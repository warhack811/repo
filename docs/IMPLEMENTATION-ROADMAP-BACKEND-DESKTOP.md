# Runa Implementation Roadmap: Backend & Desktop Agent Hardening
> **Süre:** 20 hafta (Phase 2B + Phase 3 başlangıcı)  
> **Hedef:** Rakip parity (Claude Code, ChatGPT) seviyesine ulaşmak  
> **Odak:** Backend stabilization + Desktop experience + Enterprise features

---

## PART A: IMMEDIATE SPRINT (Weeks 1-4) — Foundation Hardening

### Sprint A1 (Week 1-2): Backend Baseline Solidification

#### Task A1.1: Model Provider Clarity & Production Baseline
**Durum:** Groq-only baseline ama Prod'da "Claude yayin oncesi sabitlenecek" (TBD)  
**Problem:** Model seçimi user'a transparent değil, provider health uncertain  
**Yapılacak:**

```typescript
// apps/server/src/config/production-baseline.ts (YENI)
export interface ProductionBaselineConfig {
  primary_model_provider: 'groq' | 'deepseek' | 'claude' | 'gemini';
  fallback_chain: Array<{ provider: string; model: string }>;
  feature_gates: {
    semantic_reasoning_enabled: boolean;
    tool_call_reliability_required: boolean;
    streaming_preferred: boolean;
  };
  sla_targets: {
    ttfb_ms: number;
    latency_p95_ms: number;
    success_rate: number;
  };
}

// Durum kontrolü
const BASELINE_2026_Q2 = {
  primary: 'groq',      // authoritative
  fallback: ['deepseek', 'claude', 'gemini'],
  target_switch: 'claude', // Q3 target
};
```

**Effort:** 5d (provider selection + SLA metrics + A/B test framework)  
**Output:** Documented baseline per deployment environment

---

#### Task A1.2: Observability & Telemetry Stack
**Durum:** No Sentry, PostHog, DataDog, OpenTelemetry  
**Problem:** Production debugging impossible, perf metrics unknown  
**Yapılacak:**

```typescript
// packages/utils/src/observability.ts (YENI)
import { captureException, setContext } from '@sentry/node';

export function initializeObservability(env: 'dev' | 'staging' | 'prod') {
  if (env === 'prod') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: env,
    });
    
    // OpenTelemetry auto-instrumentation
    const otel = require('@opentelemetry/auto');
    otel.start();
  }
}

// Gateway adapter'larda
export function observeModelRequest(provider: string, model: string, tokens: number) {
  Sentry.captureMessage(`model_request`, {
    level: 'info',
    contexts: { provider, model, tokens },
  });
  // Prometheus metric
  modelRequestHistogram.observe({ provider, model }, tokens);
}
```

**Effort:** 8d (Sentry + OpenTelemetry instrumentation + metrics setup)  
**Output:** Production monitoring dashboard + error tracking  
**Dependencies:** SENTRY_DSN, OTEL_EXPORTER_OTLP_ENDPOINT env

---

#### Task A1.3: Tool Error Handling & Repair Hardening
**Durum:** Tool-call repair var ama edge cases many, logging insufficient  
**Problem:** Tool failures → approval request (all-or-nothing), no partial recovery  
**Yapılacak:**

```typescript
// apps/server/src/runtime/tool-execution-resilience.ts (YENI)

export interface ToolExecutionStrategy {
  retry_count: number;
  retry_backoff: 'fixed' | 'exponential';
  retry_jitter: boolean;
  partial_success_acceptable: boolean;
  alternative_tools?: string[];
}

const TOOL_STRATEGIES: Record<string, ToolExecutionStrategy> = {
  'file.read': {
    retry_count: 2,
    retry_backoff: 'exponential',
    retry_jitter: true,
    partial_success_acceptable: true, // range read fallback
  },
  'shell.exec': {
    retry_count: 1,
    retry_backoff: 'fixed',
    retry_jitter: false,
    partial_success_acceptable: false, // shell side-effects final
  },
  'web.search': {
    retry_count: 3,
    retry_backoff: 'exponential',
    retry_jitter: true,
    alternative_tools: ['search.codebase'],
  },
};

// Telemetry
export const toolExecutionMetrics = {
  attempts: new Counter({
    name: 'tool_execution_attempts_total',
    help: 'Tool execution attempts by status',
    labelNames: ['tool_name', 'status'],
  }),
  latency: new Histogram({
    name: 'tool_execution_duration_seconds',
    help: 'Tool execution latency',
    labelNames: ['tool_name'],
  }),
};
```

