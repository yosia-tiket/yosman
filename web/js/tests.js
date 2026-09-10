function formatValue(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function createExpect(actual) {
  const self = {
    _neg: false,
    get to() {
      return self;
    },
    get be() {
      return self;
    },
    get have() {
      return self;
    },
    get not() {
      self._neg = true;
      return self;
    },
    equal(expected) {
      return compare(
        () => actual === expected,
        `expected ${formatValue(actual)} to equal ${formatValue(expected)}`
      );
    },
    eql(expected) {
      return compare(
        () => JSON.stringify(actual) === JSON.stringify(expected),
        `expected ${formatValue(actual)} to deeply equal ${formatValue(expected)}`
      );
    },
    ok() {
      return compare(() => Boolean(actual), `expected ${formatValue(actual)} to be truthy`);
    },
    true() {
      return compare(() => actual === true, `expected ${formatValue(actual)} to be true`);
    },
    false() {
      return compare(() => actual === false, `expected ${formatValue(actual)} to be false`);
    },
    above(n) {
      return compare(() => actual > n, `expected ${formatValue(actual)} to be above ${n}`);
    },
    below(n) {
      return compare(() => actual < n, `expected ${formatValue(actual)} to be below ${n}`);
    },
    include(item) {
      return compare(() => {
        if (typeof actual === "string" || Array.isArray(actual)) return actual.includes(item);
        if (actual && typeof actual === "object") return item in actual;
        return false;
      }, `expected ${formatValue(actual)} to include ${formatValue(item)}`);
    },
    property(name) {
      return compare(
        () => actual != null && Object.prototype.hasOwnProperty.call(actual, name),
        `expected object to have property "${name}"`
      );
    },
    a(type) {
      const got = Array.isArray(actual) ? "array" : typeof actual;
      return compare(() => got === type, `expected type ${type}, got ${got}`);
    },
    an(type) {
      return self.a(type);
    },
  };

  function compare(fn, message) {
    const pass = fn();
    if (self._neg ? pass : !pass) {
      throw new Error(self._neg ? `not ${message}` : message);
    }
    return self;
  }

  return self;
}

function createPm(ctx) {
  const tests = [];
  const env = { ...(ctx.environment || {}) };
  const response = ctx.response || {};
  const headerMap = Object.fromEntries(response.headers || []);

  const pm = {
    environment: {
      get: (key) => env[key],
      set: (key, value) => {
        env[key] = String(value);
      },
      unset: (key) => {
        delete env[key];
      },
    },
    variables: {
      get: (key) => env[key],
      set: (key, value) => {
        env[key] = String(value);
      },
    },
    request: ctx.request || {},
    response: {
      code: response.status,
      status: response.reason,
      responseTime: response.time_ms,
      headers: headerMap,
      text: () => response.body || "",
      json() {
        return JSON.parse(response.body || "null");
      },
    },
    test(name, fn) {
      try {
        fn();
        tests.push({ name, passed: true, error: null });
      } catch (err) {
        tests.push({ name, passed: false, error: err.message || String(err) });
      }
    },
    expect: createExpect,
    _tests: tests,
    _env: env,
  };
  return pm;
}

function runUserScript(code, ctx) {
  const pm = createPm(ctx);
  const logs = [];
  const sandboxConsole = {
    log: (...args) => logs.push(args.map(String).join(" ")),
    warn: (...args) => logs.push(args.map(String).join(" ")),
    error: (...args) => logs.push(args.map(String).join(" ")),
  };
  if (!code || !String(code).trim()) {
    return { tests: [], logs, env: pm._env };
  }
  try {
    const fn = new Function("pm", "console", `"use strict";\n${code}`);
    fn(pm, sandboxConsole);
  } catch (err) {
    pm._tests.push({ name: "Script error", passed: false, error: err.message || String(err) });
  }
  return { tests: pm._tests, logs, env: pm._env };
}
