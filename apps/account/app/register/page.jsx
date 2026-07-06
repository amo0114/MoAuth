import { identityBrand } from "../../src/config/brand.js";
import { AccountRegisterPage } from "../../src/ui/account-register-page.jsx";

export default async function RegisterPage({ searchParams }) {
  const resolved = await searchParams;
  const authRequestId = typeof resolved?.auth_request === "string" ? resolved.auth_request : "";

  return (
    <AccountRegisterPage
      productName={identityBrand.accountName}
      authRequestId={authRequestId}
    />
  );
}