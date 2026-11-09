# StrokeAegis API Contract (as consumed by legacy `frontend/app.js`)

Source of truth used for this document:
- Frontend: `frontend/app.js` at git `HEAD` (commit `a89e8b8`, 6258 lines). NOTE: in the working tree this file has
  already been deleted (a Vite scaffold `frontend/src`, `package.json`, `vite.config.ts` now sits there). Line numbers
  below (`L1234`) refer to `git show HEAD:frontend/app.js`.
- Backend: `backend/app.py`, `backend/auth/{router,schemas,dependencies,security}.py`,
  `backend/clinical/router.py`, `backend/admin/router.py`, `backend/orchestration/pipeline_manager.py`,
  `backend/crew/flow.py`, `backend/agents/schemas.py`, `backend/agents/report_agent.py`,
  `backend/ml_engine.py`, `backend/gate_engine.py`, `backend/stroke_cls_engine.py`, `backend/chatbot/service.py`.

Endpoint count used by app.js: **55** distinct method+path pairs (5 auth, 8 public AI/tools, 24 clinical-portal, 18 admin).

---

## 0. Global conventions

### 0.1 Server, origin, static mounts (`backend/app.py`)
- Uvicorn: `uvicorn.run(app, host="127.0.0.1", port=8000)` (app.py L555). `start_demo.py` also runs
  `uvicorn.run('backend.app:app', host='127.0.0.1', port=8000)` after seeding demo users. Base URL: `http://127.0.0.1:8000`.
- All API calls in app.js are **same-origin relative paths** (`/api/...`). No base URL constant.
- CORS: `allow_origins=["*"]`, `allow_credentials=True`, all methods/headers. (A Vite dev server on another port can call
  the API directly, but a Vite `server.proxy` for `/api` is simpler and keeps EventSource same-origin.)
- No-cache middleware: any path ending `.js/.css/.html` or `/` gets `Cache-Control: no-cache, no-store, must-revalidate, max-age=0`.
- Static mounts (order matters):
  1. `app.mount("/assets", StaticFiles(directory=PROJECT_ROOT/"assets"))` -> serves the **repo-root** `assets/` dir
     (NOT `frontend/assets`). Contents: `logo.jpg`, `logo.png`, `medical_robot_transparent.svg`,
     `robot_face_no_text.svg`, `chatbot_robot_head_lets_chat.svg`, and `icons/` (67 Lucide-style SVGs: `activity.svg`,
     `alert-triangle.svg`, `bell.svg`, `bot.svg`, `brain.svg`, `door-closed.svg`, `shield-check.svg`, `siren.svg`, ...).
  2. `@app.get("/")` -> `FileResponse(PROJECT_ROOT/"frontend"/"index.html")`.
  3. `app.mount("/", StaticFiles(directory=PROJECT_ROOT/"frontend", html=True))` -> everything else under `frontend/`.
- React-rewrite warnings:
  - Vite's default build puts hashed bundles in `dist/assets/...` -> URL `/assets/...`, which is **shadowed by the
    `/assets` mount** (repo-root assets). Either set `build.assetsDir` to something else (e.g. `static`) or change the
    backend mount. Also the backend serves `frontend/` itself, not `frontend/dist/` -> backend `FRONTEND_DIR` (app.py L20)
    must be pointed at the build output, or the build must output into `frontend/`.
  - `frontend/assets/*` is unreachable at `/assets/*` today (shadowed).
  - No SPA history fallback: unknown paths 404 (StaticFiles `html=True` only serves `index.html` for directories).
    app.js uses screen switching + optional `?screen=<id>` query param, not paths.

### 0.2 Authentication mechanism
- JWT (HS256, default expiry 1440 min = 24 h; `ACCESS_TOKEN_EXPIRE_MINUTES` env). Payload: `sub` (user UUID), `email`,
  `role`, `full_name`, `exp`.
- Storage (localStorage, no sessionStorage, **no cookies**):
  - `strokeaegis_token` -> raw JWT string (`data.access_token`).
  - `strokeaegis_user` -> `JSON.stringify(<login/register TokenResponse>)`, later overwritten with the `/api/auth/me`
    `CurrentUserResponse` (note: login shape has `user_id`, /me shape has `id`; both have `role`, `approval_status`, `is_active`).
  - Other keys: `strokeaegis_theme`, `strokeaegis_lang` (UI only).
- Sending: header `Authorization: Bearer <token>`. Helper `getAuthHeaders(includeContentType=true)` (L2249) returns
  `{Authorization, 'Content-Type': 'application/json'}`; `getAuthHeaders(false)` omits Content-Type (used for GETs).
- Backend (`auth/dependencies.py`): `OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)` **or** query
  param `?token=<jwt>`. Either works for every protected endpoint.
- Guards:
  - `get_current_user`: 401 `{"detail":"Could not validate credentials or token expired."}` (+`WWW-Authenticate: Bearer`)
    if missing/invalid/unknown user; 403 `{"detail":"Inactive user account."}` if `is_active=false`.
  - `require_doctor`: 403 if role != doctor (`"Access forbidden: Doctor role required."`), or approval_status is
    `pending` / `more_info_required` / `suspended` / `rejected` / other non-approved (each has its own `detail` text).
  - `require_patient`: 403 `"Access forbidden: Patient role required."`.
  - `require_admin`: 403 `"Access forbidden: Administrator privileges required."`.
- On 401 (`handleAuthError(res)`, L2257): removes `strokeaegis_token` + `strokeaegis_user`, `updateHeaderUserBadge(null)`,
  `showScreen('screen-landing')`, shows auth alert "Your session has expired. Please sign in again.". 403 is NOT
  handled globally (each caller just treats `!res.ok` as an error).
- Endpoints with **no auth at all**: `/api/presets`, `/api/predict-risk`, `/api/diagnose-ct`,
  `/api/clinical/start-analysis`, `/api/clinical/stream/{id}`, `/api/clinical/result/{id}`, `/api/chatbot`,
  `/api/reports/download-pdf/{f}`, `/api/auth/login`, `/api/auth/register/*`. app.js sends no Authorization on these.
- Logout: client-side only (remove both localStorage keys). There is no logout endpoint and no token revocation.

### 0.3 Error shape
- `HTTPException` -> `{"detail": "<string>"}`.
- Validation (422) is rewritten by a global handler to `{"detail": "<friendly joined string>", "errors": [<pydantic error objects>]}`.
  app.js always displays `data.detail || data.message`.

### 0.4 Common enum values (DB check constraints)
- `role`: `doctor` | `patient` | `admin`.
- `approval_status` (doctor_profile): `pending` | `approved` | `rejected` | `suspended` | `more_info_required`.
- DoctorPatient `status`: `pending` | `active` | `discharged` | `declined` | `expired`; `relationship_type`: `primary` | `care_team`;
  `initiated_by`: `doctor` | `patient`. Pending requests expire after 48 h (lazily set to `expired` on read).
- Assessment `assessment_type`: `ai_system_flow` | `regular_ml` | `regular_ct`; `gatekeeper_status`: `accepted` | `rejected` | `skipped`;
  `safety_status`: `awaiting_assignment` | `assigned` | `under_review` | `resolved`.
