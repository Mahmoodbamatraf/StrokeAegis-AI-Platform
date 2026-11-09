import React, { useEffect, useMemo, useState } from 'react';
import { Brain, Hourglass, ImageOff, ScanLine, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { CtAnalysisResult, CtDiagnosisType } from '../core/types';
import { useAppCore } from '../core/useAppCore';
import { AnimatedCounter } from './LuxuryMotion';
import { ProgressOverlay, CtResultsSummaryOverlay } from './ProgressOverlay';

type Translator = { t: (ar: string, en: string) => string };

/** Bilingual label for a CT diagnosis. */
export function ctDiagnosisText(d: CtDiagnosisType | null, ui: Translator): string {
  switch (d) {
    case 'hemorrhagic':
      return ui.t('سكتة نزفية (نزيف دماغي)', 'Hemorrhagic stroke (bleeding)');
    case 'ischemic':
      return ui.t('سكتة إقفارية (احتشاء)', 'Ischemic stroke (infarct)');
    case 'normal':
      return ui.t('طبيعي — لا توجد علامات سكتة', 'Normal — no stroke signs');
    case 'rejected_non_brain':
      return ui.t('مرفوضة — ليست أشعة مقطعية للدماغ', 'Rejected — not a brain CT');
    default:
      return ui.t('لا توجد صورة أشعة', 'No CT image');
  }
}

/** Text colour class for a CT diagnosis. */
export function ctDiagnosisTone(d: CtDiagnosisType | null): string {
  if (d === 'hemorrhagic' || d === 'rejected_non_brain') return 'text-[#DC2626] dark:text-[#EF4444]';
  if (d === 'ischemic') return 'text-[#B45309] dark:text-[#F59E0B]';
  if (d === 'normal') return 'text-[#047857] dark:text-[#10B981]';
  return 'text-[#5B6B7A] dark:text-[#8CA3AF]';
}

function classLabel(key: string, ui: Translator): string {
  const k = key.toLowerCase();
  if (k.includes('bleed') || k.includes('hemorr')) return ui.t('نزيف', 'Bleeding');
  if (k.includes('isch')) return ui.t('احتشاء', 'Ischemia');
  if (k.includes('normal')) return ui.t('طبيعي', 'Normal');
  return key;
}
function classColor(key: string): string {
  const k = key.toLowerCase();
  if (k.includes('bleed') || k.includes('hemorr')) return 'bg-[#EF4444]';
  if (k.includes('isch')) return 'bg-[#F59E0B]';
  return 'bg-[#10B981]';
}

type ViewTab = 'original' | 'overlay' | 'heatmap' | 'projection' | 'roi';

interface CtGradCamViewerProps {
  /** The selected image (preset data URL or uploaded object URL). */
  previewUrl?: string | null;
  fileName?: string | null;
  /** Real result from the backend (null until analysed). */
  result?: CtAnalysisResult | null;
  /** A CT request is in flight. */
  loading?: boolean;
  compact?: boolean;
}

export const CtGradCamViewer: React.FC<CtGradCamViewerProps> = ({
  previewUrl = null,
  fileName = null,
  result = null,
  loading = false,
  compact = false,
}) => {
  const { ui } = useAppCore();
  const [laserSweepActive, setLaserSweepActive] = useState(true);
  const [summaryVisible, setSummaryVisible] = useState(false);

  const noCtSupplied = !!result && result.diagnosis === null && !result.gatePassed;
  const isRejected = !!result && !noCtSupplied && !result.gatePassed;
  const isAnalysed = !!result && !noCtSupplied && !isRejected;

  const tabs = useMemo(() => {
    const list: { id: ViewTab; labelAr: string; labelEn: string; src: string }[] = [];
    const original = result?.originalImage || previewUrl;
    if (original) list.push({ id: 'original', labelAr: 'الأصلية', labelEn: 'Original', src: original });
    if (isAnalysed && result) {
      if (result.overlayImage) list.push({ id: 'overlay', labelAr: 'Grad-CAM مع الحدود', labelEn: 'Grad-CAM overlay', src: result.overlayImage });
      if (result.heatmapImage) list.push({ id: 'heatmap', labelAr: 'الخريطة الحرارية', labelEn: 'Heatmap', src: result.heatmapImage });
      if (result.projectionImage) list.push({ id: 'projection', labelAr: 'الإسقاط الكامل', labelEn: 'Full projection', src: result.projectionImage });
      if (result.roiImage) list.push({ id: 'roi', labelAr: 'منطقة الاهتمام ROI', labelEn: 'ROI crop', src: result.roiImage });
    }
    return list;
  }, [result, previewUrl, isAnalysed]);

  const [tab, setTab] = useState<ViewTab>('original');
  useEffect(() => {
    // On a new result jump to the most informative view.
    const preferred = tabs.find((t) => t.id === 'overlay') || tabs.find((t) => t.id === 'heatmap') || tabs[0];
    setTab(preferred ? preferred.id : 'original');
    setSummaryVisible(false);
  }, [result, previewUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = tabs.find((t) => t.id === tab) || tabs[0] || null;
  const probs = Object.entries(result?.classProbabilities || {}).filter(([, v]) => Number.isFinite(Number(v)));

  /* ---------- top status bar text ---------- */
  let statusIcon = <Hourglass className="w-4 h-4 text-cyan-300" />;
  let statusText = ui.t('لم يتم اختيار صورة', 'No image selected');
  if (loading) {
    statusIcon = <ScanLine className="w-4 h-4 text-cyan-300 animate-pulse" />;
    statusText = ui.t('جاري التحليل...', 'Analysing...');
  } else if (noCtSupplied) {
    statusText = ui.t('التحليل بدون صورة أشعة', 'Analysis ran without a CT image');
  } else if (isRejected) {
    statusIcon = <ShieldAlert className="w-4 h-4 text-[#EF4444]" />;
    statusText = ui.t(
      `بوابة الأمان: مرفوضة (احتمال أشعة دماغ ${result!.gateScore}%)`,
      `Safety gate: REJECTED (brain-CT probability ${result!.gateScore}%)`
    );
  } else if (isAnalysed) {
    statusIcon = <ShieldCheck className="w-4 h-4 text-[#10B981]" />;
    statusText = ui.t(
      `بوابة الأمان: مقبولة (${result!.gateScore}%)`,
      `Safety gate: PASSED (${result!.gateScore}%)`
    );
  } else if (previewUrl) {
    statusText = ui.t('بانتظار التحليل', 'Awaiting analysis');
  }

  return (
    <div className="rounded-2xl border border-[#D7E3E6] dark:border-[#1B3540] bg-[#091318] text-white overflow-hidden shadow-lg">
      {/* Top status bar */}
      <div className="px-4 py-2.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {statusIcon}
          <span className="font-mono-tabular text-white/90 truncate">{statusText}</span>
        </div>
        {isAnalysed && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSummaryVisible((v) => !v)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                summaryVisible ? 'bg-emerald-500/25 border border-emerald-400/40 text-emerald-200' : 'bg-white/10 text-slate-300'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>{ui.t('ملخص النتيجة', 'Summary')}</span>
            </button>
            <button
              type="button"
              onClick={() => setLaserSweepActive((v) => !v)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                laserSweepActive ? 'bg-cyan-500/25 text-cyan-200' : 'bg-white/10 text-slate-300'
              }`}
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>{ui.t('مسح الليزر', 'Laser')}</span>
            </button>
          </div>
        )}
      </div>

      {/* View tabs */}
      {tabs.length > 1 && (
        <div role="tablist" className="px-3 py-2 border-b border-white/10 flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={current?.id === t.id}
              onClick={() => setTab(t.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                current?.id === t.id ? 'bg-[#0E7490] text-white' : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              {ui.t(t.labelAr, t.labelEn)}
            </button>
          ))}
        </div>
      )}

      {/* Viewport */}
      <div className={`relative flex items-center justify-center bg-[#050B0E] overflow-hidden ${compact ? 'h-64' : 'h-80'}`}>
        <ProgressOverlay active={loading} fileName={fileName} />

        {isAnalysed && result && (
          <CtResultsSummaryOverlay visible={!loading && summaryVisible} result={result} onDismiss={() => setSummaryVisible(false)} />
        )}

        {/* Cosmetic laser sweep */}
        {(isAnalysed && laserSweepActive) || (!result && previewUrl && !loading) ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-transparent via-cyan-400/20 to-cyan-400/50 border-b border-cyan-400/70 sa-ct-laser z-20"
          />
        ) : null}

        {current ? (
          <img
            src={current.src}
            alt={ui.t(current.labelAr, current.labelEn)}
            className={`max-h-full max-w-full object-contain select-none ${isRejected ? 'grayscale opacity-40' : ''}`}
          />
        ) : noCtSupplied ? (
          <div className="text-center p-6 max-w-sm">
            <ImageOff className="w-10 h-10 text-slate-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-200">{ui.t('لم تُرفق صورة أشعة', 'No CT image was attached')}</p>
            <p className="text-xs text-slate-400 mt-1">
              {ui.t('اعتمد التحليل على المؤشرات السريرية فقط.', 'The analysis used the clinical vitals only.')}
            </p>
          </div>
        ) : (
          <div className="text-center p-6 max-w-sm">
            <Brain className="w-10 h-10 text-slate-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-200">{ui.t('لا توجد صورة بعد', 'No image yet')}</p>
            <p className="text-xs text-slate-400 mt-1">
              {ui.t('اختر عينة جاهزة أو ارفع صورة أشعة مقطعية.', 'Pick a sample scan or upload a CT image.')}
            </p>
          </div>
        )}

        {/* Rejection state */}
        {isRejected && !loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-[#2A0A0A]/60">
            <div className="text-center max-w-sm sa-luxury-enter">
              <div className="w-14 h-14 rounded-2xl bg-[#DC2626]/20 border border-[#DC2626]/40 text-[#EF4444] flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-[#FCA5A5] mb-1">
                {ui.t('رفضت بوابة الأمان الصورة — ليست أشعة مقطعية للدماغ', 'Blocked by the safety gate — not a brain CT')}
              </p>
              {result?.gateMessage && <p className="text-xs text-slate-300">{result.gateMessage}</p>}
            </div>
          </div>
        )}

        {/* Awaiting badge */}
        {!result && previewUrl && !loading && (
          <div className="absolute bottom-3 start-3 z-20 px-2.5 py-1 rounded-lg bg-black/60 border border-white/15 text-[11px] font-semibold text-cyan-200 flex items-center gap-1.5">
            <Hourglass className="w-3 h-3" />
            {ui.t('بانتظار التحليل', 'Awaiting analysis')}
          </div>
        )}

        {/* Corner HUD (real values only) */}
        {isAnalysed && result && !summaryVisible && (
          <div className="absolute bottom-3 end-3 z-20 text-end text-[11px] font-mono-tabular text-cyan-300 pointer-events-none bg-black/50 rounded-lg px-2 py-1">
            <div>
              {ui.t('الثقة', 'CONFIDENCE')}: <AnimatedCounter value={result.confidence} decimals={1} suffix="%" />
            </div>
            <div className="text-slate-400">EfficientNetV2-S · Grad-CAM</div>
          </div>
        )}
      </div>

      {/* Result details */}
      {isAnalysed && result && (
        <div className="px-4 py-3 border-t border-white/10 bg-[#0C1B21] space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] text-slate-400">{ui.t('التشخيص', 'Diagnosis')}</div>
              <div
                className={`text-sm font-extrabold ${
                  result.diagnosis === 'hemorrhagic' ? 'text-[#F87171]' : result.diagnosis === 'ischemic' ? 'text-[#FBBF24]' : result.diagnosis === 'normal' ? 'text-[#34D399]' : 'text-slate-200'
                }`}
              >
                {result.diagnosis ? ctDiagnosisText(result.diagnosis, ui) : ui.t('التصنيف غير متاح', 'Classification unavailable')}
              </div>
            </div>
            <div className="text-end">
              <div className="text-[11px] text-slate-400">{ui.t('الثقة', 'Confidence')}</div>
              <div className="text-sm font-extrabold font-mono-tabular text-cyan-300">{result.confidence.toFixed(1)}%</div>
            </div>
          </div>

          {probs.length > 0 && !compact && (
            <div className="space-y-1.5">
              {probs.map(([k, v]) => {
                const pct = Math.max(0, Math.min(100, Number(v)));
                return (
                  <div key={k} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span>{classLabel(k, ui)}</span>
                      <span className="font-mono-tabular">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className={`h-full ${classColor(k)}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(result.quadrant || result.hotspotCoveragePct != null) && (
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-white/[0.04] border border-white/10">
                <div className="text-[10px] text-slate-400">{ui.t('الموضع التشريحي', 'Anatomical region')}</div>
                <div className="font-bold text-slate-100">{result.quadrant || '—'}</div>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.04] border border-white/10">
                <div className="text-[10px] text-slate-400">{ui.t('تغطية البؤرة', 'Hotspot coverage')}</div>
                <div className="font-bold font-mono-tabular text-slate-100">
                  {result.hotspotCoveragePct != null ? `${Number(result.hotspotCoveragePct).toFixed(1)}%` : '—'}
                </div>
              </div>
            </div>
          )}

          {result.reassurance && (
            <p className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 leading-relaxed">
              {result.reassurance}
            </p>
          )}
          {result.statusBanner && <p className="text-[11px] text-slate-400 leading-relaxed">{result.statusBanner}</p>}
        </div>
      )}

      {isRejected && result?.gateMessage && (
        <div className="px-4 py-3 border-t border-[#DC2626]/40 bg-[#DC2626]/10 text-xs text-[#FCA5A5] leading-relaxed">
          {ui.t(
            'لم يتم تشغيل المصنّف لأن الصورة لم تجتز بوابة الأمان.',
            'The classifier was not run because the image did not pass the safety gate.'
          )}
        </div>
      )}
    </div>
  );
};
