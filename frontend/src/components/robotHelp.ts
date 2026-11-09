/*
 * Explanations the robot guide shows above its head when the user clicks something.
 * Lookup order: data-help-ar / data-help-en on the element (or an ancestor) → RULES matched
 * against the element's label (text, aria-label, title, placeholder, id) → generic fallback.
 */

type Rule = { match: RegExp; ar: string; en: string };

const RULES: Rule[] = [
  // ---- auth / landing
  { match: /تسجيل الدخول|sign in|log ?in/i, ar: 'يدخلك لحسابك. بعدها توديك المنصة لبوابتك حسب دورك: طبيب أو مريض أو مسؤول.', en: 'Signs you in. You land on your own portal: doctor, patient or admin.' },
  { match: /إنشاء حساب|حساب جديد|sign ?up|register|create account/i, ar: 'يسوي لك حساب جديد. حساب الطبيب يحتاج موافقة الإدارة قبل ما يشتغل.', en: 'Creates a new account. Doctor accounts need admin approval first.' },
  { match: /طبيب تجريبي|demo doctor/i, ar: 'يدخلك بحساب طبيب تجريبي عشان تشوف بوابة الطبيب بسرعة.', en: 'Signs in with the demo doctor account.' },
  { match: /مريض تجريبي|demo patient/i, ar: 'يدخلك بحساب مريض تجريبي عشان تجرب الفحص الذاتي والتقارير.', en: 'Signs in with the demo patient account.' },
  { match: /مسؤول تجريبي|demo admin/i, ar: 'يدخلك بحساب المسؤول التجريبي للوحة الحوكمة.', en: 'Signs in with the demo admin account.' },
  { match: /كلمة المرور|password/i, ar: 'كلمة المرور: 6 أحرف على الأقل. زر العين يظهرها أو يخفيها.', en: 'Password: at least 6 characters. The eye button shows or hides it.' },
  { match: /البريد|email/i, ar: 'اكتب بريدك الإلكتروني المسجّل في المنصة.', en: 'Your registered email address.' },
  { match: /رقم الترخيص|license/i, ar: 'رقم ترخيص الطبيب المهني. الإدارة تتحقق منه قبل تفعيل الحساب.', en: 'Your medical license number; admins verify it before approval.' },
  { match: /خروج|log ?out|sign ?out/i, ar: 'يسجّل خروجك ويمسح الجلسة من هذا المتصفح.', en: 'Signs you out and clears the session on this browser.' },

  // ---- header / global
  { match: /^EN$|^AR$|^ع$|اللغة|language/i, ar: 'يبدّل اللغة بين العربي والإنجليزي، والاتجاه يتعدّل تلقائياً.', en: 'Switches between Arabic and English; layout direction follows.' },
  { match: /ثيم|theme|داكن|فاتح|dark|light/i, ar: 'يغيّر الثيم أو بين الوضع الفاتح والداكن.', en: 'Changes the theme or toggles light/dark mode.' },
  { match: /إشعار|notification|bell/i, ar: 'الإشعارات: تقارير جاهزة ورسائل جديدة وتنبيهات. الرقم يعني غير المقروءة.', en: 'Notifications: ready reports, new messages, alerts. The badge counts unread ones.' },
  { match: /المساعد|assistant|chatbot|شات/i, ar: 'المساعد الطبي: اسألني عن السكتة الدماغية، وأجاوبك من الإرشادات الطبية مع المصادر.', en: 'The assistant answers stroke questions from clinical guidelines, with sources.' },
  { match: /اسحب أفقياً|swipe/i, ar: 'تقدر تسحب يمين ويسار للتنقل بين الشاشات الرئيسية.', en: 'Swipe left/right to move between the main screens.' },

  // ---- analysis
  { match: /النظام الذكي|4 خطوات|4-step|ai wizard|معالج/i, ar: 'النظام الذكي: 4 خطوات. بيانات المريض، ثم الأشعة، ثم وكلاء CrewAI يحللون، ثم حزمة القرار.', en: 'The 4-step AI system: vitals → CT → CrewAI agents → decision package.' },
  { match: /النماذج المباشرة|live models|النظام العادي|regular/i, ar: 'النماذج المباشرة: تشغّل نموذج الخطر أو نموذج الأشعة لحاله بسرعة، بدون الوكلاء.', en: 'Run the risk model or the CT model directly, without the agents.' },
  { match: /أنظمة التحليل|analysis suite/i, ar: 'صفحة اختيار طريقة التحليل: النظام الذكي الكامل أو النماذج المباشرة.', en: 'Choose between the full AI system and the direct models.' },
  { match: /تحليل ai|run ai|launch ai|تشغيل نظام الذكاء/i, ar: 'يفتح النظام الذكي لهذا المريض وبياناته معبّأة من آخر تقييم.', en: 'Opens the AI system for this patient, prefilled from their last assessment.' },
  { match: /تشغيل التحليل|run (full )?analysis|بدء التحليل/i, ar: 'يرسل البيانات والصورة للخادم، ويبدأ النماذج والوكلاء. تتابعهم مباشرة في الخطوة 3.', en: 'Sends data and image to the server and starts the models and agents; watch them live in step 3.' },
  { match: /بدون أشعة|without ct/i, ar: 'يحلل عوامل الخطر فقط بدون صورة أشعة.', en: 'Analyses risk factors only, without a CT image.' },
  { match: /رفع|upload|اسحب وأفلت|drag/i, ar: 'ارفع صورة أشعة مقطعية للدماغ. بوابة ConvNeXt ترفض أي صورة مو أشعة دماغ.', en: 'Upload a brain CT slice. The ConvNeXt gate rejects anything that is not a brain CT.' },
  { match: /نزيف|hemorrhag|bleeding/i, ar: 'عينة أشعة لسكتة نزفية، للتجربة.', en: 'Sample CT of a hemorrhagic stroke.' },
  { match: /إقفار|ischemi/i, ar: 'عينة أشعة لسكتة إقفارية (جلطة)، للتجربة.', en: 'Sample CT of an ischemic stroke.' },
  { match: /ليست أشعة|non-brain|غير دماغ/i, ar: 'صورة مو أشعة دماغ، عشان تشوف بوابة الأمان كيف ترفضها.', en: 'A non-brain image to show the safety gate rejecting it.' },
  { match: /سليمة|normal/i, ar: 'عينة أشعة دماغ سليمة، للمقارنة.', en: 'Sample of a normal brain CT.' },
  { match: /خطر عالي|high risk|خطر مرتفع/i, ar: 'يعبّي النموذج بقيم مريض خطره عالي، كمثال.', en: 'Fills the form with a high-risk example.' },
  { match: /خطر متوسط|moderate/i, ar: 'يعبّي النموذج بقيم مريض خطره متوسط، كمثال.', en: 'Fills the form with a moderate-risk example.' },
  { match: /خطر منخفض|low risk/i, ar: 'يعبّي النموذج بقيم مريض خطره منخفض، كمثال.', en: 'Fills the form with a low-risk example.' },
  { match: /grad-?cam|خريطة حرارية|heatmap/i, ar: 'خريطة Grad-CAM: توضح المناطق اللي اعتمد عليها النموذج في قراره. الأحمر هو الأهم.', en: 'Grad-CAM shows the regions the model relied on; red matters most.' },
  { match: /الأصلية|original/i, ar: 'صورة الأشعة الأصلية بدون أي معالجة.', en: 'The original CT image.' },
  { match: /roi|منطقة الاهتمام/i, ar: 'منطقة الاهتمام: الجزء اللي قصّه النظام من الصورة وحلّله.', en: 'The region of interest the model analysed.' },
  { match: /الإسقاط|projection/i, ar: 'الخريطة الحرارية فوق الصورة كاملة.', en: 'The heatmap projected over the full image.' },
  { match: /مسح الليزر|laser/i, ar: 'تأثير بصري فقط، ما يغيّر النتيجة.', en: 'A visual effect only; it does not change the result.' },
  { match: /pdf|تحميل التقرير|download/i, ar: 'ينزّل التقرير الطبي كملف PDF.', en: 'Downloads the clinical report as a PDF.' },
  { match: /تحليل جديد|new analysis|new patient/i, ar: 'يبدأ تحليل جديد من الخطوة 1.', en: 'Starts a new analysis from step 1.' },
  { match: /ملف المريض|patient profile|الخطوة 1|step 1/i, ar: 'الخطوة 1: عشرة مؤشرات للمريض يستخدمها نموذج الخطر.', en: 'Step 1: the 10 patient features used by the risk model.' },
  { match: /الأشعة المقطعية|brain ct|الخطوة 2|step 2/i, ar: 'الخطوة 2: اختر صورة الأشعة أو ارفعها.', en: 'Step 2: choose or upload the CT image.' },
  { match: /مراقبة الوكلاء|agent monitor|الخطوة 3|step 3/i, ar: 'الخطوة 3: تشوف وكلاء CrewAI وهم يشتغلون مباشرة: الوقاية والطوارئ والتحقق والتقرير.', en: 'Step 3: watch the CrewAI agents live.' },
  { match: /حزمة القرار|decision package|الخطوة 4|step 4/i, ar: 'الخطوة 4: التقرير النهائي والتوصيات. القرار الأخير دايم للطبيب.', en: 'Step 4: the final report and recommendations; the doctor decides.' },
  { match: /حلّل|analy[sz]e|تقييم الخطر/i, ar: 'يشغّل نموذج تعلّم الآلة الحقيقي ويحسب نسبة خطر السكتة.', en: 'Runs the real ML model to estimate stroke risk.' },
  { match: /ضغط الدم|hypertension/i, ar: 'هل عند المريض ارتفاع ضغط مزمن؟ من أقوى عوامل الخطر.', en: 'Chronic hypertension: one of the strongest risk factors.' },
  { match: /أمراض القلب|heart/i, ar: 'هل عند المريض مرض قلب؟', en: 'Does the patient have heart disease?' },
  { match: /الجلوكوز|سكر|glucose/i, ar: 'متوسط سكر الدم (mg/dL).', en: 'Average blood glucose (mg/dL).' },
  { match: /bmi|كتلة الجسم/i, ar: 'مؤشر كتلة الجسم = الوزن ÷ مربع الطول.', en: 'Body-mass index = weight / height².' },
  { match: /التدخين|smok/i, ar: 'حالة التدخين: لم يدخّن، أو مدخّن سابق، أو مدخّن.', en: 'Smoking status.' },

  // ---- doctor
  { match: /دعوة مريض|invite|admit/i, ar: 'يرسل طلب ربط لمريض مسجّل في المنصة عن طريق بريده، والمريض يوافق.', en: 'Sends a link request to a registered patient by email; they must accept.' },
  { match: /قبول|accept/i, ar: 'يقبل طلب الربط، ويصير المريض أو الطبيب ضمن قائمتك.', en: 'Accepts the connection request.' },
  { match: /رفض|decline|reject/i, ar: 'يرفض الطلب.', en: 'Declines the request.' },
  { match: /السجل|history/i, ar: 'يعرض كل تقييمات المريض وتقاريره السابقة.', en: 'Shows the patient’s past assessments and reports.' },
  { match: /مراسلة|محادث|message|chat/i, ar: 'محادثة مباشرة بين الطبيب والمريض.', en: 'Direct doctor–patient messaging.' },
  { match: /توقيع|اعتمد|اعتماد التقرير|sign.?off/i, ar: 'الطبيب يراجع التقرير ويعتمده، وبعدها يظهر للمريض كتقرير موقّع.', en: 'The doctor reviews and signs the report off.' },
  { match: /دليل المرضى|patients/i, ar: 'قائمة مرضاك المرتبطين فيك، مع آخر خطر وتشخيص.', en: 'Your linked patients with their latest risk and diagnosis.' },
  { match: /التقارير|reports/i, ar: 'التقارير الطبية: اعتمدها أو نزّلها PDF.', en: 'Clinical reports: sign off or download.' },

  // ---- patient
  { match: /الفحص الذاتي|self.?check/i, ar: 'الفحص الذاتي: عبّي بياناتك والنموذج الحقيقي يقدّر خطر السكتة، وتوصل النتيجة لطبيبك.', en: 'Self-check: the real model estimates your stroke risk and notifies your doctor.' },
  { match: /نتائجي|results/i, ar: 'كل تقييماتك السابقة.', en: 'All your previous assessments.' },
  { match: /طبيبي|my doctor|فريق الرعاية|care team/i, ar: 'طبيبك المشرف وفريق الرعاية، وطلبات الربط.', en: 'Your supervising doctor, care team and requests.' },
  { match: /ابحث عن طبيب|find a doctor|find doctor/i, ar: 'ابحث عن طبيب وأرسل له طلب إشراف.', en: 'Find a doctor and request supervision.' },

  // ---- admin
  { match: /نظرة عامة|overview/i, ar: 'ملخص المنصة: الأرقام الرئيسية والتنبيهات وآخر الأحداث.', en: 'Platform summary: KPIs, alerts and recent events.' },
  { match: /اعتماد الأطباء|clinician|approval/i, ar: 'طلبات تسجيل الأطباء: اعتماد، أو طلب معلومات، أو رفض، أو إيقاف.', en: 'Doctor registrations: approve, request info, reject or suspend.' },
  { match: /السلامة|safety/i, ar: 'طابور السلامة: حالات تحتاج مراجعة، مثل خطر عالي بدون توقيع أو صورة رفضتها البوابة.', en: 'Safety queue: cases needing review.' },
  { match: /إسناد|assign/i, ar: 'يسند الحالة لطبيب معتمد عشان يراجعها.', en: 'Assigns the case to an approved doctor.' },
  { match: /تحقيق|investigat/i, ar: 'يسجّل نتيجة التحقيق في الحالة: محلولة، أو إنذار كاذب، أو مصعّدة.', en: 'Records the investigation outcome.' },
  { match: /المستخدمين|users/i, ar: 'كل الحسابات. تقدر توقف حساب أو تفعّله، مع ذكر السبب.', en: 'All accounts; activate or deactivate with a reason.' },
  { match: /إيقاف|تفعيل|deactivat|activat|suspend/i, ar: 'يغيّر حالة الحساب. لازم تكتب السبب، ويتسجّل في سجل التدقيق.', en: 'Changes the account status; a reason is required and audited.' },
  { match: /النماذج|models/i, ar: 'نماذج الذكاء الاصطناعي: عدد الاستدعاءات ونسبة الأخطاء والحالة.', en: 'AI models: inferences, error rate and status.' },
  { match: /التدقيق|audit/i, ar: 'سجل التدقيق: كل عملية حساسة مين سواها ومتى.', en: 'Audit log: who did what and when.' },
  { match: /صحة|health/i, ar: 'صحة النظام: حالة الخدمات (قاعدة البيانات والنماذج والذكاء) والحوادث.', en: 'System health: service status and incidents.' },
  { match: /حادث|incident/i, ar: 'يسجّل حادثة تشغيلية، مثل خدمة متعطلة.', en: 'Logs an operational incident.' },
  { match: /تحديث|refresh|reload/i, ar: 'يعيد تحميل البيانات من الخادم.', en: 'Reloads the data from the server.' },
  { match: /بحث|search/i, ar: 'اكتب للبحث والتصفية.', en: 'Type to search and filter.' },
  { match: /إلغاء|cancel|إغلاق|close/i, ar: 'يقفل النافذة بدون حفظ.', en: 'Closes without saving.' },
  { match: /حفظ|save|إرسال|send|submit/i, ar: 'يحفظ أو يرسل اللي عبّيته.', en: 'Saves or sends what you entered.' },
];

