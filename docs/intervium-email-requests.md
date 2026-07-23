# Demandes Intervium reçues par e-mail

## 2026-07-23 — Fils transférés `signature technicien` et `intervium`

- **Catégories :** bug / amélioration d’interface ; question / amélioration de paramétrage.
- **Résumé :** l'expéditeur signale que l’aperçu de signature technicien mémorisée dans les paramètres est beaucoup trop grand. Il demande aussi comment les numéros de rapport sont générés et s’il est possible de commencer la numérotation de l’année en cours après 120 rapports papier déjà réalisés.
- **Analyse et décision :** les deux demandes sont claires et sûres. La signature était affichée à sa taille naturelle hors fiche rapport, car la règle CSS de dimensionnement ne ciblait que `.report-signature-field`. La numérotation existante repart par année et calcule `YYYY-0001`, `YYYY-0002`, etc. à partir du maximum des rapports Intervium de l’année. Pour intégrer les rapports papier sans collision, un réglage admin “dernier numéro papier utilisé” est ajouté dans les paramètres PDF d’entreprise ; le prochain rapport prend `max(numéro Intervium existant, dernier numéro papier) + 1`.
- **Réponse :** à envoyer à l'expéditeur original après validation CI.
- **Fichiers modifiés :** `Frontend/styles/reports.css`, `Frontend/app.js`, `Backend/routes/auth.js`, `Backend/routes/interventions.js`, `Backend/test/frontend-utils.test.js`, `Backend/test/integration-api.test.js`, ce journal.
- **Commit / PR :** à compléter après commit.
- **Vérifications :** `npm run check` réussi ; `npm test` réussi (59 tests passés, 1 intégration PostgreSQL ignorée localement) ; `npm run release:check` réussi ; `git diff --check` sans erreur bloquante.

## 2026-07-23 — Fil `19f8a98bdc880158` — nom visible dans le bloc signature technicien

- **Catégorie :** bug / amélioration d’interface.
- **Résumé :** l'expéditeur signale que, dans le nouveau bloc “Signature technicien”, le nom du technicien n'apparaît pas comme dans un bloc “Signature” classique.
- **Analyse et décision :** demande claire, sûre et limitée. Le PDF disposait déjà d'une logique de nom signataire pour le technicien, mais l'affichage formulaire avec signature mémorisée ne montrait que l'image et une aide textuelle. Le correctif ajoute le nom du technicien assigné en lecture seule au-dessus de la signature mémorisée, tout en conservant la valeur cachée utilisée par l'export PDF.
- **Réponse :** confirmation envoyée directement à l'expéditeur original avec le commit `d36694b`, les contrôles locaux et la CI GitHub réussie. Fil labellisé `Intervium/Traité`.
- **Fichiers modifiés :** `Frontend/app.js`, `Backend/test/frontend-utils.test.js`, ce journal.
- **Commit / PR :** commit `d36694b` poussé sur `main`; aucune PR nécessaire selon le workflow actuel.
- **Vérifications :** `npm run check` réussi ; `npm test` réussi (59 tests passés, 1 intégration PostgreSQL ignorée localement) ; `npm run release:check` réussi ; `git diff --check` sans erreur bloquante ; GitHub Actions CI `30011386708` réussie.

## 2026-07-23 — Fil `19f85cc3a3873cd5` — confirmation du périmètre PDF annotable

- **Catégorie :** fonctionnalité / document client PDF.
- **Résumé :** l'expéditeur confirme que la première version manuelle proposée convient pour le document client PDF.
- **Analyse et décision :** le besoin est maintenant cadré pour une première version : PDF uniquement, import depuis la fiche rapport, annotation manuelle libre page par page, conservation avec l'intervention et fusion à la fin du rapport final. La demande reste structurante et doit être développée dans un chantier dédié, séparé des correctifs rapides.
- **Réponse :** accusé envoyé directement à l'expéditeur original ; le fil reste en attente de développement dédié.
- **Fichiers modifiés :** ce journal uniquement.
- **Commit / PR :** suivi documentaire ajouté après le correctif `d36694b`.
- **Vérifications :** non applicable, aucune modification applicative pour ce chantier pendant cette exécution.

## 2026-07-22 — Fils transférés `Fwd: intervium` — confirmations collées

