import { OIDC_CONTRACT_ERROR_CODES, OidcContractError } from "./errors.js";
import { PROVISIONING_POLICIES } from "./client-contract.js";

export const PROVISIONING_DECISIONS = Object.freeze({
  LOGIN_EXISTING: "login-existing",
  BIND_AND_LOGIN: "bind-and-login",
  CREATE_AND_LOGIN: "create-and-login",
  DENY: "deny",
});

export function decideProvisioning(policy, facts) {
  if (!PROVISIONING_POLICIES.includes(policy)) {
    throw new OidcContractError("INVALID_PROVISIONING_POLICY", "Unknown provisioning policy.", { policy });
  }

  const hasSubjectBinding = facts?.hasSubjectBinding === true;
  const hasApprovedLocalAccount = facts?.hasApprovedLocalAccount === true;
  const emailVerified = facts?.emailVerified === true;

  if (hasSubjectBinding) {
    return decision(PROVISIONING_DECISIONS.LOGIN_EXISTING);
  }

  if (policy !== "manual-binding" && hasApprovedLocalAccount && emailVerified) {
    return decision(PROVISIONING_DECISIONS.BIND_AND_LOGIN);
  }

  if (policy === "auto-create" && emailVerified) {
    return decision(PROVISIONING_DECISIONS.CREATE_AND_LOGIN);
  }

  return decision(PROVISIONING_DECISIONS.DENY, OIDC_CONTRACT_ERROR_CODES.APP_ACCESS_DENIED);
}

export function assertProvisioningAllowed(policy, facts) {
  const result = decideProvisioning(policy, facts);
  if (result.decision === PROVISIONING_DECISIONS.DENY) {
    throw new OidcContractError(result.errorCode, "Application access is denied by the local provisioning policy.", {
      policy,
      facts,
    });
  }
  return result;
}

function decision(value, errorCode = null) {
  return Object.freeze({ decision: value, errorCode });
}
