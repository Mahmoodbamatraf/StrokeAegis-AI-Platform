import React, { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';
import { Activity, Crosshair, Cpu, ScanLine, ShieldAlert, ShieldCheck, Sparkles, X } from 'lucide-react';
import { CtAnalysisResult } from '../core/types';
import { useAppCore } from '../core/useAppCore';
import { AnimatedCounter } from './LuxuryMotion';

/* ============================================================================
 * 1. CT ANALYSIS PROGRESS OVERLAY
 * Shown while a real request is in flight. The backend gives no partial progress
 * for a single CT call, so this is an indeterminate indicator: it lists the real
 * pipeline stages without pretending to know percentages.
 * ========================================================================== */
export interface ProgressOverlayProps {
  active: boolean;
  /** Name of the file being analysed (shown in the header). */
  fileName?: string | null;
}

const STAGES = [
  {
    id: 'gate',
    icon: ShieldCheck,
    labelAr: 'بوابة الأمان ConvNeXt (هل هي أشعة دماغ؟)',
    labelEn: 'ConvNeXt safety gate (is this a brain CT?)',
  },
  {
    id: 'classifier',
    icon: Cpu,
    labelAr: 'مصنّف EfficientNetV2-S (نزيف / احتشاء / طبيعي)',
    labelEn: 'EfficientNetV2-S classifier (bleeding / ischemia / normal)',
  },
  {
    id: 'gradcam',
    icon: Crosshair,
    labelAr: 'خريطة Grad-CAM لتحديد موضع البؤرة',
    labelEn: 'Grad-CAM localisation map',
  },
];

export const ProgressOverlay: React.FC<ProgressOverlayProps> = ({ active, fileName }) => {
  const { ui } = useAppCore();
  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="convnext-progress-overlay"
      className="absolute inset-0 z-30 bg-[#050C10]/90 backdrop-blur-md sa-scanline-grid flex flex-col justify-between p-4 sm:p-5 text-white overflow-hidden select-none"
    >
      {/* Cosmetic sweeping laser */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent via-cyan-400/20 to-cyan-400/55 border-b border-cyan-300/80 sa-ct-laser"
      />

      <div className="relative z-10 flex items-center gap-2 border-b border-white/10 pb-2.5">
        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
          <ScanLine className="w-4 h-4 animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-extrabold tracking-wide text-cyan-200">
            {ui.t('جاري تحليل صورة الأشعة على الخادم...', 'Analysing the CT image on the server...')}
          </div>
          {fileName && <div className="text-[10px] font-mono-tabular text-slate-400 truncate">{fileName}</div>}
        </div>
      </div>

      <div className="relative z-10 space-y-2 my-auto py-2">
        {STAGES.map((st) => {
          const Icon = st.icon;
          return (
            <div key={st.id} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-100">
                <Icon className="w-3.5 h-3.5 shrink-0 text-cyan-300" />
                <span>{ui.t(st.labelAr, st.labelEn)}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-900/90 border border-white/10 overflow-hidden">
                <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#0E7490] via-cyan-500 to-teal-300 sa-progress-scanline animate-pulse" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative z-10 pt-2 border-t border-white/10 text-[10px] font-mono-tabular text-slate-300 flex items-center justify-between">
        <span>CONVNEXT-TINY + EFFICIENTNETV2-S</span>
        <span className="animate-pulse">{ui.t('قيد المعالجة...', 'PROCESSING...')}</span>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. SLIDE-IN CT RESULTS SUMMARY OVERLAY (real result only)
 * ========================================================================== */
export interface CtResultsSummaryOverlayProps {
  visible: boolean;
  result: CtAnalysisResult;
  onDismiss: () => void;
}

export const CtResultsSummaryOverlay: React.FC<CtResultsSummaryOverlayProps> = ({ visible, result, onDismiss }) => {
  const { ui } = useAppCore();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !cardRef.current) return;
    const controls = animate(
      cardRef.current,
      { opacity: [0, 1], y: [36, 0], scale: [0.96, 1] },
      { type: 'spring', stiffness: 320, damping: 28, mass: 0.85 }
    );
    return () => controls.stop();
  }, [visible, result]);

  if (!visible) return null;

  const d = result.diagnosis;
  const isRejected = !result.gatePassed;
  const title =
    d === 'hemorrhagic'
      ? ui.t('سكتة نزفية', 'Hemorrhagic stroke')
      : d === 'ischemic'
        ? ui.t('سكتة إقفارية', 'Ischemic stroke')
        : d === 'normal'
          ? ui.t('لا توجد علامات سكتة', 'No stroke signs')
          : d === 'rejected_non_brain'
            ? ui.t('مرفوضة: ليست أشعة دماغ', 'Rejected: not a brain CT')
            : ui.t('التصنيف غير متاح', 'Classification unavailable');

  const badgePalette =
    isRejected || d === 'hemorrhagic'
      ? 'bg-red-500/20 border-red-400/50 text-red-200'
      : d === 'ischemic'
        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
        : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200';

  return (
    <div
      ref={cardRef}
      data-testid="ct-results-summary-overlay"
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-x-3 bottom-3 z-25 rounded-xl border border-cyan-400/35 bg-[#061218]/92 backdrop-blur-md p-3.5 text-white shadow-2xl space-y-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-extrabold font-mono-tabular shrink-0 ${badgePalette}`}
          >
            <Sparkles className="w-3 h-3" />
            <span>
              {isRejected || !d ? (
                ui.t('لا يوجد تصنيف', 'NO CLASSIFICATION')
              ) : (
                <>
                  {ui.t('الثقة', 'CONFIDENCE')}: <AnimatedCounter value={result.confidence} decimals={1} suffix="%" />
                </>
              )}
            </span>
          </span>
          <span className="text-xs font-extrabold text-slate-100 truncate">{title}</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={ui.t('إخفاء ملخص النتيجة', 'Dismiss summary overlay')}
          className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/10 text-[11px]">
        <div className="p-2 rounded-lg bg-white/[0.04] border border-white/10">
          <div className="text-[10px] text-slate-400">{ui.t('بوابة الأمان', 'Safety gate')}</div>
          <div className="font-mono-tabular font-extrabold text-cyan-300 mt-0.5 flex items-center gap-1">
            {isRejected ? (
              <ShieldAlert className="w-3 h-3 text-red-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
            )}
            <AnimatedCounter value={result.gateScore} decimals={1} suffix="%" />
          </div>
        </div>
        <div className="p-2 rounded-lg bg-white/[0.04] border border-white/10">
          <div className="text-[10px] text-slate-400">{ui.t('موضع البؤرة', 'Hotspot region')}</div>
          <div className="font-extrabold text-slate-100 mt-0.5 truncate">{result.quadrant || '—'}</div>
        </div>
        <div className="p-2 rounded-lg bg-white/[0.04] border border-white/10">
          <div className="text-[10px] text-slate-400">{ui.t('تغطية البؤرة', 'Hotspot coverage')}</div>
          <div className="font-mono-tabular font-extrabold text-slate-100 mt-0.5 flex items-center gap-1">
            <Activity className="w-3 h-3 shrink-0" />
            {result.hotspotCoveragePct != null ? `${Number(result.hotspotCoveragePct).toFixed(1)}%` : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};
