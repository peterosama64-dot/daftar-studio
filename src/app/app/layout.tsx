import { Suspense } from "react";

// Every app page reads the database on each request.
export const dynamic = "force-dynamic";
import { Sidebar, TabBar } from "@/components/nav";
import { Brand } from "@/components/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Suspense><Sidebar /></Suspense>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between px-4 pt-4 lg:hidden print:hidden"><Brand href="/app" /></div>
        <main className="mx-auto grid max-w-[1120px] gap-6 px-4 pt-5 pb-32 lg:px-10 lg:pt-8 lg:pb-16 print:max-w-none print:p-0">{children}</main>
      </div>
      <Suspense><TabBar /></Suspense>
    </div>
  );
}
