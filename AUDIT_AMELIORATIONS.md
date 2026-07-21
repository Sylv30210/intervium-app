# Audit d’amélioration Intervium

Date de l’audit : 21 juillet 2026  
Périmètre : frontend, backend, base PostgreSQL/Neon, authentification, sécurité, performances, UI/UX, PWA, SEO, maintenance et exploitation.

## Synthèse

Intervium est une application SaaS multi-tenant de gestion d’interventions terrain. Le projet est cohérent et déjà structuré autour de séparations simples : un backend Express, un frontend HTML/CSS/JavaScript natif servi par Express, une base PostgreSQL migrée par fichiers SQL, du stockage média local ou Cloudinary, et un déploiement Render avec Neon recommandé.

Les points forts observés sont :

- isolation par `entreprise_id` sur les principales tables métier ;
- JWT en cookie `HttpOnly`, `Secure` en production, `SameSite=Strict` ;
- protection CSRF par contrôle `Origin`/`Referer`/`Sec-Fetch-Site` sur méthodes mutatives ;
- Helmet avec CSP sans inline script/style ;
- rate limiting persistant pour auth, uploads, documents et recherche ;
- PWA avec service worker prudent sur les ressources privées ;
- validations serveur sur les identifiants, rôles, médias, rapports typés, e-mails et documents ;
- journaux d’activité, notifications et endpoint d’état interne ;
- tests unitaires et d’intégration couvrant sécurité, PWA, PDF, pagination, e-mail, MFA et isolation multi-tenant.

Les principaux axes à améliorer sont :

- stabiliser les parcours partiellement intégrés, notamment documents commerciaux ;
- améliorer la granularité des rôles et permissions ;
- enrichir les états vides, les messages et l’onboarding ;
- renforcer l’observabilité métier et les tests de parcours frontend ;
- mieux maîtriser les performances frontend autour du gros fichier `app.js` ;
- documenter plus précisément les pages légales et la conformité ;
- planifier les montées de versions majeures de dépendances.

## Architecture observée

### Racine

- `package.json` : scripts de lancement, migration, vérification JS, tests, préflight release et sauvegardes.
- `render.yaml` : blueprint Render avec services `intervium` et `intervium-staging`, auto-déploiement désactivé en production et conditionnel en staging.
- `Dockerfile`, `Procfile`, `fly.toml` : artefacts de déploiement.
- `README.md`, `OPERATIONS.md`, `DEPLOYMENT.md`, `CHANGELOG.md` : documentation d’installation, exploitation, sauvegardes et publication.
- `docs/intervium-email-requests.md` : journal durable des demandes issues d’e-mails.

### Backend

- `Backend/server.js` : bootstrap Express, sécurité HTTP, CORS conditionnel, routes API, service statique frontend, migrations au démarrage et arrêt propre.
- `Backend/config/` : connexion PostgreSQL, stockage local/Cloudinary, fournisseurs SMTP.
- `Backend/middleware/` : authentification, rôles, protection anti-CSRF, rate limiting, logs par requête.
- `Backend/routes/` : modules API (`auth`, `clients`, `equipements`, `interventions`, `uploads`, `modeles`, `documents`, `notifications`, `search`, `activity`, `admin`, `google`, `email-connections`).
- `Backend/services/` : activité/notifications, connexions e-mail, chiffrement, stockage, génération PDF, Google/Microsoft.
- `Backend/database/` : schéma de référence, moteur de migration et migrations SQL numérotées.
- `Backend/test/` : tests Node natifs.

### Frontend

- `Frontend/index.html` : shell HTML, titre, meta description, PWA, CSS et script module.
- `Frontend/app.js` : orchestration globale, auth, rendu des vues, modales, onboarding, rapports, paramètres, notifications, recherche, formulaires et actions.
- `Frontend/app.css`, `Frontend/styles/reports.css` : styles responsive, thèmes classique/sombre/glass, composants métier.
- `Frontend/api/client.js` : wrapper `fetch` avec credentials et gestion des erreurs/session expirée.
- `Frontend/views/resources.js` : rendus clients, matériels, équipe.
- `Frontend/navigation/routes.js` : vues connues et titres.
- `Frontend/reports/`, `Frontend/clients/`, `Frontend/documents/`, `Frontend/utils/` : utilitaires spécialisés.
- `Frontend/sw.js`, `offline.*`, `manifest.webmanifest` : PWA et hors connexion.
- `Frontend/conditions.html`, `confidentialite.html`, `robots.txt`, `sitemap.xml` : SEO/légal minimal.

