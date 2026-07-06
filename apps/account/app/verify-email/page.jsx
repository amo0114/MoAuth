import { AccountVerifyEmailPage } from "../../src/ui/account-verify-email-page.jsx";

export default async function VerifyEmailPage({ searchParams }) {
  const resolved = await searchParams;
  const authRequestId = typeof resolved?.auth_request === "string" ? resolved.auth_request : "";
  const userId =
    typeof resolved?.user_id === "string"
      ? resolved.user_id
      : typeof resolved?.userId === "string"
        ? resolved.userId
        : "";
  const initialCode = typeof resolved?.code === "string" ? resolved.code : "";

  return (
    <AccountVerifyEmailPage
      userId={userId}
      authRequestId={authRequestId}
      initialCode={initialCode}
    />
  );
}