- Report `validation_status`: `PASSED` | `FLAGGED` | `PENDING_REVIEW`.
- Notification `notification_type`: `new_message` | `report_ready` | `assessment_ready` | `general` | `alert`.
- ML `risk_tier`: `Low` | `Moderate` | `High`. CT `prediction`: `Normal` | `Bleeding` | `Ischemia` (plus pipeline
  placeholders `Not Uploaded`, `Blocked by Gatekeeper`, `Analysis Error`).

### 0.5 Shared object shapes (referenced below)

**PatientVitals** (pydantic `PatientInput` in app.py / `PatientVitalsInput` in clinical router; all fields have defaults):
```
gender: str = "Male"            # "Male" | "Female" | "Other"
age: float = 67.0
hypertension: int = 0           # 0 | 1
heart_disease: int = 1          # 0 | 1
ever_married: str = "Yes"       # "Yes" | "No"
work_type: str = "Private"      # "Private" | "Self-employed" | "Govt_job" | ...
Residence_type: str = "Urban"   # NOTE capital R. "Urban" | "Rural"
avg_glucose_level: float = 228.69
bmi: float = 36.6
smoking_status: str = "formerly smoked"   # "never smoked" | "formerly smoked" | "smokes" | ...
```

**MLRiskResult** (`MLRiskEngine.predict`, ml_engine.py L82):
```
stroke_probability: float (0..1), stroke_probability_pct: float (0..100, 2dp), threshold: float,
prediction: int (0|1), risk_tier: "Low"|"Moderate"|"High", risk_tier_color: "#10B981"|"#F59E0B"|"#EF4444",
risk_tier_description: str,
clinical_factors: [{ factor: str, level: "High"|"Moderate", impact: str }],
recommendations: [str], patient_summary: {..}
```

**GateResult** (`GateEngine.verify`, gate_engine.py L104):
```
accepted: bool, status: "accept_brain_ct"|"reject_not_brain_ct", predicted_class: str ("brain_ct"|...),
confidence: float, confidence_pct: float, p_not_brain_ct: float, p_brain_ct: float,
p_not_brain_pct: float, p_brain_pct: float, message: str, acceptance_threshold: float
```

**CTDiagnosis** (`StrokeClsEngine.diagnose`, stroke_cls_engine.py L322). All images are **data-URL strings**
`"data:image/jpeg;base64,..."` usable directly as `<img src>`:
```
prediction: "Normal"|"Bleeding"|"Ischemia", confidence_pct: float, status_banner: str,
class_probabilities: { "Normal": float, "Bleeding": float, "Ischemia": float },   # percents
original_image: dataURL, roi_preprocessed_image: dataURL, roi_box: [int,int,int,int],
gradcam: (Bleeding/Ischemia) { use_gradcam: true, hotspot_coverage_pct: float,
            focus_centroid: { x_pct, y_pct }, anatomical_quadrant: str,
            heatmap_image: dataURL, overlay_contour_image: dataURL, full_projection_image: dataURL }
       | (Normal) { use_gradcam: false, reassurance: str }
```

**TokenResponse** (auth/schemas.py):
```
access_token: str, token_type: "bearer", user_id: str(uuid), email: str, full_name: str,
role: "doctor"|"patient"|"admin", approval_status: str|null, is_active: bool
```

**CurrentUserResponse** (auth/schemas.py):
```
id: str, email: str, full_name: str, role: str, is_active: bool, created_at: datetime(ISO),
approval_status: str|null, rejection_reason: str|null, more_info_request: str|null,
doctor_profile: null | { id, license_number, specialization, hospital_affiliation, contact_phone,
                         approval_status, rejection_reason, verification_reference, verification_notes,
                         more_info_request, reviewed_at },
patient_profile: null | { id, mrn, date_of_birth (YYYY-MM-DD|null), gender, emergency_contact }
```

---

## 1. Login flow, roles and account status

### 1.1 Routing decision (identical logic in 4 places: DOMContentLoaded L24, `performAuthLogin` L643, `/me` check L951, `returnToUserHome` L227)
```
role == "admin"   -> showAdminDashboard()
role == "doctor"  -> approval_status in ("pending","more_info_required") -> showDoctorPendingScreen(user)
                     approval_status in ("suspended","rejected") or is_active === false
                                                 -> showRestrictedAccessScreen(rejection_reason || default text)
                     else                        -> showDoctorPortal()
role == "patient" -> is_active === false -> showRestrictedAccessScreen("Patient account deactivated by administrator.")
                     else                -> showPatientPortal()
otherwise         -> showScreen('screen-home')
```
(Small inconsistencies: the `/me` startup check and `returnToUserHome` only test `pending` (not `more_info_required`)
and `suspended` (not `rejected`). Registration success only tests `pending`.)

### 1.2 Startup
1. DOMContentLoaded: if `strokeaegis_token` and stored user has `role` -> route immediately from cached user.
2. `initAuthPortal()` then calls `GET /api/auth/me` with the token. OK -> overwrite `strokeaegis_user` with /me data and
   route again. Non-OK (any status) -> clear both keys, show landing.

### 1.3 Login
- `POST /api/auth/login` -> on success store token + user, route (400 ms delay). Same endpoint for all 3 roles; the
  doctor/patient "role pill" on the form only affects sign-up fields.
- Failure codes: 401 wrong credentials; 403 deactivated user (`"Your account has been deactivated. Please contact administration."`).
  A non-approved doctor CAN log in (gets token with `approval_status`); only `require_doctor` endpoints are blocked.
- Login TokenResponse lacks `rejection_reason`/`more_info_request` -> the pending/restricted screens fall back to
  defaults until /me refreshes the stored user.
- Demo quick-login buttons (`#btn-demo-doctor`, `#btn-demo-patient`, `#btn-demo-admin`, L859-895) call the same login
  with hard-coded seeded demo accounts (`doctor@`/`patient@`/`admin@strokeaegis.local`; passwords are in app.js L868/879/892
  and `scripts/seed_demo_users.py`).

### 1.4 Registration
- Doctor: `POST /api/auth/register/doctor` (201) -> account created `is_active=true`, `approval_status="pending"`,
  audit log written. Returns TokenResponse (logged in immediately) -> pending screen.
- Patient: `POST /api/auth/register/patient` (201) -> MRN auto-generated (`MRN-YYYYMMDD-NNNN`) if not supplied.
  Returns TokenResponse WITHOUT `approval_status` (null) -> patient portal.
- Admin: **no registration endpoint**. Admins are created by `scripts/create_initial_admin.py` / seed scripts.

### 1.5 Doctor pending / more-info / restricted screens (`initNoticeScreens`, L4587)
- `#btn-check-pending-status` -> `GET /api/auth/me`; `approval_status` `approved` -> doctor portal; `more_info_required`
  -> re-render pending screen (shows `more_info_request`); `rejected`/`suspended` -> restricted screen; else alert "still under review".
- `#form-doctor-resubmit` -> `POST /api/auth/doctor/resubmit-info` (only allowed when status is `more_info_required` or
  `pending`), sets status back to `pending`, response (CurrentUserResponse) is written to `strokeaegis_user`.
- Sign-out buttons (`#btn-pending-signout`, `#btn-restricted-signout`, `#btn-header-signout`) just clear localStorage.

