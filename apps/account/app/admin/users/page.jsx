import { cookies } from "next/headers";

import { requireAccountUser } from "../../../src/auth/require-account-session.js";
import { AdminUsers } from "../../../src/features/admin";

export const metadata = {
  title: "用户管理 · 管理后台",
};

export default async function AdminUsersRoute() {
  const user = requireAccountUser(await cookies());
  return <AdminUsers user={user} />;
}
