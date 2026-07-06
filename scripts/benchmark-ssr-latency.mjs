#!/usr/bin/env node
/**
 * Measure HTTP latency for Connect/Account routes (dev vs start comparison).
 * Usage: node scripts/benchmark-ssr-latency.mjs [--label dev|start]
 */

import net from "node:net";

const label = readLabel();
const rounds = 3;

const TARGETS = [
  { name: "connect-discovery", url: "http://127.0.0.1:3000/.well-known/openid-configuration" },
  { name: "connect-login", url: "http://127.0.0.1:3000/login" },
  { name: "connect-api-login-get", url: "http://127.0.0.1:3000/api/login" },
  { name: "account-login", url: "http://127.0.0.1:3002/login" },
];

async function main() {
  await waitForPort("127.0.0.1", 3000, 180_000);
  await waitForPort("127.0.0.1", 3002, 180_000);

  const results = [];

  for (const target of TARGETS) {
    const cold = await measure(target.url);
    const warm = [];
    for (let i = 0; i < rounds; i += 1) {
      warm.push(await measure(target.url));
    }
    results.push({
      name: target.name,
      coldMs: cold.ms,
      coldStatus: cold.status,
      warmMs: warm.map((item) => item.ms),
      warmAvgMs: average(warm.map((item) => item.ms)),
      warmMinMs: Math.min(...warm.map((item) => item.ms)),
      warmMaxMs: Math.max(...warm.map((item) => item.ms)),
    });
  }

  const payload = {
    label,
    measuredAt: new Date().toISOString(),
    rounds,
    results,
  };

  console.log(JSON.stringify(payload, null, 2));
}

function readLabel() {
  const index = process.argv.indexOf("--label");
  if (index === -1 || !process.argv[index + 1]) {
    return "unknown";
  }
  return process.argv[index + 1];
}

async function waitForPort(host, port, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await probePort(host, port);
      return;
    } catch {
      await sleep(1_000);
    }
  }
  throw new Error(`Timed out waiting for ${host}:${port}`);
}

function probePort(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve();
    });
    socket.setTimeout(2_000);
    socket.on("error", reject);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("timeout"));
    });
  });
}

async function measure(url) {
  const started = performance.now();
  const response = await fetch(url, { method: "GET", redirect: "manual" });
  await response.arrayBuffer();
  const ms = Math.round((performance.now() - started) * 100) / 100;
  return { ms, status: response.status };
}

function average(values) {
  if (values.length === 0) return 0;
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});