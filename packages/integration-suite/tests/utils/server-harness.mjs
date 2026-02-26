import { PassThrough, Writable } from "node:stream";

class MockResponse extends Writable {
  constructor(resolve) {
    super();
    this.statusCode = 200;
    this.headers = {};
    this.chunks = [];
    this._resolve = resolve;
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }

  setHeader(name, value) {
    this.headers[String(name).toLowerCase()] = String(value);
  }

  getHeader(name) {
    return this.headers[String(name).toLowerCase()];
  }

  end(chunk) {
    if (chunk !== undefined) {
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const raw = Buffer.concat(this.chunks).toString("utf8");
    let payload = {};
    if (raw.trim().length > 0) {
      payload = JSON.parse(raw);
    }

    this._resolve({
      status: this.statusCode,
      headers: this.headers,
      payload,
      raw
    });
  }
}

function normalizeHeaders(headers = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }

  if (!normalized.host) {
    normalized.host = "localhost";
  }

  return normalized;
}

export async function invokeJson(server, { method = "GET", path = "/", headers = {}, body }) {
  const req = new PassThrough();
  req.method = method;
  req.url = path;
  req.headers = normalizeHeaders(headers);

  const responsePromise = new Promise((resolve) => {
    const res = new MockResponse(resolve);
    server.emit("request", req, res);
  });

  if (body !== undefined) {
    req.write(JSON.stringify(body));
  }

  req.end();
  return responsePromise;
}

export function disposeServer(server) {
  server.emit("close");
}
