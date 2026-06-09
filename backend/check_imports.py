"""Final smoke test - verifies all critical backend modules load correctly."""
import sys

errors = []

# Core framework
try:
    import fastapi, uvicorn, pydantic
    print(f"  ✅ FastAPI {fastapi.__version__}, Uvicorn {uvicorn.__version__}, Pydantic {pydantic.__version__}")
except Exception as e:
    errors.append(f"FastAPI stack: {e}")

# ML / Embeddings
try:
    from sentence_transformers import SentenceTransformer
    print(f"  ✅ sentence-transformers OK")
except Exception as e:
    errors.append(f"sentence-transformers: {e}")

# Vector DB
try:
    import chromadb
    print(f"  ✅ ChromaDB {chromadb.__version__}")
except Exception as e:
    errors.append(f"ChromaDB: {e}")

# Gemini new SDK
try:
    from google import genai
    from google.genai import types
    print(f"  ✅ google-genai OK")
except Exception as e:
    errors.append(f"google-genai: {e}")

# Graph
try:
    import networkx as nx
    print(f"  ✅ NetworkX {nx.__version__}")
except Exception as e:
    errors.append(f"NetworkX: {e}")

# Git
try:
    import git
    print(f"  ✅ GitPython OK")
except Exception as e:
    errors.append(f"GitPython: {e}")

# Our own modules
try:
    sys.path.insert(0, '.')
    from ingestion.ast_parser import parse_file, CodeChunk
    from ingestion.graph_builder import build_dependency_graph
    from query.classifier import classify_query, QueryType
    from models.schemas import IngestRequest, QueryRequest
    print(f"  ✅ All project modules import OK")
except Exception as e:
    errors.append(f"Project modules: {e}")

# Classifier test
try:
    q = classify_query("Where is authentication implemented?")
    assert q == QueryType.WHERE, f"Expected WHERE, got {q}"
    q2 = classify_query("Refactor this database module")
    assert q2 == QueryType.REFACTOR
    q3 = classify_query("Why does this error happen?")
    assert q3 in (QueryType.WHY, QueryType.DEBUG)
    print(f"  ✅ Query classifier working (WHERE, REFACTOR, WHY)")
except Exception as e:
    errors.append(f"Classifier: {e}")

# AST parser test
try:
    sample = '''
def hello(name: str) -> str:
    """Say hello."""
    return f"Hello, {name}!"

class Greeter:
    def greet(self):
        pass
'''
    chunks = parse_file("test.py", sample)
    assert len(chunks) >= 2, f"Expected >=2 chunks, got {len(chunks)}"
    names = [c.name for c in chunks]
    assert 'hello' in names and 'Greeter' in names, f"Missing chunks: {names}"
    print(f"  ✅ AST parser: found {len(chunks)} chunks {names}")
except Exception as e:
    errors.append(f"AST parser: {e}")

print()
if errors:
    print(f"❌ {len(errors)} error(s):")
    for err in errors:
        print(f"  - {err}")
    sys.exit(1)
else:
    print("🎉 ALL CHECKS PASSED — Backend is ready to launch!")
