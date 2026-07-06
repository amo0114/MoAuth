"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

import { cn } from "../../../lib/utils.js";

interface AuthLayoutProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

const authBackgroundBlur =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMjQnIGhlaWdodD0nMjQnIHZpZXdCb3g9JzAgMCAyNCAyNCcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJz48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9J2EnIHgxPScwJyB5MT0nMCcgeDI9JzEnIHkyPScxJz48c3RvcCBzdG9wLWNvbG9yPScjZTVlNWVhJy8+PHN0b3Agb2Zmc2V0PScwLjUyJyBzdG9wLWNvbG9yPScjZjhmN2YyJy8+PHN0b3Agb2Zmc2V0PScxJyBzdG9wLWNvbG9yPScjZDhlNmYzJy8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3QgZmlsbD0ndXJsKCNhKScgd2lkdGg9JzI0JyBoZWlnaHQ9JzI0Jy8+PC9zdmc+";

export function AuthLayout({ children, className, contentClassName }: AuthLayoutProps) {
  const [mobileLoaded, setMobileLoaded] = useState(false);
  const [desktopLoaded, setDesktopLoaded] = useState(false);

  return (
    <main
      className={cn(
        "relative flex min-h-[100dvh] items-center justify-center overflow-hidden p-4 sm:p-6",
        "bg-[#E5E5EA]",
        className
      )}
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div
        className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.92),transparent_34%),radial-gradient(circle_at_82%_16%,rgba(199,220,246,0.62),transparent_36%),radial-gradient(circle_at_50%_88%,rgba(244,231,218,0.7),transparent_44%),linear-gradient(135deg,#f7f6f2_0%,#e9edf4_48%,#dfe7ef_100%)]"
        aria-hidden="true"
      />

      <Image
        src="/images/b8669e7e-c3a0-4167-a21a-7df0c5a3b5ae-phone.png"
        alt=""
        fill
        priority
        sizes="100vw"
        placeholder="blur"
        blurDataURL={authBackgroundBlur}
        quality={84}
        onLoad={() => setMobileLoaded(true)}
        className={cn(
          "z-0 object-cover object-[50%_46%] transition-[opacity,filter,transform] duration-700 ease-out sm:hidden",
          mobileLoaded ? "opacity-100 blur-0 scale-100" : "opacity-70 blur-md scale-[1.02]"
        )}
      />
      <Image
        src="/images/cd2f7715-432a-4bcf-acfc-99fbe4f80023.png"
        alt=""
        fill
        priority
        sizes="100vw"
        placeholder="blur"
        blurDataURL={authBackgroundBlur}
        quality={84}
        onLoad={() => setDesktopLoaded(true)}
        className={cn(
          "z-0 hidden object-cover object-[52%_50%] transition-[opacity,filter,transform] duration-700 ease-out sm:block lg:object-[50%_50%]",
          desktopLoaded ? "opacity-100 blur-0 scale-100" : "opacity-70 blur-md scale-[1.02]"
        )}
      />

      <div className="absolute inset-0 z-0 bg-white/10" aria-hidden="true" />

      <div className="absolute top-[-10%] left-[-10%] z-0 h-[120%] w-[120%] pointer-events-none opacity-40 mix-blend-multiply sm:opacity-50">
        <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-blue-100 mix-blend-multiply blur-[80px] will-change-transform sm:h-96 sm:w-96 sm:blur-[100px] auth-blob-motion" />
        <div className="absolute top-1/3 right-1/4 h-72 w-72 rounded-full bg-purple-50 mix-blend-multiply blur-[100px] will-change-transform sm:h-96 sm:w-96 sm:blur-[120px] auth-blob-motion auth-blob-motion-delay" />
      </div>

      <div className={cn("relative z-10 w-full max-w-[420px]", contentClassName)}>
        {children}
      </div>
    </main>
  );
}