**Effort:** 6d  
**Output:** Resilient tool execution + retry policies + metrics  
**Verification:** Tool failure rate → <5% with retries

---

### Sprint A2 (Week 3-4): Desktop Agent Foundation

#### Task A2.1: Desktop App Shell — Electron Bootstrap
**Durum:** Foundation scaffolding var, actual app yok  
**Problem:** Windows installer generates but no UI  
**Yapılacak:**

```typescript
// apps/desktop-agent/src/main-process.ts (REWRITE)
import { app, BrowserWindow, Menu, Tray } from 'electron';

let mainWindow: BrowserWindow;
let tray: Tray;

app.on('ready', async () => {
  // 1. Load workspace attestation
  const attestation = await loadWorkspaceAttestation();
  
  // 2. Create main window
  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.ts'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  // 3. Load renderer
  mainWindow.loadURL(isDev ? 'http://localhost:5173' : `file://${__dirname}/../renderer/index.html`);

  // 4. Setup tray
  tray = new Tray(path.join(__dirname, 'icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow.show() },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);

  // 5. WS connection
  const ws = new WebSocket(`${process.env.RUNA_SERVER_URL}/ws/desktop-agent`);
  attachDesktopAgentBridge(ws);
});

// IPC handlers
ipcMain.handle('get-devices', async () => {
  const devices = await fetchDevicesFromServer();
  return devices;
});

ipcMain.handle('execute-task', async (event, taskId) => {
  const result = await executeTaskLocally(taskId);
  return result;
});

// Auto-update
autoUpdater.checkForUpdatesAndNotify();
```

**Effort:** 10d (Electron lifecycle + IPC + preload bridge + tray + updater)  
**Output:** Executable desktop app with basic UI  
**Deliverables:**
- `Runa Desktop.exe` installer (signed)
- Auto-start on login
- Tray icon with status

---

#### Task A2.2: Desktop Renderer — React App Integration
**Durum:** No dedicated renderer, web app used directly  
**Problem:** Electron features (native menus, tray, IPC) inaccessible from web  
**Yapılacak:**

```typescript
// apps/desktop-agent/src/renderer/App.tsx (YENI)
import React, { useEffect, useState } from 'react';
import { useAuth } from '@runa/web/hooks/useAuth';
import { useDesktopBridge } from './hooks/useDesktopBridge';

export function DesktopApp() {
  const { user } = useAuth();
  const { isConnected, devices, executeTask } = useDesktopBridge();

  return (
    <div className="desktop-app">
      <header>
        <h1>Runa Desktop</h1>
        <span className={`status ${isConnected ? 'online' : 'offline'}`}>
          {isConnected ? '🟢 Online' : '⚫ Offline'}
        </span>
      </header>

      <nav>
        <a href="/devices">Devices</a>
        <a href="/tasks">Running Tasks</a>
        <a href="/settings">Settings</a>
      </nav>

      <Routes>
        <Route path="/devices" element={<DevicesPanel devices={devices} />} />
        <Route path="/tasks" element={<TasksPanel />} />
        <Route path="/settings" element={<SettingsPanel />} />
      </Routes>
    </div>
  );
}

