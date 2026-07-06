import { cookies } from "next/headers";

import { requireAccountUser } from "../../../src/auth/require-account-session.js";
import { AccountActivity } from "../../../src/features/account";

export default async function AccountActivityRoute() {
  const user = requireAccountUser(await cookies());
  return <AccountActivity user={user} />;
}