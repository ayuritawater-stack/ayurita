"""Pydantic models.

Every model rejects unknown fields (`extra="forbid"`) and disables type coercion
(`strict=True`) - a request with an extra field or a wrong-typed field (e.g. a string where an
int is expected) is rejected with a 422, not silently dropped/coerced. Combined with per-field
length/range/pattern constraints below, this is validate-and-reject rather than sanitize-and-accept.
"""
import base64
import io
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from PIL import Image as PILImage

INDIAN_MOBILE_REGEX = r"^[6-9]\d{9}$"
# Business contact numbers (Settings) are stored with an optional "+" and country code, unlike
# customer/guest phones which are always bare 10-digit numbers - e.g. "+919973251687".
BUSINESS_PHONE_REGEX = r"^\+?\d{10,15}$"
SLUG_REGEX = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
ORDER_NUMBER_REGEX = r"^AYU-\d{8}-[A-Z0-9]{5}$"
INDIAN_PINCODE_REGEX = r"^\d{6}$"

_STRICT = ConfigDict(extra="forbid", strict=True)

# All "image upload" fields in this app (product images, category image, settings hero/about
# images) accept either a plain http(s) URL or a base64 data URI produced by the admin panel's
# file pickers. A stored data URI is served back verbatim inside <img> tags, so it must be proven
# to be a real image at upload time - not trusted from its declared MIME type or extension.
# 2MB image -> ~2.8MB base64, hence the field max_length used on these fields.
IMAGE_FIELD_MAX_LENGTH = 2_800_000
MAX_IMAGE_BYTES = 2 * 1024 * 1024
ALLOWED_IMAGE_MIME_TYPES = {"image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WEBP"}


def validate_image_field(value: Optional[str], field_label: str) -> Optional[str]:
    """Validates an image field's value in place and returns it unchanged if valid.

    - None/'' (field not provided) passes through untouched.
    - A plain http(s):// URL passes through untouched (nothing to decode - the image itself
      lives on whatever host serves that URL, out of this app's control either way).
    - A data: URI must declare an allow-listed image MIME type, decode as valid base64, be
      under MAX_IMAGE_BYTES once decoded, and Pillow must be able to open the decoded bytes and
      confirm they're a genuine image whose actual format matches what was declared.
    Anything else raises ValueError, which FastAPI turns into a 422 - the upload is rejected
    outright rather than stored and dealt with later.
    """
    if not value:
        return value
    if value.startswith("http://") or value.startswith("https://"):
        return value
    if not value.startswith("data:"):
        raise ValueError(f"{field_label} must be an image URL or a base64 data URI")

    try:
        header, b64_data = value.split(",", 1)
    except ValueError:
        raise ValueError(f"{field_label} is not a valid data URI")

    declared_mime = header[len("data:"):].split(";")[0].strip().lower()
    if declared_mime not in ALLOWED_IMAGE_MIME_TYPES:
        raise ValueError(f'{field_label} must be a PNG, JPEG, or WEBP image (got "{declared_mime or "unknown"}")')

    try:
        raw = base64.b64decode(b64_data, validate=True)
    except Exception:
        raise ValueError(f"{field_label} is not valid base64-encoded data")

    if len(raw) > MAX_IMAGE_BYTES:
        raise ValueError(f"{field_label} must be under 2MB")

    try:
        with PILImage.open(io.BytesIO(raw)) as probe:
            actual_format = (probe.format or "").upper()
        with PILImage.open(io.BytesIO(raw)) as probe2:
            probe2.verify()
    except Exception:
        raise ValueError(f"{field_label} content is not a valid image file")

    if actual_format != ALLOWED_IMAGE_MIME_TYPES[declared_mime]:
        raise ValueError(f"{field_label} content does not match its declared type ({declared_mime})")

    return value


class LoginRequest(BaseModel):
    model_config = _STRICT
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class ChangeEmailRequest(BaseModel):
    model_config = _STRICT
    email: EmailStr


