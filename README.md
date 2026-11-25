# Lyftr Relay — Resilient LLM Chat Gateway

## 1. Live URLs

| Tier     | URL                          |
|----------|------------------------------|
| Frontend | *(deploy to Vercel/Netlify)* |
| Backend  | *(deploy to Render/Railway)* |

> Update this table after deployment.
>
> **Cold-start note:** Free-tier backend hosts spin down after inactivity; the first request after idle may take ~20–50 seconds while the container wakes and LiteLLM loads. `GET /health` is kept lightweight so it serves cleanly as both a readiness check and a warm-up ping.

---

## 2. Run locally

### With Docker (recommended)

```bash
# 1. Copy the example env file and fill in your API keys
cp .env.example .env
# Edit .env — set LLM_API_KEYS to at least two comma-separated keys

# 2. Start both services
make up
# Backend: http://localhost:8000
# Frontend: http://localhost:3000

# 3. Stop everything
make down
```

> **Note:** SQLite data is stored in the Docker named volume `lyftar_app_data` and survives container restarts.

### Without Docker

**Backend:**
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt

# Set required environment variables (copy from .env.example)
# Linux/Mac (bash/zsh):
export LLM_API_KEYS=key1,key2 DATABASE_URL=sqlite:///./data/app.db ALLOWED_ORIGINS=http://localhost:3000 ENABLE_FAILURE_SIMULATION=true LITELLM_LOCAL_MODEL_COST_MAP=True
# Windows (PowerShell):
# $env:LLM_API_KEYS="key1,key2"; $env:DATABASE_URL="sqlite:///./data/app.db"; $env:ALLOWED_ORIGINS="http://localhost:3000"; $env:ENABLE_FAILURE_SIMULATION="true"; $env:LITELLM_LOCAL_MODEL_COST_MAP="True"

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd frontend
npm install
# Set VITE_API_BASE_URL in a local .env file:
echo "VITE_API_BASE_URL=http://localhost:8000" > .env
npm run dev
# Frontend: http://localhost:3000
```

**Run backend tests (no real API keys needed):**
```bash
cd backend
.venv\Scripts\python.exe -m pytest tests/ -v
```

---

## 3. Design decisions

### Key fallback
The backend loads `LLM_API_KEYS` (comma-separated) into an ordered pool at startup — `key_1`, `key_2`, … For every `/chat` request the gateway iterates the pool in order with a bounded per-key timeout (`LLM_TIMEOUT_SECONDS`). When a key returns HTTP `429`, a quota/rate-limit error, timeout/connection error, or any `5xx` (or raises LiteLLM `RateLimitError`, `InternalServerError`, `ServiceUnavailableError`, `Timeout`, or `APIConnectionError`), the error is recorded, `fallback_attempts` is incremented, and the next key is tried. Non-retryable client errors (e.g. `BadRequestError`) stop immediately so invalid requests do not exhaust the pool silently. If every key fails, `AllProvidersUnavailableError` is raised and the route converts it to `503 {"detail": "all providers unavailable"}`. Failed requests are never persisted to the session history, and unhandled exceptions redact configured API keys before logging.

### Caching
LiteLLM's built-in `Cache(type="local")` (in-memory; `disk` cache type was removed in LiteLLM 1.111) is enabled globally at startup. The cache key is composed of `model + messages + temperature` — deliberately excluding `api_key` so a cached response from `key_1` is served regardless of which key would handle a live call next. Cache lookup runs before the provider loop so cache hits never consume an API key; hits return the exact cached reply, stored prompt/completion token counts, `key_id: null`, and `fallback_attempts: 0`.

**Design decision — simulation bypasses cache:** When `X-Simulate-Failure` is present, the cache read is skipped so failover can be demonstrated on demand even for previously-seen prompts. This is documented here and in the Verification section.

### SQLite session storage
Each chat session is stored in a `sessions` table (for the system prompt) and a `messages` table (for the conversation turns). The schema is created automatically on startup. User and assistant messages for each turn are written in a single `BEGIN IMMEDIATE` transaction, so a failure mid-turn leaves history unchanged. WAL journal mode and a 5-second busy timeout ensure reliable concurrent access. The file lives on a Docker named volume (`/data/app.db`) so it survives container restarts.

---

## 4. Verification

### Curl commands (replace `BASE` with your backend URL)

```bash
BASE=http://localhost:8000

# 1. Health check
curl $BASE/health

# 2. Send a fresh message (expect LIVE_INFERENCE)
curl -s -X POST $BASE/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id":"s-demo-1","message":"What is the capital of France?"}' | python -m json.tool

# 3. Same message in a NEW session (expect LLM_CACHE, identical reply, lower latency)
curl -s -X POST $BASE/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id":"s-demo-2","message":"What is the capital of France?"}' | python -m json.tool

# 4. Follow-up in session 1 (bot remembers prior turn)
curl -s -X POST $BASE/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id":"s-demo-1","message":"What language do they speak there?"}' | python -m json.tool

# 5. Failover: key_1 → 429, key_2 responds (expect key_id=key_2, fallback_attempts=1)
curl -s -X POST $BASE/chat \
  -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: key_1=429" \
  -d '{"session_id":"s-fail-demo","message":"failover test"}' | python -m json.tool

# 6. All keys fail → 503
curl -s -X POST $BASE/chat \
  -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: *=429" \
  -d '{"session_id":"s-fail-all","message":"doom"}' | python -m json.tool

# 7. Validation: empty message → 422
curl -s -X POST $BASE/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id":"s-val","message":""}' | python -m json.tool

# 8. Session history
curl $BASE/sessions/s-demo-1/messages | python -m json.tool
curl $BASE/sessions/nonexistent/messages   # → 404
```

---

## 5. Setup Used

- **Editor:** Antigravity (agentic AI assistant)  
- **AI tools:** Antigravity / Gemini / Claude for code generation and architecture decisions  
- **Language / runtime:** Python 3.12, Node.js 22  
- **Key libraries:** FastAPI 0.115, LiteLLM 1.111, Uvicorn, Pydantic 2.14, React 18, Vite 5  

---

## 6. Bonus features

| Feature | Rationale |
|---------|-----------|
| **System prompt field in UI** | Low-cost way to demonstrate per-session prompting without extra backend work |
| **"New Session" button** | Lets a reviewer quickly start a fresh session to test cache hits without reloading the page |
| **Deterministic temperature = 0.0** | Makes cache semantics predictable and reproducible; documented as a design choice |
| **`LITELLM_LOCAL_MODEL_COST_MAP=True`** | Prevents LiteLLM from fetching its price map over the network, which would fail in sandboxed / offline environments and slow cold starts |
| **Global FastAPI catch-all exception handler** | Ensures no endpoint ever leaks a stack trace or HTML error page — all unexpected errors become `{"detail": "internal server error"}` |
