import { PROMPT_VALUES } from "@moauth/connect-contract";

const ZITADEL_PROMPT_ALIASES = Object.freeze({
  PROMPT_LOGIN: "login",
  PROMPT_SELECT_ACCOUNT: "select_account",
  PROMPT_CONSENT: "consent",
  PROMPT_NONE: "none",
});

function toOidcPromptValue(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (PROMPT_VALUES.includes(trimmed)) return trimmed;
  return ZITADEL_PROMPT_ALIASES[trimmed] || null;
}

export function normalizePromptList(prompt) {
  if (!Array.isArray(prompt)) return [];
  return [...new Set(prompt.map(toOidcPromptValue).filter(Boolean))];
}

export function hasPrompt(prompt, value) {
  return normalizePromptList(prompt).includes(value);
}

export function buildOidcErrorRedirect({ redirectUri, state, error, errorDescription }) {
  if (!redirectUri) {
    return null;
  }

  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (errorDescription) {
    url.searchParams.set("error_description", errorDescription);
  }
  if (state) {
    url.searchParams.set("state", state);
  }
  return url.toString();
}

export function resolveLoginRoute({
  hasConnectSso,
  prompt = [],
  passwordFallbackEnabled = false,
}) {
  const prompts = normalizePromptList(prompt);

  if (hasPrompt(prompts, "none") && !hasConnectSso) {
    return { type: "login_required" };
  }

  if (hasPrompt(prompts, "login")) {
    return { type: "redirect_account", clearSso: true };
  }

  if (hasPrompt(prompts, "select_account")) {
    return { type: "redirect_account", clearSso: false };
  }

  if (hasConnectSso) {
    return { type: "consent", forceConsent: hasPrompt(prompts, "consent") };
  }

  if (passwordFallbackEnabled) {
    return { type: "password_fallback" };
  }

  return { type: "redirect_account", clearSso: false };
}