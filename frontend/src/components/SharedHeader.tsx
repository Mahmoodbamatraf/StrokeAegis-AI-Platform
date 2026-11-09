import React from 'react';
import {
  Bell,
  Globe,
  LogOut,
  Moon,
  Palette,
  Sun,
  UserCheck,
} from 'lucide-react';
import { useAppCore } from '../core/useAppCore';
import { LuxuryAccent, ScreenId } from '../core/types';

export const SharedHeader: React.FC = () => {
  const core = useAppCore();
  const { ui } = core;
  const user = core.getCurrentUser();
  const screen = core.getScreen();
  const unreadCount = core.getUnreadNotificationCount();
  const isDark = ui.getTheme() === 'dark';
  const lang = ui.getLanguage();
  const currentAccent = ui.getAccent();

  const cycleLuxuryAccent = () => {
    const order: LuxuryAccent[] = ['clinical-teal', 'surgical-emerald', 'royal-cyan'];
    const nextIdx = (order.indexOf(currentAccent) + 1) % order.length;
    ui.setAccent(order[nextIdx]);
  };

  const accentLabelMap: Record<LuxuryAccent, { ar: string; en: string }> = {
    'clinical-teal': { ar: 'ثيم: تيل طبي', en: 'Teal' },
    'surgical-emerald': { ar: 'ثيم: زمردي', en: 'Emerald' },
    'royal-cyan': { ar: 'ثيم: سيان ملكي', en: 'Cyan' },
  };

  /** Where "home" is for the signed-in user (mirrors the core's routing by role + account status). */
  const homeScreen: ScreenId = !user
    ? 'screen-landing'
    : user.role === 'admin'
      ? 'screen-admin-dashboard'
      : user.role === 'doctor'
        ? user.status === 'pending' || user.status === 'info_requested'
          ? 'screen-doctor-pending'
          : user.status === 'suspended' || user.status === 'rejected' || !user.isActive
            ? 'screen-restricted-access'
            : 'screen-doctor-portal'
        : user.isActive
          ? 'screen-patient-portal'
          : 'screen-restricted-access';

  const homeLabel: { ar: string; en: string } =
    homeScreen === 'screen-doctor-portal'
      ? { ar: 'بوابة الطبيب', en: 'Doctor Portal' }
      : homeScreen === 'screen-patient-portal'
        ? { ar: 'بوابة المريض', en: 'Patient Portal' }
        : homeScreen === 'screen-admin-dashboard'
          ? { ar: 'لوحة الحوكمة', en: 'Admin Governance' }
          : homeScreen === 'screen-doctor-pending'
            ? { ar: 'حالة الاعتماد', en: 'Account Review' }
            : homeScreen === 'screen-restricted-access'
              ? { ar: 'حالة الحساب', en: 'Account Status' }
              : { ar: 'الرئيسية والدخول', en: 'Home & Sign In' };

  const navItems: { id: ScreenId; labelAr: string; labelEn: string }[] = [
    { id: homeScreen, labelAr: homeLabel.ar, labelEn: homeLabel.en },
    { id: 'screen-home', labelAr: 'أنظمة التحليل', labelEn: 'Analysis Systems' },
    { id: 'screen-ai-system', labelAr: 'النظام الذكي (4 خطوات)', labelEn: '4-Step AI Wizard' },
    { id: 'screen-regular-system', labelAr: 'النماذج المباشرة', labelEn: 'Live Models' },
  ];

  const displayName = user ? ui.t(user.nameAr || user.name, user.name || user.nameAr) : '';
  const initials =
    displayName
      .replace(/^(Dr\.?|د\.)\s*/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || (user?.role === 'doctor' ? 'DR' : user?.role === 'admin' ? 'AD' : 'PT');

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[#D7E3E6] dark:border-[#1B3540] bg-white/90 dark:bg-[#0C1B21]/90 backdrop-blur-md transition-colors">
      <div className="max-w-[1440px] mx-auto h-full px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Brand Wordmark & Floating Emblem */}
        <button
          type="button"
          onClick={() => core.navigate(homeScreen)}
          className="flex items-center gap-2 sm:gap-3 text-start group focus:outline-none whitespace-nowrap shrink-0 cursor-pointer"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-[#0E7490]/30 dark:border-[#06B6D4]/40 bg-[#F0F6F7] dark:bg-[#11252D] flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform shrink-0">
            <img
              src="/brand/logo-ai.png"
              alt="StrokeAegis AI Emblem"
              referrerPolicy="no-referrer"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain"
            />
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight text-[#0F2A2E] dark:text-[#ECF6F8] whitespace-nowrap">
            StrokeAegis <span style={{ color: 'var(--sa-primary)' }}>AI</span>
          </span>
        </button>

        {/* Zone 2: Clean Single-Line Navigation Links */}
        <nav aria-label="Main Navigation" className="hidden lg:flex items-center gap-6">
          {navItems.map((item) => {
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => core.navigate(item.id)}
                className={`text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0 py-1 border-b-2 cursor-pointer ${
                  active
                    ? 'border-[#0E7490] dark:border-[#06B6D4] text-[#0E7490] dark:text-[#22D3EE] font-semibold scale-[1.02]'
                    : 'border-transparent text-[#5B6B7A] dark:text-[#8CA3AF] hover:text-[#0F2A2E] dark:hover:text-white'
                }`}
              >
                {ui.t(item.labelAr, item.labelEn)}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Luxury Theme & Locale Controls + User Action */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Luxury Accent Palette Switcher (Visible on all viewports with live color indicator) */}
          <button
            type="button"
            onClick={cycleLuxuryAccent}
            aria-label={ui.t('تغيير ثيم الألوان الفاخر', 'Cycle Luxury Color Theme')}
            className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-[10px] border border-[#0E7490]/40 bg-[#0E7490]/10 text-xs font-bold text-[#0F2A2E] dark:text-[#ECF6F8] hover:border-[#0E7490] flex items-center gap-2 transition-all hover:scale-[1.03] cursor-pointer whitespace-nowrap shrink-0"
          >
            <Palette className="w-3.5 h-3.5" style={{ color: 'var(--sa-primary)' }} />
            <span className="hidden sm:inline">
              {ui.t(accentLabelMap[currentAccent].ar, accentLabelMap[currentAccent].en)}
            </span>
            <span className="flex items-center gap-1" aria-hidden="true">
              <span
                className={`w-2.5 h-2.5 rounded-full bg-[#0E7490] transition-transform ${
                  currentAccent === 'clinical-teal' ? 'scale-125 ring-2 ring-[#0E7490]/40' : 'opacity-45'
                }`}
                style={{ backgroundColor: '#0E7490' }}
              />
              <span
                className={`w-2.5 h-2.5 rounded-full transition-transform ${
                  currentAccent === 'surgical-emerald' ? 'scale-125 ring-2 ring-[#059669]/40' : 'opacity-45'
                }`}
                style={{ backgroundColor: '#059669' }}
              />
              <span
                className={`w-2.5 h-2.5 rounded-full transition-transform ${
                  currentAccent === 'royal-cyan' ? 'scale-125 ring-2 ring-[#2563EB]/40' : 'opacity-45'
                }`}
                style={{ backgroundColor: '#2563EB' }}
              />
            </span>
          </button>

          {/* Language Switcher */}
          <button
            type="button"
            onClick={() => ui.toggleLanguage()}
            aria-label={ui.t('تبديل اللغة إلى الإنجليزية', 'Switch language to Arabic')}
            className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] text-xs font-semibold text-[#0F2A2E] dark:text-[#ECF6F8] hover:border-[#0E7490] dark:hover:border-[#06B6D4] flex items-center gap-1.5 transition-all hover:scale-[1.02] cursor-pointer whitespace-nowrap shrink-0"
          >
            <Globe className="w-3.5 h-3.5 text-[#0E7490] dark:text-[#06B6D4]" />
            <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
          </button>

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={() => ui.toggleTheme()}
            aria-label={ui.t('تبديل المظهر الفاتح/الداكن', 'Toggle Light/Dark Theme')}
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] text-[#0F2A2E] dark:text-[#ECF6F8] hover:border-[#0E7490] dark:hover:border-[#06B6D4] flex items-center justify-center transition-all hover:scale-105 cursor-pointer shrink-0"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-[#0E7490]" />
            )}
          </button>

          {/* Notifications Bell (signed-in users only: the endpoint needs a session) */}
          {user && (
          <button
            type="button"
            onClick={() => core.openModal('modal-notifications-drawer')}
            aria-label={
              unreadCount > 0
                ? ui.t(`الإشعارات (${unreadCount} غير مقروءة)`, `Notifications (${unreadCount} unread)`)
                : ui.t('الإشعارات', 'Notifications')
            }
            className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] bg-[#F7FAFA] dark:bg-[#11252D] text-[#0F2A2E] dark:text-[#ECF6F8] hover:border-[#0E7490] dark:hover:border-[#06B6D4] flex items-center justify-center transition-all hover:scale-105 cursor-pointer shrink-0"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          )}

          {/* User Profile or Sign In */}
          {user ? (
            <div className="flex items-center gap-2 ps-2 border-s border-[#D7E3E6] dark:border-[#1B3540]">
              <button
                type="button"
                onClick={() => core.navigate(homeScreen)}
                title={user.email}
                className="hidden sm:flex items-center gap-2 text-start px-2.5 py-1.5 rounded-[10px] hover:bg-[#F0F6F7] dark:hover:bg-[#11252D] transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-[#0E7490]/15 dark:bg-[#06B6D4]/20 text-[#0E7490] dark:text-[#22D3EE] flex items-center justify-center font-bold text-xs">
                  {initials}
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-semibold text-[#0F2A2E] dark:text-[#ECF6F8] truncate max-w-[130px]">
                    {displayName}
                  </div>
                  <div className="text-[11px] text-[#5B6B7A] dark:text-[#8CA3AF]">
                    {user.role === 'doctor'
                      ? user.status === 'active'
                        ? ui.t('طبيب', 'Doctor')
                        : ui.t('طبيب (قيد المراجعة)', 'Doctor (under review)')
                      : user.role === 'admin'
                        ? ui.t('مدير النظام', 'Administrator')
                        : ui.t('مريض', 'Patient')}
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => core.logout()}
                aria-label={ui.t('تسجيل الخروج', 'Sign Out')}
                className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-[10px] border border-[#D7E3E6] dark:border-[#1B3540] hover:border-[#DC2626] hover:text-[#DC2626] text-xs font-medium text-[#5B6B7A] dark:text-[#8CA3AF] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{ui.t('خروج', 'Sign Out')}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => core.navigate('screen-landing')}
              className="h-9 sm:h-10 px-3 sm:px-4 rounded-[10px] bg-[#0E7490] hover:bg-[#0B5C73] text-white text-xs font-semibold flex items-center gap-2 transition-all hover:scale-[1.02] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{ui.t('تسجيل الدخول', 'Sign In')}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
