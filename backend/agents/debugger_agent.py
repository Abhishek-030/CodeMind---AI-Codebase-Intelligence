import os
import json
from pathlib import Path
from typing import AsyncGenerator
from google import genai
from google.genai import types
from ingestion.embedder import search as vector_search


def get_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")
    return genai.Client(
        api_key=api_key,
        http_options={"api_version": "v1"}
    )


async def agentic_debug(repo_id: str, error_description: str, repo_path_str: str) -> AsyncGenerator[str, None]:
    """Multi-step agentic debugger that traces through the codebase."""
    repo = Path(repo_path_str)

    # Step 1: Semantic search for relevant code
    yield f"data: {json.dumps({'type': 'step', 'step': 1, 'title': 'Searching codebase', 'message': f'Finding code related to: {error_description[:80]}...'})}\n\n"

    initial_chunks = vector_search(repo_id, error_description, n_results=8)
    if not initial_chunks:
        yield f"data: {json.dumps({'type': 'error', 'message': 'No relevant code found for this error.'})}\n\n"
        return

    relevant_files = list(dict.fromkeys(c['file_path'] for c in initial_chunks))[:5]
    yield f"data: {json.dumps({'type': 'step', 'step': 2, 'title': 'Files identified', 'message': f'Analyzing {len(relevant_files)} relevant files', 'files': relevant_files})}\n\n"

    # Step 2: Read full file contents
    file_contents = {}
    for fp in relevant_files[:4]:
        try:
            full_path = repo / fp
            if full_path.exists():
                content = full_path.read_text(encoding='utf-8', errors='ignore')[:4000]
                file_contents[fp] = content
        except Exception:
            pass

    # Step 3: Search for error-related imports and dependencies
    yield f"data: {json.dumps({'type': 'step', 'step': 3, 'title': 'Tracing dependencies', 'message': 'Following import chains and call graphs...'})}\n\n"

    dep_chunks = vector_search(repo_id, f"import error exception handler {error_description[:50]}", n_results=5)
    dep_files = list(dict.fromkeys(c['file_path'] for c in dep_chunks if c['file_path'] not in file_contents))[:2]
    for fp in dep_files:
        try:
            full_path = repo / fp
            if full_path.exists():
                content = full_path.read_text(encoding='utf-8', errors='ignore')[:3000]
                file_contents[fp] = content
        except Exception:
            pass

    yield f"data: {json.dumps({'type': 'step', 'step': 4, 'title': 'Root cause analysis', 'message': 'Performing deep analysis with AI...'})}\n\n"

    # Step 4: LLM root cause analysis
    try:
        client = get_client()
    except ValueError as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        return
    context_parts = []
    for fp, content in file_contents.items():
        context_parts.append(f"### File: {fp}\n```\n{content}\n```")
    context = "\n\n".join(context_parts)

    chunk_context = "\n".join(
        f"- {c['file_path']} lines {c['start_line']}-{c['end_line']}: {c.get('name', 'N/A')}"
        for c in initial_chunks[:6]
    )

    prompt = f"""You are an expert senior developer performing AGENTIC DEBUGGING on a codebase.

## Error / Bug Description
{error_description}

## Most Relevant Code Sections (from semantic search)
{chunk_context}

## Full File Contents
{context}

## Agentic Debug Analysis

Perform a thorough multi-step root cause analysis:

### Step 1: Identify the Bug Location
Which exact file(s) and line(s) are responsible?

### Step 2: Trace the Execution Path
How does the code flow lead to this bug? Trace function calls.

### Step 3: Root Cause
Explain exactly WHY this bug occurs.

### Step 4: Evidence
Quote specific code lines that confirm your analysis.

### Step 5: Fix
Provide the exact code change needed to fix it.

Be specific with file names, line numbers, and code snippets."""

    try:
        response = client.models.generate_content_stream(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.2)
        )
        for chunk in response:
            if chunk.text:
                yield f"data: {json.dumps({'type': 'text', 'content': chunk.text})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"
