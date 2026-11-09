import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Inbox,
  Loader2,
  Mail,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Stethoscope,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import { useAppCore } from '../core/useAppCore';
import { fmtDate } from '../core/mappers';
import {
  AuditLogEntry,
  ClinicalAssessmentRecord,
  ClinicalReport,
  ClinicianApprovalRequest,
  CtDiagnosisType,
  DoctorDirectoryEntry,
  NotificationItem,
  RiskTier,
  SafetyQueueItem,
  VascularRiskResult,
} from '../core/types';
import { RobotMascot } from './RobotMascot';
import { RobotGuide } from './RobotGuide';

// =====================================================================
// shared bits
// =====================================================================
type T = (ar: string, en: string) => string;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputCls =
  'w-full h-11 px-3.5 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] text-xs text-[#0F2A2E] dark:text-[#ECF6F8] focus:outline-none focus:border-[#0E7490] disabled:opacity-60';
const textareaCls =
  'w-full p-3 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] text-xs text-[#0F2A2E] dark:text-[#ECF6F8] focus:outline-none focus:border-[#0E7490] disabled:opacity-60';
const btnBase =
  'h-11 px-4 rounded-[10px] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
const btnPrimary = `${btnBase} bg-[#0E7490] hover:bg-[#0B5C73] text-white`;
const btnSuccess = `${btnBase} bg-[#047857] hover:bg-[#065F46] text-white`;
const btnDanger = `${btnBase} bg-[#DC2626] hover:bg-[#B91C1C] text-white`;
const btnOutline = `${btnBase} border border-[#0E7490] text-[#0E7490] dark:text-[#22D3EE] hover:bg-[#0E7490]/10`;
const cardCls = 'p-3.5 rounded-xl border border-[#D7E3E6] dark:border-[#1B3540]';
const mutedCls = 'text-[#5B6B7A] dark:text-[#8CA3AF]';

const dash = (v: unknown): string => {
  if (v === null || v === undefined) return '—';
  const s = String(v).trim();
  return s ? s : '—';
};

const tierLabel = (t: T, tier: RiskTier | string | null | undefined): string => {
  const k = String(tier || '').toLowerCase();
  if (k === 'high') return t('مرتفع', 'High');
  if (k === 'moderate' || k === 'medium') return t('متوسط', 'Moderate');
  if (k === 'low') return t('منخفض', 'Low');
  return '—';
};
const tierColor = (tier: RiskTier | string | null | undefined): string => {
  const k = String(tier || '').toLowerCase();
  if (k === 'high') return 'text-[#DC2626] dark:text-[#F87171]';
  if (k === 'moderate' || k === 'medium') return 'text-[#B45309] dark:text-[#F59E0B]';
  if (k === 'low') return 'text-[#047857] dark:text-[#10B981]';
  return mutedCls;
};
const diagLabel = (t: T, d: CtDiagnosisType | null): string => {
  if (d === 'hemorrhagic') return t('نزفية', 'Hemorrhagic');
  if (d === 'ischemic') return t('إقفارية', 'Ischemic');
  if (d === 'normal') return t('طبيعية', 'Normal');
  if (d === 'rejected_non_brain') return t('مرفوضة (ليست أشعة دماغ)', 'Rejected (not a brain CT)');
  return t('بدون أشعة', 'No CT');
};
const assessmentTypeLabel = (t: T, type: string): string => {
  if (type === 'ai_system_flow') return t('معالج الذكاء الاصطناعي', 'AI wizard');
  if (type === 'regular_ml') return t('نموذج الخطر', 'Risk model');
  if (type === 'regular_ct') return t('نموذج الأشعة', 'CT model');
  if (type.includes('quick') || type.includes('self')) return t('فحص ذاتي', 'Self-check');
  return type || '—';
};

const Spinner: React.FC<{ label: string }> = ({ label }) => (
  <div role="status" className={`py-8 flex items-center justify-center gap-2 text-xs ${mutedCls}`}>
    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
    <span>{label}</span>
  </div>
);

const EmptyState: React.FC<{ text: string; icon?: React.ElementType }> = ({ text, icon: Icon = Inbox }) => (
  <div className={`py-8 flex flex-col items-center justify-center gap-2 text-xs text-center ${mutedCls}`}>
    <Icon className="w-6 h-6 opacity-60" aria-hidden="true" />
    <span>{text}</span>
  </div>
);

const FormError: React.FC<{ msg: string | null }> = ({ msg }) =>
  msg ? (
    <div
      role="alert"
      className="p-2.5 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] dark:text-[#FCA5A5] text-xs font-medium flex items-center gap-2"
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{msg}</span>
    </div>
  ) : null;

const Field: React.FC<{ id: string; label: string; hint?: string; children: React.ReactNode }> = ({
  id,
  label,
  hint,
  children,
}) => (
  <div>
    <label htmlFor={id} className="block text-xs font-bold mb-1">
      {label}
    </label>
    {children}
    {hint && <p className={`mt-1 text-[11px] ${mutedCls}`}>{hint}</p>}
  </div>
);

const KV: React.FC<{ k: string; v: React.ReactNode }> = ({ k, v }) => (
  <div className="flex items-start justify-between gap-3 py-1">
    <span className={mutedCls}>{k}</span>
    <span className="font-semibold text-end break-words min-w-0">{v}</span>
  </div>
);

/** Accessible dialog shell: Escape / backdrop closes, focus moves in and is restored on close. */
const ModalShell: React.FC<{
  id: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'md' | 'lg';
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  autoFocusInput?: boolean;
}> = ({ id, title, closeLabel, onClose, children, size = 'md', icon, headerActions, autoFocusInput = true }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const firstInput = autoFocusInput
      ? panel?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled])')
      : null;
    (firstInput || panel)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id={id}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        className={`w-full ${
          size === 'lg' ? 'max-w-3xl' : 'max-w-xl'
        } rounded-2xl border border-[#D7E3E6] dark:border-[#1B3540] bg-white dark:bg-[#0C1B21] text-[#0F2A2E] dark:text-[#ECF6F8] shadow-xl overflow-hidden max-h-[88vh] flex flex-col sa-animate-in focus:outline-none`}
      >
        <div className="px-6 py-4 border-b border-[#D7E3E6] dark:border-[#1B3540] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {icon}
            <h2 id={`${id}-title`} className="text-base font-extrabold truncate">
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="w-8 h-8 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] flex items-center justify-center hover:border-[#DC2626] hover:text-[#DC2626] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto space-y-5 flex-1">{children}</div>
      </div>
    </div>
  );
};

/** Hook giving every modal the same core handles. */
function useModalBase() {
  const core = useAppCore();
  const t: T = (ar, en) => core.ui.t(ar, en);
  const close = () => core.closeModal();
  const closeLabel = t('إغلاق النافذة', 'Close dialog');
  return { core, t, close, closeLabel };
}

