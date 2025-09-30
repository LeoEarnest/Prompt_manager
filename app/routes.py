"""HTTP routes for the prompt manager."""
from flask import Blueprint, Response, jsonify, render_template, request
from sqlalchemy.orm import selectinload

from . import db
from .models import Domain, Prompt, Subtopic


frontend_bp = Blueprint('frontend', __name__)
api_bp = Blueprint('api', __name__, url_prefix='/api')


def _build_structure_payload() -> list[dict[str, object]]:
    """Return the navigation hierarchy for domains, subtopics, and prompts."""

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

    return payload


@frontend_bp.route('/')
def index() -> str:
    """Render the start page of the prompt manager."""

    structure = _build_structure_payload()
    return render_template('index.html', structure=structure)


def _serialize_prompt(prompt: Prompt) -> dict[str, object]:
    """Return a JSON-safe representation of a prompt including hierarchy metadata."""

    subtopic = prompt.subtopic
    domain = subtopic.domain if subtopic is not None else None

    return {
        'id': prompt.id,
        'title': prompt.title,
        'content': prompt.content,
        'subtopic_id': subtopic.id if subtopic is not None else None,
        'subtopic_name': subtopic.name if subtopic is not None else None,
        'domain_id': domain.id if domain is not None else None,
        'domain_name': domain.name if domain is not None else None,
    }


@api_bp.route('/structure')
def structure() -> Response:
    """Return the full domain/subtopic/prompt hierarchy for quick navigation."""

    payload = _build_structure_payload()
    return jsonify(payload)


@api_bp.route('/subtopics')
def list_subtopics() -> Response:
    """Return all subtopics with their related domain metadata."""

    subtopics = Subtopic.query.options(
        selectinload(Subtopic.domain)
    ).order_by(Subtopic.name.asc()).all()

    payload = [
        {
            'id': subtopic.id,
            'name': subtopic.name,
            'domain': {
                'id': subtopic.domain.id,
                'name': subtopic.domain.name,
            },
        }
        for subtopic in subtopics
    ]

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


@api_bp.route('/prompts', methods=['POST'])
def create_prompt() -> Response:
    """Create a new prompt from JSON payload."""

    payload = request.get_json(silent=True) or {}

    title = (payload.get('title') or '').strip()
    content = (payload.get('content') or '').strip()
    subtopic_id_raw = payload.get('subtopic_id')

    errors: dict[str, str] = {}

    if not title:
        errors['title'] = 'Title is required.'
    if not content:
        errors['content'] = 'Content is required.'

    subtopic = None
    try:
        subtopic_id = int(subtopic_id_raw)
    except (TypeError, ValueError):
        errors['subtopic_id'] = 'Valid subtopic_id is required.'
    else:
        subtopic = db.session.get(Subtopic, subtopic_id)
        if subtopic is None:
            errors['subtopic_id'] = 'Subtopic not found.'

    if errors:
        return jsonify({'errors': errors}), 400

    prompt = Prompt(title=title, content=content, subtopic=subtopic)
    db.session.add(prompt)
    db.session.commit()

    return jsonify(_serialize_prompt(prompt)), 201


@api_bp.route('/prompts/<int:prompt_id>', methods=['PUT'])
def update_prompt(prompt_id: int) -> Response:
    """Update an existing prompt with new details."""

    prompt = db.session.get(Prompt, prompt_id)
    if prompt is None:
        return jsonify({'error': 'Prompt not found'}), 404

    payload = request.get_json(silent=True) or {}

    title = (payload.get('title') or '').strip()
    content = (payload.get('content') or '').strip()
    subtopic_id_raw = payload.get('subtopic_id')

    errors: dict[str, str] = {}

    if not title:
        errors['title'] = 'Title is required.'
    if not content:
        errors['content'] = 'Content is required.'

    subtopic = None
    try:
        subtopic_id = int(subtopic_id_raw)
    except (TypeError, ValueError):
        errors['subtopic_id'] = 'Valid subtopic_id is required.'
    else:
        subtopic = db.session.get(Subtopic, subtopic_id)
        if subtopic is None:
            errors['subtopic_id'] = 'Subtopic not found.'

    if errors:
        return jsonify({'errors': errors}), 400

    prompt.title = title
    prompt.content = content
    prompt.subtopic = subtopic
    db.session.commit()

    db.session.refresh(prompt)

    return jsonify(_serialize_prompt(prompt))


@api_bp.route('/prompts/<int:prompt_id>', methods=['DELETE'])
def delete_prompt(prompt_id: int) -> Response:
    """Delete an existing prompt by identifier."""

    prompt = db.session.get(Prompt, prompt_id)
    if prompt is None:
        return jsonify({'error': 'Prompt not found'}), 404

    db.session.delete(prompt)
    db.session.commit()

    return Response(status=204)
