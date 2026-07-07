import { ConnectAdminAuthError, requireConnectAdmin } from "../../../../../src/admin/auth.js";
import {
  disableAdminClient,
  getAdminClient,
  mapConnectAdminClientError,
  updateAdminClient,
} from "../../../../../src/admin/clients-api.js";

function authorizeOrResponse(request) {
  try {
    requireConnectAdmin(request);
    return null;
  } catch (error) {
    if (error instanceof ConnectAdminAuthError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status }
      );
    }
    throw error;
  }
}

function notFound() {
  return Response.json(
    { error: { code: "CLIENT_REGISTRY_NOT_FOUND", message: "Connect client was not found." } },
    { status: 404 }
  );
}

async function readClientId(context) {
  const params = await context.params;
  return String(params.clientId || "");
}

export async function GET(request, context) {
  const authResponse = authorizeOrResponse(request);
  if (authResponse) return authResponse;

  const client = await getAdminClient(await readClientId(context));
  return client ? Response.json({ client }) : notFound();
}

export async function PATCH(request, context) {
  const authResponse = authorizeOrResponse(request);
  if (authResponse) return authResponse;

  try {
    const body = await request.json();
    const client = await updateAdminClient(await readClientId(context), body);
    return client ? Response.json({ client }) : notFound();
  } catch (error) {
    const mapped = mapConnectAdminClientError(error);
    return Response.json(mapped.body, { status: mapped.status });
  }
}

export async function DELETE(request, context) {
  const authResponse = authorizeOrResponse(request);
  if (authResponse) return authResponse;

  try {
    const client = await disableAdminClient(await readClientId(context));
    return client ? Response.json({ client }) : notFound();
  } catch (error) {
    const mapped = mapConnectAdminClientError(error);
    return Response.json(mapped.body, { status: mapped.status });
  }
}
