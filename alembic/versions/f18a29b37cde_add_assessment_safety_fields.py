"""add_assessment_safety_fields

Revision ID: f18a29b37cde
Revises: e07bf34bf5cc
Create Date: 2026-10-13 11:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f18a29b37cde'
down_revision: Union[str, None] = 'e07bf34bf5cc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add safety status & assignment columns to assessments
    op.add_column('assessments', sa.Column('safety_status', sa.String(length=30), server_default='awaiting_assignment', nullable=False))
    op.add_column('assessments', sa.Column('assigned_by_id', sa.UUID(), nullable=True))
    op.add_column('assessments', sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('assessments', sa.Column('safety_notes', sa.Text(), nullable=True))

    # 2. Add foreign key and indexes
    op.create_foreign_key('fk_assessments_assigned_by_users', 'assessments', 'users', ['assigned_by_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_assessments_safety_status'), 'assessments', ['safety_status'], unique=False)

    # 3. Add check constraint
    op.create_check_constraint(
        'chk_assessment_safety_status',
        'assessments',
        "safety_status IN ('awaiting_assignment', 'assigned', 'under_review', 'resolved')"
    )

    # 4. Backfill existing records
    op.execute("""
        UPDATE assessments 
        SET safety_status = 'assigned' 
        WHERE doctor_id IS NOT NULL;
    """)
    op.execute("""
        UPDATE assessments 
        SET safety_status = 'resolved' 
        FROM reports 
        WHERE assessments.id = reports.assessment_id AND reports.physician_signed_off = True;
    """)


def downgrade() -> None:
    op.drop_constraint('chk_assessment_safety_status', 'assessments', type_='check')
    op.drop_constraint('fk_assessments_assigned_by_users', 'assessments', type_='foreignkey')
    op.drop_index(op.f('ix_assessments_safety_status'), table_name='assessments')
    op.drop_column('assessments', 'safety_notes')
    op.drop_column('assessments', 'assigned_at')
    op.drop_column('assessments', 'assigned_by_id')
    op.drop_column('assessments', 'safety_status')
