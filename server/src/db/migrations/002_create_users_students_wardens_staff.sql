-- Migration 002: Create Users, Students, Wardens, and Staff Tables
-- Strict unique constraints, foreign keys, and indexes

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('student', 'warden', 'admin', 'maintenance', 'health_assistant', 'security', 'mess')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'suspended')),
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS preloaded_wardens (
    id SERIAL PRIMARY KEY,
    college_id_number VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    block_id INT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    roll_number VARCHAR(50) UNIQUE NOT NULL,
    laminated_id_number VARCHAR(50) UNIQUE NOT NULL,
    id_card_image_url VARCHAR(255) NOT NULL,
    id_card_image_hash VARCHAR(64) NOT NULL,
    block_id INT NOT NULL REFERENCES blocks(id) ON DELETE RESTRICT,
    room_id INT REFERENCES rooms(id) ON DELETE SET NULL,
    full_name VARCHAR(150) NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    class_name VARCHAR(50) NOT NULL,
    academic_year INT NOT NULL,
    parent_name VARCHAR(150) NOT NULL,
    parent_phone VARCHAR(20) NOT NULL,
    emergency_contact VARCHAR(20) NOT NULL,
    allergies TEXT,
    diet_preference VARCHAR(10) NOT NULL DEFAULT 'veg' CHECK (diet_preference IN ('veg', 'non_veg')),
    rejection_reason TEXT,
    approved_by_warden_id INT,
    approved_at TIMESTAMP WITH TIME ZONE,
    joined_on DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wardens (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    college_id_number VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    block_id INT NOT NULL REFERENCES blocks(id) ON DELETE RESTRICT,
    is_night_deputy BOOLEAN NOT NULL DEFAULT FALSE,
    photo_url VARCHAR(255),
    approval_status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    staff_id_number VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL,
    designation VARCHAR(100),
    specialisations JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Essential Performance & Uniqueness Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE INDEX IF NOT EXISTS idx_students_roll ON students(roll_number);
CREATE INDEX IF NOT EXISTS idx_students_laminated_id ON students(laminated_id_number);
CREATE INDEX IF NOT EXISTS idx_students_image_hash ON students(id_card_image_hash);
CREATE INDEX IF NOT EXISTS idx_students_block_gender ON students(block_id, gender);

CREATE INDEX IF NOT EXISTS idx_wardens_college_id ON wardens(college_id_number);
CREATE INDEX IF NOT EXISTS idx_wardens_block_id ON wardens(block_id);
CREATE INDEX IF NOT EXISTS idx_staff_id_num ON staff_profiles(staff_id_number);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id, used);
