# Multi Outils

Boîte à outils du quotidien (React + Vite). **Toutes les données restent dans le navigateur** (`localStorage`).

## Outils

| Outil | Statut |
| --- | --- |
| **Budget** — dépenses, rentrées, catégories, vue mensuelle | Disponible |
| Habitudes | Bientôt |
| Courses | Bientôt |
| Notes rapides | Bientôt |
| Abonnements | Bientôt |

## Dev

```bash
npm install
npm run dev
```

## GitHub Pages

1. Créer un dépôt public (ex. `multi-outils`) et y pousser ce projet.
2. Settings → Pages → Source : **GitHub Actions**.
3. Après le workflow `Deploy GitHub Pages`, le site sera sur  
   `https://<user>.github.io/multi-outils/`

Le `base` Vite est relatif (`./`) pour fonctionner en sous-chemin Pages.
