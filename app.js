const fs = require('fs');
const path = require('path');
const { shell } = require('electron');

window.addEventListener('error', function(e) {
    try { fs.appendFileSync('error_log.txt', new Date().toISOString() + ' ' + (e.error ? e.error.stack : e.message) + '\n'); } catch(ex) {}
});
window.addEventListener('unhandledrejection', function(e) {
    try { fs.appendFileSync('error_log.txt', new Date().toISOString() + ' ' + (e.reason ? (e.reason.stack || e.reason) : e.reason) + '\n'); } catch(ex) {}
});


const db = new Dexie('LumenDex_System');
// Version 1: initial
// Version 2: added filePath and isCover
// Version 3: added customAnimals table
db.version(2).stores({
    obs: '++id,animalId,date,rating,isFav,*tags,desc,thumbnailSrc,exif,originalName,filePath,isCover'
});
db.version(3).stores({
    obs: '++id,animalId,date,rating,isFav,*tags,desc,thumbnailSrc,exif,originalName,filePath,isCover',
    customAnimals: '++id,name,type'
});



const normalizeValue = (str, unitFactors) => {
    if (!str) return 0;
    const normalized = str.replace(/,/g, '.').toLowerCase();
    let bestValue = -1;

    // Sort units by length descending to match "mètres" before "m"
    const units = Object.keys(unitFactors).sort((a, b) => b.length - a.length);

    for (const unit of units) {
        const boundaryPrefix = unit.length === 1 ? '(?:^|[^a-z])' : '';
        const boundarySuffix = '(?:$|[^a-z])';
        // Handle numbers with spaces (thousands separators) like "1 000"
        const regex = new RegExp(`([\\d.\\s]+(?:\\s*-\\s*[\\d.\\s]+)?)\\s*${boundaryPrefix}${unit}${boundarySuffix}`, 'i');

        const match = normalized.match(regex);
        if (match) {
            const numberStr = match[1];
            // Strip non-numeric chars except . and - before averaging
            const normalizedNums = numberStr.replace(/[^0-9.-]/g, '');
            const nums = normalizedNums.match(/[\d.]+/g);
            if (nums) {
                const avg = nums.reduce((sum, v) => sum + parseFloat(v), 0) / nums.length;
                const val = avg * unitFactors[unit];
                if (val > bestValue) bestValue = val;
            }
        }
    }

    if (bestValue >= 0) return bestValue;

    // Fallback: all numbers averaged, detection by inclusion
    const matches = normalized.match(/[\d.]+/g);
    if (!matches) return 0;
    const avgVal = matches.reduce((sum, v) => sum + parseFloat(v), 0) / matches.length;
    for (const unit of units) {
        if (normalized.includes(unit)) return avgVal * unitFactors[unit];
    }
    return avgVal;
};

const parseWeight = (w) => normalizeValue(w, { 't': 1000000, 'tonnes': 1000000, 'tonne': 1000000, 'kg': 1000, 'mg': 0.001, 'g': 1 });
const parseSize = (s) => normalizeValue(s, { 'mètres': 100, 'mètre': 100, 'm': 100, 'cm': 1, 'mm': 0.1 });

const EXTRA_TAGS = ['Couché de soleil', 'Jour', 'Nuit', 'Vol', 'Tête de con', 'Graille', 'Groupe', 'Bébé', 'Forêt', 'Eau', 'Ombre', 'Ailes ouvertes', 'Silhouette'];

const getExifData = (f) => new Promise(resolve => {
    EXIF.getData(f, function () {
        const d = EXIF.getTag(this, "DateTimeOriginal");
        const model = EXIF.getTag(this, "Model") || '';
        const fnum = EXIF.getTag(this, "FNumber") ? 'f/' + EXIF.getTag(this, "FNumber") : '';
        const iso = EXIF.getTag(this, "ISOSpeedRatings") ? EXIF.getTag(this, "ISOSpeedRatings") : '';
        const rawExp = EXIF.getTag(this, "ExposureTime");
        const exp = rawExp ? (rawExp < 1 ? '1/' + Math.round(1 / rawExp) : rawExp) : '';
        const focal = EXIF.getTag(this, "FocalLength") ? EXIF.getTag(this, "FocalLength") + 'mm' : '';

        resolve({
            date: d ? d.split(' ')[0].replace(/:/g, '-') : new Date().toISOString().split('T')[0],
            model: model,
            settings: [fnum, exp ? exp + 's' : '', iso ? 'ISO ' + iso : '', focal].filter(x => x).join(' • '),
            raw: { f: fnum, s: exp, iso: iso }
        });


    });


});



const createThumbnail = (src) => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600; // Increased to 600px for better clarity on high-DPI screens
        const scaleSize = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = img.width * scaleSize;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85)); // 85% quality for a professional look without being too heavy
    };
    img.src = src;
});

window.batch = {
    addFiles: async (files) => {
        const total = files.length;
        const stagingArea = document.getElementById('staging-area');
        const countEl = document.getElementById('import-count');

        // Barre de progression
        stagingArea.innerHTML = `
                        <div class="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                            <i class="ph-duotone ph-images text-5xl text-brand-accent animate-pulse"></i>
                            <div class="text-sm font-bold">Génération des miniatures…</div>
                            <div class="w-64 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                <div id="import-progress-bar" class="h-full bg-brand-accent transition-all duration-300" style="width:0%"></div>
                            </div>
                            <div id="import-progress-label" class="text-xs text-gray-500">0 / ${total}</div>
                        </div>`;

        const progressBar = document.getElementById('import-progress-bar');
        const progressLabel = document.getElementById('import-progress-label');
        let done = 0;

        // Pré-remplissage : priorité à _importerPreset (animal custom venant d'être créé)
        const defaultAnimal = (() => {
            if (window._importerPreset) {
                const name = window._importerPreset;
                window._importerPreset = null; // consommé une seule fois
                return name;
            }
            if (app.view === 'detail' && app.currentId) {
                const a = DB.find(x => x.id === app.currentId);
                if (a) return a.name;
            }
            return '';
        })();

        // Traitement en parallèle par paquets de 8 (optimal CPU/mémoire)
        const CHUNK = 8;
        const fileArr = Array.from(files);
        for (let i = 0; i < fileArr.length; i += CHUNK) {
            const chunk = fileArr.slice(i, i + CHUNK);
            await Promise.all(chunk.map(async (f) => {
                const objectUrl = URL.createObjectURL(f);
                const thumb = await createThumbnail(objectUrl);
                URL.revokeObjectURL(objectUrl);
                const exifData = await getExifData(f);
                window.staging.push({
                    file: f, thumb, exif: exifData,
                    originalName: f.name, filePath: f.path,
                    meta: {
                        animalName: defaultAnimal, env: '', rating: 3, desc: '', isFav: false,
                        date: exifData.date, tags: [], f: exifData.raw.f, s: exifData.raw.s, iso: exifData.raw.iso
                    }
                });
                done++;
                const pct = Math.round(done / total * 100);
                if (progressBar) progressBar.style.width = pct + '%';
                if (progressLabel) progressLabel.textContent = `${done} / ${total}`;
                if (countEl) countEl.innerText = `${done} / ${total} photos`;
            }));
        }
        window.batch.render();
    },

    toggleTag: (i, t) => { const x = window.staging[i].meta.tags; if (x.includes(t)) window.staging[i].meta.tags = x.filter(y => y !== t); else x.push(t); batch.render(); },
    toggleFav: (i) => { window.staging[i].meta.isFav = !window.staging[i].meta.isFav; batch.render(); },
    setEnv: (i, e) => { window.staging[i].meta.env = e; batch.render(); },

    render: () => {
        const a = document.getElementById('staging-area');
        if (!window.staging.length) return a.innerHTML = '<div class="text-center text-gray-500 mt-10">Vide</div>';
        document.getElementById('import-count').innerText = `${window.staging.length} photos`;

        // Au-delà de 20 photos → vue compacte (liste légère, pas de previews base64 partout)
        const COMPACT_THRESHOLD = 20;
        if (window.staging.length > COMPACT_THRESHOLD) {
            const allSameAnimal = window.staging.every(s => s.meta.animalName === window.staging[0].meta.animalName);
            const allSameEnv = window.staging.every(s => s.meta.env === window.staging[0].meta.env);
            a.innerHTML = `
                            <div class="p-6 space-y-5">
                                <div class="flex items-center gap-3 bg-white/5 border border-brand-accent/30 rounded-xl p-4">
                                    <i class="ph-fill ph-package text-brand-accent text-2xl shrink-0"></i>
                                    <div>
                                        <div class="font-bold text-white">${window.staging.length} photos sélectionnées</div>
                                        <div class="text-xs text-gray-400">Mode lot activé — modifiez les réglages globaux ci-dessous, puis cliquez sur Enregistrer.</div>
                                    </div>
                                </div>

                                <div class="space-y-2">
                                    <label class="text-[10px] uppercase font-bold text-gray-500">Animal (tous)</label>
                                    <input list="all-animals-list" value="${window.staging[0].meta.animalName}" 
                                        oninput="window.staging.forEach(s=>s.meta.animalName=this.value)" 
                                        placeholder="Nom de l'animal" 
                                        class="w-full bg-[#333] border border-white/10 rounded p-2 text-sm font-bold">
                                </div>

                                <div class="space-y-2">
                                    <label class="text-[10px] uppercase font-bold text-gray-500">Environnement (tous)</label>
                                    <div class="flex gap-2">
                                        <button onclick="batch.setAllEnv('Zoo')" 
                                            class="flex-1 py-2 rounded text-xs border font-bold transition-all ${window.staging[0].meta.env === 'Zoo' ? 'bg-brand-accent text-black' : 'border-white/20 hover:bg-white/5'}">ZOO</button>
                                        <button onclick="batch.setAllEnv('Sauvage')" 
                                            class="flex-1 py-2 rounded text-xs border font-bold transition-all ${window.staging[0].meta.env === 'Sauvage' ? 'bg-brand-accent text-black' : 'border-white/20 hover:bg-white/5'}">SAUVAGE</button>
                                    </div>
                                </div>

                                <div class="space-y-2">
                                    <label class="text-[10px] uppercase font-bold text-gray-500">Note (toutes)</label>
                                    <div class="rating-group gap-2 text-2xl justify-center">
                                        ${[5, 4, 3, 2, 1].map(s => `<i onclick="window.staging.forEach(st=>st.meta.rating=${s}); batch.render()" 
                                            class="ph-fill ph-star cursor-pointer ${s <= window.staging[0].meta.rating ? 'text-brand-gold' : 'text-gray-700'}"></i>`).join('')}
                                    </div>
                                </div>

                                <div class="border-t border-white/5 pt-4">
                                    <div class="text-[10px] text-gray-500 mb-2 uppercase font-bold">Aperçu (5 premières)</div>
                                    <div class="flex gap-2">
                                        ${window.staging.slice(0, 5).map(s => `<img src="${s.thumb}" class="w-16 h-16 object-cover rounded border border-white/10">`).join('')}
                                        ${window.staging.length > 5 ? `<div class="w-16 h-16 rounded border border-white/10 bg-white/5 flex items-center justify-center text-xs text-gray-400 font-bold">+${window.staging.length - 5}</div>` : ''}
                                    </div>
                                </div>
                            </div>`;
            return;
        }

        // Vue détaillée normale (≤ 20 photos)
        a.innerHTML = window.staging.map((item, idx) => `
                        <div class="flex gap-6 bg-[#222] p-4 rounded-xl border border-white/5 relative group">
                            <button onclick="batch.removeItem(${idx})" class="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/20 text-red-500 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-red-500 hover:text-white"><i class="ph-bold ph-trash"></i></button>
                            <div class="w-40 shrink-0"><img src="${item.thumb}" class="w-40 h-40 object-cover rounded bg-black"><div class="rating-group gap-1 mt-2">${[5, 4, 3, 2, 1].map(s => `<i onclick="batch.rate(${idx},${s})" class="ph-fill ph-star ${s <= item.meta.rating ? 'text-brand-gold' : 'text-gray-700'} cursor-pointer transition-all transform active:scale-90"></i>`).join('')}</div><div class="text-[10px] text-gray-500 text-center mt-1 break-words">${item.originalName}</div></div>
                            <div class="flex-1 space-y-3">
                                <div class="flex gap-2"><input list="all-animals-list" value="${item.meta.animalName}" onchange="window.staging[${idx}].meta.animalName=this.value" placeholder="Que voyez-vous ?" class="flex-1 bg-[#333] border border-white/10 rounded p-2 text-sm bg-transparent font-bold"><input type="date" value="${item.meta.date}" onchange="window.staging[${idx}].meta.date=this.value" class="bg-[#333] border border-white/10 rounded p-2 text-xs w-32"></div>
                                <div class="flex gap-2 bg-black/20 p-2 rounded items-center"><span class="text-[10px] text-gray-500 font-bold uppercase w-12 shrink-0">Stats :</span><input type="text" placeholder="f/2.8" value="${item.meta.f}" onchange="window.staging[${idx}].meta.f=this.value" class="w-16 bg-[#333] border border-white/10 rounded px-2 py-1 text-xs text-brand-accent font-mono text-center"><input type="text" placeholder="1/500" value="${item.meta.s}" onchange="window.staging[${idx}].meta.s=this.value" class="w-16 bg-[#333] border border-white/10 rounded px-2 py-1 text-xs text-brand-accent font-mono text-center"><span class="text-xs text-gray-500">s</span><input type="text" placeholder="ISO" value="${item.meta.iso}" onchange="window.staging[${idx}].meta.iso=this.value" class="w-16 bg-[#333] border border-white/10 rounded px-2 py-1 text-xs text-brand-accent font-mono text-center"></div>
                                <div class="flex gap-2"><button onclick="batch.setEnv(${idx},'Zoo')" class="flex-1 py-1.5 rounded text-xs border ${item.meta.env === 'Zoo' ? 'bg-brand-accent text-black font-bold' : 'border-white/20 hover:bg-white/5'}">ZOO</button><button onclick="batch.setEnv(${idx},'Sauvage')" class="flex-1 py-1.5 rounded text-xs border ${item.meta.env === 'Sauvage' ? 'bg-brand-accent text-black font-bold' : 'border-white/20 hover:bg-white/5'}">SAUVAGE</button></div>
                                <div class="flex flex-wrap gap-1.5">${EXTRA_TAGS.map(t => `<button onclick="batch.toggleTag(${idx}, '${t}')" class="px-2 py-0.5 rounded-full text-[10px] border ${item.meta.tags.includes(t) ? 'bg-white text-black font-bold' : 'border-white/10 text-gray-500 hover:border-white/30'}">${t}</button>`).join('')}</div>
                                <div class="flex gap-2"><textarea rows="1" placeholder="Note..." onchange="window.staging[${idx}].meta.desc = this.value" class="flex-1 bg-[#333] border border-white/10 rounded p-2 text-xs text-white bg-transparent">${item.meta.desc}</textarea><button onclick="batch.toggleFav(${idx})" class="px-3 rounded border border-white/10 ${item.meta.isFav ? 'text-red-500 border-red-500/50' : 'text-gray-600 hover:text-red-500'} transition-all transform hover:scale-125 active:scale-90"><i class="ph-fill ph-heart text-xl"></i></button></div>
                            </div></div>
                        `).join('');
    },

    removeItem: (i) => { window.staging.splice(i, 1); batch.render(); },
    setAllEnv: (e) => { window.staging.forEach(s => s.meta.env = e); batch.render(); },
    rate: (i, r) => { window.staging[i].meta.rating = r; batch.render(); },

    commit: async () => {
        try {
            // Validation rapide avant de lire les fichiers
            for (let s of window.staging) {
                if (!s.meta.env) { alert('Veuillez préciser Zoo ou Sauvage pour chaque photo.'); return; }
                const a = DB.find(x => x.name.trim() === s.meta.animalName.trim());
                if (!a) { alert(`Animal non trouvé : "${s.meta.animalName}"`); return; }
            }

            // Barre de progression pour le commit
            const stagingArea = document.getElementById('staging-area');
            const total = window.staging.length;
            stagingArea.innerHTML = `
                            <div class="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                                <i class="ph-duotone ph-hard-drives text-5xl text-brand-accent animate-pulse"></i>
                                <div class="text-sm font-bold">Enregistrement en cours…</div>
                                <div class="w-64 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                    <div id="commit-progress-bar" class="h-full bg-brand-accent transition-all duration-200" style="width:0%"></div>
                                </div>
                                <div id="commit-progress-label" class="text-xs text-gray-500">0 / ${total}</div>
                            </div>`;

            const cBar = document.getElementById('commit-progress-bar');
            const cLabel = document.getElementById('commit-progress-label');
            let done = 0;
            const docs = [];

            // Lecture des fichiers en parallèle par paquets de 10
            const CHUNK = 10;
            for (let i = 0; i < window.staging.length; i += CHUNK) {
                const chunk = window.staging.slice(i, i + CHUNK);
                const results = await Promise.all(chunk.map(s => new Promise(resolve => {
                    const rd = new FileReader();
                    rd.onload = e => resolve(e.target.result);
                    rd.readAsDataURL(s.file);
                })));
                chunk.forEach((s, j) => {
                    const a = DB.find(x => x.name.trim() === s.meta.animalName.trim());
                    docs.push({
                        animalId: a.id, imageSrc: results[j], thumbnailSrc: s.thumb,
                        exif: { ...s.exif, settings: [s.meta.f, s.meta.s ? s.meta.s + 's' : '', s.meta.iso ? 'ISO ' + s.meta.iso : ''].filter(x => x).join(' • ') },
                        originalName: s.originalName, filePath: s.filePath,
                        rating: s.meta.rating, tags: [s.meta.env, ...s.meta.tags],
                        desc: s.meta.desc, isFav: s.meta.isFav, date: s.meta.date, isCover: false
                    });
                    done++;
                    if (cBar) cBar.style.width = Math.round(done / total * 100) + '%';
                    if (cLabel) cLabel.textContent = `${done} / ${total}`;
                });
            }

            if (docs.length === 0) { alert('Aucune photo à enregistrer.'); return; }
            await db.obs.bulkAdd(docs);
            window._bumpCache();
            ui.closeImporter();
            router.go(app.view, app.currentId);
        } catch (err) {
            console.error(err);
            alert("Erreur lors de l'enregistrement : " + err.message);
        }
    }
};


