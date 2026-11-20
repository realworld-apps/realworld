#!/usr/bin/env bun
// Converts Hurl test files in api/hurl/ to a Bruno collection in api/bruno/
// Usage: bun api/hurl-to-bruno.js [--check]

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(import.meta.dirname);
const HURL_DIR = join(ROOT, "hurl");
const BRUNO_DIR = join(ROOT, "bruno");
const CHECK_MODE = process.argv.includes("--check");

// ─── Parse ──────────────────────────────────────────────────────────────────

function parseHurlFile(filePath) {
  const lines = readFileSync(filePath, "utf-8").split("\n");
  const requests = [];
  let current = null;
  let state = "IDLE";
  let bodyLines = [];
  let braceDepth = 0;

  function finishBody() {
    if (current && bodyLines.length > 0) {
      current.body = bodyLines.join("\n");
      bodyLines = [];
      braceDepth = 0;
    }
  }

  function pushCurrent() {
    if (current) {
      finishBody();
      if (current.method) {
        requests.push(current);
      }
      current = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line
    if (trimmed === "") {
      if (state === "BODY") {
        // blank lines inside JSON are kept
        bodyLines.push(line);
      }
      continue;
    }

    // Comment line — starts a new request logically (captured for naming)
    if (trimmed.startsWith("#") && state !== "BODY") {
      pushCurrent();
      current = {
        comment: trimmed.replace(/^#\s*/, ""),
        method: null,
        url: null,
        headers: {},
        body: null,
        statusCode: null,
        asserts: [],
        captures: [],
      };
      state = "IDLE";
      continue;
    }

    // Method line (GET, POST, PUT, DELETE, PATCH)
    const methodMatch = trimmed.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(.+)$/);
    if (methodMatch && state !== "BODY") {
      if (current && current.method) {
        // Back-to-back request: push completed request, start new without comment
        pushCurrent();
        current = {
          comment: null,
          method: null,
          url: null,
          headers: {},
          body: null,
          statusCode: null,
          asserts: [],
          captures: [],
        };
      } else if (!current) {
        current = {
          comment: null,
          method: null,
          url: null,
          headers: {},
          body: null,
          statusCode: null,
          asserts: [],
          captures: [],
        };
      }
      current.method = methodMatch[1];
      current.url = methodMatch[2];
      state = "HEADERS";
      continue;
    }

    // Header line (Key: Value) — only when in HEADERS state
    if (state === "HEADERS") {
      const headerMatch = trimmed.match(/^([A-Za-z][\w-]*)\s*:\s*(.+)$/);
      if (headerMatch) {
        current.headers[headerMatch[1]] = headerMatch[2];
        continue;
      }
    }

    // Start of JSON body
    if (trimmed === "{" && (state === "HEADERS" || state === "IDLE")) {
      state = "BODY";
      bodyLines = [line];
      braceDepth = 1;
      continue;
    }

    // Inside JSON body
    if (state === "BODY") {
      bodyLines.push(line);
      for (const ch of trimmed) {
        if (ch === "{") braceDepth++;
        else if (ch === "}") braceDepth--;
      }
      if (braceDepth === 0) {
        finishBody();
        state = "IDLE";
      }
      continue;
    }

    // HTTP status line
    const statusMatch = trimmed.match(/^HTTP\s+(\d+)$/);
    if (statusMatch) {
      current.statusCode = parseInt(statusMatch[1], 10);
      state = "RESPONSE";
      continue;
    }

    // Sections
    if (trimmed === "[Asserts]") {
      state = "ASSERTS";
      continue;
    }
    if (trimmed === "[Captures]") {
      state = "CAPTURES";
      continue;
    }

    // Captures
    if (state === "CAPTURES") {
      const captureMatch = trimmed.match(/^(\w+)\s*:\s*jsonpath\s+"(.+)"$/);
      if (captureMatch) {
        current.captures.push({ name: captureMatch[1], jsonpath: captureMatch[2] });
      }
      continue;
    }

    // Asserts
    if (state === "ASSERTS") {
      current.asserts.push(trimmed);
      continue;
    }
  }

  pushCurrent();
  return requests;
}

// ─── Transform ──────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function folderName(filename) {
  return basename(filename, ".hurl").replace(/_/g, "-");
}

function fileName(request, index, method, url) {
  const nn = String(index + 1).padStart(2, "0");
  let slug;
  if (request.comment) {
    slug = slugify(request.comment);
  } else {
    // derive from method + last path segment
    const pathEnd = url.split("/").pop().split("?")[0] || "request";
    slug = slugify(`${method}-${pathEnd}`);
  }
  return `${nn}-${slug}.bru`;
}

