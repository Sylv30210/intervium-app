# Intervium

Intervium est une application SaaS multi-tenant de gestion d’interventions terrain. Elle permet de centraliser les clients, les matériels, le planning, les rapports personnalisables, les photos, les signatures, les notifications et l’envoi de rapports par e-mail.

L’application est pensée pour un usage bureau et mobile, et peut être installée comme PWA sur ordinateur, Android et iOS.

## Fonctionnalités principales

- Authentification sécurisée avec JWT stocké dans un cookie `HttpOnly`.
- Isolation stricte des données par entreprise.
- Rôles `ADMIN`, `TECHNICIEN`, `CLIENT` et accès d’assistance super-développeur encadré.
- Tableau de bord avec indicateurs, prochaines interventions et actions rapides.
- Gestion des clients, contacts client et matériels associés.
- Planning des interventions.
- Création, édition, signature et export PDF des rapports d’intervention.
- Modèles de rapports configurables avec champs, sections, tableaux, photos et signatures.
- Personnalisation de l’identité PDF de l’entreprise : logo, nom affiché, SIRET, adresse et styles visuels.
- Ajout, optimisation, annotation, rotation et inclusion sélective des photos dans les PDF.
- Envoi de rapports par e-mail via SMTP, Gmail ou Microsoft selon la configuration.
- Notifications applicatives.
- Recherche globale.
- Historique d’activité.
- Thèmes Classique, Sombre et Liquid Glass.
- PWA installable avec service worker, page hors connexion et cache sécurisé.
- Pages publiques obligatoires : conditions, confidentialité, mentions légales et politique de cookies si nécessaire.
- Suppression définitive de compte avec confirmation renforcée.

## Stack technique

### Frontend

- HTML5
- CSS responsive mobile-first
- JavaScript natif en modules ES
- Fetch API
- Service Worker
- Web App Manifest

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
- Nodemailer

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
│   ├── scripts/
│   ├── services/
│   ├── test/
│   ├── server.js
│   └── package.json
├── Frontend/
│   ├── api/
│   ├── clients/
│   ├── components/
│   ├── documents/
│   ├── icons/
│   ├── navigation/
│   ├── reports/
│   ├── styles/
│   ├── utils/
│   ├── views/
│   ├── app.css
│   ├── app.js
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── offline.html
│   ├── robots.txt
│   ├── sitemap.xml
│   └── sw.js
├── docs/
├── .github/workflows/
├── AUDIT_AMELIORATIONS.md
├── CHANGELOG.md
├── DEPLOYMENT.md
├── OPERATIONS.md
├── Dockerfile
├── Procfile
├── render.yaml
└── package.json
```

## Prérequis

- Node.js 20 ou version supérieure.
- npm.
- PostgreSQL 14 ou version supérieure.
- Un compte Cloudinary pour le stockage distant en production.
- Des identifiants SMTP, Gmail ou Microsoft si l’envoi d’e-mails doit être activé.

## Installation locale

Clonez le dépôt puis installez les dépendances :

```bash
git clone https://github.com/Sylv30210/intervium-app.git
cd intervium-app
npm install
```

Créez ensuite le fichier d’environnement du backend :

```bash
cd Backend
cp .env.example .env
```

Sous Windows PowerShell :

```powershell
cd Backend
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

Lancez ensuite l’application depuis la racine :

```bash
npm start
```

Intervium sera disponible sur :

```text
http://localhost:5000
```

Le frontend est servi directement par Express depuis le dossier `Frontend`.

## Scripts npm

Depuis la racine du projet :

```bash
npm run check
```

Vérifie les fichiers JavaScript principaux.

```bash
npm test
```

Lance la suite de tests backend.

```bash
npm run release:check
```

Exécute les contrôles de pré-publication du projet.

```bash
npm run migrate
```

Applique les migrations PostgreSQL.

```bash
npm start
```

Démarre l’application via le backend.

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

Une migration déjà appliquée ne doit pas être modifiée sans procédure de régularisation explicite.

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