const app = { view: 'index', lastView: 'index', filter: 'all', sort: 'date', pokedexSort: 'rarity', sortDir: 'desc', detailSort: 'date', searchQuery: '', currentId: null, mode: 'normal', onlyUnlocked: false, overrides: JSON.parse(localStorage.getItem('pokedex-overrides') || '{}') };

// ============================================================
// CACHE MÉMOIRE — évite de re-interroger IndexedDB à chaque
// changement d'onglet. Le compteur v est incrémenté après
// chaque écriture en base, ce qui invalide toutes les entrées.
// ============================================================
window._dbCache = {
    v: 0,
    disc: { v: -1, mode: null, data: null },  // discoveredIds (Set)
    cov: { v: -1, data: null },              // covers (Map)
    pcnt: { v: -1, data: null },              // photoCounts (Map)
    tcnt: { v: -1, data: null },              // totalObsCount
    lobs: { v: -1, mode: null, data: null },  // obs SANS imageSrc (léger)
};
// Appeler après tout write en base (add/update/delete/clear)
window._bumpCache = () => {
    window._dbCache.v++;
    if (window._detailCache) window._detailCache.v = -1; // invalide le cache détail
};



const toFileUrl = (p) => {
    if (!p) return null;
    return 'file:///' + p.replace(/\\/g, '/').replace(/ /g, '%20');
};

window.router = {
    history: [],
    future: [],
    go: (view, param = null, push = true) => {
        // Prevent duplicate history entries or empty views
        const isLiteralChange = app.view !== view || (param && app.currentId !== param);
        if (push && isLiteralChange) {
            // Save scroll position when leaving index
            const contentEl = document.getElementById('content');
            const savedScroll = (app.view === 'index' && contentEl) ? contentEl.scrollTop : 0;
            window.router.history.push({ view: app.view, param: app.currentId, scroll: savedScroll });
            window.router.future = [];
        }
        app.lastView = app.view;
        app.view = view;
        if (param) app.currentId = param;

        // Update styling on sidebar
        document.querySelectorAll('.nav-btn').forEach(el => {
            el.classList.remove('text-white');
            el.classList.add('text-gray-400');
        });
        const activeViewId = view === 'detail' ? (app.lastView === 'detail' ? 'index' : app.lastView) : view;
        const activeBtn = document.getElementById('nav-' + activeViewId);
        if (activeBtn) {
            activeBtn.classList.remove('text-gray-400');
            activeBtn.classList.add('text-white');
        }

        if (typeof render === 'function') {
            render().catch(err => console.error("Render error:", err));
        }
    },
    back: () => {
        const lb = document.getElementById('lightbox');
        if (lb && !lb.classList.contains('hidden')) { window.lb.close(); return; }

        if (window.router.history.length > 0) {
            // Cap future at 10 to save memory
            if (window.router.future.length >= 10) window.router.future.shift();
            window.router.future.push({ view: app.view, param: app.currentId });
            const h = window.router.history.pop();
            window.router.go(h.view, h.param, false);
            // Restore scroll position after render settles
            if (h.scroll && h.view === 'index') {
                const contentEl = document.getElementById('content');
                if (contentEl) {
                    // Wait for render to populate DOM, then restore
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => { contentEl.scrollTop = h.scroll; });
                    });
                }
            }
        } else if (app.view !== 'index') {
            window.router.go('index', null, false);
        }
    },
    forward: () => {
        if (window.router.future.length > 0) {
            const f = window.router.future.pop();
            // This time we push the current view BACK to history so the flow continues
            window.router.history.push({ view: app.view, param: app.currentId });
            window.router.go(f.view, f.param, false);
        }
    }
};

// V28: Mouse History Navigation (Back/Forward)
window.addEventListener('mouseup', (e) => {
    if (e.button === 3) { // Back
        window.router.back();
    } else if (e.button === 4) { // Forward
        window.router.forward();
    }
});

window.handleCardClick = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    window.router.go('detail', id);
};

window.staging = [];
document.getElementById('batch-input').onchange = e => batch.addFiles(Array.from(e.target.files));

