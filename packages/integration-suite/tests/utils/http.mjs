import assert from "node:assert/strict";

export async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  return {
    status: response.status,
    ok: response.ok,
    payload
  };
}

export async function expectSuccess(baseUrl, path, options = {}) {
  const result = await requestJson(baseUrl, path, options);
  assert.equal(result.ok, true, `Expected success for ${path}, got ${result.status}: ${JSON.stringify(result.payload)}`);
  assert.equal(result.payload.success, true, `Expected success payload for ${path}`);
  return result.payload.data;
}

export async function expectStatus(baseUrl, path, status, options = {}) {
  const result = await requestJson(baseUrl, path, options);
  assert.equal(result.status, status, `Expected status ${status} for ${path}, got ${result.status}`);
  return result.payload;
}
