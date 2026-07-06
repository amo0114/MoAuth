"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { PUBLIC_NAV_LINKS, type PublicNavLink } from "../config/public-nav";

export type PublicNavLinkView = PublicNavLink & {
  isActive: boolean;
};

export function usePublicNavLinks(): PublicNavLinkView[] {
  const pathname = usePathname();

  return useMemo(
    () =>
      PUBLIC_NAV_LINKS.map((link) => ({
        disabled: false,
        external: false,
        ...link,
        isActive: !link.external && pathname === link.href,
      })),
    [pathname]
  );
}