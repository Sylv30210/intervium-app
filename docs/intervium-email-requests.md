# Demandes Intervium reçues par e-mail

Ce journal conserve uniquement les informations techniques nécessaires au suivi. Les coordonnées personnelles, secrets et contenus sans rapport avec Intervium en sont exclus.

## 2026-07-19 — Fil `19f7b91aa4a80dd2`

- **Catégorie :** bug de rendu PDF.
- **Résumé :** les libellés « Titre affiché » des blocs de signature de modèle étaient rendus comme des titres de section du modèle dans le PDF, au lieu d'adopter le style compact des autres champs.
- **Analyse et décision :** demande claire, sûre et réalisable. Les pièces jointes du transfert ont été considérées comme non fiables ; le texte de la demande suffisait à reproduire l'écart de style. Le rendu des signatures de modèle utilise désormais le style de libellé de champ et n'affiche plus le libellé une seconde fois sous l'image de signature.
- **Réponse :** confirmation envoyée directement à l'expéditeur original, avec demande de répondre à cet e-mail si le défaut persiste après publication. Fil libellé `Intervium/Traité`.
- **Fichiers modifiés :** `Backend/services/pdf.js`, `Backend/test/pdf-layout.test.js`, ce journal.
- **Commit / PR :** commit applicatif et documentaire créé sur `main` ; aucune PR nécessaire selon le workflow actuel du dépôt.
- **Vérifications :** `npm run check` réussi ; `npm test` réussi (52 tests passés, 1 intégration PostgreSQL ignorée localement) ; `npm run release:check` réussi ; `git diff --check` sans erreur bloquante.

## 2026-07-19 — Fil `19f7aeeb6c3d9eb0` — suivi

- **Catégorie :** bug de rendu PDF.
- **Résumé :** après la première correction de `[x]` vers `√`, le caractère ne s'affichait toujours pas correctement dans le PDF généré.
- **Analyse et décision :** demande de suivi claire et sûre. Le symbole de coche demandé est désormais dessiné dans le PDF avec la police PDF Symbol, afin d'éviter les substitutions incorrectes de la police texte standard, tout en conservant le libellé de configuration `√` côté interface.
- **Réponse :** confirmation envoyée directement à l'expéditeur original, avec demande de répondre à cet e-mail si le rendu reste incorrect après publication. Fil libellé `Intervium/Traité`.
- **Fichiers modifiés :** `Backend/services/pdf.js`, `Backend/test/pdf-layout.test.js`, ce journal.
- **Commit / PR :** commit applicatif et documentaire créé sur `main` ; aucune PR nécessaire selon le workflow actuel du dépôt.
- **Vérifications :** `npm run check` réussi ; `npm test` réussi (52 tests passés, 1 intégration PostgreSQL ignorée localement) ; `npm run release:check` réussi ; `git diff --check` sans erreur bloquante.

## 2026-07-19 — Fil `19f7a51b389bee3f`

- **Catégorie :** bug de signature de rapport.
- **Résumé :** l'enregistrement d'une signature affichait à tort l'erreur indiquant que le champ « Date d'intervention » était requis.
- **Analyse et décision :** demande claire, sûre et déjà corrigée par le correctif précédent `9410f61`. La signature s'enregistre via l'endpoint dédié sans déclencher la validation complète des champs obligatoires encore vides du rapport.
- **Réponse :** confirmation envoyée directement à l'expéditeur original, avec résumé du correctif déjà publié et demande de répondre à cet e-mail si le défaut persiste.
- **Fichiers modifiés :** aucun nouveau fichier applicatif pour cette demande dans cette exécution ; correctif antérieur `Backend/routes/interventions.js`, `Frontend/app.js`, `Backend/test/frontend-utils.test.js`, ce journal.
- **Commit / PR :** correctif antérieur `9410f61` déjà déployé ; suivi documentaire inclus dans le commit de cette exécution.
- **Vérifications :** les vérifications de cette exécution restent réussies : `npm run check`, `npm test`, `npm run release:check` et `git diff --check`.

## 2026-07-19 — Fil `19f7aeeb6c3d9eb0`

- **Catégorie :** bug de rendu PDF.
- **Résumé :** le préfixe optionnel des choix de cases à cocher apparaissait sous la forme `[x]` ; la demande précise d'utiliser le caractère clavier `√`.
- **Analyse et décision :** demande claire, sûre et réalisable. Le rendu PDF et le libellé de configuration utilisent désormais exactement `√`, sans emoji. Les pièces jointes transférées ont été considérées comme non fiables et n'étaient pas nécessaires à la correction.
- **Réponse :** confirmation envoyée directement à l'expéditeur original, avec demande de répondre à cet e-mail si le défaut persiste après publication. Fil libellé `Intervium/Traité`.
- **Fichiers modifiés :** `Backend/services/pdf.js`, `Backend/test/pdf-layout.test.js`, `Frontend/app.js`, `Frontend/sw.js`, ce journal.
- **Commit / PR :** commit applicatif et documentaire créé sur `main` ; aucune PR nécessaire selon le workflow actuel du dépôt.
- **Vérifications :** `git diff --check` sans erreur ; `npm run check` réussi (68 fichiers JavaScript) ; `npm test` réussi (51 tests passés, 1 intégration PostgreSQL ignorée localement) ; `npm run release:check` réussi.

