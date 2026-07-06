import React from 'react';
import { cn } from "../../../lib/utils.js";

interface CardGroupProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  delayIndex?: number;
}

export function CardGroup({ children, title, footer, className, delayIndex = 0 }: CardGroupProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#E7E1D7] dark:border-zinc-800 bg-white dark:bg-[#111111] overflow-hidden shadow-sm animate-fade-in-up fill-mode-both flex flex-col",
        className
      )}
      style={{ animationDelay: `${delayIndex * 80}ms` }}
    >
      {title && (
        <div className="flex flex-col space-y-1.5 p-6 pb-4 border-b border-[#E7E1D7]/40 dark:border-zinc-800/50 bg-black/[0.01] dark:bg-white/[0.01]">
          <h3 className="text-lg font-semibold leading-none tracking-tight text-[#1F2421] dark:text-zinc-100">
            {title}
          </h3>
        </div>
      )}
      <div className="flex-1">
        {children}
      </div>
      {footer && (
        <div className="bg-[#FBF9F5]/80 dark:bg-zinc-900/50 px-6 py-4 border-t border-[#E7E1D7] dark:border-zinc-800 flex items-center">
          <p className="text-[13px] text-muted-foreground">{footer}</p>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  icon?: React.ReactNode;
  label: React.ReactNode;
  description?: React.ReactNode;
  value?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function Row({ icon, label, description, value, badge, action, className }: RowProps) {
  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-center min-h-[68px] px-6 py-4 transition-colors duration-200",
      "hover:bg-[#FBF9F5]/80 dark:hover:bg-zinc-800/40 group",
      className
    )}>
      <div className="flex items-start sm:items-center sm:w-[35%] shrink-0 mb-3 sm:mb-0 pr-4">
        {icon && (
          <div className="mr-3 text-[#5C635D]/60 dark:text-zinc-500 flex-shrink-0 transition-all duration-300 group-hover:text-[#C4612F] group-hover:scale-110">
            {icon}
          </div>
        )}
        <div className="flex flex-col justify-center">
          <div className="text-[14px] text-[#1F2421] dark:text-zinc-200 font-medium">{label}</div>
          {description && <div className="text-[12px] text-[#5C635D] dark:text-zinc-400 mt-0.5 leading-relaxed">{description}</div>}
        </div>
      </div>
      <div className="flex-1 flex items-center gap-3 text-[14px] text-[#1F2421] dark:text-zinc-100 min-w-0">
        {value && <span className="truncate font-medium">{value}</span>}
        {badge}
      </div>
      {action && (
        <div className="shrink-0 mt-3 sm:mt-0 sm:ml-4 w-full sm:w-auto flex items-center justify-end">
          {action}
        </div>
      )}
    </div>
  );
}

export function Divider() {
  return <div className="h-[1px] bg-[#E7E1D7]/50 dark:bg-zinc-800 mx-6"></div>;
}

export function LiquidButton({
  children,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const base = "px-5 py-2.5 rounded-full text-[14px] font-medium transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] active:scale-[0.96] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-[#C4612F] text-white hover:bg-[#A94E22] shadow-[0_2px_12px_rgba(196,97,47,0.25)] hover:shadow-[0_4px_16px_rgba(196,97,47,0.35)] hover:-translate-y-0.5",
    secondary: "bg-white border-[1.5px] border-[#E7E1D7] text-[#1F2421] hover:bg-[#FBF9F5] hover:border-[#C4612F] dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 shadow-sm hover:shadow-md hover:-translate-y-0.5",
    danger: "bg-[#b42335] text-white hover:bg-[#8f1c2a] shadow-[0_2px_12px_rgba(180,35,53,0.25)] hover:shadow-[0_4px_16px_rgba(180,35,53,0.35)] hover:-translate-y-0.5",
  };

  return (
    <button className={cn(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}
