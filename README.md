# Multi Outils

Boîte à outils du quotidien (React + Vite). **Données locales** + liaisons entre outils + sauvegarde auto.

Site : https://enzo-jouet.github.io/multi-outils/

## Outils

| Outil | Statut |
| --- | --- |
| **Budget** — planifié/confirmé, récurrents, comptes, virements, plafonds | Disponible |
| **Dettes** — remboursements liés au Budget | Disponible |
| **Objectifs d’épargne** — virements Courant ↔ Épargne dans Budget | Disponible |
| Habitudes, Courses, Notes, Abonnements | Bientôt |

## Cohérence

Sur l’accueil → **Données & cohérence** :

- Épargne ↔ Budget (virements)
- Dettes ↔ Budget (opérations)
- Comptes utilisés pour chaque liaison

## Sauvegarde

1. Miroir **IndexedDB** à chaque changement
2. **Fichier local** (Chrome / Edge) : « Lier un fichier » puis écriture auto + intervalle
3. Téléchargement / restauration manuelle JSON

## Dev

```bash
npm install
npm run dev
```
