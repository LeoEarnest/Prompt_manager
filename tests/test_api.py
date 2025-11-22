"""Tests covering the API endpoints for prompt retrieval."""
from io import BytesIO
from pathlib import Path

import pytest

from app import create_app, db
from app.models import Domain, Prompt, Subtopic


@pytest.fixture()
def app(tmp_path):
    upload_dir = tmp_path / 'uploads'
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'SQLALCHEMY_TRACK_MODIFICATIONS': False,
        'UPLOAD_FOLDER': upload_dir,
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
        options = {
            'creature': ['fox'],
            'action': ['scouting'],
        }
        prompt = Prompt(
            title='Persona builder',
            content='Draft a UX persona.',
            subtopic=subtopic,
            is_template=True,
            configurable_options=options,
        )

        db.session.add(domain)
        db.session.commit()

        prompt_id = prompt.id

    response = client.get(f'/api/prompts/{prompt_id}')
    assert response.status_code == 200
    payload = response.get_json()
    assert payload['id'] == prompt_id
    assert payload['title'] == 'Persona builder'
    assert payload['content'] == 'Draft a UX persona.'
    assert payload['is_template'] is True
    assert payload['configurable_options'] == options
    assert payload['images'] == []

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
    assert data['images'] == []
    assert isinstance(data['id'], int)
    assert data['is_template'] is False
    assert data['configurable_options'] is None
    assert data['images'] == []

    with app.app_context():
        stored = db.session.get(Prompt, data['id'])
        assert stored is not None
        assert stored.title == payload['title']
        assert stored.content == payload['content']
        subtopic = db.session.get(Subtopic, stored.subtopic_id)
        assert subtopic is not None
        assert subtopic.name == payload['subtopic_name']
        assert subtopic.domain.name == payload['domain_name']


def test_create_prompt_with_images(app, client, tmp_path):
    """Multipart payloads with images should attach files and return URLs."""

    response = client.post(
        '/api/prompts',
        data={
            'title': 'Style board',
            'content': 'Reference images for the style.',
            'domain_name': 'Design',
            'subtopic_name': 'Moodboard',
            'images': [
                (BytesIO(b'image-one'), 'one.png'),
                (BytesIO(b'image-two'), 'two.jpg'),
            ],
        },
    )

    assert response.status_code == 201
    data = response.get_json()
    assert len(data['images']) == 2
    assert all(item['url'].startswith('/uploads/') for item in data['images'])

    for item in data['images']:
        file_path = tmp_path / 'uploads' / Path(item['filename'])
        assert file_path.exists()


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

    payload = {
        'title': 'Updated title',
        'content': 'Updated content body',
        'domain_name': 'Writing Lab',
        'subtopic_name': 'Revision',
    }

    response = client.put(f'/api/prompts/{prompt_id}', json=payload)
    assert response.status_code == 200

    data = response.get_json()
    assert data['id'] == prompt_id
    assert data['title'] == payload['title']
    assert data['content'] == payload['content']
    assert data['subtopic_name'] == payload['subtopic_name']
    assert data['domain_name'] == payload['domain_name']
    assert isinstance(data['subtopic_id'], int)
    assert isinstance(data['domain_id'], int)

    with app.app_context():
        stored = db.session.get(Prompt, prompt_id)
        assert stored is not None
        assert stored.title == payload['title']
        assert stored.content == payload['content']
        subtopic = db.session.get(Subtopic, stored.subtopic_id)
        assert subtopic is not None
        assert subtopic.name == payload['subtopic_name']
        assert subtopic.domain.name == payload['domain_name']


def test_update_prompt_validation_and_missing(app, client):
    """Update routes should guard against invalid payloads and missing prompts."""

    with app.app_context():
        domain = Domain(name='Coaching')
        tactics = Subtopic(name='Tactics', domain=domain)
        prompt = Prompt(title='Gameplan', content='Initial draft', subtopic=tactics)
        db.session.add_all([domain, prompt])
        db.session.commit()

        prompt_id = prompt.id

    missing_payload = client.put(
        f'/api/prompts/{prompt_id}',
        json={
            'title': '',
            'content': '',
            'domain_name': 'Coaching',
            'subtopic_name': 'Tactics',
        },
    )
    assert missing_payload.status_code == 400
    errors = missing_payload.get_json()['errors']
    assert 'title' in errors and 'content' in errors

    missing_prompt = client.put(
        f'/api/prompts/{prompt_id + 999}',
        json={
            'title': 'New',
            'content': 'Body',
            'domain_name': 'Coaching',
            'subtopic_name': 'Tactics',
        },
    )
    assert missing_prompt.status_code == 404
    assert missing_prompt.get_json()['error'] == 'Prompt not found'

    missing_domain = client.put(
        f'/api/prompts/{prompt_id}',
        json={
            'title': 'Updated',
            'content': 'Body',
            'subtopic_name': 'Tactics',
        },
    )
    assert missing_domain.status_code == 400
    assert missing_domain.get_json()['errors']['domain_name'] == 'Domain name is required.'

    missing_subtopic = client.put(
        f'/api/prompts/{prompt_id}',
        json={
            'title': 'Updated',
            'content': 'Body',
            'domain_name': 'Coaching',
        },
    )
    assert missing_subtopic.status_code == 400
    assert missing_subtopic.get_json()['errors']['subtopic_name'] == 'Subtopic name is required.'


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


