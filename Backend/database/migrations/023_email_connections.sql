CREATE TABLE IF NOT EXISTS connexions_email (
    id BIGSERIAL PRIMARY KEY,
    utilisateur_id BIGINT NOT NULL,
    entreprise_id BIGINT NOT NULL,
    fournisseur VARCHAR(40) NOT NULL,
    adresse_email VARCHAR(254) NOT NULL,
    nom_expediteur VARCHAR(150),
    type_connexion VARCHAR(10) NOT NULL CHECK (type_connexion IN ('OAUTH', 'SMTP')),
    oauth_access_token_chiffre TEXT,
    oauth_refresh_token_chiffre TEXT,
    oauth_expire_at TIMESTAMPTZ,
    oauth_scope TEXT,
    smtp_host VARCHAR(253),
    smtp_port INTEGER CHECK (smtp_port BETWEEN 1 AND 65535),
    smtp_securite VARCHAR(12) CHECK (smtp_securite IN ('TLS', 'STARTTLS', 'NONE')),
    smtp_auth_requise BOOLEAN NOT NULL DEFAULT TRUE,
    smtp_utilisateur VARCHAR(254),
    smtp_secret_chiffre TEXT,
    statut VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (statut IN ('ACTIVE', 'ERROR', 'REVOKED')),
    dernier_test_reussi_at TIMESTAMPTZ,
    derniere_erreur VARCHAR(500),
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (utilisateur_id, entreprise_id) REFERENCES utilisateurs(id, entreprise_id) ON DELETE CASCADE,
    UNIQUE (utilisateur_id, entreprise_id, fournisseur, adresse_email)
);

CREATE INDEX IF NOT EXISTS connexions_email_proprietaire_idx
    ON connexions_email (entreprise_id, utilisateur_id, updated_at DESC);

-- Reprise sans perte des connexions Gmail existantes. Les jetons restent dans
-- leur table historique jusqu'à leur prochaine reconnexion avec la clé unifiée.
INSERT INTO connexions_email
    (utilisateur_id, entreprise_id, fournisseur, adresse_email, type_connexion,
     oauth_refresh_token_chiffre, oauth_scope, connected_at, created_at, updated_at)
SELECT utilisateur_id, entreprise_id, 'google', lower(email_google), 'OAUTH',
       refresh_token_chiffre, scope, connected_at, connected_at, updated_at
FROM connexions_google
ON CONFLICT (utilisateur_id, entreprise_id, fournisseur, adresse_email) DO NOTHING;

CREATE TABLE IF NOT EXISTS journal_envois_email (
    id BIGSERIAL PRIMARY KEY,
    entreprise_id BIGINT NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
    utilisateur_id BIGINT REFERENCES utilisateurs(id) ON DELETE SET NULL,
    connexion_email_id BIGINT REFERENCES connexions_email(id) ON DELETE SET NULL,
    fournisseur VARCHAR(40) NOT NULL,
    nombre_destinataires INTEGER NOT NULL CHECK (nombre_destinataires BETWEEN 1 AND 50),
    taille_octets INTEGER NOT NULL CHECK (taille_octets >= 0),
    statut VARCHAR(20) NOT NULL CHECK (statut IN ('SENT', 'TEMPORARY_ERROR', 'PERMANENT_ERROR')),
    code_erreur VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS journal_envois_email_limite_idx
    ON journal_envois_email (entreprise_id, utilisateur_id, created_at DESC);