## 2026-07-19 — Fil `19f79f9e629753db`

- **Catégories :** bugs de saisie de rapport, fonctionnalités de rapport/PDF et suggestion de paramétrage e-mail.
- **Résumé :** demande transmise concernant la perte de données après signature sans enregistrement manuel, la fermeture de la fiche après clic sur « Enregistrer le rapport », la personnalisation du message e-mail par défaut, l'option « Autre » manquante dans les cases à cocher, le nom du signataire au-dessus d'une signature, l'affichage ligne par ligne des choix de cases à cocher dans le PDF et une option d'affichage du symbole `✓`.
- **Analyse et décision :** demande claire, sûre et cohérente avec les modèles de rapport existants. Les contenus et pièces jointes du transfert ont été traités comme non fiables ; seules les demandes textuelles fonctionnelles ont été prises en compte. Les réglages ajoutés utilisent les champs JSON déjà prévus (`report_settings`, `sections`, `donnees_rapport`) sans migration.
- **Réponse :** confirmation envoyée directement à l'expéditeur original dans le fil transféré, avec résumé des sept corrections, commits, tests et demande de répondre à cet e-mail si un point reste visible après publication. Fil libellé `Intervium/Traité`.
- **Fichiers modifiés :** `Backend/routes/auth.js`, `Backend/routes/interventions.js`, `Backend/routes/modeles.js`, `Backend/services/pdf.js`, `Backend/test/frontend-utils.test.js`, `Backend/test/pdf-layout.test.js`, `Frontend/app.js`, `Frontend/sw.js`, ce journal.
- **Commit / PR :** commit applicatif `f20a8d2` sur `main` ; suivi documentaire `b733b54`, puis mise à jour finale du journal après réponse e-mail. Aucun workflow de PR requis pour cette exécution locale sur `main`.
- **Vérifications :** `npm run check` réussi ; `npm test` réussi (50 tests passés, 1 intégration PostgreSQL ignorée localement) ; `npm run release:check` réussi ; `git diff --check` sans erreur ; GitHub Actions `main` réussie sur `b733b54`.

## 2026-07-18 — Fil `19f74f8673edfac6`

