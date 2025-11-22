"""Application configuration objects."""
from __future__ import annotations

import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent


class Config:
    """Base configuration shared across environments."""

    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.environ.get(
        'UPLOAD_FOLDER',
        (BASE_DIR / 'app' / 'static' / 'uploads').as_posix(),
    )

    _default_db_path = BASE_DIR / 'prompt_manager.db'
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        f"sqlite:///{_default_db_path.as_posix()}",
    )
