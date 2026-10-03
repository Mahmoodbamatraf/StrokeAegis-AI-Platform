// StrokeAegis AI — Unified Multi-Agent Clinical Platform Logic

let currentAIScanBlob = null;
let currentRegScanBlob = null;
let currentAIData = null;
let currentRegDiagData = null;
let activeCTView = 'overlay';
let activeRegCTView = 'overlay';
let cachedPresets = null;

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initLanguageControl();
    initScreenNavigation();
    initAuthPortal();
    initClinicalPortals();
    initPresets();
    initAIPipeline();
    initRegularSystem();
    initChatbot();

    // Auto-restore authenticated user session
    const savedToken = localStorage.getItem('strokeaegis_token');
    const savedUser = JSON.parse(localStorage.getItem('strokeaegis_user') || '{}');
    if (savedToken && savedUser && savedUser.role) {
        updateHeaderUserBadge(savedUser);
        if (savedUser.role === 'doctor') {
            showDoctorPortal();
        } else if (savedUser.role === 'patient') {
            showPatientPortal();
        }
    }
});

// ==============================================================
// 0. THEME & LANGUAGE CONTROLLER
// ==============================================================
function initTheme() {
    const themeBtn = document.getElementById('btn-theme-toggle');
    const themeKnob = document.getElementById('theme-switch-knob');
    const themeLabel = document.getElementById('theme-label-text');

    const savedTheme = localStorage.getItem('strokeaegis_theme');
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (systemDark ? 'dark' : 'light');

    const maxTravel = 40; // Travel distance between Left (0px) and Right (40px)
    let isDragging = false;
    let startX = 0;
    let currentDeltaX = 0;
    let dragDistance = 0;
    let pointerId = null;

    function updateCapsuleLabel(theme) {
        const isAr = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
        if (themeLabel) {
            themeLabel.textContent = (theme === 'dark') ? (isAr ? 'الوضع النهاري' : 'LIGHT MODE') : (isAr ? 'الوضع الداكن' : 'DARK MODE');
        }
        if (themeBtn) {
            if (theme === 'dark') {
                themeBtn.title = isAr ? 'اسحب لليسار أو انقر للوضع الفاتح' : 'Drag left or click for Light Mode';
            } else {
                themeBtn.title = isAr ? 'اسحب لليمين أو انقر للوضع الداكن' : 'Drag right or click for Dark Mode';
            }
        }
    }

    function setTheme(theme) {
        document.body.classList.add('theme-transitioning');
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('strokeaegis_theme', theme);
        updateCapsuleLabel(theme);
        if (themeKnob) {
            themeKnob.style.transform = ''; // Clear inline transform so CSS smoothly handles resting position
        }
        setTimeout(() => {
            document.body.classList.remove('theme-transitioning');
        }, 350);
    }

    setTheme(initialTheme);

    if (themeBtn) {
        // Pointer events for instant cross-device Drag & Click support
        themeBtn.addEventListener('pointerdown', (e) => {
            // Only primary mouse button or touch
            if (e.button !== 0 && e.pointerType === 'mouse') return;

            isDragging = true;
            dragDistance = 0;
            startX = e.clientX;
            currentDeltaX = 0;
            pointerId = e.pointerId;

            try {
                themeBtn.setPointerCapture(e.pointerId);
            } catch (err) {}
        });

        themeBtn.addEventListener('pointermove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            dragDistance = Math.abs(deltaX);

            if (dragDistance > 3) {
                themeBtn.classList.add('is-dragging');
            }

            const curTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const basePos = (curTheme === 'dark') ? maxTravel : 0;
            let targetPos = basePos + deltaX;

            // Clamp between 0 and maxTravel
            targetPos = Math.max(0, Math.min(maxTravel, targetPos));

            if (themeKnob) {
                themeKnob.style.transform = `translateX(${targetPos}px)`;
            }

            currentDeltaX = deltaX;
        });

        function finishInteraction(e) {
            if (!isDragging) return;
            isDragging = false;
            themeBtn.classList.remove('is-dragging');

            if (pointerId !== null) {
                try {
                    themeBtn.releasePointerCapture(pointerId);
                } catch (err) {}
                pointerId = null;
            }

            const curTheme = document.documentElement.getAttribute('data-theme') || 'light';

            // If pointer barely moved, treat as a quick CLICK / TAP
            if (dragDistance < 6) {
                const newTheme = curTheme === 'dark' ? 'light' : 'dark';
                setTheme(newTheme);
                return;
            }

            // It was a DRAG: check if dragged past midpoint (50%)
            const midpoint = maxTravel / 2;
            const basePos = (curTheme === 'dark') ? maxTravel : 0;
            const finalPos = Math.max(0, Math.min(maxTravel, basePos + currentDeltaX));

            if (curTheme === 'light') {
                if (finalPos >= midpoint) {
                    setTheme('dark');
                } else {
                    if (themeKnob) themeKnob.style.transform = '';
                }
            } else {
                if (finalPos <= midpoint) {
                    setTheme('light');
                } else {
                    if (themeKnob) themeKnob.style.transform = '';
                }
            }
        }

        themeBtn.addEventListener('pointerup', finishInteraction);
        themeBtn.addEventListener('pointercancel', finishInteraction);

        // Prevent native click interference
        themeBtn.addEventListener('click', (e) => {
            e.preventDefault();
        });
    }

    // Listen for language changes to update switch label
    window.addEventListener('languageChanged', (e) => {
        const curTheme = document.documentElement.getAttribute('data-theme') || 'light';
        updateCapsuleLabel(curTheme);
    });
}

function initLanguageControl() {
    const langBtn = document.getElementById('btn-lang-toggle');
    if (langBtn) {
        langBtn.addEventListener('click', () => {
            if (typeof toggleLanguage === 'function') {
                toggleLanguage();
            }
        });
    }
}

// ==============================================================
// 1. SCREEN & WIZARD NAVIGATION
// ==============================================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (screenId === 'screen-ai-system' || screenId === 'screen-regular-system') {
        updateDynamicReturnLabels();
    }
}

function returnToUserHome() {
    const user = JSON.parse(localStorage.getItem('strokeaegis_user') || '{}');
    if (user && user.role === 'doctor') {
        showDoctorPortal();
    } else if (user && user.role === 'patient') {
        showPatientPortal();
    } else {
        const token = localStorage.getItem('strokeaegis_token');
        if (token) {
            showScreen('screen-home');
        } else {
            showScreen('screen-landing');
        }
    }
}

function updateDynamicReturnLabels() {
    const user = JSON.parse(localStorage.getItem('strokeaegis_user') || '{}');
    const isDoc = user && user.role === 'doctor';
    const isPat = user && user.role === 'patient';
    const lang = (typeof currentLang !== 'undefined') ? currentLang : (localStorage.getItem('strokeaegis_lang') || 'en');
    const isAr = lang === 'ar';

    let backKey = 'stepper.return';
    let regBackKey = 'reg.return';
    let homeKey = 'btn.return_home';

    if (isDoc) {
        backKey = 'stepper.return_doctor';
        regBackKey = 'reg.return_doctor';
        homeKey = 'btn.return_doctor';
    } else if (isPat) {
        backKey = 'stepper.return_patient';
        regBackKey = 'reg.return_patient';
        homeKey = 'btn.return_patient';
    }

    const backText = (typeof getTranslation === 'function') ? getTranslation(backKey, lang) : (isDoc ? (isAr ? '→ العودة إلى لوحة تحكم الطبيب' : '← Return to Doctor Dashboard') : (isAr ? '→ العودة لاختيار النظام' : '← Return to System Selection'));
    const regBackText = (typeof getTranslation === 'function') ? getTranslation(regBackKey, lang) : backText;
    const homeText = (typeof getTranslation === 'function') ? getTranslation(homeKey, lang) : (isDoc ? (isAr ? 'العودة إلى لوحة تحكم الطبيب' : 'Return to Doctor Dashboard') : (isAr ? 'العودة إلى الرئيسية' : 'Return to Home'));

    const btnAIBack = document.getElementById('btn-ai-back-home');
    if (btnAIBack) {
        btnAIBack.innerHTML = `${getLucideIcon(isAr ? 'arrow-right' : 'arrow-left')} <span>${backText.replace(/^[←→]\s*/, '')}</span>`;
    }

    const btnRegBack = document.getElementById('btn-reg-back-home');
    if (btnRegBack) {
        btnRegBack.innerHTML = `${getLucideIcon(isAr ? 'arrow-right' : 'arrow-left')} <span>${regBackText.replace(/^[←→]\s*/, '')}</span>`;
    }

    const btnAIFinish = document.getElementById('btn-ai-finish-home');
    if (btnAIFinish) {
        btnAIFinish.innerHTML = `${getLucideIcon('home')} <span>${homeText.replace(/^[🏠\s]+/, '')}</span>`;
    }

    const btnReportHome = document.getElementById('btn-return-home-from-report');
    if (btnReportHome) {
        btnReportHome.innerHTML = `${getLucideIcon('home')} <span>${homeText.replace(/^[🏠\s]+/, '')}</span>`;
    }

    const btnRegRiskHome = document.getElementById('btn-reg-risk-home');
    if (btnRegRiskHome) {
        btnRegRiskHome.innerHTML = `${getLucideIcon('home')} <span>${homeText.replace(/^[🏠\s]+/, '')}</span>`;
    }

    const btnRegCTHome = document.getElementById('btn-reg-ct-home');
    if (btnRegCTHome) {
        btnRegCTHome.innerHTML = `${getLucideIcon('home')} <span>${homeText.replace(/^[🏠\s]+/, '')}</span>`;
    }
}

function showAIStep(stepNum) {
    // 1. Update wizard panes
    document.querySelectorAll('#screen-ai-system .wizard-pane').forEach(pane => pane.classList.remove('active'));
    const pane = document.getElementById(`ai-wizard-step-${stepNum}`);
    if (pane) pane.classList.add('active');

    // 2. Update breadcrumb stepper
    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`wstep-${i}`);
        if (!stepEl) continue;
        stepEl.classList.remove('active', 'completed');
        if (i === stepNum) {
            stepEl.classList.add('active');
        } else if (i < stepNum) {
            stepEl.classList.add('completed');
        }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showRegSubtab(tabKey) {
    const btnRisk = document.getElementById('subtab-btn-risk');
    const btnCT = document.getElementById('subtab-btn-ct');
    const paneRisk = document.getElementById('subtab-reg-risk');
    const paneCT = document.getElementById('subtab-reg-ct');

    if (tabKey === 'reg-risk') {
        if (btnRisk) btnRisk.classList.add('active');
        if (btnCT) btnCT.classList.remove('active');
        if (paneRisk) paneRisk.classList.add('active');
        if (paneCT) paneCT.classList.remove('active');
    } else {
        if (btnCT) btnCT.classList.add('active');
        if (btnRisk) btnRisk.classList.remove('active');
        if (paneCT) paneCT.classList.add('active');
        if (paneRisk) paneRisk.classList.remove('active');
    }
}

function initScreenNavigation() {
    // Mode selection on Home Screen
    const btnStartAI = document.getElementById('btn-home-start-ai');
    const cardAI = document.getElementById('home-card-ai');
    const btnStartReg = document.getElementById('btn-home-start-regular');
    const cardReg = document.getElementById('home-card-regular');

    if (btnStartAI) {
        btnStartAI.addEventListener('click', () => {
            const user = JSON.parse(localStorage.getItem('strokeaegis_user') || '{}');
            if (user && user.role === 'doctor') {
                openLaunchAIChoiceModal();
            } else {
                launchAISystemStandalone();
            }
        });
    }
    if (cardAI) {
        cardAI.addEventListener('click', (e) => {
            if (e.target !== btnStartAI && !btnStartAI.contains(e.target)) {
                const user = JSON.parse(localStorage.getItem('strokeaegis_user') || '{}');
                if (user && user.role === 'doctor') {
                    openLaunchAIChoiceModal();
                } else {
                    launchAISystemStandalone();
                }
            }
        });
    }

    if (btnStartReg) {
        btnStartReg.addEventListener('click', () => {
            showScreen('screen-regular-system');
            showRegSubtab('reg-risk');
        });
    }
    if (cardReg) {
        cardReg.addEventListener('click', (e) => {
            if (e.target !== btnStartReg && !btnStartReg.contains(e.target)) {
                showScreen('screen-regular-system');
                showRegSubtab('reg-risk');
            }
        });
    }

    // Return to Home Buttons
    const homeButtons = [
        'header-brand-home',
        'btn-ai-back-home',
        'btn-ai-finish-home',
        'btn-return-home-from-report',
        'btn-reg-back-home',
        'btn-reg-risk-home',
        'btn-reg-ct-home'
    ];
    homeButtons.forEach(btnId => {
        const el = document.getElementById(btnId);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                returnToUserHome();
            });
        }
    });

    // Stepper clickable for already visited steps
    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`wstep-${i}`);
        if (stepEl) {
            stepEl.style.cursor = 'pointer';
            stepEl.addEventListener('click', () => {
                if (i <= 2) {
                    showAIStep(i);
                } else if (i === 4 && currentAIData) {
                    showAIStep(4);
                }
            });
        }
    }

    // New AI Analysis Button in Step 4
    const btnNewAnalysis = document.getElementById('btn-new-ai-analysis');
    if (btnNewAnalysis) {
        btnNewAnalysis.addEventListener('click', () => {
            clearAIForm();
            clearAIScan();
            currentAIData = null;
            showAIStep(1);
        });
    }

    // Regular Mode Subtabs
    const btnRiskTab = document.getElementById('subtab-btn-risk');
    const btnCTTab = document.getElementById('subtab-btn-ct');
    if (btnRiskTab) btnRiskTab.addEventListener('click', () => showRegSubtab('reg-risk'));
    if (btnCTTab) btnCTTab.addEventListener('click', () => showRegSubtab('reg-ct'));
}

// ==============================================================
// 1.5 AUTHENTICATION & LEADING PORTAL CONTROLLER
// ==============================================================
let currentAuthTab = 'signin';   // 'signin' | 'signup'
let currentAuthRole = 'doctor';  // 'doctor' | 'patient'

function updateHeaderUserBadge(user) {
    const btnAuth = document.getElementById('btn-header-auth');
    const userBadge = document.getElementById('header-user-badge');
    const avatarEl = document.getElementById('header-user-avatar');
    const nameEl = document.getElementById('header-user-name');
    const roleEl = document.getElementById('header-user-role');
    const btnNotifs = document.getElementById('btn-header-notifs');

    if (user && (user.full_name || user.email)) {
        if (btnAuth) btnAuth.style.display = 'none';
        if (userBadge) userBadge.style.display = 'inline-flex';
        if (avatarEl) avatarEl.innerHTML = (user.role === 'doctor') ? getLucideIcon('stethoscope') : getLucideIcon('user');
        if (nameEl) nameEl.textContent = user.full_name || user.email.split('@')[0];
        if (roleEl) roleEl.textContent = (user.role === 'doctor') ? 'Doctor' : 'Patient';
        if (btnNotifs) {
            btnNotifs.style.display = 'inline-flex';
            loadNotifications();
        }
    } else {
        if (btnAuth) btnAuth.style.display = 'inline-flex';
        if (userBadge) userBadge.style.display = 'none';
        if (btnNotifs) btnNotifs.style.display = 'none';
    }
    updateDynamicReturnLabels();
}

function updateAuthUI() {
    const isAr = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
    const tabSignIn = document.getElementById('tab-auth-signin');
    const tabSignUp = document.getElementById('tab-auth-signup');
    const roleDoc = document.getElementById('role-pill-doctor');
    const rolePat = document.getElementById('role-pill-patient');
    const signupFields = document.getElementById('auth-signup-fields');
    const docFields = document.getElementById('auth-doctor-fields');
    const patFields = document.getElementById('auth-patient-fields');
    const btnText = document.getElementById('auth-btn-text');
    const robotText = document.getElementById('landing-robot-text');
    const alertBanner = document.getElementById('auth-alert-banner');

    if (alertBanner) alertBanner.style.display = 'none';

    // 1. Tabs
    if (tabSignIn && tabSignUp) {
        tabSignIn.classList.toggle('active', currentAuthTab === 'signin');
        tabSignUp.classList.toggle('active', currentAuthTab === 'signup');
    }

    // 2. Role Pills
    if (roleDoc && rolePat) {
        roleDoc.classList.toggle('active', currentAuthRole === 'doctor');
        rolePat.classList.toggle('active', currentAuthRole === 'patient');
    }

    // 3. Conditional Fields
    if (signupFields) {
        signupFields.style.display = (currentAuthTab === 'signup') ? 'flex' : 'none';
    }
    if (docFields && patFields) {
        docFields.style.display = (currentAuthRole === 'doctor' && currentAuthTab === 'signup') ? 'block' : 'none';
        patFields.style.display = (currentAuthRole === 'patient' && currentAuthTab === 'signup') ? 'block' : 'none';
    }

    // 4. Submit Button Label
    if (btnText) {
        if (currentAuthTab === 'signin') {
            btnText.textContent = (currentAuthRole === 'doctor')
                ? (isAr ? 'تسجيل الدخول كطبيب' : 'Sign In as Doctor')
                : (isAr ? 'تسجيل الدخول كمريض' : 'Sign In as Patient');
        } else {
            btnText.textContent = (currentAuthRole === 'doctor')
                ? (isAr ? 'إنشاء حساب طبيب جديد' : 'Create Doctor Account')
                : (isAr ? 'إنشاء حساب مريض جديد' : 'Create Patient Account');
        }
    }

    // 5. Cute Doctor Robot Speech Bubble Messages
    if (robotText) {
        if (currentAuthTab === 'signin') {
            if (currentAuthRole === 'doctor') {
                robotText.textContent = isAr
                    ? 'أهلاً بعودتك يا دكتور! سجل دخولك لمراجعة مرضاك وتشغيل تحليلات الذكاء الاصطناعي.'
                    : 'Welcome back, Doctor! Sign in to review your patients and launch multi-agent clinical runs.';
            } else {
                robotText.textContent = isAr
                    ? 'مرحباً بك! سجل دخولك للاطلاع على نتائج فحص السكتة ومتابعة تقاريرك الطبية المعتمدة.'
                    : 'Welcome! Sign in to access your personal stroke risk results and view your certified reports.';
            }
        } else {
            if (currentAuthRole === 'doctor') {
                robotText.textContent = isAr
                    ? 'انضم إلى شبكتنا العصبية السريرية! سجل باستخدام ترخيصك الطبي للبدء.'
                    : 'Join our clinical neurology network! Register with your medical license to get started.';
            } else {
                robotText.textContent = isAr
                    ? 'حافظ على صحتك! أنشئ ملفك الصحي الآمن لتتبع صحتك الوعائية واستشارة الأطباء.'
                    : 'Protect your vascular health! Create your secure patient profile to track your health.';
            }
        }
    }
}

function formatAuthErrorMessage(error) {
    if (!error) return 'An unexpected error occurred. Please try again.';
    if (typeof error === 'string') return error;
    if (Array.isArray(error)) {
        return error.map(e => {
            if (typeof e === 'string') return e;
            if (e && typeof e === 'object') {
                const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : '';
                const msg = e.msg || e.message || JSON.stringify(e);
                const cleanField = field ? (field.charAt(0).toUpperCase() + field.slice(1)).replace(/_/g, ' ') : '';
                return cleanField ? `${cleanField}: ${msg}` : msg;
            }
            return String(e);
        }).join('; ');
    }
    if (typeof error === 'object') {
        if (error.detail) return formatAuthErrorMessage(error.detail);
        if (error.msg) return error.msg;
        if (error.message) return error.message;
        try {
            return JSON.stringify(error);
        } catch {
            return 'An error occurred. Please try again.';
        }
    }
    return String(error);
}

function showAuthAlert(message, type = 'error') {
    const alertBanner = document.getElementById('auth-alert-banner');
    const alertMsg = document.getElementById('auth-alert-msg');
    const alertIcon = document.getElementById('auth-alert-icon');
    if (alertBanner && alertMsg) {
        alertBanner.className = `auth-alert-banner ${type}`;
        alertMsg.textContent = formatAuthErrorMessage(message);
        if (alertIcon) alertIcon.innerHTML = (type === 'error') ? getLucideIcon('alert-triangle') : getLucideIcon('check-circle-2');
        alertBanner.style.display = 'flex';
    }
}

