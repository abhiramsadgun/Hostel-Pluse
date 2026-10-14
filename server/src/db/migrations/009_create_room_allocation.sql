-- Migration 009: Create Room Allocation, Groups, Peer Swaps, Waitlists, and Move History
-- Covers:
-- 1. room_groups & room_group_members (Same class & year peer group formation & invites)
-- 2. room_requests (GroupAllocation, IndividualTransfer, PeerSwap; Waitlist & Seniority scoring)
-- 3. room_history (Safe transactional audit trail for every resident room change)

CREATE TABLE IF NOT EXISTS room_groups (
    id SERIAL PRIMARY KEY,
    leader_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    group_name VARCHAR(100) NOT NULL,
    target_class VARCHAR(50) NOT NULL,
    target_year INT NOT NULL,
    target_gender VARCHAR(20) NOT NULL CHECK (target_gender IN ('male', 'female', 'other')),
    status VARCHAR(50) NOT NULL DEFAULT 'Forming' CHECK (status IN ('Forming', 'Ready', 'Submitted', 'Allocated', 'Disbanded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS room_group_members (
    id SERIAL PRIMARY KEY,
    group_id INT NOT NULL REFERENCES room_groups(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    invite_status VARCHAR(50) NOT NULL DEFAULT 'Invited' CHECK (invite_status IN ('Invited', 'Accepted', 'Declined', 'Leader')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (group_id, student_id)
);

CREATE TABLE IF NOT EXISTS room_requests (
    id SERIAL PRIMARY KEY,
    request_type VARCHAR(50) NOT NULL DEFAULT 'GroupAllocation' CHECK (request_type IN ('GroupAllocation', 'IndividualTransfer', 'PeerSwap')),
    group_id INT REFERENCES room_groups(id) ON DELETE SET NULL,
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    block_id INT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    preferred_room_id INT REFERENCES rooms(id) ON DELETE SET NULL,
    swap_with_student_id INT REFERENCES students(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Waitlisted', 'Approved', 'Allocated', 'Rejected', 'Cancelled')),
    queue_position INT DEFAULT 0,
    seniority_score INT NOT NULL DEFAULT 0,
    warden_notes TEXT,
    reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS room_history (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    from_room_id INT REFERENCES rooms(id) ON DELETE SET NULL,
    to_room_id INT REFERENCES rooms(id) ON DELETE SET NULL,
    move_type VARCHAR(50) NOT NULL CHECK (move_type IN ('InitialAssignment', 'GroupAllocation', 'Transfer', 'Swap', 'CheckOut')),
    authorized_by INT REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    moved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_room_groups_leader ON room_groups(leader_id);
CREATE INDEX IF NOT EXISTS idx_group_members_student ON room_group_members(student_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON room_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_room_req_group ON room_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_room_req_room ON room_requests(preferred_room_id);
CREATE INDEX IF NOT EXISTS idx_room_req_status ON room_requests(status);
CREATE INDEX IF NOT EXISTS idx_room_history_student ON room_history(student_id);
