import { redirect } from "next/navigation";

import { AccountSessionError } from "../session/errors.js";
import {
  ACCOUNT_SESSION_COOKIE,
  readAccountSessionFromCookie,
  readOptionalAccountSession,
  toPublicAccountUser,
} from "../session/account-session.js";

export function getOptionalAccountUser(cookieStore) {
  const session = readOptionalAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value);
  return session ? toPublicAccountUser(session) : null;
}

export function getOptionalAccountSession(cookieStore) {
  return readOptionalAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value);
}

export function requireAccountUser(cookieStore, loginHref = "/login") {
  const user = getOptionalAccountUser(cookieStore);
  if (!user) {
    redirect(loginHref);
  }
  return user;
}

export function requireAccountSession(cookieStore, loginHref = "/login") {
  const session = getOptionalAccountSession(cookieStore);
  if (!session) {
    redirect(loginHref);
  }
  return session;
}

export function readRequiredAccountSession(cookieStore) {
  const cookieValue = cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value;
  if (!cookieValue) {
    throw new AccountSessionError("ACCOUNT_SESSION_REQUIRED", "Account session is required.");
  }
  return readAccountSessionFromCookie(cookieValue);
}