ALTER TABLE equipements
    ADD COLUMN IF NOT EXISTS marque VARCHAR(150),
    ADD COLUMN IF NOT EXISTS annee_installation SMALLINT;

UPDATE equipements
SET annee_installation = EXTRACT(YEAR FROM date_installation)::SMALLINT
WHERE annee_installation IS NULL AND date_installation IS NOT NULL;

ALTER TABLE equipements
    ADD CONSTRAINT equipements_annee_installation_check
    CHECK (annee_installation IS NULL OR annee_installation BETWEEN 1900 AND 2200);
