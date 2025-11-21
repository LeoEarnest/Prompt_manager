import pytest
from playwright.sync_api import Page, expect
import multiprocessing
import time
from app import create_app, db
from app.models import Domain, Prompt, Subtopic

# Mark all tests in this module as requiring Playwright
pytestmark = pytest.mark.playwright

# --- Top-level function for multiprocessing ---
# This function must be at the top level to be pickleable by multiprocessing on Windows.
def run_app(host, port, db_uri):
    """
    Creates, seeds, and runs the Flask app.
    This function is the target for the background process.
    """
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': db_uri,
        'SERVER_NAME': f'{host}:{port}'
    })

    with app.app_context():
        db.create_all()

        # Clear and seed the database
        db.session.query(Prompt).delete()
        db.session.query(Subtopic).delete()
        db.session.query(Domain).delete()

        domain1 = Domain(name="Software Development")
        domain2 = Domain(name="Creative Writing")

        subtopic1_1 = Subtopic(name="Python", domain=domain1)
        subtopic1_2 = Subtopic(name="JavaScript", domain=domain1)
        subtopic2_1 = Subtopic(name="Fiction", domain=domain2)

        prompt1 = Prompt(title="Flask Blueprint Setup", content="How to set up Flask Blueprints...", subtopic=subtopic1_1)
        prompt2 = Prompt(title="React Hooks", content="Explain useEffect and useState.", subtopic=subtopic1_2)
        prompt3 = Prompt(title="Character Backstory", content="Create a backstory for a rogue.", subtopic=subtopic2_1)

        db.session.add_all([domain1, domain2, subtopic1_1, subtopic1_2, subtopic2_1, prompt1, prompt2, prompt3])
        db.session.commit()
    
    # Use a production-ready server
    from waitress import serve
    serve(app, host=host, port=port)

# --- Server Fixture ---
@pytest.fixture(scope="session")
def running_server():
    """
    Fixture to run the Flask app in a background process.
    """
    host = "127.0.0.1"
    port = 5002  # Use a another different port
    base_url = f"http://{host}:{port}"
    db_uri = 'sqlite:///test_frontend_main.db'

    # The target function and its arguments must be serializable.
    server_process = multiprocessing.Process(
        target=run_app,
        args=(host, port, db_uri),
        daemon=True
    )
    server_process.start()
    
    # Give the server time to start up and create the database.
    time.sleep(3)

    yield base_url

    server_process.terminate()
    server_process.join()

def test_collapsible_menu(running_server, page: Page):
    """
    Test that the navigation menu correctly collapses and expands.
    """
    page.goto(running_server)

    # Locate the main navigation headers and content
    domain_header_sd = page.locator(".domain-name:text('Software Development')")
    domain_header_cw = page.locator(".domain-name:text('Creative Writing')")
    
    subtopic_content_sd = domain_header_sd.locator('+ .collapsible-content')
    subtopic_content_cw = domain_header_cw.locator('+ .collapsible-content')

    # 1. Initial state: All subtopics and prompts should be hidden
    expect(subtopic_content_sd).to_be_hidden()
    expect(subtopic_content_cw).to_be_hidden()

    # 2. Click "Software Development" domain to expand it
    domain_header_sd.click()
    expect(subtopic_content_sd).to_be_visible()
    expect(subtopic_content_cw).to_be_hidden() # Creative Writing should still be hidden

    # Locate subtopic elements within the now-visible "Software Development" domain
    subtopic_header_python = subtopic_content_sd.locator(".subtopic-name:text('Python')")
    prompt_list_python = subtopic_header_python.locator('+ .collapsible-content')
    
    # Check that the prompt list under "Python" is initially hidden
    expect(prompt_list_python).to_be_hidden()

    # 3. Click "Python" subtopic to expand it
    subtopic_header_python.click()
    expect(prompt_list_python).to_be_visible()
    
    # Check that the prompt is visible
    prompt_button = prompt_list_python.locator(".prompt-button:text('Flask Blueprint Setup')")
    expect(prompt_button).to_be_visible()

    # 4. Click "Python" subtopic again to collapse it
    subtopic_header_python.click()
    expect(prompt_list_python).to_be_hidden()

    # 5. Click "Software Development" domain again to collapse it
    domain_header_sd.click()
    expect(subtopic_content_sd).to_be_hidden()
