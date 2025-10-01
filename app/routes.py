"""HTTP routes for the prompt manager."""
from flask import Blueprint, Response, current_app, jsonify, render_template, request
from sqlalchemy import func, or_
from sqlalchemy.orm import selectinload
from werkzeug.exceptions import HTTPException

from . import db
from .models import Domain, Prompt, Subtopic


frontend_bp = Blueprint('frontend', __name__)
api_bp = Blueprint('api', __name__, url_prefix='/api')


@api_bp.errorhandler(HTTPException)
def handle_api_http_exception(error: HTTPException) -> Response:
    """Return JSON payloads for known HTTP errors raised within the API."""

    response = jsonify({'error': (error.description or 'Request failed')})
    response.status_code = error.code or 500
    return response


@api_bp.errorhandler(Exception)
def handle_api_exception(error: Exception) -> Response:
    """Return a safe error response for unexpected API failures."""

    current_app.logger.exception('Unhandled API error', exc_info=error)
    return jsonify({'error': 'Internal server error'}), 500


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
    domain_name = (payload.get('domain_name') or '').strip()
    subtopic_name = (payload.get('subtopic_name') or '').strip()

    errors: dict[str, str] = {}

    if not title:
        errors['title'] = 'Title is required.'
    if not content:
        errors['content'] = 'Content is required.'
    if not domain_name:
        errors['domain_name'] = 'Domain name is required.'
    if not subtopic_name:
        errors['subtopic_name'] = 'Subtopic name is required.'

    if errors:
        return jsonify({'errors': errors}), 400

    domain = Domain.query.filter(
        func.lower(Domain.name) == domain_name.lower()
    ).first()
    if domain is None:
        domain = Domain(name=domain_name)
        db.session.add(domain)
        db.session.flush()

    subtopic = Subtopic.query.filter(
        Subtopic.domain_id == domain.id,
        func.lower(Subtopic.name) == subtopic_name.lower(),
    ).first()
    if subtopic is None:
        subtopic = Subtopic(name=subtopic_name, domain=domain)
        db.session.add(subtopic)
        db.session.flush()

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
    domain_name = (payload.get('domain_name') or '').strip()
    subtopic_name = (payload.get('subtopic_name') or '').strip()

    errors: dict[str, str] = {}

    if not title:
        errors['title'] = 'Title is required.'
    if not content:
        errors['content'] = 'Content is required.'
    if not domain_name:
        errors['domain_name'] = 'Domain name is required.'
    if not subtopic_name:
        errors['subtopic_name'] = 'Subtopic name is required.'

    if errors:
        return jsonify({'errors': errors}), 400

    domain = Domain.query.filter(
        func.lower(Domain.name) == domain_name.lower()
    ).first()
    if domain is None:
        domain = Domain(name=domain_name)
        db.session.add(domain)
        db.session.flush()

    subtopic = Subtopic.query.filter(
        Subtopic.domain_id == domain.id,
        func.lower(Subtopic.name) == subtopic_name.lower(),
    ).first()
    if subtopic is None:
        subtopic = Subtopic(name=subtopic_name, domain=domain)
        db.session.add(subtopic)
        db.session.flush()

    prompt.title = title
    prompt.content = content
    prompt.subtopic = subtopic
    db.session.commit()

    db.session.refresh(prompt)

    return jsonify(_serialize_prompt(prompt))


@api_bp.route('/prompts/<int:prompt_id>', methods=['DELETE'])
def delete_prompt(prompt_id: int) -> Response:
    """Delete an existing prompt and any resulting empty parent containers."""

    prompt = db.session.get(Prompt, prompt_id)
    if prompt is None:
        return jsonify({'error': 'Prompt not found'}), 404

    # Keep track of parents before deleting the prompt
    subtopic = prompt.subtopic
    domain = subtopic.domain if subtopic else None

    db.session.delete(prompt)
    db.session.flush()  # Use flush to check counts before committing

    # Check if the subtopic is now empty
    if subtopic and not subtopic.prompts:
        db.session.delete(subtopic)
        db.session.flush()  # Use flush to check counts before committing

        # If subtopic was deleted, check if the domain is now empty
        if domain and not domain.subtopics:
            db.session.delete(domain)

    db.session.commit()

    return Response(status=204)


@api_bp.route('/search')
def search_prompts() -> Response:
    """Return prompts matching the provided query across title and content."""

    raw_query = request.args.get('q', '', type=str)
    keyword = raw_query.strip()
    if not keyword:
        return jsonify([])

    lowered = f"%{keyword.lower()}%"

    prompts = (
        Prompt.query.options(
            selectinload(Prompt.subtopic).selectinload(Subtopic.domain)
        )
        .filter(
            or_(
                func.lower(Prompt.title).like(lowered),
                func.lower(Prompt.content).like(lowered),
            )
        )
        .order_by(Prompt.title.asc())
        .all()
    )

    payload = [_serialize_prompt(prompt) for prompt in prompts]
    return jsonify(payload)
