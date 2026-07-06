import { AccountForgotPasswordPage } from "../../src/ui/account-forgot-password-page.jsx";

export default async function ForgotPasswordPage({ searchParams }) {
  const resolved = await searchParams;
  const authRequestId = typeof resolved?.auth_request === "string" ? resolved.auth_request : "";

  return <AccountForgotPasswordPage authRequestId={authRequestId} />;
}