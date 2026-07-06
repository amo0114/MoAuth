"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils.js";
import { usePublicNavLinks } from "../hooks/usePublicNavLinks";
import type { PublicNavLinkView } from "../hooks/usePublicNavLinks";

const MOBILE_OVERLAY_EASE = "ease-out";

function PublicNavLink({
  link,
  className,
  style,
  tabIndex,
  onNavigate,
}: {
  link: PublicNavLinkView;
  className?: string;
  style?: React.CSSProperties;
  tabIndex?: number;
  onNavigate?: () => void;
}) {
  const merged = cn(
    className,
    link.isActive ? "text-[#1D1D1F] dark:text-white" : "text-[#1D1D1F]/70 dark:text-white/70",
    link.disabled && "pointer-events-none opacity-50"
  );

  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        aria-current={link.isActive ? "page" : undefined}
        className={merged}
        style={style}
        tabIndex={tabIndex}
      >
        {link.title}
      </a>
    );
  }

  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      aria-current={link.isActive ? "page" : undefined}
      className={merged}
      style={style}
      tabIndex={tabIndex}
    >
      {link.title}
    </Link>
  );
}

export function PublicTopNavBar() {
  const links = usePublicNavLinks();

  return (
    <nav className="flex items-center gap-0.5 whitespace-nowrap" aria-label="站点导航">
      {links.map((link) => (
        <PublicNavLink
          key={link.href}
          link={link}
          className="relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-200"
        />
      ))}
    </nav>
  );
}

export function PublicMobileNavTrigger({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-9"
      onClick={onToggle}
      aria-label={open ? "关闭导航菜单" : "打开导航菜单"}
      aria-expanded={open}
    >
      <div className="relative size-4">
        <span
          className={cn(
            "absolute inset-x-0 block h-[1.5px] origin-center rounded-full bg-current transition-[top,transform,opacity] duration-300",
            open ? "top-[7px] rotate-45" : "top-[3px]"
          )}
        />
        <span
          className={cn(
            "absolute inset-x-0 top-[7px] block h-[1.5px] rounded-full bg-current transition-[transform,opacity] duration-300",
            open ? "scale-x-0 opacity-0" : "opacity-100"
          )}
        />
        <span
          className={cn(
            "absolute inset-x-0 block h-[1.5px] origin-center rounded-full bg-current transition-[top,transform,opacity] duration-300",
            open ? "top-[7px] -rotate-45" : "top-[11px]"
          )}
        />
      </div>
    </Button>
  );
}

export function PublicMobileNavOverlay({
  open,
  onClose,
  scrolled = false,
  user,
}: {
  open: boolean;
  onClose: () => void;
  scrolled?: boolean;
  user?: { email?: string | null } | null;
}) {
  const links = usePublicNavLinks();
  const isLoggedIn = Boolean(user);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 transition-opacity duration-500 sm:pointer-events-none sm:hidden",
        MOBILE_OVERLAY_EASE,
        scrolled
          ? "bg-[#F5F5F7]/98 dark:bg-black/95 backdrop-blur-2xl"
          : "bg-transparent backdrop-blur-none",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!open}
    >
      <div className="flex h-full flex-col justify-between px-8 pt-20 pb-10">
        <nav className="flex flex-col gap-1">
          {links.map((link, index) => (
            <PublicNavLink
              key={link.href}
              link={link}
              onNavigate={onClose}
              className={cn(
                "flex items-center gap-3 py-3 text-base font-medium tracking-tight transition-[transform,opacity] duration-500",
                MOBILE_OVERLAY_EASE,
                open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              )}
              style={{ transitionDelay: open ? `${100 + index * 50}ms` : "0ms" }}
              tabIndex={open ? undefined : -1}
            />
          ))}
        </nav>

        <div
          className={cn(
            "flex flex-col gap-3 transition-[transform,opacity] duration-500",
            MOBILE_OVERLAY_EASE,
            open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          )}
          style={{ transitionDelay: open ? "250ms" : "0ms" }}
        >
          {isLoggedIn ? (
            <Link
              href="/account/overview"
              tabIndex={open ? undefined : -1}
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1D1D1F] text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 dark:bg-white dark:text-[#1D1D1F]"
            >
              进入账号中心
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                tabIndex={open ? undefined : -1}
                onClick={onClose}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1D1D1F] text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 dark:bg-white dark:text-[#1D1D1F]"
              >
                注册
              </Link>
              <Link
                href="/login"
                tabIndex={open ? undefined : -1}
                onClick={onClose}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[#1D1D1F]/20 text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80 dark:border-white/20"
              >
                登录
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
