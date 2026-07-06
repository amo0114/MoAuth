import { DocsPager } from "../../../src/features/docs/components/DocsPager";
import { identityBrand } from "../../../src/config/brand.js";

export default function GettingStartedPage() {
  const codeSnippet = `// 示例代码（伪代码）
const authUrl = new URL("${identityBrand.connectBaseUrl}/oauth/v2/authorize");
authUrl.searchParams.set("client_id", "YOUR_CLIENT_ID");
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("redirect_uri", "http://localhost:3000/api/auth/callback");
authUrl.searchParams.set("scope", "openid profile email");
authUrl.searchParams.set("state", state);
authUrl.searchParams.set("nonce", nonce);
authUrl.searchParams.set("code_challenge", "GENERATED_CHALLENGE");
authUrl.searchParams.set("code_challenge_method", "S256");

redirect(authUrl.toString());`;

  return (
    <>
      <h1 id="getting-started">快速开始</h1>
      <p className="lead">
        本指南将带领您完成基于 {identityBrand.productName} 的第一个应用接入。
      </p>

      <h2 id="prerequisites">前提条件</h2>
      <p>在开始之前，请确保您具备以下环境：</p>
      <ul>
        <li>一个能够接收 Webhook 或处理 HTTP 回调的服务端（如 Node.js, Go 等）。</li>
        <li>向管理员申请的 <code>Client ID</code>、回调地址与允许的 scopes。</li>
      </ul>

      <h2 id="step-1">第一步：配置回调地址</h2>
      <p>
        在管理控制台中，为您的应用配置一个合法的重定向 URI (Redirect URI)。例如，对于本地开发环境，您可以将其设置为：
      </p>
      <pre><code>http://localhost:3000/api/auth/callback</code></pre>

      <h2 id="step-2">第二步：发起授权请求</h2>
      <p>
        当用户需要登录时，将用户重定向至 {identityBrand.gatewayName}。请求必须包含必要的 OIDC 参数，特别是 <code>state</code>、<code>nonce</code> 和 <code>code_challenge</code>。
      </p>
      <pre><code>{codeSnippet}</code></pre>

      <h2 id="step-3">第三步：处理回调并获取令牌</h2>
      <p>
        用户在 {identityBrand.gatewayName} 登录成功后，会被重定向回您的应用回调地址，URL 中会携带一个 <code>code</code> 参数。
        您需要在服务端使用这个 <code>code</code> 换取 <code>access_token</code> 和 <code>id_token</code>。
      </p>

      <div className="mt-12">
        <DocsPager
          prev={{ title: "简介", href: "/docs" }}
          next={{ title: "架构设计", href: "/docs/architecture" }}
        />
      </div>
    </>
  );
}
