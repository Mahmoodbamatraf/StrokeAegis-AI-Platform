import React from 'react';
import { useAppCore } from './core/useAppCore';
import { SharedHeader } from './components/SharedHeader';
import { LandingScreen } from './components/LandingScreen';
import { DoctorPortalScreen } from './components/DoctorPortalScreen';
import { PatientPortalScreen } from './components/PatientPortalScreen';
import { AdminDashboardScreen } from './components/AdminDashboardScreen';
import {
  AiWizardScreen,
  DoctorPendingScreen,
  RegularSystemScreen,
  RestrictedAccessScreen,
  SystemSelectorScreen,
} from './components/AnalysisSystemsScreens';
import { UnifiedModals } from './components/UnifiedModals';
import { SwipeableScreenViewport } from './components/SwipeableScreenViewport';
import { ToastStack } from './components/ToastStack';

/** Shown while the stored session token is being verified against /api/auth/me. */
const SessionSplash: React.FC<{ label: string }> = ({ label }) => (
  <div
    role="status"
    aria-live="polite"
    className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F7FAFA] dark:bg-[#071115] text-[#0F2A2E] dark:text-[#ECF6F8]"
  >
    <div className="w-16 h-16 rounded-2xl border border-[#0E7490]/30 dark:border-[#06B6D4]/40 bg-white dark:bg-[#0C1B21] flex items-center justify-center shadow-md sa-float-emblem">
      <img
        src="/brand/logo-ai.png"
        alt=""
        aria-hidden="true"
        className="w-12 h-12 object-contain"
      />
    </div>
    <div className="text-lg font-bold tracking-tight">
      StrokeAegis <span style={{ color: 'var(--sa-primary)' }}>AI</span>
    </div>
    <div className="flex items-center gap-2 text-xs text-[#5B6B7A] dark:text-[#8CA3AF]">
      <span className="w-3.5 h-3.5 rounded-full border-2 border-[#0E7490] border-t-transparent animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  </div>
);

export default function App() {
  const core = useAppCore();
  const { ui } = core;
  const screen = core.getScreen();

  if (!core.isSessionChecked()) {
    return <SessionSplash label={ui.t('جارٍ استعادة الجلسة...', 'Restoring your session...')} />;
  }

  return (
    <div className="min-h-screen pb-24 overflow-x-hidden bg-[#F7FAFA] dark:bg-[#071115] text-[#0F2A2E] dark:text-[#ECF6F8] transition-colors">
      <SharedHeader />

      <SwipeableScreenViewport>
        {screen === 'screen-landing' && <LandingScreen />}
        {screen === 'screen-doctor-portal' && <DoctorPortalScreen />}
        {screen === 'screen-patient-portal' && <PatientPortalScreen />}
        {screen === 'screen-admin-dashboard' && <AdminDashboardScreen />}
        {screen === 'screen-home' && <SystemSelectorScreen />}
        {screen === 'screen-ai-system' && <AiWizardScreen />}
        {screen === 'screen-regular-system' && <RegularSystemScreen />}
        {screen === 'screen-doctor-pending' && <DoctorPendingScreen />}
        {screen === 'screen-restricted-access' && <RestrictedAccessScreen />}
      </SwipeableScreenViewport>

      <UnifiedModals />
      <ToastStack />
    </div>
  );
}
