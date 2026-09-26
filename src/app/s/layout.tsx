import type { Metadata } from "next";

// Public client links (quote / invoice). Not indexed; no app navigation.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto grid max-w-3xl gap-5 px-4 py-8 print:p-0">{children}</main>;
}
