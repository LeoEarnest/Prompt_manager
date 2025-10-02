"""JSON API routes exposed by the prompt manager application."""
from __future__ import annotations

from typing import Any

from flask import Blueprint, Response, current_app, jsonify, request
from sqlalchemy import func, or_
from sqlalchemy.orm import selectinload
from werkzeug.exceptions import HTTPException

from .. import db
from ..models import Domain, Prompt, Subtopic
from .shared import build_structure_payload


api_bp = Blueprint('api', __name__, url_prefix='/api')


@api_bp.errorhandler(HTTPException)
def handle_api_http_exception(error: HTTPException) -> Response:
    """Return JSON payloads for known HTTP errors raised within the API."""

    response = jsonify({'error': error.description or 'Request failed'})
    response.status_code = error.code or 500
    return response


@api_bp.errorhandler(Exception)
def handle_api_exception(error: Exception) -> Response:
    """Return a safe error response for unexpected API failures."""

    current_app.logger.exception('Unhandled API error', exc_info=error)
    return jsonify({'error': 'Internal server error'}), 500


@api_bp.route('/structure')
def structure() -> Response:
    """Return the full domain/subtopic/prompt hierarchy for quick navigation."""

    payload = build_structure_payload()
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
            'is_template': prompt.is_template,
            'configurable_options': prompt.configurable_options,
        }
    )


def _validate_prompt_payload(payload: dict[str, Any]) -> tuple[dict[str, str], dict[str, Any]]:
    """Normalize prompt payload and return (errors, normalized_fields)."""

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

    raw_is_template = payload.get('is_template', False)
    if isinstance(raw_is_template, bool):
        is_template = raw_is_template
    else:
        errors['is_template'] = 'is_template must be a boolean.'
        is_template = False

    raw_options = payload.get('configurable_options')
    if raw_options is None:
        options = None
    elif isinstance(raw_options, dict):
        options = raw_options
    else:
        errors['configurable_options'] = 'configurable_options must be a JSON object.'
        options = None

    fields = {
        'title': title,
        'content': content,
        'domain_name': domain_name,
        'subtopic_name': subtopic_name,
        'is_template': is_template,
        'configurable_options': options,
    }
    return errors, fields

def _get_or_create_domain_and_subtopic(domain_name: str, subtopic_name: str) -> tuple[Domain, Subtopic]:
    """Fetch existing domain/subtopic pair or create new entries."""

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

    return domain, subtopic


def _serialize_prompt(prompt: Prompt) -> dict[str, Any]:
    """Return a JSON-safe representation of a prompt including hierarchy metadata."""

    subtopic = prompt.subtopic
    domain = subtopic.domain if subtopic is not None else None

    return {
        'id': prompt.id,
        'title': prompt.title,
        'content': prompt.content,
        'is_template': prompt.is_template,
        'configurable_options': prompt.configurable_options,
        'subtopic_id': subtopic.id if subtopic is not None else None,
        'subtopic_name': subtopic.name if subtopic is not None else None,
        'domain_id': domain.id if domain is not None else None,
        'domain_name': domain.name if domain is not None else None,
    }


@api_bp.route('/prompts', methods=['POST'])
def create_prompt() -> Response:
    """Create a new prompt from JSON payload."""

    payload = request.get_json(silent=True) or {}

    errors, fields = _validate_prompt_payload(payload)
    if errors:
        return jsonify({'errors': errors}), 400

    _, subtopic = _get_or_create_domain_and_subtopic(
        fields['domain_name'],
        fields['subtopic_name'],
    )

    prompt = Prompt(
        title=fields['title'],
        content=fields['content'],
        subtopic=subtopic,
        is_template=fields['is_template'],
        configurable_options=fields['configurable_options'],
    )
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

    errors, fields = _validate_prompt_payload(payload)
    if errors:
        return jsonify({'errors': errors}), 400

    _, subtopic = _get_or_create_domain_and_subtopic(
        fields['domain_name'],
        fields['subtopic_name'],
    )

    prompt.title = fields['title']
    prompt.content = fields['content']
    prompt.subtopic = subtopic
    prompt.is_template = fields['is_template']
    prompt.configurable_options = fields['configurable_options']

    db.session.commit()
    db.session.refresh(prompt)

    return jsonify(_serialize_prompt(prompt))


@api_bp.route('/prompts/<int:prompt_id>', methods=['DELETE'])
def delete_prompt(prompt_id: int) -> Response:
    """Delete an existing prompt and any resulting empty parent containers."""

    prompt = db.session.get(Prompt, prompt_id)
    if prompt is None:
        return jsonify({'error': 'Prompt not found'}), 404

    subtopic = prompt.subtopic
    domain = subtopic.domain if subtopic else None

    db.session.delete(prompt)
    db.session.flush()

    if subtopic and not subtopic.prompts:
        db.session.delete(subtopic)
        db.session.flush()

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
