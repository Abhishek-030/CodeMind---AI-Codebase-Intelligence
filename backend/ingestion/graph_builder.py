import re
from pathlib import Path
from typing import List, Dict, Any
import networkx as nx


def build_dependency_graph(repo_path: Path, files: List[Path]) -> Dict[str, Any]:
    G = nx.DiGraph()
    all_rel = {}
    for fpath in files:
        try:
            rel = str(fpath.relative_to(repo_path)).replace('\\', '/')
            G.add_node(rel, language=fpath.suffix.lstrip('.'))
            all_rel[rel] = fpath
        except ValueError:
            pass

    for fpath in files:
        try:
            rel = str(fpath.relative_to(repo_path)).replace('\\', '/')
            content = fpath.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            continue
        imports = _resolve_imports(content, fpath, repo_path, all_rel)
        for imp in imports:
            if imp in G.nodes and imp != rel:
                G.add_edge(rel, imp)

    return _graph_to_json(G)


def _resolve_imports(content: str, fpath: Path, repo_path: Path, all_rel: dict) -> List[str]:
    imports = []
    ext = fpath.suffix

    if ext == '.py':
        for line in content.split('\n'):
            line = line.strip()
            m = re.match(r'from\s+\.?([\w\.]+)\s+import', line)
            if m:
                mod = m.group(1).replace('.', '/')
                for candidate in [f"{mod}.py", f"{mod}/__init__.py"]:
                    if candidate in all_rel:
                        imports.append(candidate)
            m2 = re.match(r'import\s+([\w\.]+)', line)
            if m2:
                mod = m2.group(1).replace('.', '/')
                for candidate in [f"{mod}.py", f"{mod}/__init__.py"]:
                    if candidate in all_rel:
                        imports.append(candidate)

    elif ext in ('.js', '.ts', '.jsx', '.tsx'):
        pattern = r"['\"]([\./][^'\"]+)['\"]"
        for match in re.finditer(pattern, content):
            imp_raw = match.group(1)
            if imp_raw.startswith('.'):
                base = fpath.parent
                try:
                    resolved = (base / imp_raw).resolve()
                    for suffix in ['', '.js', '.ts', '.jsx', '.tsx', '/index.js', '/index.ts']:
                        try:
                            candidate_path = Path(str(resolved) + suffix) if suffix else resolved
                            rel_candidate = str(candidate_path.relative_to(repo_path.resolve())).replace('\\', '/')
                            if rel_candidate in all_rel:
                                imports.append(rel_candidate)
                                break
                        except ValueError:
                            pass
                except Exception:
                    pass
    return imports


def _graph_to_json(G: nx.DiGraph) -> Dict[str, Any]:
    try:
        centrality = nx.degree_centrality(G)
    except Exception:
        centrality = {}

    nodes = []
    for node, data in G.nodes(data=True):
        nodes.append({
            "id": node,
            "label": Path(node).name,
            "language": data.get("language", ""),
            "in_degree": G.in_degree(node),
            "out_degree": G.out_degree(node),
            "centrality": centrality.get(node, 0)
        })

    edges = [{"source": u, "target": v} for u, v in G.edges()]

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "node_count": G.number_of_nodes(),
            "edge_count": G.number_of_edges(),
        }
    }