function jsonpathToJs(jp) {
  // Convert jsonpath like "$.user.username" to "res.body.user.username"
  let path = jp;
  if (path.startsWith("$.")) {
    path = path.slice(2);
  }
  return `res.body.${path}`;
}

function jsonpathToPropertyCheck(jp) {
  // For "not exists" checks: split into parent path and property name
  // e.g. "$.articles[0].body" -> { parent: "res.body.articles[0]", prop: "body" }
  let path = jp;
  if (path.startsWith("$.")) {
    path = path.slice(2);
  }
  const lastDot = path.lastIndexOf(".");
  if (lastDot === -1) {
    return { parent: "res.body", prop: path };
  }
  return {
    parent: `res.body.${path.slice(0, lastDot)}`,
    prop: path.slice(lastDot + 1),
  };
}

function transformValue(rawValue) {
  // Handle template variables in values
  // "auth_{{uid}}" -> "auth_" + bru.getVar("uid")
  // "{{slug}}" -> bru.getVar("slug")
  // {{comment_id}} (bare var) -> bru.getVar("comment_id")

  if (rawValue === "null") return { expr: "null", isNull: true };
  if (rawValue === "true") return { expr: "true", isLiteral: true };
  if (rawValue === "false") return { expr: "false", isLiteral: true };
  if (/^-?\d+$/.test(rawValue)) return { expr: rawValue, isLiteral: true };
  if (/^-?\d+\.\d+$/.test(rawValue)) return { expr: rawValue, isLiteral: true };

  // Bare variable like {{comment_id}}
  const bareVarMatch = rawValue.match(/^\{\{(\w+)\}\}$/);
  if (bareVarMatch) {
    return { expr: `bru.getVar("${bareVarMatch[1]}")`, isLiteral: true };
  }

  // Quoted string
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    const inner = rawValue.slice(1, -1);

    // Check if it's purely a variable "{{slug}}"
    const pureVarMatch = inner.match(/^\{\{(\w+)\}\}$/);
    if (pureVarMatch) {
      return { expr: `bru.getVar("${pureVarMatch[1]}")`, isLiteral: true };
    }

    // Check if it contains template variables mixed with text
    if (inner.includes("{{")) {
      // Split by template vars and build concatenation
      const parts = [];
      let remaining = inner;
      while (remaining.length > 0) {
        const varIdx = remaining.indexOf("{{");
        if (varIdx === -1) {
          parts.push(`"${remaining}"`);
          break;
        }
        if (varIdx > 0) {
          parts.push(`"${remaining.slice(0, varIdx)}"`);
        }
        const endIdx = remaining.indexOf("}}", varIdx);
        const varName = remaining.slice(varIdx + 2, endIdx);
        parts.push(`bru.getVar("${varName}")`);
        remaining = remaining.slice(endIdx + 2);
      }
      return { expr: parts.join(" + "), isLiteral: true };
    }

    // Plain quoted string
    return { expr: rawValue, isLiteral: true };
  }

  return { expr: rawValue, isLiteral: true };
}

