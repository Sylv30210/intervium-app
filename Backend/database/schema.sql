BEGIN;

-- Chaque ressource métier porte entreprise_id. Les contraintes composites
-- empêchent une référence vers une ligne appartenant à un autre tenant.

CREATE TABLE entreprises (
    id BIGSERIAL PRIMARY KEY,
    nom VARCHAR(150) NOT NULL CHECK (btrim(nom) <> ''),
    logo_url TEXT,
    report_settings JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(report_settings) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE utilisateurs (
    id BIGSERIAL PRIMARY KEY,
    entreprise_id BIGINT NOT NULL,
    nom VARCHAR(100) NOT NULL CHECK (btrim(nom) <> ''),
    email VARCHAR(254) NOT NULL CHECK (btrim(email) <> ''),
    password TEXT NOT NULL CHECK (length(password) > 0),
    role VARCHAR(20) NOT NULL DEFAULT 'TECHNICIEN'
        CHECK (role IN ('ADMIN', 'TECHNICIEN', 'CLIENT')),
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT utilisateurs_entreprise_fk
        FOREIGN KEY (entreprise_id) REFERENCES entreprises(id) ON DELETE CASCADE,
    CONSTRAINT utilisateurs_id_entreprise_unique UNIQUE (id, entreprise_id),
    CONSTRAINT utilisateurs_email_unique UNIQUE (email)
);

CREATE TABLE clients (
    id BIGSERIAL PRIMARY KEY,
    entreprise_id BIGINT NOT NULL,
    utilisateur_id BIGINT,
    nom VARCHAR(150) NOT NULL CHECK (btrim(nom) <> ''),
    email VARCHAR(254),
    telephone VARCHAR(30),
    adresse TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT clients_entreprise_fk
        FOREIGN KEY (entreprise_id) REFERENCES entreprises(id) ON DELETE CASCADE,
    CONSTRAINT clients_utilisateur_tenant_fk
        FOREIGN KEY (utilisateur_id, entreprise_id)
        REFERENCES utilisateurs(id, entreprise_id) ON DELETE RESTRICT,
    CONSTRAINT clients_id_entreprise_unique UNIQUE (id, entreprise_id),
    CONSTRAINT clients_utilisateur_unique UNIQUE (utilisateur_id)
);

CREATE TABLE equipements (
    id BIGSERIAL PRIMARY KEY,
    entreprise_id BIGINT NOT NULL,
    client_id BIGINT NOT NULL,
    type VARCHAR(100),
    modele VARCHAR(150),
    numero_serie VARCHAR(150),
    date_installation DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT equipements_entreprise_fk
        FOREIGN KEY (entreprise_id) REFERENCES entreprises(id) ON DELETE CASCADE,
    CONSTRAINT equipements_client_tenant_fk
        FOREIGN KEY (client_id, entreprise_id)
        REFERENCES clients(id, entreprise_id) ON DELETE CASCADE,
    CONSTRAINT equipements_id_entreprise_unique UNIQUE (id, entreprise_id),
    CONSTRAINT equipements_id_client_entreprise_unique
        UNIQUE (id, client_id, entreprise_id),
    CONSTRAINT equipements_numero_serie_tenant_unique
        UNIQUE (entreprise_id, numero_serie)
);

CREATE TABLE modeles_rapport (
    id BIGSERIAL PRIMARY KEY,
    entreprise_id BIGINT NOT NULL,
    createur_id BIGINT NOT NULL,
    nom VARCHAR(150) NOT NULL CHECK (btrim(nom) <> ''),
    description TEXT,
    sections JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(sections) = 'array'),
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT modeles_rapport_entreprise_fk
        FOREIGN KEY (entreprise_id) REFERENCES entreprises(id) ON DELETE CASCADE,
    CONSTRAINT modeles_rapport_createur_tenant_fk
        FOREIGN KEY (createur_id, entreprise_id)
        REFERENCES utilisateurs(id, entreprise_id) ON DELETE RESTRICT,
    CONSTRAINT modeles_rapport_id_entreprise_unique UNIQUE (id, entreprise_id),
    CONSTRAINT modeles_rapport_nom_tenant_unique UNIQUE (entreprise_id, nom)
);

