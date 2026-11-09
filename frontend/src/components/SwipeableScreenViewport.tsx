import React, { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';
import { ChevronLeft, ChevronRight, Hand } from 'lucide-react';
import { useAppCore } from '../core/useAppCore';

interface SwipeableScreenViewportProps {
  children: React.ReactNode;
}

export const SwipeableScreenViewport: React.FC<SwipeableScreenViewportProps> = ({ children }) => {
  const core = useAppCore();
  const { ui } = core;
  const currentScreen = core.getScreen();
  const navDirection = core.getLastNavDirection();
  const swipeableDeck = core.getSwipeableScreens();
  const isRtl = ui.getLanguage() === 'ar';

  const stageRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<{
    startX: number;
    startY: number;
    deltaX: number;
    isHorizontalSwipe: boolean;
    active: boolean;
  }>({
    startX: 0,
    startY: 0,
    deltaX: 0,
    isHorizontalSwipe: false,
    active: false,
  });

  const [swipeOffsetPreview, setSwipeOffsetPreview] = useState(0);

  // Run Framer Motion spring entrance whenever currentScreen changes
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const enterSign = navDirection === 'next' ? (isRtl ? -1 : 1) : isRtl ? 1 : -1;
    const fromX = enterSign * 48;

    const controls = animate(
      el,
      {
        opacity: [0.22, 1],
        x: [fromX, 0],
        scale: [0.986, 1],
      },
      {
        type: 'spring',
        stiffness: 310,
        damping: 32,
        mass: 0.85,
      }
    );

    return () => controls.stop();
  }, [currentScreen, navDirection, isRtl]);

  const shouldIgnoreGestureTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest(
        'input, textarea, select, button, a, label, [role="dialog"], [data-no-swipe="true"]'
      )
    );
  };

  const beginGesture = (clientX: number, clientY: number, target: EventTarget | null) => {
    if (shouldIgnoreGestureTarget(target)) {
      gestureRef.current.active = false;
      return;
    }
    gestureRef.current = {
      startX: clientX,
      startY: clientY,
      deltaX: 0,
      isHorizontalSwipe: false,
      active: true,
    };
  };

  const moveGesture = (clientX: number, clientY: number) => {
    const st = gestureRef.current;
    if (!st.active) return;

    const dx = clientX - st.startX;
    const dy = clientY - st.startY;

    if (!st.isHorizontalSwipe) {
      if (Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 1.35) {
        st.isHorizontalSwipe = true;
      } else if (Math.abs(dy) > 18) {
        st.active = false;
        return;
      } else {
        return;
      }
    }

    st.deltaX = dx;
    const dampedX = Math.max(-115, Math.min(115, dx * 0.45));
    setSwipeOffsetPreview(Math.round(dampedX));

    if (stageRef.current) {
      stageRef.current.style.transform = `translate3d(${dampedX}px, 0, 0) scale(${
        1 - Math.min(0.02, Math.abs(dampedX) / 4500)
      })`;
    }
  };

  const endGesture = () => {
    const st = gestureRef.current;
    if (!st.active) return;
    st.active = false;
    setSwipeOffsetPreview(0);

    const dx = st.deltaX;
    const SWIPE_THRESHOLD = 64;

    if (st.isHorizontalSwipe && Math.abs(dx) >= SWIPE_THRESHOLD) {
      const direction: 'next' | 'prev' = isRtl
        ? dx > 0
          ? 'next'
          : 'prev'
        : dx < 0
          ? 'next'
          : 'prev';
      core.swipeAdjacentScreen(direction);
    } else if (stageRef.current) {
      animate(
        stageRef.current,
        { x: 0, scale: 1, opacity: 1 },
        { type: 'spring', stiffness: 360, damping: 28 }
      );
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    beginGesture(e.touches[0].clientX, e.touches[0].clientY, e.target);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    moveGesture(e.touches[0].clientX, e.touches[0].clientY);
  };

  const activeDeckIdx = swipeableDeck.findIndex((s) => s.id === currentScreen);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={endGesture}
      onPointerDown={(e) => {
        if (e.pointerType === 'touch' || e.button !== 0) return;
        beginGesture(e.clientX, e.clientY, e.target);
      }}
      onPointerMove={(e) => {
        if (e.pointerType === 'touch') return;
        moveGesture(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (e.pointerType === 'touch') return;
        endGesture();
      }}
      onPointerCancel={endGesture}
      className="relative touch-pan-y"
    >
      {/* Top Compact Luxury Swipe Gesture Bar (Zero overlap with page cards) */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-3">
        <div
          data-testid="luxury-swipe-hud"
          data-no-swipe="true"
          className="w-full sm:w-fit mx-auto px-3 py-1.5 rounded-2xl border border-[#0E7490]/30 dark:border-[#06B6D4]/35 bg-white/85 dark:bg-[#0C1B21]/85 backdrop-blur-md shadow-xs flex items-center justify-between sm:justify-center gap-2.5 transition-all"
        >
          <button
            type="button"
            onClick={() => core.swipeAdjacentScreen('prev')}
            aria-label={ui.t('الشاشة السابقة (سحب)', 'Previous Clinical Screen')}
            className="w-7 h-7 rounded-xl border border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#0E7490] flex items-center justify-center text-[#0F2A2E] dark:text-[#ECF6F8] transition-transform hover:scale-105 cursor-pointer"
          >
            {isRtl ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Interactive Screen Progress Pills */}
          <div className="flex items-center gap-1.5 px-1">
            {swipeableDeck.map((item) => {
              const isActive = item.id === currentScreen;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => core.navigate(item.id)}
                  aria-label={ui.t(item.labelAr, item.labelEn)}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    isActive
                      ? 'w-7 bg-[#0E7490]'
                      : 'w-2 bg-[#D7E3E6] dark:bg-[#1B3540] hover:bg-[#0E7490]/50'
                  }`}
                />
              );
            })}
          </div>

          {/* Active Screen Label + Swipe Hint */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#5B6B7A] dark:text-[#8CA3AF] ps-2 border-s border-[#D7E3E6] dark:border-[#1B3540]">
            <Hand className="w-3 h-3 text-[#0E7490] dark:text-[#22D3EE]" />
            <span className="text-[#0F2A2E] dark:text-[#ECF6F8]">
              {activeDeckIdx !== -1
                ? ui.t(swipeableDeck[activeDeckIdx].labelAr, swipeableDeck[activeDeckIdx].labelEn)
                : ui.t('شاشة الحساب', 'Account Status')}
            </span>
            <span className="hidden sm:inline opacity-75 font-normal">
              {swipeOffsetPreview !== 0
                ? `(${swipeOffsetPreview > 0 ? '+' : ''}${swipeOffsetPreview}px)`
                : ui.t('· اسحب أفقياً للتنقل', '· Swipe horizontally')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => core.swipeAdjacentScreen('next')}
            aria-label={ui.t('الشاشة التالية (سحب)', 'Next Clinical Screen')}
            className="w-7 h-7 rounded-xl border border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#0E7490] flex items-center justify-center text-[#0F2A2E] dark:text-[#ECF6F8] transition-transform hover:scale-105 cursor-pointer"
          >
            {isRtl ? (
              <ChevronLeft className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Animated Framer Motion Screen Stage */}
      <div ref={stageRef} className="will-change-transform">
        {children}
      </div>
    </div>
  );
};
