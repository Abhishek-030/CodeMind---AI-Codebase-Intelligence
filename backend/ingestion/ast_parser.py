import ast
import re
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass


@dataclass
class CodeChunk:
    file_path: str
    start_line: int
    end_line: int
    content: str
    chunk_type: str  # function, class, module
    name: Optional[str]
    language: str
    docstring: Optional[str] = None


def parse_python(content: str, file_path: str) -> List[CodeChunk]:
    chunks = []
    lines = content.split('\n')
    try:
        tree = ast.parse(content)
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                start = node.lineno - 1
                end = getattr(node, 'end_lineno', start + 20)
                chunk_content = '\n'.join(lines[start:end])
                docstring = None
                if (node.body and isinstance(node.body[0], ast.Expr)
                        and isinstance(node.body[0].value, ast.Constant)):
                    # Use .value (Python 3.8+) — .s was removed in 3.12
                    docstring = str(node.body[0].value.value)[:500]
                chunks.append(CodeChunk(
                    file_path=file_path,
                    start_line=start + 1,
                    end_line=end,
                    content=chunk_content[:3000],
                    chunk_type='class' if isinstance(node, ast.ClassDef) else 'function',
                    name=node.name,
                    language='python',
                    docstring=docstring
                ))
    except SyntaxError:
        pass

    if not chunks:
        chunks = chunk_by_lines(content, file_path, 'python')
    return chunks


def parse_javascript(content: str, file_path: str) -> List[CodeChunk]:
    chunks = []
    lines = content.split('\n')

    patterns = [
        (r'^(?:export\s+)?(?:async\s+)?function\s+(\w+)', 'function'),
        (r'^(?:export\s+)?class\s+(\w+)', 'class'),
        (r'^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\()', 'function'),
        (r'^(?:export\s+default\s+)?(?:async\s+)?function\s*(\w*)', 'function'),
    ]

    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        matched = False
        for pattern, ptype in patterns:
            m = re.match(pattern, stripped)
            if m:
                name = m.group(1) if m.lastindex and m.group(1) else f'anonymous_{i}'
                start = i
                brace_count = stripped.count('{') - stripped.count('}')
                j = i + 1
                if brace_count > 0:
                    while j < len(lines) and brace_count > 0:
                        brace_count += lines[j].count('{') - lines[j].count('}')
                        j += 1
                else:
                    j = min(i + 30, len(lines))

                chunk_content = '\n'.join(lines[start:j])
                if len(chunk_content) > 30:
                    chunks.append(CodeChunk(
                        file_path=file_path,
                        start_line=start + 1,
                        end_line=j,
                        content=chunk_content[:3000],
                        chunk_type=ptype,
                        name=name,
                        language='javascript'
                    ))
                i = j
                matched = True
                break
        if not matched:
            i += 1

    return chunks if chunks else chunk_by_lines(content, file_path, 'javascript')


def chunk_by_lines(content: str, file_path: str, language: str, chunk_size: int = 60) -> List[CodeChunk]:
    lines = content.split('\n')
    chunks = []
    for i in range(0, len(lines), chunk_size):
        chunk_lines = lines[i:i + chunk_size]
        if any(line.strip() for line in chunk_lines):
            chunks.append(CodeChunk(
                file_path=file_path,
                start_line=i + 1,
                end_line=min(i + chunk_size, len(lines)),
                content='\n'.join(chunk_lines)[:3000],
                chunk_type='module',
                name=None,
                language=language
            ))
    return chunks


LANG_MAP = {
    '.py': 'python',
    '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript',
    '.ts': 'typescript', '.tsx': 'typescript',
    '.java': 'java', '.go': 'go', '.rs': 'rust',
    '.cpp': 'cpp', '.c': 'c', '.h': 'c', '.hpp': 'cpp',
    '.cs': 'csharp', '.rb': 'ruby', '.php': 'php',
    '.swift': 'swift', '.kt': 'kotlin', '.scala': 'scala',
    '.vue': 'javascript', '.svelte': 'javascript',
    '.md': 'markdown',
}


def parse_file(file_path: str, content: str) -> List[CodeChunk]:
    ext = Path(file_path).suffix.lower()
    lang = LANG_MAP.get(ext, 'text')
    if lang == 'python':
        return parse_python(content, file_path)
    elif lang in ('javascript', 'typescript'):
        return parse_javascript(content, file_path)
    else:
        return chunk_by_lines(content, file_path, lang)


def extract_imports(content: str, language: str) -> List[str]:
    imports = []
    if language == 'python':
        for line in content.split('\n'):
            line = line.strip()
            if line.startswith('import ') or line.startswith('from '):
                imports.append(line)
    elif language in ('javascript', 'typescript'):
        pattern = r"(?:import|require)\s*(?:\{[^}]*\}|\w+|\*)\s*(?:from\s*)?['\"]([^'\"]+)['\"]"
        imports = re.findall(pattern, content)
    return imports