// IPC bridge hook
export function useDesktopBridge() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    window.electron.on('connection-status', (status) => {
      setIsConnected(status === 'connected');
    });
  }, []);

  return {
    isConnected,
    executeTask: async (taskId) => window.electron.executeTask(taskId),
  };
}
```

**Effort:** 8d (Vite SPA + Electron IPC + native look-and-feel)  
**Output:** Polished desktop UI  
**Styling:** Match Claude Code / VS Code (dark theme + sidebar)

---

## PART B: DESKTOP COMPLETION (Weeks 5-8)

### Sprint B1 (Week 5-6): Device Presence Backend

#### Task B1.1: Device Registry & Heartbeat System
**Durum:** DevicesPage UI var ama backend yok  
**Problem:** No online/offline tracking, no remote execution routing  
**Yapılacak:**

```typescript
// apps/server/src/features/device-presence/device-registry.ts (YENI)
import { drizzle } from 'drizzle-orm/node-postgres';
import { devices } from '@runa/db/schema';

export interface DeviceRecord {
  device_id: string;
  user_id: string;
  agent_id: string;
  last_seen: Date;
  online: boolean;
  capabilities: string[];
  ws_session_id?: string;
}

export async function registerDevice(
  userId: string,
  agentId: string,
  capabilities: string[],
): Promise<DeviceRecord> {
  const device = await db.insert(devices).values({
    device_id: generateId(),
    user_id: userId,
    agent_id: agentId,
    capabilities: JSON.stringify(capabilities),
    last_seen: new Date(),
    online: true,
  }).returning();

  return device[0];
}

export async function updateDeviceHeartbeat(
  deviceId: string,
): Promise<void> {
  await db.update(devices)
    .set({ last_seen: new Date() })
    .where(eq(devices.device_id, deviceId));
}

// Cleanup stale devices
export async function cleanupStaleDevices(staleAfterMs = 5 * 60_000) {
  const staleThreshold = new Date(Date.now() - staleAfterMs);
  await db.update(devices)
    .set({ online: false })
    .where(lt(devices.last_seen, staleThreshold));
}
```

**Effort:** 6d  
**Output:** Device registry + cleanup job + Prometheus metrics

---

#### Task B1.2: Device Presence WebSocket Broadcast
**Durum:** No WS presence channel  
**Problem:** Multiple connected clients don't see device status changes  
**Yapılacak:**

```typescript
// apps/server/src/ws/device-presence-broadcast.ts (YENI)
import { EventEmitter } from 'events';

export class DevicePresenceBroadcaster extends EventEmitter {
  private userConnections = new Map<string, Set<WebSocketConnection>>();

  subscribe(userId: string, socket: WebSocketConnection) {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(socket);
  }

  async broadcastDeviceStatusChange(
    userId: string,
    deviceId: string,
    online: boolean,
  ) {
    const connections = this.userConnections.get(userId);
    if (!connections) return;

    const message: DevicePresenceUpdate = {
      type: 'device.presence',
      payload: { device_id: deviceId, online, timestamp: new Date() },
    };

    connections.forEach((conn) => {
      if (conn.isOpen()) {
        conn.send(JSON.stringify(message));
      }
    });
  }
}

export const devicePresenceBroadcaster = new DevicePresenceBroadcaster();
```

**Effort:** 4d  
**Output:** Real-time device presence updates via WS

---

#### Task B1.3: Remote Execution Routing
**Durum:** Desktop agent execute path exists, but no request from web → desktop routing  
**Problem:** Web client can't dispatch task to specific device  
**Yapılacak:**

```typescript
// apps/server/src/ws/remote-task-routing.ts (YENI)
export async function routeTaskToDevice(
  userId: string,
  deviceId: string,
  taskRequest: TaskExecutionRequest,
): Promise<TaskResult> {
  // 1. Find device WS connection
  const device = await getDeviceSession(deviceId);
  if (!device || !device.isOnline) {
    throw new Error('Device offline');
  }

  // 2. Send execute message
  const requestId = generateId();
  device.sendExecuteMessage({
    type: 'desktop-agent.execute',
    payload: {
      request_id: requestId,
      task: taskRequest,
    },
  });

  // 3. Wait for result (with timeout)
  return await waitForTaskResult(requestId, 30_000);
}

