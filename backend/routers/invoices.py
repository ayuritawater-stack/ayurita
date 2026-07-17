"""GST invoice PDF for admin."""
import io
import zipfile
from datetime import datetime
from html import escape as _esc
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Path
from fastapi.responses import StreamingResponse, Response
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
import deps
from deps import db, get_current_admin, now_utc
from models import ORDER_NUMBER_REGEX, BulkOrderIds

router = APIRouter(tags=["invoices"])

BRAND = colors.HexColor("#0F4C81")
ACCENT = colors.HexColor("#10B981")
TEXT = colors.HexColor("#111827")
MUTED = colors.HexColor("#6B7280")
LINE = colors.HexColor("#E5E7EB")

DEFAULT_BUSINESS = {
    "name": "Ayurita Packaged Drinking Water",
    "tagline": "Pure Water. Trusted Quality.",
    "address": "Naulakha Path, Bishanpur, Begusarai, Bihar 851129",
    "phone": "+919973251687",
    "email": "hello@ayurita.com",
    "gstin": "",
}


async def _get_business() -> dict:
    settings = await db.settings.find_one({"id": "app-settings"}, {"_id": 0})
    if not settings:
        return DEFAULT_BUSINESS
    return {
        "name": settings.get("business_name") or DEFAULT_BUSINESS["name"],
        "tagline": settings.get("tagline") or DEFAULT_BUSINESS["tagline"],
        "address": settings.get("address") or DEFAULT_BUSINESS["address"],
        "phone": settings.get("phone") or DEFAULT_BUSINESS["phone"],
        "email": settings.get("email") or DEFAULT_BUSINESS["email"],
        "gstin": settings.get("gstin") or DEFAULT_BUSINESS["gstin"],
    }


def _rupees(n):
    try:
        n = float(n)
    except Exception:
        n = 0
    return f"Rs. {n:,.2f}"


def _build_invoice_pdf(order: dict, BUSINESS: dict) -> io.BytesIO:
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
    # Every value below can end up inside ReportLab's Paragraph markup, which parses an XML-like
    # mini-language (<font>, <br/>, <a href>, <img src>, ...). Guest-supplied fields come straight
    # from the public checkout form with no character restriction beyond length, so they must be
    # escaped before interpolation - otherwise a customer could inject markup (e.g. an <img src=
    # "http://..."/> tag, fetched server-side while building the PDF) into their own order.
    left = f"""<font color='#6B7280' size='8'>FROM</font><br/>
<b>{_esc(BUSINESS['name'])}</b><br/>
{_esc(BUSINESS['address'])}<br/>
Phone: {_esc(BUSINESS['phone'])}<br/>
Email: {_esc(BUSINESS['email'])}<br/>
GSTIN: {_esc(BUSINESS['gstin'])}"""

    guest = order.get("guest", {})
    right = f"""<font color='#6B7280' size='8'>BILL TO</font><br/>
<b>{_esc(guest.get('business_name', ''))}</b><br/>
{_esc(guest.get('contact_person', ''))}<br/>
{_esc(guest.get('address', ''))}, {_esc(guest.get('city', ''))}<br/>
Phone: {_esc(guest.get('phone', ''))}<br/>
Email: {_esc(guest.get('email', ''))}<br/>
{('GSTIN: ' + _esc(guest['gst_number'])) if guest.get('gst_number') else ''}"""

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
    # Older orders placed before the CGST/SGST split was added only have a combined gst_total -
    # fall back to halving it so those invoices still render correctly.
    gst_total = order.get("gst_total", 0) or 0
    cgst_total = order.get("cgst_total")
    sgst_total = order.get("sgst_total")
    if cgst_total is None or sgst_total is None:
        cgst_total = sgst_total = gst_total / 2
    totals_rows.append([Paragraph("CGST", total_lbl), Paragraph(_rupees(cgst_total), total_val)])
    totals_rows.append([Paragraph("SGST", total_lbl), Paragraph(_rupees(sgst_total), total_val)])
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
        story.append(Paragraph("<b>Order Notes:</b> " + _esc(str(order["guest"]["notes"])), normal))
        story.append(Spacer(1, 3 * mm))

    story.append(Paragraph(
        "This is a system-generated GST tax invoice. Goods once dispatched are subject to Ayurita's supply terms. "
        "For any queries regarding this invoice, please contact " + _esc(BUSINESS["email"]) + " or call " + _esc(BUSINESS["phone"]) + ".",
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


@router.get("/orders/{order_number}/invoice.pdf")
async def public_download_invoice(request: Request, order_number: str = Path(pattern=ORDER_NUMBER_REGEX)):
    deps.check_public_rate_limit(request, "invoice_download")
    order = await db.orders.find_one({"order_number": order_number.upper().strip()}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") != "delivered":
        raise HTTPException(status_code=403, detail="Invoice will be available for download once your order is delivered.")
    buf = _build_invoice_pdf(order, await _get_business())
    filename = f"Ayurita-Invoice-{order['order_number']}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/admin/orders/{order_id}/invoice.pdf")
async def admin_download_invoice(
    request: Request,
    token: str | None = Query(default=None, max_length=2000),
    order_id: str = Path(min_length=1, max_length=64),
):
    # Accept either Authorization: Bearer <jwt> header OR ?token= query param
    import jwt as pyjwt
    import os
    jwt_str = token
    if not jwt_str:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            jwt_str = auth_header[7:]
        elif request.cookies.get("access_token"):
            jwt_str = request.cookies.get("access_token")
    if not jwt_str:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(jwt_str, os.environ["JWT_SECRET"], algorithms=["HS256"])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=401, detail="Invalid token")
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    deps.check_authenticated_rate_limit(request, "admin_write", payload.get("sub", "unknown"))
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    buf = _build_invoice_pdf(order, await _get_business())
    filename = f"Ayurita-Invoice-{order['order_number']}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/admin/orders/bulk/invoices")
async def bulk_download_invoices(
    body: BulkOrderIds,
    request: Request,
    admin: dict = Depends(get_current_admin),
):
    deps.check_authenticated_rate_limit(request, "admin_write", admin["id"])
    business = await _get_business()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for order_id in body.order_ids:
            order = await db.orders.find_one({"id": order_id}, {"_id": 0})
            if not order:
                continue
            pdf = _build_invoice_pdf(order, business)
            zf.writestr(f"Ayurita-Invoice-{order['order_number']}.pdf", pdf.getvalue())
    buf.seek(0)
    filename = f"Ayurita-Invoices-{now_utc().strftime('%Y%m%d')}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
