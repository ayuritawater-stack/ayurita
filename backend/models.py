"""Pydantic models.

Every model rejects unknown fields (`extra="forbid"`) and disables type coercion
(`strict=True`) - a request with an extra field or a wrong-typed field (e.g. a string where an
int is expected) is rejected with a 422, not silently dropped/coerced. Combined with per-field
length/range/pattern constraints below, this is validate-and-reject rather than sanitize-and-accept.
"""
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

INDIAN_MOBILE_REGEX = r"^[6-9]\d{9}$"
# Business contact numbers (Settings) are stored with an optional "+" and country code, unlike
# customer/guest phones which are always bare 10-digit numbers - e.g. "+919973251687".
BUSINESS_PHONE_REGEX = r"^\+?\d{10,15}$"
SLUG_REGEX = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
ORDER_NUMBER_REGEX = r"^AYU-\d{8}-[A-Z0-9]{5}$"

_STRICT = ConfigDict(extra="forbid", strict=True)


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
    image_url: Optional[str] = Field(None, max_length=2000)


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


class CartItemIn(BaseModel):
    model_config = _STRICT
    product_id: str = Field(min_length=1, max_length=64)
    quantity: int = Field(ge=1, le=100_000)


class GuestInfo(BaseModel):
    model_config = _STRICT
    business_name: str = Field(min_length=1, max_length=200)
    contact_person: str = Field(min_length=1, max_length=200)
    phone: str = Field(pattern=INDIAN_MOBILE_REGEX)
    email: EmailStr
    address: str = Field(min_length=1, max_length=500)
    city: str = Field(min_length=1, max_length=100)
    gst_number: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = Field(None, max_length=2000)


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


class OrderStatusUpdate(BaseModel):
    model_config = _STRICT
    status: Literal["placed", "confirmed", "processing", "packed", "dispatched", "delivered", "cancelled"]


class BulkStatusUpdate(BaseModel):
    model_config = _STRICT
    order_ids: List[str] = Field(min_length=1, max_length=200)
    status: Literal["placed", "confirmed", "processing", "packed", "dispatched", "delivered", "cancelled"]


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
    gst_number: Optional[str] = Field(None, max_length=20)
    is_default: bool = False


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
