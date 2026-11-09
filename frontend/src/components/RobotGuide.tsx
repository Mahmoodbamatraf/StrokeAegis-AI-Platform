import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAppCore } from '../core/useAppCore';
import { RobotMascot, RobotMood } from './RobotMascot';
import { helpFor } from './robotHelp';

/**
 * Always-visible robot guide (bottom corner).
 * - Eyes and head follow the mouse.
 * - Clicking any control shows an explanation in a bubble above its head.
 * - Clicking the robot itself opens the AI chatbot.
 */
export const RobotGuide: React.FC = () => {
  const core = useAppCore();
  const { ui } = core;
  const robotRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<[string, string] | null>(null);
  const [mood, setMood] = useState<RobotMood | undefined>('wave');
  const [muted, setMuted] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chatOpen = core.getActiveModal() === 'chatbot-modal';
  const screen = core.getScreen();

  // greeting once, then idle
  useEffect(() => {
    show(['أهلاً! أنا مساعدك. اضغط أي زر وأشرح لك وش يسوي، أو اضغط عليّ عشان تسألني.', 'Hi! Click anything and I’ll explain it, or click me to ask a question.'], 'wave', 6500);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // explain whatever the user clicks
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (muted) return;
      const target = e.target as Element | null;
      if (target && robotRef.current?.parentElement?.contains(target)) return; // clicks on the guide itself
      const help = helpFor(target);
      if (help) show(help, 'wave', 6000);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [muted]);

  // think while the AI pipeline or a sign-in is running
  const busy = core.isLoading('auth') || core.getWizardState().running;

  function show(text: [string, string], m: RobotMood, ms: number) {
    setTip(text);
    setMood(m);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setTip(null);
      setMood(undefined);
    }, ms);
  }

  // the landing page already shows the big robot next to the sign-in card
  if (chatOpen || screen === 'screen-landing') return null;

  const text = tip ? ui.t(tip[0], tip[1]) : null;

  return (
    <div className="fixed bottom-3 end-3 sm:bottom-5 sm:end-5 z-40 flex flex-col items-end pointer-events-none select-none">
      {text && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto relative mb-1 w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl border border-[#CFE7EC] dark:border-[#1E4A54] bg-white dark:bg-[#0C1B21] px-4 py-3 shadow-[0_12px_30px_-10px_rgba(14,116,144,0.45)] sa-animate-in"
        >
          <button
            type="button"
            onClick={() => setTip(null)}
            aria-label={ui.t('إخفاء الشرح', 'Hide tip')}
            className="absolute top-1.5 end-1.5 w-6 h-6 rounded-full grid place-items-center text-[#5B6B7A] hover:bg-[#EEF4F5] dark:hover:bg-[#11252D] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <p dir="auto" className="pe-5 text-[13px] font-semibold leading-relaxed text-[#0F2A2E] dark:text-[#E6F6F8]">
            {text}
          </p>
          <button
            type="button"
            onClick={() => {
              setMuted((v) => !v);
              setTip(null);
            }}
            className="mt-1.5 text-[11px] font-bold text-[#0E7490] dark:text-[#22D3EE] hover:underline cursor-pointer"
          >
            {muted ? ui.t('تشغيل الشرح عند الضغط', 'Turn click tips on') : ui.t('إيقاف الشرح عند الضغط', 'Turn click tips off')}
          </button>
          {/* tail pointing down to the robot's head */}
          <span
            aria-hidden="true"
            className="absolute -bottom-[7px] end-12 h-3.5 w-3.5 rotate-45 border-b border-r border-[#CFE7EC] dark:border-[#1E4A54] bg-white dark:bg-[#0C1B21]"
          />
        </div>
      )}

      <div ref={robotRef} className="pointer-events-auto">
        <button
          type="button"
          onClick={() => core.openModal('chatbot-modal')}
          onMouseEnter={() => !tip && show(['اضغط عليّ عشان تسأل المساعد الطبي.', 'Click me to ask the medical assistant.'], 'wave', 3000)}
          aria-label={ui.t('فتح المساعد الطبي الذكي', 'Open the AI assistant')}
          className="block rounded-3xl cursor-pointer transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
        >
          <RobotMascot variant="full" size={104} mood={busy && !tip ? 'thinking' : mood} trackPointer />
        </button>
        {muted && !tip && (
          <button
            type="button"
            onClick={() => setMuted(false)}
            className="block mx-auto -mt-1 text-[10px] font-bold text-[#0E7490] dark:text-[#22D3EE] cursor-pointer"
          >
            {ui.t('الشرح متوقف', 'Tips off')}
          </button>
        )}
      </div>
    </div>
  );
};
