ALTER TABLE interventions
    ADD COLUMN IF NOT EXISTS adresse_chantier TEXT,
    ADD COLUMN IF NOT EXISTS travaux_demandes TEXT;

COMMENT ON COLUMN interventions.adresse_chantier IS
    'Adresse propre au chantier, indépendante de l''adresse principale du client.';
COMMENT ON COLUMN interventions.travaux_demandes IS
    'Copie modifiable de l''objet de l''intervention destinée au rapport.';
