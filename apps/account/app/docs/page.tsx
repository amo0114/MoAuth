import { DocsPager } from "../../src/features/docs/components/DocsPager";
import { identityBrand } from "../../src/config/brand.js";

export default function DocsPage() {
  return (
    <>
      <h1 id="intro">{identityBrand.productName} 统一身份系统文档</h1>
      <p className="lead">
        欢迎使用 {identityBrand.productName} 文档。这里记录 Account、Connect 与接入方应用之间的职责边界和标准接入方式。
      </p>

      <h2 id="what-is-moauth">什么是 {identityBrand.productName}？</h2>
      <p>
        在现代软件架构中，身份验证是每个产品都无法避开的核心模块。{identityBrand.productName} 以 OIDC（OpenID Connect）Authorization Code + PKCE 为接入基线，为一方应用和外部项目提供可复用的统一身份入口。
      </p>
      <ul>
        <li><strong>集中式账号管理</strong>：用户在 Account 中管理资料、安全设置、会话与应用授权。</li>
        <li><strong>应用自主权</strong>：统一身份只回答“你是谁”，角色、权限及业务数据仍由各接入应用保留在本地。</li>
        <li><strong>标准协议接入</strong>：业务应用通过 Authorization Code + PKCE 接入 Connect，并在本地建立自己的 session。</li>
      </ul>

      <h2 id="why-choose-us">为什么选择我们？</h2>
      <p>
        不同于把登录、权限和业务账号混在一起的方案，{identityBrand.productName} 从一开始就区分 Account、Connect 和业务应用边界。它不强行接管业务系统，而是通过标准协议提供统一身份入口。
      </p>

      <div className="my-8 rounded-xl bg-primary/10 p-6 ring-1 ring-primary/20">
        <h3 className="mt-0 text-primary" id="start-now">准备好开始了吗？</h3>
        <p className="mb-0 text-primary/80">
          请查看下一节《快速开始》，我们将引导您在几分钟内完成第一个应用的接入。
        </p>
      </div>

      <DocsPager
        next={{ title: "快速开始", href: "/docs/getting-started" }}
      />
    </>
  );
}
