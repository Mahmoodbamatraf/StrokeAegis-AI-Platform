# StrokeAegis — Design System

> المرجع الوحيد لقرارات التصميم في الواجهة (`frontend/`).
> أي لون أو خط أو مسافة جديدة لازم تجي من هنا. لو احتجت شي مو موجود: أضفه هنا أول، بعدين استخدمه.
>
> المصدر: توصيات `ui-ux-pro-max` (Healthcare / Medical Clinic) مع تعديلات للتباين (WCAG AA).

---

## 1. الاتجاه العام

**طبي هادئ وموثوق** — Teal طبي + أخضر صحي، خلفيات فاتحة نظيفة، بدون زخرفة.

- النمط: **Clean Clinical / Data Dashboard** — بطاقات بسيطة، حدود خفيفة، ظلال ناعمة.
- ❌ ممنوع: Neumorphism، ألوان نيون، تدرجات بنفسجي/وردي (شكل "AI" المستهلك)، أنيميشن ثقيل، emoji كأيقونات.
- الأولوية: الوضوح والقراءة > الشكل. هذي منصة طبية، الطبيب لازم يقرأ النتيجة بثانية.

---

## 2. الألوان

### 2.1 الوضع الفاتح (Light)

| Token | Hex | الاستخدام | تباين |
|---|---|---|---|
| `--color-primary` | `#0E7490` | أزرار أساسية، روابط، العناصر النشطة | 5.36 مع الأبيض ✅ |
| `--color-primary-hover` | `#155E75` | hover/pressed للـ primary | 7.27 ✅ |
| `--color-primary-soft` | `#E6F6F8` | خلفية badges وعناصر محددة | — |
| `--color-secondary` | `#0891B2` | زخرفة، أيقونات، رسوم — **مو للنص على أبيض** | 3.68 ⚠️ |
| `--color-accent` | `#047857` | نجاح، "آمن"، CTA ثانوي | 5.48 ✅ |
| `--color-accent-soft` | `#ECFDF5` | خلفية رسائل النجاح | — |
| `--color-bg` | `#F7FAFA` | خلفية الصفحة | — |
| `--color-surface` | `#FFFFFF` | البطاقات والمودالات | — |
| `--color-surface-muted` | `#EEF4F5` | خلفيات ثانوية، صفوف الجداول | — |
| `--color-text` | `#0F2A2E` | النص الأساسي والعناوين | 14.4 ✅ |
| `--color-text-muted` | `#5B6B7A` | نص ثانوي، labels | 5.23 ✅ |
| `--color-border` | `#D7E3E6` | حدود البطاقات والحقول | — |
| `--color-ring` | `#0E7490` | focus ring | — |

### 2.2 ألوان الحالة (Status) — مهمة جداً للنتائج الطبية

| Token | Hex | Soft bg | المعنى |
|---|---|---|---|
| `--color-danger` | `#DC2626` | `#FEF2F2` | خطر عالي / سكتة محتملة / خطأ |
| `--color-warning` | `#B45309` | `#FFFBEB` | خطر متوسط / يحتاج مراجعة |
| `--color-success` | `#047857` | `#ECFDF5` | خطر منخفض / سليم |
| `--color-info` | `#0E7490` | `#E6F6F8` | معلومة / حالة عادية |

⚡ **قاعدة:** لا تعتمد على اللون لوحده — كل حالة لازم معها **أيقونة + نص** (مثلاً ⚠ + "خطر متوسط").

### 2.3 الوضع الداكن (Dark) — `[data-theme="dark"]`

| Token | Hex |
|---|---|
| `--color-primary` | `#22D3EE` |
| `--color-primary-hover` | `#67E8F9` |
| `--color-primary-soft` | `#0E2A33` |
| `--color-accent` | `#34D399` |
| `--color-bg` | `#0B1418` |
| `--color-surface` | `#121C21` |
| `--color-surface-muted` | `#18252B` |
| `--color-text` | `#E6EEF0` |
| `--color-text-muted` | `#94A3B8` |
| `--color-border` | `#24343B` |
| `--color-danger` | `#F87171` |
| `--color-warning` | `#FBBF24` |
| `--color-success` | `#34D399` |

> في الداكن: النص على أزرار الـ primary يكون **`#0B1418`** (داكن) مو أبيض.

---

## 3. الخطوط

| الدور | الخط | الأوزان |
|---|---|---|
| إنجليزي (عناوين + نص) | **Figtree** | 400, 500, 600, 700 |
| عربي (عناوين + نص) | **Noto Sans Arabic** | 400, 500, 600, 700 |
| أرقام/كود/قيم مخبرية | **JetBrains Mono** | 400, 600 |

```html
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
```

```css
--font-sans: 'Figtree', 'Noto Sans Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, monospace;
/* عند العربي */
[lang="ar"], [dir="rtl"] { --font-sans: 'Noto Sans Arabic', 'Figtree', system-ui, sans-serif; }
```

### 3.1 المقاسات

| Token | الحجم | Line-height | الاستخدام |
|---|---|---|---|
| `--text-xs` | 12px | 1.5 | badges، ملاحظات صغيرة (أقل حد) |
| `--text-sm` | 14px | 1.5 | labels، نص الجداول |
| `--text-base` | 16px | 1.6 | النص الأساسي |
| `--text-lg` | 18px | 1.5 | عناوين البطاقات |
| `--text-xl` | 22px | 1.35 | عناوين الأقسام |
| `--text-2xl` | 28px | 1.25 | عنوان الصفحة |
| `--text-3xl` | 40px | 1.15 | Hero فقط |

