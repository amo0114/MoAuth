import { cookies } from "next/headers";

import { requireAccountUser } from "../../../src/auth/require-account-session.js";
import { AccountSecurity } from "../../../src/features/account";

export default async function AccountSecurityRoute() {
  const user = requireAccountUser(await cookies());
  return <AccountSecurity user={user} />;
}