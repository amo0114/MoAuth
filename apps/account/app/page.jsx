import { cookies } from "next/headers";

import { getOptionalAccountUser } from "../src/auth/require-account-session.js";
import { HomePage } from "../src/features/home";

export default async function AccountHomePage() {
  const cookieStore = await cookies();
  const user = getOptionalAccountUser(cookieStore);

  return <HomePage user={user} />;
}