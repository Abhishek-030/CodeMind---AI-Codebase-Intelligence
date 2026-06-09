from pathlib import Path
from typing import List
import chromadb
from sentence_transformers import SentenceTransformer

CHROMA_DIR = Path("./chroma_db")
_model = None
_client = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print("Loading embedding model...")
        _model = SentenceTransformer('all-MiniLM-L6-v2')
        print("Model loaded.")
    return _model


def get_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return _client


def get_collection(repo_id: str):
    client = get_client()
    try:
        # ChromaDB >= 1.0 uses 'configuration' for HNSW settings
        return client.get_or_create_collection(
            name=f"repo_{repo_id}",
            configuration={"hnsw": {"space": "cosine"}}
        )
    except Exception:
        # Fallback for older ChromaDB
        return client.get_or_create_collection(name=f"repo_{repo_id}")


def embed_chunks(repo_id: str, chunks: List) -> int:
    if not chunks:
        return 0
    model = get_model()
    collection = get_collection(repo_id)

    batch_size = 64
    total = 0
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        texts = [
            f"{c.chunk_type} {c.name or 'unnamed'} in {c.file_path}:\n{c.content[:800]}"
            for c in batch
        ]
        embeddings = model.encode(texts, show_progress_bar=False).tolist()
        ids = [f"{repo_id}_{i + j}" for j in range(len(batch))]
        metadatas = [{
            "file_path": c.file_path,
            "start_line": c.start_line,
            "end_line": c.end_line,
            "chunk_type": c.chunk_type,
            "name": c.name or "",
            "language": c.language,
            "content": c.content[:2000]
        } for c in batch]
        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas
        )
        total += len(batch)
    return total


def search(repo_id: str, query: str, n_results: int = 10) -> List[dict]:
    model = get_model()
    collection = get_collection(repo_id)
    count = collection.count()
    if count == 0:
        return []
    query_embedding = model.encode([query])[0].tolist()
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(n_results, count)
    )
    if not results['ids'][0]:
        return []
    return [
        {**meta, "distance": dist}
        for meta, dist in zip(results['metadatas'][0], results['distances'][0])
    ]


def delete_collection(repo_id: str):
    client = get_client()
    try:
        client.delete_collection(f"repo_{repo_id}")
    except Exception:
        pass