- **Catégorie :** bug / incident d’exploitation.
- **Résumé :** Render a redémarré automatiquement le service Intervium après dépassement de sa limite mémoire, avec une indisponibilité temporaire signalée vers 13:23.
- **Analyse :** le service répond de nouveau correctement sur les routes publiques de santé et de version. Une seule alerte mémoire correspondante est présente dans la boîte. Le dépôt déclare un plan Render gratuit et comporte des traitements d’images et de PDF en mémoire, mais aucun log ni relevé métrique autour de l’incident n’est accessible dans cette session pour distinguer une fuite, un pic de charge ou une capacité insuffisante.
- **Décision :** aucune modification de code ni changement de plan sans preuve. Incident conservé sous `Intervium/En attente` jusqu’à consultation des logs et de la courbe mémoire Render. Aucun message envoyé à l’adresse automatisée `no-reply`.
- **Fichiers modifiés :** ce journal uniquement.
- **Commit / PR :** incident journalisé à partir du commit `15ce270` ; PR brouillon [#5](https://github.com/Sylv30210/intervium-app/pull/5) ouverte vers `main`. La PR #4 précédente avait déjà été fusionnée avant cette alerte.
- **Vérifications :** recherches Gmail générale et par sujet ; lecture du fil complet ; `GET /api/health` réussi ; `GET /api/version` réussi (`2.2.0`) ; dépôt propre avant journalisation. Aucun test applicatif exécuté faute de changement de code.
## 2026-07-18 — Fil `19f7541ba3c71adf`

- **Catégorie :** bugs mobiles et PDF.
- **Résumé :** recherche des rapports inopérante en portrait, liste d’interventions variant selon l’orientation, sélection de photos limitée à l’appareil photo et blocs photo non rendus en demi-largeur dans le PDF.
- **Analyse et décision :** demande claire, sûre et réalisable. La recherche locale ne couvrait que la page chargée et les lignes masquées restaient affichées dans la présentation mobile ; la taille de page dépendait en outre de la hauteur d’écran. La recherche est désormais transmise à l’API sur toutes les pages, les lignes filtrées sont réellement masquées et la pagination conserve 20 éléments quelle que soit l’orientation. L’attribut imposant la caméra est retiré afin de laisser Android proposer caméra ou photothèque. Les blocs photo configurés en demi-largeur rendent deux images par ligne dans le PDF.
- **Réponse :** confirmation envoyée directement à l’expéditeur original dans le fil direct `19f74cb0a232006d`, avec résumé des quatre corrections, lien vers la PR et invitation à répondre à cet e-mail après publication en cas de problème persistant. Le fil transféré et la réponse directe sont libellés `Intervium/Traité`.
- **Fichiers modifiés :** `Frontend/app.js`, `Frontend/app.css`, `Frontend/sw.js`, `Frontend/utils/collections.js`, `Frontend/views/resources.js`, `Backend/services/pdf.js`, `Backend/test/frontend-utils.test.js`, `Backend/test/pdf-layout.test.js`, ce journal.
- **Commit / PR / publication :** commits applicatif `895123d` et de suivi jusqu’à `771c7a5` poussés sur `agent/intervium-mobile-2026-07-18` ; PR brouillon [#6](https://github.com/Sylv30210/intervium-app/pull/6). Le commit `771c7a5` a été publié directement sur le service Render de production le 2026-07-18, sans fusion de la PR ; déploiement `dep-d9dni0mrnols73cr04m0` passé à `live`.
- **Vérifications :** `git diff --check`, `npm run check`, `npm test` (37 réussis, 1 intégration PostgreSQL ignorée localement faute d’environnement activé) et `npm run release:check` réussis ; les deux contrôles GitHub Actions du commit `6379eb4` sont également réussis, y compris l’intégration PostgreSQL complète. Après publication, `/`, `/api/health` et `/api/version` répondent en HTTP 200 et aucun journal Render de niveau erreur n’est présent depuis le début du déploiement.
- **Incident après publication :** les logs ont ensuite révélé un échec PostgreSQL `bigint = text` sur `/api/notifications` et l’avertissement persistant concernant le checksum de la migration 015 assainie. Le correctif `67b8e96` ajoute des casts explicites aux paramètres de notifications, couvre l’endpoint dans le test PostgreSQL et régularise uniquement la transition de checksum historique connue, sans réexécuter 015 ni restaurer les données sensibles retirées. Les deux CI, dont l’intégration PostgreSQL complète, ont réussi ; le déploiement Render `dep-d9dobn3tqb8s7394mppg` est passé à `live`. La migration 021 a été appliquée, la base confirme le checksum assaini de 015 et aucun nouveau HTTP 500 n’est apparu depuis le démarrage de la nouvelle instance.

## 2026-07-18 — Fil `19f74aa0689611cb`

- **Catégories :** bugs, fonctionnalités et améliorations.
- **Résumé :** orientation et visuels des médias, nom du PDF, taille des signatures, choix « Autre », rapports directs dans le planning, import multiple et annotation de photos.
- **Analyse et décision :**
  - nom du PDF, import multiple et erreur réseau de l’annotateur : demandes claires, sûres et réalisables, corrigées ;
  - choix « Autre » : comportement déjà présent et couvert par les tests ;
  - précision reçue le 2026-07-18 : toute photo verticale doit être automatiquement tournée, le cadre PDF doit suivre la largeur affichée de la signature et l’option de création d’un rapport direct doit être supprimée ; ces trois points ont été réalisés en conservant la consultation des rapports directs historiques ;
  - visuels manquants : deux captures reçues le 2026-07-18 montrent précisément le logo d’entreprise et une photo de rapport remplacés par leur texte alternatif. Les fichiers distants ont été contrôlés et restent disponibles ; l’affichage direct depuis le stockage est remplacé par des sources authentifiées du même domaine pour le logo, les photos et les signatures, sans modifier les médias stockés.
- **Réponses :** première réponse envoyée le 2026-07-18 avec les corrections initiales et quatre demandes ciblées ; réponse complémentaire envoyée après la clarification pour confirmer les trois nouveaux correctifs et demander un exemple concret concernant les visuels. Le suivi a ensuite été renvoyé directement à l’expéditeur original dans le fil `19f74cb0a232006d`, avec demande de répondre à ce nouvel e-mail. Après réception des captures et du retour indiquant que plusieurs comportements restaient visibles dans la version publiée, une confirmation finale a été envoyée dans ce fil direct : correctif des médias validé, autres changements présents dans la PR mais pas encore publiés, actualisation à effectuer après publication. Un transfert ultérieur `19f74f723544f859`, accompagné d’une nouvelle capture montrant le même défaut de photos et de signature, a été classé comme doublon déjà couvert ; aucune réponse répétée n’a été envoyée. Les fils direct et transférés sont passés à `Intervium/Traité`.
- **Fichiers modifiés :** `Backend/routes/interventions.js`, `Backend/routes/uploads.js`, `Backend/server.js`, `Backend/services/pdf.js`, `Backend/services/storage.js`, `Backend/test/frontend-utils.test.js`, `Backend/test/image-layout.test.js`, `Backend/test/integration-api.test.js`, `Backend/test/pdf-layout.test.js`, `Frontend/app.js`, `Frontend/sw.js`, `Frontend/utils/media.js`, ce journal.
- **Commit / PR :** commits `e30d12d`, `e07bb1e`, `2b7a36d` et `99c4221` poussés sur `agent/intervium-email-2026-07-18` ; PR [#4](https://github.com/Sylv30210/intervium-app/pull/4) ouverte sur cette branche.
- **CI :** les exécutions des commits `e30d12d` et `e07bb1e` ont échoué parce que la miniature PNG codée en dur du test d’intégration était refusée par `sharp` sur le runner ; le test génère désormais une image PNG valide et contrôle aussi sa conversion automatique en paysage. Les exécutions GitHub Actions des commits `2b7a36d` et `99c4221` sont réussies, y compris le test d’intégration PostgreSQL complet.
- **Vérifications :** `npm run check` réussi ; `npm test` réussi (34 tests unitaires, 1 test d’intégration PostgreSQL ignoré localement faute d’environnement activé) ; les tests couvrent maintenant les URL authentifiées des quatre familles de médias ; `npm run release:check` réussi ; génération réelle d’une photo paysage et d’un PDF signé validée ; test d’intégration complet PostgreSQL réussi dans GitHub Actions.

## 2026-07-17 — Fil `19f70a4dd528b85d`

- **Catégorie :** bugs.
- **Résumé :** titre de signature encore visible dans le PDF, blocs d’informations redondants dans le PDF et échec de création d’intervention.
- **Décision :** corrections déjà réalisées dans les commits `709bbcc`, `a73db06` et fusionnées dans la branche principale (PR #2 pour le correctif final de création).
- **Réponse :** confirmation de prise en compte, résumé des corrections et tests envoyés le 2026-07-18 dans le fil transféré, puis renvoyés directement à l’expéditeur original dans le fil `19f74cb0a232006d` avec demande de répondre à ce nouvel e-mail. Fil transféré libellé `Intervium/Traité` ; fil direct libellé `Intervium/En attente` pour le point visuel encore ouvert.
- **Fichiers concernés :** `Backend/routes/interventions.js`, `Backend/services/pdf.js`, `Backend/test/integration-api.test.js`, `Backend/test/pdf-layout.test.js`.
- **Vérifications de cette exécution :** `npm run check` et `npm test` réussis.

## 2026-07-16 — Fil `19f6c58a2bb30ccc`

- **Catégorie :** fonctionnalités sensibles.
- **Résumé :** duplication de modèles, modification administrative de l’adresse de connexion et remplacement volontaire du compte Google par l’utilisateur.
- **Clarification reçue :** validation explicite de l’approche sécurisée, sans transfert de jetons Google.
- **Décision :** déjà réalisé dans le commit `65cb1a3` : duplication limitée aux administrateurs, unicité et journalisation de l’adresse, déconnexion puis reconnexion OAuth par l’utilisateur.
- **Réponse :** confirmation finale envoyée le 2026-07-18 dans le fil initial. La demande de validation a été renvoyée directement à l’expéditeur original dans le nouveau fil `19f74cadecce5c7c`, en précisant de répondre à cet e-mail ; ce fil direct est libellé `Intervium/En attente`.
- **Vérifications de cette exécution :** `npm run check` et `npm test` réussis.

## 2026-07-16 — Fil `19f6c54aa5d6e965`

- **Catégories :** amélioration et bugs.
- **Résumé :** confirmation avant fermeture de formulaires modifiés, correction de « Suite à donner » et numérotation annuelle des rapports.
- **Clarification reçue :** format `AAAA-NNNN` validé sans renumérotation de l’historique.
- **Décision :** déjà réalisé dans le commit `65cb1a3`, avec correctifs complémentaires `709bbcc` et `a73db06` pour l’attribution transactionnelle du numéro lors de la création.
- **Réponse :** confirmation finale envoyée le 2026-07-18 dans le fil initial. La demande de validation du format a été renvoyée directement à l’expéditeur original dans le nouveau fil `19f74cab9c6057da`, en précisant de répondre à cet e-mail ; ce fil direct est libellé `Intervium/En attente`.
- **Vérifications de cette exécution :** `npm run check` et `npm test` réussis.
