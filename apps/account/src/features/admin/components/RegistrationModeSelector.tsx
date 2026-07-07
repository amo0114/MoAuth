"use client";

import * as React from "react";
import { cn } from "../../../lib/utils.js";

export type RegistrationMode = "open" | "closed" | "review" | "invite";

interface ModeOption {
  value: RegistrationMode;
  label: string;
  description: string;
}

const MODES: ModeOption[] = [
  {
    value: "open",
    label: "开放注册",
    description: "任何用户可自行注册，无需审核。",
  },
  {
    value: "closed",
    label: "关闭注册",
    description: "禁止新用户注册，注册页面将提示关闭信息。",
  },
  {
    value: "review",
    label: "审核注册",
    description: "新用户注册后需管理员审核通过方可登录。",
  },
  {
    value: "invite",
    label: "邀请码注册",
    description: "仅持有效邀请码的用户可以注册。",
  },
];

interface RegistrationModeSelectorProps {
  value: RegistrationMode;
  onChange: (mode: RegistrationMode) => void;
}

export function RegistrationModeSelector({ value, onChange }: RegistrationModeSelectorProps) {
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      {MODES.map((mode) => {
        const selected = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            className={cn(
              "flex flex-col gap-1 rounded-lg border p-4 text-left transition-all duration-200",
              selected
                ? "border-blue-500 bg-blue-50/50 shadow-sm dark:border-blue-400 dark:bg-blue-950/30"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
            )}
          >
            <span
              className={cn(
                "text-sm font-medium",
                selected
                  ? "text-blue-700 dark:text-blue-300"
                  : "text-slate-900 dark:text-zinc-100"
              )}
            >
              {mode.label}
            </span>
            <span
              className={cn(
                "text-xs leading-relaxed",
                selected
                  ? "text-blue-600/80 dark:text-blue-300/80"
                  : "text-slate-500 dark:text-zinc-400"
              )}
            >
              {mode.description}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}
