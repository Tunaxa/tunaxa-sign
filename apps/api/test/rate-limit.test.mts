import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import {
  hashToken,
  LOGIN_RATE_LIMIT_MAX,
  SIGNING_IP_RATE_LIMIT_MAX,
  SIGNING_TOKEN_RATE_LIMIT_MAX,
  UnauthorizedError,
} from "@axa-sign/shared";
import { getRedisConnection } from "@axa-sign/queue";
import { app } from "../src/app.js";
import {
  loginLimiter,
  signingIpLimiter,
  signingTokenLimiter,
} from "../src/middleware/rate-limit.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { SigningService } from "../src/modules/signing/signing.service.js";

async function startServer() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
      const redis = getRedisConnection();
      await redis.quit().catch(() => redis.disconnect());
    },
  };
}

function resetIpKeys(ips: string[]) {
  for (const ip of ips) {
    signingIpLimiter.resetKey(ip);
    loginLimiter.resetKey(ip);
  }
}

test("AXS-012: public route rate limiting", async (t) => {
  const server = await startServer();
  t.after(() => server.close());

  t.mock.method(SigningService.prototype, "getSession", async () => ({
    id: "session-1",
    status: "AUTHENTICATED",
  }));

  await t.test("requests under the limit succeed", async (t) => {
    const ip = "198.51.100.1";
    const token = "raw-token-under-limit";
    t.after(() => {
      resetIpKeys([ip]);
      signingTokenLimiter.resetKey(hashToken(token));
    });

    const res = await fetch(`${server.baseUrl}/api/v1/signing/session/${token}`, {
      headers: { "X-Forwarded-For": ip },
    });
    assert.equal(res.status, 200);
  });

  await t.test(
    "per-IP limit on /signing/* blocks an IP sending many requests with different tokens with 429 and Retry-After",
    async (t) => {
      const ip = "198.51.100.2";
      const tokens: string[] = [];
      t.after(() => {
        resetIpKeys([ip]);
        for (const tok of tokens) {
          signingTokenLimiter.resetKey(hashToken(tok));
        }
      });

      for (let i = 0; i < SIGNING_IP_RATE_LIMIT_MAX; i++) {
        const tok = `distinct-token-${i}`;
        tokens.push(tok);
        const res = await fetch(
          `${server.baseUrl}/api/v1/signing/session/${tok}`,
          { headers: { "X-Forwarded-For": ip } }
        );
        assert.equal(res.status, 200);
      }

      const overToken = "distinct-token-over";
      tokens.push(overToken);
      const blocked = await fetch(
        `${server.baseUrl}/api/v1/signing/session/${overToken}`,
        { headers: { "X-Forwarded-For": ip } }
      );
      assert.equal(blocked.status, 429);
      assert.ok(blocked.headers.get("retry-after"));
      const body = (await blocked.json()) as { error: string; code: string };
      assert.equal(body.code, "RATE_LIMIT_EXCEEDED");
    }
  );

  await t.test(
    "per-token limit gets 429 even when the IP differs, and uses hashed token key",
    async (t) => {
      const token = "hammered-secret-token";
      const ips: string[] = [];
      t.after(() => {
        resetIpKeys(ips);
        signingTokenLimiter.resetKey(hashToken(token));
      });

      for (let i = 0; i < SIGNING_TOKEN_RATE_LIMIT_MAX; i++) {
        const ip = `203.0.113.${(i % 250) + 1}`;
        ips.push(ip);
        const res = await fetch(
          `${server.baseUrl}/api/v1/signing/session/${token}`,
          { headers: { "X-Forwarded-For": ip } }
        );
        assert.equal(res.status, 200);
      }

      const finalIp = "203.0.113.254";
      ips.push(finalIp);
      const blocked = await fetch(
        `${server.baseUrl}/api/v1/signing/session/${token}`,
        { headers: { "X-Forwarded-For": finalIp } }
      );
      assert.equal(blocked.status, 429);
      assert.ok(blocked.headers.get("retry-after"));
      const body = (await blocked.json()) as { error: string; code: string };
      assert.equal(body.code, "RATE_LIMIT_EXCEEDED");
    }
  );

  await t.test(
    "one token being limited does not block a different token from the same IP",
    async (t) => {
      const ip = "198.51.100.3";
      const limitedToken = "limited-token-1";
      const otherToken = "other-token-2";
      t.after(() => {
        resetIpKeys([ip]);
        signingTokenLimiter.resetKey(hashToken(limitedToken));
        signingTokenLimiter.resetKey(hashToken(otherToken));
      });

      for (let i = 0; i < SIGNING_TOKEN_RATE_LIMIT_MAX; i++) {
        const res = await fetch(
          `${server.baseUrl}/api/v1/signing/session/${limitedToken}`,
          { headers: { "X-Forwarded-For": ip } }
        );
        assert.equal(res.status, 200);
      }

      const blocked = await fetch(
        `${server.baseUrl}/api/v1/signing/session/${limitedToken}`,
        { headers: { "X-Forwarded-For": ip } }
      );
      assert.equal(blocked.status, 429);

      const allowed = await fetch(
        `${server.baseUrl}/api/v1/signing/session/${otherToken}`,
        { headers: { "X-Forwarded-For": ip } }
      );
      assert.equal(allowed.status, 200);
    }
  );

  await t.test(
    "POST /auth/login gets 429 after its stricter limit on failed attempts",
    async (t) => {
      const ip = "198.51.100.4";
      t.after(() => resetIpKeys([ip]));

      let shouldSucceed = true;
      t.mock.method(AuthService.prototype, "login", async () => {
        if (!shouldSucceed) {
          throw new UnauthorizedError("Invalid credentials");
        }
        return { accessToken: "ok", refreshToken: "ok" };
      });

      // Successful logins are skipped (skipSuccessfulRequests: true)
      for (let i = 0; i < LOGIN_RATE_LIMIT_MAX + 2; i++) {
        const res = await fetch(`${server.baseUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": ip,
          },
          body: JSON.stringify({ email: "a@b.com", password: "correct" }),
        });
        assert.equal(res.status, 200);
      }

      // Failed logins count toward the limit
      shouldSucceed = false;
      for (let i = 0; i < LOGIN_RATE_LIMIT_MAX; i++) {
        const res = await fetch(`${server.baseUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": ip,
          },
          body: JSON.stringify({ email: "a@b.com", password: "wrong" }),
        });
        assert.equal(res.status, 401);
      }

      const blocked = await fetch(`${server.baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": ip,
        },
        body: JSON.stringify({ email: "a@b.com", password: "wrong" }),
      });
      assert.equal(blocked.status, 429);
      assert.ok(blocked.headers.get("retry-after"));
      const body = (await blocked.json()) as { error: string; code: string };
      assert.equal(body.code, "RATE_LIMIT_EXCEEDED");
    }
  );

  await t.test(
    "global /api limiter skips /signing and /auth/login and returns standard 429 + Retry-After on other /api routes",
    async (t) => {
      const ip = "198.51.100.5";
      const token = "global-skip-token";
      t.after(() => {
        resetIpKeys([ip]);
        signingTokenLimiter.resetKey(hashToken(token));
      });

      t.mock.method(AuthService.prototype, "login", async () => ({
        accessToken: "ok",
        refreshToken: "ok",
      }));

      // Send requests to /signing and POST /auth/login from the same IP
      for (let i = 0; i < 5; i++) {
        const signRes = await fetch(
          `${server.baseUrl}/api/v1/signing/session/${token}`,
          { headers: { "X-Forwarded-For": ip } }
        );
        assert.equal(signRes.status, 200);

        const loginRes = await fetch(`${server.baseUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": ip,
          },
          body: JSON.stringify({ email: "a@b.com", password: "correct" }),
        });
        assert.equal(loginRes.status, 200);
      }

      // First hit on another /api route should have remaining = 99 (100 - 1), proving the 10 requests above were skipped
      const firstGlobal = await fetch(`${server.baseUrl}/api/v1/auth/me`, {
        headers: { "X-Forwarded-For": ip },
      });
      assert.equal(firstGlobal.status, 401);
      assert.equal(firstGlobal.headers.get("ratelimit-limit"), "100");
      assert.equal(firstGlobal.headers.get("ratelimit-remaining"), "99");

      // Exhaust the remaining 99 requests of the global /api limiter
      for (let i = 0; i < 99; i++) {
        const res = await fetch(`${server.baseUrl}/api/v1/auth/me`, {
          headers: { "X-Forwarded-For": ip },
        });
        assert.equal(res.status, 401);
      }

      const blocked = await fetch(`${server.baseUrl}/api/v1/auth/me`, {
        headers: { "X-Forwarded-For": ip },
      });
      assert.equal(blocked.status, 429);
      assert.ok(blocked.headers.get("retry-after"));
      const body = (await blocked.json()) as { error: string; code: string };
      assert.ok(body.error);
      assert.equal(body.code, "RATE_LIMIT_EXCEEDED");
    }
  );
});