- العربي يحتاج line-height أعلى بـ ~0.1 من الإنجليزي.
- ❌ لا نص أقل من 12px.

---

## 4. المسافات (Spacing)

مقياس 4px:

| Token | القيمة |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 24px |
| `--space-6` | 32px |
| `--space-7` | 48px |
| `--space-8` | 64px |

- داخل البطاقة: `--space-5` (24px) — في الداشبوردات الكثيفة `--space-4`.
- بين البطاقات: `--space-4` إلى `--space-5`.
- بين الأقسام: `--space-7`.
- استخدم `margin-inline-start/end` و `padding-inline` بدل left/right عشان RTL.

---

## 5. الزوايا والظلال

| Token | القيمة | الاستخدام |
|---|---|---|
| `--radius-sm` | 6px | badges، checkboxes |
| `--radius-md` | 10px | أزرار، حقول إدخال |
| `--radius-lg` | 16px | بطاقات، مودالات |
| `--radius-full` | 9999px | pills، avatars |
| `--shadow-sm` | `0 1px 2px rgba(15,42,46,.06)` | بطاقات عادية |
| `--shadow-md` | `0 4px 12px rgba(15,42,46,.08)` | hover، dropdowns |
| `--shadow-lg` | `0 12px 32px rgba(15,42,46,.12)` | مودالات |

---

## 6. الأزرار

| النوع | الخلفية | النص | الحد |
|---|---|---|---|
| Primary | `--color-primary` | `#FFFFFF` | — |
| Secondary | `--color-surface` | `--color-primary` | `1px solid --color-border` |
| Ghost | transparent | `--color-text` | — |
| Danger | `--color-danger` | `#FFFFFF` | — |

- الارتفاع: **44px** (افتراضي)، 36px (صغير) — أقل حد للمس 44×44.
- Padding: `0 var(--space-5)`، الخط `--text-sm` وزن 600، الزاوية `--radius-md`.
- Hover: لون `-hover` + `--shadow-sm`، الانتقال `150ms ease`.
- Focus: `outline: 2px solid var(--color-ring); outline-offset: 2px;` — ❌ ممنوع تشيل الـ focus.
- Disabled: `opacity: .5; cursor: not-allowed;`
- أيقونة + نص: مسافة `--space-2`.

---

## 7. الحقول (Inputs)

- ارتفاع 44px، خلفية `--color-surface`، حد `1px solid --color-border`، زاوية `--radius-md`.
- Focus: حد `--color-primary` + `box-shadow: 0 0 0 3px var(--color-primary-soft)`.
- Error: حد `--color-danger` + رسالة الخطأ **تحت الحقل مباشرة**.
- كل حقل له `<label>` ظاهر — ❌ placeholder لوحده مو label.

---

## 8. الحركة (Motion)

- المدد: 150ms (hover)، 200–250ms (فتح/إغلاق)، ❌ أكثر من 400ms.
- حرّك `transform` و `opacity` بس — ❌ لا تحرك width/height.
- لازم:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

---

## 9. قواعد التطبيق في الكود

1. ❌ **ممنوع hex مباشر** داخل أي selector — استخدم `var(--...)` فقط. (حالياً فيه مئات الألوان المكتوبة مباشرة، أشهرها `#0284c7` × 67.)
2. الـ dark mode: يتغير **بإعادة تعريف الـ tokens** في `[data-theme="dark"]` مرة وحدة — ❌ مو بقواعد منفصلة لكل عنصر (حالياً 398 قاعدة).
3. قلّل `!important` — استخدمه بس لو ما فيه حل ثاني.
4. ألوان مكتوبة في `app.js` / `index.html` (inline styles): انقلها لـ classes.

### 9.1 جدول التحويل من القديم للجديد

| القديم | الجديد |
|---|---|
| `--aegis-slate`, `#0284c7`, `#0369a1` | `--color-primary` |
| `--aegis-slate-dark` | `--color-primary-hover` |
| `--aegis-slate-light`, `--medical-cyan-light` | `--color-primary-soft` |
| `--medical-cyan`, `#38bdf8` | `--color-secondary` |
| `--color-green`, `#10b981`, `#059669` | `--color-success` |
| `--color-red`, `#ef4444` | `--color-danger` |
| `--color-amber`, `#d97706` | `--color-warning` |
| `--bg-main`, `--bg-mist`, `#f8fafc` | `--color-bg` |
| `--bg-card`, `#ffffff` | `--color-surface` |
| `--text-primary`, `--charcoal-slate`, `#1e293b`, `#0f172a` | `--color-text` |
| `--text-muted`, `#64748b`, `#94a3b8` | `--color-text-muted` |
| `--border-color`, `#e2e8f0`, `#cbd5e1` | `--color-border` |
| `--neural-gold`, `--coral-rose` | ❌ تُحذف (أو `--color-warning` حسب السياق) |

---

## 10. Checklist قبل أي PR

- [ ] ما فيه hex جديد خارج `:root`
- [ ] تباين النص 4.5:1 على الأقل (فاتح وداكن)
- [ ] focus ظاهر على كل عنصر تفاعلي
- [ ] الحالات الطبية فيها أيقونة + نص، مو لون بس
- [ ] جربت الصفحة بالعربي (RTL) والإنجليزي
- [ ] جربت الفاتح والداكن
- [ ] جربت على 375px و 1440px