class ChangePasswordRequest(BaseModel):
    model_config = _STRICT
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=6, max_length=100)
    confirm_password: str = Field(min_length=6, max_length=100)


class CategoryIn(BaseModel):
    model_config = _STRICT
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200, pattern=SLUG_REGEX)
    description: Optional[str] = Field(None, max_length=2000)
    image_url: Optional[str] = Field(None, max_length=IMAGE_FIELD_MAX_LENGTH)

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, v: Optional[str]) -> Optional[str]:
        return validate_image_field(v, "Category image")


class ProductIn(BaseModel):
    model_config = _STRICT
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200, pattern=SLUG_REGEX)
    category_id: str = Field(min_length=1, max_length=64)
    category_name: str = Field(min_length=1, max_length=200)
    size: str = Field(min_length=1, max_length=50)
    price: float = Field(ge=0, le=10_000_000)
    bulk_price: Optional[float] = Field(None, ge=0, le=10_000_000)
    moq: int = Field(1, ge=1, le=1_000_000)
    stock: int = Field(0, ge=0, le=10_000_000)
    unit: str = Field("bottle", min_length=1, max_length=50)
    packaging: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    images: List[str] = Field(default_factory=list, max_length=20)
    featured: bool = False
    is_active: bool = True
    gst_rate: float = Field(18.0, ge=0, le=100)
    sale_price: Optional[float] = Field(None, ge=0, le=10_000_000)
    sale_starts_at: Optional[str] = Field(None, max_length=40)
    sale_ends_at: Optional[str] = Field(None, max_length=40)
    specs: dict = Field(default_factory=dict)
    # Links this product to sibling size/variant products (e.g. "500ml"/"1L" of the same item) so
    # the product page can show a selector between them. Products sharing the same non-empty
    # variant_group are treated as variants of one another; variant_label is what's shown on the
    # selector button for this particular product.
    variant_group: Optional[str] = Field("", max_length=100)
    variant_label: Optional[str] = Field("", max_length=50)

    @field_validator("images")
    @classmethod
    def validate_images(cls, images: List[str]) -> List[str]:
        for img in images:
            validate_image_field(img, "Product image")
        return images


class CartItemIn(BaseModel):
    model_config = _STRICT
    product_id: str = Field(min_length=1, max_length=64)
    quantity: int = Field(ge=1, le=100_000)


# Delivery is Begusarai-only. The geocoding-based service-area check in services/delivery.py
# fails open when Google Maps is unavailable, so the checkout address itself must enforce the
# service area, otherwise POST /orders accepts any 6-digit pincode as long as the city/state
# text reads right.
#
# This explicit allowlist is the single authority on where we deliver - it replaced a
# `startswith("851")` prefix test, which was both too broad (851 covers pincodes outside the
# delivery area) and too narrow (848201 is served but is not an 851 code). Every consumer -
# the order/address validators below, GET /pincode/{code}/verify, and the checkout UI - reads
# this same set, so adding or dropping a serviceable pincode is a one-line change here.
SERVICE_CITY = "begusarai"
SERVICE_STATE = "bihar"
SERVICE_PINCODES = frozenset({
    "851101", "851112", "851113", "851114", "851115", "851116", "851117",
    "851118", "851126", "851127", "851128", "851129", "851130", "851131",
    "851133", "851134", "851135", "851156", "851211", "851212", "851213",
    "851214", "851215", "851216", "851217", "851218", "848201",
})


def _validate_service_area_city(v: str) -> str:
    if v.strip().lower() != SERVICE_CITY:
        raise ValueError("Delivery is available in Begusarai only")
    return v


def _validate_service_area_state(v: str) -> str:
    if v.strip().lower() != SERVICE_STATE:
        raise ValueError("Delivery is available in Begusarai, Bihar only")
    return v


def _validate_service_area_pincode(v: str) -> str:
    if v.strip() not in SERVICE_PINCODES:
        raise ValueError("Delivery is not available at this pincode")
    return v


