ALTER TABLE clients ADD COLUMN IF NOT EXISTS report_emails JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE clients ADD CONSTRAINT clients_report_emails_array_check CHECK (jsonb_typeof(report_emails) = 'array');
UPDATE clients SET report_emails = jsonb_build_array(email) WHERE email IS NOT NULL AND report_emails = '[]'::jsonb;
