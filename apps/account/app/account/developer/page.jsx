import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getOptionalAccountUser } from "../../../src/auth/require-account-session.js";
import { DeveloperApply } from "../../../src/features/account/components/DeveloperApply";

export const metadata = {
  title: "申请接入",
};

export default async function DeveloperApplyPage() {
  const cookieStore = await cookies();
  const user = getOptionalAccountUser(cookieStore);
  if (!user) {
    redirect("/login?next=/account/developer");
  }
  if (user.isAdmin) {
    redirect("/admin/applications");
  }
  return <DeveloperApply user={user} />;
}