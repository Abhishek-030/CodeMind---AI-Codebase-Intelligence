# 🧠 CodeMind — AI-Powered Codebase Understanding Engine

> Feed any repository. Ask natural language questions. Get intelligent answers.

![CodeMind](https://img.shields.io/badge/AI-Powered-7c3aed?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-FastAPI-3b82f6?style=for-the-badge)
![React](https://img.shields.io/badge/React-Vite-06b6d4?style=for-the-badge)

---

## 🚀 Features

| Feature | Description |
|---|---|
| **Semantic Search** | Embed code chunks with `sentence-transformers`, store in ChromaDB |
| **AST Parsing** | Parse Python with `ast`, JavaScript/TypeScript with regex-based parser |
| **Dependency Graphs** | Build import graphs with NetworkX, visualize with D3.js |
| **Natural Language Q&A** | Ask "where", "why", "explain", "refactor" questions |
| **Agentic Debugger** | Multi-step agent that traces bugs across files |
| **Streaming Responses** | Real-time SSE streaming from Gemini 1.5 Flash |
| **File Browser** | Browse all repo files with syntax highlighting |

---

## 🏗️ Architecture

```
Frontend (React + Vite)          Backend (FastAPI)
┌─────────────────────┐          ┌──────────────────────────────┐
│  Chat Interface     │◄────────►│  POST /api/query  (SSE)      │
│  Dependency Graph   │◄────────►│  POST /api/debug  (SSE)      │
│  Code Viewer        │◄────────►│  GET  /api/graph/{id}        │
│  Repo Loader        │◄────────►│  POST /api/repos/ingest/url  │
└─────────────────────┘          └──────┬───────────────────────┘
                                        │
                           ┌────────────▼────────────┐
                           │  Ingestion Pipeline      │
                           │  ├── AST Parser          │
                           │  ├── Embedder            │  
                           │  └── Graph Builder       │
                           └────────────┬────────────┘
                                        │
                           ┌────────────▼────────────┐
                           │  ChromaDB (Vectors)      │
                           │  NetworkX (Graph)        │
                           │  Gemini 1.5 Flash (LLM)  │
                           └─────────────────────────┘
```

---

## 📋 Prerequisites

- Python 3.10+
- Node.js 18+
- Git
- A **Gemini API key** (free at [aistudio.google.com](https://aistudio.google.com))

---

## ⚡ Quick Start

### 1. Clone this project
```bash
git clone <this-repo>
cd codebase-engine
```

### 2. Set up Backend
```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Configure API key
copy .env.example .env
# Edit .env and add: GEMINI_API_KEY=your_key_here

# Start backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Set up Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Open the app
Navigate to **http://localhost:3000**

---

## 🎯 Usage

### Loading a Repository
1. Click **"Load Repository"** in the sidebar
2. Enter a GitHub URL (e.g., `https://github.com/pallets/flask`) OR upload a ZIP
3. Wait for indexing to complete (shown by progress indicator)
4. Repository turns ✅ **Ready**

### Asking Questions
Once ready, switch to the **Ask AI** tab and try:

| Query Type | Example |
|---|---|
| **Where** | "Where is authentication implemented?" |
| **Explain** | "How does the request routing work?" |
| **Why** | "Why does this function return None sometimes?" |
| **Refactor** | "How can I improve the database connection module?" |
| **Debug** | "Trace why login fails after session expiry" |

### Agentic Debug Mode
Switch to **🔍 Agentic Debug** mode to enable multi-step reasoning:
- Agent searches codebase semantically
- Reads relevant files in full
- Traces dependency chains
- Produces root cause analysis

### Dependency Graph
Click the **🕸️ Dep Graph** tab to:
- See an interactive force-directed graph of all file dependencies
- Hover nodes for file details
- Drag to rearrange
- Zoom and pan
- Search/highlight specific files

### File Browser
Click **📁 Files** tab to:
- Browse all indexed files with a directory tree
- Click any file to view with full syntax highlighting

---

## 🧪 Demo Repositories (Suggested)

| Repo | Size | Good For |
|---|---|---|
| `https://github.com/pallets/flask` | ~250 files | Python web framework |
| `https://github.com/expressjs/express` | ~150 files | Node.js web framework |
| `https://github.com/tiangolo/fastapi` | ~300 files | FastAPI (meta!) |
| `https://github.com/django/django` | Large | Python Django (tests scalability) |

---

## 🔧 Tech Stack

### Backend
- **FastAPI** — REST API + SSE streaming
- **sentence-transformers** — `all-MiniLM-L6-v2` for code embeddings
- **ChromaDB** — local vector database
- **Google Gemini 1.5 Flash** — LLM for Q&A
- **NetworkX** — dependency graph construction
- **GitPython** — repository cloning
- **Python `ast`** — Python AST parsing

### Frontend
- **React 18 + Vite + TypeScript**
- **D3.js** — interactive force-directed dependency graph
- **react-markdown + react-syntax-highlighter** — rich rendering
- **Server-Sent Events** — real-time streaming responses

---

## 📁 Project Structure

```
codebase-engine/
├── backend/
│   ├── main.py                    # FastAPI application
│   ├── requirements.txt
│   ├── .env.example
│   ├── ingestion/
│   │   ├── repo_loader.py         # Git cloning + file walking
│   │   ├── ast_parser.py          # AST-based code chunking
│   │   ├── embedder.py            # sentence-transformers + ChromaDB
│   │   └── graph_builder.py       # NetworkX dependency graphs
│   ├── query/
│   │   ├── classifier.py          # Query type detection
│   │   ├── retriever.py           # RAG retrieval
│   │   └── llm_chain.py           # Gemini streaming chains
│   ├── agents/
│   │   └── debugger_agent.py      # Multi-step agentic debugger
│   └── models/
│       └── schemas.py             # Pydantic models
└── frontend/
    ├── src/
    │   ├── App.tsx                # Main layout + state
    │   ├── api/client.ts          # API client + SSE streaming
    │   ├── types/index.ts         # TypeScript types
    │   ├── components/
    │   │   ├── Sidebar.tsx        # Repo list + management
    │   │   ├── RepoLoader.tsx     # GitHub URL / ZIP uploader
    │   │   ├── Chat/              # Streaming chat interface
    │   │   ├── Graph/             # D3.js dependency graph
    │   │   └── CodeViewer/        # File browser + syntax highlighting
    │   └── index.css              # Dark glassmorphism design system
    ├── index.html
    └── package.json
```

---

## 🎓 Internship Project Notes

This project demonstrates:
1. **RAG (Retrieval-Augmented Generation)** — semantic search over code
2. **AST Analysis** — structured code understanding beyond text search
3. **Dependency Graph Analysis** — understanding module relationships
4. **Agentic AI** — multi-step reasoning agents with tool use
5. **Streaming LLM** — real-time response generation
6. **Full-Stack Development** — FastAPI + React production app

---

## 📝 License

MIT
