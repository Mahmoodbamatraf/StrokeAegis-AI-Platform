/*
 * UI-facing types. Everything here is filled from the real FastAPI backend
 * (see src/core/api.ts and the mappers in src/core/mappers.ts). Nothing is simulated.
 * Names have both `name` and `nameAr`; the backend stores one name, so both carry the same value.
 */

export type Language = 'ar' | 'en';
export type ThemeMode = 'light' | 'dark';
export type LuxuryAccent = 'clinical-teal' | 'surgical-emerald' | 'royal-cyan';

export type ScreenId =
  | 'screen-landing'
  | 'screen-doctor-portal'
  | 'screen-patient-portal'
  | 'screen-admin-dashboard'
  | 'screen-doctor-pending'
  | 'screen-restricted-access'
  | 'screen-home'
  | 'screen-ai-system'
  | 'screen-regular-system';

export type DoctorTabId = 'doc-pane-patients' | 'doc-pane-reports' | 'doc-pane-chat';

export type PatientTabId =
  | 'pat-pane-selfcheck'
  | 'pat-pane-results'
  | 'pat-pane-reports'
  | 'pat-pane-doctor'
  | 'pat-pane-chat';

export type AdminTabId =
  | 'admin-pane-overview'
  | 'admin-pane-approvals'
  | 'admin-pane-safety'
  | 'admin-pane-users'
  | 'admin-pane-models'
  | 'admin-pane-audit'
  | 'admin-pane-health';

export type ModalId =
  | 'modal-selfcheck-result'
  | 'modal-patient-history'
  | 'modal-launch-ai-choice'
  | 'modal-admit-patient'
  | 'modal-find-doctor'
  | 'modal-notifications-drawer'
  | 'modal-admin-approve-clinician'
  | 'modal-admin-action-reason'
  | 'modal-admin-safety-details'
  | 'modal-admin-safety-assign'
  | 'modal-admin-investigate'
  | 'modal-admin-incident'
  | 'modal-admin-audit-detail'
  | 'chatbot-modal'
  | null;

export type UserRole = 'doctor' | 'patient' | 'admin';
/** UI status. Backend `approval_status` maps: approved→active, more_info_required→info_requested. */
export type AccountStatus = 'active' | 'pending' | 'info_requested' | 'suspended' | 'rejected';
export type RiskTier = 'high' | 'moderate' | 'low';
/** Backend CT `prediction`: Bleeding→hemorrhagic, Ischemia→ischemic, Normal→normal, gate rejection→rejected_non_brain. */
export type CtDiagnosisType = 'hemorrhagic' | 'ischemic' | 'normal' | 'rejected_non_brain';

export interface UserProfile {
  id: string;
  name: string;
  nameAr: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  isActive: boolean;
  createdAt?: string;
  specialty?: string;
  specialtyAr?: string;
  hospital?: string;
  hospitalAr?: string;
  licenseNumber?: string;
  mrn?: string;
  dob?: string;
  gender?: 'Male' | 'Female' | 'Other';
  emergencyContact?: string;
  restrictionReason?: string;
  restrictionReasonAr?: string;
  adminRequestNote?: string;
  adminRequestNoteAr?: string;
  /** Admin users table only. */
  activeConnections?: number;
}

/** The 10 inputs of the backend ML risk model (`PatientVitals`). Field names are the backend's. */
export interface VascularInputProfile {
  gender: 'Male' | 'Female';
  age: number;
  hypertension: 0 | 1;
  heart_disease: 0 | 1;
  ever_married: 'Yes' | 'No';
  work_type: 'Private' | 'Self-employed' | 'Govt_job' | 'children' | 'Never_worked';
  Residence_type: 'Urban' | 'Rural';
  avg_glucose_level: number;
  bmi: number;
  smoking_status: 'formerly smoked' | 'never smoked' | 'smokes' | 'Unknown';
}

export interface ContributingFactor {
  id: string;
  labelEn: string;
  labelAr: string;
  severity: 'high' | 'moderate' | 'normal';
  /** Backend `impact` sentence. */
  valueDisplay: string;
}

/** Result of `/api/predict-risk` or `/patient/quick-risk`. */
export interface VascularRiskResult {
  probability: number; // 0..100
  tier: RiskTier;
  factors: ContributingFactor[];
  summaryEn: string;
  summaryAr: string;
  recommendations: string[];
  timestamp: string;
}

/** A CT sample from `/api/presets`. */
export interface CtSamplePreset {
  id: string; // bleeding | ischemia | normal | non_brain
  titleEn: string;
  titleAr: string;
  description: string;
  expectedGate: 'accept' | 'reject';
  expectedDiagnosis: string;
  previewUrl: string; // data URL
}

