-- Migration 008: Create Health Assistance, Medicine Logs, Vehicle Requests, and Medicine Inventory
-- Privacy & Safety:
-- 1. Student health tickets with SOS instant escalation
-- 2. Allergy-matched medicine administration logs with audit tracking
-- 3. Campus medical van / ambulance emergency dispatch
-- 4. Central medical stock inventory with low-stock alerts

CREATE TABLE IF NOT EXISTS medicine_inventory (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    generic_name VARCHAR(100),
    category VARCHAR(50) NOT NULL DEFAULT 'General',
    stock_quantity INT NOT NULL DEFAULT 50,
    min_threshold INT NOT NULL DEFAULT 15,
    unit VARCHAR(30) NOT NULL DEFAULT 'tablets',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS health_tickets (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    block_id INT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    room_id INT REFERENCES rooms(id) ON DELETE SET NULL,
    symptoms TEXT NOT NULL,
    severity VARCHAR(30) NOT NULL CHECK (severity IN ('mild', 'moderate', 'emergency')),
    photo_url VARCHAR(255),
    is_sos BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'On The Way', 'Under Care', 'Hospital Referred', 'Resolved', 'Cancelled')),
    health_assistant_id INT REFERENCES users(id) ON DELETE SET NULL,
    observations TEXT,
    resolution_notes TEXT,
    hospital_name VARCHAR(150),
    vehicle_needed BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medicine_logs (
    id SERIAL PRIMARY KEY,
    health_ticket_id INT NOT NULL REFERENCES health_tickets(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    medicine_name VARCHAR(150) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    administered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    administered_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    allergy_warning_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    allergy_override_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_requests (
    id SERIAL PRIMARY KEY,
    health_ticket_id INT NOT NULL REFERENCES health_tickets(id) ON DELETE CASCADE,
    requested_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(50) NOT NULL DEFAULT 'Campus Medical Van' CHECK (vehicle_type IN ('Campus Medical Van', 'Ambulance', 'Hostel Emergency Cab')),
    hospital_name VARCHAR(150) NOT NULL,
    driver_contact VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'Requested' CHECK (status IN ('Requested', 'Dispatched', 'Reached Hospital', 'Completed', 'Cancelled')),
    dispatched_at TIMESTAMP WITH TIME ZONE,
    reached_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_health_student ON health_tickets(student_id);
CREATE INDEX IF NOT EXISTS idx_health_block_status ON health_tickets(block_id, status);
CREATE INDEX IF NOT EXISTS idx_health_severity ON health_tickets(severity);
CREATE INDEX IF NOT EXISTS idx_medicine_logs_ticket ON medicine_logs(health_ticket_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_req_ticket ON vehicle_requests(health_ticket_id);
