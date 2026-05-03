"use strict";

// electron/main.ts
var import_node_fs = require("node:fs");
var import_promises4 = require("node:fs/promises");
var import_node_path4 = require("node:path");
var import_electron = require("electron");

// src/auth.ts
function readRequiredValue(value, key) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Desktop agent environment is missing ${key}.`);
  }
  return normalized;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isAuthenticatedActionResponse(value) {
  if (!isRecord(value)) {
    return false;
  }
  const candidate = value;
  if (candidate.outcome !== "authenticated" || !isRecord(candidate.session)) {
    return false;
  }
  const sessionCandidate = candidate.session;
  return typeof sessionCandidate.access_token === "string";
}
async function readResponsePayload(response) {
  const responseText = await response.text();
  const normalizedResponse = responseText.trim();
  if (normalizedResponse.length === 0) {
    return null;
  }
  try {
    return JSON.parse(normalizedResponse);
  } catch {
    return normalizedResponse;
  }
}
function readErrorMessage(payload, status) {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }
  if (isRecord(payload)) {
    const errorPayload = payload;
    const message = errorPayload.message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
    const error = errorPayload.error;
    if (typeof error === "string" && error.trim().length > 0) {
      return error;
    }
  }
  return `Desktop agent auth request failed with status ${status}.`;
}
function resolveDesktopAgentWebSocketUrl(serverUrl) {
  const normalizedUrl = new URL(serverUrl);
  if (normalizedUrl.protocol === "http:") {
    normalizedUrl.protocol = "ws:";
  } else if (normalizedUrl.protocol === "https:") {
    normalizedUrl.protocol = "wss:";
  } else if (normalizedUrl.protocol !== "ws:" && normalizedUrl.protocol !== "wss:") {
    throw new Error(`Unsupported desktop agent server URL protocol: ${normalizedUrl.protocol}`);
  }
  normalizedUrl.pathname = "/ws/desktop-agent";
  normalizedUrl.search = "";
  normalizedUrl.hash = "";
  return normalizedUrl.toString();
}
function resolveDesktopAgentHttpUrl(serverUrl, pathname) {
  const normalizedUrl = new URL(serverUrl);
  if (normalizedUrl.protocol === "ws:") {
    normalizedUrl.protocol = "http:";
  } else if (normalizedUrl.protocol === "wss:") {
    normalizedUrl.protocol = "https:";
  } else if (normalizedUrl.protocol !== "http:" && normalizedUrl.protocol !== "https:") {
    throw new Error(`Unsupported desktop agent server URL protocol: ${normalizedUrl.protocol}`);
  }
  normalizedUrl.pathname = pathname;
  normalizedUrl.search = "";
  normalizedUrl.hash = "";
  return normalizedUrl.toString();
}
function normalizeDesktopAgentPersistedSession(session2, now = /* @__PURE__ */ new Date()) {
  const accessToken = session2.access_token.trim();
  if (accessToken.length === 0) {
    throw new Error("Desktop agent session is missing access_token.");
  }
  const expiresAt = typeof session2.expires_at === "number" ? session2.expires_at : typeof session2.expires_in === "number" ? Math.trunc(now.getTime() / 1e3) + session2.expires_in : void 0;
  return {
    access_token: accessToken,
    expires_at: expiresAt,
    expires_in: session2.expires_in,
    refresh_token: session2.refresh_token?.trim() || void 0,
    token_type: session2.token_type?.trim() || void 0
  };
}
function normalizeDesktopAgentSessionInputPayload(sessionInput, now = /* @__PURE__ */ new Date()) {
  const accessToken = sessionInput.access_token.trim();
  if (accessToken.length === 0) {
    throw new Error("Paste your access token to continue.");
  }
  const refreshToken = sessionInput.refresh_token.trim();
  if (refreshToken.length === 0) {
    throw new Error("Paste your refresh token to continue.");
  }
  if (typeof sessionInput.expires_at !== "undefined" && (typeof sessionInput.expires_at !== "number" || !Number.isFinite(sessionInput.expires_at))) {
    throw new Error("Use a valid session expiry to continue.");
  }
  return normalizeDesktopAgentPersistedSession(
    {
      access_token: accessToken,
      expires_at: typeof sessionInput.expires_at === "number" ? Math.trunc(sessionInput.expires_at) : void 0,
      refresh_token: refreshToken,
      token_type: sessionInput.token_type?.trim() || void 0
    },
    now
  );
}
function readDesktopAgentBootstrapConfigFromEnvironment(environment = process.env) {
  const accessToken = environment.RUNA_DESKTOP_AGENT_ACCESS_TOKEN?.trim();
  return {
    agent_id: readRequiredValue(environment.RUNA_DESKTOP_AGENT_ID, "RUNA_DESKTOP_AGENT_ID"),
    initial_session: accessToken && accessToken.length > 0 ? normalizeDesktopAgentPersistedSession({
      access_token: accessToken
    }) : void 0,
    machine_label: environment.RUNA_DESKTOP_AGENT_MACHINE_LABEL?.trim() || void 0,
    server_url: resolveDesktopAgentWebSocketUrl(
      readRequiredValue(environment.RUNA_DESKTOP_AGENT_SERVER_URL, "RUNA_DESKTOP_AGENT_SERVER_URL")
    )
  };
}
async function refreshDesktopAgentSession(input) {
  const refreshToken = input.session.refresh_token?.trim();
  if (!refreshToken) {
    throw new Error("Desktop agent session refresh requires a refresh_token.");
  }
  const authFetch = input.auth_fetch ?? globalThis.fetch;
  if (!authFetch) {
    throw new Error("Desktop agent session refresh requires a fetch implementation.");
  }
  const response = await authFetch(
    resolveDesktopAgentHttpUrl(input.server_url, "/auth/session/refresh"),
    {
      body: JSON.stringify({
        refresh_token: refreshToken
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      method: "POST"
    }
  );
  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(payload, response.status));
  }
  if (!isAuthenticatedActionResponse(payload)) {
    throw new Error("Desktop agent session refresh returned an unsupported payload shape.");
  }
  return normalizeDesktopAgentPersistedSession(payload.session);
}

// src/electron-session-storage.ts
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var noopSessionStorageLogger = {
  warn: () => {
  }
};
function isNodeErrorWithCode(error, code) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeSessionFromUnknown(value) {
  if (!isRecord2(value) || typeof value["access_token"] !== "string") {
    throw new Error("Desktop agent session storage contained an invalid payload.");
  }
  return normalizeDesktopAgentPersistedSession({
    access_token: value["access_token"],
    expires_at: typeof value["expires_at"] === "number" ? value["expires_at"] : void 0,
    expires_in: typeof value["expires_in"] === "number" ? value["expires_in"] : void 0,
    refresh_token: typeof value["refresh_token"] === "string" ? value["refresh_token"] : void 0,
    token_type: typeof value["token_type"] === "string" ? value["token_type"] : void 0
  });
}
async function atomicWrite(filePath, body) {
  const directory = (0, import_node_path.dirname)(filePath);
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await (0, import_promises.mkdir)(directory, { recursive: true });
  await (0, import_promises.writeFile)(temporaryPath, body);
  await (0, import_promises.rename)(temporaryPath, filePath);
}
var FileDesktopAgentSessionStorage = class {
  #filePath;
  constructor(userDataDirectory) {
    this.#filePath = (0, import_node_path.join)(userDataDirectory, "desktop-session.json");
  }
  async clear() {
    await (0, import_promises.rm)(this.#filePath, { force: true });
  }
  async load() {
    let rawValue;
    try {
      rawValue = await (0, import_promises.readFile)(this.#filePath, "utf8");
    } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        return null;
      }
      throw error;
    }
    return normalizeSessionFromUnknown(JSON.parse(rawValue));
  }
  async save(session2) {
    const normalizedSession = normalizeDesktopAgentPersistedSession(session2);
    await atomicWrite(this.#filePath, JSON.stringify(normalizedSession));
  }
};
var EncryptedDesktopAgentSessionStorage = class {
  #encryptedFilePath;
  #legacyStorage;
  #legacyFilePath;
  #logger;
  #safeStorage;
  constructor(userDataDirectory, safeStorage2, logger = noopSessionStorageLogger) {
    this.#encryptedFilePath = (0, import_node_path.join)(userDataDirectory, "desktop-session.bin");
    this.#legacyFilePath = (0, import_node_path.join)(userDataDirectory, "desktop-session.json");
    this.#legacyStorage = new FileDesktopAgentSessionStorage(userDataDirectory);
    this.#logger = logger;
    this.#safeStorage = safeStorage2;
  }
  async clear() {
    await (0, import_promises.rm)(this.#encryptedFilePath, { force: true });
    await (0, import_promises.rm)(this.#legacyFilePath, { force: true });
  }
  async load() {
    let encryptedValue;
    try {
      encryptedValue = await (0, import_promises.readFile)(this.#encryptedFilePath);
    } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        return await this.#migrateLegacySession();
      }
      throw error;
    }
    const decryptedValue = this.#safeStorage.decryptString(encryptedValue);
    return normalizeSessionFromUnknown(JSON.parse(decryptedValue));
  }
  async save(session2) {
    const normalizedSession = normalizeDesktopAgentPersistedSession(session2);
    const encryptedValue = this.#safeStorage.encryptString(JSON.stringify(normalizedSession));
    await atomicWrite(this.#encryptedFilePath, encryptedValue);
  }
  async #migrateLegacySession() {
    const legacySession = await this.#legacyStorage.load();
    if (!legacySession) {
      return null;
    }
    await this.save(legacySession);
    await (0, import_promises.rm)(this.#legacyFilePath, { force: true });
    this.#logger.warn("Migrated legacy plaintext desktop session storage.");
    return legacySession;
  }
};
function createFileDesktopAgentSessionStorage(userDataDirectory) {
  return new FileDesktopAgentSessionStorage(userDataDirectory);
}
function createEncryptedDesktopAgentSessionStorage(userDataDirectory, safeStorage2, logger) {
  return new EncryptedDesktopAgentSessionStorage(userDataDirectory, safeStorage2, logger);
}
function createDesktopAgentSessionStorageForSafeStorage(input) {
  if (!input.safeStorage.isEncryptionAvailable()) {
    input.logger?.warn("OS keychain unavailable; falling back to plaintext storage.");
    return {
      insecure_storage: true,
      storage: createFileDesktopAgentSessionStorage(input.userDataDirectory)
    };
  }
  return {
    insecure_storage: false,
    storage: createEncryptedDesktopAgentSessionStorage(
      input.userDataDirectory,
      input.safeStorage,
      input.logger
    )
  };
}

// src/electron-window-host.ts
var TOOLTIP_BY_STATUS = {
  awaiting_session_input: "Runa Desktop - Sign in required",
  bootstrapping: "Runa Desktop - Checking session...",
  connected: "Runa Desktop - Connected",
  connecting: "Runa Desktop - Connecting...",
  error: "Runa Desktop - Connection needs attention",
  needs_sign_in: "Runa Desktop - Sign in required",
  ready: "Runa Desktop - Ready"
};
function cloneViewModel(viewModel) {
  return {
    ...viewModel,
    primary_action: {
      ...viewModel.primary_action
    },
    secondary_action: viewModel.secondary_action ? {
      ...viewModel.secondary_action
    } : void 0,
    session_input: viewModel.session_input ? {
      ...viewModel.session_input
    } : void 0
  };
}
function projectLegacyShellState(viewModel) {
  switch (viewModel.status) {
    case "bootstrapping":
    case "connecting":
      return {
        agentConnected: false,
        sessionValid: viewModel.session_present,
        status: "connecting"
      };
    case "connected":
      return {
        agentConnected: true,
        sessionValid: true,
        status: "connected"
      };
    case "error":
      return {
        agentConnected: false,
        errorMessage: viewModel.message,
        sessionValid: viewModel.session_present,
        status: "error"
      };
    case "awaiting_session_input":
    case "needs_sign_in":
      return {
        agentConnected: false,
        sessionValid: false,
        status: "needs_sign_in"
      };
    case "ready":
      return {
        agentConnected: false,
        sessionValid: true,
        status: "stopped"
      };
  }
}
var ElectronDesktopAgentWindowHost = class {
  #options;
  #disposed = false;
  constructor(options) {
    this.#options = options;
  }
  dispose() {
    this.#disposed = true;
  }
  mount(_document, viewModel) {
    this.#publish(viewModel);
  }
  setActionHandler(_handler) {
    this.#disposed = false;
  }
  update(_document, viewModel) {
    this.#publish(viewModel);
  }
  #publish(viewModel) {
    if (this.#disposed || !viewModel) {
      return;
    }
    const clonedViewModel = cloneViewModel(viewModel);
    this.#options.mainWindow?.webContents.send("shell:viewModel", clonedViewModel);
    this.#options.mainWindow?.webContents.send(
      "shell:stateChanged",
      projectLegacyShellState(clonedViewModel)
    );
    const toolTip = this.#options.insecureStorageWarning ? `${TOOLTIP_BY_STATUS[clonedViewModel.status]} - insecure storage` : TOOLTIP_BY_STATUS[clonedViewModel.status];
    this.#options.tray?.setToolTip(toolTip);
  }
};
function createElectronDesktopAgentWindowHost(options) {
  return new ElectronDesktopAgentWindowHost(options);
}

// src/launch-html.ts
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function renderDeviceLabel(viewModel) {
  if (viewModel.machine_label) {
    return viewModel.machine_label;
  }
  return `Agent ${viewModel.agent_id}`;
}
function renderSessionInputMarkup(viewModel) {
  if (!viewModel.session_input) {
    return "";
  }
  return `<section data-session-input="true">
        <label for="desktop-agent-access-token">${escapeHtml(
    viewModel.session_input.access_token_label
  )}</label>
        <textarea id="desktop-agent-access-token" name="access_token" rows="4"></textarea>
        <label for="desktop-agent-refresh-token">${escapeHtml(
    viewModel.session_input.refresh_token_label
  )}</label>
        <textarea id="desktop-agent-refresh-token" name="refresh_token" rows="4"></textarea>
      </section>`;
}
function renderDesktopAgentLaunchDocument(viewModel) {
  const secondaryActionMarkup = viewModel.secondary_action ? `<button type="button" data-action="${escapeHtml(viewModel.secondary_action.id)}">${escapeHtml(
    viewModel.secondary_action.label
  )}</button>` : "";
  const connectedAtMarkup = viewModel.connected_at ? `<p class="launch-meta">Connected at ${escapeHtml(viewModel.connected_at)}</p>` : "";
  const sessionInputMarkup = renderSessionInputMarkup(viewModel);
  return {
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(viewModel.title)}</title>
  </head>
  <body>
    <main data-status="${escapeHtml(viewModel.status)}">
      <header>
        <p>${escapeHtml(renderDeviceLabel(viewModel))}</p>
        <h1>${escapeHtml(viewModel.title)}</h1>
      </header>
      <p>${escapeHtml(viewModel.message)}</p>
      ${connectedAtMarkup}
      ${sessionInputMarkup}
      <section>
        <button type="button" data-action="${escapeHtml(viewModel.primary_action.id)}">${escapeHtml(
      viewModel.primary_action.label
    )}</button>
        ${secondaryActionMarkup}
      </section>
    </main>
  </body>
</html>`
  };
}

