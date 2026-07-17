ALTER TABLE utilisateurs
    ADD COLUMN IF NOT EXISTS conditions_version TEXT,
    ADD COLUMN IF NOT EXISTS conditions_acceptees_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cookies_choice TEXT NOT NULL DEFAULT 'necessary'
        CHECK (cookies_choice IN ('necessary', 'all'));