class GuestInfo(BaseModel):
    model_config = _STRICT
    business_name: str = Field(min_length=1, max_length=200)
    contact_person: str = Field(min_length=1, max_length=200)
    phone: str = Field(pattern=INDIAN_MOBILE_REGEX)
    email: EmailStr
    address: str = Field(min_length=1, max_length=500)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    pincode: str = Field(pattern=INDIAN_PINCODE_REGEX)
    gst_number: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = Field(None, max_length=2000)
    # Exact delivery point dropped on the map at checkout. Optional - a typed address is still a
    # valid order - but when present it is what the delivery charge and the rider's directions
    # link are built from, because a typed Begusarai address usually resolves only to the street.
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)

    @field_validator("city")
    @classmethod
    def validate_city(cls, v: str) -> str:
        return _validate_service_area_city(v)

    @field_validator("state")
    @classmethod
    def validate_state(cls, v: str) -> str:
        return _validate_service_area_state(v)

    @field_validator("pincode")
    @classmethod
    def validate_pincode(cls, v: str) -> str:
        return _validate_service_area_pincode(v)


class OrderIn(BaseModel):
    model_config = _STRICT
    items: List[CartItemIn] = Field(min_length=1, max_length=200)
    guest: GuestInfo
    coupon_code: Optional[str] = Field(None, min_length=1, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    payment_method: Literal["cod", "online", "credit"] = "cod"


class BulkInquiryIn(BaseModel):
    model_config = _STRICT
    business_name: str = Field(min_length=1, max_length=200)
    contact_person: str = Field(min_length=1, max_length=200)
    phone: str = Field(pattern=INDIAN_MOBILE_REGEX)
    email: EmailStr
    product: Optional[str] = Field(None, max_length=200)
    bottle_size: Optional[str] = Field(None, max_length=50)
    quantity: Optional[int] = Field(None, ge=1, le=10_000_000)
    monthly_requirement: Optional[str] = Field(None, max_length=200)
    delivery_address: Optional[str] = Field(None, max_length=500)
    message: Optional[str] = Field(None, max_length=2000)


class ContactMessageIn(BaseModel):
    model_config = _STRICT
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: Optional[str] = Field(None, pattern=INDIAN_MOBILE_REGEX)
    subject: Optional[str] = Field(None, max_length=200)
    message: str = Field(min_length=1, max_length=2000)


class CouponIn(BaseModel):
    model_config = _STRICT
    code: str = Field(min_length=1, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    discount_type: Literal["percent", "flat"] = "percent"
    value: float = Field(gt=0, le=1_000_000)
    min_order: float = Field(0, ge=0, le=10_000_000)
    max_discount: float = Field(0, ge=0, le=10_000_000)
    usage_limit: int = Field(0, ge=0, le=1_000_000)
    is_active: bool = True
    starts_at: Optional[str] = Field(None, max_length=40)
    expires_at: Optional[str] = Field(None, max_length=40)


# Order lifecycle. "processing" was dropped because it was the one status with no approved
# WhatsApp template behind it, so setting it sent a free-form text message that Meta rejects
# outside the 24-hour customer-service window - i.e. the customer silently got nothing.
ORDER_STATUSES = Literal["placed", "confirmed", "packed", "dispatched", "delivered", "cancelled"]


class OrderStatusUpdate(BaseModel):
    model_config = _STRICT
    status: ORDER_STATUSES


class BulkStatusUpdate(BaseModel):
    model_config = _STRICT
    order_ids: List[str] = Field(min_length=1, max_length=200)
    status: ORDER_STATUSES


class BulkOrderIds(BaseModel):
    model_config = _STRICT
    order_ids: List[str] = Field(min_length=1, max_length=200)


class BulkInquiryStatusUpdate(BaseModel):
    model_config = _STRICT
    status: Literal["new", "accepted", "rejected", "completed"]
    admin_reply: Optional[str] = Field(None, max_length=2000)


class CustomerSignupIn(BaseModel):
    model_config = _STRICT
    business_name: str = Field(min_length=1, max_length=200)
    contact_person: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: str = Field(pattern=INDIAN_MOBILE_REGEX)
    password: str = Field(min_length=6, max_length=100)


class CustomerLoginIn(BaseModel):
    model_config = _STRICT
    email: EmailStr
    password: str = Field(min_length=1, max_length=100)


class CustomerProfileUpdate(BaseModel):
    model_config = _STRICT
    business_name: Optional[str] = Field(None, min_length=1, max_length=200)
    contact_person: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, pattern=INDIAN_MOBILE_REGEX)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    gst_number: Optional[str] = Field(None, max_length=20)


class StaffCreateIn(BaseModel):
    model_config = _STRICT
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    admin_role: Literal["owner", "staff"] = "staff"


class StaffRoleUpdate(BaseModel):
    model_config = _STRICT
    admin_role: Literal["owner", "staff"]


class StaffUpdateIn(BaseModel):
    model_config = _STRICT
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)


