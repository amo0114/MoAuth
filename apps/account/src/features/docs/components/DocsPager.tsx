import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DocsPagerProps {
  prev?: { title: string; href: string };
  next?: { title: string; href: string };
}

export function DocsPager({ prev, next }: DocsPagerProps) {
  return (
    <div className="flex flex-row items-center justify-between pt-12 mt-12 border-t border-black/5 dark:border-white/5">
      {prev ? (
        <Link
          href={prev.href}
          className="group flex flex-col gap-1 rounded-xl border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 p-4 text-sm transition-colors hover:bg-black/10 dark:hover:bg-white/10"
        >
          <span className="flex items-center gap-1 text-muted-foreground">
            <ChevronLeft className="h-4 w-4" />
            上一页
          </span>
          <span className="font-medium text-primary">{prev.title}</span>
        </Link>
      ) : (
        <div />
      )}
      {next && (
        <Link
          href={next.href}
          className="group flex flex-col items-end gap-1 rounded-xl border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 p-4 text-sm transition-colors hover:bg-black/10 dark:hover:bg-white/10"
        >
          <span className="flex items-center gap-1 text-muted-foreground">
            下一页
            <ChevronRight className="h-4 w-4" />
          </span>
          <span className="font-medium text-primary">{next.title}</span>
        </Link>
      )}
    </div>
  );
}