- **Catégories :** fonctionnalité signature technicien ; fonctionnalité document client PDF.
- **Résumé :** deux conversations transférées par Sylvain contiennent les confirmations de Claudine. Pour la signature technicien : l’admin peut consulter/supprimer la signature, le technicien modifie sa propre signature, le bloc PDF est distinct, s’affiche uniquement si le modèle le contient, indique “Technicien non assigné” sans affectation et demande une signature manuelle si le technicien assigné n’a pas de signature mémorisée. Pour le document client : première version PDF uniquement, import depuis la fiche rapport, annotation libre page par page, conservation comme média d’intervention et fusion à la fin du rapport final ; la détection automatique des cases vides est repoussée.
- **Analyse et décision :** la partie signature technicien est claire, sûre et compatible avec l’architecture actuelle. La partie document client PDF est claire dans son objectif mais structurante : elle nécessite stockage de PDF, rendu/annotation page par page, fusion PDF et contrôles de sécurité supplémentaires ; elle est conservée comme chantier dédié afin de ne pas mêler une grosse brique documentaire à la signature personnelle.
- **Réponse :** aucune réponse Gmail envoyée depuis cette session, car le connecteur Gmail n’est pas disponible ici. Un brouillon de confirmation devra être envoyé à l’expéditeur original Claudine lors du prochain passage Gmail.
- **Fichiers modifiés :** `Backend/database/schema.sql`, `Backend/database/migrations/024_user_signatures.sql`, `Backend/routes/auth.js`, `Backend/routes/interventions.js`, `Backend/routes/modeles.js`, `Backend/routes/uploads.js`, `Backend/services/pdf.js`, `Backend/test/checkbox-reports.test.js`, `Backend/test/frontend-utils.test.js`, `Frontend/app.js`, `Frontend/utils/media.js`, `Frontend/views/resources.js`, ce journal.
- **Commit / PR :** à créer après validation finale.
- **Vérifications :** `npm run check` réussi ; `npm test` réussi (58 tests passés, 1 intégration PostgreSQL ignorée localement) ; `npm run release:check` réussi ; `npm run build --if-present` terminé ; `git diff --check` sans erreur bloquante.

## 2026-07-22 — Fil `19f85cc92402346f` — confirmation après publication

- **Catégorie :** bug de rendu PDF.
- **Résumé :** après la correction du chevauchement, le bandeau de titre PDF était jugé trop épais. Le réglage a été affiné manuellement, puis publié.
- **Analyse et décision :** suivi clair, sûr et déjà traité dans le code. Le rendu final conserve le centrage vertical et l'espace empêchant le texte du champ suivant d'empiéter sur le fond, tout en réduisant la hauteur visuelle du bandeau.
- **Réponse :** confirmation finale envoyée directement à l'expéditeur original, avec les commits `261661d` et `29c864c`, le déploiement Render `dep-d9gh7fvlk1mc73aaedt0` et les vérifications. Fil libellé `Intervium/Traité`.
- **Fichiers modifiés :** `Backend/services/pdf.js`, `Backend/test/pdf-layout.test.js` via le correctif manuel précédent ; ce journal pour le suivi e-mail.
- **Commit / PR :** correctif applicatif `29c864c` déjà poussé sur `main`; ce suivi documentaire est ajouté séparément.
- **Vérifications :** `npm run check`, `npm test`, `npm run release:check`, déploiement Render `live`, `/api/health` HTTP 200.

## 2026-07-22 — Fil `19f8a98bdc880158` — clarification reçue

- **Catégorie :** amélioration / fonctionnalité sensible.
- **Résumé :** l'expéditeur confirme que l'admin peut consulter/supprimer la signature technicien, que le technicien modifie sa propre signature, que le bloc PDF est distinct et uniquement présent si le modèle le contient, avec affichage “Technicien non assigné” sans affectation et signature manuelle si aucune signature mémorisée n'existe.
- **Analyse et décision :** la demande reste sensible pour la partie compte utilisateur : modification de mot de passe par admin et modification d'e-mail par technicien. Une confirmation de sécurité est nécessaire pour s'assurer qu'il s'agit d'une réinitialisation sans affichage du mot de passe existant et pour définir la validation lors du changement d'adresse e-mail.
- **Clarification envoyée :** demande ciblée envoyée directement à l'expéditeur original sur la réinitialisation du mot de passe et la confirmation du changement d'e-mail. Fil maintenu sous `Intervium/En attente`.
- **Fichiers modifiés :** ce journal uniquement.
- **Commit / PR :** suivi documentaire ajouté séparément.
- **Vérifications :** aucune vérification applicative dédiée, car aucune modification de code pour cette demande.

