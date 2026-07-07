import { recordAuditEvent } from "../audit/service.js";
import { getRegistrationConfig, setRegistrationConfig } from "../registration/config-store.js";

const VALID_MODES = ["open", "closed", "review", "invite"];

export async function getRegistrationAdminConfig() {
  return await getRegistrationConfig();
}

export async function updateRegistrationAdminConfig({ mode }, actor) {
  if (!VALID_MODES.includes(mode)) {
    const err = new Error(`Invalid mode: ${mode}. Must be one of: ${VALID_MODES.join(", ")}`);
    err.code = "REGISTRATION_CONFIG_INVALID";
    err.status = 400;
    throw err;
  }

  const updated = await setRegistrationConfig({ mode }, actor);

  recordAuditEvent({
    eventType: "registration_config_updated",
    sub: actor.sub,
    summary: `更新注册模式为: ${mode}`,
    metadata: { mode, updatedBy: actor.sub },
  });

  return updated;
}

export function mapRegistrationConfigError(error) {
  if (error?.code === "REGISTRATION_CONFIG_INVALID") {
    return { status: 400, body: { error: error.message } };
  }
  return { status: 500, body: { error: error?.message || "Failed to process registration config request." } };
}
