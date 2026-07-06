"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

export function DocsBreadcrumb() {
  const pathname = usePathname();
  const paths = pathname.split("/").filter(Boolean);

  return (
    <div className="mb-6 flex items-center space-x-1 text-sm text-muted-foreground">
      {paths.map((path, index) => {
        const isLast = index === paths.length - 1;
        const href = `/${paths.slice(0, index + 1).join("/")}`;
        const title =
          path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " ");

        return (
          <div key={path} className="flex items-center space-x-1">
            <Link
              href={href}
              className={`hover:text-foreground hover:underline ${
                isLast ? "font-medium text-foreground" : ""
              }`}
            >
              {title}
            </Link>
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </div>
        );
      })}
    </div>
  );
}
