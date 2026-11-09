# StrokeAegis — جرد الشاشات ومتطلبات التصميم

> مرجع للمصمم (أو أداة تصميم مثل Stitch) عشان يصمم الواجهات، وبعدها تندمج في الكود الحالي (`frontend/`).
> الألوان والخطوط والمسافات: **`DESIGN.md`** — لازم أي تصميم يلتزم فيه.

---

## 0. الملخص: كم شاشة؟

| النوع | العدد | ملاحظة |
|---|---|---|
| شاشات رئيسية | **9** | الدخول، 3 بوابات، 2 حالات حساب، اختيار النظام، نظامين تحليل |
| تبويبات داخل البوابات | **15** | دكتور 3 · مريض 5 · أدمن 7 |
| نوافذ منبثقة (Modals) | **13** | + نافذة الشات بوت |
| **المجموع** | **~38 سطح تصميم** | كل واحد × (فاتح + داكن) × (عربي RTL + إنجليزي LTR) |

### أولوية التصميم (ابدأ بهذي)

| # | الشاشة | ليش |
|---|---|---|
| 1 | الدخول / التسجيل `screen-landing` | أول شي يشوفه أي أحد — الانطباع الأول |
| 2 | بوابة الدكتور — دليل المرضى | أكثر شاشة تُستخدم |
| 3 | نظام الذكاء الاصطناعي (4 خطوات) `screen-ai-system` | قلب المشروع — هذا اللي بتعرضونه |
| 4 | بوابة المريض — الفحص الذاتي | الواجهة الوحيدة للمريض |
| 5 | لوحة الأدمن — نظرة عامة | |
| 6 | النظام العادي `screen-regular-system` | |
| 7 | الهيدر المشترك + نافذة نتيجة الخطر | تتكرر في كل مكان |
| 8 | الباقي (تبويبات ثانوية، Modals) | يورث من التصاميم اللي فوق |

---

## 1. متطلبات عامة (لكل الشاشات)

**الهوية:** حسب `DESIGN.md` — teal طبي `#0E7490`، أخضر `#047857`، Figtree + Noto Sans Arabic. ❌ بنفسجي، نيون، Neumorphism.

**لازم كل تصميم يدعم:**
- [ ] **عربي (RTL) وإنجليزي (LTR)** — الموقع يقلب الاتجاه كامل.
- [ ] **فاتح وداكن** — الاثنين، مو واحد.
- [ ] **العروض:** 375px (جوال) · 768px (تابلت) · 1440px (ديسكتوب).
- [ ] **ألوان الخطر ثابتة المعنى:** أحمر = عالي/نزيف، برتقالي = متوسط/إقفاري، أخضر = منخفض/طبيعي. ودايماً **أيقونة + نص** مع اللون.
- [ ] **الحالات:** تحميل (loading) · فاضي (empty) · خطأ (error) لكل جدول وقائمة.
- [ ] أزرار ارتفاعها ≥ 44px على الجوال، وfocus ظاهر.

**الهيدر المشترك (موجود في كل الشاشات):**
شعار StrokeAegis AI · مبدّل اللغة (EN | عربي) · مبدّل الثيم (شمس/قمر) · جرس الإشعارات (بعد الدخول) · شارة المستخدم (الاسم + الدور + زر خروج) أو زر "تسجيل الدخول".

**عناصر عائمة:** زر الشات بوت (روبوت) في الزاوية السفلية.

---

## 2. الشاشات الرئيسية

### 2.1 الدخول والتسجيل — `screen-landing`
**المستخدم:** الكل (زائر). **الغرض:** تعريف بالمنصة + دخول/تسجيل.

**الأقسام:**
1. **Hero:** شارة "طب الأعصاب السريري الدقيق" · عنوان "ابدأ بناء رعاية دقيقة مع StrokeAegis AI" · وصف سطرين · فقاعة ترحيب + صورة الروبوت الطبي.
2. **4 بطاقات مميزات:** بوابة ConvNeXt (حاجز أمان الأشعة) · EfficientNetV2-S (Grad-CAM) · التعلم الآلي الوعائي · 4 وكلاء CrewAI.
3. **بطاقة الدخول:**
   - تبويبين: تسجيل الدخول | إنشاء حساب
   - اختيار الدور: طبيب / مريض (بطاقتين قابلة للاختيار)
   - دخول: البريد · كلمة المرور (مع إظهار/إخفاء) · زر "تسجيل الدخول كطبيب/كمريض"
   - تسجيل **طبيب**: الاسم · رقم الترخيص · التخصص · المستشفى
   - تسجيل **مريض**: الاسم · تاريخ الميلاد · الجنس · رقم قريب للطوارئ
   - **دخول سريع (ديمو):** 3 أزرار — طبيب / مريض / أدمن
