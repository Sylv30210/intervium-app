ALTER TABLE interventions
    ADD COLUMN IF NOT EXISTS modele_rapport_snapshot JSONB;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'interventions_modele_rapport_snapshot_check'
    ) THEN
        ALTER TABLE interventions
            ADD CONSTRAINT interventions_modele_rapport_snapshot_check
            CHECK (
                modele_rapport_snapshot IS NULL
                OR jsonb_typeof(modele_rapport_snapshot) = 'object'
            );
    END IF;
END $$;

UPDATE interventions i
SET modele_rapport_snapshot = jsonb_build_object(
    'nom', m.nom,
    'description', m.description,
    'sections', m.sections
)
FROM modeles_rapport m
WHERE i.modele_rapport_id = m.id
  AND i.entreprise_id = m.entreprise_id
  AND i.modele_rapport_snapshot IS NULL;
