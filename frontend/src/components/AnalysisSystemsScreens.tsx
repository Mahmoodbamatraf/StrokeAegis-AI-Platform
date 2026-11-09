import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  FileCheck2,
  ImageOff,
  Loader2,
  Network,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  UploadCloud,
  XCircle,
  Zap,
} from 'lucide-react';
import { useAppCore } from '../core/useAppCore';
import { CrewAgentState, CtSamplePreset, RiskTier, VascularInputProfile, VascularRiskResult } from '../core/types';
import { CtGradCamViewer, ctDiagnosisText, ctDiagnosisTone } from './CtGradCamViewer';
import { AnimatedCounter, CerebrovascularWaveSvg, SpotlightTiltCard } from './LuxuryMotion';
import { RobotMascot } from './RobotMascot';

type Translator = { t: (ar: string, en: string) => string };

/* ============================================================================
 * Shared helpers (report fields are LLM output: guard everything)
 * ========================================================================== */
function asText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(' · ');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const pick = o.text ?? o.recommendation ?? o.title ?? o.description ?? o.message ?? o.issue ?? o.name;
    if (pick != null) return asText(pick);
    return Object.values(o).map(asText).filter(Boolean).join(' — ');
  }
  return '';
}
function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(asText).filter(Boolean);
  const s = asText(v);
  return s ? [s] : [];
}

function tierText(tier: RiskTier | null | undefined, ui: Translator): string {
  if (tier === 'high') return ui.t('خطر مرتفع', 'High risk');
  if (tier === 'moderate') return ui.t('خطر متوسط', 'Moderate risk');
  if (tier === 'low') return ui.t('خطر منخفض', 'Low risk');
  return '—';
}
function tierColor(tier: RiskTier | null | undefined): string {
  return tier === 'high' ? '#DC2626' : tier === 'moderate' ? '#B45309' : '#047857';
}
function tierTextClass(tier: RiskTier | null | undefined): string {
  return tier === 'high'
    ? 'text-[#DC2626] dark:text-[#EF4444]'
    : tier === 'moderate'
      ? 'text-[#B45309] dark:text-[#F59E0B]'
      : 'text-[#047857] dark:text-[#10B981]';
}

const cardCls = 'rounded-2xl border border-[#D7E3E6] dark:border-[#1B3540] bg-white dark:bg-[#0C1B21]';
const fieldCls =
  'w-full h-11 px-3 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] text-xs';

/* ---------- The 10 inputs of the backend risk model ---------- */
const VitalsFields: React.FC<{
  idPrefix: string;
  input: VascularInputProfile;
  onChange: <K extends keyof VascularInputProfile>(field: K, value: VascularInputProfile[K]) => void;
  ui: Translator;
  gridCls?: string;
}> = ({ idPrefix, input, onChange, ui, gridCls = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4' }) => (
  <div className={gridCls}>
    <div>
      <label htmlFor={`${idPrefix}-gender`} className="block text-xs font-bold mb-1.5">{ui.t('1. الجنس *', '1. Gender *')}</label>
      <select id={`${idPrefix}-gender`} value={input.gender} onChange={(e) => onChange('gender', e.target.value as 'Male' | 'Female')} className={fieldCls}>
        <option value="Male">{ui.t('ذكر', 'Male')}</option>
        <option value="Female">{ui.t('أنثى', 'Female')}</option>
      </select>
    </div>
    <div>
      <label htmlFor={`${idPrefix}-age`} className="block text-xs font-bold mb-1.5">{ui.t('2. العمر (سنة) *', '2. Age (years) *')}</label>
      <input id={`${idPrefix}-age`} type="number" min={0} max={120} value={input.age} onChange={(e) => onChange('age', Number(e.target.value))} className={`${fieldCls} text-sm font-mono-tabular`} />
    </div>
    <div>
      <label htmlFor={`${idPrefix}-smoke`} className="block text-xs font-bold mb-1.5">{ui.t('3. حالة التدخين *', '3. Smoking status *')}</label>
      <select id={`${idPrefix}-smoke`} value={input.smoking_status} onChange={(e) => onChange('smoking_status', e.target.value as VascularInputProfile['smoking_status'])} className={fieldCls}>
        <option value="smokes">{ui.t('مدخن حالياً', 'Smokes')}</option>
        <option value="formerly smoked">{ui.t('مدخن سابق', 'Formerly smoked')}</option>
        <option value="never smoked">{ui.t('غير مدخن', 'Never smoked')}</option>
        <option value="Unknown">{ui.t('غير معروف', 'Unknown')}</option>
      </select>
    </div>
    <div>
      <label htmlFor={`${idPrefix}-married`} className="block text-xs font-bold mb-1.5">{ui.t('4. سبق له الزواج', '4. Ever married')}</label>
      <select id={`${idPrefix}-married`} value={input.ever_married} onChange={(e) => onChange('ever_married', e.target.value as 'Yes' | 'No')} className={fieldCls}>
        <option value="Yes">{ui.t('نعم', 'Yes')}</option>
        <option value="No">{ui.t('لا', 'No')}</option>
      </select>
    </div>
    <div>
      <label htmlFor={`${idPrefix}-work`} className="block text-xs font-bold mb-1.5">{ui.t('5. نوع العمل', '5. Work type')}</label>
      <select id={`${idPrefix}-work`} value={input.work_type} onChange={(e) => onChange('work_type', e.target.value as VascularInputProfile['work_type'])} className={fieldCls}>
        <option value="Private">{ui.t('قطاع خاص', 'Private')}</option>
        <option value="Self-employed">{ui.t('عمل حر', 'Self-employed')}</option>
        <option value="Govt_job">{ui.t('قطاع حكومي', 'Government job')}</option>
        <option value="children">{ui.t('طفل', 'Child')}</option>
        <option value="Never_worked">{ui.t('لم يعمل', 'Never worked')}</option>
      </select>
    </div>
    <div>
      <label htmlFor={`${idPrefix}-res`} className="block text-xs font-bold mb-1.5">{ui.t('6. نوع السكن', '6. Residence type')}</label>
      <select id={`${idPrefix}-res`} value={input.Residence_type} onChange={(e) => onChange('Residence_type', e.target.value as 'Urban' | 'Rural')} className={fieldCls}>
        <option value="Urban">{ui.t('حضري', 'Urban')}</option>
        <option value="Rural">{ui.t('ريفي', 'Rural')}</option>
      </select>
    </div>
    <div>
      <label htmlFor={`${idPrefix}-hyp`} className="block text-xs font-bold mb-1.5">{ui.t('7. ارتفاع ضغط الدم *', '7. Hypertension *')}</label>
      <select id={`${idPrefix}-hyp`} value={input.hypertension} onChange={(e) => onChange('hypertension', (Number(e.target.value) ? 1 : 0) as 0 | 1)} className={fieldCls}>
        <option value={1}>{ui.t('نعم', 'Yes')}</option>
        <option value={0}>{ui.t('لا', 'No')}</option>
      </select>
    </div>
    <div>
      <label htmlFor={`${idPrefix}-heart`} className="block text-xs font-bold mb-1.5">{ui.t('8. أمراض القلب *', '8. Heart disease *')}</label>
      <select id={`${idPrefix}-heart`} value={input.heart_disease} onChange={(e) => onChange('heart_disease', (Number(e.target.value) ? 1 : 0) as 0 | 1)} className={fieldCls}>
        <option value={1}>{ui.t('نعم', 'Yes')}</option>
        <option value={0}>{ui.t('لا', 'No')}</option>
      </select>
    </div>
    <div>
      <label htmlFor={`${idPrefix}-gluc`} className="block text-xs font-bold mb-1.5">{ui.t('9. متوسط الجلوكوز (mg/dL) *', '9. Avg glucose (mg/dL) *')}</label>
      <input id={`${idPrefix}-gluc`} type="number" step="0.1" value={input.avg_glucose_level} onChange={(e) => onChange('avg_glucose_level', Number(e.target.value))} className={`${fieldCls} text-sm font-mono-tabular`} />
    </div>
    <div>
      <label htmlFor={`${idPrefix}-bmi`} className="block text-xs font-bold mb-1.5">{ui.t('10. مؤشر كتلة الجسم *', '10. BMI (kg/m²) *')}</label>
      <input id={`${idPrefix}-bmi`} type="number" step="0.1" value={input.bmi} onChange={(e) => onChange('bmi', Number(e.target.value))} className={`${fieldCls} text-sm font-mono-tabular`} />
    </div>
  </div>
);

const PresetButtons: React.FC<{ onPick: (p: 'high' | 'moderate' | 'low') => void; ui: Translator; small?: boolean }> = ({ onPick, ui, small }) => {
  const base = small ? 'h-8 px-2.5' : 'h-10 px-3.5';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => onPick('high')} className={`${base} rounded-lg border border-[#DC2626]/40 bg-[#DC2626]/10 hover:bg-[#DC2626] hover:text-white text-[#DC2626] dark:text-[#EF4444] text-xs font-bold transition-colors cursor-pointer`}>
        {ui.t('مثال: خطر عالي', 'Example: high risk')}
      </button>
      <button type="button" onClick={() => onPick('moderate')} className={`${base} rounded-lg border border-[#B45309]/40 bg-[#B45309]/10 hover:bg-[#B45309] hover:text-white text-[#B45309] dark:text-[#F59E0B] text-xs font-bold transition-colors cursor-pointer`}>
        {ui.t('مثال: خطر متوسط', 'Example: moderate risk')}
      </button>
      <button type="button" onClick={() => onPick('low')} className={`${base} rounded-lg border border-[#047857]/40 bg-[#047857]/10 hover:bg-[#047857] hover:text-white text-[#047857] dark:text-[#10B981] text-xs font-bold transition-colors cursor-pointer`}>
        {ui.t('مثال: خطر منخفض', 'Example: low risk')}
      </button>
    </div>
  );
};

