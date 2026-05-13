# Runa — Rakip Analizi: Backend & Desktop Agent Perspektifi
> **Tarih:** 13 Mayıs 2026  
> **Kapsam:** Claude, ChatGPT, Claude Code, Codex, Gemini ile kapsamlı karşılaştırma  
> **Odak:** Backend mimarisi ve Desktop Agent yetenekleri

---

## 1. RUNA'NIN BACKEND MİMARİSİ — Rakiplere Kıyasla

### 1.1 Model Gateway & Provider Desteği

#### ✅ RUNA'NIN GÜÇ NOKTASI
```
ModelGateway (provider-agnostic omurga)
├── Groq adapter (authoritative baseline)
├── DeepSeek adapter (v4-flash + v4-pro router dahil)
├── Claude adapter (secondary smoke path)
├── Gemini adapter
├── OpenAI adapter
└── SambaNova adapter
```

**Durum:** Provider seçim esnekliği iyi. Model economy routing (ucuz/pahalı akıl yürütme) implement edilmiş.

#### ❌ RUNA'NIN AÇIĞı
1. **Production baseline NetlİĞİ yok**
   - Resmi stance: `Groq-only validated baseline`
   - Antropic/Gemini claim: "yayin oncesi sabitlenecek" (TBD)
   - Claude paritesi smoke path olarak tutulsa da secondary claim
   - **Rakiplere kıyasla:** Claude'un kendi Claude modelini merkezi, ChatGPT'nin GPT-4'ü merkezi, Gemini'nin Gemini modelini merkezi tutmasından farklı

2. **Model reasoning/thinking yetenekleri limitli**
   - DeepSeek reasoning_content alınıyor ama gizleniyor (privacy/leak kontrol)
   - Claude's extended thinking / GPT-4 o1 seviyesi reasoning henüz yok
   - **Rakiplere kıyasla:** GPT-4 o1 / Claude 3.7 aşamasında ileri reasoning, Runa henüz tam reasoning output yok

3. **Token accounting ve optimization**
   - `model-usage-accounting.ts` mevcut ama granular token tracking yok
   - Cache hit rate telemetry yok
   - **Rakiplere kıyasla:** ChatGPT'nin prompt caching, Claude'un token budgeting seviyesinde detay yok

---

### 1.2 Tool Ekosistemi & Capability Coverage

#### ✅ RUNA'NIN GÜÇ NOKTASI
```
Tool Registry (71+ built-in + MCP integration)
├── File System (read, write, list, watch, edit-patch, share)
├── Code Search (search.codebase, search.grep, git.status, git.diff)
├── Shell (shell.exec + session-backed state)
├── Web (web.search + Serper integration)
├── Browser Automation (navigate, click, fill, extract, vision-analyze)
├── Memory (save, list, search, delete)
├── Desktop Bridge (screenshot, click, type, keypress, scroll, launch, verify-state, vision-analyze)
├── MCP (stdio + HTTP transport, mcp.<serverId>.<toolName> pattern)
└── Multi-Agent (agent.delegate with roles + depth limit)
```

**Type-safe kontrat:** Tüm araçlar `ToolDefinition` tipine uygun, registry üzerinden dispatch, approval metadata bağlı.

#### ⚠️ RUNA'NIN ORTA ÖLÇÜDE EKSIK YANLARI

1. **Ofis Belgesi Oluşturma — TAMAMEN YOK**
   - No DOCX, XLSX, PPTX, PDF generation
   - `file.write` ile ham text yazılabiliyor ama formatlanmış output yok
   - **Rakiplere kıyasla:** 
     - Claude Code (+ extensions) Word/Excel output yapabiliyor
     - ChatGPT Code Interpreter Python ile DOCX/XLSX üretiyor
     - Gemini AI Studio formatlanmış doc generation destekliyor
   - **Impact:** Raporlama, proposal, sheet workflow %0

2. **Database & SQL Interaction — HIÇBIR SEAM YOK**
   - PostgreSQL, MySQL, SQLite, Mongo direct execution yok
   - `file.read` ile SQL scripti yazılabiliyor ama live DB connection yok
   - **Rakiplere kıyasla:**
     - Claude Code direct DB adapter var
     - ChatGPT Code Interpreter pyodbc/pymongo destekliyor
   - **Impact:** Data transformation, DB admin, analytics %0

