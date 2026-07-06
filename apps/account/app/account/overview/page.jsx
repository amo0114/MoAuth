import { cookies } from "next/headers";

import { identityBrand } from "../../../src/config/brand.js";
import { requireAccountUser } from "../../../src/auth/require-account-session.js";
import { AccountOverview } from "../../../src/features/account";

export default async function AccountOverviewRoute() {
  const cookieStore = await cookies();
  const user = requireAccountUser(cookieStore);

  return <AccountOverview user={user} productName={identityBrand.productName} />;
}