## 2026-07-22 — Fil `19f85cc3a3873cd5` — clarification reçue

- **Catégorie :** fonctionnalité / document client PDF.
- **Résumé :** l'expéditeur confirme une première cible PDF uniquement, avec annotation libre, fusion dans le PDF final, conservation comme média d'intervention et import possible par le technicien au moment du rapport. Il souhaite aussi une analyse du PDF pour transformer les carrés vides en champs remplissables.
- **Analyse et décision :** la demande est pertinente mais l'analyse automatique de PDF arbitraires est fragile et risquée comme première version : les documents clients n'ont pas toujours une structure stable permettant une détection fiable des zones à remplir.
- **Clarification envoyée :** proposition d'une première version plus sûre : import PDF, affichage page par page, ajout manuel de textes/coches/annotations, conservation du PDF annoté avec l'intervention et fusion à la fin du rapport. Confirmation demandée avant code. Fil maintenu sous `Intervium/En attente`.
- **Fichiers modifiés :** ce journal uniquement.
- **Commit / PR :** suivi documentaire ajouté séparément.
- **Vérifications :** aucune vérification applicative dédiée, car aucune modification de code pour cette demande.

## 2026-07-22 — Fil `19f85cc92402346f` — suivi

- **Catégorie :** bug de rendu PDF.
- **Résumé :** après le premier correctif, le texte des titres PDF reste imparfaitement aligné avec le fond coloré et le contenu du champ suivant empiète partiellement sur le fond.
- **Analyse et décision :** suivi clair, sûr et réalisable. La pièce jointe PDF est considérée comme non fiable ; le texte du retour suffit à corriger le calcul de boîte du libellé. Le rendu des fonds de titres doit isoler le remplissage, utiliser un padding vertical plus généreux et imposer un espacement fixe avant la valeur du champ suivant.
- **Réponse :** confirmation envoyée directement à l'expéditeur original, avec résumé du correctif et des tests locaux. Fil libellé `Intervium/Traité`.
- **Fichiers modifiés :** `Backend/services/pdf.js`, `Backend/test/pdf-layout.test.js`, ce journal.
- **Commit / PR :** commit `b91af51` poussé sur `main`; aucune PR nécessaire selon le workflow actuel.
- **Vérifications :** `npm run check` réussi ; `npm test` réussi (57 tests passés, 1 intégration PostgreSQL ignorée localement) ; `npm run release:check` réussi ; `npm run build --if-present` terminé ; `git diff --check` sans erreur bloquante ; GitHub Actions CI `29937066518` réussie sur `b91af51`.

## 2026-07-22 — Fil `19f85cc3a3873cd5` — clarification reçue

- **Catégorie :** fonctionnalité / développement futur.
- **Résumé :** l'expéditeur précise vouloir remplir directement dans Intervium des champs existants d'un document client PDF, fusionner le document rempli à la fin du rapport, l'ajouter au cas par cas, avec usage admin ou technicien. L'exemple “OT Eiffage” est un modèle réutilisable mais pouvant évoluer côté client.
- **Analyse et décision :** la demande reste trop structurante pour être implémentée sans cadrage complémentaire. Les points encore ambigus concernent le support Word ou PDF seulement, la détection des champs PDF, le comportement si le PDF client n'a pas de champs remplissables, la conservation/version des modèles client évolutifs et les droits exacts admin/technicien.
- **Clarification envoyée :** demande de précisions envoyée directement à l'expéditeur original ; aucun code modifié pour cette demande tant que ces choix ne sont pas confirmés. Fil maintenu sous `Intervium/En attente`.
- **Fichiers modifiés :** ce journal uniquement.
- **Commit / PR :** suivi documentaire inclus dans le commit de cette exécution.
- **Vérifications :** aucune vérification applicative dédiée, car aucune modification de code pour cette demande.

## 2026-07-22 — Fil `19f8a98bdc880158`