/** The CT image currently picked in a form (preset or user upload). */
export interface CtSelection {
  source: 'preset' | 'upload';
  presetId: string | null;
  fileName: string;
  previewUrl: string; // data URL or object URL
}

/** Result of the CT gate + classifier (`/api/diagnose-ct` or the pipeline's `ct_analysis`). */
export interface CtAnalysisResult {
  gatePassed: boolean;
  gateScore: number; // p_brain_pct
  gateMessage: string;
  diagnosis: CtDiagnosisType | null; // null = no CT supplied
  diagnosisLabel: string; // backend raw label
  confidence: number; // 0..100
  classProbabilities: Record<string, number>;
  statusBanner: string;
  quadrant: string | null;
  hotspotCoveragePct: number | null;
  focusCentroid: { x_pct: number; y_pct: number } | null;
  originalImage: string | null;
  roiImage: string | null;
  heatmapImage: string | null;
  overlayImage: string | null;
  projectionImage: string | null;
  reassurance: string | null;
}

export type CrewAgentId = 'models' | 'prevention' | 'emergency' | 'validation' | 'report';

export interface CrewAgentState {
  id: CrewAgentId;
  nameEn: string;
  nameAr: string;
  roleEn: string;
  roleAr: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  /** Latest backend message for this agent. */
  outputEn: string;
  outputAr: string;
}

/** The full report returned by `/api/clinical/result/{id}` (kept loose: it is LLM output). */
export interface MedicalReport {
  report_id: string;
  generated_at: string;
  patient: Record<string, unknown>;
  risk_assessment: Record<string, any>;
  ct_analysis: { gate: Record<string, any>; diagnosis: Record<string, any> };
  prevention_support: Record<string, any>;
  emergency_support: Record<string, any>;
  validation: Record<string, any>;
  overall_clinical_summary: string;
  key_recommendations: string[];
  guideline_references: string[];
  clinical_disclaimer: string;
  pdf_filename: string | null;
  [key: string]: unknown;
}

export interface ClinicalAssessmentRecord {
  id: string;
  patientId: string;
  patientName: string;
  patientNameAr: string;
  date: string;
  assessmentType: 'ai_system_flow' | 'regular_ml' | 'regular_ct' | string;
  riskProbability: number | null; // 0..100
  riskTier: RiskTier | null;
  ctDiagnosis: CtDiagnosisType | null;
  ctConfidence: number | null; // 0..100
  gatekeeperStatus: string | null;
  summaryEn: string;
  summaryAr: string;
  hasReport: boolean;
  reportId: string | null;
  signedOff: boolean;
  vitals: Record<string, unknown>;
}

export interface PatientRecord {
  id: string;
  mrn: string;
  name: string;
  nameAr: string;
  email: string;
  age: number | null;
  dob: string | null;
  gender: 'Male' | 'Female' | 'Other' | null;
  careRole: 'Primary' | 'Care Team';
  status: 'Active' | 'Monitoring';
  latestRiskTier: RiskTier | null;
  latestRiskProb: number | null; // 0..100
  latestDiagnosis: CtDiagnosisType | null;
  lastEvaluated: string | null;
  totalAssessments: number;
  totalReports: number;
  conversationId: string | null;
  associatedSince: string | null;
}

export interface ClinicalReport {
  id: string;
  reportCode: string;
  assessmentId: string;
  patientId: string | null;
  patientName: string;
  patientNameAr: string;
  mrn: string;
  doctorName?: string;
  createdAt: string;
  assessmentType: string;
  riskTier: RiskTier | null;
  riskProb: number | null;
  ctDiagnosis: CtDiagnosisType | null;
  agentStatus: 'Verified' | 'Flagged Review' | 'Pending Review';
  validationStatus: string;
  signedStatus: 'Pending Sign-off' | 'Signed & Approved';
  summary: string;
  recommendationsEn: string[];
  recommendationsAr: string[];
  pdfFilename: string | null;
  downloadUrl: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: UserRole | 'ai';
  senderName: string;
  senderNameAr: string;
  text: string;
  timestamp: string;
  isMine?: boolean;
  /** Chatbot only. */
  sources?: string[];
  isEmergency?: boolean;
}

export interface ChatThread {
  conversationId: string;
  /** Counterparty user id (the patient for doctors, the doctor for patients). */
  patientId: string;
  patientName: string;
  patientNameAr: string;
  counterpartyRole: UserRole;
  mrn: string;
  specialty?: string | null;
  unreadCount: number;
  lastUpdated: string;
  lastMessage: string;
  messages: ChatMessage[];
}

