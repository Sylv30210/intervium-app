# Préparation du renommage Intervium vers Noverys

Le renommage doit être progressif. Tant que le logo Noverys définitif n’est pas validé, Intervium reste la marque active.

## Compatibilité silencieuse

- Centraliser le nom visible, les titres et les chemins d’assets dans une configuration de marque.
- Lire `noverys_visual_theme`, puis reprendre `intervium_visual_theme` si la nouvelle clé est absente ; écrire temporairement les deux clés.
- Conserver le cookie de session existant pendant au moins une durée maximale de session afin de ne pas déconnecter les utilisateurs.
- Garder les routes, identifiants PostgreSQL, anciennes données et snapshots PDF inchangés.
- Ne jamais réécrire les anciens PDF : leur identité historique fait partie du document généré.

## Assets et PWA

- Ajouter les assets validés sous `Frontend/icons/noverys-*` : symbole SVG, 192, 512, maskable 512 et Apple Touch Icon.
- Mettre à jour manifest, HTML, favicon et cache du service worker dans un même déploiement.
- Continuer à servir les anciens chemins d’icônes pendant plusieurs versions pour les PWA installées.

## Bascule applicative

- Basculer connexion, sidebar, titres, documentation et métadonnées après validation finale.
- Renommer package npm et service Render seulement après validation du domaine et des redirections.
- Conserver les anciens liens via redirection permanente.
- La mention PDF devient Noverys uniquement pour les nouveaux documents et lorsque l’entreprise l’active.

## Cookies et rollback

Si un nouveau cookie est souhaité, le middleware lira le nouveau puis l’ancien ; le login émettra temporairement les deux et le logout les supprimera tous les deux. Aucune colonne métier ne doit être renommée. Le rollback doit consister à restaurer configuration et assets, sans migration destructive.

## Assets manquants

Le fichier source du logo Noverys n’était pas joint à cette demande. Les variantes bitmap et maskable ne doivent pas être extrapolées sans cette source, afin d’éviter une identité incorrecte ou déformée.