// =====================================================================
// 1. self-check result
// =====================================================================
const SelfCheckResultModal: React.FC<{ result: VascularRiskResult }> = ({ result }) => {
  const { core, t, close, closeLabel } = useModalBase();
  const sevCls = (s: string) =>
    s === 'high'
      ? 'bg-[#DC2626]/10 text-[#DC2626] dark:text-[#F87171]'
      : s === 'moderate'
        ? 'bg-[#B45309]/10 text-[#B45309] dark:text-[#F59E0B]'
        : 'bg-[#047857]/10 text-[#047857] dark:text-[#10B981]';
  return (
    <ModalShell id="modal-selfcheck-result" title={t('نتيجة تقييم خطر السكتة الدماغية', 'Stroke Risk Assessment Result')} closeLabel={closeLabel} onClose={close}>
      <div className="p-5 rounded-xl border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className={`text-xs ${mutedCls}`}>{t('مستوى الخطر', 'Risk tier')}</div>
          <div className={`text-xl font-extrabold flex items-center gap-2 ${tierColor(result.tier)}`}>
            {result.tier === 'high' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : result.tier === 'moderate' ? (
              <Clock className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            <span>{tierLabel(t, result.tier)}</span>
          </div>
        </div>
        <div className="text-end">
          <div className={`text-xs ${mutedCls}`}>{t('الاحتمال التقديري', 'Estimated probability')}</div>
          <div className="text-3xl font-extrabold font-mono-tabular text-[#0E7490] dark:text-[#22D3EE]">
            {Number(result.probability || 0).toFixed(1)}%
          </div>
        </div>
      </div>

      {(result.summaryAr || result.summaryEn) && (
        <p className={`text-xs leading-relaxed ${mutedCls}`}>{t(result.summaryAr || result.summaryEn, result.summaryEn || result.summaryAr)}</p>
      )}

      {result.factors.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold">{t('العوامل المؤثرة في النتيجة', 'Contributing factors')}</div>
          {result.factors.map((f) => (
            <div key={f.id} className={`${cardCls} p-3 flex items-start justify-between gap-3 text-xs`}>
              <div className="space-y-0.5 min-w-0">
                <div className="font-semibold">{t(f.labelAr || f.labelEn, f.labelEn)}</div>
                {f.valueDisplay && <div className={mutedCls}>{f.valueDisplay}</div>}
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${sevCls(f.severity)}`}>
                {f.severity === 'high' ? t('مرتفع', 'High') : f.severity === 'moderate' ? t('متوسط', 'Moderate') : t('طبيعي', 'Normal')}
              </span>
            </div>
          ))}
        </div>
      )}

      {result.recommendations.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold">{t('التوصيات', 'Recommendations')}</div>
          <ul className="list-disc ps-5 space-y-1 text-xs leading-relaxed">
            {result.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
        {t(
          'هذه النتيجة تقدير من نموذج تعلم آلي وليست تشخيصاً. راجع طبيبك، واتصل بالطوارئ فوراً عند ظهور أعراض السكتة.',
          'This is a machine-learning estimate, not a diagnosis. Talk to your doctor, and call emergency services immediately if stroke symptoms appear.'
        )}
      </p>

      <div className="p-3 rounded-lg bg-[#047857]/10 text-[#047857] dark:text-[#10B981] text-xs font-bold flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {t('تم حفظ النتيجة في سجلك', 'Saved to your record')}
        </span>
        <button
          type="button"
          onClick={() => {
            core.closeModal();
            core.setPatientTab('pat-pane-results');
          }}
          className="underline cursor-pointer"
        >
          {t('عرض السجل', 'View history')}
        </button>
      </div>
    </ModalShell>
  );
};

// =====================================================================
// 2. patient history (doctor)
// =====================================================================
const PatientHistoryModal: React.FC<{ ctx: Record<string, unknown> }> = ({ ctx }) => {
  const { core, t, close, closeLabel } = useModalBase();
  const patientId = String(ctx.patientId || '');
  const loading = Boolean(ctx.loading);
  const p = (ctx.patient || {}) as Record<string, any>;
  const assessments = (ctx.assessments as ClinicalAssessmentRecord[] | undefined) || [];
  const reports = (ctx.reports as ClinicalReport[] | undefined) || [];
  const listed = core.getPatients().find((x) => x.id === patientId);
  const name = p.full_name || listed?.name || p.email || '';

  return (
    <ModalShell
      id="modal-patient-history"
      size="lg"
      title={name ? t(`السجل السريري: ${name}`, `Clinical history: ${name}`) : t('السجل السريري للمريض', 'Patient clinical history')}
      closeLabel={closeLabel}
      onClose={close}
    >
      <div className="p-4 rounded-xl bg-[#F7FAFA] dark:bg-[#11252D] grid grid-cols-1 sm:grid-cols-2 gap-x-6 text-xs">
        <KV k={t('رقم الملف', 'MRN')} v={<span className="font-mono-tabular">{dash(p.mrn || listed?.mrn)}</span>} />
        <KV k={t('البريد', 'Email')} v={dash(p.email || listed?.email)} />
        <KV
          k={t('الجنس', 'Gender')}
          v={p.gender === 'Male' ? t('ذكر', 'Male') : p.gender === 'Female' ? t('أنثى', 'Female') : dash(p.gender)}
        />
        <KV k={t('تاريخ الميلاد', 'Date of birth')} v={dash(p.date_of_birth)} />
      </div>

      {loading ? (
        <Spinner label={t('جارٍ تحميل السجل...', 'Loading history...')} />
      ) : (
        <>
          <section className="space-y-2.5" aria-labelledby="hist-assess-h">
            <h3 id="hist-assess-h" className="text-xs font-bold">
              {t(`التقييمات (${assessments.length})`, `Assessments (${assessments.length})`)}
            </h3>
            {assessments.length === 0 ? (
              <EmptyState text={t('لا توجد تقييمات محفوظة لهذا المريض بعد.', 'No saved assessments for this patient yet.')} />
            ) : (
              assessments.map((a) => (
                <div key={a.id} className={`${cardCls} text-xs space-y-1.5`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                    <span className="font-mono-tabular">{a.date}</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#0E7490]/10 text-[#0E7490] dark:text-[#22D3EE] text-[11px]">
                      {assessmentTypeLabel(t, a.assessmentType)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      {t('الخطر:', 'Risk:')}{' '}
                      <b className={tierColor(a.riskTier)}>
                        {a.riskProbability != null ? `${a.riskProbability.toFixed(1)}% · ` : ''}
                        {tierLabel(t, a.riskTier)}
                      </b>
                    </span>
                    <span>
                      {t('الأشعة:', 'CT:')} <b>{diagLabel(t, a.ctDiagnosis)}</b>
                      {a.ctConfidence != null && <span className={mutedCls}> ({a.ctConfidence.toFixed(1)}%)</span>}
                    </span>
                    {a.signedOff && (
                      <span className="text-[#047857] dark:text-[#10B981] font-semibold">{t('موقّع', 'Signed off')}</span>
                    )}
                  </div>
                  {(a.summaryEn || a.summaryAr) && <p className={`${mutedCls} leading-relaxed`}>{t(a.summaryAr || a.summaryEn, a.summaryEn || a.summaryAr)}</p>}
                </div>
              ))
            )}
          </section>

          <section className="space-y-2.5" aria-labelledby="hist-reports-h">
            <h3 id="hist-reports-h" className="text-xs font-bold">
              {t(`التقارير (${reports.length})`, `Reports (${reports.length})`)}
            </h3>
            {reports.length === 0 ? (
              <EmptyState icon={FileText} text={t('لا توجد تقارير لهذا المريض بعد.', 'No reports for this patient yet.')} />
            ) : (
              reports.map((r) => {
                const dl = core.isLoading(`download-${r.id}`);
                return (
                  <div key={r.id} className={`${cardCls} text-xs flex flex-wrap items-center justify-between gap-3`}>
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-bold font-mono-tabular">{r.reportCode}</div>
                      <div className={mutedCls}>
                        {r.createdAt} ·{' '}
                        {r.signedStatus === 'Signed & Approved' ? t('موقّع ومعتمد', 'Signed & approved') : t('بانتظار التوقيع', 'Pending sign-off')} ·{' '}
                        {dash(r.validationStatus)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={dl}
                      onClick={() => void core.downloadReport(r.id, r.pdfFilename)}
                      className={`${btnOutline} h-9 px-3`}
                    >
                      {dl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>{t('تنزيل PDF', 'Download PDF')}</span>
                    </button>
                  </div>
                );
              })
            )}
          </section>
        </>
      )}

      {patientId && (
        <div className="flex justify-end pt-1">
          <button type="button" onClick={() => core.launchAiWizardForPatient(patientId)} className={btnPrimary}>
            <Zap className="w-4 h-4" />
            <span>{t('تحليل جديد بالذكاء الاصطناعي', 'New AI analysis')}</span>
          </button>
        </div>
      )}
    </ModalShell>
  );
};

// =====================================================================
// 3. launch AI choice
// =====================================================================
const LaunchAiChoiceModal: React.FC<{ patientId: string | null }> = ({ patientId }) => {
  const { core, t, close, closeLabel } = useModalBase();
  const patient = patientId ? core.getPatients().find((p) => p.id === patientId) : null;
  return (
    <ModalShell id="modal-launch-ai-choice" title={t('اختر طريقة التحليل', 'Choose an analysis mode')} closeLabel={closeLabel} onClose={close}>
      {patient && (
        <div className="p-3 rounded-xl bg-[#F7FAFA] dark:bg-[#11252D] text-xs">
          <span className={mutedCls}>{t('المريض:', 'Patient:')}</span>{' '}
          <b>{t(patient.nameAr || patient.name, patient.name)}</b> <span className="font-mono-tabular">({patient.mrn})</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => core.launchAiWizardForPatient(patientId)}
          className={`${cardCls} p-4 text-start hover:border-[#0E7490] transition-colors cursor-pointer space-y-1.5`}
        >
          <div className="flex items-center gap-2 text-sm font-bold text-[#0E7490] dark:text-[#22D3EE]">
            <Zap className="w-4 h-4" />
            {t('معالج الذكاء الاصطناعي (4 خطوات)', '4-Step AI Wizard')}
          </div>
          <p className={`text-xs leading-relaxed ${mutedCls}`}>
            {t(
              'العلامات الحيوية + الأشعة ثم وكلاء CrewAI وتقرير PDF يُحفظ في ملف المريض.',
              'Vitals + CT, then CrewAI agents and a PDF report saved to the patient record.'
            )}
          </p>
        </button>
        <button
          type="button"
          onClick={() => core.navigate('screen-regular-system')}
          className={`${cardCls} p-4 text-start hover:border-[#0E7490] transition-colors cursor-pointer space-y-1.5`}
        >
          <div className="flex items-center gap-2 text-sm font-bold">
            <Stethoscope className="w-4 h-4" />
            {t('النماذج المباشرة', 'Live Models')}
          </div>
          <p className={`text-xs leading-relaxed ${mutedCls}`}>
            {t(
              'تشغيل نموذج الخطر أو نموذج الأشعة منفرداً للحصول على نتيجة فورية.',
              'Run the risk model or the CT model on its own for an instant result.'
            )}
          </p>
        </button>
      </div>
    </ModalShell>
  );
};

// =====================================================================
// 4. admit (invite) patient by email
// =====================================================================
const AdmitPatientModal: React.FC = () => {
  const { core, t, close, closeLabel } = useModalBase();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const busy = core.isLoading('admit');
  return (
    <ModalShell id="modal-admit-patient" title={t('إضافة مريض إلى قائمتك', 'Add a patient to your list')} closeLabel={closeLabel} onClose={close}>
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          if (!EMAIL_RE.test(email.trim())) {
            setErr(t('أدخل بريداً إلكترونياً صحيحاً.', 'Enter a valid email address.'));
            return;
          }
          setErr(null);
          await core.requestPatientByEmail(email);
        }}
        className="space-y-4"
      >
        <div className="p-3 rounded-xl bg-[#0E7490]/8 dark:bg-[#06B6D4]/10 text-xs leading-relaxed flex gap-2">
          <Mail className="w-4 h-4 shrink-0 text-[#0E7490] dark:text-[#22D3EE]" aria-hidden="true" />
          <span>
            {t(
              'يجب أن يكون لدى المريض حساب مسجّل مسبقاً في StrokeAegis. سنرسل له طلب ربط، ولن يظهر في قائمتك إلا بعد أن يقبل الطلب.',
              'The patient must already have a registered StrokeAegis account. We will send them a link request; they appear in your list only after they accept it.'
            )}
          </span>
        </div>
        <Field id="adm-email" label={t('البريد الإلكتروني للمريض *', 'Patient email *')}>
          <input
            id="adm-email"
            type="email"
            autoComplete="off"
            dir="ltr"
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </Field>
        <FormError msg={err} />
        <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          <span>{t('إرسال طلب الربط', 'Send link request')}</span>
        </button>
      </form>
    </ModalShell>
  );
};

// =====================================================================
// 5. find a doctor (patient)
// =====================================================================
const FindDoctorModal: React.FC = () => {
  const { core, t, close, closeLabel } = useModalBase();
  const [q, setQ] = useState('');
  const loading = core.isLoading('doctor-directory');
  const all = core.getDoctorDirectory();
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter((d) =>
      [d.name, d.email, d.specialty, d.hospital].some((v) => String(v || '').toLowerCase().includes(s))
    );
  }, [all, q]);

  const action = (d: DoctorDirectoryEntry) => {
    const busy = core.isLoading(`req-doc-${d.doctorId}`);
    const badge = (text: string, cls: string) => (
      <span className={`h-9 px-3 rounded-lg text-[11px] font-bold flex items-center shrink-0 ${cls}`}>{text}</span>
    );
    switch (d.statusLabel) {
      case 'primary':
        return badge(t('طبيبك الأساسي', 'Your primary doctor'), 'bg-[#047857]/10 text-[#047857] dark:text-[#10B981]');
      case 'care_team':
        return badge(t('ضمن فريق رعايتك', 'In your care team'), 'bg-[#047857]/10 text-[#047857] dark:text-[#10B981]');
      case 'pending':
        return badge(t('الطلب قيد الانتظار', 'Request pending'), 'bg-[#B45309]/10 text-[#B45309] dark:text-[#F59E0B]');
      case 'available':
      case 'declined':
      case 'expired':
        return (
          <button
            type="button"
            disabled={busy}
            onClick={() => void core.requestDoctor(d.doctorId)}
            className={`${btnPrimary} h-9 px-3 shrink-0`}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{d.statusLabel === 'available' ? t('طلب متابعة', 'Request care') : t('إعادة الطلب', 'Request again')}</span>
          </button>
        );
      default:
        return badge(String(d.statusLabel || '—'), `bg-[#F0F6F7] dark:bg-[#11252D] ${mutedCls}`);
    }
  };

  return (
    <ModalShell id="modal-find-doctor" title={t('البحث عن طبيب', 'Find a doctor')} closeLabel={closeLabel} onClose={close}>
      <div className="relative">
        <label htmlFor="doc-search" className="sr-only">
          {t('بحث', 'Search')}
        </label>
        <Search className="w-4 h-4 text-[#5B6B7A] absolute top-3.5 start-3.5 pointer-events-none" aria-hidden="true" />
        <input
          id="doc-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('ابحث بالاسم أو التخصص أو المستشفى...', 'Search by name, specialty or hospital...')}
          className={`${inputCls} ps-10`}
        />
      </div>
      {loading && all.length === 0 ? (
        <Spinner label={t('جارٍ تحميل الأطباء...', 'Loading doctors...')} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          text={q ? t('لا يوجد طبيب يطابق البحث.', 'No doctor matches your search.') : t('لا يوجد أطباء معتمدون حالياً.', 'No approved doctors are available yet.')}
        />
      ) : (
        <div className="space-y-2.5">
          {list.map((d) => (
            <div key={d.doctorId} className={`${cardCls} flex items-center justify-between gap-3 text-xs`}>
              <div className="min-w-0">
                <div className="font-bold truncate">{d.name}</div>
                <div className={`${mutedCls} truncate`}>{[d.specialty, d.hospital].filter(Boolean).join(' · ') || d.email}</div>
              </div>
              {action(d)}
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
};

// =====================================================================
// 6. notifications
// =====================================================================
const NotificationsModal: React.FC = () => {
  const { core, t, close, closeLabel } = useModalBase();
  const items = core.getNotifications();
  const unread = core.getUnreadNotificationCount();
  const loading = core.isLoading('notifications');
  const marking = core.isLoading('notif-read');
  const iconFor = (n: NotificationItem) =>
    n.type === 'alert' ? ShieldAlert : n.type === 'message' ? MessageSquare : n.type === 'report' ? FileText : Bell;
  return (
    <ModalShell
      id="modal-notifications-drawer"
      title={t('الإشعارات', 'Notifications')}
      closeLabel={closeLabel}
      onClose={close}
      autoFocusInput={false}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs ${mutedCls}`}>
          {unread > 0 ? t(`${unread} غير مقروءة`, `${unread} unread`) : t('لا توجد إشعارات غير مقروءة', 'No unread notifications')}
        </span>
        <button
          type="button"
          disabled={unread === 0 || marking}
          onClick={() => void core.markAllNotificationsRead()}
          className="text-xs font-bold text-[#0E7490] dark:text-[#22D3EE] flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          {t('تحديد الكل كمقروء', 'Mark all as read')}
        </button>
      </div>
      {loading && items.length === 0 ? (
        <Spinner label={t('جارٍ التحميل...', 'Loading...')} />
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} text={t('لا توجد إشعارات بعد.', 'You have no notifications yet.')} />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = iconFor(n);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.read) void core.markNotificationRead(n.id);
                  }}
                  aria-label={n.read ? undefined : t(`${n.titleAr} (غير مقروء، اضغط للتحديد كمقروء)`, `${n.titleEn} (unread, click to mark as read)`)}
                  className={`w-full text-start p-3 rounded-xl border text-xs flex gap-3 transition-colors ${
                    n.read
                      ? 'border-[#D7E3E6] dark:border-[#1B3540] cursor-default'
                      : 'border-[#0E7490]/40 bg-[#0E7490]/6 dark:bg-[#06B6D4]/8 cursor-pointer hover:border-[#0E7490]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 mt-0.5 ${n.type === 'alert' ? 'text-[#DC2626]' : 'text-[#0E7490] dark:text-[#22D3EE]'}`}
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0 space-y-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className={`font-bold ${n.read ? '' : 'text-[#0F2A2E] dark:text-white'}`}>{t(n.titleAr, n.titleEn)}</span>
                      <span className={`font-mono-tabular text-[11px] shrink-0 ${mutedCls}`}>{n.time}</span>
                    </span>
                    <span className={`block leading-relaxed ${mutedCls}`}>{t(n.bodyAr, n.bodyEn)}</span>
                  </span>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-[#0E7490] dark:bg-[#22D3EE] mt-1.5 shrink-0" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </ModalShell>
  );
};

// =====================================================================
// 7. admin: approve clinician
// =====================================================================
const ClinicianSummary: React.FC<{ c: ClinicianApprovalRequest; t: T }> = ({ c, t }) => (
  <div className="p-4 rounded-xl bg-[#F7FAFA] dark:bg-[#11252D] text-xs grid grid-cols-1 sm:grid-cols-2 gap-x-6">
    <KV k={t('الاسم', 'Name')} v={dash(c.name)} />
    <KV k={t('البريد', 'Email')} v={dash(c.email)} />
    <KV k={t('رقم الترخيص', 'License')} v={<span className="font-mono-tabular">{dash(c.licenseNumber)}</span>} />
    <KV k={t('التخصص', 'Specialty')} v={dash(c.specialty)} />
    <KV k={t('المستشفى', 'Hospital')} v={dash(c.hospital)} />
    <KV k={t('تاريخ التقديم', 'Submitted')} v={dash(c.submittedAt)} />
  </div>
);

const ApproveClinicianModal: React.FC<{ clinician: ClinicianApprovalRequest }> = ({ clinician }) => {
  const { core, t, close, closeLabel } = useModalBase();
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const busy = core.isLoading(`clinician-${clinician.id}`);
  return (
    <ModalShell id="modal-admin-approve-clinician" title={t(`اعتماد الطبيب: ${clinician.name}`, `Approve doctor: ${clinician.name}`)} closeLabel={closeLabel} onClose={close}>
      <ClinicianSummary c={clinician} t={t} />
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          if (ref.trim().length < 2) {
            setErr(t('مرجع التحقق مطلوب (حرفان على الأقل).', 'Verification reference is required (at least 2 characters).'));
            return;
          }
          setErr(null);
          await core.updateClinicianStatus(clinician.id, 'active', notes.trim() || undefined, ref.trim());
        }}
        className="space-y-4"
      >
        <Field
          id="ap-ref"
          label={t('مرجع التحقق من الترخيص *', 'License verification reference *')}
          hint={t('مثال: رقم سجل الهيئة الذي تحققت منه.', 'e.g. the registry record number you checked.')}
        >
          <input id="ap-ref" type="text" value={ref} disabled={busy} onChange={(e) => setRef(e.target.value)} className={`${inputCls} font-mono-tabular`} dir="ltr" />
        </Field>
        <Field id="ap-notes" label={t('ملاحظات (اختياري)', 'Notes (optional)')}>
          <textarea id="ap-notes" rows={3} value={notes} disabled={busy} onChange={(e) => setNotes(e.target.value)} className={textareaCls} />
        </Field>
        <FormError msg={err} />
        <button type="submit" disabled={busy} className={`${btnSuccess} w-full`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{t('اعتماد الطبيب وتفعيل الحساب', 'Approve and activate account')}</span>
        </button>
      </form>
    </ModalShell>
  );
};

// =====================================================================
// 8. admin: reject / suspend / request info
// =====================================================================
const ActionReasonModal: React.FC<{ clinician: ClinicianApprovalRequest; action: 'reject' | 'suspend' | 'request-info' }> = ({
  clinician,
  action,
}) => {
  const { core, t, close, closeLabel } = useModalBase();
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const busy = core.isLoading(`clinician-${clinician.id}`);
  const meta =
    action === 'reject'
      ? { title: t('رفض طلب الطبيب', 'Reject doctor application'), label: t('سبب الرفض *', 'Rejection reason *'), btn: t('رفض الطلب', 'Reject application'), cls: btnDanger }
      : action === 'suspend'
        ? { title: t('إيقاف حساب الطبيب', 'Suspend doctor account'), label: t('سبب الإيقاف *', 'Suspension reason *'), btn: t('إيقاف الحساب', 'Suspend account'), cls: btnDanger }
        : {
            title: t('طلب معلومات إضافية', 'Request more information'),
            label: t('المعلومات المطلوبة من الطبيب *', 'Information requested from the doctor *'),
            btn: t('إرسال الطلب', 'Send request'),
            cls: btnPrimary,
          };
  return (
    <ModalShell id="modal-admin-action-reason" title={`${meta.title}: ${clinician.name}`} closeLabel={closeLabel} onClose={close}>
      <ClinicianSummary c={clinician} t={t} />
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          if (reason.trim().length < 5) {
            setErr(t('اكتب 5 أحرف على الأقل.', 'Please write at least 5 characters.'));
            return;
          }
          setErr(null);
          const status = action === 'reject' ? 'rejected' : action === 'suspend' ? 'suspended' : 'info_requested';
          await core.updateClinicianStatus(clinician.id, status, reason.trim());
        }}
        className="space-y-4"
      >
        <Field id="act-reason" label={meta.label} hint={t('سيظهر هذا النص للطبيب.', 'The doctor will see this text.')}>
          <textarea id="act-reason" rows={4} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} className={textareaCls} />
        </Field>
        <FormError msg={err} />
        <button type="submit" disabled={busy} className={`${meta.cls} w-full`}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{meta.btn}</span>
        </button>
      </form>
    </ModalShell>
  );
};

// =====================================================================
// 9. admin: safety case details (raw backend object)
// =====================================================================
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-1.5">
    <h3 className="text-xs font-bold">{title}</h3>
    <div className="p-3.5 rounded-xl bg-[#F7FAFA] dark:bg-[#11252D] text-xs">{children}</div>
  </section>
);

const SafetyDetailsModal: React.FC<{ ctx: Record<string, unknown> }> = ({ ctx }) => {
  const { core, t, close, closeLabel } = useModalBase();
  const loading = Boolean(ctx.loading);
  const d = (ctx.detail || null) as Record<string, any> | null;
  const patient = (d?.patient || {}) as Record<string, any>;
  const doc = (d?.assigned_doctor || null) as Record<string, any> | null;
  const vitals = (d?.vitals || {}) as Record<string, unknown>;
  const gate = (d?.gatekeeper || {}) as Record<string, any>;
  const ct = (d?.ct_classifier || {}) as Record<string, any>;
  const ml = (d?.ml_risk || {}) as Record<string, any>;
  const findings = d?.agent_findings as Record<string, unknown> | null | undefined;
  const report = (d?.report || null) as Record<string, any> | null;
  const tracking = (d?.safety_tracking || {}) as Record<string, any>;
  const history = (Array.isArray(d?.audit_history) ? d!.audit_history : []) as Record<string, any>[];
  const summary = findings && typeof findings === 'object' ? (findings as any).overall_clinical_summary : null;
  const pct = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : `${Number(v).toFixed(1)}%`);
  const reportBusy = report?.id ? core.isLoading(`download-${report.id}`) : false;

  return (
    <ModalShell
      id="modal-admin-safety-details"
      size="lg"
      title={t('تفاصيل حالة السلامة', 'Safety case details')}
      closeLabel={closeLabel}
      onClose={close}
      autoFocusInput={false}
    >
      {loading ? (
        <Spinner label={t('جارٍ تحميل الحالة...', 'Loading case...')} />
      ) : !d ? (
        <EmptyState icon={ShieldAlert} text={t('تعذّر تحميل تفاصيل الحالة.', 'Could not load the case details.')} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Section title={t('المريض', 'Patient')}>
              <KV k={t('الاسم', 'Name')} v={dash(patient.full_name)} />
              <KV k={t('رقم الملف', 'MRN')} v={<span className="font-mono-tabular">{dash(patient.mrn)}</span>} />
              <KV k={t('البريد', 'Email')} v={dash(patient.email)} />
              <KV k={t('الجنس / الميلاد', 'Gender / DOB')} v={`${dash(patient.gender)} · ${dash(patient.dob)}`} />
            </Section>
            <Section title={t('الطبيب المسؤول', 'Assigned doctor')}>
              {doc ? (
                <>
                  <KV k={t('الاسم', 'Name')} v={dash(doc.full_name)} />
                  <KV k={t('البريد', 'Email')} v={dash(doc.email)} />
                  <KV k={t('التخصص', 'Specialty')} v={dash(doc.specialization)} />
                  <KV k={t('المستشفى', 'Hospital')} v={dash(doc.hospital_affiliation)} />
                </>
              ) : (
                <span className={mutedCls}>{t('لم يُسند لطبيب بعد.', 'Not assigned yet.')}</span>
              )}
            </Section>
            <Section title={t('نموذج الخطر', 'ML risk model')}>
              <KV k={t('المستوى', 'Tier')} v={<span className={tierColor(ml.tier)}>{tierLabel(t, ml.tier)}</span>} />
              <KV k={t('الاحتمال', 'Probability')} v={ml.probability_pct != null ? pct(ml.probability_pct) : ml.probability != null ? pct(Number(ml.probability) * 100) : '—'} />
            </Section>
            <Section title={t('الأشعة المقطعية', 'CT analysis')}>
              <KV k={t('بوابة الأمان', 'Safety gate')} v={dash(gate.status)} />
              <KV k={t('التشخيص', 'Diagnosis')} v={dash(ct.diagnosis)} />
              <KV k={t('الثقة', 'Confidence')} v={ct.confidence_pct != null ? pct(ct.confidence_pct) : ct.confidence != null ? pct(Number(ct.confidence) * 100) : '—'} />
            </Section>
          </div>

          <Section title={t('متابعة السلامة', 'Safety tracking')}>
            <KV k={t('الحالة', 'Status')} v={dash(tracking.status)} />
            <KV k={t('أسند بواسطة', 'Assigned by')} v={dash(tracking.assigned_by_name)} />
            <KV k={t('وقت الإسناد', 'Assigned at')} v={dash(fmtDate(tracking.assigned_at))} />
            {tracking.notes && <p className="pt-1.5 leading-relaxed whitespace-pre-wrap">{String(tracking.notes)}</p>}
          </Section>

          {Object.keys(vitals).length > 0 && (
            <Section title={t('العلامات الحيوية المُدخلة', 'Submitted vitals')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                {Object.entries(vitals).map(([k, v]) => (
                  <KV key={k} k={k} v={<span className="font-mono-tabular">{typeof v === 'object' ? JSON.stringify(v) : dash(v)}</span>} />
                ))}
              </div>
            </Section>
          )}

          {(summary || (findings && Object.keys(findings).length > 0)) && (
            <Section title={t('نتائج الوكلاء', 'Agent findings')}>
              {summary && <p className="leading-relaxed whitespace-pre-wrap">{String(summary)}</p>}
              {findings && Object.keys(findings).length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-semibold text-[#0E7490] dark:text-[#22D3EE]">{t('عرض البيانات الكاملة', 'Show raw data')}</summary>
                  <pre className="mt-2 p-3 rounded-lg bg-[#091318] text-cyan-300 font-mono-tabular text-[11px] overflow-x-auto max-h-64" dir="ltr">
                    {JSON.stringify(findings, null, 2)}
                  </pre>
                </details>
              )}
            </Section>
          )}

          <Section title={t('التقرير', 'Report')}>
            {report ? (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-[200px]">
                  <KV k={t('التحقق', 'Validation')} v={dash(report.validation_status)} />
                  <KV k={t('التوقيع', 'Sign-off')} v={report.physician_signed_off ? t(`موقّع ${fmtDate(report.signed_at)}`, `Signed ${fmtDate(report.signed_at)}`) : t('غير موقّع', 'Not signed')} />
                  {report.sign_off_notes && <KV k={t('ملاحظات التوقيع', 'Sign-off notes')} v={String(report.sign_off_notes)} />}
                </div>
                {report.id && (
                  <button
                    type="button"
                    disabled={reportBusy}
                    onClick={() => void core.downloadReport(String(report.id), report.pdf_filename ? String(report.pdf_filename) : null)}
                    className={`${btnOutline} h-9 px-3`}
                  >
                    {reportBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    <span>{t('تنزيل PDF', 'Download PDF')}</span>
                  </button>
                )}
              </div>
            ) : (
              <span className={mutedCls}>{t('لا يوجد تقرير لهذه الحالة.', 'No report for this case.')}</span>
            )}
          </Section>

          <Section title={t(`سجل التدقيق (${history.length})`, `Audit history (${history.length})`)}>
            {history.length === 0 ? (
              <span className={mutedCls}>{t('لا توجد أحداث.', 'No events.')}</span>
            ) : (
              <ul className="divide-y divide-[#D7E3E6] dark:divide-[#1B3540]">
                {history.map((h, i) => (
                  <li key={String(h.id ?? i)} className="py-2 space-y-0.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{dash(h.action)}</span>
                      <span className={`font-mono-tabular text-[11px] ${mutedCls}`}>{fmtDate(h.created_at)}</span>
                    </div>
                    <div className={mutedCls}>
                      {dash(h.actor_name)} ({dash(h.actor_role)}) · {dash(h.outcome)}
                      {h.reason ? ` · ${h.reason}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </ModalShell>
  );
};

// =====================================================================
// 10. admin: assign safety case
// =====================================================================
const SafetyCaseHeader: React.FC<{ item: SafetyQueueItem; t: T }> = ({ item, t }) => (
  <div className="p-3.5 rounded-xl bg-[#F7FAFA] dark:bg-[#11252D] text-xs space-y-1">
    <div className="font-bold">
      {item.caseCode} · {t(item.patientNameAr || item.patientName, item.patientName)}{' '}
      <span className="font-mono-tabular font-normal">({item.mrn})</span>
    </div>
    <div className={mutedCls}>{t(item.triggerReasonAr || item.triggerReasonEn, item.triggerReasonEn)}</div>
  </div>
);

const SafetyAssignModal: React.FC<{ item: SafetyQueueItem }> = ({ item }) => {
  const { core, t, close, closeLabel } = useModalBase();
  const clinicians = core.getQualifiedClinicians();
  const loadingList = core.isLoading('qualified');
  const busy = core.isLoading('safety-assign');
  const [doctorId, setDoctorId] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <ModalShell id="modal-admin-safety-assign" title={t('إسناد الحالة إلى طبيب', 'Assign case to a doctor')} closeLabel={closeLabel} onClose={close}>
      <SafetyCaseHeader item={item} t={t} />
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          if (!doctorId) {
            setErr(t('اختر طبيباً.', 'Please choose a doctor.'));
            return;
          }
          setErr(null);
          await core.assignSafetyCase(item.id, doctorId, notes.trim() || undefined);
        }}
        className="space-y-4"
      >
        <Field id="assign-doc" label={t('الطبيب *', 'Doctor *')}>
          <select id="assign-doc" value={doctorId} disabled={busy || loadingList} onChange={(e) => setDoctorId(e.target.value)} className={inputCls}>
            <option value="">
              {loadingList ? t('جارٍ التحميل...', 'Loading...') : clinicians.length === 0 ? t('لا يوجد أطباء معتمدون', 'No approved doctors') : t('— اختر طبيباً —', '— Choose a doctor —')}
            </option>
            {clinicians.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.specialty ? ` · ${c.specialty}` : ''}
                {c.hospital ? ` · ${c.hospital}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field id="assign-notes" label={t('ملاحظات (اختياري)', 'Notes (optional)')}>
          <textarea id="assign-notes" rows={3} value={notes} disabled={busy} onChange={(e) => setNotes(e.target.value)} className={textareaCls} />
        </Field>
        <FormError msg={err} />
        <button type="submit" disabled={busy || loadingList} className={`${btnPrimary} w-full`}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{t('تأكيد الإسناد', 'Assign case')}</span>
        </button>
      </form>
    </ModalShell>
  );
};

// =====================================================================
// 11. admin: investigate
// =====================================================================
const InvestigateModal: React.FC<{ item: SafetyQueueItem }> = ({ item }) => {
  const { core, t, close, closeLabel } = useModalBase();
  const busy = core.isLoading('safety-investigate');
  const [status, setStatus] = useState<'resolved' | 'false_positive' | 'escalated'>('resolved');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <ModalShell id="modal-admin-investigate" title={t('تسجيل نتيجة التحقيق', 'Record investigation outcome')} closeLabel={closeLabel} onClose={close}>
      <SafetyCaseHeader item={item} t={t} />
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          if (notes.trim().length < 3) {
            setErr(t('اكتب ملاحظات التحقيق (3 أحرف على الأقل).', 'Write investigation notes (at least 3 characters).'));
            return;
          }
          setErr(null);
          await core.investigateSafetyCase(item.id, status, notes.trim());
        }}
        className="space-y-4"
      >
        <Field id="inv-status" label={t('النتيجة *', 'Outcome *')}>
          <select
            id="inv-status"
            value={status}
            disabled={busy}
            onChange={(e) => setStatus(e.target.value as 'resolved' | 'false_positive' | 'escalated')}
            className={inputCls}
          >
            <option value="resolved">{t('تم الحل', 'Resolved')}</option>
            <option value="false_positive">{t('إنذار خاطئ', 'False positive')}</option>
            <option value="escalated">{t('تصعيد', 'Escalated')}</option>
          </select>
        </Field>
        <Field id="inv-notes" label={t('ملاحظات التحقيق *', 'Investigation notes *')}>
          <textarea id="inv-notes" rows={4} value={notes} disabled={busy} onChange={(e) => setNotes(e.target.value)} className={textareaCls} />
        </Field>
        <FormError msg={err} />
        <button type="submit" disabled={busy} className={`${status === 'escalated' ? btnDanger : btnSuccess} w-full`}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{t('حفظ نتيجة التحقيق', 'Save investigation')}</span>
        </button>
      </form>
    </ModalShell>
  );
};

// =====================================================================
// 12. admin: log incident
// =====================================================================
const IncidentModal: React.FC = () => {
  const { core, t, close, closeLabel } = useModalBase();
  const busy = core.isLoading('incident');
  const [service, setService] = useState('');
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <ModalShell id="modal-admin-incident" title={t('تسجيل حادثة تشغيلية', 'Log a system incident')} closeLabel={closeLabel} onClose={close}>
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const s = service.trim();
          const ty = type.trim();
          if (s.length < 2 || s.length > 50) {
            setErr(t('اسم الخدمة يجب أن يكون بين 2 و50 حرفاً.', 'Service name must be 2–50 characters.'));
            return;
          }
          if (ty.length < 2 || ty.length > 50) {
            setErr(t('نوع الحادثة يجب أن يكون بين 2 و50 حرفاً.', 'Incident type must be 2–50 characters.'));
            return;
          }
          if (desc.trim().length < 5) {
            setErr(t('الوصف يجب أن يكون 5 أحرف على الأقل.', 'Description must be at least 5 characters.'));
            return;
          }
          setErr(null);
          await core.logSystemIncident(s, severity, ty, desc.trim());
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field id="inc-srv" label={t('الخدمة المتأثرة *', 'Affected service *')}>
            <input id="inc-srv" type="text" maxLength={50} value={service} disabled={busy} onChange={(e) => setService(e.target.value)} placeholder="ct_classifier" className={inputCls} dir="ltr" />
          </Field>
          <Field id="inc-type" label={t('نوع الحادثة *', 'Incident type *')}>
            <input id="inc-type" type="text" maxLength={50} value={type} disabled={busy} onChange={(e) => setType(e.target.value)} placeholder={t('بطء / انقطاع', 'latency / outage')} className={inputCls} />
          </Field>
        </div>
        <Field id="inc-sev" label={t('الخطورة *', 'Severity *')}>
          <select
            id="inc-sev"
            value={severity}
            disabled={busy}
            onChange={(e) => setSeverity(e.target.value as 'low' | 'medium' | 'high' | 'critical')}
            className={inputCls}
          >
            <option value="low">{t('منخفضة', 'Low')}</option>
            <option value="medium">{t('متوسطة', 'Medium')}</option>
            <option value="high">{t('عالية', 'High')}</option>
            <option value="critical">{t('حرجة', 'Critical')}</option>
          </select>
        </Field>
        <Field id="inc-desc" label={t('الوصف *', 'Description *')}>
          <textarea id="inc-desc" rows={4} value={desc} disabled={busy} onChange={(e) => setDesc(e.target.value)} className={textareaCls} />
        </Field>
        <FormError msg={err} />
        <button type="submit" disabled={busy} className={`${btnDanger} w-full`}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{t('تسجيل الحادثة', 'Log incident')}</span>
        </button>
      </form>
    </ModalShell>
  );
};

// =====================================================================
// 13. admin: audit entry
// =====================================================================
const AuditDetailModal: React.FC<{ entry: AuditLogEntry }> = ({ entry }) => {
  const { t, close, closeLabel } = useModalBase();
  const sevCls =
    entry.severity === 'critical'
      ? 'text-[#DC2626] dark:text-[#F87171]'
      : entry.severity === 'warning'
        ? 'text-[#B45309] dark:text-[#F59E0B]'
        : 'text-[#0E7490] dark:text-[#22D3EE]';
  return (
    <ModalShell id="modal-admin-audit-detail" title={t('تفاصيل سجل التدقيق', 'Audit log entry')} closeLabel={closeLabel} onClose={close} autoFocusInput={false}>
      <div className="p-4 rounded-xl bg-[#F7FAFA] dark:bg-[#11252D] text-xs grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <KV k={t('المعرّف', 'ID')} v={<span className="font-mono-tabular">{dash(entry.id)}</span>} />
        <KV k={t('الوقت', 'Time')} v={<span className="font-mono-tabular">{dash(entry.timestamp)}</span>} />
        <KV k={t('المنفّذ', 'Actor')} v={dash(entry.actor)} />
        <KV k={t('الدور', 'Role')} v={dash(entry.role)} />
        <KV k={t('الإجراء', 'Action')} v={dash(entry.action)} />
        <KV k={t('المورد', 'Resource')} v={dash(entry.resource)} />
        <KV k={t('النتيجة', 'Outcome')} v={dash(entry.outcome)} />
        <KV k={t('الخطورة', 'Severity')} v={<span className={sevCls}>{dash(entry.severity)}</span>} />
        {entry.reason && <KV k={t('السبب', 'Reason')} v={entry.reason} />}
      </div>
      <div className="space-y-1.5">
        <h3 className="text-xs font-bold">{t('البيانات التفصيلية', 'Payload')}</h3>
        <pre className="p-4 rounded-xl bg-[#091318] text-cyan-300 font-mono-tabular text-xs overflow-x-auto max-h-80" dir="ltr">
          {JSON.stringify(entry.payload ?? {}, null, 2)}
        </pre>
      </div>
    </ModalShell>
  );
};

// =====================================================================
// 14. RAG chatbot
// =====================================================================
const ChatbotModal: React.FC = () => {
  const { core, t, close, closeLabel } = useModalBase();
  const messages = core.getChatbotMessages();
  const thinking = core.isChatbotThinking();
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length, thinking]);

  const ask = (q: string) => {
    if (!q.trim() || thinking) return;
    void core.sendChatbotQuestion(q);
  };

  const suggestions = [
    t('ما هي العلامات التحذيرية للسكتة الدماغية؟', 'What are the warning signs of a stroke?'),
    t('كيف أقلل خطر السكتة المرتبط بارتفاع الضغط؟', 'How can I lower stroke risk from high blood pressure?'),
    t('ما الفرق بين السكتة الإقفارية والنزفية؟', 'What is the difference between ischemic and hemorrhagic stroke?'),
  ];

  return (
    <ModalShell
      id="chatbot-modal"
      size="lg"
      title={t('المساعد الطبي الذكي', 'StrokeAegis AI Assistant')}
      closeLabel={closeLabel}
      onClose={close}
      icon={<RobotMascot variant="head" size={40} />}
      headerActions={
        <button
          type="button"
          onClick={() => core.resetChatbot()}
          disabled={thinking}
          aria-label={t('بدء محادثة جديدة', 'Start a new conversation')}
          title={t('محادثة جديدة', 'New conversation')}
          className="w-8 h-8 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] flex items-center justify-center hover:border-[#0E7490] hover:text-[#0E7490] cursor-pointer disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      }
    >
      <p className={`text-[11px] leading-relaxed ${mutedCls}`}>
        {t(
          'إجابات مبنية على إرشادات طبية مفهرسة (RAG) لأغراض التثقيف فقط. في الحالات الطارئة اتصل بالإسعاف فوراً.',
          'Answers are grounded in indexed clinical guidelines (RAG) and are for education only. In an emergency, call an ambulance immediately.'
        )}
      </p>

      <div
        className="space-y-3 h-[45vh] min-h-[220px] overflow-y-auto p-3 rounded-xl bg-[#F7FAFA] dark:bg-[#11252D]"
        role="log"
        aria-live="polite"
        aria-label={t('سجل المحادثة', 'Conversation')}
      >
        {messages.map((m) => {
          const isAi = m.senderRole === 'ai';
          const emergency = isAi && m.isEmergency;
          return (
            <div key={m.id} className={`flex flex-col ${isAi ? 'items-start' : 'items-end'}`}>
              <div
                className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed ${
                  emergency
                    ? 'bg-[#FEF2F2] dark:bg-[#2A0C0C] border-2 border-[#DC2626] text-[#7F1D1D] dark:text-[#FECACA]'
                    : isAi
                      ? 'bg-white dark:bg-[#0C1B21] border border-[#D7E3E6] dark:border-[#1B3540]'
                      : 'bg-[#0E7490] text-white'
                }`}
              >
                <div className="font-bold mb-1 opacity-80 flex items-center gap-1.5">
                  {emergency && <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" aria-hidden="true" />}
                  <span>{emergency ? t('تنبيه طارئ', 'Emergency alert') : t(m.senderNameAr, m.senderName)}</span>
                  <span className="font-normal opacity-70 font-mono-tabular">{m.timestamp}</span>
                </div>
                <p className="whitespace-pre-wrap break-words" dir="auto">
                  {m.text}
                </p>
                {isAi && m.sources && m.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#D7E3E6] dark:border-[#1B3540] space-y-0.5">
                    <div className={`text-[10px] font-bold uppercase tracking-wide ${mutedCls}`}>{t('المصادر', 'Sources')}</div>
                    <ol className={`list-decimal ps-4 text-[10.5px] ${mutedCls}`} dir="ltr">
                      {m.sources.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {thinking && (
          <div className="flex items-start">
            <div className="p-3 rounded-xl bg-white dark:bg-[#0C1B21] border border-[#D7E3E6] dark:border-[#1B3540] flex items-center gap-1.5" role="status">
              <span className="sr-only">{t('المساعد يكتب...', 'The assistant is typing...')}</span>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[#0E7490] dark:bg-[#22D3EE] animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              disabled={thinking}
              onClick={() => ask(q)}
              className="px-3 py-1.5 rounded-lg border border-[#0E7490]/40 bg-[#0E7490]/8 text-xs font-semibold text-[#0E7490] dark:text-[#22D3EE] hover:bg-[#0E7490] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || thinking) return;
          ask(input);
          setInput('');
        }}
        className="flex items-center gap-2"
      >
        <label htmlFor="chatbot-input" className="sr-only">
          {t('سؤالك', 'Your question')}
        </label>
        <input
          id="chatbot-input"
          type="text"
          dir="auto"
          value={input}
          maxLength={1000}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('اسأل عن السكتة الدماغية وأعراضها والوقاية منها...', 'Ask about stroke symptoms, risk factors or prevention...')}
          className={`${inputCls} flex-1`}
        />
        <button type="submit" disabled={thinking || !input.trim()} className={btnPrimary}>
          {thinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{t('إرسال', 'Send')}</span>
        </button>
      </form>
    </ModalShell>
  );
};

// =====================================================================
// root
// =====================================================================
export const UnifiedModals: React.FC = () => {
  const core = useAppCore();
  const { ui } = core;
  const activeModal = core.getActiveModal();
  const ctx = core.getModalContext();

  const clinician = ctx.clinician as ClinicianApprovalRequest | undefined;
  const safetyItem = ctx.item as SafetyQueueItem | undefined;
  const auditEntry = ctx.entry as AuditLogEntry | undefined;
  const result = ctx.result as VascularRiskResult | undefined;
  const reasonAction = ctx.action as 'reject' | 'suspend' | 'request-info' | undefined;

  return (
    <>
      {/* Always-visible robot guide: follows the mouse, explains clicks, opens the chatbot */}
      <RobotGuide />

      {activeModal === 'modal-selfcheck-result' && result && <SelfCheckResultModal result={result} />}
      {activeModal === 'modal-patient-history' && <PatientHistoryModal ctx={ctx} />}
      {activeModal === 'modal-launch-ai-choice' && <LaunchAiChoiceModal patientId={(ctx.patientId as string) || null} />}
      {activeModal === 'modal-admit-patient' && <AdmitPatientModal />}
      {activeModal === 'modal-find-doctor' && <FindDoctorModal />}
      {activeModal === 'modal-notifications-drawer' && <NotificationsModal />}
      {activeModal === 'modal-admin-approve-clinician' && clinician && (
        <ApproveClinicianModal key={clinician.id} clinician={clinician} />
      )}
      {activeModal === 'modal-admin-action-reason' && clinician && reasonAction && (
        <ActionReasonModal key={`${clinician.id}-${reasonAction}`} clinician={clinician} action={reasonAction} />
      )}
      {activeModal === 'modal-admin-safety-details' && <SafetyDetailsModal ctx={ctx} />}
      {activeModal === 'modal-admin-safety-assign' && safetyItem && <SafetyAssignModal key={safetyItem.id} item={safetyItem} />}
      {activeModal === 'modal-admin-investigate' && safetyItem && <InvestigateModal key={safetyItem.id} item={safetyItem} />}
      {activeModal === 'modal-admin-incident' && <IncidentModal />}
      {activeModal === 'modal-admin-audit-detail' && auditEntry && <AuditDetailModal entry={auditEntry} />}
      {activeModal === 'chatbot-modal' && <ChatbotModal />}
    </>
  );
};
