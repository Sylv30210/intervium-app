CREATE TABLE IF NOT EXISTS contacts_clients (
    id BIGSERIAL PRIMARY KEY,
    entreprise_id BIGINT NOT NULL,
    client_id BIGINT NOT NULL,
    nom VARCHAR(150) NOT NULL CHECK (btrim(nom) <> ''),
    fonction VARCHAR(150),
    email VARCHAR(254),
    telephone VARCHAR(30),
    destinataire_rapport BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (entreprise_id) REFERENCES entreprises(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id, entreprise_id) REFERENCES clients(id, entreprise_id) ON DELETE CASCADE,
    UNIQUE (id, entreprise_id)
);

CREATE INDEX IF NOT EXISTS contacts_clients_client_idx ON contacts_clients (entreprise_id, client_id, nom);