---

## 2. AI pipeline (SSE) flow, CT images and presets

### 2.1 Presets -> CT image transport
- `GET /api/presets` returns `ct_presets[].preview_base64` as a data URL (`data:image/png;base64,...`).
- When a preset is chosen, app.js converts it to a Blob with `fetch(preset.preview_base64).then(r => r.blob())`
  (L1112/L1139) and keeps it in `currentAIScanBlob` / `currentRegScanBlob`. User uploads keep the raw `File`.
- **All CT images are sent to the backend as binary multipart files**, field name `file`, filename always `'scan.png'`
  (`formData.append('file', blob, 'scan.png')`). Never base64 in a request body.
- Backend returns processed images as base64 JPEG **data URLs** inside JSON (see CTDiagnosis).

### 2.2 Full AI pipeline sequence (`launchFullAIPipeline` L1320, `listenToPipelineStream` L1357)
1. Collect vitals (`collectAIPatientData` L1290) -> PatientVitals + optional `patient_id`, `full_name`, `mrn` (when a
   doctor launched it for a patient, `activeTargetPatient`) + `doctor_name`/`attending_doctor` ("Dr. <name>") if the logged-in user is a doctor.
2. `POST /api/clinical/start-analysis` (multipart: `patient_json` string + optional `file`) -> `{success, pipeline_id, stream_url}`.
3. `new EventSource('/api/clinical/stream/' + pipelineId)` (no auth, no custom headers; same-origin).
   - `onmessage`: `JSON.parse(e.data)` -> `handleAgentProgressEvent(ev, es)`. Only unnamed `data:` messages are used
     (no `event:` names are emitted). Keep-alive lines are SSE comments `: ping` (sent every ~1 s idle).
   - `onerror`: close EventSource and fall back to `pollPipelineCompletion` (GET `/api/clinical/result/{id}` every 2 s,
     max 30 attempts = 60 s, then alert "timed out"). The server ends the stream after the final event, so `onerror`
     firing after completion is normal.
4. On event `{agent:"pipeline", status:"completed"}` -> `es.close()` -> `completeAIPipeline(ev.pipeline_id)` ->
   `GET /api/clinical/result/{id}` -> `renderFullAIResults(data.result)` (step 4) -> if `activeTargetPatient.id`,
   `POST /api/clinical-portal/record-assessment` (auto-persist).
5. PDF button: `<a href="/api/reports/download-pdf/${report.pdf_filename}">` (unauthenticated).

### 2.3 SSE event payload (`AgentProgressEvent`, agents/schemas.py L162)
Each message: `data: <json>\n\n` with
```
{ "pipeline_id": "sa-1a2b3c4d", "agent": str, "status": "waiting"|"working"|"completed"|"failed",
  "message": str, "data": object|null }
```
Event sequence emitted by `StrokeAegisClinicalFlow` (crew/flow.py):

| # | agent | status | data | app.js timeline id |
|---|-------|--------|------|----|
| 1 | `ml_risk` | `working` | null | `models` |
| 2 | `ml_risk` | `completed` | `{risk_tier, probability}` | `models` |
| - | `ml_risk` | `failed` (fallback result used, flow continues) | null | `models` |
| 3 | `ct_gate` | `working` | null (only if a file was uploaded) | `models` |
| 4 | `ct_gate` | `completed` | full GateResult | `models` |
| - | `ct_gate` | `failed` (gate rejected; flow continues, diagnosis = "Blocked by Gatekeeper") | full GateResult | `models` |
| 5 | `ct_classifier` | `working` | null | `models` |
| 6 | `ct_classifier` | `completed` | `{prediction, confidence}` | `models` |
| - | `ct_classifier` | `failed` | null | `models` |
| 7 | `prevention` | `working` -> `completed`/`failed` | null | `prevention` |
| 8 | `emergency` | `working` -> `completed`/`failed` | null | `emergency` (runs in parallel with prevention) |
| 9 | `validation` | `working` -> `completed` (`data:{status, safety_check}`) / `failed` | | `validation` |
| 10 | `report` | `working` -> `completed` / `failed` | null | `report` |
| 11 | `pipeline` | `completed` | null | triggers completion |
| - | `pipeline` | `failed` (thread exception; `message: "Pipeline error: ..."`) | null | not handled explicitly -> stream ends -> onerror -> polling |

If no CT file was sent, the ct_gate/ct_classifier events are skipped. If the report agent fails, no `pipeline` event is
emitted; the stream closes when `is_done` and app.js falls back to polling. Unknown pipeline id -> single message
`data: {"error":"Pipeline not found"}` then close.

---

## 3. Endpoint reference

Format per endpoint: **Method Path** / Auth / Request / Response / Caller.
"Bearer" = `Authorization: Bearer <strokeaegis_token>`; "401->logout" = response passed through `handleAuthError`.

### A. Auth (`/api/auth`, backend/auth/router.py)

#### A1. POST `/api/auth/login`
- Auth: none. Content-Type `application/json`.
- Body (`UserLoginInput`): `email: str` (regex `^[^@\s]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-.]+)*$`, lowercased/trimmed), `password: str`.
- 200 TokenResponse. Example:
  `{"access_token":"eyJ...","token_type":"bearer","user_id":"6f1c...","email":"doctor@strokeaegis.local","full_name":"Dr. Sarah Al-Mansoor","role":"doctor","approval_status":"approved","is_active":true}`
- Errors: 401 `"Incorrect email or password."`, 403 deactivated, 422.
- Caller: `performAuthLogin(email,password)` L611 -> stores token/user, routes by role (section 1.1).

#### A2. POST `/api/auth/register/doctor`
- Auth: none. JSON. Status 201.
- Body (`DoctorRegisterInput`): `email: str` (required), `password: str` (min 6), `full_name: str` (2-150),
  `license_number: str` (2-100, unique), `specialization: str|null` (default "Stroke Neurology", max 150),
  `hospital_affiliation: str|null` (max 200), `contact_phone: str|null` (max 50).
  app.js sends: `{email, password, full_name, license_number, specialization, hospital_affiliation}` (no contact_phone).
- 201 TokenResponse with `approval_status:"pending"`, `is_active:true`.
- Errors: 400 `"An account with this email already exists."` / `"A doctor with this license number already exists."`, 422, 500.
- Caller: `#auth-portal-form` submit (signup + doctor pill) L768 -> stores session -> `showDoctorPendingScreen`.

#### A3. POST `/api/auth/register/patient`
- Auth: none. JSON. Status 201.
- Body (`PatientRegisterInput`): `email`, `password` (min 6), `full_name` (2-150), `date_of_birth: date|null`
  (accepts `YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`; invalid -> null), `gender: str|null` ("Male"/"Female"/"Other",
  capitalized; else null), `emergency_contact: str|null` (max 100), `mrn: str|null` (max 50, unique; auto if omitted).
  app.js sends: `{email, password, full_name, date_of_birth, gender, emergency_contact}`.
- 201 TokenResponse (`approval_status: null`).
- Errors: 400 duplicate email / duplicate MRN, 422, 500.
- Caller: `#auth-portal-form` submit (signup + patient pill) L789 -> `showPatientPortal`.

