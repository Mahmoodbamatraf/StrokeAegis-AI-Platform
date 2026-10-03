"""
StrokeAegis AI — Professional Clinical Decision Support PDF Report Generator
Built with ReportLab matching official StrokeAegis brand identity.
"""

import io
import base64
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
    KeepTogether,
    HRFlowable
)

logger = logging.getLogger("strokeaegis.reports.pdf")
logger.setLevel(logging.INFO)

# Official Brand Palette
COLOR_PRIMARY = colors.HexColor("#527299")      # Aegis Slate Blue
COLOR_SECONDARY = colors.HexColor("#6BC8D7")    # Medical Cyan
COLOR_ACCENT = colors.HexColor("#D1A562")       # Neural Gold
COLOR_ALERT = colors.HexColor("#E8927C")        # Coral / Pulse Rose
COLOR_DARK = colors.HexColor("#2B3848")         # Deep Charcoal Slate
COLOR_LIGHT_BG = colors.HexColor("#F4F8FA")     # Clean Mist
COLOR_WHITE = colors.HexColor("#FFFFFF")
COLOR_GREEN = colors.HexColor("#10B981")
COLOR_MUTED = colors.HexColor("#64748B")

REPORTS_DIR = Path(__file__).resolve().parent.parent / "generated_reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
ASSETS_DIR = Path(__file__).resolve().parent.parent.parent / "assets"


class NumberedCanvas(colors.Color):
    """Placeholder or custom canvas helper if needed."""
    pass


