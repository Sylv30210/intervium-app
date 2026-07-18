# Demandes Intervium reçues par e-mail

Ce journal conserve uniquement les informations techniques nécessaires au suivi. Les coordonnées personnelles, secrets et contenus sans rapport avec Intervium en sont exclus.

## 2026-07-18 — Fil `19f74aa0689611cb`

- **Catégories :** bugs, fonctionnalités et améliorations.
- **Résumé :** orientation et visuels des médias, nom du PDF, taille des signatures, choix « Autre », rapports directs dans le planning, import multiple et annotation de photos.
- **Analyse et décision :**
  - nom du PDF, import multiple et erreur réseau de l’annotateur : demandes claires, sûres et réalisables, corrigées ;
  - choix « Autre » : comportement déjà présent et couvert par les tests ;
  - orientation paysage, emplacement exact des visuels, dimensions des signatures et date d’affichage des rapports directs : précisions fonctionnelles nécessaires avant modification.
- **Réponse :** envoyée le 2026-07-18 dans le même fil ; confirmation des points corrigés et demande ciblée de précisions sur les quatre points ambigus. Fil libellé `Intervium/En attente`.
- **Fichiers modifiés :** `Backend/routes/interventions.js`, `Backend/routes/uploads.js`, `Backend/services/pdf.js`, `Backend/services/storage.js`, `Backend/test/integration-api.test.js`, `Backend/test/pdf-layout.test.js`, `Frontend/app.js`, `Frontend/sw.js`, ce journal.
- **Commit / PR :** commit `e30d12d` poussé sur `agent/intervium-email-2026-07-18`. Création de PR bloquée par les permissions du connecteur GitHub (HTTP 403) ; branche communiquée dans la réponse.
- **Vérifications :** `npm run check` réussi ; `npm test` réussi (30 tests, 1 test d’intégration PostgreSQL ignoré faute d’environnement activé) ; `npm run release:check` réussi.

## 2026-07-17 — Fil `19f70a4dd528b85d`

- **Catégorie :** bugs.
- **Résumé :** titre de signature encore visible dans le PDF, blocs d’informations redondants dans le PDF et échec de création d’intervention.
- **Décision :** corrections déjà réalisées dans les commits `709bbcc`, `a73db06` et fusionnées dans la branche principale (PR #2 pour le correctif final de création).
- **Réponse :** confirmation de prise en compte, résumé des corrections et tests envoyés le 2026-07-18 dans le même fil. Fil libellé `Intervium/Traité`.
- **Fichiers concernés :** `Backend/routes/interventions.js`, `Backend/services/pdf.js`, `Backend/test/integration-api.test.js`, `Backend/test/pdf-layout.test.js`.
- **Vérifications de cette exécution :** `npm run check` et `npm test` réussis.

## 2026-07-16 — Fil `19f6c58a2bb30ccc`

- **Catégorie :** fonctionnalités sensibles.
- **Résumé :** duplication de modèles, modification administrative de l’adresse de connexion et remplacement volontaire du compte Google par l’utilisateur.
- **Clarification reçue :** validation explicite de l’approche sécurisée, sans transfert de jetons Google.
- **Décision :** déjà réalisé dans le commit `65cb1a3` : duplication limitée aux administrateurs, unicité et journalisation de l’adresse, déconnexion puis reconnexion OAuth par l’utilisateur.
- **Réponse :** confirmation finale envoyée le 2026-07-18 dans le même fil. Fil libellé `Intervium/Traité`.
- **Vérifications de cette exécution :** `npm run check` et `npm test` réussis.

## 2026-07-16 — Fil `19f6c54aa5d6e965`

- **Catégories :** amélioration et bugs.
- **Résumé :** confirmation avant fermeture de formulaires modifiés, correction de « Suite à donner » et numérotation annuelle des rapports.
- **Clarification reçue :** format `AAAA-NNNN` validé sans renumérotation de l’historique.
- **Décision :** déjà réalisé dans le commit `65cb1a3`, avec correctifs complémentaires `709bbcc` et `a73db06` pour l’attribution transactionnelle du numéro lors de la création.
- **Réponse :** confirmation finale envoyée le 2026-07-18 dans le même fil. Fil libellé `Intervium/Traité`.
- **Vérifications de cette exécution :** `npm run check` et `npm test` réussis.
