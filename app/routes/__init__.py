"""Blueprint exports for the prompt manager application."""
from .api import api_bp
from .frontend import frontend_bp

__all__ = ('api_bp', 'frontend_bp')
