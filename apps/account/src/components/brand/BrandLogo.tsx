"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { identityBrand } from "../../config/brand.js";
import { cn } from "../../lib/utils.js";

type BrandLogoVariant = "auto" | "light" | "dark";

type BrandLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
  variant?: BrandLogoVariant;
};

export function BrandLogo({
  size = 32,
  className,
  priority = false,
  alt,
  variant = "auto",
}: BrandLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const src =
    variant === "light"
      ? identityBrand.logos.light
      : variant === "dark"
        ? identityBrand.logos.dark
        : !mounted || resolvedTheme !== "dark"
          ? identityBrand.logos.light
          : identityBrand.logos.dark;

  return (
    <Image
      src={src}
      alt={alt ?? identityBrand.productName}
      width={size}
      height={size}
      priority={priority}
      className={cn("object-contain bg-transparent", className)}
    />
  );
}