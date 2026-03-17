// app.js
console.log("App starting...");

// Global Error Handler for user feedback
window.onerror = function (msg, url, line, col, error) {
    alert(`Erreur technique : ${msg}\nLigne: ${line}`);
    console.error("Global Error:", error);
    return false;
};

// Safe Access globals
const animals = window.PokedexData || [];
if (animals.length === 0) console.warn("Attention: Aucune donnée animal chargée.");

const db = window.PokedexDB;
if (!db) alert("Erreur: Base de données non chargée.");

// --- State Management ---
const state = {
    currentView: 'pokedex',
    filter: 'all',
    currentAnimal: null,
};

// --- Router ---
// Defined immediately on window
window.router = {
    navigate: (view, param = null) => {
        console.log(`Navigating to ${view}`, param);
        state.currentView = view;
        if (param) state.currentAnimal = param;
        render().catch(err => {
            console.error("Render error:", err);
            alert("Erreur lors de l'affichage : " + err.message);
        });
    }
};

// --- UI Helpers ---
const ui = {
    appContent: document.getElementById('app-content'),
    viewTitle: document.getElementById('view-title'),
    categoryBar: document.getElementById('category-bar'),
    modalContainer: document.getElementById('modal-container'),
    modalContent: document.getElementById('modal-content'),

    openModal: () => {
        document.getElementById('modal-container').classList.remove('hidden');
    },
    closeModal: () => {
        document.getElementById('modal-container').classList.add('hidden');
    },

    openImportModal: (animalId = null) => {
        const id = animalId || (state.currentView === 'animal-detail' ? state.currentAnimal : null);
        renderImportModal(id);
        ui.openModal();
    },

    formatDate: (dateString) => {
        if (!dateString) return 'Date inconnue';
        return new Date(dateString).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    }
};
window.ui = ui; // Expose to global

// --- Main Render Loop ---
async function render() {
    // Re-select elements in case DOM changed (unlikely here but safe)
    const contentEl = document.getElementById('app-content');

    // Sidebar Active State styling
    document.querySelectorAll('.nav-item').forEach(el => {
        // Naive reset
        el.classList.remove('bg-white/10', 'text-white', 'border-white/5');
        el.classList.add('text-gray-400');
    });

    // Handle Views
    switch (state.currentView) {
        case 'pokedex':
            document.getElementById('view-title').innerText = 'Pokedex';
            document.getElementById('category-bar').classList.remove('translate-y-20', 'opacity-0');
            await renderPokedex();
            break;
        case 'animal-detail':
            document.getElementById('view-title').innerText = 'Détails';
            document.getElementById('category-bar').classList.add('translate-y-20', 'opacity-0');
            await renderAnimalDetail(state.currentAnimal);
            break;
        case 'gallery':
            document.getElementById('view-title').innerText = 'Toutes les photos';
            document.getElementById('category-bar').classList.add('translate-y-20', 'opacity-0');
            await renderGallery();
            break;
        case 'legendary':
            document.getElementById('view-title').innerText = 'Légendaires';
            document.getElementById('category-bar').classList.add('translate-y-20', 'opacity-0');
            await renderPokedex('Legendary');
            break;
    }

    updateSidebarStats();
}

// --- Views ---