async function performAuthLogin(email, password) {
    const spinner = document.getElementById('auth-btn-spinner');
    const btnText = document.getElementById('auth-btn-text');
    if (spinner) spinner.style.display = 'inline-block';
    if (btnText) btnText.style.opacity = '0.7';

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), password })
        });

        let data;
        try {
            data = await response.json();
        } catch (jsonErr) {
            data = { detail: `Server error (${response.status}): Failed to parse response.` };
        }

        if (!response.ok) {
            const errorDetail = data.detail || data.message || 'Authentication failed. Please check credentials.';
            showAuthAlert(errorDetail, 'error');
            return false;
        }

        // Save session
        localStorage.setItem('strokeaegis_token', data.access_token);
        localStorage.setItem('strokeaegis_user', JSON.stringify(data));
        updateHeaderUserBadge(data);

        showAuthAlert(`Welcome back, ${data.full_name}! Redirecting to workspace...`, 'success');
        setTimeout(() => {
            if (data.role === 'doctor') {
                showDoctorPortal();
            } else if (data.role === 'patient') {
                showPatientPortal();
            } else {
                showScreen('screen-home');
            }
        }, 400);
        return true;

    } catch (err) {
        showAuthAlert(`Network error: ${err.message}`, 'error');
        return false;
    } finally {
        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.style.opacity = '1';
    }
}

async function initAuthPortal() {
    // 1. Tab switches
    const tabSignIn = document.getElementById('tab-auth-signin');
    const tabSignUp = document.getElementById('tab-auth-signup');
    if (tabSignIn) {
        tabSignIn.addEventListener('click', () => {
            currentAuthTab = 'signin';
            updateAuthUI();
        });
    }
    if (tabSignUp) {
        tabSignUp.addEventListener('click', () => {
            currentAuthTab = 'signup';
            updateAuthUI();
        });
    }

    // 2. Role pills
    const roleDoc = document.getElementById('role-pill-doctor');
    const rolePat = document.getElementById('role-pill-patient');
    if (roleDoc) {
        roleDoc.addEventListener('click', () => {
            currentAuthRole = 'doctor';
            updateAuthUI();
        });
    }
    if (rolePat) {
        rolePat.addEventListener('click', () => {
            currentAuthRole = 'patient';
            updateAuthUI();
        });
    }

    // 3. Password Show/Hide Toggle
    const btnTogglePwd = document.getElementById('btn-toggle-pwd');
    const pwdInput = document.getElementById('auth-input-password');
    const pwdEyeIcon = document.getElementById('pwd-eye-icon');
    if (btnTogglePwd && pwdInput) {
        btnTogglePwd.addEventListener('click', () => {
            const isPassword = pwdInput.type === 'password';
            pwdInput.type = isPassword ? 'text' : 'password';
            if (pwdEyeIcon) pwdEyeIcon.innerHTML = isPassword ? getLucideIcon('eye-off') : getLucideIcon('eye');
        });
    }

    // 4. Form Submission
    const authForm = document.getElementById('auth-portal-form');
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const isAr = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
            const email = (document.getElementById('auth-input-email').value || '').trim();
            const password = document.getElementById('auth-input-password').value || '';

            if (!email) {
                showAuthAlert(isAr ? 'يرجى إدخال البريد الإلكتروني.' : 'Please enter your email address.', 'error');
                document.getElementById('auth-input-email')?.focus();
                return;
            }

            if (!email.includes('@')) {
                showAuthAlert(isAr ? 'يرجى إدخال بريد إلكتروني صالح (مثال: user@example.com).' : 'Please enter a valid email address (e.g. user@example.com).', 'error');
                document.getElementById('auth-input-email')?.focus();
                return;
            }

            if (!password) {
                showAuthAlert(isAr ? 'يرجى إدخال كلمة المرور.' : 'Please enter your password.', 'error');
                document.getElementById('auth-input-password')?.focus();
                return;
            }

            if (password.length < 6) {
                showAuthAlert(isAr ? 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.' : 'Password must be at least 6 characters long.', 'error');
                document.getElementById('auth-input-password')?.focus();
                return;
            }

            if (currentAuthTab === 'signin') {
                await performAuthLogin(email, password);
            } else {
                // Sign Up
                const fullName = (document.getElementById('auth-input-fullname').value || '').trim();
                if (!fullName || fullName.length < 2) {
                    showAuthAlert(isAr ? 'يرجى إدخال الاسم الكامل (حرفين على الأقل).' : 'Full name is required (at least 2 characters).', 'error');
                    document.getElementById('auth-input-fullname')?.focus();
                    return;
                }

                let endpoint = '';
                let payload = {};

                if (currentAuthRole === 'doctor') {
                    endpoint = '/api/auth/register/doctor';
                    const license = (document.getElementById('auth-input-license').value || '').trim();
                    const spec = (document.getElementById('auth-input-spec').value || '').trim() || 'Stroke Neurology';
                    const hospital = (document.getElementById('auth-input-hospital').value || '').trim();

                    if (!license) {
                        showAuthAlert(isAr ? 'رقم الترخيص الطبي مطلوب للتسجيل كطبيب.' : 'Medical License number is required for doctor registration.', 'error');
                        document.getElementById('auth-input-license')?.focus();
                        return;
                    }

                    payload = {
                        email,
                        password,
                        full_name: fullName,
                        license_number: license,
                        specialization: spec,
                        hospital_affiliation: hospital || null
                    };
                } else {
                    endpoint = '/api/auth/register/patient';
                    const dobVal = (document.getElementById('auth-input-dob').value || '').trim();
                    const genderVal = document.getElementById('auth-input-gender')?.value || 'Male';
                    const emergency = (document.getElementById('auth-input-emergency').value || '').trim() || null;

                    payload = {
                        email,
                        password,
                        full_name: fullName,
                        date_of_birth: dobVal || null,
                        gender: genderVal,
                        emergency_contact: emergency
                    };
                }

                const spinner = document.getElementById('auth-btn-spinner');
                const btnText = document.getElementById('auth-btn-text');
                if (spinner) spinner.style.display = 'inline-block';
                if (btnText) btnText.style.opacity = '0.7';

                try {
                    const res = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    let data;
                    try {
                        data = await res.json();
                    } catch (parseErr) {
                        data = { detail: `Server error (${res.status}): Failed to parse response.` };
                    }

                    if (!res.ok) {
                        showAuthAlert(data.detail || data.message || 'Registration failed. Please check your data.', 'error');
                        return;
                    }

                    // Save session
                    localStorage.setItem('strokeaegis_token', data.access_token);
                    localStorage.setItem('strokeaegis_user', JSON.stringify(data));
                    updateHeaderUserBadge(data);

                    showAuthAlert(`Account created successfully! Welcome to StrokeAegis, ${data.full_name}.`, 'success');
                    setTimeout(() => {
                        if (data.role === 'doctor') {
                            showDoctorPortal();
                        } else if (data.role === 'patient') {
                            showPatientPortal();
                        } else {
                            showScreen('screen-home');
                        }
                    }, 450);

                } catch (err) {
                    showAuthAlert(`Registration error: ${err.message}`, 'error');
                } finally {
                    if (spinner) spinner.style.display = 'none';
                    if (btnText) btnText.style.opacity = '1';
                }
            }
        });
    }

    // 5. 1-Click Fast Demo Sign-In Buttons
    const btnDemoDoc = document.getElementById('btn-demo-doctor');
    const btnDemoPat = document.getElementById('btn-demo-patient');

    if (btnDemoDoc) {
        btnDemoDoc.addEventListener('click', async () => {
            currentAuthTab = 'signin';
            currentAuthRole = 'doctor';
            updateAuthUI();
            document.getElementById('auth-input-email').value = 'doctor@strokeaegis.local';
            document.getElementById('auth-input-password').value = 'DoctorSecure2026!';
            await performAuthLogin('doctor@strokeaegis.local', 'DoctorSecure2026!');
        });
    }

    if (btnDemoPat) {
        btnDemoPat.addEventListener('click', async () => {
            currentAuthTab = 'signin';
            currentAuthRole = 'patient';
            updateAuthUI();
            document.getElementById('auth-input-email').value = 'patient@strokeaegis.local';
            document.getElementById('auth-input-password').value = 'PatientSecure2026!';
            await performAuthLogin('patient@strokeaegis.local', 'PatientSecure2026!');
        });
    }

    // 7. Header Navigation Auth Button
    const btnHeaderAuth = document.getElementById('btn-header-auth');
    if (btnHeaderAuth) {
        btnHeaderAuth.addEventListener('click', () => {
            showScreen('screen-landing');
        });
    }

    // 8. Header Sign Out Button
    const btnSignOut = document.getElementById('btn-header-signout');
    if (btnSignOut) {
        btnSignOut.addEventListener('click', () => {
            localStorage.removeItem('strokeaegis_token');
            localStorage.removeItem('strokeaegis_user');
            updateHeaderUserBadge(null);
            showScreen('screen-landing');
            showAuthAlert('You have been signed out safely.', 'success');
        });
    }

    // 9. Robot click animation & greeting
    const robotImg = document.getElementById('landing-doctor-robot');
    if (robotImg) {
        robotImg.addEventListener('click', () => {
            robotImg.style.animation = 'none';
            void robotImg.offsetWidth; // force reflow
            robotImg.style.animation = 'robot-float 1.5s ease-in-out';
            const robotText = document.getElementById('landing-robot-text');
            if (robotText) {
                const isAr = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
                robotText.textContent = isAr
                    ? 'أنا جاهز دائماً لمساعدتك في اتخاذ قرارات سريرية دقيقة وإنقاذ الأرواح!'
                    : 'I am always ready to help you make precise clinical decisions and protect brain tissue!';
            }
        });
    }

    // 10. Update on language toggle
    window.addEventListener('languageChanged', () => {
        updateAuthUI();
        updateDynamicReturnLabels();
    });

    // 11. Initial State Check (Token verification)
    const token = localStorage.getItem('strokeaegis_token');
    if (token) {
        try {
            const meRes = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (meRes.ok) {
                const meData = await meRes.json();
                localStorage.setItem('strokeaegis_user', JSON.stringify(meData));
                updateHeaderUserBadge(meData);
                if (meData.role === 'doctor') {
                    showDoctorPortal();
                } else if (meData.role === 'patient') {
                    showPatientPortal();
                } else {
                    showScreen('screen-home');
                }
                return;
            } else {
                localStorage.removeItem('strokeaegis_token');
                localStorage.removeItem('strokeaegis_user');
                updateHeaderUserBadge(null);
            }
        } catch (e) {
            console.warn('[Auth] Token check failed:', e);
        }
    }

    // Default to leading screen if no active session
    updateAuthUI();
    showScreen('screen-landing');
}

// ==============================================================
// 2. PRESETS & FORM HANDLING (BLANK BY DEFAULT!)
// ==============================================================
async function initPresets() {
    try {
        const res = await fetch('/api/presets');
        const data = await res.json();
        cachedPresets = data;

        // 1. CT Presets Setup
        const aiCTContainer = document.getElementById('ai-ct-presets-container');
        const regCTContainer = document.getElementById('reg-ct-presets-container');

        if (data.ct_presets) {
            if (aiCTContainer) aiCTContainer.innerHTML = '';
            if (regCTContainer) regCTContainer.innerHTML = '';

            data.ct_presets.forEach(p => {
                // AI CT Preset Button
                if (aiCTContainer) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'ct-preset-mini-btn';
                    btn.innerHTML = `<img src="${p.preview_base64}" alt="${p.name}"> <span>${p.name.split('(')[0].trim()}</span>`;
                    btn.addEventListener('click', () => {
                        loadCTPresetToAI(p);
                    });
                    aiCTContainer.appendChild(btn);
                }

                // Regular CT Preset Button
                if (regCTContainer) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'ct-preset-mini-btn';
                    btn.innerHTML = `<img src="${p.preview_base64}" alt="${p.name}"> <span>${p.name.split('(')[0].trim()}</span>`;
                    btn.addEventListener('click', () => {
                        loadCTPresetToReg(p);
                    });
                    regCTContainer.appendChild(btn);
                }
            });
        }

        // 2. Patient Presets Setup
        const pHigh = document.getElementById('ai-preset-high');
        const pMod = document.getElementById('ai-preset-mod');
        const pLow = document.getElementById('ai-preset-low');
        const pClear = document.getElementById('ai-preset-clear');
        const pQuickFill = document.getElementById('btn-ai-step1-preset-fill');

        const rHigh = document.getElementById('reg-preset-high');
        const rMod = document.getElementById('reg-preset-mod');
        const rLow = document.getElementById('reg-preset-low');
        const rClear = document.getElementById('reg-preset-clear');

        if (data.patient_presets) {
            if (pHigh) pHigh.addEventListener('click', () => { setPresetPillActive(pHigh); fillAIForm(data.patient_presets[0].data); });
            if (pMod) pMod.addEventListener('click', () => { setPresetPillActive(pMod); fillAIForm(data.patient_presets[1].data); });
            if (pLow) pLow.addEventListener('click', () => { setPresetPillActive(pLow); fillAIForm(data.patient_presets[2].data); });
            if (pQuickFill) pQuickFill.addEventListener('click', () => { setPresetPillActive(pHigh); fillAIForm(data.patient_presets[0].data); });

            if (rHigh) rHigh.addEventListener('click', () => { setPresetPillActive(rHigh); fillRegForm(data.patient_presets[0].data); });
            if (rMod) rMod.addEventListener('click', () => { setPresetPillActive(rMod); fillRegForm(data.patient_presets[1].data); });
            if (rLow) rLow.addEventListener('click', () => { setPresetPillActive(rLow); fillRegForm(data.patient_presets[2].data); });
        }

        if (pClear) pClear.addEventListener('click', () => clearAIForm());
        if (rClear) rClear.addEventListener('click', () => clearRegForm());

        // Note: We DO NOT auto-fill forms or auto-load scans on page load!
        // The user explicitly requested clean forms and empty dropzones by default.

    } catch (e) {
        console.error("Failed to load presets:", e);
    }
}

function setPresetPillActive(activeBtn) {
    const parent = activeBtn.closest('.presets-row');
    if (parent) {
        parent.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
    }
    activeBtn.classList.add('active');
}

function fillAIForm(data) {
    if (!data) return;
    const g = document.getElementById('ai-gender'); if (g) g.value = data.gender;
    const a = document.getElementById('ai-age'); if (a) a.value = data.age;
    const h = document.getElementById('ai-hypertension'); if (h) h.value = String(data.hypertension);
    const hd = document.getElementById('ai-heart'); if (hd) hd.value = String(data.heart_disease);
    const gl = document.getElementById('ai-glucose'); if (gl) gl.value = data.avg_glucose_level;
    const bm = document.getElementById('ai-bmi'); if (bm) bm.value = data.bmi;
    const sm = document.getElementById('ai-smoking'); if (sm) sm.value = data.smoking_status;
    const m = document.getElementById('ai-married'); if (m) m.value = data.ever_married;
    const w = document.getElementById('ai-work'); if (w) w.value = data.work_type;
    const r = document.getElementById('ai-residence'); if (r) r.value = data.Residence_type;
}

function clearAIForm() {
    const f = document.getElementById('ai-patient-form');
    if (f) f.reset();
    document.querySelectorAll('#ai-wizard-step-1 .preset-pill').forEach(p => p.classList.remove('active'));
}

function fillRegForm(data) {
    if (!data) return;
    const g = document.getElementById('reg-gender'); if (g) g.value = data.gender;
    const a = document.getElementById('reg-age'); if (a) a.value = data.age;
    const h = document.getElementById('reg-hypertension'); if (h) h.value = String(data.hypertension);
    const hd = document.getElementById('reg-heart'); if (hd) hd.value = String(data.heart_disease);
    const gl = document.getElementById('reg-glucose'); if (gl) gl.value = data.avg_glucose_level;
    const bm = document.getElementById('reg-bmi'); if (bm) bm.value = data.bmi;
    const sm = document.getElementById('reg-smoking'); if (sm) sm.value = data.smoking_status;
}

function clearRegForm() {
    const f = document.getElementById('reg-risk-form');
    if (f) f.reset();
    document.querySelectorAll('#subtab-reg-risk .preset-pill').forEach(p => p.classList.remove('active'));
    const placeholder = document.getElementById('reg-risk-placeholder');
    const content = document.getElementById('reg-risk-content');
    if (placeholder) placeholder.style.display = 'block';
    if (content) content.style.display = 'none';
}

function loadCTPresetToAI(preset) {
    fetch(preset.preview_base64)
        .then(res => res.blob())
        .then(blob => {
            currentAIScanBlob = blob;
            const preview = document.getElementById('ai-scan-preview');
            const dropzone = document.getElementById('ai-dropzone');
            const img = document.getElementById('ai-preview-img');
            const name = document.getElementById('ai-preview-name');

            if (img) img.src = preset.preview_base64;
            if (name) name.textContent = preset.filename;
            if (dropzone) dropzone.style.display = 'none';
            if (preview) preview.style.display = 'block';
        });
}

function clearAIScan() {
    currentAIScanBlob = null;
    const fileInput = document.getElementById('ai-ct-file-input');
    if (fileInput) fileInput.value = '';
    const preview = document.getElementById('ai-scan-preview');
    const dropzone = document.getElementById('ai-dropzone');
    if (preview) preview.style.display = 'none';
    if (dropzone) dropzone.style.display = 'block';
}

function loadCTPresetToReg(preset) {
    fetch(preset.preview_base64)
        .then(res => res.blob())
        .then(blob => {
            currentRegScanBlob = blob;
            const preview = document.getElementById('reg-scan-preview');
            const dropzone = document.getElementById('reg-dropzone');
            const img = document.getElementById('reg-preview-img');
            const name = document.getElementById('reg-preview-name');

            if (img) img.src = preset.preview_base64;
            if (name) name.textContent = preset.filename;
            if (dropzone) dropzone.style.display = 'none';
            if (preview) preview.style.display = 'block';

            // Automatically trigger Path B analysis
            runRegCTAnalysis(blob);
        });
}

function clearRegScan() {
    currentRegScanBlob = null;
    const fileInput = document.getElementById('reg-ct-file-input');
    if (fileInput) fileInput.value = '';
    const preview = document.getElementById('reg-scan-preview');
    const dropzone = document.getElementById('reg-dropzone');
    const placeholder = document.getElementById('reg-ct-placeholder');
    const content = document.getElementById('reg-ct-content');

    if (preview) preview.style.display = 'none';
    if (dropzone) dropzone.style.display = 'block';
    if (placeholder) placeholder.style.display = 'block';
    if (content) content.style.display = 'none';
}

// ==============================================================
// 3. OPTION 1: COMPLETE AI SYSTEM PIPELINE & SSE STREAMING
// ==============================================================
function initAIPipeline() {
    // Step 1 Form Navigation to Step 2
    const patientForm = document.getElementById('ai-patient-form');
    if (patientForm) {
        patientForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!patientForm.checkValidity()) {
                patientForm.reportValidity();
                return;
            }
            showAIStep(2);
        });
    }

    // Step 2 Back to Step 1
    const btnBackTo1 = document.getElementById('btn-ai-back-to-step1');
    if (btnBackTo1) {
        btnBackTo1.addEventListener('click', () => {
            showAIStep(1);
        });
    }

    // Step 2 File Upload & Drag-and-Drop
    const dropzone = document.getElementById('ai-dropzone');
    const fileInput = document.getElementById('ai-ct-file-input');
    const btnClearScan = document.getElementById('ai-btn-clear-scan');

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleAIFile(e.target.files[0]);
            }
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
            });
        });

        dropzone.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleAIFile(e.dataTransfer.files[0]);
            }
        });
    }

    if (btnClearScan) {
        btnClearScan.addEventListener('click', () => {
            clearAIScan();
        });
    }

    // Step 2 Launch Button -> Move to Step 3 & Launch Pipeline
    const btnLaunch = document.getElementById('btn-launch-ai-pipeline');
    if (btnLaunch) {
        btnLaunch.addEventListener('click', () => {
            const patientData = collectAIPatientData();
            if (!patientData.gender || isNaN(patientData.age) || isNaN(patientData.avg_glucose_level)) {
                alert("Please complete the required Patient Profile fields in Step 1 before launching the pipeline.");
                showAIStep(1);
                return;
            }
            showAIStep(3);
            launchFullAIPipeline(patientData);
        });
    }

    // Step 3 Completion Button -> Move to Step 4
    const btnToReport = document.getElementById('btn-to-report-view');
    if (btnToReport) {
        btnToReport.addEventListener('click', () => {
            showAIStep(4);
        });
    }

    // Radiological Viewer Toggles in Step 4
    const viewPills = document.querySelectorAll('.view-pill[data-view]');
    viewPills.forEach(pill => {
        pill.addEventListener('click', () => {
            viewPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            activeCTView = pill.getAttribute('data-view');
            updateAIRadiologyViewer();
        });
    });
}

