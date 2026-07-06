import { cookies } from "next/headers";

import { requireAccountUser } from "../../../src/auth/require-account-session.js";
import { AdminSettings } from "../../../src/features/admin";

export const metadata = {
  title: "系统设置 · 管理后台",
};

export default async function AdminSettingsRoute() {
  const user = requireAccountUser(await cookies());
  return <AdminSettings user={user} />;
}
