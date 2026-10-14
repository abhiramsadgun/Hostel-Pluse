-- Migration 001: Create Blocks and Rooms
-- Core hostel physical infrastructure

CREATE TABLE IF NOT EXISTS blocks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    total_floors INT NOT NULL DEFAULT 4,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    block_id INT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    room_number VARCHAR(20) NOT NULL,
    floor INT NOT NULL,
    capacity INT NOT NULL DEFAULT 2,
    occupied_count INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'full', 'maintenance')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_block_room UNIQUE (block_id, room_number)
);

CREATE INDEX IF NOT EXISTS idx_rooms_block_id ON rooms(block_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_blocks_gender ON blocks(gender);
