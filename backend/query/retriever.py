from ingestion.embedder import search as vector_search


def retrieve_context(repo_id: str, query: str, n: int = 10) -> list:
    return vector_search(repo_id, query, n_results=n)


def format_context(chunks: list) -> str:
    parts = []
    for c in chunks:
        parts.append(
            f"=== {c['file_path']} (lines {c['start_line']}-{c['end_line']}, type: {c['chunk_type']}, name: {c.get('name', 'N/A')}) ===\n"
            f"{c['content']}\n"
        )
    return "\n".join(parts)