## Fonctionnalités présentes

- Connexion, inscription contrôlée par variable d’environnement, consentement aux conditions.
- Rôles `ADMIN`, `TECHNICIEN`, `CLIENT`, avec `SUPER_DEVELOPPEUR` interne traité comme assistance contrôlée.
- Tableau de bord avec statistiques et actions rapides.
- Liste, recherche, pagination et détail des rapports/interventions.
- Planning mensuel.
- Gestion des clients, contacts et destinataires de rapports.
- Gestion des matériels liés aux clients.
- Modèles de rapport configurables : champs, choix, tableaux, photos, signatures, rendu PDF.
- Saisie de rapport, autosauvegarde locale, signatures tactiles, photos, rotation, annotation.
- Génération et téléchargement PDF.
- Envoi de rapports par e-mail via Google, Microsoft ou SMTP.
- Personnalisation de l’identité PDF : logo, nom affiché, adresse, couleur, style, pied de page.
- Paramètres : thème, mot de passe, e-mail, navigation mobile, tutoriel, état interne.
- Notifications et recherche globale.
- Historique d’activité pour administrateurs.
- Sauvegardes chiffrées via scripts.

## Parcours utilisateurs

- `ADMIN` : configure l’entreprise, crée clients/matériels/modèles/techniciens, planifie, suit, édite, supprime, exporte et envoie les rapports.
- `TECHNICIEN` : accède aux interventions assignées, complète les rapports, ajoute photos/signatures, exporte/envoie selon les autorisations.
- `CLIENT` : consulte les rapports liés à son compte client.
- `SUPER_DEVELOPPEUR` : accès interne MFA, assistance en lecture seule par défaut, écriture temporaire limitée, restrictions sur suppressions et gestion d’accès.

## Structure base de données

Tables principales observées :

- `entreprises`
- `utilisateurs`
- `clients`
- `contacts_clients`
- `equipements`
- `modeles_rapport`
- `interventions`
- `photos`
- `documents_commerciaux`
- `activites`
- `notifications`
- `connexions_google`
- `connexions_email`
- `journal_envois_email`
- `rate_limits`
- `schema_migrations`

Le modèle est orienté multi-tenant avec `entreprise_id` sur les ressources métier et de nombreux index composés. Les migrations utilisent checksum SHA-256, transaction, table `schema_migrations` et verrou PostgreSQL.

## Services externes

- Render : hébergement web.
- Neon/PostgreSQL : base recommandée.
- Cloudinary : stockage média production.
- Google OAuth/Gmail API : envoi e-mail.
- Microsoft Entra/Graph : envoi e-mail.
- SMTP : connexions e-mail alternatives.
- Sentry : optionnel pour erreurs serveur.

## Fonctionnalités incomplètes ou mal intégrées

- Le module `documents_commerciaux` existe côté API et frontend, mais les documents sont indiqués comme “historiques conservés” et la navigation ne les expose pas clairement.
- Les pages légales sont très minimales pour une application professionnelle.
- Le sitemap ne référence que l’accueil et les pages légales ; certaines routes publiques utiles comme login/pricing n’existent pas ou ne sont pas exposées.
- Le frontend est très centralisé dans `Frontend/app.js`, ce qui rend les évolutions plus risquées.
- Les tests frontend restent surtout indirects via analyse JS et utilitaires ; il manque des tests E2E de parcours.

## Améliorations recommandées

### Corrections urgentes

