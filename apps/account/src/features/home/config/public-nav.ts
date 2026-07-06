export type PublicNavLink = {
  title: string;
  href: string;
  disabled?: boolean;
  external?: boolean;
};

function docsHref() {
  const url = process.env.NEXT_PUBLIC_IDENTITY_DOCS_URL?.trim();
  return url || "/docs";
}

/** 公共顶栏导航（account.xxx.com 营销页，与账号中心 nav 分离） */
export const PUBLIC_NAV_LINKS: PublicNavLink[] = [
  { title: "主页", href: "/" },
  { title: "关于", href: "/about" },
  {
    title: "文档",
    href: docsHref(),
    external: Boolean(process.env.NEXT_PUBLIC_IDENTITY_DOCS_URL?.trim()),
  },
];