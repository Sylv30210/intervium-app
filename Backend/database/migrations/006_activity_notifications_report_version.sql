ALTER TABLE interventions
    ADD COLUMN IF NOT EXISTS report_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE modeles_rapport
    ADD COLUMN IF NOT EXISTS pdf_config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE modeles_rapport
    DROP CONSTRAINT IF EXISTS modeles_rapport_pdf_config_object_check;
ALTER TABLE modeles_rapport
    ADD CONSTRAINT modeles_rapport_pdf_config_object_check
    CHECK (jsonb_typeof(pdf_config) = 'object');

CREATE TABLE IF NOT EXISTS activites (
    id BIGSERIAL PRIMARY KEY,
    entreprise_id BIGINT NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
    utilisateur_id BIGINT REFERENCES utilisateurs(id) ON DELETE SET NULL,
    utilisateur_nom VARCHAR(150),
    utilisateur_role VARCHAR(20),
    action VARCHAR(60) NOT NULL,
    ressource_type VARCHAR(50) NOT NULL,
    ressource_id BIGINT,
    resume VARCHAR(500) NOT NULL,
    changements JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(changements) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    entreprise_id BIGINT NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
    utilisateur_id BIGINT REFERENCES utilisateurs(id) ON DELETE CASCADE,
    role_cible VARCHAR(20),
    type VARCHAR(60) NOT NULL,
    titre VARCHAR(180) NOT NULL,
    message VARCHAR(500) NOT NULL,
    ressource_type VARCHAR(50),
    ressource_id BIGINT,
    lu_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT notifications_target_check CHECK (utilisateur_id IS NOT NULL OR role_cible IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS activites_tenant_date_idx
    ON activites (entreprise_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS activites_tenant_resource_idx
    ON activites (entreprise_id, ressource_type, ressource_id);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
    ON notifications (entreprise_id, utilisateur_id, lu_at, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_role_unread_idx
    ON notifications (entreprise_id, role_cible, lu_at, created_at DESC);
CREATE INDEX IF NOT EXISTS interventions_tenant_updated_idx
    ON interventions (entreprise_id, updated_at DESC, id DESC);
