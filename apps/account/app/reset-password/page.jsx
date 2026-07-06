import { AccountResetPasswordPage } from "../../src/ui/account-reset-password-page.jsx";

export default async function ResetPasswordPage({ searchParams }) {
  const resolved = await searchParams;
  const authRequestId = typeof resolved?.auth_request === "string" ? resolved.auth_request : "";

  return <AccountResetPasswordPage authRequestId={authRequestId} />;
}