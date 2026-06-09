import os
import json
import shutil
import zipfile
import uuid
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from models.schemas import IngestRequest, QueryRequest
from ingestion.repo_loader import clone_repo, walk_files, read_file_safe, REPOS_DIR
from ingestion.ast_parser import parse_file
from ingestion.embedder import embed_chunks, delete_collection
from ingestion.graph_builder import build_dependency_graph
from query.llm_chain import stream_answer
from agents.debugger_agent import agentic_debug

REGISTRY_FILE = REPOS_DIR / "registry.json"
REPOS: dict = {}
GRAPHS: dict = {}


def load_repos():
    if REGISTRY_FILE.exists():
        try:
            data = json.loads(REGISTRY_FILE.read_text())
            REPOS.update(data)
        except Exception:
            pass


def save_repos():
    REPOS_DIR.mkdir(exist_ok=True)
    REGISTRY_FILE.write_text(json.dumps(REPOS, indent=2))


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_repos()
    yield


app = FastAPI(
    title="AI Codebase Understanding Engine",
    version="1.0.0",
    description="Feed a repository, ask natural language questions about it.",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def ingest_repo_task(repo_id: str, repo_path: Path, repo_name: str):
    """Background ingestion pipeline."""
    try:
        REPOS[repo_id]["status"] = "indexing"
        save_repos()

        files = walk_files(repo_path)
        REPOS[repo_id]["file_count"] = len(files)

        all_chunks = []
        for fpath in files:
            content = read_file_safe(fpath)
            if not content or len(content.strip()) < 20:
                continue
            try:
                rel_path = str(fpath.relative_to(repo_path)).replace('\\', '/')
            except ValueError:
                continue
            chunks = parse_file(rel_path, content)
            all_chunks.extend(chunks)

        chunk_count = embed_chunks(repo_id, all_chunks)
        graph_data = build_dependency_graph(repo_path, files)
        GRAPHS[repo_id] = graph_data

        REPOS[repo_id].update({
            "status": "ready",
            "chunk_count": chunk_count,
            "file_count": len(files),
        })
        save_repos()
        print(f"[Ingestion] {repo_name}: {len(files)} files, {chunk_count} chunks indexed.")

    except Exception as e:
        print(f"[Ingestion ERROR] {repo_name}: {e}")
        REPOS[repo_id]["status"] = "error"
        REPOS[repo_id]["error"] = str(e)
        save_repos()


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/repos")
async def list_repos():
    return list(REPOS.values())


@app.get("/api/repos/{repo_id}")
async def get_repo(repo_id: str):
    if repo_id not in REPOS:
        raise HTTPException(404, "Repository not found")
    return REPOS[repo_id]


@app.post("/api/repos/ingest/url")
async def ingest_url(request: IngestRequest, background_tasks: BackgroundTasks):
    if not request.github_url:
        raise HTTPException(400, "github_url is required")
    try:
        repo_id, repo_path = clone_repo(request.github_url)
        repo_name = request.github_url.rstrip('/').split('/')[-1].replace('.git', '')
        REPOS[repo_id] = {
            "repo_id": repo_id,
            "name": repo_name,
            "url": request.github_url,
            "status": "pending",
            "file_count": 0,
            "chunk_count": 0,
            "repo_path": str(repo_path),
        }
        save_repos()
        background_tasks.add_task(ingest_repo_task, repo_id, repo_path, repo_name)
        return {"repo_id": repo_id, "name": repo_name, "status": "pending"}
    except Exception as e:
        raise HTTPException(500, f"Failed to clone repository: {str(e)}")


@app.post("/api/repos/ingest/upload")
async def ingest_upload(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith('.zip'):
        raise HTTPException(400, "Only ZIP files are supported")

    repo_id = str(uuid.uuid4())[:8]
    repo_path = REPOS_DIR / repo_id
    repo_path.mkdir(parents=True, exist_ok=True)

    try:
        content_bytes = await file.read()
        zip_path = repo_path / "upload.zip"
        zip_path.write_bytes(content_bytes)

        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(repo_path)
        zip_path.unlink()

        contents = [c for c in repo_path.iterdir()]
        actual_path = contents[0] if (len(contents) == 1 and contents[0].is_dir()) else repo_path

        repo_name = file.filename.replace('.zip', '')
        REPOS[repo_id] = {
            "repo_id": repo_id,
            "name": repo_name,
            "url": "",
            "status": "pending",
            "file_count": 0,
            "chunk_count": 0,
            "repo_path": str(actual_path),
        }
        save_repos()
        background_tasks.add_task(ingest_repo_task, repo_id, actual_path, repo_name)
        return {"repo_id": repo_id, "name": repo_name, "status": "pending"}
    except Exception as e:
        shutil.rmtree(repo_path, ignore_errors=True)
        raise HTTPException(500, f"Upload failed: {str(e)}")


@app.delete("/api/repos/{repo_id}")
async def delete_repo(repo_id: str):
    if repo_id not in REPOS:
        raise HTTPException(404, "Repository not found")
    repo_path_str = REPOS[repo_id].get("repo_path", "")
    if repo_path_str:
        shutil.rmtree(repo_path_str, ignore_errors=True)
    delete_collection(repo_id)
    del REPOS[repo_id]
    GRAPHS.pop(repo_id, None)
    save_repos()
    return {"message": "Repository deleted successfully"}


@app.post("/api/query")
async def query_repo(request: QueryRequest):
    if request.repo_id not in REPOS:
        raise HTTPException(404, "Repository not found")
    if REPOS[request.repo_id]["status"] != "ready":
        raise HTTPException(400, f"Repository not ready. Status: {REPOS[request.repo_id]['status']}")
    return StreamingResponse(
        stream_answer(request.repo_id, request.question),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@app.post("/api/debug")
async def debug_repo(request: QueryRequest):
    if request.repo_id not in REPOS:
        raise HTTPException(404, "Repository not found")
    if REPOS[request.repo_id]["status"] != "ready":
        raise HTTPException(400, "Repository not ready")
    repo_path = REPOS[request.repo_id].get("repo_path", "")
    return StreamingResponse(
        agentic_debug(request.repo_id, request.question, repo_path),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@app.get("/api/graph/{repo_id}")
async def get_graph(repo_id: str):
    if repo_id not in REPOS:
        raise HTTPException(404, "Repository not found")
    if repo_id in GRAPHS:
        return GRAPHS[repo_id]
    repo_path = Path(REPOS[repo_id].get("repo_path", ""))
    if not repo_path.exists():
        raise HTTPException(404, "Repository files not found on disk")
    files = walk_files(repo_path)
    graph_data = build_dependency_graph(repo_path, files)
    GRAPHS[repo_id] = graph_data
    return graph_data


@app.get("/api/files/{repo_id}")
async def get_file_tree(repo_id: str):
    if repo_id not in REPOS:
        raise HTTPException(404, "Repository not found")
    repo_path = Path(REPOS[repo_id].get("repo_path", ""))
    if not repo_path.exists():
        raise HTTPException(404, "Repository path not found")

    from ingestion.repo_loader import IGNORE_DIRS, SUPPORTED_EXTENSIONS
    tree = []
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith('.')]
        for fname in files:
            fpath = Path(root) / fname
            if fpath.suffix in SUPPORTED_EXTENSIONS:
                try:
                    rel = str(fpath.relative_to(repo_path)).replace('\\', '/')
                    tree.append({"path": rel, "name": fname, "ext": fpath.suffix})
                except ValueError:
                    pass
    return {"files": sorted(tree, key=lambda x: x['path'])}


@app.get("/api/files/{repo_id}/content")
async def get_file_content(repo_id: str, path: str):
    if repo_id not in REPOS:
        raise HTTPException(404, "Repository not found")
    repo_path = Path(REPOS[repo_id].get("repo_path", ""))
    full_path = repo_path / path
    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(404, "File not found")
    try:
        content = full_path.read_text(encoding='utf-8', errors='ignore')
        return {"content": content, "path": path}
    except Exception as e:
        raise HTTPException(500, str(e))
