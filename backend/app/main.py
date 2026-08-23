"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(
    title="Last-Mile Delivery Tracker",
    description="A complete last-mile delivery management system with deterministic pricing, zone-based dispatch, and immutable tracking.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Import and include routers after app creation to avoid circular imports
def _include_routers():
    from app.auth.router import router as auth_router
    from app.zones.router import router as zones_router
    from app.pricing.router import router as pricing_router
    from app.orders.router import router as orders_router
    from app.dispatch.router import router as dispatch_router
    from app.tracking.router import router as tracking_router
    from app.notifications.router import router as notifications_router
    from app.admin.router import router as admin_router

    app.include_router(auth_router, prefix="/auth", tags=["Auth"])
    app.include_router(zones_router, prefix="/admin", tags=["Zones & Areas"])
    app.include_router(pricing_router, prefix="/pricing", tags=["Pricing"])
    app.include_router(orders_router, prefix="/orders", tags=["Customer Orders"])
    app.include_router(dispatch_router, prefix="/agent", tags=["Delivery Agent"])
    app.include_router(tracking_router, prefix="/orders", tags=["Tracking"])
    app.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
    app.include_router(admin_router, prefix="/admin", tags=["Admin"])


_include_routers()


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "Last-Mile Delivery Tracker"}