#### A4. GET `/api/auth/me`
- Auth: Bearer (sent manually, not via getAuthHeaders). Not routed through handleAuthError: startup check clears
  session on any non-OK; pending-check ignores non-OK.
- 200 CurrentUserResponse. Example (pending doctor):
  `{"id":"6f1c...","email":"new.doc@x.com","full_name":"Dr. A","role":"doctor","is_active":true,"created_at":"2026-11-09T17:35:00","approval_status":"more_info_required","rejection_reason":null,"more_info_request":"Upload board certificate","doctor_profile":{"id":"9a2e...","license_number":"MD-1","specialization":"Stroke Neurology","hospital_affiliation":null,"contact_phone":null,"approval_status":"more_info_required","rejection_reason":null,"verification_reference":null,"verification_notes":"...","more_info_request":"Upload board certificate","reviewed_at":"2026-11-09T18:00:00+00:00"},"patient_profile":null}`
- Callers: `initAuthPortal` L944 (session restore), `initNoticeScreens` `#btn-check-pending-status` L4598.

#### A5. POST `/api/auth/doctor/resubmit-info`
- Auth: Bearer (`getAuthHeaders(true)`), 401->logout. Any doctor role (uses `get_current_user`, not `require_doctor`).
- Body (`DoctorResubmitInfoInput`): `clarification_notes: str` (required, min 5), `license_number: str|null` (2-100),
  `specialization: str|null`, `hospital_affiliation: str|null`, `contact_phone: str|null`.
  app.js sends `{clarification_notes}` plus `license_number` / `hospital_affiliation` only when non-empty.
- 200 CurrentUserResponse (status now `pending`).
- Errors: 403 non-doctor, 400 `"Cannot resubmit credentials while account status is '<status>'."` / duplicate license.
- Caller: `#form-doctor-resubmit` submit L4655 -> saves to `strokeaegis_user`, re-renders pending screen.

### B. Public AI / tools (`backend/app.py`, no auth)

#### B1. GET `/api/presets`
- 200:
```
{ "ct_presets": [ { "id": "bleeding"|"ischemia"|"normal"|"non_brain", "name": str, "filename": str,
                    "expected_gate": "accept"|"reject", "expected_diagnosis": str, "description": str,
                    "preview_base64": "data:image/png;base64,..." } ],      # only presets whose file exists in sample_scans/
  "patient_presets": [ { "id": "high_risk"|"moderate_risk"|"low_risk", "name": str, "data": PatientVitals } ] }
```
- Caller: `initPresets()` L989 -> CT preset buttons in AI step 2 (`#ai-ct-presets-container`) and regular CT
  (`#reg-ct-presets-container`); patient preset pills index 0/1/2 = high/mod/low fill AI and regular forms.

#### B2. POST `/api/predict-risk`
- Body JSON PatientVitals. app.js sends `{gender, age, hypertension, heart_disease, avg_glucose_level, bmi, smoking_status, ever_married:"Yes", work_type:"Private", Residence_type:"Urban"}` (last three hard-coded).
- 200 `{"success": true, "data": MLRiskResult}`; 500 `{"detail":"ML Risk prediction error: ..."}`.
- Example: `{"success":true,"data":{"stroke_probability":0.71,"stroke_probability_pct":71.0,"risk_tier":"High","risk_tier_description":"...","clinical_factors":[{"factor":"Chronic Hypertension","level":"High","impact":"..."}],...}}`
- Caller: `#reg-risk-form` submit in `initRegularSystem` L1813 -> `renderRegRiskResult(out.data)` (gauge %, tier pill, factor chips).

#### B3. POST `/api/diagnose-ct`
- Body: `multipart/form-data`, field `file` (UploadFile, required). app.js: `formData.append('file', blob, 'scan.png')`, no explicit Content-Type header.
- 200 accepted: `{"success": true, "gate_passed": true, "gate_details": GateResult, "diagnosis": CTDiagnosis}`
- 200 rejected: `{"success": false, "gate_passed": false, "gate_details": GateResult, "message": str}`
- 500 `{"detail":"Diagnostic neuroimaging pipeline error: ..."}`.
- Caller: `runRegCTAnalysis(fileBlob)` L1943 (auto-run on upload/preset) -> gate strip, prediction/confidence/quadrant, viewer (`original_image`, `roi_preprocessed_image`, `gradcam.heatmap_image`, `gradcam.overlay_contour_image`).

#### B4. POST `/api/clinical/start-analysis`
- Body: `multipart/form-data`: `patient_json: str` (Form, required; JSON-encoded PatientVitals + optional `patient_id`,
  `full_name`, `mrn`, `doctor_name`, `attending_doctor`), `file: UploadFile` (optional, filename `scan.png`).
- 200 `{"success": true, "pipeline_id": "sa-1a2b3c4d", "stream_url": "/api/clinical/stream/sa-1a2b3c4d"}`; 500 `{"detail":"Pipeline start error: ..."}`.
- Caller: `launchFullAIPipeline(patientData)` L1334 (AI wizard step 2 "Launch" -> step 3). Uses `pipeline_id`, ignores `stream_url`.

#### B5. GET `/api/clinical/stream/{pipeline_id}` (SSE)
- `text/event-stream`, headers `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`. See section 2.3.
- Events are replayed from the start to every new subscriber.
- Caller: `listenToPipelineStream` L1358 via `new EventSource(...)` -> `handleAgentProgressEvent` drives robot speech
  bubble (`#speech-agent-tag`, `#speech-message`, `#speech-sub`) and timeline (`#ag-step-{models|prevention|emergency|validation|report}`).

#### B6. GET `/api/clinical/result/{pipeline_id}`
- 200:
```
{ "pipeline_id": str, "is_done": bool, "error": str|null,
  "result": MedicalReport | {} | {"error": str} | null,   # null until done; {} if flow ended without report
  "events_count": int, "events": [AgentProgressEvent] }
```
  **MedicalReport** (`MedicalReportResult.model_dump()` + extras):
```
report_id: "SA-2026-ABC123", generated_at: "November 09, 2026 - 18:35:12 UTC",
patient: <patient_json as sent>, risk_assessment: MLRiskResult,
ct_analysis: { gate: GateResult|{accepted:false,predicted_class:"not_provided",confidence_pct:0,message}, diagnosis: CTDiagnosis|placeholder },
prevention_support: { risk_interpretation, patient_risk_summary, lifestyle_recommendations[], blood_pressure_guidance,
                      glycemic_guidance, lipid_and_antiplatelet_guidance, evidence_citations[], warnings[], requires_clinician_review },
emergency_support:  { acute_clinical_summary, detected_stroke_type, hyperacute_management[], thrombolysis_eligibility_considerations,
                      mechanical_thrombectomy_considerations, blood_pressure_management, monitoring_and_neurosurgical_actions[],
                      contraindication_flags[], evidence_citations[], requires_clinician_review },
validation: { status: "PASSED"|"PASSED_WITH_WARNINGS"|"FAILED", safety_check: "PASSED"|"FAILED", contradictions_detected[],
              logical_consistency_checks[], citation_audit[], non_autonomy_verified, critical_issues[], warnings[], clinician_signoff_required },
overall_clinical_summary: str, key_recommendations: [str], guideline_references: [str], clinical_disclaimer: str,
pdf_filename: "SA-2026-ABC123.pdf"|null, pdf_path: str|null,
attending_doctor?: str, doctor_name?: str     # only if sent in patient_json
```
- 404 `{"detail":"Pipeline not found"}` (pipelines are in-memory; lost on server restart).
- Callers: `pollPipelineCompletion` L1436 (checks `is_done`), `completeAIPipeline` L1477 (`data.result` -> `renderFullAIResults`).