function assertToJs(assertLine) {
  // jsonpath "$.x.y" == "val"
  // jsonpath "$.x" isString
  // jsonpath "$.x" count == 1
  // jsonpath "$.x.*" count == 4
  // jsonpath "$[?count($.*) == 1]" exists
  // jsonpath "$.x" contains "val"
  // jsonpath "$.x" not isEmpty
  // jsonpath "$.x" not exists
  // jsonpath "$.x" matches "regex"

  const jpMatch = assertLine.match(/^jsonpath\s+"([^"]+)"\s+(.+)$/);
  if (!jpMatch) throw new Error(`Unhandled hurl assert (not jsonpath): ${assertLine}`);

  const jp = jpMatch[1];
  const rest = jpMatch[2].trim();

  // Exact number of keys of a single-key object: "$[?count($.*) == 1]" exists
  // (Hurl unwraps a one-element result, so "$.*" count == 1 can't express this)
  const keyCountMatch = jp.match(/^\$\[\?count\(\$\.\*\) == (\d+)\]$/);
  if (keyCountMatch && rest === "exists") {
    return `expect(Object.keys(res.body).length).to.eql(${keyCountMatch[1]});`;
  }

  // count == N or count >= N
  const countMatch = rest.match(/^count\s+(==|>=)\s+(.+)$/);
  if (countMatch) {
    const op = countMatch[1];
    const val = countMatch[2].trim();
    // "$.x.*" count == N: exact number of keys of the object at $.x
    if (jp === "$.*" || jp.endsWith(".*")) {
      if (op !== "==") throw new Error(`Unhandled hurl assert: ${assertLine}`);
      const objPath = jp === "$.*" ? "res.body" : jsonpathToJs(jp.slice(0, -2));
      return `expect(Object.keys(${objPath}).length).to.eql(${transformValue(val).expr});`;
    }
    const jsPath = jsonpathToJs(jp);
    const transformed = transformValue(val);
    if (op === "==") {
      return `expect(${jsPath}.length).to.eql(${transformed.expr});`;
    } else if (op === ">=") {
      return `expect(${jsPath}.length).to.be.at.least(${transformed.expr});`;
    }
  }

  // not exists
  if (rest === "not exists") {
    const { parent, prop } = jsonpathToPropertyCheck(jp);
    return `expect(${parent}).to.not.have.property("${prop}");`;
  }

  // not isEmpty
  if (rest === "not isEmpty") {
    const jsPath = jsonpathToJs(jp);
    return `expect(${jsPath}).to.not.eql("");`;
  }

  // isString
  if (rest === "isString") {
    const jsPath = jsonpathToJs(jp);
    return `expect(typeof ${jsPath}).to.eql("string");`;
  }

  // isInteger
  if (rest === "isInteger") {
    const jsPath = jsonpathToJs(jp);
    return `expect(Number.isInteger(${jsPath})).to.eql(true);`;
  }

  // isCollection (matches both arrays and objects)
  if (rest === "isCollection") {
    const jsPath = jsonpathToJs(jp);
    return `expect(${jsPath}).to.not.be.null; expect(typeof ${jsPath}).to.eql("object");`;
  }

  // isList (arrays only)
  if (rest === "isList") {
    const jsPath = jsonpathToJs(jp);
    return `expect(Array.isArray(${jsPath})).to.eql(true);`;
  }

  // isObject (objects only, not arrays)
  if (rest === "isObject") {
    const jsPath = jsonpathToJs(jp);
    return `expect(${jsPath}).to.not.be.null; expect(typeof ${jsPath}).to.eql("object"); expect(Array.isArray(${jsPath})).to.eql(false);`;
  }

  // isBoolean
  if (rest === "isBoolean") {
    const jsPath = jsonpathToJs(jp);
    return `expect(typeof ${jsPath}).to.eql("boolean");`;
  }

  // contains "val" or contains bareVar
  const containsMatch = rest.match(/^contains\s+(.+)$/);
  if (containsMatch) {
    const jsPath = jsonpathToJs(jp);
    const rawVal = containsMatch[1].trim();
    const val = transformValue(rawVal);
    return `expect(${jsPath}).to.include(${val.expr});`;
  }

  // matches "regex"
  // Hurl regex is a string where \\ means a literal backslash, so \\d means \d (digit shorthand).
  // JS regex literals don't need that extra escaping: /\d/ is already the digit shorthand.
  const matchesMatch = rest.match(/^matches\s+"([^"]*)"$/);
  if (matchesMatch) {
    const jsPath = jsonpathToJs(jp);
    const regexBody = matchesMatch[1].replace(/\\\\/g, "\\");
    return `expect(${jsPath}).to.match(/${regexBody}/);`;
  }

  // ==, !=, or >= with value
  const opMatch = rest.match(/^(==|!=|>=)\s+(.+)$/);
  if (opMatch) {
    const op = opMatch[1];
    const rawVal = opMatch[2].trim();
    const jsPath = jsonpathToJs(jp);
    const val = transformValue(rawVal);

    if (op === "==") {
      if (val.isNull) {
        return `expect(${jsPath}).to.be.null;`;
      }
      return `expect(${jsPath}).to.eql(${val.expr});`;
    } else if (op === "!=") {
      if (val.isNull) {
        return `expect(${jsPath}).to.not.be.null;`;
      }
      return `expect(${jsPath}).to.not.eql(${val.expr});`;
    } else if (op === ">=") {
      return `expect(${jsPath}).to.be.at.least(${val.expr});`;
    }
  }

  throw new Error(`Unhandled hurl assert: ${assertLine}`);
}

// ─── Generate ───────────────────────────────────────────────────────────────

