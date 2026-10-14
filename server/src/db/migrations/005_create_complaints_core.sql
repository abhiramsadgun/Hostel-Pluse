-- Migration 005: Create Complaint Management Core Tables
-- Covers Hackathon Outcomes:
-- 1. complaint_counter (safe concurrency ID generation HCM-YYYY-XXXXXX)
-- 2. Seed 8 core complaint categories with severity weights and SLA hours
-- 3. complaints table (title, description, auto room, anonymous, priority score, AI predictions)
-- 4. complaint_images (before and after photo attachments via Multer)
-- 5. complaint_votes ("I'm also affected" upvote system)
-- 6. status_logs (Submitted -> Assigned -> In Progress -> Resolved -> Closed -> Reopened)
-- 7. resolution_history (historical turnaround records for AI predictor)
-- 8. complaint_feedback (star rating 1-5 and student comments)
-- 9. recurring_issue_flags (detect 3+ occurrences in 30 days)

-- 1. Concurrency-safe readable ID counter
CREATE TABLE IF NOT EXISTS complaint_counter (
    year INT PRIMARY KEY,
    last_val INT NOT NULL DEFAULT 0
);

-- Seed/Upsert 8 Core Hackathon Categories
INSERT INTO complaint_categories (name, key, department, severity_weight, sla_hours, description, is_active)
VALUES
    ('Plumbing & Water Supply', 'plumbing', 'maintenance', 75, 12, 'Leaking pipes, tap damage, clogged drainage, toilet flush issues, water pressure', TRUE),
    ('Electrical & Lighting', 'electrical', 'maintenance', 80, 12, 'Power failure, tube lights, ceiling fans, switchboard spark, MCB trip, geyser malfunction', TRUE),
    ('Carpentry & Furniture', 'furniture', 'maintenance', 45, 48, 'Broken study desk, chair damage, cot repair, wardrobe hinges, window latch, door locks', TRUE),
    ('Cleanliness & Hygiene', 'cleanliness', 'maintenance', 50, 24, 'Room dusting, dustbin clearing, common washroom hygiene, corridor sweeping, pest control', TRUE),
    ('Wi-Fi & LAN Network', 'internet', 'maintenance', 65, 18, 'No internet access, weak Wi-Fi signal, broken Ethernet RJ45 port, slow connection', TRUE),
    ('Mess & Food Quality', 'mess', 'mess', 70, 12, 'Food hygiene, foreign objects, undercooked meals, delayed service, drinking water in dining hall', TRUE),
    ('Security & Gate Entry', 'security', 'security', 90, 6, 'Lost ID cards, unauthorized entry, biometric turnstile error, late check-in dispute, corridor safety', TRUE),
    ('Other Campus Support', 'other', 'maintenance', 30, 72, 'General infrastructure inquiries, miscellaneous campus facilities, non-urgent student support', TRUE)
ON CONFLICT (name) DO UPDATE SET
    key = EXCLUDED.key,
    department = EXCLUDED.department,
    severity_weight = EXCLUDED.severity_weight,
    sla_hours = EXCLUDED.sla_hours,
    description = EXCLUDED.description;

-- 2. Core Complaints Table
CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY,
    complaint_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category_id INT REFERENCES complaint_categories(id) ON DELETE SET NULL,
    category_key VARCHAR(50) NOT NULL,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    block_id INT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    room_id INT REFERENCES rooms(id) ON DELETE SET NULL,
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'Submitted',
    priority_score NUMERIC(10,2) NOT NULL DEFAULT 0,
    predicted_hours NUMERIC(6,1) NOT NULL DEFAULT 24.0,
    predicted_resolution_at TIMESTAMP WITH TIME ZONE,
    sla_hours INT NOT NULL DEFAULT 24,
    is_overdue BOOLEAN NOT NULL DEFAULT FALSE,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    affected_count INT NOT NULL DEFAULT 1,
    assigned_staff_id INT REFERENCES staff_profiles(id) ON DELETE SET NULL,
    assigned_note TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    parent_complaint_id INT REFERENCES complaints(id) ON DELETE SET NULL,
    ai_confidence NUMERIC(5,2) DEFAULT 0,
    ai_suggested_category VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Photo Attachments (up to 4 before photos, plus staff after photo)
CREATE TABLE IF NOT EXISTS complaint_images (
    id SERIAL PRIMARY KEY,
    complaint_id INT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    image_url VARCHAR(255) NOT NULL,
    image_type VARCHAR(20) NOT NULL DEFAULT 'before',
    caption VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Upvotes ("I'm also affected")
CREATE TABLE IF NOT EXISTS complaint_votes (
    id SERIAL PRIMARY KEY,
    complaint_id INT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_complaint_student_vote UNIQUE (complaint_id, student_id)
);

-- 5. Status Logs (Audit trail for status changes)
CREATE TABLE IF NOT EXISTS status_logs (
    id SERIAL PRIMARY KEY,
    complaint_id INT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    actor_id INT REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(50),
    actor_name VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Resolution History (For AI Resolution Time Predictor)
CREATE TABLE IF NOT EXISTS resolution_history (
    id SERIAL PRIMARY KEY,
    complaint_id INT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    category_key VARCHAR(50) NOT NULL,
    assigned_staff_id INT REFERENCES staff_profiles(id) ON DELETE SET NULL,
    resolution_hours NUMERIC(8,2) NOT NULL,
    resolution_notes TEXT,
    after_photo_url VARCHAR(255),
    resolved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Student Feedback & Rating
CREATE TABLE IF NOT EXISTS complaint_feedback (
    id SERIAL PRIMARY KEY,
    complaint_id INT UNIQUE NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Recurring Issue Flags
CREATE TABLE IF NOT EXISTS recurring_issue_flags (
    id SERIAL PRIMARY KEY,
    category_key VARCHAR(50) NOT NULL,
    block_id INT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    room_id INT REFERENCES rooms(id) ON DELETE SET NULL,
    scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('room', 'block')),
    occurrence_count INT NOT NULL DEFAULT 3,
    first_reported_at TIMESTAMP WITH TIME ZONE,
    last_reported_at TIMESTAMP WITH TIME ZONE,
    complaint_ids JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    flagged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for lightning-fast queries and warden dashboard filters
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_block_status ON complaints(block_id, status);
CREATE INDEX IF NOT EXISTS idx_complaints_student ON complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_complaints_room ON complaints(room_id);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category_key);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_staff ON complaints(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_overdue ON complaints(is_overdue);
CREATE INDEX IF NOT EXISTS idx_complaint_votes_comp ON complaint_votes(complaint_id);
CREATE INDEX IF NOT EXISTS idx_status_logs_comp ON status_logs(complaint_id);
CREATE INDEX IF NOT EXISTS idx_res_hist_cat ON resolution_history(category_key);
CREATE INDEX IF NOT EXISTS idx_recur_block_cat ON recurring_issue_flags(block_id, category_key);