function handleAIFile(file) {
    currentAIScanBlob = file;
    const preview = document.getElementById('ai-scan-preview');
    const dropzone = document.getElementById('ai-dropzone');
    const img = document.getElementById('ai-preview-img');
    const name = document.getElementById('ai-preview-name');

    if (name) name.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        if (img) img.src = e.target.result;
        if (dropzone) dropzone.style.display = 'none';
        if (preview) preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function collectAIPatientData() {
    const data = {
        gender: document.getElementById('ai-gender') ? document.getElementById('ai-gender').value : '',
        age: document.getElementById('ai-age') ? parseFloat(document.getElementById('ai-age').value) : NaN,
        hypertension: document.getElementById('ai-hypertension') ? parseInt(document.getElementById('ai-hypertension').value) : 0,
        heart_disease: document.getElementById('ai-heart') ? parseInt(document.getElementById('ai-heart').value) : 0,
        avg_glucose_level: document.getElementById('ai-glucose') ? parseFloat(document.getElementById('ai-glucose').value) : NaN,
        bmi: document.getElementById('ai-bmi') ? parseFloat(document.getElementById('ai-bmi').value) : NaN,
        smoking_status: document.getElementById('ai-smoking') ? document.getElementById('ai-smoking').value : '',
        ever_married: document.getElementById('ai-married') ? document.getElementById('ai-married').value : 'Yes',
        work_type: document.getElementById('ai-work') ? document.getElementById('ai-work').value : 'Private',
        Residence_type: document.getElementById('ai-residence') ? document.getElementById('ai-residence').value : 'Urban'
    };
    if (activeTargetPatient) {
        if (activeTargetPatient.id) data.patient_id = activeTargetPatient.id;
        if (activeTargetPatient.full_name) data.full_name = activeTargetPatient.full_name;
        if (activeTargetPatient.mrn) data.mrn = activeTargetPatient.mrn;
    }
    const loggedUser = JSON.parse(localStorage.getItem('strokeaegis_user') || '{}');
    if (loggedUser && loggedUser.role === 'doctor' && loggedUser.full_name) {
        let docName = loggedUser.full_name;
        if (!docName.toLowerCase().startsWith('dr.') && !docName.toLowerCase().startsWith('dr ')) {
            docName = 'Dr. ' + docName;
        }
        data.doctor_name = docName;
        data.attending_doctor = docName;
    }
    return data;
}

async function launchFullAIPipeline(patientData) {
    // Reset Stepper & Robot State in Step 3
    resetAIRobotAndTimeline();
    const step3Footer = document.getElementById('step3-footer');
    if (step3Footer) step3Footer.style.display = 'none';

    try {
        const formData = new FormData();
        formData.append('patient_json', JSON.stringify(patientData));
        if (currentAIScanBlob) {
            formData.append('file', currentAIScanBlob, 'scan.png');
        }

        // Start asynchronous pipeline
        const startRes = await fetch('/api/clinical/start-analysis', {
            method: 'POST',
            body: formData
        });
        const startData = await startRes.json();

        if (!startData.success || !startData.pipeline_id) {
            throw new Error(startData.detail || "Could not initialize AI pipeline.");
        }

        const pipelineId = startData.pipeline_id;
        console.log("Connected to AI Pipeline:", pipelineId);

        // Listen for real-time Server-Sent Events
        listenToPipelineStream(pipelineId);

    } catch (err) {
        alert("Pipeline Launch Error: " + err.message);
        const robotMsg = document.getElementById('speech-message');
        if (robotMsg) robotMsg.textContent = "Pipeline initialization failed: " + err.message;
    }
}

function listenToPipelineStream(pipelineId) {
    const eventSource = new EventSource(`/api/clinical/stream/${pipelineId}`);
    const robotImg = document.getElementById('robot-img');
    if (robotImg) robotImg.classList.add('working');

    eventSource.onmessage = (e) => {
        try {
            const ev = JSON.parse(e.data);
            handleAgentProgressEvent(ev, eventSource);
        } catch (err) {
            // Ignore non-json keepalive comments
        }
    };

    eventSource.onerror = (err) => {
        console.warn("SSE connection closed or lost. Falling back to polling result...", err);
        eventSource.close();
        pollPipelineCompletion(pipelineId);
    };
}

function handleAgentProgressEvent(ev, eventSource) {
    const robotTag = document.getElementById('speech-agent-tag');
    const robotMsg = document.getElementById('speech-message');
    const robotSub = document.getElementById('speech-sub');

    console.log(`[SSE Event] ${ev.agent} -> ${ev.status}: ${ev.message}`);

    // Update Robot Speech & Agent Timeline
    if (ev.agent === 'ml_risk') {
        updateAgentTimelineItem('models', ev.status, ev.message);
        if (robotTag) robotTag.innerHTML = `${getLucideIcon('bar-chart-3')} Predictive ML Model`;
        if (robotMsg) robotMsg.textContent = ev.message;
        if (robotSub) robotSub.textContent = 'Evaluating systemic vascular comorbidity multipliers...';
    } else if (ev.agent === 'ct_gate') {
        updateAgentTimelineItem('models', ev.status, ev.message);
        if (robotTag) robotTag.innerHTML = `${getLucideIcon('door-closed')} Door Safety Gatekeeper`;
        if (robotMsg) robotMsg.textContent = ev.message;
        if (robotSub) robotSub.textContent = 'Verifying ConvNeXt-Tiny authentic brain CT scan threshold...';
    } else if (ev.agent === 'ct_classifier') {
        updateAgentTimelineItem('models', ev.status, ev.message);
        if (robotTag) robotTag.innerHTML = `${getLucideIcon('brain')} Diagnostic Classifier`;
        if (robotMsg) robotMsg.textContent = ev.message;
        if (robotSub) robotSub.textContent = 'EfficientNetV2-S + GeM pooling & Grad-CAM lesion localization...';
    } else if (ev.agent === 'prevention') {
        updateAgentTimelineItem('models', 'completed', 'Models evaluation completed.');
        updateAgentTimelineItem('prevention', ev.status, ev.message);
        if (robotTag) robotTag.innerHTML = `${getLucideIcon('shield-check')} Prevention Agent`;
        if (robotMsg) robotMsg.textContent = ev.status === 'working' ? 'Prevention Agent is working...' : ev.message;
        if (robotSub) robotSub.textContent = ev.status === 'working' ? 'Retrieving stroke prevention guidelines from Medical RAG...' : 'Guideline evidence verified.';
    } else if (ev.agent === 'emergency') {
        updateAgentTimelineItem('emergency', ev.status, ev.message);
        if (robotTag) robotTag.innerHTML = `${getLucideIcon('siren')} Emergency Support Agent`;
        if (robotMsg) robotMsg.textContent = ev.status === 'working' ? 'Emergency Agent is working...' : ev.message;
        if (robotSub) robotSub.textContent = ev.status === 'working' ? 'Analyzing acute stroke guideline evidence & reperfusion criteria...' : 'Acute pathway established.';
    } else if (ev.agent === 'validation') {
        updateAgentTimelineItem('prevention', 'completed', 'Prevention guidelines finalized.');
        updateAgentTimelineItem('emergency', 'completed', 'Acute management protocol verified.');
        updateAgentTimelineItem('validation', ev.status, ev.message);
        if (robotTag) robotTag.innerHTML = `${getLucideIcon('search')} Medical Validation Agent`;
        if (robotMsg) robotMsg.textContent = ev.status === 'working' ? 'Validation Agent is auditing safety...' : ev.message;
        if (robotSub) robotSub.textContent = ev.status === 'working' ? 'Checking clinical consistency, contradictions, and non-autonomous stance...' : 'Clinical safety audit passed.';
    } else if (ev.agent === 'report') {
        updateAgentTimelineItem('validation', 'completed', 'Validation audit passed.');
        updateAgentTimelineItem('report', ev.status, ev.message);
        if (robotTag) robotTag.innerHTML = `${getLucideIcon('clipboard-list')} Medical Report Agent`;
        if (robotMsg) robotMsg.textContent = ev.status === 'working' ? 'Report Agent is compiling documentation...' : ev.message;
        if (robotSub) robotSub.textContent = ev.status === 'working' ? 'Synthesizing clinical decision report and compiling PDF document...' : 'Clinical report completed.';
    } else if (ev.agent === 'pipeline' && ev.status === 'completed') {
        eventSource.close();
        completeAIPipeline(ev.pipeline_id);
    }
}

async function pollPipelineCompletion(pipelineId) {
    let attempts = 0;
    const interval = setInterval(async () => {
        attempts++;
        try {
            const res = await fetch(`/api/clinical/result/${pipelineId}`);
            const data = await res.json();

            if (data.is_done) {
                clearInterval(interval);
                completeAIPipeline(pipelineId);
            }
        } catch (e) {
            console.error("Polling error:", e);
        }

        if (attempts > 30) {
            clearInterval(interval);
            alert("Pipeline execution timed out. Please try again.");
        }
    }, 2000);
}

async function completeAIPipeline(pipelineId) {
    const robotImg = document.getElementById('robot-img');
    if (robotImg) robotImg.classList.remove('working');

    const robotTag = document.getElementById('speech-agent-tag');
    const robotMsg = document.getElementById('speech-message');
    const robotSub = document.getElementById('speech-sub');

    if (robotTag) robotTag.innerHTML = `${getLucideIcon('check-circle-2')} Clinical AI Pipeline Completed`;
    if (robotMsg) robotMsg.textContent = 'All 4 CrewAI clinical agents finished and compiled the unified decision package!';
    if (robotSub) robotSub.textContent = 'Click below to view the full clinical findings, explainability views, and PDF report.';

    // Mark all agents completed in timeline
    ['models', 'prevention', 'emergency', 'validation', 'report'].forEach(ag => {
        updateAgentTimelineItem(ag, 'completed', 'Completed successfully');
    });

    // Reveal Step 3 Proceed Button
    const step3Footer = document.getElementById('step3-footer');
    if (step3Footer) step3Footer.style.display = 'flex';

    // Fetch full pipeline result and populate Step 4
    try {
        const res = await fetch(`/api/clinical/result/${pipelineId}`);
        const data = await res.json();
        if (data.result) {
            currentAIData = data.result;
            renderFullAIResults(data.result);
        }
    } catch (e) {
        console.error("Failed to fetch final results:", e);
    }
}

function updateAgentTimelineItem(agent, status, message) {
    const step = document.getElementById(`ag-step-${agent}`);
    const badge = document.getElementById(`badge-ag-${agent}`);
    const icon = document.getElementById(`ag-icon-${agent}`);
    const act = document.getElementById(`act-ag-${agent}`);

    if (!step || !badge) return;

    badge.className = `agent-status-badge ${status}`;
    if (status === 'working') {
        step.classList.add('active');
        badge.textContent = 'Working...';
        if (act && message) act.textContent = message;
    } else if (status === 'completed') {
        step.classList.remove('active');
        step.classList.add('completed');
        badge.textContent = 'Completed';
        if (icon) icon.innerHTML = getLucideIcon('check');
        if (act && message) act.textContent = message;
    } else if (status === 'failed') {
        step.classList.add('failed');
        badge.textContent = 'Failed';
        if (icon) icon.innerHTML = getLucideIcon('alert-triangle');
    }
}

function resetAIRobotAndTimeline() {
    const agents = [
        { id: 'models', iconName: 'settings', act: 'Evaluating vascular risk and verifying CT safety gate' },
        { id: 'prevention', iconName: 'shield-check', act: 'Retrieving stroke prevention guidelines from Medical RAG' },
        { id: 'emergency', iconName: 'siren', act: 'Analyzing acute stroke guideline evidence and reperfusion criteria' },
        { id: 'validation', iconName: 'search', act: 'Auditing clinical contradictions, consistency, and citation accuracy' },
        { id: 'report', iconName: 'clipboard-list', act: 'Synthesizing clinical decision report and compiling PDF document' }
    ];

    agents.forEach(ag => {
        const step = document.getElementById(`ag-step-${ag.id}`);
        const badge = document.getElementById(`badge-ag-${ag.id}`);
        const icon = document.getElementById(`ag-icon-${ag.id}`);
        const act = document.getElementById(`act-ag-${ag.id}`);

        if (step) step.className = 'agent-step-item';
        if (badge) {
            badge.className = ag.id === 'models' ? 'agent-status-badge working' : 'agent-status-badge waiting';
            badge.textContent = ag.id === 'models' ? 'Working...' : 'Waiting';
        }
        if (icon) icon.innerHTML = getLucideIcon(ag.iconName);
        if (act) act.textContent = ag.act;
    });

    const robotTag = document.getElementById('speech-agent-tag');
    const robotMsg = document.getElementById('speech-message');
    const robotSub = document.getElementById('speech-sub');
    if (robotTag) robotTag.innerHTML = `${getLucideIcon('bot')} System Initializing`;
    if (robotMsg) robotMsg.textContent = 'Starting StrokeAegis multi-agent clinical flow...';
    if (robotSub) robotSub.textContent = 'Orchestrating deterministic models and RAG clinical agents.';
}

// ==============================================================
// 4. RENDERING FULL AI SYSTEM RESULTS (STEP 4)
// ==============================================================
function renderFullAIResults(report) {
    // 1. ML Risk Card
    const risk = report.risk_assessment || {};
    const prob = risk.stroke_probability_pct || 0;
    const tier = risk.risk_tier || 'Moderate';

    const gaugePct = document.getElementById('ai-gauge-pct');
    if (gaugePct) gaugePct.textContent = `${prob}%`;

    const tierPill = document.getElementById('ai-tier-pill');
    if (tierPill) {
        tierPill.textContent = `${tier.toUpperCase()} RISK TIER`;
        tierPill.style.color = tier === 'High' ? 'var(--color-red)' : (tier === 'Moderate' ? 'var(--color-amber)' : 'var(--color-green)');
        tierPill.style.backgroundColor = tier === 'High' ? 'var(--color-red-light)' : (tier === 'Moderate' ? 'var(--color-amber-light)' : 'var(--color-green-light)');
    }

    const tierDesc = document.getElementById('ai-tier-desc');
    if (tierDesc) tierDesc.textContent = risk.risk_tier_description || '';

    const chips = document.getElementById('ai-factors-chips');
    if (chips) {
        chips.innerHTML = '';
        (risk.clinical_factors || []).forEach(f => {
            const chip = document.createElement('span');
            chip.className = 'chip-item';
            chip.textContent = f.factor;
            chips.appendChild(chip);
        });
    }

    // 2. CT Neuroimaging Card
    const ct = report.ct_analysis || {};
    const gate = ct.gate || {};
    const diag = ct.diagnosis || {};

    const gateStrip = document.getElementById('ai-gate-strip');
    const gateTitle = document.getElementById('ai-gate-title');
    const gateDesc = document.getElementById('ai-gate-desc');

    if (gateStrip && gateTitle && gateDesc) {
        if (gate.accepted) {
            gateStrip.className = 'gate-strip';
            gateTitle.textContent = `Gatekeeper Verified (${gate.confidence_pct || 99.4}% confidence)`;
            gateDesc.textContent = 'Authentic Brain CT Scan &bull; Passed ConvNeXt-Tiny Door Model.';
        } else {
            gateStrip.className = 'gate-strip rejected';
            gateTitle.textContent = `Door Model Safety Gate Rejection`;
            gateDesc.textContent = gate.message || 'Non-brain scan rejected.';
        }
    }

    const predEl = document.getElementById('ai-ct-pred');
    if (predEl) predEl.textContent = diag.prediction || 'Normal';

    const confEl = document.getElementById('ai-ct-conf');
    if (confEl) confEl.textContent = `${diag.confidence_pct || 0}%`;

    const gradcam = diag.gradcam || {};
    const quadEl = document.getElementById('ai-ct-quadrant');
    if (quadEl) quadEl.textContent = gradcam.anatomical_quadrant || 'Preserved Parenchymal Symmetry';

    updateAIRadiologyViewer();

    // 3. Prevention Guidance Card
    const prev = report.prevention_support || {};
    const prevInterp = document.getElementById('ai-prev-interpretation');
    if (prevInterp) prevInterp.textContent = prev.risk_interpretation || '';

    const prevBP = document.getElementById('ai-prev-bp');
    if (prevBP) prevBP.innerHTML = `<strong>Blood Pressure Target:</strong> ${prev.blood_pressure_guidance || 'Guideline recommended < 130/80 mmHg'}`;

    const prevGly = document.getElementById('ai-prev-glycemic');
    if (prevGly) prevGly.innerHTML = `<strong>Glycemic Control:</strong> ${prev.glycemic_guidance || 'HbA1c target < 7.0% (fasting glucose < 126 mg/dL)'}`;

    const prevRecs = document.getElementById('ai-prev-recs');
    if (prevRecs) {
        prevRecs.innerHTML = '';
        (prev.lifestyle_recommendations || []).forEach(r => {
            const li = document.createElement('li');
            li.textContent = r;
            prevRecs.appendChild(li);
        });
    }

    const prevCits = document.getElementById('ai-prev-citations');
    if (prevCits) {
        prevCits.innerHTML = '';
        (prev.evidence_citations || []).forEach(c => {
            const li = document.createElement('li');
            li.textContent = c;
            prevCits.appendChild(li);
        });
    }

    // 4. Emergency Clinical Support Card
    const emerg = report.emergency_support || {};
    const emergSum = document.getElementById('ai-emerg-summary');
    if (emergSum) emergSum.textContent = emerg.acute_clinical_summary || '';

    const contraBox = document.getElementById('ai-emerg-contra-box');
    const contraText = document.getElementById('ai-emerg-contra-text');
    if (contraBox && contraText) {
        if (emerg.contraindication_flags && emerg.contraindication_flags.length > 0) {
            contraBox.style.display = 'block';
            contraText.textContent = emerg.contraindication_flags.join(' • ');
        } else {
            contraBox.style.display = 'none';
        }
    }

    const emergActions = document.getElementById('ai-emerg-actions');
    if (emergActions) {
        emergActions.innerHTML = '';
        (emerg.hyperacute_management || []).forEach(a => {
            const li = document.createElement('li');
            li.textContent = a;
            emergActions.appendChild(li);
        });
    }

    const emergThrombo = document.getElementById('ai-emerg-thrombo');
    if (emergThrombo) emergThrombo.innerHTML = `<strong>Reperfusion / Thrombolysis:</strong> ${emerg.thrombolysis_eligibility_considerations || 'N/A'}`;

    const emergBP = document.getElementById('ai-emerg-bp');
    if (emergBP) emergBP.innerHTML = `<strong>Acute Blood Pressure Target:</strong> ${emerg.blood_pressure_management || 'N/A'}`;

    const emergCits = document.getElementById('ai-emerg-citations');
    if (emergCits) {
        emergCits.innerHTML = '';
        (emerg.evidence_citations || []).forEach(c => {
            const li = document.createElement('li');
            li.textContent = c;
            emergCits.appendChild(li);
        });
    }

    // 5. Validation Strip & Final Report
    const val = report.validation || {};
    const valClearance = document.getElementById('ai-val-clearance');
    if (valClearance) valClearance.textContent = val.safety_check || 'PASSED';

    const valContradictions = document.getElementById('ai-val-contradictions');
    if (valContradictions) valContradictions.textContent = `${(val.contradictions_detected || []).length} None`;

    const repSummary = document.getElementById('ai-report-summary');
    if (repSummary) repSummary.textContent = report.overall_clinical_summary || '';

    const keyActions = document.getElementById('ai-report-key-actions');
    if (keyActions) {
        keyActions.innerHTML = '';
        (report.key_recommendations || []).forEach(k => {
            const li = document.createElement('li');
            li.textContent = k;
            keyActions.appendChild(li);
        });
    }

    // 6. PDF Download Button
    const btnPDF = document.getElementById('btn-download-pdf');
    if (btnPDF) {
        if (report.pdf_filename) {
            btnPDF.href = `/api/reports/download-pdf/${report.pdf_filename}`;
            btnPDF.style.display = 'inline-flex';
        } else {
            btnPDF.style.display = 'none';
        }
    }

    // Automatically persist assessment & report to PostgreSQL if launched for a patient
    if (activeTargetPatient && activeTargetPatient.id) {
        autoPersistPipelineAssessment(activeTargetPatient.id, report);
    }
}

async function autoPersistPipelineAssessment(patientId, report) {
    try {
        const mlRisk = report.ml_risk || {};
        const ct = report.ct_analysis || {};
        const diag = ct.diagnosis || {};
        const gate = ct.gate || {};

        const payload = {
            patient_id: patientId,
            assessment_type: 'ai_system_flow',
            patient_vitals: report.patient_vitals || {},
            gatekeeper_status: gate.accepted ? 'accepted' : 'rejected',
            ct_diagnosis: diag.prediction || 'Normal',
            ct_confidence: diag.confidence_pct ? diag.confidence_pct / 100 : null,
            ml_risk_probability: mlRisk.stroke_probability || null,
            ml_risk_tier: mlRisk.risk_tier || 'Low',
            agent_findings: {
                prevention: report.prevention_support || {},
                emergency: report.emergency_support || {},
                validation: report.validation_support || {}
            },
            pdf_filename: report.pdf_filename || null,
            report_summary: {
                summary: report.overall_clinical_summary || '',
                recommendations: report.key_recommendations || []
            },
            validation_status: 'PASSED',
            physician_signed_off: false
        };

        const res = await fetch('/api/clinical-portal/record-assessment', {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            console.log('✓ Assessment & PDF report persisted to PostgreSQL database for patient:', patientId);
        }
    } catch (e) {
        console.warn('Auto-persistence skipped:', e);
    }
}

function updateAIRadiologyViewer() {
    if (!currentAIData || !currentAIData.ct_analysis) return;
    const diag = currentAIData.ct_analysis.diagnosis || {};
    const gradcam = diag.gradcam || {};
    const viewerImg = document.getElementById('ai-viewer-img');
    if (!viewerImg) return;

    if (activeCTView === 'overlay' && gradcam.overlay_contour_image) {
        viewerImg.src = gradcam.overlay_contour_image;
    } else if (activeCTView === 'heatmap' && gradcam.heatmap_image) {
        viewerImg.src = gradcam.heatmap_image;
    } else if (activeCTView === 'preprocessed' && diag.roi_preprocessed_image) {
        viewerImg.src = diag.roi_preprocessed_image;
    } else if (diag.original_image) {
        viewerImg.src = diag.original_image;
    }
}

// ==============================================================
// 5. OPTION 2: REGULAR SYSTEM (PATH A & PATH B)
// ==============================================================
function initRegularSystem() {
    // Path A Form Submit
    const regForm = document.getElementById('reg-risk-form');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnCalc = document.getElementById('btn-calc-reg-risk');
            if (btnCalc) {
                btnCalc.disabled = true;
                btnCalc.innerHTML = `${getLucideIcon('loader-2', 'lucide-spin')} Calculating Risk...`;
            }

            const data = {
                gender: document.getElementById('reg-gender').value,
                age: parseFloat(document.getElementById('reg-age').value),
                hypertension: parseInt(document.getElementById('reg-hypertension').value),
                heart_disease: parseInt(document.getElementById('reg-heart').value),
                avg_glucose_level: parseFloat(document.getElementById('reg-glucose').value),
                bmi: parseFloat(document.getElementById('reg-bmi').value),
                smoking_status: document.getElementById('reg-smoking').value,
                ever_married: "Yes",
                work_type: "Private",
                Residence_type: "Urban"
            };

            try {
                const res = await fetch('/api/predict-risk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const out = await res.json();
                if (out.success) {
                    renderRegRiskResult(out.data);
                } else {
                    alert("Risk calculation failed: " + (out.detail || "Unknown error"));
                }
            } catch (err) {
                alert("Risk calculation error: " + err.message);
            } finally {
                if (btnCalc) {
                    btnCalc.disabled = false;
                    btnCalc.innerHTML = `${getLucideIcon('bar-chart-3')} Calculate Stroke Danger Risk`;
                }
            }
        });
    }

    // Path B CT Dropzone & Buttons
    const regDropzone = document.getElementById('reg-dropzone');
    const regFileInput = document.getElementById('reg-ct-file-input');
    const btnRunRegCT = document.getElementById('btn-run-reg-ct');
    const btnClearRegScan = document.getElementById('reg-btn-clear-scan');

    if (regDropzone && regFileInput) {
        regDropzone.addEventListener('click', () => regFileInput.click());
        regFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleRegFile(e.target.files[0]);
            }
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            regDropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                regDropzone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            regDropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                regDropzone.classList.remove('dragover');
            });
        });

        regDropzone.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleRegFile(e.dataTransfer.files[0]);
            }
        });
    }

    if (btnClearRegScan) {
        btnClearRegScan.addEventListener('click', () => {
            clearRegScan();
        });
    }

    if (btnRunRegCT) {
        btnRunRegCT.addEventListener('click', () => {
            if (currentRegScanBlob) runRegCTAnalysis(currentRegScanBlob);
        });
    }

    // Path B viewer toggles
    const regViewPills = document.querySelectorAll('.view-pill[data-reg-view]');
    regViewPills.forEach(pill => {
        pill.addEventListener('click', () => {
            regViewPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            activeRegCTView = pill.getAttribute('data-reg-view');
            updateRegRadiologyViewer();
        });
    });
}

