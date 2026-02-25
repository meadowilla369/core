import { createServer, IncomingMessage, ServerResponse } from "node:http";

import type { GatewayConfig } from "./config.js";
import { log } from "./logger.js";

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function safeHeaders(headers: IncomingMessage["headers"]): Record<string, string> {
  const forwarded: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (!value) {
      continue;
    }

    const lower = key.toLowerCase();
    if (lower === "host" || lower === "content-length" || lower === "connection") {
      continue;
    }

    forwarded[key] = Array.isArray(value) ? value.join(",") : value;
  }

  return forwarded;
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

async function proxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: GatewayConfig,
  upstreamBaseUrl: string,
  upstreamName: string,
  pathname: string,
  search: string
): Promise<void> {
  const method = req.method ?? "GET";
  const upstreamPath = pathname.replace(/^\/v1/, "") + search;
  const upstreamUrl = `${upstreamBaseUrl}${upstreamPath}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);

    const upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers: safeHeaders(req.headers),
      body,
      signal: controller.signal
    });

    const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
    res.statusCode = upstreamResponse.status;

    const upstreamContentType = upstreamResponse.headers.get("content-type");
    if (upstreamContentType) {
      res.setHeader("content-type", upstreamContentType);
    }

    res.end(responseBuffer);
  } catch (error) {
    log(config.serviceName, "error", "Failed to proxy request", {
      upstreamName,
      upstreamUrl,
      error: error instanceof Error ? error.message : String(error)
    });

    sendJson(res, 502, {
      success: false,
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: `${upstreamName} unavailable`
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkServiceReady(config: GatewayConfig, serviceName: string, baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}/healthz`, {
      method: "GET",
      signal: controller.signal
    });

    return response.ok;
  } catch {
    log(config.serviceName, "warn", "Readiness check failed", { serviceName, baseUrl });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function createGatewayServer(config: GatewayConfig) {
  return createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (method === "GET" && url.pathname === "/healthz") {
        return sendJson(res, 200, {
          success: true,
          data: {
            service: config.serviceName,
            status: "ok",
            timestamp: new Date().toISOString()
          }
        });
      }

      if (method === "GET" && url.pathname === "/readyz") {
        const [authReady, userReady, kycReady, eventReady] = await Promise.all([
          checkServiceReady(config, "auth-service", config.authServiceBaseUrl),
          checkServiceReady(config, "user-service", config.userServiceBaseUrl),
          checkServiceReady(config, "kyc-service", config.kycServiceBaseUrl),
          checkServiceReady(config, "event-service", config.eventServiceBaseUrl)
        ]);

        const ready = authReady && userReady && kycReady && eventReady;
        return sendJson(res, ready ? 200 : 503, {
          success: ready,
          data: {
            service: config.serviceName,
            authServiceReady: authReady,
            userServiceReady: userReady,
            kycServiceReady: kycReady,
            eventServiceReady: eventReady
          }
        });
      }

      if (url.pathname.startsWith("/v1/auth/")) {
        return proxyRequest(
          req,
          res,
          config,
          config.authServiceBaseUrl,
          "auth-service",
          url.pathname,
          url.search
        );
      }

      if (url.pathname === "/v1/users" || url.pathname.startsWith("/v1/users/")) {
        return proxyRequest(
          req,
          res,
          config,
          config.userServiceBaseUrl,
          "user-service",
          url.pathname,
          url.search
        );
      }

      if (url.pathname.startsWith("/v1/kyc/")) {
        return proxyRequest(
          req,
          res,
          config,
          config.kycServiceBaseUrl,
          "kyc-service",
          url.pathname,
          url.search
        );
      }

      if (url.pathname === "/v1/events" || url.pathname.startsWith("/v1/events/")) {
        return proxyRequest(
          req,
          res,
          config,
          config.eventServiceBaseUrl,
          "event-service",
          url.pathname,
          url.search
        );
      }

      return sendJson(res, 404, {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Route not found"
        }
      });
    } catch (error) {
      log(config.serviceName, "error", "Unhandled request error", {
        error: error instanceof Error ? error.message : String(error)
      });

      return sendJson(res, 500, {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error"
        }
      });
    }
  });
}
