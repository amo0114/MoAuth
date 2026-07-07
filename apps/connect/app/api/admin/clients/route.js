import { ConnectAdminAuthError, requireConnectAdmin } from "../../../../src/admin/auth.js";
import {
  listAdminClients,
  mapConnectAdminClientError,
  registerAdminClient,
} from "../../../../src/admin/clients-api.js";

function authorize(request) {
  try {
    return { actor: requireConnectAdmin(request), response: null };
  } catch (error) {
    if (error instanceof ConnectAdminAuthError) {
      return {
        actor: null,
        response: Response.json(
          { error: { code: error.code, message: error.message } },
          { status: error.status }
        ),
      };
    }
    throw error;
  }
}

export async function GET(request) {
  const { response } = authorize(request);
  if (response) return response;

  try {
    const url = new URL(request.url);
    const filters = {};
    const env = url.searchParams.get("env");
    const status = url.searchParams.get("status");
    if (env) filters.env = env;
    if (status) filters.status = status;
    const clients = await listAdminClients(filters);
    return Response.json({ clients });
  } catch (error) {
    const mapped = mapConnectAdminClientError(error);
    return Response.json(mapped.body, { status: mapped.status });
  }
}

export async function POST(request) {
  const { actor, response } = authorize(request);
  if (response) return response;

  try {
    const body = await request.json();
    const client = await registerAdminClient(body, actor);
    return Response.json({ client }, { status: 201 });
  } catch (error) {
    const mapped = mapConnectAdminClientError(error);
    return Response.json(mapped.body, { status: mapped.status });
  }
}
