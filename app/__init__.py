"""Application factory for the prompt manager."""
from flask import Flask
from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()


def create_app(test_config: dict | None = None) -> Flask:
    """Application factory used by both tests and production."""

    app = Flask(__name__, instance_relative_config=False)

    app.config.from_object('config.Config')

    if test_config:
        app.config.update(test_config)

    db.init_app(app)

    from .routes import api_bp, frontend_bp  # imported lazily to avoid circular imports

    app.register_blueprint(frontend_bp)
    app.register_blueprint(api_bp)

    from .models import Domain, Prompt, Subtopic  # imported lazily to avoid circular imports

    @app.shell_context_processor
    def make_shell_context() -> dict[str, object]:
        """Ensure helpful objects are available in the Flask shell."""

        return {
            'db': db,
            'Domain': Domain,
            'Subtopic': Subtopic,
            'Prompt': Prompt,
        }

    return app