export interface ConnectionRequest {
  id: string; // relationship id
  counterpartyId: string;
  name: string;
  email: string;
  mrn?: string | null;
  specialty?: string | null;
  hospital?: string | null;
  relationshipType: 'primary' | 'care_team';
  status: string;
  initiatedBy: 'doctor' | 'patient';
  createdAt: string;
  expiresAt: string | null;
}

export interface CareTeamDoctor {
  doctorId: string;
  relationshipId: string | null;
  name: string;
  email: string;
  specialty: string | null;
  hospital: string | null;
  phone: string | null;
  relationshipType: 'primary' | 'care_team' | null;
  status: string;
  conversationId: string | null;
  expiresAt: string | null;
}

export interface DoctorDirectoryEntry {
  doctorId: string;
  name: string;
  email: string;
  specialty: string | null;
  hospital: string | null;
  statusLabel: 'available' | 'primary' | 'care_team' | 'pending' | 'declined' | 'expired' | string;
}

export interface DoctorStats {
  doctorName: string;
  specialization: string;
  hospital: string | null;
  licenseNumber: string | null;
  totalPatients: number;
  totalAssessments: number;
  pendingReports: number;
  signedReports: number;
  unreadMessages: number;
}

export interface PatientOverview {
  mrn: string;
  doctor: CareTeamDoctor | null;
  conversationId: string | null;
  stats: {
    totalAssessments: number;
    totalReports: number;
    careTeamCount: number;
    pendingRequestsCount: number;
    unreadNotifications: number;
    unreadMessages: number;
  };
}

export interface ClinicianApprovalRequest {
  id: string; // doctor_profile id (used by approve/reject endpoints)
  userId: string;
  name: string;
  nameAr: string;
  email: string;
  licenseNumber: string;
  specialty: string;
  specialtyAr: string;
  hospital: string;
  hospitalAr: string;
  phone: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  status: AccountStatus;
  verificationRef?: string;
  notes?: string;
  rejectionReason?: string;
  moreInfoRequest?: string;
}

export interface SafetyQueueItem {
  id: string; // assessment id
  caseCode: string;
  patientId: string;
  patientName: string;
  patientNameAr: string;
  mrn: string;
  diagnosis: CtDiagnosisType | null;
  riskTier: RiskTier | null;
  riskProb: number | null;
  triggerReasonEn: string;
  triggerReasonAr: string;
  assignedDoctor: string;
  assignedDoctorAr: string;
  priority: 'HIGH' | 'MEDIUM' | 'NORMAL';
  status: 'Open Alert' | 'Under Investigation' | 'Resolved';
  safetyStatus: string;
  timestamp: string;
  investigationNotes?: string;
  pdfFilename: string | null;
}

export interface QualifiedClinician {
  id: string; // user id
  name: string;
  email: string;
  specialty: string;
  hospital: string;
}

export interface AIModelTelemetry {
  id: string;
  key: string;
  name: string;
  version: string;
  architecture: string;
  purposeEn: string;
  purposeAr: string;
  inferencesCount: number;
  errorCount: number;
  errorRatePercent: number;
  lastInferenceAt: string | null;
  status: 'Nominal' | 'Degraded' | 'Offline';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole | string;
  action: string;
  resource: string;
  outcome: string;
  reason: string | null;
  severity: 'info' | 'warning' | 'critical';
  payload: Record<string, unknown>;
}

export interface SystemIncident {
  id: string;
  service: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  createdAt: string;
  status: 'Open' | 'Investigating' | 'Resolved';
}

export interface ServiceHealth {
  key: string;
  name: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  details: string;
  latencyMs: number | null;
}

export interface AdminOverview {
  activeDoctors: number;
  pendingClinicians: number;
  registeredPatients: number;
  totalAssessments: number;
  assessmentsToday: number;
  reportsAwaitingSignoff: number;
  safetyFlags: number;
  gateRejections: number;
  openIncidents: number;
  volume: {
    ctScansTotal: number;
    highRiskCount: number;
    highRiskRatePct: number;
    ischemicCount: number;
    hemorrhagicCount: number;
    normalCount: number;
  };
  subsystems: { name: string; details: string; status: string }[];
  alerts: { title: string; message: string; actionTab: AdminTabId | string }[];
  recentEvents: { id: string; createdAt: string; actor: string; action: string; target: string; outcome: string }[];
  lastUpdated: string;
}

export interface NotificationItem {
  id: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  time: string;
  read: boolean;
  type: 'alert' | 'report' | 'message' | 'system';
  referenceId: string | null;
}

export interface ToastMessage {
  id: number;
  kind: 'success' | 'error' | 'info';
  textAr: string;
  textEn: string;
}
