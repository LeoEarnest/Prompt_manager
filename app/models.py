"""Database models for the prompt manager application."""
from __future__ import annotations

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Integer, String, Text, ForeignKey

from . import db


class Domain(db.Model):
    """Represents a broad area a prompt may belong to."""

    __tablename__ = 'domains'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)

    subtopics: Mapped[list['Subtopic']] = relationship(
        'Subtopic',
        back_populates='domain',
        cascade='all, delete-orphan',
        lazy='selectin',
    )

    def __repr__(self) -> str:  # pragma: no cover - trivial debug helper
        return f"<Domain id={self.id!r} name={self.name!r}>"


class Subtopic(db.Model):
    """Represents a subtopic within a domain."""

    __tablename__ = 'subtopics'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    domain_id: Mapped[int] = mapped_column(ForeignKey('domains.id'), nullable=False)

    domain: Mapped['Domain'] = relationship('Domain', back_populates='subtopics')
    prompts: Mapped[list['Prompt']] = relationship(
        'Prompt',
        back_populates='subtopic',
        cascade='all, delete-orphan',
        lazy='selectin',
    )

    def __repr__(self) -> str:  # pragma: no cover - trivial debug helper
        return f"<Subtopic id={self.id!r} name={self.name!r} domain_id={self.domain_id!r}>"


class Prompt(db.Model):
    """Represents a single reusable prompt."""

    __tablename__ = 'prompts'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_template: Mapped[bool] = mapped_column(db.Boolean, nullable=False, default=False)
    configurable_options: Mapped[dict | None] = mapped_column(db.JSON, nullable=True)
    subtopic_id: Mapped[int] = mapped_column(ForeignKey('subtopics.id'), nullable=False)

    subtopic: Mapped['Subtopic'] = relationship('Subtopic', back_populates='prompts')
    images: Mapped[list['PromptImage']] = relationship(
        'PromptImage',
        back_populates='prompt',
        cascade='all, delete-orphan',
        lazy='selectin',
        order_by='PromptImage.sort_order',
    )

    def __repr__(self) -> str:  # pragma: no cover - trivial debug helper
        return f"<Prompt id={self.id!r} title={self.title!r} subtopic_id={self.subtopic_id!r}>"


class PromptImage(db.Model):
    """Stores uploaded image metadata for a prompt."""

    __tablename__ = 'prompt_images'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    prompt_id: Mapped[int] = mapped_column(ForeignKey('prompts.id', ondelete='CASCADE'), nullable=False)
    filename: Mapped[str] = mapped_column(String(256), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    prompt: Mapped['Prompt'] = relationship('Prompt', back_populates='images')

    def __repr__(self) -> str:  # pragma: no cover - trivial debug helper
        return f"<PromptImage id={self.id!r} prompt_id={self.prompt_id!r} filename={self.filename!r}>"
