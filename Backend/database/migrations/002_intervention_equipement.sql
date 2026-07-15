ALTER TABLE equipements
    ADD COLUMN IF NOT EXISTS entreprise_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'equipements_id_client_entreprise_unique'
    ) THEN
        ALTER TABLE equipements
            ADD CONSTRAINT equipements_id_client_entreprise_unique
            UNIQUE (id, client_id, entreprise_id);
    END IF;
END $$;

ALTER TABLE interventions
    ADD COLUMN IF NOT EXISTS equipement_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'interventions_equipement_client_tenant_fk'
    ) THEN
        ALTER TABLE interventions
            ADD CONSTRAINT interventions_equipement_client_tenant_fk
            FOREIGN KEY (equipement_id, client_id, entreprise_id)
            REFERENCES equipements(id, client_id, entreprise_id)
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS interventions_equipement_idx
    ON interventions (entreprise_id, equipement_id);
