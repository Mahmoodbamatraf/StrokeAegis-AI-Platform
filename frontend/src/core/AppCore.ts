/*
 * StrokeAegisCore — the single app store, wired to the real FastAPI backend.
 *
 * Rules:
 *  - No simulated clinical data. Every list starts empty and is filled from /api/*.
 *  - Components read with getXxx() and call actions; actions are async and update state + emit().
 *  - Loading flags: isLoading(key). Errors surface as toasts (getToasts()).
 *  - Contract of every endpoint used here: scratchpad api-contract.md (copied to docs/API_CONTRACT.md).
 */
import { api, ApiError, downloadReportPdf, getToken, setSession, setUnauthorizedHandler } from './api';
import {
  fmtTime,
  mapAdminUser,
  mapAssessment,
  mapAudit,
  mapCareDoctor,
  mapCareRequest,
  mapClinician,
  mapCtAnalysis,
  mapCtPreset,
  mapDirectoryDoctor,
  mapDoctorStats,
  mapHealth,
  mapIncident,
  mapMessage,
  mapModel,
  mapNotification,
  mapOverview,
  mapPatient,
  mapPatientOverview,
  mapQualified,
  mapReport,
  mapRequest,
  mapRiskResult,
  mapSafetyItem,
  mapThread,
  mapUser,
  vitalsFromRecord,
} from './mappers';
import {
  AccountStatus,
  AdminOverview,
  AdminTabId,
  AIModelTelemetry,
  AuditLogEntry,
  CareTeamDoctor,
  ChatMessage,
  ChatThread,
  ClinicalAssessmentRecord,
  ClinicalReport,
  ClinicianApprovalRequest,
  ConnectionRequest,
  CrewAgentId,
  CrewAgentState,
  CtAnalysisResult,
  CtSamplePreset,
  CtSelection,
  DoctorDirectoryEntry,
  DoctorStats,
  DoctorTabId,
  Language,
  LuxuryAccent,
  MedicalReport,
  ModalId,
  NotificationItem,
  PatientOverview,
  PatientRecord,
  PatientTabId,
  QualifiedClinician,
  SafetyQueueItem,
  ScreenId,
  ServiceHealth,
  SystemIncident,
  ThemeMode,
  ToastMessage,
  UserProfile,
  UserRole,
  VascularInputProfile,
  VascularRiskResult,
} from './types';

type Listener = () => void;

const THEME_KEY = 'strokeaegis_theme';
const LANG_KEY = 'strokeaegis_lang';

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Seeded demo accounts (scripts/seed_demo_users.py). Same ones the legacy UI used. */
const DEMO_ACCOUNTS: Record<'doctor' | 'patient' | 'admin', { email: string; password: string }> = {
  doctor: { email: 'doctor@strokeaegis.local', password: 'DoctorSecure2026!' },
  patient: { email: 'patient@strokeaegis.local', password: 'PatientSecure2026!' },
  admin: { email: 'admin@strokeaegis.local', password: 'AdminSecure2026!' },
};

/** Form starting values. These are only defaults for input fields, never results. */
export const VITAL_PRESETS: Record<'high' | 'moderate' | 'low', VascularInputProfile> = {
  high: {
    gender: 'Male', age: 67, hypertension: 1, heart_disease: 1, ever_married: 'Yes', work_type: 'Private',
    Residence_type: 'Urban', avg_glucose_level: 228.69, bmi: 36.6, smoking_status: 'formerly smoked',
  },
  moderate: {
    gender: 'Female', age: 55, hypertension: 1, heart_disease: 0, ever_married: 'Yes', work_type: 'Self-employed',
    Residence_type: 'Rural', avg_glucose_level: 140.0, bmi: 29.5, smoking_status: 'never smoked',
  },
  low: {
    gender: 'Female', age: 32, hypertension: 0, heart_disease: 0, ever_married: 'No', work_type: 'Private',
    Residence_type: 'Urban', avg_glucose_level: 88.0, bmi: 22.4, smoking_status: 'never smoked',
  },
};

const AGENT_DEFS: Record<CrewAgentId, { nameEn: string; nameAr: string; roleEn: string; roleAr: string }> = {
  models: {
    nameEn: 'Clinical models', nameAr: 'النماذج السريرية',
    roleEn: 'ML risk · ConvNeXt CT gate · EfficientNetV2 classifier', roleAr: 'نموذج الخطر · بوابة الأشعة · مصنّف الأشعة',
  },
  prevention: {
    nameEn: 'Prevention agent', nameAr: 'وكيل الوقاية',
    roleEn: 'Secondary-prevention plan from guidelines', roleAr: 'خطة الوقاية حسب الإرشادات الطبية',
  },
  emergency: {
    nameEn: 'Emergency agent', nameAr: 'وكيل الطوارئ',
    roleEn: 'Acute stroke management considerations', roleAr: 'اعتبارات التعامل مع السكتة الحادة',
  },
  validation: {
    nameEn: 'Validation agent', nameAr: 'وكيل التحقق',
    roleEn: 'Safety and consistency audit', roleAr: 'تدقيق السلامة والاتساق',
  },
  report: {
    nameEn: 'Report agent', nameAr: 'وكيل التقرير',
    roleEn: 'Final clinical report and PDF', roleAr: 'التقرير السريري النهائي وملف PDF',
  },
};
const AGENT_ORDER: CrewAgentId[] = ['models', 'prevention', 'emergency', 'validation', 'report'];

function freshAgents(withCt: boolean): CrewAgentState[] {
  return AGENT_ORDER.map((id) => ({
    id,
    ...AGENT_DEFS[id],
    status: 'queued',
    progress: 0,
    outputEn: id === 'models' && !withCt ? 'Risk model only (no CT image attached).' : '',
    outputAr: id === 'models' && !withCt ? 'نموذج الخطر فقط (بدون صورة أشعة).' : '',
  }));
}

export class ThemeAndLocaleController {
  private theme: ThemeMode;
  private accent: LuxuryAccent = 'clinical-teal';
  private language: Language;
  private notify: () => void;

  constructor(notify: () => void) {
    this.notify = notify;
    this.theme = readPref(THEME_KEY) === 'dark' ? 'dark' : 'light';
    this.language = readPref(LANG_KEY) === 'en' ? 'en' : 'ar';
    this.syncDom();
  }

  public getTheme(): ThemeMode {
    return this.theme;
  }
  public getAccent(): LuxuryAccent {
    return this.accent;
  }
  public getLanguage(): Language {
    return this.language;
  }
  public setTheme(mode: ThemeMode): void {
    this.theme = mode;
    writePref(THEME_KEY, mode);
    this.syncDom();
    this.notify();
  }
  public toggleTheme(): void {
    this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
  }
  public setAccent(accent: LuxuryAccent): void {
    this.accent = accent;
    this.syncDom();
    this.notify();
  }
  public setLanguage(lang: Language): void {
    this.language = lang;
    writePref(LANG_KEY, lang);
    this.syncDom();
    this.notify();
  }
  public toggleLanguage(): void {
    this.setLanguage(this.language === 'ar' ? 'en' : 'ar');
  }
  public t(arText: string, enText: string): string {
    return this.language === 'ar' ? arText : enText;
  }

  private syncDom(): void {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    html.lang = this.language;
    html.dir = this.language === 'ar' ? 'rtl' : 'ltr';
    html.classList.toggle('dark', this.theme === 'dark');
    html.setAttribute('data-theme', this.theme);
    html.setAttribute('data-accent', this.accent);
  }
}

export class StrokeAegisCore {
  private static instance: StrokeAegisCore | null = null;
  private listeners: Set<Listener> = new Set();

  public readonly ui: ThemeAndLocaleController;

  // ---------- navigation ----------
  private currentScreen: ScreenId = 'screen-landing';
  private doctorTab: DoctorTabId = 'doc-pane-patients';
  private patientTab: PatientTabId = 'pat-pane-selfcheck';
  private adminTab: AdminTabId = 'admin-pane-overview';
  private activeModal: ModalId = null;
  private modalContext: Record<string, unknown> = {};
  private lastNavDirection: 'next' | 'prev' = 'next';

  // ---------- session ----------
  private currentUser: UserProfile | null = null;
  private sessionChecked = false;

  // ---------- async status ----------
  private loading: Set<string> = new Set();
  private toasts: ToastMessage[] = [];
  private toastSeq = 1;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  // ---------- shared catalog ----------
  private ctPresets: CtSamplePreset[] = [];
  private presetsLoaded = false;

