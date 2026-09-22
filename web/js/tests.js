function formatValue(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function typeOfValue(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function includesValue(actual, item) {
  if (typeof actual === "string") return actual.includes(item);
  if (Array.isArray(actual)) return actual.includes(item);
  if (actual && typeof actual === "object") return item in actual;
  return false;
}

function isEmptyValue(actual) {
  if (typeof actual === "string" || Array.isArray(actual)) return actual.length === 0;
  if (actual && typeof actual === "object") return Object.keys(actual).length === 0;
  return !actual;
}

// A small subset of chai's BDD assertion API — enough for the assertions
// that show up in real-world Postman test scripts. Language chains (to, be,
// have, ...) are no-op getters for readability; property assertions (ok,
// true, empty, ...) run the check on access since chai uses them without
// parens; method assertions (equal, above, ...) run on call.
const CHAI_LANGUAGE_CHAINS = ["to", "be", "been", "is", "that", "which", "and", "has", "have", "with", "at", "of", "same", "but", "does"];

function createExpect(actual) {
  const self = { _neg: false };

  for (const name of CHAI_LANGUAGE_CHAINS) {
    Object.defineProperty(self, name, { get: () => self });
  }
  Object.defineProperty(self, "not", {
    get() {
      self._neg = true;
      return self;
    },
  });

  function assert(pass, message) {
    if (self._neg ? pass : !pass) {
      throw new Error(self._neg ? `not ${message}` : message);
    }
    return self;
  }

  const propertyAssertions = {
    ok: () => assert(Boolean(actual), `expected ${formatValue(actual)} to be truthy`),
    true: () => assert(actual === true, `expected ${formatValue(actual)} to be true`),
    false: () => assert(actual === false, `expected ${formatValue(actual)} to be false`),
    null: () => assert(actual === null, `expected ${formatValue(actual)} to be null`),
    undefined: () => assert(actual === undefined, `expected ${formatValue(actual)} to be undefined`),
    exist: () => assert(actual !== null && actual !== undefined, `expected ${formatValue(actual)} to exist`),
    empty: () => assert(isEmptyValue(actual), `expected ${formatValue(actual)} to be empty`),
    NaN: () => assert(Number.isNaN(actual), `expected ${formatValue(actual)} to be NaN`),
  };
  for (const [name, check] of Object.entries(propertyAssertions)) {
    Object.defineProperty(self, name, { get: check });
  }

  self.equal = (expected) => assert(actual === expected, `expected ${formatValue(actual)} to equal ${formatValue(expected)}`);
  self.eql = (expected) => assert(JSON.stringify(actual) === JSON.stringify(expected), `expected ${formatValue(actual)} to deeply equal ${formatValue(expected)}`);
  self.a = (type) => assert(typeOfValue(actual) === type, `expected type ${type}, got ${typeOfValue(actual)}`);
  self.an = self.a;
  self.above = (n) => assert(actual > n, `expected ${formatValue(actual)} to be above ${n}`);
  self.below = (n) => assert(actual < n, `expected ${formatValue(actual)} to be below ${n}`);
  self.least = (n) => assert(actual >= n, `expected ${formatValue(actual)} to be at least ${n}`);
  self.most = (n) => assert(actual <= n, `expected ${formatValue(actual)} to be at most ${n}`);
  self.within = (min, max) => assert(actual >= min && actual <= max, `expected ${formatValue(actual)} to be within ${min}..${max}`);
  self.include = self.contain = (item) => assert(includesValue(actual, item), `expected ${formatValue(actual)} to include ${formatValue(item)}`);
  self.property = (name, value) => {
    const has = actual != null && Object.prototype.hasOwnProperty.call(actual, name);
    if (value === undefined) return assert(has, `expected object to have property "${name}"`);
    return assert(has && actual[name] === value, `expected property "${name}" to equal ${formatValue(value)}`);
  };
  self.length = self.lengthOf = (n) =>
    assert(actual != null && actual.length === n, `expected length ${n}, got ${actual ? actual.length : "undefined"}`);
  self.match = (regex) => assert(regex.test(actual), `expected ${formatValue(actual)} to match ${regex}`);
  self.string = (str) => assert(typeof actual === "string" && actual.includes(str), `expected ${formatValue(actual)} to contain ${formatValue(str)}`);
  self.instanceOf = self.instanceof = (ctor) => assert(actual instanceof ctor, `expected ${formatValue(actual)} to be an instance of ${ctor.name || ctor}`);

  return self;
}

// Mirrors chai-http's response assertions (pm.response.to.have.status(...)),
// which is what real Postman test scripts use to assert on the response.
function createResponseAssertions(response) {
  const headerMap = {};
  for (const [key, value] of response.headers || []) headerMap[String(key).toLowerCase()] = value;
  const contentType = response.content_type || headerMap["content-type"] || "";

  const self = { _neg: false };
  for (const name of CHAI_LANGUAGE_CHAINS) {
    Object.defineProperty(self, name, { get: () => self });
  }
  Object.defineProperty(self, "not", {
    get() {
      self._neg = true;
      return self;
    },
  });

  function assert(pass, message) {
    if (self._neg ? pass : !pass) {
      throw new Error(self._neg ? `not ${message}` : message);
    }
    return self;
  }

  self.status = (code) => assert(response.status === code, `expected response to have status ${code} but got ${response.status}`);
  self.header = (name, value) => {
    const actual = headerMap[String(name).toLowerCase()];
    if (value === undefined) return assert(actual !== undefined, `expected response to have header "${name}"`);
    return assert(actual === value, `expected header "${name}" to equal ${formatValue(value)}, got ${formatValue(actual)}`);
  };

  const statusAssertions = {
    ok: () => assert(response.status >= 200 && response.status < 300, `expected response to be ok but got status ${response.status}`),
    success: () => assert(response.status >= 200 && response.status < 300, `expected a successful response but got status ${response.status}`),
    error: () => assert(response.status >= 400, `expected response to be an error but got status ${response.status}`),
    clientError: () => assert(response.status >= 400 && response.status < 500, `expected a client error but got status ${response.status}`),
    serverError: () => assert(response.status >= 500, `expected a server error but got status ${response.status}`),
    json: () => assert(/json/i.test(contentType), `expected response content-type to be json, got ${formatValue(contentType)}`),
    html: () => assert(/html/i.test(contentType), `expected response content-type to be html, got ${formatValue(contentType)}`),
  };
  for (const [name, check] of Object.entries(statusAssertions)) {
    Object.defineProperty(self, name, { get: check });
  }

  return self;
}

function createVariableStore(initial) {
  const store = { ...(initial || {}) };
  return {
    _store: store,
    get: (key) => store[key],
    set: (key, value) => {
      store[key] = String(value);
    },
    unset: (key) => {
      delete store[key];
    },
    has: (key) => Object.prototype.hasOwnProperty.call(store, key),
  };
}

function createPm(ctx) {
  const tests = [];
  const environment = createVariableStore(ctx.environment);
  const collectionVariables = createVariableStore(ctx.collectionVariables);
  const response = ctx.response || {};
  const headerMap = Object.fromEntries(response.headers || []);

  const pm = {
    environment,
    collectionVariables,
    variables: {
      get: (key) => (environment.has(key) ? environment.get(key) : collectionVariables.get(key)),
      set: (key, value) => environment.set(key, value),
      unset: (key) => environment.unset(key),
      has: (key) => environment.has(key) || collectionVariables.has(key),
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
      get to() {
        return createResponseAssertions(response);
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
    _env: environment._store,
    _collectionVars: collectionVariables._store,
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
    return { tests: [], logs, env: pm._env, collectionVars: pm._collectionVars };
  }
  try {
    const fn = new Function("pm", "console", `"use strict";\n${code}`);
    fn(pm, sandboxConsole);
  } catch (err) {
    pm._tests.push({ name: "Script error", passed: false, error: err.message || String(err) });
  }
  return { tests: pm._tests, logs, env: pm._env, collectionVars: pm._collectionVars };
}
