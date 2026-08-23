"""Application configuration loaded from environment variables."""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)


class Settings:
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-not-for-production")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./delivery_tracker.db")
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    ALGORITHM: str = "HS256"


settings = Settings()
