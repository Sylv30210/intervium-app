# Demandes Intervium reçues par e-mail

Ce journal conserve uniquement les informations techniques nécessaires au suivi. Les coordonnées personnelles, secrets et contenus sans rapport avec Intervium en sont exclus.

## 2026-07-18 — Fil `19f74f8673edfac6`

- **Catégorie :** bug / incident d’exploitation.
- **Résumé :** Render a redémarré automatiquement le service Intervium après dépassement de sa limite mémoire, avec une indisponibilité temporaire signalée vers 13:23.
- **Analyse :** le service répond de nouveau correctement sur les routes publiques de santé et de version. Une seule alerte mémoire correspondante est présente dans la boîte. Le dépôt déclare un plan Render gratuit et comporte des traitements d’images et de PDF en mémoire, mais aucun log ni relevé métrique autour de l’incident n’est accessible dans cette session pour distinguer une fuite, un pic de charge ou une capacité insuffisante.
- **Décision :** aucune modification de code ni changement de plan sans preuve. Incident conservé sous `Intervium/En attente` jusqu’à consultation des logs et de la courbe mémoire Render. Aucun message envoyé à l’adresse automatisée `no-reply`.
- **Fichiers modifiés :** ce journal uniquement.
- **Commit / PR :** commit de journal associé à cette entrée sur la branche de la PR [#4](https://github.com/Sylv30210/intervium-app/pull/4).
- **Vérifications :** recherches Gmail générale et par sujet ; lecture du fil complet ; `GET /api/health` réussi ; `GET /api/version` réussi (`2.2.0`) ; dépôt propre avant journalisation. Aucun test applicatif exécuté faute de changement de code.

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
