"use client";

import type { ReactNode } from "react";

/** A submit button that asks the browser's "are you sure?" first. */
export function ConfirmButton({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  return <button className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>{children}</button>;
}