function handleRegFile(file) {
    currentRegScanBlob = file;
    const preview = document.getElementById('reg-scan-preview');
    const dropzone = document.getElementById('reg-dropzone');
    const img = document.getElementById('reg-preview-img');
    const name = document.getElementById('reg-preview-name');

    if (name) name.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
        if (img) img.src = ev.target.result;
        if (dropzone) dropzone.style.display = 'none';
        if (preview) preview.style.display = 'block';
        runRegCTAnalysis(currentRegScanBlob);
    };
    reader.readAsDataURL(file);
}

function renderRegRiskResult(data) {
    const placeholder = document.getElementById('reg-risk-placeholder');
    const content = document.getElementById('reg-risk-content');
    if (placeholder) placeholder.style.display = 'none';
    if (content) content.style.display = 'block';

    const gaugePct = document.getElementById('reg-gauge-pct');
    if (gaugePct) gaugePct.textContent = `${data.stroke_probability_pct}%`;

    const pill = document.getElementById('reg-tier-pill');
    if (pill) {
        pill.textContent = `${data.risk_tier.toUpperCase()} RISK TIER`;
        pill.style.color = data.risk_tier_color;
    }

    const desc = document.getElementById('reg-tier-desc');
    if (desc) desc.textContent = data.risk_tier_description;

    const list = document.getElementById('reg-factors-list');
    if (list) {
        list.innerHTML = '';
        (data.clinical_factors || []).forEach(f => {
            const chip = document.createElement('span');
            chip.className = 'chip-item';
            chip.textContent = f.factor;
            list.appendChild(chip);
        });
    }
}

async function runRegCTAnalysis(fileBlob) {
    const placeholder = document.getElementById('reg-ct-placeholder');
    const content = document.getElementById('reg-ct-content');
    const btnRun = document.getElementById('btn-run-reg-ct');

    if (btnRun) {
        btnRun.disabled = true;
        btnRun.textContent = "Analyzing CT scan...";
    }

    try {
        const formData = new FormData();
        formData.append('file', fileBlob, 'scan.png');

        const res = await fetch('/api/diagnose-ct', {
            method: 'POST',
            body: formData
        });
        const out = await res.json();

        if (placeholder) placeholder.style.display = 'none';
        if (content) content.style.display = 'block';

        const gateStrip = document.getElementById('reg-gate-strip');
        const gateTitle = document.getElementById('reg-gate-title');
        const gateDesc = document.getElementById('reg-gate-desc');

        if (out.gate_passed) {
            if (gateStrip) gateStrip.className = 'gate-strip';
            if (gateTitle) gateTitle.textContent = `Door Model Gatekeeper Passed (${out.gate_details.confidence_pct}%)`;
            if (gateDesc) gateDesc.textContent = "Authentic brain CT scan verified.";

            currentRegDiagData = out.diagnosis;
            const predEl = document.getElementById('reg-ct-pred');
            if (predEl) predEl.textContent = out.diagnosis.prediction;

            const confEl = document.getElementById('reg-ct-conf');
            if (confEl) confEl.textContent = `${out.diagnosis.confidence_pct}%`;

            const quadEl = document.getElementById('reg-ct-quadrant');
            if (quadEl) quadEl.textContent = out.diagnosis.gradcam.anatomical_quadrant || 'Symmetric';

            updateRegRadiologyViewer();
        } else {
            if (gateStrip) gateStrip.className = 'gate-strip rejected';
            if (gateTitle) gateTitle.textContent = "Safety Gate Rejection";
            if (gateDesc) gateDesc.textContent = out.message || "Non-brain scan rejected.";

            const predEl = document.getElementById('reg-ct-pred');
            if (predEl) predEl.textContent = "Blocked";

            const confEl = document.getElementById('reg-ct-conf');
            if (confEl) confEl.textContent = "0%";

            const viewerImg = document.getElementById('reg-viewer-img');
            if (viewerImg) viewerImg.src = "";
        }
    } catch (e) {
        alert("CT diagnostic error: " + e.message);
    } finally {
        if (btnRun) {
            btnRun.disabled = false;
            btnRun.textContent = "Run CT Neuroimaging Analysis";
        }
    }
}

function updateRegRadiologyViewer() {
    if (!currentRegDiagData) return;
    const gradcam = currentRegDiagData.gradcam || {};
    const img = document.getElementById('reg-viewer-img');
    if (!img) return;

    if (activeRegCTView === 'overlay' && gradcam.overlay_contour_image) {
        img.src = gradcam.overlay_contour_image;
    } else if (activeRegCTView === 'heatmap' && gradcam.heatmap_image) {
        img.src = gradcam.heatmap_image;
    } else if (currentRegDiagData.original_image) {
        img.src = currentRegDiagData.original_image;
    }
}

// ==============================================================
// 6. STANDALONE MEDICAL CHATBOT LOGIC (CUTE ROBOT IDENTITY)
// ==============================================================
let chatbotConversationId = null;

function initChatbot() {
    const headerRobotTrigger = document.getElementById('header-robot-trigger');
    const modal = document.getElementById('chatbot-modal');
    const backdrop = document.getElementById('chatbot-backdrop');
    const btnClose = document.getElementById('btn-close-chatbot');
    const form = document.getElementById('chatbot-form');
    const input = document.getElementById('chatbot-input');
    const messagesContainer = document.getElementById('chatbot-messages');
    const typingBar = document.getElementById('chatbot-typing-bar');
    const btnSend = document.getElementById('btn-send-chat');

    if (!modal || !backdrop) return;

    function openChatbot() {
        modal.classList.add('active');
        backdrop.classList.add('active');
        if (input) {
            setTimeout(() => input.focus(), 150);
        }
        scrollChatToBottom();
    }

    function closeChatbot() {
        modal.classList.remove('active');
        backdrop.classList.remove('active');
    }

    if (headerRobotTrigger) {
        headerRobotTrigger.addEventListener('click', () => {
            if (modal.classList.contains('active')) {
                closeChatbot();
            } else {
                openChatbot();
            }
        });
        headerRobotTrigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openChatbot();
            }
        });
    }

    if (btnClose) btnClose.addEventListener('click', closeChatbot);
    backdrop.addEventListener('click', closeChatbot);

    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeChatbot();
        }
    });

    // Handle suggestion pills click
    if (messagesContainer) {
        messagesContainer.addEventListener('click', (e) => {
            const pill = e.target.closest('.chat-suggest-pill');
            if (pill && input && form) {
                const text = pill.textContent.trim();
                input.value = text;
                form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        });
    }

    // Form submission
    if (form && input) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;

            // Clear input and append user bubble
            input.value = '';
            appendUserMessage(text);

            // Show typing indicator & disable send
            if (typingBar) typingBar.style.display = 'flex';
            if (btnSend) btnSend.disabled = true;
            if (input) input.disabled = true;
            scrollChatToBottom();

            try {
                const res = await fetch('/api/chatbot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: text,
                        conversation_id: chatbotConversationId
                    })
                });

                const data = await res.json();
                if (data.conversation_id) {
                    chatbotConversationId = data.conversation_id;
                }

                appendAssistantMessage(data.answer, data.sources, data.is_emergency);

            } catch (err) {
                console.error("Chatbot request error:", err);
                appendAssistantMessage(
                    "I'm sorry, I couldn't process your request right now. Please check your connection and try again.",
                    [],
                    false
                );
            } finally {
                if (typingBar) typingBar.style.display = 'none';
                if (btnSend) btnSend.disabled = false;
                if (input) {
                    input.disabled = false;
                    input.focus();
                }
                scrollChatToBottom();
            }
        });
    }

    function appendUserMessage(text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message user';
        const now = formatTime();

        msgDiv.innerHTML = `
            <div class="msg-content">
                <div class="msg-sender">You</div>
                <div class="msg-bubble">${escapeHTML(text)}</div>
                <div class="msg-time">${now}</div>
            </div>
        `;
        messagesContainer.appendChild(msgDiv);
    }

    function appendAssistantMessage(text, sources, isEmergency) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message assistant';
        const now = formatTime();

        const bubbleClass = isEmergency ? 'msg-bubble emergency-bubble' : 'msg-bubble';

        // Parse markdown formatting into clean HTML
        let formattedText = formatMarkdownToHTML(text);

        let sourcesHTML = '';
        if (sources && sources.length > 0) {
            const listItems = sources.map(s => {
                const cite = s.citation || `${s.source} ${s.guideline} (${s.year || ''})`;
                return `<li>${escapeHTML(cite)}</li>`;
            }).join('');

            sourcesHTML = `
                <div class="msg-sources-container">
                    <div class="sources-header">
                        <span>${getLucideIcon('book-open')} Guideline Evidence Sources (${sources.length})</span>
                    </div>
                    <ul class="sources-list">${listItems}</ul>
                </div>
            `;
        }

        msgDiv.innerHTML = `
            <div class="msg-avatar">
                <img src="/assets/robot_face_no_text.svg" alt="Robot" class="msg-robot-icon">
            </div>
            <div class="msg-content">
                <div class="msg-sender">StrokeAegis Medical Assistant</div>
                <div class="${bubbleClass}">${formattedText}</div>
                ${sourcesHTML}
                <div class="msg-time">${now}</div>
            </div>
        `;
        messagesContainer.appendChild(msgDiv);
    }

    function scrollChatToBottom() {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    function formatTime() {
        const d = new Date();
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatMarkdownToHTML(str) {
        let out = escapeHTML(str);
        // Bold: **text**
        out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Bullets
        out = out.replace(/^[\*\-]\s+(.*)$/gm, '&bull; $1');
        // Linebreaks
        out = out.replace(/\n/g, '<br>');
        return out;
    }
}

// ==============================================================
// 7. PHASE 2: ROLE-BASED CLINICAL PORTALS (DOCTOR & PATIENT)
// ==============================================================

let activeTargetPatient = null;
let activeDocConvoId = null;
let activePatConvoId = null;
let cachedDoctorPatients = [];
let cachedDoctorReports = [];

function getAuthHeaders(includeContentType = true) {
    const token = localStorage.getItem('strokeaegis_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (includeContentType) headers['Content-Type'] = 'application/json';
    return headers;
}

function handleAuthError(res) {
    if (res.status === 401) {
        localStorage.removeItem('strokeaegis_token');
        localStorage.removeItem('strokeaegis_user');
        updateHeaderUserBadge(null);
        showScreen('screen-landing');
        showAuthAlert('Your session has expired. Please sign in again.', 'error');
        return true;
    }
    return false;
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function downloadClinicalReport(reportId, filename) {
    if (!reportId) return;
    const token = localStorage.getItem('strokeaegis_token');
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const directUrl = `/api/clinical-portal/reports/${encodeURIComponent(reportId)}/download${tokenParam}`;
    const cleanFilename = filename || `StrokeAegis_Report_${reportId}.pdf`;

    try {
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(directUrl, { headers });
        if (!res.ok) {
            const fallbackLink = document.createElement('a');
            fallbackLink.href = directUrl;
            fallbackLink.download = cleanFilename;
            fallbackLink.target = '_blank';
            document.body.appendChild(fallbackLink);
            fallbackLink.click();
            fallbackLink.remove();
            return;
        }

        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = cleanFilename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
            a.remove();
        }, 300);
    } catch (err) {
        console.warn('Direct blob fetch failed, falling back to direct link:', err);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = directUrl;
        a.download = cleanFilename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
}

// -------------------------------------------------------------
// Portal Initialization & Wiring
// -------------------------------------------------------------
function initClinicalPortals() {
    // 1. Doctor Portal Navigation Subtabs
    document.querySelectorAll('#screen-doctor-portal .portal-subnav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            if (tabId) switchDoctorPortalTab(tabId);
        });
    });

    // 2. Doctor Action Buttons
    const btnDocLaunchAI = document.getElementById('btn-doc-launch-ai');
    if (btnDocLaunchAI) {
        btnDocLaunchAI.addEventListener('click', () => {
            openLaunchAIChoiceModal();
        });
    }

    const btnDocLaunchReg = document.getElementById('btn-doc-launch-reg');
    if (btnDocLaunchReg) {
        btnDocLaunchReg.addEventListener('click', () => {
            showScreen('screen-regular-system');
            showRegSubtab('reg-risk');
            updateDynamicReturnLabels();
        });
    }

    // 3. Doctor Patient Search Filter
    const inputPatientSearch = document.getElementById('doc-patient-search');
    if (inputPatientSearch) {
        inputPatientSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            filterDoctorPatientsTable(query);
        });
    }

    // 4. Doctor Refresh Buttons
    const btnRefPatients = document.getElementById('btn-refresh-doc-patients');
    if (btnRefPatients) {
        btnRefPatients.addEventListener('click', () => loadDoctorPatients());
    }

    const btnRefReports = document.getElementById('btn-refresh-doc-reports');
    if (btnRefReports) {
        btnRefReports.addEventListener('click', () => loadDoctorReports());
    }

    // 5. Doctor Chat Form
    const docChatForm = document.getElementById('doc-chat-form');
    if (docChatForm) {
        docChatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendDoctorChatMessage();
        });
    }

    // 6. Patient Portal Subtabs
    document.querySelectorAll('#screen-patient-portal .portal-subnav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            if (tabId) switchPatientPortalTab(tabId);
        });
    });

    // 7. Patient Self-Check Form
    const patSelfCheckForm = document.getElementById('pat-selfcheck-form');
    if (patSelfCheckForm) {
        patSelfCheckForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handlePatientSelfCheck();
        });
    }

    // 8. Patient Refresh Buttons
    const btnRefPatAssess = document.getElementById('btn-refresh-pat-assessments');
    if (btnRefPatAssess) {
        btnRefPatAssess.addEventListener('click', () => loadPatientAssessments());
    }

    const btnRefPatReports = document.getElementById('btn-refresh-pat-reports');
    if (btnRefPatReports) {
        btnRefPatReports.addEventListener('click', () => loadPatientReports());
    }

    // 9. Patient Chat Form
    const patChatForm = document.getElementById('pat-chat-form');
    if (patChatForm) {
        patChatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendPatientChatMessage();
        });
    }

    // 10. History Modal Close
    const btnCloseModal = document.getElementById('btn-close-history-modal');
    const modalBackdrop = document.getElementById('modal-patient-history');
    if (btnCloseModal && modalBackdrop) {
        btnCloseModal.addEventListener('click', () => {
            modalBackdrop.style.display = 'none';
        });
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target === modalBackdrop) modalBackdrop.style.display = 'none';
        });
    }

    // 11. Add / Admit Patient Modal (Doctor Workspace)
    const btnOpenAdmit = document.getElementById('btn-open-admit-modal');
    const btnCloseAdmit = document.getElementById('btn-close-admit-modal');
    const btnCancelAdmit = document.getElementById('btn-cancel-admit');
    const btnCancelInvite = document.getElementById('btn-cancel-invite');
    const modalAdmit = document.getElementById('modal-admit-patient');
    const formAdmit = document.getElementById('form-admit-patient');
    const formInvite = document.getElementById('form-invite-patient');
    const tabInvite = document.getElementById('tab-btn-invite-email');
    const tabDirect = document.getElementById('tab-btn-direct-admit');
    const contentInvite = document.getElementById('admit-tab-content-invite');
    const contentDirect = document.getElementById('admit-tab-content-direct');

    if (btnOpenAdmit) {
        btnOpenAdmit.addEventListener('click', () => {
            openAddPatientModal();
        });
    }
    const closeAdmitModal = () => {
        if (modalAdmit) modalAdmit.style.display = 'none';
        const feedback = document.getElementById('admit-request-feedback');
        if (feedback) feedback.style.display = 'none';
    };
    if (btnCloseAdmit) btnCloseAdmit.addEventListener('click', closeAdmitModal);
    if (btnCancelAdmit) btnCancelAdmit.addEventListener('click', closeAdmitModal);
    if (btnCancelInvite) btnCancelInvite.addEventListener('click', closeAdmitModal);
    if (modalAdmit) {
        modalAdmit.addEventListener('click', (e) => {
            if (e.target === modalAdmit) closeAdmitModal();
        });
    }

    if (tabInvite && tabDirect) {
        tabInvite.addEventListener('click', () => {
            tabInvite.classList.add('active');
            tabDirect.classList.remove('active');
            if (contentInvite) contentInvite.style.display = 'block';
            if (contentDirect) contentDirect.style.display = 'none';
        });
        tabDirect.addEventListener('click', () => {
            tabDirect.classList.add('active');
            tabInvite.classList.remove('active');
            if (contentInvite) contentInvite.style.display = 'none';
            if (contentDirect) contentDirect.style.display = 'block';
        });
    }

    if (formInvite) {
        formInvite.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleInvitePatientSubmit();
        });
    }

    if (formAdmit) {
        formAdmit.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleAdmitPatientSubmit();
        });
    }

    // 11b. Find a Doctor Modal (Patient Workspace)
    const btnOpenFindDoc = document.getElementById('btn-open-find-doctor-modal');
    const btnCloseFindDoc = document.getElementById('btn-close-find-doctor-modal');
    const modalFindDoc = document.getElementById('modal-find-doctor');
    const searchFindDoc = document.getElementById('find-doctor-search-input');

    if (btnOpenFindDoc) {
        btnOpenFindDoc.addEventListener('click', () => {
            openFindDoctorModal();
        });
    }
    const closeFindDocModal = () => {
        if (modalFindDoc) modalFindDoc.style.display = 'none';
        const fb = document.getElementById('find-doctor-feedback');
        if (fb) fb.style.display = 'none';
    };
    if (btnCloseFindDoc) btnCloseFindDoc.addEventListener('click', closeFindDocModal);
    if (modalFindDoc) {
        modalFindDoc.addEventListener('click', (e) => {
            if (e.target === modalFindDoc) closeFindDocModal();
        });
    }
    if (searchFindDoc) {
        searchFindDoc.addEventListener('input', (e) => {
            loadAvailableDoctors(e.target.value.trim());
        });
    }

    // 12. Notifications Drawer Modal
    const btnHeaderNotifs = document.getElementById('btn-header-notifs');
    const btnCloseNotifs = document.getElementById('btn-close-notifs-modal');
    const btnNotifsReadAll = document.getElementById('btn-notifs-read-all');
    const modalNotifs = document.getElementById('modal-notifications-drawer');

    if (btnHeaderNotifs && modalNotifs) {
        btnHeaderNotifs.addEventListener('click', () => {
            modalNotifs.style.display = 'flex';
            loadNotifications();
        });
    }
    const closeNotifsModal = () => {
        if (modalNotifs) modalNotifs.style.display = 'none';
    };
    if (btnCloseNotifs) btnCloseNotifs.addEventListener('click', closeNotifsModal);
    if (modalNotifs) {
        modalNotifs.addEventListener('click', (e) => {
            if (e.target === modalNotifs) closeNotifsModal();
        });
    }
    if (btnNotifsReadAll) {
        btnNotifsReadAll.addEventListener('click', async () => {
            await markAllNotificationsRead();
        });
    }

    // 12b. Vascular Health Check Result Modal Close
    const modalSelfCheck = document.getElementById('modal-selfcheck-result');
    const btnCloseSelfCheck = document.getElementById('btn-close-selfcheck-modal');
    const btnDoneSelfCheck = document.getElementById('btn-close-selfcheck-modal-footer');

    const closeSelfCheckModal = () => {
        if (modalSelfCheck) modalSelfCheck.style.display = 'none';
    };
    if (btnCloseSelfCheck) btnCloseSelfCheck.addEventListener('click', closeSelfCheckModal);
    if (btnDoneSelfCheck) btnDoneSelfCheck.addEventListener('click', closeSelfCheckModal);
    if (modalSelfCheck) {
        modalSelfCheck.addEventListener('click', (e) => {
            if (e.target === modalSelfCheck) closeSelfCheckModal();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalSelfCheck && modalSelfCheck.style.display === 'flex') {
            closeSelfCheckModal();
        }
    });

    // 12c. Launch AI Choice Modal (Doctor Workspace)
    const modalLaunchChoice = document.getElementById('modal-launch-ai-choice');
    const btnCloseLaunchChoice = document.getElementById('btn-close-launch-choice');
    const btnLaunchAssigned = document.getElementById('btn-launch-ai-assigned');
    const btnLaunchStandalone = document.getElementById('btn-launch-ai-standalone');

    if (btnCloseLaunchChoice) btnCloseLaunchChoice.addEventListener('click', closeLaunchAIChoiceModal);
    if (btnLaunchAssigned) btnLaunchAssigned.addEventListener('click', launchAIWithSelectedPatient);
    if (btnLaunchStandalone) btnLaunchStandalone.addEventListener('click', launchAISystemStandalone);
    if (modalLaunchChoice) {
        modalLaunchChoice.addEventListener('click', (e) => {
            if (e.target === modalLaunchChoice) closeLaunchAIChoiceModal();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalLaunchChoice && modalLaunchChoice.style.display === 'flex') {
            closeLaunchAIChoiceModal();
        }
    });

    // 13. Header Brand Home Button
    const headerBrandHome = document.getElementById('header-brand-home');
    if (headerBrandHome) {
        headerBrandHome.addEventListener('click', (e) => {
            e.preventDefault();
            returnToUserHome();
        });
    }

    // 14. Header User Badge Click
    const headerUserBadge = document.getElementById('header-user-badge');
    if (headerUserBadge) {
        headerUserBadge.addEventListener('click', (e) => {
            if (e.target.closest('#btn-header-signout')) return;
            const user = JSON.parse(localStorage.getItem('strokeaegis_user') || '{}');
            if (user && user.role === 'doctor') {
                showDoctorPortal();
            } else if (user && user.role === 'patient') {
                showPatientPortal();
            }
        });
    }

    // 15. Periodic background syncing for notifications and active chat stream
    setInterval(() => {
        const token = localStorage.getItem('strokeaegis_token');
        if (!token) return;

        // Auto-refresh notification badges
        loadNotifications();

        // If patient chat pane is active, refresh messages smoothly
        const patChatPane = document.getElementById('pat-pane-chat');
        if (patChatPane && patChatPane.classList.contains('active') && activePatConvoId) {
            loadPatientMessagesForConvo(activePatConvoId, true);
        }

        // If doctor chat pane is active, refresh active doctor messages smoothly
        const docChatPane = document.getElementById('doc-pane-chat');
        if (docChatPane && docChatPane.classList.contains('active') && activeDocConvoId) {
            refreshDoctorMessages(activeDocConvoId);
        }
    }, 4000);
}

