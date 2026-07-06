import { ConnectLoginPage } from "../src/ui/connect-login-page.jsx";
import { getAccountPublicUrl } from "../src/config/env.js";

export const dynamic = "force-dynamic";

export default function ConnectHomePage() {
  return <ConnectLoginPage accountBaseUrl={getAccountPublicUrl()} />;
}
