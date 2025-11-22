"""add prompt_images

Revision ID: 1af86a7ff09a
Revises: b11338531698
Create Date: 2025-11-22 13:37:58.159245

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1af86a7ff09a'
down_revision = 'b11338531698'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # If the table does not exist (fresh DB), create it directly.
    if 'prompt_images' not in inspector.get_table_names():
        op.create_table(
            'prompt_images',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('prompt_id', sa.Integer(), sa.ForeignKey('prompts.id', ondelete='CASCADE'), nullable=False),
            sa.Column('filename', sa.String(length=256), nullable=False),
            sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        )
        return

    columns = {col['name'] for col in inspector.get_columns('prompt_images')}
    # If already migrated (both cols present), nothing to do.
    if 'filename' in columns and 'sort_order' in columns:
        return

    # Handle legacy column name
    if 'filename' not in columns and 'file_path' in columns:
        op.alter_column('prompt_images', 'file_path', new_column_name='filename', existing_type=sa.String(length=256))

    # Add missing sort_order if needed (SQLite supports add column).
    if 'sort_order' not in columns:
        op.add_column('prompt_images', sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    op.drop_table('prompt_images')
