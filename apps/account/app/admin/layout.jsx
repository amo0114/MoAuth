import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getOptionalAccountUser } from "../../src/auth/require-account-session.js";
import { AccountCenterShell } from "../../src/features/account";

export const metadata = {
  title: "管理后台",
};

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies();
  const user = getOptionalAccountUser(cookieStore);

  if (!user) {
    redirect("/login?next=/admin/users");
  }

  if (!user.isAdmin) {
    redirect("/account/overview");
  }

  return (
    <AccountCenterShell user={user} showAdmin>
      {children}
    </AccountCenterShell>
  );
}
