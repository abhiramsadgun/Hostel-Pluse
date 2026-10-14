-- Migration 004: Create Food Menu Templates, Meal Preferences, Complaint Categories, and System Settings
-- Core food management and foundation seeds

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaint_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    key VARCHAR(50) UNIQUE,
    department VARCHAR(50) NOT NULL,
    severity_weight INT NOT NULL DEFAULT 50,
    sla_hours INT NOT NULL DEFAULT 24,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Weekly menu template (Monday = 1, Sunday = 7)
CREATE TABLE IF NOT EXISTS menu_templates (
    id SERIAL PRIMARY KEY,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    day_name VARCHAR(15) NOT NULL,
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snacks', 'dinner')),
    meal_time VARCHAR(50) NOT NULL,
    veg_items TEXT NOT NULL,
    nonveg_items TEXT DEFAULT '',
    nonveg_available BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_template_day_meal UNIQUE (day_of_week, meal_type)
);

-- Student daily meal choices (confirmed or overridden before cutoff)
CREATE TABLE IF NOT EXISTS meal_preferences (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    meal_type VARCHAR(20) NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snacks', 'dinner')),
    choice VARCHAR(10) NOT NULL CHECK (choice IN ('veg', 'non_veg')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_date_meal UNIQUE (student_id, date, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_meal_pref_date_meal ON meal_preferences(date, meal_type);
CREATE INDEX IF NOT EXISTS idx_meal_pref_student ON meal_preferences(student_id);
CREATE INDEX IF NOT EXISTS idx_menu_template_day ON menu_templates(day_of_week);
CREATE INDEX IF NOT EXISTS idx_complaint_cat_dept ON complaint_categories(department);