class ProductQuestionIn(BaseModel):
    model_config = _STRICT
    product_id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    question: str = Field(min_length=1, max_length=1000)


class QuestionAnswerIn(BaseModel):
    model_config = _STRICT
    answer: str = Field(min_length=1, max_length=2000)


class ReviewIn(BaseModel):
    model_config = _STRICT
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=2000)


class ReviewStatusUpdate(BaseModel):
    model_config = _STRICT
    status: Literal["pending", "approved", "rejected"]


class CreditLimitUpdate(BaseModel):
    model_config = _STRICT
    credit_limit: float = Field(ge=0, le=10_000_000)


class RecordPaymentIn(BaseModel):
    model_config = _STRICT
    amount: float = Field(gt=0, le=10_000_000)
    note: Optional[str] = Field(None, max_length=500)


class CreditRequestIn(BaseModel):
    model_config = _STRICT
    requested_amount: float = Field(gt=0, le=10_000_000)
    note: Optional[str] = Field(None, max_length=1000)


class CreditRequestResolve(BaseModel):
    model_config = _STRICT
    status: Literal["approved", "rejected"]
    approved_limit: Optional[float] = Field(None, ge=0, le=10_000_000)


class ReturnRequestIn(BaseModel):
    model_config = _STRICT
    reason: str = Field(min_length=1, max_length=2000)


class ReturnStatusUpdate(BaseModel):
    model_config = _STRICT
    status: Literal["approved", "rejected", "refunded"]
    resolution_note: Optional[str] = Field(None, max_length=2000)
    refund_amount: Optional[float] = Field(None, ge=0, le=10_000_000)


class AddressIn(BaseModel):
    model_config = _STRICT
    label: str = Field(min_length=1, max_length=50)
    address: str = Field(min_length=1, max_length=500)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    pincode: str = Field(pattern=INDIAN_PINCODE_REGEX)
    gst_number: Optional[str] = Field(None, max_length=20)
    is_default: bool = False
    # Map pin saved with the address, so a returning customer keeps their exact gate/door
    # location instead of re-dropping it at every checkout. See GuestInfo.lat above.
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)

    # Same service-area rule as GuestInfo - a saved address the shop can't deliver to would only
    # fail later at checkout, so reject it up front.
    @field_validator("city")
    @classmethod
    def validate_city(cls, v: str) -> str:
        return _validate_service_area_city(v)

    @field_validator("state")
    @classmethod
    def validate_state(cls, v: str) -> str:
        return _validate_service_area_state(v)

    @field_validator("pincode")
    @classmethod
    def validate_pincode(cls, v: str) -> str:
        return _validate_service_area_pincode(v)


class DeliveryEstimateIn(BaseModel):
    model_config = _STRICT
    address: str = Field(min_length=1, max_length=500)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field("", max_length=100)
    pincode: str = Field(pattern=INDIAN_PINCODE_REGEX)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)


class WishlistMerge(BaseModel):
    model_config = _STRICT
    product_ids: List[str] = Field(default_factory=list, max_length=500)


