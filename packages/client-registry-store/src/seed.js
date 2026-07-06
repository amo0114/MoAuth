export const DEFAULT_CLIENT_REGISTRY_SEEDS = Object.freeze([
  Object.freeze({
    id: "seed-subboost-dev",
    clientId: "380559739236450307",
    displayName: "SubBoost",
    clientType: "confidential",
    redirectUris: ["http://127.0.0.1:3001/api/auth/moauth/callback"],
    allowedScopes: ["openid", "profile", "email"],
    allowedPrompts: ["login", "select_account", "consent"],
    provisioningPolicy: "allowlist",
    env: "dev",
    status: "active",
    createdBy: "admin",
  }),
]);