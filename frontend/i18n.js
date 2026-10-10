/**
 * StrokeAegis AI — Internationalization (i18n) Module
 * Supports English (LTR) and Arabic (RTL) with dynamic reactive translation.
 */

const translations = {
    en: {
        // Top Header
        "brand.title": "StrokeAegis",
        "brand.ai": "AI",
        "brand.tagline": "AI-Powered Stroke Reporting & Integrated Clinical Solutions",
        "robot.ask": "Ask StrokeAegis AI",
        "robot.sub": "Medical Chatbot • Click to Chat",

        // Controls
        "theme.toggle": "Toggle Dark / Light Theme",
        "theme.light": "Light Mode",
        "theme.dark": "Dark Mode",
        "lang.toggle": "Switch Language (العربية)",
        "lang.en": "EN",
        "lang.ar": "عربي",

        // Screen 1: Home
        "home.badge": "INTEGRATED CLINICAL PLATFORM",
        "home.title": "Select Clinical Workflow Mode",
        "home.desc": "Choose between the comprehensive multi-agent clinical decision support pipeline or direct standalone access to the deterministic deep learning and machine learning engines.",
        "home.card_ai.badge": "FULL INTELLIGENCE • CREWAI FLOW",
        "home.card_ai.title": "OPTION 1 — AI SYSTEM",
        "home.card_ai.subtitle": "Complete End-to-End Intelligent Clinical Workflow",
        "home.card_ai.desc": "Guides you step-by-step through the unified StrokeAegis pipeline: Patient Vitals → Brain CT Scan → Multi-Agent Clinical Analysis & Guidelines RAG → Hospital-Grade Clinical Decision Report.",
        "home.card_ai.h1": "4 CrewAI Clinical Agents",
        "home.card_ai.h2": "Real-Time Guideline RAG (AHA/ASA, ESO, NICE)",
        "home.card_ai.h3": "End-to-End Clinical Findings & PDF Build",
        "home.card_ai.btn": "Start AI Clinical Pipeline →",

        "home.card_reg.badge": "DIRECT MODEL ACCESS • ZERO CREWAI",
        "home.card_reg.title": "OPTION 2 — REGULAR SYSTEM",
        "home.card_reg.subtitle": "Standalone Machine Learning & Deep Learning Engines",
        "home.card_reg.desc": "Run individual AI inference models directly without multi-agent orchestration or RAG: Path A calculates tabular stroke danger risk from patient vitals; Path B diagnoses Brain CT scans with Grad-CAM explainability.",
        "home.card_reg.h1": "Path A: ML Stroke Danger Assessment",
        "home.card_reg.h2": "Path B: Brain CT Diagnostic Classifier & Grad-CAM",
        "home.card_reg.h3": "Instant Deterministic Outputs",
        "home.card_reg.btn": "Open Regular System →",

        // Stepper Navigation
        "stepper.return": "← Return to System Selection",
        "stepper.return_doctor": "← Return to Doctor Dashboard",
        "stepper.return_patient": "← Return to Patient Portal",
        "stepper.step1": "1. Patient Profile",
        "stepper.step2": "2. Brain CT Scan",
        "stepper.step3": "3. Agent Monitor",
        "stepper.step4": "4. Clinical Report",

        // Step 1: Patient Profile Form
        "step1.badge": "STEP 1 OF 4",
        "step1.title": "Patient Demographic & Vitals Profile",
        "step1.desc": "Enter the patient's baseline cardiovascular, metabolic, and demographic biomarkers to calculate the Machine Learning Vascular Stroke Risk score.",
        "step1.presets_label": "Clinical Presets:",
        "preset.high": "High Risk",
        "preset.mod": "Moderate Risk",
        "preset.low": "Low Risk",
        "preset.clear": "Clear Form",

        "form.gender": "Gender",
        "form.gender_select": "Select Gender...",
        "form.male": "Male",
        "form.female": "Female",
        "form.age": "Age (Years)",
        "form.hypertension": "Hypertension History",
        "form.heart_disease": "Heart Disease",
        "form.no": "No",
        "form.yes": "Yes",
        "form.marital": "Ever Married",
        "form.work": "Work Type",
        "form.work_select": "Select Work Type...",
        "form.work_private": "Private Industry",
        "form.work_self": "Self-Employed",
        "form.work_govt": "Government Service",
        "form.work_children": "Children / Dependent",
        "form.work_never": "Never Worked",
        "form.residence": "Residence Type",
        "form.residence_urban": "Urban Metro",
        "form.residence_rural": "Rural",
        "form.glucose": "Average Glucose Level (mg/dL)",
        "form.bmi": "BMI (Body Mass Index)",
        "form.smoking": "Smoking History",
        "form.smoking_select": "Select Smoking History...",
        "form.smoking_formerly": "Formerly Smoked",
        "form.smoking_never": "Never Smoked",
        "form.smoking_current": "Currently Smokes",
        "form.smoking_unknown": "Unknown History",

        "step1.btn_next": "Continue to Brain CT Scan →",

        // Step 2: Brain CT Scan
        "step2.badge": "STEP 2 OF 4",
        "step2.title": "Brain CT Neuroimaging Scan",
        "step2.desc": "Upload an axial non-contrast head CT scan. The ConvNeXt-Tiny safety gatekeeper verifies scan anatomical validity before EfficientNetV2 classification and Grad-CAM explainability localization.",
        "step2.presets_label": "Clinical Neuroimaging Presets:",
        "ct_preset.hemorrhage": "Intracranial Hemorrhage",
        "ct_preset.ischemia": "Ischemic Infarct",
        "ct_preset.normal": "Normal Brain CT",
        "ct_preset.nonbrain": "Non-Brain (Safety Gate)",
        "dropzone.title": "Drag & drop a Brain CT scan here",
        "dropzone.sub": "or click to browse DICOM / PNG / JPG files",
        "dropzone.limits": "Recommended: Axial non-contrast CT slice • Max 20MB",
        "btn.remove_image": "Remove Image",
        "btn.back_step1": "← Back to Patient Profile",
        "btn.run_pipeline": "Run Full StrokeAegis Clinical Pipeline →",

        // Step 3: Agent Monitor
        "step3.title": "StrokeAegis AI Agent Activity Monitor",
        "step3.badge": "CrewAI Flow Orchestrator Active",
        "robot.speech.agent": "System Initializing",
        "robot.speech.msg": "Starting StrokeAegis multi-agent clinical flow...",
        "robot.speech.sub": "Orchestrating deterministic models and RAG clinical agents.",
        "timeline.title": "COORDINATED CLINICAL AGENT PIPELINE",
        "ag.models.title": "ML Risk & Brain CT Models",
        "ag.models.role": "Deterministic Inference Engines • ConvNeXt-Tiny & EfficientNetV2-S",
        "ag.models.act": "Evaluating vascular risk and verifying CT safety gate",
        "ag.prevention.title": "Prevention Agent",
        "ag.prevention.role": "Stroke Prevention Clinical Specialist • RAG Knowledge Base",
        "ag.prevention.act": "Retrieving stroke prevention guidelines from Medical RAG",
        "ag.emergency.title": "Emergency Clinical Support Agent",
        "ag.emergency.role": "Acute Stroke Clinical Specialist • RAG Knowledge Base",
        "ag.emergency.act": "Analyzing acute stroke guideline evidence and reperfusion criteria",
        "ag.validation.title": "Medical Validation Agent",
        "ag.validation.role": "Medical Safety & Validation Specialist • No Direct RAG",
        "ag.validation.act": "Auditing clinical contradictions, consistency, and citation accuracy",
        "ag.report.title": "Medical Report Agent",
        "ag.report.role": "Clinical Documentation Specialist • No Direct RAG",
        "ag.report.act": "Synthesizing clinical decision report and compiling PDF document",
        "badge.waiting": "Waiting",
        "badge.working": "Working...",
        "badge.completed": "Completed",
        "badge.failed": "Failed",
        "step3.btn_report": "View Full Clinical Findings & Report →",

        // Step 4: Final Clinical Report
        "step4.alert_success": "Clinical Assessment Complete & Validated",
        "step4.alert_desc": "All deterministic models and 4 CrewAI clinical agents have finished execution. Review findings below or download the hospital-grade PDF report.",
        "btn.new_patient": "New Patient Analysis",
        "btn.return_home": "Return to Home",
        "btn.return_doctor": "Return to Doctor Dashboard",
        "btn.return_patient": "Return to Patient Portal",
        "report.ml_card_title": "Machine Learning Stroke Risk Assessment",
        "report.ct_card_title": "CT Diagnosis & Grad-CAM Explainability",
        "report.prevention_title": "Prevention Agent • Clinical Recommendations",
        "report.emergency_title": "Emergency Agent • Acute Stroke Pathways",
        "report.validation_title": "Medical Validation Agent Audit",
        "report.summary_title": "StrokeAegis AI Unified Clinical Decision Support Report",
        "btn.download_pdf": "Download Official PDF Report",

        // Regular System (Option 2)
        "reg.return": "← Return to System Selection",
        "reg.return_doctor": "← Return to Doctor Dashboard",
        "reg.return_patient": "← Return to Patient Portal",
        "reg.title": "StrokeAegis Standalone Clinical AI Engines",
        "reg.desc": "Access direct deterministic deep learning and machine learning models without multi-agent CrewAI flow orchestration or guideline RAG.",
        "reg.tab_a": "Path A: Stroke Risk (No CT)",
        "reg.tab_b": "Path B: CT Diagnosis & Grad-CAM",
        "reg.path_a_title": "Tabular Machine Learning Stroke Risk Assessment",
        "reg.path_a_desc": "Calculate statistical 10-year stroke probability from cardiovascular and metabolic clinical markers.",
        "reg.btn_calc_risk": "Calculate Stroke Danger Risk →",
        "reg.path_b_title": "Brain CT Deep Learning Diagnosis & Grad-CAM Localization",
        "reg.path_b_desc": "Automated CT safety gating, classification, and radiological heatmap explainability.",
        "reg.btn_diagnose_ct": "Diagnose Brain CT Scan →",

        // Medical Chatbot Dialog
        "chatbot.title": "StrokeAegis",
        "chatbot.ai": "AI",
        "chatbot.sub": "Medical Assistant • Stroke Specialist",
        "chatbot.close": "Close Chatbot",
        "chatbot.initial_msg": "Hello! 👋 I'm StrokeAegis AI's medical assistant. I can help you with questions about stroke, stroke risk, symptoms, diagnosis, prevention, and other medical topics related to stroke. How can I help you?",
        "chatbot.suggest_label": "Suggested Questions:",
        "chatbot.suggest_q1": "What are the warning signs of stroke?",
        "chatbot.suggest_q2": "How does hypertension increase stroke risk?",
        "chatbot.suggest_q3": "What is the FAST protocol?",
        "chatbot.typing": "Consulting Stroke Guidelines...",
        "chatbot.placeholder": "Ask about stroke, symptoms, prevention...",
        "chatbot.disclaimer": "Clinical Decision Support • For emergencies, dial 911 / EMS immediately.",

        // Footer & Rights
        "footer.rights": "© 2026 StrokeAegis AI All rights reserved.",
        "footer.author": "Mahmood Bamatraf",

        // Leading Page & Auth Portal
        "auth.signin_nav": "Sign In",
        "landing.badge": "PRECISION CLINICAL NEUROLOGY",
        "landing.title_lead": "Start Building Precision Care with",
        "landing.lead_desc": "The intelligent multi-agent clinical decision support system uniting deep brain CT neuroimaging, tabular vascular risk modeling, and AHA/ASA guideline-grounded AI agents.",
        "landing.robot_welcome": "Hello! I'm AegisBot. Sign in as a Doctor or Patient to explore clinical decision support!",
        "landing.feat1_title": "ConvNeXt Gate",
        "landing.feat1_desc": "Brain CT safety door",
        "landing.feat2_title": "EfficientNetV2-S",
        "landing.feat2_desc": "Grad-CAM explainability",
        "landing.feat3_title": "Vascular ML",
        "landing.feat3_desc": "Calibrated risk tiering",
        "landing.feat4_title": "4 CrewAI Agents",
        "landing.feat4_desc": "AHA/ASA & ESO guidelines",

        "auth.tab_signin": "Sign In",
        "auth.tab_signup": "Create Account",
        "auth.select_role_label": "Select Your Account Role:",
        "auth.role_doctor_title": "Doctor",
        "auth.role_doctor_sub": "Clinician / Specialist",
        "auth.role_patient_title": "Patient",
        "auth.role_patient_sub": "Personal Health",
        "auth.email_label": "Email Address",
        "auth.password_label": "Password",
        "auth.fullname_label": "Full Name",
        "auth.license_label": "Medical License #",
        "auth.spec_label": "Specialization",
        "auth.hospital_label": "Hospital / Center Affiliation",
        "auth.dob_label": "Date of Birth",
        "auth.gender_label": "Gender",
        "auth.emergency_label": "Emergency Kin Contact",
        "auth.submit_signin_doc": "Sign In as Doctor",
        "auth.submit_signin_pat": "Sign In as Patient",
        "auth.submit_signup_doc": "Create Doctor Account",
        "auth.submit_signup_pat": "Create Patient Account",
        "auth.or_quick_demo": "or use 1-click fast demo access",

        // Phase 2: Doctor Portal
        "doc.role_tag": "ATTENDING NEUROLOGIST WORKSPACE",
        "doc.stats.patients": "Active Patients",
        "doc.stats.pending": "Reports Awaiting Sign-Off",
        "doc.stats.assessments": "Total Assessments",
        "doc.stats.unread": "Unread Messages",
        "doc.tabs.patients": "My Patients Directory",
        "doc.tabs.reports": "Clinical Reports & Sign-Off",
        "doc.tabs.chat": "Patient Messages",
        "doc.actions.launch_ai": "Launch AI Clinical System",
        "doc.actions.launch_reg": "Regular Engines",
        "doc.actions.admit_patient": "+ Add Patient",
        "doc.admit_modal.title": "Add Patient to Clinical Care",
        "doc.admit_modal.subtitle": "Send a secure 48-hour connection request to a registered patient by email",
        "doc.admit_modal.submit": "Send Connection Request",
        "doc.launch_choice.title": "Launch AI Clinical System",
        "doc.launch_choice.subtitle": "Choose how you wish to conduct this clinical AI evaluation session:",
        "doc.launch_choice.assign_badge": "Patient Assignment",
        "doc.launch_choice.assign_title": "Assign to an Active Patient",
        "doc.launch_choice.assign_desc": "Select a patient from your clinical roster. Demographics will be pre-filled, and the diagnostic analysis and PDF report will be securely saved to their medical history.",
        "doc.launch_choice.select_label": "Select Patient from Roster:",
        "doc.launch_choice.btn_assigned": "Launch with Selected Patient",
        "doc.launch_choice.standalone_badge": "Trial & Simulation",
        "doc.launch_choice.standalone_title": "Standalone Evaluation (Unassigned)",
        "doc.launch_choice.standalone_desc": "Test the multimodal AI diagnostic models freely. Evaluate custom vitals and CT scans without assigning to any patient or modifying any medical record.",
        "doc.launch_choice.btn_standalone": "Launch in Standalone Mode",
        "doc.search_placeholder": "Search patients by name, MRN, or status...",
        "doc.reports_title": "Official Clinical Decision Reports",
        "doc.th.patient": "Patient",
        "doc.th.mrn": "MRN",
        "doc.th.demographics": "Demographics",
        "doc.th.status": "Status",
        "doc.th.latest_risk": "Latest Assessment",
        "doc.th.actions": "Clinical Actions",
        "doc.th.report_file": "Report ID / PDF",
        "doc.th.date": "Generated Date",
        "doc.th.findings": "Clinical Findings",
        "doc.th.validation": "Multi-Agent Validation",
        "doc.th.certification": "Physician Sign-Off",

        // Notifications
        "notifs.title": "Clinical Notifications",
        "notifs.subtitle": "Real-time alerts, reports, and messages from PostgreSQL",
        "notifs.mark_all_read": "Mark All Read",

        // Phase 2: Patient Portal
        "pat.role_tag": "PERSONAL STROKE HEALTH PORTAL",
        "pat.stats.assessments": "My Assessments",
        "pat.stats.reports": "Certified Reports",
        "pat.stats.risk_tier": "Latest Risk Status",
        "pat.stats.unread": "Doctor Messages",
        "pat.tabs.selfcheck": "Vascular Health Check",
        "pat.tabs.results": "My Results & Scans",
        "pat.tabs.reports": "My Certified Reports",
        "pat.tabs.doctor": "My Doctor & Care Team",
        "pat.tabs.chat": "Doctor Chat",
        "pat.selfcheck.title": "Instant Cerebrovascular Risk Evaluation",
        "pat.selfcheck.desc": "Assess your personalized stroke risk based on clinical cardiovascular and metabolic biomarkers validated by machine learning.",
        "pat.selfcheck.btn": "Calculate My Stroke Risk",
        "pat.selfcheck.btn_calculating": "Calculating Stroke Risk...",
        "pat.selfcheck.analyzing_factors": "Analyzing Cardiovascular Factors...",
        "pat.selfcheck.ml_consulting": "Consulting Machine Learning Ensembles & Vascular Risk Models",
        "pat.selfcheck.modal_title": "Vascular Health Assessment",
        "pat.selfcheck.assessment_result": "Assessment Result",
        "pat.selfcheck.stroke_vulnerability": "Stroke Vulnerability",
        "pat.selfcheck.calculated_prob": "Calculated Probability",
        "pat.selfcheck.contributing_factors": "Contributing Clinical Factors:",
        "pat.selfcheck.no_factors": "No significant adverse cardiovascular multipliers detected.",
        "pat.selfcheck.saved_notice": "Result automatically saved to your longitudinal record and shared with your supervising neurologist.",
        "pat.selfcheck.close_modal": "Close Assessment",
        "pat.results_title": "Longitudinal Health Assessment History",
        "pat.reports_title": "Certified Clinical Reports",

        // Phase 2: Messaging & Common
        "chat.active_threads": "Patient Threads",
        "chat.select_thread": "Select a conversation thread on the left to start messaging.",
        "chat.doc_placeholder": "Type a clinical instruction or response...",
        "chat.pat_placeholder": "Type a message or question for your doctor...",
        "common.refresh": "Refresh",
        "common.cancel": "Cancel"
    },

    ar: {
        // Top Header
        "brand.title": "StrokeAegis",
        "brand.ai": "AI",
        "brand.tagline": "تقارير السكتة الدماغية المدعومة بالذكاء الاصطناعي والحلول السريرية المتكاملة",
        "robot.ask": "اسأل StrokeAegis AI",
        "robot.sub": "المساعد الطبي الذكي • انقر للمحادثة",

        // Controls
        "theme.toggle": "تبديل المظهر الداكن / الفاتح",
        "theme.light": "الوضع الفاتح",
        "theme.dark": "الوضع الداكن",
        "lang.toggle": "Switch to English",
        "lang.en": "EN",
        "lang.ar": "عربي",

        // Screen 1: Home
        "home.badge": "المنصة السريرية المتكاملة",
        "home.title": "اختر نمط سير العمل السريري",
        "home.desc": "اختر بين نظام دعم القرار السريري المتكامل متعدد الوكلاء الذكي أو الوصول المباشر إلى نماذج التعلم العميق والتعلم الآلي المستقلة.",
        "home.card_ai.badge": "ذكاء اصطناعي متكامل • تدفق CREWAI",
        "home.card_ai.title": "الخيار 1 — نظام الذكاء الاصطناعي",
        "home.card_ai.subtitle": "سير عمل سريري ذكي شامل ومتكامل",
        "home.card_ai.desc": "يرشدك خطوة بخطوة خلال مسار StrokeAegis الموحد: المؤشرات الحيوية للمريض ← فحص الأشعة المقطعية للدماغ ← التحليل السريري متعدد الوكلاء ومطابقة الإرشادات الطبية RAG ← تقرير دعم القرار السريري المعتمد.",
        "home.card_ai.h1": "4 وكلاء سريريين بتقنية CrewAI",
        "home.card_ai.h2": "استرجاع فوري للأدلة الإرشادية (AHA/ASA, ESO, NICE)",
        "home.card_ai.h3": "نتائج سريرية شاملة وإصدار تقرير طبي PDF",
        "home.card_ai.btn": "بدء تدفق الذكاء الاصطناعي السريري ←",

        "home.card_reg.badge": "وصول مباشر للنماذج • بدون وكلاء",
        "home.card_reg.title": "الخيار 2 — النظام القياسي المباشر",
        "home.card_reg.subtitle": "نماذج التعلم الآلي والتعلم العميق المباشرة",
        "home.card_reg.desc": "تشغيل نماذج الاستدلال المستقلة مباشرة بدون تنسيق الوكلاء أو قاعدة RAG: المسار (أ) لحساب مخاطر السكتة الدماغية من بيانات المريض؛ المسار (ب) لتشخيص الأشعة المقطعية للدماغ مع تفسير Grad-CAM.",
        "home.card_reg.h1": "المسار أ: تقييم خطر السكتة الدماغية إحصائياً",
        "home.card_reg.h2": "المسار ب: تصنيف الأشعة المقطعية للدماغ وخريطة Grad-CAM",
        "home.card_reg.h3": "نتائج فورية ومباشرة بدون انتظار",
        "home.card_reg.btn": "فتح النظام القياسي المباشر ←",

        // Stepper Navigation
        "stepper.return": "→ العودة لاختيار النظام",
        "stepper.return_doctor": "→ العودة إلى لوحة تحكم الطبيب",
        "stepper.return_patient": "→ العودة إلى بوابة المريض",
        "stepper.step1": "1. ملف المريض",
        "stepper.step2": "2. أشعة الدماغ المقطعية",
        "stepper.step3": "3. مراقبة الوكلاء",
        "stepper.step4": "4. التقرير السريري",

        // Step 1: Patient Profile Form
        "step1.badge": "الخطوة 1 من 4",
        "step1.title": "البيانات الديموغرافية والمؤشرات الحيوية للمريض",
        "step1.desc": "أدخل المؤشرات الحيوية الأساسية للمريض لحساب درجة مخاطر السكتة الدماغية الوعائية باستخدام نموذج التعلم الآلي.",
        "step1.presets_label": "نماذج سريرية جاهزة:",
        "preset.high": "خطر مرتفع",
        "preset.mod": "خطر متوسط",
        "preset.low": "خطر منخفض",
        "preset.clear": "مسح النموذج",

        "form.gender": "الجنس",
        "form.gender_select": "اختر الجنس...",
        "form.male": "ذكر",
        "form.female": "أنثى",
        "form.age": "العمر (بالسنوات)",
        "form.hypertension": "تاريخ ارتفاع ضغط الدم",
        "form.heart_disease": "أمراض القلب",
        "form.no": "لا",
        "form.yes": "نعم",
        "form.marital": "الحالة الاجتماعية (متزوج سابقاً)",
        "form.work": "نوع العمل",
        "form.work_select": "اختر نوع العمل...",
        "form.work_private": "القطاع الخاص",
        "form.work_self": "عمل حر",
        "form.work_govt": "وظيفة حكومية",
        "form.work_children": "أطفال / معال",
        "form.work_never": "لم يعمل مسبقاً",
        "form.residence": "نوع الإقامة",
        "form.residence_urban": "مدينة / حضري",
        "form.residence_rural": "ريفي",
        "form.glucose": "متوسط مستوى الجلوكوز (ملغ/ديسيلتر)",
        "form.bmi": "مؤشر كتلة الجسم (BMI)",
        "form.smoking": "تاريخ التدخين",
        "form.smoking_select": "اختر حالة التدخين...",
        "form.smoking_formerly": "مدخن سابقاً",
        "form.smoking_never": "غير مدخن إطلاقاً",
        "form.smoking_current": "مدخن حالياً",
        "form.smoking_unknown": "تاريخ غير معروف",

        "step1.btn_next": "المتابعة إلى فحص الأشعة المقطعية ←",

        // Step 2: Brain CT Scan
        "step2.badge": "الخطوة 2 من 4",
        "step2.title": "فحص الأشعة المقطعية للدماغ",
        "step2.desc": "ارفع صورة أشعة مقطعية محورية بدون صبغة للدماغ. يتحقق صمام الأمان ConvNeXt-Tiny من صحة وملاءمة الصورة تشريحياً قبل التصنيف بواسطة EfficientNetV2 وتحديد موقع الإصابة بـ Grad-CAM.",
        "step2.presets_label": "أمثلة أشعة مقطعية معتمدة:",
        "ct_preset.hemorrhage": "نزيف دماغي (Hemorrhage)",
        "ct_preset.ischemia": "جلطة إقفارية (Ischemia)",
        "ct_preset.normal": "أشعة مقطعية طبيعية (Normal)",
        "ct_preset.nonbrain": "صورة خارج الدماغ (فحص الأمان)",
        "dropzone.title": "اسحب وأفلت صورة الأشعة المقطعية للدماغ هنا",
        "dropzone.sub": "أو انقر لاستعراض ملفات DICOM / PNG / JPG",
        "dropzone.limits": "الموصى به: مقطع محوري غير ظليل للرأس • الحجم الأقصى 20 ميغابايت",
        "btn.remove_image": "إزالة الصورة",
        "btn.back_step1": "→ العودة إلى ملف المريض",
        "btn.run_pipeline": "تشغيل خط StrokeAegis السريري الكامل ←",

        // Step 3: Agent Monitor
        "step3.title": "شاشة مراقبة نشاط وكلاء StrokeAegis",
        "step3.badge": "منسق تدفق CrewAI نشط",
        "robot.speech.agent": "بدء تهيئة النظام",
        "robot.speech.msg": "بدء تدفق StrokeAegis السريري متعدد الوكلاء...",
        "robot.speech.sub": "تنسيق النماذج الحسابية ووكلاء الإرشادات السريرية RAG.",
        "timeline.title": "مسار تنفيذ الوكلاء السريريين المنسق",
        "ag.models.title": "نماذج التعلم الآلي والأشعة المقطعية",
        "ag.models.role": "محركات الاستدلال المحددة • ConvNeXt-Tiny و EfficientNetV2-S",
        "ag.models.act": "تقييم مخاطر الأوعية والتحقق من صمام أمان الأشعة",
        "ag.prevention.title": "وكيل الوقاية السريرية",
        "ag.prevention.role": "أخصائي الوقاية من السكتة الدماغية • قاعدة معرفة RAG",
        "ag.prevention.act": "استرجاع إرشادات الوقاية من السكتة من قاعدة الإرشادات الطبية",
        "ag.emergency.title": "وكيل الدعم السريري للطوارئ",
        "ag.emergency.role": "أخصائي السكتة الدماغية الحادة • قاعدة معرفة RAG",
        "ag.emergency.act": "تحليل أدلة الإرشادات الحادة ومعايير إعادة التروية وإذابة الجلطات",
        "ag.validation.title": "وكيل التحقق والسلامة الطبية",
        "ag.validation.role": "أخصائي السلامة والتحقق الطبي • تدقيق مستقل بدون RAG",
        "ag.validation.act": "تدقيق التناقضات السريرية، والتوافق، ودقة الاستشهادات الطبية",
        "ag.report.title": "وكيل التوثيق والتقرير الطبي",
        "ag.report.role": "أخصائي التوثيق وإعداد التقارير • إنشاء مستندات المستشفيات",
        "ag.report.act": "تجميع وتوليف التقرير السريري النهائي وبناء مستند PDF",
        "badge.waiting": "في الانتظار",
        "badge.working": "قيد المعالجة...",
        "badge.completed": "اكتمل بنجاح",
        "badge.failed": "فشل",
        "step3.btn_report": "عرض النتائج السريرية الكاملة والتقرير ←",

        // Step 4: Final Clinical Report
        "step4.alert_success": "اكتمل التقييم السريري وتدقيقه بنجاح",
        "step4.alert_desc": "انتهت جميع النماذج الحسابية ووكلاء CrewAI السريريون الأربعة من العمل. راجع النتائج أدناه أو قم بتحميل التقرير الطبي المعتمد بصيغة PDF.",
        "btn.new_patient": "تحليل مريض جديد",
        "btn.return_home": "العودة إلى الرئيسية",
        "btn.return_doctor": "العودة إلى لوحة تحكم الطبيب",
        "btn.return_patient": "العودة إلى بوابة المريض",
        "report.ml_card_title": "تقييم مخاطر السكتة الدماغية بالتعلم الآلي",
        "report.ct_card_title": "تشخيص الأشعة المقطعية وخريطة التفسير Grad-CAM",
        "report.prevention_title": "وكيل الوقاية • التوصيات السريرية",
        "report.emergency_title": "وكيل الطوارئ • مسارات السكتة الحادة",
        "report.validation_title": "تدقيق وكيل السلامة والتحقق الطبي",
        "report.summary_title": "تقرير StrokeAegis الموحد لدعم القرار السريري",
        "btn.download_pdf": "تحميل التقرير الطبي الرسمي (PDF)",

        // Regular System (Option 2)
        "reg.return": "→ العودة لاختيار النظام",
        "reg.return_doctor": "→ العودة إلى لوحة تحكم الطبيب",
        "reg.return_patient": "→ العودة إلى بوابة المريض",
        "reg.title": "محركات الذكاء الاصطناعي السريرية المستقلة",
        "reg.desc": "الوصول المباشر إلى نماذج التعلم العميق والتعلم الآلي الحسابية دون وساطة وكلاء CrewAI أو قاعدة المعرفة RAG.",
        "reg.tab_a": "المسار أ: تقييم خطر السكتة (بدون أشعة)",
        "reg.tab_b": "المسار ب: تشخيص الأشعة و Grad-CAM",
        "reg.path_a_title": "تقييم خطر السكتة الدماغية بالتعلم الآلي",
        "reg.path_a_desc": "حساب الاحتمالية الإحصائية للإصابة بالسكتة خلال 10 سنوات بناءً على المؤشرات القلبية والتمثيلية للمريض.",
        "reg.btn_calc_risk": "حساب خطر السكتة الدماغية ←",
        "reg.path_b_title": "تشخيص الأشعة المقطعية بالتعلم العميق وخريطة Grad-CAM",
        "reg.path_b_desc": "فحص أمان الأشعة الآلي، والتصنيف الثلاثي، وإظهار خريطة الانتباه الحراري للموقع المتضرر.",
        "reg.btn_diagnose_ct": "تشخيص فحص الأشعة المقطعية ←",

        // Medical Chatbot Dialog
        "chatbot.title": "StrokeAegis",
        "chatbot.ai": "AI",
        "chatbot.sub": "المساعد الطبي • أخصائي السكتة الدماغية",
        "chatbot.close": "إغلاق المحادثة",
        "chatbot.initial_msg": "مرحباً! 👋 أنا المساعد الطبي الذكي لـ StrokeAegis AI. يمكنني مساعدتك في الإجابة على أي أسئلة تتعلق بالسكتة الدماغية، ومخاطرها، وأعراضها، وتشخيصها، وطرق الوقاية منها، والمواضيع الطبية المرتبطة بها. كيف يمكنني مساعدتك؟",
        "chatbot.suggest_label": "أسئلة مقترحة:",
        "chatbot.suggest_q1": "ما هي العلامات التحذيرية للسكتة الدماغية؟",
        "chatbot.suggest_q2": "كيف يزيد ارتفاع ضغط الدم من خطر السكتة الدماغية؟",
        "chatbot.suggest_q3": "ما هو بروتوكول FAST في الطوارئ؟",
        "chatbot.typing": "جارٍ استشارة الإرشادات الطبية للسكتة...",
        "chatbot.placeholder": "اسأل عن السكتة الدماغية، الأعراض، الوقاية...",
        "chatbot.disclaimer": "دعم القرار السريري • في حالات الطوارئ اتصل بـ 911 أو الإسعاف فوراً.",

        // Footer & Rights
        "footer.rights": "© 2026 StrokeAegis AI All rights reserved.",
        "footer.author": "Mahmood Bamatraf (محمود بامطرف)",

        // Leading Page & Auth Portal
        "auth.signin_nav": "تسجيل الدخول",
        "landing.badge": "طب الأعصاب السريري الدقيق",
        "landing.title_lead": "ابدأ بناء رعاية دقيقة مع",
        "landing.lead_desc": "منظومة اتخاذ القرار السريري الذكية متعددة الوكلاء التي تجمع بين التصوير العصبي المقطعي العميق، ونمذجة الخطر الوعائي، ووكلاء الذكاء الاصطناعي المستندين إلى أدلة جمعية القلب الأمريكية.",
        "landing.robot_welcome": "مرحباً! أنا AegisBot. سجل دخولك كطبيب أو مريض لاستكشاف منظومة القرار السريري!",
        "landing.feat1_title": "بوابة ConvNeXt",
        "landing.feat1_desc": "حاجز أمان مقطعية الدماغ",
        "landing.feat2_title": "EfficientNetV2-S",
        "landing.feat2_desc": "تفسيرية بصرية Grad-CAM",
        "landing.feat3_title": "التعلم الآلي الوعائي",
        "landing.feat3_desc": "تصنيف المخاطر المعاير",
        "landing.feat4_title": "4 وكلاء CrewAI",
        "landing.feat4_desc": "إرشادات AHA/ASA و ESO",

        "auth.tab_signin": "تسجيل الدخول",
        "auth.tab_signup": "إنشاء حساب",
        "auth.select_role_label": "اختر نوع الحساب:",
        "auth.role_doctor_title": "طبيب",
        "auth.role_doctor_sub": "طبيب سريري / استشاري",
        "auth.role_patient_title": "مريض",
        "auth.role_patient_sub": "الملف الصحي الشخصي",
        "auth.email_label": "البريد الإلكتروني",
        "auth.password_label": "كلمة المرور",
        "auth.fullname_label": "الاسم الكامل",
        "auth.license_label": "رقم الترخيص الطبي",
        "auth.spec_label": "التخصص الدقيق",
        "auth.hospital_label": "المستشفى / المركز التابع له",
        "auth.dob_label": "تاريخ الميلاد",
        "auth.gender_label": "الجنس",
        "auth.emergency_label": "جهة الاتصال في الطوارئ",
        "auth.submit_signin_doc": "تسجيل الدخول كطبيب",
        "auth.submit_signin_pat": "تسجيل الدخول كمريض",
        "auth.submit_signup_doc": "إنشاء حساب طبيب",
        "auth.submit_signup_pat": "إنشاء حساب مريض",
        "auth.or_quick_demo": "أو استخدم الدخول السريع التجريبي بنقرة واحدة",

        // Phase 2: Doctor Portal (Arabic)
        "doc.role_tag": "مساحة عمل استشاري طب المخ والأعصاب",
        "doc.stats.patients": "المرضى النشطين",
        "doc.stats.pending": "تقارير تنتظر التوقيع والاعتماد",
        "doc.stats.assessments": "إجمالي التقييمات",
        "doc.stats.unread": "رسائل غير مقروءة",
        "doc.tabs.patients": "دليل المرضى",
        "doc.tabs.reports": "التقارير السريرية والاعتماد",
        "doc.tabs.chat": "مراسلات المرضى",
        "doc.actions.launch_ai": "تشغيل نظام الذكاء الاصطناعي",
        "doc.actions.launch_reg": "النماذج المباشرة",
        "doc.actions.admit_patient": "+ إضافة مريض",
        "doc.admit_modal.title": "إضافة مريض إلى الرعاية السريرية",
        "doc.admit_modal.subtitle": "إرسال طلب ربط آمن لمدة 48 ساعة إلى مريض مسجل عبر البريد الإلكتروني",
        "doc.admit_modal.submit": "إرسال طلب الارتباط",
        "doc.launch_choice.title": "تشغيل نظام الذكاء الاصطناعي السريري",
        "doc.launch_choice.subtitle": "اختر وضع التقييم لجلسة الذكاء الاصطناعي الحالية:",
        "doc.launch_choice.assign_badge": "تخصيص لمريض",
        "doc.launch_choice.assign_title": "تعيين لمريض نشط من القائمة",
        "doc.launch_choice.assign_desc": "اختر مريضاً من سجلك الطبي لتعبئة بياناته تلقائياً وحفظ التحليل التشخيصي والتقرير الطبي في سجله المعتمد.",
        "doc.launch_choice.select_label": "اختر المريض من قائمتك السريرية:",
        "doc.launch_choice.btn_assigned": "بدء التشغيل للمريض المختار",
        "doc.launch_choice.standalone_badge": "تجربة ومحاكاة",
        "doc.launch_choice.standalone_title": "تقييم مستقل (غير مخصص لمريض)",
        "doc.launch_choice.standalone_desc": "جرّب نماذج الذكاء الاصطناعي بحرية مع إمكانية إدخال مؤشرات وصور مقطعية مخصصة دون ربطها أو تعديل أي سجل طبي للمرضى.",
        "doc.launch_choice.btn_standalone": "بدء التشغيل بالوضع المستقل",
        "doc.search_placeholder": "ابحث عن مريض بالاسم، السجل الطبي، أو الحالة...",
        "doc.reports_title": "تقارير دعم القرار السريري المعتمدة",
        "doc.th.patient": "المريض",
        "doc.th.mrn": "رقم السجل الطبي",
        "doc.th.demographics": "البيانات الديموغرافية",
        "doc.th.status": "الحالة",
        "doc.th.latest_risk": "آخر تقييم سريري",
        "doc.th.actions": "الإجراءات السريرية",
        "doc.th.report_file": "معرّف التقرير / PDF",
        "doc.th.date": "تاريخ الإصدار",
        "doc.th.findings": "النتائج السريرية",
        "doc.th.validation": "تحقق الوكلاء المتعددين",
        "doc.th.certification": "توقيع الطبيب الاستشاري",

        // Notifications (Arabic)
        "notifs.title": "الإشعارات السريرية",
        "notifs.subtitle": "تنبيهات فورية وتقارير ورسائل مباشرة من قاعدة بيانات PostgreSQL",
        "notifs.mark_all_read": "تحديد الكل كمقروء",

        // Phase 2: Patient Portal (Arabic)
        "pat.role_tag": "البوابة الصحية الشخصية للوقاية من السكتة",
        "pat.stats.assessments": "تقييماتي الصحية",
        "pat.stats.reports": "تقاريري المعتمدة",
        "pat.stats.risk_tier": "مستوى الخطر الأخير",
        "pat.stats.unread": "رسائل الطبيب",
        "pat.tabs.selfcheck": "الفحص الوعائي الذاتي",
        "pat.tabs.results": "نتائجي وصوري الإشعاعية",
        "pat.tabs.reports": "تقاريري الطبية المعتمدة",
        "pat.tabs.doctor": "طبيبي والفريق المعالج",
        "pat.tabs.chat": "محادثة الطبيب",
        "pat.selfcheck.title": "التقييم الفوري لمخاطر الأوعية الدماغية",
        "pat.selfcheck.desc": "احسب خطر إصابتك بالسكتة الدماغية استناداً إلى مؤشراتك الحيوية والقلبية المعتمدة بنماذج التعلم الآلي.",
        "pat.selfcheck.btn": "احسب خطر السكتة الدماغية لدي",
        "pat.selfcheck.btn_calculating": "جارٍ حساب خطر السكتة الدماغية...",
        "pat.selfcheck.analyzing_factors": "تحليل المؤشرات والعوامل القلبية والوعائية...",
        "pat.selfcheck.ml_consulting": "استشارة نماذج التعلم الآلي المعيارية لتقييم المخاطر الوعائية",
        "pat.selfcheck.modal_title": "تقييم صحة الأوعية الدماغية",
        "pat.selfcheck.assessment_result": "نتيجة التقييم",
        "pat.selfcheck.stroke_vulnerability": "قابلية الإصابة بالسكتة الدماغية",
        "pat.selfcheck.calculated_prob": "الاحتمالية المحسوبة",
        "pat.selfcheck.contributing_factors": "العوامل السريرية المساهمة:",
        "pat.selfcheck.no_factors": "لم يتم رصد أي مضاعفات سلبية بارزة تؤثر على القلب والأوعية.",
        "pat.selfcheck.saved_notice": "تم حفظ النتيجة تلقائياً في سجلك الطبي ومشاركتها مع طبيب الأعصاب المشرف.",
        "pat.selfcheck.close_modal": "إغلاق التقييم",
        "pat.results_title": "سجل التقييمات الصحية التاريخية",
        "pat.reports_title": "التقارير الطبية المعتمدة رسمياً",

        // Phase 2: Messaging & Common (Arabic)
        "chat.active_threads": "محادثات المرضى النشطة",
        "chat.select_thread": "اختر محادثة من القائمة لبدء التواصل.",
        "chat.doc_placeholder": "اكتب تعليمات سريرية أو رداً للمريض...",
        "chat.pat_placeholder": "اكتب رسالة أو استفساراً لطبيبك...",
        "common.refresh": "تحديث",
        "common.cancel": "إلغاء"
    }
};