// Web client initiates
// POST /api/devices/{deviceId}/execute
export async function executeOnDevice(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { deviceId } = req.params;
  const { tool_name, tool_args } = req.body;

  const result = await routeTaskToDevice(req.user.id, deviceId, {
    tool_name,
    tool_args,
  });

  reply.send(result);
}
```

**Effort:** 5d  
**Output:** End-to-end remote execution from web → desktop

---

### Sprint B2 (Week 7-8): Live End-to-End Testing & Polish

#### Task B2.1: Desktop Automation E2E Tests
**Durum:** Health checks mevcut ama gerçek app test yok  
**Problem:** No proof that real click/type works on Chrome, Word, etc.  
**Yapılacak:**

```typescript
// apps/desktop-agent/src/__tests__/e2e.spec.ts (YENI)
import { spawn } from 'child_process';
import { captureScreenshot, executeDesktopClick } from '../index';

describe('Desktop Automation E2E', () => {
  let chromeProcess;

  beforeAll(async () => {
    // Launch Chrome
    chromeProcess = spawn('chrome', ['--no-sandbox', 'about:blank']);
    await new Promise((resolve) => setTimeout(resolve, 2000)); // warm-up
  });

  test('Click button and verify state change', async () => {
    // 1. Navigate to test page
    await executeDesktopClick({
      x: 100,
      y: 100, // address bar
      button: 'left',
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 2. Type URL
    await executeDesktopType({
      text: 'http://localhost:8888/test-automation',
    });
    await executeDesktopKeypress({
      key: 'Enter',
    });
    await new Promise((resolve) => setTimeout(resolve, 2000)); // page load

    // 3. Take screenshot
    const screenshot = await captureScreenshot();

    // 4. Click button
    await executeDesktopClick({
      x: 200,
      y: 150, // button coordinates
      button: 'left',
    });

    // 5. Verify state changed
    const resultScreenshot = await captureScreenshot();
    expect(resultScreenshot).not.toBe(screenshot); // should differ

    // 6. Vision-based verification
    const analysis = await analyzeScreenshot(resultScreenshot);
    expect(analysis).toContain('Button clicked successfully');
  });

  afterAll(async () => {
    chromeProcess.kill();
  });
});
```

**Effort:** 8d (test suite + CI integration + performance tuning)  
**Output:** Green E2E tests, proof of production-ready automation

---

## PART C: BACKEND FEATURES (Weeks 9-16)

### Sprint C1 (Week 9-10): Office Document Generation

#### Task C1.1: DOCX & XLSX Generation Framework
**Durum:** Hiçbir şey yok  
**Problem:** Can't generate reports, spreadsheets, proposals  
**Yapılacak:**

```typescript
// apps/server/src/tools/doc-create-word.ts (YENI)
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell } from 'docx';
import { writeFile } from 'fs/promises';

export async function executeDocCreateWord(
  args: {
    filename: string;
    title: string;
    content: Array<{ type: 'heading' | 'paragraph' | 'table'; data: unknown }>;
  },
): Promise<{ file_path: string; size: number }> {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: args.title,
          heading: 'Heading1',
        }),
        ...args.content.map((item) => {
          if (item.type === 'heading') {
            return new Paragraph({
              text: item.data as string,
              heading: 'Heading2',
            });
          }
          if (item.type === 'paragraph') {
            return new Paragraph(item.data as string);
          }
          if (item.type === 'table') {
            const table = item.data as Array<Array<string>>;
            return new Table({
              rows: table.map((row) => new TableRow({
                cells: row.map((cell) => new TableCell({
                  children: [new Paragraph(cell)],
                })),
              })),
            });
          }
        }),
      ],
    }],
  });

  const bytes = await Packer.toBuffer(doc);
  const filePath = path.join(process.env.WORKSPACE_DIR, args.filename);
  await writeFile(filePath, bytes);

  return { file_path: filePath, size: bytes.length };
}

