"""JSON API routes exposed by the prompt manager application."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import uuid4

from flask import Blueprint, Response, current_app, jsonify, request, url_for
from sqlalchemy import func, or_
from sqlalchemy.orm import selectinload
from werkzeug.exceptions import HTTPException
from werkzeug.utils import secure_filename

from .. import db
from ..models import Domain, Prompt, PromptImage, Subtopic
from .shared import build_structure_payload


api_bp = Blueprint('api', __name__, url_prefix='/api')

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_IMAGES_PER_PROMPT = 8


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
            'images': _serialize_images(prompt),
        }
    )


def _collect_payload_and_files() -> tuple[dict[str, Any], list]:
    """Return request payload and any uploaded files for image handling."""

    if request.is_json:
        return request.get_json(silent=True) or {}, []

    payload = request.form.to_dict(flat=True)
    files: list = []
    for field_name in ('images', 'images[]'):
        files.extend(request.files.getlist(field_name))
    return payload, [f for f in files if f]


def _normalize_bool(value: Any) -> bool | None:
    """Normalize a boolean-like value from JSON or form submissions."""

    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {'true', '1', 'yes', 'on'}:
            return True
        if lowered in {'false', '0', 'no', 'off'}:
            return False
    return None


def _parse_configurable_options(raw_value: Any) -> tuple[dict | None, str | None]:
    """Attempt to parse configurable_options input, returning (value, error)."""

    if raw_value is None or raw_value == '':
        return None, None

    if isinstance(raw_value, dict):
        return raw_value, None

    if isinstance(raw_value, str):
        try:
            parsed = json.loads(raw_value)
        except ValueError:
            return None, 'configurable_options must be valid JSON.'
        if isinstance(parsed, dict):
            return parsed, None
        return None, 'configurable_options must be a JSON object.'

    return None, 'configurable_options must be a JSON object.'


def _is_allowed_image(file_storage) -> bool:
    """Quick validation for uploaded image types."""

    filename = secure_filename(file_storage.filename or '')
    extension = Path(filename).suffix.lower().lstrip('.')
    if not filename or extension not in ALLOWED_IMAGE_EXTENSIONS:
        return False
    mimetype = (file_storage.mimetype or '').lower()
    return mimetype.startswith('image/')


def _attach_images(prompt: Prompt, files: list) -> dict[str, str]:
    """Validate and persist uploaded images; returns an error dict if any."""

    cleaned_files = [f for f in files if f and getattr(f, 'filename', '')]
    if not cleaned_files:
        return {}

    existing_count = len(prompt.images)
    if existing_count + len(cleaned_files) > MAX_IMAGES_PER_PROMPT:
        return {'images': f'You can attach up to {MAX_IMAGES_PER_PROMPT} images per prompt.'}

    invalid_files = [f.filename for f in cleaned_files if not _is_allowed_image(f)]
    if invalid_files:
        return {'images': 'Only image files (png, jpg, jpeg, gif, webp) are allowed.'}

    upload_dir = Path(current_app.config.get('UPLOAD_FOLDER', 'uploads'))
    upload_dir.mkdir(parents=True, exist_ok=True)

    for index, storage in enumerate(cleaned_files):
        original_ext = Path(secure_filename(storage.filename or '')).suffix
        fallback_ext = Path(storage.filename or '').suffix
        extension = original_ext or fallback_ext
        generated_name = f"{uuid4().hex}{extension}"
        storage.save(upload_dir / generated_name)
        prompt.images.append(
            PromptImage(
                filename=generated_name,
                sort_order=existing_count + index,
            )
        )

    return {}


def _remove_image_file(filename: str) -> None:
    """Attempt to remove an image from disk, ignoring missing files."""

    upload_dir = Path(current_app.config.get('UPLOAD_FOLDER', 'uploads'))
    file_path = upload_dir / filename
    try:
        file_path.unlink()
    except FileNotFoundError:
        return
    except OSError:
        current_app.logger.warning('Failed to remove image file %s', file_path)


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

    normalized_bool = _normalize_bool(payload.get('is_template', False))
    if normalized_bool is None:
        errors['is_template'] = 'is_template must be a boolean.'
        is_template = False
    else:
        is_template = normalized_bool

    options, options_error = _parse_configurable_options(payload.get('configurable_options'))
    if options_error:
        errors['configurable_options'] = options_error

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
        'images': _serialize_images(prompt),
    }


def _serialize_images(prompt: Prompt) -> list[dict[str, Any]]:
    """Serialize attached images for API responses."""

    images = getattr(prompt, 'images', []) or []
    return [
        {
            'id': image.id,
            'filename': image.filename,
            'url': url_for('frontend.uploaded_file', filename=image.filename, _external=False),
        }
        for image in sorted(images, key=lambda img: img.sort_order)
    ]


@api_bp.route('/prompts', methods=['POST'])
def create_prompt() -> Response:
    """Create a new prompt from JSON payload."""

    payload, image_files = _collect_payload_and_files()

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

    image_errors = _attach_images(prompt, image_files)
    if image_errors:
        db.session.rollback()
        errors.update(image_errors)
        return jsonify({'errors': errors}), 400

    db.session.commit()

    return jsonify(_serialize_prompt(prompt)), 201


@api_bp.route('/prompts/<int:prompt_id>', methods=['PUT'])
def update_prompt(prompt_id: int) -> Response:
    """Update an existing prompt with new details."""

    prompt = db.session.get(Prompt, prompt_id)
    if prompt is None:
        return jsonify({'error': 'Prompt not found'}), 404

    payload, image_files = _collect_payload_and_files()

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

    image_errors = _attach_images(prompt, image_files)
    if image_errors:
        db.session.rollback()
        errors.update(image_errors)
        return jsonify({'errors': errors}), 400

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

    for image in list(prompt.images):
        _remove_image_file(image.filename)

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
            selectinload(Prompt.subtopic).selectinload(Subtopic.domain),
            selectinload(Prompt.images),
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
