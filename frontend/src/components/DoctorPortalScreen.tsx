import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  History,
  Inbox,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Stethoscope,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useAppCore } from '../core/useAppCore';
import {
  ClinicalReport,
  ConnectionRequest,
  CtDiagnosisType,
  DoctorTabId,
  PatientRecord,
  RiskTier,
} from '../core/types';
import { AnimatedCounter, CerebrovascularWaveSvg, SpotlightTiltCard } from './LuxuryMotion';

type ReportFilter = 'all' | 'pending' | 'signed';
type RiskFilter = 'all' | RiskTier | 'none';

const CARD = 'rounded-2xl border border-[#D7E3E6] dark:border-[#1B3540] bg-white dark:bg-[#0C1B21]';
const MUTED = 'text-[#5B6B7A] dark:text-[#8CA3AF]';
const STRONG = 'text-[#0F2A2E] dark:text-[#ECF6F8]';

export const DoctorPortalScreen: React.FC = () => {
  const core = useAppCore();
  const { ui } = core;
  const user = core.getCurrentUser();
  const stats = core.getDoctorStats();
  const activeTab = core.getDoctorTab();
  const patients = core.getPatients();
  const requests = core.getDoctorRequests();
  const reports = core.getReports();
  const threads = core.getChatThreads();
  const activeConversationId = core.getActiveConversationId();

  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [reportFilter, setReportFilter] = useState<ReportFilter>('all');
  const [chatDraft, setChatDraft] = useState('');
  /** Patient whose chat was requested before their conversation was known (no conversationId yet). */
  const [pendingChatPatientId, setPendingChatPatientId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeThread = threads.find((t) => t.conversationId === activeConversationId) || null;

  // When threads arrive, open the conversation that was requested from the patients table.
  useEffect(() => {
    if (!pendingChatPatientId) return;
    const t = threads.find((x) => x.patientId === pendingChatPatientId);
    if (t) {
      core.openConversation(t.conversationId);
      setPendingChatPatientId(null);
    }
  }, [threads, pendingChatPatientId, core]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [activeThread?.messages.length, activeConversationId]);

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return patients.filter((p) => {
      if (riskFilter === 'none' && p.latestRiskTier !== null) return false;
      if (riskFilter !== 'all' && riskFilter !== 'none' && p.latestRiskTier !== riskFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.nameAr.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
      );
    });
  }, [patients, searchQuery, riskFilter]);

  const pendingReportsLocal = reports.filter((r) => r.signedStatus === 'Pending Sign-off').length;
  const filteredReports = reports.filter((r) =>
    reportFilter === 'all'
      ? true
      : reportFilter === 'pending'
        ? r.signedStatus === 'Pending Sign-off'
        : r.signedStatus === 'Signed & Approved'
  );
  const unreadMessages = stats?.unreadMessages ?? threads.reduce((acc, t) => acc + t.unreadCount, 0);
  const pendingReports = stats?.pendingReports ?? pendingReportsLocal;

  const openChatWith = (p: PatientRecord) => {
    if (p.conversationId) {
      core.openConversation(p.conversationId);
    } else {
      setPendingChatPatientId(p.id);
    }
    core.setDoctorTab('doc-pane-chat');
  };

  const findPatientForReport = (rep: ClinicalReport): PatientRecord | undefined =>
    patients.find((p) => (rep.patientId && p.id === rep.patientId) || (rep.mrn !== '—' && p.mrn === rep.mrn));

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatDraft.trim();
    if (!text || !activeThread || core.isLoading('send-message')) return;
    void core.sendChatMessage(activeThread.conversationId, text);
    setChatDraft('');
  };

  // ---------------------------------------------------------------- helpers
  const diagnosisLabel = (d: CtDiagnosisType | null): string | null => {
    if (d === 'hemorrhagic') return ui.t('نزيف دماغي (Hemorrhagic)', 'Hemorrhagic stroke');
    if (d === 'ischemic') return ui.t('احتشاء إقفاري (Ischemic)', 'Ischemic stroke');
    if (d === 'normal') return ui.t('أشعة طبيعية', 'Normal CT');
    if (d === 'rejected_non_brain') return ui.t('صورة مرفوضة (ليست أشعة دماغ)', 'Image rejected (not a brain CT)');
    return null;
  };

  const renderRiskStatus = (tier: RiskTier | null, prob: number | null, diagnosis: CtDiagnosisType | null) => {
    const dx = diagnosisLabel(diagnosis);
    const pct = prob !== null ? ` (${prob.toFixed(1)}%)` : '';
    let badge: React.ReactNode;
    if (tier === 'high') {
      badge = (
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#DC2626] dark:text-[#EF4444]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            {ui.t('خطر مرتفع', 'High risk')}
            {pct}
          </span>
        </div>
      );
    } else if (tier === 'moderate') {
      badge = (
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B45309] dark:text-[#F59E0B]">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>
            {ui.t('خطر متوسط', 'Moderate risk')}
            {pct}
          </span>
        </div>
      );
    } else if (tier === 'low') {
      badge = (
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#047857] dark:text-[#10B981]">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>
            {ui.t('خطر منخفض', 'Low risk')}
            {pct}
          </span>
        </div>
      );
    } else {
      badge = (
        <div className={`inline-flex items-center gap-1.5 text-xs font-semibold ${MUTED}`}>
          <Activity className="w-3.5 h-3.5 shrink-0" />
          <span>{ui.t('لا يوجد تقييم بعد', 'No assessment yet')}</span>
        </div>
      );
    }
    return (
      <div className="space-y-0.5">
        {badge}
        {dx && <div className={`text-[11px] ${MUTED}`}>{dx}</div>}
      </div>
    );
  };

  const genderLabel = (g: PatientRecord['gender']) =>
    g === 'Male' ? ui.t('ذكر', 'M') : g === 'Female' ? ui.t('أنثى', 'F') : g === 'Other' ? ui.t('آخر', 'Other') : '—';

  const ageLabel = (age: number | null) => (age !== null ? `${age} ${ui.t('سنة', 'yrs')}` : '—');

  const validationBadge = (rep: ClinicalReport) => {
    const cls =
      rep.agentStatus === 'Verified'
        ? 'text-[#047857] dark:text-[#10B981]'
        : rep.agentStatus === 'Flagged Review'
          ? 'text-[#DC2626] dark:text-[#EF4444]'
          : 'text-[#B45309] dark:text-[#F59E0B]';
    const label =
      rep.agentStatus === 'Verified'
        ? ui.t('اجتاز التحقق', 'Validation passed')
        : rep.agentStatus === 'Flagged Review'
          ? ui.t('مُعلَّم للمراجعة', 'Flagged for review')
          : ui.t('بانتظار المراجعة', 'Pending review');
    return <span className={`font-medium ${cls}`}>{label}</span>;
  };

  const skeletonRows = (n: number) => (
    <div className="divide-y divide-[#D7E3E6] dark:divide-[#1B3540]">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="p-4 flex items-center gap-3 animate-pulse">
          <div className="w-9 h-9 rounded-xl bg-[#E4EEF0] dark:bg-[#11252D]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-[#E4EEF0] dark:bg-[#11252D]" />
            <div className="h-3 w-1/2 rounded bg-[#EEF4F5] dark:bg-[#0F2028]" />
          </div>
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

  const requestRow = (r: ConnectionRequest, kind: 'incoming' | 'outgoing') => {
    const busy = core.isLoading(`rel-${r.id}`);
    return (
      <div
        key={r.id}
        className="p-3.5 rounded-xl border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="space-y-0.5 min-w-0">
          <div className={`text-xs font-bold ${STRONG} truncate`}>{r.name || r.email}</div>
          <div className={`text-[11px] ${MUTED} truncate`}>
            {r.email}
            {r.mrn ? ` · ${r.mrn}` : ''}
            {' · '}
            {r.relationshipType === 'primary' ? ui.t('مشرف رئيسي', 'Primary') : ui.t('فريق الرعاية', 'Care team')}
          </div>
          <div className={`text-[11px] font-mono-tabular ${MUTED}`}>
            {ui.t('أُرسل', 'Sent')} {r.createdAt || '—'}
            {r.expiresAt && (
              <span className="text-[#B45309] dark:text-[#F59E0B]">
                {' · '}
                {ui.t('ينتهي', 'Expires')} {r.expiresAt}
              </span>
            )}
          </div>
        </div>
        {kind === 'incoming' ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={busy}
              onClick={() => void core.acceptConnection(r.id)}
              className="h-9 px-3 rounded-lg bg-[#047857] hover:bg-[#065F46] disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{ui.t('قبول', 'Accept')}</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void core.declineConnection(r.id)}
              className="h-9 px-3 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#DC2626] disabled:opacity-60 text-[#DC2626] dark:text-[#EF4444] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>{ui.t('رفض', 'Decline')}</span>
            </button>
          </div>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#B45309]/10 text-[#B45309] dark:text-[#F59E0B] text-[11px] font-bold">
            <Clock className="w-3 h-3" />
            {ui.t('بانتظار موافقة المريض', 'Awaiting patient')}
          </span>
        )}
      </div>
    );
  };

  const statValue = (v: number | undefined) =>
    stats ? (
      <AnimatedCounter value={v ?? 0} />
    ) : core.isLoading('doctor-stats') ? (
      <span className="inline-block w-10 h-7 rounded bg-[#E4EEF0] dark:bg-[#11252D] animate-pulse align-middle" />
    ) : (
      '—'
    );

  const specialty = stats?.specialization || user?.specialty || '';
  const hospital = stats?.hospital || user?.hospital || '';
  const license = stats?.licenseNumber || user?.licenseNumber || '';
  const patientsLoading = core.isLoading('patients') && patients.length === 0;
  const reportsLoading = core.isLoading('reports') && reports.length === 0;
  const threadsLoading = core.isLoading('conversations') && threads.length === 0;
  const hasRequests = requests.incoming.length > 0 || requests.outgoing.length > 0;

  return (
    <div id="screen-doctor-portal" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Clinician Workspace Header Card */}
      <SpotlightTiltCard tiltIntensity={1.5} className={`p-6 ${CARD}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#0E7490]/12 dark:bg-[#06B6D4]/20 text-[#0E7490] dark:text-[#22D3EE] flex items-center justify-center shrink-0">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-[#0E7490] dark:text-[#22D3EE]">
                  {ui.t('مساحة العمل السريرية للطبيب', 'Clinician Workspace')}
                </span>
                <CerebrovascularWaveSvg className="hidden sm:block" />
              </div>
              <h1 className={`text-xl sm:text-2xl font-extrabold ${STRONG}`}>
                {user ? ui.t(user.nameAr || user.name, user.name) : stats?.doctorName || '—'}
              </h1>
              <div className={`flex flex-wrap items-center gap-2 text-xs ${MUTED}`}>
                {[specialty, hospital].filter(Boolean).map((s, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span aria-hidden="true">·</span>}
                    <span>{s}</span>
                  </React.Fragment>
                ))}
                {license && (
                  <>
                    {(specialty || hospital) && <span aria-hidden="true">·</span>}
                    <span className="font-mono-tabular">{license}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => core.openModal('modal-launch-ai-choice')}
              className="h-11 px-4 rounded-[10px] bg-[#0E7490] hover:bg-[#0B5C73] text-white text-xs font-bold flex items-center gap-2 transition-all hover:scale-[1.02] cursor-pointer whitespace-nowrap"
            >
              <Zap className="w-4 h-4" />
              <span>{ui.t('تشغيل نظام الذكاء الاصطناعي', 'Launch AI System')}</span>
            </button>
            <button
              type="button"
              onClick={() => core.navigate('screen-regular-system')}
              className="h-11 px-4 rounded-[10px] border border-[#0E7490] dark:border-[#06B6D4] text-[#0E7490] dark:text-[#22D3EE] hover:bg-[#0E7490]/10 text-xs font-bold flex items-center gap-2 transition-all hover:scale-[1.02] cursor-pointer whitespace-nowrap"
            >
              <Activity className="w-4 h-4" />
              <span>{ui.t('النماذج المباشرة', 'Live Models')}</span>
            </button>
          </div>
        </div>
      </SpotlightTiltCard>

      {/* KPI tiles — all from /doctor/stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SpotlightTiltCard staggerIndex={1} accentGlow="teal" className={`p-5 ${CARD}`}>
          <div className={`text-xs font-medium mb-1 ${MUTED}`}>{ui.t('المرضى المرتبطون', 'Linked patients')}</div>
          <div className={`text-3xl font-extrabold ${STRONG}`}>{statValue(stats?.totalPatients)}</div>
          <div className={`text-[11px] mt-1 ${MUTED}`}>
            {ui.t('مرضى رئيسيون وضمن فريق الرعاية', 'Primary and care-team patients')}
          </div>
        </SpotlightTiltCard>

        <SpotlightTiltCard
          staggerIndex={2}
          accentGlow="amber"
          className="p-5 rounded-2xl border border-[#B45309]/40 bg-[#B45309]/5 dark:bg-[#F59E0B]/10"
        >
          <div className="text-xs font-semibold text-[#B45309] dark:text-[#F59E0B] mb-1">
            {ui.t('تقارير تنتظر التوقيع', 'Reports pending sign-off')}
          </div>
          <div className="text-3xl font-extrabold text-[#B45309] dark:text-[#F59E0B]">
            {statValue(stats?.pendingReports)}
          </div>
          <div className={`text-[11px] mt-1 ${MUTED}`}>
            {stats
              ? ui.t(`${stats.signedReports} تقرير موقّع`, `${stats.signedReports} signed`)
              : ui.t('بانتظار البيانات', 'Waiting for data')}
          </div>
        </SpotlightTiltCard>

        <SpotlightTiltCard staggerIndex={3} accentGlow="emerald" className={`p-5 ${CARD}`}>
          <div className={`text-xs font-medium mb-1 ${MUTED}`}>{ui.t('إجمالي التقييمات', 'Total assessments')}</div>
          <div className={`text-3xl font-extrabold ${STRONG}`}>{statValue(stats?.totalAssessments)}</div>
          <div className={`text-[11px] mt-1 ${MUTED}`}>
            {ui.t('نموذج الخطر والأشعة المقطعية', 'Risk model and CT analyses')}
          </div>
        </SpotlightTiltCard>

        <SpotlightTiltCard staggerIndex={4} accentGlow="teal" className={`p-5 ${CARD}`}>
          <div className={`text-xs font-medium mb-1 ${MUTED}`}>{ui.t('رسائل غير مقروءة', 'Unread messages')}</div>
          <div className="text-3xl font-extrabold text-[#0E7490] dark:text-[#22D3EE]">
            {statValue(stats?.unreadMessages)}
          </div>
          <div className={`text-[11px] mt-1 ${MUTED}`}>{ui.t('من محادثات المرضى', 'From patient conversations')}</div>
        </SpotlightTiltCard>
      </div>

      {/* Workspace Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D7E3E6] dark:border-[#1B3540] pb-3">
        <div role="tablist" className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'doc-pane-patients' as DoctorTabId, labelAr: 'دليل المرضى', labelEn: 'Patients', icon: Users, count: patients.length },
              { id: 'doc-pane-reports' as DoctorTabId, labelAr: 'التقارير والاعتماد', labelEn: 'Reports & Sign-off', icon: FileCheck2, count: pendingReports },
              { id: 'doc-pane-chat' as DoctorTabId, labelAr: 'مراسلات المرضى', labelEn: 'Patient Messages', icon: MessageSquare, count: unreadMessages },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => core.setDoctorTab(t.id)}
                className={`h-11 px-4 rounded-[10px] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#0E7490] text-white'
                    : 'bg-white dark:bg-[#0C1B21] border border-[#D7E3E6] dark:border-[#1B3540] text-[#5B6B7A] dark:text-[#8CA3AF] hover:text-[#0F2A2E] dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{ui.t(t.labelAr, t.labelEn)}</span>
                <span className="font-mono-tabular opacity-85">({t.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: PATIENTS */}
      {activeTab === 'doc-pane-patients' && (
        <div className="space-y-6 sa-animate-in">
          {/* Connection requests */}
          {hasRequests && (
            <div className={`p-5 space-y-4 ${CARD}`}>
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-[#0E7490] dark:text-[#22D3EE]" />
                <h2 className={`text-sm font-bold ${STRONG}`}>{ui.t('طلبات الربط', 'Connection requests')}</h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-2.5">
                  <div className={`text-xs font-bold ${MUTED}`}>
                    {ui.t('طلبات واردة من المرضى', 'Incoming from patients')} ({requests.incoming.length})
                  </div>
                  {requests.incoming.length === 0 ? (
                    <div className={`text-xs ${MUTED}`}>{ui.t('لا توجد طلبات واردة.', 'No incoming requests.')}</div>
                  ) : (
                    requests.incoming.map((r) => requestRow(r, 'incoming'))
                  )}
                </div>
                <div className="space-y-2.5">
                  <div className={`text-xs font-bold ${MUTED}`}>
                    {ui.t('دعوات مرسلة بانتظار الرد', 'Pending invitations you sent')} ({requests.outgoing.length})
                  </div>
                  {requests.outgoing.length === 0 ? (
                    <div className={`text-xs ${MUTED}`}>{ui.t('لا توجد دعوات معلقة.', 'No pending invitations.')}</div>
                  ) : (
                    requests.outgoing.map((r) => requestRow(r, 'outgoing'))
                  )}
                </div>
              </div>
            </div>
          )}

          <div id="doc-pane-patients" className={`overflow-hidden ${CARD}`}>
            {/* Toolbar */}
            <div className="p-4 sm:p-5 border-b border-[#D7E3E6] dark:border-[#1B3540] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-1 flex-col sm:flex-row gap-2.5 max-w-2xl">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#5B6B7A] absolute top-3.5 start-3.5 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label={ui.t('بحث باسم المريض أو رقم الملف', 'Search by patient name or MRN')}
                    placeholder={ui.t('ابحث بالاسم، البريد، أو رقم الملف MRN...', 'Search by name, email, or MRN...')}
                    className="w-full h-11 ps-10 pe-4 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] text-xs text-[#0F2A2E] dark:text-[#ECF6F8] focus:outline-none focus:border-[#0E7490]"
                  />
                </div>
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
                  aria-label={ui.t('تصفية حسب مستوى الخطر', 'Filter by risk level')}
                  className="h-11 px-3 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] text-xs text-[#0F2A2E] dark:text-[#ECF6F8]"
                >
                  <option value="all">{ui.t('كل المستويات', 'All risk levels')}</option>
                  <option value="high">{ui.t('خطر مرتفع', 'High risk')}</option>
                  <option value="moderate">{ui.t('خطر متوسط', 'Moderate risk')}</option>
                  <option value="low">{ui.t('خطر منخفض', 'Low risk')}</option>
                  <option value="none">{ui.t('بدون تقييم', 'No assessment')}</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => core.openModal('modal-admit-patient')}
                className="h-11 px-4 rounded-[10px] bg-[#0E7490] hover:bg-[#0B5C73] text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                <span>{ui.t('دعوة مريض بالبريد', 'Invite patient by email')}</span>
              </button>
            </div>

            {patientsLoading ? (
              skeletonRows(4)
            ) : patients.length === 0 ? (
              emptyState(
                <Users className="w-6 h-6" />,
                ui.t('لا يوجد مرضى بعد', 'No patients yet'),
                ui.t(
                  'ادعُ مريضاً مسجلاً في المنصة عبر بريده الإلكتروني، وسيظهر هنا بعد موافقته.',
                  'Invite a registered patient by email. They will appear here once they accept.'
                ),
                <button
                  type="button"
                  onClick={() => core.openModal('modal-admit-patient')}
                  className="h-10 px-4 rounded-lg bg-[#0E7490] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{ui.t('دعوة مريض', 'Invite a patient')}</span>
                </button>
              )
            ) : filteredPatients.length === 0 ? (
              emptyState(<Search className="w-6 h-6" />, ui.t('لا توجد نتائج مطابقة', 'No matching patients'))
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-start border-collapse">
                    <thead>
                      <tr className="border-b border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] text-[11px] font-bold text-[#5B6B7A] dark:text-[#8CA3AF]">
                        <th className="py-3.5 px-4 text-start">{ui.t('المريض', 'Patient')}</th>
                        <th className="py-3.5 px-4 text-start">{ui.t('رقم الملف', 'MRN')}</th>
                        <th className="py-3.5 px-4 text-start">{ui.t('العمر والجنس', 'Age / Sex')}</th>
                        <th className="py-3.5 px-4 text-start">{ui.t('نوع الإشراف', 'Care role')}</th>
                        <th className="py-3.5 px-4 text-start">{ui.t('آخر تقييم', 'Latest assessment')}</th>
                        <th className="py-3.5 px-4 text-end">{ui.t('إجراءات', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D7E3E6] dark:divide-[#1B3540] text-xs">
                      {filteredPatients.map((patient) => (
                        <tr key={patient.id} className="hover:bg-[#F7FAFA] dark:hover:bg-[#11252D]/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-[#0E7490]/12 dark:bg-[#06B6D4]/20 text-[#0E7490] dark:text-[#22D3EE] font-bold flex items-center justify-center shrink-0">
                                {(patient.name || '?').slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className={`font-bold ${STRONG}`}>{ui.t(patient.nameAr, patient.name)}</div>
                                <div className={`text-[11px] ${MUTED}`}>{patient.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className={`py-3.5 px-4 font-mono-tabular font-semibold ${STRONG}`}>{patient.mrn}</td>
                          <td className={`py-3.5 px-4 font-mono-tabular ${STRONG}`}>
                            {ageLabel(patient.age)} · {genderLabel(patient.gender)}
                          </td>
                          <td className={`py-3.5 px-4 ${MUTED}`}>
                            <div className="font-semibold text-[#047857] dark:text-[#10B981]">
                              {patient.careRole === 'Primary' ? ui.t('مشرف رئيسي', 'Primary') : ui.t('فريق الرعاية', 'Care team')}
                            </div>
                            <div className="text-[11px]">
                              {patient.totalAssessments} {ui.t('تقييم', 'assessments')} · {patient.totalReports}{' '}
                              {ui.t('تقرير', 'reports')}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {renderRiskStatus(patient.latestRiskTier, patient.latestRiskProb, patient.latestDiagnosis)}
                            {patient.lastEvaluated && (
                              <div className={`text-[11px] font-mono-tabular mt-0.5 ${MUTED}`}>{patient.lastEvaluated}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => core.launchAiWizardForPatient(patient.id)}
                                className="h-9 px-3 rounded-lg bg-[#0E7490] hover:bg-[#0B5C73] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <Zap className="w-3.5 h-3.5" />
                                <span>{ui.t('تحليل AI', 'Run AI')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void core.openPatientHistory(patient.id)}
                                className={`h-9 px-2.5 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#0E7490] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${STRONG}`}
                              >
                                <History className="w-3.5 h-3.5" />
                                <span>{ui.t('السجل', 'History')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openChatWith(patient)}
                                className={`h-9 px-2.5 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#0E7490] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${STRONG}`}
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>{ui.t('مراسلة', 'Message')}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-[#D7E3E6] dark:divide-[#1B3540]">
                  {filteredPatients.map((patient) => (
                    <div key={patient.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className={`font-bold text-sm ${STRONG}`}>{ui.t(patient.nameAr, patient.name)}</div>
                          <div className={`text-xs font-mono-tabular ${MUTED}`}>
                            {patient.mrn} · {ageLabel(patient.age)} · {genderLabel(patient.gender)}
                          </div>
                          {patient.lastEvaluated && (
                            <div className={`text-[11px] font-mono-tabular ${MUTED}`}>{patient.lastEvaluated}</div>
                          )}
                        </div>
                        {renderRiskStatus(patient.latestRiskTier, patient.latestRiskProb, patient.latestDiagnosis)}
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => core.launchAiWizardForPatient(patient.id)}
                          className="h-11 rounded-lg bg-[#0E7490] text-white text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>{ui.t('تحليل AI', 'Run AI')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void core.openPatientHistory(patient.id)}
                          className={`h-11 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] text-xs font-semibold flex items-center justify-center gap-1 ${STRONG}`}
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>{ui.t('السجل', 'History')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openChatWith(patient)}
                          className={`h-11 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] text-xs font-semibold flex items-center justify-center gap-1 ${STRONG}`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{ui.t('مراسلة', 'Chat')}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REPORTS & SIGN-OFF */}
      {activeTab === 'doc-pane-reports' && (
        <div id="doc-pane-reports" className={`overflow-hidden sa-animate-in ${CARD}`}>
          <div className="p-5 border-b border-[#D7E3E6] dark:border-[#1B3540] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className={`text-base font-bold ${STRONG}`}>
              {ui.t('التقارير السريرية واعتماد التوقيع', 'Clinical reports & physician sign-off')}
            </h2>
            <div role="tablist" className="flex items-center gap-1.5">
              {(
                [
                  { id: 'all', ar: 'الكل', en: 'All', n: reports.length },
                  { id: 'pending', ar: 'بانتظار التوقيع', en: 'Pending', n: pendingReportsLocal },
                  { id: 'signed', ar: 'موقّعة', en: 'Signed', n: reports.length - pendingReportsLocal },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={reportFilter === f.id}
                  onClick={() => setReportFilter(f.id)}
                  className={`h-9 px-3 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
                    reportFilter === f.id
                      ? 'bg-[#0E7490] text-white'
                      : 'border border-[#D7E3E6] dark:border-[#1B3540] text-[#5B6B7A] dark:text-[#8CA3AF] hover:text-[#0F2A2E] dark:hover:text-white'
                  }`}
                >
                  {ui.t(f.ar, f.en)} <span className="font-mono-tabular opacity-85">({f.n})</span>
                </button>
              ))}
            </div>
          </div>

          {reportsLoading ? (
            skeletonRows(3)
          ) : reports.length === 0 ? (
            emptyState(
              <FileCheck2 className="w-6 h-6" />,
              ui.t('لا توجد تقارير بعد', 'No reports yet'),
              ui.t(
                'تظهر التقارير هنا بعد تشغيل نظام الذكاء الاصطناعي لأحد مرضاك.',
                'Reports appear here after you run the AI system for one of your patients.'
              )
            )
          ) : filteredReports.length === 0 ? (
            emptyState(<FileCheck2 className="w-6 h-6" />, ui.t('لا توجد تقارير في هذا التصنيف', 'No reports in this filter'))
          ) : (
            <div className="divide-y divide-[#D7E3E6] dark:divide-[#1B3540]">
              {filteredReports.map((rep) => {
                const isSigned = rep.signedStatus === 'Signed & Approved';
                const signing = core.isLoading(`sign-${rep.id}`);
                const downloading = core.isLoading(`download-${rep.id}`);
                const linked = findPatientForReport(rep);
                const firstRec = rep.recommendationsEn[0];
                return (
                  <div
                    key={rep.id}
                    className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#F7FAFA] dark:hover:bg-[#11252D]/50 transition-colors"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono-tabular font-bold text-[#0E7490] dark:text-[#22D3EE] break-all">
                          {rep.reportCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={`font-bold ${STRONG}`}>
                          {ui.t(rep.patientNameAr, rep.patientName)}
                          {rep.mrn !== '—' ? ` (${rep.mrn})` : ''}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={`font-mono-tabular ${MUTED}`}>{rep.createdAt || '—'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        {renderRiskStatus(rep.riskTier, rep.riskProb, rep.ctDiagnosis)}
                        <span aria-hidden="true">·</span>
                        {rep.agentStatus === 'Flagged Review' && <ShieldAlert className="w-3.5 h-3.5 text-[#DC2626]" />}
                        {validationBadge(rep)}
                      </div>
                      {(rep.summary || firstRec) && (
                        <p className={`text-xs line-clamp-2 ${MUTED}`}>{rep.summary || firstRec}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      {isSigned ? (
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#047857] dark:text-[#10B981]">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{ui.t('موقّع ومعتمد', 'Signed & approved')}</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={signing}
                          onClick={() => void core.signReport(rep.id)}
                          className="h-10 px-4 rounded-[10px] bg-[#047857] hover:bg-[#065F46] disabled:opacity-60 disabled:cursor-wait text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
                          <span>{ui.t('توقيع واعتماد', 'Sign off')}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={downloading}
                        onClick={() => void core.downloadReport(rep.id, rep.pdfFilename)}
                        className={`h-10 px-3.5 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#0E7490] disabled:opacity-60 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${STRONG}`}
                      >
                        {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        <span>{ui.t('تحميل PDF', 'Download PDF')}</span>
                      </button>

                      {linked && (
                        <button
                          type="button"
                          onClick={() => void core.openPatientHistory(linked.id)}
                          className={`h-10 px-3.5 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#0E7490] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${STRONG}`}
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>{ui.t('سجل المريض', 'Patient history')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PATIENT MESSAGES */}
      {activeTab === 'doc-pane-chat' && (
        <div
          id="doc-pane-chat"
          className={`overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[480px] sa-animate-in ${CARD}`}
        >
          {/* Conversations list */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-e border-[#D7E3E6] dark:border-[#1B3540] divide-y divide-[#D7E3E6] dark:divide-[#1B3540] lg:max-h-[560px] lg:overflow-y-auto">
            <div className={`p-4 bg-[#F7FAFA] dark:bg-[#11252D] text-xs font-bold ${STRONG}`}>
              {ui.t('محادثات المرضى', 'Patient conversations')}
            </div>
            {threadsLoading ? (
              skeletonRows(3)
            ) : threads.length === 0 ? (
              <div className={`p-6 text-xs text-center ${MUTED}`}>
                {ui.t(
                  'لا توجد محادثات بعد. تُنشأ المحادثة تلقائياً عند ربط مريض بك.',
                  'No conversations yet. A conversation is created when a patient is linked to you.'
                )}
              </div>
            ) : (
              threads.map((thread) => {
                const selected = thread.conversationId === activeConversationId;
                return (
                  <button
                    key={thread.conversationId}
                    type="button"
                    onClick={() => core.openConversation(thread.conversationId)}
                    className={`w-full p-4 text-start transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      selected ? 'bg-[#0E7490]/10 dark:bg-[#06B6D4]/15' : 'hover:bg-[#F7FAFA] dark:hover:bg-[#11252D]/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className={`text-xs font-bold truncate ${STRONG}`}>
                        {ui.t(thread.patientNameAr, thread.patientName)}
                      </div>
                      <div className={`text-[11px] truncate ${MUTED}`}>
                        {thread.lastMessage || ui.t('لا توجد رسائل بعد', 'No messages yet')}
                      </div>
                      <div className={`text-[10px] font-mono-tabular ${MUTED}`}>
                        {[thread.mrn, thread.lastUpdated].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {thread.unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#0E7490] text-white text-[10px] font-bold shrink-0">
                        {thread.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Active chat */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            {!activeThread ? (
              emptyState(
                <MessageSquare className="w-6 h-6" />,
                ui.t('اختر محادثة', 'Select a conversation'),
                ui.t('اختر مريضاً من القائمة لعرض الرسائل.', 'Pick a patient from the list to view messages.')
              )
            ) : (
              <>
                <div className="p-4 border-b border-[#D7E3E6] dark:border-[#1B3540] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`text-sm font-bold truncate ${STRONG}`}>
                      {ui.t(activeThread.patientNameAr, activeThread.patientName)}
                    </div>
                    <div className={`text-xs ${MUTED}`}>
                      {activeThread.mrn ? `${activeThread.mrn} · ` : ''}
                      {ui.t('قناة تواصل سريرية', 'Clinical channel')}
                    </div>
                  </div>
                  {activeThread.counterpartyRole === 'patient' && (
                    <button
                      type="button"
                      onClick={() => core.launchAiWizardForPatient(activeThread.patientId)}
                      className="h-9 px-3 rounded-lg bg-[#0E7490] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{ui.t('تحليل AI للمريض', 'Run AI for patient')}</span>
                    </button>
                  )}
                </div>

                <div className="p-5 space-y-3 flex-1 overflow-y-auto max-h-[380px]">
                  {activeThread.messages.length === 0 ? (
                    <div className={`text-xs text-center py-10 ${MUTED}`}>
                      {core.isLoading(`messages-${activeThread.conversationId}`)
                        ? ui.t('جارِ تحميل الرسائل...', 'Loading messages...')
                        : ui.t('لا توجد رسائل بعد. ابدأ المحادثة.', 'No messages yet. Start the conversation.')}
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
                  onSubmit={handleSendMessage}
                  className="p-4 border-t border-[#D7E3E6] dark:border-[#1B3540] flex items-center gap-2.5"
                >
                  <input
                    type="text"
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    aria-label={ui.t('نص الرسالة', 'Message text')}
                    placeholder={ui.t('اكتب رسالتك للمريض...', 'Write a message to the patient...')}
                    className="flex-1 h-11 px-4 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] text-xs text-[#0F2A2E] dark:text-[#ECF6F8] focus:outline-none focus:border-[#0E7490]"
                  />
                  <button
                    type="submit"
                    disabled={!chatDraft.trim() || core.isLoading('send-message')}
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

      {/* Mail hint for invitations, shown only when there are no patients and no requests */}
      {activeTab === 'doc-pane-patients' && patients.length === 0 && !hasRequests && !patientsLoading && (
        <div className={`flex items-center gap-2 text-[11px] ${MUTED}`}>
          <Mail className="w-3.5 h-3.5" />
          <span>
            {ui.t(
              'يجب أن يكون المريض مسجلاً مسبقاً بحساب مريض في المنصة.',
              'The patient must already have a registered patient account.'
            )}
          </span>
        </div>
      )}
    </div>
  );
};