  // ---------- doctor ----------
  private doctorStats: DoctorStats | null = null;
  private patients: PatientRecord[] = [];
  private doctorRequests: { incoming: ConnectionRequest[]; outgoing: ConnectionRequest[] } = { incoming: [], outgoing: [] };
  private reports: ClinicalReport[] = [];

  // ---------- patient ----------
  private patientOverview: PatientOverview | null = null;
  private assessmentHistory: ClinicalAssessmentRecord[] = [];
  private careTeam: {
    primary: CareTeamDoctor | null;
    team: CareTeamDoctor[];
    incoming: ConnectionRequest[];
    outgoing: ConnectionRequest[];
  } = { primary: null, team: [], incoming: [], outgoing: [] };
  private doctorDirectory: DoctorDirectoryEntry[] = [];

  // ---------- chat (both roles) ----------
  private chatThreads: ChatThread[] = [];
  private activeConversationId: string | null = null;

  // ---------- notifications ----------
  private notifications: NotificationItem[] = [];
  private unreadNotifications = 0;

  // ---------- admin ----------
  private adminOverview: AdminOverview | null = null;
  private clinicianApprovals: ClinicianApprovalRequest[] = [];
  private clinicianFilter: { status: string; search: string } = { status: 'all', search: '' };
  private safetyQueue: SafetyQueueItem[] = [];
  private safetyFilter = 'all';
  private qualifiedClinicians: QualifiedClinician[] = [];
  private usersDirectory: UserProfile[] = [];
  private usersFilter: { role: string; search: string } = { role: 'all', search: '' };
  private aiModels: AIModelTelemetry[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private auditSearch = '';
  private health: { overall: string; services: ServiceHealth[]; checkedAt: string } | null = null;
  private incidents: SystemIncident[] = [];

  // ---------- AI wizard (4 steps) ----------
  private wizardStep: 1 | 2 | 3 | 4 = 1;
  private wizardTargetPatientId: string | null = null;
  private wizardVascularInput: VascularInputProfile = { ...VITAL_PRESETS.high };
  private wizardVascularResult: VascularRiskResult | null = null;
  private wizardCt: CtSelection | null = null;
  private wizardCtFile: Blob | null = null;
  private wizardAgents: CrewAgentState[] = freshAgents(false);
  private wizardActivityLogs: string[] = [];
  private wizardRunning = false;
  private wizardError: string | null = null;
  private wizardPipelineId: string | null = null;
  private wizardReport: MedicalReport | null = null;
  private wizardCtResult: CtAnalysisResult | null = null;
  private wizardEventSource: EventSource | null = null;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;

  // ---------- regular system ----------
  private regularPath: 'path-a' | 'path-b' = 'path-a';
  private regularVascularInput: VascularInputProfile = { ...VITAL_PRESETS.moderate };
  private regularVascularResult: VascularRiskResult | null = null;
  private regularCt: CtSelection | null = null;
  private regularCtResult: CtAnalysisResult | null = null;
  private regularCtRejectMessage: string | null = null;

  // ---------- patient self-check ----------
  private selfCheckInput: VascularInputProfile = { ...VITAL_PRESETS.moderate };
  private latestSelfCheckResult: VascularRiskResult | null = null;

  // ---------- chatbot ----------
  private chatbotMessages: ChatMessage[] = [];
  private chatbotConversationId: string | null = null;

  private constructor() {
    this.ui = new ThemeAndLocaleController(() => this.emit());
    setUnauthorizedHandler(() => this.handleSessionExpired());
    this.chatbotMessages = [this.chatbotWelcome()];
    void this.restoreSession();
  }

  public static getInstance(): StrokeAegisCore {
    if (!StrokeAegisCore.instance) StrokeAegisCore.instance = new StrokeAegisCore();
    return StrokeAegisCore.instance;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  // =====================================================================
  // generic helpers
  // =====================================================================
  public isLoading(key: string): boolean {
    return this.loading.has(key);
  }
  public isSessionChecked(): boolean {
    return this.sessionChecked;
  }

  private async run<T>(key: string, fn: () => Promise<T>, opts: { silent?: boolean } = {}): Promise<T | null> {
    this.loading.add(key);
    this.emit();
    try {
      return await fn();
    } catch (e) {
      if (!opts.silent && !(e instanceof ApiError && e.status === 401)) {
        const msg = e instanceof Error ? e.message : String(e);
        this.toast('error', msg, msg);
      }
      return null;
    } finally {
      this.loading.delete(key);
      this.emit();
    }
  }

  public getToasts(): ToastMessage[] {
    return this.toasts;
  }
  public toast(kind: ToastMessage['kind'], textAr: string, textEn: string): void {
    const id = this.toastSeq++;
    this.toasts = [...this.toasts, { id, kind, textAr, textEn }];
    this.emit();
    setTimeout(() => this.dismissToast(id), kind === 'error' ? 7000 : 4000);
  }
  public dismissToast(id: number): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.emit();
  }

  // =====================================================================
  // getters
  // =====================================================================
  public getScreen(): ScreenId {
    return this.currentScreen;
  }
  public getDoctorTab(): DoctorTabId {
    return this.doctorTab;
  }
  public getPatientTab(): PatientTabId {
    return this.patientTab;
  }
  public getAdminTab(): AdminTabId {
    return this.adminTab;
  }
  public getActiveModal(): ModalId {
    return this.activeModal;
  }
  public getModalContext(): Record<string, unknown> {
    return this.modalContext;
  }
  public getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }
  public getCtPresets(): CtSamplePreset[] {
    return this.ctPresets;
  }
  public getDoctorStats(): DoctorStats | null {
    return this.doctorStats;
  }
  public getPatients(): PatientRecord[] {
    return this.patients;
  }
  public getDoctorRequests() {
    return this.doctorRequests;
  }
  public getReports(): ClinicalReport[] {
    return this.reports;
  }
  /** Patient: own assessments. Doctor: the history loaded by openPatientHistory(). */
  public getAssessmentHistory(patientId?: string): ClinicalAssessmentRecord[] {
    if (!patientId) return this.assessmentHistory;
    return this.assessmentHistory.filter((a) => a.patientId === patientId);
  }
  public getPatientOverview(): PatientOverview | null {
    return this.patientOverview;
  }
  public getCareTeam() {
    return this.careTeam;
  }
  public getDoctorDirectory(): DoctorDirectoryEntry[] {
    return this.doctorDirectory;
  }
  public getChatThreads(): ChatThread[] {
    return this.chatThreads;
  }
  public getActiveConversationId(): string | null {
    return this.activeConversationId;
  }
  public getNotifications(): NotificationItem[] {
    return this.notifications;
  }
  public getUnreadNotificationCount(): number {
    return this.unreadNotifications;
  }
  public getAdminOverview(): AdminOverview | null {
    return this.adminOverview;
  }
  public getClinicianApprovals(): ClinicianApprovalRequest[] {
    return this.clinicianApprovals;
  }
  public getClinicianFilter() {
    return this.clinicianFilter;
  }
  public getSafetyQueue(): SafetyQueueItem[] {
    return this.safetyQueue;
  }
  public getSafetyFilter(): string {
    return this.safetyFilter;
  }
  public getQualifiedClinicians(): QualifiedClinician[] {
    return this.qualifiedClinicians;
  }
  public getUsersDirectory(): UserProfile[] {
    return this.usersDirectory;
  }
  public getUsersFilter() {
    return this.usersFilter;
  }
  public getAIModels(): AIModelTelemetry[] {
    return this.aiModels;
  }
  public getAuditLogs(): AuditLogEntry[] {
    return this.auditLogs;
  }
  public getAuditSearch(): string {
    return this.auditSearch;
  }
  public getHealth() {
    return this.health;
  }
  public getIncidents(): SystemIncident[] {
    return this.incidents;
  }
  public getChatbotMessages(): ChatMessage[] {
    return this.chatbotMessages;
  }

  // =====================================================================
  // navigation
  // =====================================================================
  public getLastNavDirection(): 'next' | 'prev' {
    return this.lastNavDirection;
  }

  public getSwipeableScreens(): { id: ScreenId; labelAr: string; labelEn: string }[] {
    const u = this.currentUser;
    const roleScreen: { id: ScreenId; labelAr: string; labelEn: string } =
      u?.role === 'doctor'
        ? { id: 'screen-doctor-portal', labelAr: 'بوابة الطبيب', labelEn: 'Doctor Portal' }
        : u?.role === 'patient'
          ? { id: 'screen-patient-portal', labelAr: 'بوابة المريض', labelEn: 'Patient Portal' }
          : u?.role === 'admin'
            ? { id: 'screen-admin-dashboard', labelAr: 'لوحة الحوكمة', labelEn: 'Admin Governance' }
            : { id: 'screen-landing', labelAr: 'الرئيسية والدخول', labelEn: 'Home & Sign In' };
    return [
      roleScreen,
      { id: 'screen-home', labelAr: 'بوابات التحليل', labelEn: 'Analysis Suite' },
      { id: 'screen-ai-system', labelAr: 'معالج الذكاء الاصطناعي', labelEn: '4-Step AI Wizard' },
      { id: 'screen-regular-system', labelAr: 'النماذج المباشرة', labelEn: 'Live Models' },
    ];
  }

