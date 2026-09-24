import Link from "next/link";
import { btnClass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="grid gap-4">
        <p className="num text-sm text-muted">404</p>
        <h1 className="text-3xl font-bold">الصفحة دي مش موجودة</h1>
        <Link href="/app" className={btnClass()}>ارجع للدفتر</Link>
      </div>
    </div>
  );
}