// Register tool
toolRegistry.register({
  name: 'doc.create-word',
  description: 'Create a formatted Word document (DOCX)',
  callable_schema: {
    type: 'object',
    properties: {
      filename: { type: 'string', pattern: '^[a-zA-Z0-9_.-]+\\.docx$' },
      title: { type: 'string' },
      content: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { enum: ['heading', 'paragraph', 'table'] },
            data: {},
          },
        },
      },
    },
    required: ['filename', 'title', 'content'],
  },
  implementation: executeDocCreateWord,
  metadata: {
    risk_level: 'medium',
    narration_policy: 'optional',
    approval_required: false,
  },
});
```

**Effort:** 8d (docx + xlsx + pptx + pdf generators)  
**Output:** 4 new tools (doc.create-word, doc.create-excel, doc.create-pptx, doc.create-pdf)  
**Dependencies:** `docx`, `exceljs`, `pptxgen`, `pdfkit` npm packages

---

### Sprint C2 (Week 11-12): Database Integration

#### Task C2.1: SQL Execution Tool
**Durum:** Hiçbir şey yok  
**Problem:** Can't query databases, transform data  
**Yapılacak:**

```typescript
// apps/server/src/tools/db-execute-sql.ts (YENI)
import { createConnection, Connection } from 'mysql2/promise';
import { Client as PgClient } from 'pg';

export async function executeDbExecuteSql(
  args: {
    connection_string: string;
    sql: string;
    timeout_ms?: number;
  },
  context: ToolExecutionContext,
): Promise<{ rows: unknown[]; row_count: number; execution_ms: number }> {
  // 1. Validate connection string (no hardcoded passwords)
  const connUrl = new URL(args.connection_string);
  if (!connUrl.password && process.env[`DB_PASSWORD_${connUrl.hostname}`]) {
    connUrl.password = process.env[`DB_PASSWORD_${connUrl.hostname}`];
  }

  // 2. Connect
  const start = Date.now();
  const connection = await createConnection(args.connection_string);

  try {
    // 3. Execute query
    const [rows] = await connection.execute(args.sql, []);

    // 4. Return results
    return {
      rows: rows as unknown[],
      row_count: (rows as unknown[]).length,
      execution_ms: Date.now() - start,
    };
  } finally {
    await connection.end();
  }
}

// Register with approval requirement
toolRegistry.register({
  name: 'db.execute-sql',
  description: 'Execute SQL query on database (SELECT/INSERT/UPDATE/DELETE)',
  callable_schema: {
    type: 'object',
    properties: {
      connection_string: { type: 'string' },
      sql: { type: 'string' },
      timeout_ms: { type: 'number', default: 30000 },
    },
    required: ['connection_string', 'sql'],
  },
  implementation: executeDbExecuteSql,
  metadata: {
    risk_level: 'high',
    narration_policy: 'required',
    approval_required: true, // User must approve DB writes
  },
});
```

**Effort:** 6d (PostgreSQL + MySQL + SQLite adapters + query validation)  
**Output:** `db.execute-sql` tool with safe query validation  
**Security:** Input sanitization, credential injection prevention, query timeout

---

### Sprint C3 (Week 13-14): Semantic Memory with Vector Search

#### Task C3.1: Qdrant Integration & Embedding Pipeline
**Durum:** Hiçbir şey yok  
**Problem:** No semantic memory, only keyword search  
**Yapılacak:**

```typescript
// apps/server/src/memory/vector-memory-store.ts (YENI)
import { QdrantClient } from '@qdrant/js-client-rest';

