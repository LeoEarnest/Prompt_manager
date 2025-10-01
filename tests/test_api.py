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

    payload = {
        'title': 'Hypothesis generator',
        'content': 'Draft three hypotheses for the study.',
        'domain_name': 'Research',
        'subtopic_name': 'AI Experiments',
    }

    response = client.post('/api/prompts', json=payload)
    assert response.status_code == 201

    data = response.get_json()
    assert data['title'] == payload['title']
    assert data['content'] == payload['content']
    assert data['subtopic_name'] == payload['subtopic_name']
    assert data['domain_name'] == payload['domain_name']
    assert isinstance(data['subtopic_id'], int)
    assert isinstance(data['domain_id'], int)
    assert isinstance(data['id'], int)

    with app.app_context():
        stored = db.session.get(Prompt, data['id'])
        assert stored is not None
        assert stored.title == payload['title']
        assert stored.content == payload['content']
        subtopic = db.session.get(Subtopic, stored.subtopic_id)
        assert subtopic is not None
        assert subtopic.name == payload['subtopic_name']
        assert subtopic.domain.name == payload['domain_name']


def test_create_prompt_validation_errors(app, client):
    """Invalid payloads should produce helpful error messages."""

    missing_title = client.post(
        '/api/prompts',
        json={
            'content': 'Example content',
            'domain_name': 'Productivity',
            'subtopic_name': 'Daily Habits',
        },
    )
    assert missing_title.status_code == 400
    assert 'title' in missing_title.get_json()['errors']

    missing_domain = client.post(
        '/api/prompts',
        json={
            'title': 'New idea',
            'content': 'Example content',
            'subtopic_name': 'Daily Habits',
        },
    )
    assert missing_domain.status_code == 400
    assert missing_domain.get_json()['errors']['domain_name'] == 'Domain name is required.'

    missing_subtopic = client.post(
        '/api/prompts',
        json={
            'title': 'Another idea',
            'content': 'More detail',
            'domain_name': 'Productivity',
        },
    )
    assert missing_subtopic.status_code == 400
    assert missing_subtopic.get_json()['errors']['subtopic_name'] == 'Subtopic name is required.'


def test_update_prompt_success(app, client):
    """Updating an existing prompt should persist changes and return metadata."""

    with app.app_context():
        domain = Domain(name='Writing Lab')
        brainstorming = Subtopic(name='Brainstorming', domain=domain)
        revision = Subtopic(name='Revision', domain=domain)
        prompt = Prompt(
            title='Original title',
            content='Original content',
            subtopic=brainstorming,
        )
        db.session.add_all([domain, prompt])
        db.session.commit()

        prompt_id = prompt.id
        revision_id = revision.id

    payload = {
        'title': 'Updated title',
        'content': 'Updated content body',
        'subtopic_id': revision_id,
    }

    response = client.put(f'/api/prompts/{prompt_id}', json=payload)
    assert response.status_code == 200

    data = response.get_json()
    assert data['id'] == prompt_id
    assert data['title'] == payload['title']
    assert data['content'] == payload['content']
    assert data['subtopic_id'] == revision_id
    assert data['subtopic_name'] == 'Revision'
    assert data['domain_name'] == 'Writing Lab'

    with app.app_context():
        stored = db.session.get(Prompt, prompt_id)
        assert stored is not None
        assert stored.title == payload['title']
        assert stored.content == payload['content']
        assert stored.subtopic_id == revision_id


def test_update_prompt_validation_and_missing(app, client):
    """Update routes should guard against invalid payloads and missing prompts."""

    with app.app_context():
        domain = Domain(name='Coaching')
        tactics = Subtopic(name='Tactics', domain=domain)
        prompt = Prompt(title='Gameplan', content='Initial draft', subtopic=tactics)
        db.session.add_all([domain, prompt])
        db.session.commit()

        prompt_id = prompt.id
        subtopic_id = tactics.id

    missing_payload = client.put(
        f'/api/prompts/{prompt_id}',
        json={'title': '', 'content': '', 'subtopic_id': subtopic_id},
    )
    assert missing_payload.status_code == 400
    errors = missing_payload.get_json()['errors']
    assert 'title' in errors and 'content' in errors

    missing_prompt = client.put(
        f'/api/prompts/{prompt_id + 999}',
        json={'title': 'New', 'content': 'Body', 'subtopic_id': subtopic_id},
    )
    assert missing_prompt.status_code == 404
    assert missing_prompt.get_json()['error'] == 'Prompt not found'


