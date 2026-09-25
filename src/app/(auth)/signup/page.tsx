import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentUserId } from "@/lib/auth";

export const metadata = { title: "حساب جديد" };

export default async function Signup() {
  if (await currentUserId()) redirect("/app");
  return (
    <>
      <h1 className="text-[32px] font-extrabold">افتح دفترك</h1>
      <p className="text-ink2">حساب واحد، وشغلك وفلوسك متسجّلين ليك انت بس.</p>
      <AuthForm mode="signup" />
    </>
  );
}
