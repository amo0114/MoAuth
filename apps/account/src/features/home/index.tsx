import { PublicShell } from "./components/PublicShell";
import { HeroSection } from "./components/HeroSection";
import { StatsSection } from "./components/StatsSection";
import { FeatureShowcase } from "./components/FeatureShowcase";
import { DeveloperSection } from "./components/DeveloperSection";
import { DeepDiveSecuritySection } from "./components/DeepDiveSecuritySection";
import { SecurityArchitecture } from "./components/SecurityArchitecture";
import { FaqSection } from "./components/FaqSection";
import { CtaSection } from "./components/CtaSection";
import { PublicFooter } from "./components/PublicFooter";

type HomePageProps = {
  user?: { email?: string | null } | null;
};

export function HomePage({ user }: HomePageProps) {
  return (
    <PublicShell user={user}>
      <HeroSection user={user} />
      <StatsSection />
      <FeatureShowcase />
      <DeveloperSection />
      <SecurityArchitecture />
      <DeepDiveSecuritySection />
      <FaqSection />
      <CtaSection user={user} />
      <PublicFooter />
    </PublicShell>
  );
}