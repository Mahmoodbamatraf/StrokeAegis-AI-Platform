/*
 * Backend JSON → UI types. One function per backend shape (see API contract).
 * Kept pure so they can be unit-tested without a server.
 */
import {
  AccountStatus,
  AdminOverview,
  AIModelTelemetry,
  AuditLogEntry,
  CareTeamDoctor,
  ChatMessage,
  ChatThread,
  ClinicalAssessmentRecord,
  ClinicalReport,
  ClinicianApprovalRequest,
  ConnectionRequest,
  CtAnalysisResult,
  CtDiagnosisType,
  CtSamplePreset,
  DoctorDirectoryEntry,
  DoctorStats,
  NotificationItem,
  PatientOverview,
  PatientRecord,
  QualifiedClinician,
  RiskTier,
  SafetyQueueItem,
  ServiceHealth,
  SystemIncident,
  UserProfile,
  UserRole,
  VascularInputProfile,
  VascularRiskResult,
} from './types';

const str = (v: unknown, fallback = ''): string => (v === null || v === undefined ? fallback : String(v));
const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** "2026-11-09T18:35:12.123+00:00" → "2026-11-09 18:35" */
export function fmtDate(iso: unknown): string {
  const s = str(iso);
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtTime(iso: unknown): string {
  const s = str(iso);
  const d = new Date(s);
  if (!s || Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function ageFromDob(dob: unknown): number | null {
  const s = str(dob);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

export function mapTier(tier: unknown): RiskTier | null {
  const t = str(tier).toLowerCase();
  if (t.startsWith('high')) return 'high';
  if (t.startsWith('mod') || t.startsWith('med')) return 'moderate';
  if (t.startsWith('low')) return 'low';
  return null;
}

export function mapDiagnosis(pred: unknown): CtDiagnosisType | null {
  const p = str(pred).toLowerCase();
  if (!p || p === 'not uploaded' || p === 'none' || p === 'analysis error') return null;
  if (p.includes('bleed') || p.includes('hemorr') || p.includes('haemorr')) return 'hemorrhagic';
  if (p.includes('isch')) return 'ischemic';
  if (p.includes('normal')) return 'normal';
  if (p.includes('block') || p.includes('reject') || p.includes('gate')) return 'rejected_non_brain';
  return null;
}

/** 0..1 → 0..100 (backend stores probabilities as fractions in the portal tables). */
const fracToPct = (v: unknown): number | null =>
  v === null || v === undefined ? null : Math.round(num(v) * 1000) / 10;

export function mapAccountStatus(approval: unknown, isActive: unknown): AccountStatus {
  if (isActive === false) return 'suspended';
  switch (str(approval)) {
    case 'pending':
      return 'pending';
    case 'more_info_required':
      return 'info_requested';
    case 'suspended':
      return 'suspended';
    case 'rejected':
      return 'rejected';
    default:
      return 'active';
  }
}

function asGender(g: unknown): 'Male' | 'Female' | 'Other' | undefined {
  const s = str(g).toLowerCase();
  if (s === 'male') return 'Male';
  if (s === 'female') return 'Female';
  if (s === 'other') return 'Other';
  return undefined;
}

/** Login `TokenResponse` or `/api/auth/me` `CurrentUserResponse`. */
export function mapUser(u: any): UserProfile {
  const dp = u.doctor_profile || {};
  const pp = u.patient_profile || {};
  const name = str(u.full_name, u.email);
  return {
    id: str(u.id ?? u.user_id),
    name,
    nameAr: name,
    email: str(u.email),
    role: str(u.role) as UserRole,
    status: u.role === 'doctor' ? mapAccountStatus(u.approval_status, u.is_active) : u.is_active === false ? 'suspended' : 'active',
    isActive: u.is_active !== false,
    createdAt: u.created_at ? fmtDate(u.created_at) : undefined,
    specialty: dp.specialization ?? undefined,
    specialtyAr: dp.specialization ?? undefined,
    hospital: dp.hospital_affiliation ?? undefined,
    hospitalAr: dp.hospital_affiliation ?? undefined,
    licenseNumber: dp.license_number ?? undefined,
    mrn: pp.mrn ?? undefined,
    dob: pp.date_of_birth ?? undefined,
    gender: asGender(pp.gender),
    emergencyContact: pp.emergency_contact ?? undefined,
    restrictionReason: u.rejection_reason ?? undefined,
    restrictionReasonAr: u.rejection_reason ?? undefined,
    adminRequestNote: u.more_info_request ?? undefined,
    adminRequestNoteAr: u.more_info_request ?? undefined,
  };
}

/** `MLRiskResult` (also the quick-risk `result` with aliases). */
export function mapRiskResult(r: any): VascularRiskResult {
  const pct = r.stroke_probability_pct ?? r.probability_pct ?? num(r.stroke_probability) * 100;
  const factors = (r.clinical_factors || r.risk_factors || []) as any[];
  const desc = str(r.risk_tier_description ?? r.tier_desc);
  return {
    probability: Math.round(num(pct) * 10) / 10,
    tier: mapTier(r.risk_tier) || 'low',
    factors: factors.map((f, i) => ({
      id: `f-${i}`,
      labelEn: str(f.factor),
      labelAr: str(f.factor),
      severity: str(f.level).toLowerCase() === 'high' ? 'high' : str(f.level).toLowerCase() === 'moderate' ? 'moderate' : 'normal',
      valueDisplay: str(f.impact),
    })),
    summaryEn: desc,
    summaryAr: desc,
    recommendations: (r.recommendations || []).map((x: unknown) => str(x)),
    timestamp: fmtDate(new Date().toISOString()),
  };
}

export function toVitals(v: VascularInputProfile): Record<string, unknown> {
  return { ...v };
}

/** Fills a form from stored `patient_vitals` (falls back to `base` per field). */
export function vitalsFromRecord(rec: any, base: VascularInputProfile): VascularInputProfile {
  if (!rec || typeof rec !== 'object') return { ...base };
  const g = asGender(rec.gender);
  return {
    gender: g === 'Female' ? 'Female' : g === 'Male' ? 'Male' : base.gender,
    age: rec.age !== undefined ? num(rec.age, base.age) : base.age,
    hypertension: rec.hypertension !== undefined ? (num(rec.hypertension) ? 1 : 0) : base.hypertension,
    heart_disease: rec.heart_disease !== undefined ? (num(rec.heart_disease) ? 1 : 0) : base.heart_disease,
    ever_married: rec.ever_married === 'No' ? 'No' : rec.ever_married === 'Yes' ? 'Yes' : base.ever_married,
    work_type: rec.work_type || base.work_type,
    Residence_type: rec.Residence_type === 'Rural' ? 'Rural' : rec.Residence_type === 'Urban' ? 'Urban' : base.Residence_type,
    avg_glucose_level: rec.avg_glucose_level !== undefined ? num(rec.avg_glucose_level, base.avg_glucose_level) : base.avg_glucose_level,
    bmi: rec.bmi !== undefined ? num(rec.bmi, base.bmi) : base.bmi,
    smoking_status: rec.smoking_status || base.smoking_status,
  };
}

const PRESET_TITLES: Record<string, [string, string]> = {
  bleeding: ['نزيف دماغي (سكتة نزفية)', 'Hemorrhagic stroke (bleeding)'],
  ischemia: ['احتشاء إقفاري (سكتة إقفارية)', 'Ischemic stroke'],
  normal: ['أشعة دماغ سليمة', 'Normal brain CT'],
  non_brain: ['صورة ليست أشعة دماغ (اختبار البوابة)', 'Non-brain image (gate test)'],
};

export function mapCtPreset(p: any): CtSamplePreset {
  const t = PRESET_TITLES[p.id] || [str(p.name), str(p.name)];
  return {
    id: str(p.id),
    titleAr: t[0],
    titleEn: str(p.name) || t[1],
    description: str(p.description),
    expectedGate: p.expected_gate === 'reject' ? 'reject' : 'accept',
    expectedDiagnosis: str(p.expected_diagnosis),
    previewUrl: str(p.preview_base64),
  };
}

/** `gate` = GateResult, `diag` = CTDiagnosis (or a pipeline placeholder). */
export function mapCtAnalysis(gate: any, diag: any): CtAnalysisResult {
  const g = gate || {};
  const d = diag || {};
  const gc = d.gradcam || {};
  const gatePassed = g.accepted !== false && g.predicted_class !== 'not_provided';
  const provided = g.predicted_class !== 'not_provided';
  return {
    gatePassed: provided ? g.accepted === true : false,
    gateScore: Math.round(num(g.p_brain_pct ?? g.confidence_pct) * 10) / 10,
    gateMessage: str(g.message),
    diagnosis: !provided ? null : gatePassed ? mapDiagnosis(d.prediction) : 'rejected_non_brain',
    diagnosisLabel: str(d.prediction),
    confidence: Math.round(num(d.confidence_pct) * 10) / 10,
    classProbabilities: d.class_probabilities || {},
    statusBanner: str(d.status_banner),
    quadrant: gc.anatomical_quadrant ?? null,
    hotspotCoveragePct: gc.hotspot_coverage_pct ?? null,
    focusCentroid: gc.focus_centroid ?? null,
    originalImage: d.original_image ?? null,
    roiImage: d.roi_preprocessed_image ?? null,
    heatmapImage: gc.heatmap_image ?? null,
    overlayImage: gc.overlay_contour_image ?? null,
    projectionImage: gc.full_projection_image ?? null,
    reassurance: gc.reassurance ?? null,
  };
}

export function mapPatient(p: any): PatientRecord {
  const la = p.latest_assessment;
  const name = str(p.full_name, p.email);
  const g = asGender(p.gender);
  return {
    id: str(p.id),
    mrn: str(p.mrn, '—'),
    name,
    nameAr: name,
    email: str(p.email),
    age: ageFromDob(p.date_of_birth),
    dob: p.date_of_birth ?? null,
    gender: g ?? null,
    careRole: p.relationship_type === 'care_team' ? 'Care Team' : 'Primary',
    status: la && mapTier(la.ml_risk_tier) === 'high' ? 'Monitoring' : 'Active',
    latestRiskTier: la ? mapTier(la.ml_risk_tier) : null,
    latestRiskProb: la ? fracToPct(la.ml_risk_probability) : null,
    latestDiagnosis: la ? mapDiagnosis(la.ct_diagnosis) : null,
    lastEvaluated: la ? fmtDate(la.created_at) : null,
    totalAssessments: num(p.total_assessments),
    totalReports: num(p.total_reports),
    conversationId: p.conversation_id ?? null,
    associatedSince: p.associated_since ? fmtDate(p.associated_since) : null,
  };
}

export function mapAssessment(a: any, patientId: string, patientName: string): ClinicalAssessmentRecord {
  const conf = a.ct_confidence;
  const summary = str(a.agent_findings?.overall_clinical_summary || a.agent_findings?.summary || '');
  return {
    id: str(a.id),
    patientId,
    patientName,
    patientNameAr: patientName,
    date: fmtDate(a.created_at),
    assessmentType: str(a.assessment_type),
    riskProbability: fracToPct(a.ml_risk_probability),
    riskTier: mapTier(a.ml_risk_tier),
    ctDiagnosis: mapDiagnosis(a.ct_diagnosis),
    ctConfidence: conf === null || conf === undefined ? null : Math.round(num(conf) * 1000) / 10,
    gatekeeperStatus: a.gatekeeper_status ?? null,
    summaryEn: summary,
    summaryAr: summary,
    hasReport: Boolean(a.has_report),
    reportId: a.report_id ?? null,
    signedOff: Boolean(a.is_signed_off),
    vitals: a.patient_vitals || {},
  };
}

export function mapReport(r: any, extra: { patientId?: string | null; patientName?: string; mrn?: string } = {}): ClinicalReport {
  const summary = r.report_summary || {};
  const recs = Array.isArray(summary.recommendations) ? summary.recommendations.map((x: unknown) => str(x)) : [];
  const v = str(r.validation_status, 'PENDING_REVIEW');
  const name = str(r.patient_name ?? extra.patientName, '—');
  return {
    id: str(r.id),
    reportCode: r.pdf_filename ? str(r.pdf_filename).replace(/\.pdf$/i, '') : `RPT-${str(r.id).slice(0, 8).toUpperCase()}`,
    assessmentId: str(r.assessment_id),
    patientId: extra.patientId ?? null,
    patientName: name,
    patientNameAr: name,
    mrn: str(r.patient_mrn ?? extra.mrn, '—'),
    doctorName: r.doctor_name ?? undefined,
    createdAt: fmtDate(r.created_at),
    assessmentType: str(r.assessment_type),
    riskTier: mapTier(r.ml_risk_tier),
    riskProb: fracToPct(r.ml_risk_probability),
    ctDiagnosis: mapDiagnosis(r.ct_diagnosis),
    agentStatus: v === 'PASSED' ? 'Verified' : v === 'FLAGGED' ? 'Flagged Review' : 'Pending Review',
    validationStatus: v,
    signedStatus: r.physician_signed_off ? 'Signed & Approved' : 'Pending Sign-off',
    summary: str(summary.summary),
    recommendationsEn: recs,
    recommendationsAr: recs,
    pdfFilename: r.pdf_filename ?? null,
    downloadUrl: `/api/clinical-portal/reports/${str(r.id)}/download`,
  };
}

export function mapThread(c: any): ChatThread {
  const cp = c.counterparty || {};
  const name = str(cp.full_name, cp.email);
  return {
    conversationId: str(c.id),
    patientId: str(cp.id),
    patientName: name,
    patientNameAr: name,
    counterpartyRole: str(cp.role, 'patient') as UserRole,
    mrn: str(cp.mrn, ''),
    specialty: cp.specialization ?? null,
    unreadCount: num(c.unread_count),
    lastUpdated: fmtDate(c.updated_at),
    lastMessage: str(c.last_message?.content),
    messages: [],
  };
}

export function mapMessage(
  m: any,
  me: { id: string; role: UserRole; name: string },
  other: { id: string; role: UserRole; name: string }
): ChatMessage {
  const mine = Boolean(m.is_mine);
  const who = mine ? me : other;
  return {
    id: str(m.id),
    senderId: str(m.sender_id),
    senderRole: who.role,
    senderName: who.name,
    senderNameAr: who.name,
    text: str(m.content),
    timestamp: fmtTime(m.created_at),
    isMine: mine,
  };
}

export function mapRequest(r: any): ConnectionRequest {
  return {
    id: str(r.id),
    counterpartyId: str(r.patient_id),
    name: str(r.patient_name, r.patient_email),
    email: str(r.patient_email),
    mrn: r.patient_mrn ?? null,
    relationshipType: r.relationship_type === 'care_team' ? 'care_team' : 'primary',
    status: str(r.status),
    initiatedBy: r.initiated_by === 'patient' ? 'patient' : 'doctor',
    createdAt: fmtDate(r.created_at),
    expiresAt: r.expires_at ? fmtDate(r.expires_at) : null,
  };
}

export function mapCareDoctor(d: any): CareTeamDoctor {
  return {
    doctorId: str(d.doctor_id),
    relationshipId: d.relationship_id ?? null,
    name: str(d.full_name, d.email),
    email: str(d.email),
    specialty: d.specialization ?? null,
    hospital: d.hospital ?? null,
    phone: d.phone ?? null,
    relationshipType: d.relationship_type ?? null,
    status: str(d.status, 'active'),
    conversationId: d.conversation_id ?? null,
    expiresAt: d.expires_at ? fmtDate(d.expires_at) : null,
  };
}

/** Patient-side view of a pending request (counterparty = doctor). */
export function mapCareRequest(d: any): ConnectionRequest {
  return {
    id: str(d.relationship_id),
    counterpartyId: str(d.doctor_id),
    name: str(d.full_name, d.email),
    email: str(d.email),
    specialty: d.specialization ?? null,
    hospital: d.hospital ?? null,
    relationshipType: d.relationship_type === 'care_team' ? 'care_team' : 'primary',
    status: str(d.status),
    initiatedBy: d.initiated_by === 'patient' ? 'patient' : 'doctor',
    createdAt: fmtDate(d.created_at),
    expiresAt: d.expires_at ? fmtDate(d.expires_at) : null,
  };
}

export function mapDirectoryDoctor(d: any): DoctorDirectoryEntry {
  return {
    doctorId: str(d.doctor_id),
    name: str(d.full_name, d.email),
    email: str(d.email),
    specialty: d.specialization ?? null,
    hospital: d.hospital ?? null,
    statusLabel: str(d.status_label, 'available'),
  };
}

export function mapDoctorStats(s: any): DoctorStats {
  return {
    doctorName: str(s.doctor_name),
    specialization: str(s.specialization),
    hospital: s.hospital ?? null,
    licenseNumber: s.license_number ?? null,
    totalPatients: num(s.total_patients),
    totalAssessments: num(s.total_assessments),
    pendingReports: num(s.pending_reports),
    signedReports: num(s.signed_reports),
    unreadMessages: num(s.unread_messages),
  };
}

export function mapPatientOverview(o: any): PatientOverview {
  const s = o.stats || {};
  return {
    mrn: str(o.patient?.mrn, '—'),
    doctor: o.doctor ? mapCareDoctor(o.doctor) : null,
    conversationId: o.conversation_id ?? null,
    stats: {
      totalAssessments: num(s.total_assessments),
      totalReports: num(s.total_reports),
      careTeamCount: num(s.care_team_count),
      pendingRequestsCount: num(s.pending_requests_count),
      unreadNotifications: num(s.unread_notifications),
      unreadMessages: num(s.unread_messages),
    },
  };
}

export function mapClinician(c: any): ClinicianApprovalRequest {
  const name = str(c.full_name, c.email);
  return {
    id: str(c.id),
    userId: str(c.user_id),
    name,
    nameAr: name,
    email: str(c.email),
    licenseNumber: str(c.license_number, '—'),
    specialty: str(c.specialization, '—'),
    specialtyAr: str(c.specialization, '—'),
    hospital: str(c.hospital_affiliation, '—'),
    hospitalAr: str(c.hospital_affiliation, '—'),
    phone: str(c.contact_phone, '—'),
    submittedAt: fmtDate(c.created_at),
    reviewedAt: c.reviewed_at ? fmtDate(c.reviewed_at) : null,
    reviewedBy: c.reviewed_by_name ?? null,
    status: mapAccountStatus(c.approval_status, c.is_active),
    verificationRef: c.verification_reference ?? undefined,
    notes: c.verification_notes ?? undefined,
    rejectionReason: c.rejection_reason ?? undefined,
    moreInfoRequest: c.more_info_request ?? undefined,
  };
}

export function mapSafetyItem(s: any): SafetyQueueItem {
  const status = str(s.safety_status);
  const name = str(s.patient_name, '—');
  const reason = str(s.alert_reason || s.flag_reason, '—');
  const doctor = str(s.doctor_name, '—');
  return {
    id: str(s.assessment_id ?? s.id),
    caseCode: `CASE-${str(s.assessment_id ?? s.id).slice(0, 8).toUpperCase()}`,
    patientId: str(s.patient_id),
    patientName: name,
    patientNameAr: name,
    mrn: str(s.patient_mrn, '—'),
    diagnosis: s.gatekeeper_status === 'rejected' ? 'rejected_non_brain' : mapDiagnosis(s.ct_diagnosis),
    riskTier: mapTier(s.ml_risk_tier),
    riskProb: fracToPct(s.ml_risk_probability),
    triggerReasonEn: reason,
    triggerReasonAr: reason,
    assignedDoctor: doctor,
    assignedDoctorAr: doctor,
    priority: s.priority === 'HIGH' ? 'HIGH' : s.priority === 'MEDIUM' ? 'MEDIUM' : 'NORMAL',
    status: status === 'resolved' ? 'Resolved' : status === 'under_review' || status === 'assigned' ? 'Under Investigation' : 'Open Alert',
    safetyStatus: status,
    timestamp: fmtDate(s.created_at),
    investigationNotes: s.safety_notes ?? undefined,
    pdfFilename: s.pdf_filename ?? null,
  };
}

export function mapQualified(c: any): QualifiedClinician {
  return {
    id: str(c.id),
    name: str(c.full_name, c.email),
    email: str(c.email),
    specialty: str(c.specialization, '—'),
    hospital: str(c.hospital_affiliation, '—'),
  };
}

export function mapAdminUser(u: any): UserProfile {
  const name = str(u.full_name, u.email);
  const di = u.doctor_info || {};
  const pi = u.patient_info || {};
  return {
    id: str(u.id),
    name,
    nameAr: name,
    email: str(u.email),
    role: str(u.role) as UserRole,
    status: u.role === 'doctor' ? mapAccountStatus(di.approval_status, u.is_active) : u.is_active ? 'active' : 'suspended',
    isActive: Boolean(u.is_active),
    createdAt: fmtDate(u.created_at),
    specialty: di.specialization ?? undefined,
    specialtyAr: di.specialization ?? undefined,
    hospital: di.hospital ?? undefined,
    hospitalAr: di.hospital ?? undefined,
    licenseNumber: di.license_number ?? undefined,
    mrn: pi.mrn ?? undefined,
    dob: pi.dob ?? undefined,
    gender: asGender(pi.gender),
    activeConnections: num(u.active_connections),
  };
}

const MODEL_PURPOSE: Record<string, [string, string]> = {
  door_gatekeeper: ['بوابة أمان تتحقق أن الصورة أشعة دماغ قبل التشخيص', 'Safety gate: verifies the image is a brain CT'],
  stroke_classifier: ['تصنيف الأشعة (طبيعي / نزيف / إقفار) مع خريطة Grad-CAM', 'CT classification (normal / bleeding / ischemia) with Grad-CAM'],
  ml_risk_model: ['تقدير خطر السكتة من 10 مؤشرات سريرية', 'Stroke risk estimation from 10 clinical features'],
  clinical_agents: ['وكلاء CrewAI للوقاية والطوارئ والتحقق والتقرير', 'CrewAI agents: prevention, emergency, validation, report'],
};

export function mapModel(m: any): AIModelTelemetry {
  const total = num(m.total_inferences);
  const failed = num(m.failed_inferences);
  const purpose = MODEL_PURPOSE[str(m.model_key)] || [str(m.display_name), str(m.display_name)];
  const st = str(m.status);
  return {
    id: str(m.id),
    key: str(m.model_key),
    name: str(m.display_name, m.model_key),
    version: str(m.model_version),
    architecture: str(m.architecture),
    purposeAr: purpose[0],
    purposeEn: purpose[1],
    inferencesCount: total,
    errorCount: failed,
    errorRatePercent: total > 0 ? Math.round((failed / total) * 1000) / 10 : 0,
    lastInferenceAt: m.last_inference_at ? fmtDate(m.last_inference_at) : null,
    status: st === 'active' ? 'Nominal' : st === 'offline' ? 'Offline' : 'Degraded',
  };
}

export function mapAudit(a: any): AuditLogEntry {
  const outcome = str(a.outcome, 'success').toLowerCase();
  const action = str(a.action);
  const critical = /suspend|reject|deactivat|delete/i.test(action);
  return {
    id: str(a.id),
    timestamp: fmtDate(a.created_at),
    actor: str(a.actor_email, 'system'),
    role: str(a.actor_role, 'system'),
    action,
    resource: str(a.target_resource, '—'),
    outcome,
    reason: a.reason ?? null,
    severity: outcome === 'failure' || outcome === 'denied' || outcome === 'error' ? 'critical' : critical ? 'warning' : 'info',
    payload: { ...(a.details || {}), client_ip: a.client_ip ?? null, reason: a.reason ?? null },
  };
}

export function mapIncident(i: any): SystemIncident {
  const st = str(i.status);
  const sev = str(i.severity, 'low');
  return {
    id: str(i.id),
    service: str(i.service_name),
    severity: (['low', 'medium', 'high', 'critical'].includes(sev) ? sev : 'low') as SystemIncident['severity'],
    type: str(i.incident_type),
    description: str(i.description),
    createdAt: fmtDate(i.created_at),
    status: st === 'resolved' ? 'Resolved' : st === 'investigating' ? 'Investigating' : 'Open',
  };
}

export function mapHealth(h: any): ServiceHealth[] {
  const services = h?.services || {};
  return Object.entries(services).map(([key, v]: [string, any]) => ({
    key,
    name: str(v?.name, key),
    status: (['healthy', 'degraded', 'unavailable'].includes(v?.status) ? v.status : 'degraded') as ServiceHealth['status'],
    details: str(v?.details),
    latencyMs: v?.latency_ms ?? null,
  }));
}

export function mapOverview(o: any): AdminOverview {
  const vb = o.volume_breakdown || {};
  return {
    activeDoctors: num(o.active_doctors),
    pendingClinicians: num(o.pending_clinicians),
    registeredPatients: num(o.registered_patients),
    totalAssessments: num(o.total_assessments),
    assessmentsToday: num(o.assessments_today),
    reportsAwaitingSignoff: num(o.reports_awaiting_signoff),
    safetyFlags: num(o.safety_flags),
    gateRejections: num(o.gate_rejections),
    openIncidents: num(o.open_incidents),
    volume: {
      ctScansTotal: num(vb.ct_scans_total),
      highRiskCount: num(vb.high_risk_count),
      highRiskRatePct: num(vb.high_risk_rate_pct),
      ischemicCount: num(vb.ischemic_count),
      hemorrhagicCount: num(vb.hemorrhagic_count),
      normalCount: num(vb.normal_count),
    },
    subsystems: (o.subsystem_health || []).map((s: any) => ({
      name: str(s.service_name),
      details: str(s.details),
      status: str(s.status),
    })),
    alerts: (o.attention_alerts || []).map((a: any) => ({
      title: str(a.title),
      message: str(a.message),
      // backend says admin-pane-clinicians; the React tab id is admin-pane-approvals
      actionTab: a.action_tab === 'admin-pane-clinicians' ? 'admin-pane-approvals' : str(a.action_tab),
    })),
    recentEvents: (o.recent_events || []).map((e: any) => ({
      id: str(e.id),
      createdAt: fmtDate(e.created_at),
      actor: str(e.actor),
      action: str(e.action),
      target: str(e.target),
      outcome: str(e.outcome),
    })),
    lastUpdated: fmtDate(o.last_updated),
  };
}

export function mapNotification(n: any): NotificationItem {
  const t = str(n.notification_type);
  return {
    id: str(n.id),
    titleEn: str(n.title),
    titleAr: str(n.title),
    bodyEn: str(n.message),
    bodyAr: str(n.message),
    time: fmtDate(n.created_at),
    read: Boolean(n.is_read),
    type: t === 'alert' ? 'alert' : t === 'new_message' ? 'message' : t === 'report_ready' || t === 'assessment_ready' ? 'report' : 'system',
    referenceId: n.reference_id ?? null,
  };
}
