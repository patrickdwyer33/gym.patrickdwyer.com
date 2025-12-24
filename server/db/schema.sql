-- Static reference data (seeded from CSV)
CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('Pull', 'Push', 'Legs', 'Core')),
    primary_variant TEXT,
    alternate_variant TEXT,
    no_equipment_variant TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exercise_groups (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    exercise1_id INTEGER NOT NULL,
    exercise2_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exercise1_id) REFERENCES exercises(id),
    FOREIGN KEY (exercise2_id) REFERENCES exercises(id)
);

CREATE TABLE IF NOT EXISTS schedule (
    day_number INTEGER PRIMARY KEY CHECK(day_number BETWEEN 1 AND 10),
    workout_id INTEGER NOT NULL,
    FOREIGN KEY (workout_id) REFERENCES exercise_groups(id)
);

-- User data (dynamic, synced)
CREATE TABLE IF NOT EXISTS workout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_date DATE NOT NULL,
    day_number INTEGER NOT NULL CHECK(day_number BETWEEN 1 AND 10),
    exercise_group_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('not_started', 'in_progress', 'completed')),
    notes TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Sync tracking
    sync_version INTEGER DEFAULT 0,
    last_synced_at TIMESTAMP,
    FOREIGN KEY (exercise_group_id) REFERENCES exercise_groups(id),
    UNIQUE(session_date)
);

CREATE TABLE IF NOT EXISTS workout_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    reps INTEGER,
    weight REAL,
    duration_seconds INTEGER,
    notes TEXT,
    completed BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Sync tracking
    sync_version INTEGER DEFAULT 0,
    last_synced_at TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id),
    UNIQUE(session_id, exercise_id, set_number)
);

CREATE TABLE IF NOT EXISTS rest_timers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    rest_duration_seconds INTEGER NOT NULL DEFAULT 90,
    timer_started_at TIMESTAMP,
    timer_completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

-- Configuration table for app settings
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_day ON workout_sessions(day_number);
CREATE INDEX IF NOT EXISTS idx_workout_sets_session ON workout_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_updated ON workout_sets(updated_at);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_updated ON workout_sessions(updated_at);
