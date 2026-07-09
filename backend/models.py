"""Pydantic models."""
from typing import List, Optional
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class CategoryIn(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None


class ProductIn(BaseModel):
    name: str
    slug: str
    category_id: str
    category_name: str
    size: str
    price: float
    bulk_price: Optional[float] = None
    moq: int = 1
    stock: int = 0
    unit: str = "bottle"
    packaging: Optional[str] = None
    description: Optional[str] = None
    images: List[str] = []
    featured: bool = False
    is_active: bool = True
    gst_rate: float = 18.0


class CartItemIn(BaseModel):
    product_id: str
    quantity: int


class GuestInfo(BaseModel):
    business_name: str
    contact_person: str
    phone: str
    email: EmailStr
    address: str
    city: str
    gst_number: Optional[str] = None
    notes: Optional[str] = None


class OrderIn(BaseModel):
    items: List[CartItemIn]
    guest: GuestInfo
    coupon_code: Optional[str] = None
    payment_method: str = "cod"


class BulkInquiryIn(BaseModel):
    business_name: str
    contact_person: str
    phone: str
    email: EmailStr
    product: Optional[str] = None
    bottle_size: Optional[str] = None
    quantity: Optional[int] = None
    monthly_requirement: Optional[str] = None
    delivery_address: Optional[str] = None
    message: Optional[str] = None


class ContactMessageIn(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    subject: Optional[str] = None
    message: str


class CouponIn(BaseModel):
    code: str
    discount_type: str = "percent"
    value: float
    min_order: float = 0
    is_active: bool = True
    expires_at: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: str


class BulkInquiryStatusUpdate(BaseModel):
    status: str
    admin_reply: Optional[str] = None