// ../../packages/types/dist/ws.js
var desktopAgentProtocolVersion = 1;
var desktopAgentToolNames = [
  "desktop.click",
  "desktop.clipboard.read",
  "desktop.clipboard.write",
  "desktop.keypress",
  "desktop.launch",
  "desktop.scroll",
  "desktop.screenshot",
  "desktop.type"
];
var desktopAgentRejectCodes = [
  "INVALID_MESSAGE",
  "STALE_REQUEST",
  "UNAUTHORIZED",
  "UNSUPPORTED_PROTOCOL"
];

// ../../packages/types/dist/ws-guards.js
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isDesktopAgentCapabilityCandidate(value) {
  return isRecord3(value);
}
function isConnectionReadyMessageCandidate(value) {
  return isRecord3(value);
}
function isDesktopAgentSessionAcceptedPayloadCandidate(value) {
  return isRecord3(value);
}
function isDesktopAgentSessionAcceptedMessageCandidate(value) {
  return isRecord3(value);
}
function isDesktopAgentExecutePayloadCandidate(value) {
  return isRecord3(value);
}
function isDesktopAgentExecuteMessageCandidate(value) {
  return isRecord3(value);
}
function isDesktopAgentHeartbeatPingPayloadCandidate(value) {
  return isRecord3(value);
}
function isDesktopAgentHeartbeatPingMessageCandidate(value) {
  return isRecord3(value);
}
function isDesktopAgentRejectedPayloadCandidate(value) {
  return isRecord3(value);
}
function isDesktopAgentRejectedMessageCandidate(value) {
  return isRecord3(value);
}
function isDesktopAgentToolName(value) {
  return typeof value === "string" && desktopAgentToolNames.includes(value);
}
function isDesktopAgentCapability(value) {
  return isDesktopAgentCapabilityCandidate(value) && isDesktopAgentToolName(value.tool_name);
}
function isDesktopAgentCapabilities(value) {
  return Array.isArray(value) && value.every((capability) => isDesktopAgentCapability(capability));
}
function isDesktopAgentConnectionReadyServerMessage(value) {
  return isConnectionReadyMessageCandidate(value) && value.type === "desktop-agent.connection.ready" && value.message === "ready" && value.transport === "desktop_bridge";
}
function isDesktopAgentSessionAcceptedServerMessage(value) {
  return isDesktopAgentSessionAcceptedMessageCandidate(value) && value.type === "desktop-agent.session.accepted" && isDesktopAgentSessionAcceptedPayloadCandidate(value.payload) && typeof value.payload.agent_id === "string" && isDesktopAgentCapabilities(value.payload.capabilities) && typeof value.payload.connection_id === "string" && typeof value.payload.user_id === "string";
}
function isDesktopAgentHeartbeatPingServerMessage(value) {
  return isDesktopAgentHeartbeatPingMessageCandidate(value) && value.type === "desktop-agent.heartbeat.ping" && isDesktopAgentHeartbeatPingPayloadCandidate(value.payload) && typeof value.payload.ping_id === "string" && typeof value.payload.sent_at === "string";
}
function isDesktopAgentExecuteServerMessage(value) {
  return isDesktopAgentExecuteMessageCandidate(value) && value.type === "desktop-agent.execute" && isDesktopAgentExecutePayloadCandidate(value.payload) && isRecord3(value.payload.arguments) && typeof value.payload.call_id === "string" && typeof value.payload.request_id === "string" && typeof value.payload.run_id === "string" && isDesktopAgentToolName(value.payload.tool_name) && typeof value.payload.trace_id === "string";
}
function isDesktopAgentRejectedServerMessage(value) {
  return isDesktopAgentRejectedMessageCandidate(value) && value.type === "desktop-agent.rejected" && isDesktopAgentRejectedPayloadCandidate(value.payload) && typeof value.payload.error_message === "string" && typeof value.payload.error_code === "string" && desktopAgentRejectCodes.includes(value.payload.error_code);
}
function isDesktopAgentServerMessage(value) {
  return isDesktopAgentConnectionReadyServerMessage(value) || isDesktopAgentSessionAcceptedServerMessage(value) || isDesktopAgentHeartbeatPingServerMessage(value) || isDesktopAgentExecuteServerMessage(value) || isDesktopAgentRejectedServerMessage(value);
}

