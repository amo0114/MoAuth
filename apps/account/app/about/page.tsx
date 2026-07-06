import { cookies } from "next/headers";

import { getOptionalAccountUser } from "../../src/auth/require-account-session.js";
import { PublicShell } from "../../src/features/home/components/PublicShell";
import { PublicFooter } from "../../src/features/home/components/PublicFooter";
import { AboutHero } from "../../src/features/home/components/AboutHero";
import { AboutBentoGrid } from "../../src/features/home/components/AboutBentoGrid";
import { AboutContact } from "../../src/features/home/components/AboutContact";

export default async function AboutPage() {
  const cookieStore = await cookies();
  const user = getOptionalAccountUser(cookieStore);

  return (
    <PublicShell user={user}>
      <main className="flex-1 w-full flex flex-col items-center overflow-x-hidden">
        <AboutHero />
        <AboutBentoGrid />
        <AboutContact />
      </main>
      <PublicFooter />
    </PublicShell>
  );
}