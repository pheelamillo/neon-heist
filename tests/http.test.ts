import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { assertSameOrigin } from "../src/lib/server/http";

test("origin checks accept localhost and LAN origins when Next binds to 0.0.0.0", () => {
  for (const host of ["localhost:3000", "127.0.0.1:3000", "192.168.1.42:3000"]) {
    assert.doesNotThrow(() => assertSameOrigin(new NextRequest("http://0.0.0.0:3000/api/session", {
      method: "POST", headers: { host, origin: `http://${host}`, "sec-fetch-site": "same-origin" },
    })));
  }
});

test("unrelated origins, null origins, wrong schemes, and cross-site fetches remain blocked", () => {
  for (const origin of ["https://evil.example", "http://localhost:3001", "https://localhost:3000", "null", "garbage", "http://localhost:3000.evil.example"]) {
    assert.throws(() => assertSameOrigin(new NextRequest("http://0.0.0.0:3000/api/session", {
      headers: { host: "localhost:3000", origin },
    })), /Cross-site/);
  }
  assert.throws(() => assertSameOrigin(new NextRequest("http://localhost:3000/api/session", {
    headers: { host: "localhost:3000", "sec-fetch-site": "cross-site" },
  })), /Cross-site/);
});

test("nonbrowser requests without an origin still require API authentication separately", () => {
  assert.doesNotThrow(() => assertSameOrigin(new NextRequest("http://localhost:3000/api/session")));
});