// src/input.ts
var import_node_child_process = require("node:child_process");
var MAX_EXEC_BUFFER_BYTES = 8192;
var MAX_CLICK_COUNT = 3;
var MAX_DELAY_MS = 1e3;
var MAX_SCREEN_COORDINATE = 65535;
var MAX_SCROLL_DELTA = 12e3;
var MAX_TEXT_LENGTH = 2e3;
var ALLOWED_MODIFIERS = /* @__PURE__ */ new Set(["alt", "ctrl", "shift"]);
function buildSafeEnvironment() {
  const allowedKeys = [
    "COMSPEC",
    "HOME",
    "LANG",
    "LC_ALL",
    "PATH",
    "PATHEXT",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "WINDIR"
  ];
  const safeEnvironment = {};
  for (const key of allowedKeys) {
    const value = process.env[key];
    if (value !== void 0) {
      safeEnvironment[key] = value;
    }
  }
  return safeEnvironment;
}
function createErrorResult(error_code, error_message, details, retryable) {
  return {
    details,
    error_code,
    error_message,
    retryable,
    status: "error"
  };
}
function createSuccessResult(output) {
  return {
    output,
    status: "success"
  };
}
function isRecord4(value) {
  return typeof value === "object" && value !== null;
}
function isFiniteInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value);
}
function extractErrorCode(error) {
  if (isRecord4(error)) {
    const candidate = error;
    if (typeof candidate.code === "number" || typeof candidate.code === "string") {
      return candidate.code;
    }
  }
  return void 0;
}
function toText(value) {
  if (typeof value === "string") {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }
  return "";
}
function extractStderr(error) {
  if (isRecord4(error)) {
    const candidate = error;
    return toText(candidate.stderr);
  }
  return "";
}
function toPowerShellSingleQuoted(value) {
  return `'${value.replaceAll("'", "''")}'`;
}
function runPowerShell(dependencies, script) {
  return new Promise((resolvePromise, rejectPromise) => {
    dependencies.execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-Command", script],
      {
        encoding: "utf8",
        env: buildSafeEnvironment(),
        maxBuffer: MAX_EXEC_BUFFER_BYTES,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error) {
          const enrichedError = error;
          enrichedError.stdout = stdout;
          enrichedError.stderr = stderr;
          rejectPromise(enrichedError);
          return;
        }
        resolvePromise();
      }
    );
  });
}
function createUnsupportedPlatformError(toolName, platform) {
  return createErrorResult(
    "EXECUTION_FAILED",
    `${toolName} is currently supported only on Windows hosts.`,
    {
      platform,
      reason: "unsupported_platform"
    },
    false
  );
}
function validateDesktopClickArguments(argumentsValue) {
  const allowedKeys = /* @__PURE__ */ new Set(["button", "click_count", "x", "y"]);
  for (const key of Object.keys(argumentsValue)) {
    if (!allowedKeys.has(key)) {
      return createErrorResult(
        "INVALID_INPUT",
        `desktop.click does not accept the "${key}" argument.`,
        {
          argument: key,
          reason: "unexpected_argument"
        },
        false
      );
    }
  }
  const { button = "left", click_count = 1, x, y } = argumentsValue;
  if (!isFiniteInteger(x) || x < 0 || x > MAX_SCREEN_COORDINATE) {
    return createErrorResult(
      "INVALID_INPUT",
      "desktop.click requires an integer x coordinate between 0 and 65535.",
      {
        argument: "x",
        reason: "invalid_coordinate"
      },
      false
    );
  }
  if (!isFiniteInteger(y) || y < 0 || y > MAX_SCREEN_COORDINATE) {
    return createErrorResult(
      "INVALID_INPUT",
      "desktop.click requires an integer y coordinate between 0 and 65535.",
      {
        argument: "y",
        reason: "invalid_coordinate"
      },
      false
    );
  }
  if (button !== "left" && button !== "middle" && button !== "right") {
    return createErrorResult(
      "INVALID_INPUT",
      "desktop.click button must be one of: left, right, middle.",
      {
        argument: "button",
        reason: "invalid_button"
      },
      false
    );
  }
  if (!isFiniteInteger(click_count) || click_count < 1 || click_count > MAX_CLICK_COUNT) {
    return createErrorResult(
      "INVALID_INPUT",
      "desktop.click click_count must be an integer between 1 and 3.",
      {
        argument: "click_count",
        reason: "invalid_click_count"
      },
      false
    );
  }
  return {
    button,
    click_count,
    x,
    y
  };
}
function buildDesktopClickScript(input) {
  const flagMap = {
    left: {
      down: "0x0002",
      up: "0x0004"
    },
    middle: {
      down: "0x0020",
      up: "0x0040"
    },
    right: {
      down: "0x0008",
      up: "0x0010"
    }
  };
  const flags = flagMap[input.button];
  return [
    'Add-Type @"',
    "using System;",
    "using System.Runtime.InteropServices;",
    "public static class DesktopClickNative {",
    '	[DllImport("user32.dll", SetLastError = true)]',
    "	public static extern bool SetCursorPos(int x, int y);",
    '	[DllImport("user32.dll", SetLastError = true)]',
    "	public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);",
    "}",
    '"@',
    `if (-not [DesktopClickNative]::SetCursorPos(${String(input.x)}, ${String(input.y)})) { throw "Failed to move pointer." }`,
    `for ($i = 0; $i -lt ${String(input.click_count)}; $i++) {`,
    `	[DesktopClickNative]::mouse_event(${flags.down}, 0, 0, 0, [UIntPtr]::Zero)`,
    "	Start-Sleep -Milliseconds 40",
    `	[DesktopClickNative]::mouse_event(${flags.up}, 0, 0, 0, [UIntPtr]::Zero)`,
    `	if ($i -lt (${String(input.click_count)} - 1)) { Start-Sleep -Milliseconds 50 }`,
    "}"
  ].join("\n");
}
function toDesktopClickErrorResult(error) {
  const errorCode = extractErrorCode(error);
  const stderr = extractStderr(error).trim();
  if (errorCode === "ENOENT") {
    return createErrorResult(
      "NOT_FOUND",
      "PowerShell is not available on this host.",
      {
        reason: "powershell_not_found"
      },
      false
    );
  }
  if (errorCode === "EACCES" || errorCode === "EPERM" || stderr.includes("Access is denied")) {
    return createErrorResult(
      "PERMISSION_DENIED",
      "Permission denied while injecting desktop click input.",
      {
        reason: "desktop_click_permission_denied"
      },
      false
    );
  }
  if (error instanceof Error) {
    return createErrorResult(
      "EXECUTION_FAILED",
      `Failed to execute desktop click: ${stderr || error.message}`,
      {
        reason: "desktop_click_failed"
      },
      false
    );
  }
  return createErrorResult(
    "UNKNOWN",
    "Failed to execute desktop click.",
    {
      reason: "desktop_click_unknown_failure"
    },
    false
  );
}
async function executeDesktopClick(dependencies, argumentsValue) {
  const validatedArguments = validateDesktopClickArguments(argumentsValue);
  if ("status" in validatedArguments) {
    return validatedArguments;
  }
  if (dependencies.platform !== "win32") {
    return createUnsupportedPlatformError("desktop.click", dependencies.platform);
  }
  try {
    await runPowerShell(dependencies, buildDesktopClickScript(validatedArguments));
    return createSuccessResult({
      button: validatedArguments.button,
      click_count: validatedArguments.click_count,
      position: {
        x: validatedArguments.x,
        y: validatedArguments.y
      }
    });
  } catch (error) {
    return toDesktopClickErrorResult(error);
  }
}
function toSendKeysToken(character) {
  switch (character) {
    case "+":
      return "{+}";
    case "^":
      return "{^}";
    case "%":
      return "{%}";
    case "~":
      return "{~}";
    case "(":
      return "{(}";
    case ")":
      return "{)}";
    case "[":
      return "{[}";
    case "]":
      return "{]}";
    case "{":
      return "{{}";
    case "}":
      return "{}}";
    case "\n":
      return "{ENTER}";
    case "	":
      return "{TAB}";
    default:
      return character;
  }
}
function validateDesktopTypeArguments(argumentsValue) {
  const allowedKeys = /* @__PURE__ */ new Set(["delay_ms", "text"]);
  for (const key of Object.keys(argumentsValue)) {
    if (!allowedKeys.has(key)) {
      return createErrorResult(
        "INVALID_INPUT",
        `desktop.type does not accept the "${key}" argument.`,
        {
          argument: key,
          reason: "unexpected_argument"
        },
        false
      );
    }
  }
  const { delay_ms = 0, text } = argumentsValue;
  if (typeof text !== "string" || text.length === 0 || text.length > MAX_TEXT_LENGTH) {
    return createErrorResult(
      "INVALID_INPUT",
      "desktop.type requires a non-empty text string up to 2000 characters.",
      {
        argument: "text",
        reason: "invalid_text"
      },
      false
    );
  }
  if (!isFiniteInteger(delay_ms) || delay_ms < 0 || delay_ms > MAX_DELAY_MS) {
    return createErrorResult(
      "INVALID_INPUT",
      "desktop.type delay_ms must be an integer between 0 and 1000.",
      {
        argument: "delay_ms",
        reason: "invalid_delay"
      },
      false
    );
  }
  const normalizedText = text.replaceAll("\r\n", "\n");
  return {
    delay_ms,
    text: normalizedText,
    tokens: Array.from(normalizedText, (character) => toSendKeysToken(character))
  };
}
function buildDesktopTypeScript(input) {
  const serializedTokens = input.tokens.map((token) => toPowerShellSingleQuoted(token)).join(", ");
  return [
    "Add-Type -AssemblyName System.Windows.Forms",
    `$tokens = @(${serializedTokens})`,
    `$delayMs = ${String(input.delay_ms)}`,
    "foreach ($token in $tokens) {",
    "	[System.Windows.Forms.SendKeys]::SendWait($token)",
    "	if ($delayMs -gt 0) { Start-Sleep -Milliseconds $delayMs }",
    "}"
  ].join("\n");
}
function toDesktopTypeErrorResult(error) {
  const errorCode = extractErrorCode(error);
  const stderr = extractStderr(error).trim();
  if (errorCode === "ENOENT") {
    return createErrorResult(
      "NOT_FOUND",
      "PowerShell is not available on this host.",
      {
        reason: "powershell_not_found"
      },
      false
    );
  }
  if (errorCode === "EACCES" || errorCode === "EPERM" || stderr.includes("Access is denied")) {
    return createErrorResult(
      "PERMISSION_DENIED",
      "Permission denied while injecting desktop typing input.",
      {
        reason: "desktop_type_permission_denied"
      },
      false
    );
  }
  if (error instanceof Error) {
    return createErrorResult(
      "EXECUTION_FAILED",
      `Failed to execute desktop typing: ${stderr || error.message}`,
      {
        reason: "desktop_type_failed"
      },
      false
    );
  }
  return createErrorResult(
    "UNKNOWN",
    "Failed to execute desktop typing.",
    {
      reason: "desktop_type_unknown_failure"
    },
    false
  );
}
async function executeDesktopType(dependencies, argumentsValue) {
  const validatedArguments = validateDesktopTypeArguments(argumentsValue);
  if ("status" in validatedArguments) {
    return validatedArguments;
  }
  if (dependencies.platform !== "win32") {
    return createUnsupportedPlatformError("desktop.type", dependencies.platform);
  }
  try {
    await runPowerShell(dependencies, buildDesktopTypeScript(validatedArguments));
    return createSuccessResult({
      character_count: validatedArguments.text.length,
      delay_ms: validatedArguments.delay_ms
    });
  } catch (error) {
    return toDesktopTypeErrorResult(error);
  }
}
function toSendKeysKeyToken(key) {
  const normalizedKey = key.trim().toLowerCase();
  const namedKeyMap = {
    backspace: "{BACKSPACE}",
    delete: "{DELETE}",
    down: "{DOWN}",
    end: "{END}",
    enter: "{ENTER}",
    esc: "{ESC}",
    escape: "{ESC}",
    f1: "{F1}",
    f2: "{F2}",
    f3: "{F3}",
    f4: "{F4}",
    f5: "{F5}",
    f6: "{F6}",
    f7: "{F7}",
    f8: "{F8}",
    f9: "{F9}",
    f10: "{F10}",
    f11: "{F11}",
    f12: "{F12}",
    home: "{HOME}",
    insert: "{INSERT}",
    left: "{LEFT}",
    pagedown: "{PGDN}",
    pageup: "{PGUP}",
    right: "{RIGHT}",
    space: "{SPACE}",
    tab: "{TAB}",
    up: "{UP}"
  };
  if (namedKeyMap[normalizedKey]) {
    return namedKeyMap[normalizedKey];
  }
  if (/^[a-z0-9]$/u.test(normalizedKey)) {
    return normalizedKey;
  }
  return void 0;
}
function validateDesktopKeypressArguments(argumentsValue) {
  const allowedKeys = /* @__PURE__ */ new Set(["key", "modifiers"]);
  for (const key2 of Object.keys(argumentsValue)) {
    if (!allowedKeys.has(key2)) {
      return createErrorResult(
        "INVALID_INPUT",
        `desktop.keypress does not accept the "${key2}" argument.`,
        {
          argument: key2,
          reason: "unexpected_argument"
        },
        false
      );
    }
  }
  const { key, modifiers = [] } = argumentsValue;
  if (typeof key !== "string" || key.trim().length === 0) {
    return createErrorResult(
      "INVALID_INPUT",
      "desktop.keypress requires a non-empty key string.",
      {
        argument: "key",
        reason: "invalid_key"
      },
      false
    );
  }
  if (!Array.isArray(modifiers)) {
    return createErrorResult(
      "INVALID_INPUT",
      "desktop.keypress modifiers must be an array when provided.",
      {
        argument: "modifiers",
        reason: "invalid_modifiers"
      },
      false
    );
  }
  const normalizedModifiers = [];
  for (const modifier of modifiers) {
    if (typeof modifier !== "string") {
      return createErrorResult(
        "INVALID_INPUT",
        "desktop.keypress modifiers must contain only strings.",
        {
          argument: "modifiers",
          reason: "invalid_modifier_entry"
        },
        false
      );
    }
    const normalizedModifier = modifier.trim().toLowerCase();
    if (!ALLOWED_MODIFIERS.has(normalizedModifier)) {
      return createErrorResult(
        "INVALID_INPUT",
        "desktop.keypress modifiers must be chosen from ctrl, alt, shift.",
        {
          argument: "modifiers",
          reason: "unsupported_modifier"
        },
        false
      );
    }
    if (!normalizedModifiers.includes(normalizedModifier)) {
      normalizedModifiers.push(normalizedModifier);
    }
  }
  const keyToken = toSendKeysKeyToken(key);
  if (!keyToken) {
    return createErrorResult(
      "INVALID_INPUT",
      "desktop.keypress key must be a supported named key, letter, or digit.",
      {
        argument: "key",
        reason: "unsupported_key"
      },
      false
    );
  }
  const modifierPrefix = normalizedModifiers.map((modifier) => {
    switch (modifier) {
      case "ctrl":
        return "^";
      case "alt":
        return "%";
      case "shift":
        return "+";
    }
  }).join("");
  return {
    key: key.trim().toLowerCase(),
    modifiers: normalizedModifiers,
    sequence: `${modifierPrefix}${keyToken}`
  };
}
function buildDesktopKeypressScript(input) {
  return [
    "Add-Type -AssemblyName System.Windows.Forms",
    `[System.Windows.Forms.SendKeys]::SendWait(${toPowerShellSingleQuoted(input.sequence)})`
  ].join("\n");
}
function toDesktopKeypressErrorResult(error) {
  const errorCode = extractErrorCode(error);
  const stderr = extractStderr(error).trim();
  if (errorCode === "ENOENT") {
    return createErrorResult(
      "NOT_FOUND",
      "PowerShell is not available on this host.",
      {
        reason: "powershell_not_found"
      },
      false
    );
  }
  if (errorCode === "EACCES" || errorCode === "EPERM" || stderr.includes("Access is denied")) {
    return createErrorResult(
      "PERMISSION_DENIED",
      "Permission denied while injecting desktop keypress input.",
      {
        reason: "desktop_keypress_permission_denied"
      },
      false
    );
  }
  if (error instanceof Error) {
    return createErrorResult(
      "EXECUTION_FAILED",
      `Failed to execute desktop keypress: ${stderr || error.message}`,
      {
        reason: "desktop_keypress_failed"
      },
      false
    );
  }
  return createErrorResult(
    "UNKNOWN",
    "Failed to execute desktop keypress.",
    {
      reason: "desktop_keypress_unknown_failure"
    },
    false
  );
}
async function executeDesktopKeypress(dependencies, argumentsValue) {
  const validatedArguments = validateDesktopKeypressArguments(argumentsValue);
  if ("status" in validatedArguments) {
    return validatedArguments;
  }
  if (dependencies.platform !== "win32") {
    return createUnsupportedPlatformError("desktop.keypress", dependencies.platform);
  }
  try {
    await runPowerShell(dependencies, buildDesktopKeypressScript(validatedArguments));
    return createSuccessResult({
      key: validatedArguments.key,
      modifiers: validatedArguments.modifiers
    });
  } catch (error) {
    return toDesktopKeypressErrorResult(error);
  }
}
function validateDesktopScrollArguments(argumentsValue) {
  const allowedKeys = /* @__PURE__ */ new Set(["delta_x", "delta_y"]);
  for (const key of Object.keys(argumentsValue)) {
    if (!allowedKeys.has(key)) {
      return createErrorResult(
        "INVALID_INPUT",
        `desktop.scroll does not accept the "${key}" argument.`,
        {
          argument: key,
          reason: "unexpected_argument"
        },
        false
      );
    }
  }
  const { delta_x = 0, delta_y = 0 } = argumentsValue;
  if (!isFiniteInteger(delta_x) || Math.abs(delta_x) > MAX_SCROLL_DELTA) {
    return createErrorResult(
      "INVALID_INPUT",
      "desktop.scroll delta_x must be an integer between -12000 and 12000.",
      {
        argument: "delta_x",
        reason: "invalid_delta"
      },
      false
    );
  }
  if (!isFiniteInteger(delta_y) || Math.abs(delta_y) > MAX_SCROLL_DELTA) {
    return createErrorResult(
      "INVALID_INPUT",
      "desktop.scroll delta_y must be an integer between -12000 and 12000.",
      {
        argument: "delta_y",
        reason: "invalid_delta"
      },
      false
    );
  }
  if (delta_x === 0 && delta_y === 0) {
    return createErrorResult(
      "INVALID_INPUT",
      "desktop.scroll requires at least one non-zero delta.",
      {
        reason: "zero_scroll_delta"
      },
      false
    );
  }
  return {
    delta_x,
    delta_y
  };
}
function buildDesktopScrollScript(input) {
  return [
    'Add-Type @"',
    "using System;",
    "using System.Runtime.InteropServices;",
    "public static class DesktopScrollNative {",
    '	[DllImport("user32.dll", SetLastError = true)]',
    "	public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);",
    "}",
    '"@',
    `if (${String(input.delta_y)} -ne 0) { [DesktopScrollNative]::mouse_event(0x0800, 0, 0, [uint32]${String(input.delta_y)}, [UIntPtr]::Zero) }`,
    `if (${String(input.delta_x)} -ne 0) { [DesktopScrollNative]::mouse_event(0x01000, 0, 0, [uint32]${String(input.delta_x)}, [UIntPtr]::Zero) }`
  ].join("\n");
}
function toDesktopScrollErrorResult(error) {
  const errorCode = extractErrorCode(error);
  const stderr = extractStderr(error).trim();
  if (errorCode === "ENOENT") {
    return createErrorResult(
      "NOT_FOUND",
      "PowerShell is not available on this host.",
      {
        reason: "powershell_not_found"
      },
      false
    );
  }
  if (errorCode === "EACCES" || errorCode === "EPERM" || stderr.includes("Access is denied")) {
    return createErrorResult(
      "PERMISSION_DENIED",
      "Permission denied while injecting desktop scroll input.",
      {
        reason: "desktop_scroll_permission_denied"
      },
      false
    );
  }
  if (error instanceof Error) {
    return createErrorResult(
      "EXECUTION_FAILED",
      `Failed to execute desktop scroll: ${stderr || error.message}`,
      {
        reason: "desktop_scroll_failed"
      },
      false
    );
  }
  return createErrorResult(
    "UNKNOWN",
    "Failed to execute desktop scroll.",
    {
      reason: "desktop_scroll_unknown_failure"
    },
    false
  );
}
async function executeDesktopScroll(dependencies, argumentsValue) {
  const validatedArguments = validateDesktopScrollArguments(argumentsValue);
  if ("status" in validatedArguments) {
    return validatedArguments;
  }
  if (dependencies.platform !== "win32") {
    return createUnsupportedPlatformError("desktop.scroll", dependencies.platform);
  }
  try {
    await runPowerShell(dependencies, buildDesktopScrollScript(validatedArguments));
    return createSuccessResult({
      delta_x: validatedArguments.delta_x,
      delta_y: validatedArguments.delta_y
    });
  } catch (error) {
    return toDesktopScrollErrorResult(error);
  }
}
async function executeDesktopAgentInput(toolName, argumentsValue, dependencies = {}) {
  const resolvedDependencies = {
    execFile: dependencies.execFile ?? import_node_child_process.execFile,
    platform: dependencies.platform ?? process.platform
  };
  switch (toolName) {
    case "desktop.click":
      return await executeDesktopClick(resolvedDependencies, argumentsValue);
    case "desktop.type":
      return await executeDesktopType(resolvedDependencies, argumentsValue);
    case "desktop.keypress":
      return await executeDesktopKeypress(resolvedDependencies, argumentsValue);
    case "desktop.scroll":
      return await executeDesktopScroll(resolvedDependencies, argumentsValue);
    default:
      return createErrorResult(
        "INVALID_INPUT",
        `Desktop agent has not implemented ${toolName} yet.`,
        {
          reason: "unsupported_capability"
        },
        false
      );
  }
}

