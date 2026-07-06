import { completeHandoffFromAccountSession } from "./service.js";

export async function tryAutoHandoffRedirect(
  { authRequestId, accountSession, requireLogin },
  options = {}
) {
  if (!authRequestId || !accountSession || requireLogin) {
    return null;
  }

  try {
    const result = await completeHandoffFromAccountSession(
      { authRequestId, accountSession },
      options
    );
    return result.redirectUrl || null;
  } catch {
    return null;
  }
}