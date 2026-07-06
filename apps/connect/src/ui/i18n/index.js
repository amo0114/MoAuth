import { zhCN } from "./zh-CN.js";
import { enUS } from "./en-US.js";

const DEFAULT_LOCALE = "zh-CN";
const SUPPORTED_LOCALES = ["zh-CN", "en-US"];

const DICTIONARIES = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

export function resolveLocale(locale) {
  if (!locale) return DEFAULT_LOCALE;
  const lower = String(locale).toLowerCase();
  if (SUPPORTED_LOCALES.includes(lower)) return lower;
  if (lower.startsWith("zh")) return "zh-CN";
  if (lower.startsWith("en")) return "en-US";
  return DEFAULT_LOCALE;
}

export function getDictionary(locale) {
  return DICTIONARIES[resolveLocale(locale)] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export function detectLocaleFromHeaders(headers) {
  if (!headers || typeof headers.get !== "function") return DEFAULT_LOCALE;
  const acceptLanguage = headers.get("accept-language") || "";
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const first = acceptLanguage.split(",")[0] || "";
  return resolveLocale(first.trim());
}

export function getAcceptLanguageHeader(locale) {
  return resolveLocale(locale) === "en-US" ? "en-US,en;q=0.9" : "zh-CN,zh;q=0.9";
}

export { DEFAULT_LOCALE, SUPPORTED_LOCALES };
