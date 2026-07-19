# Connexion des fournisseurs e-mail

## Architecture

Les routes `/api/email-connections` gèrent les comptes du seul utilisateur authentifié et de son entreprise. `services/email-sender.js` est le point d’entrée unique d’envoi : Gmail API pour Google, Microsoft Graph pour Microsoft, Nodemailer pour SMTP. La route historique `/api/google` est conservée pour compatibilité.

La migration `023_email_connections.sql` crée `connexions_email` et `journal_envois_email`, puis référence les connexions Gmail historiques sans supprimer `connexions_google`. Chaque requête SQL de lecture, modification, test ou suppression contient `utilisateur_id` et `entreprise_id`.

## Fournisseurs

- Google : OAuth 2.0, scope `gmail.send` uniquement, plus `openid email` pour identifier le compte.
- Microsoft Outlook, Hotmail et Microsoft 365 : OAuth 2.0 Authorization Code sur le tenant `common`, scopes délégués `openid profile email offline_access Mail.Send`, puis `POST /me/sendMail` dans Graph.
- Orange : SMTP `smtp.orange.fr:465`, TLS, authentification, mot de passe dédié aux applications de messagerie. Aucune API OAuth Orange publique adaptée à l’envoi SaaS n’a été trouvée dans la documentation officielle; aucune fausse intégration OAuth n’est fournie.
- Free : `smtp.free.fr:587`, STARTTLS, authentification avec l’adresse complète.
- SFR : `smtp.sfr.fr:465`, TLS 1.2 minimum, authentification avec l’adresse complète.
- OVHcloud : profil guidé sans serveur imposé, car les paramètres diffèrent entre MX Plan, Email Pro et Exchange. Recopier la valeur officielle affichée dans le Manager OVHcloud pour l’offre concernée.
- Infomaniak : `mail.infomaniak.com:587`, STARTTLS, authentification obligatoire.
- Yahoo : `smtp.mail.yahoo.com:465`, TLS, mot de passe d’application obligatoire.
- Proton Mail : seulement les offres payantes avec domaine personnalisé et jeton SMTP officiel, `smtp.protonmail.ch:587`, STARTTLS. Le mot de passe du compte Proton ne fonctionne pas.
- SMTP personnalisé : serveur, port, chiffrement et authentification configurables. En production, le mode sans chiffrement est refusé.

Sources officielles vérifiées le 19 juillet 2026 : [Microsoft Graph sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0), [permissions Graph](https://learn.microsoft.com/en-us/graph/permissions-reference), [Orange](https://assistance.orange.fr/nid/434630), [Free](https://assistance.free.fr/articles/609), [SFR](https://assistance.sfr.fr/sfrmail-appli/sfrmail/configurer-messagerie-recevoir-email-sfr.html), [Infomaniak](https://www.infomaniak.com/fr/support/faq/468/comprendre-les-ports-et-protocoles-de-messagerie), [Yahoo](https://fr.aide.yahoo.com/kb/SLN4075.html), [Proton](https://proton.me/support/smtp-submission).

## Chiffrement et sécurité

Les access tokens, refresh tokens et mots de passe SMTP sont chiffrés côté backend en AES-256-GCM. Le format `v1.<nonce>.<tag>.<contenu>` utilise un nonce aléatoire de 12 octets et un tag d’authentification. La clé `EMAIL_CREDENTIALS_ENCRYPTION_KEY` ne doit exister que dans l’environnement backend. Les anciens jetons Google restent lisibles avec `GOOGLE_TOKEN_ENCRYPTION_KEY` pendant la transition et sont réécrits au format versionné à la reconnexion.

Les secrets ne sont jamais sérialisés dans les réponses. Les logs n’enregistrent que des codes d’erreur assainis. Les hôtes SMTP locaux, adresses IP littérales et destinations DNS privées sont refusés. TLS 1.2 est le minimum; les certificats invalides sont refusés. Les objets et noms de pièces jointes ne peuvent pas contenir de retours à la ligne.

Limites applicatives : 20 destinataires par message, 10 Mio par pièce jointe, 12 Mio par message, 60 envois par utilisateur et 200 destinataires par entreprise sur une heure. Les fournisseurs conservent leurs propres limites, potentiellement plus strictes.

## Variables d’environnement

- `APP_URL` : origine publique exacte, sans barre finale.
- `EMAIL_CREDENTIALS_ENCRYPTION_KEY` : clé aléatoire de 32 octets, base64 ou hexadécimal.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GMAIL_SENDING_ENABLED=true`.
- `GOOGLE_TOKEN_ENCRYPTION_KEY` : ancienne clé Google, à conserver tant que d’anciennes connexions existent.
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`.
- `DATABASE_URL` : URL Neon poolée pour l’application.
- `MIGRATION_DATABASE_URL` : URL Neon directe pour les migrations.

Callbacks :

- Google : `${APP_URL}/api/google/callback`
- Microsoft : `${APP_URL}/api/email-connections/microsoft/callback`

## Configuration OAuth

Google Cloud Console : activer Gmail API, configurer l’écran de consentement, créer un client « Application Web », ajouter le callback Google, puis demander uniquement `.../auth/gmail.send`. Pour obtenir le refresh token, le flux demande `access_type=offline` et un consentement explicite.

Microsoft Entra : créer une inscription d’application acceptant « comptes dans tout annuaire et comptes Microsoft personnels », ajouter une plateforme Web avec le callback Microsoft, créer un secret client, puis ajouter la permission Microsoft Graph déléguée `Mail.Send`. `offline_access` est demandé dynamiquement par le flux OAuth.

## Base Neon et déploiement Render

Le démarrage exécute automatiquement les migrations avec `MIGRATION_DATABASE_URL`, sous verrou PostgreSQL. Pour une exécution manuelle contrôlée : `npm run migrate`. Ne jamais exécuter `schema.sql` sur une base existante.

Dans Render, ajouter toutes les variables au service de production `intervium` et au staging `intervium-staging`, avec des applications OAuth et callbacks distincts si possible. Après déploiement, vérifier `/api/health`, connecter chaque compte depuis Paramètres, lancer « Tester la connexion », puis envoyer un rapport vers une adresse contrôlée.

Le domaine public exact n’est pas versionné dans ce dépôt. Le nom de service ne garantit pas l’URL Render : copier l’URL affichée dans Render → service → Settings → Custom Domains (ou l’URL `onrender.com` en haut de la page), puis l’utiliser comme `APP_URL` et dans les deux callbacks.

## Tests

`npm run check` contrôle la syntaxe et `npm test` exécute les tests sans envoyer de vrais messages. Les appels réseau OAuth et la base sont simulés dans les tests dédiés. Un test SMTP réel ne se produit que lorsque l’utilisateur clique explicitement sur « Tester la connexion »; il exécute `verify()` sans envoyer de message.

## Limites connues

- Microsoft ne propose pas d’endpoint standard de révocation des refresh tokens pour ce flux : supprimer la connexion retire immédiatement les jetons d’Intervium; l’utilisateur peut aussi retirer le consentement dans son compte Microsoft.
- Le test SMTP vérifie connexion, TLS et authentification, mais pas la livraison finale.
- Google historique ne gère que le rapport PDF actuel; le service unifié prévoit CC/CCI/HTML mais l’interface de rapport existante ne les expose pas encore.
- Les paramètres OVHcloud varient selon MX Plan, Email Pro et Exchange; vérifier le Manager avant d’utiliser le préréglage.
