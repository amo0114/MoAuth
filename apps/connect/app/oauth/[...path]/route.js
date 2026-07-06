import { isZitadelConfigured } from "../../../src/config/zitadel.js";
import { proxyToZitadel } from "../../../src/oidc/proxy-node.js";

function notConfigured() {
  return Response.json(
    {
      error: {
        code: "ZITADEL_NOT_CONFIGURED",
        message: "Identity core is not configured. Set ZITADEL_* env vars before proxying OIDC endpoints.",
      },
    },
    { status: 503 }
  );
}

async function handle(request) {
  if (!isZitadelConfigured()) {
    return notConfigured();
  }
  return proxyToZitadel(request);
}

export async function GET(request) {
  return handle(request);
}

export async function POST(request) {
  return handle(request);
}

export async function HEAD(request) {
  return handle(request);
}