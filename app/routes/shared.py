"""Shared helpers for prompt manager blueprints."""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import selectinload

from ..models import Domain, Subtopic


def build_structure_payload() -> list[dict[str, Any]]:
    """Return hierarchical payload of domains with subtopics and prompts."""

    domains = Domain.query.options(
        selectinload(Domain.subtopics).selectinload(Subtopic.prompts)
    ).order_by(Domain.name.asc()).all()

    payload: list[dict[str, Any]] = []
    for domain in domains:
        subtopics_data: list[dict[str, Any]] = []
        for subtopic in sorted(domain.subtopics, key=lambda sub: sub.name.lower()):
            prompts_data = [
                {
                    'id': prompt.id,
                    'title': prompt.title,
                }
                for prompt in sorted(subtopic.prompts, key=lambda prompt: prompt.title.lower())
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