| Problème observé | Modification recommandée | Intérêt | Fichiers concernés | Priorité | Difficulté |
|---|---|---|---|---|---|
| Fonction documents présente mais masquée/partielle. | Décider officiellement : réactiver avec navigation, ou retirer l’entrée des routes connues et recherche. | Évite les parcours morts et la confusion produit. | `Frontend/app.js`, `Frontend/navigation/routes.js`, `Backend/routes/documents.js` | Élevée | Intermédiaire |
| Suppressions clients/interventions suppriment en cascade des médias et données métier. | Ajouter un écran de confirmation détaillé avec nombre d’éléments impactés avant suppression. | Réduit le risque de perte accidentelle. | `Backend/routes/clients.js`, `Backend/routes/interventions.js`, `Frontend/app.js` | Élevée | Intermédiaire |
| Aucun test E2E ne valide les principaux parcours UI. | Ajouter Playwright ou équivalent pour login, création client, intervention, rapport, PDF. | Détecte les régressions avant déploiement. | nouveau dossier `e2e/`, scripts npm | Élevée | Intermédiaire |
| Service Render en plan free avec alertes mémoire historiques. | Surveiller mémoire, inspecter pics PDF/images, envisager instance supérieure ou tâches asynchrones. | Améliore disponibilité. | `render.yaml`, `Backend/services/pdf.js`, `Backend/services/storage.js` | Élevée | Intermédiaire |
| Les erreurs API frontend sont affichées telles quelles mais sans contexte actionnable. | Standardiser les erreurs avec titre, détail, action recommandée et `request_id` quand disponible. | Support plus rapide et meilleure compréhension utilisateur. | `Frontend/api/client.js`, `Backend/server.js`, routes API | Élevée | Intermédiaire |

### Sécurité

| Problème observé | Modification recommandée | Intérêt | Fichiers concernés | Priorité | Difficulté |
|---|---|---|---|---|---|
| Pas de politique de durée/session renouvelable visible côté utilisateur. | Afficher expiration de session et ajouter renouvellement contrôlé ou alerte avant expiration. | Moins de pertes de saisie longues. | `Backend/routes/auth.js`, `Frontend/app.js` | Moyenne | Intermédiaire |
| Le changement de mot de passe n’impose que 8 caractères. | Ajouter règles minimales plus robustes et contrôle de mots de passe compromis si service choisi. | Renforce les comptes. | `Backend/routes/auth.js`, `Frontend/app.js` | Moyenne | Intermédiaire |
| MFA réservé au super-développeur. | Proposer MFA optionnel pour ADMIN. | Protège les comptes les plus sensibles. | `Backend/routes/auth.js`, migrations, paramètres frontend | Élevée | Complexe |
| SMTP configurable par utilisateur. | Ajouter allowlist/denylist de domaines ou ports et journal d’audit plus détaillé. | Limite l’abus et les erreurs de configuration. | `Backend/services/email-connections.js`, `Backend/config/smtp-providers.js` | Moyenne | Intermédiaire |
| Les pages légales ne décrivent pas précisément sous-traitants et droits RGPD. | Compléter confidentialité, cookies, mentions légales, CGU/CGV avec validation juridique. | Conformité et crédibilité. | `Frontend/conditions.html`, `Frontend/confidentialite.html`, nouveaux fichiers légaux | Élevée | Intermédiaire |
| Absence de rotation/révocation guidée des secrets. | Documenter procédure de rotation `JWT_SECRET`, OAuth, Cloudinary, clés de chiffrement. | Meilleure résilience incident. | `OPERATIONS.md`, `DEPLOYMENT.md` | Moyenne | Simple |
| Super-développeur très puissant même encadré. | Ajouter logs consultables, justification obligatoire et expiration visible. | Auditabilité. | `Backend/routes/auth.js`, `Backend/routes/activity.js`, `Frontend/app.js` | Élevée | Intermédiaire |

### Performances

