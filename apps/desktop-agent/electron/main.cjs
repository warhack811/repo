"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/renderer/electron-log-preload.js
var require_electron_log_preload = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/renderer/electron-log-preload.js"(exports2, module2) {
    "use strict";
    var electron = {};
    try {
      electron = require("electron");
    } catch (e) {
    }
    if (electron.ipcRenderer) {
      initialize(electron);
    }
    if (typeof module2 === "object") {
      module2.exports = initialize;
    }
    function initialize({ contextBridge, ipcRenderer }) {
      if (!ipcRenderer) {
        return;
      }
      ipcRenderer.on("__ELECTRON_LOG_IPC__", (_, message) => {
        window.postMessage({ cmd: "message", ...message });
      });
      ipcRenderer.invoke("__ELECTRON_LOG__", { cmd: "getOptions" }).catch((e) => console.error(new Error(
        `electron-log isn't initialized in the main process. Please call log.initialize() before. ${e.message}`
      )));
      const electronLog2 = {
        sendToMain(message) {
          try {
            ipcRenderer.send("__ELECTRON_LOG__", message);
          } catch (e) {
            console.error("electronLog.sendToMain ", e, "data:", message);
            ipcRenderer.send("__ELECTRON_LOG__", {
              cmd: "errorHandler",
              error: { message: e?.message, stack: e?.stack },
              errorName: "sendToMain"
            });
          }
        },
        log(...data) {
          electronLog2.sendToMain({ data, level: "info" });
        }
      };
      for (const level of ["error", "warn", "info", "verbose", "debug", "silly"]) {
        electronLog2[level] = (...data) => electronLog2.sendToMain({
          data,
          level
        });
      }
      if (contextBridge && process.contextIsolated) {
        try {
          contextBridge.exposeInMainWorld("__electronLog", electronLog2);
        } catch {
        }
      }
      if (typeof window === "object") {
        window.__electronLog = electronLog2;
      } else {
        __electronLog = electronLog2;
      }
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/core/scope.js
var require_scope = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/core/scope.js"(exports2, module2) {
    "use strict";
    module2.exports = scopeFactory;
    function scopeFactory(logger) {
      return Object.defineProperties(scope, {
        defaultLabel: { value: "", writable: true },
        labelPadding: { value: true, writable: true },
        maxLabelLength: { value: 0, writable: true },
        labelLength: {
          get() {
            switch (typeof scope.labelPadding) {
              case "boolean":
                return scope.labelPadding ? scope.maxLabelLength : 0;
              case "number":
                return scope.labelPadding;
              default:
                return 0;
            }
          }
        }
      });
      function scope(label) {
        scope.maxLabelLength = Math.max(scope.maxLabelLength, label.length);
        const newScope = {};
        for (const level of [...logger.levels, "log"]) {
          newScope[level] = (...d) => logger.logData(d, { level, scope: label });
        }
        return newScope;
      }
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/core/Logger.js
var require_Logger = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/core/Logger.js"(exports2, module2) {
    "use strict";
    var scopeFactory = require_scope();
    var Logger = class _Logger {
      static instances = {};
      errorHandler = null;
      eventLogger = null;
      functions = {};
      hooks = [];
      isDev = false;
      levels = null;
      logId = null;
      scope = null;
      transports = {};
      variables = {};
      constructor({
        allowUnknownLevel = false,
        errorHandler,
        eventLogger,
        initializeFn,
        isDev = false,
        levels = ["error", "warn", "info", "verbose", "debug", "silly"],
        logId,
        transportFactories = {},
        variables
      } = {}) {
        this.addLevel = this.addLevel.bind(this);
        this.create = this.create.bind(this);
        this.logData = this.logData.bind(this);
        this.processMessage = this.processMessage.bind(this);
        this.allowUnknownLevel = allowUnknownLevel;
        this.initializeFn = initializeFn;
        this.isDev = isDev;
        this.levels = levels;
        this.logId = logId;
        this.transportFactories = transportFactories;
        this.variables = variables || {};
        this.scope = scopeFactory(this);
        this.addLevel("log", false);
        for (const name of this.levels) {
          this.addLevel(name, false);
        }
        this.errorHandler = errorHandler;
        errorHandler?.setOptions({ logFn: this.error });
        this.eventLogger = eventLogger;
        eventLogger?.setOptions({ logger: this });
        for (const [name, factory] of Object.entries(transportFactories)) {
          this.transports[name] = factory(this);
        }
        _Logger.instances[logId] = this;
      }
      static getInstance({ logId }) {
        return this.instances[logId] || this.instances.default;
      }
      addLevel(level, index = this.levels.length) {
        if (index !== false) {
          this.levels.splice(index, 0, level);
        }
        this[level] = (...args) => this.logData(args, { level });
        this.functions[level] = this[level];
      }
      catchErrors(options) {
        this.processMessage(
          {
            data: ["log.catchErrors is deprecated. Use log.errorHandler instead"],
            level: "warn"
          },
          { transports: ["console"] }
        );
        return this.errorHandler.startCatching(options);
      }
      create(options) {
        if (typeof options === "string") {
          options = { logId: options };
        }
        return new _Logger({
          ...options,
          errorHandler: this.errorHandler,
          initializeFn: this.initializeFn,
          isDev: this.isDev,
          transportFactories: this.transportFactories,
          variables: { ...this.variables }
        });
      }
      compareLevels(passLevel, checkLevel, levels = this.levels) {
        const pass = levels.indexOf(passLevel);
        const check = levels.indexOf(checkLevel);
        if (check === -1 || pass === -1) {
          return true;
        }
        return check <= pass;
      }
      initialize({ preload = true, spyRendererConsole = false } = {}) {
        this.initializeFn({ logger: this, preload, spyRendererConsole });
      }
      logData(data, options = {}) {
        this.processMessage({ data, ...options });
      }
      processMessage(message, { transports = this.transports } = {}) {
        if (message.cmd === "errorHandler") {
          this.errorHandler.handle(message.error, {
            errorName: message.errorName,
            processType: "renderer",
            showDialog: Boolean(message.showDialog)
          });
          return;
        }
        let level = message.level;
        if (!this.allowUnknownLevel) {
          level = this.levels.includes(message.level) ? message.level : "info";
        }
        const normalizedMessage = {
          date: /* @__PURE__ */ new Date(),
          ...message,
          level,
          variables: {
            ...this.variables,
            ...message.variables
          }
        };
        for (const [transName, transFn] of this.transportEntries(transports)) {
          if (typeof transFn !== "function" || transFn.level === false) {
            continue;
          }
          if (!this.compareLevels(transFn.level, message.level)) {
            continue;
          }
          try {
            const transformedMsg = this.hooks.reduce((msg, hook) => {
              return msg ? hook(msg, transFn, transName) : msg;
            }, normalizedMessage);
            if (transformedMsg) {
              transFn({ ...transformedMsg, data: [...transformedMsg.data] });
            }
          } catch (e) {
            this.processInternalErrorFn(e);
          }
        }
      }
      processInternalErrorFn(_e) {
      }
      transportEntries(transports = this.transports) {
        const transportArray = Array.isArray(transports) ? transports : Object.entries(transports);
        return transportArray.map((item) => {
          switch (typeof item) {
            case "string":
              return this.transports[item] ? [item, this.transports[item]] : null;
            case "function":
              return [item.name, item];
            default:
              return Array.isArray(item) ? item : null;
          }
        }).filter(Boolean);
      }
    };
    module2.exports = Logger;
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/renderer/lib/RendererErrorHandler.js
var require_RendererErrorHandler = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/renderer/lib/RendererErrorHandler.js"(exports2, module2) {
    "use strict";
    var consoleError = console.error;
    var RendererErrorHandler = class {
      logFn = null;
      onError = null;
      showDialog = false;
      preventDefault = true;
      constructor({ logFn = null } = {}) {
        this.handleError = this.handleError.bind(this);
        this.handleRejection = this.handleRejection.bind(this);
        this.startCatching = this.startCatching.bind(this);
        this.logFn = logFn;
      }
      handle(error, {
        logFn = this.logFn,
        errorName = "",
        onError = this.onError,
        showDialog = this.showDialog
      } = {}) {
        try {
          if (onError?.({ error, errorName, processType: "renderer" }) !== false) {
            logFn({ error, errorName, showDialog });
          }
        } catch {
          consoleError(error);
        }
      }
      setOptions({ logFn, onError, preventDefault, showDialog }) {
        if (typeof logFn === "function") {
          this.logFn = logFn;
        }
        if (typeof onError === "function") {
          this.onError = onError;
        }
        if (typeof preventDefault === "boolean") {
          this.preventDefault = preventDefault;
        }
        if (typeof showDialog === "boolean") {
          this.showDialog = showDialog;
        }
      }
      startCatching({ onError, showDialog } = {}) {
        if (this.isActive) {
          return;
        }
        this.isActive = true;
        this.setOptions({ onError, showDialog });
        window.addEventListener("error", (event) => {
          this.preventDefault && event.preventDefault?.();
          this.handleError(event.error || event);
        });
        window.addEventListener("unhandledrejection", (event) => {
          this.preventDefault && event.preventDefault?.();
          this.handleRejection(event.reason || event);
        });
      }
      handleError(error) {
        this.handle(error, { errorName: "Unhandled" });
      }
      handleRejection(reason) {
        const error = reason instanceof Error ? reason : new Error(JSON.stringify(reason));
        this.handle(error, { errorName: "Unhandled rejection" });
      }
    };
    module2.exports = RendererErrorHandler;
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/renderer/lib/transports/console.js
var require_console = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/renderer/lib/transports/console.js"(exports2, module2) {
    "use strict";
    module2.exports = consoleTransportRendererFactory;
    var consoleMethods = {
      error: console.error,
      warn: console.warn,
      info: console.info,
      verbose: console.info,
      debug: console.debug,
      silly: console.debug,
      log: console.log
    };
    function consoleTransportRendererFactory(logger) {
      return Object.assign(transport, {
        format: "{h}:{i}:{s}.{ms}{scope} \u203A {text}",
        formatDataFn({
          data = [],
          date = /* @__PURE__ */ new Date(),
          format = transport.format,
          logId = logger.logId,
          scope = logger.scopeName,
          ...message
        }) {
          if (typeof format === "function") {
            return format({ ...message, data, date, logId, scope });
          }
          if (typeof format !== "string") {
            return data;
          }
          data.unshift(format);
          if (typeof data[1] === "string" && data[1].match(/%[1cdfiOos]/)) {
            data = [`${data[0]} ${data[1]}`, ...data.slice(2)];
          }
          data[0] = data[0].replace(/\{(\w+)}/g, (substring, name) => {
            switch (name) {
              case "level":
                return message.level;
              case "logId":
                return logId;
              case "scope":
                return scope ? ` (${scope})` : "";
              case "text":
                return "";
              case "y":
                return date.getFullYear().toString(10);
              case "m":
                return (date.getMonth() + 1).toString(10).padStart(2, "0");
              case "d":
                return date.getDate().toString(10).padStart(2, "0");
              case "h":
                return date.getHours().toString(10).padStart(2, "0");
              case "i":
                return date.getMinutes().toString(10).padStart(2, "0");
              case "s":
                return date.getSeconds().toString(10).padStart(2, "0");
              case "ms":
                return date.getMilliseconds().toString(10).padStart(3, "0");
              case "iso":
                return date.toISOString();
              default: {
                return message.variables?.[name] || substring;
              }
            }
          }).trim();
          return data;
        },
        writeFn({ message: { level, data } }) {
          const consoleLogFn = consoleMethods[level] || consoleMethods.info;
          setTimeout(() => consoleLogFn(...data));
        }
      });
      function transport(message) {
        transport.writeFn({
          message: { ...message, data: transport.formatDataFn(message) }
        });
      }
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/renderer/lib/transports/ipc.js
var require_ipc = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/renderer/lib/transports/ipc.js"(exports2, module2) {
    "use strict";
    module2.exports = ipcTransportRendererFactory;
    var RESTRICTED_TYPES = /* @__PURE__ */ new Set([Promise, WeakMap, WeakSet]);
    function ipcTransportRendererFactory(logger) {
      return Object.assign(transport, {
        depth: 5,
        serializeFn(data, { depth = 5, seen = /* @__PURE__ */ new WeakSet() } = {}) {
          if (depth < 1) {
            return `[${typeof data}]`;
          }
          if (seen.has(data)) {
            return data;
          }
          if (["function", "symbol"].includes(typeof data)) {
            return data.toString();
          }
          if (Object(data) !== data) {
            return data;
          }
          if (RESTRICTED_TYPES.has(data.constructor)) {
            return `[${data.constructor.name}]`;
          }
          if (Array.isArray(data)) {
            return data.map((item) => transport.serializeFn(
              item,
              { level: depth - 1, seen }
            ));
          }
          if (data instanceof Error) {
            return data.stack;
          }
          if (data instanceof Map) {
            return new Map(
              Array.from(data).map(([key, value]) => [
                transport.serializeFn(key, { level: depth - 1, seen }),
                transport.serializeFn(value, { level: depth - 1, seen })
              ])
            );
          }
          if (data instanceof Set) {
            return new Set(
              Array.from(data).map(
                (val) => transport.serializeFn(val, { level: depth - 1, seen })
              )
            );
          }
          seen.add(data);
          return Object.fromEntries(
            Object.entries(data).map(
              ([key, value]) => [
                key,
                transport.serializeFn(value, { level: depth - 1, seen })
              ]
            )
          );
        }
      });
      function transport(message) {
        if (!window.__electronLog) {
          logger.processMessage(
            {
              data: ["electron-log: logger isn't initialized in the main process"],
              level: "error"
            },
            { transports: ["console"] }
          );
          return;
        }
        try {
          __electronLog.sendToMain(transport.serializeFn(message, {
            depth: transport.depth
          }));
        } catch (e) {
          logger.transports.console({
            data: ["electronLog.transports.ipc", e, "data:", message.data],
            level: "error"
          });
        }
      }
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/renderer/index.js
var require_renderer = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/renderer/index.js"(exports2, module2) {
    "use strict";
    var Logger = require_Logger();
    var RendererErrorHandler = require_RendererErrorHandler();
    var transportConsole = require_console();
    var transportIpc = require_ipc();
    module2.exports = createLogger();
    module2.exports.Logger = Logger;
    module2.exports.default = module2.exports;
    function createLogger() {
      const logger = new Logger({
        allowUnknownLevel: true,
        errorHandler: new RendererErrorHandler(),
        initializeFn: () => {
        },
        logId: "default",
        transportFactories: {
          console: transportConsole,
          ipc: transportIpc
        },
        variables: {
          processType: "renderer"
        }
      });
      logger.errorHandler.setOptions({
        logFn({ error, errorName, showDialog }) {
          logger.transports.console({
            data: [errorName, error].filter(Boolean),
            level: "error"
          });
          logger.transports.ipc({
            cmd: "errorHandler",
            error: {
              cause: error?.cause,
              code: error?.code,
              name: error?.name,
              message: error?.message,
              stack: error?.stack
            },
            errorName,
            logId: logger.logId,
            showDialog
          });
        }
      });
      if (typeof window === "object") {
        window.addEventListener("message", (event) => {
          const { cmd, logId, ...message } = event.data || {};
          const instance = Logger.getInstance({ logId });
          if (cmd === "message") {
            instance.processMessage(message, { transports: ["console"] });
          }
        });
      }
      return new Proxy(logger, {
        get(target, prop) {
          if (typeof target[prop] !== "undefined") {
            return target[prop];
          }
          return (...data) => logger.logData(data, { level: prop });
        }
      });
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/electronApi.js
var require_electronApi = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/electronApi.js"(exports2, module2) {
    "use strict";
    var os = require("os");
    var path = require("path");
    var electron;
    try {
      electron = require("electron");
    } catch {
      electron = null;
    }
    module2.exports = {
      getAppUserDataPath() {
        return getPath("userData");
      },
      getName,
      getPath,
      getVersion,
      getVersions() {
        return {
          app: `${getName()} ${getVersion()}`,
          electron: `Electron ${process.versions.electron}`,
          os: getOsVersion()
        };
      },
      isDev() {
        const app2 = getApp();
        if (app2?.isPackaged !== void 0) {
          return !app2.isPackaged;
        }
        if (typeof process.execPath === "string") {
          const execFileName = path.basename(process.execPath).toLowerCase();
          return execFileName.startsWith("electron");
        }
        return process.env.NODE_ENV === "development" || process.env.ELECTRON_IS_DEV === "1";
      },
      isElectron() {
        return Boolean(process.versions.electron);
      },
      onAppEvent(eventName, handler) {
        electron?.app?.on(eventName, handler);
        return () => {
          electron?.app?.off(eventName, handler);
        };
      },
      onEveryWebContentsEvent(eventName, handler) {
        electron?.webContents?.getAllWebContents().forEach((webContents) => {
          webContents.on(eventName, handler);
        });
        electron?.app?.on("web-contents-created", onWebContentsCreated);
        return () => {
          electron?.webContents?.getAllWebContents().forEach((webContents) => {
            webContents.off(eventName, handler);
          });
          electron?.app?.off("web-contents-created", onWebContentsCreated);
        };
        function onWebContentsCreated(_, webContents) {
          webContents.on(eventName, handler);
        }
      },
      /**
       * Listen to async messages sent from opposite process
       * @param {string} channel
       * @param {function} listener
       */
      onIpc(channel, listener) {
        getIpc()?.on(channel, listener);
      },
      onIpcInvoke(channel, listener) {
        getIpc()?.handle?.(channel, listener);
      },
      /**
       * @param {string} url
       * @param {Function} [logFunction]
       */
      openUrl(url, logFunction = console.error) {
        getElectronModule("shell")?.openExternal(url).catch(logFunction);
      },
      setPreloadFileForSessions({
        filePath,
        includeFutureSession = true,
        sessions = [electron?.session?.defaultSession]
      }) {
        for (const session2 of sessions.filter(Boolean)) {
          setPreload(session2);
        }
        if (includeFutureSession) {
          electron?.app?.on("session-created", (session2) => {
            setPreload(session2);
          });
        }
        function setPreload(session2) {
          session2.setPreloads([...session2.getPreloads(), filePath]);
        }
      },
      /**
       * Sent a message to opposite process
       * @param {string} channel
       * @param {any} message
       */
      sendIpc(channel, message) {
        if (process.type === "browser") {
          sendIpcToRenderer(channel, message);
        } else if (process.type === "renderer") {
          sendIpcToMain(channel, message);
        }
      },
      showErrorBox(title, message) {
        const dialog = getElectronModule("dialog");
        if (!dialog) return;
        dialog.showErrorBox(title, message);
      },
      whenAppReady() {
        return electron?.app?.whenReady() || Promise.resolve();
      }
    };
    function getApp() {
      return getElectronModule("app");
    }
    function getName() {
      const app2 = getApp();
      if (!app2) return null;
      return "name" in app2 ? app2.name : app2.getName();
    }
    function getElectronModule(name) {
      return electron?.[name] || null;
    }
    function getIpc() {
      if (process.type === "browser" && electron?.ipcMain) {
        return electron.ipcMain;
      }
      if (process.type === "renderer" && electron?.ipcRenderer) {
        return electron.ipcRenderer;
      }
      return null;
    }
    function getVersion() {
      const app2 = getApp();
      if (!app2) return null;
      return "version" in app2 ? app2.version : app2.getVersion();
    }
    function getOsVersion() {
      let osName = os.type().replace("_", " ");
      let osVersion = os.release();
      if (osName === "Darwin") {
        osName = "macOS";
        osVersion = getMacOsVersion();
      }
      return `${osName} ${osVersion}`;
    }
    function getMacOsVersion() {
      const release = Number(os.release().split(".")[0]);
      if (release <= 19) {
        return `10.${release - 4}`;
      }
      return release - 9;
    }
    function getPath(name) {
      const app2 = getApp();
      if (!app2) return null;
      try {
        return app2.getPath(name);
      } catch (e) {
        return null;
      }
    }
    function sendIpcToMain(channel, message) {
      getIpc()?.send(channel, message);
    }
    function sendIpcToRenderer(channel, message) {
      electron?.BrowserWindow?.getAllWindows().forEach((wnd) => {
        if (wnd.webContents?.isDestroyed() === false) {
          wnd.webContents.send(channel, message);
        }
      });
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/initialize.js
var require_initialize = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/initialize.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var os = require("os");
    var path = require("path");
    var electronApi = require_electronApi();
    var preloadInitializeFn = require_electron_log_preload();
    module2.exports = {
      initialize({ logger, preload = true, spyRendererConsole = false }) {
        electronApi.whenAppReady().then(() => {
          if (preload) {
            initializePreload(preload);
          }
          if (spyRendererConsole) {
            initializeSpyRendererConsole(logger);
          }
        }).catch(logger.warn);
      }
    };
    function initializePreload(preloadOption) {
      let preloadPath = typeof preloadOption === "string" ? preloadOption : path.resolve(__dirname, "../renderer/electron-log-preload.js");
      if (!fs.existsSync(preloadPath)) {
        preloadPath = path.join(
          electronApi.getAppUserDataPath() || os.tmpdir(),
          "electron-log-preload.js"
        );
        const preloadCode = `
      try {
        (${preloadInitializeFn.toString()})(require('electron'));
      } catch(e) {
        console.error(e);
      }
    `;
        fs.writeFileSync(preloadPath, preloadCode, "utf8");
      }
      electronApi.setPreloadFileForSessions({ filePath: preloadPath });
    }
    function initializeSpyRendererConsole(logger) {
      const levels = ["verbose", "info", "warning", "error"];
      electronApi.onEveryWebContentsEvent(
        "console-message",
        (event, level, message) => {
          logger.processMessage({
            data: [message],
            level: levels[level],
            variables: { processType: "renderer" }
          });
        }
      );
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transforms/transform.js
var require_transform = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transforms/transform.js"(exports2, module2) {
    "use strict";
    module2.exports = { transform };
    function transform({
      logger,
      message,
      transport,
      initialData = message?.data || [],
      transforms = transport?.transforms
    }) {
      return transforms.reduce((data, trans) => {
        if (typeof trans === "function") {
          return trans({ data, logger, message, transport });
        }
        return data;
      }, initialData);
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transforms/format.js
var require_format = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transforms/format.js"(exports2, module2) {
    "use strict";
    var { transform } = require_transform();
    module2.exports = {
      concatFirstStringElements,
      formatScope,
      formatText,
      formatVariables,
      timeZoneFromOffset,
      format({ message, logger, transport, data = message?.data }) {
        switch (typeof transport.format) {
          case "string": {
            return transform({
              message,
              logger,
              transforms: [formatVariables, formatScope, formatText],
              transport,
              initialData: [transport.format, ...data]
            });
          }
          case "function": {
            return transport.format({
              data,
              level: message?.level || "info",
              logger,
              message,
              transport
            });
          }
          default: {
            return data;
          }
        }
      }
    };
    function concatFirstStringElements({ data }) {
      if (typeof data[0] !== "string" || typeof data[1] !== "string") {
        return data;
      }
      if (data[0].match(/%[1cdfiOos]/)) {
        return data;
      }
      return [`${data[0]} ${data[1]}`, ...data.slice(2)];
    }
    function timeZoneFromOffset(minutesOffset) {
      const minutesPositive = Math.abs(minutesOffset);
      const sign = minutesOffset >= 0 ? "-" : "+";
      const hours = Math.floor(minutesPositive / 60).toString().padStart(2, "0");
      const minutes = (minutesPositive % 60).toString().padStart(2, "0");
      return `${sign}${hours}:${minutes}`;
    }
    function formatScope({ data, logger, message }) {
      const { defaultLabel, labelLength } = logger?.scope || {};
      const template = data[0];
      let label = message.scope;
      if (!label) {
        label = defaultLabel;
      }
      let scopeText;
      if (label === "") {
        scopeText = labelLength > 0 ? "".padEnd(labelLength + 3) : "";
      } else if (typeof label === "string") {
        scopeText = ` (${label})`.padEnd(labelLength + 3);
      } else {
        scopeText = "";
      }
      data[0] = template.replace("{scope}", scopeText);
      return data;
    }
    function formatVariables({ data, message }) {
      let template = data[0];
      if (typeof template !== "string") {
        return data;
      }
      template = template.replace("{level}]", `${message.level}]`.padEnd(6, " "));
      const date = message.date || /* @__PURE__ */ new Date();
      data[0] = template.replace(/\{(\w+)}/g, (substring, name) => {
        switch (name) {
          case "level":
            return message.level || "info";
          case "logId":
            return message.logId;
          case "y":
            return date.getFullYear().toString(10);
          case "m":
            return (date.getMonth() + 1).toString(10).padStart(2, "0");
          case "d":
            return date.getDate().toString(10).padStart(2, "0");
          case "h":
            return date.getHours().toString(10).padStart(2, "0");
          case "i":
            return date.getMinutes().toString(10).padStart(2, "0");
          case "s":
            return date.getSeconds().toString(10).padStart(2, "0");
          case "ms":
            return date.getMilliseconds().toString(10).padStart(3, "0");
          case "z":
            return timeZoneFromOffset(date.getTimezoneOffset());
          case "iso":
            return date.toISOString();
          default: {
            return message.variables?.[name] || substring;
          }
        }
      }).trim();
      return data;
    }
    function formatText({ data }) {
      const template = data[0];
      if (typeof template !== "string") {
        return data;
      }
      const textTplPosition = template.lastIndexOf("{text}");
      if (textTplPosition === template.length - 6) {
        data[0] = template.replace(/\s?{text}/, "");
        if (data[0] === "") {
          data.shift();
        }
        return data;
      }
      const templatePieces = template.split("{text}");
      let result = [];
      if (templatePieces[0] !== "") {
        result.push(templatePieces[0]);
      }
      result = result.concat(data.slice(1));
      if (templatePieces[1] !== "") {
        result.push(templatePieces[1]);
      }
      return result;
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transforms/object.js
var require_object = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transforms/object.js"(exports2, module2) {
    "use strict";
    var util = require("util");
    module2.exports = {
      serialize,
      maxDepth({ data, transport, depth = transport?.depth ?? 6 }) {
        if (!data) {
          return data;
        }
        if (depth < 1) {
          if (Array.isArray(data)) return "[array]";
          if (typeof data === "object" && data) return "[object]";
          return data;
        }
        if (Array.isArray(data)) {
          return data.map((child) => module2.exports.maxDepth({
            data: child,
            depth: depth - 1
          }));
        }
        if (typeof data !== "object") {
          return data;
        }
        if (data && typeof data.toISOString === "function") {
          return data;
        }
        if (data === null) {
          return null;
        }
        if (data instanceof Error) {
          return data;
        }
        const newJson = {};
        for (const i in data) {
          if (!Object.prototype.hasOwnProperty.call(data, i)) continue;
          newJson[i] = module2.exports.maxDepth({
            data: data[i],
            depth: depth - 1
          });
        }
        return newJson;
      },
      toJSON({ data }) {
        return JSON.parse(JSON.stringify(data, createSerializer()));
      },
      toString({ data, transport }) {
        const inspectOptions = transport?.inspectOptions || {};
        const simplifiedData = data.map((item) => {
          if (item === void 0) {
            return void 0;
          }
          try {
            const str = JSON.stringify(item, createSerializer(), "  ");
            return str === void 0 ? void 0 : JSON.parse(str);
          } catch (e) {
            return item;
          }
        });
        return util.formatWithOptions(inspectOptions, ...simplifiedData);
      }
    };
    function createSerializer(options = {}) {
      const seen = /* @__PURE__ */ new WeakSet();
      return function(key, value) {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return void 0;
          }
          seen.add(value);
        }
        return serialize(key, value, options);
      };
    }
    function serialize(key, value, options = {}) {
      const serializeMapAndSet = options?.serializeMapAndSet !== false;
      if (value instanceof Error) {
        return value.stack;
      }
      if (!value) {
        return value;
      }
      if (typeof value === "function") {
        return `[function] ${value.toString()}`;
      }
      if (serializeMapAndSet && value instanceof Map && Object.fromEntries) {
        return Object.fromEntries(value);
      }
      if (serializeMapAndSet && value instanceof Set && Array.from) {
        return Array.from(value);
      }
      return value;
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transforms/style.js
var require_style = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transforms/style.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      transformStyles,
      applyAnsiStyles({ data }) {
        return transformStyles(data, styleToAnsi, resetAnsiStyle);
      },
      removeStyles({ data }) {
        return transformStyles(data, () => "");
      }
    };
    var ANSI_COLORS = {
      unset: "\x1B[0m",
      black: "\x1B[30m",
      red: "\x1B[31m",
      green: "\x1B[32m",
      yellow: "\x1B[33m",
      blue: "\x1B[34m",
      magenta: "\x1B[35m",
      cyan: "\x1B[36m",
      white: "\x1B[37m"
    };
    function styleToAnsi(style) {
      const color = style.replace(/color:\s*(\w+).*/, "$1").toLowerCase();
      return ANSI_COLORS[color] || "";
    }
    function resetAnsiStyle(string) {
      return string + ANSI_COLORS.unset;
    }
    function transformStyles(data, onStyleFound, onStyleApplied) {
      const foundStyles = {};
      return data.reduce((result, item, index, array) => {
        if (foundStyles[index]) {
          return result;
        }
        if (typeof item === "string") {
          let valueIndex = index;
          let styleApplied = false;
          item = item.replace(/%[1cdfiOos]/g, (match) => {
            valueIndex += 1;
            if (match !== "%c") {
              return match;
            }
            const style = array[valueIndex];
            if (typeof style === "string") {
              foundStyles[valueIndex] = true;
              styleApplied = true;
              return onStyleFound(style, item);
            }
            return match;
          });
          if (styleApplied && onStyleApplied) {
            item = onStyleApplied(item);
          }
        }
        result.push(item);
        return result;
      }, []);
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/console.js
var require_console2 = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/console.js"(exports2, module2) {
    "use strict";
    var { concatFirstStringElements, format } = require_format();
    var { maxDepth, toJSON } = require_object();
    var { applyAnsiStyles, removeStyles } = require_style();
    var { transform } = require_transform();
    var consoleMethods = {
      error: console.error,
      warn: console.warn,
      info: console.info,
      verbose: console.info,
      debug: console.debug,
      silly: console.debug,
      log: console.log
    };
    module2.exports = consoleTransportFactory;
    var separator = process.platform === "win32" ? ">" : "\u203A";
    var DEFAULT_FORMAT = `%c{h}:{i}:{s}.{ms}{scope}%c ${separator} {text}`;
    Object.assign(consoleTransportFactory, {
      DEFAULT_FORMAT
    });
    function consoleTransportFactory(logger) {
      return Object.assign(transport, {
        format: DEFAULT_FORMAT,
        level: "silly",
        transforms: [
          addTemplateColors,
          format,
          formatStyles,
          concatFirstStringElements,
          maxDepth,
          toJSON
        ],
        useStyles: process.env.FORCE_STYLES,
        writeFn({ message }) {
          const consoleLogFn = consoleMethods[message.level] || consoleMethods.info;
          consoleLogFn(...message.data);
        }
      });
      function transport(message) {
        const data = transform({ logger, message, transport });
        transport.writeFn({
          message: { ...message, data }
        });
      }
    }
    function addTemplateColors({ data, message, transport }) {
      if (transport.format !== DEFAULT_FORMAT) {
        return data;
      }
      return [`color:${levelToStyle(message.level)}`, "color:unset", ...data];
    }
    function canUseStyles(useStyleValue, level) {
      if (typeof useStyleValue === "boolean") {
        return useStyleValue;
      }
      const useStderr = level === "error" || level === "warn";
      const stream = useStderr ? process.stderr : process.stdout;
      return stream && stream.isTTY;
    }
    function formatStyles(args) {
      const { message, transport } = args;
      const useStyles = canUseStyles(transport.useStyles, message.level);
      const nextTransform = useStyles ? applyAnsiStyles : removeStyles;
      return nextTransform(args);
    }
    function levelToStyle(level) {
      const map = { error: "red", warn: "yellow", info: "cyan", default: "unset" };
      return map[level] || map.default;
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/file/File.js
var require_File = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/file/File.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var fs = require("fs");
    var os = require("os");
    var File = class extends EventEmitter {
      asyncWriteQueue = [];
      bytesWritten = 0;
      hasActiveAsyncWriting = false;
      path = null;
      initialSize = void 0;
      writeOptions = null;
      writeAsync = false;
      constructor({
        path,
        writeOptions = { encoding: "utf8", flag: "a", mode: 438 },
        writeAsync = false
      }) {
        super();
        this.path = path;
        this.writeOptions = writeOptions;
        this.writeAsync = writeAsync;
      }
      get size() {
        return this.getSize();
      }
      clear() {
        try {
          fs.writeFileSync(this.path, "", {
            mode: this.writeOptions.mode,
            flag: "w"
          });
          this.reset();
          return true;
        } catch (e) {
          if (e.code === "ENOENT") {
            return true;
          }
          this.emit("error", e, this);
          return false;
        }
      }
      crop(bytesAfter) {
        try {
          const content = readFileSyncFromEnd(this.path, bytesAfter || 4096);
          this.clear();
          this.writeLine(`[log cropped]${os.EOL}${content}`);
        } catch (e) {
          this.emit(
            "error",
            new Error(`Couldn't crop file ${this.path}. ${e.message}`),
            this
          );
        }
      }
      getSize() {
        if (this.initialSize === void 0) {
          try {
            const stats = fs.statSync(this.path);
            this.initialSize = stats.size;
          } catch (e) {
            this.initialSize = 0;
          }
        }
        return this.initialSize + this.bytesWritten;
      }
      increaseBytesWrittenCounter(text) {
        this.bytesWritten += Buffer.byteLength(text, this.writeOptions.encoding);
      }
      isNull() {
        return false;
      }
      nextAsyncWrite() {
        const file = this;
        if (this.hasActiveAsyncWriting || this.asyncWriteQueue.length === 0) {
          return;
        }
        const text = this.asyncWriteQueue.join("");
        this.asyncWriteQueue = [];
        this.hasActiveAsyncWriting = true;
        fs.writeFile(this.path, text, this.writeOptions, (e) => {
          file.hasActiveAsyncWriting = false;
          if (e) {
            file.emit(
              "error",
              new Error(`Couldn't write to ${file.path}. ${e.message}`),
              this
            );
          } else {
            file.increaseBytesWrittenCounter(text);
          }
          file.nextAsyncWrite();
        });
      }
      reset() {
        this.initialSize = void 0;
        this.bytesWritten = 0;
      }
      toString() {
        return this.path;
      }
      writeLine(text) {
        text += os.EOL;
        if (this.writeAsync) {
          this.asyncWriteQueue.push(text);
          this.nextAsyncWrite();
          return;
        }
        try {
          fs.writeFileSync(this.path, text, this.writeOptions);
          this.increaseBytesWrittenCounter(text);
        } catch (e) {
          this.emit(
            "error",
            new Error(`Couldn't write to ${this.path}. ${e.message}`),
            this
          );
        }
      }
    };
    module2.exports = File;
    function readFileSyncFromEnd(filePath, bytesCount) {
      const buffer = Buffer.alloc(bytesCount);
      const stats = fs.statSync(filePath);
      const readLength = Math.min(stats.size, bytesCount);
      const offset = Math.max(0, stats.size - bytesCount);
      const fd = fs.openSync(filePath, "r");
      const totalBytes = fs.readSync(fd, buffer, 0, readLength, offset);
      fs.closeSync(fd);
      return buffer.toString("utf8", 0, totalBytes);
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/file/NullFile.js
var require_NullFile = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/file/NullFile.js"(exports2, module2) {
    "use strict";
    var File = require_File();
    var NullFile = class extends File {
      clear() {
      }
      crop() {
      }
      getSize() {
        return 0;
      }
      isNull() {
        return true;
      }
      writeLine() {
      }
    };
    module2.exports = NullFile;
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/file/FileRegistry.js
var require_FileRegistry = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/file/FileRegistry.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events");
    var fs = require("fs");
    var path = require("path");
    var File = require_File();
    var NullFile = require_NullFile();
    var FileRegistry = class extends EventEmitter {
      store = {};
      constructor() {
        super();
        this.emitError = this.emitError.bind(this);
      }
      /**
       * Provide a File object corresponding to the filePath
       * @param {string} filePath
       * @param {WriteOptions} [writeOptions]
       * @param {boolean} [writeAsync]
       * @return {File}
       */
      provide({ filePath, writeOptions, writeAsync = false }) {
        let file;
        try {
          filePath = path.resolve(filePath);
          if (this.store[filePath]) {
            return this.store[filePath];
          }
          file = this.createFile({ filePath, writeOptions, writeAsync });
        } catch (e) {
          file = new NullFile({ path: filePath });
          this.emitError(e, file);
        }
        file.on("error", this.emitError);
        this.store[filePath] = file;
        return file;
      }
      /**
       * @param {string} filePath
       * @param {WriteOptions} writeOptions
       * @param {boolean} async
       * @return {File}
       * @private
       */
      createFile({ filePath, writeOptions, writeAsync }) {
        this.testFileWriting(filePath);
        return new File({ path: filePath, writeOptions, writeAsync });
      }
      /**
       * @param {Error} error
       * @param {File} file
       * @private
       */
      emitError(error, file) {
        this.emit("error", error, file);
      }
      /**
       * @param {string} filePath
       * @private
       */
      testFileWriting(filePath) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, "", { flag: "a" });
      }
    };
    module2.exports = FileRegistry;
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/file/packageJson.js
var require_packageJson = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/file/packageJson.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    module2.exports = {
      readPackageJson,
      tryReadJsonAt
    };
    function readPackageJson() {
      return tryReadJsonAt(require.main && require.main.filename) || tryReadJsonAt(extractPathFromArgs()) || tryReadJsonAt(process.resourcesPath, "app.asar") || tryReadJsonAt(process.resourcesPath, "app") || tryReadJsonAt(process.cwd()) || { name: null, version: null };
    }
    function tryReadJsonAt(...searchPaths) {
      if (!searchPaths[0]) {
        return null;
      }
      try {
        const searchPath = path.join(...searchPaths);
        const fileName = findUp("package.json", searchPath);
        if (!fileName) {
          return null;
        }
        const json = JSON.parse(fs.readFileSync(fileName, "utf8"));
        const name = json.productName || json.name;
        if (!name || name.toLowerCase() === "electron") {
          return null;
        }
        if (json.productName || json.name) {
          return {
            name,
            version: json.version
          };
        }
      } catch (e) {
        return null;
      }
    }
    function findUp(fileName, cwd) {
      let currentPath = cwd;
      while (true) {
        const parsedPath = path.parse(currentPath);
        const root = parsedPath.root;
        const dir = parsedPath.dir;
        if (fs.existsSync(path.join(currentPath, fileName))) {
          return path.resolve(path.join(currentPath, fileName));
        }
        if (currentPath === root) {
          return null;
        }
        currentPath = dir;
      }
    }
    function extractPathFromArgs() {
      const matchedArgs = process.argv.filter((arg) => {
        return arg.indexOf("--user-data-dir=") === 0;
      });
      if (matchedArgs.length === 0 || typeof matchedArgs[0] !== "string") {
        return null;
      }
      const userDataDir = matchedArgs[0];
      return userDataDir.replace("--user-data-dir=", "");
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/file/variables.js
var require_variables = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/file/variables.js"(exports2, module2) {
    "use strict";
    var os = require("os");
    var path = require("path");
    var electronApi = require_electronApi();
    var packageJson = require_packageJson();
    module2.exports = {
      getAppData,
      getLibraryDefaultDir,
      getLibraryTemplate,
      getNameAndVersion,
      getPathVariables,
      getUserData
    };
    function getAppData(platform) {
      const appData = electronApi.getPath("appData");
      if (appData) {
        return appData;
      }
      const home = getHome();
      switch (platform) {
        case "darwin": {
          return path.join(home, "Library/Application Support");
        }
        case "win32": {
          return process.env.APPDATA || path.join(home, "AppData/Roaming");
        }
        default: {
          return process.env.XDG_CONFIG_HOME || path.join(home, ".config");
        }
      }
    }
    function getHome() {
      return os.homedir ? os.homedir() : process.env.HOME;
    }
    function getLibraryDefaultDir(platform, appName) {
      if (platform === "darwin") {
        return path.join(getHome(), "Library/Logs", appName);
      }
      return path.join(getUserData(platform, appName), "logs");
    }
    function getLibraryTemplate(platform) {
      if (platform === "darwin") {
        return path.join(getHome(), "Library/Logs", "{appName}");
      }
      return path.join(getAppData(platform), "{appName}", "logs");
    }
    function getNameAndVersion() {
      let name = electronApi.getName() || "";
      let version = electronApi.getVersion();
      if (name.toLowerCase() === "electron") {
        name = "";
        version = "";
      }
      if (name && version) {
        return { name, version };
      }
      const packageValues = packageJson.readPackageJson();
      if (!name) {
        name = packageValues.name;
      }
      if (!version) {
        version = packageValues.version;
      }
      if (!name) {
        name = "Electron";
      }
      return { name, version };
    }
    function getPathVariables(platform) {
      const nameAndVersion = getNameAndVersion();
      const appName = nameAndVersion.name;
      const appVersion = nameAndVersion.version;
      return {
        appData: getAppData(platform),
        appName,
        appVersion,
        get electronDefaultDir() {
          return electronApi.getPath("logs");
        },
        home: getHome(),
        libraryDefaultDir: getLibraryDefaultDir(platform, appName),
        libraryTemplate: getLibraryTemplate(platform),
        temp: electronApi.getPath("temp") || os.tmpdir(),
        userData: getUserData(platform, appName)
      };
    }
    function getUserData(platform, appName) {
      if (electronApi.getName() !== appName) {
        return path.join(getAppData(platform), appName);
      }
      return electronApi.getPath("userData") || path.join(getAppData(platform), appName);
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/file/index.js
var require_file = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/file/index.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var os = require("os");
    var FileRegistry = require_FileRegistry();
    var variables = require_variables();
    var { transform } = require_transform();
    var { removeStyles } = require_style();
    var { format } = require_format();
    var { toString } = require_object();
    module2.exports = fileTransportFactory;
    var globalRegistry = new FileRegistry();
    function fileTransportFactory(logger, registry = globalRegistry) {
      let pathVariables;
      if (registry.listenerCount("error") < 1) {
        registry.on("error", (e, file) => {
          logConsole(`Can't write to ${file}`, e);
        });
      }
      return Object.assign(transport, {
        fileName: getDefaultFileName(logger.variables.processType),
        format: "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}]{scope} {text}",
        getFile,
        inspectOptions: { depth: 5 },
        level: "silly",
        maxSize: 1024 ** 2,
        readAllLogs,
        sync: true,
        transforms: [removeStyles, format, toString],
        writeOptions: { flag: "a", mode: 438, encoding: "utf8" },
        archiveLogFn(file) {
          const oldPath = file.toString();
          const inf = path.parse(oldPath);
          try {
            fs.renameSync(oldPath, path.join(inf.dir, `${inf.name}.old${inf.ext}`));
          } catch (e) {
            logConsole("Could not rotate log", e);
            const quarterOfMaxSize = Math.round(transport.maxSize / 4);
            file.crop(Math.min(quarterOfMaxSize, 256 * 1024));
          }
        },
        resolvePathFn(vars) {
          return path.join(vars.libraryDefaultDir, vars.fileName);
        }
      });
      function transport(message) {
        const file = getFile(message);
        const needLogRotation = transport.maxSize > 0 && file.size > transport.maxSize;
        if (needLogRotation) {
          transport.archiveLogFn(file);
          file.reset();
        }
        const content = transform({ logger, message, transport });
        file.writeLine(content);
      }
      function initializeOnFirstAccess() {
        if (pathVariables) {
          return;
        }
        pathVariables = Object.create(
          Object.prototype,
          {
            ...Object.getOwnPropertyDescriptors(
              variables.getPathVariables(process.platform)
            ),
            fileName: {
              get() {
                return transport.fileName;
              },
              enumerable: true
            }
          }
        );
        if (typeof transport.archiveLog === "function") {
          transport.archiveLogFn = transport.archiveLog;
          logConsole("archiveLog is deprecated. Use archiveLogFn instead");
        }
        if (typeof transport.resolvePath === "function") {
          transport.resolvePathFn = transport.resolvePath;
          logConsole("resolvePath is deprecated. Use resolvePathFn instead");
        }
      }
      function logConsole(message, error = null, level = "error") {
        const data = [`electron-log.transports.file: ${message}`];
        if (error) {
          data.push(error);
        }
        logger.transports.console({ data, date: /* @__PURE__ */ new Date(), level });
      }
      function getFile(msg) {
        initializeOnFirstAccess();
        const filePath = transport.resolvePathFn(pathVariables, msg);
        return registry.provide({
          filePath,
          writeAsync: !transport.sync,
          writeOptions: transport.writeOptions
        });
      }
      function readAllLogs({ fileFilter = (f) => f.endsWith(".log") } = {}) {
        const logsPath = path.dirname(transport.resolvePathFn(pathVariables));
        return fs.readdirSync(logsPath).map((fileName) => path.join(logsPath, fileName)).filter(fileFilter).map((logPath) => {
          try {
            return {
              path: logPath,
              lines: fs.readFileSync(logPath, "utf8").split(os.EOL)
            };
          } catch {
            return null;
          }
        }).filter(Boolean);
      }
    }
    function getDefaultFileName(processType = process.type) {
      switch (processType) {
        case "renderer":
          return "renderer.log";
        case "worker":
          return "worker.log";
        default:
          return "main.log";
      }
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/remote.js
var require_remote = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/transports/remote.js"(exports2, module2) {
    "use strict";
    var http = require("http");
    var https = require("https");
    var { transform } = require_transform();
    var { removeStyles } = require_style();
    var { toJSON, maxDepth } = require_object();
    module2.exports = remoteTransportFactory;
    function remoteTransportFactory(logger) {
      return Object.assign(transport, {
        client: { name: "electron-application" },
        depth: 6,
        level: false,
        requestOptions: {},
        transforms: [removeStyles, toJSON, maxDepth],
        makeBodyFn({ message }) {
          return JSON.stringify({
            client: transport.client,
            data: message.data,
            date: message.date.getTime(),
            level: message.level,
            scope: message.scope,
            variables: message.variables
          });
        },
        processErrorFn({ error }) {
          logger.processMessage(
            {
              data: [`electron-log: can't POST ${transport.url}`, error],
              level: "warn"
            },
            { transports: ["console", "file"] }
          );
        },
        sendRequestFn({ serverUrl, requestOptions, body }) {
          const httpTransport = serverUrl.startsWith("https:") ? https : http;
          const request = httpTransport.request(serverUrl, {
            method: "POST",
            ...requestOptions,
            headers: {
              "Content-Type": "application/json",
              "Content-Length": body.length,
              ...requestOptions.headers
            }
          });
          request.write(body);
          request.end();
          return request;
        }
      });
      function transport(message) {
        if (!transport.url) {
          return;
        }
        const body = transport.makeBodyFn({
          logger,
          message: { ...message, data: transform({ logger, message, transport }) },
          transport
        });
        const request = transport.sendRequestFn({
          serverUrl: transport.url,
          requestOptions: transport.requestOptions,
          body: Buffer.from(body, "utf8")
        });
        request.on("error", (error) => transport.processErrorFn({
          error,
          logger,
          message,
          request,
          transport
        }));
      }
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/ErrorHandler.js
var require_ErrorHandler = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/ErrorHandler.js"(exports2, module2) {
    "use strict";
    var electronApi = require_electronApi();
    var ErrorHandler = class {
      isActive = false;
      logFn = null;
      onError = null;
      showDialog = true;
      constructor({ logFn = null, onError = null, showDialog = true } = {}) {
        this.createIssue = this.createIssue.bind(this);
        this.handleError = this.handleError.bind(this);
        this.handleRejection = this.handleRejection.bind(this);
        this.setOptions({ logFn, onError, showDialog });
        this.startCatching = this.startCatching.bind(this);
        this.stopCatching = this.stopCatching.bind(this);
      }
      handle(error, {
        logFn = this.logFn,
        onError = this.onError,
        processType = "browser",
        showDialog = this.showDialog,
        errorName = ""
      } = {}) {
        error = normalizeError(error);
        try {
          if (typeof onError === "function") {
            const versions = electronApi.getVersions();
            const createIssue = this.createIssue;
            const result = onError({
              createIssue,
              error,
              errorName,
              processType,
              versions
            });
            if (result === false) {
              return;
            }
          }
          errorName ? logFn(errorName, error) : logFn(error);
          if (showDialog && !errorName.includes("rejection")) {
            electronApi.showErrorBox(
              `A JavaScript error occurred in the ${processType} process`,
              error.stack
            );
          }
        } catch {
          console.error(error);
        }
      }
      setOptions({ logFn, onError, showDialog }) {
        if (typeof logFn === "function") {
          this.logFn = logFn;
        }
        if (typeof onError === "function") {
          this.onError = onError;
        }
        if (typeof showDialog === "boolean") {
          this.showDialog = showDialog;
        }
      }
      startCatching({ onError, showDialog } = {}) {
        if (this.isActive) {
          return;
        }
        this.isActive = true;
        this.setOptions({ onError, showDialog });
        process.on("uncaughtException", this.handleError);
        process.on("unhandledRejection", this.handleRejection);
      }
      stopCatching() {
        this.isActive = false;
        process.removeListener("uncaughtException", this.handleError);
        process.removeListener("unhandledRejection", this.handleRejection);
      }
      createIssue(pageUrl, queryParams) {
        electronApi.openUrl(
          `${pageUrl}?${new URLSearchParams(queryParams).toString()}`
        );
      }
      handleError(error) {
        this.handle(error, { errorName: "Unhandled" });
      }
      handleRejection(reason) {
        const error = reason instanceof Error ? reason : new Error(JSON.stringify(reason));
        this.handle(error, { errorName: "Unhandled rejection" });
      }
    };
    function normalizeError(e) {
      if (e instanceof Error) {
        return e;
      }
      if (e && typeof e === "object") {
        if (e.message) {
          return Object.assign(new Error(e.message), e);
        }
        try {
          return new Error(JSON.stringify(e));
        } catch (serErr) {
          return new Error(`Couldn't normalize error ${String(e)}: ${serErr}`);
        }
      }
      return new Error(`Can't normalize error ${String(e)}`);
    }
    module2.exports = ErrorHandler;
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/EventLogger.js
var require_EventLogger = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/EventLogger.js"(exports2, module2) {
    "use strict";
    var electronApi = require_electronApi();
    var EventLogger = class {
      disposers = [];
      format = "{eventSource}#{eventName}:";
      formatters = {
        app: {
          "certificate-error": ({ args }) => {
            return this.arrayToObject(args.slice(1, 4), [
              "url",
              "error",
              "certificate"
            ]);
          },
          "child-process-gone": ({ args }) => {
            return args.length === 1 ? args[0] : args;
          },
          "render-process-gone": ({ args: [webContents, details] }) => {
            return details && typeof details === "object" ? { ...details, ...this.getWebContentsDetails(webContents) } : [];
          }
        },
        webContents: {
          "console-message": ({ args: [level, message, line, sourceId] }) => {
            if (level < 3) {
              return void 0;
            }
            return { message, source: `${sourceId}:${line}` };
          },
          "did-fail-load": ({ args }) => {
            return this.arrayToObject(args, [
              "errorCode",
              "errorDescription",
              "validatedURL",
              "isMainFrame",
              "frameProcessId",
              "frameRoutingId"
            ]);
          },
          "did-fail-provisional-load": ({ args }) => {
            return this.arrayToObject(args, [
              "errorCode",
              "errorDescription",
              "validatedURL",
              "isMainFrame",
              "frameProcessId",
              "frameRoutingId"
            ]);
          },
          "plugin-crashed": ({ args }) => {
            return this.arrayToObject(args, ["name", "version"]);
          },
          "preload-error": ({ args }) => {
            return this.arrayToObject(args, ["preloadPath", "error"]);
          }
        }
      };
      events = {
        app: {
          "certificate-error": true,
          "child-process-gone": true,
          "render-process-gone": true
        },
        webContents: {
          // 'console-message': true,
          "did-fail-load": true,
          "did-fail-provisional-load": true,
          "plugin-crashed": true,
          "preload-error": true,
          "unresponsive": true
        }
      };
      level = "error";
      scope = "";
      constructor(options = {}) {
        this.setOptions(options);
      }
      setOptions({ events, level, logger, format, formatters, scope }) {
        if (typeof events === "object") {
          this.events = events;
        }
        if (typeof level === "string") {
          this.level = level;
        }
        if (typeof logger === "object") {
          this.logger = logger;
        }
        if (typeof format === "string" || typeof format === "function") {
          this.format = format;
        }
        if (typeof formatters === "object") {
          this.formatters = formatters;
        }
        if (typeof scope === "string") {
          this.scope = scope;
        }
      }
      startLogging(options = {}) {
        this.setOptions(options);
        this.disposeListeners();
        for (const eventName of this.getEventNames(this.events.app)) {
          this.disposers.push(
            electronApi.onAppEvent(eventName, (...handlerArgs) => {
              this.handleEvent({ eventSource: "app", eventName, handlerArgs });
            })
          );
        }
        for (const eventName of this.getEventNames(this.events.webContents)) {
          this.disposers.push(
            electronApi.onEveryWebContentsEvent(eventName, (...handlerArgs) => {
              this.handleEvent(
                { eventSource: "webContents", eventName, handlerArgs }
              );
            })
          );
        }
      }
      stopLogging() {
        this.disposeListeners();
      }
      arrayToObject(array, fieldNames) {
        const obj = {};
        fieldNames.forEach((fieldName, index) => {
          obj[fieldName] = array[index];
        });
        if (array.length > fieldNames.length) {
          obj.unknownArgs = array.slice(fieldNames.length);
        }
        return obj;
      }
      disposeListeners() {
        this.disposers.forEach((disposer) => disposer());
        this.disposers = [];
      }
      formatEventLog({ eventName, eventSource, handlerArgs }) {
        const [event, ...args] = handlerArgs;
        if (typeof this.format === "function") {
          return this.format({ args, event, eventName, eventSource });
        }
        const formatter = this.formatters[eventSource]?.[eventName];
        let formattedArgs = args;
        if (typeof formatter === "function") {
          formattedArgs = formatter({ args, event, eventName, eventSource });
        }
        if (!formattedArgs) {
          return void 0;
        }
        const eventData = {};
        if (Array.isArray(formattedArgs)) {
          eventData.args = formattedArgs;
        } else if (typeof formattedArgs === "object") {
          Object.assign(eventData, formattedArgs);
        }
        if (eventSource === "webContents") {
          Object.assign(eventData, this.getWebContentsDetails(event?.sender));
        }
        const title = this.format.replace("{eventSource}", eventSource === "app" ? "App" : "WebContents").replace("{eventName}", eventName);
        return [title, eventData];
      }
      getEventNames(eventMap) {
        if (!eventMap || typeof eventMap !== "object") {
          return [];
        }
        return Object.entries(eventMap).filter(([_, listen]) => listen).map(([eventName]) => eventName);
      }
      getWebContentsDetails(webContents) {
        if (!webContents?.loadURL) {
          return {};
        }
        try {
          return {
            webContents: {
              id: webContents.id,
              url: webContents.getURL()
            }
          };
        } catch {
          return {};
        }
      }
      handleEvent({ eventName, eventSource, handlerArgs }) {
        const log = this.formatEventLog({ eventName, eventSource, handlerArgs });
        if (log) {
          const logFns = this.scope ? this.logger.scope(this.scope) : this.logger;
          logFns?.[this.level]?.(...log);
        }
      }
    };
    module2.exports = EventLogger;
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/index.js
var require_main = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/main/index.js"(exports2, module2) {
    "use strict";
    var electronApi = require_electronApi();
    var { initialize } = require_initialize();
    var transportConsole = require_console2();
    var transportFile = require_file();
    var transportRemote = require_remote();
    var Logger = require_Logger();
    var ErrorHandler = require_ErrorHandler();
    var EventLogger = require_EventLogger();
    var defaultLogger = new Logger({
      errorHandler: new ErrorHandler(),
      eventLogger: new EventLogger(),
      initializeFn: initialize,
      isDev: electronApi.isDev(),
      logId: "default",
      transportFactories: {
        console: transportConsole,
        file: transportFile,
        remote: transportRemote
      },
      variables: {
        processType: "main"
      }
    });
    defaultLogger.processInternalErrorFn = (e) => {
      defaultLogger.transports.console.writeFn({
        data: ["Unhandled electron-log error", e],
        level: "error"
      });
    };
    module2.exports = defaultLogger;
    module2.exports.Logger = Logger;
    module2.exports.default = module2.exports;
    electronApi.onIpc("__ELECTRON_LOG__", (_, message) => {
      if (message.scope) {
        Logger.getInstance(message).scope(message.scope);
      }
      const date = new Date(message.date);
      processMessage({
        ...message,
        date: date.getTime() ? date : /* @__PURE__ */ new Date()
      });
    });
    electronApi.onIpcInvoke("__ELECTRON_LOG__", (_, { cmd = "", logId }) => {
      switch (cmd) {
        case "getOptions": {
          const logger = Logger.getInstance({ logId });
          return {
            levels: logger.levels,
            logId
          };
        }
        default: {
          processMessage({ data: [`Unknown cmd '${cmd}'`], level: "error" });
          return {};
        }
      }
    });
    function processMessage(message) {
      Logger.getInstance(message)?.processMessage(message);
    }
  }
});

// ../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/index.js
var require_src = __commonJS({
  "../../node_modules/.pnpm/electron-log@5.0.0/node_modules/electron-log/src/index.js"(exports2, module2) {
    "use strict";
    var isRenderer = typeof process === "undefined" || (process.type === "renderer" || process.type === "worker");
    if (isRenderer) {
      require_electron_log_preload();
      module2.exports = require_renderer();
    } else {
      module2.exports = require_main();
    }
  }
});

// electron/main.ts
var import_node_fs2 = require("node:fs");
var import_promises5 = require("node:fs/promises");
var import_node_path5 = require("node:path");
var import_electron = require("electron");

// src/app-launcher.ts
var import_node_child_process = require("node:child_process");
var MAX_EXEC_BUFFER_BYTES = 8192;
var LAUNCH_WHITELIST = [
  "calc",
  "chrome",
  "code",
  "edge",
  "explorer",
  "firefox",
  "notepad"
];
function buildSafeEnvironment() {
  const allowedKeys = [
    "COMSPEC",
    "HOME",
    "LANG",
    "LC_ALL",
    "PATH",
    "PATHEXT",
    "PSModulePath",
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
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function extractErrorCode(error) {
  if (!isRecord(error)) {
    return void 0;
  }
  const candidate = error;
  return typeof candidate.code === "number" || typeof candidate.code === "string" ? candidate.code : void 0;
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
  if (!isRecord(error)) {
    return "";
  }
  const candidate = error;
  return toText(candidate.stderr);
}
function isLaunchAppName(value) {
  return LAUNCH_WHITELIST.includes(value);
}
function normalizeAppName(value) {
  return value.trim().toLowerCase();
}
function toPowerShellSingleQuoted(value) {
  return `'${value.replaceAll("'", "''")}'`;
}
function validateLaunchArguments(argumentsValue) {
  const allowedKeys = /* @__PURE__ */ new Set(["app_name"]);
  for (const key of Object.keys(argumentsValue)) {
    if (!allowedKeys.has(key)) {
      return createErrorResult(
        "INVALID_INPUT",
        `desktop.launch does not accept the "${key}" argument.`,
        {
          argument: key,
          reason: "unexpected_argument"
        },
        false
      );
    }
  }
  const { app_name: appName } = argumentsValue;
  if (typeof appName !== "string" || appName.trim().length === 0) {
    return createErrorResult(
      "INVALID_INPUT",
      "desktop.launch requires an app_name string.",
      {
        argument: "app_name",
        reason: "invalid_app_name"
      },
      false
    );
  }
  const normalizedAppName = normalizeAppName(appName);
  if (!isLaunchAppName(normalizedAppName)) {
    return createErrorResult(
      "PERMISSION_DENIED",
      `desktop.launch does not allow launching "${normalizedAppName}".`,
      {
        allowed_apps: LAUNCH_WHITELIST,
        app_name: normalizedAppName,
        reason: "app_not_whitelisted"
      },
      false
    );
  }
  return normalizedAppName;
}
function resolveExecutableName(appName) {
  const executableMap = {
    calc: "calc.exe",
    chrome: "chrome.exe",
    code: "code.cmd",
    edge: "msedge.exe",
    explorer: "explorer.exe",
    firefox: "firefox.exe",
    notepad: "notepad.exe"
  };
  return executableMap[appName];
}
function buildLaunchScript(appName) {
  const executableName = resolveExecutableName(appName);
  return [
    `$process = Start-Process -FilePath ${toPowerShellSingleQuoted(executableName)} -PassThru`,
    "[Console]::Out.Write(($process.Id).ToString())"
  ].join("\n");
}
function runPowerShell(dependencies, script) {
  return new Promise((resolvePromise, rejectPromise) => {
    dependencies.execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
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
        resolvePromise(toText(stdout));
      }
    );
  });
}
function toLaunchErrorResult(appName, error) {
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
  if (errorCode === "EACCES" || errorCode === "EPERM" || stderr.includes("Access is denied") || stderr.includes("This command cannot be run")) {
    return createErrorResult(
      "PERMISSION_DENIED",
      `Permission denied while launching ${appName}.`,
      {
        app_name: appName,
        reason: "desktop_launch_permission_denied"
      },
      false
    );
  }
  if (stderr.includes("cannot find") || stderr.includes("The system cannot find")) {
    return createErrorResult(
      "NOT_FOUND",
      `Whitelisted app "${appName}" was not found on this host.`,
      {
        app_name: appName,
        executable: resolveExecutableName(appName),
        reason: "desktop_launch_app_not_found"
      },
      false
    );
  }
  if (error instanceof Error) {
    return createErrorResult(
      "EXECUTION_FAILED",
      `Failed to launch ${appName}: ${stderr || error.message}`,
      {
        app_name: appName,
        reason: "desktop_launch_failed"
      },
      false
    );
  }
  return createErrorResult(
    "UNKNOWN",
    `Failed to launch ${appName}.`,
    {
      app_name: appName,
      reason: "desktop_launch_unknown_failure"
    },
    false
  );
}
function createUnsupportedPlatformError(platform) {
  return createErrorResult(
    "EXECUTION_FAILED",
    "Desktop app launch bridge is currently supported only on Windows hosts.",
    {
      platform,
      reason: "unsupported_platform"
    },
    false
  );
}
async function executeDesktopAgentLaunch(argumentsValue, dependencies = {}) {
  const appName = validateLaunchArguments(argumentsValue);
  if (typeof appName !== "string") {
    return appName;
  }
  const resolvedDependencies = {
    execFile: dependencies.execFile ?? import_node_child_process.execFile,
    platform: dependencies.platform ?? process.platform
  };
  if (resolvedDependencies.platform !== "win32") {
    return createUnsupportedPlatformError(resolvedDependencies.platform);
  }
  try {
    const pidText = await runPowerShell(resolvedDependencies, buildLaunchScript(appName));
    const parsedPid = Number.parseInt(pidText.trim(), 10);
    return {
      output: {
        launched: true,
        ...Number.isInteger(parsedPid) && parsedPid > 0 ? { pid: parsedPid } : {},
        process_name: appName
      },
      status: "success"
    };
  } catch (error) {
    return toLaunchErrorResult(appName, error);
  }
}

// src/auth.ts
function readRequiredValue(value, key) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Desktop agent environment is missing ${key}.`);
  }
  return normalized;
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isAuthenticatedActionResponse(value) {
  if (!isRecord2(value)) {
    return false;
  }
  const candidate = value;
  if (candidate.outcome !== "authenticated" || !isRecord2(candidate.session)) {
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
  if (isRecord2(payload)) {
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

// src/clipboard.ts
var import_node_child_process2 = require("node:child_process");
var MAX_EXEC_BUFFER_BYTES2 = 32 * 1024;
var MAX_CLIPBOARD_BYTES = 10 * 1024;
var REDACTED_PLACEHOLDER = "[redacted-sensitive-clipboard-content]";
function buildSafeEnvironment2() {
  const allowedKeys = [
    "COMSPEC",
    "HOME",
    "LANG",
    "LC_ALL",
    "PATH",
    "PATHEXT",
    "PSModulePath",
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
function createErrorResult2(error_code, error_message, details, retryable) {
  return {
    details,
    error_code,
    error_message,
    retryable,
    status: "error"
  };
}
function isRecord3(value) {
  return typeof value === "object" && value !== null;
}
function extractErrorCode2(error) {
  if (!isRecord3(error)) {
    return void 0;
  }
  const candidate = error;
  return typeof candidate.code === "number" || typeof candidate.code === "string" ? candidate.code : void 0;
}
function toText2(value) {
  if (typeof value === "string") {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }
  return "";
}
function extractStderr2(error) {
  if (!isRecord3(error)) {
    return "";
  }
  const candidate = error;
  return toText2(candidate.stderr);
}
function toPowerShellSingleQuoted2(value) {
  return `'${value.replaceAll("'", "''")}'`;
}
function runPowerShell2(dependencies, script) {
  return new Promise((resolvePromise, rejectPromise) => {
    dependencies.execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-Command", script],
      {
        encoding: "utf8",
        env: buildSafeEnvironment2(),
        maxBuffer: MAX_EXEC_BUFFER_BYTES2,
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
        resolvePromise(toText2(stdout));
      }
    );
  });
}
function toClipboardErrorResult(operation, error) {
  const errorCode = extractErrorCode2(error);
  const stderr = extractStderr2(error).trim();
  if (errorCode === "ENOENT") {
    return createErrorResult2(
      "NOT_FOUND",
      "PowerShell is not available on this host.",
      {
        reason: "powershell_not_found"
      },
      false
    );
  }
  if (errorCode === "EACCES" || errorCode === "EPERM" || stderr.includes("Access is denied")) {
    return createErrorResult2(
      "PERMISSION_DENIED",
      `Permission denied while attempting to ${operation} the desktop clipboard.`,
      {
        reason: `desktop_clipboard_${operation}_permission_denied`
      },
      false
    );
  }
  if (error instanceof Error) {
    return createErrorResult2(
      "EXECUTION_FAILED",
      `Failed to ${operation} desktop clipboard: ${stderr || error.message}`,
      {
        reason: `desktop_clipboard_${operation}_failed`
      },
      false
    );
  }
  return createErrorResult2(
    "UNKNOWN",
    `Failed to ${operation} desktop clipboard.`,
    {
      reason: `desktop_clipboard_${operation}_unknown_failure`
    },
    false
  );
}
function hasSensitiveClipboardPattern(content) {
  const sensitivePatterns = [
    /\b(?:api[_-]?key|secret|token|password|passwd|pwd)\s*[:=]\s*\S+/iu,
    /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/u,
    /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/u,
    /\b(?:sk|pk|rk|ghp|github_pat)_[A-Za-z0-9_]{12,}\b/u
  ];
  return sensitivePatterns.some((pattern) => pattern.test(content));
}
function normalizeClipboardReadOutput(rawContent) {
  const normalizedContent = rawContent.replace(/\r\n/gu, "\n");
  const byteLength = Buffer.byteLength(normalizedContent, "utf8");
  const isRedacted = hasSensitiveClipboardPattern(normalizedContent);
  const isTruncated = byteLength > MAX_CLIPBOARD_BYTES;
  let content = isRedacted ? REDACTED_PLACEHOLDER : normalizedContent;
  if (!isRedacted && isTruncated) {
    content = Buffer.from(content, "utf8").subarray(0, MAX_CLIPBOARD_BYTES).toString("utf8");
  }
  return {
    byte_length: byteLength,
    character_count: normalizedContent.length,
    content,
    is_redacted: isRedacted,
    is_truncated: isTruncated
  };
}
function validateReadArguments(argumentsValue) {
  const keys = Object.keys(argumentsValue);
  if (keys.length === 0) {
    return void 0;
  }
  return createErrorResult2(
    "INVALID_INPUT",
    "desktop.clipboard.read does not accept any arguments.",
    {
      argument: keys[0],
      reason: "unexpected_argument"
    },
    false
  );
}
function validateWriteArguments(argumentsValue) {
  const allowedKeys = /* @__PURE__ */ new Set(["text"]);
  for (const key of Object.keys(argumentsValue)) {
    if (!allowedKeys.has(key)) {
      return createErrorResult2(
        "INVALID_INPUT",
        `desktop.clipboard.write does not accept the "${key}" argument.`,
        {
          argument: key,
          reason: "unexpected_argument"
        },
        false
      );
    }
  }
  const { text } = argumentsValue;
  if (typeof text !== "string") {
    return createErrorResult2(
      "INVALID_INPUT",
      "desktop.clipboard.write requires a text string.",
      {
        argument: "text",
        reason: "invalid_text"
      },
      false
    );
  }
  if (Buffer.byteLength(text, "utf8") > MAX_CLIPBOARD_BYTES) {
    return createErrorResult2(
      "INVALID_INPUT",
      "desktop.clipboard.write text must be 10KB or smaller.",
      {
        argument: "text",
        max_bytes: MAX_CLIPBOARD_BYTES,
        reason: "text_too_large"
      },
      false
    );
  }
  return text;
}
function createUnsupportedPlatformError2(platform) {
  return createErrorResult2(
    "EXECUTION_FAILED",
    "Desktop clipboard bridge is currently supported only on Windows hosts.",
    {
      platform,
      reason: "unsupported_platform"
    },
    false
  );
}
async function executeDesktopAgentClipboardRead(argumentsValue, dependencies = {}) {
  const invalidArguments = validateReadArguments(argumentsValue);
  if (invalidArguments) {
    return invalidArguments;
  }
  const resolvedDependencies = {
    execFile: dependencies.execFile ?? import_node_child_process2.execFile,
    platform: dependencies.platform ?? process.platform
  };
  if (resolvedDependencies.platform !== "win32") {
    return createUnsupportedPlatformError2(resolvedDependencies.platform);
  }
  try {
    const rawContent = await runPowerShell2(resolvedDependencies, "Get-Clipboard -Raw -Format Text");
    return {
      output: normalizeClipboardReadOutput(rawContent),
      status: "success"
    };
  } catch (error) {
    return toClipboardErrorResult("read", error);
  }
}
async function executeDesktopAgentClipboardWrite(argumentsValue, dependencies = {}) {
  const text = validateWriteArguments(argumentsValue);
  if (typeof text !== "string") {
    return text;
  }
  const resolvedDependencies = {
    execFile: dependencies.execFile ?? import_node_child_process2.execFile,
    platform: dependencies.platform ?? process.platform
  };
  if (resolvedDependencies.platform !== "win32") {
    return createUnsupportedPlatformError2(resolvedDependencies.platform);
  }
  try {
    await runPowerShell2(
      resolvedDependencies,
      `Set-Clipboard -Value ${toPowerShellSingleQuoted2(text)}`
    );
    return {
      output: {
        byte_length: Buffer.byteLength(text, "utf8"),
        character_count: text.length,
        written: true
      },
      status: "success"
    };
  } catch (error) {
    return toClipboardErrorResult("write", error);
  }
}

// src/diagnostics.ts
var import_promises = require("node:fs/promises");

// src/logger.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_electron_log = __toESM(require_src(), 1);
var REDACTED_KEYS = /* @__PURE__ */ new Set([
  "access_token",
  "refreshtoken",
  "refresh_token",
  "accesstoken",
  "password",
  "code",
  "pairing_code",
  "authorization",
  "cookie",
  "set-cookie",
  "email",
  "refresh",
  "secret",
  "api_key",
  "apikey"
]);
var BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu;
var JWT_PATTERN = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu;
function rotateLogFiles(logFilePath) {
  const oldestPath = `${logFilePath}.5`;
  if ((0, import_node_fs.existsSync)(oldestPath)) {
    (0, import_node_fs.unlinkSync)(oldestPath);
  }
  for (let index = 4; index >= 1; index -= 1) {
    const sourcePath = `${logFilePath}.${index}`;
    if ((0, import_node_fs.existsSync)(sourcePath)) {
      (0, import_node_fs.renameSync)(sourcePath, `${logFilePath}.${index + 1}`);
    }
  }
  if ((0, import_node_fs.existsSync)(logFilePath)) {
    (0, import_node_fs.renameSync)(logFilePath, `${logFilePath}.1`);
  }
}
function normalizeRedactionKey(key) {
  return key.toLowerCase();
}
function shouldRedactKey(key) {
  return REDACTED_KEYS.has(normalizeRedactionKey(key));
}
function redactPii(value) {
  if (typeof value === "string") {
    return value.replace(BEARER_TOKEN_PATTERN, "Bearer [REDACTED]").replace(JWT_PATTERN, "[REDACTED_JWT]");
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactPii(item));
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  const redactedRecord = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    redactedRecord[key] = shouldRedactKey(key) ? "[REDACTED]" : redactPii(nestedValue);
  }
  return redactedRecord;
}
function createDesktopAgentLogger(options) {
  const logger = import_electron_log.default;
  const logFilePath = (0, import_node_path.join)(options.userDataDirectory, "logs", "main.log");
  (0, import_node_fs.mkdirSync)((0, import_node_path.dirname)(logFilePath), { recursive: true });
  logger.transports.file.resolvePathFn = () => logFilePath;
  logger.transports.file.archiveLogFn = () => {
    rotateLogFiles(logFilePath);
  };
  logger.transports.file.level = "info";
  logger.transports.file.maxSize = 5 * 1024 * 1024;
  logger.transports.console.level = process.env["NODE_ENV"] === "production" ? "warn" : "debug";
  logger.hooks.push((message) => {
    message.data = message.data.map((item) => redactPii(item));
    return message;
  });
  return logger;
}

// src/diagnostics.ts
function sanitizeLogLine(line) {
  const redactedValue = redactPii(line);
  return typeof redactedValue === "string" ? redactedValue : JSON.stringify(redactedValue);
}
async function readLastLogLines(logFilePath, limit = 50) {
  let logContent;
  try {
    logContent = await (0, import_promises.readFile)(logFilePath, "utf8");
  } catch {
    return [];
  }
  return logContent.split(/\r?\n/u).filter((line) => line.trim().length > 0).slice(-limit).map((line) => sanitizeLogLine(line));
}
async function createDesktopAgentDiagnosticsSnapshot(options) {
  return {
    app_version: options.appVersion,
    arch: options.arch,
    electron_version: options.electronVersion,
    last_log_lines: await readLastLogLines(options.logFilePath),
    locale: options.locale,
    node_version: options.nodeVersion,
    platform: options.platform,
    runtime_status: options.runtimeStatus,
    settings: {
      autoStart: options.settings.autoStart,
      openWindowOnStart: options.settings.openWindowOnStart,
      telemetryOptIn: options.settings.telemetryOptIn
    }
  };
}

// src/electron-session-storage.ts
var import_promises2 = require("node:fs/promises");
var import_node_path2 = require("node:path");
var noopSessionStorageLogger = {
  warn: () => {
  }
};
function isNodeErrorWithCode(error, code) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeSessionFromUnknown(value) {
  if (!isRecord4(value) || typeof value["access_token"] !== "string") {
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
  const directory = (0, import_node_path2.dirname)(filePath);
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await (0, import_promises2.mkdir)(directory, { recursive: true });
  await (0, import_promises2.writeFile)(temporaryPath, body);
  await (0, import_promises2.rename)(temporaryPath, filePath);
}
var FileDesktopAgentSessionStorage = class {
  #filePath;
  constructor(userDataDirectory) {
    this.#filePath = (0, import_node_path2.join)(userDataDirectory, "desktop-session.json");
  }
  async clear() {
    await (0, import_promises2.rm)(this.#filePath, { force: true });
  }
  async load() {
    let rawValue;
    try {
      rawValue = await (0, import_promises2.readFile)(this.#filePath, "utf8");
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
    this.#encryptedFilePath = (0, import_node_path2.join)(userDataDirectory, "desktop-session.bin");
    this.#legacyFilePath = (0, import_node_path2.join)(userDataDirectory, "desktop-session.json");
    this.#legacyStorage = new FileDesktopAgentSessionStorage(userDataDirectory);
    this.#logger = logger;
    this.#safeStorage = safeStorage2;
  }
  async clear() {
    await (0, import_promises2.rm)(this.#encryptedFilePath, { force: true });
    await (0, import_promises2.rm)(this.#legacyFilePath, { force: true });
  }
  async load() {
    let encryptedValue;
    try {
      encryptedValue = await (0, import_promises2.readFile)(this.#encryptedFilePath);
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
    await (0, import_promises2.rm)(this.#legacyFilePath, { force: true });
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
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isDesktopAgentCapabilityCandidate(value) {
  return isRecord5(value);
}
function isConnectionReadyMessageCandidate(value) {
  return isRecord5(value);
}
function isDesktopAgentSessionAcceptedPayloadCandidate(value) {
  return isRecord5(value);
}
function isDesktopAgentSessionAcceptedMessageCandidate(value) {
  return isRecord5(value);
}
function isDesktopAgentExecutePayloadCandidate(value) {
  return isRecord5(value);
}
function isDesktopAgentExecuteMessageCandidate(value) {
  return isRecord5(value);
}
function isDesktopAgentHeartbeatPingPayloadCandidate(value) {
  return isRecord5(value);
}
function isDesktopAgentHeartbeatPingMessageCandidate(value) {
  return isRecord5(value);
}
function isDesktopAgentRejectedPayloadCandidate(value) {
  return isRecord5(value);
}
function isDesktopAgentRejectedMessageCandidate(value) {
  return isRecord5(value);
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
  return isDesktopAgentExecuteMessageCandidate(value) && value.type === "desktop-agent.execute" && isDesktopAgentExecutePayloadCandidate(value.payload) && isRecord5(value.payload.arguments) && typeof value.payload.call_id === "string" && typeof value.payload.request_id === "string" && typeof value.payload.run_id === "string" && isDesktopAgentToolName(value.payload.tool_name) && typeof value.payload.trace_id === "string";
}
function isDesktopAgentRejectedServerMessage(value) {
  return isDesktopAgentRejectedMessageCandidate(value) && value.type === "desktop-agent.rejected" && isDesktopAgentRejectedPayloadCandidate(value.payload) && typeof value.payload.error_message === "string" && typeof value.payload.error_code === "string" && desktopAgentRejectCodes.includes(value.payload.error_code);
}
function isDesktopAgentServerMessage(value) {
  return isDesktopAgentConnectionReadyServerMessage(value) || isDesktopAgentSessionAcceptedServerMessage(value) || isDesktopAgentHeartbeatPingServerMessage(value) || isDesktopAgentExecuteServerMessage(value) || isDesktopAgentRejectedServerMessage(value);
}

// src/input.ts
var import_node_child_process3 = require("node:child_process");
var MAX_EXEC_BUFFER_BYTES3 = 8192;
var MAX_CLICK_COUNT = 3;
var MAX_DELAY_MS = 1e3;
var MAX_SCREEN_COORDINATE = 65535;
var MAX_SCROLL_DELTA = 12e3;
var MAX_TEXT_LENGTH = 2e3;
var ALLOWED_MODIFIERS = /* @__PURE__ */ new Set(["alt", "ctrl", "shift"]);
function buildSafeEnvironment3() {
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
function createErrorResult3(error_code, error_message, details, retryable) {
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
function isRecord6(value) {
  return typeof value === "object" && value !== null;
}
function isFiniteInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value);
}
function extractErrorCode3(error) {
  if (isRecord6(error)) {
    const candidate = error;
    if (typeof candidate.code === "number" || typeof candidate.code === "string") {
      return candidate.code;
    }
  }
  return void 0;
}
function toText3(value) {
  if (typeof value === "string") {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }
  return "";
}
function extractStderr3(error) {
  if (isRecord6(error)) {
    const candidate = error;
    return toText3(candidate.stderr);
  }
  return "";
}
function toPowerShellSingleQuoted3(value) {
  return `'${value.replaceAll("'", "''")}'`;
}
function runPowerShell3(dependencies, script) {
  return new Promise((resolvePromise, rejectPromise) => {
    dependencies.execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-Command", script],
      {
        encoding: "utf8",
        env: buildSafeEnvironment3(),
        maxBuffer: MAX_EXEC_BUFFER_BYTES3,
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
function createUnsupportedPlatformError3(toolName, platform) {
  return createErrorResult3(
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
      return createErrorResult3(
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
    return createErrorResult3(
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
    return createErrorResult3(
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
    return createErrorResult3(
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
    return createErrorResult3(
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
  const errorCode = extractErrorCode3(error);
  const stderr = extractStderr3(error).trim();
  if (errorCode === "ENOENT") {
    return createErrorResult3(
      "NOT_FOUND",
      "PowerShell is not available on this host.",
      {
        reason: "powershell_not_found"
      },
      false
    );
  }
  if (errorCode === "EACCES" || errorCode === "EPERM" || stderr.includes("Access is denied")) {
    return createErrorResult3(
      "PERMISSION_DENIED",
      "Permission denied while injecting desktop click input.",
      {
        reason: "desktop_click_permission_denied"
      },
      false
    );
  }
  if (error instanceof Error) {
    return createErrorResult3(
      "EXECUTION_FAILED",
      `Failed to execute desktop click: ${stderr || error.message}`,
      {
        reason: "desktop_click_failed"
      },
      false
    );
  }
  return createErrorResult3(
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
    return createUnsupportedPlatformError3("desktop.click", dependencies.platform);
  }
  try {
    await runPowerShell3(dependencies, buildDesktopClickScript(validatedArguments));
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
      return createErrorResult3(
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
    return createErrorResult3(
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
    return createErrorResult3(
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
  const serializedTokens = input.tokens.map((token) => toPowerShellSingleQuoted3(token)).join(", ");
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
  const errorCode = extractErrorCode3(error);
  const stderr = extractStderr3(error).trim();
  if (errorCode === "ENOENT") {
    return createErrorResult3(
      "NOT_FOUND",
      "PowerShell is not available on this host.",
      {
        reason: "powershell_not_found"
      },
      false
    );
  }
  if (errorCode === "EACCES" || errorCode === "EPERM" || stderr.includes("Access is denied")) {
    return createErrorResult3(
      "PERMISSION_DENIED",
      "Permission denied while injecting desktop typing input.",
      {
        reason: "desktop_type_permission_denied"
      },
      false
    );
  }
  if (error instanceof Error) {
    return createErrorResult3(
      "EXECUTION_FAILED",
      `Failed to execute desktop typing: ${stderr || error.message}`,
      {
        reason: "desktop_type_failed"
      },
      false
    );
  }
  return createErrorResult3(
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
    return createUnsupportedPlatformError3("desktop.type", dependencies.platform);
  }
  try {
    await runPowerShell3(dependencies, buildDesktopTypeScript(validatedArguments));
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
      return createErrorResult3(
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
    return createErrorResult3(
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
    return createErrorResult3(
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
      return createErrorResult3(
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
      return createErrorResult3(
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
    return createErrorResult3(
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
    `[System.Windows.Forms.SendKeys]::SendWait(${toPowerShellSingleQuoted3(input.sequence)})`
  ].join("\n");
}
function toDesktopKeypressErrorResult(error) {
  const errorCode = extractErrorCode3(error);
  const stderr = extractStderr3(error).trim();
  if (errorCode === "ENOENT") {
    return createErrorResult3(
      "NOT_FOUND",
      "PowerShell is not available on this host.",
      {
        reason: "powershell_not_found"
      },
      false
    );
  }
  if (errorCode === "EACCES" || errorCode === "EPERM" || stderr.includes("Access is denied")) {
    return createErrorResult3(
      "PERMISSION_DENIED",
      "Permission denied while injecting desktop keypress input.",
      {
        reason: "desktop_keypress_permission_denied"
      },
      false
    );
  }
  if (error instanceof Error) {
    return createErrorResult3(
      "EXECUTION_FAILED",
      `Failed to execute desktop keypress: ${stderr || error.message}`,
      {
        reason: "desktop_keypress_failed"
      },
      false
    );
  }
  return createErrorResult3(
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
    return createUnsupportedPlatformError3("desktop.keypress", dependencies.platform);
  }
  try {
    await runPowerShell3(dependencies, buildDesktopKeypressScript(validatedArguments));
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
      return createErrorResult3(
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
    return createErrorResult3(
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
    return createErrorResult3(
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
    return createErrorResult3(
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
    "	public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, UIntPtr dwExtraInfo);",
    "}",
    '"@',
    `if (${String(input.delta_y)} -ne 0) { [DesktopScrollNative]::mouse_event(0x0800, 0, 0, ${String(input.delta_y)}, [UIntPtr]::Zero) }`,
    `if (${String(input.delta_x)} -ne 0) { [DesktopScrollNative]::mouse_event(0x01000, 0, 0, ${String(input.delta_x)}, [UIntPtr]::Zero) }`
  ].join("\n");
}
function toDesktopScrollErrorResult(error) {
  const errorCode = extractErrorCode3(error);
  const stderr = extractStderr3(error).trim();
  if (errorCode === "ENOENT") {
    return createErrorResult3(
      "NOT_FOUND",
      "PowerShell is not available on this host.",
      {
        reason: "powershell_not_found"
      },
      false
    );
  }
  if (errorCode === "EACCES" || errorCode === "EPERM" || stderr.includes("Access is denied")) {
    return createErrorResult3(
      "PERMISSION_DENIED",
      "Permission denied while injecting desktop scroll input.",
      {
        reason: "desktop_scroll_permission_denied"
      },
      false
    );
  }
  if (error instanceof Error) {
    return createErrorResult3(
      "EXECUTION_FAILED",
      `Failed to execute desktop scroll: ${stderr || error.message}`,
      {
        reason: "desktop_scroll_failed"
      },
      false
    );
  }
  return createErrorResult3(
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
    return createUnsupportedPlatformError3("desktop.scroll", dependencies.platform);
  }
  try {
    await runPowerShell3(dependencies, buildDesktopScrollScript(validatedArguments));
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
    execFile: dependencies.execFile ?? import_node_child_process3.execFile,
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
      return createErrorResult3(
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
var import_node_child_process4 = require("node:child_process");
var import_promises3 = require("node:fs/promises");
var import_node_os = require("node:os");
var import_node_path3 = require("node:path");
var import_node_util = require("node:util");
var execFileAsync = (0, import_node_util.promisify)(import_node_child_process4.execFile);
var PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
function buildSafeEnvironment4() {
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
  const outputPath = (0, import_node_path3.join)((0, import_node_os.tmpdir)(), `runa-desktop-agent-${Date.now()}-${Math.random()}.png`);
  try {
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-Command", buildCaptureScript(outputPath)],
      {
        encoding: "utf8",
        env: buildSafeEnvironment4(),
        maxBuffer: 16384,
        windowsHide: true
      }
    );
    const screenshotBuffer = await (0, import_promises3.readFile)(outputPath);
    validatePngBuffer(screenshotBuffer);
    return {
      base64_data: screenshotBuffer.toString("base64"),
      byte_length: screenshotBuffer.byteLength,
      format: "png",
      mime_type: "image/png"
    };
  } finally {
    await (0, import_promises3.rm)(outputPath, {
      force: true
    }).catch(() => void 0);
  }
}

// src/ws-bridge.ts
var DESKTOP_AGENT_HANDSHAKE_TIMEOUT_MS = 15e3;
var desktopAgentImplementedCapabilities = desktopAgentToolNames.map((toolName) => ({
  tool_name: toolName
}));
function sendClientMessage(socket, message) {
  socket.send(JSON.stringify(message));
}
function createHelloMessage(options) {
  return {
    payload: {
      agent_id: options.agent_id,
      capabilities: desktopAgentImplementedCapabilities,
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
      case "desktop.clipboard.read": {
        const result = await executeDesktopAgentClipboardRead(message.payload.arguments);
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
      case "desktop.clipboard.write": {
        const result = await executeDesktopAgentClipboardWrite(message.payload.arguments);
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
      case "desktop.launch": {
        const result = await executeDesktopAgentLaunch(message.payload.arguments);
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
var import_promises4 = require("node:fs/promises");
var import_node_path4 = require("node:path");
var defaultDesktopAgentSettings = {
  autoStart: true,
  openWindowOnStart: false,
  telemetryOptIn: false
};
function isNodeErrorWithCode2(error, code) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
function isRecord7(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeSettings(value) {
  if (!isRecord7(value)) {
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
  await (0, import_promises4.mkdir)((0, import_node_path4.dirname)(filePath), { recursive: true });
  await (0, import_promises4.writeFile)(temporaryPath, JSON.stringify(settings, null, 2), "utf8");
  await (0, import_promises4.rename)(temporaryPath, filePath);
}
var FileDesktopAgentSettingsStore = class {
  #filePath;
  #settings = null;
  constructor(userDataDirectory) {
    this.#filePath = (0, import_node_path4.join)(userDataDirectory, "settings.json");
  }
  async load() {
    if (this.#settings) {
      return { ...this.#settings };
    }
    let rawValue;
    try {
      rawValue = await (0, import_promises4.readFile)(this.#filePath, "utf8");
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
    await (0, import_promises4.rm)(this.#filePath, { force: true });
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
var userDataDirectoryOverride = process.env.RUNA_DESKTOP_AGENT_USER_DATA_DIR?.trim();
if (userDataDirectoryOverride) {
  import_electron.app.setPath("userData", userDataDirectoryOverride);
}
import_electron.crashReporter.start({
  companyName: "Runa",
  ignoreSystemCrashHandler: false,
  productName: "Runa Desktop",
  submitURL: process.env["RUNA_CRASH_SUBMIT_URL"] ?? "https://localhost/",
  uploadToServer: process.env["RUNA_CRASH_UPLOAD"] === "true"
});
var desktopLogger = createDesktopAgentLogger({
  userDataDirectory: import_electron.app.getPath("userData")
});
function getMainLogFilePath() {
  return (0, import_node_path5.join)(import_electron.app.getPath("userData"), "logs", "main.log");
}
function getCrashpadDirectoryPath() {
  return (0, import_node_path5.join)(import_electron.app.getPath("userData"), "Crashpad");
}
function logBoot(message, data) {
  const safeData = data === void 0 ? void 0 : redactPii(data);
  const payload = safeData === void 0 ? "" : ` ${JSON.stringify(safeData)}`;
  console.log(`[boot:${message}]${payload}`);
  desktopLogger.info(`[boot:${message}]`, safeData ?? {});
}
var bootLogger = {
  warn: (message) => {
    const safeMessage = redactPii(message);
    const printableMessage = typeof safeMessage === "string" ? safeMessage : JSON.stringify(safeMessage);
    console.warn(`[boot:warn] ${printableMessage}`);
    desktopLogger.warn(`[boot:warn] ${printableMessage}`);
  }
};
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
  return (0, import_node_path5.dirname)(__filename);
}
function resolvePackagedPath(...segments) {
  return (0, import_node_path5.join)(getAppDir(), ...segments);
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
function isRecord8(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isDesktopAgentSessionInputPayload(value) {
  if (!isRecord8(value)) {
    return false;
  }
  const expiresAt = value.expires_at;
  return typeof value.access_token === "string" && typeof value.refresh_token === "string" && (expiresAt === void 0 || typeof expiresAt === "number") && (value.token_type === void 0 || typeof value.token_type === "string");
}
function isShellInvokeActionPayload(value) {
  if (!isRecord8(value)) {
    return false;
  }
  return value.actionId === "connect" || value.actionId === "connecting" || value.actionId === "retry" || value.actionId === "sign_in" || value.actionId === "sign_out";
}
function isSettingsPatch(value) {
  if (!isRecord8(value)) {
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
async function openLogFolder() {
  await import_electron.shell.openPath((0, import_node_path5.join)(import_electron.app.getPath("userData"), "logs"));
}
async function openCrashFolder() {
  await import_electron.shell.openPath(getCrashpadDirectoryPath());
}
async function copyDiagnosticsSnapshot() {
  const snapshot = await createDesktopAgentDiagnosticsSnapshot({
    appVersion: import_electron.app.getVersion(),
    arch: process.arch,
    electronVersion: process.versions.electron,
    locale: import_electron.app.getLocale(),
    logFilePath: getMainLogFilePath(),
    nodeVersion: process.versions.node,
    platform: process.platform,
    runtimeStatus: getViewModel().status,
    settings: currentSettings
  });
  import_electron.clipboard.writeText(JSON.stringify(snapshot, null, 2));
  logBoot("diagnostics:copied");
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
      const body = await (0, import_promises5.readFile)(assetPath);
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
  const trayIcon = (0, import_node_fs2.existsSync)(iconPath) ? import_electron.nativeImage.createFromPath(iconPath) : import_electron.nativeImage.createEmpty();
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
        click: () => {
          void openLogFolder();
        },
        label: "Open log folder"
      },
      {
        click: () => {
          void openCrashFolder();
        },
        label: "Open crash folder"
      },
      {
        click: () => {
          void copyDiagnosticsSnapshot();
        },
        label: "Copy diagnostics"
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
  desktopLogger.error("uncaught", error);
});
process.on("unhandledRejection", (reason) => {
  logBoot("process:unhandled-rejection", { reason: String(reason) });
  desktopLogger.error("unhandled", reason);
});
//# sourceMappingURL=main.cjs.map
