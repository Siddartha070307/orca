"""FastAPI application entrypoint for ORCA Marine Intelligence Platform."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.models.db import init_db
from app.api.routes import router
from app.api.auth_routes import auth_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("orca")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle startup and shutdown handler."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    # Initialize SQLite database schema
    init_db()
    logger.info("Database schema initialized.")
    if settings.ADMIN_SEED_ENABLED and settings.ADMIN_PASSWORD:
        from app.models.db import SessionLocal
        from app.services.admin_bootstrap import seed_default_admin
        with SessionLocal() as db:
            seed_default_admin(db)
    yield
    logger.info("Shutting down ORCA.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Agentic AI Marine Intelligence Platform for Indian Waters (SIH26176 / ISRO)",
    lifespan=lifespan
)

# Enable CORS for frontend web dashboards & GIS tools
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
is_wildcard = len(origins) == 1 and origins[0] == "*"
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=not is_wildcard,  # Standard browser security: credentials disallowed with wildcard origin
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(router)
app.include_router(auth_router)


@app.get("/")
def root():
    return {
        "platform": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs_url": "/docs",
        "health_check": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