#### B7. GET `/api/reports/download-pdf/{filename_or_id}`
- No auth. Appends `.pdf` if missing; serves `backend/generated_reports/<name>` as `application/pdf` attachment. 404 if absent.
- Caller: not fetched; set as `#btn-download-pdf` `href` in `renderFullAIResults` L1710.

#### B8. POST `/api/chatbot`
- Body JSON (`ChatbotRequest`): `message: str` (required, non-blank else 400 `"Message cannot be empty."`),
  `conversation_id: str|null`.
- 200 `{"success": true, "answer": str, "sources": [Source], "in_scope": bool, "is_emergency": bool, "conversation_id": str}`
  where `Source = { source: str, guideline: str, section: str, year: int|null, page: int|null, citation: str }`.
  `conversation_id` is a server-generated uuid4 on first call; memory is an in-process dict keyed by it (lost on restart).
  Arabic/English auto-detected per message.
- Example: `{"success":true,"answer":"Call emergency services now...","sources":[{"source":"AHA/ASA","guideline":"Guidelines for the Early Management of Acute Ischemic Stroke","section":"Emergency Medical Services and Systems of Care","year":2019,"page":12,"citation":"AHA/ASA Acute Ischemic Stroke Guidelines, Section: Prehospital Care & FAST"}],"in_scope":true,"is_emergency":true,"conversation_id":"3f9b..."}`
- Caller: chatbot form submit in `initChatbot` L2119. Keeps `chatbotConversationId` (module variable, not persisted)
  and sends it back each turn; renders `answer`, sources list (`s.citation || "${s.source} ${s.guideline} (${s.year})"`),
  red emergency bubble when `is_emergency`. No auth header sent.

### C. Clinical portal (`/api/clinical-portal`, backend/clinical/router.py)
All: Bearer via `getAuthHeaders(false)` for GET, `getAuthHeaders(true)` for POST; 401->logout unless noted.

#### C1. GET `/doctor/stats` (require_doctor)
- 200 `{doctor_name: str, specialization: str, hospital: str|null, license_number: str|null, total_patients: int, total_assessments: int, pending_reports: int, signed_reports: int, unread_messages: int}`
- Caller: `loadDoctorStats` L2641 -> welcome header, stat tiles, badges `#doc-badge-pending-reports`, `#doc-badge-unread-msgs`.

#### C2. GET `/doctor/patients` (require_doctor)
- 200 `{"patients": [ { id, full_name, email, mrn, gender, date_of_birth: str|null, emergency_contact, status: "active", relationship_type: "primary"|"care_team", associated_since: ISO, total_assessments: int, total_reports: int, latest_assessment: null | { id, type, ml_risk_tier, ml_risk_probability: float|null (0..1), ct_diagnosis, created_at }, conversation_id: str|null } ]}`
- Side effect: auto-creates missing conversations.
- Caller: `loadDoctorPatients` L2687 (calls `loadDoctorRequests` first) -> `#tbody-doc-patients` table, `cachedDoctorPatients`.

#### C3. GET `/doctor/requests` (require_doctor)
- 200 `{"incoming": [Req], "outgoing": [Req]}`, `Req = { id, patient_id, patient_name, patient_email, patient_mrn, relationship_type, status, initiated_by, created_at, expires_at }`.
- Caller: `loadDoctorRequests` L3909 -> incoming (accept/decline buttons) and outgoing invitations lists.

#### C4. POST `/doctor/patients/request` (require_doctor)
- Body JSON (`DoctorPatientRequestInput`): `patient_email: str|null` or `email: str|null` (either; app.js sends `{email}`).
- 200 `{success: true, relationship_id: str, target_role: "primary"|"care_team", patient_name: str, message: str}`
- Errors: 400 empty email / already active / already pending; 404 `"No registered patient found with email '...'. Please ask the patient to register for StrokeAegis first."`.
- Caller: `handleInvitePatientSubmit` L4003 (invite-patient modal).

#### C5. GET `/doctor/patients/{patient_id}/history` (require_doctor; patient_id UUID)
- 200 `{ patient: { id, full_name, email, mrn, gender, date_of_birth, emergency_contact, status }, assessments: [ { id, assessment_type, ml_risk_tier, ml_risk_probability, ct_diagnosis, ct_confidence (0..1), gatekeeper_status, patient_vitals: object, agent_findings: object, has_report: bool, report_id: str|null, created_at } ], reports: [ { id, assessment_id, pdf_filename, validation_status, physician_signed_off: bool, report_summary: {summary, recommendations[]}, created_at } ] }`
- 403 if no active relationship.
- Caller: `openPatientHistoryModal` L2972 -> history modal with per-report "Download PDF" (C24).

#### C6. GET `/doctor/reports` (require_doctor)
- 200 `{"reports": [ { id, assessment_id, pdf_filename, validation_status, physician_signed_off, created_at, patient_name, patient_mrn, assessment_type, ct_diagnosis, ml_risk_tier, ml_risk_probability, report_summary } ]}`
- Caller: `loadDoctorReports` L3058 -> reports pane, sign-off buttons, download links.

#### C7. POST `/doctor/reports/{report_id}/sign-off` (require_doctor)
- No body (Content-Type JSON header sent, empty body).
- 200 `{success: true, message: str, report_id: str, physician_signed_off: true, signed_by: str, signed_at: ISO}`
- Errors: 404, 403 (no active relationship). Regenerates the PDF with signer name (errors there are swallowed).
- Caller: `handleDoctorSignOff` L3121 -> refresh reports/stats.

#### C8. GET `/patient/overview` (require_patient)
- 200
```
{ patient: { id, full_name, email, mrn, gender, date_of_birth, emergency_contact },
  doctor: null | { doctor_id, full_name, email, specialization, hospital, phone, relationship_type },
  conversation_id: str|null,
  stats: { total_assessments, total_reports, care_team_count, pending_requests_count, unread_notifications, unread_messages },
  latest_assessment: null | { id, type, ml_risk_tier, ml_risk_probability, ct_diagnosis, created_at },
  latest_signed_report: null | { id, pdf_filename, created_at } }
```
- Caller: `loadPatientOverview` L3375 -> patient dashboard header, supervising-doctor card, stat tiles.

#### C9. POST `/patient/quick-risk` (require_patient)
- Body JSON PatientVitals. app.js sends `{age, gender, hypertension, heart_disease, avg_glucose_level, bmi, smoking_status, ever_married, Residence_type}` (no `work_type` -> default "Private").
- 200 `{success: true, assessment_id: str, result: MLRiskResult + { probability_pct, tier_color, tier_desc, risk_factors } }`
  (aliases: `probability_pct`=`stroke_probability_pct`, `tier_color`=`risk_tier_color`, `tier_desc`=`risk_tier_description`, `risk_factors`=`clinical_factors`).
