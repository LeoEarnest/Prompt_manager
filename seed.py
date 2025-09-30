"""Seed the database with initial data for development and testing."""
from __future__ import annotations

from app import create_app, db
from app.models import Domain, Prompt, Subtopic

SAMPLE_DATA = [
    {
        'name': '代码编程',
        'subtopics': [
            {
                'name': 'Python Flask',
                'prompts': [
                    {
                        'title': '生成路由',
                        'content': (
                            'You are a backend assistant. Given a feature description, '
                            'produce Flask route handlers with sqlalchemy integration.'
                        ),
                    },
                    {
                        'title': '调试帮助',
                        'content': (
                            'Act as a debugging partner. When given a stack trace, '
                            'suggest targeted hypotheses and reproduction steps.'
                        ),
                    },
                ],
            },
            {
                'name': 'JavaScript 工具',
                'prompts': [
                    {
                        'title': '性能剖析',
                        'content': (
                            'Analyse a web app performance profile and list concrete '
                            'optimisations ordered by expected impact.'
                        ),
                    }
                ],
            },
        ],
    },
    {
        'name': '创意写作',
        'subtopics': [
            {
                'name': '科幻小说',
                'prompts': [
                    {
                        'title': '世界观设定',
                        'content': (
                            'Create a speculative fiction setting outline with technology, '
                            'societal shifts, and key conflicts.'
                        ),
                    },
                    {
                        'title': '角色深描',
                        'content': (
                            'Given a character archetype, expand with motivations, '
                            'fears, and a pivotal decision point.'
                        ),
                    },
                ],
            },
            {
                'name': '诗歌灵感',
                'prompts': [
                    {
                        'title': '意象探索',
                        'content': (
                            'Generate layered imagery around a central theme using vivid '
                            'sensory language and varied rhythm.'
                        ),
                    }
                ],
            },
        ],
    },
]


def seed() -> None:
    """Reset the database and populate it with sample content."""

    app = create_app()
    with app.app_context():
        db.drop_all()
        db.create_all()

        for domain_data in SAMPLE_DATA:
            domain = Domain(name=domain_data['name'])
            for subtopic_data in domain_data['subtopics']:
                subtopic = Subtopic(name=subtopic_data['name'], domain=domain)
                for prompt_data in subtopic_data['prompts']:
                    Prompt(
                        title=prompt_data['title'],
                        content=prompt_data['content'],
                        subtopic=subtopic,
                    )
            db.session.add(domain)

        db.session.commit()
        print('Database seeded successfully.')


if __name__ == '__main__':
    seed()
