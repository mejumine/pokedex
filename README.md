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

**LumenDex** est une application de bureau (Electron) qui transforme votre bibliothèque de photos animalières en un véritable Pokédex personnel. Importez vos clichés, associez-les à l'animal correspondant parmi une base de données de **1000+ espèces**, et regardez votre collection prendre vie.

> Conçu pour les photographes naturalistes, les passionnés de faune sauvage, et toute personne qui aime observer et capturer le vivant.

---

## 🚀 Installation rapide (recommandée)

> **Aucun logiciel requis.** Juste Windows 10 ou 11.

1. Téléchargez le fichier **`LumenDex.exe`** depuis la section [Releases](../../releases) du dépôt
2. Double-cliquez dessus
3. C'est tout ✅

Les données (photos, collection, favoris) sont sauvegardées localement sur votre PC — elles persistent entre les sessions.

---

## 🛠️ Installation développeurs (depuis les sources)

### Prérequis

- [Node.js](https://nodejs.org/) v18 ou supérieur
- Windows 10/11

### Lancement

```bash
git clone https://github.com/mejumine/pokedex.git
cd pokedex
npm install
npm start
```

Ou double-cliquer sur **`Lancer Pokedex.bat`** (après `npm install`).

### Générer l'exécutable portable

```bash
npm run dist
```

Génère un `LumenDex.exe` portable dans `dist/`.

---

## 🎮 Fonctionnalités

### 🗂️ Collection & Pokédex
- **1000+ espèces animales** (mammifères, oiseaux, reptiles, amphibiens, insectes…)
- Progression visuelle : animaux non-photographiés en niveaux de gris
- **Animaux personnalisés** : créez vos propres entrées, stockées localement, survivent aux mises à jour
- Tri par rareté, nom, poids, taille, photos — filtres par type
- Mode **Zoo** / **Sauvage**, recherche en temps réel
- Thème couleur personnalisable

### 📷 Import de photos
- Import en lot (testé à 600+ photos simultanées)
- Miniatures générées automatiquement en parallèle
- Lecture EXIF automatique (appareil, ouverture, vitesse, ISO, date)

### 🖼️ Galerie & Visualisation
- Lightbox avec zoom / pan, navigation clavier, infos EXIF
- Favoris ❤️, notation ⭐, tags personnalisés
- Photo de couverture par espèce avec recadrage intégré

### ⚡ Performance
- Cache mémoire : navigation < 5ms après le premier chargement
- Pagination 60 éléments/page

---

## 🔒 Données & Confidentialité

Toutes les données sont **100% locales** — aucun compte, aucun serveur, aucune connexion requise.

Les animaux personnalisés créés dans l'app survivent aux mises à jour de l'application.

---

## 🗃️ Stack technique

| Composant | Technologie |
|-----------|-------------|
| Framework desktop | Electron v40 |
| Base de données locale | Dexie.js (IndexedDB) |
| Métadonnées EXIF | EXIF.js |
| UI | HTML + Tailwind CSS + CSS vanilla |
| Icônes | Phosphor Icons |
| Données animales | `database.js` — 1000+ espèces |

---

<div align="center">


</div>
