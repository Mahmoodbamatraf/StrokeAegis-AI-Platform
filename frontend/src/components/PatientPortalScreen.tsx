import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Calculator,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  HeartPulse,
  History,
  Inbox,
  Loader2,
  MessageSquare,
  Search,
  Send,
  Stethoscope,
  UserPlus,
  X,
} from 'lucide-react';
import { useAppCore } from '../core/useAppCore';
import {
  CareTeamDoctor,
  ConnectionRequest,
  CtDiagnosisType,
  PatientTabId,
  RiskTier,
  VascularInputProfile,
} from '../core/types';
import { AnimatedCounter, SpotlightTiltCard } from './LuxuryMotion';

const CARD = 'rounded-2xl border border-[#D7E3E6] dark:border-[#1B3540] bg-white dark:bg-[#0C1B21]';
const MUTED = 'text-[#5B6B7A] dark:text-[#8CA3AF]';
const STRONG = 'text-[#0F2A2E] dark:text-[#ECF6F8]';
const FIELD =
  'w-full h-11 px-3.5 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] text-xs text-[#0F2A2E] dark:text-[#ECF6F8] focus:outline-none focus:border-[#0E7490]';

export const PatientPortalScreen: React.FC = () => {
  const core = useAppCore();
  const { ui } = core;
  const user = core.getCurrentUser();
  const overview = core.getPatientOverview();
  const activeTab = core.getPatientTab();
  const selfCheck = core.getSelfCheckState();
  const input = selfCheck.input;
  const latestResult = selfCheck.latestResult;
  const history = core.getAssessmentHistory();
  const reports = core.getReports();
  const careTeam = core.getCareTeam();
  const threads = core.getChatThreads();
  const activeConversationId = core.getActiveConversationId();
  const activeThread = threads.find((t) => t.conversationId === activeConversationId) || null;

  const [chatMsg, setChatMsg] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [activeThread?.messages.length, activeConversationId]);

  const primaryDoctor: CareTeamDoctor | null = careTeam.primary || overview?.doctor || null;
  const latestAssessment = history.find((a) => a.riskTier !== null) || null;
  const latestTier: RiskTier | null = latestResult?.tier ?? latestAssessment?.riskTier ?? null;
  const latestProb: number | null = latestResult?.probability ?? latestAssessment?.riskProbability ?? null;

  const handleSelfCheckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selfCheck.running) return;
    void core.runPatientSelfCheck();
  };

  const handleSendPatientChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatMsg.trim();
    if (!text || !activeThread || core.isLoading('send-message')) return;
    void core.sendChatMessage(activeThread.conversationId, text);
    setChatMsg('');
  };

  const messageDoctor = (conversationId: string | null, doctorId: string) => {
    // Only open by id when the conversation (or its thread) is known; otherwise the core's
    // loadConversations() picks the first thread, avoiding a request with a non-conversation id.
    if (conversationId || threads.some((t) => t.patientId === doctorId)) core.openConversation(conversationId || doctorId);
    core.setPatientTab('pat-pane-chat');
  };

  const set = <K extends keyof VascularInputProfile>(k: K, v: VascularInputProfile[K]) => core.updateSelfCheckField(k, v);

  // ---------------------------------------------------------------- helpers
  const tierBadge = (tier: RiskTier | null, prob: number | null, size: 'sm' | 'lg' = 'sm') => {
    const text = size === 'lg' ? 'text-lg font-extrabold' : 'text-xs font-bold';
    const icon = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';
    const pct = prob !== null ? ` (${prob.toFixed(1)}%)` : '';
    if (tier === 'high')
      return (
        <span className={`inline-flex items-center gap-1.5 ${text} text-[#DC2626] dark:text-[#EF4444]`}>
          <AlertTriangle className={icon} />
          {ui.t('مرتفع', 'High')}
          {pct}
        </span>
      );
    if (tier === 'moderate')
      return (
        <span className={`inline-flex items-center gap-1.5 ${text} text-[#B45309] dark:text-[#F59E0B]`}>
          <Clock className={icon} />
          {ui.t('متوسط', 'Moderate')}
          {pct}
        </span>
      );
    if (tier === 'low')
      return (
        <span className={`inline-flex items-center gap-1.5 ${text} text-[#047857] dark:text-[#10B981]`}>
          <CheckCircle2 className={icon} />
          {ui.t('منخفض', 'Low')}
          {pct}
        </span>
      );
    return (
      <span className={`inline-flex items-center gap-1.5 ${size === 'lg' ? 'text-sm font-bold' : 'text-xs font-semibold'} ${MUTED}`}>
        <Activity className={icon} />
        {ui.t('لا يوجد تقييم بعد', 'No assessment yet')}
      </span>
    );
  };

  const diagnosisLabel = (d: CtDiagnosisType | null): string | null => {
    if (d === 'hemorrhagic') return ui.t('نزيف دماغي', 'Hemorrhagic stroke');
    if (d === 'ischemic') return ui.t('احتشاء إقفاري', 'Ischemic stroke');
    if (d === 'normal') return ui.t('أشعة طبيعية', 'Normal CT');
    if (d === 'rejected_non_brain') return ui.t('صورة مرفوضة (ليست أشعة دماغ)', 'Image rejected (not a brain CT)');
    return null;
  };

  const typeLabel = (t: string) =>
    t === 'ai_system_flow'
      ? ui.t('تحليل شامل بالذكاء الاصطناعي', 'Full AI analysis')
      : t === 'regular_ml'
        ? ui.t('فحص خطر السكتة', 'Stroke risk check')
        : t === 'regular_ct'
          ? ui.t('تحليل أشعة مقطعية', 'CT analysis')
          : t || ui.t('تقييم', 'Assessment');

  const skeleton = (n: number) => (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl border border-[#D7E3E6] dark:border-[#1B3540] animate-pulse space-y-2">
          <div className="h-3 w-1/3 rounded bg-[#E4EEF0] dark:bg-[#11252D]" />
          <div className="h-3 w-2/3 rounded bg-[#EEF4F5] dark:bg-[#0F2028]" />
        </div>
      ))}
    </div>
  );

  const emptyState = (icon: React.ReactNode, title: string, body?: string, action?: React.ReactNode) => (
    <div className="p-10 text-center space-y-3">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-[#0E7490]/10 dark:bg-[#06B6D4]/15 text-[#0E7490] dark:text-[#22D3EE] flex items-center justify-center">
        {icon}
      </div>
      <div className={`text-sm font-bold ${STRONG}`}>{title}</div>
      {body && <p className={`text-xs max-w-md mx-auto ${MUTED}`}>{body}</p>}
      {action}
    </div>
  );

  const statValue = (v: number | undefined) =>
    overview ? (
      <AnimatedCounter value={v ?? 0} />
    ) : core.isLoading('patient-overview') ? (
      <span className="inline-block w-10 h-7 rounded bg-[#E4EEF0] dark:bg-[#11252D] animate-pulse align-middle" />
    ) : (
      '—'
    );

  const doctorLine = (d: { specialty: string | null; hospital: string | null }) =>
    [d.specialty, d.hospital].filter(Boolean).join(' · ');

  const requestCard = (r: ConnectionRequest, kind: 'incoming' | 'outgoing') => {
    const busy = core.isLoading(`rel-${r.id}`);
    return (
      <div key={r.id} className="p-3.5 rounded-xl border border-[#D7E3E6] dark:border-[#1B3540] text-xs space-y-2">
        <div>
          <div className={`font-bold ${STRONG}`}>{r.name || r.email}</div>
          <div className={MUTED}>{doctorLine({ specialty: r.specialty ?? null, hospital: r.hospital ?? null }) || r.email}</div>
          <div className={`text-[11px] font-mono-tabular ${MUTED}`}>
            {r.relationshipType === 'primary' ? ui.t('طبيب رئيسي', 'Primary doctor') : ui.t('فريق الرعاية', 'Care team')}
            {r.createdAt ? ` · ${r.createdAt}` : ''}
            {r.expiresAt && (
              <span className="text-[#B45309] dark:text-[#F59E0B]">
                {' · '}
                {ui.t('ينتهي', 'Expires')} {r.expiresAt}
              </span>
            )}
          </div>
        </div>
        {kind === 'incoming' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void core.acceptConnection(r.id)}
              className="h-9 px-3 rounded-lg bg-[#047857] hover:bg-[#065F46] disabled:opacity-60 text-white font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {ui.t('قبول', 'Accept')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void core.declineConnection(r.id)}
              className="h-9 px-3 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#DC2626] disabled:opacity-60 text-[#DC2626] dark:text-[#EF4444] font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              {ui.t('رفض', 'Decline')}
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#B45309]/10 text-[#B45309] dark:text-[#F59E0B] text-[11px] font-bold">
            <Clock className="w-3 h-3" />
            {ui.t('بانتظار موافقة الطبيب', 'Awaiting doctor')}
          </span>
        )}
      </div>
    );
  };

  const fieldLabel = (id: string, ar: string, en: string, tagAr: string, tagEn: string) => (
    <div className="flex items-center justify-between text-xs">
      <label htmlFor={id} className={`font-bold ${STRONG}`}>
        {ui.t(ar, en)}
      </label>
      <span className={`text-[11px] ${MUTED}`}>{ui.t(tagAr, tagEn)}</span>
    </div>
  );

  const mrn = overview?.mrn && overview.mrn !== '—' ? overview.mrn : user?.mrn || '';
  const headerDoctor = overview?.doctor || careTeam.primary;
  const resultsLoading = core.isLoading('assessments') && history.length === 0;
  const reportsLoading = core.isLoading('reports') && reports.length === 0;
  const careLoading =
    core.isLoading('care-team') && !careTeam.primary && careTeam.team.length === 0 && careTeam.incoming.length === 0;
  const threadsLoading = core.isLoading('conversations') && threads.length === 0;
  const otherTeam = careTeam.team.filter((d) => d.doctorId !== careTeam.primary?.doctorId);

  return (
    <div id="screen-patient-portal" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sa-luxury-enter">
      {/* Header */}
      <div className={`p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${CARD}`}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#047857]/12 dark:bg-[#10B981]/20 text-[#047857] dark:text-[#10B981] flex items-center justify-center shrink-0">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#047857] dark:text-[#10B981]">
              {ui.t('بوابتك الصحية الشخصية', 'Your personal health portal')}
            </div>
            <h1 className={`text-xl sm:text-2xl font-extrabold ${STRONG}`}>
              {user ? ui.t(user.nameAr || user.name, user.name) : '—'}
            </h1>
            <div className={`text-xs font-mono-tabular ${MUTED}`}>
              {mrn && <span>{mrn} · </span>}
              {headerDoctor
                ? ui.t(`الطبيب المشرف: ${headerDoctor.name}`, `Doctor: ${headerDoctor.name}`)
                : ui.t('لا يوجد طبيب مشرف بعد', 'No supervising doctor yet')}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => core.openModal('modal-find-doctor')}
          className="h-11 px-4 rounded-[10px] border border-[#0E7490] dark:border-[#06B6D4] text-[#0E7490] dark:text-[#22D3EE] hover:bg-[#0E7490]/10 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Search className="w-4 h-4" />
          <span>{ui.t('ابحث عن طبيب', 'Find a doctor')}</span>
        </button>
      </div>

      {/* KPIs from /patient/overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SpotlightTiltCard delayIndex={1} glowColor="teal" className={`p-5 ${CARD}`}>
          <div className={`text-xs font-medium mb-1 ${MUTED}`}>{ui.t('تقييماتي', 'My assessments')}</div>
          <div className={`text-3xl font-extrabold font-mono-tabular ${STRONG}`}>
            {statValue(overview?.stats.totalAssessments)}
          </div>
        </SpotlightTiltCard>

        <SpotlightTiltCard delayIndex={2} glowColor="emerald" className={`p-5 ${CARD}`}>
          <div className={`text-xs font-medium mb-1 ${MUTED}`}>{ui.t('تقاريري', 'My reports')}</div>
          <div className="text-3xl font-extrabold font-mono-tabular text-[#047857] dark:text-[#10B981]">
            {statValue(overview?.stats.totalReports)}
          </div>
        </SpotlightTiltCard>

        <SpotlightTiltCard delayIndex={3} glowColor="teal" className={`p-5 ${CARD}`}>
          <div className={`text-xs font-medium mb-1 ${MUTED}`}>{ui.t('رسائل غير مقروءة', 'Unread messages')}</div>
          <div className="text-3xl font-extrabold font-mono-tabular text-[#0E7490] dark:text-[#22D3EE]">
            {statValue(overview?.stats.unreadMessages)}
          </div>
        </SpotlightTiltCard>

        <SpotlightTiltCard delayIndex={4} glowColor="amber" className={`p-5 ${CARD}`}>
          <div className={`text-xs font-medium mb-1 ${MUTED}`}>{ui.t('آخر مستوى خطر', 'Latest risk level')}</div>
          <div className="flex items-center gap-2 mt-1">{tierBadge(latestTier, latestProb, 'lg')}</div>
        </SpotlightTiltCard>
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex flex-wrap items-center gap-2 border-b border-[#D7E3E6] dark:border-[#1B3540] pb-3">
        {(
          [
            { id: 'pat-pane-selfcheck' as PatientTabId, labelAr: 'الفحص الذاتي', labelEn: 'Self-check', icon: Calculator, badge: 0 },
            { id: 'pat-pane-results' as PatientTabId, labelAr: 'نتائجي', labelEn: 'My results', icon: History, badge: 0 },
            { id: 'pat-pane-reports' as PatientTabId, labelAr: 'تقاريري', labelEn: 'My reports', icon: FileCheck2, badge: 0 },
            {
              id: 'pat-pane-doctor' as PatientTabId,
              labelAr: 'طبيبي والفريق',
              labelEn: 'My doctor & care team',
              icon: Stethoscope,
              badge: overview?.stats.pendingRequestsCount ?? 0,
            },
            {
              id: 'pat-pane-chat' as PatientTabId,
              labelAr: 'محادثة الطبيب',
              labelEn: 'Doctor chat',
              icon: MessageSquare,
              badge: overview?.stats.unreadMessages ?? 0,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => core.setPatientTab(tab.id)}
              className={`h-11 px-4 rounded-[10px] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#0E7490] text-white'
                  : 'bg-white dark:bg-[#0C1B21] border border-[#D7E3E6] dark:border-[#1B3540] text-[#5B6B7A] dark:text-[#8CA3AF] hover:text-[#0F2A2E] dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{ui.t(tab.labelAr, tab.labelEn)}</span>
              {tab.badge > 0 && (
                <span className={`px-1.5 rounded-full text-[10px] font-mono-tabular ${active ? 'bg-white/25' : 'bg-[#0E7490] text-white'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SELF-CHECK */}
      {activeTab === 'pat-pane-selfcheck' && (
        <div className="space-y-6 sa-animate-in">
          <div id="pat-pane-selfcheck" className={`p-6 sm:p-8 space-y-6 ${CARD}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D7E3E6] dark:border-[#1B3540] pb-4">
              <div>
                <h2 className={`text-lg font-extrabold ${STRONG}`}>
                  {ui.t('تقييم خطر السكتة الدماغية', 'Stroke risk self-check')}
                </h2>
                <p className={`text-xs mt-1 ${MUTED}`}>
                  {ui.t(
                    'أدخل المؤشرات العشرة ليحسب نموذج التعلم الآلي احتمالية خطر السكتة، ويُحفظ الناتج في سجلك ويُبلَّغ طبيبك.',
                    'Enter the 10 inputs. The machine-learning model computes your stroke risk, saves it to your record and notifies your doctor.'
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[11px] ${MUTED}`}>{ui.t('قيم تجريبية:', 'Sample values:')}</span>
                <button
                  type="button"
                  onClick={() => core.applySelfCheckPreset('low')}
                  className="h-9 px-3 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#047857] text-xs font-semibold text-[#047857] dark:text-[#10B981] cursor-pointer"
                >
                  {ui.t('منخفض', 'Low')}
                </button>
                <button
                  type="button"
                  onClick={() => core.applySelfCheckPreset('moderate')}
                  className="h-9 px-3 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#B45309] text-xs font-semibold text-[#B45309] dark:text-[#F59E0B] cursor-pointer"
                >
                  {ui.t('متوسط', 'Moderate')}
                </button>
                <button
                  type="button"
                  onClick={() => core.applySelfCheckPreset('high')}
                  className="h-9 px-3 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#DC2626] text-xs font-semibold text-[#DC2626] dark:text-[#EF4444] cursor-pointer"
                >
                  {ui.t('مرتفع', 'High')}
                </button>
              </div>
            </div>

            <form onSubmit={handleSelfCheckSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  {fieldLabel('sc-age', '1. العمر (سنة)', '1. Age (years)', 'أساسي', 'Baseline')}
                  <input
                    id="sc-age"
                    type="number"
                    min={0}
                    max={120}
                    required
                    value={Number.isFinite(input.age) ? input.age : ''}
                    onChange={(e) => set('age', Number(e.target.value))}
                    className={`${FIELD} text-sm font-mono-tabular`}
                  />
                </div>

                <div className="space-y-1.5">
                  {fieldLabel('sc-gender', '2. الجنس', '2. Sex', 'أساسي', 'Baseline')}
                  <select
                    id="sc-gender"
                    value={input.gender}
                    onChange={(e) => set('gender', e.target.value as VascularInputProfile['gender'])}
                    className={FIELD}
                  >
                    <option value="Female">{ui.t('أنثى', 'Female')}</option>
                    <option value="Male">{ui.t('ذكر', 'Male')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  {fieldLabel('sc-hyp', '3. ارتفاع ضغط الدم', '3. Hypertension', 'حيوي', 'Vital')}
                  <select
                    id="sc-hyp"
                    value={input.hypertension}
                    onChange={(e) => set('hypertension', Number(e.target.value) as 0 | 1)}
                    className={FIELD}
                  >
                    <option value={0}>{ui.t('لا', 'No')}</option>
                    <option value={1}>{ui.t('نعم', 'Yes')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  {fieldLabel('sc-heart', '4. أمراض القلب', '4. Heart disease', 'حيوي', 'Vital')}
                  <select
                    id="sc-heart"
                    value={input.heart_disease}
                    onChange={(e) => set('heart_disease', Number(e.target.value) as 0 | 1)}
                    className={FIELD}
                  >
                    <option value={0}>{ui.t('لا', 'No')}</option>
                    <option value={1}>{ui.t('نعم', 'Yes')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  {fieldLabel('sc-gluc', '5. متوسط الجلوكوز (mg/dL)', '5. Avg glucose (mg/dL)', 'استقلابي', 'Metabolic')}
                  <input
                    id="sc-gluc"
                    type="number"
                    step="0.1"
                    min={40}
                    max={400}
                    required
                    value={Number.isFinite(input.avg_glucose_level) ? input.avg_glucose_level : ''}
                    onChange={(e) => set('avg_glucose_level', Number(e.target.value))}
                    className={`${FIELD} text-sm font-mono-tabular`}
                  />
                </div>

                <div className="space-y-1.5">
                  {fieldLabel('sc-bmi', '6. مؤشر كتلة الجسم (BMI)', '6. Body mass index (BMI)', 'استقلابي', 'Metabolic')}
                  <input
                    id="sc-bmi"
                    type="number"
                    step="0.1"
                    min={10}
                    max={80}
                    required
                    value={Number.isFinite(input.bmi) ? input.bmi : ''}
                    onChange={(e) => set('bmi', Number(e.target.value))}
                    className={`${FIELD} text-sm font-mono-tabular`}
                  />
                </div>

                <div className="space-y-1.5">
                  {fieldLabel('sc-smoke', '7. التدخين', '7. Smoking status', 'نمط الحياة', 'Lifestyle')}
                  <select
                    id="sc-smoke"
                    value={input.smoking_status}
                    onChange={(e) => set('smoking_status', e.target.value as VascularInputProfile['smoking_status'])}
                    className={FIELD}
                  >
                    <option value="never smoked">{ui.t('لم يدخن أبداً', 'Never smoked')}</option>
                    <option value="formerly smoked">{ui.t('مدخن سابق', 'Formerly smoked')}</option>
                    <option value="smokes">{ui.t('مدخن حالياً', 'Smokes')}</option>
                    <option value="Unknown">{ui.t('غير معروف', 'Unknown')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  {fieldLabel('sc-work', '8. نوع العمل', '8. Work type', 'نمط الحياة', 'Lifestyle')}
                  <select
                    id="sc-work"
                    value={input.work_type}
                    onChange={(e) => set('work_type', e.target.value as VascularInputProfile['work_type'])}
                    className={FIELD}
                  >
                    <option value="Private">{ui.t('قطاع خاص', 'Private sector')}</option>
                    <option value="Self-employed">{ui.t('عمل حر', 'Self-employed')}</option>
                    <option value="Govt_job">{ui.t('وظيفة حكومية', 'Government job')}</option>
                    <option value="children">{ui.t('طفل', 'Child')}</option>
                    <option value="Never_worked">{ui.t('لم يعمل', 'Never worked')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  {fieldLabel('sc-married', '9. سبق الزواج', '9. Ever married', 'ديموغرافي', 'Demographic')}
                  <select
                    id="sc-married"
                    value={input.ever_married}
                    onChange={(e) => set('ever_married', e.target.value as VascularInputProfile['ever_married'])}
                    className={FIELD}
                  >
                    <option value="Yes">{ui.t('نعم', 'Yes')}</option>
                    <option value="No">{ui.t('لا', 'No')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  {fieldLabel('sc-res', '10. نوع السكن', '10. Residence type', 'ديموغرافي', 'Demographic')}
                  <select
                    id="sc-res"
                    value={input.Residence_type}
                    onChange={(e) => set('Residence_type', e.target.value as VascularInputProfile['Residence_type'])}
                    className={FIELD}
                  >
                    <option value="Urban">{ui.t('حضري', 'Urban')}</option>
                    <option value="Rural">{ui.t('ريفي', 'Rural')}</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={selfCheck.running}
                  className="w-full sm:w-auto min-w-[260px] h-12 px-6 rounded-[10px] bg-[#0E7490] hover:bg-[#0B5C73] disabled:opacity-70 disabled:cursor-wait text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {selfCheck.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                  <span>
                    {selfCheck.running
                      ? ui.t('جارِ الحساب بالنموذج...', 'Running the model...')
                      : ui.t('احسب خطر السكتة الآن', 'Calculate my stroke risk')}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {latestResult && (
            <div className={`p-6 space-y-4 ${CARD}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className={`text-xs font-semibold ${MUTED}`}>
                    {ui.t('آخر نتيجة', 'Latest result')}
                    {latestResult.timestamp ? ` · ${latestResult.timestamp}` : ''}
                  </div>
                  <div className="mt-1">{tierBadge(latestResult.tier, latestResult.probability, 'lg')}</div>
                </div>
                <button
                  type="button"
                  onClick={() => core.openModal('modal-selfcheck-result', { result: latestResult })}
                  className="h-10 px-4 rounded-lg border border-[#0E7490] text-[#0E7490] dark:text-[#22D3EE] text-xs font-bold cursor-pointer"
                >
                  {ui.t('عرض التفاصيل', 'View details')}
                </button>
              </div>
              {(latestResult.summaryAr || latestResult.summaryEn) && (
                <p className={`text-xs leading-relaxed ${MUTED}`}>
                  {ui.t(latestResult.summaryAr || latestResult.summaryEn, latestResult.summaryEn || latestResult.summaryAr)}
                </p>
              )}
              {latestResult.factors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {latestResult.factors.slice(0, 6).map((f) => (
                    <span
                      key={f.id}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        f.severity === 'high'
                          ? 'bg-[#DC2626]/10 text-[#DC2626] dark:text-[#EF4444]'
                          : f.severity === 'moderate'
                            ? 'bg-[#B45309]/10 text-[#B45309] dark:text-[#F59E0B]'
                            : 'bg-[#047857]/10 text-[#047857] dark:text-[#10B981]'
                      }`}
                    >
                      {ui.t(f.labelAr, f.labelEn)}
                    </span>
                  ))}
                </div>
              )}
              <p className={`text-[11px] ${MUTED}`}>
                {ui.t(
                  'هذه النتيجة تقدير إحصائي وليست تشخيصاً طبياً. راجع طبيبك.',
                  'This is a statistical estimate, not a diagnosis. Please consult your doctor.'
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RESULTS */}
      {activeTab === 'pat-pane-results' && (
        <div id="pat-pane-results" className={`p-6 space-y-5 sa-animate-in ${CARD}`}>
          <h2 className={`text-base font-bold ${STRONG}`}>{ui.t('سجل تقييماتي', 'My assessment history')}</h2>
          {resultsLoading ? (
            skeleton(3)
          ) : history.length === 0 ? (
            emptyState(
              <History className="w-6 h-6" />,
              ui.t('لا توجد تقييمات بعد', 'No assessments yet'),
              ui.t('ابدأ بالفحص الذاتي لحساب خطر السكتة.', 'Start with the self-check to compute your stroke risk.'),
              <button
                type="button"
                onClick={() => core.setPatientTab('pat-pane-selfcheck')}
                className="h-10 px-4 rounded-lg bg-[#0E7490] text-white text-xs font-bold cursor-pointer"
              >
                {ui.t('اذهب للفحص الذاتي', 'Go to self-check')}
              </button>
            )
          ) : (
            <div className="space-y-4">
              {history.map((item) => {
                const dx = diagnosisLabel(item.ctDiagnosis);
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono-tabular font-bold text-[#0E7490] dark:text-[#22D3EE]">{item.date || '—'}</span>
                        <span aria-hidden="true">·</span>
                        <span className={`font-bold ${STRONG}`}>{typeLabel(item.assessmentType)}</span>
                      </div>
                      {dx && (
                        <div className={`text-xs ${STRONG}`}>
                          {ui.t('الأشعة:', 'CT:')} {dx}
                          {item.ctConfidence !== null ? ` (${item.ctConfidence.toFixed(1)}%)` : ''}
                        </div>
                      )}
                      {(item.summaryEn || item.summaryAr) && (
                        <p className={`text-xs line-clamp-2 ${MUTED}`}>{ui.t(item.summaryAr, item.summaryEn)}</p>
                      )}
                    </div>
                    <div className="sm:text-end shrink-0 space-y-1">
                      <div>{tierBadge(item.riskTier, item.riskProbability)}</div>
                      <div className="text-[11px]">
                        {item.signedOff ? (
                          <span className="text-[#047857] dark:text-[#10B981] font-semibold">
                            {ui.t('اعتمده الطبيب', 'Signed off by doctor')}
                          </span>
                        ) : item.hasReport ? (
                          <span className="text-[#B45309] dark:text-[#F59E0B]">{ui.t('التقرير بانتظار المراجعة', 'Report pending review')}</span>
                        ) : (
                          <span className={MUTED}>{ui.t('محفوظ في سجلك', 'Saved to your record')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REPORTS */}
      {activeTab === 'pat-pane-reports' && (
        <div id="pat-pane-reports" className={`p-6 space-y-4 sa-animate-in ${CARD}`}>
          <h2 className={`text-base font-bold ${STRONG}`}>{ui.t('تقاريري السريرية', 'My clinical reports')}</h2>
          {reportsLoading ? (
            skeleton(2)
          ) : reports.length === 0 ? (
            emptyState(
              <FileCheck2 className="w-6 h-6" />,
              ui.t('لا توجد تقارير بعد', 'No reports yet'),
              ui.t(
                'يُنشئ طبيبك التقرير بعد تشغيل التحليل الشامل بالذكاء الاصطناعي.',
                'Your doctor creates a report after running the full AI analysis.'
              )
            )
          ) : (
            <div className="divide-y divide-[#D7E3E6] dark:divide-[#1B3540]">
              {reports.map((rep) => {
                const signed = rep.signedStatus === 'Signed & Approved';
                const downloading = core.isLoading(`download-${rep.id}`);
                const dx = diagnosisLabel(rep.ctDiagnosis);
                return (
                  <div key={rep.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className={`text-xs font-bold break-all ${STRONG}`}>
                        {rep.reportCode} · <span className="font-mono-tabular">{rep.createdAt || '—'}</span>
                      </div>
                      <div className={`text-xs ${MUTED}`}>
                        {rep.doctorName ? ui.t(`الطبيب: ${rep.doctorName}`, `Doctor: ${rep.doctorName}`) : ''}
                        {rep.doctorName && dx ? ' · ' : ''}
                        {dx || ''}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {tierBadge(rep.riskTier, rep.riskProb)}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            signed
                              ? 'bg-[#047857]/10 text-[#047857] dark:text-[#10B981]'
                              : 'bg-[#B45309]/10 text-[#B45309] dark:text-[#F59E0B]'
                          }`}
                        >
                          {signed ? ui.t('معتمد', 'Signed') : ui.t('بانتظار اعتماد الطبيب', 'Awaiting sign-off')}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={downloading}
                      onClick={() => void core.downloadReport(rep.id, rep.pdfFilename)}
                      className="h-10 px-4 rounded-[10px] bg-[#0E7490] hover:bg-[#0B5C73] disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shrink-0"
                    >
                      {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>{ui.t('تحميل PDF', 'Download PDF')}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DOCTOR & CARE TEAM */}
      {activeTab === 'pat-pane-doctor' && (
        <div id="pat-pane-doctor" className="grid grid-cols-1 lg:grid-cols-12 gap-6 sa-animate-in">
          <div className={`lg:col-span-7 p-6 space-y-4 ${CARD}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className={`text-base font-bold ${STRONG}`}>{ui.t('الطبيب المشرف', 'Primary doctor')}</h2>
              <button
                type="button"
                onClick={() => core.openModal('modal-find-doctor')}
                className="h-9 px-3 rounded-lg bg-[#0E7490] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{ui.t('ابحث عن طبيب', 'Find a doctor')}</span>
              </button>
            </div>

            {careLoading ? (
              skeleton(1)
            ) : primaryDoctor ? (
              <div className="p-4 rounded-xl border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className={`text-sm font-bold ${STRONG}`}>{primaryDoctor.name}</div>
                  {doctorLine(primaryDoctor) && <div className={`text-xs ${MUTED}`}>{doctorLine(primaryDoctor)}</div>}
                  <div className={`text-[11px] ${MUTED}`}>
                    {primaryDoctor.email}
                    {primaryDoctor.phone ? ` · ${primaryDoctor.phone}` : ''}
                  </div>
                  <div className="text-[11px] text-[#047857] dark:text-[#10B981] mt-1 font-semibold">
                    {ui.t('طبيب رئيسي نشط', 'Active primary doctor')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => messageDoctor(primaryDoctor.conversationId, primaryDoctor.doctorId)}
                  className="h-10 px-4 rounded-lg border border-[#0E7490] text-[#0E7490] dark:text-[#22D3EE] text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {ui.t('مراسلة', 'Message')}
                </button>
              </div>
            ) : (
              emptyState(
                <Stethoscope className="w-6 h-6" />,
                ui.t('لا يوجد طبيب مشرف بعد', 'No primary doctor yet'),
                ui.t(
                  'ابحث عن طبيب وأرسل له طلب إشراف، أو اقبل دعوة طبيب من الطلبات الواردة.',
                  'Find a doctor and send a request, or accept a doctor’s invitation from incoming requests.'
                )
              )
            )}

            {otherTeam.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <h3 className={`text-sm font-bold ${STRONG}`}>{ui.t('فريق الرعاية', 'Care team')}</h3>
                {otherTeam.map((d) => (
                  <div
                    key={d.doctorId}
                    className="p-3.5 rounded-xl border border-[#D7E3E6] dark:border-[#1B3540] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 text-xs">
                      <div className={`font-bold ${STRONG}`}>{d.name}</div>
                      <div className={MUTED}>{doctorLine(d) || d.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => messageDoctor(d.conversationId, d.doctorId)}
                      className="h-9 px-3 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#0E7490] text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {ui.t('مراسلة', 'Message')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`lg:col-span-5 p-6 space-y-4 ${CARD}`}>
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-[#0E7490] dark:text-[#22D3EE]" />
              <h3 className={`text-sm font-bold ${STRONG}`}>{ui.t('الطلبات', 'Requests')}</h3>
            </div>
            <div className="space-y-2.5">
              <div className={`text-xs font-bold ${MUTED}`}>
                {ui.t('دعوات واردة من الأطباء', 'Invitations from doctors')} ({careTeam.incoming.length})
              </div>
              {careTeam.incoming.length === 0 ? (
                <div className={`text-xs ${MUTED}`}>{ui.t('لا توجد دعوات واردة.', 'No incoming invitations.')}</div>
              ) : (
                careTeam.incoming.map((r) => requestCard(r, 'incoming'))
              )}
            </div>
            <div className="space-y-2.5">
              <div className={`text-xs font-bold ${MUTED}`}>
                {ui.t('طلبات أرسلتها', 'Requests you sent')} ({careTeam.outgoing.length})
              </div>
              {careTeam.outgoing.length === 0 ? (
                <div className={`text-xs ${MUTED}`}>{ui.t('لا توجد طلبات معلقة.', 'No pending requests.')}</div>
              ) : (
                careTeam.outgoing.map((r) => requestCard(r, 'outgoing'))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DOCTOR CHAT */}
      {activeTab === 'pat-pane-chat' && (
        <div id="pat-pane-chat" className={`overflow-hidden sa-animate-in ${CARD}`}>
          {threadsLoading ? (
            <div className="p-6">{skeleton(2)}</div>
          ) : threads.length === 0 ? (
            emptyState(
              <Stethoscope className="w-6 h-6" />,
              primaryDoctor
                ? ui.t('لا توجد محادثة بعد', 'No conversation yet')
                : ui.t('لا يوجد طبيب مرتبط بك', 'No linked doctor'),
              primaryDoctor
                ? ui.t('ستظهر المحادثة مع طبيبك هنا قريباً.', 'Your conversation with your doctor will appear here.')
                : ui.t(
                    'المراسلة متاحة فقط مع طبيب مرتبط بك. اربط حسابك بطبيب أولاً من تبويب "طبيبي والفريق".',
                    'Messaging is only available with a linked doctor. Connect with a doctor first from the "My doctor & care team" tab.'
                  ),
              !primaryDoctor ? (
                <button
                  type="button"
                  onClick={() => core.setPatientTab('pat-pane-doctor')}
                  className="h-10 px-4 rounded-lg bg-[#0E7490] text-white text-xs font-bold cursor-pointer"
                >
                  {ui.t('اذهب إلى طبيبي والفريق', 'Go to my doctor & care team')}
                </button>
              ) : undefined
            )
          ) : (
            <div className={`grid grid-cols-1 ${threads.length > 1 ? 'lg:grid-cols-12' : ''} min-h-[420px]`}>
              {threads.length > 1 && (
                <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-e border-[#D7E3E6] dark:border-[#1B3540] divide-y divide-[#D7E3E6] dark:divide-[#1B3540]">
                  <div className={`p-4 bg-[#F7FAFA] dark:bg-[#11252D] text-xs font-bold ${STRONG}`}>
                    {ui.t('أطبائي', 'My doctors')}
                  </div>
                  {threads.map((t) => {
                    const selected = t.conversationId === activeConversationId;
                    return (
                      <button
                        key={t.conversationId}
                        type="button"
                        onClick={() => core.openConversation(t.conversationId)}
                        className={`w-full p-4 text-start flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                          selected ? 'bg-[#0E7490]/10 dark:bg-[#06B6D4]/15' : 'hover:bg-[#F7FAFA] dark:hover:bg-[#11252D]/50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className={`text-xs font-bold truncate ${STRONG}`}>{ui.t(t.patientNameAr, t.patientName)}</div>
                          <div className={`text-[11px] truncate ${MUTED}`}>
                            {t.lastMessage || t.specialty || ui.t('لا توجد رسائل بعد', 'No messages yet')}
                          </div>
                        </div>
                        {t.unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-[#0E7490] text-white text-[10px] font-bold shrink-0">
                            {t.unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className={`${threads.length > 1 ? 'lg:col-span-8' : ''} flex flex-col justify-between`}>
                {!activeThread ? (
                  emptyState(<MessageSquare className="w-6 h-6" />, ui.t('اختر محادثة', 'Select a conversation'))
                ) : (
                  <>
                    <div className="p-4 border-b border-[#D7E3E6] dark:border-[#1B3540]">
                      <h2 className={`text-sm font-bold ${STRONG}`}>
                        {ui.t(`محادثة مع ${activeThread.patientName}`, `Chat with ${activeThread.patientName}`)}
                      </h2>
                      {activeThread.specialty && <div className={`text-xs ${MUTED}`}>{activeThread.specialty}</div>}
                    </div>

                    <div className="p-5 space-y-3 flex-1 overflow-y-auto max-h-[360px]">
                      {activeThread.messages.length === 0 ? (
                        <div className={`text-xs text-center py-10 ${MUTED}`}>
                          {core.isLoading(`messages-${activeThread.conversationId}`)
                            ? ui.t('جارِ تحميل الرسائل...', 'Loading messages...')
                            : ui.t('لا توجد رسائل بعد. اكتب أول رسالة لطبيبك.', 'No messages yet. Write your first message to your doctor.')}
                        </div>
                      ) : (
                        activeThread.messages.map((m) => {
                          const mine = Boolean(m.isMine);
                          return (
                            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                              <div
                                className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words ${
                                  mine
                                    ? 'bg-[#0E7490] text-white'
                                    : 'bg-[#F0F6F7] dark:bg-[#11252D] text-[#0F2A2E] dark:text-[#ECF6F8]'
                                }`}
                              >
                                <div className="font-bold mb-1 opacity-85">
                                  {mine ? ui.t('أنت', 'You') : ui.t(m.senderNameAr, m.senderName)}
                                  {m.timestamp ? ` · ${m.timestamp}` : ''}
                                </div>
                                <p>{m.text}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    <form
                      onSubmit={handleSendPatientChat}
                      className="p-4 border-t border-[#D7E3E6] dark:border-[#1B3540] flex items-center gap-2.5"
                    >
                      <input
                        type="text"
                        value={chatMsg}
                        onChange={(e) => setChatMsg(e.target.value)}
                        aria-label={ui.t('نص الرسالة', 'Message text')}
                        placeholder={ui.t('اكتب رسالتك للطبيب...', 'Write a message to your doctor...')}
                        className="flex-1 h-11 px-4 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] text-xs text-[#0F2A2E] dark:text-[#ECF6F8] focus:outline-none focus:border-[#0E7490]"
                      />
                      <button
                        type="submit"
                        disabled={!chatMsg.trim() || core.isLoading('send-message')}
                        className="h-11 px-5 rounded-[10px] bg-[#0E7490] hover:bg-[#0B5C73] disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                      >
                        {core.isLoading('send-message') ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>{ui.t('إرسال', 'Send')}</span>
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
