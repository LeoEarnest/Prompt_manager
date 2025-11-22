"""Frontend routes for serving the application shell."""
from pathlib import Path

from flask import Blueprint, current_app, render_template, send_from_directory

from .shared import build_structure_payload


frontend_bp = Blueprint('frontend', __name__)


@frontend_bp.route('/')
def index() -> str:
    """Render the landing page populated with the prompt structure."""

    structure = build_structure_payload()
    return render_template('index.html', structure=structure)


@frontend_bp.route('/uploads/<path:filename>')
def uploaded_file(filename: str):
    """Serve user-uploaded prompt images."""

    upload_folder = current_app.config.get('UPLOAD_FOLDER')
    if not upload_folder:
        return '', 404

    return send_from_directory(Path(upload_folder), filename)
