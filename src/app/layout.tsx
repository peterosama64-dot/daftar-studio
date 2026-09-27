import type { Metadata, Viewport } from "next";
import { Alexandria, Readex_Pro, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const alexandria = Alexandria({ subsets: ["arabic", "latin"], weight: ["500", "600", "700", "800"], variable: "--font-alexandria" });
const readex = Readex_Pro({ subsets: ["arabic", "latin"], weight: ["400", "500", "600"], variable: "--font-readex" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: { default: "دفتر الاستوديو", template: "%s · دفتر الاستوديو" },
  description: "شغلك وفلوسك كمصمم في دفتر واحد: سجّل بصوتك، والدفتر يرتّب المهام والدخل والاشتراكات ويقولك صافي ربحك.",
};
export const viewport: Viewport = { themeColor: "#f4f3ef", viewportFit: "cover" };

// Runs before first paint so the chosen theme and text size never flash. Values come from cookies set in settings.
const PREFS = `(function(){try{var c=document.cookie,d=document.documentElement,t=/(?:^|; )theme=(light|dark)/.exec(c),z=/(?:^|; )size=(lg|xl)/.exec(c);if(t)d.dataset.theme=t[1];if(z)d.dataset.size=z[1];}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={`${alexandria.variable} ${readex.variable} ${jetbrains.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: PREFS }} /></head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