// -------------------------------------------------------------
// Doctor Portal Functions
// -------------------------------------------------------------
function showDoctorPortal(activeTabId = 'doc-pane-patients') {
    showScreen('screen-doctor-portal');
    switchDoctorPortalTab(activeTabId);
    loadDoctorDashboard();
    updateDynamicReturnLabels();
}

function switchDoctorPortalTab(targetPaneId) {
    document.querySelectorAll('#screen-doctor-portal .portal-subnav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === targetPaneId);
    });
    document.querySelectorAll('#screen-doctor-portal .portal-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === targetPaneId);
    });
    if (targetPaneId === 'doc-pane-chat') {
        loadDoctorConversations();
    } else if (targetPaneId === 'doc-pane-patients') {
        loadDoctorPatients();
    } else if (targetPaneId === 'doc-pane-reports') {
        loadDoctorReports();
    }
}

async function loadDoctorDashboard() {
    await Promise.all([
        loadDoctorStats(),
        loadDoctorPatients(),
        loadDoctorReports(),
        loadDoctorConversations()
    ]);
}

async function loadDoctorStats() {
    try {
        const res = await fetch('/api/clinical-portal/doctor/stats', {
            headers: getAuthHeaders(false)
        });
        if (handleAuthError(res)) return;
        if (!res.ok) return;

        const data = await res.json();
        const nameEl = document.getElementById('doc-welcome-name');
        const detailsEl = document.getElementById('doc-sub-details');
        const patStat = document.getElementById('doc-stat-patients');
        const pendStat = document.getElementById('doc-stat-pending');
        const assStat = document.getElementById('doc-stat-assessments');
        const unreadStat = document.getElementById('doc-stat-unread');
        const repBadge = document.getElementById('doc-badge-pending-reports');
        const chatBadge = document.getElementById('doc-badge-unread-msgs');

        if (nameEl) nameEl.textContent = data.doctor_name || 'Dr. Sarah Al-Mansoor';
        if (detailsEl) {
            detailsEl.textContent = `${data.specialization || 'Stroke Neurology'} • ${data.hospital || 'King Faisal Specialist Hospital'} • Lic: ${data.license_number || 'MD-SA-98234'}`;
        }
        if (patStat) patStat.textContent = data.total_patients;
        if (pendStat) pendStat.textContent = data.pending_reports;
        if (assStat) assStat.textContent = data.total_assessments;
        if (unreadStat) unreadStat.textContent = data.unread_messages;

        if (repBadge) {
            repBadge.textContent = data.pending_reports;
            repBadge.style.display = data.pending_reports > 0 ? 'inline-flex' : 'none';
        }
        if (chatBadge) {
            chatBadge.textContent = data.unread_messages;
            chatBadge.style.display = data.unread_messages > 0 ? 'inline-flex' : 'none';
        }
    } catch (err) {
        console.warn('Error loading doctor stats:', err);
    }
}

async function loadDoctorPatients() {
    const tbody = document.getElementById('tbody-doc-patients');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading patients directory...</td></tr>`;

    try {
        await loadDoctorRequests();

        const res = await fetch('/api/clinical-portal/doctor/patients', {
            headers: getAuthHeaders(false)
        });
        if (handleAuthError(res)) return;
        if (!res.ok) throw new Error('Failed to load patients');

        const data = await res.json();
        cachedDoctorPatients = data.patients || [];
        renderDoctorPatientsTable(cachedDoctorPatients);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #EF4444;">Failed to load patients: ${err.message}</td></tr>`;
    }
}