- Side effects: persists a `regular_ml` assessment; notifies linked doctor.
- Caller: `handlePatientSelfCheck` L3480 (enforces >=850 ms spinner) -> self-check result card (reads `ml.probability_pct`, `ml.stroke_probability`, `ml.risk_tier`, `ml.risk_tier_description`/`tier_desc`, `ml.clinical_factors`/`risk_factors`).

#### C10. GET `/patient/assessments` (require_patient)
- 200 `{"assessments": [ { id, assessment_type, ml_risk_tier, ml_risk_probability, ct_diagnosis, ct_confidence, gatekeeper_status, patient_vitals, has_report, report_id, is_signed_off: bool, created_at } ]}`
- Caller: `loadPatientAssessments` L3592 -> assessment history list.

#### C11. GET `/patient/reports` (require_patient)
- 200 `{"reports": [ { id, assessment_id, pdf_filename, validation_status, physician_signed_off, doctor_name, assessment_type, ct_diagnosis, ml_risk_tier, created_at, download_url: "/api/clinical-portal/reports/<id>/download" } ]}`
- Caller: `loadPatientReports` L3643 -> report cards with download button (C24).

#### C12. GET `/patient/care-team` (require_patient)
- 200 `{ primary_doctor: Doc|null, care_team: [Doc], incoming_requests: [Doc], outgoing_requests: [Doc] }`,
  `Doc = { doctor_id, relationship_id, full_name, email, specialization, hospital, phone, relationship_type, status, initiated_by, created_at, expires_at, conversation_id }`.
- Caller: `loadPatientCareTeam` L4042 -> care-team pane (primary card, team list, incoming accept/decline, outgoing countdown).

#### C13. GET `/patient/search-doctors` (require_patient)
- No query params (no server-side search; app.js filters client-side if at all).
- 200 `{"doctors": [ { doctor_id, full_name, email, specialization, hospital, phone, status_label: "available"|"primary"|"care_team"|"pending"|"declined"|"expired", relationship: null | { id, status, relationship_type, initiated_by, expires_at } } ]}`
  (lists all active `role=doctor` users, including non-approved ones).
- Caller: `loadAvailableDoctors` L4238 -> "find a doctor" directory with request buttons.

#### C14. POST `/patient/request-doctor` (require_patient)
- Body JSON (`PatientDoctorRequestInput`): `doctor_id: UUID` (required). app.js: `{doctor_id: doctorId}`.
- 200 `{success: true, relationship_id, target_role: "primary"|"care_team", message}`; 404 doctor not found; 400 already connected/pending.
- Caller: `handlePatientRequestDoctor` L4315 (reads JSON regardless of status, shows `data.detail` on error).

#### C15. POST `/relationships/{relationship_id}/accept` (get_current_user; doctor or patient)
- No body. Only the invited party may accept (403 otherwise). 400 if expired.
- 200 `{success: true, message, relationship_type: "primary"|"care_team", conversation_id: str}` or, if already active, `{success: true, message: "Connection is already active."}`.
- Caller: `acceptConnectionRequest` L4352 -> refreshes doctor or patient views based on stored user role.

#### C16. POST `/relationships/{relationship_id}/decline` (get_current_user)
- No body. 200 `{success: true, message: "Connection request declined."}`; 403/404.
- Caller: `declineConnectionRequest` L4387.

#### C17. GET `/conversations` (get_current_user)
- 200 `{"conversations": [ { id, counterparty: { id, full_name, role, email, mrn: str|null, specialization: str|null }, last_message: null | { content, sender_id, is_mine: bool, created_at }, unread_count: int, updated_at } ]}` (only conversations with an active relationship).
- Callers: `loadDoctorConversations` L3153 (doctor chat sidebar), `loadPatientConversation` L3698 (patient chat).

#### C18. GET `/conversations/{conversation_id}/messages` (get_current_user)
- 200 `{ conversation_id, counterparty: { id, full_name, role }, messages: [ { id, sender_id, is_mine: bool, content, is_read: bool, created_at } ] }` (ascending). Side effect: marks incoming messages read.
- 403 not participant / no active relationship; 404.
- Callers: `openDoctorConversation` L3222 (401->logout), `refreshDoctorMessages` L3258 and `loadPatientMessagesForConvo` L3798 (both silent on errors; polled every 4 s while the chat pane is active).

#### C19. POST `/conversations/{conversation_id}/messages` (get_current_user)
- Body JSON (`SendMessageInput`): `content: str` (1-5000). app.js: `{content: text}`.
- 200 `{success: true, message: { id, sender_id, is_mine: true, content, created_at }}`; 403/404.
- Callers: `sendDoctorChatMessage` L3304, `sendPatientChatMessage` L3857.

#### C20. POST `/record-assessment` (require_doctor)
- Body JSON (`RecordAssessmentInput`): `patient_id: UUID` (required), `assessment_type: "ai_system_flow"|"regular_ml"|"regular_ct"` (required),
  `patient_vitals: object|null`, `ct_scan_path: str|null`, `gatekeeper_status: str|null`, `ct_diagnosis: str|null`,
  `ct_confidence: float|null` (0..1), `ml_risk_probability: float|null` (0..1), `ml_risk_tier: str|null`,
  `agent_findings: object|null`, `pdf_filename: str|null` (creates a Report only if set), `report_summary: object|null`,
  `validation_status: str|null` (default "PASSED"), `physician_signed_off: bool` (default false).
- 200 `{success: true, assessment_id: str, report_id: str|null, message: "Assessment recorded in clinical database."}`; 404/403.
- Caller: `autoPersistPipelineAssessment(patientId, report)` L1723 after AI pipeline completes for `activeTargetPatient`.
  Sends `assessment_type:'ai_system_flow'`, `gatekeeper_status: gate.accepted?'accepted':'rejected'`, `ct_confidence: diag.confidence_pct/100`,
  `report_summary: {summary: overall_clinical_summary, recommendations: key_recommendations}`, `validation_status:'PASSED'`, `physician_signed_off:false`.
  **Legacy bugs to fix, not copy**: it reads `report.ml_risk` (should be `report.risk_assessment`) so `ml_risk_probability`
  is always null and `ml_risk_tier` always `'Low'`; `report.patient_vitals` (should be `report.patient`) so vitals are `{}`;
  `report.validation_support` (should be `report.validation`). Errors are silently ignored (no handleAuthError).

#### C21. GET `/notifications` (get_current_user)
- Query: `unread_only: bool = false` (app.js never sends it). Returns latest 50.
- 200 `{ notifications: [ { id, title, message, notification_type, reference_id: str|null, is_read, created_at } ], unread_count: int }`
- Caller: `loadNotifications` L4424 (also every 4 s via `setInterval` when a token exists) -> bell badge + dropdown.

#### C22. POST `/notifications/{notification_id}/read` (get_current_user)
- No body. 200 `{success: true, message: "Notification marked as read."}`; 404.
- Caller: `markNotificationRead` L4507.

#### C23. POST `/notifications/read-all` (get_current_user)
- No body. 200 `{success: true, message: "All notifications marked as read."}`.
- Caller: `markAllNotificationsRead` L4520.