// src/screenshot.ts
var import_node_child_process2 = require("node:child_process");
var import_promises2 = require("node:fs/promises");
var import_node_os = require("node:os");
var import_node_path2 = require("node:path");
var import_node_util = require("node:util");
var execFileAsync = (0, import_node_util.promisify)(import_node_child_process2.execFile);
var PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
function buildSafeEnvironment2() {
  const allowedKeys = [
    "COMSPEC",
    "HOME",
    "LANG",
    "LC_ALL",
    "PATH",
    "PATHEXT",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "WINDIR"
  ];
  const safeEnvironment = {};
  for (const key of allowedKeys) {
    const value = process.env[key];
    if (value !== void 0) {
      safeEnvironment[key] = value;
    }
  }
  return safeEnvironment;
}
function buildCaptureScript(outputPath) {
  const escapedOutputPath = outputPath.replace(/'/g, "''");
  return [
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    "$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen",
    "$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height",
    "$graphics = [System.Drawing.Graphics]::FromImage($bitmap)",
    "$graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bitmap.Size)",
    `$bitmap.Save('${escapedOutputPath}', [System.Drawing.Imaging.ImageFormat]::Png)`,
    "$graphics.Dispose()",
    "$bitmap.Dispose()"
  ].join("\n");
}
function validatePngBuffer(buffer) {
  if (buffer.byteLength === 0) {
    throw new Error("Desktop agent screenshot capture returned an empty buffer.");
  }
  const isPng = PNG_SIGNATURE.every((byte, index) => buffer[index] === byte);
  if (!isPng) {
    throw new Error("Desktop agent screenshot capture did not produce a PNG image.");
  }
}
async function captureDesktopScreenshot() {
  if (process.platform !== "win32") {
    throw new Error("Desktop agent screenshot capture is currently supported only on Windows.");
  }
  const outputPath = (0, import_node_path2.join)((0, import_node_os.tmpdir)(), `runa-desktop-agent-${Date.now()}-${Math.random()}.png`);
  try {
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-Command", buildCaptureScript(outputPath)],
      {
        encoding: "utf8",
        env: buildSafeEnvironment2(),
        maxBuffer: 16384,
        windowsHide: true
      }
    );
    const screenshotBuffer = await (0, import_promises2.readFile)(outputPath);
    validatePngBuffer(screenshotBuffer);
    return {
      base64_data: screenshotBuffer.toString("base64"),
      byte_length: screenshotBuffer.byteLength,
      format: "png",
      mime_type: "image/png"
    };
  } finally {
    await (0, import_promises2.rm)(outputPath, {
      force: true
    }).catch(() => void 0);
  }
}

// src/ws-bridge.ts
var DESKTOP_AGENT_HANDSHAKE_TIMEOUT_MS = 15e3;
function sendClientMessage(socket, message) {
  socket.send(JSON.stringify(message));
}
function createHelloMessage(options) {
  return {
    payload: {
      agent_id: options.agent_id,
      capabilities: [
        {
          tool_name: "desktop.click"
        },
        {
          tool_name: "desktop.keypress"
        },
        {
          tool_name: "desktop.scroll"
        },
        {
          tool_name: "desktop.screenshot"
        },
        {
          tool_name: "desktop.type"
        }
      ],
      machine_label: options.machine_label,
      protocol_version: desktopAgentProtocolVersion
    },
    type: "desktop-agent.hello"
  };
}
function createResultMessage(request_id, call_id, tool_name, result) {
  return {
    payload: {
      call_id,
      request_id,
      tool_name,
      ...result
    },
    type: "desktop-agent.result"
  };
}
function createHeartbeatPongMessage(ping) {
  return {
    payload: {
      ping_id: ping.payload.ping_id,
      received_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    type: "desktop-agent.heartbeat.pong"
  };
}
async function waitForServerMessage(socket, guard) {
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Desktop agent bridge handshake timed out."));
    }, DESKTOP_AGENT_HANDSHAKE_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timeout);
      socket.removeEventListener("close", handleClose);
      socket.removeEventListener("error", handleError);
      socket.removeEventListener("message", handleMessage);
    };
    const handleClose = (event) => {
      cleanup();
      reject(new Error(`Desktop agent bridge closed: ${event.reason || String(event.code)}`));
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Desktop agent bridge socket error."));
    };
    const handleMessage = (event) => {
      try {
        const parsedMessage = JSON.parse(String(event.data));
        if (!isDesktopAgentServerMessage(parsedMessage)) {
          throw new Error("Desktop agent bridge received an invalid server message.");
        }
        if (isDesktopAgentRejectedServerMessage(parsedMessage)) {
          throw new Error(parsedMessage.payload.error_message);
        }
        if (guard(parsedMessage)) {
          cleanup();
          resolve(parsedMessage);
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    socket.addEventListener("close", handleClose, { once: true });
    socket.addEventListener("error", handleError, { once: true });
    socket.addEventListener("message", handleMessage);
  });
}
async function handleExecuteMessage(socket, message, captureScreenshot) {
  try {
    switch (message.payload.tool_name) {
      case "desktop.screenshot": {
        const screenshot = await captureScreenshot();
        sendClientMessage(
          socket,
          createResultMessage(
            message.payload.request_id,
            message.payload.call_id,
            message.payload.tool_name,
            {
              output: screenshot,
              status: "success"
            }
          )
        );
        return;
      }
      case "desktop.click":
      case "desktop.keypress":
      case "desktop.scroll":
      case "desktop.type": {
        const result = await executeDesktopAgentInput(
          message.payload.tool_name,
          message.payload.arguments
        );
        sendClientMessage(
          socket,
          createResultMessage(
            message.payload.request_id,
            message.payload.call_id,
            message.payload.tool_name,
            result
          )
        );
        return;
      }
      default:
        sendClientMessage(
          socket,
          createResultMessage(
            message.payload.request_id,
            message.payload.call_id,
            message.payload.tool_name,
            {
              details: {
                reason: "unsupported_capability"
              },
              error_code: "INVALID_INPUT",
              error_message: `Desktop agent has not implemented ${message.payload.tool_name} yet.`,
              retryable: false,
              status: "error"
            }
          )
        );
    }
  } catch (error) {
    sendClientMessage(
      socket,
      createResultMessage(
        message.payload.request_id,
        message.payload.call_id,
        message.payload.tool_name,
        {
          details: {
            reason: message.payload.tool_name === "desktop.screenshot" ? "desktop_capture_failed" : "desktop_input_failed"
          },
          error_code: "EXECUTION_FAILED",
          error_message: error instanceof Error ? error.message : message.payload.tool_name === "desktop.screenshot" ? "Desktop agent screenshot capture failed." : `Desktop agent ${message.payload.tool_name} execution failed.`,
          retryable: false,
          status: "error"
        }
      )
    );
  }
}
async function startDesktopAgentBridge(options) {
  const socketFactory = options.web_socket_factory ?? ((url) => new WebSocket(url));
  const bridgeUrl = new URL(options.server_url);
  bridgeUrl.searchParams.set("access_token", options.access_token);
  const socket = socketFactory(bridgeUrl.toString());
  const connectionReadyPromise = waitForServerMessage(
    socket,
    isDesktopAgentConnectionReadyServerMessage
  );
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("Desktop agent bridge failed to connect.")),
      { once: true }
    );
  });
  await connectionReadyPromise;
  const sessionAcceptedPromise = waitForServerMessage(
    socket,
    isDesktopAgentSessionAcceptedServerMessage
  );
  sendClientMessage(socket, createHelloMessage(options));
  await sessionAcceptedPromise;
  const captureScreenshot = options.capture_screenshot ?? captureDesktopScreenshot;
  socket.addEventListener("message", (event) => {
    try {
      const parsedMessage = JSON.parse(String(event.data));
      if (!isDesktopAgentServerMessage(parsedMessage)) {
        socket.close(1008, "Desktop agent bridge received an invalid server message.");
        return;
      }
      if (isDesktopAgentExecuteServerMessage(parsedMessage)) {
        void handleExecuteMessage(socket, parsedMessage, captureScreenshot);
      }
      if (isDesktopAgentHeartbeatPingServerMessage(parsedMessage)) {
        sendClientMessage(socket, createHeartbeatPongMessage(parsedMessage));
      }
      if (isDesktopAgentRejectedServerMessage(parsedMessage)) {
        socket.close(1011, parsedMessage.payload.error_message);
      }
    } catch {
      socket.close(1008, "Desktop agent bridge received an invalid server message.");
    }
  });
  return {
    close(code, reason) {
      socket.close(code, reason);
    },
    socket
  };
}

