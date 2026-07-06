import { cookies } from "next/headers";

import { requireAccountUser } from "../../../src/auth/require-account-session.js";
import { AccountProfile } from "../../../src/features/account";

export default async function AccountProfileRoute() {
  const user = requireAccountUser(await cookies());
  return <AccountProfile user={user} />;
}