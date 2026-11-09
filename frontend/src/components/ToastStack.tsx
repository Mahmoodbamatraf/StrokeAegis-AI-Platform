import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useAppCore } from '../core/useAppCore';
import { ToastMessage } from '../core/types';

const KIND_STYLES: Record<ToastMessage['kind'], { box: string; icon: React.ElementType }> = {
  success: {
    box: 'border-[#047857]/40 bg-[#ECFDF5] dark:bg-[#062A20] text-[#065F46] dark:text-[#6EE7B7]',
    icon: CheckCircle2,
  },
  error: {
    box: 'border-[#DC2626]/40 bg-[#FEF2F2] dark:bg-[#2A0C0C] text-[#B91C1C] dark:text-[#FCA5A5]',
    icon: AlertCircle,
  },
  info: {
    box: 'border-[#0E7490]/40 bg-[#F0F9FB] dark:bg-[#0B2229] text-[#0E7490] dark:text-[#67E8F9]',
    icon: Info,
  },
};

/** Global toast notifications (success / error / info) emitted by the core store. */
export const ToastStack: React.FC = () => {
  const core = useAppCore();
  const { ui } = core;
  const toasts = core.getToasts();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed top-20 end-4 z-[60] flex flex-col gap-2 w-[min(92vw,380px)] pointer-events-none"
    >
      {toasts.map((t) => {
        const style = KIND_STYLES[t.kind] || KIND_STYLES.info;
        const Icon = style.icon;
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto p-3 rounded-xl border shadow-lg flex items-start gap-2.5 text-xs font-medium sa-animate-in ${style.box}`}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="flex-1 leading-relaxed break-words">{ui.t(t.textAr, t.textEn)}</span>
            <button
              type="button"
              onClick={() => core.dismissToast(t.id)}
              aria-label={ui.t('إغلاق التنبيه', 'Dismiss notification')}
              className="w-6 h-6 rounded-md flex items-center justify-center opacity-70 hover:opacity-100 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
