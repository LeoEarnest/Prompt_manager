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


def test_create_prompt_success(app, client):
    """Posting valid data should persist a prompt and return details."""

    with app.app_context():
        domain = Domain(name='Research')
        subtopic = Subtopic(name='AI Experiments', domain=domain)
        db.session.add(domain)
        db.session.commit()
        subtopic_id = subtopic.id

    payload = {
        'title': 'Hypothesis generator',
        'content': 'Draft three hypotheses for the study.',
        'subtopic_id': subtopic_id,
    }

    response = client.post('/api/prompts', json=payload)
    assert response.status_code == 201

    data = response.get_json()
    assert data['title'] == payload['title']
    assert data['content'] == payload['content']
    assert data['subtopic_id'] == subtopic_id
    assert data['subtopic_name'] == 'AI Experiments'
    assert data['domain_name'] == 'Research'
    assert isinstance(data['id'], int)

    with app.app_context():
        stored = db.session.get(Prompt, data['id'])
        assert stored is not None
        assert stored.title == payload['title']
        assert stored.content == payload['content']
        assert stored.subtopic_id == subtopic_id


def test_create_prompt_validation_errors(app, client):
    """Invalid payloads should produce helpful error messages."""

    with app.app_context():
        domain = Domain(name='Productivity')
        subtopic = Subtopic(name='Daily Habits', domain=domain)
        db.session.add(domain)
        db.session.commit()
        subtopic_id = subtopic.id

    missing_title = client.post(
        '/api/prompts',
        json={'content': 'Example content', 'subtopic_id': subtopic_id},
    )
    assert missing_title.status_code == 400
    assert 'title' in missing_title.get_json()['errors']

    invalid_subtopic = client.post(
        '/api/prompts',
        json={'title': 'New idea', 'content': 'Example content', 'subtopic_id': subtopic_id + 999},
    )
    assert invalid_subtopic.status_code == 400
    assert invalid_subtopic.get_json()['errors']['subtopic_id'] == 'Subtopic not found.'

    non_numeric_subtopic = client.post(
        '/api/prompts',
        json={'title': 'Another idea', 'content': 'More detail', 'subtopic_id': 'abc'},
    )
    assert non_numeric_subtopic.status_code == 400
    assert non_numeric_subtopic.get_json()['errors']['subtopic_id'] == 'Valid subtopic_id is required.'
