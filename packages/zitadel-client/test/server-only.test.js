import assert from "node:assert/strict";
import test from "node:test";

test("server-only guard rejects browser-like global scope", async () => {
  const previousWindow = globalThis.window;
  globalThis.window = { document: {} };

  try {
    await assert.rejects(
      async () => {
        await import(`../src/server-only.js?guard=${Date.now()}`);
      },
      /server-only/
    );
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
});