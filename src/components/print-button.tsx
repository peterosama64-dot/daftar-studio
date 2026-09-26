"use client";

import { Button } from "./ui";

/** Opens the browser's print dialog; "Save as PDF" there gives a PDF with proper Arabic shaping. */
export function PrintButton({ file }: { file: string }) {
  function print() {
    const title = document.title;
    document.title = file; // becomes the suggested PDF file name
    window.print();
    document.title = title;
  }
  return <Button kind="secondary" small onClick={print} className="print:hidden">نزّل PDF</Button>;
}
