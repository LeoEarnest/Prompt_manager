"""Tests covering the API endpoints for prompt retrieval."""
import pytest

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


@pytest.fixture()
def client(app):
    return app.test_client()


def test_structure_endpoint_returns_expected_shape(app, client):
    """The structure endpoint should expose the hierarchy in a single payload."""

    with app.app_context():
        coding = Domain(name='Coding')
        flask_topic = Subtopic(name='Flask', domain=coding)
        prompt = Prompt(title='Create route', content='Make a sample route.', subtopic=flask_topic)

        writing = Domain(name='Writing')
        fiction_topic = Subtopic(name='Fiction', domain=writing)
        Prompt(title='World build', content='Outline a sci-fi world.', subtopic=fiction_topic)

        db.session.add_all([coding, writing, prompt])
        db.session.commit()

    response = client.get('/api/structure')

    assert response.status_code == 200
    assert response.mimetype == 'application/json'

    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) == 2

    coding_payload = next(item for item in data if item['name'] == 'Coding')
    assert coding_payload['subtopics'][0]['name'] == 'Flask'
    prompts = coding_payload['subtopics'][0]['prompts']
    assert prompts[0]['title'] == 'Create route'
    assert 'content' not in prompts[0]


def test_prompt_detail_returns_prompt_and_handles_missing(app, client):
    """The prompt detail endpoint should return data or a 404 payload."""

    with app.app_context():
        domain = Domain(name='Design')
        subtopic = Subtopic(name='UX', domain=domain)
        prompt = Prompt(title='Persona builder', content='Draft a UX persona.', subtopic=subtopic)

        db.session.add(domain)
        db.session.commit()

        prompt_id = prompt.id

    response = client.get(f'/api/prompts/{prompt_id}')
    assert response.status_code == 200
    assert response.get_json() == {
        'id': prompt_id,
        'title': 'Persona builder',
        'content': 'Draft a UX persona.',
    }

    missing_response = client.get(f'/api/prompts/{prompt_id + 1000}')
    assert missing_response.status_code == 404
    assert missing_response.get_json() == {'error': 'Prompt not found'}