- **Catégorie :** amélioration / fonctionnalité.
- **Résumé :** demande d'ajouter une signature mémorisée et modifiable dans la fiche technicien, un menu de modification technicien accessible aux admins et techniciens, puis un bloc “signature technicien” dans les modèles de rapport reprenant automatiquement le technicien assigné et sa signature mémorisée.
- **Analyse et décision :** demande pertinente mais sensible car elle touche aux signatures personnelles, aux droits de modification des comptes techniciens et à l'insertion automatique dans les PDF. Des précisions sont nécessaires avant tout code : qui peut modifier quelle signature, validation par le technicien, comportement sans technicien assigné ou sans signature, et impact sur les signatures existantes.
- **Clarification envoyée :** demande de précisions envoyée directement à l'expéditeur original ; aucun code modifié pour cette demande. Fil libellé `Intervium/En attente`.
- **Fichiers modifiés :** ce journal uniquement.
- **Commit / PR :** suivi documentaire inclus dans le commit de cette exécution.
- **Vérifications :** aucune vérification applicative dédiée, car aucune modification de code pour cette demande.

## 2026-07-21 — Fil `19f85ecdf2f08160`

- **Catégorie :** bug CI / maintenance.
- **Résumé :** alerte GitHub Actions indiquant l'échec du workflow CI sur `main` pour le commit de correction PDF.
- **Analyse et décision :** demande pertinente et sûre à traiter. Les logs GitHub Actions montrent que l'échec vient du test d'intégration PostgreSQL : l'intervention de test utilisait une date fixe `2026-07-20`, devenue passée au moment de l'exécution du 2026-07-21 ; aucune notification `INTERVENTION_SOON` n'était donc créée, et le test lisait `items[0]` alors que la liste était vide.
- **Réponse :** aucune réponse envoyée à l'adresse automatisée GitHub `noreply`; fil labellisé `Intervium/Traité` après validation.
- **Fichiers modifiés :** `Backend/test/integration-api.test.js`, ce journal.
- **Commit / PR :** correctif `16c3924` créé et poussé sur `main`; aucune PR nécessaire selon le workflow actuel.
- **Vérifications :** `npm run check` réussi ; `npm test` réussi localement (57 tests passés, 1 intégration PostgreSQL ignorée localement) ; `npm run release:check` réussi ; `npm run build --if-present` terminé ; `git diff --check` sans erreur bloquante. GitHub Actions CI `29857292088` réussie sur `16c3924`, avec intégration PostgreSQL active.

## 2026-07-21 — Fil `19f85cc92402346f`

- **Catégorie :** bug de rendu PDF.
- **Résumé :** les fonds colorés configurés pour les titres de champs du PDF ne sont pas centrés verticalement sur le libellé et présentent des épaisseurs irrégulières selon les champs.
- **Analyse et décision :** demande claire, sûre et cohérente avec la personnalisation PDF ajoutée précédemment. La pièce jointe PDF a été considérée comme non fiable ; le texte du signalement suffisait à identifier le problème dans le calcul de hauteur du fond des libellés.
- **Réponse :** confirmation envoyée directement à l'expéditeur original, avec résumé du correctif, commit et tests. Fil libellé `Intervium/Traité`.
- **Fichiers modifiés :** `Backend/services/pdf.js`, `Backend/test/pdf-layout.test.js`, ce journal.
- **Commit / PR :** commit applicatif et documentaire créé sur `main`; aucune PR nécessaire selon le workflow actuel.
- **Vérifications :** `npm run check` réussi ; `npm test` réussi (57 tests passés, 1 intégration PostgreSQL ignorée localement) ; `npm run release:check` réussi ; `npm run build --if-present` terminé ; `git diff --check` sans erreur bloquante.

## 2026-07-21 — Fil `19f85cc3a3873cd5`

- **Catégorie :** fonctionnalité / développement futur.
- **Résumé :** demande d'intégrer au rapport un fichier joint client, par exemple une liste de contrôle PDF, en le rendant modifiable pour le remplir puis le joindre au rapport.
- **Analyse et décision :** demande pertinente mais trop large pour être implémentée sans cadrage : il faut préciser le type de fichiers à supporter, le mode d'édition attendu, le stockage, le lien avec les modèles, le rendu final PDF et les contraintes de sécurité sur les pièces jointes client. Aucun code modifié pour cette demande.
- **Clarification envoyée :** demande de précisions envoyée directement à l'expéditeur original, avec consigne de répondre à cet e-mail. Fil libellé `Intervium/En attente`.
- **Fichiers modifiés :** ce journal uniquement.
- **Commit / PR :** suivi documentaire inclus dans le commit de cette exécution.
- **Vérifications :** aucune vérification applicative dédiée, car aucune modification de code pour cette demande.