export interface VectorMemoryEntry {
  id: string;
  user_id: string;
  workspace_id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export class VectorMemoryStore {
  private qdrant: QdrantClient;
  private embeddingModel: Embedding;

  async saveMemory(
    userId: string,
    workspaceId: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<VectorMemoryEntry> {
    // 1. Generate embedding
    const embedding = await this.embeddingModel.embed(content);

    // 2. Store in Qdrant
    const id = generateId();
    await this.qdrant.upsert('memory', {
      points: [{
        id: idToUint64(id),
        vector: embedding,
        payload: {
          id,
          user_id: userId,
          workspace_id: workspaceId,
          content,
          metadata,
          created_at: new Date(),
        },
      }],
    });

    return { id, user_id: userId, workspace_id: workspaceId, content, embedding, metadata, created_at: new Date(), updated_at: new Date() };
  }

  async searchMemory(
    userId: string,
    workspaceId: string,
    query: string,
    topK = 5,
  ): Promise<VectorMemoryEntry[]> {
    // 1. Embed query
    const queryEmbedding = await this.embeddingModel.embed(query);

    // 2. Search Qdrant
    const results = await this.qdrant.search('memory', {
      vector: queryEmbedding,
      limit: topK,
      filter: {
        must: [
          { key: 'user_id', match: { value: userId } },
          { key: 'workspace_id', match: { value: workspaceId } },
        ],
      },
    });

    return results.map((r) => r.payload as VectorMemoryEntry);
  }
}

// Update memory.search tool
async function executeMemorySearch(
  args: { query: string; limit?: number },
  context: ToolExecutionContext,
): Promise<{ results: VectorMemoryEntry[] }> {
  const store = new VectorMemoryStore();
  const results = await store.searchMemory(
    context.user_id,
    context.workspace_id,
    args.query,
    args.limit ?? 5,
  );
  return { results };
}
```

**Effort:** 10d (Qdrant client setup + embedding model integration + RLS enforcement)  
**Output:** Semantic memory search + tool update  
**Dependencies:** `@qdrant/js-client-rest`, embedding model (e.g., `sentence-transformers` via API)

---

## PART D: ENTERPRISE FEATURES (Weeks 17-20)

### Sprint D1 (Week 17-18): RBAC & Team Permissions

#### Task D1.1: Role-Based Access Control
**Durum:** No team concept, solo user only  
**Problem:** Can't share workspace, no admin controls  
**Yapılacak:**

```typescript
// packages/db/src/schema/rbac.ts (YENI)
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  workspace_id: text('workspace_id').notNull(),
  name: text('name').notNull(), // 'admin', 'editor', 'viewer'
  capabilities: jsonb('capabilities').notNull(), // { 'file.read': true, 'shell.exec': false }
  created_at: timestamp('created_at').defaultNow(),
});

export const workspaceMembers = pgTable('workspace_members', {
  id: serial('id').primaryKey(),
  workspace_id: text('workspace_id').notNull(),
  user_id: text('user_id').notNull(),
  role_id: integer('role_id').references(() => roles.id),
  invited_at: timestamp('invited_at').defaultNow(),
  accepted_at: timestamp('accepted_at'),
});

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  workspace_id: text('workspace_id').notNull(),
  user_id: text('user_id').notNull(),
  action: text('action').notNull(), // 'run.created', 'approval.granted', 'file.written'
  resource: jsonb('resource').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});
```

**Effort:** 8d (schema + permission checks + audit logging)  
**Output:** RBAC layer, audit trail  
**Verification:** E2E test: admin invites editor → editor can't execute shell

---

### Sprint D2 (Week 19-20): Sandbox Code Execution

#### Task D2.1: Docker-based Execution Sandbox
**Durum:** Direct shell.exec on host  
**Problem:** Resource exhaustion, security risk  
**Yapılacak:**

```typescript
// apps/server/src/tools/shell-exec-sandboxed.ts (YENI)
import Docker from 'dockerode';

