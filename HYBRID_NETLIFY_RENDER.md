# Architecture hybride Netlify + Render

## Répartition retenue

Netlify est le **frontend public** : il déploie le dossier `Frontend/`, distribue les fichiers statiques via son CDN et applique les règles de cache de `Frontend/_headers`.

Render reste le **backend d’autorité**. Toutes les requêtes `/api/*` et `/uploads/*` reçues par Netlify sont réécrites en proxy vers Render sans redirection navigateur. Les cookies de session restent donc same-origin pour le navigateur (`https://app…/api/...`) et ne sont jamais exposés aux scripts frontend.

| Composant | Service | Motif |
| --- | --- | --- |
| HTML, CSS, JS, PWA, icônes | Netlify + CDN | Contenu statique proche des utilisateurs |
| Express, authentification, JWT HttpOnly, PDF, uploads, e-mails, IA | Render | Processus Node durable, dépendances serveur et secrets |
| PostgreSQL | Neon | Base unique, accessible uniquement par Render |
| Médias | Cloudinary | Stockage média existant, URLs HTTPS directes |
| OAuth Google/Microsoft | Render pour le callback, Netlify pour le retour UI | Les secrets OAuth restent sur Render; le retour conserve l’origine qui a lancé le flux |

Il n’y a volontairement **aucune Netlify Function** : dupliquer Express dans des fonctions créerait deux backends, multiplierait les secrets, compliquerait les migrations Neon et augmenterait les démarrages à froid. Stripe n’est pas présent dans ce dépôt ; si un module Stripe est ajouté, ses webhooks et clés secrètes doivent également rester sur Render.

## Réglages Netlify

1. Connectez ce dépôt et choisissez `main` comme branche de production.
2. Laissez `netlify.toml` définir le répertoire de publication `Frontend`. Ne renseignez ni `DATABASE_URL`, ni `JWT_SECRET`, ni clés OAuth/Cloudinary/Gemini dans Netlify.
3. Définissez votre domaine public Netlify, par exemple `https://app.exemple.fr`. Cette URL sera le frontend canonique.
4. Conservez les règles proxy `/api/*` et `/uploads/*` vers `https://intervium-app.onrender.com`. Elles sont indispensables à la session same-origin.
5. Pour les Deploy Previews, évitez de connecter OAuth sauf si vous ajoutez précisément l’URL Preview à `FRONTEND_ORIGIN`; les callbacks OAuth enregistrés doivent rester des URLs Render stables.

## Réglages Render

Render continue d’héberger `intervium` et `intervium-staging`. Ne supprimez aucun service ni variable existante.

Pour la production, ajoutez ou modifiez :

```text
APP_URL=https://app.exemple.fr
FRONTEND_ORIGIN=https://app.exemple.fr
GOOGLE_REDIRECT_URI=https://intervium-app.onrender.com/api/google/callback
MICROSOFT_REDIRECT_URI=https://intervium-app.onrender.com/api/email-connections/microsoft/callback
```

Conservez inchangés sur Render : `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `JWT_SECRET`, `EMAIL_CREDENTIALS_ENCRYPTION_KEY`, `TOTP_ENCRYPTION_KEY`, `CLOUDINARY_URL`, `GEMINI_API_KEY`, les secrets Google/Microsoft, SMTP et Sentry. La valeur de `JWT_SECRET` doit être identique entre les instances Render qui partagent les mêmes sessions et la même base.

Pour le staging, utilisez des URLs séparées (par exemple le sous-domaine Netlify de staging et le service `intervium-staging`) et une base Neon de staging. N’ajoutez jamais l’URL de staging à la production.

## Configuration des fournisseurs OAuth

Dans Google Cloud Console et Microsoft Entra, enregistrez les deux callbacks Render ci-dessus — pas l’URL Netlify. Après le callback, Render redirige vers l’origine frontend qui a initié le flux, validée et incluse dans l’état OAuth signé.

## Vérification après déploiement

1. Ouvrez `https://app.exemple.fr/api/health` : la réponse doit être `{ "status": "ok" }` via Netlify puis Render.
2. Ouvrez `https://intervium-app.onrender.com/api/health` : la même réponse confirme que Render reste directement disponible.
3. Sur Netlify, connectez-vous, rechargez la page, puis déconnectez-vous. Vérifiez dans l’onglet Réseau que les appels restent relatifs (`/api/...`) et que le cookie `intervium_sid` est `HttpOnly`, `Secure`, `SameSite=Strict`.
4. Téléversez une photo, ouvrez un PDF, envoyez un rapport et utilisez Intervium AI : ces opérations doivent répondre depuis `/api/...` via le proxy Render.
5. Testez le raccordement Google puis Microsoft. Le callback doit passer par Render et vous ramener sur le domaine Netlify.
6. Testez une navigation directe sur Render. Ses routes Express et son frontend restent inchangés; son premier appel API peut être plus lent en sortie de veille, mais Netlify n’ajoute pas de démarrage à froid aux fichiers statiques.