def test_delete_prompt_success_and_missing(app, client):
    """Deleting a prompt should remove it and handle missing ids."""

    with app.app_context():
        domain = Domain(name='Strategy')
        planning = Subtopic(name='Planning', domain=domain)
        prompt = Prompt(title='Plan sprint', content='Outline the next sprint goals.', subtopic=planning)
        db.session.add_all([domain, prompt])
        db.session.commit()

        prompt_id = prompt.id

    response = client.delete(f'/api/prompts/{prompt_id}')
    assert response.status_code == 204
    assert response.get_data() == b''

    with app.app_context():
        assert db.session.get(Prompt, prompt_id) is None

    missing_response = client.get(f'/api/prompts/{prompt_id}')
    assert missing_response.status_code == 404

    delete_missing = client.delete(f'/api/prompts/{prompt_id}')
    assert delete_missing.status_code == 404
    assert delete_missing.get_json()['error'] == 'Prompt not found'


def test_search_endpoint_matches_title_and_content(app, client):
    """Search endpoint should match case-insensitive title and content fragments."""

    with app.app_context():
        domain = Domain(name='Product Discovery')
        insights = Subtopic(name='Insights', domain=domain)
        experiments = Subtopic(name='Experiments', domain=domain)

        prompt_a = Prompt(
            title='Focus Finder',
            content='Build a focus plan for the day.',
            subtopic=insights,
        )
        prompt_b = Prompt(
            title='Morning Routine',
            content='Start every morning with a focus review.',
            subtopic=insights,
        )
        prompt_c = Prompt(
            title='Experiment Tracker',
            content='Log nightly learnings from experiments.',
            subtopic=experiments,
        )

        db.session.add_all([domain, prompt_a, prompt_b, prompt_c])
        db.session.commit()

    response = client.get('/api/search', query_string={'q': 'focus'})
    assert response.status_code == 200
    data = response.get_json()
    titles = {item['title'] for item in data}
    assert titles == {'Focus Finder', 'Morning Routine'}
    assert all(item['domain_name'] == 'Product Discovery' for item in data)

    content_response = client.get('/api/search', query_string={'q': 'nightly'})
    assert content_response.status_code == 200
    content_results = content_response.get_json()
    assert [item['title'] for item in content_results] == ['Experiment Tracker']


def test_search_endpoint_handles_empty_or_missing_query(app, client):
    """Blank search queries should return an empty list without errors."""

    empty_response = client.get('/api/search', query_string={'q': ''})
    assert empty_response.status_code == 200
    assert empty_response.get_json() == []

    missing_response = client.get('/api/search')
    assert missing_response.status_code == 200
    assert missing_response.get_json() == []


def test_search_endpoint_returns_empty_for_no_matches(app, client):
    """Searching with no matching prompts should return an empty collection."""

    with app.app_context():
        domain = Domain(name='Wellness')
        subtopic = Subtopic(name='Habits', domain=domain)
        db.session.add_all([
            domain,
            Prompt(title='Gratitude Journal', content='Write three gratitudes.', subtopic=subtopic),
        ])
        db.session.commit()

    response = client.get('/api/search', query_string={'q': 'prototype'})
    assert response.status_code == 200
    assert response.get_json() == []


def test_api_unknown_route_returns_json_error(client):
    """Requesting an undefined API route should yield a JSON error payload."""

    response = client.get('/api/does-not-exist')
    assert response.status_code == 404
    assert response.mimetype == 'application/json'
    payload = response.get_json()
    assert isinstance(payload, dict)
    assert 'error' in payload and payload['error']
