# Intervium

Intervium est une application SaaS multi-tenant de gestion d’interventions terrain. Elle centralise les clients, les équipements, le planning, les rapports personnalisables, les photos, les signatures, les devis et les factures.

L’application est également installable comme PWA sur ordinateur, Android et iOS.

## Fonctionnalités

- Authentification sécurisée par JWT dans un cookie `HttpOnly`.
- Isolation stricte des données par entreprise.
- Rôles `ADMIN`, `TECHNICIEN` et `CLIENT`.
- Gestion des clients et fiches client détaillées.
- Gestion des équipements associés aux clients.
- Planning et suivi des interventions.
- Création d’interventions par les administrateurs et techniciens.
- Modèles de rapport configurables.
- Photos optimisées avec Sharp.
- Signatures tactiles.
- Stockage Cloudinary en production ou stockage local en développement.
- Rapports PDF personnalisés avec l’identité de l’entreprise.
- Gestion des devis, factures et avoirs.
- Gestion des comptes techniciens.
- Thèmes Classique, Sombre et Liquid Glass.
- PWA installable avec service worker et écran hors connexion.

## Stack technique

### Frontend

- HTML5
- CSS responsive mobile-first
- JavaScript natif
- Fetch API
- Service Worker et Web App Manifest

### Backend

- Node.js
- Express
- PostgreSQL
- `pg`
- `bcryptjs`
- `jsonwebtoken`
- `multer.memoryStorage()`
- Sharp
- Cloudinary
- PDFKit
- Helmet

### Hébergement recommandé

- Render pour l’application Node.js
- Neon pour PostgreSQL
- Cloudinary pour les médias

## Structure du projet

```text
Intervium.app/
├── Backend/
│   ├── config/
│   ├── database/
│   │   ├── migrations/
│   │   └── migrate.js
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── server.js
│   └── package.json
├── Frontend/
│   ├── icons/
│   ├── app.js
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── offline.html
│   └── sw.js
├── Dockerfile
├── Procfile
├── render.yaml
└── fly.toml
```

## Prérequis

- Node.js 22 ou version compatible
- PostgreSQL 14 ou supérieur
- npm
- Un compte Cloudinary pour le stockage distant en production

## Installation locale

Clonez le dépôt puis installez les dépendances du backend :

```bash
git clone https://github.com/Sylv30210/intervium-app.git
cd Intervium.app/Backend
npm install
```

Créez ensuite votre fichier d’environnement à partir du modèle :

```bash
cp .env.example .env
```

Sous Windows PowerShell :

```powershell
Copy-Item .env.example .env
```

Configurez au minimum PostgreSQL et le secret JWT :

```env
NODE_ENV=development
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_USER=intervium
DB_PASSWORD=change_me
DB_NAME=intervium

JWT_SECRET=replace_with_a_long_random_secret
STORAGE_DRIVER=local
```

Lancez l’application :

```bash
npm start
```

Intervium sera disponible sur :

```text
http://localhost:5000
```

Le frontend est servi directement par Express depuis le dossier `Frontend`.

## Scripts npm

Depuis le dossier `Backend` :

```bash
npm start
```

Applique les migrations puis démarre le serveur.

```bash
npm run dev
```

Démarre le serveur avec Nodemon.

```bash
npm run migrate
```

Exécute uniquement les migrations PostgreSQL.

## Migrations PostgreSQL

Les migrations sont exécutées automatiquement par `Backend/server.js` avant que le serveur commence à accepter des connexions.

Le moteur de migration utilise :

- une table `schema_migrations` ;
- des checksums SHA-256 ;
- une transaction par migration ;
- un verrou PostgreSQL pour empêcher deux instances de migrer simultanément.

Les fichiers SQL se trouvent dans :

```text
Backend/database/migrations/
```

## Stockage des médias

### Développement local

```env
STORAGE_DRIVER=local
```

Les fichiers sont enregistrés dans `Backend/uploads/`.

### Production avec Cloudinary

```env
STORAGE_DRIVER=cloudinary
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

Les photos sont redimensionnées à une largeur maximale de 1200 pixels puis converties en WebP avec une qualité de 80 %. Les logos et signatures sont également validés et optimisés avant leur transfert.

Les secrets Cloudinary ne doivent jamais être ajoutés au dépôt Git.

## Variables d’environnement de production

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
MIGRATION_DATABASE_URL=postgresql://...
JWT_SECRET=...
STORAGE_DRIVER=cloudinary
CLOUDINARY_URL=cloudinary://...
DB_POOL_MAX=10
```

- `DATABASE_URL` peut utiliser la connexion poolée Neon.
- `MIGRATION_DATABASE_URL` doit idéalement utiliser la connexion directe Neon.
- Render fournit automatiquement `PORT`.
- `FRONTEND_ORIGIN` est facultatif lorsque le frontend est hébergé séparément.

## Déploiement sur Render

Le fichier `render.yaml` contient la configuration Blueprint.

1. Poussez le projet sur GitHub ou GitLab.
2. Créez un nouveau Blueprint sur Render.
3. Sélectionnez le dépôt.
4. Renseignez `DATABASE_URL`, `MIGRATION_DATABASE_URL` et `CLOUDINARY_URL`.
5. Laissez Render générer `JWT_SECRET`.
6. Lancez le déploiement.

Endpoint de vérification :

```text
GET /api/health
```

Pour plus de détails, consultez [DEPLOYMENT.md](./DEPLOYMENT.md).

## PWA

Intervium comprend :

- un manifest complet ;
- des icônes 192 × 192, 512 × 512 et maskable ;
- un service worker versionné ;
- une page hors connexion ;
- un bouton d’installation sur les navigateurs compatibles ;
- des instructions d’installation pour iOS ;
- la prise en charge des zones sécurisées des appareils mobiles.

Les réponses privées de l’API, les PDF, les logos, les photos et les signatures ne sont jamais enregistrés dans le cache du service worker.

## Sécurité et multi-tenant

- Les mots de passe sont hachés avec bcrypt.
- Les JWT sont transmis dans un cookie `HttpOnly`.
- Le cookie utilise `Secure` en production et `SameSite=Strict`.
- Chaque requête métier est filtrée avec l’identifiant d’entreprise issu de la session.
- Les identifiants d’entreprise envoyés par le frontend ne sont jamais utilisés comme source de vérité.
- Les requêtes PostgreSQL sont paramétrées.
- Helmet configure les principaux en-têtes HTTP de sécurité.
- Les réponses API utilisent `Cache-Control: no-store, private`.

### Rôles

- `ADMIN` : gestion complète de son entreprise.
- `TECHNICIEN` : accès aux interventions qui lui sont attribuées et aux ressources nécessaires à son travail.
- `CLIENT` : accès en lecture à ses propres rapports.

## Vérifications avant contribution

Avant de proposer une modification :

```bash
cd Backend
npm run migrate
node --check server.js
node --check ../Frontend/app.js
node --check ../Frontend/sw.js
```

Vérifiez également :

- qu’aucun secret ou fichier `.env` n’est versionné ;
- que les nouvelles routes filtrent systématiquement par tenant ;
- que les médias ne sont jamais enregistrés en Base64 dans PostgreSQL ;
- que les réponses privées ne sont pas ajoutées au cache PWA.

## Licence

Projet propriétaire. Tous droits réservés.
