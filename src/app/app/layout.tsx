import { Suspense } from "react";

// Every app page reads the database on each request.
export const dynamic = "force-dynamic";
import { Sidebar, TabBar } from "@/components/nav";
import Link from "next/link";
import { Brand } from "@/components/ui";
import { OfflineKit } from "@/components/offline-kit";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const uid = await requireUser();
  return (
    <div className="flex min-h-dvh">
      <Suspense><Sidebar /></Suspense>
      <div className="min-w-0 flex-1">
        <OfflineKit uid={uid} />
        <div className="flex items-center justify-between px-4 pt-4 lg:hidden print:hidden">
          <Brand href="/app" />
          <Link href="/app/search" aria-label="بحث" className="grid size-10 place-items-center rounded-xl border border-rule bg-sheet text-muted hover:text-ink">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          </Link>
        </div>
        <main className="mx-auto grid max-w-[1120px] gap-6 px-4 pt-5 pb-32 lg:px-10 lg:pt-8 lg:pb-16 print:max-w-none print:gap-3 print:p-0">{children}</main>
      </div>
      <Suspense><TabBar /></Suspense>
    </div>
  );
}
