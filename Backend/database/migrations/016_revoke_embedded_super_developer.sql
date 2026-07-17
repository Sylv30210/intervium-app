-- Révoque le compte créé par l'ancienne migration 015. Sa recréation doit être
-- réalisée explicitement avec la commande administrative provision-super-developer.
UPDATE utilisateurs
SET actif = FALSE,
    password = '$2b$12$invalidatedcredential000000000000000000000000000000000',
    doit_changer_mot_de_passe = TRUE,
    updated_at = NOW()
WHERE email = 'lecoeuvresylvain1@gmail.com'
  AND role = 'SUPER_DEVELOPPEUR';
