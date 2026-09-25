# دفتر الاستوديو

شغلك وفلوسك كمصمم أو آرت دايركتور في دفتر واحد. بتقول أو بتكتب اللي عندك، والدفتر يرتّبه لمهام ودخل واشتراكات ومصاريف، ويقولك المستعجل إيه وصافي ربحك كام.

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Prisma · Claude API. Arabic, RTL.

## التشغيل على جهازك

محتاج PostgreSQL شغال على جهازك (أو قاعدة مجانية على Neon أو Supabase).

```bash
npm install
cp .env.example .env      # حط رابط قاعدة البيانات و SESSION_SECRET
npx prisma migrate dev    # يعمل الجداول
npm run dev               # http://localhost:3000 ← اعمل حساب من /signup
```

| متغير | لازم؟ | بيعمل إيه |
|---|---|---|
| `POSTGRES_PRISMA_URL` | أيوه | رابط PostgreSQL الـ pooled. على Vercel بيتحط لوحده لما توصّل Supabase. |
| `POSTGRES_URL_NON_POOLING` | أيوه | رابط مباشر لنفس القاعدة، بيستخدمه Prisma للـ migrations. بيتحط لوحده برضه. |
| `SESSION_SECRET` | في الإنتاج أيوه | بيوقّع كوكي الدخول. ٣٢ حرف عشوائي على الأقل: `openssl rand -base64 48`. |
| `ANTHROPIC_API_KEY` | لأ | «رتّبهالي» والتقرير المكتوب بـ Claude. من غيره بيشتغل ترتيب مبدئي بسيط. |
| `APP_TIMEZONE` | لأ | الافتراضي `Africa/Cairo`. بيحدد «النهارده» إيه. |

## الرفع على Vercel

1. vercel.com ← **Add New… ← Project** ← اختار repo `daftar-studio` ← **Import**. (لو الـ deploy الأول وقع عشان قاعدة البيانات، عادي، كمّل.)
2. في المشروع: **Storage ← Create Database ← Supabase** (أو Connect لو عندك قاعدة Supabase). ده بيعمل القاعدة ويحط `POSTGRES_PRISMA_URL` و `POSTGRES_URL_NON_POOLING` لوحده.
3. **Settings ← Environment Variables** ضيف:
   - `SESSION_SECRET`: ٤٠ حرف عشوائي أو أكتر (أي كلام طويل ملخبط، ومتستخدموش في أي مكان تاني).
   - `ANTHROPIC_API_KEY` (اختياري): عشان «رتّبهالي» والتقرير يشتغلوا بـ Claude.
4. **Deployments ← آخر deploy ← Redeploy**. الـ build بيشغّل `prisma migrate deploy` لوحده ويعمل الجداول.
5. (اختياري) **Settings ← Domains** ضيف الدومين بتاعك.

⚠️ `prisma migrate deploy` بيطبّق الـ migrations الجديدة بس ومش بيمسح بيانات. ممنوع تشغّل `migrate dev` أو `migrate reset` على قاعدة الإنتاج: الاتنين ممكن يمسحوا البيانات.

## الأوامر

- `npm test` — اختبارات المنطق: تصنيف المهام، حساب الفلوس، التواريخ، الترتيب المبدئي، وتوكنات الدخول.
- `npx tsc --noEmit` — فحص الأنواع.
- `npm run build` — نسخة الإنتاج.

## الصفحات

| المسار | الصفحة |
|---|---|
| `/` | صفحة الهبوط |
| `/pricing` | الأسعار |
| `/signup` · `/login` | حساب جديد والدخول |
| `/app` | الرئيسية: فلوس الشهر، «قول أو اكتب»، المستعجل، الأسبوع ده |
| `/app/tasks` | بورد الشغل: مستعجل / ليه لسه شوية / خلصته |
| `/app/tasks/[id]` | تفاصيل مهمة: الحالة، المتفق عليه واللي اتدفع، ملاحظات |
| `/app/money` | الدخل والاشتراكات والمصاريف، ورسم آخر ٦ شهور |
| `/app/inbox` | لزق شات واتساب وتطليع المهام والمبالغ منه |
| `/app/report` | تقرير الشهر |
| `/app/clients` | العملاء واللي لسه مستحق |
| `/app/settings` | العملة والربط ومسح البيانات |

## المراحل

1. **✓ المرحلة ١:** كل الصفحات شغالة ببيانات حقيقية، التسجيل بالصوت، الترتيب بـ Claude، التقرير.
2. **✓ المرحلة ٢:** حسابات لكل مستخدم، وكل واحد يشوف بياناته بس، PostgreSQL، وجاهز للرفع على Vercel.
3. **المرحلة ٣:** ربط Gmail (OAuth) وقراءة إيصالات الاشتراكات.
4. **المرحلة ٤:** تذكيرات بالمواعيد، وتصدير التقرير PDF.

التصميم والهوية في `DESIGN.md`.