4. فوتر.

**الحالات:** خطأ دخول · جاري الدخول · نجاح التسجيل.

---

### 2.2 بوابة الدكتور — `screen-doctor-portal`
**المستخدم:** طبيب معتمد.

**رأس البوابة:** أيقونة + "مساحة عمل استشاري طب المخ والأعصاب" · اسم الدكتور · التخصص • المستشفى • رقم الترخيص.
**4 إحصائيات:** المرضى النشطين · تقارير تنتظر التوقيع (مميزة بالبرتقالي) · إجمالي التقييمات · رسائل غير مقروءة.
**تنقل:** دليل المرضى · التقارير والاعتماد (عدّاد) · مراسلات المرضى (عدّاد) · **زرين مميزين:** تشغيل نظام الذكاء الاصطناعي · النماذج المباشرة.

| التبويب | المحتوى |
|---|---|
| **دليل المرضى** `doc-pane-patients` | بحث · إضافة مريض · تحديث · **جدول:** المريض (أفاتار+اسم+بريد) · رقم الملف MRN · العمر والجنس · الحالة (Active + Care Team/Primary) · آخر تقييم (شارة خطر + التشخيص) · إجراءات (Launch AI · History · Message) |
| **التقارير والاعتماد** `doc-pane-reports` | جدول: رقم التقرير/PDF · المريض · التاريخ · النتائج · تحقق الوكلاء · توقيع الطبيب · إجراءات (توقيع/تحميل) |
| **المراسلات** `doc-pane-chat` | تخطيط محادثة: قائمة المحادثات (يسار/يمين) + نافذة الرسائل + حقل إرسال |

> ⚠️ الجدول لازم له **نسخة جوال** (بطاقات بدل جدول) — حالياً يتمرر جانبي.

---

### 2.3 بوابة المريض — `screen-patient-portal`
**المستخدم:** مريض. **رأس:** "البوابة الصحية الشخصية" · 4 إحصائيات (تقييماتي · تقاريري المعتمدة · رسائل الطبيب · **مستوى الخطر الأخير**).

| التبويب | المحتوى |
|---|---|
| **الفحص الذاتي** `pat-pane-selfcheck` | عنوان "التقييم الفوري لمخاطر الأوعية الدماغية" · **9 حقول** كل واحد عليه وسم صغير (Baseline/Vital/Metabolic/Lifestyle/Demographic): العمر · الجنس · ضغط الدم · أمراض القلب · الجلوكوز · BMI · التدخين · الحالة الاجتماعية · السكن · زر "احسب خطر السكتة" |
| **نتائجي وصوري** `pat-pane-results` | سجل زمني للتقييمات (timeline) |
| **تقاريري المعتمدة** `pat-pane-reports` | قائمة تقارير قابلة للتحميل |
| **طبيبي والفريق** `pat-pane-doctor` | بطاقة الطبيب المشرف · فريق الرعاية · زر "ابحث عن طبيب" · طلبات معلّقة |
| **محادثة الطبيب** `pat-pane-chat` | محادثة واحدة مع الطبيب · حالة "ما عندك طبيب مشرف" |

---

### 2.4 لوحة الأدمن — `screen-admin-dashboard`
**المستخدم:** مدير النظام. **رأس:** "حوكمة النظام السريري" · **6 إحصائيات:** أطباء نشطين · طلبات اعتماد · مرضى مسجلين · تقييمات اليوم · تنبيهات السلامة (أحمر) · حوادث مفتوحة.

| التبويب | المحتوى |
|---|---|
| **نظرة عامة** | أشرطة توزيع الحالات (6 أشرطة ملونة) · حالة الأنظمة · آخر الأحداث (جدول) |
| **اعتماد الأطباء** | فلاتر (الكل/معلّق/معلومات إضافية/معتمد/موقوف/مرفوض) · جدول + أزرار (اعتماد/طلب معلومات/رفض/إيقاف) |
| **طابور السلامة** | فلاتر · جدول حالات (التشخيص، مستوى الخطر، الطبيب المسؤول) |
| **المستخدمين** | فلاتر حسب الدور · جدول + مفتاح تفعيل/إيقاف |
| **مراقبة النماذج** | بطاقات لكل نموذج AI (عدد الاستدلالات، الأخطاء، نسبة الخطأ) |
| **سجل التدقيق** | جدول + تصدير CSV |
| **صحة النظام** | بانر حالة عام · سجل الحوادث · زر "تسجيل حادثة" |

