"use client";

import {
  Activity,
  Database,
  Fingerprint,
  Globe2,
  KeyRound,
  LockKeyhole,
  Route,
  Server,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

const TECHNOLOGIES = [
  { name: "OIDC", icon: Globe2 },
  { name: "Authorization Code", icon: Route },
  { name: "PKCE S256", icon: KeyRound },
  { name: "Connect Gateway", icon: ShieldCheck },
  { name: "Account Center", icon: UserCheck },
  { name: "Zitadel Core", icon: Server },
  { name: "Local Session", icon: LockKeyhole },
  { name: "Audit Events", icon: Activity },
  { name: "Allowlist", icon: Database },
  { name: "Passkey Roadmap", icon: Fingerprint },
];

export function StatsSection() {
  return (
    <section className="border-y border-black/5 dark:border-white/[0.12] bg-black/[0.02] dark:bg-white/[0.03] py-10 overflow-hidden relative">
      {/* Gradient masks for smooth fade in/out at edges */}
      <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-white dark:from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-white dark:from-[#0a0a0a] to-transparent z-10 pointer-events-none" />

      <div className="mx-auto flex w-full max-w-7xl flex-col items-center relative overflow-hidden">
        <div className="mb-6 text-sm font-medium text-muted-foreground uppercase tracking-widest text-center relative w-full">
          <span className="relative z-10 bg-black/[0.02] dark:bg-[#0a0a0a] px-4">安全支撑以下业务</span>
          <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent -z-10" />
        </div>

        <div className="flex w-full items-center">
          {/* Track 1 */}
          <div className="flex shrink-0 animate-marquee motion-reduce:animate-none whitespace-nowrap">
            {TECHNOLOGIES.map((tech, i) => (
              <div
                key={i}
                className="mx-8 flex items-center justify-center gap-2 text-xl font-bold tracking-tight text-black/40 dark:text-white/40 transition-all duration-300 ease-out hover:text-black/80 dark:hover:text-white/80 hover:scale-110 cursor-default"
              >
                <tech.icon className="size-5 transition-transform duration-300" />
                {tech.name}
              </div>
            ))}
          </div>
          {/* Track 2 (Duplicate for seamless loop) */}
          <div className="flex shrink-0 animate-marquee motion-reduce:animate-none whitespace-nowrap" aria-hidden="true">
            {TECHNOLOGIES.map((tech, i) => (
              <div
                key={`second-${i}`}
                className="mx-8 flex items-center justify-center gap-2 text-xl font-bold tracking-tight text-black/40 dark:text-white/40 transition-all duration-300 ease-out hover:text-black/80 dark:hover:text-white/80 hover:scale-110 cursor-default"
              >
                <tech.icon className="size-5 transition-transform duration-300" />
                {tech.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