| Problème observé | Modification recommandée | Intérêt | Fichiers concernés | Priorité | Difficulté |
|---|---|---|---|---|---|
| `Frontend/app.js` concentre beaucoup de logique. | Découper progressivement par vues : auth, rapports, planning, paramètres, notifications. | Chargement et maintenance plus efficaces. | `Frontend/app.js`, nouveaux modules | Moyenne | Complexe |
| Génération PDF synchrone sur requête HTTP. | Étudier file d’attente ou cache PDF invalidé par `report_version`. | Réduit pics CPU/mémoire et timeouts. | `Backend/routes/interventions.js`, `Backend/services/pdf.js` | Élevée | Complexe |
| Recherche globale utilise `ILIKE %term%`. | Ajouter index trigram PostgreSQL ou recherche structurée si volume augmente. | Recherche plus rapide. | migrations, `Backend/routes/search.js` | Moyenne | Intermédiaire |
| Chargement initial appelle plusieurs endpoints. | Ajouter endpoint agrégé léger pour bootstrap ou chargement progressif par vue. | Meilleur temps de première interaction. | `Backend/routes/*`, `Frontend/app.js` | Moyenne | Intermédiaire |
| Images distantes lues pour PDF avec fetch direct. | Cache temporaire contrôlé pendant génération ou timeout par image avec fallback visible. | Moins d’échecs PDF et moins de latence. | `Backend/services/pdf.js`, `Backend/services/storage.js` | Moyenne | Intermédiaire |
| Les ressources shell PWA sont mises en cache mais pas versionnées par hash. | Automatiser le bump de `CACHE_VERSION` ou ajouter manifest de build. | Évite les incohérences après déploiement. | `Frontend/sw.js`, scripts npm | Moyenne | Simple |

### Expérience utilisateur

| Problème observé | Modification recommandée | Intérêt | Fichiers concernés | Priorité | Difficulté |
|---|---|---|---|---|---|
| Certains états vides étaient trop courts. | Remplacer par des messages explicatifs et orientés action. | Meilleure prise en main. | `Frontend/app.js`, `Frontend/views/resources.js` | Moyenne | Simple |
| Les formulaires longs de rapport peuvent être intimidants. | Ajouter sommaire de sections, progression et accès rapide aux champs requis manquants. | Saisie terrain plus rapide. | `Frontend/app.js`, `Frontend/styles/reports.css` | Élevée | Intermédiaire |
| Les erreurs de validation de rapport apparaissent au toast mais ne ciblent pas le champ. | Faire défiler et mettre en évidence le champ fautif. | Correction plus rapide. | `Frontend/app.js`, `Backend/routes/interventions.js` | Élevée | Intermédiaire |
| Le planning mensuel manque de filtres. | Ajouter filtre technicien/statut/client et bouton “Aujourd’hui”. | Planification plus lisible. | `Frontend/app.js`, `Backend/routes/interventions.js` | Moyenne | Intermédiaire |
| Les recherches de listes ne montrent pas d’état “aucun résultat pour ce filtre”. | Différencier “aucune donnée” et “aucun résultat”. | Évite les malentendus. | `Frontend/app.js`, `Frontend/views/resources.js` | Moyenne | Simple |
| La suppression individuelle de notifications est directe. | Ajouter annulation “Notification supprimée — Annuler” ou confirmation discrète. | Réduit les erreurs. | `Frontend/app.js`, `Backend/routes/notifications.js` | Faible | Intermédiaire |
| Les e-mails de rapport ne proposent pas d’aperçu avant envoi. | Ajouter aperçu objet/message/destinataires/PDF sélectionné. | Moins d’erreurs d’envoi. | `Frontend/app.js`, `Backend/routes/interventions.js` | Moyenne | Intermédiaire |
| Les brouillons locaux de rapport sont invisibles hors statut autosave. | Afficher date de dernière sauvegarde locale et option effacer le brouillon. | Plus de confiance pendant la saisie. | `Frontend/app.js` | Moyenne | Simple |

### Interface et design

| Problème observé | Modification recommandée | Intérêt | Fichiers concernés | Priorité | Difficulté |
|---|---|---|---|---|---|
| Composants HTML construits manuellement dans de longues chaînes. | Créer helpers de composants réutilisables pour cartes, boutons, champs, empty states. | Cohérence visuelle et moins de duplication. | `Frontend/app.js`, `Frontend/views/*` | Moyenne | Intermédiaire |
| Les tableaux mobile deviennent des cartes mais peuvent être denses. | Ajouter hiérarchie plus claire, actions repliées et badges plus lisibles. | Meilleure lisibilité terrain. | `Frontend/app.css`, `Frontend/views/resources.js`, `Frontend/app.js` | Moyenne | Intermédiaire |
| Les modales longues servent à beaucoup de parcours. | Ajouter sous-sections sticky, ancres et bouton retour haut. | Navigation plus confortable. | `Frontend/app.js`, `Frontend/app.css` | Moyenne | Intermédiaire |
| Les animations ne respectent pas explicitement `prefers-reduced-motion`. | Ajouter media query pour réduire transitions/spinners non essentiels. | Accessibilité vestibulaire. | `Frontend/app.css` | Moyenne | Simple |
| Les couleurs du thème glass/dark peuvent manquer de contraste sur certains états. | Auditer contraste WCAG et ajuster badges, muted, boutons danger/secondary. | Accessibilité et professionnalisme. | `Frontend/app.css`, `Frontend/styles/reports.css` | Moyenne | Intermédiaire |
| Les pages légales sont en HTML compact difficile à maintenir. | Les reformater en documents lisibles avec sections et navigation. | Maintenance et crédibilité. | `Frontend/*.html`, `Frontend/legal.css` | Moyenne | Simple |

