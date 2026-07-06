"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Slash } from "lucide-react";

import { cn } from "../../lib/utils.js";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { Separator } from "../../components/ui/separator";

export type BreadcrumbEntry =
  | string
  | {
      label: string;
      href?: string;
    };

type SectionPageLayoutProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbEntry[];
  /** 页面底部最大宽度；默认 5xl。 */
  maxWidth?: "4xl" | "5xl" | "6xl" | "7xl" | "full";
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
};

const MAX_WIDTH_CLASS: Record<NonNullable<SectionPageLayoutProps["maxWidth"]>, string> = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-none",
};

/**
 * Slot 化页面布局：对齐 new-api Section 页面结构。
 * - Title / Description / Actions / Breadcrumb 横向排列在顶部
 * - Content 通过 children 注入
 */
export function SectionPageLayout({
  title,
  description,
  actions,
  breadcrumbs,
  maxWidth = "5xl",
  children,
  className,
  bodyClassName,
}: SectionPageLayoutProps) {
  const hasHeader = title || description || actions;

  return (
    <div className={cn("flex h-full min-h-0 flex-1 flex-col", className)}>
      <div className="shrink-0 px-3 pt-3 pb-2.5 sm:px-4 sm:pt-5 sm:pb-3">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <div className="mb-2 text-xs sm:mb-3 sm:text-sm">
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((entry, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  const label = typeof entry === "string" ? entry : entry.label;
                  const href = typeof entry === "string" ? undefined : entry.href;

                  return (
                    <React.Fragment key={`${label}-${index}`}>
                      <BreadcrumbItem>
                        {isLast || !href ? (
                          <BreadcrumbPage>{label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link href={href}>{label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast ? (
                        <BreadcrumbSeparator>
                          <ChevronRight className="size-3.5" />
                        </BreadcrumbSeparator>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        ) : null}

        {hasHeader ? (
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 sm:items-center sm:gap-x-4">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold tracking-tight sm:text-lg text-[#1F2421] dark:text-zinc-50">
                {title}
              </h2>
              {description && (
                <p className="mt-1 line-clamp-2 text-[14px] text-muted-foreground sm:truncate">
                  {description}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex w-full shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-x-4">
                {actions}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-auto px-3 pt-1 pb-3 sm:px-4 sm:pt-1.5 sm:pb-4",
          bodyClassName
        )}
      >
        <div
          className={cn(
            "mx-auto w-full",
            maxWidth === "full" && "h-full",
            MAX_WIDTH_CLASS[maxWidth]
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function SectionDivider() {
  return <Separator className="my-2" />;
}

export { Separator as SectionSeparator, Slash };
