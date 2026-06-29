import { validateRegisteredClient } from "@moauth/connect-contract";

const CLIENTS = [
  validateRegisteredClient(
    {
      clientId: "379513141119169040",
      displayName: "SubBoost",
      clientType: "confidential",
      redirectUris: ["http://127.0.0.1:3001/api/auth/moauth/callback"],
      allowedScopes: ["openid", "profile", "email"],
      allowedPrompts: ["login", "select_account", "consent"],
      provisioningPolicy: "allowlist",
    },
    { allowLoopbackHttp: true }
  ),
];

export function findClientById(clientId) {
  return CLIENTS.find((client) => client.clientId === clientId) || null;
}

export function listRegisteredClients() {
  return [...CLIENTS];
}