const INTERACTIVE = 'button, a[href], input, select, textarea, label, summary, [role="button"], [role="tab"], [role="link"], [data-help-ar], [data-help-en]';

function labelOf(el: Element): string {
  const parts = [
    el.getAttribute('aria-label'),
    el.getAttribute('title'),
    el.getAttribute('placeholder'),
    (el as HTMLElement).innerText,
    el.id,
  ];
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    const lab = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : el.closest('label');
    if (lab) parts.unshift((lab as HTMLElement).innerText);
  }
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}

/** Returns [arabic, english] help for a clicked element, or null if it's not interactive. */
export function helpFor(target: EventTarget | null): [string, string] | null {
  if (!(target instanceof Element)) return null;
  const tagged = target.closest('[data-help-ar], [data-help-en]');
  if (tagged) {
    const ar = tagged.getAttribute('data-help-ar') || tagged.getAttribute('data-help-en') || '';
    const en = tagged.getAttribute('data-help-en') || ar;
    return [ar, en];
  }
  const el = target.closest(INTERACTIVE);
  if (!el) return null;
  const label = labelOf(el);
  if (!label) return null;
  for (const r of RULES) if (r.match.test(label)) return [r.ar, r.en];
  const short = label.length > 48 ? `${label.slice(0, 48)}…` : label;
  return [`ضغطت على «${short}».`, `You clicked “${short}”.`];
}
