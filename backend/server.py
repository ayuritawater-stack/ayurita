"""Ayurita FastAPI app entrypoint."""
import os
import asyncio
import logging
from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from deps import client
from seed import run_seed
from security import SecureHeadersMiddleware
from services.credit_reminders import send_due_reminders
from routers import auth as r_auth
from routers import categories as r_categories
from routers import products as r_products
from routers import coupons as r_coupons
from routers import orders as r_orders
from routers import bulk as r_bulk
from routers import contact as r_contact
from routers import analytics as r_analytics
from routers import invoices as r_invoices
from routers import catalogue as r_catalogue
from routers import settings as r_settings
from routers import customer as r_customer
from routers import payments as r_payments
from routers import admins as r_admins
from routers import reviews as r_reviews
from routers import credit as r_credit
from routers import returns as r_returns

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ayurita")

app = FastAPI(title="Ayurita Packaged Drinking Water API")

api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"status": "ok", "service": "Ayurita API"}


# Mount routers under /api
api.include_router(r_auth.router)
api.include_router(r_categories.router)
api.include_router(r_products.router)
api.include_router(r_coupons.router)
api.include_router(r_orders.router)
api.include_router(r_bulk.router)
api.include_router(r_contact.router)
api.include_router(r_analytics.router)
api.include_router(r_invoices.router)
api.include_router(r_catalogue.router)
api.include_router(r_settings.router)
api.include_router(r_customer.router)
api.include_router(r_payments.router)
api.include_router(r_admins.router)
api.include_router(r_admins.audit_router)
api.include_router(r_reviews.router)
api.include_router(r_credit.router)
api.include_router(r_credit.requests_router)
api.include_router(r_credit.reminders_router)
api.include_router(r_returns.router)

app.include_router(api)

app.add_middleware(SecureHeadersMiddleware)

# CORS — restrict to configured origins (comma-separated). Fallback to *.
_origins_env = os.environ.get("CORS_ORIGINS", "*").strip()
if _origins_env == "*":
    allow_origins = ["*"]
    allow_credentials = False  # cannot combine "*" with credentials
else:
    allow_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_credentials=allow_credentials,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    # Catches anything not already handled by FastAPI's own HTTPException/validation-error
    # handlers (both of which stay intact and take precedence). Full detail - including the
    # traceback - goes to the server log only; the client only ever sees a generic message, never
    # a stack trace, file path, or raw database error.
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong. Please try again."})


async def _credit_reminder_loop():
    while True:
        try:
            sent = await send_due_reminders()
            if sent:
                logger.info("Credit payment reminders sent: %d", sent)
        except Exception:
            logger.exception("Credit reminder loop failed")
        await asyncio.sleep(24 * 60 * 60)


@app.on_event("startup")
async def _startup():
    try:
        await run_seed()
    except Exception as exc:
        logger.warning("Startup seeding skipped: %s", exc)
    asyncio.create_task(_credit_reminder_loop())


@app.on_event("shutdown")
async def _shutdown():
    client.close()