/* ---------- CT sample presets from /api/presets ---------- */
const CtPresetGrid: React.FC<{
  presets: CtSamplePreset[];
  loading: boolean;
  selectedId: string | null;
  disabled?: boolean;
  onPick: (id: string) => void;
  ui: Translator;
}> = ({ presets, loading, selectedId, disabled, onPick, ui }) => {
  if (loading && presets.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-[#5B6B7A] dark:text-[#8CA3AF] p-3">
        <Loader2 className="w-4 h-4 animate-spin" />
        {ui.t('جاري تحميل العينات...', 'Loading sample scans...')}
      </div>
    );
  }
  if (presets.length === 0) {
    return (
      <div className="text-xs text-[#5B6B7A] dark:text-[#8CA3AF] p-3 rounded-xl border border-dashed border-[#D7E3E6] dark:border-[#1B3540]">
        {ui.t('لا توجد عينات متاحة من الخادم. يمكنك رفع صورة بدلاً من ذلك.', 'No sample scans are available from the server. You can upload an image instead.')}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {presets.map((p) => {
        const selected = selectedId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(p.id)}
            className={`p-3 rounded-xl border text-start transition-all cursor-pointer flex gap-3 items-center disabled:opacity-50 disabled:cursor-not-allowed ${
              selected
                ? 'border-[#0E7490] dark:border-[#06B6D4] bg-[#0E7490]/10 dark:bg-[#06B6D4]/15'
                : 'border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#0E7490]/50'
            }`}
          >
            {p.previewUrl ? (
              <img src={p.previewUrl} alt="" className="w-12 h-12 rounded-lg object-cover bg-black shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-[#F0F6F7] dark:bg-[#11252D] shrink-0" />
            )}
            <div className="min-w-0 space-y-0.5">
              <div className="text-xs font-bold text-[#0F2A2E] dark:text-[#ECF6F8] truncate">{ui.t(p.titleAr, p.titleEn)}</div>
              {p.description && <div className="text-[11px] text-[#5B6B7A] dark:text-[#8CA3AF] line-clamp-2">{p.description}</div>}
              <div className={`text-[10px] font-semibold ${p.expectedGate === 'reject' ? 'text-[#DC2626]' : 'text-[#047857] dark:text-[#10B981]'}`}>
                {p.expectedGate === 'reject'
                  ? ui.t('اختبار رفض البوابة', 'Gate-rejection test')
                  : ui.t('أشعة دماغ', 'Brain CT')}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

/* ---------- Risk result card (Path A + wizard step 4) ---------- */
const RiskResultCard: React.FC<{ res: VascularRiskResult; ui: Translator; showRecommendations?: boolean }> = ({ res, ui, showRecommendations = true }) => (
  <div className="space-y-4 w-full">
    <div className="flex flex-col items-center text-center space-y-2">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="10" className="text-[#F0F6F7] dark:text-[#11252D]" />
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke={tierColor(res.tier)}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(Math.max(0, Math.min(100, res.probability)) / 100) * 314} 314`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold font-mono-tabular">
            <AnimatedCounter value={res.probability} decimals={1} suffix="%" />
          </span>
          <span className={`text-xs font-bold ${tierTextClass(res.tier)}`}>{tierText(res.tier, ui)}</span>
        </div>
      </div>
      {res.summaryEn && <p className="text-xs text-[#5B6B7A] dark:text-[#8CA3AF] max-w-md leading-relaxed">{ui.t(res.summaryAr, res.summaryEn)}</p>}
    </div>

    {res.factors.length > 0 && (
      <div className="space-y-2">
        <div className="text-xs font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">{ui.t('العوامل المساهمة', 'Contributing factors')}</div>
        {res.factors.map((f) => (
          <div key={f.id} className="p-2.5 rounded-xl border border-[#D7E3E6] dark:border-[#1B3540] text-xs space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">{ui.t(f.labelAr, f.labelEn)}</span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  f.severity === 'high'
                    ? 'bg-[#DC2626]/10 text-[#DC2626] dark:text-[#EF4444]'
                    : f.severity === 'moderate'
                      ? 'bg-[#B45309]/10 text-[#B45309] dark:text-[#F59E0B]'
                      : 'bg-[#047857]/10 text-[#047857] dark:text-[#10B981]'
                }`}
              >
                {f.severity === 'high' ? ui.t('مرتفع', 'High') : f.severity === 'moderate' ? ui.t('متوسط', 'Moderate') : ui.t('طبيعي', 'Normal')}
              </span>
            </div>
            {f.valueDisplay && <p className="text-[#5B6B7A] dark:text-[#8CA3AF] leading-relaxed">{f.valueDisplay}</p>}
          </div>
        ))}
      </div>
    )}

    {showRecommendations && res.recommendations.length > 0 && (
      <div className="space-y-1.5">
        <div className="text-xs font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">{ui.t('التوصيات', 'Recommendations')}</div>
        <ul className="list-disc ps-5 space-y-1 text-xs text-[#0F2A2E] dark:text-[#ECF6F8]">
          {res.recommendations.map((r, i) => (
            <li key={i} className="leading-relaxed">{r}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, icon, children, className = '' }) => (
  <div className={`p-5 ${cardCls} space-y-3 ${className}`}>
    <h3 className="text-sm font-extrabold text-[#0F2A2E] dark:text-[#ECF6F8] flex items-center gap-2">
      {icon}
      {title}
    </h3>
    {children}
  </div>
);

const Bullets: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="list-disc ps-5 space-y-1 text-xs text-[#0F2A2E] dark:text-[#ECF6F8]">
    {items.map((x, i) => (
      <li key={i} className="leading-relaxed">{x}</li>
    ))}
  </ul>
);

const LabeledText: React.FC<{ label: string; value: string }> = ({ label, value }) =>
  value ? (
    <div className="text-xs space-y-0.5">
      <div className="font-bold text-[#0E7490] dark:text-[#22D3EE]">{label}</div>
      <p className="text-[#0F2A2E] dark:text-[#ECF6F8] leading-relaxed whitespace-pre-line">{value}</p>
    </div>
  ) : null;

/* ============================================================================
 * 2.6 ANALYSIS SYSTEM CHOICE (`screen-home`)
 * ========================================================================== */
export const SystemSelectorScreen: React.FC = () => {
  const core = useAppCore();
  const { ui } = core;

  return (
    <div id="screen-home" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="max-w-2xl space-y-2 sa-luxury-enter">
        <div className="text-xs font-semibold text-[#0E7490] dark:text-[#22D3EE]">
          {ui.t('بوابات التحليل والتشخيص العصبي', 'Clinical Neuro-Diagnostic Workflows')}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F2A2E] dark:text-[#ECF6F8]">
          {ui.t('اختر مسار نظام التحليل السريري', 'Select Clinical Analysis System')}
        </h1>
        <p className="text-sm text-[#5B6B7A] dark:text-[#8CA3AF]">
          {ui.t(
            'اختر بين سير العمل الكامل بـ 4 خطوات مع وكلاء CrewAI، أو الوصول المباشر للنماذج المنفردة.',
            'Choose between the full 4-step workflow with CrewAI agents, or direct access to the standalone models.'
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <SpotlightTiltCard staggerIndex={1} tiltIntensity={3} accentGlow="teal" className="p-7 rounded-2xl border-2 border-[#0E7490] dark:border-[#06B6D4] bg-white dark:bg-[#0C1B21]">
          <div className="h-full flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#0E7490]/15 text-[#0E7490] dark:text-[#22D3EE] flex items-center justify-center">
                <Network className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-[#0E7490] dark:text-[#22D3EE]">
                {ui.t('الخيار 1 — المسار المتكامل الموصى به', 'Option 1 — Full Multimodal Pipeline')}
              </div>
              <h2 className="text-xl font-extrabold text-[#0F2A2E] dark:text-[#ECF6F8]">
                {ui.t('نظام الذكاء الاصطناعي المتكامل (4 خطوات + CrewAI)', '4-Step Clinical AI System (with CrewAI agents)')}
              </h2>
              <p className="text-xs sm:text-sm text-[#5B6B7A] dark:text-[#8CA3AF] leading-relaxed">
                {ui.t(
                  'يبدأ بملف المريض (10 مؤشرات)، ثم صورة الأشعة المقطعية عبر بوابة ConvNeXt ومصنّف EfficientNetV2 مع خريطة Grad-CAM، ثم متابعة الوكلاء مباشرة، وصولاً إلى التقرير السريري النهائي.',
                  'Patient profile (10 inputs), CT through the ConvNeXt gate and EfficientNetV2 classifier with Grad-CAM, live agent monitoring, and the final clinical report.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => core.navigate('screen-ai-system')}
              className="h-12 px-6 rounded-[10px] bg-[#0E7490] hover:bg-[#0B5C73] text-white text-sm font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>{ui.t('تشغيل نظام الذكاء الاصطناعي', 'Launch 4-Step AI System')}</span>
            </button>
          </div>
        </SpotlightTiltCard>

        <SpotlightTiltCard staggerIndex={2} tiltIntensity={3} accentGlow="emerald" className="p-7 rounded-2xl border border-[#D7E3E6] dark:border-[#1B3540] bg-white dark:bg-[#0C1B21]">
          <div className="h-full flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#047857]/15 text-[#047857] dark:text-[#10B981] flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-[#047857] dark:text-[#10B981]">
                {ui.t('الخيار 2 — النماذج المباشرة السريعة', 'Option 2 — Direct Standalone Models')}
              </div>
              <h2 className="text-xl font-extrabold text-[#0F2A2E] dark:text-[#ECF6F8]">
                {ui.t('النظام العادي (المسار A للخطر | المسار B للأشعة)', 'Regular System (Path A Risk ML | Path B CT Scan)')}
              </h2>
              <p className="text-xs sm:text-sm text-[#5B6B7A] dark:text-[#8CA3AF] leading-relaxed">
                {ui.t(
                  'وصول مباشر إما لنموذج حساب خطر السكتة، أو لتشخيص صور الأشعة المقطعية مع خريطة Grad-CAM.',
                  'Direct access to either Path A (stroke risk model) or Path B (CT gate + classifier with Grad-CAM).'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => core.navigate('screen-regular-system')}
              className="h-12 px-6 rounded-[10px] border border-[#0E7490] dark:border-[#06B6D4] text-[#0E7490] dark:text-[#22D3EE] hover:bg-[#0E7490] hover:text-white text-sm font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Activity className="w-4 h-4" />
              <span>{ui.t('اختر المسار المباشر', 'Select Direct Model Path')}</span>
            </button>
          </div>
        </SpotlightTiltCard>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2.7 4-STEP CLINICAL AI WIZARD (`screen-ai-system`)
 * ========================================================================== */
const agentStatusText = (a: CrewAgentState, ui: Translator) =>
  a.status === 'done'
    ? ui.t('مكتمل', 'Done')
    : a.status === 'failed'
      ? ui.t('فشل', 'Failed')
      : a.status === 'running'
        ? ui.t('قيد التشغيل', 'Running')
        : ui.t('في الانتظار', 'Queued');

export const AiWizardScreen: React.FC = () => {
  const core = useAppCore();
  const { ui } = core;
  const wiz = core.getWizardState();
  const input = wiz.vascularInput;
  const presets = core.getCtPresets();
  const presetsLoading = core.isLoading('presets');
  const logRef = useRef<HTMLDivElement>(null);
  const isAr = ui.getLanguage() === 'ar';

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [wiz.activityLogs.length]);

  const steps = [
    { num: 1 as const, labelAr: '1. ملف المريض', labelEn: '1. Patient Profile', enabled: true },
    { num: 2 as const, labelAr: '2. صورة الأشعة المقطعية', labelEn: '2. Brain CT Scan', enabled: true },
    { num: 3 as const, labelAr: '3. مراقبة الوكلاء', labelEn: '3. Agent Monitor', enabled: !!wiz.pipelineId },
    { num: 4 as const, labelAr: '4. حزمة القرار السريري', labelEn: '4. Decision Package', enabled: !!wiz.report },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      core.toast('error', 'الرجاء اختيار ملف صورة (PNG أو JPG).', 'Please choose an image file (PNG or JPG).');
      return;
    }
    core.selectWizardCtFile(file);
  };

  const doneCount = wiz.agents.filter((a) => a.status === 'done').length;
  const runningAgent = wiz.agents.find((a) => a.status === 'running');

  const NextIcon = isAr ? ArrowLeft : ArrowRight;

  return (
    <div id="screen-ai-system" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header + stepper */}
      <div className={`p-6 ${cardCls} space-y-5 shadow-xs`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#0E7490] dark:text-[#22D3EE]">
                {ui.t('معالج الذكاء الاصطناعي السريري المتعدد الوسائط', 'Multimodal Clinical AI Wizard')}
              </span>
              <CerebrovascularWaveSvg className="hidden sm:block" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F2A2E] dark:text-[#ECF6F8]">
              {ui.t('نظام الذكاء الاصطناعي — التحليل المتكامل (4 خطوات)', 'StrokeAegis 4-Step Clinical System')}
            </h1>
          </div>
          {wiz.targetPatient && (
            <div className="text-xs font-mono-tabular px-3.5 py-2 rounded-xl bg-[#F0F6F7] dark:bg-[#11252D] border border-[#D7E3E6] dark:border-[#1B3540]">
              {ui.t('المريض الحالي:', 'Active patient:')}{' '}
              <strong className="text-[#0E7490] dark:text-[#22D3EE]">
                {ui.t(wiz.targetPatient.nameAr, wiz.targetPatient.name)} ({wiz.targetPatient.mrn})
              </strong>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((s) => {
            const active = wiz.step === s.num;
            const completed = wiz.step > s.num;
            return (
              <button
                key={s.num}
                type="button"
                disabled={!s.enabled}
                onClick={() => core.setWizardStep(s.num)}
                className={`h-12 px-4 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? 'border-[#0E7490] dark:border-[#06B6D4] bg-[#0E7490] text-white scale-[1.01] shadow-xs'
                    : completed
                      ? 'border-[#047857]/50 bg-[#047857]/10 text-[#047857] dark:text-[#10B981]'
                      : 'border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] text-[#5B6B7A] dark:text-[#8CA3AF]'
                }`}
              >
                <span className="truncate">{ui.t(s.labelAr, s.labelEn)}</span>
                {completed && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 1: PATIENT PROFILE */}
      {wiz.step === 1 && (
        <div className={`p-6 sm:p-8 ${cardCls} space-y-6 sa-animate-in`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#D7E3E6] dark:border-[#1B3540] pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#0F2A2E] dark:text-[#ECF6F8]">
                {ui.t('الخطوة 1: البيانات السريرية للمريض (10 حقول)', 'Step 1: Patient Clinical Profile (10 fields)')}
              </h2>
              <p className="text-xs text-[#5B6B7A] dark:text-[#8CA3AF] mt-0.5">
                {ui.t('عبّئ القيم أو استخدم مثالاً جاهزاً لتعبئة النموذج.', 'Fill in the values or use an example to pre-fill the form.')}
              </p>
            </div>
            <PresetButtons onPick={(p) => core.applyWizardPreset(p)} ui={ui} />
          </div>

          <VitalsFields idPrefix="w" input={input} onChange={(f, v) => core.updateWizardVascularField(f, v)} ui={ui} />

          <div className="pt-4 border-t border-[#D7E3E6] dark:border-[#1B3540] flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs flex items-center gap-2">
              <span>{ui.t('تقدير الخطر المبدئي (نموذج حقيقي):', 'Live risk preview (real model):')}</span>
              {wiz.vascularResult ? (
                <span className={`font-mono-tabular font-extrabold text-sm ${tierTextClass(wiz.vascularResult.tier)}`}>
                  {wiz.vascularResult.probability.toFixed(1)}% · {tierText(wiz.vascularResult.tier, ui)}
                </span>
              ) : (
                <span className="font-mono-tabular font-extrabold text-sm text-[#5B6B7A]">—</span>
              )}
              {wiz.previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0E7490]" aria-label={ui.t('جاري الحساب', 'Calculating')} />}
            </div>
            <button
              type="button"
              onClick={() => core.setWizardStep(2)}
              className="h-12 px-6 rounded-[10px] bg-[#0E7490] hover:bg-[#0B5C73] text-white text-sm font-bold flex items-center gap-2 cursor-pointer"
            >
              <span>{ui.t('التالي: صورة الأشعة المقطعية', 'Next: Brain CT Scan')}</span>
              <NextIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: CT */}
      {wiz.step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sa-animate-in">
          <div className={`lg:col-span-7 p-6 ${cardCls} space-y-5`}>
            <h2 className="text-lg font-extrabold text-[#0F2A2E] dark:text-[#ECF6F8]">
              {ui.t('الخطوة 2: رفع أو اختيار صورة الأشعة المقطعية للدماغ', 'Step 2: Upload or choose a brain CT image')}
            </h2>

            <label
              htmlFor="ct-file-upload"
              className={`block p-6 rounded-2xl border-2 border-dashed border-[#0E7490]/40 hover:border-[#0E7490] bg-[#F7FAFA] dark:bg-[#11252D] text-center transition-colors ${wiz.running ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
            >
              <UploadCloud className="w-8 h-8 text-[#0E7490] dark:text-[#22D3EE] mx-auto mb-2" />
              <div className="text-xs font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">
                {ui.t('اضغط لاختيار صورة أشعة مقطعية (PNG / JPG)', 'Click to choose a CT image (PNG / JPG)')}
              </div>
              {wiz.ct?.source === 'upload' && (
                <div className="text-xs font-mono-tabular text-[#047857] mt-1">
                  {ui.t('الملف المرفوع:', 'Uploaded:')} {wiz.ct.fileName}
                </div>
              )}
              <input id="ct-file-upload" type="file" accept="image/*" onChange={handleFileUpload} className="hidden" disabled={wiz.running} />
            </label>

            <div className="space-y-2.5">
              <div className="text-xs font-bold text-[#5B6B7A] dark:text-[#8CA3AF]">
                {ui.t('أو اختر إحدى العينات الجاهزة من الخادم:', 'Or choose one of the server sample scans:')}
              </div>
              <CtPresetGrid
                presets={presets}
                loading={presetsLoading}
                selectedId={wiz.ct?.presetId ?? null}
                disabled={wiz.running}
                onPick={(id) => void core.selectWizardCtSample(id)}
                ui={ui}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#F7FAFA] dark:bg-[#11252D] border border-[#D7E3E6] dark:border-[#1B3540] text-xs">
              <span className="text-[#0F2A2E] dark:text-[#ECF6F8]">
                {wiz.ct
                  ? ui.t(`الصورة المختارة: ${wiz.ct.fileName}`, `Selected image: ${wiz.ct.fileName}`)
                  : ui.t('لم يتم اختيار صورة — سيعمل التحليل على المؤشرات السريرية فقط.', 'No image selected — the analysis will use the clinical vitals only.')}
              </span>
              {wiz.ct && (
                <button
                  type="button"
                  disabled={wiz.running}
                  onClick={() => core.clearWizardCt()}
                  className="h-8 px-3 rounded-lg border border-[#D7E3E6] dark:border-[#1B3540] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ImageOff className="w-3.5 h-3.5" />
                  {ui.t('التحليل بدون صورة', 'Run without CT')}
                </button>
              )}
            </div>

            {wiz.error && !wiz.running && (
              <div role="alert" className="p-3 rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/10 text-[#DC2626] dark:text-[#FCA5A5] text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {ui.t('تعذّر بدء التحليل: ', 'Could not start the analysis: ')}
                  {wiz.error}
                </span>
              </div>
            )}

            <div className="pt-3 flex items-center justify-between gap-3">
              <button type="button" onClick={() => core.setWizardStep(1)} className="h-11 px-4 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] text-xs font-bold cursor-pointer">
                {ui.t('السابق: ملف المريض', 'Back: Patient Profile')}
              </button>
              <button
                type="button"
                disabled={wiz.running}
                onClick={() => void core.executeWizardFullAnalysis()}
                className="h-12 px-6 rounded-[10px] bg-[#0E7490] hover:bg-[#0B5C73] text-white text-sm font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {wiz.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>{wiz.running ? ui.t('جاري البدء...', 'Starting...') : ui.t('تشغيل التحليل الكامل', 'Run Full Analysis')}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <CtGradCamViewer previewUrl={wiz.ct?.previewUrl ?? null} fileName={wiz.ct?.fileName ?? null} />
          </div>
        </div>
      )}

      {/* STEP 3: LIVE AGENTS */}
      {wiz.step === 3 && (
        <div className="space-y-6 sa-animate-in">
          {wiz.error && (
            <div role="alert" className="p-5 rounded-2xl border border-[#DC2626] bg-[#DC2626]/10 text-[#DC2626] dark:text-[#FCA5A5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-extrabold">{ui.t('توقف التحليل بسبب خطأ', 'The analysis stopped with an error')}</div>
                  <p className="text-xs mt-1 break-words">{wiz.error}</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => void core.executeWizardFullAnalysis()} className="h-10 px-4 rounded-lg bg-[#DC2626] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  {ui.t('إعادة المحاولة', 'Retry')}
                </button>
                <button type="button" onClick={() => core.setWizardStep(2)} className="h-10 px-4 rounded-lg border border-[#DC2626] text-xs font-bold cursor-pointer">
                  {ui.t('تغيير المدخلات', 'Change inputs')}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {(wiz.running || !wiz.report) && !wiz.error && (
              <div className={`lg:col-span-3 p-5 ${cardCls} flex flex-col items-center justify-center text-center gap-3`}>
                <RobotMascot
                  variant="full"
                  mood="thinking"
                  size={140}
                  message={
                    runningAgent
                      ? ui.t(`${runningAgent.nameAr} يعمل الآن...`, `${runningAgent.nameEn} is working...`)
                      : ui.t('جاري تجهيز الوكلاء...', 'Preparing the agents...')
                  }
                />
                <div className="text-xs font-mono-tabular text-[#5B6B7A] dark:text-[#8CA3AF]">
                  {ui.t(`اكتمل ${doneCount} من ${wiz.agents.length}`, `${doneCount} of ${wiz.agents.length} complete`)}
                </div>
              </div>
            )}

            <div className={`${(wiz.running || !wiz.report) && !wiz.error ? 'lg:col-span-9' : 'lg:col-span-12'} grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`}>
              {wiz.agents.map((agent, idx) => {
                const isDone = agent.status === 'done';
                const isFailed = agent.status === 'failed';
                const isRunning = agent.status === 'running';
                const pct = Math.max(0, Math.min(100, Math.round(agent.progress)));
                return (
                  <SpotlightTiltCard
                    key={agent.id}
                    delayIndex={idx + 1}
                    glowColor={isDone ? 'emerald' : isFailed ? 'crimson' : 'teal'}
                    className="p-5 rounded-2xl border border-[#D7E3E6] dark:border-[#1B3540] bg-white dark:bg-[#0C1B21] flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono-tabular font-bold text-[#0E7490] dark:text-[#22D3EE]">
                          {ui.t(`المرحلة ${idx + 1}`, `Stage ${idx + 1}`)}
                        </span>
                        <span
                          className={`font-bold flex items-center gap-1 ${
                            isDone
                              ? 'text-[#047857] dark:text-[#10B981]'
                              : isFailed
                                ? 'text-[#DC2626] dark:text-[#EF4444]'
                                : isRunning
                                  ? 'text-[#B45309]'
                                  : 'text-[#5B6B7A] dark:text-[#8CA3AF]'
                          }`}
                        >
                          {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
                          {isDone && <CheckCircle2 className="w-3 h-3" />}
                          {isFailed && <XCircle className="w-3 h-3" />}
                          {agentStatusText(agent, ui)}
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-[#0F2A2E] dark:text-[#ECF6F8]">{ui.t(agent.nameAr, agent.nameEn)}</h3>
                      <div className="text-[11px] text-[#5B6B7A] dark:text-[#8CA3AF]">{ui.t(agent.roleAr, agent.roleEn)}</div>
                      <p className="text-xs text-[#0F2A2E] dark:text-[#ECF6F8] pt-2 border-t border-[#D7E3E6] dark:border-[#1B3540] leading-relaxed min-h-[2.5rem]">
                        {ui.t(agent.outputAr, agent.outputEn) || <span className="text-[#5B6B7A] dark:text-[#8CA3AF]">—</span>}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono-tabular text-[#5B6B7A] dark:text-[#8CA3AF]">
                        <span>{ui.t('التقدم', 'Progress')}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#F0F6F7] dark:bg-[#11252D] overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${isDone ? 'bg-[#047857]' : isFailed ? 'bg-[#DC2626]' : 'bg-[#0E7490]'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </SpotlightTiltCard>
                );
              })}
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-[#D7E3E6] dark:border-[#1B3540] bg-[#091318] text-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono-tabular font-bold text-[#22D3EE] flex items-center gap-2">
                {wiz.running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {ui.t('سجل نشاط الوكلاء المباشر', 'Live agent activity log')}
                {wiz.pipelineId && <span className="text-slate-500">· {wiz.pipelineId}</span>}
              </span>
              {wiz.report && (
                <button type="button" onClick={() => core.setWizardStep(4)} className="h-10 px-4 rounded-lg bg-[#0E7490] hover:bg-[#0B5C73] text-white text-xs font-bold cursor-pointer flex items-center gap-1.5">
                  {ui.t('عرض حزمة القرار السريري', 'Open Clinical Decision Package')}
                  <NextIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div ref={logRef} dir="ltr" className="font-mono-tabular text-xs space-y-1.5 text-slate-300 max-h-64 overflow-y-auto text-left">
              {wiz.activityLogs.length === 0 ? (
                <div className="text-slate-500">{ui.t('بانتظار أول حدث من الخادم...', 'Waiting for the first server event...')}</div>
              ) : (
                wiz.activityLogs.map((line, i) => (
                  <div key={i} className={line.includes('ERROR') ? 'text-red-300' : ''}>
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: DECISION PACKAGE */}
      {wiz.step === 4 && (wiz.report ? <DecisionPackage /> : (
        <div className={`p-8 ${cardCls} text-center text-sm text-[#5B6B7A] dark:text-[#8CA3AF]`}>
          {ui.t('لا يوجد تقرير بعد. شغّل التحليل أولاً.', 'No report yet. Run the analysis first.')}
        </div>
      ))}
    </div>
  );
};

/* ---------- Step 4: the real MedicalReport ---------- */
const DecisionPackage: React.FC = () => {
  const core = useAppCore();
  const { ui } = core;
  const wiz = core.getWizardState();
  const report = wiz.report!;
  const risk = wiz.vascularResult;
  const ct = wiz.ctResult;

  const prev = (report.prevention_support || {}) as Record<string, unknown>;
  const emer = (report.emergency_support || {}) as Record<string, unknown>;
  const val = (report.validation || {}) as Record<string, unknown>;

  const valStatus = asText(val.status).toUpperCase();
  const valTone =
    valStatus === 'PASSED'
      ? { cls: 'border-[#047857]/40 bg-[#047857]/10 text-[#047857] dark:text-[#10B981]', icon: <ShieldCheck className="w-4 h-4" />, label: ui.t('اجتاز التحقق', 'Validation passed') }
      : valStatus === 'PASSED_WITH_WARNINGS'
        ? { cls: 'border-[#B45309]/40 bg-[#B45309]/10 text-[#B45309] dark:text-[#F59E0B]', icon: <AlertTriangle className="w-4 h-4" />, label: ui.t('اجتاز التحقق مع تحذيرات', 'Validation passed with warnings') }
        : valStatus === 'FAILED'
          ? { cls: 'border-[#DC2626]/40 bg-[#DC2626]/10 text-[#DC2626] dark:text-[#EF4444]', icon: <ShieldAlert className="w-4 h-4" />, label: ui.t('فشل التحقق — يلزم مراجعة الطبيب', 'Validation failed — clinician review required') }
          : { cls: 'border-[#D7E3E6] dark:border-[#1B3540] text-[#5B6B7A] dark:text-[#8CA3AF]', icon: <ShieldAlert className="w-4 h-4" />, label: ui.t('حالة التحقق غير متوفرة', 'Validation status unavailable') };

  const strokeOnCt = ct?.diagnosis === 'hemorrhagic' || ct?.diagnosis === 'ischemic';
  const keyRecs = asList(report.key_recommendations);
  const lifestyle = asList(prev.lifestyle_recommendations);
  const prevWarnings = asList(prev.warnings);
  const hyperacute = asList(emer.hyperacute_management);
  const monitoring = asList(emer.monitoring_and_neurosurgical_actions);
  const contraFlags = asList(emer.contraindication_flags);
  const critical = asList(val.critical_issues);
  const warnings = asList(val.warnings);
  const contradictions = asList(val.contradictions_detected);
  const refs = asList(report.guideline_references);

  const emergencyBody = (
    <div className="space-y-3">
      <LabeledText label={ui.t('الملخص الحاد', 'Acute summary')} value={asText(emer.acute_clinical_summary)} />
      <LabeledText label={ui.t('نوع السكتة المكتشف', 'Detected stroke type')} value={asText(emer.detected_stroke_type)} />
      {hyperacute.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-bold text-[#0E7490] dark:text-[#22D3EE]">{ui.t('التدبير في المرحلة فائقة الحدة', 'Hyperacute management')}</div>
          <Bullets items={hyperacute} />
        </div>
      )}
      <LabeledText label={ui.t('اعتبارات إذابة الجلطة', 'Thrombolysis considerations')} value={asText(emer.thrombolysis_eligibility_considerations)} />
      <LabeledText label={ui.t('اعتبارات استخراج الجلطة', 'Mechanical thrombectomy considerations')} value={asText(emer.mechanical_thrombectomy_considerations)} />
      <LabeledText label={ui.t('إدارة ضغط الدم', 'Blood pressure management')} value={asText(emer.blood_pressure_management)} />
      {monitoring.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-bold text-[#0E7490] dark:text-[#22D3EE]">{ui.t('المراقبة والإجراءات الجراحية', 'Monitoring & neurosurgical actions')}</div>
          <Bullets items={monitoring} />
        </div>
      )}
      {contraFlags.length > 0 && (
        <div className="p-3 rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/10 space-y-1">
          <div className="text-xs font-bold text-[#DC2626] dark:text-[#EF4444]">{ui.t('موانع الاستعمال', 'Contraindication flags')}</div>
          <Bullets items={contraFlags} />
        </div>
      )}
    </div>
  );
  const emergencyHasContent = Object.values(emer).some((v) => asText(v));

  return (
    <div className="space-y-6 sa-animate-in">
      {/* Header */}
      <div className={`p-6 ${cardCls} flex flex-wrap items-center justify-between gap-4`}>
        <div className="space-y-1.5">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${valTone.cls}`}>
            {valTone.icon}
            {valTone.label}
          </div>
          <h2 className="text-xl font-extrabold text-[#0F2A2E] dark:text-[#ECF6F8]">{ui.t('حزمة القرار السريري', 'Clinical Decision Package')}</h2>
          <div className="text-[11px] font-mono-tabular text-[#5B6B7A] dark:text-[#8CA3AF]">
            {report.report_id}
            {report.generated_at ? ` · ${report.generated_at}` : ''}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {wiz.pdfUrl ? (
            <a href={wiz.pdfUrl} download className="h-10 px-4 rounded-[10px] bg-[#0E7490] hover:bg-[#0B5C73] text-white text-xs font-bold flex items-center gap-2">
              <Download className="w-3.5 h-3.5" />
              <span>{ui.t('تحميل التقرير PDF', 'Download PDF report')}</span>
            </a>
          ) : (
            <span className="text-xs text-[#5B6B7A] dark:text-[#8CA3AF]">{ui.t('ملف PDF غير متوفر', 'PDF not available')}</span>
          )}
          <button
            type="button"
            onClick={() => core.launchAiWizardForPatient(wiz.targetPatientId ?? null)}
            className="h-10 px-3.5 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{ui.t('تحليل جديد', 'New analysis')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column */}
        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D]">
              <div className="text-xs text-[#5B6B7A] dark:text-[#8CA3AF]">{ui.t('احتمالية السكتة (نموذج ML)', 'Stroke probability (ML model)')}</div>
              {risk ? (
                <div className={`text-2xl font-extrabold font-mono-tabular mt-1 ${tierTextClass(risk.tier)}`}>
                  <AnimatedCounter value={risk.probability} decimals={1} suffix="%" />
                  <span className="text-sm ms-2">{tierText(risk.tier, ui)}</span>
                </div>
              ) : (
                <div className="text-2xl font-extrabold mt-1">—</div>
              )}
            </div>
            <div className="p-4 rounded-xl border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D]">
              <div className="text-xs text-[#5B6B7A] dark:text-[#8CA3AF]">{ui.t('نتيجة الأشعة المقطعية', 'CT result')}</div>
              <div className={`text-base font-extrabold mt-1 ${ctDiagnosisTone(ct?.diagnosis ?? null)}`}>
                {ct ? (ct.diagnosis ? ctDiagnosisText(ct.diagnosis, ui) : ct.gatePassed ? ui.t('التصنيف غير متاح', 'Classification unavailable') : ctDiagnosisText(null, ui)) : '—'}
                {ct && ct.gatePassed && ct.diagnosis && (
                  <span className="text-sm font-mono-tabular ms-2">({ct.confidence.toFixed(1)}%)</span>
                )}
              </div>
            </div>
          </div>

          {asText(report.overall_clinical_summary) && (
            <Section title={ui.t('الملخص السريري العام', 'Overall clinical summary')} icon={<FileCheck2 className="w-4 h-4 text-[#0E7490]" />}>
              <p className="text-xs text-[#0F2A2E] dark:text-[#ECF6F8] leading-relaxed whitespace-pre-line">{asText(report.overall_clinical_summary)}</p>
            </Section>
          )}

          {keyRecs.length > 0 && (
            <Section title={ui.t('التوصيات الرئيسية', 'Key recommendations')} icon={<CheckCircle2 className="w-4 h-4 text-[#047857]" />}>
              <Bullets items={keyRecs} />
            </Section>
          )}

          {risk && (
            <Section title={ui.t('تقييم الخطر الوعائي', 'Vascular risk assessment')} icon={<Activity className="w-4 h-4 text-[#0E7490]" />}>
              <RiskResultCard res={risk} ui={ui} showRecommendations={false} />
            </Section>
          )}

          {Object.keys(prev).length > 0 && (
            <Section title={ui.t('دعم الوقاية (وكيل الوقاية)', 'Prevention support (prevention agent)')} icon={<ShieldCheck className="w-4 h-4 text-[#047857]" />}>
              <div className="space-y-3">
                <LabeledText label={ui.t('تفسير الخطر', 'Risk interpretation')} value={asText(prev.risk_interpretation)} />
                <LabeledText label={ui.t('ملخص خطر المريض', 'Patient risk summary')} value={asText(prev.patient_risk_summary)} />
                {lifestyle.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[#0E7490] dark:text-[#22D3EE]">{ui.t('توصيات نمط الحياة', 'Lifestyle recommendations')}</div>
                    <Bullets items={lifestyle} />
                  </div>
                )}
                <LabeledText label={ui.t('إرشادات ضغط الدم', 'Blood pressure guidance')} value={asText(prev.blood_pressure_guidance)} />
                <LabeledText label={ui.t('إرشادات سكر الدم', 'Glycemic guidance')} value={asText(prev.glycemic_guidance)} />
                <LabeledText label={ui.t('الدهون ومضادات الصفيحات', 'Lipid & antiplatelet guidance')} value={asText(prev.lipid_and_antiplatelet_guidance)} />
                {prevWarnings.length > 0 && (
                  <div className="p-3 rounded-xl border border-[#B45309]/40 bg-[#B45309]/10 space-y-1">
                    <div className="text-xs font-bold text-[#B45309] dark:text-[#F59E0B]">{ui.t('تحذيرات', 'Warnings')}</div>
                    <Bullets items={prevWarnings} />
                  </div>
                )}
              </div>
            </Section>
          )}

          {emergencyHasContent &&
            (strokeOnCt ? (
              <Section
                title={ui.t('دعم الطوارئ (سكتة ظاهرة في الأشعة)', 'Emergency support (stroke seen on CT)')}
                icon={<Siren className="w-4 h-4 text-[#DC2626]" />}
                className="border-[#DC2626]/50"
              >
                {emergencyBody}
              </Section>
            ) : (
              <details className={`p-5 ${cardCls}`}>
                <summary className="text-sm font-extrabold text-[#0F2A2E] dark:text-[#ECF6F8] cursor-pointer flex items-center gap-2">
                  <Siren className="w-4 h-4 text-[#5B6B7A]" />
                  {ui.t('دعم الطوارئ (لم تظهر سكتة حادة في الأشعة)', 'Emergency support (no acute stroke on CT)')}
                </summary>
                <div className="pt-3">{emergencyBody}</div>
              </details>
            ))}
        </div>

        {/* Right column */}
        <div className="lg:col-span-5 space-y-6">
          {ct && ct.diagnosis === null && !ct.gatePassed ? (
            <div className={`p-5 ${cardCls} text-xs text-[#5B6B7A] dark:text-[#8CA3AF] flex items-center gap-2`}>
              <ImageOff className="w-4 h-4" />
              {ui.t('لم تُرفق صورة أشعة بهذا التحليل.', 'No CT image was attached to this analysis.')}
            </div>
          ) : (
            <CtGradCamViewer previewUrl={wiz.ct?.previewUrl ?? null} fileName={wiz.ct?.fileName ?? null} result={ct} />
          )}

          <Section title={ui.t('تدقيق السلامة (وكيل التحقق)', 'Safety audit (validation agent)')} icon={valTone.icon}>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${valTone.cls}`}>
              {valTone.label}
            </div>
            {critical.length > 0 && (
              <div className="p-3 rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/10 space-y-1">
                <div className="text-xs font-bold text-[#DC2626] dark:text-[#EF4444]">{ui.t('مشكلات حرجة', 'Critical issues')}</div>
                <Bullets items={critical} />
              </div>
            )}
            {contradictions.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-bold text-[#B45309] dark:text-[#F59E0B]">{ui.t('تناقضات مكتشفة', 'Contradictions detected')}</div>
                <Bullets items={contradictions} />
              </div>
            )}
            {warnings.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-bold text-[#B45309] dark:text-[#F59E0B]">{ui.t('تحذيرات', 'Warnings')}</div>
                <Bullets items={warnings} />
              </div>
            )}
            {critical.length === 0 && warnings.length === 0 && contradictions.length === 0 && (
              <p className="text-xs text-[#5B6B7A] dark:text-[#8CA3AF]">{ui.t('لم يُبلّغ عن مشكلات.', 'No issues were reported.')}</p>
            )}
            {val.clinician_signoff_required !== false && (
              <p className="text-[11px] font-semibold text-[#0E7490] dark:text-[#22D3EE]">
                {ui.t('يلزم توقيع الطبيب المعالج قبل الاعتماد.', 'Clinician sign-off is required before use.')}
              </p>
            )}
          </Section>

          {refs.length > 0 && (
            <Section title={ui.t('المراجع والإرشادات', 'Guideline references')} icon={<BookOpen className="w-4 h-4 text-[#0E7490]" />}>
              <Bullets items={refs} />
            </Section>
          )}

          {asText(report.clinical_disclaimer) && (
            <div className="p-4 rounded-2xl border border-[#B45309]/30 bg-[#B45309]/5 text-[11px] text-[#5B6B7A] dark:text-[#8CA3AF] leading-relaxed">
              <div className="font-bold text-[#B45309] dark:text-[#F59E0B] mb-1">{ui.t('إخلاء مسؤولية سريري', 'Clinical disclaimer')}</div>
              {asText(report.clinical_disclaimer)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2.8 REGULAR DIRECT SYSTEM (`screen-regular-system`)
 * ========================================================================== */
export const RegularSystemScreen: React.FC = () => {
  const core = useAppCore();
  const { ui } = core;
  const reg = core.getRegularSystemState();
  const res = reg.vascularResult;
  const presets = core.getCtPresets();
  const presetsLoading = core.isLoading('presets');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      core.toast('error', 'الرجاء اختيار ملف صورة (PNG أو JPG).', 'Please choose an image file (PNG or JPG).');
      return;
    }
    void core.setRegularCtFile(file);
  };

  return (
    <div id="screen-regular-system" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div className={`p-6 ${cardCls} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div>
          <div className="text-xs font-semibold text-[#0E7490] dark:text-[#22D3EE]">{ui.t('الوصول المباشر للنماذج السريرية', 'Standalone Direct Model Execution')}</div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F2A2E] dark:text-[#ECF6F8]">{ui.t('النظام العادي — النماذج المباشرة', 'Regular System — Live Diagnostic Models')}</h1>
        </div>
        <div role="tablist" className="flex items-center gap-2">
          {(['path-a', 'path-b'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={reg.path === p}
              onClick={() => core.setRegularPath(p)}
              className={`h-11 px-4 rounded-[10px] text-xs font-bold cursor-pointer ${
                reg.path === p ? 'bg-[#0E7490] text-white' : 'border border-[#D7E3E6] dark:border-[#1B3540] text-[#5B6B7A] dark:text-[#8CA3AF]'
              }`}
            >
              {p === 'path-a' ? ui.t('المسار A — تقييم الخطر (ML)', 'Path A — Risk (ML)') : ui.t('المسار B — تشخيص الأشعة (CT)', 'Path B — CT Diagnosis')}
            </button>
          ))}
        </div>
      </div>

      {reg.path === 'path-a' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`lg:col-span-7 p-6 ${cardCls} space-y-5`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">{ui.t('المسار A: نموذج خطر السكتة', 'Path A: Stroke risk model')}</h2>
              <PresetButtons onPick={(p) => core.applyRegularPreset(p)} ui={ui} small />
            </div>
            <VitalsFields
              idPrefix="ra"
              input={reg.vascularInput}
              onChange={(f, v) => core.updateRegularVascularField(f, v)}
              ui={ui}
              gridCls="grid grid-cols-1 sm:grid-cols-2 gap-4"
            />
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={reg.riskLoading}
                onClick={() => void core.runRegularRisk()}
                className="h-12 px-6 rounded-[10px] bg-[#0E7490] hover:bg-[#0B5C73] text-white text-sm font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {reg.riskLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                <span>{reg.riskLoading ? ui.t('جاري التحليل...', 'Analysing...') : ui.t('تحليل الخطر', 'Analyse risk')}</span>
              </button>
            </div>
          </div>

          <div className={`lg:col-span-5 p-6 ${cardCls} flex flex-col items-center justify-center`}>
            {reg.riskLoading && !res ? (
              <div className="flex flex-col items-center gap-2 text-xs text-[#5B6B7A] dark:text-[#8CA3AF]">
                <Loader2 className="w-8 h-8 animate-spin text-[#0E7490]" />
                {ui.t('جاري تشغيل النموذج...', 'Running the model...')}
              </div>
            ) : res ? (
              <div className={`w-full ${reg.riskLoading ? 'opacity-50' : ''}`}>
                <RiskResultCard res={res} ui={ui} />
              </div>
            ) : (
              <div className="text-center space-y-2 text-xs text-[#5B6B7A] dark:text-[#8CA3AF] max-w-xs">
                <Activity className="w-10 h-10 mx-auto text-[#D7E3E6] dark:text-[#1B3540]" />
                <p>{ui.t('أدخل البيانات ثم اضغط "تحليل الخطر" لعرض النتيجة.', 'Enter the data and press "Analyse risk" to see the result.')}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`lg:col-span-6 p-6 ${cardCls} space-y-4`}>
            <h2 className="text-base font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">{ui.t('المسار B: تشخيص الأشعة المقطعية وبوابة الأمان', 'Path B: CT diagnosis with safety gate')}</h2>

            <label
              htmlFor="reg-ct-upload"
              className={`block p-5 rounded-2xl border-2 border-dashed border-[#0E7490]/40 hover:border-[#0E7490] bg-[#F7FAFA] dark:bg-[#11252D] text-center transition-colors ${reg.ctLoading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
            >
              <UploadCloud className="w-7 h-7 text-[#0E7490] dark:text-[#22D3EE] mx-auto mb-1.5" />
              <div className="text-xs font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">
                {ui.t('اضغط لرفع صورة أشعة — يبدأ التحليل تلقائياً', 'Click to upload a CT image — analysis starts automatically')}
              </div>
              {reg.ct?.source === 'upload' && <div className="text-xs font-mono-tabular text-[#047857] mt-1">{reg.ct.fileName}</div>}
              <input id="reg-ct-upload" type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={reg.ctLoading} />
            </label>

            <div className="text-xs font-bold text-[#5B6B7A] dark:text-[#8CA3AF]">{ui.t('أو اختر عينة جاهزة:', 'Or choose a sample scan:')}</div>
            <CtPresetGrid
              presets={presets}
              loading={presetsLoading}
              selectedId={reg.ctSampleId}
              disabled={reg.ctLoading}
              onPick={(id) => void core.setRegularCtSample(id)}
              ui={ui}
            />

            {reg.ctRejectMessage && !reg.ctLoading && (
              <div role="alert" className="p-3 rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/10 text-[#DC2626] dark:text-[#FCA5A5] text-xs flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">{ui.t('رفضت بوابة الأمان الصورة', 'The safety gate rejected this image')}</div>
                  <p className="mt-0.5">{reg.ctRejectMessage}</p>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-6">
            <CtGradCamViewer previewUrl={reg.ct?.previewUrl ?? null} fileName={reg.ct?.fileName ?? null} result={reg.ctResult} loading={reg.ctLoading} />
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 2.5 ACCOUNT STATUS SCREENS (`screen-doctor-pending` & `screen-restricted-access`)
 * ========================================================================== */
export const DoctorPendingScreen: React.FC = () => {
  const core = useAppCore();
  const { ui } = core;
  const user = core.getCurrentUser();
  const infoRequested = user?.status === 'info_requested';

  const [license, setLicense] = useState(user?.licenseNumber || '');
  const [hospital, setHospital] = useState(user?.hospital || '');
  const [clarification, setClarification] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [noteError, setNoteError] = useState(false);
  const submitting = core.isLoading('resubmit');
  const checking = core.isLoading('me');

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clarification.trim().length < 5) {
      setNoteError(true);
      return;
    }
    setNoteError(false);
    const ok = await core.submitDoctorClarification(license, hospital, clarification);
    if (ok) setSubmitted(true);
  };

  return (
    <div id="screen-doctor-pending" className="max-w-2xl mx-auto px-4 py-12">
      <div className={`p-7 ${cardCls} space-y-6`}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#B45309]/15 text-[#B45309] dark:text-[#F59E0B] flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#B45309] dark:text-[#F59E0B]">{ui.t('حالة اعتماد الطبيب', 'Clinician credentialing status')}</div>
            <h1 className="text-xl font-extrabold text-[#0F2A2E] dark:text-[#ECF6F8]">
              {infoRequested
                ? ui.t('الإدارة تطلب معلومات إضافية', 'The administrators requested more information')
                : ui.t('طلبك قيد المراجعة', 'Your application is under review')}
            </h1>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[#5B6B7A] dark:text-[#8CA3AF] leading-relaxed">
          {ui.t(
            'يراجع المسؤولون بيانات ترخيصك الطبي. يمكنك التحقق من الحالة في أي وقت، أو إرسال توضيح إذا طُلب منك ذلك.',
            'The administrators are reviewing your medical license details. You can check the status at any time, or send a clarification if one was requested.'
          )}
        </p>

        {infoRequested && (user?.adminRequestNote || user?.adminRequestNoteAr) && (
          <div className="p-4 rounded-xl border border-[#B45309]/40 bg-[#B45309]/10 text-xs space-y-1">
            <div className="font-bold text-[#B45309] dark:text-[#F59E0B]">{ui.t('ملاحظة الإدارة:', 'Administrator note:')}</div>
            <p className="text-[#0F2A2E] dark:text-[#ECF6F8] leading-relaxed">
              {ui.t(user?.adminRequestNoteAr || user?.adminRequestNote || '', user?.adminRequestNote || user?.adminRequestNoteAr || '')}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={checking}
            onClick={() => void core.refreshAccountStatus()}
            className="h-11 px-4 rounded-[10px] border border-[#047857] text-[#047857] dark:text-[#10B981] text-xs font-bold cursor-pointer flex items-center gap-2 disabled:opacity-60"
          >
            {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {ui.t('التحقق من الحالة', 'Check status')}
          </button>
          <button type="button" onClick={() => core.logout()} className="h-11 px-4 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] text-xs font-semibold cursor-pointer">
            {ui.t('تسجيل الخروج', 'Sign out')}
          </button>
        </div>

        {submitted ? (
          <div className="p-4 rounded-xl bg-[#047857]/10 border border-[#047857]/30 text-[#047857] dark:text-[#10B981] text-xs font-bold">
            {ui.t('تم إرسال التوضيح إلى الإدارة. ستصلك النتيجة بعد المراجعة.', 'Your clarification was sent to the administrators. You will be notified after review.')}
          </div>
        ) : (
          <form onSubmit={handleResubmit} className="space-y-4 pt-4 border-t border-[#D7E3E6] dark:border-[#1B3540]">
            <div className="text-xs font-bold text-[#0F2A2E] dark:text-[#ECF6F8]">{ui.t('إرسال توضيح أو تحديث البيانات', 'Send a clarification or update your details')}</div>
            <div>
              <label htmlFor="pend-lic" className="block text-xs font-bold mb-1">{ui.t('رقم الترخيص الطبي', 'Medical license number')}</label>
              <input id="pend-lic" type="text" value={license} onChange={(e) => setLicense(e.target.value)} className={`${fieldCls} font-mono-tabular`} />
            </div>
            <div>
              <label htmlFor="pend-hosp" className="block text-xs font-bold mb-1">{ui.t('المستشفى / جهة العمل', 'Hospital / institution')}</label>
              <input id="pend-hosp" type="text" value={hospital} onChange={(e) => setHospital(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label htmlFor="pend-note" className="block text-xs font-bold mb-1">{ui.t('التوضيح *', 'Clarification *')}</label>
              <textarea
                id="pend-note"
                rows={3}
                value={clarification}
                onChange={(e) => setClarification(e.target.value)}
                placeholder={ui.t('اكتب التوضيح المطلوب (5 أحرف على الأقل)...', 'Write the requested clarification (at least 5 characters)...')}
                className="w-full p-3.5 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] text-xs"
                aria-invalid={noteError}
              />
              {noteError && (
                <p className="text-[11px] text-[#DC2626] mt-1">{ui.t('التوضيح يجب أن يكون 5 أحرف على الأقل.', 'The clarification must be at least 5 characters.')}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="h-11 px-5 rounded-[10px] bg-[#0E7490] text-white text-xs font-bold cursor-pointer flex items-center gap-2 disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {ui.t('إرسال للإدارة', 'Send to administrators')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export const RestrictedAccessScreen: React.FC = () => {
  const core = useAppCore();
  const { ui } = core;
  const user = core.getCurrentUser();
  const reasonAr = user?.restrictionReasonAr || user?.restrictionReason || '';
  const reasonEn = user?.restrictionReason || user?.restrictionReasonAr || '';

  return (
    <div id="screen-restricted-access" className="max-w-xl mx-auto px-4 py-16">
      <div className="p-7 rounded-2xl border border-[#DC2626]/40 bg-white dark:bg-[#0C1B21] text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-[#DC2626]/15 text-[#DC2626] flex items-center justify-center mx-auto">
          <AlertOctagon className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-extrabold text-[#0F2A2E] dark:text-[#ECF6F8]">
          {user?.status === 'rejected' ? ui.t('تم رفض طلب الحساب', 'Account application rejected') : ui.t('الحساب مقيّد', 'Account access restricted')}
        </h1>
        <p className="text-xs sm:text-sm text-[#5B6B7A] dark:text-[#8CA3AF] leading-relaxed">
          {reasonEn
            ? ui.t(reasonAr, reasonEn)
            : ui.t('تم تقييد الوصول إلى هذا الحساب من قبل الإدارة. تواصل مع المسؤول لمزيد من التفاصيل.', 'Access to this account has been restricted by the administrators. Contact an administrator for details.')}
        </p>
        <div className="pt-2">
          <button type="button" onClick={() => core.logout()} className="h-11 px-6 rounded-[10px] bg-[#0E7490] text-white text-xs font-bold cursor-pointer">
            {ui.t('العودة لشاشة تسجيل الدخول', 'Return to Sign In')}
          </button>
        </div>
      </div>
    </div>
  );
};
