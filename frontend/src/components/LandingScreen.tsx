import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Network,
  ShieldCheck,
  Stethoscope,
  User,
  UserPlus,
  Zap,
} from 'lucide-react';
import { useAppCore } from '../core/useAppCore';
import { CerebrovascularWaveSvg, NeuralCanvasBackdrop, SpotlightTiltCard } from './LuxuryMotion';
import { RobotMascot } from './RobotMascot';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputCls =
  'w-full h-11 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] text-sm text-[#0F2A2E] dark:text-[#ECF6F8] focus:outline-none focus:border-[#0E7490] disabled:opacity-60';
const labelCls = 'block text-xs font-semibold text-[#0F2A2E] dark:text-[#ECF6F8] mb-1';

export const LandingScreen: React.FC = () => {
  const core = useAppCore();
  const { ui } = core;
  const isRtl = ui.getLanguage() === 'ar';
  const busy = core.isLoading('auth');

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [selectedRole, setSelectedRole] = useState<'doctor' | 'patient'>('doctor');
  const [showPassword, setShowPassword] = useState(false);

  // Form state (no pre-filled credentials)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [hospital, setHospital] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'' | 'Male' | 'Female' | 'Other'>('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const switchMode = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg(
        ui.t('يرجى إدخال البريد الإلكتروني وكلمة المرور للمتابعة.', 'Please enter your email address and password.')
      );
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setErrorMsg(ui.t('صيغة البريد الإلكتروني غير صحيحة.', 'The email address format is not valid.'));
      return;
    }

    if (authMode === 'signin') {
      const err = await core.login(email, password);
      if (err) setErrorMsg(err);
      return;
    }

    // ---------- sign-up validation (mirrors the backend's rules) ----------
    if (name.trim().length < 2) {
      setErrorMsg(ui.t('الاسم الكامل يجب أن يكون حرفين على الأقل.', 'Full name must be at least 2 characters.'));
      return;
    }
    if (password.length < 6) {
      setErrorMsg(ui.t('كلمة المرور يجب أن تكون 6 أحرف على الأقل.', 'Password must be at least 6 characters.'));
      return;
    }
    if (selectedRole === 'doctor' && licenseNumber.trim().length < 2) {
      setErrorMsg(
        ui.t('رقم الترخيص الطبي مطلوب لتسجيل الطبيب.', 'A medical license number is required for doctor registration.')
      );
      return;
    }

    const err = await core.registerAccount({
      role: selectedRole,
      name,
      email,
      password,
      ...(selectedRole === 'doctor'
        ? {
            licenseNumber,
            specialty: specialty.trim() || undefined,
            hospital: hospital.trim() || undefined,
            phone: phone.trim() || undefined,
          }
        : {
            dob: dob || undefined,
            gender: gender || undefined,
            emergencyContact: emergencyContact.trim() || undefined,
          }),
    });
    if (err) setErrorMsg(err);
  };

  const mascotMessage =
    authMode === 'signin'
      ? selectedRole === 'doctor'
        ? ui.t(
            'أهلاً بعودتك يا دكتور! سجّل دخولك لمراجعة مرضاك وتشغيل تحليلات الذكاء الاصطناعي.',
            'Welcome back, doctor! Sign in to review your patients and run AI analyses.'
          )
        : ui.t(
            'أهلاً بك! سجّل دخولك لإجراء فحص سريع لمخاطر السكتة ومتابعة تقاريرك مع طبيبك.',
            'Welcome! Sign in to run a quick stroke-risk check and follow your reports with your doctor.'
          )
      : selectedRole === 'doctor'
        ? ui.t(
            'انضم إلينا كطبيب! بعد التسجيل يراجع المسؤول رقم ترخيصك قبل تفعيل حسابك.',
            'Join as a doctor! After sign-up, an administrator verifies your license before activating your account.'
          )
        : ui.t(
            'أنشئ حسابك كمريض لتتابع فحوصاتك وتتواصل مع طبيبك بأمان.',
            'Create your patient account to track your checks and talk to your doctor securely.'
          );

  /** Descriptive architecture cards (no invented performance numbers). */
  const featureCards = [
    {
      id: 'feat-convnext',
      icon: ShieldCheck,
      tag: 'ConvNeXt',
      titleAr: 'بوابة ConvNeXt لأمان الأشعة',
      titleEn: 'ConvNeXt CT Safety Gate',
      descAr: 'تتحقق أولاً من أن الصورة المرفوعة أشعة مقطعية للدماغ، وترفض الصور غير المناسبة قبل أي تشخيص.',
      descEn: 'Checks first that an upload is a brain CT slice and rejects unsuitable images before any diagnosis.',
      glow: 'teal' as const,
    },
    {
      id: 'feat-efficientnet',
      icon: Brain,
      tag: 'EfficientNetV2 · Grad-CAM',
      titleAr: 'مصنّف EfficientNetV2 مع Grad-CAM',
      titleEn: 'EfficientNetV2 Classifier + Grad-CAM',
      descAr: 'يصنّف الأشعة إلى نزفية أو إقفارية أو طبيعية، ويعرض خريطة Grad-CAM توضح المنطقة التي ركّز عليها النموذج.',
      descEn: 'Classifies CT as hemorrhagic, ischemic or normal, with a Grad-CAM heatmap showing where the model focused.',
      glow: 'emerald' as const,
    },
    {
      id: 'feat-vascular',
      icon: Activity,
      tag: 'ML · 10 inputs',
      titleAr: 'نموذج تعلم آلي لتقدير الخطر',
      titleEn: 'ML Stroke-Risk Model',
      descAr: 'يقدّر احتمال السكتة من 10 مدخلات سريرية وديموغرافية مثل العمر والضغط والسكر ومؤشر كتلة الجسم.',
      descEn: 'Estimates stroke probability from 10 clinical and demographic inputs such as age, hypertension, glucose and BMI.',
      glow: 'amber' as const,
    },
    {
      id: 'feat-crewai',
      icon: Network,
      tag: 'CrewAI',
      titleAr: 'وكلاء CrewAI السريريون',
      titleEn: 'CrewAI Clinical Agents',
      descAr: 'وكلاء للوقاية والطوارئ والتحقق وكتابة التقرير يحوّلون نتائج النماذج إلى تقرير سريري بصيغة PDF.',
      descEn: 'Prevention, emergency, validation and report agents turn model outputs into a clinical PDF report.',
      glow: 'teal' as const,
    },
    {
      id: 'feat-rag',
      icon: MessageSquare,
      tag: 'RAG',
      titleAr: 'مساعد محادثة مبني على RAG',
      titleEn: 'RAG Guideline Chatbot',
      descAr: 'يجيب عن أسئلة السكتة الدماغية بالاعتماد على إرشادات طبية مفهرسة، ويعرض المصادر التي استند إليها.',
      descEn: 'Answers stroke questions grounded in indexed clinical guidelines and shows the sources it used.',
      glow: 'emerald' as const,
      wide: true,
    },
  ];

  const roleCard = (role: 'doctor' | 'patient') => {
    const active = selectedRole === role;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => {
          setSelectedRole(role);
          setErrorMsg(null);
        }}
        className={`p-3.5 rounded-xl border text-start transition-all cursor-pointer flex items-center gap-3 ${
          active
            ? 'border-[#0E7490] dark:border-[#06B6D4] bg-[#0E7490]/8 dark:bg-[#06B6D4]/12 scale-[1.01]'
            : 'border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#0E7490]/50'
        }`}
      >
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            role === 'doctor'
              ? 'bg-[#0E7490]/15 text-[#0E7490] dark:text-[#22D3EE]'
              : 'bg-[#047857]/15 text-[#047857] dark:text-[#10B981]'
          }`}
        >
          {role === 'doctor' ? <Stethoscope className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5" />}
        </div>
        <div>
          <div className="text-xs font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">
            {role === 'doctor' ? ui.t('طبيب', 'Doctor') : ui.t('مريض', 'Patient')}
          </div>
          <div className="text-[11px] text-[#5B6B7A] dark:text-[#8CA3AF]">
            {role === 'doctor' ? ui.t('مساحة عمل الطبيب', 'Clinician Workspace') : ui.t('فحص ومتابعة', 'Self-Check & Care')}
          </div>
        </div>
      </button>
    );
  };

  const tabBtn = (mode: 'signin' | 'signup', labelAr: string, labelEn: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={authMode === mode}
      onClick={() => switchMode(mode)}
      className={`h-10 rounded-lg text-xs font-bold transition-all cursor-pointer ${
        authMode === mode
          ? 'bg-white dark:bg-[#0C1B21] text-[#0E7490] dark:text-[#22D3EE] shadow-xs'
          : 'text-[#5B6B7A] dark:text-[#8CA3AF] hover:text-[#0F2A2E] dark:hover:text-white'
      }`}
    >
      {ui.t(labelAr, labelEn)}
    </button>
  );

  return (
    <div id="screen-landing" className="min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      <main className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* Hero + architecture cards (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-8 sa-luxury-enter">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-semibold tracking-wide text-[#0E7490] dark:text-[#22D3EE] flex items-center gap-2">
                  <span>{ui.t('دعم القرار في السكتة الدماغية', 'Stroke Decision Support')}</span>
                  <span aria-hidden="true">·</span>
                  <span>{ui.t('مشروع جامعي بحثي', 'University Research Project')}</span>
                </div>
                <CerebrovascularWaveSvg />
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-[#0F2A2E] dark:text-[#ECF6F8] leading-[1.18] balance">
                {ui.t('رعاية أدق للسكتة الدماغية مع StrokeAegis AI', 'Precision Stroke Care with StrokeAegis AI')}
              </h1>

              <p className="text-base sm:text-lg text-[#5B6B7A] dark:text-[#8CA3AF] max-w-2xl leading-relaxed">
                {ui.t(
                  'منصة تجمع نموذج تعلم آلي لتقدير خطر السكتة، وبوابة ConvNeXt لفحص صلاحية الأشعة، ومصنّف EfficientNetV2 مع خرائط Grad-CAM، ووكلاء CrewAI لكتابة التقرير السريري، ومساعد محادثة مبني على RAG.',
                  'One workspace combining an ML stroke-risk model, a ConvNeXt CT validity gate, an EfficientNetV2 classifier with Grad-CAM heatmaps, CrewAI agents that draft the clinical report, and a RAG-based guideline chatbot.'
                )}
              </p>

              <SpotlightTiltCard
                tiltIntensity={2.5}
                accentGlow="teal"
                className="rounded-2xl border border-[#D7E3E6] dark:border-[#1B3540] bg-white dark:bg-[#0C1B21] shadow-sm"
              >
                <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-5 overflow-hidden">
                  <div className="absolute inset-0 pointer-events-none opacity-35 dark:opacity-50">
                    <NeuralCanvasBackdrop />
                  </div>
                  <div className="relative z-10 w-24 h-24 rounded-2xl bg-[#F0F6F7]/90 dark:bg-[#11252D]/90 border border-[#0E7490]/30 p-2 shrink-0 flex items-center justify-center shadow-md sa-float-emblem">
                    <img
                      src="/brand/logo-ai.png"
                      alt={ui.t('شعار StrokeAegis', 'StrokeAegis emblem')}
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 object-contain"
                    />
                  </div>
                  <div className="relative z-10 space-y-2.5 text-center sm:text-start flex-1">
                    <div className="text-xs font-bold text-[#047857] dark:text-[#10B981]">
                      {ui.t('جرّب النماذج مباشرة أو سجّل دخولك', 'Try the models directly or sign in')}
                    </div>
                    <p className="text-sm text-[#0F2A2E] dark:text-[#ECF6F8] leading-relaxed">
                      {ui.t(
                        'يمكنك تشغيل النماذج المباشرة ومعالج الذكاء الاصطناعي دون حساب. سجّل دخولك لحفظ التحليلات في ملف المريض والتواصل مع طبيبك.',
                        'You can run the live models and the AI wizard without an account. Sign in to save analyses to a patient record and talk to your care team.'
                      )}
                    </p>
                    <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                      <button
                        type="button"
                        onClick={() => core.navigate('screen-ai-system')}
                        className="h-10 px-4 rounded-[10px] bg-[#0E7490] hover:bg-[#0B5C73] text-white text-xs font-semibold flex items-center gap-2 transition-all hover:scale-[1.03] shadow-xs cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{ui.t('تشغيل نظام الذكاء الاصطناعي (4 خطوات)', 'Launch 4-Step AI Wizard')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => core.navigate('screen-home')}
                        className="h-10 px-4 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] bg-white/80 dark:bg-[#0C1B21]/80 hover:border-[#0E7490] text-xs font-semibold text-[#0F2A2E] dark:text-[#ECF6F8] flex items-center gap-2 transition-all hover:scale-[1.02] cursor-pointer"
                      >
                        <span>{ui.t('استعراض أنظمة التحليل', 'Explore Analysis Modes')}</span>
                        {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </SpotlightTiltCard>
            </div>

            {/* Architecture cards (descriptive only) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {featureCards.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <SpotlightTiltCard
                    key={card.id}
                    staggerIndex={idx + 1}
                    tiltIntensity={4}
                    accentGlow={card.glow}
                    className={`p-4.5 rounded-2xl border border-[#D7E3E6] dark:border-[#1B3540] bg-white dark:bg-[#0C1B21] hover:border-[#0E7490]/60 transition-colors ${
                      card.wide ? 'sm:col-span-2' : ''
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="w-9 h-9 rounded-xl bg-[#0E7490]/10 dark:bg-[#06B6D4]/15 text-[#0E7490] dark:text-[#22D3EE] flex items-center justify-center">
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-[#0E7490]/8 dark:bg-[#06B6D4]/12 text-[11px] font-bold text-[#0E7490] dark:text-[#22D3EE]" dir="ltr">
                          {card.tag}
                        </span>
                      </div>
                      <h2 className="text-sm font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">{ui.t(card.titleAr, card.titleEn)}</h2>
                      <p className="text-xs text-[#5B6B7A] dark:text-[#8CA3AF] leading-relaxed">{ui.t(card.descAr, card.descEn)}</p>
                    </div>
                  </SpotlightTiltCard>
                );
              })}
            </div>
          </div>

          {/* Mascot + authentication card (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="flex justify-center sa-luxury-enter">
              <RobotMascot
                variant="full"
                mood={errorMsg ? 'alert' : busy ? 'thinking' : 'wave'}
                message={mascotMessage}
                trackPointer
              />
            </div>

            <SpotlightTiltCard
              tiltIntensity={1.8}
              staggerIndex={2}
              className="flex-1 rounded-2xl border border-[#D7E3E6] dark:border-[#1B3540] bg-white dark:bg-[#0C1B21] p-6 sm:p-7 shadow-sm"
            >
              <div className="h-full flex flex-col justify-between space-y-6">
                <div className="space-y-5">
                  <div
                    role="tablist"
                    aria-label={ui.t('تبويبات الدخول والتسجيل', 'Authentication mode')}
                    className="grid grid-cols-2 p-1 rounded-xl bg-[#F0F6F7] dark:bg-[#11252D] border border-[#D7E3E6] dark:border-[#1B3540]"
                  >
                    {tabBtn('signin', 'تسجيل الدخول', 'Sign In')}
                    {tabBtn('signup', 'إنشاء حساب جديد', 'Create Account')}
                  </div>

                  <div className="space-y-2">
                    <span className="block text-xs font-semibold text-[#5B6B7A] dark:text-[#8CA3AF]">
                      {authMode === 'signup'
                        ? ui.t('اختر نوع الحساب', 'Choose account type')
                        : ui.t('أنا…', 'I am a…')}
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      {roleCard('doctor')}
                      {roleCard('patient')}
                    </div>
                    {authMode === 'signin' && (
                      <p className="text-[11px] text-[#5B6B7A] dark:text-[#8CA3AF]">
                        {ui.t(
                          'يتم تحديد نوع الحساب تلقائياً من بيانات الدخول.',
                          'Your account type is detected automatically from your credentials.'
                        )}
                      </p>
                    )}
                  </div>

                  {errorMsg && (
                    <div
                      role="alert"
                      className="p-3 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] dark:text-[#FCA5A5] text-xs font-medium flex items-center gap-2 sa-luxury-enter"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-3.5" noValidate aria-busy={busy}>
                    {authMode === 'signup' && (
                      <div className="sa-luxury-enter">
                        <label htmlFor="auth-fullname" className={labelCls}>
                          {ui.t('الاسم الكامل *', 'Full Name *')}
                        </label>
                        <input
                          id="auth-fullname"
                          type="text"
                          autoComplete="name"
                          value={name}
                          maxLength={150}
                          disabled={busy}
                          onChange={(e) => setName(e.target.value)}
                          className={`${inputCls} px-3.5`}
                        />
                      </div>
                    )}

                    <div>
                      <label htmlFor="auth-email" className={labelCls}>
                        {ui.t('البريد الإلكتروني *', 'Email Address *')}
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#5B6B7A] absolute top-3.5 start-3.5 pointer-events-none" />
                        <input
                          id="auth-email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          disabled={busy}
                          onChange={(e) => setEmail(e.target.value)}
                          className={`${inputCls} ps-10 pe-3.5`}
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="auth-password" className={labelCls}>
                        {ui.t('كلمة المرور *', 'Password *')}
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[#5B6B7A] absolute top-3.5 start-3.5 pointer-events-none" />
                        <input
                          id="auth-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                          value={password}
                          disabled={busy}
                          onChange={(e) => setPassword(e.target.value)}
                          aria-describedby={authMode === 'signup' ? 'auth-password-hint' : undefined}
                          className={`${inputCls} ps-10 pe-10`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={ui.t('إظهار أو إخفاء كلمة المرور', 'Show or hide password')}
                          className="absolute top-2.5 end-2.5 w-6 h-6 flex items-center justify-center text-[#5B6B7A] hover:text-[#0F2A2E] dark:hover:text-white cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {authMode === 'signup' && (
                        <p id="auth-password-hint" className="mt-1 text-[11px] text-[#5B6B7A] dark:text-[#8CA3AF]">
                          {ui.t('6 أحرف على الأقل.', 'At least 6 characters.')}
                        </p>
                      )}
                    </div>

                    {authMode === 'signup' && selectedRole === 'doctor' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 sa-luxury-enter">
                        <div>
                          <label htmlFor="doc-license" className={labelCls}>
                            {ui.t('رقم الترخيص الطبي *', 'License Number *')}
                          </label>
                          <input
                            id="doc-license"
                            type="text"
                            value={licenseNumber}
                            maxLength={100}
                            disabled={busy}
                            onChange={(e) => setLicenseNumber(e.target.value)}
                            className={`${inputCls} px-3 text-xs font-mono-tabular`}
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label htmlFor="doc-specialty" className={labelCls}>
                            {ui.t('التخصص', 'Specialty')}
                          </label>
                          <input
                            id="doc-specialty"
                            type="text"
                            value={specialty}
                            maxLength={150}
                            disabled={busy}
                            onChange={(e) => setSpecialty(e.target.value)}
                            placeholder={ui.t('أعصاب السكتة الدماغية', 'Stroke Neurology')}
                            className={`${inputCls} px-3 text-xs`}
                          />
                        </div>
                        <div>
                          <label htmlFor="doc-hospital" className={labelCls}>
                            {ui.t('المستشفى / المركز الطبي', 'Hospital / Institution')}
                          </label>
                          <input
                            id="doc-hospital"
                            type="text"
                            value={hospital}
                            maxLength={200}
                            disabled={busy}
                            onChange={(e) => setHospital(e.target.value)}
                            className={`${inputCls} px-3 text-xs`}
                          />
                        </div>
                        <div>
                          <label htmlFor="doc-phone" className={labelCls}>
                            {ui.t('رقم التواصل', 'Contact Phone')}
                          </label>
                          <input
                            id="doc-phone"
                            type="tel"
                            autoComplete="tel"
                            value={phone}
                            maxLength={50}
                            disabled={busy}
                            onChange={(e) => setPhone(e.target.value)}
                            className={`${inputCls} px-3 text-xs font-mono-tabular`}
                            dir="ltr"
                          />
                        </div>
                        <p className="sm:col-span-2 text-[11px] text-[#5B6B7A] dark:text-[#8CA3AF]">
                          {ui.t(
                            'سيبقى حسابك قيد المراجعة حتى يتحقق المسؤول من ترخيصك.',
                            'Your account stays under review until an administrator verifies your license.'
                          )}
                        </p>
                      </div>
                    )}

                    {authMode === 'signup' && selectedRole === 'patient' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 sa-luxury-enter">
                        <div>
                          <label htmlFor="pat-dob" className={labelCls}>
                            {ui.t('تاريخ الميلاد', 'Date of Birth')}
                          </label>
                          <input
                            id="pat-dob"
                            type="date"
                            value={dob}
                            disabled={busy}
                            onChange={(e) => setDob(e.target.value)}
                            className={`${inputCls} px-3 text-xs`}
                          />
                        </div>
                        <div>
                          <label htmlFor="pat-gender" className={labelCls}>
                            {ui.t('الجنس', 'Gender')}
                          </label>
                          <select
                            id="pat-gender"
                            value={gender}
                            disabled={busy}
                            onChange={(e) => setGender(e.target.value as '' | 'Male' | 'Female' | 'Other')}
                            className={`${inputCls} px-3 text-xs`}
                          >
                            <option value="">{ui.t('— اختر —', '— Select —')}</option>
                            <option value="Male">{ui.t('ذكر', 'Male')}</option>
                            <option value="Female">{ui.t('أنثى', 'Female')}</option>
                            <option value="Other">{ui.t('آخر', 'Other')}</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor="pat-emergency" className={labelCls}>
                            {ui.t('جهة اتصال للطوارئ', 'Emergency Contact')}
                          </label>
                          <input
                            id="pat-emergency"
                            type="text"
                            value={emergencyContact}
                            maxLength={100}
                            disabled={busy}
                            onChange={(e) => setEmergencyContact(e.target.value)}
                            className={`${inputCls} px-3 text-xs`}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full h-11 rounded-[10px] bg-[#0E7490] hover:bg-[#0B5C73] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01] cursor-pointer mt-2 shadow-xs"
                    >
                      {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : authMode === 'signin' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      <span>
                        {busy
                          ? ui.t('جارٍ المعالجة...', 'Please wait...')
                          : authMode === 'signin'
                            ? ui.t('تسجيل الدخول', 'Sign In')
                            : selectedRole === 'doctor'
                              ? ui.t('تقديم طلب تسجيل طبيب', 'Submit Doctor Registration')
                              : ui.t('إنشاء حساب مريض', 'Create Patient Account')}
                      </span>
                    </button>
                  </form>
                </div>

                {/* Seeded demo accounts */}
                <div className="pt-5 border-t border-[#D7E3E6] dark:border-[#1B3540] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                    <span className="font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">
                      {ui.t('الدخول بحساب تجريبي', 'Sign in with a demo account')}
                    </span>
                    <span className="text-[11px] text-[#5B6B7A] dark:text-[#8CA3AF]">
                      {ui.t('حسابات تجريبية للعرض فقط', 'Demo accounts for evaluation only')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => core.loginDemo('doctor')}
                      className="h-11 px-2 rounded-[10px] border border-[#0E7490]/40 bg-[#0E7490]/10 hover:bg-[#0E7490] hover:text-white text-[#0E7490] dark:text-[#22D3EE] text-xs font-bold transition-all hover:scale-[1.03] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {ui.t('طبيب تجريبي', 'Demo Doctor')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => core.loginDemo('patient')}
                      className="h-11 px-2 rounded-[10px] border border-[#047857]/40 bg-[#047857]/10 hover:bg-[#047857] hover:text-white text-[#047857] dark:text-[#10B981] text-xs font-bold transition-all hover:scale-[1.03] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {ui.t('مريض تجريبي', 'Demo Patient')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => core.loginDemo('admin')}
                      className="h-11 px-2 rounded-[10px] border border-[#B45309]/40 bg-[#B45309]/10 hover:bg-[#B45309] hover:text-white text-[#B45309] dark:text-[#F59E0B] text-xs font-bold transition-all hover:scale-[1.03] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {ui.t('مسؤول تجريبي', 'Demo Admin')}
                    </button>
                  </div>
                </div>
              </div>
            </SpotlightTiltCard>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#D7E3E6] dark:border-[#1B3540] bg-white dark:bg-[#0C1B21] py-5">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5B6B7A] dark:text-[#8CA3AF]">
          <div className="text-center sm:text-start">
            {ui.t(
              '© 2026 StrokeAegis AI — مشروع جامعي لأغراض البحث والتعليم، وليس بديلاً عن التقييم الطبي.',
              '© 2026 StrokeAegis AI — a university research project; not a substitute for medical evaluation.'
            )}
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => core.navigate('screen-home')} className="hover:text-[#0E7490] transition-colors cursor-pointer">
              {ui.t('أنظمة التحليل', 'Analysis Suite')}
            </button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => core.navigate('screen-ai-system')} className="hover:text-[#0E7490] transition-colors cursor-pointer">
              {ui.t('معالج الـ 4 خطوات', '4-Step AI Wizard')}
            </button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => core.openModal('chatbot-modal')} className="hover:text-[#0E7490] transition-colors cursor-pointer">
              {ui.t('المساعد الطبي الذكي', 'Clinical AI Assistant')}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
