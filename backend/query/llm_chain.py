import os
import json
from typing import AsyncGenerator
from google import genai
from google.genai import types
from .retriever import retrieve_context, format_context
from .classifier import classify_query, QueryType

_client = None


def get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set. Please add it to your .env file.")
        _client = genai.Client(
            api_key=api_key,
            http_options={"api_version": "v1"}
        )
    return _client


SYSTEM_PROMPTS = {
    QueryType.WHERE: """You are an expert codebase navigator. The user wants to LOCATE where something is implemented.

Provide:
1. **Exact files** with full paths
2. **Line numbers** where the implementation starts
3. **Code snippet** showing the relevant implementation
4. **Brief explanation** of what you found

Format clearly with file paths in backticks.""",

    QueryType.EXPLAIN: """You are a senior developer explaining code to a colleague.

Provide:
1. **What it does** — high-level purpose
2. **How it works** — key logic and flow
3. **Important details** — edge cases, patterns used
4. **Dependencies** — what it relies on

Use clear markdown formatting.""",

    QueryType.WHY: """You are a senior debugging expert performing root cause analysis.

Provide:
1. **Root cause** — the core reason
2. **Code trace** — the execution path leading to this behavior
3. **Evidence** — specific lines from the code that confirm this
4. **Recommendation** — how to fix or address it""",

    QueryType.REFACTOR: """You are a principal software engineer doing a code review.

Provide:
1. **Issues identified** — what's wrong or could be better
2. **Refactoring plan** — step by step improvements
3. **Improved code** — concrete rewritten version in code blocks
4. **Benefits** — why the new approach is better""",

    QueryType.DEBUG: """You are an expert debugger tracing a bug through the codebase.

Provide:
1. **Bug location** — exact file and line
2. **Execution trace** — how the bug is triggered
3. **Why it fails** — the logical error
4. **Fix** — exact code change needed""",

    QueryType.GENERAL: """You are a codebase expert. Answer the user's question accurately and helpfully.
Use the provided code context. Reference specific files and line numbers.
Use clear markdown formatting.""",
}


async def stream_answer(repo_id: str, question: str) -> AsyncGenerator[str, None]:
    try:
        client = get_client()
    except ValueError as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        return

    query_type = classify_query(question)
    chunks = retrieve_context(repo_id, question, n=10)

    if not chunks:
        yield f"data: {json.dumps({'type': 'error', 'message': 'No relevant code found. Make sure the repository is fully indexed.'})}\n\n"
        return

    context = format_context(chunks)
    system_prompt = SYSTEM_PROMPTS.get(query_type, SYSTEM_PROMPTS[QueryType.GENERAL])

    prompt = f"""{system_prompt}

## Relevant Code Context

{context}

## User Question
{question}

## Analysis"""

    # Send metadata first
    sources = [
        {
            "file": c["file_path"],
            "start_line": c["start_line"],
            "end_line": c["end_line"],
            "name": c.get("name", ""),
            "type": c.get("chunk_type", "")
        }
        for c in chunks[:8]
    ]
    yield f"data: {json.dumps({'type': 'meta', 'query_type': query_type.value, 'sources': sources})}\n\n"

    try:
        response = client.models.generate_content_stream(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.3)
        )
        for chunk in response:
            if chunk.text:
                yield f"data: {json.dumps({'type': 'text', 'content': chunk.text})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': f'LLM error: {str(e)}'})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"