CREATE TABLE interventions (
    id BIGSERIAL PRIMARY KEY,
    entreprise_id BIGINT NOT NULL,
    client_id BIGINT NOT NULL,
    equipement_id BIGINT,
    technicien_id BIGINT,
    titre VARCHAR(200) NOT NULL CHECK (btrim(titre) <> ''),
    description TEXT,
    compte_rendu TEXT,
    statut VARCHAR(30) NOT NULL DEFAULT 'PLANIFIEE'
        CHECK (statut IN ('PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE')),
    date_intervention DATE,
    heure TIME,
    signature_url TEXT,
    modele_rapport_id BIGINT,
    donnees_rapport JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(donnees_rapport) = 'object'),
    modele_rapport_snapshot JSONB
        CHECK (modele_rapport_snapshot IS NULL OR jsonb_typeof(modele_rapport_snapshot) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT interventions_entreprise_fk
        FOREIGN KEY (entreprise_id) REFERENCES entreprises(id) ON DELETE CASCADE,
    CONSTRAINT interventions_client_tenant_fk
        FOREIGN KEY (client_id, entreprise_id)
        REFERENCES clients(id, entreprise_id) ON DELETE RESTRICT,
    CONSTRAINT interventions_equipement_client_tenant_fk
        FOREIGN KEY (equipement_id, client_id, entreprise_id)
        REFERENCES equipements(id, client_id, entreprise_id) ON DELETE RESTRICT,
    CONSTRAINT interventions_technicien_tenant_fk
        FOREIGN KEY (technicien_id, entreprise_id)
        REFERENCES utilisateurs(id, entreprise_id) ON DELETE RESTRICT,
    CONSTRAINT interventions_modele_tenant_fk
        FOREIGN KEY (modele_rapport_id, entreprise_id)
        REFERENCES modeles_rapport(id, entreprise_id) ON DELETE RESTRICT,
    CONSTRAINT interventions_id_entreprise_unique UNIQUE (id, entreprise_id)
);

CREATE TABLE documents_commerciaux (
    id BIGSERIAL PRIMARY KEY,
    entreprise_id BIGINT NOT NULL,
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
    CONSTRAINT documents_entreprise_fk
        FOREIGN KEY (entreprise_id) REFERENCES entreprises(id) ON DELETE CASCADE,
    CONSTRAINT documents_client_tenant_fk
        FOREIGN KEY (client_id, entreprise_id)
        REFERENCES clients(id, entreprise_id) ON DELETE RESTRICT,
    CONSTRAINT documents_createur_tenant_fk
        FOREIGN KEY (createur_id, entreprise_id)
        REFERENCES utilisateurs(id, entreprise_id) ON DELETE RESTRICT,
    CONSTRAINT documents_numero_tenant_unique UNIQUE (entreprise_id, numero),
    CONSTRAINT documents_id_entreprise_unique UNIQUE (id, entreprise_id)
);

CREATE TABLE photos (
    id BIGSERIAL PRIMARY KEY,
    entreprise_id BIGINT NOT NULL,
    intervention_id BIGINT NOT NULL,
    url TEXT NOT NULL CHECK (btrim(url) <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT photos_entreprise_fk
        FOREIGN KEY (entreprise_id) REFERENCES entreprises(id) ON DELETE CASCADE,
    CONSTRAINT photos_intervention_tenant_fk
        FOREIGN KEY (intervention_id, entreprise_id)
        REFERENCES interventions(id, entreprise_id) ON DELETE CASCADE
);

CREATE INDEX utilisateurs_entreprise_idx ON utilisateurs (entreprise_id);
CREATE INDEX clients_entreprise_idx ON clients (entreprise_id);
CREATE INDEX equipements_client_idx ON equipements (entreprise_id, client_id);
CREATE INDEX interventions_client_idx ON interventions (entreprise_id, client_id);
CREATE INDEX interventions_technicien_idx ON interventions (entreprise_id, technicien_id);
CREATE INDEX interventions_equipement_idx ON interventions (entreprise_id, equipement_id);
CREATE INDEX interventions_planning_idx
    ON interventions (entreprise_id, date_intervention, heure);
CREATE INDEX photos_intervention_idx ON photos (entreprise_id, intervention_id);
CREATE INDEX modeles_rapport_entreprise_idx ON modeles_rapport (entreprise_id, actif, nom);
CREATE INDEX documents_client_idx ON documents_commerciaux (entreprise_id, client_id);
CREATE INDEX documents_date_idx ON documents_commerciaux (entreprise_id, date_emission DESC);

COMMIT;
