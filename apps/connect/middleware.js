import { NextResponse } from "next/server";
import { isZitadelConfigured } from "./src/config/zitadel.js";
import { proxyToZitadel, shouldProxyZitadel } from "./src/oidc/proxy-core.js";

export const runtime = "nodejs";

export async function middleware(request) {
  const url = new URL(request.url);

  if (!shouldProxyZitadel(url.pathname)) {
    return NextResponse.next();
  }

  if (!isZitadelConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "ZITADEL_NOT_CONFIGURED",
          message: "Identity core is not configured. Set ZITADEL_* env vars before proxying OIDC endpoints.",
        },
      },
      { status: 503 }
    );
  }

  return proxyToZitadel(request);
}

export const config = {
  matcher: ["/oauth/:path*", "/oidc/:path*", "/.well-known/:path*"],
};