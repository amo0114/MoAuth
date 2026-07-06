import { cookies } from "next/headers";
import { getOptionalAccountUser } from "../../src/auth/require-account-session.js";
import { PublicShell } from "../../src/features/home/components/PublicShell";
import { DocsSidebar } from "../../src/features/docs/components/DocsSidebar";
import { DocsToc } from "../../src/features/docs/components/DocsToc";
import { DocsBreadcrumb } from "../../src/features/docs/components/DocsBreadcrumb";
import { PublicFooter } from "../../src/features/home/components/PublicFooter";

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const user = getOptionalAccountUser(cookieStore);

  return (
    <PublicShell user={user}>
      <div className="flex-1 w-full border-b border-black/5 dark:border-white/5">
        <div className="mx-auto flex max-w-[1400px] items-start px-6">
          {/* Left Sidebar */}
          <aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 md:sticky md:block md:w-[240px] lg:w-[280px]">
            <div className="h-full overflow-y-auto py-8 pr-6">
              <DocsSidebar />
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="relative py-8 lg:gap-10 lg:py-10 xl:grid xl:grid-cols-[1fr_240px] flex-1 min-w-0">
            <div className="mx-auto w-full min-w-0 max-w-3xl">
              <DocsBreadcrumb />
              <article className="prose prose-gray dark:prose-invert max-w-none prose-headings:font-artistic prose-a:text-primary">
                {children}
              </article>
            </div>

            {/* Right TOC */}
            <div className="hidden text-sm xl:block">
              <div className="sticky top-20 -mt-10 h-[calc(100vh-3.5rem)] pt-10">
                <div className="h-full overflow-y-auto pb-10">
                  <DocsToc />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      <PublicFooter />
    </PublicShell>
  );
}