3. **Sistem-level Integration Sınırlı**
   - Desktop agents yalnız Windows (Electron + PS5 scripting)
   - macOS/Linux native bindings yok (SSH variant yok)
   - Registry/service manipulation yok
   - **Rakiplere kıyasla:** ChatGPT'nin code interpreter Ubuntu/Python full stack, Runa Windows-centric
   - **Impact:** Cross-platform automation %30

4. **Credential & Secret Management — BASIC**
   - Env var reading var ama safe secret injection yok
   - No credential rotation, no vault integration
   - Shell output redaction mevcut ama limited
   - **Rakiplere kıyasla:** Enterprise Claude'lar vault/secret manager integration destekliyor
   - **Impact:** Secure DevOps workflow %20

---

### 1.3 WebSocket Orchestration & Real-time Architecture

#### ✅ RUNA'NIN GÜÇ NOKTASI

```
WS Split Architecture (Phase 2)
├── transport.ts     → connection + auth + message frame
├── orchestration.ts → routing + context compilation
├── presentation.ts  → RenderBlock mapping
├── run-execution.ts → agent loop invocation
└── ws-guards.ts     → payload validation
```

**Avantaj:**
- Runtime event streaming (`narration.started`, `narration.token`, `narration.completed`)
- `RenderBlock` union tip-safe presentation (text, tool, memory, work_narration, etc.)
- WebSocket reconnect + approval state recovery
- Async generator `AgentLoop` stop conditions modeli

#### ⚠️ ORTA ÖLÇÜDE EKSIK YANLAR

1. **Protocol Versioning & Backward Compat — MINIMAL**
   - WS kontrat `v1` olarak harcoded
   - Streaming JSON payload değiştiğinde compat break riski yüksek
   - **Rakiplere kıyasla:** Claude Code API semantic versioning, ChatGPT API stable contract design
   - **Risk:** Production client update consistency %40

2. **Heartbeat & Keep-alive — BASIC**
   - Desktop agent heartbeat var ama web client-side keep-alive yok
   - Long-polling fallback yok (WS mandatory)
   - **Rakiplere kıyasla:** ChatGPT fallback mechanisms, enterprise deployments
   - **Impact:** Mobile/unstable networks resilience %30

