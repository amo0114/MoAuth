export function normalizeClientCallbackUrl(callbackUrl, authRequestInfo) {
  if (!callbackUrl || !authRequestInfo?.state) {
    return callbackUrl;
  }

  const url = new URL(callbackUrl);
  if (!url.searchParams.get("state")) {
    url.searchParams.set("state", authRequestInfo.state);
  }
  return url.toString();
}