import { getHandoffInternalToken } from "../config/env.js";
import { isZitadelConfigured } from "@moauth/zitadel-client/config";

export async function evaluateAccountReadiness() {
  const checks = {
    zitadel: isZitadelConfigured(),
    handoff: Boolean(getHandoffInternalToken()),
  };

  return {
    ok: checks.zitadel && checks.handoff,
    service: "account",
    checks,
  };
}