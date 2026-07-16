"""Public product catalogue PDF."""
import io
from html import escape as _esc
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from deps import db

router = APIRouter(tags=["catalogue"])

BRAND = colors.HexColor("#0F4C81")
ACCENT = colors.HexColor("#10B981")
TEXT = colors.HexColor("#111827")
MUTED = colors.HexColor("#6B7280")
LINE = colors.HexColor("#E5E7EB")


def _rupees(n):
    try:
        n = float(n)
    except Exception:
        n = 0
    return f"Rs. {n:,.0f}"


@router.get("/catalogue.pdf")
async def download_catalogue():
    products = await db.products.find({"is_active": True}, {"_id": 0}).sort("category_name", 1).to_list(500)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=15 * mm,
        title="Ayurita Product Catalogue",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=26, textColor=BRAND, alignment=TA_CENTER, fontName="Helvetica-Bold")
    tagline = ParagraphStyle("tag", parent=styles["Normal"], fontSize=10, textColor=MUTED, alignment=TA_CENTER)
    eyebrow = ParagraphStyle("eye", parent=styles["Normal"], fontSize=8, textColor=ACCENT, alignment=TA_CENTER, fontName="Helvetica-Bold")
    section_h = ParagraphStyle("sh", parent=styles["Heading2"], fontSize=14, textColor=BRAND, fontName="Helvetica-Bold", spaceBefore=8, spaceAfter=4)
    small = ParagraphStyle("sm", parent=styles["Normal"], fontSize=8.5, textColor=MUTED, leading=11)
    normal = ParagraphStyle("nm", parent=styles["Normal"], fontSize=9.5, textColor=TEXT, leading=13)

    story = []
    story.append(Paragraph("AYURITA", h1))
    story.append(Paragraph("PURE WATER · TRUSTED QUALITY", eyebrow))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Wholesale Product Catalogue", tagline))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        "Ayurita is a manufacturer and wholesale supplier of premium packaged drinking water based in Bishanpur, "
        "Begusarai. This catalogue lists our complete product range with current wholesale rates.",
        small,
    ))
    story.append(Spacer(1, 6 * mm))

    # Group by category
    grouped: dict = {}
    for p in products:
        grouped.setdefault(p.get("category_name", "Other"), []).append(p)

    for cat_name, cat_products in grouped.items():
        story.append(Paragraph(cat_name, section_h))
        head = ["Product", "Size", "MOQ", "Unit Price", "Bulk Price", "GST"]
        rows = [head]
        for p in cat_products:
            rows.append([
                Paragraph(f"<b>{_esc(p.get('name',''))}</b><br/><font size='7.5' color='#6B7280'>{_esc((p.get('description') or '')[:80])}</font>", normal),
                p.get("size", ""),
                str(p.get("moq", 1)),
                _rupees(p.get("price", 0)),
                _rupees(p.get("bulk_price") or 0) if p.get("bulk_price") else "—",
                f"{p.get('gst_rate', 18)}%",
            ])
        t = Table(rows, colWidths=[70 * mm, 18 * mm, 15 * mm, 25 * mm, 25 * mm, 15 * mm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BRAND),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("ALIGN", (3, 0), (4, -1), "RIGHT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("LINEBELOW", (0, -1), (-1, -1), 0.4, LINE),
        ]))
        story.append(t)
        story.append(Spacer(1, 4 * mm))

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph(
        "<b>How to order:</b> Call +91 99732 51687 · Email hello@ayurita.com · "
        "Or submit a bulk enquiry on our website. Delivery available across Begusarai District. "
        "All prices exclude GST. Bulk pricing kicks in on qualifying quantities.",
        small,
    ))

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="Ayurita-Product-Catalogue.pdf"'},
    )
