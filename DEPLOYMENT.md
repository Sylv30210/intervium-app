# Déploiement d'Intervium

## Variables de production

Obligatoires :

- `NODE_ENV=production`
- `DATABASE_URL` : URL Neon poolée (hôte contenant `-pooler`)
- `MIGRATION_DATABASE_URL` : URL Neon directe, utilisée au démarrage pour les migrations
- `JWT_SECRET` : secret aléatoire long ; ne jamais le versionner

Gérées ou facultatives :

- `PORT` : injecté automatiquement par Render ; `5000` par défaut en local
- `DB_POOL_MAX=10`
- `UPLOADS_DIRECTORY=/var/data/uploads` sur Render avec disque persistant
- `FRONTEND_ORIGIN` : seulement si le frontend est hébergé sur un autre domaine ; plusieurs origines peuvent être séparées par des virgules
- `DB_SSL` et `DB_SSL_REJECT_UNAUTHORIZED` : uniquement pour une configuration PostgreSQL sans paramètres SSL dans l'URL

`SESSION_SECRET` n'est pas utilisé : Intervium signe ses cookies de session JWT avec
`JWT_SECRET`.

## Neon

1. Créer un projet et une base dans la région la plus proche de Render.
2. Copier l'URL **poolée** dans `DATABASE_URL`.
3. Copier l'URL **directe** dans `MIGRATION_DATABASE_URL`.
4. Conserver les paramètres SSL fournis par Neon dans les deux URL.
5. Ne pas lancer `schema.sql` manuellement : `npm start` applique automatiquement les migrations numérotées.

## Render avec Blueprint

1. Pousser le projet dans un dépôt GitHub ou GitLab privé.
2. Dans Render, choisir **New > Blueprint** et sélectionner le dépôt.
3. Render détecte `render.yaml`. Renseigner les deux URL Neon lorsqu'elles sont demandées.
4. Laisser Render générer `JWT_SECRET`.
5. Créer le service. Le démarrage exécute `npm run migrate`, puis lance Express.
6. Vérifier `https://<service>.onrender.com/api/health`, puis créer le premier compte ADMIN.

Le Blueprint utilise un service `starter` avec un disque persistant de 1 Go. C'est
nécessaire avec le stockage local actuel : sans disque, les photos, signatures et
logos disparaissent lors d'un redéploiement ou redémarrage Render.

## Fly.io (alternative)

1. Modifier le nom `app` de `fly.toml` pour qu'il soit unique.
2. Exécuter `fly volumes create intervium_data --region cdg --size 1`.
3. Ajouter les secrets :
   `fly secrets set DATABASE_URL="..." MIGRATION_DATABASE_URL="..." JWT_SECRET="..."`.
4. Exécuter `fly deploy`.
