"""GST invoice PDF for admin."""
import io
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from deps import db, get_current_admin

router = APIRouter(tags=["invoices"])

BRAND = colors.HexColor("#0F4C81")
ACCENT = colors.HexColor("#10B981")
TEXT = colors.HexColor("#111827")
MUTED = colors.HexColor("#6B7280")
LINE = colors.HexColor("#E5E7EB")

BUSINESS = {
    "name": "Ayurita Packaged Drinking Water",
    "tagline": "Pure Water. Trusted Quality.",
    "address": "Naulakha Path, Bishanpur, Begusarai, Mohan Eghu, Bihar 851129",
    "phone": "+91 99732 51687",
    "email": "hello@ayurita.com",
    "gstin": "10ABCDE1234F1Z5",  # placeholder
}


def _rupees(n):
    try:
        n = float(n)
    except Exception:
        n = 0
    return f"Rs. {n:,.2f}"


def _build_invoice_pdf(order: dict) -> io.BytesIO:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
        title=f"Invoice {order['order_number']}",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontSize=22, textColor=BRAND, fontName="Helvetica-Bold", spaceAfter=2)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8, textColor=MUTED)
    normal = ParagraphStyle("nml", parent=styles["Normal"], fontSize=9.5, textColor=TEXT, leading=13)
    label = ParagraphStyle("lbl", parent=styles["Normal"], fontSize=8, textColor=MUTED, fontName="Helvetica-Bold")
    total_lbl = ParagraphStyle("tlbl", parent=styles["Normal"], fontSize=10, textColor=TEXT, alignment=TA_RIGHT)
    total_val = ParagraphStyle("tval", parent=styles["Normal"], fontSize=10, textColor=TEXT, alignment=TA_RIGHT, fontName="Helvetica-Bold")

    story = []

    # Header
    header_data = [[
        Paragraph(BUSINESS["name"], h1),
        Paragraph(f"<b>TAX INVOICE</b><br/><font size=8 color='#6B7280'>#{order['order_number']}</font>",
                  ParagraphStyle("th", parent=styles["Normal"], alignment=TA_RIGHT, fontSize=14, textColor=TEXT)),
    ]]
    ht = Table(header_data, colWidths=[110 * mm, 60 * mm])
    ht.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(ht)
    story.append(Paragraph(BUSINESS["tagline"], small))
    story.append(Spacer(1, 4 * mm))

    # Business + invoice meta
    left = f"""<font color='#6B7280' size='8'>FROM</font><br/>
<b>{BUSINESS['name']}</b><br/>
{BUSINESS['address']}<br/>
Phone: {BUSINESS['phone']}<br/>
Email: {BUSINESS['email']}<br/>
GSTIN: {BUSINESS['gstin']}"""

    guest = order.get("guest", {})
    right = f"""<font color='#6B7280' size='8'>BILL TO</font><br/>
<b>{guest.get('business_name', '')}</b><br/>
{guest.get('contact_person', '')}<br/>
{guest.get('address', '')}, {guest.get('city', '')}<br/>
Phone: {guest.get('phone', '')}<br/>
Email: {guest.get('email', '')}<br/>
{('GSTIN: ' + guest['gst_number']) if guest.get('gst_number') else ''}"""

    meta_lines = [
        ("Invoice #", order["order_number"]),
        ("Invoice Date", _fmt_date(order.get("created_at"))),
        ("Payment", (order.get("payment_method") or "COD").upper()),
        ("Status", (order.get("status") or "").title()),
    ]
    meta_html = "<br/>".join([f"<font color='#6B7280' size='8'>{k}</font>  <b>{v}</b>" for k, v in meta_lines])

    parties = Table(
        [[Paragraph(left, normal), Paragraph(right, normal), Paragraph(meta_html, normal)]],
        colWidths=[60 * mm, 60 * mm, 55 * mm],
    )
    parties.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
    ]))
    story.append(parties)
    story.append(Spacer(1, 6 * mm))

    # Items table
    items_head = ["#", "Product", "Size", "Qty", "Unit Price", "GST %", "Line Total"]
    data = [items_head]
    for i, it in enumerate(order.get("items", []), 1):
        data.append([
            str(i),
            it.get("product_name", ""),
            it.get("size", ""),
            str(it.get("quantity", 0)),
            _rupees(it.get("unit_price", 0)),
            f"{it.get('gst_rate', 18)}%",
            _rupees(it.get("line_total", 0)),
        ])
    items = Table(data, colWidths=[10 * mm, 55 * mm, 18 * mm, 15 * mm, 26 * mm, 15 * mm, 30 * mm])
    items.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (3, 0), (3, -1), "CENTER"),
        ("ALIGN", (4, 0), (-1, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("LINEBELOW", (0, 0), (-1, 0), 0.7, BRAND),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(items)
    story.append(Spacer(1, 4 * mm))

    # Totals
    totals_rows = [
        [Paragraph("Subtotal", total_lbl), Paragraph(_rupees(order.get("subtotal", 0)), total_val)],
    ]
    if (order.get("discount") or 0) > 0:
        totals_rows.append([
            Paragraph(f"Discount ({order.get('coupon_code') or ''})", total_lbl),
            Paragraph("- " + _rupees(order.get("discount", 0)), total_val),
        ])
    totals_rows.append([Paragraph("GST", total_lbl), Paragraph(_rupees(order.get("gst_total", 0)), total_val)])
    totals_rows.append([Paragraph("Shipping", total_lbl), Paragraph(_rupees(order.get("shipping", 0)), total_val)])
    totals_rows.append([
        Paragraph("<font size='12'><b>GRAND TOTAL</b></font>", ParagraphStyle("gtl", parent=total_lbl, fontSize=12, fontName="Helvetica-Bold")),
        Paragraph(f"<font size='12' color='#0F4C81'><b>{_rupees(order.get('grand_total', 0))}</b></font>", total_val),
    ])
    tt = Table(totals_rows, colWidths=[130 * mm, 45 * mm])
    tt.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.7, BRAND),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(tt)
    story.append(Spacer(1, 8 * mm))

    # Notes / footer
    if order.get("guest", {}).get("notes"):
        story.append(Paragraph("<b>Order Notes:</b> " + str(order["guest"]["notes"]), normal))
        story.append(Spacer(1, 3 * mm))

    story.append(Paragraph(
        "This is a system-generated GST tax invoice. Goods once dispatched are subject to Ayurita's supply terms. "
        "For any queries regarding this invoice, please contact " + BUSINESS["email"] + " or call " + BUSINESS["phone"] + ".",
        small,
    ))
    story.append(Spacer(1, 6 * mm))

    thanks = ParagraphStyle("thx", parent=normal, alignment=TA_CENTER, textColor=BRAND, fontSize=11, fontName="Helvetica-Bold")
    story.append(Paragraph("Thank you for choosing Ayurita — Pure Water. Trusted Quality.", thanks))

    doc.build(story)
    buf.seek(0)
    return buf


def _fmt_date(iso_str: str) -> str:
    if not iso_str:
        return "-"
    try:
        return datetime.fromisoformat(iso_str.replace("Z", "+00:00")).strftime("%d %b %Y")
    except Exception:
        return iso_str[:10]


@router.get("/admin/orders/{order_id}/invoice.pdf")
async def admin_download_invoice(order_id: str, token: str | None = Query(default=None), admin: dict | None = None):
    # Allow either standard auth OR token query param (browser <a href download>)
    if admin is None:
        # try to read from token query
        if not token:
            raise HTTPException(status_code=401, detail="Not authenticated")
        # simple decode
        import jwt as pyjwt
        import os
        try:
            payload = pyjwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
            if payload.get("role") != "admin":
                raise HTTPException(status_code=401, detail="Invalid token")
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")

    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    buf = _build_invoice_pdf(order)
    filename = f"Ayurita-Invoice-{order['order_number']}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
