"""HTTP routes for the prompt manager."""
from flask import Blueprint, render_template


bp = Blueprint('main', __name__)


@bp.route('/')
def index() -> str:
    """Render the start page of the prompt manager."""
    return render_template('index.html')
