# CLAUDE.md — دفتر الاستوديو

Personal work + money notebook for freelance designers / art directors (Egypt & Gulf). Arabic RTL, Egyptian colloquial UI copy.

- Stack: Next.js 15 App Router, TypeScript, Tailwind v4 (tokens in `src/app/globals.css`), Prisma (SQLite dev → PostgreSQL prod), `@anthropic-ai/sdk`.
- Design system: `DESIGN.md`. One accent (Process Cyan). Green = money in / done only; red = urgent / money out only.
- Enum-like fields are strings; allowed values in `src/lib/constants.ts`.
- Pure logic lives in `src/lib/{tasks,money,dates,heuristic}.ts` with tests in `tests/`. Keep it pure and tested.
- All writes go through server actions in `src/app/app/actions.ts`.
- "Today" always comes from `now()` in `src/lib/dates.ts` (studio timezone), never `new Date()` directly.
- Claude calls live only in `src/lib/ai.ts`; everything must keep working without `ANTHROPIC_API_KEY` (offline parser fallback).
- Before declaring work done: `npm test`, `npx tsc --noEmit`, `npm run build`, and open the changed page in a browser.
