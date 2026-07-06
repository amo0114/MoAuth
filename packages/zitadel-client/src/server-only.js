if (typeof globalThis.window !== "undefined" && globalThis.window?.document) {
  throw new Error(
    "@moauth/zitadel-client is server-only and must not be imported in browser code."
  );
}