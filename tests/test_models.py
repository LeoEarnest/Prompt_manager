"""Tests covering the ORM models for the prompt manager."""
import pytest
from sqlalchemy.exc import IntegrityError

from app import create_app, db
from app.models import Domain, Prompt, Subtopic


@pytest.fixture()
def app():
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'SQLALCHEMY_TRACK_MODIFICATIONS': False,
    })

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_domain_subtopic_prompt_relationship(app):
    """Ensure cascading relationships between models operate as expected."""

    with app.app_context():
        domain = Domain(name='Artificial Intelligence')
        subtopic = Subtopic(name='Language Models', domain=domain)
        prompt = Prompt(title='Greeting Prompt', content='Hello, world!', subtopic=subtopic)

        db.session.add(domain)
        db.session.commit()

        assert subtopic.domain is domain
        assert prompt.subtopic is subtopic
        assert domain.subtopics == [subtopic]
        assert subtopic.prompts == [prompt]
        assert prompt.subtopic.domain is domain


def test_domain_name_must_be_unique(app):
    """Attempting to insert duplicate domain names should raise an integrity error."""

    with app.app_context():
        first = Domain(name='Automation')
        duplicate = Domain(name='Automation')

        db.session.add(first)
        db.session.commit()
        db.session.add(duplicate)

        with pytest.raises(IntegrityError):
            db.session.commit()

        db.session.rollback()

        assert Domain.query.count() == 1

def test_prompt_template_fields_persist(app):
    """Template prompts should persist boolean flag and options payload."""

    with app.app_context():
        domain = Domain(name='Photography')
        subtopic = Subtopic(name='Wildlife', domain=domain)
        options = {
            'creature': ['fox', 'owl'],
            'action': ['hunting'],
        }
        prompt = Prompt(
            title='Wildlife template',
            content='Capture a {creature} while {action}.',
            subtopic=subtopic,
            is_template=True,
            configurable_options=options,
        )

        db.session.add(domain)
        db.session.commit()

        fetched = db.session.get(Prompt, prompt.id)
        assert fetched is not None
        assert fetched.is_template is True
        assert fetched.configurable_options == options