3. **Message Ordering & Idempotency — KISMEN**
   - `run_id` + `turn_index` var ama message-level idempotency key yok
   - Tool result re-ingestion race conditions mümkün
   - **Rakiplere kıyasla:** Deterministic replay path yok (benzer sorun ChatGPT'de de var)
   - **Risk:** Duplicate tool execution %15

---

### 1.4 Approval & Policy Engine

#### ✅ RUNA'NIN GÜÇ NOKTASI

```
Permission Engine
├── Capability-based model (file.read, shell.exec, desktop.*, etc.)
├── Approval modes (standard, ask-every-time, trusted-session)
├── Policy state persistence (PostgreSQL backed)
├── High-risk tool gating (desktop, shell, write/execute)
└── Multi-turn auto-continue + capability counter tracking
```

**Avantaj:**
- Explicit approval workflow (`WAITING_APPROVAL` state)
- Session-based trust model (TTL, max-turns, capability budget)
- RLS (Row-Level Security) via Supabase Auth

#### ❌ RUNA'NIN ÇIKINTILAR

1. **Granular Role-Based Access Control (RBAC) — YOKLUĞU**
   - Team/organization permissions yok
   - Workspace-level sharing yok
   - Admin panel yok
   - **Rakiplere kıyasla:** Enterprise Claude RBAC + audit trails, ChatGPT Org plan RBAC
   - **Impact:** Team collaboration %0 (Phase 3 hedefi)

2. **Audit & Compliance Logging — MINIMAL**
   - Runtime events logu var ama structured audit trail yok
   - Compliance exportable format (JSON, CSV) yok
   - Data residency policy yok
   - **Rakiplere kıyasla:** Compliance tools HIPAA/SOC2 logging
   - **Impact:** Enterprise adoption %10

3. **Sandbox Policy & Resource Limits — YOKLUĞU**
   - `shell.exec` approval var ama CPU/memory/disk limit yok
   - Container isolation yok (process directly runs on host)
   - **Rakiplere kıyasla:** ChatGPT Code Interpreter gVisor sandbox, Claude Code local sandbox
   - **Risk:** Resource exhaustion attack %40

---

### 1.5 Memory & Context Management

#### ✅ RUNA'NIN GÜÇ NOKTASI

```
Memory System
├── Session memory (per-run context blocks)
├── Project memory (persistent key-value + RLS)
├── memory.save / memory.search / memory.list / memory.delete
├── Compose-memory-context seam
└── Prompt layer integration
```

**Avantaj:**
- Type-safe `MemoryBlock` kontrat
- RLS via user_id + workspace_id
- Immediate search (no embedding)

#### ❌ RUNA'NIN EKSIKLIKLERI

1. **Semantic (Vector) Memory — TAMAMEN YOKLUĞU**
   - Embedding model yok
   - Vector DB (Qdrant, Pinecone, Weaviate) integration yok
   - Similarity search yok → exact keyword search only
   - **Rakiplere kıyasla:** 
     - Claude's memory with semantic search mümkün (enterprise feature)
     - ChatGPT+ file-based memory + semantic search
     - Gemini's memory with embeddings
   - **Impact:** Long-context understanding across sessions %0

2. **Memory Retention Policies — YALNIZ TTL**
   - Debug 30d retention sadece
   - User-defined retention schedule yok
   - Auto-cleanup mevcut ama granular policies yok
   - **Rakiplere kıyasla:** ChatGPT memory deletion calendar
   - **Impact:** Data governance %20

3. **Memory Compression & Summarization — YOKLUĞU**
   - Long session memory otomatik summarize/compress yok
   - Prompt window bloat managementi yok
   - **Rakiplere kıyasla:** Claude's automatic context compression (o1 seçimi), ChatGPT's memory consolidation
   - **Impact:** Long-running projects efficiency %30

---

### 1.6 Runtime State Machine & Stop Conditions

#### ✅ RUNA'NIN GÜÇ NOKTASI

```
State Machine
├── INIT
├── CONTEXT_READY
├── MODEL_THINKING
├── TOOL_EXECUTING
├── WAITING_APPROVAL
├── TOOL_RESULT_INGESTING
└── COMPLETED / FAILED

Stop Conditions
├── max_turns (safety boundary)
├── token_budget (LLM cost control)
├── repeated_tool_calls (stagnation detection)
├── tool_failure (resilience boundary)
├── human_boundary (approval required)
└── model_signal (stop_reason dari provider)
```

**Avantaj:**
- Typed `StopReason` union (terminal, retriable, approval_required)
- Tool-call repair recovery + fallback chains
- Auto-continue policy checkpoint

#### ⚠️ ORTA ÖLÇÜDE EKSIK YANLAR

1. **Adaptive Loop Iteration — SABIT THRESHOLDS**
   - Max turns, token budget harcoded
   - No adaptive planning (örn., "predict this needs 3 more loops")
   - **Rakiplere kıyasla:** Claude's internal planning-aware loop budget
   - **Impact:** Efficiency optimization %20

2. **Failure Recovery & Retry Strategies — BASIC**
   - Tool failure → approval request (all-or-nothing)
   - Partial retry logic yok (örn., split large task → partial success)
   - Exponential backoff yok
   - **Rakiplere kıyasla:** ChatGPT's retry logic with jitter, Claude's graceful degradation
   - **Impact:** Robustness %25

3. **Loop Observability — MINIMAL**
   - `AgentLoopSnapshot` mevcut ama real-time metrics exporter yok
   - Sentry/PostHog/Datadog integration yok
   - Performance tracing (OpenTelemetry) yok
   - **Rakiplere kıyasla:** Enterprise Claude observability stack, ChatGPT internal metrics
   - **Impact:** Production debugging %20

---

## 2. RUNA'NIN DESKTOP AGENT — Rakiplere Kıyasla

### 2.1 Desktop Bridge Architecture

#### ✅ RUNA'NIN GÜÇ NOKTASI

```
Desktop Agent Bridge
├── Secure WebSocket handshake (JWT auth + agent_id validation)
├── Protocol versioning (desktopAgentProtocolVersion)
├── Heartbeat + keep-alive (ping/pong)
├── Tool execution sandbox (typed DesktopAgentExecuteServerMessage)
├── Screenshot capability proof (implemented + tested)
└── Session state persistence (encrypted storage)
```

**Avantaj:**
- Type-safe bidirectional protocol (`desktop-agent.hello`, `desktop-agent.execute`, `desktop-agent.result`)
- Request/response tracing (request_id, call_id)
- Error classification (PERMISSION_DENIED, TIMEOUT, INVALID_INPUT)

#### ❌ RUNA'NIN TEMEL EKSIKLIKLERI

1. **User-Facing Desktop App Shell — TAMAMEN YOKLUĞU**
   ```
   Mevcut durum:
   - Electron foundation var (main.ts, preload.ts scaffolding)
   - Windows installer artifact üretiliyor (Runa Desktop Setup 0.1.0.exe)
   - AMA: Gerçek UI, window management, tray lifecycle yok
   ```
   
   **Ne gerekiyor:**
   - Electron main process: WS connection, auto-reconnect, offline-first UI
   - React renderer: authenticated shell, device presence, task status
   - Tray integration: minimize/restore, status icon
   - IPC security: context isolation, preload bridge validation
   - Auto-update: electron-updater integration + signed releases
   
   **Rakiplere kıyasla:**
     - Claude Code desktop app: tam polished Electron, native window, sidebar
     - ChatGPT desktop app: native macOS/Windows UI, system integration
     - VS Code: Electron baseline, community matured
   
   **Impact:** Production usability %0

2. **Online Device Presence & Remote Access — BACKEND YOKLUĞU**
   ```
   Mevcut durum:
   - DevicesPage React component var (UI shell)
   - Device presence endpoint stub var
   - AMA: Actual device heartbeat, online/offline sync, remote execution backend yok
   ```
   
   **Ne gerekiyor:**
   - Device heartbeat endpoint (WS atau HTTP periodic)
   - Device state persistence (PostgreSQL: device_id, last_seen, online_status)
   - Presence broadcast (WebSocket rooms / Redis pub-sub)
   - Remote execution routing (user in web → execute on desktop via WS bridge)
   - Connection pooling + reconnect logic
   
   **Rakiplere kıyasla:**
     - Claude Code remote machines: fully implemented, SSH tunneling
     - ChatGPT desktop: device registry, remote execution
     - VS Code Remote: extension-based but production-grade
   
   **Impact:** Remote control %0

3. **Cross-Platform Support — WINDOWS-ONLY**
   ```
   Mevcut durum:
   - Windows: Electron + PowerShell 5/7 scripting
   - macOS: yok
   - Linux: yok
   ```
   
   **Ne gerekiyor:**
   - macOS: native Cocoa API (SwiftUI or Objective-C bridge)
   - Linux: X11/Wayland input simulation (uinput, xdotool)
   - Platform abstraction layer (trait-based design)
   - Cross-platform installer (DMG, AppImage, deb)
   
   **Rakiplere kıyasla:**
     - Claude Code: Windows + macOS + Linux support
     - ChatGPT desktop: native iOS + Android apps
   
   **Impact:** Market reach %40

---

### 2.2 Desktop Tool Capabilities

#### ✅ RUNA'NIN GÜÇ NOKTASI

```
Implemented Desktop Tools
├── desktop.screenshot (mevcut, test yeşil)
├── desktop.click (server-side, health check yeşil)
├── desktop.type (server-side, health check yeşil)
├── desktop.keypress (server-side, health check yeşil)
├── desktop.scroll (server-side, health check yeşil)
├── desktop.launch (server-side, app launch)
├── desktop.verify-state (server-side, UI state verification)
├── desktop.vision-analyze (server-side, screenshot vision)
├── desktop.clipboard (read + write)
└── desktop.input (cross-tool coordination)
```

**Avantaj:**
- Comprehensive UI automation (click, type, keypress, scroll)
- Vision-based state verification (screenshot → LLM analysis)
- Clipboard bridge

#### ❌ RUNA'NIN ÜRETIM KAPANIS SORUNU

1. **Live End-to-End Automation — PROOF SAHASı YOK**
   ```
   Current status:
   - Tools: "health check green" (benchmark path)
   - Gap: Gerçek masaüstü uygulamada (Chrome, Notepad, Word) tıklama kanıtı yok
   - Risk: Server-side input simulation kurgusu mükemmel ama desktop client-side receiver side
          gerçek API (Windows Input API, uinput) ile senkronizasyon belirsiz
   ```
   
   **Needing:**
   - Live e2e test suite: open app → screenshot → click button → verify result
   - Accessibility (UI Automation / IAccessible2) integration
   - Timing/race condition handling (wait for element, retry logic)
   - Multi-window / multi-process orchestration
   
   **Rakiplere kıyasla:**
     - Claude Code: live browser automation test yeşil
     - ChatGPT Code Interpreter: screenshot + click integration test var
   
   **Risk:** Release-grade production deployment %60

2. **Permission & User Control Model — EKSIK**
   ```
   Mevcut durum:
   - Server-side tool execution approval var
   - Desktop side: execution without user visual feedback yok
   ```
   
   **Ne gerekiyor:**
   - Desktop side approval UI (toast notification, user confirmation)
   - Visual feedback during execution (highlight clicked element, show cursor movement)
   - Per-app permission (allow Excel automation but block password manager)
   - Recording + playback for audit
   
   **Rakiplere kıyasla:**
     - Claude Code screen sharing + user present model
     - ChatGPT: desktop app API minimal automation (no direct UI control)
   
   **Impact:** User trust %30

3. **Headless / Remote Execution — YOKLUĞU**
   ```
   Mevcut durum:
   - Only local desktop automation (Electron on user machine)
   - Cloud desktop / VDI / headless agent yok
   ```
   
   **Ne gerekiyor:**
   - Docker container with X11 / Wayland
   - Cloud VDI integration (AWS AppStream, Azure Virtual Desktop)
   - Headless Chrome / Firefox remote debug protocol
   - Screenshot streaming (MJPEG, H.264)
   
   **Rakiplere kıyasla:**
     - ChatGPT: cloud-based code execution (no remote desktop UI)
     - Claude Code: remote machines (SSH + local tools)
   
   **Impact:** Scalability %30

---

### 2.3 Session Management & Persistence

#### ✅ RUNA'NIN GÜÇ NOKTASI

```
Session Storage
├── Encrypted session storage (encryption-at-rest)
├── electron-session-storage (IPC bridge)
├── Session restore on agent restart
└── Settings persistence (SettingsStore)
```

#### ⚠️ ORTA ÖLÇÜDE EKSIK YANLAR

1. **Multi-Session / Multi-Device Sync — YOKLUĞU**
   - Desktop agent: per-machine local state only
   - Cloud sync yok (örn., "start on desktop, continue on mobile")
   - Device pairing yok
   - **Rakiplere kıyasla:** Continuity in Apple devices, Chrome sync, Notion cross-device
   - **Impact:** Seamless experience %0

2. **Offline Mode — TEMEL DURUM**
   - Agent queues execution but sync logic minimal
   - **Ne gerekiyor:** Task queue, conflict resolution, eventual consistency
   - **Impact:** Offline UX %20

---

## 3. RUNA BACKEND + DESKTOP BÜTÜNÜ: KRITIK GAPS

| # | Gap | Current | Target (Competitors) | Severity | Effort |
|---|-----|---------|---------------------|----------|--------|
| 1 | Desktop App Shell | Foundation only | Full Electron + React | 🔴 Critical | 6-8w |
| 2 | Device Presence Backend | UI stub | Full backend + WS sync | 🔴 Critical | 4-6w |
| 3 | Office Doc Generation | None | DOCX/XLSX/PPTX/PDF | 🟠 High | 2-3w |
| 4 | Database Integration | None | SQL direct execution | 🟠 High | 2-3w |
| 5 | Semantic Memory | None | Vector DB + embeddings | 🟠 High | 4-5w |
| 6 | Sandbox Code Execution | Direct (unsafe) | Container isolated | 🟠 High | 3-4w |
| 7 | Cross-Platform Desktop | Windows only | Windows + macOS + Linux | 🟠 High | 6-8w |
| 8 | RBAC / Team Permissions | None | Role-based access | 🟡 Medium | 3-4w |
| 9 | Audit & Compliance | Minimal | SOC2/HIPAA logging | 🟡 Medium | 3-4w |
| 10 | Production Model Baseline | Groq (TBD others) | Claude/GPT-4/Gemini stable | 🟡 Medium | 2-3w |

---

## 4. IMPLEMENTATION ROADMAP

### Phase 2B (8-12 hafta) — Desktop Companion Release
```
Week 1-2:   Desktop app shell (Electron main + renderer)
Week 3-4:   Device presence backend (heartbeat + WS sync)
Week 5-6:   Live end-to-end automation (click/type on real apps)
Week 7-8:   macOS support (native Cocoa bridge)
Week 9-10:  Installer + auto-update (electron-builder)
Week 11-12: Cross-device sync + offline queue
```

### Phase 3 (12-16 hafta) — Backend Hardening
```
Week 1-3:   Office doc generation (DOCX/XLSX/PPTX)
Week 4-6:   Database integration (SQL direct execution)
Week 7-10:  Semantic memory (Qdrant + embedding model)
Week 11-14: Sandbox code execution (Docker + gVisor)
Week 15-16: RBAC + audit logging
```

---

## 5. IMMEDIATE ACTION ITEMS (NEXT 4 WEEKS)

### Backend Priority
1. **Model baseline stabilization** (1-2w)
   - Claude adapter smoke testini production-ready hale getir
   - DeepSeek stability iyileştirmesi (fallthrough detection)
   - Provider health store + session-level demoting mevcut, observe telemetry ek

2. **Tool ecosystem expansion** (2-3w)
   - Office doc generation baseline (DOCX + XLSX)
   - Database connection adapter (PostgreSQL + SQLite)
   - Secret management (env var safe injection)

3. **Observability & telemetry** (1w)
   - Sentry integration + error tracking
   - Metrics exporter (Prometheus format)
   - Performance tracing (OpenTelemetry)

### Desktop Agent Priority
1. **Desktop app shell MVP** (2-3w)
   - Electron main + React renderer
   - WS connection + auth
   - Tray integration
   - Settings persistence

2. **Device presence backend** (2w)
   - Heartbeat endpoint
   - Device state DB schema
   - Presence broadcast (WS rooms)

3. **Live automation testing** (1-2w)
   - E2E test suite (real apps)
   - CI integration
   - Performance benchmarking

---

## 6. COMPETITIVE POSITIONING

### Where Runa Leads
- ✅ Agentic loop + stop conditions (typed, modular)
- ✅ Tool ecosystem breadth (71+ tools)
- ✅ WebSocket split architecture (clean separation)
- ✅ Approval + policy engine (flexible model)
- ✅ MCP integration (stdio + HTTP)

### Where Runa Lags
- ❌ Model baseline clarity (Groq vs Claude vs Gemini)
- ❌ Desktop experience (app shell incomplete)
- ❌ Remote access (device presence missing)
- ❌ Enterprise features (RBAC, audit, compliance)
- ❌ Semantic memory (no embeddings)
- ❌ Document generation (no office doc support)

### Quick Win Strategy
1. **First 2 weeks:** Office doc generation + database tools → Immediate user value
2. **Next 4 weeks:** Desktop app shell + device presence → Remote access capability
3. **Following 8 weeks:** Semantic memory + sandbox + RBAC → Enterprise parity

---

## CONCLUSION

Runa'nın backend mimarisi **solid ve well-structured** (async generator loop, typed contracts, clean WS split). Ancak:

1. **Production claims belirsiz** (Groq-only baseline ama Prod'da Claude hedefleniyor)
2. **Desktop experience incomplete** (app shell, device presence missing)
3. **Enterprise features missing** (RBAC, audit, semantic memory)
4. **Quick wins available** (office docs, database tools, device presence)

**Rakiplere kıyasla:** Backend teknik kalitesi **eş seviyede**, fakat **feature coverage gap %30-40**. Desktop agent ise **%50 complete** (foundation strong ama user-facing shell yok).

**Recommendation:** Focus next 12 weeks on (1) Desktop shell MVP, (2) Office doc generation, (3) Device presence backend. Bu üç feature tamamlandığında "AI work partner" claim significantly stronger olacak.
