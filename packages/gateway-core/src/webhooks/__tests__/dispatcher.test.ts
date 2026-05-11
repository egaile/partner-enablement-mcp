import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  WebhookDispatcher,
  type WebhooksPort,
} from "../dispatcher.js";
import type { WebhookRecord } from "../../storage/types.js";

const TENANT = "00000000-0000-0000-0000-000000000001";

function webhook(overrides?: Partial<WebhookRecord>): WebhookRecord {
  return {
    id: "wh-1",
    tenantId: TENANT,
    url: "https://hooks.example.com/test",
    secret: "shh",
    events: ["server_error"],
    enabled: true,
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makePort(records: WebhookRecord[] = []): WebhooksPort {
  return {
    async listByEvent(_tenantId, event) {
      return records.filter((r) => r.events.includes(event) && r.enabled);
    },
    async get(id, tenantId) {
      return (
        records.find((r) => r.id === id && r.tenantId === tenantId) ?? null
      );
    },
  };
}

describe("WebhookDispatcher", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("SSRF allowlist (default: allowLoopback=false)", () => {
    const blockedHosts = [
      "http://127.0.0.1/hook",
      "http://localhost/hook",
      "http://localhost.localdomain/hook",
      "http://10.0.0.5/hook", // 10.0.0.0/8
      "http://172.16.0.1/hook", // 172.16.0.0/12 lower
      "http://172.31.255.255/hook", // 172.16.0.0/12 upper
      "http://192.168.1.1/hook", // 192.168.0.0/16
      "http://169.254.169.254/latest/meta-data", // AWS metadata
      "http://0.0.0.0/hook",
      "http://[::1]/hook",
      "file:///etc/passwd",
      "ftp://example.com/x",
    ];

    for (const url of blockedHosts) {
      it(`rejects ${url}`, async () => {
        const dispatcher = new WebhookDispatcher({
          webhooks: makePort([webhook({ url })]),
        });
        await dispatcher.dispatch(TENANT, "server_error", { x: 1 });
        // Should never call fetch — the URL is rejected at the gate.
        expect(fetchMock).not.toHaveBeenCalled();
      });
    }

    it("permits public https hosts", async () => {
      const dispatcher = new WebhookDispatcher({
        webhooks: makePort([webhook({ url: "https://hooks.slack.com/x" })]),
      });
      await dispatcher.dispatch(TENANT, "server_error", { x: 1 });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    });

    it("permits 172.32+ (outside the 172.16/12 reserved range)", async () => {
      const dispatcher = new WebhookDispatcher({
        webhooks: makePort([webhook({ url: "http://172.32.0.1/hook" })]),
      });
      await dispatcher.dispatch(TENANT, "server_error", { x: 1 });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    });
  });

  describe("allowLoopback opt-in", () => {
    it("permits 127.0.0.1 when allowLoopback=true", async () => {
      const dispatcher = new WebhookDispatcher({
        webhooks: makePort([webhook({ url: "http://127.0.0.1:9999/hook" })]),
        allowLoopback: true,
      });
      await dispatcher.dispatch(TENANT, "server_error", { x: 1 });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    });
  });

  describe("payload + signature", () => {
    it("posts {event, timestamp, data} with X-Webhook-Signature header", async () => {
      const w = webhook({
        secret: "supersecret",
        events: ["injection_detected"],
      });
      const dispatcher = new WebhookDispatcher({ webhooks: makePort([w]) });

      await dispatcher.dispatch(TENANT, "injection_detected", {
        serverId: "s-1",
        toolName: "deleteResource",
      });

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(w.url);
      expect(init.method).toBe("POST");
      expect(init.headers["Content-Type"]).toBe("application/json");

      const body = init.body as string;
      const parsed = JSON.parse(body);
      expect(parsed.event).toBe("injection_detected");
      expect(parsed.data.toolName).toBe("deleteResource");
      expect(typeof parsed.timestamp).toBe("string");

      const expected = createHmac("sha256", w.secret)
        .update(body)
        .digest("hex");
      expect(init.headers["X-Webhook-Signature"]).toBe(expected);
    });

    it("fan-outs to every subscribed webhook", async () => {
      const dispatcher = new WebhookDispatcher({
        webhooks: makePort([
          webhook({ id: "wh-1", url: "https://a.example/hook" }),
          webhook({ id: "wh-2", url: "https://b.example/hook" }),
          webhook({
            id: "wh-3",
            url: "https://c.example/hook",
            events: ["other"],
          }),
        ]),
      });

      await dispatcher.dispatch(TENANT, "server_error", {});

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      const urls = fetchMock.mock.calls.map((c) => c[0]);
      expect(urls).toContain("https://a.example/hook");
      expect(urls).toContain("https://b.example/hook");
      expect(urls).not.toContain("https://c.example/hook");
    });

    it("a 5xx response from one subscriber doesn't stop the others", async () => {
      fetchMock
        .mockResolvedValueOnce(new Response("oops", { status: 500 }))
        .mockResolvedValueOnce(new Response("ok", { status: 200 }));
      const dispatcher = new WebhookDispatcher({
        webhooks: makePort([
          webhook({ id: "wh-1", url: "https://broken.example/hook" }),
          webhook({ id: "wh-2", url: "https://ok.example/hook" }),
        ]),
      });

      await dispatcher.dispatch(TENANT, "server_error", {});

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    });
  });

  describe("sendTestEvent", () => {
    it("delivers a synthetic test payload", async () => {
      const dispatcher = new WebhookDispatcher({
        webhooks: makePort([webhook()]),
      });
      await dispatcher.sendTestEvent("wh-1", TENANT);

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.event).toBe("test");
      expect(body.data.message).toMatch(/test event/i);
    });

    it("throws when the webhook id is unknown", async () => {
      const dispatcher = new WebhookDispatcher({ webhooks: makePort([]) });
      await expect(
        dispatcher.sendTestEvent("no-such-id", TENANT)
      ).rejects.toThrow(/not found/i);
    });
  });
});
