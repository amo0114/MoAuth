import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { startRegistrationReviewReconcileLoop } from "./src/registration-review/reconcile.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const configuredPort = Number.parseInt(process.env.PORT || "3002", 10);
const port = Number.isFinite(configuredPort) ? configuredPort : 3002;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
let registrationReviewReconcileLoop = null;
let httpServer = null;

app.prepare().then(() => {
  httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    registrationReviewReconcileLoop = startRegistrationReviewReconcileLoop();
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

function stopBackgroundJobs() {
  registrationReviewReconcileLoop?.stop();
}

function shutdown(signal) {
  stopBackgroundJobs();
  if (!httpServer) {
    process.exit(0);
  }

  const forcedExit = setTimeout(() => {
    console.error(`[Account] forced shutdown after ${signal}`);
    process.exit(1);
  }, 5_000);
  forcedExit.unref?.();

  httpServer.close(() => {
    clearTimeout(forcedExit);
    process.exit(0);
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