async function renderPokedex(forceRarity = null) {
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24 animate-fade-in';

    let filteredAnimals = animals;
    if (forceRarity) {
        filteredAnimals = animals.filter(a => a.rarity === forceRarity);
    } else if (state.filter !== 'all') {
        filteredAnimals = animals.filter(a => a.type === state.filter);
    }

    // Load unlocks
    const unlockMap = {};
    const coverPhotoMap = {};

    try {
        for (const animal of filteredAnimals) {
            const photos = await db.photos.where('animalId').equals(animal.id).toArray();
            unlockMap[animal.id] = photos.length > 0;
            if (photos.length > 0) {
                photos.sort((a, b) => b.rating - a.rating);
                coverPhotoMap[animal.id] = photos[0].imageSrc;
            }
        }
    } catch (e) {
        console.error("DB Error", e);
    }

    grid.innerHTML = filteredAnimals.map(animal => {
        const isUnlocked = unlockMap[animal.id];
        const coverImage = coverPhotoMap[animal.id];

        const containerClass = isUnlocked
            ? 'bg-gradient-to-br from-gray-800 to-black border-brand-accent/30'
            : 'bg-black/40 border-white/5';

        const imageContent = isUnlocked
            ? `<img src="${coverImage}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />`
            : `<div class="w-full h-full flex items-center justify-center text-gray-700 group-hover:text-gray-600 transition-colors">
                 <i class="${animal.icon} text-9xl"></i>
               </div>`;

        const nameColor = isUnlocked ? 'text-white' : 'text-gray-600';
        const filterStyle = isUnlocked ? '' : 'filter: grayscale(100%) brightness(0.9); opacity: 0.8;';

        // NOTE: Putting onclick directy on div to ensure it catches bubbles
        return `
            <div onclick="window.router.navigate('animal-detail', '${animal.id}')" 
                 class="group relative aspect-[4/5] rounded-3xl overflow-hidden border ${containerClass} hover:border-brand-accent cursor-pointer card-hover shadow-xl select-none">
                
                <div class="absolute inset-0 z-0 bg-gray-900 overflow-hidden" style="${filterStyle}">
                    ${imageContent}
                    <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
                </div>

                <div class="absolute bottom-0 inset-x-0 p-6 z-10 flex flex-col items-start pointer-events-none">
                    <div class="flex items-center gap-2 mb-1">
                         ${isUnlocked ? '<div class="px-2 py-0.5 rounded-full bg-brand-accent text-black text-[10px] font-bold uppercase tracking-wider">Découvert</div>' : ''}
                         <span class="text-xs font-mono text-gray-500 uppercase tracking-widest">#${animal.id.toUpperCase().substring(0, 6)}</span>
                    </div>
                    <h3 class="text-3xl font-['Outfit'] font-bold ${nameColor} leading-none mb-1 group-hover:text-brand-accent transition-colors">${animal.name}</h3>
                    <p class="text-sm text-gray-400 line-clamp-1">${animal.latinName}</p>
                </div>
            </div>
        `;
    }).join('');

    const content = document.getElementById('app-content');
    content.innerHTML = '';
    content.appendChild(grid);
}