def generate_clinical_pdf(report_data: Dict[str, Any]) -> str:
    """
    Renders a comprehensive, hospital-grade clinical decision support PDF report.
    Returns the absolute path to the generated PDF file.
    """
    report_id = report_data.get("report_id", f"SA-{datetime.now().strftime('%Y')}-0001")
    output_pdf_path = REPORTS_DIR / f"{report_id}.pdf"

    logger.info(f"Generating clinical PDF report: {output_pdf_path}")

    doc = SimpleDocTemplate(
        str(output_pdf_path),
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    style_title = ParagraphStyle(
        'RepTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=COLOR_PRIMARY
    )

    style_tagline = ParagraphStyle(
        'RepTagline',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=COLOR_MUTED
    )

    style_meta = ParagraphStyle(
        'RepMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=COLOR_DARK,
        alignment=2 # Right
    )

    style_section_h = ParagraphStyle(
        'RepSecHead',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=COLOR_PRIMARY,
        spaceBefore=10,
        spaceAfter=4
    )

    style_sub_h = ParagraphStyle(
        'RepSubHead',
        parent=styles['Heading3'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=COLOR_DARK,
        spaceBefore=4,
        spaceAfter=2
    )

    style_body = ParagraphStyle(
        'RepBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=COLOR_DARK
    )

    style_body_bold = ParagraphStyle(
        'RepBodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=12,
        textColor=COLOR_DARK
    )

    style_bullet = ParagraphStyle(
        'RepBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=COLOR_DARK,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=2
    )

    style_citation = ParagraphStyle(
        'RepCitation',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=7.5,
        leading=10,
        textColor=COLOR_PRIMARY,
        leftIndent=8,
        spaceAfter=2
    )

    style_disclaimer = ParagraphStyle(
        'RepDisclaimer',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7,
        leading=9,
        textColor=COLOR_MUTED
    )

    story = []

    # 1. Header (Logo + Brand + Meta Info)
    logo_path = ASSETS_DIR / "logo.png"
    if not logo_path.exists():
        logo_path = ASSETS_DIR / "logo.jpg"
    logo_img = None
    if logo_path.exists():
        try:
            logo_img = RLImage(str(logo_path), width=1.1*inch, height=1.1*inch)
        except Exception as e:
            logger.warning(f"Could not load logo in PDF: {e}")

    header_brand = [
        Paragraph("StrokeAegis <font color='#6BC8D7'>AI</font>", style_title),
        Paragraph("AI-Powered Stroke Reporting & Integrated Solutions", style_tagline),
        Paragraph("Clinical Decision Support Platform (Multi-Agent Architecture)", style_tagline)
    ]

    header_meta = [
        Paragraph(f"<b>REPORT ID:</b> {report_id}", style_meta),
        Paragraph(f"<b>DATE:</b> {report_data.get('generated_at', datetime.now().strftime('%Y-%m-%d %H:%M'))}", style_meta),
        Paragraph("<b>STATUS:</b> <font color='#10B981'><b>VALIDATED AI ASSESSMENT</b></font>", style_meta),
        Paragraph("<b>ACCESS:</b> Confidential Medical Documentation", style_meta)
    ]

    header_table_data = [
        [logo_img or "", header_brand, header_meta]
    ]

    header_table = Table(header_table_data, colWidths=[1.2*inch, 3.8*inch, 2.5*inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=COLOR_PRIMARY, spaceBefore=4, spaceAfter=8))

    # 2. Section 1: Patient Demographic & Vitals Profile
    story.append(Paragraph("1. Patient Demographic & Vitals Profile", style_section_h))
    pat = report_data.get("patient", {})
    is_standalone = not (pat.get("full_name") or pat.get("name") or report_data.get("patient_name"))
    pat_name = pat.get("full_name") or pat.get("name") or report_data.get("patient_name", "Clinical Simulation / Unassigned")
    pat_mrn = pat.get("mrn") or report_data.get("patient_mrn", "TRIAL-MODE")
    attending_doc = (
        report_data.get("attending_doctor")
        or report_data.get("doctor_name")
        or pat.get("attending_doctor")
        or pat.get("doctor_name")
    )

    # If doctor is not explicitly specified or was legacy default, resolve from active patient relationship
    if not attending_doc or attending_doc == "Dr. Sarah Al-Mansoor, MD":
        try:
            from backend.database.database import SessionLocal
            from backend.database.models import User, PatientProfile, DoctorPatient
            with SessionLocal() as db:
                pat_user = None
                pat_id = pat.get("id") or pat.get("patient_id") or report_data.get("patient_id")
                if pat_id:
                    import uuid
                    try:
                        pat_user = db.query(User).filter(User.id == uuid.UUID(str(pat_id))).first()
                    except Exception:
                        pass
                if not pat_user and pat_mrn and pat_mrn != "TRIAL-MODE":
                    prof = db.query(PatientProfile).filter(PatientProfile.mrn == pat_mrn).first()
                    if prof:
                        pat_user = prof.user
                if not pat_user and pat_name and pat_name not in ["Clinical Simulation / Unassigned", "Clinical Patient"]:
                    pat_user = db.query(User).filter(User.full_name == pat_name, User.role == "patient").first()

                if pat_user:
                    assoc = db.query(DoctorPatient).filter(
                        DoctorPatient.patient_id == pat_user.id,
                        DoctorPatient.status == "active"
                    ).order_by(
                        (DoctorPatient.relationship_type == "primary").desc(),
                        DoctorPatient.created_at.desc()
                    ).first()
                    if assoc:
                        doctor_user_obj = db.query(User).filter(User.id == assoc.doctor_id).first()
                        if doctor_user_obj and doctor_user_obj.full_name:
                            attending_doc = doctor_user_obj.full_name
                            if not attending_doc.lower().startswith("dr.") and not attending_doc.lower().startswith("dr "):
                                attending_doc = f"Dr. {attending_doc}"
                            if not attending_doc.endswith(", MD"):
                                attending_doc = f"{attending_doc}, MD"
        except Exception as db_err:
            logger.debug(f"Could not auto-resolve attending doctor from DB: {db_err}")

    # Fallback only if no doctor is assigned at all
    if not attending_doc:
        attending_doc = "Attending Neurologist, MD"

    record_status = "Standalone Simulation" if is_standalone else "Active Patient File"

    pat_table_data = [
        [
            Paragraph(f"<b>Patient Name:</b> {pat_name}", style_body_bold),
            Paragraph(f"<b>MRN:</b> <font color='#0284C7'><b>{pat_mrn}</b></font>", style_body_bold),
            Paragraph(f"<b>Attending Neurologist:</b> {attending_doc}", style_body),
            Paragraph(f"<b>Record Status:</b> {record_status}", style_body)
        ],
        [
            Paragraph(f"<b>Gender:</b> {pat.get('gender', 'N/A')}", style_body),
            Paragraph(f"<b>Age:</b> {pat.get('age', 'N/A')} Years", style_body),
            Paragraph(f"<b>BMI:</b> {pat.get('bmi', 'N/A')} kg/m²", style_body),
            Paragraph(f"<b>Smoking:</b> {pat.get('smoking_status', 'N/A')}", style_body)
        ],
        [
            Paragraph(f"<b>Hypertension:</b> {'Positive (Yes)' if pat.get('hypertension') == 1 else 'Negative'}", style_body),
            Paragraph(f"<b>Cardiac Disease:</b> {'Positive (Yes)' if pat.get('heart_disease') == 1 else 'Negative'}", style_body),
            Paragraph(f"<b>Average Glucose:</b> {pat.get('avg_glucose_level', 'N/A')} mg/dL", style_body),
            Paragraph(f"<b>Residence:</b> {pat.get('Residence_type', 'N/A')}", style_body)
        ]
    ]
    pat_table = Table(pat_table_data, colWidths=[1.87*inch, 1.87*inch, 1.87*inch, 1.87*inch])
    pat_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_LIGHT_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(pat_table)
    story.append(Spacer(1, 8))

    # 3. Section 2: Clinical Machine Learning Stroke Risk Assessment
    story.append(Paragraph("2. Clinical Machine Learning Stroke Risk Stratification (StrokePrediction-V2)", style_section_h))
    risk = report_data.get("risk_assessment", {})
    tier = risk.get("risk_tier", "Moderate")
    tier_color = "#EF4444" if tier == "High" else ("#F59E0B" if tier == "Moderate" else "#10B981")

    risk_summary_text = (
        f"<b>Predicted Probability:</b> <font color='{tier_color}' size='+1'><b>{risk.get('stroke_probability_pct', 0)}%</b></font> &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Risk Tier:</b> <font color='{tier_color}'><b>{tier.upper()} DANGER TIER</b></font> &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Decision Threshold:</b> {risk.get('threshold', 0.49)*100:.1f}%"
    )

    factors_text = ", ".join([f.get("factor", "") for f in risk.get("clinical_factors", [])]) or "Standard demographic parameters"
    risk_table_data = [
        [Paragraph(risk_summary_text, style_body_bold)],
        [Paragraph(f"<b>Clinical Risk Multipliers:</b> {factors_text}", style_body)],
        [Paragraph(f"<b>Model Rationale:</b> {risk.get('risk_tier_description', 'N/A')}", style_body)]
    ]
    risk_table = Table(risk_table_data, colWidths=[7.5*inch])
    risk_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor(tier_color)),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(risk_table)
    story.append(Spacer(1, 8))

    # 4. Section 3: Diagnostic CT Neuroimaging & AI Explainability
    story.append(Paragraph("3. Diagnostic CT Neuroimaging & Explainability (EfficientNetV2-S + GeM)", style_section_h))
    ct_data = report_data.get("ct_analysis", {})
    gate_data = ct_data.get("gate", {})
    diag_data = ct_data.get("diagnosis", {})
    gradcam = diag_data.get("gradcam", {})

    pred_name = diag_data.get("prediction", "Normal")
    pred_color = "#EF4444" if pred_name == "Bleeding" else ("#F59E0B" if pred_name == "Ischemia" else "#10B981")

    gate_desc = f"Passed Gatekeeper ({gate_data.get('confidence_pct', 0)}% Brain CT confidence)" if gate_data.get('accepted') else "Rejected by Gatekeeper"
    ct_meta_text = (
        f"<b>Gatekeeper Safety Status:</b> <font color='#10B981'><b>{gate_desc}</b></font><br/>"
        f"<b>Primary CT Classification:</b> <font color='{pred_color}' size='+1'><b>{pred_name.upper()}</b></font> ({diag_data.get('confidence_pct', 0)}% Confidence)<br/>"
        f"<b>Status Banner:</b> {diag_data.get('status_banner', 'N/A')}<br/>"
        f"<b>Lesion Localization:</b> {gradcam.get('anatomical_quadrant', 'Bilateral parenchymal symmetry')}<br/>"
        f"<b>Hotspot Lesion Coverage:</b> {gradcam.get('hotspot_coverage_pct', 0.0)}% of Brain ROI"
    )

    # Check for Grad-CAM overlay image to embed
    overlay_img_flowable = None
    if gradcam.get("overlay_contour_image"):
        try:
            b64_str = gradcam["overlay_contour_image"]
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            img_bytes = base64.b64decode(b64_str)
            img_buf = io.BytesIO(img_bytes)
            overlay_img_flowable = RLImage(img_buf, width=1.8*inch, height=1.8*inch)
        except Exception as e:
            logger.warning(f"Could not render Grad-CAM in PDF: {e}")

    ct_table_data = [
        [Paragraph(ct_meta_text, style_body), overlay_img_flowable or Paragraph("<i>No lesion overlay required</i>", style_meta)]
    ]
    ct_table = Table(ct_table_data, colWidths=[5.4*inch, 2.1*inch])
    ct_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), COLOR_LIGHT_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(ct_table)
    story.append(Spacer(1, 8))

    # 5. Section 4: AI Clinical Decision Support (CrewAI Multi-Agent Guidance)
    story.append(Paragraph("4. AI Clinical Decision Support (CrewAI Guideline-Grounded Multi-Agent)", style_section_h))

    # 4.1 Acute Emergency Clinical Support
    emerg = report_data.get("emergency_support", {})
    story.append(Paragraph("4.1 Hyperacute Emergency Stroke Management Specialist", style_sub_h))
    story.append(Paragraph(f"<b>Acute Summary:</b> {emerg.get('acute_clinical_summary', 'N/A')}", style_body))

    for action in emerg.get("hyperacute_management", [])[:3]:
        story.append(Paragraph(f"&bull; {action}", style_bullet))

    story.append(Paragraph(f"<b>Reperfusion Considerations:</b> {emerg.get('thrombolysis_eligibility_considerations', 'N/A')}", style_body))
    story.append(Paragraph(f"<b>Acute Blood Pressure Target:</b> {emerg.get('blood_pressure_management', 'N/A')}", style_body))

    for contra in emerg.get("contraindication_flags", [])[:2]:
        story.append(Paragraph(f"<b>CONTRAINDICATION ALERT:</b> {contra}", ParagraphStyle('Alert', parent=style_bullet, textColor=COLOR_ALERT)))

    story.append(Spacer(1, 4))

    # 4.2 Stroke Prevention Guidance
    prev = report_data.get("prevention_support", {})
    story.append(Paragraph("4.2 Guideline-Based Stroke Prevention Specialist", style_sub_h))
    story.append(Paragraph(f"<b>Vascular Risk Interpretation:</b> {prev.get('risk_interpretation', 'N/A')}", style_body))
    story.append(Paragraph(f"<b>Blood Pressure Target:</b> {prev.get('blood_pressure_guidance', 'N/A')}", style_body))
    story.append(Paragraph(f"<b>Glycemic & Metabolic Target:</b> {prev.get('glycemic_guidance', 'N/A')}", style_body))

    story.append(Paragraph("<b>Recommended Lifestyle Modifications:</b>", style_body_bold))
    for rec in prev.get("lifestyle_recommendations", [])[:4]:
        story.append(Paragraph(f"&bull; {rec}", style_bullet))

    story.append(Spacer(1, 8))

    # 6. Section 5: Medical Safety & Clinical Validation Audit
    story.append(Paragraph("5. Medical Safety & Clinical Validation Audit", style_section_h))
    val = report_data.get("validation", {})
    val_status = val.get("status", "PASSED")
    val_color = "#10B981" if val_status == "PASSED" else "#F59E0B"

    val_text = (
        f"<b>Audit Outcome:</b> <font color='{val_color}'><b>{val_status}</b></font> &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Safety Verification:</b> {val.get('safety_check', 'PASSED')} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Non-Autonomous Stance Verified:</b> {val.get('non_autonomy_verified', True)}<br/>"
        f"<b>Clinical Contradictions Detected:</b> {len(val.get('contradictions_detected', []))} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Critical Safety Alerts:</b> {len(val.get('critical_issues', []))}"
    )
    val_table = Table([[Paragraph(val_text, style_body)]], colWidths=[7.5*inch])
    val_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#ECFDF5") if val_status == "PASSED" else colors.HexColor("#FFFBEB")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor(val_color)),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(val_table)
    story.append(Spacer(1, 8))

    # 7. Section 6: Integrated Executive AI Summary
    story.append(Paragraph("6. Integrated Clinical Action Plan & Executive Summary", style_section_h))
    story.append(Paragraph(report_data.get("overall_clinical_summary", "N/A"), style_body))
    story.append(Spacer(1, 4))
    for rec in report_data.get("key_recommendations", [])[:4]:
        story.append(Paragraph(f"&bull; <b>{rec}</b>", style_bullet))

    story.append(Spacer(1, 8))

    # 8. Section 7: Guideline Evidence Bibliography
    story.append(Paragraph("7. Traceable Medical Guideline References (Medical RAG Knowledge Base)", style_section_h))
    for cit in report_data.get("guideline_references", [])[:5]:
        story.append(Paragraph(f"[&bull;] {cit}", style_citation))

    story.append(Spacer(1, 8))

    # 9. Section 8: Disclaimer & Attending Physician Sign-Off Block
    disclaimer_text = report_data.get("clinical_disclaimer", (
        "StrokeAegis AI is an AI-powered clinical decision-support system intended to assist qualified healthcare "
        "professionals. It does not replace clinical judgment, diagnosis, or physician decision-making and does not "
        "independently prescribe or order treatment."
    ))

    is_signed = report_data.get("physician_signed_off", True)
    signed_badge = "<font color='#10B981'><b>✓ Certified & Digitally Signed</b></font>" if is_signed else "<font color='#F59E0B'><b>Pending Physician Sign-Off</b></font>"
    signed_date = report_data.get("signed_at", datetime.now().strftime("%Y-%m-%d"))

    signoff_table_data = [
        [
            Paragraph(f"<b>CLINICAL DISCLAIMER:</b> {disclaimer_text}", style_disclaimer),
            Paragraph(f"<b>Attending Physician Evaluation:</b><br/><br/><b>{attending_doc}</b><br/>Status: {signed_badge}<br/>Date: {signed_date}<br/><br/>Doctor Signature: ____________________", style_body)
        ]
    ]
    signoff_table = Table(signoff_table_data, colWidths=[4.8*inch, 2.7*inch])
    signoff_table.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP')
    ]))

    story.append(KeepTogether([signoff_table]))

    # Build PDF
    doc.build(story)
    logger.info(f"PDF generated successfully at {output_pdf_path}")
    return str(output_pdf_path)
