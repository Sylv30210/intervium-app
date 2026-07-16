ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(180);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_tenant_user_dedupe_idx
    ON notifications (entreprise_id, COALESCE(utilisateur_id, 0), COALESCE(role_cible, ''), dedupe_key)
    WHERE dedupe_key IS NOT NULL;