---

### 2.5 حالات الحساب
- **`screen-doctor-pending`** — "طلبك قيد المراجعة": رسالة حالة · (لو الأدمن طلب معلومات) نموذج: رقم ترخيص محدّث · مستشفى · توضيح* · أزرار: إعادة الإرسال · تحقق من الحالة · خروج.
- **`screen-restricted-access`** — "الحساب مقيّد": أيقونة تحذير · السبب · زر رجوع للدخول.

---

### 2.6 اختيار نظام التحليل — `screen-home`
بطاقتين كبار جنب بعض:
- **الخيار 1 — نظام الذكاء الاصطناعي:** سير عمل كامل 4 خطوات مع 4 وكلاء CrewAI → زر "تشغيل".
- **الخيار 2 — النظام العادي:** وصول مباشر للنماذج → زر "اختر المسار".

---

### 2.7 نظام الذكاء الاصطناعي (Wizard) — `screen-ai-system` ⭐
**أهم شاشة للعرض.** شريط خطوات (Stepper) بـ 4 خطوات:

1. **ملف المريض:** 3 أزرار حالات جاهزة (خطر عالي/متوسط/منخفض) + مسح · **10 حقول:** الجنس* · العمر* · التدخين* · الحالة الاجتماعية · نوع العمل · السكن · ضغط الدم* · أمراض القلب* · الجلوكوز* · BMI* → "التالي".
2. **صورة الأشعة المقطعية:** منطقة سحب وإفلات · معاينة الصورة · 4 عينات جاهزة (نزيف/إقفاري/طبيعي/صورة مو دماغ) → "تشغيل التحليل الكامل".
3. **مراقب الوكلاء:** 4 وكلاء (وقاية · طوارئ · تحقق · تقرير) — كل واحد بحالته (ينتظر/يشتغل/خلص) + سجل نشاط مباشر.
4. **حزمة القرار السريري:** النتيجة النهائية · خريطة Grad-CAM · مستوى الخطر · توصيات · تحميل PDF · "تحليل مريض جديد".

**الحالات:** رفض الصورة (مو أشعة دماغ) · فشل وكيل · جاري التحليل.

---

### 2.8 النظام العادي — `screen-regular-system`
اختيار مسار (تبويبين):
- **المسار A — تقييم الخطر (ML):** حالات جاهزة · 7 حقول · زر حساب → **نتيجة:** عدّاد دائري (gauge) بالنسبة % + شارة المستوى + وصف.
- **المسار B — تشخيص الأشعة:** رفع صورة → **نتيجة:** بوابة الأمان (قبول/رفض) · التشخيص · خريطة Grad-CAM.

---

## 3. النوافذ المنبثقة (Modals)

| النافذة | المحتوى |
|---|---|
| `modal-selfcheck-result` | نتيجة فحص المريض: المستوى + النسبة + العوامل المساهمة + "تم الحفظ" |
| `modal-patient-history` | تاريخ مريض: رسم زمني للتقييمات + قائمة التقارير |
| `modal-launch-ai-choice` | تشغيل AI: لمريض محدد (قائمة) أو مستقل |
| `modal-admit-patient` | إضافة مريض بالبريد |
| `modal-find-doctor` | بحث عن طبيب + بطاقات نتائج |
| `modal-notifications-drawer` | درج إشعارات جانبي + "قراءة الكل" |
| `modal-admin-approve-clinician` | اعتماد طبيب: مرجع التحقق* + ملاحظات* |
| `modal-admin-action-reason` | سبب الإجراء (رفض/إيقاف) |
| `modal-admin-safety-details` | تفاصيل حالة سلامة |
| `modal-admin-safety-assign` | إسناد حالة لطبيب |
| `modal-admin-investigate` | نتيجة التحقيق |
| `modal-admin-incident` | تسجيل حادثة: الخدمة · الخطورة · النوع · الوصف |
| `modal-admin-audit-detail` | تفاصيل سجل تدقيق (JSON) |
| `chatbot-modal` | شات بوت طبي: رسائل + 3 أسئلة مقترحة + حقل كتابة |

> نصيحة: صمّم **قالب modal واحد** (هيدر + جسم + أزرار) والباقي يتبعه.

---

## 4. شروط الدمج (عشان أقدر أدمج التصميم بدون ما ينكسر شي)

