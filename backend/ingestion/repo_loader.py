import os
import uuid
import shutil
import zipfile
from pathlib import Path
from typing import Optional
import git

REPOS_DIR = Path("./repos")
REPOS_DIR.mkdir(exist_ok=True)

SUPPORTED_EXTENSIONS = {
    '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.rs',
    '.cpp', '.c', '.h', '.hpp', '.cs', '.rb', '.php', '.swift',
    '.kt', '.scala', '.vue', '.svelte', '.md'
}

IGNORE_DIRS = {
    'node_modules', '.git', '__pycache__', 'dist', 'build',
    '.venv', 'venv', 'env', 'vendor', '.idea', '.vscode',
    'coverage', '.nyc_output', 'target', 'out', 'bin', 'obj',
    '.next', '.nuxt', 'eggs', '*.egg-info'
}


def clone_repo(github_url: str) -> tuple:
    repo_id = str(uuid.uuid4())[:8]
    repo_path = REPOS_DIR / repo_id
    git.Repo.clone_from(github_url, str(repo_path), depth=1)
    return repo_id, repo_path


def walk_files(repo_path: Path) -> list:
    files = []
    for root, dirs, filenames in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith('.')]
        for filename in filenames:
            fpath = Path(root) / filename
            if fpath.suffix in SUPPORTED_EXTENSIONS:
                files.append(fpath)
    return files


def read_file_safe(fpath: Path) -> Optional[str]:
    try:
        return fpath.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        return None
