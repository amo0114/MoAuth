import { cookies } from "next/headers";

import { getOptionalAccountUser } from "../../../src/auth/require-account-session.js";
import { AdminApplications } from "../../../src/features/admin/components/AdminApplications";

export const metadata = {
  title: "应用管理",
};

export default async function AdminApplicationsPage() {
  const cookieStore = await cookies();
  const user = getOptionalAccountUser(cookieStore);
  return <AdminApplications user={user} />;
}