**اللي يقدر يتغيّر بحرية:** التخطيط، الترتيب، الأحجام، الأيقونات، الزخرفة، المسافات.

**اللي ما يتغيّر:**
1. **الحقول والبيانات** — نفس الحقول بالضبط (الباك إند ينتظرها). لا تحذف حقل.
2. **التدفق** — نفس الخطوات والتبويبات (ممكن تغيّر شكلها).
3. **الـ IDs** في الكود (`screen-*`, `doc-pane-*` …) — أنا أحافظ عليها وقت الدمج، المصمم ما يحتاج يهتم.

**وش أحتاج منك لكل شاشة:**
- صورة التصميم (PNG) **أو** كود HTML المصدّر من Stitch — الكود أفضل (أدق).
- فاتح وداكن (لو صممت واحد بس، أطلّع الثاني من الـ tokens).
- نسخة الجوال للشاشات المهمة (1–4).

**طريقة الدمج:** أنا ما أنسخ كود Stitch كما هو (هو Tailwind/React غالباً، ومشروعنا HTML/CSS عادي). آخذ التصميم وأطبّقه على الكود الحالي بالـ tokens حق `DESIGN.md`، شاشة شاشة، وكل شاشة commit لحالها.

---

## 5. Prompts جاهزة لأداة التصميم

> انسخ الـ prompt + ارفع `DESIGN.md` كـ design system. الإنجليزي يعطي نتائج أدق في أدوات التصميم.

**ثابت لكل prompt (حطه في الأول):**
```
Medical AI platform "StrokeAegis" for stroke risk & CT diagnosis. Calm clinical style, NOT neumorphism, no purple/neon.
Colors: primary teal #0E7490, success #047857, warning #B45309, danger #DC2626, bg #F7FAFA, surface #FFFFFF, text #0F2A2E, muted #5B6B7A, border #D7E3E6.
Fonts: Figtree (Latin), Noto Sans Arabic (Arabic). Radius 10px buttons, 16px cards. Buttons 44px tall.
Arabic RTL layout. Header: logo left, language toggle, theme toggle, notifications bell, user badge.
```

**1 — الدخول:**
```
Landing + auth page. Hero with badge, headline "Start Building Precision Care with StrokeAegis AI", 2-line description, friendly medical robot illustration.
4 small feature cards (ConvNeXt CT gate, EfficientNetV2 Grad-CAM, Vascular ML, 4 CrewAI agents).
Auth card: tabs Sign in / Create account; role selector cards Doctor / Patient; email, password; primary button; "Fast demo access" with 3 small buttons (Doctor, Patient, Admin).
```

**2 — دليل مرضى الطبيب:**
```
Doctor workspace dashboard. Profile header card (name, specialty, hospital, license). 4 KPI tiles (active patients, reports pending sign-off highlighted amber, total assessments, unread messages).
Tab bar: Patients, Reports & Sign-off (badge), Messages (badge) + 2 accent buttons: Launch AI System, Live Models.
Patients table: avatar+name+email, MRN (mono), age/gender, status pills, latest risk badge (High red / Moderate amber / Low green, with % and diagnosis on second line), actions (Launch AI primary, History, Message). Search + Add patient. Mobile: rows become cards.
```

**3 — نظام الذكاء الاصطناعي:**
```
4-step clinical AI wizard with horizontal stepper: 1 Patient profile, 2 Brain CT scan, 3 Agent monitor, 4 Decision package.
Show step 3: four agent cards (Prevention, Emergency, Validation, Report) each with status (queued/running/done), progress, and a live activity log panel. Professional, data-dense but calm.
```

**4 — فحص المريض:**
```
Patient self-check form "Instant Cerebrovascular Risk Evaluation". 9 fields in a 3-column grid, each with a tiny category tag (Baseline, Vital factor, Metabolic, Lifestyle, Demographic): age, gender, hypertension, heart disease, glucose, BMI, smoking, married, residence. Big primary button "Calculate my stroke risk".
Result modal: risk tier with color + icon, probability capsule, contributing factors list, "saved to your record" note.
```

**5 — لوحة الأدمن:**
```
Admin governance dashboard. 6 KPI tiles (active doctors, pending approvals, patients, assessments today, safety alerts red, open incidents). Tabs: Overview, Clinician approvals, Safety queue, Users, AI models, Audit log, System health.
Overview: horizontal bar breakdown (total, high-risk, CT scans, ischemic, hemorrhagic, normal), subsystem status list, recent events table.
```
