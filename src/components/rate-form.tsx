"use client";

import { useState } from "react";
import { Button, inputClass } from "./ui";

/** Five tappable stars and an optional note; posts to the given server action. */
export function RateForm({ action }: { action: (f: FormData) => Promise<void> }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const shown = hover || stars;
  return (
    <form action={action} className="grid gap-3">
      <p className="font-semibold">إيه رأيك في الشغل؟</p>
      <div className="flex gap-1" role="radiogroup" aria-label="التقييم" dir="ltr" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} من 5`}
            onClick={() => setStars(n)} onMouseEnter={() => setHover(n)}
            className={`text-4xl leading-none ${n <= shown ? "text-wait" : "text-rule"}`}>★</button>
        ))}
      </div>
      <input type="hidden" name="stars" value={stars || ""} />
      <textarea name="note" rows={3} maxLength={600} placeholder="كلمة عن التعامل (اختياري)" aria-label="رأيك" className={inputClass} />
      <Button disabled={!stars} className="justify-self-start">ابعت التقييم</Button>
    </form>
  );
}
