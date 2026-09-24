# CLAUDE.md — دفتر الاستوديو

Personal work + money notebook for freelance designers / art directors (Egypt & Gulf). Arabic RTL, Egyptian colloquial UI copy.

- Stack: Next.js 15 App Router, TypeScript, Tailwind v4 (tokens in `src/app/globals.css`), Prisma + PostgreSQL, `@anthropic-ai/sdk`.
- Design system: `DESIGN.md`. One accent (Process Cyan). Green = money in / done only; red = urgent / money out only.
- Enum-like fields are strings; allowed values in `src/lib/constants.ts`.
- Pure logic lives in `src/lib/{tasks,money,dates,heuristic}.ts` with tests in `tests/`. Keep it pure and tested.
- All writes go through server actions in `src/app/app/actions.ts`.
- **Every query is scoped to the signed-in user.** Pages/actions start with `requireUser()` (`src/lib/auth.ts`); reads filter `where: { userId }`; updates/deletes use `updateMany`/`deleteMany` with `{ id, userId }`. Never `findUnique({ where: { id } })` on user data.
- Sessions: HS256 JWT in the `daftar_session` httpOnly cookie (`src/lib/session.ts`); middleware only gates, pages re-check the user exists.
- **Production database:** apply schema changes only with `prisma migrate deploy` (the `vercel-build` script). Never run `migrate dev`, `migrate reset`, `db push --force-reset`, or anything with a shadow database against production — they can wipe it. Create migrations against a local throwaway database.
- "Today" always comes from `now()` in `src/lib/dates.ts` (studio timezone), never `new Date()` directly.
- Claude calls live only in `src/lib/ai.ts`; everything must keep working without `ANTHROPIC_API_KEY` (offline parser fallback).
- Before declaring work done: `npm test`, `npx tsc --noEmit`, `npm run build`, and open the changed page in a browser.