// src/session.ts
var SESSION_EXPIRING_WINDOW_SECONDS = 90;
function createSignedOutSnapshot(config, reason, error_message) {
  return {
    agent_id: config.agent_id,
    error_message,
    machine_label: config.machine_label,
    reason,
    status: "signed_out"
  };
}
function createBootstrappingSnapshot(config) {
  return {
    agent_id: config.agent_id,
    machine_label: config.machine_label,
    status: "bootstrapping"
  };
}
function createSignedInSnapshot(config, session2) {
  return {
    agent_id: config.agent_id,
    machine_label: config.machine_label,
    session: session2,
    status: "signed_in"
  };
}
function createBridgeConnectingSnapshot(config, session2) {
  return {
    agent_id: config.agent_id,
    machine_label: config.machine_label,
    session: session2,
    status: "bridge_connecting"
  };
}
function createBridgeConnectedSnapshot(config, session2, connectedAt) {
  return {
    agent_id: config.agent_id,
    connected_at: connectedAt,
    machine_label: config.machine_label,
    session: session2,
    status: "bridge_connected"
  };
}
function createBridgeErrorSnapshot(config, session2, error_message) {
  return {
    agent_id: config.agent_id,
    error_message,
    machine_label: config.machine_label,
    session: session2,
    status: "bridge_error"
  };
}
function cloneSession(session2) {
  return {
    access_token: session2.access_token,
    expires_at: session2.expires_at,
    expires_in: session2.expires_in,
    refresh_token: session2.refresh_token,
    token_type: session2.token_type
  };
}
function cloneSnapshot(snapshot) {
  if ("session" in snapshot) {
    return {
      ...snapshot,
      session: cloneSession(snapshot.session)
    };
  }
  return {
    ...snapshot
  };
}
function resolveRuntimeErrorMessage(error, fallback) {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}
function shouldRefreshSession(session2) {
  if (typeof session2.expires_at !== "number") {
    return false;
  }
  const nowSeconds = Math.trunc(Date.now() / 1e3);
  return session2.expires_at <= nowSeconds + SESSION_EXPIRING_WINDOW_SECONDS;
}
var InMemoryDesktopAgentSessionStorage = class {
  #session;
  constructor(initialSession = null) {
    this.#session = initialSession ? cloneSession(initialSession) : null;
  }
  async clear() {
    this.#session = null;
  }
  async load() {
    return this.#session ? cloneSession(this.#session) : null;
  }
  async save(session2) {
    this.#session = cloneSession(session2);
  }
};
var DesktopAgentSessionRuntimeImpl = class {
  #options;
  #activeSession;
  #bootstrapSession;
  #bridgeCleanup;
  #bridgeSession;
  #operation;
  #snapshot;
  constructor(options) {
    this.#options = {
      agent_id: options.agent_id,
      auth_fetch: options.auth_fetch ?? globalThis.fetch,
      bridge_factory: options.bridge_factory ?? startDesktopAgentBridge,
      initial_session: options.initial_session ? cloneSession(options.initial_session) : void 0,
      machine_label: options.machine_label,
      server_url: options.server_url,
      session_storage: options.session_storage ?? new InMemoryDesktopAgentSessionStorage(options.initial_session ?? null)
    };
    this.#bootstrapSession = options.initial_session ? cloneSession(options.initial_session) : null;
    this.#activeSession = options.initial_session ? cloneSession(options.initial_session) : null;
    this.#bridgeCleanup = null;
    this.#bridgeSession = null;
    this.#operation = Promise.resolve();
    this.#snapshot = createSignedOutSnapshot(
      this.#options,
      options.initial_session ? "stopped" : "missing_session"
    );
  }
  getSnapshot() {
    return cloneSnapshot(this.#snapshot);
  }
  start() {
    return this.#enqueue(async () => {
      if (this.#bridgeSession && this.#snapshot.status === "bridge_connected") {
        return this.getSnapshot();
      }
      this.#setSnapshot(createBootstrappingSnapshot(this.#options));
      const resolvedSession = await this.#resolveBootstrapSession();
      if (!resolvedSession) {
        return this.getSnapshot();
      }
      this.#activeSession = resolvedSession;
      this.#setSnapshot(createSignedInSnapshot(this.#options, resolvedSession));
      this.#setSnapshot(createBridgeConnectingSnapshot(this.#options, resolvedSession));
      try {
        const bridgeSession = await this.#options.bridge_factory({
          access_token: resolvedSession.access_token,
          agent_id: this.#options.agent_id,
          machine_label: this.#options.machine_label,
          server_url: this.#options.server_url
        });
        this.#bridgeSession = bridgeSession;
        this.#attachBridgeLifecycle(bridgeSession, resolvedSession);
        this.#setSnapshot(
          createBridgeConnectedSnapshot(this.#options, resolvedSession, (/* @__PURE__ */ new Date()).toISOString())
        );
      } catch (error) {
        this.#bridgeSession = null;
        this.#setSnapshot(
          createBridgeErrorSnapshot(
            this.#options,
            resolvedSession,
            resolveRuntimeErrorMessage(error, "Desktop bridge connection failed.")
          )
        );
      }
      return this.getSnapshot();
    });
  }
  stop() {
    return this.#enqueue(async () => {
      this.#closeBridgeSession(1e3, "Desktop runtime stopped.");
      if (this.#activeSession) {
        this.#setSnapshot(createSignedInSnapshot(this.#options, this.#activeSession));
      } else {
        this.#setSnapshot(createSignedOutSnapshot(this.#options, "stopped"));
      }
      return this.getSnapshot();
    });
  }
  setSession(session2) {
    return this.#enqueue(async () => {
      const normalizedSession = normalizeDesktopAgentPersistedSession(session2);
      this.#closeBridgeSession(1e3, "Desktop runtime session updated.");
      await this.#options.session_storage.save(normalizedSession);
      this.#activeSession = cloneSession(normalizedSession);
      this.#bootstrapSession = cloneSession(normalizedSession);
      this.#setSnapshot(createSignedInSnapshot(this.#options, normalizedSession));
      return this.getSnapshot();
    });
  }
  signOut() {
    return this.#enqueue(async () => {
      await this.stop();
      await this.#options.session_storage.clear();
      this.#activeSession = null;
      this.#bootstrapSession = null;
      this.#setSnapshot(createSignedOutSnapshot(this.#options, "signed_out"));
      return this.getSnapshot();
    });
  }
  async #resolveBootstrapSession() {
    try {
      const storedSession = await this.#options.session_storage.load();
      const candidateSession = storedSession ?? this.#bootstrapSession ?? this.#activeSession ?? null;
      if (!candidateSession) {
        this.#setSnapshot(createSignedOutSnapshot(this.#options, "missing_session"));
        return null;
      }
      let normalizedSession = normalizeDesktopAgentPersistedSession(candidateSession);
      if (shouldRefreshSession(normalizedSession)) {
        if (!normalizedSession.refresh_token) {
          this.#setSnapshot(
            createSignedOutSnapshot(
              this.#options,
              "refresh_failed",
              "Desktop agent session expired and no refresh token was available."
            )
          );
          return null;
        }
        try {
          normalizedSession = await refreshDesktopAgentSession({
            auth_fetch: this.#options.auth_fetch,
            server_url: this.#options.server_url,
            session: normalizedSession
          });
        } catch (error) {
          await this.#options.session_storage.clear();
          this.#activeSession = null;
          this.#bootstrapSession = null;
          this.#setSnapshot(
            createSignedOutSnapshot(
              this.#options,
              "refresh_failed",
              resolveRuntimeErrorMessage(error, "Desktop agent session refresh failed.")
            )
          );
          return null;
        }
      }
      await this.#options.session_storage.save(normalizedSession);
      this.#bootstrapSession = cloneSession(normalizedSession);
      return normalizedSession;
    } catch (error) {
      this.#activeSession = null;
      this.#setSnapshot(
        createSignedOutSnapshot(
          this.#options,
          "bootstrap_failed",
          resolveRuntimeErrorMessage(error, "Desktop agent session bootstrap failed.")
        )
      );
      return null;
    }
  }
  #attachBridgeLifecycle(bridgeSession, session2) {
    const handleClose = (event) => {
      if (this.#bridgeSession !== bridgeSession) {
        return;
      }
      this.#bridgeSession = null;
      this.#detachBridgeLifecycle();
      this.#setSnapshot(
        createBridgeErrorSnapshot(
          this.#options,
          session2,
          event.reason || `Desktop bridge closed with code ${String(event.code)}.`
        )
      );
    };
    const handleError = () => {
      if (this.#bridgeSession !== bridgeSession) {
        return;
      }
      this.#bridgeSession = null;
      this.#detachBridgeLifecycle();
      this.#setSnapshot(
        createBridgeErrorSnapshot(this.#options, session2, "Desktop bridge socket error.")
      );
    };
    bridgeSession.socket.addEventListener("close", handleClose);
    bridgeSession.socket.addEventListener("error", handleError);
    this.#bridgeCleanup = () => {
      bridgeSession.socket.removeEventListener("close", handleClose);
      bridgeSession.socket.removeEventListener("error", handleError);
    };
  }
  #closeBridgeSession(code, reason) {
    const bridgeSession = this.#bridgeSession;
    if (!bridgeSession) {
      return;
    }
    this.#bridgeSession = null;
    this.#detachBridgeLifecycle();
    bridgeSession.close(code, reason);
  }
  #detachBridgeLifecycle() {
    this.#bridgeCleanup?.();
    this.#bridgeCleanup = null;
  }
  #enqueue(operation) {
    const runOperation = this.#operation.then(operation, operation);
    this.#operation = runOperation.then(
      () => void 0,
      () => void 0
    );
    return runOperation;
  }
  #setSnapshot(snapshot) {
    this.#snapshot = cloneSnapshot(snapshot);
  }
};
function createDesktopAgentSessionRuntime(options) {
  return new DesktopAgentSessionRuntimeImpl(options);
}

// src/shell.ts
function projectShellSnapshot(runtimeSnapshot) {
  switch (runtimeSnapshot.status) {
    case "bootstrapping":
      return {
        agent_id: runtimeSnapshot.agent_id,
        machine_label: runtimeSnapshot.machine_label,
        message: "Connecting to Runa",
        session_present: false,
        status: "bootstrapping"
      };
    case "signed_in":
      return {
        agent_id: runtimeSnapshot.agent_id,
        machine_label: runtimeSnapshot.machine_label,
        message: "Ready to connect",
        session_present: true,
        status: "ready"
      };
    case "bridge_connecting":
      return {
        agent_id: runtimeSnapshot.agent_id,
        machine_label: runtimeSnapshot.machine_label,
        message: "Connecting to Runa",
        session_present: true,
        status: "connecting"
      };
    case "bridge_connected":
      return {
        agent_id: runtimeSnapshot.agent_id,
        connected_at: runtimeSnapshot.connected_at,
        machine_label: runtimeSnapshot.machine_label,
        message: "Connected",
        session_present: true,
        status: "connected"
      };
    case "bridge_error":
      return {
        agent_id: runtimeSnapshot.agent_id,
        machine_label: runtimeSnapshot.machine_label,
        message: "Connection failed",
        session_present: true,
        status: "error"
      };
    case "signed_out":
      return {
        agent_id: runtimeSnapshot.agent_id,
        machine_label: runtimeSnapshot.machine_label,
        message: runtimeSnapshot.reason === "bootstrap_failed" || runtimeSnapshot.reason === "refresh_failed" ? "Connection failed" : "Sign in required",
        session_present: false,
        status: runtimeSnapshot.reason === "bootstrap_failed" || runtimeSnapshot.reason === "refresh_failed" ? "error" : "needs_sign_in"
      };
  }
}
function resolveShellErrorSnapshot(runtimeSnapshot) {
  return {
    agent_id: runtimeSnapshot.agent_id,
    machine_label: runtimeSnapshot.machine_label,
    message: "Connection failed",
    session_present: "session" in runtimeSnapshot,
    status: "error"
  };
}
function cloneShellSnapshot(snapshot) {
  return {
    ...snapshot
  };
}
function areShellSnapshotsEqual(left, right) {
  return left.agent_id === right.agent_id && left.connected_at === right.connected_at && left.machine_label === right.machine_label && left.message === right.message && left.session_present === right.session_present && left.status === right.status;
}
var SHELL_RUNTIME_WATCH_INTERVAL_MS = 500;
var DesktopAgentShellImpl = class {
  #runtime;
  #listeners = /* @__PURE__ */ new Set();
  #snapshot;
  #watchHandle = null;
  constructor(options) {
    this.#runtime = options.session_runtime ?? createDesktopAgentSessionRuntime({
      agent_id: options.agent_id,
      auth_fetch: options.auth_fetch,
      bridge_factory: options.bridge_factory,
      initial_session: options.initial_session,
      machine_label: options.machine_label,
      server_url: options.server_url,
      session_storage: options.session_storage
    });
    this.#snapshot = projectShellSnapshot(this.#runtime.getSnapshot());
  }
  getSnapshot() {
    return cloneShellSnapshot(this.#snapshot);
  }
  retry() {
    return this.#syncFromRuntime(async () => await this.#runtime.start());
  }
  signOut() {
    return this.#syncFromRuntime(async () => await this.#runtime.signOut());
  }
  start() {
    return this.#syncFromRuntime(async () => await this.#runtime.start());
  }
  stop() {
    return this.#syncFromRuntime(async () => await this.#runtime.stop());
  }
  submitSession(session2) {
    return this.#syncFromRuntime(async () => await this.#runtime.setSession(session2));
  }
  subscribe(listener) {
    this.#listeners.add(listener);
    this.#ensureWatchLoop();
    listener(this.getSnapshot());
    return () => {
      this.#listeners.delete(listener);
      this.#stopWatchLoopIfIdle();
    };
  }
  async #syncFromRuntime(operation) {
    try {
      this.#setSnapshot(projectShellSnapshot(await operation()));
    } catch {
      this.#setSnapshot(resolveShellErrorSnapshot(this.#runtime.getSnapshot()));
    }
    return this.getSnapshot();
  }
  #ensureWatchLoop() {
    if (this.#watchHandle || this.#listeners.size === 0) {
      return;
    }
    this.#watchHandle = setInterval(() => {
      const runtimeSnapshot = this.#runtime.getSnapshot();
      this.#setSnapshot(projectShellSnapshot(runtimeSnapshot));
    }, SHELL_RUNTIME_WATCH_INTERVAL_MS);
    if (typeof this.#watchHandle === "object" && this.#watchHandle !== null && "unref" in this.#watchHandle && typeof this.#watchHandle.unref === "function") {
      this.#watchHandle.unref();
    }
  }
  #stopWatchLoopIfIdle() {
    if (this.#listeners.size > 0 || !this.#watchHandle) {
      return;
    }
    clearInterval(this.#watchHandle);
    this.#watchHandle = null;
  }
  #setSnapshot(nextSnapshot) {
    if (areShellSnapshotsEqual(this.#snapshot, nextSnapshot)) {
      return;
    }
    this.#snapshot = cloneShellSnapshot(nextSnapshot);
    this.#notifyListeners();
  }
  #notifyListeners() {
    const snapshot = this.getSnapshot();
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }
};
function createDesktopAgentShell(options) {
  return new DesktopAgentShellImpl(options);
}

