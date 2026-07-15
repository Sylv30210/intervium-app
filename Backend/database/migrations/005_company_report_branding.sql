ALTER TABLE entreprises
    ADD COLUMN IF NOT EXISTS logo_url TEXT,
    ADD COLUMN IF NOT EXISTS report_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE entreprises
    DROP CONSTRAINT IF EXISTS entreprises_report_settings_object_check;

ALTER TABLE entreprises
    ADD CONSTRAINT entreprises_report_settings_object_check
    CHECK (jsonb_typeof(report_settings) = 'object');
