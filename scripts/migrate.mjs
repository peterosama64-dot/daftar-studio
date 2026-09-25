// Runs `prisma migrate deploy` for vercel-build, with one narrow repair.
//
// Production once ended up with the init migration's tables in place but its
// row in _prisma_migrations missing or marked failed (P3018 "already exists",
// then P3009 on every later deploy). If — and only if — that happens for the
// init migration AND every table, index and foreign key it creates is really
// there, mark it applied and deploy again. Anything else fails the build as usual.
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const INIT = "20260924231834_init";

function sh(cmd) {
  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: "pipe" });
    process.stdout.write(out);
    return { ok: true, out };
  } catch (e) {
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    process.stdout.write(out);
    return { ok: false, out };
  }
}

async function initSchemaComplete() {
  const db = new PrismaClient({ datasourceUrl: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL });
  try {
    const [row] = await db.$queryRawUnsafe(`
      SELECT
        (SELECT count(*) FROM pg_tables WHERE schemaname = current_schema() AND tablename IN ('User','Task','Entry'))::int AS tables,
        (SELECT count(*) FROM pg_indexes WHERE schemaname = current_schema() AND indexname IN ('User_email_key','Task_userId_status_idx','Entry_userId_kind_idx'))::int AS indexes,
        (SELECT count(*) FROM pg_constraint WHERE conname IN ('Task_userId_fkey','Entry_userId_fkey'))::int AS fks`);
    return row.tables === 3 && row.indexes === 3 && row.fks === 2;
  } finally {
    await db.$disconnect();
  }
}

const first = sh("npx prisma migrate deploy");
if (first.ok) process.exit(0);

const stuckInit = /P3009|P3018/.test(first.out) && first.out.includes(INIT);
if (!stuckInit) process.exit(1);
if (!(await initSchemaComplete())) {
  console.error(`\n[migrate] ${INIT} is stuck and its tables are NOT all there. Not touching it.`);
  process.exit(1);
}

console.log(`\n[migrate] ${INIT}: tables already exist, marking it applied.`);
sh(`npx prisma migrate resolve --rolled-back ${INIT}`); // clears a failed row; harmless if there is none
if (!sh(`npx prisma migrate resolve --applied ${INIT}`).ok) process.exit(1);
process.exit(sh("npx prisma migrate deploy").ok ? 0 : 1);