export async function executeShellExecSandboxed(
  args: { command: string; timeout_ms?: number },
  context: ToolExecutionContext,
): Promise<{ stdout: string; stderr: string; exit_code: number }> {
  const docker = new Docker();

  // 1. Create container with resource limits
  const container = await docker.createContainer({
    Image: 'runa-sandbox:latest',
    Cmd: ['bash', '-c', args.command],
    Env: [
      `USER_ID=${context.user_id}`,
      `WORKSPACE=${context.workspace_id}`,
    ],
    HostConfig: {
      Memory: 512 * 1024 * 1024, // 512MB
      MemorySwap: 512 * 1024 * 1024,
      CpuQuota: 50000, // 50% CPU
      PidsLimit: 32,
      ReadonlyRootfs: true,
      Mounts: [{
        Type: 'bind',
        Source: `/workspaces/${context.workspace_id}`,
        Target: '/workspace',
        ReadOnly: false,
      }],
    },
  });

  try {
    // 2. Run container
    await container.start();
    const stream = await container.attach({ stream: true, stdout: true, stderr: true });

    // 3. Collect output
    const output = { stdout: '', stderr: '' };
    stream.on('data', (data) => {
      output.stdout += data.toString();
    });

    // 4. Wait for exit
    const result = await container.wait();

    return {
      stdout: output.stdout,
      stderr: output.stderr,
      exit_code: result.StatusCode,
    };
  } finally {
    await container.remove();
  }
}

// Update shell.exec to use sandbox
toolRegistry.get('shell.exec').implementation = executeShellExecSandboxed;
```

**Effort:** 10d (Docker image creation + resource limit tuning + filesystem isolation)  
**Output:** Sandboxed shell execution  
**Dependencies:** Docker daemon + custom `runa-sandbox` image  
**Security:** Read-only root, mounted workspace, CPU/memory limits, PID limit

---

## IMPLEMENTATION TIMELINE SUMMARY

| Week | Focus | Key Deliverables | Status |
|------|-------|------------------|--------|
| 1-2 | Backend baseline | Model clarity + observability | ✨ Next |
| 3-4 | Desktop shell | Electron app + IPC | ✨ Next |
| 5-6 | Device presence | Heartbeat + WS broadcast | Planning |
| 7-8 | E2E testing | Green automation tests | Planning |
| 9-10 | Office docs | DOCX + XLSX tools | Planning |
| 11-12 | Database integration | SQL execution tool | Planning |
| 13-14 | Semantic memory | Qdrant + vector search | Planning |
| 15-16 | Sandbox | Docker-based execution | Planning |
| 17-18 | RBAC | Team permissions + audit | Planning |
| 19-20 | Polish | Performance + docs | Planning |

---

## SUCCESS CRITERIA

✅ **Backend Parity:**
- Production model baseline explicit (not "TBD")
- Observability stack (Sentry + OpenTelemetry)
- Tool ecosystem expanded (docs + database + sandbox)
- 95%+ success rate on tool execution

✅ **Desktop Parity:**
- Desktop app shell polished (Electron + React)
- Device presence real-time (WS sync)
- Remote execution working (web → desktop)
- E2E tests green (real Chrome/Word automation)
- Windows + macOS support

✅ **Enterprise Readiness:**
- RBAC + team permissions
- Audit logging (compliance-ready)
- Semantic memory (vector search)
- Sandboxed code execution

---

## RESOURCE ALLOCATION

**Total Effort:** ~180 person-days  
**Team:** 3 backend engineers + 2 desktop engineers  
**Timeline:** 20 weeks (5 months)  
**Estimated Cost:** ~$400K (fully loaded)

---

## RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| Electron version conflicts | Use LTS version, extensive testing |
| Docker overhead on desktop | Use lightweight gVisor alternative |
| Vector DB latency | Implement caching layer (Redis) |
| Cross-platform brittleness | Extensive OS-specific testing |
| Dependency bloat | Audit and pin versions carefully |

---

**Next Step:** Start Week 1 tasks immediately. Establish CI/CD pipeline for weekly releases.