#### C24. GET `/reports/{report_id}/download` (get_current_user_optional)
- Auth optional: Bearer header and/or `?token=<jwt>`. If authenticated, patient must own the report, doctor must have an
  active relationship (403 otherwise). **Unauthenticated requests are served without checks.**
- Response: `application/pdf` attachment (`Content-Disposition: attachment; filename="<pdf_filename>"`). PDF is regenerated
  on every request with current doctor/sign-off info. 404 if report missing.
- Caller: `downloadClinicalReport(reportId, filename)` L2276: `fetch(url + '?token=' + token, {headers: {Authorization}})`
  -> blob -> object URL -> hidden `<a download>`; on non-OK falls back to opening the direct `?token=` URL. Also used as
  `href` (with `?token=`) on history/report/patient-report "Download PDF" anchors (L3027, L3104, L3680).
- Note: if PDF regeneration throws, the handler calls an undefined `logger` (no logger in clinical/router.py) -> 500.

### D. Admin (`/api/admin`, backend/admin/router.py, all `require_admin`)
All calls use `getAuthHeaders(true)` (Content-Type JSON even on GET) and 401->logout.

#### D1. GET `/overview`
- 200 (top-level keys used by app.js):
```
{ active_doctors, pending_clinicians, registered_patients, total_assessments, assessments_today,
  reports_awaiting_signoff, safety_flags, gate_rejections, open_incidents: int,
  volume_breakdown: { total_assessments, ct_scans_total, high_risk_count, high_risk_rate_pct, ischemic_count, hemorrhagic_count, normal_count },
  subsystem_health: [ { service_name, details, status: "HEALTHY"|"DEGRADED" } ],
  attention_alerts: [ { title, message, action_tab: "admin-pane-clinicians"|"admin-pane-safety"|"admin-pane-health" } ],
  recent_events: [ { id, created_at, actor, action, target, outcome, reason } ],
  last_updated: ISO,
  kpis: {...same counters, "flagged_assessments"}, trends: { volume_by_type: {type: count}, volume_breakdown }, recent_activity: [...] }
```
- Caller: `loadAdminOverview` L4773 -> KPI tiles, volume chart, subsystem list, attention alerts, recent events.

#### D2. GET `/clinicians`
- Query: `status` (alias of `status_filter`, default `all`; `pending` matches `pending`+`more_info_required`; others exact:
  `more_info_required`, `approved`, `suspended`, `rejected`), `search` (name/email/license/specialization/hospital).
  app.js sets `status` only when != 'all', `search` only when non-empty.
- 200 **bare array** `[ { id (doctor_profile id), user_id, full_name, email, is_active, license_number, specialization, hospital_affiliation ("Not Specified" if null), contact_phone ("N/A"), approval_status, rejection_reason, verification_reference, verification_notes, more_info_request, created_at, reviewed_at, reviewed_by_name } ]`
- Caller: `loadAdminClinicians(filter, search)` L4973 -> clinicians table; filter pills `#admin-clinicians-status-filters [data-status]`, search debounced 300 ms.

#### D3. POST `/clinicians/{profile_id}/approve`  (profile_id = doctor_profile `id`, not user id)
- Body JSON optional (`ClinicianApproveInput`): `verification_reference: str|null` (max 100), `verification_notes: str|null`.
  app.js requires reference length >= 2 client-side and sends `{verification_reference, verification_notes}`.
- 200 `{status: "success", message}`; 404.
- Caller: approve modal submit in `initAdminDashboard` L5990 (`pendingApproveClinician.id`).

#### D4. POST `/clinicians/{profile_id}/reject`
- Body (`ClinicianDecisionInput`): `reason: str|null` (server requires >= 5 chars after trim, else 400), `notes: str|null`. app.js: `{reason}`.
- 200 `{status: "success", message}`.
- Caller: reason modal (`openReasonModal(doc.id,'reject')`) submit L6048.

#### D5. POST `/clinicians/{profile_id}/request-info`
- Body (`ClinicianRequestInfoInput`): `request_notes: str` (min 5). app.js maps the reason field to `{request_notes: reason}`.
- 200 `{status: "success", message}`. Sets doctor `approval_status = "more_info_required"`, `more_info_request`.
- Caller: reason modal (`'request-info'`) L6048.

#### D6. POST `/clinicians/{profile_id}/suspend`
- Body `ClinicianDecisionInput` (`reason` >= 5). app.js: `{reason}`.
- 200 `{status: "success", message}`.
- Caller: reason modal (`'suspend'`) L6048.

#### D7. GET `/safety-queue`
- Query: `filter_type` (or alias `type`): `all` | `flagged` | `rejected_gate` | `unsigned`; `page` (>=1, default 1);
  `page_size` (1-100, default 50); `search`. app.js only sends `filter_type` (when != 'all').
- 200 **bare array** `[ { assessment_id, id, patient_id, patient_name, patient_mrn, doctor_id, doctor_name, doctor_specialization, assessment_type, scan_type, gatekeeper_status, ct_diagnosis, ct_confidence, confidence_pct, ml_risk_tier, ml_risk_probability, validation_status, physician_signed_off, has_pdf, pdf_filename, alert_reason, flag_reason, priority: "HIGH"|"MEDIUM"|"NORMAL", safety_status, safety_notes, assigned_by_name, assigned_at, created_at } ]`
- Caller: `loadAdminSafetyQueue(filter)` L5148 -> safety table; pills `#admin-safety-type-filters [data-type]`.

#### D8. GET `/safety-queue/{assessment_id}`
- 200 `{ assessment_id, assessment_type, created_at, patient: { id, full_name, email, mrn, gender, dob }, assigned_doctor: { id, full_name, email, specialization, hospital_affiliation }, vitals: object, gatekeeper: { status, ct_scan_path }, ct_classifier: { diagnosis, confidence, confidence_pct }, ml_risk: { tier, probability, probability_pct }, agent_findings: object, report: { id, validation_status, physician_signed_off, pdf_filename, signed_at, sign_off_notes, report_summary }, safety_tracking: { status, notes, assigned_by_name, assigned_at }, audit_history: [ { id, action, actor_name, actor_role, outcome, reason, details, created_at } ] }`
- Caller: `openSafetyDetailsModal(assessmentId)` L5279 -> case details modal.

#### D9. GET `/qualified-clinicians`
- 200 bare array `[ { id (user id), full_name, email, specialization, hospital_affiliation, license_number, verification_reference } ]`
- Caller: `openSafetyAssignModal` L5452 -> `<select>` of doctors.

#### D10. POST `/safety-queue/{assessment_id}/assign`
- Body (`SafetyAssignInput`): `doctor_id: UUID` (required, user id), `notes: str|null`. app.js: `{doctor_id, notes}`.
- 200 `{status: "success", message, doctor_id, doctor_name}`; 400 (inactive/unapproved/already assigned), 404.
- Caller: assign modal submit L6162.

#### D11. POST `/safety-queue/{assessment_id}/investigate`
- Body (`SafetyInvestigationInput`): `notes: str` (min 3), `status: str` (`resolved` | `false_positive` | `escalated`, default resolved), `assign_to_doctor_id: UUID|null`. app.js: `{status, notes}` from `#admin-investigate-status`.
- 200 `{status: "success", message: "Investigation notes recorded successfully."}`.
- Caller: investigate modal submit L6100.