### Nouvelles fonctionnalités

| Problème observé | Modification recommandée | Intérêt | Fichiers concernés | Priorité | Difficulté |
|---|---|---|---|---|---|
| Pas de gestion avancée des tâches récurrentes. | Ajouter interventions récurrentes et rappels programmés. | Gain de temps pour maintenance périodique. | migrations, `Backend/routes/interventions.js`, `Frontend/app.js` | Moyenne | Complexe |
| Pas d’export CSV visible. | Ajouter exports clients/matériels/interventions. | Reporting et sauvegarde métier. | routes dédiées, `Frontend/app.js` | Faible | Intermédiaire |
| Pas de pièces jointes documentaires hors photos. | Ajouter documents client/matériel sécurisés. | Centralise certificats, notices, contrats. | migrations, routes uploads, frontend | Moyenne | Complexe |
| Notifications uniquement passives. | Ajouter préférences de notifications et e-mails de rappel. | Meilleure réactivité équipe. | migrations, `Backend/routes/notifications.js`, services e-mail | Moyenne | Complexe |
| Pas de tableaux de bord par technicien/client. | Ajouter vues analytics : charge, retards, taux terminé, volumes. | Pilotage opérationnel. | `Backend/routes/interventions.js`, `Frontend/app.js` | Moyenne | Intermédiaire |
| Pas de mode “modèle favori”. | Permettre modèle par défaut par entreprise/utilisateur. | Saisie plus rapide. | migrations, `Backend/routes/modeles.js`, `Frontend/app.js` | Faible | Intermédiaire |
| Pas de raccourcis clavier documentés. | Ajouter raccourcis `/` recherche, `n` nouvelle intervention, `?` aide. | Productivité desktop. | `Frontend/app.js` | Faible | Simple |

### Qualité du code

| Problème observé | Modification recommandée | Intérêt | Fichiers concernés | Priorité | Difficulté |
|---|---|---|---|---|---|
| `app.js` est devenu trop volumineux. | Extraire les vues et handlers par domaine. | Réduit risques de régression. | `Frontend/app.js`, nouveaux modules | Élevée | Complexe |
| Les helpers `positiveId`, `nullableText`, validations sont dupliqués côté routes. | Créer utilitaires backend partagés. | Moins de bugs divergents. | `Backend/routes/*`, `Backend/utils/validation.js` | Moyenne | Intermédiaire |
| Beaucoup de HTML est généré par interpolation. | Standardiser helpers d’échappement et éviter exceptions. | Sécurité et maintenabilité. | `Frontend/app.js`, `Frontend/views/*` | Moyenne | Intermédiaire |
| Pas de typage statique. | Introduire JSDoc strict ou TypeScript progressivement sur utilitaires/routes. | Détection plus précoce des erreurs. | frontend/backend JS | Faible | Complexe |
| Les tests d’intégration sont désactivés par défaut. | Ajouter job CI dédié avec base PostgreSQL de test. | Validation multi-tenant réelle. | GitHub Actions, `Backend/test/integration-api.test.js` | Élevée | Intermédiaire |

### Maintenance

