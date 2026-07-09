"""Ayurita FastAPI app entrypoint."""
import os
import logging
from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from deps import client
from seed import run_seed
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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ayurita")

app = FastAPI(title="Ayurita Packaged Drinking Water API")

# Rate limiter (attached from auth router)
app.state.limiter = r_auth.limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


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

app.include_router(api)

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


@app.on_event("startup")
async def _startup():
    await run_seed()


@app.on_event("shutdown")
async def _shutdown():
    client.close()
