-- Migration 006: Create Room Services Schedules and History
-- Supports routine room operations: laundry, house cleaning, pest control, deep sanitization

CREATE TABLE IF NOT EXISTS service_schedules (
    id SERIAL PRIMARY KEY,
    service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('house_cleaning', 'laundry', 'pest_control', 'deep_sanitization')),
    block_id INT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    room_id INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    scheduled_time VARCHAR(50) NOT NULL,
    recurrence VARCHAR(50) NOT NULL DEFAULT 'one_time' CHECK (recurrence IN ('one_time', 'weekly', 'bi_weekly', 'monthly')),
    assigned_staff_id INT REFERENCES staff_profiles(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Confirmed', 'Rescheduled', 'Away', 'In Progress', 'Completed', 'Cancelled')),
    student_acknowledgement VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (student_acknowledgement IN ('Pending', 'Confirmed', 'Rescheduled', 'Away')),
    student_notes TEXT,
    reschedule_preferred_date DATE,
    reschedule_preferred_time VARCHAR(50),
    completion_notes TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_services_room ON service_schedules(room_id);
CREATE INDEX IF NOT EXISTS idx_services_block ON service_schedules(block_id);
CREATE INDEX IF NOT EXISTS idx_services_staff ON service_schedules(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_services_date ON service_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_services_status ON service_schedules(status);