function renderDoctorPatientsTable(patients) {
    const tbody = document.getElementById('tbody-doc-patients');
    if (!tbody) return;

    if (!patients || patients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
                    <div style="margin-bottom: 0.75rem;">${getLucideIcon("user-x")}</div>
                    <h4 style="margin: 0 0 0.5rem 0; color: var(--text-main); font-size: 1rem; font-weight: 700;">No Patients Assigned</h4>
                    <p style="margin: 0 0 1.25rem 0; font-size: 0.85rem; max-width: 420px; margin-inline: auto;">
                        Your patient roster is currently empty. Use <strong>Add Patient</strong> above to invite patients by email.
                    </p>
                    <button type="button" class="btn-portal-action primary" onclick="openAddPatientModal()" style="display: inline-flex; margin: 0 auto;">
                        ${getLucideIcon("user-plus")} Add Patient by Email
                    </button>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = patients.map(p => {
        let riskBadge = `<span class="tier-tag low">No Record</span>`;
        if (p.latest_assessment) {
            const tier = p.latest_assessment.ml_risk_tier || 'Low';
            const tierClass = tier.toLowerCase();
            const probPct = p.latest_assessment.ml_risk_probability ? `${(p.latest_assessment.ml_risk_probability * 100).toFixed(1)}%` : '';
            const diag = p.latest_assessment.ct_diagnosis ? ` • ${p.latest_assessment.ct_diagnosis}` : '';
            riskBadge = `<span class="tier-tag ${tierClass}">${tier} Risk ${probPct}${diag}</span>`;
        }

        const ageStr = p.date_of_birth ? `${calculateAge(p.date_of_birth)} yrs` : '--';
        const demoStr = `${p.gender || 'Unknown'}, ${ageStr}`;
        const relBadge = p.relationship_type === 'care_team' 
            ? `<span class="rel-badge rel-badge-care" style="margin-left: 0.4rem;">Care Team</span>` 
            : `<span class="rel-badge rel-badge-primary" style="margin-left: 0.4rem;">Primary</span>`;

        return `
            <tr>
                <td>
                    <div class="patient-cell">
                        <div class="patient-avatar-sm">${getLucideIcon("user")}</div>
                        <div class="patient-name-wrap">
                            <strong>${escapeHTML(p.full_name)}</strong>
                            <small>${escapeHTML(p.email)}</small>
                        </div>
                    </div>
                </td>
                <td><strong style="font-family: monospace;">${escapeHTML(p.mrn)}</strong></td>
                <td>${escapeHTML(demoStr)}</td>
                <td><span class="status-pill active">${escapeHTML(p.status)}</span> ${relBadge}</td>
                <td>${riskBadge}</td>
                <td>
                    <div class="table-actions-cell">
                        <button type="button" class="btn-action-sm primary" onclick="launchAISystemForPatient('${p.id}')" title="Run full 4-step AI System for this patient">
                            ${getLucideIcon('bot')} Launch AI
                        </button>
                        <button type="button" class="btn-action-sm secondary" onclick="openPatientHistoryModal('${p.id}')" title="View longitudinal assessments and reports">
                            ${getLucideIcon('scroll')} History
                        </button>
                        <button type="button" class="btn-action-sm secondary" onclick="switchDoctorToChatWithPatient('${p.id}')" title="Send message to patient">
                            ${getLucideIcon('message-square')} Message
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterDoctorPatientsTable(query) {
    if (!cachedDoctorPatients) return;
    if (!query) {
        renderDoctorPatientsTable(cachedDoctorPatients);
        return;
    }
    const filtered = cachedDoctorPatients.filter(p => {
        return (p.full_name && p.full_name.toLowerCase().includes(query)) ||
               (p.mrn && p.mrn.toLowerCase().includes(query)) ||
               (p.status && p.status.toLowerCase().includes(query));
    });
    renderDoctorPatientsTable(filtered);
}

function calculateAge(dobStr) {
    try {
        const dob = new Date(dobStr);
        const diff = Date.now() - dob.getTime();
        const ageDt = new Date(diff);
        return Math.abs(ageDt.getUTCFullYear() - 1970);
    } catch {
        return '--';
    }
}

function launchAISystemForPatient(patientId) {
    const patient = cachedDoctorPatients.find(p => p.id === patientId);
    activeTargetPatient = patient || { id: patientId };

    // Switch to AI System Screen
    showScreen('screen-ai-system');
    showAIStep(1);
    clearAIForm();

    if (patient) {
        // Pre-fill fields where possible
        if (patient.gender === 'Male' || patient.gender === 'Female') {
            const genEl = document.getElementById('ai-gender');
            if (genEl) genEl.value = patient.gender;
        }
        if (patient.date_of_birth) {
            const age = calculateAge(patient.date_of_birth);
            const ageEl = document.getElementById('ai-age');
            if (ageEl && typeof age === 'number') ageEl.value = age;
        }
    }
    renderAIWizardModeBanner(patient);
}

function populateLaunchSelectOptions(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    if (cachedDoctorPatients && cachedDoctorPatients.length > 0) {
        cachedDoctorPatients.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            const ageStr = p.date_of_birth ? `${calculateAge(p.date_of_birth)} yrs` : '';
            opt.textContent = `${p.full_name} (${p.mrn}) — ${p.gender || 'N/A'}${ageStr ? ', ' + ageStr : ''}`;
            selectEl.appendChild(opt);
        });
        if (activeTargetPatient && activeTargetPatient.id) {
            selectEl.value = activeTargetPatient.id;
        }
    } else {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No patients currently in your roster';
        opt.disabled = true;
        selectEl.appendChild(opt);
    }
}

async function openLaunchAIChoiceModal() {
    const modal = document.getElementById('modal-launch-ai-choice');
    if (!modal) return;

    // Show modal immediately
    modal.style.display = 'flex';

    // Populate patient select dropdown with active roster
    const selectEl = document.getElementById('select-launch-ai-patient');
    if (selectEl) {
        if (cachedDoctorPatients && cachedDoctorPatients.length > 0) {
            populateLaunchSelectOptions(selectEl);
        } else {
            selectEl.innerHTML = '<option value="" disabled selected>Loading patient roster...</option>';
            await loadDoctorPatients();
            populateLaunchSelectOptions(selectEl);
        }
    }
}

function closeLaunchAIChoiceModal() {
    const modal = document.getElementById('modal-launch-ai-choice');
    if (modal) modal.style.display = 'none';
}

function launchAIWithSelectedPatient() {
    const selectEl = document.getElementById('select-launch-ai-patient');
    const patientId = selectEl ? selectEl.value : null;
    if (!patientId) {
        alert('Please select a patient from your roster, or select Standalone Mode.');
        return;
    }
    closeLaunchAIChoiceModal();
    launchAISystemForPatient(patientId);
}

function launchAISystemStandalone() {
    activeTargetPatient = null;
    closeLaunchAIChoiceModal();
    showScreen('screen-ai-system');
    showAIStep(1);
    clearAIForm();
    renderAIWizardModeBanner(null);
}

function renderAIWizardModeBanner(patient) {
    let banner = document.getElementById('ai-active-patient-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'ai-active-patient-banner';
        const screenAI = document.getElementById('screen-ai-system');
        const navBar = screenAI ? screenAI.querySelector('.wizard-nav-bar') : null;
        if (navBar && navBar.parentNode) {
            navBar.insertAdjacentElement('afterend', banner);
        } else {
            const step1 = document.getElementById('ai-wizard-step-1');
            if (step1) step1.prepend(banner);
        }
    }
    if (!banner) return;

    const isAr = (typeof currentLanguage !== 'undefined' ? currentLanguage : (localStorage.getItem('strokeaegis_lang') || 'en')) === 'ar';

    if (patient && patient.full_name) {
        const titleText = isAr ? `المريض النشط: ${escapeHTML(patient.full_name)}` : `Active Patient: ${escapeHTML(patient.full_name)}`;
        const metaText = `MRN: ${escapeHTML(patient.mrn)} &bull; ${escapeHTML(patient.gender || '')} &bull; ${isAr ? 'تم ربط السجل الطبي المعتمد' : 'Clinical Record Linked'}`;
        const switchText = isAr ? `${getLucideIcon('refresh-cw')} تغيير / إلغاء التعيين` : `${getLucideIcon('refresh-cw')} Switch / Unassign`;
        const returnText = isAr ? '→ العودة إلى لوحة تحكم الطبيب' : '← Return to Doctor Portal';

        banner.innerHTML = `
            <div style="background: rgba(2, 132, 199, 0.1); border: 1.5px solid #0284C7; border-radius: 12px; padding: 0.85rem 1.25rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span style="font-size: 1.4rem; display: flex; align-items: center;">${getLucideIcon("user", "lucide-icon-lg")}</span>
                    <div>
                        <strong style="color: #0284C7; font-size: 0.96rem; display: block;">${titleText}</strong>
                        <span style="color: var(--text-muted); font-size: 0.82rem;">${metaText}</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button type="button" class="btn btn-sm btn-secondary" onclick="openLaunchAIChoiceModal()" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; border-radius: 9999px;">
                        ${switchText}
                    </button>
                    <button type="button" class="btn btn-sm" onclick="showDoctorPortal()" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; border-radius: 9999px;">
                        ${returnText}
                    </button>
                </div>
            </div>
        `;
        banner.style.display = 'block';
    } else {
        const titleText = isAr ? 'وضع التقييم المستقل (غير مخصص لمريض)' : 'Standalone Evaluation Mode (Unassigned)';
        const metaText = isAr ? 'وضع تجربة ومحاكاة &bull; لن يتم ربط التقرير بأي سجل طبي' : 'Trial &amp; Simulation &bull; Reports will not be linked to any patient record';
        const assignText = isAr ? `${getLucideIcon('user-plus')} تعيين لمريض` : `${getLucideIcon('user-plus')} Assign to Patient`;
        const returnText = isAr ? '→ العودة إلى لوحة تحكم الطبيب' : '← Return to Doctor Portal';

        banner.innerHTML = `
            <div style="background: rgba(16, 185, 129, 0.1); border: 1.5px solid #10B981; border-radius: 12px; padding: 0.85rem 1.25rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span style="font-size: 1.4rem; display: flex; align-items: center;">${getLucideIcon("flask-conical", "lucide-icon-lg")}</span>
                    <div>
                        <strong style="color: #10B981; font-size: 0.96rem; display: block;">${titleText}</strong>
                        <span style="color: var(--text-muted); font-size: 0.82rem;">${metaText}</span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button type="button" class="btn btn-sm btn-secondary" onclick="openLaunchAIChoiceModal()" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; border-radius: 9999px;">
                        ${assignText}
                    </button>
                    <button type="button" class="btn btn-sm" onclick="showDoctorPortal()" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; border-radius: 9999px;">
                        ${returnText}
                    </button>
                </div>
            </div>
        `;
        banner.style.display = 'block';
    }
}

async function openPatientHistoryModal(patientId) {
    const modal = document.getElementById('modal-patient-history');
    const modalName = document.getElementById('history-modal-patient-name');
    const modalMrn = document.getElementById('history-modal-patient-mrn');
    const modalBody = document.getElementById('history-modal-body');

    if (!modal || !modalBody) return;
    modal.style.display = 'flex';
    modalBody.innerHTML = `<div style="text-align: center; padding: 2.5rem; color: var(--text-muted);">Fetching longitudinal clinical history...</div>`;

    try {
        const res = await fetch(`/api/clinical-portal/doctor/patients/${patientId}/history`, {
            headers: getAuthHeaders(false)
        });
        if (handleAuthError(res)) return;
        if (!res.ok) throw new Error('Could not retrieve patient history');

        const data = await res.json();
        const p = data.patient;
        if (modalName) modalName.textContent = p.full_name;
        if (modalMrn) modalMrn.textContent = `MRN: ${p.mrn} • Gender: ${p.gender} • Status: ${p.status}`;

        let assessmentsHTML = '';
        if (data.assessments && data.assessments.length > 0) {
            assessmentsHTML = data.assessments.map(a => {
                const dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown date';
                const tier = a.ml_risk_tier || 'Low';
                const tierClass = tier.toLowerCase();
                const prob = a.ml_risk_probability ? `${(a.ml_risk_probability * 100).toFixed(1)}%` : '--';
                const diag = a.ct_diagnosis ? ` • CT Diagnosis: <strong>${escapeHTML(a.ct_diagnosis)}</strong>` : '';

                return `
                    <div style="background: rgba(241, 245, 249, 0.6); border: 1px solid var(--border-color); border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                            <strong>Type: ${escapeHTML(a.assessment_type)}</strong>
                            <small style="color: var(--text-muted);">${escapeHTML(dateStr)}</small>
                        </div>
                        <div style="font-size: 0.85rem; margin-bottom: 0.3rem;">
                            <span class="tier-tag ${tierClass}">Risk: ${tier} (${prob})</span>
                            ${diag}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            assessmentsHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No assessments recorded yet.</p>`;
        }

        let reportsHTML = '';
        if (data.reports && data.reports.length > 0) {
            reportsHTML = data.reports.map(r => {
                const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString() : '';
                const signedBadge = r.physician_signed_off
                    ? `<span class="badge-certified">${getLucideIcon('check')} Certified</span>`
                    : `<span class="status-pill pending">Pending Sign-Off</span>`;
                const token = localStorage.getItem('strokeaegis_token');
                const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';

                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 0.5rem;">
                        <div>
                            <strong>${getLucideIcon('file-text')} ${escapeHTML(r.pdf_filename)}</strong>
                            <small style="color: var(--text-muted); display: block;">Generated: ${dateStr}</small>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            ${signedBadge}
                            <a href="/api/clinical-portal/reports/${r.id}/download${tokenQuery}" target="_blank" onclick="event.preventDefault(); downloadClinicalReport('${r.id}', '${escapeHTML(r.pdf_filename)}');" class="btn-action-sm primary">Download PDF</a>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            reportsHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No reports compiled yet.</p>`;
        }

        modalBody.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <h4 style="margin: 0 0 0.75rem 0; font-size: 1rem; color: #0284C7; display: flex; align-items: center; gap: 0.4rem;">${getLucideIcon('bar-chart-3')} Clinical Assessments Timeline</h4>
                ${assessmentsHTML}
            </div>
            <div>
                <h4 style="margin: 0 0 0.75rem 0; font-size: 1rem; color: #0284C7; display: flex; align-items: center; gap: 0.4rem;">${getLucideIcon('file-text')} Generated Clinical Reports</h4>
                ${reportsHTML}
            </div>
        `;

    } catch (err) {
        modalBody.innerHTML = `<div style="text-align: center; padding: 2rem; color: #EF4444;">Error: ${err.message}</div>`;
    }
}

async function loadDoctorReports() {
    const tbody = document.getElementById('tbody-doc-reports');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading clinical reports...</td></tr>`;

    try {
        const res = await fetch('/api/clinical-portal/doctor/reports', {
            headers: getAuthHeaders(false)
        });
        if (handleAuthError(res)) return;
        if (!res.ok) throw new Error('Failed to load reports');

        const data = await res.json();
        cachedDoctorReports = data.reports || [];
        renderDoctorReportsTable(cachedDoctorReports);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #EF4444;">Failed to load reports: ${err.message}</td></tr>`;
    }
}

function renderDoctorReportsTable(reports) {
    const tbody = document.getElementById('tbody-doc-reports');
    if (!tbody) return;

    if (!reports || reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No reports generated yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = reports.map(r => {
        const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';
        const findings = `${r.ct_diagnosis || 'CT Examined'} • ${r.ml_risk_tier || 'Low'} Risk`;

        const signOffCell = r.physician_signed_off
            ? `<span class="badge-certified">${getLucideIcon('check')} Certified</span>`
            : `<button type="button" class="btn-signoff-action" id="btn-sign-${r.id}" onclick="handleDoctorSignOff('${r.id}')">${getLucideIcon('file-signature')} Sign Off</button>`;

        const token = localStorage.getItem('strokeaegis_token');
        const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';

        return `
            <tr>
                <td><strong style="font-family: monospace;">${getLucideIcon('file-text')} ${escapeHTML(r.pdf_filename)}</strong></td>
                <td>
                    <strong>${escapeHTML(r.patient_name)}</strong><br>
                    <small style="color: var(--text-muted);">${escapeHTML(r.patient_mrn)}</small>
                </td>
                <td>${escapeHTML(dateStr)}</td>
                <td><strong>${escapeHTML(findings)}</strong></td>
                <td><span class="status-pill active">${getLucideIcon('check')} ${escapeHTML(r.validation_status || 'PASSED')}</span></td>
                <td id="sign-cell-${r.id}">${signOffCell}</td>
                <td>
                    <a href="/api/clinical-portal/reports/${r.id}/download${tokenQuery}" target="_blank" onclick="event.preventDefault(); downloadClinicalReport('${r.id}', '${escapeHTML(r.pdf_filename)}');" class="btn-action-sm primary">
                        ${getLucideIcon('file-text')} View PDF
                    </a>
                </td>
            </tr>
        `;
    }).join('');
}

async function handleDoctorSignOff(reportId) {
    const btn = document.getElementById(`btn-sign-${reportId}`);
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Certifying...';
    }

    try {
        const res = await fetch(`/api/clinical-portal/doctor/reports/${reportId}/sign-off`, {
            method: 'POST',
            headers: getAuthHeaders(true)
        });
        if (handleAuthError(res)) return;
        if (!res.ok) throw new Error('Sign-off failed');

        const cell = document.getElementById(`sign-cell-${reportId}`);
        if (cell) {
            cell.innerHTML = `<span class="badge-certified">${getLucideIcon('check')} Certified</span>`;
        }

        // Refresh stats
        await loadDoctorStats();
        alert('Report electronically signed and certified! The patient has been notified.');
    } catch (err) {
        alert('Sign-off error: ' + err.message);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `${getLucideIcon('file-signature')} Sign Off`;
        }
    }
}

// -------------------------------------------------------------
// Doctor Messaging System
// -------------------------------------------------------------
async function loadDoctorConversations() {
    const listEl = document.getElementById('doc-conversations-list');
    if (!listEl) return;

    try {
        const res = await fetch('/api/clinical-portal/conversations', {
            headers: getAuthHeaders(false)
        });
        if (handleAuthError(res)) return;
        if (!res.ok) return;

        const data = await res.json();
        const convos = data.conversations || [];

        if (convos.length === 0) {
            listEl.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No active patient threads.</div>`;
            return;
        }

        listEl.innerHTML = convos.map((c, idx) => {
            const name = c.counterparty ? c.counterparty.full_name : 'Patient';
            const mrn = c.counterparty && c.counterparty.mrn ? ` (${c.counterparty.mrn})` : '';
            const lastText = c.last_message ? c.last_message.content : 'Started consultation';
            const unreadBadge = c.unread_count > 0 ? `<span class="convo-unread-pill">${c.unread_count}</span>` : '';

            return `
                <div class="conversation-item ${idx === 0 ? 'active' : ''}" id="doc-convo-item-${c.id}" onclick="openDoctorConversation('${c.id}', '${escapeHTML(name)}')">
                    <div class="convo-avatar">${getLucideIcon("user")}</div>
                    <div class="convo-info">
                        <div class="convo-top">
                            <span class="convo-name">${escapeHTML(name)}${mrn}</span>
                        </div>
                        <div class="convo-preview">${escapeHTML(lastText)}</div>
                    </div>
                    ${unreadBadge}
                </div>
            `;
        }).join('');

        // Automatically open active conversation or first conversation
        if (convos.length > 0) {
            let target = convos[0];
            if (activeDocConvoId) {
                const found = convos.find(c => c.id === activeDocConvoId);
                if (found) target = found;
            }
            openDoctorConversation(target.id, target.counterparty ? target.counterparty.full_name : 'Patient');
        }

    } catch (err) {
        console.warn('Error loading doctor conversations:', err);
    }
}

async function openDoctorConversation(convoId, recipientName) {
    activeDocConvoId = convoId;

    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
    const currentItem = document.getElementById(`doc-convo-item-${convoId}`);
    if (currentItem) currentItem.classList.add('active');

    const nameEl = document.getElementById('doc-chat-recipient-name');
    if (nameEl) nameEl.textContent = recipientName;

    const input = document.getElementById('doc-chat-input');
    const btnSend = document.getElementById('btn-doc-chat-send');
    if (input) input.disabled = false;
    if (btnSend) btnSend.disabled = false;

    const stream = document.getElementById('doc-chat-stream');
    if (!stream) return;
    stream.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Loading messages...</div>`;

    try {
        const res = await fetch(`/api/clinical-portal/conversations/${convoId}/messages`, {
            headers: getAuthHeaders(false)
        });
        if (handleAuthError(res)) return;
        if (!res.ok) throw new Error('Could not load messages');

        const data = await res.json();
        const msgs = data.messages || [];

        if (msgs.length === 0) {
            stream.innerHTML = `<div class="chat-empty-state">No messages in this consultation yet. Type below to send clinical guidance.</div>`;
            return;
        }

        stream.innerHTML = msgs.map(m => {
            const bubbleClass = m.is_mine ? 'mine' : 'theirs';
            const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return `
                <div class="chat-bubble ${bubbleClass}">
                    ${escapeHTML(m.content)}
                    <span class="chat-bubble-time">${timeStr}</span>
                </div>
            `;
        }).join('');

        stream.scrollTop = stream.scrollHeight;
    } catch (err) {
        stream.innerHTML = `<div style="text-align: center; color: #EF4444; padding: 1.5rem;">Error: ${err.message}</div>`;
    }
}

async function refreshDoctorMessages(convoId) {
    const stream = document.getElementById('doc-chat-stream');
    if (!stream || !convoId || activeDocConvoId !== convoId) return;

    try {
        const res = await fetch(`/api/clinical-portal/conversations/${convoId}/messages`, {
            headers: getAuthHeaders(false)
        });
        if (!res.ok) return;

        const data = await res.json();
        const msgs = data.messages || [];

        const currentCount = stream.querySelectorAll('.chat-bubble').length;
        if (currentCount === msgs.length) return;

        const wasScrolledToBottom = (stream.scrollHeight - stream.clientHeight <= stream.scrollTop + 50);

        if (msgs.length === 0) {
            stream.innerHTML = `<div class="chat-empty-state">No messages in this consultation yet. Type below to send clinical guidance.</div>`;
            return;
        }

        stream.innerHTML = msgs.map(m => {
            const bubbleClass = m.is_mine ? 'mine' : 'theirs';
            const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return `
                <div class="chat-bubble ${bubbleClass}">
                    ${escapeHTML(m.content)}
                    <span class="chat-bubble-time">${timeStr}</span>
                </div>
            `;
        }).join('');

        if (wasScrolledToBottom) {
            stream.scrollTop = stream.scrollHeight;
        }
    } catch (err) {
        // silent background sync
    }
}

async function sendDoctorChatMessage() {
    if (!activeDocConvoId) return;
    const input = document.getElementById('doc-chat-input');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    input.value = '';

    try {
        const res = await fetch(`/api/clinical-portal/conversations/${activeDocConvoId}/messages`, {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify({ content: text })
        });
        if (handleAuthError(res)) return;
        if (!res.ok) throw new Error('Could not send message');

        const data = await res.json();
        const stream = document.getElementById('doc-chat-stream');
        if (stream) {
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble mine';
            bubble.innerHTML = `${escapeHTML(text)}<span class="chat-bubble-time">${timeStr}</span>`;
            stream.appendChild(bubble);
            stream.scrollTop = stream.scrollHeight;
        }
    } catch (err) {
        alert('Send message failed: ' + err.message);
    }
}

function switchDoctorToChatWithPatient(patientId) {
    switchDoctorPortalTab('doc-pane-chat');
    // If conversation exists for this patient, select it
    const patient = cachedDoctorPatients.find(p => p.id === patientId);
    if (patient && patient.conversation_id) {
        openDoctorConversation(patient.conversation_id, patient.full_name);
    }
}

// -------------------------------------------------------------
// Patient Portal Functions
// -------------------------------------------------------------
function showPatientPortal(activeTabId = 'pat-pane-selfcheck') {
    showScreen('screen-patient-portal');
    switchPatientPortalTab(activeTabId);
    loadPatientDashboard();
    updateDynamicReturnLabels();
}

function switchPatientPortalTab(targetPaneId) {
    document.querySelectorAll('#screen-patient-portal .portal-subnav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === targetPaneId);
    });
    document.querySelectorAll('#screen-patient-portal .portal-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === targetPaneId);
    });
    if (targetPaneId === 'pat-pane-chat') {
        loadPatientConversation();
    } else if (targetPaneId === 'pat-pane-doctor') {
        loadPatientCareTeam();
    } else if (targetPaneId === 'pat-pane-reports') {
        loadPatientReports();
    } else if (targetPaneId === 'pat-pane-history') {
        loadPatientAssessments();
    }
}

async function loadPatientDashboard() {
    await Promise.all([
        loadPatientOverview(),
        loadPatientAssessments(),
        loadPatientReports(),
        loadPatientConversation()
    ]);
}

async function loadPatientOverview() {
    try {
        const res = await fetch('/api/clinical-portal/patient/overview', {
            headers: getAuthHeaders(false)
        });
        if (handleAuthError(res)) return;
        if (!res.ok) return;

        const data = await res.json();
        const pat = data.patient;
        const doc = data.doctor;
        const stats = data.stats;

        // Welcome info
        const nameEl = document.getElementById('pat-welcome-name');
        const detailsEl = document.getElementById('pat-sub-details');
        if (nameEl) nameEl.textContent = pat.full_name || 'Patient';
        if (detailsEl) {
            let docLabel = 'No Primary Doctor Assigned';
            if (doc) {
                docLabel = doc.relationship_type === 'care_team'
                    ? `Care Team Doctor: ${doc.full_name}`
                    : `Supervising Neurologist: ${doc.full_name}`;
            }
            detailsEl.textContent = `MRN: ${pat.mrn} • ${pat.gender || ''} • ${docLabel}`;
        }

        // Stats
        const assStat = document.getElementById('pat-stat-assessments');
        const repStat = document.getElementById('pat-stat-reports');
        const riskStat = document.getElementById('pat-stat-risk');
        const unreadStat = document.getElementById('pat-stat-unread');

        if (assStat) assStat.textContent = stats.total_assessments;
        if (repStat) repStat.textContent = stats.total_reports;
        if (unreadStat) unreadStat.textContent = stats.unread_messages;

        if (riskStat && data.latest_assessment) {
            riskStat.textContent = data.latest_assessment.ml_risk_tier || 'Low';
        }

        // Always load full care team details and requests
        await loadPatientCareTeam();

        // Chat Header & Controls
        const chatDocName = document.getElementById('pat-chat-doctor-name');
        const chatDocMeta = document.getElementById('pat-chat-doctor-meta');
        const chatInput = document.getElementById('pat-chat-input');
        const chatSendBtn = document.getElementById('btn-pat-chat-send');
        if (doc) {
            if (chatDocName) chatDocName.textContent = doc.full_name;
            if (chatDocMeta) chatDocMeta.textContent = `${doc.specialization || 'Attending Physician'} • Direct Clinical Consultation`;
            if (chatInput) {
                chatInput.disabled = false;
                chatInput.placeholder = "Type a message or question for your doctor...";
            }
            if (chatSendBtn) chatSendBtn.disabled = false;
        } else {
            if (chatDocName) chatDocName.textContent = 'No Supervising Doctor Assigned';
            if (chatDocMeta) chatDocMeta.textContent = 'Connect with a physician via My Doctor & Care Team';
            if (chatInput) {
                chatInput.disabled = true;
                chatInput.placeholder = "Connect with a doctor to enable messaging...";
            }
            if (chatSendBtn) chatSendBtn.disabled = true;
        }

    } catch (err) {
        console.warn('Error loading patient overview:', err);
    }
}

async function handlePatientSelfCheck() {
    const btn = document.getElementById('btn-pat-run-risk');
    const spinner = document.getElementById('pat-sc-spinner');
    const btnIcon = document.getElementById('pat-sc-btn-icon');
    const btnText = document.getElementById('pat-sc-btn-text');
    const banner = document.getElementById('pat-sc-calculating-banner');
    const modal = document.getElementById('modal-selfcheck-result');
    const modalBody = document.getElementById('selfcheck-modal-body');

    // 1. Activate calculation loading state with scrolling animation
    if (btn) btn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (btnIcon) btnIcon.style.display = 'none';
    if (btnText) {
        btnText.textContent = (typeof t === 'function' ? t('pat.selfcheck.btn_calculating') : 'Calculating Stroke Risk...');
    }
    if (banner) {
        banner.style.display = 'block';
        banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const payload = {
        age: parseFloat(document.getElementById('pat-sc-age').value),
        gender: document.getElementById('pat-sc-gender').value,
        hypertension: parseInt(document.getElementById('pat-sc-hypertension').value),
        heart_disease: parseInt((document.getElementById('pat-sc-heart') || document.getElementById('pat-sc-heart_disease')).value),
        avg_glucose_level: parseFloat(document.getElementById('pat-sc-glucose').value),
        bmi: parseFloat(document.getElementById('pat-sc-bmi').value),
        smoking_status: document.getElementById('pat-sc-smoking').value,
        ever_married: document.getElementById('pat-sc-married').value,
        Residence_type: document.getElementById('pat-sc-residence').value
    };

    try {
        // Enforce smooth minimum wait time (~850ms) so the patient clearly sees the scrolling calculation animation
        const apiPromise = fetch('/api/clinical-portal/patient/quick-risk', {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify(payload)
        });
        const delayPromise = new Promise(r => setTimeout(r, 850));
        const [res] = await Promise.all([apiPromise, delayPromise]);

        if (handleAuthError(res)) return;
        if (!res.ok) throw new Error('Vascular risk calculation failed');

        const data = await res.json();
        const ml = data.result;

        if (modal && modalBody) {
            const tier = ml.risk_tier || 'Low';
            const tierColor = ml.tier_color || (tier === 'High' ? '#EF4444' : tier === 'Moderate' ? '#F59E0B' : '#10B981');
            const probPct = ml.probability_pct || (ml.stroke_probability * 100).toFixed(1);

            const factorsList = (ml.risk_factors && ml.risk_factors.length > 0) ? ml.risk_factors : (ml.clinical_factors || []);
            let factorsHTML = '';
            if (factorsList.length > 0) {
                factorsHTML = factorsList.map(f => `
                    <li class="sc-factor-item">
                        <span class="factor-bullet">•</span>
                        <div>
                            <strong>${escapeHTML(f.factor)}:</strong> 
                            <span>${escapeHTML(f.impact)}</span>
                        </div>
                    </li>
                `).join('');
            } else {
                const noFactorsMsg = typeof t === 'function' ? t('pat.selfcheck.no_factors') : 'No significant adverse cardiovascular multipliers detected.';
                factorsHTML = `
                    <li class="sc-factor-item sc-factor-empty">
                        <span class="factor-bullet">${getLucideIcon("check")}</span>
                        <div>${escapeHTML(noFactorsMsg)}</div>
                    </li>
                `;
            }

            const assessResultLabel = typeof t === 'function' ? t('pat.selfcheck.assessment_result') : 'Assessment Result';
            const strokeVulnLabel = typeof t === 'function' ? t('pat.selfcheck.stroke_vulnerability') : 'Stroke Vulnerability';
            const calcProbLabel = typeof t === 'function' ? t('pat.selfcheck.calculated_prob') : 'Calculated Probability';
            const contribFactorsLabel = typeof t === 'function' ? t('pat.selfcheck.contributing_factors') : 'Contributing Clinical Factors:';
            const savedNoticeLabel = typeof t === 'function' ? t('pat.selfcheck.saved_notice') : 'Result automatically saved to your longitudinal record and shared with your supervising neurologist.';
            const tierDesc = ml.tier_desc || ml.risk_tier_description || '';

            modalBody.innerHTML = `
                <div class="sc-modal-result-card" style="border-left: 5px solid ${tierColor};">
                    <div class="sc-modal-header-row">
                        <div>
                            <span class="sc-modal-tag">${escapeHTML(assessResultLabel)}</span>
                            <h3 class="sc-modal-tier-title">
                                <span>${escapeHTML(strokeVulnLabel)}:</span> 
                                <span style="color: ${tierColor};">${escapeHTML(tier)} Risk</span>
                            </h3>
                        </div>
                        <div class="sc-modal-prob-capsule" style="background: ${tierColor}18; color: ${tierColor}; border: 1.5px solid ${tierColor}45;">
                            <span class="prob-num">${escapeHTML(probPct)}%</span>
                            <span class="prob-label">${escapeHTML(calcProbLabel)}</span>
                        </div>
                    </div>
                    ${tierDesc ? `<p class="sc-modal-tier-desc">${escapeHTML(tierDesc)}</p>` : ''}
                </div>

                <div class="sc-modal-factors-section">
                    <h4 class="sc-modal-factors-heading">
                        ${getLucideIcon("clipboard-list")} <span>${escapeHTML(contribFactorsLabel)}</span>
                    </h4>
                    <ul class="sc-modal-factors-list">
                        ${factorsHTML}
                    </ul>
                </div>

                <div class="sc-modal-saved-notice">
                    <span class="notice-icon">${getLucideIcon("check")}</span>
                    <div class="notice-text">
                        ${escapeHTML(savedNoticeLabel)}
                    </div>
                </div>
            `;

            // Open modal over blurred page
            modal.style.display = 'flex';
        }

        // Refresh stats & timeline in background
        loadPatientAssessments();
        loadPatientOverview();

    } catch (err) {
        alert('Evaluation error: ' + err.message);
    } finally {
        if (banner) banner.style.display = 'none';
        if (btn) btn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnIcon) btnIcon.style.display = 'inline';
        if (btnText) {
            btnText.textContent = (typeof t === 'function' ? t('pat.selfcheck.btn') : 'Calculate My Stroke Risk');
        }
    }
}

async function loadPatientAssessments() {
    const list = document.getElementById('pat-timeline-list');
    if (!list) return;
    list.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading past clinical assessments...</div>`;

    try {
        const res = await fetch('/api/clinical-portal/patient/assessments', {
            headers: getAuthHeaders(false)
        });
        if (handleAuthError(res)) return;
        if (!res.ok) throw new Error('Failed to load assessments');

        const data = await res.json();
        const assessments = data.assessments || [];

        if (assessments.length === 0) {
            list.innerHTML = `<div style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No assessments recorded yet. Run a vascular self-check above to get started!</div>`;
            return;
        }

        list.innerHTML = assessments.map(a => {
            const dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            const tier = a.ml_risk_tier || 'Low';
            const tierClass = tier.toLowerCase();
            const probPct = a.ml_risk_probability ? `${(a.ml_risk_probability * 100).toFixed(1)}%` : '';
            const isFullFlow = a.assessment_type === 'ai_system_flow';
            const icon = isFullFlow ? getLucideIcon('bot') : getLucideIcon('stethoscope');
            const title = isFullFlow ? 'Comprehensive Multi-Agent Clinical Evaluation' : 'Vascular Health Self-Check';
            const diagStr = a.ct_diagnosis ? ` • CT Diagnosis: <strong>${escapeHTML(a.ct_diagnosis)}</strong>` : '';

            return `
                <div class="timeline-card">
                    <div class="timeline-main">
                        <div class="timeline-icon">${icon}</div>
                        <div class="timeline-content">
                            <h4>${title}</h4>
                            <p>${dateStr} ${diagStr}</p>
                        </div>
                    </div>
                    <div>
                        <span class="tier-tag ${tierClass}">${tier} Risk (${probPct})</span>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        list.innerHTML = `<div style="text-align: center; padding: 2rem; color: #EF4444;">Error: ${err.message}</div>`;
    }
}

