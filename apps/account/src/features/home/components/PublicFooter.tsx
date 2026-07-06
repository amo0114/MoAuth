import Link from "next/link";
import { identityBrand } from "@/config/brand";

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/50 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          © {year} {identityBrand.productName}. 统一身份账号中心。
        </p>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          <Link href="/about" className="hover:text-foreground transition-colors">
            关于
          </Link>
          <Link href="/login" className="hover:text-foreground transition-colors">
            登录
          </Link>
          <Link
            href="/register"
            className="hover:text-foreground transition-colors"
          >
            注册
          </Link>
        </nav>
      </div>
    </footer>
  );
}