| Problème observé | Modification recommandée | Intérêt | Fichiers concernés | Priorité | Difficulté |
|---|---|---|---|---|---|
| Dépendances backend avec versions plus récentes disponibles. | Planifier mises à jour mineures `@aws-sdk/client-s3`, `@sentry/node`; étudier majeures `express` 5, `bcryptjs` 3, `dotenv` 17. | Sécurité, support et compatibilité. | `Backend/package.json`, `Backend/package-lock.json` | Moyenne | Intermédiaire |
| `npm audit --omit=dev` est sain aujourd’hui mais non automatisé visiblement. | Ajouter contrôle audit en CI/preflight selon seuil. | Réduit risque supply-chain. | scripts npm, CI | Moyenne | Simple |
| Documentation d’exploitation mentionne production manuelle. | Ajouter checklist “avant/après déploiement” avec health, logs, rollback. | Déploiements plus sûrs. | `OPERATIONS.md`, `DEPLOYMENT.md` | Moyenne | Simple |
| Les migrations historiques ont une migration modifiée/réconciliée. | Documenter précisément la politique “ne jamais modifier une migration appliquée”. | Évite incidents de checksum. | `OPERATIONS.md`, `Backend/database/migrate.js` | Élevée | Simple |
| Pas de matrice claire des permissions. | Ajouter tableau des droits par rôle. | Décisions produit et tests plus faciles. | `README.md`, tests authorization | Moyenne | Simple |
| Les sauvegardes existent mais nécessitent confirmation opérationnelle Neon. | Mettre en place rappel mensuel et preuve de restauration. | Résilience données. | `OPERATIONS.md`, scripts backup | Élevée | Intermédiaire |

### Améliorations secondaires

| Problème observé | Modification recommandée | Intérêt | Fichiers concernés | Priorité | Difficulté |
|---|---|---|---|---|---|
| Les infobulles sont surtout des `title`. | Ajouter composant tooltip accessible. | Aide contextuelle plus propre. | `Frontend/app.js`, `Frontend/app.css` | Faible | Intermédiaire |
| Les dates affichent rarement l’heure complète/contexte. | Uniformiser format date + heure + statut relatif. | Meilleure compréhension terrain. | `Frontend/utils/format.js`, `Frontend/app.js` | Faible | Simple |
| Les boutons “Ajouter” dépendent du contexte mais pas toujours explicites. | Renommer selon vue : “Ajouter un client”, “Ajouter un matériel”. | Moins d’ambiguïté. | `Frontend/app.js` | Faible | Simple |
| Le tutoriel est global. | Ajouter mini-aides par page et checklists de démarrage. | Onboarding progressif. | `Frontend/app.js`, `Frontend/app.css` | Faible | Intermédiaire |
| Le sitemap ne liste pas toutes les pages publiques potentielles. | Ajouter uniquement les routes publiques réellement disponibles ; créer pages marketing si besoin. | SEO plus cohérent. | `Frontend/sitemap.xml`, nouvelles pages | Faible | Simple |
| Le bouton PWA dépend de l’événement navigateur. | Ajouter instructions d’installation permanentes par plateforme. | Moins de support utilisateur. | `Frontend/app.js`, `README.md` | Faible | Simple |

## Premier lot appliqué pendant cet audit

Modifications simples, compatibles avec l’architecture actuelle :

- amélioration des états vides des listes clients, matériels, équipe, modèles et rapports ;
- messages différenciés selon rôle quand pertinent ;
- bump du cache PWA pour forcer la prise en compte des libellés après déploiement.

Fichiers modifiés :

- `Frontend/app.js`
- `Frontend/views/resources.js`
- `Frontend/sw.js`
- `AUDIT_AMELIORATIONS.md`

## Vérifications effectuées

- `npm audit --omit=dev` : aucune vulnérabilité trouvée.
- `npm --prefix Backend audit --omit=dev` : aucune vulnérabilité trouvée.
- `npm --prefix Backend outdated --depth=0` : mises à jour disponibles pour `@aws-sdk/client-s3`, `@sentry/node`, `bcryptjs`, `dotenv`, `express`.
- `npm run check` : 68 fichiers JavaScript vérifiés.
- `npm test` : 56 tests réussis, 1 test d’intégration PostgreSQL ignoré par défaut.
- `npm run release:check` : contrôles de prépublication réussis.
- `npm run build --if-present` : aucun script `build` défini, donc aucune étape de build à exécuter pour ce frontend sans bundler.