window.ui = {
    openImporter: () => { window.staging = []; document.getElementById('staging-area').innerHTML = ''; document.getElementById('batch-input').value = ''; document.getElementById('importer').classList.remove('hidden'); document.getElementById('filters').style.display = 'none'; },
    closeImporter: () => { document.getElementById('importer').classList.add('hidden'); document.getElementById('filters').style.display = 'flex'; },

    handleImgError: (el) => {
        el.onerror = null;

        // Try to find the animal card this image belongs to
        const card = el.closest('[data-animal-id]');
        const animalId = card ? card.getAttribute('data-animal-id') : null;

        // If it's a reference image on a Pokedex card (not a user observation photo),
        // auto-fetch a real image from iNaturalist
        if (animalId && typeof dev !== 'undefined' && dev.shuffleImage) {
            // Show a subtle loading shimmer
            el.style.opacity = '0.3';
            el.style.filter = 'grayscale(1)';
            // Rate-limit: don't refetch if already pending
            if (!window._imgFetchPending) window._imgFetchPending = new Set();
            if (!window._imgFetchPending.has(animalId)) {
                window._imgFetchPending.add(animalId);
                dev.shuffleImage(animalId, true).then(() => {
                    window._imgFetchPending.delete(animalId);
                    el.style.opacity = '';
                    el.style.filter = '';
                }).catch(() => {
                    window._imgFetchPending.delete(animalId);
                    showPlaceholder();
                });
                return; // Don't show placeholder yet — wait for fetch
            }
        }

        showPlaceholder();

        function showPlaceholder() {
            const placeholder = document.createElement('div');
            placeholder.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:#111;';
            placeholder.innerHTML = `
                <i class="ph ph-image-broken" style="font-size:28px;color:rgba(255,255,255,0.15)"></i>
                <span style="font-size:9px;color:rgba(255,255,255,0.2);font-weight:600;text-transform:uppercase;letter-spacing:1px;">Aucune photo</span>
            `;
            if (el.parentNode) {
                el.parentNode.style.position = 'relative';
                el.parentNode.appendChild(placeholder);
                el.style.display = 'none';
            }
        }
    },

    showMenu: async (e, id, animalId) => {
        e.preventDefault();

        window.selectedObsId = id;
        window.selectedAnimalId = animalId;

        const menu = document.getElementById('context-menu');
        const starContainer = document.getElementById('context-rating-stars');

        // Toggle visibility based on what was clicked
        const elSetCover = document.getElementById('menu-set-cover');
        if (elSetCover) elSetCover.style.display = id ? 'block' : 'none';

        const elOpenFolder = document.getElementById('menu-open-folder');
        if (elOpenFolder) elOpenFolder.style.display = id ? 'block' : 'none';

        const elGroupRating = document.getElementById('group-rating');
        if (elGroupRating) elGroupRating.style.display = id ? 'block' : 'none';

        const elDelete = document.getElementById('menu-delete');
        if (elDelete) elDelete.style.display = id ? 'block' : 'none';

        // Show "Restore" if we have an animalId or if it's an observation (to reset that animal)
        const restoreBtn = document.getElementById('menu-restore-default');
        if (restoreBtn) {
            restoreBtn.style.display = (id || animalId) ? 'block' : 'none';
            restoreBtn.innerHTML = '<i class="ph-bold ph-arrow-counter-clockwise"></i> Restaurer l\'image par défaut';
        }

        if (id) {
            const obs = await db.obs.get(id);
            if (obs) {
                starContainer.className = 'rating-group text-2xl gap-2 mt-2';
                starContainer.innerHTML = [5, 4, 3, 2, 1].map(s => `
                            <i onclick="window.ui.setRating(${s})" class="ph-fill ph-star cursor-pointer transition-all transform active:scale-90 ${s <= obs.rating ? 'text-brand-gold' : 'text-white/10'}"></i>
                        `).join('');
                window.selectedAnimalId = obs.animalId;
            }
        }

        menu.style.display = 'block';
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';

        const hideHandler = () => {
            menu.style.display = 'none';
            document.removeEventListener('click', hideHandler);
        };
        setTimeout(() => document.addEventListener('click', hideHandler), 10);
    },

    shuffleImage: async (animalId, partialUpdate = false) => {
        const a = DB.find(x => x.id === animalId);
        if (!a) return;

        const card = document.querySelector(`[data-animal-id="${animalId}"]`);
        const img = card ? card.querySelector('img') : null;
        if (img) {
            img.classList.add('animate-pulse');
            img.style.filter = 'brightness(0.5)';
        }

        try {
            // Mapping app types to iNaturalist iconic_taxa
            const iconicMap = {
                'mammal': 'Mammalia',
                'bird': 'Aves',
                'reptile': 'Reptilia',
                'amphibian': 'Amphibia',
                'fish': 'Actinopterygii',
                'insect': 'Insecta,Arachnida,Mollusca',
                'aquatic': 'Mammalia,Actinopterygii,Mollusca,Animalia'
            };
            const iconicTaxa = iconicMap[a.type] || 'Animalia';

            // 1. Search for the Taxon. Priority to scientificName.
            // Locale=fr ensures common names are matched correctly if sciName is missing.
            const query = a.scientificName || a.name;
            const searchUrl = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(query)}&iconic_taxa=${encodeURIComponent(iconicTaxa)}&locale=fr&per_page=10`;

            const searchResp = await fetch(searchUrl);
            const searchJson = await searchResp.json();

            let bestTaxon = null;
            if (searchJson.results && searchJson.results.length > 0) {
                // Priority 1: Exact Scientific Name match
                bestTaxon = searchJson.results.find(r => r.name.toLowerCase() === query.toLowerCase());

                // Priority 2: Exact Common Name match (in locale fr)
                if (!bestTaxon) {
                    bestTaxon = searchJson.results.find(r =>
                        r.preferred_common_name && r.preferred_common_name.toLowerCase() === query.toLowerCase()
                    );
                }

                // Priority 3: First result that matches the iconic taxon filter (Strict validation)
                if (!bestTaxon) {
                    const filterTerms = iconicTaxa.split(',');
                    bestTaxon = searchJson.results.find(r => filterTerms.includes(r.iconic_taxon_name));
                }
            }

            if (bestTaxon) {
                // 2. Fetch specific photos for this taxon
                const infoResp = await fetch(`https://api.inaturalist.org/v1/taxa/${bestTaxon.id}`);
                const infoJson = await infoResp.json();

                if (infoJson.results && infoJson.results[0].taxon_photos && infoJson.results[0].taxon_photos.length > 0) {
                    const photos = infoJson.results[0].taxon_photos;
                    // Pick random photo from the first few for variety but high relevance
                    const sampleSize = Math.min(5, photos.length);
                    const randPhoto = photos[Math.floor(Math.random() * sampleSize)].photo;
                    const newUrl = randPhoto.url.replace('square', 'large');

                    // Update local state and persistence
                    a.imgRef = newUrl;
                    app.overrides[animalId] = newUrl;
                    localStorage.setItem('pokedex-overrides', JSON.stringify(app.overrides));

                    if (partialUpdate && img) img.src = newUrl;

                    const commitBtn = document.getElementById('dev-commit-btn');
                    if (commitBtn) commitBtn.classList.remove('hidden');
                }
            } else {
                console.warn(`Aucun match valide trouvé pour "${query}" [Type: ${iconicTaxa}]`);
            }
        } catch (err) {
            console.error("iNaturalist Shuffle failed:", err);
        }
        if (img) {
            img.classList.remove('animate-pulse');
            img.style.filter = '';
        }
    },

    commitToDatabase: async () => {
        const overrideCount = Object.keys(app.overrides).length;
        if (overrideCount === 0) {
            alert("Aucune modification à enregistrer.");
            return;
        }

        if (!confirm(`Souhaitez-vous enregistrer définitivement ${overrideCount} nouvelles images dans database.js ?`)) {
            return;
        }

        try {
            // Use path relative to this file
            const dbPath = path.resolve(__dirname, 'database.js');
            if (!fs.existsSync(dbPath)) {
                alert("Erreur : database.js introuvable.");
                return;
            }

            let content = fs.readFileSync(dbPath, 'utf8');

            // Robust persistence logic:
            // Instead of a single messy regex, we iterate and use a dedicated regex for each ID
            // that strictly matches the "imgRef": "..." portion within that ID's object block.
            for (const [id, newUrl] of Object.entries(app.overrides)) {
                // 1. Find the block for this ID
                // We look for "id": "OUR_ID" and then find the NEXT "imgRef": "..."
                // This regex handles variability in whitespace and quotes
                const entryRegex = new RegExp(`(["']id["']\\s*:\\s*["']${id}["'][\\s\\S]*?["']imgRef["']\\s*:\\s*["'])([^"']*)(["'])`, 'g');

                if (entryRegex.test(content)) {
                    content = content.replace(entryRegex, `$1${newUrl}$3`);
                } else {
                    console.error(`Impossible de trouver l'entrée pour ${id} dans database.js`);
                }
            }

            fs.writeFileSync(dbPath, content, 'utf8');

            // Success Cleanup
            app.overrides = {};
            localStorage.removeItem('pokedex-overrides');
            document.getElementById('dev-commit-btn').classList.add('hidden');

            alert("✅ Changements enregistrés ! L'application va redémarrer.");
            location.reload();

        } catch (err) {
            console.error("Commit failed:", err);
            alert("Échec de l'écriture : " + err.message);
        }
    },

    restoreDefaultImage: async () => {
        const animalId = window.selectedAnimalId;
        if (!animalId) return;

        try {
            // 1. Clear Dexie cover (Observations)
            await db.obs.where('animalId').equals(animalId).modify({ isCover: false });
            window._bumpCache();

            // 2. Clear Shuffle override (LocalStorage)
            if (app.overrides[animalId]) {
                delete app.overrides[animalId];
                localStorage.setItem('pokedex-overrides', JSON.stringify(app.overrides));
            }

            render();
        } catch (err) {
            console.error("Restore failed:", err);
        }
    },

    setAsCover: async () => {
        const id = window.selectedObsId;
        const obs = await db.obs.get(id);
        if (!obs) return;

        const modal = document.getElementById('cropper-modal');
        const img = document.getElementById('cropper-img');
        img.src = obs.imageSrc;
        modal.classList.remove('hidden');

        if (window.cropperInstance) window.cropperInstance.destroy();
        window.cropperInstance = new Cropper(img, {
            aspectRatio: 3 / 4,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 1,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
        });


    },

    closeCropper: () => {
        document.getElementById('cropper-modal').classList.add('hidden');
        if (window.cropperInstance) window.cropperInstance.destroy();
    },

    saveCrop: async () => {
        if (!window.cropperInstance) return;
        const loader = document.getElementById('cropper-loader');
        if (loader) loader.classList.remove('hidden');

        // Delay slightly to let the UI show the loader before heavy heavy processing
        await new Promise(r => setTimeout(r, 100));

        try {
            const canvas = window.cropperInstance.getCroppedCanvas({
                width: 600,
                height: 800
            });

            const thumb = canvas.toDataURL('image/jpeg', 0.85); // Light quality reduction for size
            const id = window.selectedObsId;
            const obs = await db.obs.get(id);
            if (!obs) {
                if (loader) loader.classList.add('hidden');
                return;
            }

            // Unset all covers for this animal
            await db.obs.where('animalId').equals(obs.animalId).modify({ isCover: false });
            // Set this one as cover + updated thumbnail
            await db.obs.update(id, { thumbnailSrc: thumb, isCover: true });
            window._bumpCache();

            ui.closeCropper();
            if (loader) loader.classList.add('hidden');
            render();
        } catch (err) {
            if (loader) loader.classList.add('hidden');
            console.error("Crop save failed:", err);
            alert("Erreur lors de l'enregistrement : " + err.message);
        }
    },

    openSourceFolder: async () => {
        const id = window.selectedObsId;
        const obs = await db.obs.get(id);
        if (!obs || !obs.filePath) { alert("Chemin du fichier non trouvé."); return; }
        if (!fs.existsSync(obs.filePath)) {
            alert("Erreur : L'image est introuvable sur votre disque car elle a été déplacée ou supprimée.");
            return;
        }
        shell.showItemInFolder(obs.filePath);
    },

    setRating: async (rating) => {
        const id = window.selectedObsId;
        if (!id) return;
        try {
            await db.obs.update(id, { rating: rating });
            window._bumpCache();
            document.getElementById('context-menu').style.display = 'none';
            render();
        } catch (err) {
            console.error("Rating update failed:", err);
        }
    },

    updateTheme: (color) => {
        if (!color) return;
        document.documentElement.style.setProperty('--brand-accent', color);
        // Create a glow color (transparent version of the theme color)
        const glowColor = color + '4d'; // adding 30% alpha (4d in hex)
        document.documentElement.style.setProperty('--brand-accent-glow', glowColor);

        localStorage.setItem('pokedex-theme', color);
        const picker = document.getElementById('theme-picker');
        if (picker) picker.value = color;

        // Update text color of Photo Utility and Icon
        const logoIcon = document.getElementById('logo-icon');
        const logoSub = document.getElementById('logo-sub');
        if (logoIcon) logoIcon.style.color = color;
        if (logoSub) logoSub.style.color = color;

        // Force a sync of active pills
        ui.syncPill('nav-pill', document.querySelector('.nav-btn.active')?.id);
        ui.syncPill('mode-pill', document.querySelector('[onclick*="setMode"].active')?.id, 'active-accent-text');
    },

    exportData: async () => {
        try {
            const obs = await db.obs.toArray();
            const data = JSON.stringify(obs, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pokedex_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Export failed:", err);
            alert("Erreur lors de l'exportation.");
        }
    },

    importData: async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (!Array.isArray(data)) throw new Error("Format invalide");
                    if (confirm(`Importer ${data.length} observations ? Cela écrasera les données existantes en cas de conflit d'ID.`)) {
                        await db.obs.bulkPut(data);
                        window._bumpCache();
                        alert("Importation terminée !");
                        location.reload();
                    }
                } catch (err) {
                    alert("Erreur lors de l'importation : " + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    },

    resetData: async () => {
        if (confirm("⚠️ VOULEZ-VOUS VRAIMENT TOUT EFFACER ?\nCette action supprimera toutes vos photos et votre progression définitivement.")) {
            await db.obs.clear();
            window._bumpCache();
            location.reload();
        }
    },

    deleteObservation: async () => {
        const id = window.selectedObsId;
        if (!id) return;
        if (confirm("Supprimer cette observation ?")) {
            try {
                await db.obs.delete(id);
                window._bumpCache();
                render();
            } catch (err) {
                console.error("Delete failed:", err);
                alert("Erreur lors de la suppression.");
            }
        }
    }
};

window.setFilter = (f) => { app.filter = f; render(); };
window.setMode = (m) => {
    app.mode = m;
    const modeLabel = m === 'normal' ? 'TOUT' : (m === 'zoo' ? 'ZOO' : 'SAUVAGE');
    const el = document.getElementById('stats-mode-label');
    if (el) el.innerText = modeLabel;
    ui.syncPill('mode-pill', `btn-mode-${m}`, 'active-accent-text');
    render();
};

window.sort = (s) => { app.sort = s; render(); };
window.sortDex = (s) => { app.pokedexSort = s; render(); };
window.sortDetail = (s) => { app.detailSort = s; render(); };

