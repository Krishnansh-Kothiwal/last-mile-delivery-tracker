"""Reset the database to a clean demo state."""
import sys
from sqlalchemy import text, inspect
from app.database import engine, Base
from app.seed import seed_database
from app.models import User


def reset_database():
    """Drop all tables, recreate schema, and re-seed clean demo data."""
    print("Beginning database reset...")

    # Disable FK constraints during table drop for SQLite / DB safety
    with engine.begin() as conn:
        if engine.name == "sqlite":
            conn.execute(text("PRAGMA foreign_keys = OFF;"))

        inspector = inspect(conn)
        tables = inspector.get_table_names()
        print(f"Dropping {len(tables)} existing tables...")
        for table in tables:
            if engine.name == "sqlite":
                conn.execute(text(f'DROP TABLE IF EXISTS "{table}";'))
            else:
                conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE;'))

        if engine.name == "sqlite":
            conn.execute(text("PRAGMA foreign_keys = ON;"))

    print("Re-creating schema from application metadata...")
    Base.metadata.create_all(bind=engine)

    print("Re-seeding clean demo data...")
    seed_database()
    print("[SUCCESS] Database successfully reset to clean demo state!")


if __name__ == "__main__":
    reset_database()
