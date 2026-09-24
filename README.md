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
| `DATABASE_URL` | أيوه | رابط PostgreSQL. على Neon/Supabase استخدم الرابط الـ pooled. |
| `DIRECT_URL` | أيوه | رابط مباشر لنفس القاعدة، بيستخدمه Prisma للـ migrations. |
| `SESSION_SECRET` | في الإنتاج أيوه | بيوقّع كوكي الدخول. ٣٢ حرف عشوائي على الأقل: `openssl rand -base64 48`. |
| `ANTHROPIC_API_KEY` | لأ | «رتّبهالي» والتقرير المكتوب بـ Claude. من غيره بيشتغل ترتيب مبدئي بسيط. |
| `APP_TIMEZONE` | لأ | الافتراضي `Africa/Cairo`. بيحدد «النهارده» إيه. |

## الرفع على Vercel

1. اعمل قاعدة PostgreSQL (Neon أو Supabase) وخد الرابطين: pooled و direct.
2. على vercel.com: New Project ← اختار الـ repo ده.
3. في Environment Variables حط: `DATABASE_URL` و `DIRECT_URL` و `SESSION_SECRET` (و `ANTHROPIC_API_KEY` لو عايز Claude).
4. Build Command سيبه زي ما هو: Vercel بيشغّل `vercel-build` لوحده، وده بيعمل `prisma migrate deploy` قبل الـ build.
5. Deploy. وبعدها من Settings ← Domains ضيف الدومين بتاعك.

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
