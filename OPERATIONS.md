# Exploitation Intervium

## Provisionner le super-développeur

Le compte n'est jamais créé par une migration. Depuis un terminal administratif éphémère, définir `DATABASE_URL`, `SUPER_DEVELOPER_EMAIL`, `SUPER_DEVELOPER_PASSWORD` et `TOTP_ENCRYPTION_KEY`, puis exécuter :

```sh
npm --prefix Backend run provision:super-developer
```

Scanner immédiatement l'URI TOTP affichée, vérifier la connexion, puis supprimer les variables `SUPER_DEVELOPER_EMAIL` et `SUPER_DEVELOPER_PASSWORD`. La clé `TOTP_ENCRYPTION_KEY` doit rester dans le gestionnaire de secrets du serveur.

## Déploiements

- `intervium-staging` suit `main` seulement après réussite des contrôles GitHub.
- la production `intervium` n'est plus déployée automatiquement ; une promotion manuelle est nécessaire après validation du staging ;
- créer le tag correspondant à la version après validation de production, par exemple `v2.2.0`.

## Sauvegardes

Activer les sauvegardes et la restauration point-in-time dans Neon. Vérifier mensuellement une restauration dans un projet isolé. Pour une deuxième copie, planifier un `pg_dump` chiffré vers un stockage privé avec une durée de conservation définie. Ne jamais déposer un dump dans Git, les logs ou les artefacts publics.

## Nettoyage de l'ancien secret Git

La suppression du hash dans la branche courante ne le retire pas des anciens commits. Après révocation du compte, utiliser `git filter-repo` dans un clone dédié, faire vérifier le résultat, prévenir tous les collaborateurs, puis remplacer l'historique distant. Tous les clones existants devront être recréés. Cette opération doit être planifiée séparément d'un déploiement applicatif.