Les photos sont redimensionnées et converties en WebP. Les logos et signatures sont validés et optimisés avant stockage.

Les secrets Cloudinary ne doivent jamais être ajoutés au dépôt Git.

## Envoi d’e-mails

Intervium peut envoyer des rapports et messages depuis plusieurs fournisseurs :

- SMTP ;
- Gmail OAuth ;
- Microsoft OAuth.

Les jetons et identifiants sensibles sont chiffrés côté serveur. Les scopes OAuth doivent rester limités à l’envoi d’e-mails.

Variables courantes :

```env
GMAIL_SENDING_ENABLED=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...
GOOGLE_TOKEN_ENCRYPTION_KEY=...

MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_REDIRECT_URI=...

EMAIL_CREDENTIALS_ENCRYPTION_KEY=...
APP_URL=...
```

## Variables d’environnement de production

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
MIGRATION_DATABASE_URL=postgresql://...
JWT_SECRET=...
STORAGE_DRIVER=cloudinary
CLOUDINARY_URL=cloudinary://...
DB_POOL_MAX=10
APP_URL=https://...
PUBLIC_REGISTRATION_ENABLED=false
```

- `DATABASE_URL` peut utiliser la connexion poolée Neon.
- `MIGRATION_DATABASE_URL` doit idéalement utiliser la connexion directe Neon.
- Render fournit automatiquement `PORT`.
- `FRONTEND_ORIGIN` est facultatif lorsque le frontend est servi par le même backend.

## Déploiement sur Render

Le fichier `render.yaml` contient la configuration Blueprint.

Deux services sont déclarés :

- `intervium` : production, déploiement manuel.
- `intervium-staging` : staging, déploiement après contrôles réussis.

Étapes générales :

1. Pousser le projet sur GitHub.
2. Créer ou mettre à jour le Blueprint Render.
3. Renseigner les variables sensibles dans le Dashboard Render.
4. Vérifier que la CI GitHub est verte.
5. Déclencher manuellement le déploiement production si nécessaire.

Endpoint de vérification :

```text
GET /api/health
```

Pour plus de détails, consultez [DEPLOYMENT.md](./DEPLOYMENT.md).

## PWA

Intervium comprend :

- un manifest complet ;
- des icônes adaptées ;
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
- Les réponses API privées utilisent `Cache-Control: no-store, private`.
- Les limites anti-abus sensibles utilisent un rate limiter persistant.
- Les actions destructives sensibles exigent une confirmation explicite.

### Rôles

- `ADMIN` : gestion complète de son entreprise.
- `TECHNICIEN` : accès aux interventions attribuées et aux ressources nécessaires au travail terrain.
- `CLIENT` : accès en lecture à ses propres rapports.
- Super-développeur : assistance encadrée, lecture seule par défaut, sans contournement des protections de suppression.

## Vérifications avant contribution

Avant de proposer ou pousser une modification :

```bash
npm run check
npm test
npm run release:check
```

Vérifiez également :

- qu’aucun secret ou fichier `.env` n’est versionné ;
- que les nouvelles routes filtrent systématiquement par entreprise ;
- que les médias ne sont jamais enregistrés en Base64 dans PostgreSQL ;
- que les réponses privées ne sont pas ajoutées au cache PWA ;
- que les actions sensibles ont une confirmation claire ;
- que le responsive mobile reste utilisable.

## Documentation complémentaire

- [DEPLOYMENT.md](./DEPLOYMENT.md) : déploiement et hébergement.
- [OPERATIONS.md](./OPERATIONS.md) : exploitation et maintenance.
- [CHANGELOG.md](./CHANGELOG.md) : historique des changements.
- [AUDIT_AMELIORATIONS.md](./AUDIT_AMELIORATIONS.md) : audit et pistes d’amélioration.
- [docs/intervium-email-requests.md](./docs/intervium-email-requests.md) : suivi des demandes reçues par e-mail.

## Licence

Projet propriétaire. Tous droits réservés.
