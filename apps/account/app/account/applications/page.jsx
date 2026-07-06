import { cookies } from "next/headers";

import { requireAccountUser } from "../../../src/auth/require-account-session.js";
import { AccountApplications } from "../../../src/features/account";

export default async function AccountApplicationsRoute() {
  const user = requireAccountUser(await cookies());
  return <AccountApplications user={user} />;
}