-- Migration 007: Create Digital Outpass, Parent Call Logs, and Security Gate Check Logs
-- Covers Student Life & Safety:
-- 1. outpass_counter (Safe unique ID generator OUT-YYYY-XXXXXX)
-- 2. outpasses (day, night, home, emergency; QR code data, parent consent)
-- 3. outpass_call_logs (Mandatory warden parental call verification trail)
-- 4. gate_logs (Security guard gate scan check-out and check-in log)

CREATE TABLE IF NOT EXISTS outpass_counter (
    year INT PRIMARY KEY,
    last_val INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS outpasses (
    id SERIAL PRIMARY KEY,
    outpass_number VARCHAR(50) UNIQUE NOT NULL,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    block_id INT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    room_id INT REFERENCES rooms(id) ON DELETE SET NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('day', 'night', 'home', 'emergency')),
    reason TEXT NOT NULL,
    destination VARCHAR(255) NOT NULL,
    out_time TIMESTAMP WITH TIME ZONE NOT NULL,
    expected_return_time TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_out_time TIMESTAMP WITH TIME ZONE,
    actual_return_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'Requested' CHECK (status IN ('Requested', 'Parent Contacted', 'Approved', 'Rejected', 'Out', 'Returned', 'Overdue', 'Cancelled')),
    qr_code_data TEXT,
    parent_name VARCHAR(150),
    parent_phone VARCHAR(50),
    parent_consent_status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (parent_consent_status IN ('Pending', 'consent_granted', 'consent_denied', 'unreachable', 'emergency_waived')),
    rejection_reason TEXT,
    warden_notes TEXT,
    approved_by INT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    is_late_return BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outpass_call_logs (
    id SERIAL PRIMARY KEY,
    outpass_id INT NOT NULL REFERENCES outpasses(id) ON DELETE CASCADE,
    warden_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_person VARCHAR(100) NOT NULL,
    phone_dialed VARCHAR(50) NOT NULL,
    call_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    response_status VARCHAR(50) NOT NULL CHECK (response_status IN ('consent_granted', 'consent_denied', 'no_answer', 'requested_callback')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gate_logs (
    id SERIAL PRIMARY KEY,
    outpass_id INT NOT NULL REFERENCES outpasses(id) ON DELETE CASCADE,
    security_guard_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('CHECK_OUT', 'CHECK_IN')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT,
    is_late BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_outpass_student ON outpasses(student_id);
CREATE INDEX IF NOT EXISTS idx_outpass_block_status ON outpasses(block_id, status);
CREATE INDEX IF NOT EXISTS idx_outpass_status ON outpasses(status);
CREATE INDEX IF NOT EXISTS idx_outpass_out_time ON outpasses(out_time);
CREATE INDEX IF NOT EXISTS idx_outpass_return_time ON outpasses(expected_return_time);
CREATE INDEX IF NOT EXISTS idx_call_logs_outpass ON outpass_call_logs(outpass_id);
CREATE INDEX IF NOT EXISTS idx_gate_logs_outpass ON gate_logs(outpass_id);
