<div align="center">

# 🦎 LumenDex

**Application de collection photographique animalière — style Pokédex**

*Photographiez, classez et explorez votre encyclopédie personnelle du vivant*

![Electron](https://img.shields.io/badge/Electron-40.x-47848F?logo=electron&logoColor=white)
![License](https://img.shields.io/badge/Licence-ISC-green)
![Platform](https://img.shields.io/badge/Plateforme-Windows-blue?logo=windows)
![Status](https://img.shields.io/badge/Statut-Actif-brightgreen)
![IndexedDB](https://img.shields.io/badge/Stockage-IndexedDB%20%2F%20Dexie.js-orange)

</div>

---

## ✨ Présentation

**LumenDex** est une application de bureau (Electron) qui transforme votre bibliothèque de photos animalières en un véritable Pokédex personnel. Importez vos clichés, associez-les à l'animal correspondant parmi une base de données de **200+ espèces**, et regardez votre collection prendre vie.

> Conçu pour les photographes naturalistes, les passionnés de faune sauvage, et toute personne qui aime observer et capturer le vivant.

---

## 🚀 Fonctionnalités

### 🗂️ Collection & Pokédex
- **200+ espèces animales** dans la base de données (mammifères, oiseaux, reptiles, insectes…)
- Progression visuelle : les animaux non-photographiés apparaissent en niveaux de gris
- Tri par rareté, nom, poids, taille, nombre de photos
- Filtrage par type d'animal (mammifère, oiseau, reptile, insecte…)
- Mode **Zoo** / **Sauvage** pour séparer vos contextes de prise de vue
- Recherche en temps réel

### 📷 Import de photos
- **Import en lot** (testé à 600 photos simultanées)
- Génération automatique de miniatures en parallèle (×8) avec barre de progression
- Interface **mode lot** pour les grandes sélections (>20 photos) : un formulaire pour tout configurer en une fois
- Lecture des données **EXIF** automatique (appareil, ouverture, vitesse, ISO, date)
- Pré-remplissage intelligent de l'animal selon le contexte

### 🖼️ Galerie & Visualisation
- Vue galerie avec tri par date, note, animal
- Lightbox avec **zoom / pan**, navigation clavier, infos EXIF
- Favoris ❤️, notation ⭐ 1-5 étoiles, tags personnalisés
- Photo de couverture personnalisable par espèce (recadrage intégré)

### ⚡ Performance (optimisée pour les grandes collections)
- **Écran de chargement** au démarrage : pré-chauffe de tous les caches IndexedDB
- **Cache mémoire global** : après le démarrage, tous les onglets sont instantanés
- `imageSrc` (pleine résolution) jamais chargé en masse — uniquement à la demande
- Pagination 60 éléments/page sur le Pokédex et les pages détail
- Navigation entre onglets : ~200ms → **<5ms** après le premier chargement

### 🎨 Interface
- Thème sombre premium avec couleur d'accent personnalisable
- Glassmorphism, animations fluides, effets de glow
- Badges de progression par type d'animal
- Page détail par espèce : statistiques, habitat, conseils photo

---

## 🛠️ Installation

### Prérequis
- [Node.js](https://nodejs.org/) (v18+)
- Windows 10/11

### Lancement en développement

```bash
# Cloner le dépôt
git clone https://github.com/mejumine/pokedex.git
cd pokedex

# Installer les dépendances
npm install

# Lancer l'application
npm start
```

Ou simplement double-cliquer sur **`Lancer Pokedex.bat`** à la racine du projet.

### Build portable (optionnel)

```bash
npm run dist
```

Génère un `.exe` portable dans le dossier `dist/`.

---

## 🗃️ Stack technique

| Composant | Technologie |
|-----------|-------------|
| Framework desktop | [Electron](https://www.electronjs.org/) v40 |
| Base de données locale | [Dexie.js](https://dexie.org/) (wrapper IndexedDB) |
| Métadonnées EXIF | [EXIF.js](https://github.com/exif-js/exif-js) |
| UI / Styles | HTML + CSS vanilla |
| Icônes | [Phosphor Icons](https://phosphoricons.com/) |
| Données animales | `database.js` — 200+ espèces avec stats, descriptions, conseils |

---

## 📁 Structure du projet

```
pokedex/
├── main.js            # Point d'entrée Electron (fenêtre, IPC)
├── index.html         # Structure UI principale
├── app.js             # Logique applicative (router, render, cache, lightbox…)
├── app.css            # Styles personnalisés (thème sombre, glassmorphism)
├── database.js        # Base de données statique des animaux
├── js/                # Librairies externes (Dexie, EXIF.js…)
├── Lancer Pokedex.bat # Raccourci de lancement Windows
└── package.json
```

---

## 🗺️ Roadmap

- [ ] Export de la collection en PDF ou HTML statique
- [ ] Synchronisation cloud (optionnelle)
- [ ] Support macOS / Linux
- [ ] Mode statistiques avancées (carte de répartition, graphes par saison)

---

## 🤝 Contribution

Ce projet est personnel et expérimental. N'hésitez pas à forker et adapter à vos besoins !

Les issues et pull requests sont les bienvenus pour toute amélioration ou correction de bug.

---

<div align="center">

Fait avec ❤️ pour les passionnés de nature et de photographie

</div>
