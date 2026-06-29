export function getConnectIssuer() {
  return normalizeUrl(process.env.MOAUTH_CONNECT_ISSUER || "http://localhost:3000");
}

export function getPublicAppUrl() {
  return normalizeUrl(process.env.MOAUTH_CONNECT_PUBLIC_URL || getConnectIssuer());
}

function normalizeUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}
