ALTER TABLE interventions ADD COLUMN IF NOT EXISTS numero_rapport VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS interventions_numero_rapport_unique
    ON interventions (entreprise_id, numero_rapport) WHERE numero_rapport IS NOT NULL;
