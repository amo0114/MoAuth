export function shouldReturnVerificationCodes() {
  if (process.env.MOAUTH_DEV_RETURN_VERIFICATION_CODES === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}

export function buildAuthContextPath(pathname, authRequestId = "") {
  if (!authRequestId) return pathname;
  const params = new URLSearchParams();
  params.set("auth_request", authRequestId);
  return `${pathname}?${params.toString()}`;
}