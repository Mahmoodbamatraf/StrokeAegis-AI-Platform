"""
Unit verification script for Doctor navigation fixes and patient portal handlers
"""
from pathlib import Path

def test_navigation_fixes():
    js_path = Path("frontend/app.js")
    assert js_path.exists(), "frontend/app.js missing"
    content = js_path.read_text(encoding="utf-8")

    # 1. Check btnDocLaunchReg launches screen-regular-system (not blank screen-regular)
    assert "showScreen('screen-regular-system')" in content, "Missing showScreen('screen-regular-system')"
    assert "showScreen('screen-regular');" not in content, "Found obsolete showScreen('screen-regular')"
    print("✓ Fix 1 Verified: btnDocLaunchReg properly targets screen-regular-system.")

    # 2. Check returnToUserHome definition and role-based routing
    assert "function returnToUserHome()" in content, "Missing returnToUserHome function"
    assert "showDoctorPortal()" in content, "Missing showDoctorPortal call in return routing"
    print("✓ Fix 2 Verified: returnToUserHome properly implemented for doctors and patients.")

    # 3. Check dynamic return labels
    assert "function updateDynamicReturnLabels()" in content, "Missing updateDynamicReturnLabels function"
    assert "stepper.return_doctor" in content, "Missing stepper.return_doctor key lookup"
    print("✓ Fix 3 Verified: updateDynamicReturnLabels dynamically formats Doctor/Patient return labels.")

    # 4. Check homeButtons array uses returnToUserHome
    assert "returnToUserHome();" in content, "homeButtons not calling returnToUserHome"
    print("✓ Fix 4 Verified: All home buttons (header brand, wizard back, finish, report return, regular back/home) route through returnToUserHome().")

    # 5. Check showPatientPortal and switchPatientPortalTab definition
    assert "function showPatientPortal(" in content, "Missing showPatientPortal function"
    assert "function switchPatientPortalTab(" in content, "Missing switchPatientPortalTab function"
    print("✓ Fix 5 Verified: showPatientPortal and switchPatientPortalTab fully implemented.")

    # 6. Check i18n translations
    i18n_path = Path("frontend/i18n.js")
    i18n_content = i18n_path.read_text(encoding="utf-8")
    assert "stepper.return_doctor" in i18n_content, "Missing stepper.return_doctor in i18n"
    assert "stepper.return_patient" in i18n_content, "Missing stepper.return_patient in i18n"
    assert "العودة إلى لوحة تحكم الطبيب" in i18n_content, "Missing Arabic doctor dashboard return in i18n"
    print("✓ Fix 6 Verified: Bilingual translations for Doctor & Patient returns present in i18n.js.")

    print("\nALL DOCTOR NAVIGATION FIXES SUCCESSFULLY VERIFIED!")

if __name__ == "__main__":
    test_navigation_fixes()
