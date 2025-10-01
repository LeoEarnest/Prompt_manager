"""Frontend routes for serving the application shell."""
from flask import Blueprint, render_template

from .shared import build_structure_payload


frontend_bp = Blueprint('frontend', __name__)


@frontend_bp.route('/')
def index() -> str:
    """Render the landing page populated with the prompt structure."""

    structure = build_structure_payload()
    return render_template('index.html', structure=structure)
