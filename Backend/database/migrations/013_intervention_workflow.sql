ALTER TABLE interventions
    ADD COLUMN IF NOT EXISTS creation_type VARCHAR(20) NOT NULL DEFAULT 'PLANIFIEE'
        CHECK (creation_type IN ('PLANIFIEE', 'RAPPORT_DIRECT'));

CREATE INDEX IF NOT EXISTS interventions_creation_type_idx
    ON interventions (entreprise_id, creation_type, date_intervention);