// src/launch-surface.ts
function cloneLaunchAction(action) {
  return {
    ...action
  };
}
function cloneLaunchSnapshot(snapshot) {
  return {
    ...snapshot
  };
}
function cloneLaunchViewModel(viewModel) {
  return {
    ...viewModel,
    primary_action: cloneLaunchAction(viewModel.primary_action),
    secondary_action: viewModel.secondary_action ? cloneLaunchAction(viewModel.secondary_action) : void 0
  };
}
function projectLaunchSurfaceSnapshot(shellSnapshot) {
  return {
    agent_id: shellSnapshot.agent_id,
    connected_at: shellSnapshot.connected_at,
    machine_label: shellSnapshot.machine_label,
    message: shellSnapshot.message,
    session_present: shellSnapshot.session_present,
    status: shellSnapshot.status
  };
}
function resolveLaunchViewModel(snapshot) {
  switch (snapshot.status) {
    case "needs_sign_in":
      return {
        agent_id: snapshot.agent_id,
        machine_label: snapshot.machine_label,
        message: "Sign in to connect this computer to Runa.",
        primary_action: {
          id: "sign_in",
          label: "Sign in"
        },
        session_present: snapshot.session_present,
        status: snapshot.status,
        title: "Sign in required"
      };
    case "bootstrapping":
      return {
        agent_id: snapshot.agent_id,
        machine_label: snapshot.machine_label,
        message: "Checking your saved session.",
        primary_action: {
          id: "connecting",
          label: "Checking session"
        },
        session_present: snapshot.session_present,
        status: snapshot.status,
        title: "Connecting to Runa"
      };
    case "ready":
      return {
        agent_id: snapshot.agent_id,
        machine_label: snapshot.machine_label,
        message: "Your session is ready when you want to connect.",
        primary_action: {
          id: "connect",
          label: "Connect"
        },
        secondary_action: {
          id: "sign_out",
          label: "Sign out"
        },
        session_present: snapshot.session_present,
        status: snapshot.status,
        title: "Ready to connect"
      };
    case "connecting":
      return {
        agent_id: snapshot.agent_id,
        machine_label: snapshot.machine_label,
        message: "Connecting to Runa.",
        primary_action: {
          id: "connecting",
          label: "Connecting"
        },
        secondary_action: {
          id: "sign_out",
          label: "Sign out"
        },
        session_present: snapshot.session_present,
        status: snapshot.status,
        title: "Connecting to Runa"
      };
    case "connected":
      return {
        agent_id: snapshot.agent_id,
        connected_at: snapshot.connected_at,
        machine_label: snapshot.machine_label,
        message: "This computer is connected and ready.",
        primary_action: {
          id: "connect",
          label: "Connected"
        },
        secondary_action: {
          id: "sign_out",
          label: "Sign out"
        },
        session_present: snapshot.session_present,
        status: snapshot.status,
        title: "Connected"
      };
    case "error":
      return {
        agent_id: snapshot.agent_id,
        machine_label: snapshot.machine_label,
        message: snapshot.session_present ? "We could not connect right now. You can try again." : "Sign in again to continue.",
        primary_action: snapshot.session_present ? {
          id: "retry",
          label: "Try again"
        } : {
          id: "sign_in",
          label: "Sign in"
        },
        secondary_action: snapshot.session_present ? {
          id: "sign_out",
          label: "Sign out"
        } : void 0,
        session_present: snapshot.session_present,
        status: snapshot.status,
        title: "Connection failed"
      };
  }
}
var DesktopAgentLaunchSurfaceImpl = class {
  #listeners = /* @__PURE__ */ new Set();
  #shell;
  #snapshot;
  #viewModel;
  constructor(options) {
    this.#shell = options.shell ?? createDesktopAgentShell({
      agent_id: options.agent_id,
      auth_fetch: options.auth_fetch,
      bridge_factory: options.bridge_factory,
      initial_session: options.initial_session,
      machine_label: options.machine_label,
      server_url: options.server_url,
      session_runtime: options.session_runtime,
      session_storage: options.session_storage
    });
    this.#snapshot = projectLaunchSurfaceSnapshot(this.#shell.getSnapshot());
    this.#viewModel = resolveLaunchViewModel(this.#snapshot);
    this.#shell.subscribe((shellSnapshot) => {
      this.#sync(shellSnapshot);
    });
  }
  getSnapshot() {
    return cloneLaunchSnapshot(this.#snapshot);
  }
  getViewModel() {
    return cloneLaunchViewModel(this.#viewModel);
  }
  retry() {
    return this.#run(async () => await this.#shell.retry());
  }
  signOut() {
    return this.#run(async () => await this.#shell.signOut());
  }
  start() {
    return this.#run(async () => await this.#shell.start());
  }
  stop() {
    return this.#run(async () => await this.#shell.stop());
  }
  submitSession(session2) {
    return this.#run(async () => await this.#shell.submitSession(session2));
  }
  subscribe(listener) {
    this.#listeners.add(listener);
    listener(this.getSnapshot(), this.getViewModel());
    return () => {
      this.#listeners.delete(listener);
    };
  }
  async #run(operation) {
    await operation();
    return this.getSnapshot();
  }
  #sync(shellSnapshot) {
    this.#snapshot = projectLaunchSurfaceSnapshot(shellSnapshot);
    this.#viewModel = resolveLaunchViewModel(this.#snapshot);
    this.#notifyListeners();
  }
  #notifyListeners() {
    if (this.#listeners.size === 0) {
      return;
    }
    const snapshot = this.getSnapshot();
    const viewModel = this.getViewModel();
    for (const listener of this.#listeners) {
      listener(snapshot, viewModel);
    }
  }
};
function createDesktopAgentLaunchSurface(options) {
  return new DesktopAgentLaunchSurfaceImpl(options);
}

// src/protocol-handler.ts
var PAIRING_CODE_PATTERN = /^[A-Z0-9_-]{6,128}$/u;
function parseDesktopPairingCodeUrl(input) {
  let parsedUrl;
  try {
    parsedUrl = new URL(input);
  } catch {
    return null;
  }
  if (parsedUrl.protocol !== "runa:" || parsedUrl.hostname !== "desktop-pair") {
    return null;
  }
  const code = parsedUrl.searchParams.get("code")?.trim();
  if (!code || !PAIRING_CODE_PATTERN.test(code)) {
    return null;
  }
  return { code };
}
function findDesktopPairingCodeInArgv(argv) {
  for (const argument of argv) {
    const payload = parseDesktopPairingCodeUrl(argument);
    if (payload) {
      return payload;
    }
  }
  return null;
}
function maskDesktopPairingCode(code) {
  const normalizedCode = code.trim();
  if (normalizedCode.length <= 4) {
    return "****";
  }
  return `${normalizedCode.slice(0, 4)}...`;
}

// src/window-host.ts
var NoopDesktopAgentWindowHost = class {
  #document = null;
  #handler = null;
  dispose() {
    this.#document = null;
    this.#handler = null;
  }
  mount(document) {
    this.#document = document;
  }
  setActionHandler(handler) {
    this.#handler = handler;
  }
  update(document) {
    this.#document = document;
  }
};
function createNoopDesktopAgentWindowHost() {
  return new NoopDesktopAgentWindowHost();
}

