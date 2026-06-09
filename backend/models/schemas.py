from pydantic import BaseModel
from typing import Optional


class IngestRequest(BaseModel):
    github_url: Optional[str] = None


class QueryRequest(BaseModel):
    repo_id: str
    question: str
