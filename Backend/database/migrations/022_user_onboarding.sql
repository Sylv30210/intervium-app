ALTER TABLE utilisateurs
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE utilisateurs
    ALTER COLUMN cookies_choice DROP NOT NULL,
    ALTER COLUMN cookies_choice DROP DEFAULT;

UPDATE utilisateurs
SET cookies_choice = NULL
WHERE conditions_acceptees_at IS NULL;

-- Ne pas imposer rétroactivement le tutoriel aux comptes qui utilisaient déjà
-- l'application avant son introduction.
UPDATE utilisateurs
SET onboarding_completed = TRUE
WHERE conditions_acceptees_at IS NOT NULL;
