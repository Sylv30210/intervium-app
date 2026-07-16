CREATE TABLE IF NOT EXISTS connexions_google (
    utilisateur_id BIGINT NOT NULL,
    entreprise_id BIGINT NOT NULL,
    email_google VARCHAR(254) NOT NULL,
    refresh_token_chiffre TEXT NOT NULL,
    scope TEXT NOT NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (utilisateur_id, entreprise_id),
    FOREIGN KEY (utilisateur_id, entreprise_id)
        REFERENCES utilisateurs(id, entreprise_id) ON DELETE CASCADE
);