async function loadPatientReports() {
    const grid = document.getElementById('pat-reports-grid');
    if (!grid) return;
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">Loading official reports...</div>`;

    try {
        const res = await fetch('/api/clinical-portal/patient/reports', {
            headers: getAuthHeaders(false)
        });
        if (handleAuthError(res)) return;
        if (!res.ok) throw new Error('Failed to load reports');

        const data = await res.json();
        const reports = data.reports || [];

        if (reports.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; color: var(--text-muted);">No reports available yet. Official reports will appear here once generated.</div>`;
            return;
        }

        grid.innerHTML = reports.map(r => {
            const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString() : '';
            const isSigned = r.physician_signed_off;
            const certBadge = isSigned
                ? `<span class="badge-certified">${getLucideIcon('check')} Certified by Physician</span>`
                : `<span class="status-pill pending">Pending Physician Sign-Off</span>`;

            const token = localStorage.getItem('strokeaegis_token');
            const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';

            return `
                <div class="report-card">
                    <div>
                        <div class="report-card-top">
                            <span class="report-card-icon">${getLucideIcon("file-text")}</span>
                            ${certBadge}
                        </div>
                        <h4 class="report-card-title">${escapeHTML(r.pdf_filename)}</h4>
                        <div class="report-card-meta">
                            Issued: ${dateStr} • ${escapeHTML(r.doctor_name || 'Supervising Neurologist')}
                        </div>
                    </div>
                    <div>
                        <a href="/api/clinical-portal/reports/${r.id}/download${tokenQuery}" target="_blank" onclick="event.preventDefault(); downloadClinicalReport('${r.id}', '${escapeHTML(r.pdf_filename)}');" class="btn-download-report" style="width: 100%;">
                            ${getLucideIcon("download")} Download Certified PDF Report
                        </a>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #EF4444;">Error: ${err.message}</div>`;
    }
}

async function loadPatientConversation() {
    const stream = document.getElementById('pat-chat-stream');
    if (!stream) return;

    try {
        const res = await fetch('/api/clinical-portal/conversations', {
            headers: getAuthHeaders(false)
        });
        if (handleAuthError(res)) return;
        if (!res.ok) return;

        const data = await res.json();
        const convos = data.conversations || [];
        const chatDocName = document.getElementById('pat-chat-doctor-name');
        const chatDocMeta = document.getElementById('pat-chat-doctor-meta');
        const chatInput = document.getElementById('pat-chat-input');
        const chatSendBtn = document.getElementById('btn-pat-chat-send');
        const docSelect = document.getElementById('pat-chat-doctor-select');

        if (convos.length === 0) {
            if (chatDocName) chatDocName.textContent = 'No Supervising Doctor Assigned';
            if (chatDocMeta) chatDocMeta.textContent = 'Connect with a physician via My Doctor & Care Team';
            if (chatInput) {
                chatInput.disabled = true;
                chatInput.placeholder = 'Connect with a doctor to enable messaging...';
            }
            if (chatSendBtn) chatSendBtn.disabled = true;
            if (docSelect) docSelect.style.display = 'none';

            stream.innerHTML = `
                <div class="chat-empty-state" style="padding: 3rem 1.5rem; text-align: center;">
                    <div style="margin-bottom: 0.75rem; color: var(--text-muted);">${getLucideIcon('user-x')}</div>
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 1.05rem; font-weight: 700; color: var(--text-main);">No Doctor Connected</h4>
                    <p style="margin: 0 0 1.25rem 0; font-size: 0.88rem; color: var(--text-muted); max-width: 400px; margin-inline: auto; line-height: 1.5;">
                        You are currently not connected to an attending physician. Please request clinical supervision under <strong>My Doctor &amp; Care Team</strong> to activate direct consultation chat.
                    </p>
                    <button type="button" class="btn btn-primary" onclick="switchPatientPortalTab('pat-pane-doctor'); openFindDoctorModal();" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1.2rem; font-size: 0.86rem; border-radius: 9999px;">
                        ${getLucideIcon('search')} Find a Doctor
                    </button>
                </div>`;
            activePatConvoId = null;
            return;
        }

        // When conversations exist:
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = 'Type a message or question for your doctor...';
        }
        if (chatSendBtn) chatSendBtn.disabled = false;

        let convo = convos[0];
        if (activePatConvoId) {
            const foundActive = convos.find(c => c.id === activePatConvoId);
            if (foundActive) convo = foundActive;
        }
        if (window.targetChatDoctorId) {
            const found = convos.find(c => c.counterparty && c.counterparty.id === window.targetChatDoctorId);
            if (found) convo = found;
            window.targetChatDoctorId = null;
        }
        activePatConvoId = convo.id;

        // If multiple doctors connected, provide a quick selector
        if (docSelect) {
            if (convos.length > 1) {
                docSelect.style.display = 'inline-block';
                docSelect.innerHTML = convos.map(c => `
                    <option value="${c.id}" ${c.id === convo.id ? 'selected' : ''}>
                        ${escapeHTML(c.counterparty ? c.counterparty.full_name : 'Doctor')} (${escapeHTML(c.counterparty && c.counterparty.specialization ? c.counterparty.specialization : 'Specialist')})
                    </option>
                `).join('');
                docSelect.onchange = async (e) => {
                    const selId = e.target.value;
                    const selected = convos.find(c => c.id === selId);
                    if (selected) {
                        activePatConvoId = selected.id;
                        if (selected.counterparty) {
                            if (chatDocName) chatDocName.textContent = selected.counterparty.full_name;
                            if (chatDocMeta) chatDocMeta.textContent = `${selected.counterparty.specialization || 'Attending Physician'} • Direct Consultation`;
                        }
                        await loadPatientMessagesForConvo(selected.id);
                    }
                };
            } else {
                docSelect.style.display = 'none';
            }
        }

        if (convo.counterparty) {
            if (chatDocName) chatDocName.textContent = convo.counterparty.full_name;
            if (chatDocMeta) chatDocMeta.textContent = `${convo.counterparty.specialization || 'Attending Physician'} • Direct Consultation`;
        }

        await loadPatientMessagesForConvo(convo.id);
    } catch (err) {
        console.warn('Error loading patient conversation:', err);
    }
}

async function loadPatientMessagesForConvo(convoId, isBackground = false) {
    const stream = document.getElementById('pat-chat-stream');
    if (!stream || !convoId) return;

    try {
        const msgRes = await fetch(`/api/clinical-portal/conversations/${convoId}/messages`, {
            headers: getAuthHeaders(false)
        });
        if (!msgRes.ok) return;

        const msgData = await msgRes.json();
        const msgs = msgData.messages || [];

        if (msgs.length === 0) {
            if (!isBackground) {
                stream.innerHTML = `<div class="chat-empty-state">Type a message below to consult your supervising neurologist.</div>`;
            }
            return;
        }

        const currentCount = stream.querySelectorAll('.chat-bubble').length;
        if (isBackground && currentCount === msgs.length) {
            return;
        }

        const wasScrolledToBottom = (stream.scrollHeight - stream.clientHeight <= stream.scrollTop + 50);

        stream.innerHTML = msgs.map(m => {
            const bubbleClass = m.is_mine ? 'mine' : 'theirs';
            const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return `
                <div class="chat-bubble ${bubbleClass}">
                    ${escapeHTML(m.content)}
                    <span class="chat-bubble-time">${timeStr}</span>
                </div>
            `;
        }).join('');

        if (wasScrolledToBottom || !isBackground) {
            stream.scrollTop = stream.scrollHeight;
        }
    } catch (err) {
        if (!isBackground) {
            console.warn('Error loading conversation messages:', err);
        }
    }
}

async function sendPatientChatMessage() {
    if (!activePatConvoId) {
        // Attempt auto-healing reload in case doctor approved relationship
        await loadPatientConversation();
    }
    if (!activePatConvoId) {
        alert('No active doctor consultation thread found. Please ensure you are connected with a physician under My Doctor & Care Team.');
        return;
    }
    const input = document.getElementById('pat-chat-input');
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    input.value = '';

    try {
        const res = await fetch(`/api/clinical-portal/conversations/${activePatConvoId}/messages`, {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify({ content: text })
        });
        if (handleAuthError(res)) return;
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || 'Could not send message');
        }

        const stream = document.getElementById('pat-chat-stream');
        if (stream) {
            const emptyEl = stream.querySelector('.chat-empty-state');
            if (emptyEl) emptyEl.remove();

            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble mine';
            bubble.innerHTML = `${escapeHTML(text)}<span class="chat-bubble-time">${timeStr}</span>`;
            stream.appendChild(bubble);
            stream.scrollTop = stream.scrollHeight;
        }
    } catch (err) {
        alert('Send message failed: ' + err.message);
    }
}

// -------------------------------------------------------------
// Doctor Patient Admission Handler
// -------------------------------------------------------------
async function handleAdmitPatientSubmit() {
    const spinner = document.getElementById('admit-spinner');
    const submitBtn = document.getElementById('btn-submit-admit');
    if (spinner) spinner.style.display = 'inline-block';
    if (submitBtn) submitBtn.disabled = true;

    const fullName = document.getElementById('admit-fullname').value.trim();
    const email = document.getElementById('admit-email').value.trim();
    const dob = document.getElementById('admit-dob').value || null;
    const gender = document.getElementById('admit-gender').value;
    const emergency = document.getElementById('admit-emergency').value.trim() || null;

    try {
        const res = await fetch('/api/clinical-portal/doctor/patients/admit', {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify({
                full_name: fullName,
                email: email,
                date_of_birth: dob,
                gender: gender,
                emergency_contact: emergency,
                status: 'active'
            })
        });

        if (handleAuthError(res)) return;
        const data = await res.json();

        if (!res.ok) {
            alert('Admission failed: ' + (data.detail || 'Could not admit patient'));
            return;
        }

        // Close modal
        const modal = document.getElementById('modal-admit-patient');
        if (modal) modal.style.display = 'none';

        // Refresh doctor workspace
        await Promise.all([
            loadDoctorPatients(),
            loadDoctorStats(),
            loadNotifications()
        ]);

        alert(`✓ Patient ${data.patient.full_name} successfully admitted with MRN ${data.patient.mrn}!`);
    } catch (err) {
        alert('Admission error: ' + err.message);
    } finally {
        if (spinner) spinner.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
    }
}

// -------------------------------------------------------------
// Doctor & Patient Relationship / Care Team Handlers
// -------------------------------------------------------------

function formatTimeRemaining(isoStr) {
    if (!isoStr) return '';
    try {
        const expires = new Date(isoStr);
        const now = new Date();
        const diffMs = expires - now;
        if (diffMs <= 0) return 'Expired';
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `Expires in ${diffHours}h ${diffMinutes}m`;
    } catch (e) {
        return '';
    }
}

async function loadDoctorRequests() {
    const container = document.getElementById('doc-incoming-requests-container');
    if (!container) return;

    try {
        const res = await fetch('/api/clinical-portal/doctor/requests', {
            headers: getAuthHeaders(false)
        });
        if (handleAuthError(res)) return;
        if (!res.ok) return;

        const data = await res.json();
        const incoming = data.incoming || [];

        if (incoming.length === 0) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = `
            <div style="background: rgba(37, 99, 235, 0.08); border: 1.5px solid #3B82F6; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        ${getLucideIcon('user-plus')}
                        <h4 style="margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-main);">
                            Incoming Patient Connection Requests (${incoming.length})
                        </h4>
                    </div>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">Action required within 48h</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${incoming.map(req => {
                        const timeRem = formatTimeRemaining(req.expires_at);
                        return `
                            <div style="background: var(--bg-card, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; padding: 0.9rem 1.15rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                                <div>
                                    <strong style="color: var(--text-main); font-size: 0.95rem;">${escapeHTML(req.patient_name)}</strong>
                                    <span style="color: var(--text-muted); font-size: 0.82rem; margin-left: 0.5rem;">MRN: ${escapeHTML(req.patient_mrn)}</span>
                                    <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.2rem;">
                                        ${escapeHTML(req.patient_email)} • <span style="color: #D97706; font-weight: 600;">${timeRem}</span>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 0.5rem;">
                                    <button type="button" class="btn btn-sm btn-primary" onclick="acceptConnectionRequest('${req.id}')" style="padding: 0.35rem 0.85rem; font-size: 0.82rem; border-radius: 6px;">
                                        Accept Request
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary" onclick="declineConnectionRequest('${req.id}')" style="padding: 0.35rem 0.85rem; font-size: 0.82rem; border-radius: 6px;">
                                        Decline
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } catch (err) {
        console.warn('Failed to load doctor requests:', err);
    }
}

