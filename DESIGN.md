# Design System: Daftar el-Studio (دفتر الاستوديو)

A voice-first work and money notebook for freelance graphic designers and art directors in Egypt and the Gulf. The user speaks or pastes client messages; the app turns them into tasks, income, subscriptions and expenses, then reports what is done, what is urgent, and the month's net profit.

**All screens are Arabic, right-to-left (dir="rtl"), Egyptian colloquial copy.** Latin text (brand names such as Figma, Adobe, Gmail) and all numbers stay left-to-right inside the RTL flow.

## 1. Visual Theme & Atmosphere
A print-shop proof sheet turned into software. Calm off-white paper, one ink color, and a single process-cyan accent, like a registration mark on a press sheet. Small print-production details act as quiet signature: thin crop marks at the corners of the main card, a monospace slug line ("VOICE NOTE · 00:14", "REV 03", "REPORT · SEP 2026") above key panels, and a registration-mark logo (a thin circle crossed by two hairlines with a cyan dot in the center).

- Density: 5, "Daily App Balanced". Marketing pages 3, app dashboards 6.
- Variance: 7, "Offset Asymmetric". Uneven column splits (1.25 : 1, 1.4 : 1), never a centered hero.
- Motion: 5, "Fluid CSS". One orchestrated moment per screen, no scattered effects.

## 2. Color Palette & Roles
- **Proof Paper** (#F4F3EF): page background.
- **Sheet White** (#FBFBF9): cards, panels, inputs.
- **Press Ink** (#17181C): primary text and the primary button fill. Never pure black.
- **Second Ink** (#3B3D45): body paragraphs.
- **Pencil Grey** (#6C6E78): metadata, captions, slug lines.
- **Hairline** (#DCDAD3): 1px borders and dividers, dashed for soft separations.
- **Process Cyan** (#0B6E8A): the only accent. Mic button, active tab underline, focus rings, links, numbered steps. Soft tint #DBEEF3.

Semantic colors are separate from the accent and must never be swapped:
- **Money Green** (#1F7A4D, tint #DCEFE4): money received, net profit, "done".
- **Risk Red** (#B3261E, tint #F8E0DC): urgent, overdue, money going out.
- **Waiting Amber** (#9A5B0C, tint #F7ECD8): due within 3 days, subscriptions.

Dark mode: paper #111215, sheet #18191E, ink #EEEDF0, muted #9A9CA7, hairline #2B2D35, cyan #5CC2DC, green #5FD39A, red #FF8A80, amber #EFB25C.

## 3. Typography Rules
- **Display:** Alexandria (Arabic geometric), 700–800. Headlines are tight (line-height 1.12–1.2), and hierarchy comes from weight, not huge size. Hero size clamp(36px, 5.2vw, 64px). Section headings clamp(30px, 4.2vw, 48px).
- **Body:** Readex Pro 400/500, 16–17px, line-height 1.75, max 60 characters per line.
- **Mono:** JetBrains Mono 500/600 for every amount, date, count, time stamp and slug line, with tabular figures. Amounts show a sign and a thousands separator: +7,500 / −720.
- Banned: Inter, Cairo for headlines, any generic serif, all-caps Arabic tricks.

## 4. Component Stylings
- **Primary button:** Press Ink fill, Proof Paper text, 12px radius, 48px tall, Alexandria 600. Lifts 2px on hover and presses down 1px on click. No glow. One primary button per view.
- **Mic button:** 56px rounded square (14px radius) in Process Cyan tint with a cyan mic icon. While recording it turns Risk Red with a soft pulsing ring, and a small live waveform of thin cyan bars shows beside it.
- **Capture box:** a large textarea next to the mic button, with a 1px cyan border and a 4px cyan-tint halo, because it is the heart of the app. Under it sits the "رتّبهالي" button.
- **Review list (after capture):** rows with a pill on the start side (مستعجل red / دخل green / اشتراك amber / ليه وقت cyan), the text, and a mono value on the end side. Buttons: "احفظ الكل" and "إلغاء".
- **Task card:** Sheet White, 1px hairline, 12–14px radius, and a 4px colored stripe on the start (right) edge by state: red urgent, amber soon, cyan later, green done. A round checkbox and meta pills (client, due, source: "من الإيميل" / "من الشات" / "بالصوت"). Done cards have strikethrough text at 70% opacity.
- **Ledger table:** rows separated by hairlines, with amounts left-aligned in mono. Sub-rows (individual subscriptions) are indented and in Pencil Grey. The total row has a 2px ink top rule and a 22px bold label, with the net amount in Money Green (Risk Red if negative).
- **Pills:** 999px radius, 12px text, tinted background, no border.
- **Inputs:** label above, helper or error below, 10px radius, Proof Paper fill, cyan focus ring. No floating labels.
- **Loading:** skeleton blocks in the exact shape of the cards. No spinners.
- **Empty states:** a short line in Egyptian Arabic telling the user what to do next, with a dashed hairline box. Example: "لسه مخلصتش حاجة الشهر ده".
- Shadows are soft and tinted to ink: 0 18px 40px -24px rgba(23,24,28,.28). Use them only on the one panel that should float.

## 5. Layout Principles
- Max width 1200px centered, 16px minimum side gutter, CSS grid with gap for spacing.
- RTL: the start side is the right. The logo sits top-right, the primary nav action top-left.
- App shell (web): a slim right-side sidebar (icons + labels: الرئيسية، الشغل، الفلوس، الرسايل، التقرير، العملاء، الإعدادات), a top bar with a month switcher ("› سبتمبر 2026 ‹"), and a permanent money strip (دخلي / صرفت / صافي ربحي) at the top of the home, money and report screens.
- Never three equal cards in a row. Use uneven splits (1.25 : 1 : 0.9 for the task board), zig-zag rows, or ledger tables.
- Below 768px everything collapses to one column. No horizontal scroll, and touch targets are at least 44px.

## 6. Motion & Interaction
- Signature moment: a voice transcript types itself out, and each phrase lights up the task, income or subscription card it produced, one after another.
- Spring feel on buttons (overshoot ease), with 60ms staggered cascades when lists mount.
- Animate only transform and opacity. Respect reduced-motion by showing the final state.

## 7. Anti-Patterns (Banned)
- No emojis anywhere, including chat bubbles.
- No purple or blue neon gradients, glows, or gradient text.
- No centered hero, and no "scroll to explore" chevrons.
- No three equal feature cards.
- No mixing semantic colors: green is only money-in and done, red is only urgent and money-out.
- No fake round stats ("99%", "10x"), and no AI copy clichés (ارتقِ، سلس، الجيل القادم).
- No generic names. Use Egyptian studio clients such as كافيه سُكّر، مكتبة الكرمة، عيادة بسمة.
- No pure black (#000000), and no Inter.
