"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { identityBrand } from "@/config/brand";
import { cn } from "@/lib/utils";
import {
  PublicMobileNavOverlay,
  PublicMobileNavTrigger,
  PublicTopNavBar,
} from "./PublicTopNav";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type PublicShellProps = {
  children: React.ReactNode;
  user?: { email?: string | null } | null;
};

export function PublicShell({ children, user }: PublicShellProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isLoggedIn = Boolean(user);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-[padding] duration-500 ease-out",
          scrolled ? "pt-3 px-4" : "pt-0 px-0",
        )}
      >
        <nav
          className={cn(
            "relative mx-auto flex items-center transition-[max-width,padding,background-color,border-color,box-shadow,border-radius] duration-500 ease-out",
            scrolled
              ? "max-w-4xl rounded-full border border-border/50 bg-background/80 backdrop-blur-xl shadow-lg px-4 py-2.5"
              : "max-w-6xl border-transparent bg-transparent px-6 py-4",
          )}
        >
          <Link
            href="/"
            className={cn(
              "absolute left-4 z-10 flex items-center gap-2.5 transition-[top,transform] duration-500 ease-out",
              scrolled ? "top-1/2 -translate-y-1/2" : "top-4",
            )}
          >
            <BrandLogo
              size={scrolled ? 28 : 32}
              className="shrink-0 transition-[width,height,transform] duration-500"
            />
            <span
              className={cn(
                "font-artistic font-semibold tracking-tight transition-[font-size,line-height] duration-500",
                scrolled ? "text-base" : "text-lg",
              )}
            >
              {identityBrand.productName}
            </span>
          </Link>

          <div className="hidden md:flex flex-1 justify-center">
            <PublicTopNavBar />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            {isLoggedIn ? (
              <Button size="sm" className="rounded-full font-medium shadow-sm transition-[transform,box-shadow,background-color,color] hover:shadow-md hover:-translate-y-0.5 active:scale-95" asChild>
                <Link href="/account/overview">进入账号中心</Link>
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex rounded-full font-medium"
                  asChild
                >
                  <Link href="/login">登录</Link>
                </Button>
                <Button size="sm" className="rounded-full font-medium shadow-sm transition-[transform,box-shadow,background-color,color] hover:shadow-md hover:-translate-y-0.5 active:scale-95" asChild>
                  <Link href="/register">免费注册</Link>
                </Button>
              </>
            )}
            <div className="md:hidden flex items-center gap-1">
              <ThemeToggle />
              <PublicMobileNavTrigger
                open={mobileOpen}
                onToggle={() => setMobileOpen((v) => !v)}
              />
            </div>
          </div>
        </nav>
      </header>

      <PublicMobileNavOverlay
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        scrolled={scrolled}
        user={user}
      />

      <main>{children}</main>
    </div>
  );
}