  public navigate(screen: ScreenId): void {
    const deck = this.getSwipeableScreens().map((s) => s.id);
    const oldIdx = deck.indexOf(this.currentScreen);
    const newIdx = deck.indexOf(screen);
    if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
      this.lastNavDirection = newIdx > oldIdx ? 'next' : 'prev';
    }
    this.currentScreen = screen;
    this.activeModal = null;
    this.emit();
    this.onScreenEnter(screen);
  }

  public swipeAdjacentScreen(direction: 'next' | 'prev'): ScreenId {
    const deck = this.getSwipeableScreens();
    const currentIdx = deck.findIndex((s) => s.id === this.currentScreen);
    const baseIdx = currentIdx === -1 ? 0 : currentIdx;
    const targetIdx = direction === 'next' ? (baseIdx + 1) % deck.length : (baseIdx - 1 + deck.length) % deck.length;
    this.lastNavDirection = direction;
    this.navigate(deck[targetIdx].id);
    return this.currentScreen;
  }

  /** Lazy loading: each screen/tab fetches what it shows. */
  private onScreenEnter(screen: ScreenId): void {
    const role = this.currentUser?.role;
    if (screen === 'screen-doctor-portal' && role === 'doctor') {
      void this.loadDoctorStats();
      this.onDoctorTab(this.doctorTab);
    } else if (screen === 'screen-patient-portal' && role === 'patient') {
      void this.loadPatientOverview();
      this.onPatientTab(this.patientTab);
    } else if (screen === 'screen-admin-dashboard' && role === 'admin') {
      this.onAdminTab(this.adminTab);
    } else if (screen === 'screen-ai-system' || screen === 'screen-regular-system') {
      void this.loadPresets();
      if (screen === 'screen-ai-system' && role === 'doctor' && this.patients.length === 0) void this.loadDoctorPatients();
    }
  }

  public setDoctorTab(tab: DoctorTabId): void {
    this.doctorTab = tab;
    this.emit();
    this.onDoctorTab(tab);
  }
  private onDoctorTab(tab: DoctorTabId): void {
    if (tab === 'doc-pane-patients') {
      void this.loadDoctorPatients();
      void this.loadDoctorRequests();
    } else if (tab === 'doc-pane-reports') void this.loadDoctorReports();
    else if (tab === 'doc-pane-chat') void this.loadConversations();
  }

  public setPatientTab(tab: PatientTabId): void {
    this.patientTab = tab;
    this.emit();
    this.onPatientTab(tab);
  }
  private onPatientTab(tab: PatientTabId): void {
    if (tab === 'pat-pane-results') void this.loadPatientAssessments();
    else if (tab === 'pat-pane-reports') void this.loadPatientReports();
    else if (tab === 'pat-pane-doctor') void this.loadCareTeam();
    else if (tab === 'pat-pane-chat') void this.loadConversations();
  }

  public setAdminTab(tab: AdminTabId): void {
    this.adminTab = tab;
    this.emit();
    this.onAdminTab(tab);
  }
  private onAdminTab(tab: AdminTabId): void {
    switch (tab) {
      case 'admin-pane-overview':
        void this.loadAdminOverview();
        break;
      case 'admin-pane-approvals':
        void this.loadClinicians();
        break;
      case 'admin-pane-safety':
        void this.loadSafetyQueue();
        break;
      case 'admin-pane-users':
        void this.loadUsers();
        break;
      case 'admin-pane-models':
        void this.loadModels();
        break;
      case 'admin-pane-audit':
        void this.loadAuditLogs();
        break;
      case 'admin-pane-health':
        void this.loadHealth();
        break;
    }
  }

  public openModal(modal: ModalId, context: Record<string, unknown> = {}): void {
    this.activeModal = modal;
    this.modalContext = context;
    this.emit();
    if (modal === 'modal-notifications-drawer') void this.loadNotifications();
    if (modal === 'modal-find-doctor') void this.loadDoctorDirectory();
    if (modal === 'modal-admin-safety-assign') void this.loadQualifiedClinicians();
  }
  public closeModal(): void {
    this.activeModal = null;
    this.modalContext = {};
    this.emit();
  }
  /** Merge into the open modal's context (e.g. data that arrived after opening). */
  private patchModalContext(patch: Record<string, unknown>): void {
    this.modalContext = { ...this.modalContext, ...patch };
    this.emit();
  }

  // =====================================================================
  // auth
  // =====================================================================
  private homeScreenFor(user: UserProfile): ScreenId {
    if (user.role === 'admin') return 'screen-admin-dashboard';
    if (user.role === 'doctor') {
      if (user.status === 'pending' || user.status === 'info_requested') return 'screen-doctor-pending';
      if (user.status === 'suspended' || user.status === 'rejected' || !user.isActive) return 'screen-restricted-access';
      return 'screen-doctor-portal';
    }
    if (user.role === 'patient') return user.isActive ? 'screen-patient-portal' : 'screen-restricted-access';
    return 'screen-home';
  }

  private async restoreSession(): Promise<void> {
    if (!getToken()) {
      this.sessionChecked = true;
      this.emit();
      return;
    }
    try {
      const me = await api.get('/api/auth/me', undefined, false);
      this.startSession(mapUser(me), me);
    } catch {
      setSession(null);
      this.currentUser = null;
    } finally {
      this.sessionChecked = true;
      this.emit();
    }
  }

  private startSession(user: UserProfile, raw: unknown): void {
    this.currentUser = user;
    setSession(getToken(), raw);
    this.resetPortalData();
    this.navigate(this.homeScreenFor(user));
    this.startPolling();
    void this.loadNotifications();
  }

  /** Real login. Returns an error message (for the form) or null on success. */
  public async login(email: string, password: string): Promise<string | null> {
    this.loading.add('auth');
    this.emit();
    try {
      const tok: any = await api.post('/api/auth/login', { email: email.trim().toLowerCase(), password }, false);
      setSession(tok.access_token, tok);
      // /me carries profile details (license, rejection reason...) that the login response lacks
      let raw: any = tok;
      try {
        raw = await api.get('/api/auth/me');
      } catch {
        /* fall back to token payload */
      }
      this.startSession(mapUser(raw), raw);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    } finally {
      this.loading.delete('auth');
      this.emit();
    }
  }

  /** Kept for the landing "demo" buttons: logs in with the seeded demo accounts. */
  public loginDemo(role: 'doctor' | 'patient' | 'admin' | 'pending_doctor' | 'restricted'): void {
    if (role === 'pending_doctor' || role === 'restricted') return; // no seeded accounts for these states
    const acc = DEMO_ACCOUNTS[role];
    void this.login(acc.email, acc.password).then((err) => {
      if (err) this.toast('error', `تعذّر دخول الحساب التجريبي: ${err}`, `Demo sign-in failed: ${err}`);
    });
  }

  /** Legacy name used by the landing form. */
  public loginWithCredentials(email: string, password: string): Promise<string | null> {
    return this.login(email, password);
  }

  public async registerAccount(payload: {
    role: 'doctor' | 'patient';
    name: string;
    email: string;
    password: string;
    licenseNumber?: string;
    specialty?: string;
    hospital?: string;
    phone?: string;
    dob?: string;
    gender?: 'Male' | 'Female' | 'Other';
    emergencyContact?: string;
  }): Promise<string | null> {
    this.loading.add('auth');
    this.emit();
    try {
      const body: Record<string, unknown> = {
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        full_name: payload.name.trim(),
      };
      let path = '/api/auth/register/patient';
      if (payload.role === 'doctor') {
        path = '/api/auth/register/doctor';
        body.license_number = payload.licenseNumber?.trim();
        if (payload.specialty) body.specialization = payload.specialty;
        if (payload.hospital) body.hospital_affiliation = payload.hospital;
        if (payload.phone) body.contact_phone = payload.phone;
      } else {
        if (payload.dob) body.date_of_birth = payload.dob;
        if (payload.gender) body.gender = payload.gender;
        if (payload.emergencyContact) body.emergency_contact = payload.emergencyContact;
      }
      const tok: any = await api.post(path, body, false);
      setSession(tok.access_token, tok);
      let raw: any = tok;
      try {
        raw = await api.get('/api/auth/me');
      } catch {
        /* ignore */
      }
      this.startSession(mapUser(raw), raw);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    } finally {
      this.loading.delete('auth');
      this.emit();
    }
  }

  /** Pending-doctor screen: re-check approval status. */
  public async refreshAccountStatus(): Promise<void> {
    const me = await this.run('me', () => api.get('/api/auth/me'));
    if (!me) return;
    const user = mapUser(me);
    this.currentUser = user;
    setSession(getToken(), me);
    const next = this.homeScreenFor(user);
    if (next === this.currentScreen) {
      this.toast('info', 'حسابك ما زال قيد المراجعة.', 'Your account is still under review.');
      this.emit();
    } else {
      this.navigate(next);
    }
  }

  public async submitDoctorClarification(license: string, hospital: string, note: string): Promise<boolean> {
    const body: Record<string, unknown> = { clarification_notes: note.trim() };
    if (license.trim()) body.license_number = license.trim();
    if (hospital.trim()) body.hospital_affiliation = hospital.trim();
    const me = await this.run('resubmit', () => api.post('/api/auth/doctor/resubmit-info', body));
    if (!me) return false;
    this.currentUser = mapUser(me);
    setSession(getToken(), me);
    this.toast('success', 'تم إرسال التوضيح للإدارة.', 'Clarification sent to the administrators.');
    return true;
  }

  public logout(): void {
    setSession(null);
    this.stopPolling();
    this.closeEventSource();
    this.currentUser = null;
    this.resetPortalData();
    this.currentScreen = 'screen-landing';
    this.activeModal = null;
    this.emit();
  }

  private handleSessionExpired(): void {
    if (!this.currentUser) return;
    this.logout();
    this.toast('error', 'انتهت الجلسة. سجّل دخولك مرة ثانية.', 'Your session has expired. Please sign in again.');
  }

  private resetPortalData(): void {
    this.doctorStats = null;
    this.patients = [];
    this.doctorRequests = { incoming: [], outgoing: [] };
    this.reports = [];
    this.patientOverview = null;
    this.assessmentHistory = [];
    this.careTeam = { primary: null, team: [], incoming: [], outgoing: [] };
    this.doctorDirectory = [];
    this.chatThreads = [];
    this.activeConversationId = null;
    this.notifications = [];
    this.unreadNotifications = 0;
    this.adminOverview = null;
    this.clinicianApprovals = [];
    this.safetyQueue = [];
    this.usersDirectory = [];
    this.aiModels = [];
    this.auditLogs = [];
    this.health = null;
    this.incidents = [];
    this.latestSelfCheckResult = null;
  }

  // ---------- polling: notifications + open chat ----------
  private startPolling(): void {
    this.stopPolling();
    let tick = 0;
    this.pollTimer = setInterval(() => {
      if (!this.currentUser) return;
      tick++;
      const chatOpen =
        this.activeConversationId &&
        ((this.currentScreen === 'screen-doctor-portal' && this.doctorTab === 'doc-pane-chat') ||
          (this.currentScreen === 'screen-patient-portal' && this.patientTab === 'pat-pane-chat'));
      if (chatOpen) void this.refreshMessages(this.activeConversationId!, true);
      if (tick % 3 === 0) void this.loadNotifications(true);
    }, 4000);
  }
  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  // =====================================================================
  // shared loaders
  // =====================================================================
  public async loadPresets(): Promise<void> {
    if (this.presetsLoaded) return;
    const data: any = await this.run('presets', () => api.get('/api/presets', undefined, false));
    if (!data) return;
    this.ctPresets = (data.ct_presets || []).map(mapCtPreset);
    this.presetsLoaded = true;
    this.emit();
  }

  public async loadNotifications(silent = false): Promise<void> {
    const data: any = await this.run('notifications', () => api.get('/api/clinical-portal/notifications'), { silent });
    if (!data) return;
    this.notifications = (data.notifications || []).map(mapNotification);
    this.unreadNotifications = Number(data.unread_count) || this.notifications.filter((n) => !n.read).length;
    this.emit();
  }

  public async markNotificationRead(id: string): Promise<void> {
    const ok = await this.run('notif-read', () => api.post(`/api/clinical-portal/notifications/${id}/read`), { silent: true });
    if (ok === null) return;
    this.notifications = this.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    this.unreadNotifications = Math.max(0, this.unreadNotifications - 1);
    this.emit();
  }

  public async markAllNotificationsRead(): Promise<void> {
    const ok = await this.run('notif-read', () => api.post('/api/clinical-portal/notifications/read-all'));
    if (ok === null) return;
    this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
    this.unreadNotifications = 0;
    this.emit();
  }

  public async downloadReport(reportId: string, filename: string | null): Promise<void> {
    await this.run(`download-${reportId}`, () => downloadReportPdf(reportId, filename));
  }

  // =====================================================================
  // doctor portal
  // =====================================================================
  public async loadDoctorStats(): Promise<void> {
    const data = await this.run('doctor-stats', () => api.get('/api/clinical-portal/doctor/stats'));
    if (data) {
      this.doctorStats = mapDoctorStats(data);
      this.emit();
    }
  }

  public async loadDoctorPatients(): Promise<void> {
    const data: any = await this.run('patients', () => api.get('/api/clinical-portal/doctor/patients'));
    if (data) {
      this.patients = (data.patients || []).map(mapPatient);
      this.emit();
    }
  }

  public async loadDoctorRequests(): Promise<void> {
    const data: any = await this.run('doctor-requests', () => api.get('/api/clinical-portal/doctor/requests'), { silent: true });
    if (data) {
      this.doctorRequests = {
        incoming: (data.incoming || []).map(mapRequest),
        outgoing: (data.outgoing || []).map(mapRequest),
      };
      this.emit();
    }
  }

  /**
   * "Admit patient": the backend links an EXISTING registered patient by email (sends them a request).
   * name/age/gender are accepted for the old signature but not sent (backend has no such endpoint).
   */
  public async admitPatient(_name: string, email: string): Promise<boolean> {
    const data: any = await this.run('admit', () => api.post('/api/clinical-portal/doctor/patients/request', { email: email.trim() }));
    if (!data) return false;
    this.toast('success', `تم إرسال طلب الربط إلى ${data.patient_name || email}.`, data.message || 'Request sent.');
    this.closeModal();
    void this.loadDoctorRequests();
    return true;
  }
  public requestPatientByEmail(email: string): Promise<boolean> {
    return this.admitPatient('', email);
  }

  public async acceptConnection(relationshipId: string): Promise<void> {
    const data: any = await this.run(`rel-${relationshipId}`, () => api.post(`/api/clinical-portal/relationships/${relationshipId}/accept`));
    if (!data) return;
    this.toast('success', 'تم قبول الطلب.', data.message || 'Request accepted.');
    this.refreshAfterRelationshipChange();
  }
  public async declineConnection(relationshipId: string): Promise<void> {
    const data: any = await this.run(`rel-${relationshipId}`, () => api.post(`/api/clinical-portal/relationships/${relationshipId}/decline`));
    if (!data) return;
    this.toast('info', 'تم رفض الطلب.', data.message || 'Request declined.');
    this.refreshAfterRelationshipChange();
  }
  private refreshAfterRelationshipChange(): void {
    if (this.currentUser?.role === 'doctor') {
      void this.loadDoctorPatients();
      void this.loadDoctorRequests();
      void this.loadDoctorStats();
    } else {
      void this.loadCareTeam();
      void this.loadPatientOverview();
    }
  }

  /** Opens the history modal and loads assessments + reports for one patient. */
  public async openPatientHistory(patientId: string): Promise<void> {
    this.openModal('modal-patient-history', { patientId, loading: true });
    const data: any = await this.run('history', () => api.get(`/api/clinical-portal/doctor/patients/${patientId}/history`));
    if (!data) {
      this.patchModalContext({ loading: false });
      return;
    }
    const p = data.patient || {};
    const name = p.full_name || p.email || '';
    const assessments = (data.assessments || []).map((a: any) => mapAssessment(a, patientId, name));
    const reports = (data.reports || []).map((r: any) =>
      mapReport(r, { patientId, patientName: name, mrn: p.mrn })
    );
    this.assessmentHistory = [...this.assessmentHistory.filter((a) => a.patientId !== patientId), ...assessments];
    this.patchModalContext({ loading: false, patient: p, assessments, reports });
  }

  public async loadDoctorReports(): Promise<void> {
    const data: any = await this.run('reports', () => api.get('/api/clinical-portal/doctor/reports'));
    if (data) {
      this.reports = (data.reports || []).map((r: any) => mapReport(r));
      this.emit();
    }
  }

  public async signReport(reportId: string): Promise<void> {
    const data: any = await this.run(`sign-${reportId}`, () => api.post(`/api/clinical-portal/doctor/reports/${reportId}/sign-off`));
    if (!data) return;
    this.reports = this.reports.map((r) =>
      r.id === reportId ? { ...r, signedStatus: 'Signed & Approved' } : r
    );
    this.toast('success', 'تم اعتماد التقرير وتوقيعه.', 'Report signed off.');
    void this.loadDoctorStats();
  }

  // =====================================================================
  // chat (doctor ↔ patient)
  // =====================================================================
  public async loadConversations(): Promise<void> {
    const data: any = await this.run('conversations', () => api.get('/api/clinical-portal/conversations'));
    if (!data) return;
    const old = new Map(this.chatThreads.map((t) => [t.conversationId, t.messages]));
    this.chatThreads = (data.conversations || []).map((c: any) => {
      const t = mapThread(c);
      t.messages = old.get(t.conversationId) || [];
      return t;
    });
    if (!this.activeConversationId && this.chatThreads[0]) this.activeConversationId = this.chatThreads[0].conversationId;
    this.emit();
    if (this.activeConversationId) void this.refreshMessages(this.activeConversationId);
  }

  /** `id` may be a conversation id or a counterparty (patient/doctor) user id. */
  public openConversation(id: string): void {
    const t = this.chatThreads.find((x) => x.conversationId === id || x.patientId === id);
    this.activeConversationId = t ? t.conversationId : id;
    this.emit();
    void this.refreshMessages(this.activeConversationId);
  }

  private async refreshMessages(conversationId: string, silent = false): Promise<void> {
    const data: any = await this.run(`messages-${conversationId}`, () =>
      api.get(`/api/clinical-portal/conversations/${conversationId}/messages`), { silent }
    );
    if (!data || !this.currentUser) return;
    const cp = data.counterparty || {};
    const me = { id: this.currentUser.id, role: this.currentUser.role, name: this.currentUser.name };
    const other = { id: String(cp.id || ''), role: (cp.role || 'patient') as UserRole, name: String(cp.full_name || '') };
    const msgs = (data.messages || []).map((m: any) => mapMessage(m, me, other));
    this.chatThreads = this.chatThreads.map((t) =>
      t.conversationId === conversationId ? { ...t, messages: msgs, unreadCount: 0 } : t
    );
    this.emit();
  }

  /**
   * Send a chat message. First arg may be the conversation id or the counterparty id
   * (legacy components pass the patient id). `senderRole` is ignored: the server knows who you are.
   */
  public async sendChatMessage(target: string, text: string, _senderRole?: 'doctor' | 'patient'): Promise<void> {
    const content = text.trim();
    if (!content) return;
    const thread = this.chatThreads.find((t) => t.conversationId === target || t.patientId === target);
    const conversationId = thread?.conversationId || target;
    const data: any = await this.run('send-message', () =>
      api.post(`/api/clinical-portal/conversations/${conversationId}/messages`, { content })
    );
    if (!data || !this.currentUser) return;
    const m = data.message || {};
    const msg: ChatMessage = {
      id: String(m.id),
      senderId: this.currentUser.id,
      senderRole: this.currentUser.role,
      senderName: this.currentUser.name,
      senderNameAr: this.currentUser.nameAr,
      text: String(m.content ?? content),
      timestamp: fmtTime(m.created_at) || fmtTime(new Date().toISOString()),
      isMine: true,
    };
    this.chatThreads = this.chatThreads.map((t) =>
      t.conversationId === conversationId
        ? { ...t, messages: [...t.messages, msg], lastMessage: msg.text, lastUpdated: msg.timestamp }
        : t
    );
    this.emit();
  }

  // =====================================================================
  // patient portal
  // =====================================================================
  public async loadPatientOverview(): Promise<void> {
    const data: any = await this.run('patient-overview', () => api.get('/api/clinical-portal/patient/overview'));
    if (data) {
      this.patientOverview = mapPatientOverview(data);
      this.emit();
    }
  }

  public async loadPatientAssessments(): Promise<void> {
    const data: any = await this.run('assessments', () => api.get('/api/clinical-portal/patient/assessments'));
    if (!data || !this.currentUser) return;
    const u = this.currentUser;
    this.assessmentHistory = (data.assessments || []).map((a: any) => mapAssessment(a, u.id, u.name));
    this.emit();
  }

  public async loadPatientReports(): Promise<void> {
    const data: any = await this.run('reports', () => api.get('/api/clinical-portal/patient/reports'));
    if (!data || !this.currentUser) return;
    const u = this.currentUser;
    this.reports = (data.reports || []).map((r: any) =>
      mapReport(r, { patientId: u.id, patientName: u.name, mrn: u.mrn })
    );
    this.emit();
  }

  public async loadCareTeam(): Promise<void> {
    const data: any = await this.run('care-team', () => api.get('/api/clinical-portal/patient/care-team'));
    if (!data) return;
    this.careTeam = {
      primary: data.primary_doctor ? mapCareDoctor(data.primary_doctor) : null,
      team: (data.care_team || []).map(mapCareDoctor),
      incoming: (data.incoming_requests || []).map(mapCareRequest),
      outgoing: (data.outgoing_requests || []).map(mapCareRequest),
    };
    this.emit();
  }

  public async loadDoctorDirectory(): Promise<void> {
    const data: any = await this.run('doctor-directory', () => api.get('/api/clinical-portal/patient/search-doctors'));
    if (data) {
      this.doctorDirectory = (data.doctors || []).map(mapDirectoryDoctor);
      this.emit();
    }
  }

  public async requestDoctor(doctorId: string): Promise<void> {
    const data: any = await this.run(`req-doc-${doctorId}`, () =>
      api.post('/api/clinical-portal/patient/request-doctor', { doctor_id: doctorId })
    );
    if (!data) return;
    this.toast('success', 'تم إرسال طلبك للطبيب.', data.message || 'Request sent to the doctor.');
    void this.loadDoctorDirectory();
    void this.loadCareTeam();
  }

  public getSelfCheckState() {
    return {
      input: this.selfCheckInput,
      latestResult: this.latestSelfCheckResult,
      running: this.isLoading('self-check'),
    };
  }

  public updateSelfCheckField<K extends keyof VascularInputProfile>(field: K, value: VascularInputProfile[K]): void {
    this.selfCheckInput = { ...this.selfCheckInput, [field]: value };
    this.emit();
  }

  public applySelfCheckPreset(preset: 'high' | 'moderate' | 'low'): void {
    this.selfCheckInput = { ...VITAL_PRESETS[preset] };
    this.emit();
  }

  /** Real ML risk model via /patient/quick-risk (also stores an assessment + notifies the doctor). */
  public async runPatientSelfCheck(): Promise<VascularRiskResult | null> {
    const data: any = await this.run('self-check', () =>
      api.post('/api/clinical-portal/patient/quick-risk', { ...this.selfCheckInput })
    );
    if (!data) return null;
    const result = mapRiskResult(data.result || {});
    this.latestSelfCheckResult = result;
    this.openModal('modal-selfcheck-result', { result, assessmentId: data.assessment_id });
    void this.loadPatientOverview();
    return result;
  }

  // =====================================================================
  // CT image selection helpers
  // =====================================================================
  private async selectionFromPreset(presetId: string): Promise<{ sel: CtSelection; blob: Blob } | null> {
    await this.loadPresets();
    const p = this.ctPresets.find((x) => x.id === presetId);
    if (!p) return null;
    const blob = await this.run('ct-preset', async () => (await fetch(p.previewUrl)).blob());
    if (!blob) return null;
    return { sel: { source: 'preset', presetId: p.id, fileName: `${p.id}.png`, previewUrl: p.previewUrl }, blob };
  }
  private selectionFromFile(file: File): CtSelection {
    return { source: 'upload', presetId: null, fileName: file.name, previewUrl: URL.createObjectURL(file) };
  }

  // =====================================================================
  // AI wizard (4 steps): vitals → CT → live agents (SSE) → decision package
  // =====================================================================
  public getWizardState() {
    return {
      step: this.wizardStep,
      targetPatientId: this.wizardTargetPatientId,
      targetPatient: this.patients.find((p) => p.id === this.wizardTargetPatientId) || null,
      vascularInput: this.wizardVascularInput,
      /** Live preview from the real ML model (null until the first response). */
      vascularResult: this.wizardVascularResult,
      previewLoading: this.isLoading('wizard-preview'),
      ct: this.wizardCt,
      /** Kept for older components: preset id or 'upload'. */
      selectedCtId: this.wizardCt?.presetId || (this.wizardCt ? 'upload' : null),
      customCtName: this.wizardCt?.source === 'upload' ? this.wizardCt.fileName : null,
      running: this.wizardRunning,
      error: this.wizardError,
      pipelineId: this.wizardPipelineId,
      agents: this.wizardAgents,
      activityLogs: this.wizardActivityLogs,
      report: this.wizardReport,
      ctResult: this.wizardCtResult,
      pdfUrl: this.wizardReport?.pdf_filename ? `/api/reports/download-pdf/${this.wizardReport.pdf_filename}` : null,
    };
  }

  public launchAiWizardForPatient(patientId: string | null): void {
    this.closeEventSource();
    this.wizardTargetPatientId = patientId;
    this.wizardStep = 1;
    this.wizardReport = null;
    this.wizardCtResult = null;
    this.wizardError = null;
    this.wizardAgents = freshAgents(Boolean(this.wizardCt));
    this.wizardActivityLogs = [];
    this.currentScreen = 'screen-ai-system';
    this.activeModal = null;
    this.emit();
    this.onScreenEnter('screen-ai-system');
    if (patientId) void this.prefillWizardFromHistory(patientId);
    this.scheduleWizardPreview();
  }

  /** Use the patient's latest stored vitals, if any, as the form's starting values. */
  private async prefillWizardFromHistory(patientId: string): Promise<void> {
    const pat = this.patients.find((p) => p.id === patientId);
    const base = { ...this.wizardVascularInput };
    if (pat?.age) base.age = pat.age;
    if (pat?.gender === 'Male' || pat?.gender === 'Female') base.gender = pat.gender;
    this.wizardVascularInput = base;
    this.emit();
    const data: any = await this.run('wizard-prefill', () =>
      api.get(`/api/clinical-portal/doctor/patients/${patientId}/history`), { silent: true }
    );
    const withVitals = (data?.assessments || []).find((a: any) => a.patient_vitals && Object.keys(a.patient_vitals).length);
    if (withVitals && this.wizardTargetPatientId === patientId && this.wizardStep === 1) {
      this.wizardVascularInput = vitalsFromRecord(withVitals.patient_vitals, base);
      this.emit();
      this.scheduleWizardPreview();
    }
  }

  public setWizardStep(step: 1 | 2 | 3 | 4): void {
    // steps 3/4 only make sense once a run exists
    if (step >= 3 && !this.wizardPipelineId) return;
    if (step === 4 && !this.wizardReport) return;
    this.wizardStep = step;
    this.emit();
    if (step === 2) void this.loadPresets();
  }

  public applyWizardPreset(preset: 'high' | 'moderate' | 'low'): void {
    this.wizardVascularInput = { ...VITAL_PRESETS[preset] };
    this.emit();
    this.scheduleWizardPreview();
  }

  public updateWizardVascularField<K extends keyof VascularInputProfile>(field: K, value: VascularInputProfile[K]): void {
    this.wizardVascularInput = { ...this.wizardVascularInput, [field]: value };
    this.emit();
    this.scheduleWizardPreview();
  }

  /** Debounced call to the real ML model for the step-1 preview. */
  private scheduleWizardPreview(): void {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(async () => {
      const data: any = await this.run('wizard-preview', () =>
        api.post('/api/predict-risk', { ...this.wizardVascularInput }, false), { silent: true }
      );
      if (data?.data) {
        this.wizardVascularResult = mapRiskResult(data.data);
        this.emit();
      }
    }, 450);
  }

  /** Pick one of the backend's sample scans. */
  public async selectWizardCtSample(presetId: string): Promise<void> {
    const r = await this.selectionFromPreset(presetId);
    if (!r) return;
    this.wizardCt = r.sel;
    this.wizardCtFile = r.blob;
    this.emit();
  }

  /** Use a user-uploaded image. */
  public selectWizardCtFile(file: File): void {
    this.wizardCt = this.selectionFromFile(file);
    this.wizardCtFile = file;
    this.emit();
  }

  public clearWizardCt(): void {
    this.wizardCt = null;
    this.wizardCtFile = null;
    this.emit();
  }

  /** Starts the real pipeline: POST start-analysis, then follows the SSE stream. */
  public async executeWizardFullAnalysis(): Promise<void> {
    if (this.wizardRunning) return;
    this.closeEventSource();
    this.wizardRunning = true;
    this.wizardError = null;
    this.wizardReport = null;
    this.wizardCtResult = null;
    this.wizardAgents = freshAgents(Boolean(this.wizardCtFile));
    this.wizardActivityLogs = [];
    this.emit();

    const patient: Record<string, unknown> = { ...this.wizardVascularInput };
    const target = this.patients.find((p) => p.id === this.wizardTargetPatientId);
    if (target) {
      patient.patient_id = target.id;
      patient.full_name = target.name;
      patient.mrn = target.mrn;
    }
    if (this.currentUser?.role === 'doctor') {
      patient.doctor_name = this.currentUser.name;
      patient.attending_doctor = this.currentUser.name;
    }
    const form = new FormData();
    form.append('patient_json', JSON.stringify(patient));
    if (this.wizardCtFile) form.append('file', this.wizardCtFile, 'scan.png');

    let start: any;
    try {
      start = await api.post('/api/clinical/start-analysis', form, false);
    } catch (e) {
      this.wizardRunning = false;
      this.wizardError = e instanceof Error ? e.message : String(e);
      this.emit();
      return;
    }
    this.wizardPipelineId = start.pipeline_id;
    this.wizardStep = 3;
    this.log(`Pipeline ${start.pipeline_id} started.`);
    this.emit();
    this.listenToPipeline(start.pipeline_id);
  }

  private log(line: string): void {
    const t = new Date().toTimeString().slice(0, 8);
    this.wizardActivityLogs = [...this.wizardActivityLogs, `[${t}] ${line}`];
  }

  private closeEventSource(): void {
    this.wizardEventSource?.close();
    this.wizardEventSource = null;
  }

  private listenToPipeline(pipelineId: string): void {
    const es = new EventSource(`/api/clinical/stream/${pipelineId}`);
    this.wizardEventSource = es;
    let finished = false;
    es.onmessage = (e) => {
      let ev: any;
      try {
        ev = JSON.parse(e.data);
      } catch {
        return;
      }
      if (ev.error) {
        finished = true;
        es.close();
        this.failWizard(String(ev.error));
        return;
      }
      this.applyAgentEvent(ev);
      if (ev.agent === 'pipeline') {
        finished = true;
        es.close();
        if (ev.status === 'completed') void this.completeWizard(pipelineId);
        else this.failWizard(String(ev.message || 'Pipeline failed'));
      }
    };
    es.onerror = () => {
      es.close();
      if (!finished) void this.pollPipeline(pipelineId);
    };
  }

  private applyAgentEvent(ev: any): void {
    const map: Record<string, CrewAgentId> = {
      ml_risk: 'models', ct_gate: 'models', ct_classifier: 'models',
      prevention: 'prevention', emergency: 'emergency', validation: 'validation', report: 'report',
    };
    const id = map[ev.agent];
    if (ev.message) this.log(`${ev.agent}: ${ev.message}`);
    if (!id) {
      this.emit();
      return;
    }
    const isModelStep = id === 'models';
    this.wizardAgents = this.wizardAgents.map((a) => {
      if (a.id !== id) return a;
      let status = a.status;
      let progress = a.progress;
      if (ev.status === 'working') {
        status = 'running';
        progress = Math.max(progress, isModelStep ? progress + 20 : 40);
      } else if (ev.status === 'completed') {
        // the models step completes when its last sub-model finishes
        const last = ev.agent === 'ct_classifier' || (ev.agent === 'ml_risk' && !this.wizardCtFile);
        status = isModelStep && !last ? 'running' : 'done';
        progress = isModelStep && !last ? Math.min(90, progress + 30) : 100;
      } else if (ev.status === 'failed') {
        // a failed sub-model (e.g. gate rejection) stops only that branch; pipeline continues
        status = isModelStep && ev.agent !== 'ct_gate' ? 'running' : 'failed';
        progress = 100;
      }
      return { ...a, status, progress: Math.min(100, progress), outputEn: ev.message || a.outputEn, outputAr: ev.message || a.outputAr };
    });
    if (ev.agent === 'ct_gate' && ev.status === 'failed') {
      this.wizardAgents = this.wizardAgents.map((a) => (a.id === 'models' ? { ...a, status: 'done', progress: 100 } : a));
    }
    this.emit();
  }

  private async pollPipeline(pipelineId: string): Promise<void> {
    for (let i = 0; i < 45; i++) {
      if (this.wizardPipelineId !== pipelineId) return;
      try {
        const data: any = await api.get(`/api/clinical/result/${pipelineId}`, undefined, false);
        (data.events || []).slice(-1).forEach((ev: any) => this.applyAgentEvent(ev));
        if (data.is_done) {
          await this.completeWizard(pipelineId, data);
          return;
        }
      } catch (e) {
        this.failWizard(e instanceof Error ? e.message : String(e));
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    this.failWizard('انتهت مهلة التحليل. Analysis timed out.');
  }

  private failWizard(message: string): void {
    this.wizardRunning = false;
    this.wizardError = message;
    this.log(`ERROR: ${message}`);
    this.wizardAgents = this.wizardAgents.map((a) => (a.status === 'done' ? a : { ...a, status: 'failed' }));
    this.emit();
  }

  private async completeWizard(pipelineId: string, preloaded?: any): Promise<void> {
    let data = preloaded;
    try {
      if (!data || !data.result) data = await api.get(`/api/clinical/result/${pipelineId}`, undefined, false);
    } catch (e) {
      this.failWizard(e instanceof Error ? e.message : String(e));
      return;
    }
    const report = data?.result as MedicalReport | null;
    if (!report || !report.report_id) {
      this.failWizard(String(data?.error || (report as any)?.error || 'No report was produced.'));
      return;
    }
    this.wizardReport = report;
    this.wizardCtResult = report.ct_analysis ? mapCtAnalysis(report.ct_analysis.gate, report.ct_analysis.diagnosis) : null;
    if (report.risk_assessment && Object.keys(report.risk_assessment).length) {
      this.wizardVascularResult = mapRiskResult(report.risk_assessment);
    }
    this.wizardAgents = this.wizardAgents.map((a) => (a.status === 'failed' ? a : { ...a, status: 'done', progress: 100 }));
    this.wizardRunning = false;
    this.wizardStep = 4;
    this.log('Clinical decision package ready.');
    this.emit();
    if (this.wizardTargetPatientId && this.currentUser?.role === 'doctor') {
      void this.persistWizardAssessment(this.wizardTargetPatientId, report);
    }
  }

  /** Saves the pipeline result into the patient's record (fixes the legacy wrong-key bug). */
  private async persistWizardAssessment(patientId: string, report: MedicalReport): Promise<void> {
    const risk = report.risk_assessment || {};
    const gate = report.ct_analysis?.gate || {};
    const diag = report.ct_analysis?.diagnosis || {};
    const hasCt = gate.predicted_class !== 'not_provided';
    const body = {
      patient_id: patientId,
      assessment_type: 'ai_system_flow',
      patient_vitals: report.patient || {},
      gatekeeper_status: hasCt ? (gate.accepted ? 'accepted' : 'rejected') : 'skipped',
      ct_diagnosis: hasCt ? diag.prediction ?? null : null,
      ct_confidence: hasCt && diag.confidence_pct != null ? Number(diag.confidence_pct) / 100 : null,
      ml_risk_probability: risk.stroke_probability ?? null,
      ml_risk_tier: risk.risk_tier ?? null,
      agent_findings: {
        overall_clinical_summary: report.overall_clinical_summary,
        prevention_support: report.prevention_support,
        emergency_support: report.emergency_support,
        validation: report.validation,
      },
      pdf_filename: report.pdf_filename,
      report_summary: { summary: report.overall_clinical_summary, recommendations: report.key_recommendations },
      validation_status: report.validation?.status === 'FAILED' ? 'FLAGGED' : 'PASSED',
      physician_signed_off: false,
    };
    const ok = await this.run('persist-assessment', () => api.post('/api/clinical-portal/record-assessment', body));
    if (ok) {
      this.toast('success', 'تم حفظ التحليل في ملف المريض.', 'Assessment saved to the patient record.');
      void this.loadDoctorPatients();
    }
  }

  // =====================================================================
  // regular system: Path A (risk model) / Path B (CT model)
  // =====================================================================
  public getRegularSystemState() {
    return {
      path: this.regularPath,
      vascularInput: this.regularVascularInput,
      vascularResult: this.regularVascularResult,
      riskLoading: this.isLoading('regular-risk'),
      ct: this.regularCt,
      ctSampleId: this.regularCt?.presetId || null,
      ctResult: this.regularCtResult,
      ctRejectMessage: this.regularCtRejectMessage,
      ctLoading: this.isLoading('regular-ct'),
    };
  }

  public setRegularPath(path: 'path-a' | 'path-b'): void {
    this.regularPath = path;
    this.emit();
    if (path === 'path-b') void this.loadPresets();
  }

  public applyRegularPreset(preset: 'high' | 'moderate' | 'low'): void {
    this.regularVascularInput = { ...VITAL_PRESETS[preset] };
    this.regularVascularResult = null;
    this.emit();
  }

  public updateRegularVascularField<K extends keyof VascularInputProfile>(field: K, value: VascularInputProfile[K]): void {
    this.regularVascularInput = { ...this.regularVascularInput, [field]: value };
    this.regularVascularResult = null; // result no longer matches the inputs
    this.emit();
  }

  /** Path A: real ML risk model. */
  public async runRegularRisk(): Promise<void> {
    const data: any = await this.run('regular-risk', () =>
      api.post('/api/predict-risk', { ...this.regularVascularInput }, false)
    );
    if (data?.data) {
      this.regularVascularResult = mapRiskResult(data.data);
      this.emit();
    }
  }

  /** Path B: pick a sample scan and analyse it immediately. */
  public async setRegularCtSample(presetId: string): Promise<void> {
    const r = await this.selectionFromPreset(presetId);
    if (!r) return;
    this.regularCt = r.sel;
    this.emit();
    await this.runRegularCt(r.blob);
  }

  /** Path B: analyse an uploaded image. */
  public async setRegularCtFile(file: File): Promise<void> {
    this.regularCt = this.selectionFromFile(file);
    this.emit();
    await this.runRegularCt(file);
  }

  private async runRegularCt(blob: Blob): Promise<void> {
    this.regularCtResult = null;
    this.regularCtRejectMessage = null;
    this.emit();
    const form = new FormData();
    form.append('file', blob, 'scan.png');
    const data: any = await this.run('regular-ct', () => api.post('/api/diagnose-ct', form, false));
    if (!data) return;
    this.regularCtResult = mapCtAnalysis(data.gate_details, data.gate_passed ? data.diagnosis : null);
    if (!data.gate_passed) {
      this.regularCtResult = { ...this.regularCtResult, gatePassed: false, diagnosis: 'rejected_non_brain' };
      this.regularCtRejectMessage = String(data.message || data.gate_details?.message || '');
    }
    this.emit();
  }

  // =====================================================================
  // admin
  // =====================================================================
  public async loadAdminOverview(): Promise<void> {
    const data = await this.run('admin-overview', () => api.get('/api/admin/overview'));
    if (data) {
      this.adminOverview = mapOverview(data);
      this.emit();
    }
  }

  public async loadClinicians(status?: string, search?: string): Promise<void> {
    if (status !== undefined) this.clinicianFilter = { ...this.clinicianFilter, status };
    if (search !== undefined) this.clinicianFilter = { ...this.clinicianFilter, search };
    const f = this.clinicianFilter;
    const data: any = await this.run('clinicians', () =>
      api.get('/api/admin/clinicians', { status: f.status !== 'all' ? f.status : undefined, search: f.search || undefined })
    );
    if (data) {
      this.clinicianApprovals = (Array.isArray(data) ? data : data.items || []).map(mapClinician);
      this.emit();
    }
  }

  /**
   * Admin decision on a clinician (`id` = doctor_profile id).
   * active → approve (needs verificationRef), rejected → reject, suspended → suspend,
   * info_requested → request-info. `notes` is the reason / request text (min 5 chars on the server).
   */
  public async updateClinicianStatus(id: string, status: AccountStatus, notes?: string, verificationRef?: string): Promise<boolean> {
    let path = '';
    let body: Record<string, unknown> = {};
    if (status === 'active') {
      path = 'approve';
      body = { verification_reference: verificationRef || null, verification_notes: notes || null };
    } else if (status === 'rejected') {
      path = 'reject';
      body = { reason: notes || '' };
    } else if (status === 'suspended') {
      path = 'suspend';
      body = { reason: notes || '' };
    } else if (status === 'info_requested') {
      path = 'request-info';
      body = { request_notes: notes || '' };
    } else return false;
    const ok = await this.run(`clinician-${id}`, () => api.post(`/api/admin/clinicians/${id}/${path}`, body));
    if (!ok) return false;
    this.toast('success', 'تم تحديث حالة الطبيب.', 'Clinician status updated.');
    this.closeModal();
    void this.loadClinicians();
    return true;
  }

  public async loadSafetyQueue(filter?: string): Promise<void> {
    if (filter !== undefined) this.safetyFilter = filter;
    const data: any = await this.run('safety', () =>
      api.get('/api/admin/safety-queue', { filter_type: this.safetyFilter !== 'all' ? this.safetyFilter : undefined })
    );
    if (data) {
      this.safetyQueue = (Array.isArray(data) ? data : data.items || []).map(mapSafetyItem);
      this.emit();
    }
  }

  /** Opens the case-details modal and loads the full case (context.detail = raw backend object). */
  public async openSafetyDetails(assessmentId: string): Promise<void> {
    this.openModal('modal-admin-safety-details', { id: assessmentId, loading: true });
    const data = await this.run('safety-detail', () => api.get(`/api/admin/safety-queue/${assessmentId}`));
    this.patchModalContext({ loading: false, detail: data });
  }

  public async loadQualifiedClinicians(): Promise<void> {
    const data: any = await this.run('qualified', () => api.get('/api/admin/qualified-clinicians'));
    if (data) {
      this.qualifiedClinicians = (Array.isArray(data) ? data : []).map(mapQualified);
      this.emit();
    }
  }

  public async assignSafetyCase(assessmentId: string, doctorUserId: string, notes?: string): Promise<boolean> {
    const ok = await this.run('safety-assign', () =>
      api.post(`/api/admin/safety-queue/${assessmentId}/assign`, { doctor_id: doctorUserId, notes: notes || null })
    );
    if (!ok) return false;
    this.toast('success', 'تم إسناد الحالة للطبيب.', 'Case assigned.');
    this.closeModal();
    void this.loadSafetyQueue();
    return true;
  }

  public async investigateSafetyCase(
    assessmentId: string,
    status: 'resolved' | 'false_positive' | 'escalated',
    notes: string
  ): Promise<boolean> {
    const ok = await this.run('safety-investigate', () =>
      api.post(`/api/admin/safety-queue/${assessmentId}/investigate`, { status, notes })
    );
    if (!ok) return false;
    this.toast('success', 'تم حفظ ملاحظات التحقيق.', 'Investigation recorded.');
    this.closeModal();
    void this.loadSafetyQueue();
    return true;
  }

  public async loadUsers(role?: string, search?: string): Promise<void> {
    if (role !== undefined) this.usersFilter = { ...this.usersFilter, role };
    if (search !== undefined) this.usersFilter = { ...this.usersFilter, search };
    const f = this.usersFilter;
    const data: any = await this.run('users', () =>
      api.get('/api/admin/users', { role: f.role !== 'all' ? f.role : undefined, search: f.search || undefined })
    );
    if (data) {
      this.usersDirectory = (Array.isArray(data) ? data : data.items || []).map(mapAdminUser);
      this.emit();
    }
  }

  /** Activate/deactivate a user. The backend requires a reason (≥ 3 chars). */
  public async toggleUserActiveStatus(userId: string, reason?: string): Promise<boolean> {
    const r = (reason || '').trim() || 'Status changed by administrator';
    const data: any = await this.run(`user-${userId}`, () => api.post(`/api/admin/users/${userId}/toggle-status`, { reason: r }));
    if (!data) return false;
    this.usersDirectory = this.usersDirectory.map((u) =>
      u.id === userId ? { ...u, isActive: Boolean(data.is_active), status: data.is_active ? 'active' : 'suspended' } : u
    );
    this.toast('success', data.is_active ? 'تم تفعيل الحساب.' : 'تم إيقاف الحساب.', data.message || 'Updated.');
    this.emit();
    return true;
  }

  public async loadModels(): Promise<void> {
    const data: any = await this.run('models', () => api.get('/api/admin/models'));
    if (data) {
      this.aiModels = (Array.isArray(data) ? data : []).map(mapModel);
      this.emit();
    }
  }

  public async loadAuditLogs(search?: string): Promise<void> {
    if (search !== undefined) this.auditSearch = search;
    const data: any = await this.run('audit', () =>
      api.get('/api/admin/audit-logs', { search: this.auditSearch || undefined, limit: 100 })
    );
    if (data) {
      this.auditLogs = (Array.isArray(data) ? data : data.items || []).map(mapAudit);
      this.emit();
    }
  }

  public async loadHealth(): Promise<void> {
    const [h, inc]: any[] = await Promise.all([
      this.run('health', () => api.get('/api/admin/health')),
      this.run('incidents', () => api.get('/api/admin/incidents'), { silent: true }),
    ]);
    if (h) this.health = { overall: String(h.overall_status || 'degraded'), services: mapHealth(h), checkedAt: String(h.checked_at || '') };
    if (inc) this.incidents = (Array.isArray(inc) ? inc : []).map(mapIncident);
    this.emit();
  }

  public async logSystemIncident(
    service: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    type: string,
    description: string
  ): Promise<boolean> {
    const ok = await this.run('incident', () =>
      api.post('/api/admin/incidents', { service_name: service, severity, incident_type: type, description })
    );
    if (!ok) return false;
    this.toast('success', 'تم تسجيل الحادثة.', 'Incident logged.');
    this.closeModal();
    void this.loadHealth();
    return true;
  }

  // =====================================================================
  // chatbot (RAG over stroke guidelines)
  // =====================================================================
  private chatbotWelcome(): ChatMessage {
    return {
      id: 'cb-welcome',
      senderId: 'ai',
      senderRole: 'ai',
      senderName: 'StrokeAegis Assistant',
      senderNameAr: 'مساعد StrokeAegis',
      text: 'مرحباً! أنا مساعد StrokeAegis. اسألني عن السكتة الدماغية وأعراضها والوقاية منها. Hi! Ask me anything about stroke.',
      timestamp: fmtTime(new Date().toISOString()),
    };
  }

  public isChatbotThinking(): boolean {
    return this.isLoading('chatbot');
  }

  public async sendChatbotQuestion(question: string): Promise<void> {
    const q = question.trim();
    if (!q || this.isLoading('chatbot')) return;
    const now = fmtTime(new Date().toISOString());
    this.chatbotMessages = [
      ...this.chatbotMessages,
      {
        id: `cb-u-${Date.now()}`,
        senderId: this.currentUser?.id || 'guest',
        senderRole: this.currentUser?.role || 'patient',
        senderName: this.currentUser?.name || 'You',
        senderNameAr: this.currentUser?.nameAr || 'أنت',
        text: q,
        timestamp: now,
        isMine: true,
      },
    ];
    this.emit();
    const data: any = await this.run('chatbot', () =>
      api.post('/api/chatbot', { message: q, conversation_id: this.chatbotConversationId }, false)
    );
    if (!data) {
      this.chatbotMessages = [
        ...this.chatbotMessages,
        {
          id: `cb-e-${Date.now()}`, senderId: 'ai', senderRole: 'ai',
          senderName: 'StrokeAegis Assistant', senderNameAr: 'مساعد StrokeAegis',
          text: this.ui.t('تعذّر الحصول على رد الآن. حاول بعد قليل.', 'Could not get an answer right now. Please try again.'),
          timestamp: fmtTime(new Date().toISOString()),
        },
      ];
      this.emit();
      return;
    }
    this.chatbotConversationId = data.conversation_id || this.chatbotConversationId;
    this.chatbotMessages = [
      ...this.chatbotMessages,
      {
        id: `cb-a-${Date.now()}`,
        senderId: 'ai',
        senderRole: 'ai',
        senderName: 'StrokeAegis Assistant',
        senderNameAr: 'مساعد StrokeAegis',
        text: String(data.answer || ''),
        timestamp: fmtTime(new Date().toISOString()),
        sources: (data.sources || []).map((s: any) => s.citation || `${s.source} ${s.guideline}${s.year ? ` (${s.year})` : ''}`),
        isEmergency: Boolean(data.is_emergency),
      },
    ];
    this.emit();
  }

  public resetChatbot(): void {
    this.chatbotConversationId = null;
    this.chatbotMessages = [this.chatbotWelcome()];
    this.emit();
  }
}

export const appCore = StrokeAegisCore.getInstance();
