import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  getOptionalAccountSession,
  getOptionalAccountUser,
} from "../../src/auth/require-account-session.js";
import { tryAutoHandoffRedirect } from "../../src/handoff/auto-continue.js";
import { toPublicAccountUser } from "../../src/session/account-session.js";
import { identityBrand } from "../../src/config/brand.js";
import { resolveHandoffClientName } from "../../src/oidc/handoff-client-label.js";
import { LoginPage as AccountLoginPage } from "../../src/features/auth";

export default async function LoginRoute({ searchParams }) {
  const resolved = await searchParams;
  const authRequestId =
    typeof resolved?.auth_request === "string"
      ? resolved.auth_request
      : typeof resolved?.authRequest === "string"
        ? resolved.authRequest
        : "";
  const requireLogin = resolved?.require_login === "1";

  const cookieStore = await cookies();
  const existingSession = getOptionalAccountSession(cookieStore);

  if (!authRequestId && existingSession) {
    redirect("/account/overview");
  }

  if (existingSession && authRequestId) {
    const handoffRedirect = await tryAutoHandoffRedirect({
      authRequestId,
      accountSession: existingSession,
      requireLogin,
    });
    if (handoffRedirect) {
      redirect(handoffRedirect);
    }
  }

  const existingUser = existingSession && authRequestId ? toPublicAccountUser(existingSession) : null;
  const clientName = authRequestId ? await resolveHandoffClientName(authRequestId) : null;

  return (
    <AccountLoginPage
      productName={identityBrand.accountName}
      gatewayName={identityBrand.gatewayName}
      authRequestId={authRequestId}
      clientName={clientName}
      existingUser={existingUser}
      registered={resolved?.registered === "1"}
      passwordReset={resolved?.reset === "1"}
    />
  );
}