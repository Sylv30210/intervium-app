-- La migration 015 a été assainie après son application afin de retirer un
-- compte et un hash intégrés au dépôt. Accepte uniquement cette transition de
-- checksum connue ; tout autre écart continuera d'être signalé.
UPDATE schema_migrations
SET checksum = '82b2a44d3d2680ad5ef88d9b7a5c0a985f44ab8aad4049cff841d6a389804860'
WHERE filename = '015_super_developer.sql'
  AND checksum = '9a8c5e96e2b87184d0fca332cec9e451fe6c795afedec04255292341d847c26b';
