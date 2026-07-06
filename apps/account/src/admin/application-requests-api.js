import { createAdminApplication } from "./applications-api.js";
import { recordAuditEvent } from "../audit/service.js";
import { getApplicationRequestStore } from "../application-requests/store.js";
import { getClientRegistryStore } from "../client-registry/store.js";
import { resolveUserLevel } from "../developer/user-level.js";

function assertUniqueDisplayName(displayName) {
  const normalized = String(displayName || "").trim().toLowerCase();
  const conflict = getClientRegistryStore()
    .list()
    .some((record) => record.displayName.trim().toLowerCase() === normalized);
  if (conflict) {
    throw new Error("An application with the same display name already exists.");
  }
}

export function createDeveloperApplicationRequest(input, applicant) {
  resolveUserLevel(applicant);
  assertUniqueDisplayName(input.displayName);
  return getApplicationRequestStore().create({
    ...input,
    applicantSubjectId: applicant.sub,
  });
}

export function listDeveloperApplicationRequests(applicant) {
  return getApplicationRequestStore().list({ applicantSubjectId: applicant.sub });
}

export function listPendingApplicationRequests() {
  return getApplicationRequestStore().list({ status: "pending" });
}

export async function approveApplicationRequest(id, actor, options = {}) {
  const store = getApplicationRequestStore();
  const request = store.getById(id);
  if (!request) return null;
  if (request.status !== "pending" && request.status !== "changes_requested") {
    throw new Error("Only pending requests can be approved.");
  }

  const created = await createAdminApplication(
    {
      displayName: request.displayName,
      homepageUrl: request.homepageUrl,
      description: request.description,
      logoUrl: request.logoUrl,
      redirectUris: request.redirectUris,
      allowedScopes: ["openid", "profile", "email"],
      allowedPrompts: ["login", "select_account", "consent"],
      provisioningPolicy: options.provisioningPolicy || "allowlist",
      env: options.env || "dev",
      minUserLevel: request.minUserLevel,
      status: "active",
      createdBy: "self_service",
      ownerSubjectId: request.applicantSubjectId,
    },
    actor
  );

  const updated = store.update(id, {
    status: "approved",
    reviewNote: options.reviewNote || null,
    reviewedBySubjectId: actor.sub,
    reviewedAt: new Date(),
    createdClientId: created.clientId,
    createdRegistryId: created.id,
  });

  recordAuditEvent({
    eventType: "console_application_request_approved",
    sub: actor.sub,
    summary: `批准应用接入申请 ${request.displayName}`,
    metadata: {
      requestId: id,
      clientId: created.clientId,
      applicantSubjectId: request.applicantSubjectId,
    },
  });

  return { request: updated, application: created };
}

export function rejectApplicationRequest(id, actor, reviewNote) {
  const store = getApplicationRequestStore();
  const request = store.getById(id);
  if (!request) return null;
  if (request.status !== "pending" && request.status !== "changes_requested") {
    throw new Error("Only pending requests can be rejected.");
  }

  const updated = store.update(id, {
    status: "rejected",
    reviewNote: reviewNote || null,
    reviewedBySubjectId: actor.sub,
    reviewedAt: new Date(),
  });

  recordAuditEvent({
    eventType: "console_application_request_rejected",
    sub: actor.sub,
    summary: `拒绝应用接入申请 ${request.displayName}`,
    metadata: {
      requestId: id,
      applicantSubjectId: request.applicantSubjectId,
    },
  });

  return updated;
}