function generateBruFile(request, seq) {
  const sections = [];

  // Meta
  const name = request.comment || `${request.method} ${request.url.split("/").pop()}`;
  sections.push(`meta {
  name: ${name}
  type: http
  seq: ${seq}
}`);

  // Request
  const hasBody = request.body !== null;
  const bodyType = hasBody ? "json" : "none";
  sections.push(`${request.method.toLowerCase()} {
  url: ${request.url}
  body: ${bodyType}
  auth: none
}`);

  // Headers
  const headerEntries = Object.entries(request.headers);
  if (headerEntries.length > 0) {
    const headerLines = headerEntries.map(([k, v]) => `  ${k}: ${v}`).join("\n");
    sections.push(`headers {\n${headerLines}\n}`);
  }

  // Body
  // Indent JSON body by 2 spaces so that closing braces don't appear at column 1,
  // which the .bru parser would mistake for the block-closing brace.
  if (hasBody) {
    const indentedBody = request.body.split("\n").map((l) => (l.trim() ? "  " + l : l)).join("\n");
    sections.push(`body:json {\n${indentedBody}\n}`);
  }

  // Assert (status code)
  if (request.statusCode !== null) {
    sections.push(`assert {\n  res.status: eq ${request.statusCode}\n}`);
  }

  // Script: post-response (captures + assertions)
  const scriptLines = [];

  for (const capture of request.captures) {
    // Convert jsonpath to JS dotpath
    let dotpath = capture.jsonpath;
    if (dotpath.startsWith("$.")) dotpath = dotpath.slice(2);
    scriptLines.push(`bru.setVar("${capture.name}", res.body.${dotpath});`);
  }

  for (const assertLine of request.asserts) {
    scriptLines.push(assertToJs(assertLine));
  }

  if (scriptLines.length > 0) {
    const body = scriptLines.map((l) => `  ${l}`).join("\n");
    sections.push(`script:post-response {\n${body}\n}`);
  }

  return sections.join("\n\n") + "\n";
}

function generateCollection(outputDir) {
  mkdirSync(outputDir, { recursive: true });

  // bruno.json
  writeFileSync(
    join(outputDir, "bruno.json"),
    JSON.stringify(
      {
        version: "1",
        name: "RealWorld API",
        type: "collection",
      },
      null,
      2
    ) + "\n"
  );

  // collection.bru — collection-level pre-request
  writeFileSync(
    join(outputDir, "collection.bru"),
    `script:pre-request {
  if (!bru.getVar("uid")) {
    bru.setVar("uid", Date.now().toString() + Math.random().toString(36).substring(2, 6));
  }
}
`
  );

  // environments/local.bru
  const envDir = join(outputDir, "environments");
  mkdirSync(envDir, { recursive: true });
  writeFileSync(
    join(envDir, "local.bru"),
    `vars {
  host: http://localhost:3000
}
`
  );

  // Process each hurl file
  const hurlFiles = readdirSync(HURL_DIR)
    .filter((f) => f.endsWith(".hurl"))
    .sort();

  for (const hurlFile of hurlFiles) {
    const filePath = join(HURL_DIR, hurlFile);
    const requests = parseHurlFile(filePath);
    const folder = folderName(hurlFile);
    const folderPath = join(outputDir, folder);
    mkdirSync(folderPath, { recursive: true });

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      const bruFileName = fileName(req, i, req.method, req.url);
      const bruContent = generateBruFile(req, i + 1);
      writeFileSync(join(folderPath, bruFileName), bruContent);
    }
  }
}

// ─── Check Mode ─────────────────────────────────────────────────────────────

function collectFiles(dir, prefix = "") {
  const result = {};
  if (!existsSync(dir)) return result;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      Object.assign(result, collectFiles(join(dir, entry.name), relPath));
    } else {
      result[relPath] = readFileSync(join(dir, entry.name), "utf-8");
    }
  }
  return result;
}

function checkMode() {
  const tempDir = join(tmpdir(), `bruno-check-${Date.now()}`);
  try {
    generateCollection(tempDir);
    const expected = collectFiles(tempDir);
    const actual = collectFiles(BRUNO_DIR);

    const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    const diffs = [];

    for (const key of [...allKeys].sort()) {
      if (!(key in actual)) {
        diffs.push(`  missing: ${key}`);
      } else if (!(key in expected)) {
        diffs.push(`  extra:   ${key}`);
      } else if (expected[key] !== actual[key]) {
        diffs.push(`  changed: ${key}`);
      }
    }

    if (diffs.length > 0) {
      console.error("Bruno collection is out of sync with Hurl files:\n" + diffs.join("\n"));
      console.error("\nRun `bun api/hurl-to-bruno.js` to regenerate.");
      process.exit(1);
    }

    console.log("Bruno collection is up to date.");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

if (CHECK_MODE) {
  checkMode();
} else {
  // Clean and regenerate
  if (existsSync(BRUNO_DIR)) {
    rmSync(BRUNO_DIR, { recursive: true });
  }
  generateCollection(BRUNO_DIR);

  // Count generated files
  const files = collectFiles(BRUNO_DIR);
  console.log(`Generated ${Object.keys(files).length} files in api/bruno/`);
}
