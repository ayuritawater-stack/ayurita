"""Auth router — login, me, with rate limiting on login."""
from fastapi import APIRouter, HTTPException, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from deps import db, get_current_admin, verify_password, create_access_token
from models import LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/login")
@limiter.limit("5/minute")
async def admin_login(request: Request, body: LoginRequest):
    email = body.email.lower().strip()
    admin = await db.admins.find_one({"email": email})
    if not admin or not verify_password(body.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(admin["id"], admin["email"])
    return {
        "token": token,
        "user": {
            "id": admin["id"],
            "email": admin["email"],
            "name": admin.get("name", "Admin"),
            "role": "admin",
        },
    }


@router.get("/me")
async def admin_me(admin: dict = Depends(get_current_admin)):
    return admin