// src/launch-controller.ts
var noopLaunchControllerLogger = {
  warn: () => {
  }
};
function cloneControllerSnapshot(snapshot) {
  return {
    ...snapshot
  };
}
function cloneControllerViewModel(viewModel) {
  return {
    ...viewModel,
    primary_action: {
      ...viewModel.primary_action
    },
    secondary_action: viewModel.secondary_action ? {
      ...viewModel.secondary_action
    } : void 0,
    session_input: viewModel.session_input ? {
      ...viewModel.session_input
    } : void 0
  };
}
function projectControllerSnapshot(snapshot, awaitingSessionInput, awaitingSessionMessage) {
  if (awaitingSessionInput) {
    return {
      agent_id: snapshot.agent_id,
      awaiting_session_input: true,
      machine_label: snapshot.machine_label,
      message: awaitingSessionMessage ?? "Paste your session to continue connecting this computer.",
      session_present: snapshot.session_present,
      status: "awaiting_session_input"
    };
  }
  return {
    agent_id: snapshot.agent_id,
    awaiting_session_input: false,
    connected_at: snapshot.connected_at,
    machine_label: snapshot.machine_label,
    message: snapshot.message,
    session_present: snapshot.session_present,
    status: snapshot.status
  };
}
function resolvePrimaryAction(viewModel) {
  switch (viewModel.status) {
    case "needs_sign_in":
      return {
        id: "sign_in",
        label: viewModel.primary_action.label
      };
    case "error":
      return {
        id: viewModel.session_present ? "retry" : "sign_in",
        label: viewModel.primary_action.label
      };
    case "bootstrapping":
    case "connecting":
    case "connected":
    case "ready":
      return {
        id: "connect",
        label: viewModel.primary_action.label
      };
  }
}
function resolveSecondaryAction(viewModel, awaitingSessionInput) {
  if (awaitingSessionInput && viewModel.session_present) {
    return {
      id: "sign_out",
      label: "Sign out"
    };
  }
  if (!viewModel.secondary_action) {
    return void 0;
  }
  return {
    id: "sign_out",
    label: viewModel.secondary_action.label
  };
}
function projectControllerViewModel(snapshot, viewModel, awaitingSessionInput, awaitingSessionMessage) {
  if (awaitingSessionInput) {
    return {
      agent_id: snapshot.agent_id,
      awaiting_session_input: true,
      machine_label: snapshot.machine_label,
      message: awaitingSessionMessage ?? "Paste your session to continue connecting this computer.",
      primary_action: {
        id: "submit_session",
        label: "Continue"
      },
      session_present: snapshot.session_present,
      session_input: {
        access_token_label: "Access token",
        refresh_token_label: "Refresh token"
      },
      status: "awaiting_session_input",
      title: "Sign in required"
    };
  }
  return {
    agent_id: snapshot.agent_id,
    awaiting_session_input: false,
    connected_at: snapshot.connected_at,
    machine_label: snapshot.machine_label,
    message: viewModel.message,
    primary_action: resolvePrimaryAction(viewModel),
    secondary_action: resolveSecondaryAction(viewModel, false),
    session_present: snapshot.session_present,
    status: snapshot.status,
    title: viewModel.title
  };
}
var DesktopAgentLaunchControllerImpl = class {
  #host;
  #launchSurface;
  #logger;
  #awaitingSessionInput = false;
  #mounted = false;
  #started = false;
  #surfaceSnapshot;
  #surfaceViewModel;
  #sessionInputMessage = null;
  #snapshot;
  #surfaceUnsubscribe = null;
  #pendingPairingCode = null;
  #viewModel;
  constructor(options) {
    this.#host = options.host ?? createNoopDesktopAgentWindowHost();
    this.#logger = options.logger ?? noopLaunchControllerLogger;
    this.#launchSurface = options.launch_surface ?? createDesktopAgentLaunchSurface({
      agent_id: options.agent_id,
      auth_fetch: options.auth_fetch,
      bridge_factory: options.bridge_factory,
      initial_session: options.initial_session,
      machine_label: options.machine_label,
      server_url: options.server_url,
      session_runtime: options.session_runtime,
      session_storage: options.session_storage,
      shell: options.shell
    });
    this.#surfaceSnapshot = this.#launchSurface.getSnapshot();
    this.#surfaceViewModel = this.#launchSurface.getViewModel();
    this.#snapshot = projectControllerSnapshot(this.#surfaceSnapshot, false);
    this.#viewModel = projectControllerViewModel(
      this.#surfaceSnapshot,
      this.#surfaceViewModel,
      false
    );
  }
  getSnapshot() {
    return cloneControllerSnapshot(this.#snapshot);
  }
  getViewModel() {
    return cloneControllerViewModel(this.#viewModel);
  }
  async handlePairingCode(code) {
    this.#pendingPairingCode = code;
    this.#awaitingSessionInput = true;
    this.#sessionInputMessage = `Pairing code received, exchanging ${maskDesktopPairingCode(
      code
    )}.`;
    this.#syncFromSurface();
    await this.#render("update");
    return this.getSnapshot();
  }
  async invokeAction(actionId) {
    if (actionId === "submit_session") {
      this.#awaitingSessionInput = true;
      this.#sessionInputMessage = null;
      this.#syncFromSurface();
      await this.#render("update");
      return this.getSnapshot();
    }
    await this.#handleAction({ id: actionId });
    return this.getSnapshot();
  }
  signOut() {
    this.#awaitingSessionInput = false;
    this.#sessionInputMessage = null;
    return this.#run(async () => await this.#launchSurface.signOut());
  }
  async start() {
    if (this.#started) {
      return this.getSnapshot();
    }
    this.#started = true;
    await this.#host.setActionHandler(async (event) => {
      await this.#handleAction(event);
    });
    this.#surfaceUnsubscribe = this.#launchSurface.subscribe((snapshot, viewModel) => {
      this.#surfaceSnapshot = snapshot;
      this.#surfaceViewModel = viewModel;
      this.#syncAwaitingSessionInputFromSurface();
      this.#syncFromSurface();
      if (this.#mounted) {
        void this.#render("update");
      }
    });
    await this.#render("mount");
    this.#mounted = true;
    this.#surfaceSnapshot = await this.#launchSurface.start();
    this.#surfaceViewModel = this.#launchSurface.getViewModel();
    this.#syncAwaitingSessionInputFromSurface();
    this.#syncFromSurface();
    await this.#render("update");
    return this.getSnapshot();
  }
  async stop() {
    if (!this.#started) {
      return this.getSnapshot();
    }
    this.#awaitingSessionInput = false;
    this.#sessionInputMessage = null;
    await this.#launchSurface.stop();
    this.#surfaceUnsubscribe?.();
    this.#surfaceUnsubscribe = null;
    this.#mounted = false;
    await this.#host.dispose();
    this.#started = false;
    return this.getSnapshot();
  }
  async submitSession(session2) {
    await this.#handleSessionSubmit(session2);
    return this.getSnapshot();
  }
  async #handleAction(event) {
    switch (event.id) {
      case "connect":
        await this.#launchSurface.start();
        return;
      case "connecting":
        return;
      case "retry":
        await this.#launchSurface.retry();
        return;
      case "sign_out":
        this.#awaitingSessionInput = false;
        this.#sessionInputMessage = null;
        await this.#launchSurface.signOut();
        return;
      case "sign_in":
        this.#awaitingSessionInput = true;
        this.#sessionInputMessage = null;
        this.#syncFromSurface();
        await this.#render("update");
        return;
      case "submit_session":
        await this.#handleSessionSubmit(event.payload);
        return;
    }
  }
  async #run(operation) {
    this.#surfaceSnapshot = await operation();
    this.#surfaceViewModel = this.#launchSurface.getViewModel();
    this.#syncAwaitingSessionInputFromSurface();
    this.#syncFromSurface();
    if (this.#started) {
      await this.#render("update");
    }
    return this.getSnapshot();
  }
  async #render(mode) {
    const viewModel = this.getViewModel();
    const document = renderDesktopAgentLaunchDocument(viewModel);
    if (mode === "mount") {
      await this.#host.mount(document, viewModel);
      return;
    }
    await this.#host.update(document, viewModel);
  }
  #syncFromSurface() {
    this.#snapshot = projectControllerSnapshot(
      this.#surfaceSnapshot,
      this.#awaitingSessionInput,
      this.#sessionInputMessage ?? void 0
    );
    this.#viewModel = projectControllerViewModel(
      this.#surfaceSnapshot,
      this.#surfaceViewModel,
      this.#awaitingSessionInput,
      this.#sessionInputMessage ?? void 0
    );
  }
  #syncAwaitingSessionInputFromSurface() {
    if (!this.#surfaceSnapshot.session_present && this.#surfaceSnapshot.status === "needs_sign_in") {
      this.#awaitingSessionInput = true;
      this.#sessionInputMessage = null;
    }
  }
  async #handleSessionSubmit(payload) {
    this.#awaitingSessionInput = true;
    if (this.#pendingPairingCode) {
      this.#logger.warn("Desktop pairing code exchange is not implemented yet.");
      this.#sessionInputMessage = "Pairing code exchange is not available in this build yet.";
      this.#syncFromSurface();
      await this.#render("update");
      return;
    }
    let normalizedSession;
    try {
      normalizedSession = normalizeDesktopAgentSessionInputPayload(payload);
    } catch (error) {
      this.#sessionInputMessage = this.#resolveSessionInputMessage(error);
      this.#syncFromSurface();
      await this.#render("update");
      return;
    }
    this.#sessionInputMessage = null;
    this.#awaitingSessionInput = false;
    await this.#run(async () => await this.#launchSurface.submitSession(normalizedSession));
  }
  #resolveSessionInputMessage(error) {
    if (error instanceof Error) {
      const message = error.message.trim();
      if (message.length > 0) {
        return message;
      }
    }
    return "Paste a valid session to continue.";
  }
};
function createDesktopAgentLaunchController(options) {
  return new DesktopAgentLaunchControllerImpl(options);
}

// src/node-websocket.ts
var import_node_crypto = require("node:crypto");
var import_node_net = require("node:net");
var import_node_tls = require("node:tls");
var WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
function createAcceptKey(key) {
  return (0, import_node_crypto.createHash)("sha1").update(`${key}${WS_GUID}`, "binary").digest("base64");
}
function encodeClientFrame(opcode, payload) {
  const mask = (0, import_node_crypto.randomBytes)(4);
  const length = payload.byteLength;
  const headerLength = length < 126 ? 2 : length <= 65535 ? 4 : 10;
  const header = Buffer.alloc(headerLength);
  header[0] = 128 | opcode;
  if (length < 126) {
    header[1] = 128 | length;
  } else if (length <= 65535) {
    header[1] = 128 | 126;
    header.writeUInt16BE(length, 2);
  } else {
    header[1] = 128 | 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  const maskedPayload = Buffer.alloc(length);
  for (let index = 0; index < length; index += 1) {
    const payloadByte = payload[index] ?? 0;
    const maskByte = mask[index % 4] ?? 0;
    maskedPayload[index] = payloadByte ^ maskByte;
  }
  return Buffer.concat([header, mask, maskedPayload]);
}
var NodeWebSocket = class {
  #buffer = Buffer.alloc(0);
  #closed = false;
  #handshakeComplete = false;
  #listeners = /* @__PURE__ */ new Map();
  #socket;
  constructor(url) {
    const target = new URL(url);
    const secure = target.protocol === "wss:";
    const port = target.port ? Number(target.port) : secure ? 443 : 80;
    const path = `${target.pathname || "/"}${target.search}`;
    const key = (0, import_node_crypto.randomBytes)(16).toString("base64");
    this.#socket = secure ? (0, import_node_tls.connect)({ host: target.hostname, port, servername: target.hostname }) : (0, import_node_net.connect)({ host: target.hostname, port });
    this.#socket.once("connect", () => {
      this.#socket.write(
        [
          `GET ${path} HTTP/1.1`,
          `Host: ${target.host}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${key}`,
          "Sec-WebSocket-Version: 13",
          "\r\n"
        ].join("\r\n")
      );
    });
    this.#socket.on(
      "data",
      (chunk) => this.#handleData(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk), key)
    );
    this.#socket.on("error", (error) => this.#emit("error", { message: error.message }));
    this.#socket.on("close", () => this.#emitClose());
  }
  addEventListener(type, listener, options) {
    const registrations = this.#listeners.get(type) ?? [];
    registrations.push({ listener, once: options?.once === true });
    this.#listeners.set(type, registrations);
  }
  removeEventListener(type, listener) {
    const registrations = this.#listeners.get(type) ?? [];
    this.#listeners.set(
      type,
      registrations.filter((registration) => registration.listener !== listener)
    );
  }
  close(code = 1e3, reason = "") {
    if (this.#closed) {
      return;
    }
    const reasonBuffer = Buffer.from(reason);
    const payload = Buffer.alloc(2 + reasonBuffer.byteLength);
    payload.writeUInt16BE(code, 0);
    reasonBuffer.copy(payload, 2);
    this.#socket.write(encodeClientFrame(8, payload));
    this.#socket.end();
  }
  send(data) {
    this.#socket.write(encodeClientFrame(1, Buffer.from(data)));
  }
  #emit(type, event) {
    const registrations = this.#listeners.get(type) ?? [];
    const remaining = [];
    for (const registration of registrations) {
      registration.listener(event);
      if (!registration.once) {
        remaining.push(registration);
      }
    }
    this.#listeners.set(type, remaining);
  }
  #emitClose() {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#emit("close", {});
  }
  #handleData(chunk, key) {
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    if (!this.#handshakeComplete) {
      const headerEnd = this.#buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }
      const header = this.#buffer.subarray(0, headerEnd).toString("utf8");
      this.#buffer = this.#buffer.subarray(headerEnd + 4);
      const acceptKey = createAcceptKey(key);
      if (!header.startsWith("HTTP/1.1 101") || !header.includes(`Sec-WebSocket-Accept: ${acceptKey}`)) {
        this.#emit("error", { message: "Desktop agent bridge WebSocket handshake failed." });
        this.#socket.destroy();
        return;
      }
      this.#handshakeComplete = true;
      this.#emit("open", {});
    }
    this.#parseFrames();
  }
  #parseFrames() {
    while (this.#buffer.byteLength >= 2) {
      const first = this.#buffer[0] ?? 0;
      const second = this.#buffer[1] ?? 0;
      const opcode = first & 15;
      let offset = 2;
      let length = second & 127;
      if (length === 126) {
        if (this.#buffer.byteLength < offset + 2) {
          return;
        }
        length = this.#buffer.readUInt16BE(offset);
        offset += 2;
      } else if (length === 127) {
        if (this.#buffer.byteLength < offset + 8) {
          return;
        }
        const bigLength = this.#buffer.readBigUInt64BE(offset);
        if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
          this.#emit("error", { message: "Desktop agent bridge frame is too large." });
          this.#socket.destroy();
          return;
        }
        length = Number(bigLength);
        offset += 8;
      }
      if (this.#buffer.byteLength < offset + length) {
        return;
      }
      const payload = this.#buffer.subarray(offset, offset + length);
      this.#buffer = this.#buffer.subarray(offset + length);
      if (opcode === 1) {
        this.#emit("message", { data: payload.toString("utf8") });
      } else if (opcode === 8) {
        this.#socket.end();
        this.#emitClose();
      } else if (opcode === 9) {
        this.#socket.write(encodeClientFrame(10, payload));
      }
    }
  }
};
function createNodeWebSocket(url) {
  return new NodeWebSocket(url);
}

// src/security/window-policy.ts
var DEFAULT_ALLOWED_EXTERNAL_DOMAINS = ["runa.app", "*.runa.app"];
function normalizeDomain(domain) {
  const normalized = domain.trim().toLowerCase();
  if (!normalized || normalized.includes("://") || normalized.includes("/")) {
    return null;
  }
  return normalized;
}
function readAllowedExternalUrlPolicy(environment = process.env) {
  const configuredDomains = environment["RUNA_ALLOWED_EXTERNAL_DOMAINS"]?.split(",").map((domain) => normalizeDomain(domain)).filter((domain) => domain !== null);
  return {
    allowed_domains: configuredDomains && configuredDomains.length > 0 ? configuredDomains : DEFAULT_ALLOWED_EXTERNAL_DOMAINS
  };
}
function matchesAllowedDomain(hostname, allowedDomain) {
  const normalizedHostname = hostname.toLowerCase();
  if (allowedDomain.startsWith("*.")) {
    const suffix = allowedDomain.slice(2);
    return normalizedHostname !== suffix && normalizedHostname.endsWith(`.${suffix}`);
  }
  return normalizedHostname === allowedDomain;
}
function isAllowedExternalUrl(url, policy = readAllowedExternalUrlPolicy()) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }
  if (parsedUrl.protocol !== "https:") {
    return false;
  }
  return policy.allowed_domains.some((domain) => matchesAllowedDomain(parsedUrl.hostname, domain));
}

// src/settings-store.ts
var import_promises3 = require("node:fs/promises");
var import_node_path3 = require("node:path");
var defaultDesktopAgentSettings = {
  autoStart: true,
  openWindowOnStart: false,
  telemetryOptIn: false
};
function isNodeErrorWithCode2(error, code) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeSettings(value) {
  if (!isRecord5(value)) {
    return defaultDesktopAgentSettings;
  }
  return {
    autoStart: typeof value["autoStart"] === "boolean" ? value["autoStart"] : defaultDesktopAgentSettings.autoStart,
    openWindowOnStart: typeof value["openWindowOnStart"] === "boolean" ? value["openWindowOnStart"] : defaultDesktopAgentSettings.openWindowOnStart,
    telemetryOptIn: typeof value["telemetryOptIn"] === "boolean" ? value["telemetryOptIn"] : defaultDesktopAgentSettings.telemetryOptIn
  };
}
async function atomicWriteJson(filePath, settings) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await (0, import_promises3.mkdir)((0, import_node_path3.dirname)(filePath), { recursive: true });
  await (0, import_promises3.writeFile)(temporaryPath, JSON.stringify(settings, null, 2), "utf8");
  await (0, import_promises3.rename)(temporaryPath, filePath);
}
var FileDesktopAgentSettingsStore = class {
  #filePath;
  #settings = null;
  constructor(userDataDirectory) {
    this.#filePath = (0, import_node_path3.join)(userDataDirectory, "settings.json");
  }
  async load() {
    if (this.#settings) {
      return { ...this.#settings };
    }
    let rawValue;
    try {
      rawValue = await (0, import_promises3.readFile)(this.#filePath, "utf8");
    } catch (error) {
      if (isNodeErrorWithCode2(error, "ENOENT")) {
        this.#settings = defaultDesktopAgentSettings;
        return { ...this.#settings };
      }
      throw error;
    }
    try {
      this.#settings = normalizeSettings(JSON.parse(rawValue));
    } catch {
      this.#settings = defaultDesktopAgentSettings;
    }
    return { ...this.#settings };
  }
  async update(patch) {
    const currentSettings2 = await this.load();
    const nextSettings = normalizeSettings({
      ...currentSettings2,
      ...patch
    });
    await atomicWriteJson(this.#filePath, nextSettings);
    this.#settings = nextSettings;
    return { ...nextSettings };
  }
  async clear() {
    this.#settings = null;
    await (0, import_promises3.rm)(this.#filePath, { force: true });
  }
};
function createFileDesktopAgentSettingsStore(userDataDirectory) {
  return new FileDesktopAgentSettingsStore(userDataDirectory);
}

// electron/main.ts
var tray = null;
var mainWindow = null;
var isQuitting = false;
var controller = null;
var configurationErrorMessage = null;
var insecureStorageWarning = false;
var gotSingleInstanceLock = import_electron.app.requestSingleInstanceLock();
var allowedExternalUrlPolicy = readAllowedExternalUrlPolicy();
var startHidden = process.argv.includes("--hidden");
var currentSettings = {
  autoStart: true,
  openWindowOnStart: false,
  telemetryOptIn: false
};
function logBoot(message, data) {
  const payload = data === void 0 ? "" : ` ${JSON.stringify(data)}`;
  console.log(`[boot:${message}]${payload}`);
}
var bootLogger = {
  warn: (message) => {
    console.warn(`[boot:warn] ${message}`);
  }
};
var userDataDirectoryOverride = process.env.RUNA_DESKTOP_AGENT_USER_DATA_DIR?.trim();
if (userDataDirectoryOverride) {
  import_electron.app.setPath("userData", userDataDirectoryOverride);
}
var settingsStore = createFileDesktopAgentSettingsStore(import_electron.app.getPath("userData"));
import_electron.protocol.registerSchemesAsPrivileged([
  {
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true
    },
    scheme: "runa-desktop"
  }
]);
function getAppDir() {
  return (0, import_node_path4.dirname)(__filename);
}
function resolvePackagedPath(...segments) {
  return (0, import_node_path4.join)(getAppDir(), ...segments);
}
function createFallbackViewModel() {
  return {
    agent_id: "unconfigured",
    awaiting_session_input: false,
    message: configurationErrorMessage ?? "Desktop runtime setup failed.",
    primary_action: {
      id: "retry",
      label: "Try again"
    },
    session_present: false,
    status: "error",
    title: "Connection failed"
  };
}
function getViewModel() {
  return controller?.getViewModel() ?? createFallbackViewModel();
}
function projectViewModelToLegacyShellState(viewModel) {
  switch (viewModel.status) {
    case "bootstrapping":
    case "connecting":
      return {
        agentConnected: false,
        sessionValid: viewModel.session_present,
        status: "connecting"
      };
    case "connected":
      return {
        agentConnected: true,
        sessionValid: true,
        status: "connected"
      };
    case "error":
      return {
        agentConnected: false,
        errorMessage: viewModel.message,
        sessionValid: viewModel.session_present,
        status: "error"
      };
    case "awaiting_session_input":
    case "needs_sign_in":
      return {
        agentConnected: false,
        sessionValid: false,
        status: "needs_sign_in"
      };
    case "ready":
      return {
        agentConnected: false,
        sessionValid: true,
        status: "stopped"
      };
  }
}
function isRecord6(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isDesktopAgentSessionInputPayload(value) {
  if (!isRecord6(value)) {
    return false;
  }
  const expiresAt = value.expires_at;
  return typeof value.access_token === "string" && typeof value.refresh_token === "string" && (expiresAt === void 0 || typeof expiresAt === "number") && (value.token_type === void 0 || typeof value.token_type === "string");
}
function isShellInvokeActionPayload(value) {
  if (!isRecord6(value)) {
    return false;
  }
  return value.actionId === "connect" || value.actionId === "connecting" || value.actionId === "retry" || value.actionId === "sign_in" || value.actionId === "sign_out";
}
function isSettingsPatch(value) {
  if (!isRecord6(value)) {
    return false;
  }
  return (value["autoStart"] === void 0 || typeof value["autoStart"] === "boolean") && (value["openWindowOnStart"] === void 0 || typeof value["openWindowOnStart"] === "boolean") && (value["telemetryOptIn"] === void 0 || typeof value["telemetryOptIn"] === "boolean");
}
function applyLoginItemSettings(settings) {
  import_electron.app.setLoginItemSettings({
    args: ["--hidden"],
    openAsHidden: !settings.openWindowOnStart,
    openAtLogin: settings.autoStart
  });
}
async function updateSettings(patch) {
  currentSettings = await settingsStore.update(patch);
  applyLoginItemSettings(currentSettings);
  createTrayMenu();
  return currentSettings;
}
async function handleDeepLinkArgv(argv) {
  const payload = findDesktopPairingCodeInArgv(argv);
  if (!payload || !controller) {
    return;
  }
  showMainWindow();
  await controller.handlePairingCode(payload.code);
}
function resolveRendererAssetPath(requestUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(requestUrl);
  } catch {
    return null;
  }
  const assetPath = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/u, "")) || "index.html";
  if (assetPath.split("/").includes("..")) {
    return null;
  }
  return resolvePackagedPath("renderer", assetPath);
}
function resolveRendererAssetContentType(filePath) {
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  return "application/octet-stream";
}
function registerRendererProtocol() {
  import_electron.protocol.handle("runa-desktop", async (request) => {
    const assetPath = resolveRendererAssetPath(request.url);
    if (!assetPath) {
      return new Response("Not found", { status: 404 });
    }
    try {
      const body = await (0, import_promises4.readFile)(assetPath);
      return new Response(body, {
        headers: {
          "content-type": resolveRendererAssetContentType(assetPath)
        }
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}
async function invokeControllerAction(actionId) {
  if (!controller) {
    return getViewModel();
  }
  await controller.invokeAction(actionId);
  return controller.getViewModel();
}
async function stopController() {
  if (!controller) {
    return getViewModel();
  }
  await controller.stop();
  return controller.getViewModel();
}
async function signOutController() {
  if (!controller) {
    return getViewModel();
  }
  await controller.signOut();
  return controller.getViewModel();
}
async function submitSession(payload) {
  if (!controller || !isDesktopAgentSessionInputPayload(payload)) {
    return getViewModel();
  }
  await controller.submitSession(payload);
  return controller.getViewModel();
}
function createControllerFromEnvironment() {
  try {
    const config = readDesktopAgentBootstrapConfigFromEnvironment();
    const sessionStorageSelection = createDesktopAgentSessionStorageForSafeStorage({
      logger: bootLogger,
      safeStorage: import_electron.safeStorage,
      userDataDirectory: import_electron.app.getPath("userData")
    });
    insecureStorageWarning = sessionStorageSelection.insecure_storage;
    controller = createDesktopAgentLaunchController({
      ...config,
      bridge_factory: async (bridgeOptions) => await startDesktopAgentBridge({
        ...bridgeOptions,
        web_socket_factory: createNodeWebSocket
      }),
      host: createElectronDesktopAgentWindowHost({
        insecureStorageWarning,
        mainWindow,
        tray
      }),
      logger: bootLogger,
      session_storage: sessionStorageSelection.storage
    });
    configurationErrorMessage = null;
    logBoot("runtime:configured", {
      agent_id: config.agent_id,
      has_initial_session: config.initial_session !== void 0,
      machine_label: config.machine_label,
      server_url: config.server_url
    });
  } catch (error) {
    configurationErrorMessage = error instanceof Error ? error.message : "Desktop runtime setup failed.";
    logBoot("runtime:configuration-error", {
      error: configurationErrorMessage
    });
  }
}
function createTray() {
  const iconPath = resolvePackagedPath("../build/icon.png");
  const trayIcon = (0, import_node_fs.existsSync)(iconPath) ? import_electron.nativeImage.createFromPath(iconPath) : import_electron.nativeImage.createEmpty();
  tray = new import_electron.Tray(trayIcon.isEmpty() ? import_electron.nativeImage.createEmpty() : trayIcon);
  createTrayMenu();
}
function createTrayMenu() {
  if (!tray) {
    return;
  }
  tray.setContextMenu(
    import_electron.Menu.buildFromTemplate([
      {
        click: () => showMainWindow(),
        label: "Open Runa Desktop"
      },
      { type: "separator" },
      {
        click: () => {
          void invokeControllerAction("connect");
        },
        label: "Connect"
      },
      {
        click: () => {
          void stopController();
        },
        label: "Disconnect"
      },
      { type: "separator" },
      {
        click: () => {
          void signOutController();
        },
        label: "Sign out"
      },
      { type: "separator" },
      {
        checked: currentSettings.autoStart,
        click: () => {
          void updateSettings({
            autoStart: !currentSettings.autoStart
          });
        },
        label: "Start with Windows",
        type: "checkbox"
      },
      { type: "separator" },
      {
        click: () => import_electron.app.quit(),
        label: "Quit Runa Desktop"
      }
    ])
  );
}
function createMainWindow() {
  logBoot("window:create-start");
  mainWindow = new import_electron.BrowserWindow({
    height: 800,
    show: false,
    title: "Runa Desktop",
    webPreferences: {
      allowRunningInsecureContent: false,
      contextIsolation: true,
      experimentalFeatures: false,
      webSecurity: true,
      nodeIntegration: false,
      preload: resolvePackagedPath("preload.cjs"),
      sandbox: true
    },
    width: 1200
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    event.preventDefault();
    if (isAllowedExternalUrl(url, allowedExternalUrlPolicy)) {
      void import_electron.shell.openExternal(url);
    }
  });
  mainWindow.loadURL("runa-desktop://app/index.html");
  mainWindow.once("ready-to-show", () => {
    logBoot("window:ready-to-show");
    if (!startHidden) {
      mainWindow?.show();
    }
    mainWindow?.webContents.send("shell:viewModel", getViewModel());
    mainWindow?.webContents.send(
      "shell:stateChanged",
      projectViewModelToLegacyShellState(getViewModel())
    );
  });
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function showMainWindow() {
  if (!mainWindow) {
    createMainWindow();
    return;
  }
  mainWindow.show();
  mainWindow.focus();
}
function registerIpcHandlers() {
  import_electron.ipcMain.handle("shell:getViewModel", () => getViewModel());
  import_electron.ipcMain.handle("shell:invokeAction", async (_event, payload) => {
    if (!isShellInvokeActionPayload(payload)) {
      return getViewModel();
    }
    return await invokeControllerAction(payload.actionId);
  });
  import_electron.ipcMain.handle(
    "session:submit",
    async (_event, payload) => await submitSession(payload)
  );
  import_electron.ipcMain.handle("settings:get", () => currentSettings);
  import_electron.ipcMain.handle("settings:update", async (_event, payload) => {
    if (!isSettingsPatch(payload)) {
      return currentSettings;
    }
    return await updateSettings(payload);
  });
  import_electron.ipcMain.handle("agent:getStatus", () => projectViewModelToLegacyShellState(getViewModel()));
  import_electron.ipcMain.handle("shell:getState", () => projectViewModelToLegacyShellState(getViewModel()));
  import_electron.ipcMain.handle("shell:connect", async () => await invokeControllerAction("connect"));
  import_electron.ipcMain.handle("shell:disconnect", async () => await stopController());
  import_electron.ipcMain.handle(
    "session:signIn",
    async (_event, payload) => await submitSession(payload)
  );
  import_electron.ipcMain.handle("session:signOut", async () => await signOutController());
}
if (!gotSingleInstanceLock) {
  import_electron.app.quit();
} else {
  import_electron.app.on("second-instance", (_event, argv) => {
    showMainWindow();
    void handleDeepLinkArgv(argv);
  });
  import_electron.app.on("open-url", (event, url) => {
    event.preventDefault();
    void handleDeepLinkArgv([url]);
  });
  import_electron.app.whenReady().then(async () => {
    logBoot("app-ready");
    currentSettings = await settingsStore.load();
    applyLoginItemSettings(currentSettings);
    import_electron.app.setAsDefaultProtocolClient("runa");
    import_electron.session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });
    import_electron.session.defaultSession.setPermissionCheckHandler(() => false);
    logBoot("electron-version", {
      electron_version: process.versions.electron
    });
    registerRendererProtocol();
    registerIpcHandlers();
    createTray();
    createMainWindow();
    createControllerFromEnvironment();
    await handleDeepLinkArgv(process.argv);
    await controller?.start();
    logBoot("main-process:boot-complete");
  }).catch((error) => {
    logBoot("main-process:boot-error", {
      error: error instanceof Error ? error.message : String(error)
    });
    import_electron.app.quit();
  });
}
import_electron.app.on("window-all-closed", () => {
  logBoot("window-all-closed");
});
import_electron.app.on("before-quit", () => {
  isQuitting = true;
  logBoot("app:before-quit");
  tray?.destroy();
  tray = null;
  void controller?.stop();
});
process.on("uncaughtException", (error) => {
  logBoot("process:uncaught-exception", {
    error: error.message,
    stack: error.stack
  });
});
process.on("unhandledRejection", (reason) => {
  logBoot("process:unhandled-rejection", { reason: String(reason) });
});
//# sourceMappingURL=main.cjs.map