async function renderAnimalDetail(animalId) {
    const animal = animals.find(a => a.id === animalId);
    if (!animal) {
        window.router.navigate('pokedex');
        return;
    }

    const photos = await db.photos.where('animalId').equals(animalId).reverse().sortBy('date');
    const isUnlocked = photos.length > 0;

    const html = `
        <div class="max-w-5xl mx-auto space-y-12 animate-fade-in pb-20">
            
            <button onclick="window.router.navigate('pokedex')" class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4">
                <i class="ph ph-arrow-left"></i> Retour
            </button>

            <!-- Hero Section -->
            <div class="flex flex-col md:flex-row gap-8 items-start">
                <div class="w-full md:w-1/2 aspect-square rounded-3xl overflow-hidden border border-white/10 relative bg-black shadow-2xl">
                     ${isUnlocked && photos[0]
            ? `<img src="${photos[0].imageSrc}" class="w-full h-full object-cover">`
            : `<div class="w-full h-full flex items-center justify-center bg-gray-900 border-2 border-dashed border-gray-700 rounded-3xl">
                             <div class="text-center">
                                 <i class="ph ph-camera-slash text-6xl text-gray-700 mb-4"></i>
                                 <p class="text-gray-500">Aucune photo pour le moment.</p>
                             </div>
                           </div>`
        }
                </div>

                <div class="flex-1 space-y-6 pt-4">
                    <div>
                        <div class="flex items-center gap-3 mb-2">
                             ${animal.rarity === 'Legendary' ? '<span class="text-brand-gold flex items-center gap-1 text-sm font-bold uppercase tracking-wider"><i class="ph-fill ph-star"></i> Proie Légendaire</span>' : ''}
                             <span class="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-xs font-semibold uppercase">${animal.type}</span>
                        </div>
                        <h1 class="text-6xl font-['Outfit'] font-bold text-white mb-2">${animal.name}</h1>
                        <p class="text-2xl text-gray-500 italic font-serif">${animal.latinName}</p>
                    </div>

                    <p class="text-gray-300 leading-relaxed text-lg border-l-4 border-brand-accent pl-6 bg-white/5 p-4 rounded-r-xl">
                        ${animal.description}
                    </p>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">Habitat</div>
                            <div class="text-lg font-semibold text-white">${animal.habitat}</div>
                        </div>
                        <div class="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">Régime</div>
                            <div class="text-lg font-semibold text-white">${animal.diet}</div>
                        </div>
                        <div class="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">Poids</div>
                            <div class="text-lg font-semibold text-white">${animal.weight}</div>
                        </div>
                         <div class="bg-white/5 p-4 rounded-xl border border-white/5">
                            <div class="text-xs text-gray-500 uppercase tracking-wider mb-1">Taille</div>
                            <div class="text-lg font-semibold text-white">${animal.size}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Gallery Section -->
            <div>
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-3xl font-bold font-['Outfit']">Mes Clichés</h2>
                    <button onclick="window.ui.openImportModal('${animal.id}')" class="bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-brand-accent transition-colors flex items-center gap-2">
                        <i class="ph-bold ph-plus"></i> Ajouter une photo
                    </button>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    ${photos.map(photo => `
                        <div class="group relative aspect-square rounded-2xl overflow-hidden cursor-pointer border border-white/5 bg-gray-900">
                            <img src="${photo.imageSrc}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                            <div class="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                <div class="flex gap-1 text-yellow-400 text-xs mb-1">
                                    ${Array(5).fill(0).map((_, i) => `<i class="ph-fill ${i < photo.rating ? 'ph-star' : 'ph-star text-gray-600'}"></i>`).join('')}
                                </div>
                                <div class="text-[10px] text-gray-400">${momentFromNow(photo.date)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    document.getElementById('app-content').innerHTML = html;
}

function momentFromNow(date) {
    if (!date) return '';
    try {
        const d = new Date(date);
        return d.toLocaleDateString();
    } catch (e) { return date; }
}

async function renderGallery() {
    const photos = await db.photos.reverse().sortBy('date');

    // Sort logic could trigger re-renders, but for now simple grid
    const html = `
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20 animate-fade-in">
            ${photos.map(photo => {
        // Find associated animal for name
        const animal = animals.find(a => a.id === photo.animalId);
        return `
                <div class="group relative aspect-square rounded-2xl overflow-hidden cursor-pointer bg-gray-900 border border-white/5" onclick="window.router.navigate('animal-detail', '${photo.animalId}')">
                    <img src="${photo.imageSrc}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                        <p class="font-bold text-white text-lg">${animal ? animal.name : 'Inconnu'}</p>
                         <div class="flex gap-1 text-yellow-400 text-sm">
                             ${Array(5).fill(0).map((_, i) => `<i class="ph-fill ${i < photo.rating ? 'ph-star' : 'ph-star text-gray-600'}"></i>`).join('')}
                         </div>
                    </div>
                </div>
                `;
    }).join('')}
        </div>
    `;
    document.getElementById('app-content').innerHTML = html;
}

// --- Import Modal Logic ---
function renderImportModal(preselectedAnimalId) {
    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
        <div class="p-8">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-3xl font-bold font-['Outfit']">Ajouter une observation</h2>
                <button onclick="window.ui.closeModal()" class="text-gray-500 hover:text-white"><i class="ph ph-x text-2xl"></i></button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <!-- Drop Zone -->
                <div id="drop-zone" class="border-3 border-dashed border-white/20 rounded-2xl aspect-square flex flex-col items-center justify-center text-gray-500 hover:border-brand-accent hover:text-brand-accent hover:bg-brand-accent/5 transition-all cursor-pointer relative overflow-hidden">
                    <input type="file" id="file-input" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">
                    <i class="ph ph-upload-simple text-5xl mb-4"></i>
                    <p class="font-medium">Glissez une photo ici</p>
                    <p class="text-sm mt-2">ou cliquez pour parcourir</p>
                    <img id="preview-image" class="absolute inset-0 w-full h-full object-contain bg-black hidden">
                </div>

                <!-- Form -->
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs uppercase text-gray-500 font-semibold mb-1">Animal</label>
                        <select id="input-animal" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-accent">
                            <option value="">Sélectionner...</option>
                            ${animals.map(a => `<option value="${a.id}" ${a.id === preselectedAnimalId ? 'selected' : ''}>${a.name}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div>
                         <label class="block text-xs uppercase text-gray-500 font-semibold mb-1">Note</label>
                         <div class="flex gap-2 text-2xl text-gray-600" id="rating-input">
                            ${[1, 2, 3, 4, 5].map(i => `<button type="button" data-val="${i}" class="hover:text-brand-gold focus:outline-none"><i class="ph-fill ph-star"></i></button>`).join('')}
                         </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs uppercase text-gray-500 font-semibold mb-1">Mode</label>
                            <select id="input-mode" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-accent">
                                <option value="wild" class="bg-gray-800">Sauvage</option>
                                <option value="zoo" class="bg-gray-800">Zoo</option>
                            </select>
                        </div>
                         <div>
                            <label class="block text-xs uppercase text-gray-500 font-semibold mb-1">Date</label>
                            <input type="date" id="input-date" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-accent">
                        </div>
                    </div>

                    <div class="bg-black/40 p-3 rounded-xl border border-white/5 text-xs font-mono text-gray-400">
                        <div id="exif-data">EXIF: En attente de photo...</div>
                    </div>

                    <button id="btn-save" class="w-full bg-white text-black font-bold py-4 rounded-xl mt-4 hover:bg-brand-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        Enregistrer l'observation
                    </button>
                </div>
            </div>
        </div>
    `;

    // Bind Events
    const fileInput = document.getElementById('file-input');
    const preview = document.getElementById('preview-image');
    const exifDisplay = document.getElementById('exif-data');
    let currentDataUrl = null;
    let currentRating = 0;

    // Rating Logic
    document.getElementById('rating-input').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn) {
            currentRating = parseInt(btn.dataset.val);
            const buttons = document.getElementById('rating-input').querySelectorAll('button');
            buttons.forEach((b, idx) => {
                b.className = idx < currentRating ? 'text-brand-gold' : 'text-gray-600';
            });
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            currentDataUrl = ev.target.result;
            preview.src = currentDataUrl;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);

        // EXIF Reading with checks
        if (window.EXIF) {
            window.EXIF.getData(file, function () {
                const make = window.EXIF.getTag(this, "Make");
                const model = window.EXIF.getTag(this, "Model");
                const date = window.EXIF.getTag(this, "DateTimeOriginal");

                let exifText = `${make || ''} ${model || ''}`;
                if (date) {
                    const [dPart] = date.split(' ');
                    const isoDate = dPart.replace(/:/g, '-');
                    document.getElementById('input-date').value = isoDate;
                    exifText += ` • ${isoDate}`;
                } else {
                    document.getElementById('input-date').valueAsDate = new Date();
                }

                if (!exifText.trim()) exifText = "Aucune donnée EXIF trouvée.";
                exifDisplay.innerText = exifText;
            });
        }
    });

    document.getElementById('btn-save').addEventListener('click', async () => {
        const animalId = document.getElementById('input-animal').value;
        const mode = document.getElementById('input-mode').value;
        const dateInput = document.getElementById('input-date').value;

        if (!animalId || !currentDataUrl) {
            alert("Veuillez choisir un animal et une photo.");
            return;
        }

        try {
            await db.photos.add({
                animalId,
                imageSrc: currentDataUrl,
                rating: currentRating,
                mode: mode,
                date: dateInput || new Date().toISOString(),
                timestamp: Date.now()
            });
            window.ui.closeModal();
            window.router.navigate('animal-detail', animalId);
        } catch (e) {
            alert("Erreur de sauvegarde: " + e.message);
        }
    });
}

// --- Updates ---
async function updateSidebarStats() {
    try {
        const totalAnimals = animals.length;
        const allPhotos = await db.photos.toArray();
        const discoveredIds = new Set(allPhotos.map(p => p.animalId));
        const discoveredCount = discoveredIds.size;

        document.getElementById('sidebar-stats-count').innerText = `${discoveredCount} / ${totalAnimals}`;

        const percent = (discoveredCount / totalAnimals) * 100;
        document.getElementById('sidebar-stats-bar').style.width = `${percent}%`;
    } catch (e) { console.warn("Stats read error", e); }
}


// --- Init ---
document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.category-btn').forEach(b => {
            b.classList.remove('active', 'bg-white/10', 'text-white');
            b.classList.add('text-gray-400');
        });
        e.target.classList.add('active', 'bg-white/10', 'text-white');
        e.target.classList.remove('text-gray-400');

        state.filter = e.target.dataset.filter;
        renderPokedex();
    });
});

console.log("Initialization complete. Rendering...");
render().then(() => console.log("Initial Render Done"));
