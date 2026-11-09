import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Download,
  FileCode2,
  Inbox,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { useAppCore } from '../core/useAppCore';
import {
  AccountStatus,
  AdminTabId,
  AuditLogEntry,
  ClinicianApprovalRequest,
  SafetyQueueItem,
  UserProfile,
} from '../core/types';
import { AnimatedCounter, SpotlightTiltCard } from './LuxuryMotion';

// ---------------------------------------------------------------------------
// shared style tokens
// ---------------------------------------------------------------------------
const CARD = 'rounded-2xl border border-[#D7E3E6] dark:border-[#1B3540] bg-white dark:bg-[#0C1B21]';
const H2 = 'text-base font-bold text-[#0F2A2E] dark:text-[#ECF6F8]';
const MUTED = 'text-[#5B6B7A] dark:text-[#8CA3AF]';
const DIVIDE = 'divide-y divide-[#D7E3E6] dark:divide-[#1B3540]';
const PILL_ON = 'bg-[#0E7490] text-white';
const PILL_OFF = 'bg-[#F7FAFA] dark:bg-[#11252D] text-[#5B6B7A] dark:text-[#8CA3AF] hover:text-[#0F2A2E] dark:hover:text-white';
const INPUT =
  'h-9 w-full rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] bg-white dark:bg-[#0C1B21] text-xs text-[#0F2A2E] dark:text-[#ECF6F8] placeholder:text-[#5B6B7A] dark:placeholder:text-[#8CA3AF] focus:outline-none focus:border-[#0E7490]';

const ADMIN_TABS: AdminTabId[] = [
  'admin-pane-overview',
  'admin-pane-approvals',
  'admin-pane-safety',
  'admin-pane-users',
  'admin-pane-models',
  'admin-pane-audit',
  'admin-pane-health',
];

type Tone = 'green' | 'amber' | 'red' | 'teal' | 'gray';
const TONE: Record<Tone, string> = {
  green: 'bg-[#047857]/10 text-[#047857] dark:bg-[#10B981]/15 dark:text-[#10B981]',
  amber: 'bg-[#B45309]/10 text-[#B45309] dark:bg-[#F59E0B]/15 dark:text-[#F59E0B]',
  red: 'bg-[#DC2626]/10 text-[#DC2626] dark:bg-[#EF4444]/15 dark:text-[#EF4444]',
  teal: 'bg-[#0E7490]/10 text-[#0E7490] dark:bg-[#22D3EE]/15 dark:text-[#22D3EE]',
  gray: 'bg-[#F0F6F7] text-[#5B6B7A] dark:bg-[#11252D] dark:text-[#8CA3AF]',
};

const Badge: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`inline-flex items-center h-6 px-2 rounded-md text-[11px] font-bold whitespace-nowrap ${TONE[tone]}`}>
    {children}
  </span>
);

const SkeletonRows: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="space-y-3 py-2" aria-busy="true">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-12 rounded-lg bg-[#F0F6F7] dark:bg-[#11252D] animate-pulse" />
    ))}
  </div>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className={`py-10 flex flex-col items-center justify-center gap-2 text-xs ${MUTED}`}>
    <Inbox className="w-6 h-6 opacity-60" />
    <span>{text}</span>
  </div>
);

/** Debounced search box: local text, fires onSearch 300 ms after the last keystroke. */
const DebouncedSearch: React.FC<{ initial: string; placeholder: string; onSearch: (v: string) => void }> = ({
  initial,
  placeholder,
  onSearch,
}) => {
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <div className="relative w-full sm:w-64">
      <Search className={`w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-3 ${MUTED}`} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => onSearch(v.trim()), 300);
        }}
        className={`${INPUT} ps-8 pe-3`}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// status helpers
// ---------------------------------------------------------------------------
const clinicianStatusTone = (s: AccountStatus): Tone =>
  s === 'active' ? 'green' : s === 'pending' ? 'amber' : s === 'info_requested' ? 'teal' : 'red';

const priorityTone = (p: SafetyQueueItem['priority']): Tone => (p === 'HIGH' ? 'red' : p === 'MEDIUM' ? 'amber' : 'gray');

const safetyStatusTone = (s: SafetyQueueItem['status']): Tone =>
  s === 'Resolved' ? 'green' : s === 'Under Investigation' ? 'teal' : 'red';

const serviceTone = (s: string): Tone => {
  const v = s.toLowerCase();
  if (v === 'healthy' || v === 'nominal' || v === 'active') return 'green';
  if (v === 'degraded') return 'amber';
  if (v === 'unavailable' || v === 'offline' || v === 'down') return 'red';
  return 'gray';
};

const severityTone = (s: string): Tone =>
  s === 'critical' || s === 'high' ? 'red' : s === 'medium' || s === 'warning' ? 'amber' : 'gray';

