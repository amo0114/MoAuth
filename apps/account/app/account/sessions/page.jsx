import { cookies } from "next/headers";

import { requireAccountUser } from "../../../src/auth/require-account-session.js";
import { AccountSessions } from "../../../src/features/account";

export default async function AccountSessionsRoute() {
  const user = requireAccountUser(await cookies());
  return <AccountSessions user={user} />;
}