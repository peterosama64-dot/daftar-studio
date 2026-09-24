import Link from "next/link";
import { Brand, btnClass } from "./ui";

export function SiteNav() {
  return (
    <nav className="flex items-center justify-between gap-4 py-5">
      <Brand />
      <div className="hidden gap-6 text-[15px] text-ink2 md:flex">
        <Link href="/#how" className="hover:text-cyan">بيشتغل إزاي</Link>
        <Link href="/#money" className="hover:text-cyan">الفلوس</Link>
        <Link href="/#report" className="hover:text-cyan">التقرير</Link>
        <Link href="/pricing" className="hover:text-cyan">الأسعار</Link>
      </div>
      <div className="flex items-center gap-3"><Link href="/login" className="hidden text-[15px] text-ink2 hover:text-cyan sm:inline">ادخل</Link><Link href="/signup" className={btnClass("primary", true)}>افتح دفترك</Link></div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="flex flex-wrap justify-between gap-3 border-t border-rule py-6 text-[13px] text-muted">
      <span>دفتر الاستوديو · معمول لمصممين وآرت دايركتورز في مصر والخليج</span>
      <span className="num">© 2026</span>
    </footer>
  );
}