window.ui.syncPill = (pillId, activeId, activeClass = 'active-pill-text') => {
    const pill = document.getElementById(pillId);
    const active = document.getElementById(activeId);
    if (!pill || !active) return;

    const w = active.offsetWidth;
    const h = active.offsetHeight;
    if (w === 0 || h === 0) return; // Prevent collapse if container is hidden

    // Match dimensions and position
    pill.style.width = w + 'px';
    pill.style.height = h + 'px';
    pill.style.left = active.offsetLeft + 'px';
    pill.style.top = active.offsetTop + 'px';

    // Sync rounding
    pill.style.borderRadius = window.getComputedStyle(active).borderRadius;

    // Update text colors for the group
    const container = active.parentElement;
    container.querySelectorAll('button').forEach(btn => {
        if (btn === active) {
            if (activeClass) btn.classList.add(activeClass);
        } else {
            if (activeClass) btn.classList.remove(activeClass);
        }
    });


};

window.toggleSortDir = () => {
    app.sortDir = app.sortDir === 'asc' ? 'desc' : 'asc';
    document.querySelectorAll('.btn-sort-dir-icon').forEach(icon => {
        // Asc = Up (180deg), Desc = Down (0deg)
        icon.style.transform = app.sortDir === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)';
        // Small animation pop
        icon.parentElement.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(1.2)' },
            { transform: 'scale(1)' }
        ], { duration: 200, easing: 'ease-out' });
    });


    render();
};

let _searchTimeout = null;
window.setSearch = (q) => {
    if (_searchTimeout) clearTimeout(_searchTimeout);
    // Show/hide clear button
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) clearBtn.classList.toggle('hidden', !q);
    _searchTimeout = setTimeout(() => {
        app.searchQuery = q.toLowerCase().trim();
        render();
    }, 300);
};

window.clearSearch = () => {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    if (input) { input.value = ''; input.focus(); }
    if (clearBtn) clearBtn.classList.add('hidden');
    app.searchQuery = '';
    render();
};


window.playAudio = (id) => { alert("Audio non disponible pour le moment (Pas de fichier MP3)."); };

window.loadMore = () => {
    const scrollEl = document.getElementById('content') || document.scrollingElement;
    const savedScroll = scrollEl ? scrollEl.scrollTop : 0;
    window._pageState.page++;
    render().then(() => requestAnimationFrame(() => { if (scrollEl) scrollEl.scrollTop = savedScroll; }));
};

window.loadMoreDetail = () => {
    const scrollEl = document.getElementById('content') || document.scrollingElement;
    const savedScroll = scrollEl ? scrollEl.scrollTop : 0;
    if (!window._detailPageState) window._detailPageState = { key: '', page: 1 };
    window._detailPageState.page++;
    render().then(() => requestAnimationFrame(() => { if (scrollEl) scrollEl.scrollTop = savedScroll; }));
};

function renderNav() {
    const activeId = app.view === 'index' ? 'nav-pokedex' : (app.view === 'gallery' ? 'nav-gallery' : (app.view === 'favs' ? 'nav-fav' : (app.view === 'badges' ? 'nav-badges' : null)));
    if (activeId) {
        ui.syncPill('nav-pill', activeId, 'active-nav');
    } else {
        document.getElementById('nav-pill').style.width = '0';
    }
}

document.addEventListener('keydown', (e) => { if (!document.getElementById('lightbox').classList.contains('hidden')) { if (e.key === 'ArrowLeft') window.lb.prev(); if (e.key === 'ArrowRight') window.lb.next(); if (e.key === 'Escape') window.lb.close(); } });

window.lb = {
    open: (i, l) => {
        window.pl = l;
        window.li = i;
        document.getElementById('lightbox').classList.remove('hidden');
        window.lb.resetZoom();
        window.lb.render();
    },
    close: () => { document.getElementById('lightbox').classList.add('hidden'); window.lb.resetZoom(); },
    resetZoom: () => {
        const img = document.getElementById('lb-img');
        img.style.transform = 'translate(0px, 0px) scale(1)';
        img.style.cursor = 'zoom-in';
        img.classList.remove('zoomed');
        window.lb.pan = { x: 0, y: 0, isDragging: false, startX: 0, startY: 0, moved: false };
    },
    pan: { x: 0, y: 0, isDragging: false, startX: 0, startY: 0, moved: false },
    download: async () => {
        const p = window.pl[window.li];
        const link = document.createElement('a');
        link.download = p.originalName || `LumenDex_${p.id}.jpg`;
        if (p.imageSrc) {
            // Cas rare : imageSrc encore présent en mémoire
            link.href = p.imageSrc;
            link.click();
        } else {
            // Chargement à la demande depuis IDB (seul ce 1 enregistrement)
            const full = await db.obs.get(p.id);
            if (full && full.imageSrc) { link.href = full.imageSrc; link.click(); }
            else if (p.filePath) shell.showItemInFolder(p.filePath);
        }
    },
    openFolder: () => {
        const p = window.pl[window.li];
        if (!p || !p.filePath) { alert("Chemin du fichier non trouvé."); return; }
        shell.showItemInFolder(p.filePath);
    },
    toggleZoom: (e) => {
        if (window.lb.pan.moved) {
            window.lb.pan.moved = false;
            return;
        }
        const img = document.getElementById('lb-img');
        const isZoomed = img.classList.contains('zoomed');
        if (isZoomed) {
            window.lb.resetZoom();
        } else {
            const rect = img.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width * 100;
            const y = (e.clientY - rect.top) / rect.height * 100;
            img.style.transformOrigin = `${x}% ${y}%`;
            img.style.transform = 'translate(0px, 0px) scale(2.5)';
            img.style.cursor = 'grab';
            img.classList.add('zoomed');
        }
    },
    startPan: (e) => {
        const img = document.getElementById('lb-img');
        if (!img.classList.contains('zoomed')) return;
        window.lb.pan.isDragging = true;
        window.lb.pan.moved = false; // RESET ON EVERY MOUSE DOWN
        window.lb.pan.startX = e.clientX - window.lb.pan.x;
        window.lb.pan.startY = e.clientY - window.lb.pan.y;
        img.style.cursor = 'grabbing';
        img.style.transition = 'none';
    },
    doPan: (e) => {
        if (!window.lb.pan.isDragging) return;
        window.lb.pan.moved = true;
        const img = document.getElementById('lb-img');
        window.lb.pan.x = e.clientX - window.lb.pan.startX;
        window.lb.pan.y = e.clientY - window.lb.pan.startY;
        img.style.transform = `translate(${window.lb.pan.x}px, ${window.lb.pan.y}px) scale(2.5)`;
    },
    stopPan: () => {
        if (!window.lb.pan.isDragging) return;
        window.lb.pan.isDragging = false;
        const img = document.getElementById('lb-img');
        img.style.cursor = 'grab';
        img.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    },
    // V28: INTERACTIVE RATING
    setRating: async (r, event) => {
        if (event) {
            event.target.classList.add('star-pop');
            setTimeout(() => event.target.classList.remove('star-pop'), 300);
        }
        const p = window.pl[window.li];
        if (!p) return;
        const oldId = p.id;

        try {
            await db.obs.update(p.id, { rating: r });
            window._bumpCache();
            p.rating = r;
            await render(); // Re-sorts and updates window.currentPhotos

            // Re-sync index to the same photo
            if (window.currentPhotos) {
                const newIndex = window.currentPhotos.findIndex(x => x.id === oldId);
                if (newIndex !== -1) {
                    window.li = newIndex;
                    window.pl = window.currentPhotos;
                }
            }
            window.lb.render(); // Update stars instantly
        } catch (err) {
            console.error("LB Rating update failed:", err);
        }
    },
    render: () => {
        const p = window.pl[window.li]; const a = DB.find(x => x.id === p.animalId) || { name: '?', tips: '' };

        // Priorité 1 : chemin fichier (rapide, pas de base64)
        // Priorité 2 : imageSrc si encore en mémoire (cas rare)
        // Priorité 3 : chargement à la demande depuis IDB
        const lbImg = document.getElementById('lb-img');
        if (p.filePath && fs.existsSync(p.filePath)) {
            lbImg.src = toFileUrl(p.filePath);
        } else if (p.imageSrc) {
            lbImg.src = p.imageSrc;
        } else {
            lbImg.src = '';
            db.obs.get(p.id).then(full => { if (full) lbImg.src = full.imageSrc || ''; });
        }

        // V28: Navigation Feature - Clickable Title
        const titleEl = document.getElementById('lb-title');
        titleEl.innerHTML = `${a.name} <i class="ph-bold ph-arrow-right text-lg opacity-50 ml-1"></i>`;
        titleEl.onclick = () => {
            window.lb.close();
            router.go('detail', p.animalId);
        };
        titleEl.classList.add('cursor-pointer', 'hover:text-brand-accent', 'transition-colors');

        document.getElementById('lb-desc').innerText = p.desc || '';
        document.getElementById('lb-tags').innerHTML = (p.tags || []).map(t => `<span class="bg-gray-700 px-2 py-1 rounded text-[10px]">${t}</span>`).join('');

        // CLICKABLE STARS
        document.getElementById('lb-stars').innerHTML = [5, 4, 3, 2, 1].map(s => `
                        <i onclick="window.lb.setRating(${s}, event)" class="ph-fill ${s <= p.rating ? 'ph-star text-brand-gold' : 'ph-star text-white/20'} transition-all cursor-pointer transform"></i>
                        `).join('');

        // V28: Tips removed from Lightbox (Moved to Detail Page)
        const existingTips = document.getElementById('lb-tips');
        if (existingTips) existingTips.remove();

        document.getElementById('lb-counter').innerText = `${window.li + 1} / ${window.pl.length}`;
        const btn = document.getElementById('lb-fav-btn'); btn.className = p.isFav ? 'text-2xl text-red-500 transition-all' : 'text-2xl text-gray-500 hover:text-red-500 transition-all';
        const e = p.exif || { model: 'Inconnu', settings: '' };
        document.getElementById('lb-exif').innerHTML = `<span><i class="ph-bold ph-camera"></i> ${e.model || 'Inconnu'}</span> <span class="text-white/30">|</span> <span>${e.settings || 'Pas de données optiques'}</span> <span class="text-white/30">|</span> <span>${p.originalName || 'Inconnu'}</span>`;
    },
    toggleFav: async () => {
        const p = window.pl[window.li];
        if (!p) return;
        const newFav = !p.isFav;
        try {
            await db.obs.update(p.id, { isFav: newFav });
            window._bumpCache();
            p.isFav = newFav;
            window.lb.render();
            if (app.view === 'favs') render();
        } catch (err) {
            console.error("LB Fav toggle failed:", err);
        }
    },
    next: () => { if (window.li < window.pl.length - 1) { window.li++; window.lb.render(); window.lb.resetZoom(); } }, prev: () => { if (window.li > 0) { window.li--; window.lb.render(); window.lb.resetZoom(); } },
};

// Initialize Lightbox Pan Listeners
document.addEventListener('mousemove', (e) => window.lb.doPan(e));
document.addEventListener('mouseup', () => window.lb.stopPan());
const lbImg = document.getElementById('lb-img');
if (lbImg) {
    lbImg.addEventListener('mousedown', (e) => {
        if (e.button === 0) window.lb.startPan(e);
    });
}

window.toggleGridFav = async (e, id) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const p = await db.obs.get(id);
    if (p) {
        const newFav = !p.isFav;

        // Persistence
        await db.obs.update(id, { isFav: newFav });
        window._bumpCache();

        if (app.view !== 'favs') {
            p.isFav = newFav;
            if (newFav) {
                btn.classList.remove('text-white/30', 'hover:text-white');
                btn.classList.add('text-red-500', 'opacity-100');
            } else {
                btn.classList.add('text-white/30', 'hover:text-white');
                btn.classList.remove('text-red-500', 'opacity-100');
            }
        } else {
            render();
        }
    }
};

