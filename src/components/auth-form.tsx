"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthState } from "@/app/(auth)/actions";
import { Button, Field, inputClass } from "./ui";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? login : signup, null);
  return (
    <form action={action} className="grid gap-4" noValidate>
      {mode === "signup" && <Field label="اسمك"><input name="name" autoComplete="name" defaultValue={state?.name} className={inputClass} /></Field>}
      <Field label="الإيميل">
        <input name="email" type="email" required autoComplete="email" dir="ltr" defaultValue={state?.email} className={`${inputClass} text-left`} />
      </Field>
      <Field label="كلمة السر" hint={mode === "signup" ? <span className="text-xs text-muted">٨ حروف على الأقل</span> : undefined}>
        <input name="password" type="password" required minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "signup" ? "new-password" : "current-password"} dir="ltr"
          className={`${inputClass} text-left ${state?.error ? "border-risk" : ""}`} aria-invalid={!!state?.error} />
      </Field>
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && <p role="alert" className="text-sm text-risk">{state.error}</p>}
      <Button disabled={pending}>{pending ? "لحظة…" : mode === "login" ? "ادخل" : "اعمل حساب"}</Button>
      <p className="text-center text-sm text-muted">
        {mode === "login"
          ? <>معندكش حساب؟ <Link href="/signup" className="font-semibold text-cyan">اعمل حساب</Link></>
          : <>عندك حساب؟ <Link href="/login" className="font-semibold text-cyan">سجّل دخول</Link></>}
      </p>
    </form>
  );
}
