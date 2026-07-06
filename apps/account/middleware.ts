import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ACCOUNT_SESSION_COOKIE } from "./src/session/constants.js";

/**
 * 保护 /account/*：无 session cookie 时跳转登录。
 * 页面级 requireAccountUser 仍保留，用于校验 cookie 签名与过期。
 */
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(ACCOUNT_SESSION_COOKIE)?.value;

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    const pathname = request.nextUrl.pathname;
    if (pathname && pathname !== "/login") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*"],
};