Ce journal conserve uniquement les informations techniques nécessaires au suivi. Les coordonnées personnelles, secrets et contenus sans rapport avec Intervium en sont exclus.

## 2026-07-19 — Fil `19f7bb22f3538cae` — clarification reçue

- **Catégorie :** amélioration visuelle PDF.
- **Résumé :** clarification reçue pour les réglages PDF : taille du logo en réglage global entreprise avec bornes minimum/maximum, coordonnées société rendues ligne par ligne, et style global des titres de champs par modèle avec couleur, taille, police, gras, souligné et fond coloré optionnel.
- **Analyse et décision :** demande désormais suffisamment précise, sûre et cohérente avec l'architecture existante. Les réglages entreprise restent dans `report_settings`; les réglages propres aux modèles restent dans `pdf_config`, sans migration de schéma.
- **Réponse :** confirmation envoyée directement à l'expéditeur original, avec résumé des changements, tests et indication de publication prochaine. Fil libellé `Intervium/Traité`.
- **Fichiers modifiés :** `Backend/routes/auth.js`, `Backend/routes/modeles.js`, `Backend/services/pdf.js`, `Backend/test/email-connections.test.js`, `Backend/test/frontend-utils.test.js`, `Backend/test/pdf-layout.test.js`, `Frontend/app.js`, `Frontend/sw.js`, ce journal.
- **Commit / PR :** commit applicatif et documentaire créé sur `main` ; aucune PR nécessaire selon le workflow actuel du dépôt.
- **Vérifications :** `npm run check` réussi ; `npm test` réussi (56 tests passés, 1 intégration PostgreSQL ignorée localement) ; `npm run release:check` réussi ; `git diff --check` sans erreur bloquante.

## 2026-07-19 — Fil `19f7bb25348d4b77`

- **Catégorie :** bug de rendu PDF.
- **Résumé :** deux blocs de signature configurés en demi-largeur dans un modèle de rapport passaient l'un sous l'autre dans le PDF alors qu'ils devaient s'afficher côte à côte.
- **Analyse et décision :** demande claire, sûre et réalisable. Les pièces jointes ont été considérées comme non fiables ; le texte de la demande suffisait à identifier la cause. Les champs de signature étaient traités avant la logique de placement demi-largeur, ce qui empêchait leur association en deux colonnes.
- **Réponse :** confirmation envoyée directement à l'expéditeur original, avec demande de répondre à cet e-mail si le défaut persiste après publication. Fil libellé `Intervium/Traité`.
- **Fichiers modifiés :** `Backend/services/pdf.js`, `Backend/test/pdf-layout.test.js`, ce journal.
- **Commit / PR :** commit applicatif et documentaire créé sur `main` ; aucune PR nécessaire selon le workflow actuel du dépôt.
- **Vérifications :** `npm run check` réussi ; `npm test` réussi (53 tests passés, 1 intégration PostgreSQL ignorée localement) ; `npm run release:check` réussi ; `git diff --check` sans erreur bloquante.

## 2026-07-19 — Fil `19f7bb22f3538cae`

- **Catégorie :** amélioration visuelle PDF.
- **Résumé :** demande de personnalisation de l'en-tête PDF : taille du logo société modifiable, informations société sur plusieurs lignes, et personnalisation avancée des titres de champs de blocs.
- **Analyse et décision :** la demande est pertinente mais incomplète pour la partie personnalisation avancée des titres : les options exactes, les valeurs par défaut, le périmètre global/par modèle/par champ et l'interface attendue ne sont pas définis. Aucun code modifié pour cette demande afin de ne pas figer une UX ou un format de configuration non validé.
- **Clarification envoyée :** demande de précisions envoyée directement à l'expéditeur original : confirmer le périmètre du réglage logo, le rendu exact des informations société, les propriétés de style nécessaires pour les titres, et si le réglage doit être global, par modèle ou par champ.
- **Fichiers modifiés :** ce journal uniquement.
- **Commit / PR :** suivi documentaire inclus dans le commit de cette exécution.
- **Vérifications :** aucune vérification applicative dédiée, car aucune modification de code pour cette demande ; les contrôles de l'exécution sont réussis pour le correctif PDF traité séparément.

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
