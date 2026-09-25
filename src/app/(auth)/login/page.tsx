import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentUserId } from "@/lib/auth";

export const metadata = { title: "الدخول" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentUserId()) redirect("/app");
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-[32px] font-extrabold">أهلاً بيك في الدفتر</h1>
      <p className="text-ink2">ادخل عشان تكمّل شغلك من مكان ما سبته.</p>
      <AuthForm mode="login" next={next} />
    </>
  );
}
