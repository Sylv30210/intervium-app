ALTER TABLE utilisateurs DROP CONSTRAINT IF EXISTS utilisateurs_role_check;
ALTER TABLE utilisateurs ADD CONSTRAINT utilisateurs_role_check
    CHECK (role IN ('ADMIN', 'TECHNICIEN', 'CLIENT', 'SUPER_DEVELOPPEUR'));
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS doit_changer_mot_de_passe BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO utilisateurs (entreprise_id, nom, email, password, role, actif, doit_changer_mot_de_passe)
SELECT MIN(id), 'Super développeur', 'lecoeuvresylvain1@gmail.com',
       '$2a$12$BZLDDXR7FrabSyuWuxVeDOynRYhLvKRJTCgr.G9629QRjy8sd4XUq',
       'SUPER_DEVELOPPEUR', TRUE, TRUE
FROM entreprises
HAVING COUNT(*) > 0
ON CONFLICT (email) DO UPDATE SET role='SUPER_DEVELOPPEUR', actif=TRUE,
    password=EXCLUDED.password, doit_changer_mot_de_passe=TRUE, updated_at=NOW();
