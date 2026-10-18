"""add_clinician_verification_fields

Revision ID: e07bf34bf5cc
Revises: 3cbcbee5bdd4
Create Date: 2026-10-13 10:44:58.243085

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e07bf34bf5cc'
down_revision: Union[str, None] = '3cbcbee5bdd4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add verification and info request columns to doctor_profiles
    op.add_column('doctor_profiles', sa.Column('verification_reference', sa.String(length=100), nullable=True))
    op.add_column('doctor_profiles', sa.Column('verification_notes', sa.Text(), nullable=True))
    op.add_column('doctor_profiles', sa.Column('more_info_request', sa.Text(), nullable=True))

    # 2. Update check constraint on doctor_profiles to include 'more_info_required'
    op.execute("ALTER TABLE doctor_profiles DROP CONSTRAINT IF EXISTS chk_doctor_approval_status;")
    op.create_check_constraint(
        'chk_doctor_approval_status',
        'doctor_profiles',
        "approval_status IN ('pending', 'approved', 'rejected', 'suspended', 'more_info_required')"
    )

    # 3. Backfill legacy approved doctors
    op.execute("UPDATE doctor_profiles SET verification_reference = 'LEGACY_VERIFIED', verification_notes = 'Pre-existing verified clinician account' WHERE approval_status = 'approved' AND verification_reference IS NULL;")


def downgrade() -> None:
    op.execute("ALTER TABLE doctor_profiles DROP CONSTRAINT IF EXISTS chk_doctor_approval_status;")
    op.create_check_constraint(
        'chk_doctor_approval_status',
        'doctor_profiles',
        "approval_status IN ('pending', 'approved', 'rejected', 'suspended')"
    )
    op.drop_column('doctor_profiles', 'more_info_request')
    op.drop_column('doctor_profiles', 'verification_notes')
    op.drop_column('doctor_profiles', 'verification_reference')