let currentLang = localStorage.getItem('strokeaegis_lang') || 'en';

function getTranslation(key, lang = currentLang) {
    if (translations[lang] && translations[lang][key] !== undefined) {
        return translations[lang][key];
    }
    if (translations.en && translations.en[key] !== undefined) {
        return translations.en[key];
    }
    return key;
}

function setLanguage(lang) {
    if (lang !== 'en' && lang !== 'ar') lang = 'en';
    currentLang = lang;
    localStorage.setItem('strokeaegis_lang', lang);

    document.documentElement.lang = lang;
    document.documentElement.dir = (lang === 'ar' ? 'rtl' : 'ltr');
    document.body.classList.toggle('rtl', lang === 'ar');

    // Update text for all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = getTranslation(key, lang);
        if (text) {
            el.textContent = text;
        }
    });

    // Update HTML for elements with data-i18n-html
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        const text = getTranslation(key, lang);
        if (text) {
            el.innerHTML = text;
        }
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const text = getTranslation(key, lang);
        if (text) {
            el.placeholder = text;
        }
    });

    // Update titles / tooltips
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const text = getTranslation(key, lang);
        if (text) {
            el.title = text;
        }
    });

    // Update Language Toggle button UI
    const langBtn = document.getElementById('btn-lang-toggle');
    if (langBtn) {
        const enSpan = langBtn.querySelector('.lang-opt-en');
        const arSpan = langBtn.querySelector('.lang-opt-ar');
        if (enSpan && arSpan) {
            enSpan.classList.toggle('active', lang === 'en');
            arSpan.classList.toggle('active', lang === 'ar');
        }
        langBtn.title = (lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English');
    }

    // Dispatch event so other components can react
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

function toggleLanguage() {
    setLanguage(currentLang === 'en' ? 'ar' : 'en');
}

// Auto-initialize language on script load
document.addEventListener('DOMContentLoaded', () => {
    setLanguage(currentLang);
});
