CREATE TABLE IF NOT EXISTS modeles_rapport (
    id BIGSERIAL PRIMARY KEY,
    entreprise_id BIGINT NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
    createur_id BIGINT NOT NULL,
    nom VARCHAR(150) NOT NULL CHECK (btrim(nom) <> ''),
    description TEXT,
    sections JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sections) = 'array'),
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (createur_id, entreprise_id)
        REFERENCES utilisateurs(id, entreprise_id) ON DELETE RESTRICT,
    UNIQUE (id, entreprise_id),
    UNIQUE (entreprise_id, nom)
);

ALTER TABLE interventions
    ADD COLUMN IF NOT EXISTS modele_rapport_id BIGINT,
    ADD COLUMN IF NOT EXISTS donnees_rapport JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'interventions_modele_tenant_fk'
    ) THEN
        ALTER TABLE interventions
            ADD CONSTRAINT interventions_modele_tenant_fk
            FOREIGN KEY (modele_rapport_id, entreprise_id)
            REFERENCES modeles_rapport(id, entreprise_id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS documents_commerciaux (
    id BIGSERIAL PRIMARY KEY,
    entreprise_id BIGINT NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
    client_id BIGINT NOT NULL,
    createur_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('DEVIS', 'FACTURE', 'AVOIR')),
    statut VARCHAR(20) NOT NULL DEFAULT 'BROUILLON'
        CHECK (statut IN ('BROUILLON', 'ENVOYE', 'ACCEPTE', 'PAYE', 'ANNULE')),
    numero VARCHAR(50),
    date_emission DATE NOT NULL DEFAULT CURRENT_DATE,
    date_echeance DATE,
    devise CHAR(3) NOT NULL DEFAULT 'EUR',
    mode_paiement VARCHAR(80),
    notes TEXT,
    lignes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(lignes) = 'array'),
    total_ht NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_ht >= 0),
    total_tva NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_tva >= 0),
    total_ttc NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_ttc >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (client_id, entreprise_id)
        REFERENCES clients(id, entreprise_id) ON DELETE RESTRICT,
    FOREIGN KEY (createur_id, entreprise_id)
        REFERENCES utilisateurs(id, entreprise_id) ON DELETE RESTRICT,
    UNIQUE (entreprise_id, numero),
    UNIQUE (id, entreprise_id)
);

CREATE INDEX IF NOT EXISTS modeles_rapport_entreprise_idx
    ON modeles_rapport (entreprise_id, actif, nom);
CREATE INDEX IF NOT EXISTS documents_client_idx
    ON documents_commerciaux (entreprise_id, client_id);
CREATE INDEX IF NOT EXISTS documents_date_idx
    ON documents_commerciaux (entreprise_id, date_emission DESC);