class CustomerPasswordChange(BaseModel):
    model_config = _STRICT
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=6, max_length=100)


class CustomerForgotPasswordIn(BaseModel):
    model_config = _STRICT
    email: EmailStr


class CustomerResetPasswordIn(BaseModel):
    model_config = _STRICT
    email: EmailStr
    otp: str = Field(pattern=r"^\d{6}$")
    new_password: str = Field(min_length=6, max_length=100)


class PaymentCreateOrderRequest(BaseModel):
    model_config = _STRICT
    order_id: str = Field(min_length=1, max_length=100)


class PaymentVerifyRequest(BaseModel):
    model_config = _STRICT
    order_id: str = Field(min_length=1, max_length=100)
    razorpay_order_id: str = Field(min_length=1, max_length=100)
    razorpay_payment_id: str = Field(min_length=1, max_length=100)
    razorpay_signature: str = Field(min_length=1, max_length=200)


class SettingsIn(BaseModel):
    model_config = _STRICT
    business_name: str = Field(min_length=1, max_length=200)
    tagline: str = Field("", max_length=300)
    address: str = Field("", max_length=500)
    phone: str = Field(pattern=BUSINESS_PHONE_REGEX)
    whatsapp: str = Field(pattern=BUSINESS_PHONE_REGEX)
    email: EmailStr
    gstin: str = Field("", max_length=20)
    business_hours: str = Field("", max_length=200)
    upi_id: str = Field("", max_length=100)
    payment_details: str = Field("", max_length=1000)
    tax_rate: float = Field(0.0, ge=0, le=100)
    shipping_flat: float = Field(0.0, ge=0, le=100_000)
    free_shipping_above: float = Field(0.0, ge=0, le=10_000_000)
    low_stock_threshold: int = Field(10, ge=0, le=100_000)
    credit_due_days: int = Field(30, ge=1, le=365)
    large_order_threshold: float = Field(20000.0, ge=0, le=100_000_000)
    return_window_days: int = Field(2, ge=0, le=90)
    credit_reminder_lead_days: int = Field(3, ge=0, le=30)
    # Distance-based delivery charge (see services/delivery.py). shop_lat/shop_lng anchor the
    # driving-distance calculation; delivery_service_city/delivery_radius_km define the
    # serviceable area (a geocoded address must resolve to this city AND fall within the radius);
    # shipping_flat above stays as the fallback used whenever the address can't be geocoded or
    # shop coordinates aren't configured yet.
    shop_lat: Optional[float] = Field(None, ge=-90, le=90)
    shop_lng: Optional[float] = Field(None, ge=-180, le=180)
    delivery_service_city: str = Field("Begusarai", max_length=100)
    delivery_radius_km: float = Field(25.0, ge=0, le=1000)
    delivery_rate_per_km: float = Field(20.0, ge=0, le=10_000)
    # Admin-uploadable storefront images (URL or base64 data URI, validated like product images):
    # hero_image replaces the hardcoded homepage hero photo, about_hero_image sits behind the
    # About page's heading banner, about_image is the "Our Story" photo on the About page.
    hero_image: Optional[str] = Field(None, max_length=IMAGE_FIELD_MAX_LENGTH)
    about_hero_image: Optional[str] = Field(None, max_length=IMAGE_FIELD_MAX_LENGTH)
    about_image: Optional[str] = Field(None, max_length=IMAGE_FIELD_MAX_LENGTH)

    @field_validator("hero_image")
    @classmethod
    def validate_hero_image(cls, v: Optional[str]) -> Optional[str]:
        return validate_image_field(v, "Hero image")

    @field_validator("about_hero_image")
    @classmethod
    def validate_about_hero_image(cls, v: Optional[str]) -> Optional[str]:
        return validate_image_field(v, "About banner image")

    @field_validator("about_image")
    @classmethod
    def validate_about_image(cls, v: Optional[str]) -> Optional[str]:
        return validate_image_field(v, "About image")
