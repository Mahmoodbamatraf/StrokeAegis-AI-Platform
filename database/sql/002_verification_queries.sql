-- =============================================================================
-- StrokeAegis AI — Verification & Audit Queries
-- Version: 1.0.0
-- Purpose: Inspect and verify tables, constraints, foreign keys, and indexes in pgAdmin.
-- =============================================================================

-- 1. List all tables in public schema
SELECT tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 2. Verify all 9 expected tables exist
SELECT 
    t.table_name,
    COUNT(c.column_name) as column_count
FROM information_schema.tables t
JOIN information_schema.columns c 
    ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
    AND t.table_name IN (
        'users', 
        'doctor_profiles', 
        'patient_profiles', 
        'doctor_patient', 
        'assessments', 
        'reports', 
        'conversations', 
        'messages', 
        'notifications'
    )
GROUP BY t.table_name
ORDER BY t.table_name;

-- 3. Verify Foreign Keys and Cascade Actions
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 4. Verify Unique and Check Constraints
SELECT 
    conrelid::regclass AS table_name,
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
ORDER BY conrelid::regclass::text, contype;

-- 5. Verify Indexes created
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 6. Count rows in all application tables
SELECT 'users' AS table_name, count(*) AS total_records FROM users
UNION ALL
SELECT 'doctor_profiles', count(*) FROM doctor_profiles
UNION ALL
SELECT 'patient_profiles', count(*) FROM patient_profiles
UNION ALL
SELECT 'doctor_patient', count(*) FROM doctor_patient
UNION ALL
SELECT 'assessments', count(*) FROM assessments
UNION ALL
SELECT 'reports', count(*) FROM reports
UNION ALL
SELECT 'conversations', count(*) FROM conversations
UNION ALL
SELECT 'messages', count(*) FROM messages
UNION ALL
SELECT 'notifications', count(*) FROM notifications;