#### D12. GET `/users`
- Query: `role` (`all`|`doctor`|`patient`|`admin`), `status` (alias `status_filter`: `all`|`active`|`deactivated`), `search`. app.js sends `role` (when != all) and `search`. Max 200 rows.
- 200 bare array `[ { id, email, full_name, role, is_active, created_at, doctor_info: null | { license_number, specialization, hospital, approval_status }, patient_info: null | { mrn, gender, dob }, active_connections: int } ]`
- Caller: `loadAdminUsers(role, search)` L5536 -> users table (`#admin-users-role-filters [data-role]`).

#### D13. POST `/users/{user_id}/toggle-status`
- Body (`UserStatusToggleInput`): **`reason: str` (required, min 3)**.
- 200 `{status: "success", is_active: bool, message}`; 400 self/last-admin; 404.
- Caller: `toggleAdminUserStatus(userId, activate)` L5587. **Legacy bug**: app.js sends NO body, so the backend always
  returns 422 ("Reason: Field required"). The React version must send `{reason}`.

#### D14. GET `/models`
- 200 bare array `[ { id, model_key: "door_gatekeeper"|"stroke_classifier"|"ml_risk_model"|"clinical_agents"|..., display_name, model_version, architecture, status: "active"|"degraded"|"offline", total_inferences, failed_inferences, last_inference_at, metadata_info: object } ]`
- Caller: `loadAdminModels` L5612 -> model inventory cards.

#### D15. GET `/audit-logs`
- Query: `action`, `outcome`, `search`, `limit` (1-500, default 50), `offset` (default 0). app.js sends only `search`.
- 200 `{ total: int, offset: int, limit: int, items: [ { id, actor_id, actor_role, actor_email, action, target_resource, outcome, reason, details, client_ip, created_at } ] }` (app.js accepts array or `.items`).
- Caller: `loadAdminAuditLogs(search)` L5669 -> audit table.

#### D16. GET `/health`
- 200 `{ overall_status: "healthy"|"degraded"|"unavailable", services: { database, auth_service, ml_risk_model, ct_gatekeeper, ct_classifier, rag_service, llm_provider, pdf_engine: { name, status: "healthy"|"degraded"|"unavailable", details, latency_ms? } }, checked_at: ISO }`
- Caller: `loadAdminHealth` L5762 -> service status grid.

#### D17. GET `/incidents`
- 200 bare array (latest 50) `[ { id, service_name, incident_type, severity: "low"|"medium"|"high"|"critical", description, status: "open"|"investigating"|"resolved", resolved_at, created_at } ]`
- Caller: `loadAdminHealth` L5799 (no handleAuthError) -> incident list.

#### D18. POST `/incidents`
- Body (`IncidentCreateInput`): `service_name: str` (2-50), `incident_type: str` (2-50), `severity` (`low|medium|high|critical`, default low), `description: str` (min 5). app.js: `{service_name, severity, incident_type, description}`.
- 200 `{status: "success", incident_id: str}`.
- Caller: incident modal submit L6221.

---

## 4. Backend endpoints NOT called by app.js (relevant for UI)

| Method Path | Auth | Body / Response | Notes |
|---|---|---|---|
| GET `/api/health` | none | `{status, system, tagline, architecture, models{...}}` | system info |
| POST `/api/verify-gate` | none | multipart `file` -> `{success, data: GateResult}` | gate only |
| POST `/api/clinical/complete-analysis` | none | multipart `patient_json` + `file?` -> `{success, pipeline_id, data: MedicalReport}` | synchronous (slow) pipeline |
| POST `/api/agents/prevention` | none | JSON PatientVitals -> `{success, prevention: PreventionResult}` | |
| POST `/api/agents/emergency` | none | multipart `file` -> `{success, gate, diagnosis, emergency}` | |
| GET `/api/chatbot/health` | none | `{status, service, model, crewai, scope_guard, rag_connected}` | |
| POST `/api/clinical-portal/doctor/patients/{patient_id}/assign` | require_doctor | no body -> `{success, message}` | instant claim of a patient, bypasses request/accept |
| POST `/api/admin/incidents/{incident_id}/resolve` | require_admin | no body -> `{status, message}` | there is no "resolve" button in app.js |

Not available in the backend at all: logout / token refresh, profile update (name/phone/password), password reset,
admin registration, patient-profile edit, doctor-side "discharge patient", websocket chat (chat is 4 s polling).
Registration endpoints exist and ARE used: `/api/auth/register/doctor`, `/api/auth/register/patient` (A2, A3).

---

## 5. Quick index (55)

Auth (5): A1 POST /api/auth/login, A2 POST /api/auth/register/doctor, A3 POST /api/auth/register/patient, A4 GET /api/auth/me, A5 POST /api/auth/doctor/resubmit-info
Public (8): B1 GET /api/presets, B2 POST /api/predict-risk, B3 POST /api/diagnose-ct, B4 POST /api/clinical/start-analysis, B5 GET /api/clinical/stream/{id} (SSE), B6 GET /api/clinical/result/{id}, B7 GET /api/reports/download-pdf/{f} (href), B8 POST /api/chatbot
Clinical portal (24): C1 GET doctor/stats, C2 GET doctor/patients, C3 GET doctor/requests, C4 POST doctor/patients/request, C5 GET doctor/patients/{id}/history, C6 GET doctor/reports, C7 POST doctor/reports/{id}/sign-off, C8 GET patient/overview, C9 POST patient/quick-risk, C10 GET patient/assessments, C11 GET patient/reports, C12 GET patient/care-team, C13 GET patient/search-doctors, C14 POST patient/request-doctor, C15 POST relationships/{id}/accept, C16 POST relationships/{id}/decline, C17 GET conversations, C18 GET conversations/{id}/messages, C19 POST conversations/{id}/messages, C20 POST record-assessment, C21 GET notifications, C22 POST notifications/{id}/read, C23 POST notifications/read-all, C24 GET reports/{id}/download
Admin (18): D1 GET overview, D2 GET clinicians, D3 POST clinicians/{id}/approve, D4 /reject, D5 /request-info, D6 /suspend, D7 GET safety-queue, D8 GET safety-queue/{id}, D9 GET qualified-clinicians, D10 POST safety-queue/{id}/assign, D11 POST safety-queue/{id}/investigate, D12 GET users, D13 POST users/{id}/toggle-status, D14 GET models, D15 GET audit-logs, D16 GET health, D17 GET incidents, D18 POST incidents

## 6. Legacy defects worth not reproducing
1. D13 toggle-status sent without the required `reason` body -> always 422.
2. C20 auto-persist reads wrong report keys (`ml_risk`, `patient_vitals`, `validation_support`).
3. C24 download endpoint serves PDFs to unauthenticated callers; token is also leaked in `?token=` URLs.
4. `/api/clinical/*`, `/api/predict-risk`, `/api/diagnose-ct`, `/api/chatbot`, `/api/reports/download-pdf/*` have no auth.
5. clinical/router.py references an undefined `logger` in C7/C24 error paths -> 500 instead of graceful fallback.
6. Pipeline `pipeline/failed` SSE event is not handled in the UI; failure only surfaces via polling timeout (60 s).