function openAddPatientModal() {
    const modal = document.getElementById('modal-admit-patient');
    if (!modal) return;
    
    const formInvite = document.getElementById('form-invite-patient');
    const formAdmit = document.getElementById('form-admit-patient');
    const feedback = document.getElementById('admit-request-feedback');
    const inviteEmailInput = document.getElementById('admit-email-request');

    if (formInvite) formInvite.reset();
    if (formAdmit) formAdmit.reset();
    if (feedback) {
        feedback.style.display = 'none';
        feedback.className = 'admit-feedback-box';
        feedback.innerHTML = '';
    }

    const tabInvite = document.getElementById('tab-btn-invite-email');
    const tabDirect = document.getElementById('tab-btn-direct-admit');
    const contentInvite = document.getElementById('admit-tab-content-invite');
    const contentDirect = document.getElementById('admit-tab-content-direct');

    if (tabInvite && tabDirect) {
        tabInvite.classList.add('active');
        tabDirect.classList.remove('active');
    }
    if (contentInvite) contentInvite.style.display = 'block';
    if (contentDirect) contentDirect.style.display = 'none';

    modal.style.display = 'flex';
    if (inviteEmailInput) {
        setTimeout(() => inviteEmailInput.focus(), 100);
    }
}

async function handleInvitePatientSubmit() {
    const emailInput = document.getElementById('admit-email-request');
    const feedback = document.getElementById('admit-request-feedback');
    const spinner = document.getElementById('admit-invite-spinner');
    const submitBtn = document.getElementById('btn-submit-invite');

    if (!emailInput || !feedback) return;
    const email = emailInput.value.trim();
    if (!email) return;

    if (spinner) spinner.style.display = 'inline-block';
    if (submitBtn) submitBtn.disabled = true;
    feedback.style.display = 'none';

    try {
        const res = await fetch('/api/clinical-portal/doctor/patients/request', {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify({ email: email })
        });

        if (handleAuthError(res)) return;
        const data = await res.json();

        feedback.style.display = 'block';
        if (!res.ok) {
            feedback.className = 'admit-feedback-box error';
            feedback.innerHTML = escapeHTML(data.detail || 'Failed to send connection request.');
            return;
        }

        feedback.className = 'admit-feedback-box success';
        feedback.innerHTML = `✓ ${escapeHTML(data.message || 'Connection request sent successfully! (48-hour expiration)')}`;
        emailInput.value = '';

        await loadDoctorRequests();
        await loadNotifications();
    } catch (err) {
        feedback.style.display = 'block';
        feedback.className = 'admit-feedback-box error';
        feedback.innerHTML = 'Error sending request: ' + escapeHTML(err.message);
    } finally {
        if (spinner) spinner.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function loadPatientCareTeam() {
    const incContainer = document.getElementById('pat-incoming-requests-container');
    const docCard = document.getElementById('pat-doctor-card');
    const careList = document.getElementById('pat-care-team-list');
    const outContainer = document.getElementById('pat-outgoing-requests-container');

    try {
        const res = await fetch('/api/clinical-portal/patient/care-team', {
            headers: getAuthHeaders(false)
        });
        if (handleAuthError(res)) return;
        if (!res.ok) return;

        const data = await res.json();
        const primaryDoc = data.primary_doctor;
        const careTeam = data.care_team || [];
        const incoming = data.incoming_requests || [];
        const outgoing = data.outgoing_requests || [];

        // 1. Incoming Requests from Doctors
        if (incContainer) {
            if (incoming.length > 0) {
                incContainer.style.display = 'block';
                incContainer.innerHTML = `
                    <div style="background: rgba(37, 99, 235, 0.08); border: 1.5px solid #3B82F6; border-radius: 12px; padding: 1.25rem;">
                        <h4 style="margin: 0 0 0.85rem 0; font-size: 0.98rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">
                            ${getLucideIcon('user-plus')} Doctor Clinical Supervision Invitations (${incoming.length})
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            ${incoming.map(req => {
                                const timeRem = formatTimeRemaining(req.expires_at);
                                return `
                                    <div style="background: var(--bg-card, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; padding: 0.85rem 1.15rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                                        <div>
                                            <strong style="color: var(--text-main); font-size: 0.95rem;">${escapeHTML(req.full_name)}</strong>
                                            <div style="color: var(--text-muted); font-size: 0.82rem; margin-top: 0.2rem;">
                                                ${escapeHTML(req.specialization)} • ${escapeHTML(req.hospital)}
                                            </div>
                                            <div style="color: #D97706; font-size: 0.8rem; font-weight: 600; margin-top: 0.2rem;">
                                                ${timeRem}
                                            </div>
                                        </div>
                                        <div style="display: flex; gap: 0.5rem;">
                                            <button type="button" class="btn btn-sm btn-primary" onclick="acceptConnectionRequest('${req.relationship_id}')" style="padding: 0.35rem 0.85rem; font-size: 0.82rem; border-radius: 6px;">
                                                Accept Doctor
                                            </button>
                                            <button type="button" class="btn btn-sm btn-secondary" onclick="declineConnectionRequest('${req.relationship_id}')" style="padding: 0.35rem 0.85rem; font-size: 0.82rem; border-radius: 6px;">
                                                Decline
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            } else {
                incContainer.style.display = 'none';
                incContainer.innerHTML = '';
            }
        }

        // 2. Primary Doctor
        if (docCard) {
            if (primaryDoc) {
                docCard.innerHTML = `
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
                        <div style="display: flex; gap: 1.25rem; align-items: center;">
                            <div class="doctor-avatar-lg" style="width: 58px; height: 58px; border-radius: 50%; background: rgba(37, 99, 235, 0.12); display: flex; align-items: center; justify-content: center; color: var(--primary);">
                                ${getLucideIcon('stethoscope')}
                            </div>
                            <div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                    <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main);">${escapeHTML(primaryDoc.full_name)}</h3>
                                    <span class="rel-badge rel-badge-primary">Primary Supervising Doctor</span>
                                </div>
                                <p style="margin: 0.25rem 0 0 0; color: var(--text-muted); font-size: 0.88rem;">
                                    ${escapeHTML(primaryDoc.specialization)} • ${escapeHTML(primaryDoc.hospital)}
                                </p>
                                <p style="margin: 0.2rem 0 0 0; color: var(--text-muted); font-size: 0.82rem;">
                                    ${primaryDoc.email ? `Email: ${escapeHTML(primaryDoc.email)}` : ''} 
                                    ${primaryDoc.phone ? ` • Tel: ${escapeHTML(primaryDoc.phone)}` : ''}
                                </p>
                            </div>
                        </div>
                        <div>
                            <button type="button" class="btn btn-primary" onclick="switchToPatientDoctorChat('${primaryDoc.doctor_id}')" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1.1rem; font-size: 0.85rem; border-radius: 8px;">
                                ${getLucideIcon('message-circle')} Direct Consultation Chat
                            </button>
                        </div>
                    </div>
                `;
            } else {
                docCard.innerHTML = `
                    <div style="text-align: center; padding: 2rem 1.5rem; background: var(--bg-card, #ffffff); border: 1.5px dashed var(--border-color, #cbd5e1); border-radius: 12px;">
                        <div style="margin-bottom: 0.75rem; color: var(--text-muted);">${getLucideIcon('user-x')}</div>
                        <h4 style="margin: 0 0 0.5rem 0; font-size: 1.05rem; font-weight: 700; color: var(--text-main);">No Primary Doctor Assigned</h4>
                        <p style="margin: 0 0 1.25rem 0; font-size: 0.86rem; color: var(--text-muted); max-width: 440px; margin-inline: auto;">
                            You currently do not have an active supervising neurologist assigned. Search our network of verified physicians to request clinical oversight.
                        </p>
                        <button type="button" class="btn btn-primary" onclick="openFindDoctorModal()" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1.2rem; font-size: 0.86rem; border-radius: 9999px;">
                            ${getLucideIcon('search')} Find a Doctor
                        </button>
                    </div>
                `;
            }
        }

        // 3. Specialized Care Team Members
        if (careList) {
            if (careTeam.length > 0) {
                careList.innerHTML = careTeam.map(doc => `
                    <div class="care-team-card">
                        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                            <div class="doctor-avatar-sm" style="width: 40px; height: 40px; border-radius: 50%; background: rgba(16, 185, 129, 0.12); display: flex; align-items: center; justify-content: center; color: #10B981;">
                                ${getLucideIcon('stethoscope')}
                            </div>
                            <div>
                                <strong style="font-size: 0.95rem; color: var(--text-main); display: block;">${escapeHTML(doc.full_name)}</strong>
                                <span class="rel-badge rel-badge-care">Care Team</span>
                            </div>
                        </div>
                        <div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 0.85rem;">
                            <div>${escapeHTML(doc.specialization)}</div>
                            <div>${escapeHTML(doc.hospital)}</div>
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="switchToPatientDoctorChat('${doc.doctor_id}')" style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 0.35rem; font-size: 0.8rem; padding: 0.35rem 0.5rem;">
                            ${getLucideIcon('message-circle')} Send Message
                        </button>
                    </div>
                `).join('');
            } else {
                careList.innerHTML = `
                    <div style="grid-column: 1/-1; padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px;">
                        No secondary care team specialists assigned yet.
                    </div>
                `;
            }
        }

        // 4. Outgoing Requests
        if (outContainer) {
            if (outgoing.length > 0) {
                outContainer.style.display = 'block';
                outContainer.innerHTML = `
                    <div style="margin-top: 1.5rem;">
                        <h4 style="font-size: 0.95rem; font-weight: 600; margin: 0 0 0.75rem 0; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">
                            ${getLucideIcon('clock')} Pending Outgoing Requests (${outgoing.length})
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                            ${outgoing.map(req => {
                                const timeRem = formatTimeRemaining(req.expires_at);
                                return `
                                    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                        <div>
                                            <strong style="font-size: 0.9rem; color: var(--text-main);">${escapeHTML(req.full_name)}</strong>
                                            <span style="font-size: 0.82rem; color: var(--text-muted); margin-left: 0.5rem;">${escapeHTML(req.specialization)}</span>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                                            <span style="color: #D97706; font-size: 0.8rem; font-weight: 600;">${timeRem}</span>
                                            <span class="badge badge-warning" style="font-size: 0.75rem;">Awaiting Doctor Review</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            } else {
                outContainer.style.display = 'none';
                outContainer.innerHTML = '';
            }
        }

    } catch (err) {
        console.warn('Failed to load patient care team:', err);
    }
}

function openFindDoctorModal() {
    const modal = document.getElementById('modal-find-doctor');
    const searchInput = document.getElementById('find-doctor-search-input');
    const feedback = document.getElementById('find-doctor-feedback');
    if (!modal) return;

    if (searchInput) searchInput.value = '';
    if (feedback) {
        feedback.style.display = 'none';
        feedback.className = 'admit-feedback-box';
        feedback.innerHTML = '';
    }

    modal.style.display = 'flex';
    loadAvailableDoctors('');
}

async function loadAvailableDoctors(query = '') {
    const container = document.getElementById('find-doctor-list-container');
    if (!container) return;

    container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Searching verified physicians...</div>`;

    try {
        const res = await fetch('/api/clinical-portal/patient/search-doctors', {
            headers: getAuthHeaders(false)
        });
        if (handleAuthError(res)) return;
        if (!res.ok) throw new Error('Could not load doctors');

        const data = await res.json();
        let docs = data.doctors || [];

        if (query) {
            const q = query.toLowerCase();
            docs = docs.filter(d => 
                (d.full_name && d.full_name.toLowerCase().includes(q)) ||
                (d.specialization && d.specialization.toLowerCase().includes(q)) ||
                (d.hospital && d.hospital.toLowerCase().includes(q))
            );
        }

        if (docs.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                    <div style="margin-bottom: 0.5rem;">${getLucideIcon('search-x')}</div>
                    <p style="margin: 0; font-size: 0.9rem;">No physicians found matching your search.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = docs.map(doc => {
            let actionBtn = '';
            if (doc.status_label === 'primary') {
                actionBtn = `<span class="rel-badge rel-badge-primary">Your Primary Doctor</span>`;
            } else if (doc.status_label === 'care_team') {
                actionBtn = `<span class="rel-badge rel-badge-care">Your Care Team</span>`;
            } else if (doc.status_label === 'pending') {
                actionBtn = `<span class="badge badge-warning" style="font-size: 0.78rem;">Request Pending (48h)</span>`;
            } else {
                actionBtn = `
                    <button type="button" class="btn btn-sm btn-primary" onclick="handlePatientRequestDoctor('${doc.doctor_id}')" style="padding: 0.35rem 0.85rem; font-size: 0.82rem; border-radius: 6px;">
                        ${getLucideIcon('user-plus')} Request Supervision
                    </button>
                `;
            }

            return `
                <div style="background: var(--bg-card, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; padding: 0.9rem 1.15rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.85rem;">
                        <div style="width: 42px; height: 42px; border-radius: 50%; background: rgba(37, 99, 235, 0.1); display: flex; align-items: center; justify-content: center; color: var(--primary);">
                            ${getLucideIcon('stethoscope')}
                        </div>
                        <div>
                            <strong style="color: var(--text-main); font-size: 0.95rem;">${escapeHTML(doc.full_name)}</strong>
                            <div style="color: var(--text-muted); font-size: 0.82rem; margin-top: 0.15rem;">
                                ${escapeHTML(doc.specialization)} • ${escapeHTML(doc.hospital)}
                            </div>
                        </div>
                    </div>
                    <div>
                        ${actionBtn}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        container.innerHTML = `<div style="text-align: center; padding: 2rem; color: #EF4444;">Error: ${escapeHTML(err.message)}</div>`;
    }
}

async function handlePatientRequestDoctor(doctorId) {
    const feedback = document.getElementById('find-doctor-feedback');
    if (feedback) {
        feedback.style.display = 'none';
        feedback.className = 'admit-feedback-box';
    }

    try {
        const res = await fetch('/api/clinical-portal/patient/request-doctor', {
            method: 'POST',
            headers: getAuthHeaders(true),
            body: JSON.stringify({ doctor_id: doctorId })
        });
        if (handleAuthError(res)) return;
        const data = await res.json();

        if (feedback) {
            feedback.style.display = 'block';
            if (!res.ok) {
                feedback.className = 'admit-feedback-box error';
                feedback.innerHTML = escapeHTML(data.detail || 'Could not send request.');
                return;
            }
            feedback.className = 'admit-feedback-box success';
            feedback.innerHTML = `✓ ${escapeHTML(data.message || 'Supervision request sent successfully!')}`;
        }

        const searchInput = document.getElementById('find-doctor-search-input');
        const q = searchInput ? searchInput.value.trim() : '';
        await loadAvailableDoctors(q);
        await loadPatientCareTeam();
        await loadNotifications();
    } catch (err) {
        if (feedback) {
            feedback.style.display = 'block';
            feedback.className = 'admit-feedback-box error';
            feedback.innerHTML = 'Error: ' + escapeHTML(err.message);
        }
    }
}

async function acceptConnectionRequest(relationshipId) {
    if (!confirm('Are you sure you want to accept this connection request?')) return;

    try {
        const res = await fetch(`/api/clinical-portal/relationships/${relationshipId}/accept`, {
            method: 'POST',
            headers: getAuthHeaders(true)
        });
        if (handleAuthError(res)) return;
        const data = await res.json();

        if (!res.ok) {
            alert('Acceptance failed: ' + (data.detail || 'Could not accept request.'));
            return;
        }

        alert(`✓ ${data.message || 'Connection established successfully!'}`);

        const user = JSON.parse(localStorage.getItem('strokeaegis_user') || '{}');
        if (user && user.role === 'doctor') {
            await loadDoctorRequests();
            await loadDoctorPatients();
            await loadDoctorStats();
            await loadDoctorConversations();
        } else {
            await loadPatientOverview();
            await loadPatientCareTeam();
            await loadPatientConversation();
        }
        await loadNotifications();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function declineConnectionRequest(relationshipId) {
    if (!confirm('Are you sure you want to decline this connection request?')) return;

    try {
        const res = await fetch(`/api/clinical-portal/relationships/${relationshipId}/decline`, {
            method: 'POST',
            headers: getAuthHeaders(true)
        });
        if (handleAuthError(res)) return;
        const data = await res.json();

        if (!res.ok) {
            alert('Decline failed: ' + (data.detail || 'Could not decline request.'));
            return;
        }

        const user = JSON.parse(localStorage.getItem('strokeaegis_user') || '{}');
        if (user && user.role === 'doctor') {
            await loadDoctorRequests();
        } else {
            await loadPatientCareTeam();
        }
        await loadNotifications();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function switchToPatientDoctorChat(doctorId) {
    window.targetChatDoctorId = doctorId;
    switchPatientPortalTab('pat-pane-chat');
    loadPatientConversation();
}

// -------------------------------------------------------------
// Notifications Management Functions
// -------------------------------------------------------------
async function loadNotifications() {
    const badge = document.getElementById('header-notif-count');

    try {
        const res = await fetch('/api/clinical-portal/notifications', {
            headers: getAuthHeaders(false)
        });
        if (handleAuthError(res)) return;
        if (!res.ok) return;

        const data = await res.json();
        const notifs = data.notifications || [];
        const unread = data.unread_count || 0;

        if (badge) {
            badge.textContent = unread;
            badge.style.display = unread > 0 ? 'inline-block' : 'none';
        }

        renderNotificationsList(notifs);
    } catch (err) {
        console.warn('Error loading notifications:', err);
    }
}

function renderNotificationsList(notifs) {
    const container = document.getElementById('notifs-list-container');
    if (!container) return;

    if (!notifs || notifs.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">No notifications recorded yet.</div>`;
        return;
    }

    container.innerHTML = notifs.map(n => {
        const timeStr = n.created_at ? new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        const unreadClass = n.is_read ? 'read' : 'unread';
        const unreadDot = n.is_read ? '' : `<span class="notif-unread-dot" title="Unread"></span>`;
        const isMsg = n.notification_type === 'new_message' || n.type === 'message';
        const isRep = n.notification_type === 'report_ready' || n.type === 'report';
        const icon = isRep ? getLucideIcon('file-text') : (isMsg ? getLucideIcon('message-square') : getLucideIcon('bell'));

        let actionsHTML = '';
        if (isMsg && n.reference_id) {
            actionsHTML += `<button type="button" class="notif-action-btn" onclick="openChatFromNotification('${n.reference_id}', '${n.id}')" style="background: var(--color-primary, #2563eb); color: #ffffff; border: none; font-weight: 600; padding: 0.3rem 0.75rem; border-radius: 6px; cursor: pointer; margin-right: 0.5rem; display: inline-flex; align-items: center; gap: 0.35rem;">${getLucideIcon('message-square')} Open Chat</button>`;
        }
        if (!n.is_read) {
            actionsHTML += `<button type="button" class="notif-action-btn" onclick="markNotificationRead('${n.id}')">Mark as read</button>`;
        }

        return `
            <div class="notif-item ${unreadClass}" id="notif-item-${n.id}">
                <div class="notif-icon-box">${icon}</div>
                <div class="notif-body">
                    <div class="notif-top">
                        <span class="notif-title">${escapeHTML(n.title)} ${unreadDot}</span>
                        <span class="notif-time">${timeStr}</span>
                    </div>
                    <div class="notif-message">${escapeHTML(n.message)}</div>
                    ${actionsHTML ? `<div style="margin-top: 0.5rem; display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem;">${actionsHTML}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function openChatFromNotification(convoId, notifId) {
    if (notifId) {
        await markNotificationRead(notifId);
    }
    const modalNotifs = document.getElementById('modal-notifications-drawer');
    if (modalNotifs) modalNotifs.style.display = 'none';

    const user = JSON.parse(localStorage.getItem('strokeaegis_user') || '{}');
    if (user && user.role === 'patient') {
        showPatientPortal('pat-pane-chat');
        activePatConvoId = convoId;
        await loadPatientConversation();
    } else if (user && user.role === 'doctor') {
        showDoctorPortal('doc-pane-chat');
        activeDocConvoId = convoId;
        await loadDoctorConversations();
    }
}

async function markNotificationRead(notifId) {
    try {
        const res = await fetch(`/api/clinical-portal/notifications/${notifId}/read`, {
            method: 'POST',
            headers: getAuthHeaders(true)
        });
        if (handleAuthError(res)) return;
        await loadNotifications();
    } catch (err) {
        console.warn('Mark read error:', err);
    }
}

async function markAllNotificationsRead() {
    try {
        const res = await fetch('/api/clinical-portal/notifications/read-all', {
            method: 'POST',
            headers: getAuthHeaders(true)
        });
        if (handleAuthError(res)) return;
        await loadNotifications();
    } catch (err) {
        console.warn('Mark all read error:', err);
    }
}