async function render() {
    // Quick UI feedback
    ui.syncPill('mode-pill', 'btn-mode-' + app.mode, 'active-pill-text');
    if (typeof renderNav === 'function') renderNav();

    // ── REQUÊTES IDB AVEC CACHE ────────────────────────────────────────────
    // La première visite interroge IDB. Les visites suivantes
    // (changement d'onglet, tri, filtre…) utilisent le cache mémoire.
    // _bumpCache() est appelé après chaque écriture pour invalider.
    const C = window._dbCache;

    // 1. discoveredIds
    let discoveredIds;
    if (C.disc.v === C.v && C.disc.mode === app.mode) {
        discoveredIds = C.disc.data;
    } else {
        try {
            if (app.mode === 'normal') {
                const keys = await db.obs.orderBy('animalId').uniqueKeys();
                discoveredIds = new Set(keys);
            } else {
                const modeTag = app.mode === 'zoo' ? 'Zoo' : 'Sauvage';
                const matchObs = await db.obs.where('tags').equals(modeTag).toArray();
                discoveredIds = new Set(matchObs.map(o => o.animalId));
            }
        } catch (err) {
            console.warn('Discovery fetch failed — full scan fallback', err);
            const allObs = await db.obs.toArray();
            discoveredIds = new Set(allObs.map(o => o.animalId));
        }
        C.disc = { v: C.v, mode: app.mode, data: discoveredIds };
    }

    // 2. covers (isCover = true) — filtre JS car Dexie ne gère pas les booléens en index
    let covers;
    if (C.cov.v === C.v) {
        covers = C.cov.data;
    } else {
        const coversArr = await db.obs.filter(o => o.isCover === true).toArray();
        covers = new Map(coversArr.map(o => [o.animalId, o]));
        C.cov = { v: C.v, data: covers };
    }

    // 3. photoCounts
    let photoCounts;
    if (C.pcnt.v === C.v) {
        photoCounts = C.pcnt.data;
    } else {
        photoCounts = new Map();
        await db.obs.orderBy('animalId').eachKey(id => {
            photoCounts.set(id, (photoCounts.get(id) || 0) + 1);
        });
        C.pcnt = { v: C.v, data: photoCounts };
    }

    // 4. totalObsCount
    let totalObsCount;
    if (C.tcnt.v === C.v) {
        totalObsCount = C.tcnt.data;
    } else {
        totalObsCount = await db.obs.count();
        C.tcnt = { v: C.v, data: totalObsCount };
    }

    const sourceDB = (typeof window.DB !== 'undefined') ? window.DB : (typeof DB !== 'undefined' ? DB : []);

    if (sourceDB.length === 0) {
        console.warn('WARN: sourceDB is empty!');
    }

    let totalList = app.filter === 'all' ? sourceDB : sourceDB.filter(x => x.type === app.filter);

    // RESTORED: UI Pill Syncing
    requestAnimationFrame(() => {
        if (document.getElementById('filter-pill')) ui.syncPill('filter-pill', 'f-btn-' + app.filter, 'active-pill-text');
        if (document.getElementById('dex-sort-pill')) ui.syncPill('dex-sort-pill', 'btn-dex-' + app.pokedexSort, 'active-pill-text');
        if (document.getElementById('gal-sort-pill')) ui.syncPill('gal-sort-pill', 'btn-sort-' + app.sort, 'active-accent-text');
    });

    // RESTORED: Unlocked Toggle State
    const tgl = document.getElementById('toggle-unlocked');
    if (tgl) {
        tgl.className = `w-8 h-4 rounded-full relative transition-colors duration-200 ${app.onlyUnlocked ? 'bg-brand-accent' : 'bg-gray-600'}`;
        tgl.children[0].className = `absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${app.onlyUnlocked ? 'translate-x-4' : 'translate-x-0'}`;
    }

    const countDiscovered = totalList.filter(x => discoveredIds.has(x.id)).length;

    const statsTxt = document.getElementById('stats-txt');
    if (statsTxt) statsTxt.innerText = `${countDiscovered} / ${totalList.length}`;
    const statsBar = document.getElementById('stats-bar');
    if (statsBar) statsBar.style.width = `${(countDiscovered / totalList.length) * 100}%`;
    const statsModeLabel = document.getElementById('stats-mode-label');
    if (statsModeLabel) statsModeLabel.innerText = app.mode === 'normal' ? 'TOUT' : (app.mode === 'zoo' ? 'ZOO' : 'SAUVAGE');

    const u = discoveredIds;
    const c = document.getElementById('content');
    document.getElementById('filters').style.display = app.view === 'index' ? 'flex' : 'none';
    document.getElementById('pokedex-sort').style.display = app.view === 'index' ? 'flex' : 'none';
    document.getElementById('sort-controls').style.display = (app.view === 'gallery') ? 'flex' : 'none';
    document.getElementById('filters').style.display = app.view === 'index' ? 'flex' : 'none';
    document.getElementById('pokedex-sort').style.display = app.view === 'index' ? 'flex' : 'none';
    document.getElementById('sort-controls').style.display = (app.view === 'gallery') ? 'flex' : 'none';
    document.getElementById('global-sort-dir-wrapper').style.display = (app.view !== 'detail' && app.view !== 'badges') ? 'block' : 'none';

    // Fragmented Rendering Helper with cancellation
    if (!window._renderToken) window._renderToken = 0;
    const currentRenderToken = ++window._renderToken;

    const renderInChunks = (container, htmlChunks, chunkSize = 100, onComplete = null) => {
        let index = 0;
        const nextChunk = () => {
            if (currentRenderToken !== window._renderToken) return; // Cancelled
            const fragment = document.createRange().createContextualFragment(htmlChunks.slice(index, index + chunkSize).join(''));
            container.appendChild(fragment);
            index += chunkSize;
            if (index < htmlChunks.length) {
                requestAnimationFrame(nextChunk);
            } else if (onComplete) {
                onComplete(index);
            }
        };
        requestAnimationFrame(nextChunk);
    };

    // Basic cache for sorted data
    if (!window._sortCache) window._sortCache = { key: '', data: [] };
    const getSortedData = (list, sortKey, sortDir) => {
        // Invalidate cache if counts changed
        const cacheKey = `${sortKey}-${sortDir}-${list.length}-${app.filter}-${app.mode}-${app.onlyUnlocked}-${app.searchQuery}-${totalObsCount}`;
        if (window._sortCache.key === cacheKey) return window._sortCache.data;

        const sorted = [...list];
        sorted.sort((a, b) => {
            // Arrow DOWN (desc) = Smallest First (1, 5, 10...)
            // Arrow UP (asc) = Largest First (100, 50, 1...)
            // Following user request: flèche vers le bas = du plus petit au plus grand
            const dir = (sortDir === 'desc') ? 1 : -1;
            if (sortKey === 'num') {
                // Custom animals (#C...) always sort after standard database entries
                const aIsCustom = a.isCustom ? 1 : 0;
                const bIsCustom = b.isCustom ? 1 : 0;
                if (aIsCustom !== bIsCustom) return aIsCustom - bIsCustom;
                const nA = parseInt(a.num.replace(/[^0-9]/g, '')) || 0;
                const nB = parseInt(b.num.replace(/[^0-9]/g, '')) || 0;
                return (nA - nB) * dir;
            }
            if (sortKey === 'name') return a.name.localeCompare(b.name) * dir;
            if (sortKey === 'weight') return (parseWeight(a.stats.weight) - parseWeight(b.stats.weight)) * dir;
            if (sortKey === 'size') return (parseSize(a.stats.size) - parseSize(b.stats.size)) * dir;
            if (sortKey === 'rarity') return (a.stats.rarity - b.stats.rarity) * dir;
            if (sortKey === 'photos') return ((photoCounts.get(a.id) || 0) - (photoCounts.get(b.id) || 0)) * dir;
            return 0;
        });



        window._sortCache = { key: cacheKey, data: sorted };
        return sorted;
    };

    if (app.view === 'index') {
        document.getElementById('page-title').innerText = 'Pokedex';
        let l = totalList;
        if (app.searchQuery) l = l.filter(x => x.name.toLowerCase().includes(app.searchQuery));
        l = getSortedData(l, app.pokedexSort, app.sortDir);
        if (app.onlyUnlocked) l = l.filter(x => u.has(x.id));

        // --- PAGINATION (Append-Only) ---
        const PAGE_SIZE = 60;
        const listKey = `${l.length}-${app.filter}-${app.pokedexSort}-${app.sortDir}-${app.onlyUnlocked}-${app.searchQuery}-${app.mode}`;
        // Always rebuild if we weren't just on the index page — the detail view also
        // contains a div.grid (photos) that fools a querySelector('.grid') check.
        const wasOnIndex = window._lastRenderedView === 'index';
        const sameKey = window._pageState && window._pageState.key === listKey;
        const isNewContext = !sameKey || !wasOnIndex;
        window._lastRenderedView = 'index';

        if (isNewContext) {
            // Preserve the page number when returning from detail so the user
            // sees all cards they had loaded, not just the first 60.
            const savedPage = (!wasOnIndex && sameKey && window._pageState.page > 1)
                ? window._pageState.page : 1;
            window._pageState = { key: listKey, page: savedPage, rendered: 0 };
        }

        const alreadyRendered = window._pageState.rendered;
        const upTo = Math.min(window._pageState.page * PAGE_SIZE, l.length);
        const newItems = l.slice(alreadyRendered, upTo);
        const hasMore = upTo < l.length;

        // Rebuild DOM on new context, otherwise append
        let grid;
        if (isNewContext) {
            c.innerHTML = '<div id="index-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"></div><div id="load-more-wrapper" class="flex justify-center py-8 pb-20"></div>';
        }
        grid = c.querySelector('#index-grid');


        const makeCard = (a, idx) => {
            const discovered = u.has(a.id);
            const coverObs = covers.get(a.id);
            const imgSrc = coverObs ? (coverObs.thumbnailSrc || coverObs.imageSrc) : a.imgRef;
            const objPos = (coverObs || !a.objectPosition) ? '' : `style="object-position: ${a.objectPosition}"`;
            const customBadge = a.isCustom
                ? `<div class="absolute top-1 left-1 bg-brand-accent/20 border border-brand-accent/40 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] text-brand-accent font-bold uppercase tracking-wider">✦ Custom</div>`
                : '';
            return `<div onclick="window.handleCardClick(event, '${a.id}')" oncontextmenu="window.ui.showMenu(event, null, '${a.id}')"
                            data-animal-id="${a.id}"
                            class="aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden relative cursor-pointer border ${discovered ? 'border-brand-accent' : 'border-white/5'} card-hover animate-reveal"
                            style="animation-delay: ${idx % 8 * 40}ms">
                            <img src="${imgSrc}" ${objPos} onerror="window.ui.handleImgError(this)" loading="lazy" class="img-fit ${discovered ? '' : 'grayscale opacity-50'}">
                                ${customBadge}
                                <div class="absolute top-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-brand-gold font-bold">R${a.stats.rarity}</div>
                                <div class="absolute bottom-0 inset-x-0 p-2 text-xs font-bold text-white bg-black/50 truncate">${a.name}</div>
                        </div>`;
        };

        const totalNewItems = newItems.length;
        const htmlChunks = newItems.map((a, i) => makeCard(a, alreadyRendered + i));
        renderInChunks(grid, htmlChunks, 100, () => {
            // Update rendered count by the actual number of new items appended
            window._pageState.rendered = alreadyRendered + totalNewItems;
        });

        // Load more button — always in its own div outside the grid
        const wrapper = document.getElementById('load-more-wrapper');
        if (wrapper) {
            wrapper.innerHTML = hasMore
                ? `<button onclick="window.loadMore()" class="bg-white hover:bg-white/80 transition-colors text-black font-bold px-8 py-3 rounded-full text-sm shadow-xl">
                            Charger plus (${upTo} / ${l.length})
                           </button>`
                : '';
        }

    } else if (app.view === 'detail') {
        window._lastRenderedView = 'detail';
        const a = DB.find(x => x.id === app.currentId);
        const isSameView = document.getElementById('detail-content-id') && document.getElementById('detail-content-id').dataset.id === app.currentId;

        // ── CHARGEMENT INSTANTANÉ DES PHOTOS ────────────────────────────
        // C.lobs est déjà entièrement en RAM depuis le splash screen.
        // On filtre en JavaScript pur → <10ms au lieu de 2-5s IDB.
        if (!window._detailCache) window._detailCache = { v: -1, id: null, data: [] };
        let photos;
        if (window._detailCache.v === C.v && window._detailCache.id === app.currentId) {
            // Cache détail exact (même animal, même version)
            photos = window._detailCache.data;
        } else if (C.lobs.v === C.v && C.lobs.data) {
            // Filtrer depuis le cache global (pré-chargé au splash) → instantané
            photos = C.lobs.data.filter(p => p.animalId === app.currentId);
            window._detailCache = { v: C.v, id: app.currentId, data: photos };
        } else {
            // Fallback IDB (ne devrait arriver qu'au tout premier lancement sans splash)
            const raw = await db.obs.where('animalId').equals(app.currentId).reverse().sortBy('date');
            photos = raw.map(({ imageSrc, ...p }) => p);
            window._detailCache = { v: C.v, id: app.currentId, data: photos };
        }
        const has = photos.length > 0;

        if (app.detailSort === 'rating') photos.sort((a, b) => b.rating - a.rating);
        else photos.sort((a, b) => new Date(b.date) - new Date(a.date));
        if (app.sortDir === 'asc') photos.reverse();
        window.currentPhotos = photos;

        // ── PAGINATION (identique au Pokedex) ───────────────────────────────
        const DETAIL_PAGE = 60;
        const detailKey = `${app.currentId}-${app.detailSort}-${app.sortDir}`;
        const isNewDetailCtx = !window._detailPageState || window._detailPageState.key !== detailKey || !isSameView;
        if (isNewDetailCtx) window._detailPageState = { key: detailKey, page: 1 };

        const dpUpTo = window._detailPageState.page * DETAIL_PAGE;
        const visiblePhotos = photos.slice(0, dpUpTo);
        const hasMorePhotos = dpUpTo < photos.length;

        const makePhotoCard = (p, i) => `
                            <div onclick="window.lb.open(${i},window.currentPhotos)" oncontextmenu="window.ui.showMenu(event, ${p.id})" class="aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative group card-hover">
                                <img src="${p.thumbnailSrc}" loading="lazy" class="img-fit">
                                <div class="absolute bottom-1 right-1 bg-black/80 rounded px-1 text-[10px] text-brand-gold font-bold">★ ${p.rating}</div>
                                <div onclick="window.toggleGridFav(event, ${p.id})" class="absolute top-1 left-1 p-1 rounded-full hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100 ${p.isFav ? 'text-red-500 opacity-100' : 'text-white/30 hover:text-white'}">
                                    <i class="ph-fill ph-heart text-lg"></i>
                                </div>
                            </div>`;

        const loadMoreBtn = hasMorePhotos
            ? `<button onclick="window.loadMoreDetail()" class="bg-white hover:bg-white/80 transition-colors text-black font-bold px-8 py-3 rounded-full text-sm shadow-xl">
                                Charger plus (${dpUpTo} / ${photos.length})
                               </button>`
            : '';

        const gridHtml = has
            ? `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 pt-4">
                                ${visiblePhotos.map((p, i) => makePhotoCard(p, i)).join('')}
                               </div>
                               <div class="flex justify-center py-8 pb-20">${loadMoreBtn}</div>`
            : `<div class="h-40 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-gray-600"><i class="ph ph-camera text-3xl mb-2"></i><p>Aucune photo pour le moment. gros looser.</p><button onclick="ui.openImporter()" class="text-brand-accent font-bold text-sm mt-2 hover:underline">Importer maintenant</button></div>`;


        if (isSameView) {
            // Partial Update
            document.getElementById('detail-grid-container').innerHTML = gridHtml;

            // Immediately update the main cover image and its state
            const mainImg = document.getElementById('detail-main-img');
            if (mainImg) {
                const coverObs = covers.get(app.currentId);
                mainImg.src = coverObs ? (coverObs.thumbnailSrc || coverObs.imageSrc) : a.imgRef;
                mainImg.style.objectPosition = (coverObs || !a.objectPosition) ? '' : a.objectPosition;
                if (u.has(a.id)) mainImg.classList.remove('grayscale', 'opacity-60');
                else mainImg.classList.add('grayscale', 'opacity-60');
            }
            // Update sort button active states
            // Use a slightly mismatched sync call or ensure classes are toggled? 
            // Actually ui.syncPill handles the background. The text color is handled in CSS/JS? No, I need to toggle classes manually if I don't re-render.
            // Wait, syncPill only moves the pill. It doesn't update text colors unless valid 'active' class used on button?
            // The syncPill function ADDS the active class to the target element if specified?
            // Let's check syncPill implementation later. For now assume re-rendering buttons is needed or just rely on syncPill.
            // Actually, simple solution: update the buttons' classes manually here or just re-render the controls area?
            // Re-rendering the controls area destroys the pill too.
            // So I must NOT re-render the controls area.
            // I will trust syncPill to handle the visual "active" indication if it does that, OR I update classes manually.
            // UPDATE: syncPill moves the background. The text color change relies on CSS usually or `ui.syncPill` toggling classes?
            // Looking at `ui.syncPill` (not visible here but usually it just moves the bg).
            // The buttons have `transition-colors`. I need to correctly set their active/inactive classes.
            // Let's manually updaet classes for now.
            ['date', 'rating'].forEach(t => {
                const btn = document.getElementById(`detail-sort-${t}`);
                if (btn) btn.className = `relative z-10 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${app.detailSort === t ? 'active-accent-text' : 'text-gray-400'}`;
            });



        } else {
            // Full Render
            document.getElementById('page-title').innerText = a.name;
            c.innerHTML = `
                        <div id="detail-content-id" data-id="${a.id}" class="max-w-6xl mx-auto pb-24 space-y-8">
                            <button onclick="window.router.back()" class="text-xs font-bold text-gray-400 hover:text-white uppercase flex items-center gap-2"><i class="ph-bold ph-arrow-left"></i> Retour</button>
                            <div class="glass-panel p-8 rounded-2xl flex flex-col md:flex-row gap-8 items-start">
                                <div oncontextmenu="window.ui.showMenu(event, null, '${a.id}')" class="aspect-[3/4] w-full md:w-64 bg-black rounded-xl overflow-hidden relative border border-white/10 shrink-0">
                                    <img id="detail-main-img" src="${covers.has(a.id) ? (covers.get(a.id).thumbnailSrc || covers.get(a.id).imageSrc) : a.imgRef}"
                                        ${(covers.has(a.id) || !a.objectPosition) ? '' : `style="object-position: ${a.objectPosition}"`}
                                        onerror="window.ui.handleImgError(this)"
                                        class="img-fit ${u.has(a.id) ? '' : 'grayscale opacity-60'}">
                                        <div class="absolute top-4 left-4 bg-black/50 backdrop-blur px-2 py-1 rounded text-xs font-bold uppercase">${a.type}</div>
                                </div>
                                <div class="flex-1 space-y-6 w-full">
                                    <div class="flex justify-between items-start">
                                        <div><h1 class="text-4xl font-extrabold flex items-center gap-3">${a.name} <button onclick="playAudio('${a.id}')" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-brand-accent hover:!bg-white hover:scale-110 transition-all"><i class="ph-fill ph-speaker-high text-xl"></i></button></h1></div>
                                        <div class="flex items-center gap-2">
                                            ${a.isCustom ? `<div class="text-xs font-bold px-3 py-1 rounded-full bg-brand-accent/20 border border-brand-accent/40 text-brand-accent">✦ Custom</div>` : ''}
                                            <div class="text-xs font-bold px-3 py-1 rounded-full bg-brand-gold text-black">Rareté ${a.stats.rarity}/10</div>
                                        </div>
                                    </div>
                                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center text-sm">
                                        <div class="p-3 bg-white/5 rounded-lg border border-white/5">
                                            <div class="flex items-center justify-center gap-1.5 text-gray-400 mb-1"><i class="ph-bold ph-scales"></i> Poids</div>
                                            <div class="font-bold text-brand-accent">${a.stats.weight}</div>
                                        </div>
                                        <div class="p-3 bg-white/5 rounded-lg border border-white/5">
                                            <div class="flex items-center justify-center gap-1.5 text-gray-400 mb-1"><i class="ph-bold ph-ruler"></i> Taille</div>
                                            <div class="font-bold text-brand-accent">${a.stats.size}</div>
                                        </div>
                                        <div class="p-3 bg-white/5 rounded-lg border border-white/5">
                                            <div class="flex items-center justify-center gap-1.5 text-gray-400 mb-1"><i class="ph-bold ph-tree"></i> Habitat</div>
                                            <div class="font-bold text-brand-accent">${a.stats.habitat}</div>
                                        </div>
                                        <div class="p-3 bg-white/5 rounded-lg border border-white/5">
                                            <div class="flex items-center justify-center gap-1.5 text-gray-400 mb-1"><i class="ph-bold ph-camera"></i> Photos</div>
                                            <div class="font-bold text-brand-accent">${photos.length}</div>
                                        </div>
                                    </div>
                                    <div class="p-4 bg-white/5 rounded-lg border border-white/5 text-left text-gray-400 text-sm">
                                        ${a.desc}
                                    </div>
                                </div>
                            </div>

                            <!-- V28: Guide du Photographe (Tips) -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="glass-panel p-6 rounded-xl border border-white/10 relative overflow-hidden">
                                    <i class="ph-duotone ph-map-pin text-6xl absolute -right-4 -bottom-4 text-white/20 rotate-12"></i>
                                    <h3 class="text-lg font-bold text-brand-accent mb-3 flex items-center gap-2"><i class="ph-fill ph-binoculars"></i> Où le trouver ?</h3>
                                    <p class="text-gray-300 text-sm leading-relaxed">${(a.tips && a.tips.finding) ? a.tips.finding : "Cherchez dans son habitat naturel (" + a.stats.habitat + "). Soyez patient et observateur."}</p>
                                </div>
                                <div class="glass-panel p-6 rounded-xl border border-white/10 relative overflow-hidden">
                                    <i class="ph-duotone ph-camera text-6xl absolute -right-4 -bottom-4 text-white/20 -rotate-12"></i>
                                    <h3 class="text-lg font-bold text-brand-gold mb-3 flex items-center gap-2"><i class="ph-fill ph-aperture"></i> Technique Photo</h3>
                                    <p class="text-gray-300 text-sm leading-relaxed">${(a.tips && a.tips.photo) ? a.tips.photo : "Privilégiez la lumière douce du matin ou du soir. Faites la mise au point sur les yeux."}</p>
                                </div>
                            </div>

                            <div class="flex items-center justify-between border-b border-white/10 pb-4">
                                <h3 class="text-xl font-bold flex items-center gap-3">Mes Photos <span class="text-sm bg-white text-black font-extrabold px-2.5 py-0.5 rounded-full">${photos.length}</span></h3>
                                <div class="flex gap-2 items-center">
                                    <div class="relative bg-white/5 rounded-full p-1 flex items-center">
                                        <div id="detail-pill" class="pill-bg !bg-white"></div>
                                        <button id="detail-sort-date" onclick="window.sortDetail('date')" class="sort-btn relative z-10 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${app.detailSort === 'date' ? 'active-accent-text' : 'text-gray-400'}">Date</button>
                                        <button id="detail-sort-rating" onclick="window.sortDetail('rating')" class="sort-btn relative z-10 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${app.detailSort === 'rating' ? 'active-accent-text' : 'text-gray-400'}">Note</button>
                                    </div>
                                    <button onclick="window.toggleSortDir()" class="ml-2 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:!bg-white transition-all active:scale-95" title="Inverser le tri">
                                        <i class="ph-bold ph-arrow-down text-lg transition-transform duration-300 transform btn-sort-dir-icon" style="transform: ${app.sortDir === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)'}"></i>
                                    </button>
                                </div>
                            </div>

                            <div id="detail-grid-container">
                                ${gridHtml}
                            </div>
                        </div>`;
        }

        requestAnimationFrame(() => ui.syncPill('detail-pill', 'detail-sort-' + app.detailSort, 'active-accent-text'));


        // V28: Badges View
    } else if (app.view === 'badges') {
        window._lastRenderedView = 'badges';
        document.getElementById('page-title').innerText = 'Badges';
        c.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24"></div>';
        const grid = c.querySelector('.grid');

        // Badges — réutilise le cache léger (lobs) si disponible
        let allObsBadges;
        if (C.lobs.v === C.v) {
            allObsBadges = C.lobs.data;
        } else {
            const rawBadge = await db.obs.toArray();
            allObsBadges = rawBadge.map(({ imageSrc, ...p }) => p);
            C.lobs = { v: C.v, mode: 'normal', data: allObsBadges };
        }
        const filteredObs = allObsBadges.filter(o => (app.mode === 'normal' || (o.tags || []).includes(app.mode === 'zoo' ? 'Zoo' : 'Sauvage')));

        const typeCount = {}; // {mammal: 10, bird: 5 } (photos count)
        const typeUnique = {}; // {mammal: Set(ids) } (unique animals)
        const animalCount = {}; // {dex_1: 5 }

        filteredObs.forEach(o => {
            const a = DB.find(x => x.id === o.animalId);
            if (!a) return;

            // Photos per Type
            typeCount[a.type] = (typeCount[a.type] || 0) + 1;

            // Unique per Type
            if (!typeUnique[a.type]) typeUnique[a.type] = new Set();
            typeUnique[a.type].add(a.id);

            // Photos per Animal
            animalCount[a.id] = (animalCount[a.id] || 0) + 1;
        });



        const badges = [];
        const types = [...new Set(DB.map(x => x.type))];
        const typeNames = { mammal: 'Mammifères', bird: 'Oiseaux', exotic: 'Exotiques', aquatic: 'Aquatiques', insect: 'Insectes', reptile: 'Reptiles', amphibian: 'Amphibiens' };

        // 1. Completionist (Unique Animals Count: 5, 10, 25, then 100%)
        const tiersExpl = [
            { t: 0, l: 'Novice', c: 'text-gray-600' },
            { t: 5, l: 'Bronze', c: 'text-orange-700' },
            { t: 10, l: 'Argent', c: 'text-gray-300' },
            { t: 25, l: 'Or', c: 'text-yellow-400' },
            { t: 'ALL', l: 'Diamant', c: 'text-cyan-400' } // Special tag for 100%
        ];

        types.forEach(t => {
            const totalInDb = DB.filter(x => x.type === t).length;
            const found = typeUnique[t] ? typeUnique[t].size : 0;

            // Determine current tier
            let currentTier = tiersExpl[0];
            let nextTier = tiersExpl[1];
            let isMax = false;

            // Check for Diamond (100%) first
            if (totalInDb > 0 && found >= totalInDb) {
                currentTier = tiersExpl[4]; // Diamond
                nextTier = null;
                isMax = true;
            } else {
                // Check standard tiers
                for (let i = 0; i < 4; i++) { // Only go up to Gold (index 3) for standard check
                    const tier = tiersExpl[i];
                    if (tier.t !== 'ALL' && found >= tier.t) {
                        // Update current tier, but respect Diamond check which failed (so we are not Diamond yet)
                        currentTier = tier;
                        nextTier = tiersExpl[i + 1];
                    }
                }
            }

            // Adjust next target if it's 'ALL'
            let target = 0;
            if (isMax) {
                target = totalInDb;
            } else if (nextTier) {
                if (nextTier.t === 'ALL') target = totalInDb;
                else target = nextTier.t;
            }

            const label = typeNames[t] || t;

            badges.push({
                title: `Explorateur - ${label}`,
                subtitle: currentTier.t === 0 ? 'Aucun badge' : currentTier.l,
                desc: isMax ? `Vous avez photographié toutes les espèces !` : `Trouvez ${target} espèces de ${label} pour le rang ${nextTier.l}.`,
                icon: 'ph-compass',
                color: currentTier.c,
                progress: found,
                target: target,
                totalInDb: totalInDb,
                type: t,
                label: label,
                tiers: tiersExpl,
                unlocked: currentTier.t !== 0 || isMax
            });


        });



        // 2. Collector (Total Photos) - DISABLED to avoid duplicates per category
        /*
        const tiersColl = [
            {t: 0, l: 'Novice', c: 'text-gray-600' },
                {t: 5, l: 'Bronze', c: 'text-orange-700' },
                {t: 10, l: 'Argent', c: 'text-gray-300' },
                {t: 25, l: 'Or', c: 'text-yellow-400' },
                {t: 50, l: 'Diamant', c: 'text-cyan-400' }
                ];

        types.forEach(t => {
            const count = typeCount[t] || 0;

                let currentTier = tiersColl[0];
                let nextTier = tiersColl[1];
                for (let i = 0; i < tiersColl.length; i++) {
                if (count >= tiersColl[i].t) {
                    currentTier = tiersColl[i];
                nextTier = tiersColl[i + 1];
                }
            }

                const isMax = !nextTier;
                const target = isMax ? count : nextTier.t; // If max, target matches count or stays at max tier
                const label = typeNames[t] || t;

                badges.push({
                    title: `Collectionneur - ${label}`,
                subtitle: currentTier.t === 0 ? 'Non classé' : currentTier.l,
                desc: isMax ? `Collection complète !` : `Prenez ${target} photos de ${label} pour le rang ${nextTier.l}.`,
                icon: 'ph-images',
                color: currentTier.c,
                progress: count,
                target: target,
                unlocked: currentTier.t > 0
            });


        });


                */

        // Sort: Unlocked first, then by progress ratio
        badges.sort((a, b) => {
            if (a.unlocked !== b.unlocked) return b.unlocked - a.unlocked;
            return (b.progress / b.target) - (a.progress / a.target);
        });



        const htmlChunks = badges.map((b, i) => {
            const badgeJson = JSON.stringify(b).replace(/"/g, '&quot;');
            const subtitleStyle = b.unlocked
                ? `color: inherit; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);`
                : `color: #6b7280; background: #1f2937; border: 1px solid rgba(255,255,255,0.05);`;
            return `
                        <div onclick="window.openBadgeModal(${i})" data-badge-idx="${i}" class="bg-gray-900 border ${b.unlocked ? 'border-brand-accent/50 box-shadow-brand' : 'border-white/5'} rounded-xl p-4 flex items-center gap-4 relative overflow-hidden group cursor-pointer card-hover">
                            <div class="w-14 h-14 rounded-full ${b.unlocked ? 'bg-white/10' : 'bg-gray-800/60'} flex items-center justify-center shrink-0 border ${b.unlocked ? 'border-white/20' : 'border-white/5'} relative">
                                ${b.unlocked ? `<div class="absolute inset-0 rounded-full opacity-20 ${b.color}" style="background:currentColor"></div>` : ''}
                                <i class="ph-fill ${b.icon} text-3xl ${b.unlocked ? b.color : 'text-gray-700'}"></i>
                            </div>
                            <div class="flex-1 z-10">
                                <div class="flex justify-between items-start">
                                    <h4 class="font-bold text-sm ${b.unlocked ? 'text-white' : 'text-gray-500'}">${b.title}</h4>
                                    <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded ${b.unlocked ? b.color : ''}" style="${subtitleStyle}">${b.subtitle}</span>
                                </div>
                                <p class="text-[10px] text-gray-400 mb-2 mt-1">${b.desc}</p>
                                <div class="h-1.5 w-full bg-black/60 rounded-full overflow-hidden border border-white/5">
                                    <div class="h-full transition-all duration-700 ${b.unlocked ? 'bg-brand-accent' : 'bg-gray-700'}" style="width: ${Math.min(100, b.target > 0 ? (b.progress / b.target) * 100 : 0)}%"></div>
                                </div>
                                <div class="text-[10px] text-right mt-1 text-gray-500 font-mono">${b.progress} / ${b.target}</div>
                            </div>
                            ${b.unlocked ? '<div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>' : ''}
                        </div>
                        `;
        });

        window._currentBadges = badges;

        if (badges.length === 0) {
            grid.innerHTML = '<div class="col-span-3 text-center text-gray-500 py-20">Commencez à prendre des photos pour débloquer des badges !</div>';
        } else {
            renderInChunks(grid, htmlChunks);
        }

    } else {
        window._lastRenderedView = app.view;
        const title = app.view === 'favs' ? 'Favoris' : 'Galerie';

        // ── CHARGEMENT LÉGER DES PHOTOS (sans imageSrc) ──────────────────
        // imageSrc = base64 pleine résolution (~2-5 MB par photo).
        // Le charger en masse pour 1000 photos = saturation mémoire + lenteur.
        // On le strip ici et on le charge à la demande dans la lightbox.
        let photos;
        const lobsOk = C.lobs.v === C.v && C.lobs.mode === app.mode;
        if (lobsOk) {
            photos = C.lobs.data;
        } else {
            let rawPhotos;
            if (app.mode === 'normal') {
                rawPhotos = await db.obs.toArray();
            } else {
                const tag = app.mode === 'zoo' ? 'Zoo' : 'Sauvage';
                rawPhotos = await db.obs.where('tags').equals(tag).toArray();
            }
            // Supprimer imageSrc de chaque obs — ne sera rechargé qu'à la demande
            photos = rawPhotos.map(({ imageSrc, ...p }) => p);
            C.lobs = { v: C.v, mode: app.mode, data: photos };
        }


        if (app.view === 'favs') photos = photos.filter(p => p.isFav);
        if (app.searchQuery) {
            const nameMap = new Map(DB.map(x => [x.id, x.name.toLowerCase()]));
            photos = photos.filter(p => {
                const animalName = nameMap.get(p.animalId) || '';
                const tags = (p.tags || []).join(' ').toLowerCase();
                const desc = (p.desc || '').toLowerCase();
                const q = app.searchQuery;
                return animalName.includes(q) || tags.includes(q) || desc.includes(q);
            });


        }
        document.getElementById('page-title').innerHTML = `${title} <span class="text-[10px] !bg-white px-2 py-0.5 rounded-full text-gray-400 ml-2 font-bold uppercase tracking-wider">${photos.length} photo${photos.length > 1 ? 's' : ''}</span>`;
        window.currentPhotos = photos;

        if (app.sort === 'rating') {
            photos.sort((a, b) => b.rating - a.rating);
            if (app.sortDir === 'asc') photos.reverse();
            c.innerHTML = `<div class="grid grid-cols-5 md:grid-cols-6 gap-3 pb-24"></div>`;
            const grid = c.querySelector('.grid');
            const htmlChunks = photos.map((p, i) => `<div onclick="window.lb.open(${i},window.currentPhotos)" oncontextmenu="window.ui.showMenu(event, ${p.id})" class="aspect-square bg-gray-800 rounded-lg overflow-hidden relative cursor-pointer group card-hover animate-reveal" style="animation-delay: ${i % 8 * 40}ms"><img src="${p.thumbnailSrc || p.imageSrc}" loading="lazy" class="img-fit"><div class="absolute bottom-1 right-1 bg-black/80 rounded px-1 text-[10px] text-brand-gold font-bold">★ ${p.rating}</div><div onclick="window.toggleGridFav(event, ${p.id})" class="absolute top-1 left-1 p-1 rounded-full hover:bg-black/50 transition-colors ${p.isFav ? 'text-red-500' : 'text-white/30 hover:text-white'}"><i class="ph-fill ph-heart text-lg"></i></div></div>`);
            renderInChunks(grid, htmlChunks);
        } else {
            photos.sort((a, b) => new Date(b.date) - new Date(a.date));
            if (app.sortDir === 'asc') photos.reverse();
            const g = {}; photos.forEach(p => { const k = new Date(p.date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); const K = k.charAt(0).toUpperCase() + k.slice(1); if (!g[K]) g[K] = []; g[K].push(p) });
            c.innerHTML = '<div class="space-y-6 pb-24"></div>';
            const container = c.querySelector('.space-y-6');

            let globalIdx = 0;
            for (const [mKey, lPhotos] of Object.entries(g)) {
                const monthWrapper = document.createElement('div');
                monthWrapper.innerHTML = `<div><h3 class="text-lg font-bold mb-2 py-2 text-gray-400 border-b border-white/5 flex items-center gap-2"><span>${mKey}</span> <span class="text-[10px] bg-white/5 px-2 rounded-full font-bold uppercase tracking-wider opacity-50">${lPhotos.length} photo${lPhotos.length > 1 ? 's' : ''}</span></h3><div class="grid grid-cols-5 md:grid-cols-6 gap-3"></div></div>`;
                const content = monthWrapper.firstElementChild;
                container.appendChild(content);
                const grid = content.querySelector('.grid');
                const htmlChunks = lPhotos.map(p => {
                    const div = `<div onclick="window.lb.open(${photos.indexOf(p)},window.currentPhotos)" oncontextmenu="window.ui.showMenu(event, ${p.id})" class="aspect-square bg-gray-800 rounded-lg overflow-hidden relative cursor-pointer group card-hover animate-reveal" style="animation-delay: ${globalIdx % 8 * 40}ms"><img src="${p.thumbnailSrc || p.imageSrc}" loading="lazy" class="img-fit"><div class="absolute bottom-1 right-1 bg-black/80 rounded px-1 text-[10px] text-brand-gold font-bold">★ ${p.rating}</div><div onclick="window.toggleGridFav(event, ${p.id})" class="absolute top-1 left-1 p-1 rounded-full hover:bg-black/50 transition-colors ${p.isFav ? 'text-red-500' : 'text-white/30 hover:text-white'}"><i class="ph-fill ph-heart text-lg"></i></div></div>`;
                    globalIdx++;
                    return div;
                });


                renderInChunks(grid, htmlChunks);
            }
        }
    }
}

// ── BADGE MODAL ──────────────────────────────────────────────────────────────
window.openBadgeModal = (idx) => {
    const b = window._currentBadges && window._currentBadges[idx];
    if (!b) return;

    const modal = document.getElementById('badge-modal');
    if (!modal) return;

    const tierDefs = [
        { t: 0,     l: 'Aucun badge', icon: '—',  color: '#6b7280', bg: '#1f2937' },
        { t: 5,     l: 'Bronze',      icon: '🥉', color: '#b45309', bg: 'rgba(180,83,9,0.15)' },
        { t: 10,    l: 'Argent',      icon: '🥈', color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
        { t: 25,    l: 'Or',          icon: '🥇', color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
        { t: 'ALL', l: 'Diamant',     icon: '💎', color: '#22d3ee', bg: 'rgba(34,211,238,0.15)' },
    ];
    const totalInDb = b.totalInDb || 0;
    const found = b.progress;

    // Determine which tier the user is at
    let currentTierIdx = 0;
    if (found >= totalInDb && totalInDb > 0) {
        currentTierIdx = 4;
    } else {
        for (let i = 0; i < 4; i++) {
            if (tierDefs[i].t !== 'ALL' && found >= tierDefs[i].t) currentTierIdx = i;
        }
    }
    const currentTierDef = tierDefs[currentTierIdx];

    // Build tiers HTML
    const tiersHtml = tierDefs.map((tier, i) => {
        const thresholdVal = tier.t === 'ALL' ? totalInDb : tier.t;
        const isReached = (tier.t === 'ALL') ? (found >= totalInDb && totalInDb > 0) : (found >= tier.t && tier.t > 0);
        const isCurrent = i === currentTierIdx;
        const isNext = i === currentTierIdx + 1;
        const pct = tier.t === 0 ? 0 : Math.min(100, (found / thresholdVal) * 100);
        
        return `
            <div class="flex items-center gap-3 p-3 rounded-xl border transition-all ${isCurrent ? 'border-white/20 bg-white/5' : 'border-white/5 bg-black/20'} ${isNext ? 'ring-1 ring-brand-accent/30' : ''}">
                <div class="text-2xl w-8 text-center">${tier.icon}</div>
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs font-bold" style="color: ${isReached || isCurrent ? tier.color : '#6b7280'}">${tier.l}</span>
                        <span class="text-[10px] font-mono text-gray-500">${tier.t === 0 ? 'Départ' : (tier.t === 'ALL' ? totalInDb + ' espèces' : tier.t + ' espèces')}</span>
                    </div>
                    ${tier.t !== 0 ? `
                    <div class="h-1 w-full bg-black/60 rounded-full overflow-hidden border border-white/5">
                        <div class="h-full rounded-full transition-all duration-700" style="width: ${pct}%; background: ${tier.color}; opacity: ${isReached ? '1' : '0.4'}"></div>
                    </div>` : ''}
                </div>
                ${isReached ? `<i class="ph-fill ph-check-circle text-lg" style="color: ${tier.color}"></i>` : ''}
                ${isCurrent && !isReached ? '<div class="w-2 h-2 rounded-full bg-brand-accent animate-pulse"></div>' : ''}
            </div>
        `;
    }).join('');

    document.getElementById('badge-modal-title').textContent = b.title;
    document.getElementById('badge-modal-rank').textContent = currentTierDef.l;
    document.getElementById('badge-modal-rank').style.color = currentTierDef.color;
    document.getElementById('badge-modal-rank').style.borderColor = currentTierDef.color + '44';
    document.getElementById('badge-modal-rank').style.background = currentTierDef.bg;
    document.getElementById('badge-modal-desc').textContent = b.desc;
    document.getElementById('badge-modal-progress').textContent = `${found} / ${totalInDb} espèces de ${b.label}`;
    document.getElementById('badge-modal-tiers').innerHTML = tiersHtml;

    // Overall progress bar
    const overallPct = totalInDb > 0 ? Math.min(100, (found / totalInDb) * 100) : 0;
    document.getElementById('badge-modal-bar').style.width = overallPct + '%';
    document.getElementById('badge-modal-bar').style.background = currentTierDef.color;

    modal.classList.remove('badge-modal-hidden');
    requestAnimationFrame(() => {
        modal.classList.add('badge-modal-visible');
    });
};

window.closeBadgeModal = () => {
    const modal = document.getElementById('badge-modal');
    if (!modal) return;
    modal.classList.remove('badge-modal-visible');
    setTimeout(() => modal.classList.add('badge-modal-hidden'), 250);
};


const savedTheme = localStorage.getItem('pokedex-theme') || '#4FD1C5';
ui.updateTheme(savedTheme);
const themePicker = document.getElementById('theme-picker');
if (themePicker) { themePicker.value = savedTheme; }

// Populate animal suggestions datalist with safety
try {
    const datalistCurrent = document.getElementById('all-animals-list');
    const targetDB = (typeof window.DB !== 'undefined') ? window.DB : (typeof DB !== 'undefined' ? DB : []);
    if (datalistCurrent && targetDB.length > 0) {
        datalistCurrent.innerHTML = targetDB.map(a => `<option value="${a.name}">`).join('');
    }
} catch (err) {
    console.error("Datalist population failed", err);
}

// ══════════════════════════════════════════════════════════════════
// CUSTOM ANIMAL MANAGER — animaux créés localement, stockés en IDB
// Survivent aux mises à jour de database.js et sont isolés par machine
// ══════════════════════════════════════════════════════════════════
window.customAnimalManager = {

    open: () => {
        const modal = document.getElementById('custom-animal-modal');
        if (!modal) return;
        // Reset form
        document.getElementById('ca-name').value = '';
        document.getElementById('ca-type').value = 'mammal';
        document.getElementById('ca-sciname').value = '';
        document.getElementById('ca-engname').value = '';
        document.getElementById('ca-weight').value = '';
        document.getElementById('ca-size').value = '';
        document.getElementById('ca-habitat').value = '';
        document.getElementById('ca-rarity').value = '3';
        document.getElementById('ca-rarity-display').textContent = '3';
        document.getElementById('ca-desc').value = '';
        document.getElementById('ca-tips-finding').value = '';
        document.getElementById('ca-tips-photo').value = '';
        document.getElementById('ca-error').textContent = '';
        modal.classList.remove('hidden');
    },

    close: () => {
        const modal = document.getElementById('custom-animal-modal');
        if (modal) modal.classList.add('hidden');
    },

    save: async () => {
        const name = document.getElementById('ca-name').value.trim();
        if (!name) {
            document.getElementById('ca-error').textContent = '⚠ Le nom est obligatoire.';
            return;
        }
        // Check for duplicate name in DB
        if (window.DB.find(a => a.name.toLowerCase() === name.toLowerCase())) {
            document.getElementById('ca-error').textContent = `⚠ "${name}" existe déjà dans le Pokedex.`;
            return;
        }
        const rarity = parseInt(document.getElementById('ca-rarity').value) || 3;
        const newAnimal = {
            name,
            type: document.getElementById('ca-type').value,
            scientificName: document.getElementById('ca-sciname').value.trim(),
            englishName: document.getElementById('ca-engname').value.trim(),
            imgRef: '',
            objectPosition: 'center',
            stats: {
                weight: document.getElementById('ca-weight').value.trim(),
                size: document.getElementById('ca-size').value.trim(),
                habitat: document.getElementById('ca-habitat').value.trim(),
                rarity
            },
            desc: document.getElementById('ca-desc').value.trim(),
            tips: {
                finding: document.getElementById('ca-tips-finding').value.trim(),
                photo: document.getElementById('ca-tips-photo').value.trim()
            },
            isCustom: true,
            createdAt: new Date().toISOString()
        };

        try {
            const insertedId = await db.customAnimals.add(newAnimal);
            // Assign a unique dex ID so it works with observations
            const dexId = 'custom_' + insertedId;
            newAnimal.id = dexId;
            newAnimal.num = '#C' + String(insertedId).padStart(4, '0');
            await db.customAnimals.update(insertedId, { dexId, id: dexId, num: newAnimal.num });

            // Inject into live window.DB so everything works instantly
            window.DB.push(newAnimal);

            // Update datalist
            const datalist = document.getElementById('all-animals-list');
            if (datalist) {
                const opt = document.createElement('option');
                opt.value = name;
                datalist.appendChild(opt);
            }

            // Ferme le modal, reste sur la vue courante (pas de changement de app.view).
            // _importerPreset transmet le nom à batch.addFiles() pour le pré-remplissage.
            customAnimalManager.close();
            window._importerPreset = name;
            render();
            ui.openImporter();

        } catch (err) {
            console.error('Custom animal save failed:', err);
            document.getElementById('ca-error').textContent = '⚠ Erreur lors de la sauvegarde : ' + err.message;
        }
    }
};

(async () => {
    // Le splash est déjà dans le HTML — on le récupère directement
    const splash = document.getElementById('splash-screen');

    // 🐾 Cycling animal emojis
    const _animalEmojis = ['🦎','🦁','🐘','🦅','🐺','🦊','🐬','🦋','🐊','🦉','🐆','🦈','🦜','🐻','🦧','🐙','🦩','🐢','🦌','🦚','🐋','🦑','🦏','🦟','🐦','🦔','🐠','🦞','🦢','🐸','🦬','🐊','🦤','🦓','🐡','🦭','🐓','🪶','🦗','🐪'];
    // Shuffle once per launch (Fisher-Yates)
    for (let i = _animalEmojis.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [_animalEmojis[i], _animalEmojis[j]] = [_animalEmojis[j], _animalEmojis[i]];
    }
    let _emojiIdx = 0;
    const _emojiEl = document.getElementById('splash-emoji');
    const _emojiInterval = setInterval(() => {
        if (!_emojiEl || !document.body.contains(_emojiEl)) { clearInterval(_emojiInterval); return; }
        _emojiEl.style.opacity = '0';
        _emojiEl.style.transform = 'scale(0.7)';
        setTimeout(() => {
            _emojiIdx = (_emojiIdx + 1) % _animalEmojis.length;
            _emojiEl.textContent = _animalEmojis[_emojiIdx];
            _emojiEl.style.opacity = '1';
            _emojiEl.style.transform = 'scale(1)';
        }, 150);
    }, 500);

    const bar = document.getElementById('splash-bar');
    const label = document.getElementById('splash-label');
    const step = (pct, txt) => {
        if (bar) bar.style.width = pct + '%';
        if (label) label.textContent = txt;
    };

    const C = window._dbCache;

    try {
        // Étape 0 — Charger les animaux custom depuis IDB et les fusionner dans window.DB
        step(5, 'Animaux personnalisés…');
        try {
            const customArr = await db.customAnimals.toArray();
            if (customArr.length > 0) {
                const existingIds = new Set(window.DB.map(a => a.id));
                customArr.forEach(ca => {
                    if (ca.dexId && !existingIds.has(ca.dexId)) {
                        ca.id = ca.dexId;
                        ca.isCustom = true;
                        window.DB.push(ca);
                    }
                });
                // Refresh datalist
                const datalist = document.getElementById('all-animals-list');
                if (datalist) {
                    datalist.innerHTML = window.DB.map(a => `<option value="${a.name}">`).join('');
                }
            }
        } catch (e) {
            console.warn('Custom animals load failed (non-critical):', e);
        }

        // Étape 1 — discoveredIds (Pokedex)
        step(10, 'Pokedex…');
        const keys = await db.obs.orderBy('animalId').uniqueKeys();
        C.disc = { v: C.v, mode: 'normal', data: new Set(keys) };

        // Étape 2 — covers
        step(28, 'Couvertures…');
        const coversArr = await db.obs.filter(o => o.isCover === true).toArray();
        C.cov = { v: C.v, data: new Map(coversArr.map(o => [o.animalId, o])) };

        // Étape 3 — photoCounts
        step(44, 'Comptage des photos…');
        const photoCounts = new Map();
        await db.obs.orderBy('animalId').eachKey(id => {
            photoCounts.set(id, (photoCounts.get(id) || 0) + 1);
        });
        C.pcnt = { v: C.v, data: photoCounts };

        // Étape 4 — totalCount
        step(56, 'Index de la collection…');
        C.tcnt = { v: C.v, data: await db.obs.count() };

        // Étape 5 — observations légères (Galerie, Badges, etc.) SANS imageSrc
        step(68, 'Galerie & Favoris…');
        const rawAll = await db.obs.toArray();
        const lightObs = rawAll.map(({ imageSrc, ...p }) => p);
        C.lobs = { v: C.v, mode: 'normal', data: lightObs };

        step(90, 'Presque prêt…');
    } catch (err) {
        console.warn('Splash preload partial failure (non-critical):', err);
    }

    // Lancer l'app
    step(100, '');
    try { router.go('index'); } catch (err) {
        console.error("Critical: router.go('index') failed", err);
    }

    // Fade out du splash
    await new Promise(r => setTimeout(r, 200));
    clearInterval(_emojiInterval);
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 520);
})();