def test_create_prompt_reuses_and_is_case_insensitive(app, client):
    """Posting a prompt with existing names should reuse domain/subtopic."""

    with app.app_context():
        domain = Domain(name='General')
        subtopic = Subtopic(name='Notes', domain=domain)
        db.session.add_all([domain, subtopic])
        db.session.commit()

        assert Domain.query.count() == 1
        assert Subtopic.query.count() == 1

    payload = {
        'title': 'A new note',
        'content': 'Content for the note.',
        'domain_name': 'general',  # Lowercase
        'subtopic_name': 'notes',  # Lowercase
    }

    response = client.post('/api/prompts', json=payload)
    assert response.status_code == 201

    with app.app_context():
        assert Domain.query.count() == 1
        assert Subtopic.query.count() == 1

        created_prompt = Prompt.query.filter_by(title=payload['title']).first()
        assert created_prompt is not None
        assert created_prompt.subtopic.name == 'Notes'
        assert created_prompt.subtopic.domain.name == 'General'


def test_update_prompt_creates_new_classification(app, client):
    """Updating a prompt with a new domain/subtopic should create them."""

    with app.app_context():
        domain = Domain(name='Domain A')
        subtopic = Subtopic(name='Subtopic A', domain=domain)
        prompt = Prompt(title='Test', content='Test content', subtopic=subtopic)
        db.session.add_all([domain, subtopic, prompt])
        db.session.commit()

        prompt_id = prompt.id
        assert Domain.query.count() == 1
        assert Subtopic.query.count() == 1

    payload = {
        'title': 'Updated Title',
        'content': 'Updated content',
        'domain_name': 'Domain B',  # New domain
        'subtopic_name': 'Subtopic B',  # New subtopic
    }

    response = client.put(f'/api/prompts/{prompt_id}', json=payload)
    assert response.status_code == 200

    with app.app_context():
        assert Domain.query.count() == 2
        assert Subtopic.query.count() == 2

        updated_prompt = db.session.get(Prompt, prompt_id)
        assert updated_prompt is not None
        assert updated_prompt.subtopic.name == 'Subtopic B'
        assert updated_prompt.subtopic.domain.name == 'Domain B'

def test_delete_prompt_also_deletes_empty_parents(app, client):
    """Deleting the last prompt in a hierarchy should prune empty parents."""

    with app.app_context():
        domain = Domain(name='Pruning Test Domain')
        subtopic = Subtopic(name='Pruning Test Subtopic', domain=domain)
        prompt1 = Prompt(title='Prompt 1', content='...', subtopic=subtopic)
        prompt2 = Prompt(title='Prompt 2', content='...', subtopic=subtopic)
        db.session.add_all([domain, subtopic, prompt1, prompt2])
        db.session.commit()

        prompt1_id = prompt1.id
        prompt2_id = prompt2.id
        subtopic_id = subtopic.id
        domain_id = domain.id

        assert Domain.query.count() == 1
        assert Subtopic.query.count() == 1
        assert Prompt.query.count() == 2

    # Delete the first prompt, parents should remain
    res1 = client.delete(f'/api/prompts/{prompt1_id}')
    assert res1.status_code == 204

    with app.app_context():
        assert db.session.get(Domain, domain_id) is not None
        assert db.session.get(Subtopic, subtopic_id) is not None
        assert db.session.get(Prompt, prompt1_id) is None
        assert Prompt.query.count() == 1

    # Delete the second and last prompt, parents should be pruned
    res2 = client.delete(f'/api/prompts/{prompt2_id}')
    assert res2.status_code == 204

    with app.app_context():
        assert db.session.get(Domain, domain_id) is None
        assert db.session.get(Subtopic, subtopic_id) is None
        assert db.session.get(Prompt, prompt2_id) is None
        assert Domain.query.count() == 0
        assert Subtopic.query.count() == 0
        assert Prompt.query.count() == 0
