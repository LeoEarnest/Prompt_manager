"""HTTP routes for the prompt manager."""
from flask import Blueprint, Response, jsonify, render_template
from sqlalchemy.orm import selectinload

from . import db
from .models import Domain, Prompt, Subtopic


frontend_bp = Blueprint('frontend', __name__)
api_bp = Blueprint('api', __name__, url_prefix='/api')


@frontend_bp.route('/')
def index() -> str:
    """Render the start page of the prompt manager."""
    return render_template('index.html')


@api_bp.route('/structure')
def structure() -> Response:
    """Return the full domain/subtopic/prompt hierarchy for quick navigation."""

    domains = Domain.query.options(
        selectinload(Domain.subtopics).selectinload(Subtopic.prompts)
    ).order_by(Domain.name.asc()).all()

    payload: list[dict] = []
    for domain in domains:
        subtopics_data: list[dict] = []
        for subtopic in sorted(domain.subtopics, key=lambda s: s.name.lower()):
            prompts_data = [
                {
                    'id': prompt.id,
                    'title': prompt.title,
                }
                for prompt in sorted(subtopic.prompts, key=lambda p: p.title.lower())
            ]
            subtopics_data.append(
                {
                    'id': subtopic.id,
                    'name': subtopic.name,
                    'prompts': prompts_data,
                }
            )

        payload.append(
            {
                'id': domain.id,
                'name': domain.name,
                'subtopics': subtopics_data,
            }
        )

    return jsonify(payload)


@api_bp.route('/prompts/<int:prompt_id>')
def prompt_detail(prompt_id: int) -> Response:
    """Return a single prompt by its identifier."""

    prompt = db.session.get(Prompt, prompt_id)
    if prompt is None:
        return jsonify({'error': 'Prompt not found'}), 404

    return jsonify(
        {
            'id': prompt.id,
            'title': prompt.title,
            'content': prompt.content,
        }
    )