export const AdminDashboardScreen: React.FC = () => {
  const core = useAppCore();
  const { ui } = core;
  const activeTab = core.getAdminTab();

  const overview = core.getAdminOverview();
  const approvals = core.getClinicianApprovals();
  const clinicianFilter = core.getClinicianFilter();
  const safetyQueue = core.getSafetyQueue();
  const safetyFilter = core.getSafetyFilter();
  const users = core.getUsersDirectory();
  const usersFilter = core.getUsersFilter();
  const models = core.getAIModels();
  const auditLogs = core.getAuditLogs();
  const health = core.getHealth();
  const incidents = core.getIncidents();

  // Inline "reason" form for activate/deactivate (backend requires reason >= 3 chars)
  const [toggleUserId, setToggleUserId] = useState<string | null>(null);
  const [toggleReason, setToggleReason] = useState('');

  // The KPI strip is shown on every tab, so make sure the overview is loaded once.
  useEffect(() => {
    if (!core.getAdminOverview() && !core.isLoading('admin-overview')) void core.loadAdminOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLabel = (s: AccountStatus): string =>
    s === 'active'
      ? ui.t('معتمد', 'Approved')
      : s === 'pending'
        ? ui.t('معلّق', 'Pending')
        : s === 'info_requested'
          ? ui.t('بانتظار معلومات', 'Info requested')
          : s === 'suspended'
            ? ui.t('موقوف', 'Suspended')
            : ui.t('مرفوض', 'Rejected');

  const serviceLabel = (s: string): string => {
    const v = s.toLowerCase();
    if (v === 'healthy') return ui.t('سليم', 'Healthy');
    if (v === 'degraded') return ui.t('متدهور', 'Degraded');
    if (v === 'unavailable') return ui.t('غير متاح', 'Unavailable');
    return s || '—';
  };

  const refresh = (): void => {
    switch (activeTab) {
      case 'admin-pane-overview':
        void core.loadAdminOverview();
        break;
      case 'admin-pane-approvals':
        void core.loadClinicians();
        break;
      case 'admin-pane-safety':
        void core.loadSafetyQueue();
        break;
      case 'admin-pane-users':
        void core.loadUsers();
        break;
      case 'admin-pane-models':
        void core.loadModels();
        break;
      case 'admin-pane-audit':
        void core.loadAuditLogs();
        break;
      case 'admin-pane-health':
        void core.loadHealth();
        break;
    }
  };

  const tabLoadingKey: Record<AdminTabId, string> = {
    'admin-pane-overview': 'admin-overview',
    'admin-pane-approvals': 'clinicians',
    'admin-pane-safety': 'safety',
    'admin-pane-users': 'users',
    'admin-pane-models': 'models',
    'admin-pane-audit': 'audit',
    'admin-pane-health': 'health',
  };
  const tabBusy = core.isLoading(tabLoadingKey[activeTab]);

  const RefreshButton = (
    <button
      type="button"
      onClick={refresh}
      disabled={tabBusy}
      aria-label={ui.t('تحديث', 'Refresh')}
      className="h-9 px-3 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:border-[#0E7490] disabled:opacity-60 disabled:cursor-wait"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${tabBusy ? 'animate-spin' : ''}`} />
      <span>{ui.t('تحديث', 'Refresh')}</span>
    </button>
  );

  const handleExportAuditCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'ID,Timestamp,Actor,Role,Action,Resource,Outcome,Reason,Severity';
    const rows = auditLogs.map((l) =>
      [l.id, l.timestamp, l.actor, l.role, l.action, l.resource, l.outcome, l.reason, l.severity].map(esc).join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'strokeaegis-audit-log.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const submitToggle = async (u: UserProfile) => {
    if (toggleReason.trim().length < 3) return;
    const ok = await core.toggleUserActiveStatus(u.id, toggleReason.trim());
    if (ok) {
      setToggleUserId(null);
      setToggleReason('');
    }
  };

  // ---------------- KPI tiles ----------------
  const kpis: { ar: string; en: string; value: number | undefined; glow: 'teal' | 'amber' | 'emerald' | 'crimson'; color?: string; danger?: boolean }[] = [
    { ar: 'أطباء نشطون', en: 'Active Doctors', value: overview?.activeDoctors, glow: 'teal' },
    { ar: 'طلبات اعتماد معلقة', en: 'Pending Approvals', value: overview?.pendingClinicians, glow: 'amber', color: 'text-[#B45309] dark:text-[#F59E0B]' },
    { ar: 'مرضى مسجلون', en: 'Registered Patients', value: overview?.registeredPatients, glow: 'emerald' },
    { ar: 'تقييمات اليوم', en: 'Assessments Today', value: overview?.assessmentsToday, glow: 'teal', color: 'text-[#0E7490] dark:text-[#22D3EE]' },
    { ar: 'تنبيهات السلامة', en: 'Safety Flags', value: overview?.safetyFlags, glow: 'crimson', danger: true },
    { ar: 'حوادث مفتوحة', en: 'Open Incidents', value: overview?.openIncidents, glow: 'amber' },
  ];
  const overviewLoading = core.isLoading('admin-overview');

  return (
    <div id="screen-admin-dashboard" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sa-luxury-enter">
      {/* Header */}
      <div className={`p-6 ${CARD} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#0E7490]/12 dark:bg-[#06B6D4]/20 text-[#0E7490] dark:text-[#22D3EE] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#0E7490] dark:text-[#22D3EE]">
              {ui.t('مركز القيادة والرقابة السريرية', 'Clinical AI Governance & Safety Command')}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F2A2E] dark:text-[#ECF6F8]">
              {ui.t('حوكمة النظام السريري', 'Clinical System Governance')}
            </h1>
            {overview?.lastUpdated && (
              <div className={`text-[11px] mt-0.5 ${MUTED}`}>
                {ui.t('آخر تحديث:', 'Last updated:')} <span className="font-mono-tabular">{overview.lastUpdated}</span>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => core.openModal('modal-admin-incident', {})}
          className="h-11 px-4 rounded-[10px] bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>{ui.t('تسجيل حادثة نظام', 'Log System Incident')}</span>
        </button>
      </div>

      {/* Governance KPI Tiles (from /api/admin/overview) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {kpis.map((k, i) => (
          <SpotlightTiltCard
            key={k.en}
            delayIndex={i + 1}
            glowColor={k.glow}
            className={
              k.danger
                ? 'p-4 rounded-2xl border border-[#DC2626]/40 bg-[#DC2626]/6 dark:bg-[#EF4444]/12'
                : `p-4 ${CARD}`
            }
          >
            <div className={`text-[11px] ${k.danger ? 'font-bold text-[#DC2626] dark:text-[#EF4444]' : `font-medium ${MUTED}`}`}>
              {ui.t(k.ar, k.en)}
            </div>
            <div
              className={`text-2xl font-extrabold font-mono-tabular mt-1 ${
                k.danger ? 'text-[#DC2626] dark:text-[#EF4444]' : k.color || ''
              }`}
            >
              {k.value === undefined ? (
                overviewLoading ? (
                  <span className="inline-block h-7 w-12 rounded bg-[#F0F6F7] dark:bg-[#11252D] animate-pulse align-middle" />
                ) : (
                  '—'
                )
              ) : (
                <AnimatedCounter value={k.value} />
              )}
            </div>
          </SpotlightTiltCard>
        ))}
      </div>

      {/* Admin Tabs Navigation */}
      <div role="tablist" className="flex flex-wrap items-center gap-2 border-b border-[#D7E3E6] dark:border-[#1B3540] pb-3">
        {(
          [
            { id: 'admin-pane-overview', labelAr: 'نظرة عامة', labelEn: 'Overview', icon: BarChart3 },
            { id: 'admin-pane-approvals', labelAr: 'اعتماد الأطباء', labelEn: 'Clinician Approvals', icon: UserCheck },
            { id: 'admin-pane-safety', labelAr: 'طابور السلامة', labelEn: 'Safety Queue', icon: ShieldAlert },
            { id: 'admin-pane-users', labelAr: 'المستخدمون', labelEn: 'Users Directory', icon: Users },
            { id: 'admin-pane-models', labelAr: 'مراقبة النماذج', labelEn: 'AI Models', icon: Cpu },
            { id: 'admin-pane-audit', labelAr: 'سجل التدقيق', labelEn: 'Audit Log', icon: FileCode2 },
            { id: 'admin-pane-health', labelAr: 'صحة النظام', labelEn: 'System Health', icon: Server },
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
              onClick={() => core.setAdminTab(tab.id)}
              className={`h-11 px-3.5 rounded-[10px] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#0E7490] text-white'
                  : 'bg-white dark:bg-[#0C1B21] border border-[#D7E3E6] dark:border-[#1B3540] text-[#5B6B7A] dark:text-[#8CA3AF] hover:text-[#0F2A2E] dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{ui.t(tab.labelAr, tab.labelEn)}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'admin-pane-overview' && (
        <div id="admin-pane-overview" className="space-y-6 sa-animate-in">
          <div className="flex justify-end">{RefreshButton}</div>

          {!overview && overviewLoading ? (
            <div className={`p-6 ${CARD}`}>
              <SkeletonRows rows={6} />
            </div>
          ) : !overview ? (
            <div className={CARD}>
              <EmptyState text={ui.t('تعذّر تحميل النظرة العامة. اضغط تحديث.', 'Overview unavailable. Press Refresh.')} />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Attention alerts */}
              {overview.alerts.length > 0 && (
                <div className="lg:col-span-12 space-y-2">
                  {overview.alerts.map((a, i) => {
                    const target = ADMIN_TABS.includes(a.actionTab as AdminTabId) ? (a.actionTab as AdminTabId) : null;
                    return (
                      <button
                        key={`${a.title}-${i}`}
                        type="button"
                        disabled={!target}
                        onClick={() => target && core.setAdminTab(target)}
                        className="w-full text-start p-4 rounded-2xl border border-[#B45309]/40 bg-[#B45309]/6 dark:bg-[#F59E0B]/10 flex items-center gap-3 cursor-pointer disabled:cursor-default hover:border-[#B45309]"
                      >
                        <AlertTriangle className="w-5 h-5 text-[#B45309] dark:text-[#F59E0B] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">{a.title}</div>
                          <div className={`text-xs ${MUTED}`}>{a.message}</div>
                        </div>
                        {target && <ChevronRight className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B] shrink-0 rtl:rotate-180" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Volume breakdown */}
              <div className={`lg:col-span-7 p-6 ${CARD} space-y-4`}>
                <h2 className={H2}>{ui.t('توزيع الحالات والتشخيصات', 'Clinical Case & Modality Distribution')}</h2>
                {(() => {
                  const v = overview.volume;
                  const total = overview.totalAssessments;
                  const ct = v.ctScansTotal;
                  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
                  const bars = [
                    { ar: 'إجمالي التقييمات', en: 'Total assessments', count: total, pct: total > 0 ? 100 : 0, color: 'bg-[#0E7490]' },
                    { ar: 'حالات الخطر المرتفع', en: 'High-risk cases', count: v.highRiskCount, pct: v.highRiskRatePct, color: 'bg-[#DC2626]' },
                    { ar: 'صور الأشعة المقطعية', en: 'CT scans processed', count: ct, pct: pct(ct, total), color: 'bg-[#06B6D4]' },
                    { ar: 'سكتات إقفارية', en: 'Ischemic detections', count: v.ischemicCount, pct: pct(v.ischemicCount, ct), color: 'bg-[#B45309]' },
                    { ar: 'نزيف دماغي', en: 'Hemorrhagic detections', count: v.hemorrhagicCount, pct: pct(v.hemorrhagicCount, ct), color: 'bg-[#DC2626]' },
                    { ar: 'أشعة طبيعية', en: 'Normal CT scans', count: v.normalCount, pct: pct(v.normalCount, ct), color: 'bg-[#047857]' },
                  ];
                  return total === 0 && ct === 0 ? (
                    <EmptyState text={ui.t('لا توجد تقييمات بعد.', 'No assessments yet.')} />
                  ) : (
                    <div className="space-y-3.5">
                      {bars.map((bar) => (
                        <div key={bar.en} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#0F2A2E] dark:text-[#ECF6F8]">{ui.t(bar.ar, bar.en)}</span>
                            <span className={`font-mono-tabular font-bold ${MUTED}`}>
                              {bar.count.toLocaleString()} ({bar.pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-[#F0F6F7] dark:bg-[#11252D] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${bar.color} transition-[width] duration-700`}
                              style={{ width: `${Math.min(100, Math.max(0, bar.pct))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className={`pt-2 text-[11px] ${MUTED} flex flex-wrap gap-x-4 gap-y-1`}>
                        <span>
                          {ui.t('تقارير بانتظار التوقيع:', 'Reports awaiting sign-off:')}{' '}
                          <b className="font-mono-tabular">{overview.reportsAwaitingSignoff}</b>
                        </span>
                        <span>
                          {ui.t('رفض بوابة الأمان:', 'Gate rejections:')} <b className="font-mono-tabular">{overview.gateRejections}</b>
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Subsystem health */}
              <div className={`lg:col-span-5 p-6 ${CARD} space-y-4`}>
                <h2 className={H2}>{ui.t('حالة الأنظمة الفرعية', 'Core Subsystem Telemetry')}</h2>
                {overview.subsystems.length === 0 ? (
                  <EmptyState text={ui.t('لا توجد بيانات.', 'No subsystem data.')} />
                ) : (
                  <div className={`${DIVIDE} text-xs`}>
                    {overview.subsystems.map((s) => (
                      <div key={s.name} className="py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-[#0F2A2E] dark:text-[#ECF6F8]">{s.name}</div>
                          {s.details && <div className={`text-[11px] ${MUTED}`}>{s.details}</div>}
                        </div>
                        <Badge tone={serviceTone(s.status)}>● {serviceLabel(s.status)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent events */}
              <div className={`lg:col-span-12 ${CARD} overflow-hidden`}>
                <div className="p-4 border-b border-[#D7E3E6] dark:border-[#1B3540] font-bold text-sm">
                  {ui.t('آخر الأحداث', 'Recent Governance & Clinical Events')}
                </div>
                {overview.recentEvents.length === 0 ? (
                  <EmptyState text={ui.t('لا توجد أحداث حديثة.', 'No recent events.')} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-start text-xs">
                      <thead className={`bg-[#F7FAFA] dark:bg-[#11252D] ${MUTED}`}>
                        <tr>
                          <th className="py-3 px-4 text-start">{ui.t('الوقت', 'Timestamp')}</th>
                          <th className="py-3 px-4 text-start">{ui.t('الفاعل', 'Actor')}</th>
                          <th className="py-3 px-4 text-start">{ui.t('الحدث', 'Action')}</th>
                          <th className="py-3 px-4 text-start">{ui.t('المورد', 'Target')}</th>
                          <th className="py-3 px-4 text-start">{ui.t('النتيجة', 'Outcome')}</th>
                        </tr>
                      </thead>
                      <tbody className={DIVIDE}>
                        {overview.recentEvents.map((e) => (
                          <tr key={e.id}>
                            <td className="py-3 px-4 font-mono-tabular whitespace-nowrap">{e.createdAt}</td>
                            <td className="py-3 px-4 font-semibold">{e.actor || '—'}</td>
                            <td className="py-3 px-4 font-mono-tabular text-[#0E7490] dark:text-[#22D3EE]">{e.action}</td>
                            <td className="py-3 px-4">{e.target || '—'}</td>
                            <td className="py-3 px-4">
                              <Badge tone={/fail|denied|error/i.test(e.outcome) ? 'red' : 'green'}>{e.outcome || '—'}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CLINICIAN APPROVALS */}
      {activeTab === 'admin-pane-approvals' && (
        <div id="admin-pane-approvals" className={`${CARD} p-5 space-y-4 sa-animate-in`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={H2}>{ui.t('طلبات اعتماد تراخيص الأطباء', 'Clinician Credentialing & Approvals')}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <DebouncedSearch
                initial={clinicianFilter.search}
                placeholder={ui.t('بحث بالاسم أو البريد أو الترخيص…', 'Search name, email, license…')}
                onSearch={(v) => void core.loadClinicians(undefined, v)}
              />
              {RefreshButton}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', ar: 'الكل', en: 'All' },
                { id: 'pending', ar: 'معلّق', en: 'Pending' },
                { id: 'more_info_required', ar: 'بانتظار معلومات', en: 'Info requested' },
                { id: 'approved', ar: 'معتمد', en: 'Approved' },
                { id: 'suspended', ar: 'موقوف', en: 'Suspended' },
                { id: 'rejected', ar: 'مرفوض', en: 'Rejected' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={clinicianFilter.status === f.id}
                onClick={() => void core.loadClinicians(f.id)}
                className={`h-9 px-3 rounded-lg text-xs font-semibold cursor-pointer ${clinicianFilter.status === f.id ? PILL_ON : PILL_OFF}`}
              >
                {ui.t(f.ar, f.en)}
              </button>
            ))}
          </div>

          {core.isLoading('clinicians') && approvals.length === 0 ? (
            <SkeletonRows />
          ) : approvals.length === 0 ? (
            <EmptyState text={ui.t('لا توجد طلبات مطابقة.', 'No matching clinician requests.')} />
          ) : (
            <div className={DIVIDE}>
              {approvals.map((c: ClinicianApprovalRequest) => {
                const busy = core.isLoading(`clinician-${c.id}`);
                const btn = 'h-9 px-3 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait';
                return (
                  <div key={c.id} className="py-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">{ui.t(c.nameAr, c.name)}</span>
                        <Badge tone={clinicianStatusTone(c.status)}>{statusLabel(c.status)}</Badge>
                      </div>
                      <div className={`text-xs ${MUTED}`}>
                        <span className="font-mono-tabular text-[#0E7490] dark:text-[#22D3EE]">{c.licenseNumber}</span> ·{' '}
                        {ui.t(c.specialtyAr, c.specialty)} · {ui.t(c.hospitalAr, c.hospital)}
                      </div>
                      <div className={`text-xs ${MUTED}`}>
                        {c.email} · {c.phone} · {ui.t('تاريخ الطلب:', 'Submitted:')}{' '}
                        <span className="font-mono-tabular">{c.submittedAt}</span>
                      </div>
                      {c.reviewedAt && (
                        <div className={`text-[11px] ${MUTED}`}>
                          {ui.t('روجع في', 'Reviewed')} <span className="font-mono-tabular">{c.reviewedAt}</span>
                          {c.reviewedBy ? ` · ${c.reviewedBy}` : ''}
                        </div>
                      )}
                      {c.verificationRef && (
                        <div className="text-[11px]">
                          <span className="font-semibold">{ui.t('مرجع التحقق:', 'Verification ref:')}</span>{' '}
                          <span className="font-mono-tabular">{c.verificationRef}</span>
                        </div>
                      )}
                      {c.moreInfoRequest && (
                        <div className="text-[11px] p-2 rounded-lg bg-[#0E7490]/6 dark:bg-[#22D3EE]/10">
                          <span className="font-semibold">{ui.t('المعلومات المطلوبة:', 'Info requested:')}</span> {c.moreInfoRequest}
                        </div>
                      )}
                      {c.rejectionReason && (
                        <div className="text-[11px] p-2 rounded-lg bg-[#DC2626]/6 dark:bg-[#EF4444]/10 text-[#DC2626] dark:text-[#EF4444]">
                          <span className="font-semibold">{ui.t('السبب:', 'Reason:')}</span> {c.rejectionReason}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {(c.status === 'pending' || c.status === 'info_requested') && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => core.openModal('modal-admin-approve-clinician', { clinician: c })}
                            className={`${btn} bg-[#047857] text-white`}
                          >
                            {ui.t('اعتماد', 'Approve')}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => core.openModal('modal-admin-action-reason', { clinician: c, action: 'request-info' })}
                            className={`${btn} border border-[#B45309] text-[#B45309] dark:text-[#F59E0B]`}
                          >
                            {ui.t('طلب معلومات', 'Request Info')}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => core.openModal('modal-admin-action-reason', { clinician: c, action: 'reject' })}
                            className={`${btn} border border-[#DC2626] text-[#DC2626]`}
                          >
                            {ui.t('رفض', 'Reject')}
                          </button>
                        </>
                      )}
                      {c.status === 'active' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => core.openModal('modal-admin-action-reason', { clinician: c, action: 'suspend' })}
                          className={`${btn} border border-[#DC2626] text-[#DC2626]`}
                        >
                          {ui.t('إيقاف', 'Suspend')}
                        </button>
                      )}
                      {(c.status === 'suspended' || c.status === 'rejected') && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => core.openModal('modal-admin-approve-clinician', { clinician: c })}
                          className={`${btn} bg-[#047857] text-white`}
                        >
                          {ui.t('إعادة الاعتماد', 'Approve again')}
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

      {/* TAB 3: SAFETY QUEUE */}
      {activeTab === 'admin-pane-safety' && (
        <div id="admin-pane-safety" className={`${CARD} p-5 space-y-4 sa-animate-in`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={H2}>{ui.t('طابور السلامة السريرية', 'Clinical Safety Escalation Queue')}</h2>
            {RefreshButton}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', ar: 'الكل', en: 'All' },
                { id: 'flagged', ar: 'مُعلَّمة', en: 'Flagged' },
                { id: 'rejected_gate', ar: 'رفض البوابة', en: 'Gate rejected' },
                { id: 'unsigned', ar: 'غير موقّعة', en: 'Unsigned' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={safetyFilter === f.id}
                onClick={() => void core.loadSafetyQueue(f.id)}
                className={`h-9 px-3 rounded-lg text-xs font-semibold cursor-pointer ${safetyFilter === f.id ? PILL_ON : PILL_OFF}`}
              >
                {ui.t(f.ar, f.en)}
              </button>
            ))}
          </div>

          {core.isLoading('safety') && safetyQueue.length === 0 ? (
            <SkeletonRows />
          ) : safetyQueue.length === 0 ? (
            <EmptyState text={ui.t('لا توجد حالات في الطابور.', 'No cases in the safety queue.')} />
          ) : (
            <div className={DIVIDE}>
              {safetyQueue.map((item) => (
                <div key={item.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono-tabular font-bold text-[#DC2626] dark:text-[#EF4444]">{item.caseCode}</span>
                      <Badge tone={priorityTone(item.priority)}>
                        {item.priority === 'HIGH'
                          ? ui.t('أولوية عالية', 'High priority')
                          : item.priority === 'MEDIUM'
                            ? ui.t('أولوية متوسطة', 'Medium priority')
                            : ui.t('أولوية عادية', 'Normal priority')}
                      </Badge>
                      <Badge tone={safetyStatusTone(item.status)}>
                        {item.status === 'Resolved'
                          ? ui.t('محلولة', 'Resolved')
                          : item.status === 'Under Investigation'
                            ? ui.t('قيد التحقيق', 'Under investigation')
                            : ui.t('تنبيه مفتوح', 'Open alert')}
                      </Badge>
                      <span className={`font-mono-tabular ${MUTED}`}>{item.timestamp}</span>
                    </div>
                    <div className="text-xs font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">
                      {ui.t(item.patientNameAr, item.patientName)}{' '}
                      <span className={`font-mono-tabular font-normal ${MUTED}`}>({item.mrn})</span>
                    </div>
                    <div className={`text-xs ${MUTED}`}>{ui.t(item.triggerReasonAr, item.triggerReasonEn)}</div>
                    <div className="text-xs flex flex-wrap gap-x-3 gap-y-1">
                      <span>
                        {ui.t('الطبيب المسؤول:', 'Assigned clinician:')}{' '}
                        <b>{ui.t(item.assignedDoctorAr, item.assignedDoctor)}</b>
                      </span>
                      {item.riskTier && (
                        <span className={MUTED}>
                          {ui.t('الخطر:', 'Risk:')} {item.riskTier}
                          {item.riskProb !== null ? ` (${item.riskProb}%)` : ''}
                        </span>
                      )}
                      {item.diagnosis && <span className={MUTED}>CT: {item.diagnosis}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void core.openSafetyDetails(item.id)}
                      className="h-9 px-3 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] text-xs font-semibold cursor-pointer"
                    >
                      {ui.t('التفاصيل', 'Details')}
                    </button>
                    <button
                      type="button"
                      onClick={() => core.openModal('modal-admin-safety-assign', { item })}
                      className="h-9 px-3 rounded-lg border border-[#0E7490] text-[#0E7490] dark:text-[#22D3EE] text-xs font-semibold cursor-pointer"
                    >
                      {ui.t('إسناد لطبيب', 'Assign Doctor')}
                    </button>
                    <button
                      type="button"
                      onClick={() => core.openModal('modal-admin-investigate', { item })}
                      className="h-9 px-3 rounded-lg bg-[#0E7490] text-white text-xs font-bold cursor-pointer"
                    >
                      {ui.t('توثيق التحقيق', 'Investigate')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: USERS DIRECTORY */}
      {activeTab === 'admin-pane-users' && (
        <div id="admin-pane-users" className={`${CARD} p-5 space-y-4 sa-animate-in`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={H2}>{ui.t('إدارة حسابات المستخدمين', 'User Accounts & Role Access Control')}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <DebouncedSearch
                initial={usersFilter.search}
                placeholder={ui.t('بحث بالاسم أو البريد…', 'Search name or email…')}
                onSearch={(v) => void core.loadUsers(undefined, v)}
              />
              {RefreshButton}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', ar: 'الكل', en: 'All' },
                { id: 'doctor', ar: 'أطباء', en: 'Doctors' },
                { id: 'patient', ar: 'مرضى', en: 'Patients' },
                { id: 'admin', ar: 'مسؤولون', en: 'Admins' },
              ] as const
            ).map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={usersFilter.role === r.id}
                onClick={() => void core.loadUsers(r.id)}
                className={`h-9 px-3 rounded-lg text-xs font-semibold cursor-pointer ${usersFilter.role === r.id ? PILL_ON : PILL_OFF}`}
              >
                {ui.t(r.ar, r.en)}
              </button>
            ))}
          </div>

          {core.isLoading('users') && users.length === 0 ? (
            <SkeletonRows />
          ) : users.length === 0 ? (
            <EmptyState text={ui.t('لا يوجد مستخدمون مطابقون.', 'No matching users.')} />
          ) : (
            <div className={DIVIDE}>
              {users.map((u) => {
                const busy = core.isLoading(`user-${u.id}`);
                const editing = toggleUserId === u.id;
                const roleLabel =
                  u.role === 'doctor' ? ui.t('طبيب', 'Doctor') : u.role === 'patient' ? ui.t('مريض', 'Patient') : ui.t('مسؤول', 'Admin');
                return (
                  <div key={u.id} className="py-3.5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">{ui.t(u.nameAr, u.name)}</span>
                          <Badge tone="teal">{roleLabel}</Badge>
                          {u.role === 'doctor' && u.status !== 'active' && (
                            <Badge tone={clinicianStatusTone(u.status)}>{statusLabel(u.status)}</Badge>
                          )}
                        </div>
                        <div className={`text-[11px] ${MUTED}`}>
                          {u.email}
                          {u.createdAt ? ` · ${ui.t('انضم', 'Joined')} ${u.createdAt}` : ''}
                        </div>
                        {u.role === 'doctor' && (u.licenseNumber || u.specialty) && (
                          <div className={`text-[11px] ${MUTED}`}>
                            {u.licenseNumber && <span className="font-mono-tabular">{u.licenseNumber}</span>}
                            {u.specialty ? ` · ${ui.t(u.specialtyAr || u.specialty, u.specialty)}` : ''}
                            {u.hospital ? ` · ${ui.t(u.hospitalAr || u.hospital, u.hospital)}` : ''}
                          </div>
                        )}
                        {u.role === 'patient' && u.mrn && (
                          <div className={`text-[11px] ${MUTED}`}>
                            MRN: <span className="font-mono-tabular">{u.mrn}</span>
                            {u.gender ? ` · ${u.gender}` : ''}
                            {u.dob ? ` · ${u.dob}` : ''}
                          </div>
                        )}
                        {u.role !== 'admin' && (
                          <div className={`text-[11px] ${MUTED}`}>
                            {ui.t('اتصالات نشطة:', 'Active connections:')}{' '}
                            <span className="font-mono-tabular font-bold">{u.activeConnections ?? 0}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge tone={u.isActive ? 'green' : 'red'}>
                          {u.isActive ? ui.t('نشط', 'Active') : ui.t('معطّل', 'Deactivated')}
                        </Badge>
                        <button
                          type="button"
                          disabled={busy}
                          aria-expanded={editing}
                          onClick={() => {
                            setToggleUserId(editing ? null : u.id);
                            setToggleReason('');
                          }}
                          className="h-9 px-3 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#0E7490] text-xs font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                        >
                          {u.isActive ? ui.t('تعطيل', 'Deactivate') : ui.t('تفعيل', 'Activate')}
                        </button>
                      </div>
                    </div>

                    {editing && (
                      <form
                        className="flex flex-col sm:flex-row gap-2 p-3 rounded-xl bg-[#F7FAFA] dark:bg-[#11252D]"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void submitToggle(u);
                        }}
                      >
                        <input
                          autoFocus
                          value={toggleReason}
                          onChange={(e) => setToggleReason(e.target.value)}
                          placeholder={ui.t('سبب التغيير (3 أحرف على الأقل)', 'Reason for the change (min 3 characters)')}
                          aria-label={ui.t('سبب التغيير', 'Reason for the change')}
                          className={`${INPUT} px-3 flex-1`}
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={busy || toggleReason.trim().length < 3}
                            className={`h-9 px-3 rounded-lg text-white text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                              u.isActive ? 'bg-[#DC2626]' : 'bg-[#047857]'
                            }`}
                          >
                            {busy ? ui.t('جارٍ الحفظ…', 'Saving…') : ui.t('تأكيد', 'Confirm')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setToggleUserId(null);
                              setToggleReason('');
                            }}
                            className="h-9 px-3 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] text-xs font-semibold cursor-pointer"
                          >
                            {ui.t('إلغاء', 'Cancel')}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AI MODELS */}
      {activeTab === 'admin-pane-models' && (
        <div id="admin-pane-models" className="space-y-4 sa-animate-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={H2}>{ui.t('مخزون نماذج الذكاء الاصطناعي', 'AI Model Inventory')}</h2>
            {RefreshButton}
          </div>
          {core.isLoading('models') && models.length === 0 ? (
            <div className={`${CARD} p-5`}>
              <SkeletonRows />
            </div>
          ) : models.length === 0 ? (
            <div className={CARD}>
              <EmptyState text={ui.t('لا توجد نماذج مسجلة.', 'No models registered.')} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {models.map((m) => (
                <div key={m.id || m.key} className={`p-6 ${CARD} space-y-4`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-mono-tabular text-[#0E7490] dark:text-[#22D3EE]">
                        {m.architecture || '—'}
                        {m.version ? ` · v${m.version.replace(/^v/i, '')}` : ''}
                      </div>
                      <h3 className="text-base font-bold text-[#0F2A2E] dark:text-[#ECF6F8] mt-0.5">{m.name}</h3>
                    </div>
                    <Badge tone={m.status === 'Nominal' ? 'green' : m.status === 'Degraded' ? 'amber' : 'red'}>
                      ●{' '}
                      {m.status === 'Nominal'
                        ? ui.t('يعمل', 'Nominal')
                        : m.status === 'Degraded'
                          ? ui.t('متدهور', 'Degraded')
                          : ui.t('متوقف', 'Offline')}
                    </Badge>
                  </div>

                  <p className={`text-xs ${MUTED}`}>{ui.t(m.purposeAr, m.purposeEn)}</p>

                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#D7E3E6] dark:border-[#1B3540] text-xs">
                    <div>
                      <div className={MUTED}>{ui.t('الاستدلالات', 'Inferences')}</div>
                      <div className="text-base font-extrabold font-mono-tabular mt-0.5">{m.inferencesCount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className={MUTED}>{ui.t('الأخطاء', 'Errors')}</div>
                      <div className="text-base font-extrabold font-mono-tabular mt-0.5">{m.errorCount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className={MUTED}>{ui.t('نسبة الخطأ', 'Error Rate')}</div>
                      <div
                        className={`text-base font-extrabold font-mono-tabular mt-0.5 ${
                          m.errorRatePercent >= 5 ? 'text-[#DC2626] dark:text-[#EF4444]' : 'text-[#047857] dark:text-[#10B981]'
                        }`}
                      >
                        {m.errorRatePercent}%
                      </div>
                    </div>
                  </div>
                  <div className={`text-[11px] ${MUTED} flex items-center gap-1.5`}>
                    <Activity className="w-3.5 h-3.5" />
                    {ui.t('آخر استدلال:', 'Last inference:')}{' '}
                    <span className="font-mono-tabular">{m.lastInferenceAt || ui.t('لا يوجد بعد', 'None yet')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: AUDIT LOG */}
      {activeTab === 'admin-pane-audit' && (
        <div id="admin-pane-audit" className={`${CARD} p-5 space-y-4 sa-animate-in`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={H2}>{ui.t('سجل التدقيق', 'Clinical Audit Trail')}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <DebouncedSearch
                initial=""
                placeholder={ui.t('بحث في السجل…', 'Search the log…')}
                onSearch={(v) => void core.loadAuditLogs(v)}
              />
              {RefreshButton}
              <button
                type="button"
                onClick={handleExportAuditCsv}
                disabled={auditLogs.length === 0}
                className="h-9 px-3 rounded-lg bg-[#0E7490] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{ui.t('تصدير CSV', 'Export CSV')}</span>
              </button>
            </div>
          </div>

          {core.isLoading('audit') && auditLogs.length === 0 ? (
            <SkeletonRows rows={6} />
          ) : auditLogs.length === 0 ? (
            <EmptyState text={ui.t('لا توجد سجلات مطابقة.', 'No matching audit entries.')} />
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-start text-xs">
                <thead className={`bg-[#F7FAFA] dark:bg-[#11252D] ${MUTED}`}>
                  <tr>
                    <th className="py-3 px-4 text-start">{ui.t('الوقت', 'Timestamp')}</th>
                    <th className="py-3 px-4 text-start">{ui.t('الفاعل', 'Actor')}</th>
                    <th className="py-3 px-4 text-start">{ui.t('الحدث', 'Action')}</th>
                    <th className="py-3 px-4 text-start">{ui.t('المورد', 'Resource')}</th>
                    <th className="py-3 px-4 text-start">{ui.t('النتيجة', 'Outcome')}</th>
                  </tr>
                </thead>
                <tbody className={DIVIDE}>
                  {auditLogs.map((log: AuditLogEntry) => (
                    <tr
                      key={log.id}
                      tabIndex={0}
                      role="button"
                      onClick={() => core.openModal('modal-admin-audit-detail', { entry: log })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          core.openModal('modal-admin-audit-detail', { entry: log });
                        }
                      }}
                      className="cursor-pointer hover:bg-[#F7FAFA] dark:hover:bg-[#11252D] focus:outline-none focus:bg-[#F7FAFA] dark:focus:bg-[#11252D]"
                    >
                      <td className="py-3 px-4 font-mono-tabular whitespace-nowrap">{log.timestamp}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold">{log.actor}</div>
                        <div className={`text-[11px] ${MUTED}`}>{log.role}</div>
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-[#0E7490] dark:text-[#22D3EE]">{log.action}</td>
                      <td className="py-3 px-4">{log.resource}</td>
                      <td className="py-3 px-4">
                        <Badge tone={log.severity === 'critical' ? 'red' : log.severity === 'warning' ? 'amber' : 'green'}>
                          {log.outcome}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: SYSTEM HEALTH */}
      {activeTab === 'admin-pane-health' && (
        <div id="admin-pane-health" className="space-y-5 sa-animate-in">
          {(() => {
            const overall = (health?.overall || '').toLowerCase();
            const tone = !health ? 'gray' : serviceTone(overall);
            const box =
              tone === 'green'
                ? 'border-[#047857]/40 bg-[#047857]/8 dark:bg-[#10B981]/12'
                : tone === 'amber'
                  ? 'border-[#B45309]/40 bg-[#B45309]/8 dark:bg-[#F59E0B]/12'
                  : tone === 'red'
                    ? 'border-[#DC2626]/40 bg-[#DC2626]/8 dark:bg-[#EF4444]/12'
                    : 'border-[#D7E3E6] dark:border-[#1B3540] bg-white dark:bg-[#0C1B21]';
            const Icon = tone === 'green' ? CheckCircle2 : tone === 'red' ? XCircle : AlertOctagon;
            const iconColor =
              tone === 'green'
                ? 'text-[#047857] dark:text-[#10B981]'
                : tone === 'red'
                  ? 'text-[#DC2626] dark:text-[#EF4444]'
                  : 'text-[#B45309] dark:text-[#F59E0B]';
            return (
              <div className={`p-5 rounded-2xl border ${box} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                <div className="flex items-center gap-3">
                  {core.isLoading('health') && !health ? (
                    <RefreshCw className={`w-6 h-6 animate-spin ${MUTED}`} />
                  ) : (
                    <Icon className={`w-6 h-6 ${iconColor}`} />
                  )}
                  <div>
                    <div className="text-sm font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">
                      {!health
                        ? core.isLoading('health')
                          ? ui.t('جارٍ فحص الخدمات…', 'Checking services…')
                          : ui.t('حالة النظام غير متاحة', 'System status unavailable')
                        : overall === 'healthy'
                          ? ui.t('جميع الخدمات تعمل بشكل سليم', 'All services operational')
                          : overall === 'unavailable'
                            ? ui.t('بعض الخدمات غير متاحة', 'Some services are unavailable')
                            : ui.t('أداء النظام متدهور', 'System performance degraded')}
                    </div>
                    {health?.checkedAt && (
                      <div className={`text-xs ${MUTED}`}>
                        {ui.t('آخر فحص:', 'Last checked:')}{' '}
                        <span className="font-mono-tabular">
                          {(() => {
                            const d = new Date(health.checkedAt);
                            return isNaN(d.getTime()) ? health.checkedAt : d.toLocaleString();
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {RefreshButton}
                  <button
                    type="button"
                    onClick={() => core.openModal('modal-admin-incident', {})}
                    className="h-9 px-3 rounded-lg bg-[#DC2626] text-white text-xs font-bold cursor-pointer"
                  >
                    {ui.t('تسجيل حادثة', 'Log Incident')}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Service grid */}
          {core.isLoading('health') && !health ? (
            <div className={`${CARD} p-5`}>
              <SkeletonRows />
            </div>
          ) : health && health.services.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {health.services.map((s) => (
                <div key={s.key} className={`p-4 ${CARD} space-y-2`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">{s.name}</div>
                    <Badge tone={serviceTone(s.status)}>{serviceLabel(s.status)}</Badge>
                  </div>
                  {s.details && <div className={`text-[11px] ${MUTED} break-words`}>{s.details}</div>}
                  <div className={`text-[11px] ${MUTED}`}>
                    {ui.t('زمن الاستجابة:', 'Latency:')}{' '}
                    <span className="font-mono-tabular font-bold">{s.latencyMs !== null ? `${s.latencyMs} ms` : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={CARD}>
              <EmptyState text={ui.t('لا توجد بيانات خدمات.', 'No service data.')} />
            </div>
          )}

          {/* Incidents */}
          <div className={`${CARD} p-5 space-y-3`}>
            <h3 className="text-sm font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">
              {ui.t('سجل الحوادث التشغيلية', 'Operational Incident Log')}
            </h3>
            {core.isLoading('incidents') && incidents.length === 0 ? (
              <SkeletonRows rows={3} />
            ) : incidents.length === 0 ? (
              <EmptyState text={ui.t('لا توجد حوادث مسجلة.', 'No incidents logged.')} />
            ) : (
              <div className={DIVIDE}>
                {incidents.map((inc) => (
                  <div key={inc.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">
                        {inc.service} <span className={`font-normal ${MUTED}`}>({inc.type})</span>
                      </div>
                      <div className={MUTED}>{inc.description}</div>
                      <div className={`text-[11px] font-mono-tabular ${MUTED}`}>{inc.createdAt}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge tone={severityTone(inc.severity)}>
                        {inc.severity === 'critical'
                          ? ui.t('حرجة', 'Critical')
                          : inc.severity === 'high'
                            ? ui.t('عالية', 'High')
                            : inc.severity === 'medium'
                              ? ui.t('متوسطة', 'Medium')
                              : ui.t('منخفضة', 'Low')}
                      </Badge>
                      <Badge tone={inc.status === 'Resolved' ? 'green' : inc.status === 'Investigating' ? 'teal' : 'amber'}>
                        {inc.status === 'Resolved'
                          ? ui.t('محلولة', 'Resolved')
                          : inc.status === 'Investigating'
                            ? ui.t('قيد التحقيق', 'Investigating')
                            : ui.t('مفتوحة', 'Open')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
