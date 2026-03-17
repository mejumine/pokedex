const db = new Dexie('LumenDex_System');
            // Version 1: initial
            // Version 2: added filePath and isCover
            db.version(2).stores({
                obs: '++id,animalId,date,rating,isFav,*tags,desc,thumbnailSrc,exif,originalName,filePath,isCover'
        });


    });
};


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

        const parseWeight = (w) => normalizeValue(w, {'t': 1000000, 'tonnes': 1000000, 'tonne': 1000000, 'kg': 1000, 'mg': 0.001, 'g': 1 });
        const parseSize = (s) => normalizeValue(s, {'mètres': 100, 'mètre': 100, 'm': 100, 'cm': 1, 'mm': 0.1 });

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
};

                });


    });
};

        });


    });
};


        const createThumbnail = (src) => new Promise(resolve => { const img = new Image(); img.onload = () => { const canvas = document.createElement('canvas'); const MAX_WIDTH = 800; const scaleSize = MAX_WIDTH / img.width; canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', 0.95)); }; img.src = src; });

            window.batch = {
                addFiles: async (files) => {
                document.getElementById('staging-area').innerHTML = '<div class="text-gray-500 text-center mt-10">Lecture...</div>';
            for (let f of files) {
                    const src = await new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(f) });
            const thumb = await createThumbnail(src);
            const exifData = await getExifData(f);
            let pre = '';
            if (app.view === 'detail' && app.currentId) { const a = DB.find(x => x.id === app.currentId); if (a) pre = a.name; }
            window.staging.push({src, thumb, exif: exifData, originalName: f.name, filePath: f.path, meta: {animalName: pre, env: '', rating: 3, desc: '', isFav: false, date: exifData.date, tags: [], f: exifData.raw.f, s: exifData.raw.s, iso: exifData.raw.iso } });
                }
            window.batch.render();
            },
            toggleTag: (i, t) => { const x = window.staging[i].meta.tags; if (x.includes(t)) window.staging[i].meta.tags = x.filter(y => y !== t); else x.push(t); batch.render(); },
            toggleFav: (i) => {window.staging[i].meta.isFav = !window.staging[i].meta.isFav; batch.render(); },
            setEnv: (i, e) => {window.staging[i].meta.env = e; batch.render(); },
            render: () => {
                const a = document.getElementById('staging-area');
            if (!window.staging.length) return a.innerHTML = '<div class="text-center text-gray-500 mt-10">Vide</div>';
                a.innerHTML = window.staging.map((item, idx) => `
            <div class="flex gap-6 bg-[#222] p-4 rounded-xl border border-white/5 relative group">
                <button onclick="batch.removeItem(${idx})" class="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/20 text-red-500 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-red-500 hover:text-white"><i class="ph-bold ph-trash"></i></button>
                <div class="w-40 shrink-0"><img src="${item.thumb}" class="w-40 h-40 object-cover rounded bg-black"><div class="flex justify-center gap-1 mt-2">${[1, 2, 3, 4, 5].map(s => `<i onclick="batch.rate(${idx},${s})" class="ph-fill ph-star ${s <= item.meta.rating ? 'text-brand-gold' : 'text-gray-700'} cursor-pointer"></i>`).join('')}</div><div class="text-[10px] text-gray-500 text-center mt-1 break-words">${item.originalName}</div></div>
                <div class="flex-1 space-y-3">
                    <div class="flex gap-2"><input list="all-animals-list" value="${item.meta.animalName}" onchange="window.staging[${idx}].meta.animalName=this.value" placeholder="Que voyez-vous ?" class="flex-1 bg-[#333] border border-white/10 rounded p-2 text-sm bg-transparent font-bold"><input type="date" value="${item.meta.date}" onchange="window.staging[${idx}].meta.date=this.value" class="bg-[#333] border border-white/10 rounded p-2 text-xs w-32"></div>
                        <div class="flex gap-2 bg-black/20 p-2 rounded items-center">
                            <span class="text-[10px] text-gray-500 font-bold uppercase w-12 shrink-0">Stats :</span>
                            <input type="text" placeholder="f/2.8" value="${item.meta.f}" onchange="window.staging[${idx}].meta.f=this.value" class="w-16 bg-[#333] border border-white/10 rounded px-2 py-1 text-xs text-brand-accent font-mono text-center">
                                <input type="text" placeholder="1/500" value="${item.meta.s}" onchange="window.staging[${idx}].meta.s=this.value" class="w-16 bg-[#333] border border-white/10 rounded px-2 py-1 text-xs text-brand-accent font-mono text-center"><span class="text-xs text-gray-500">s</span>
                                    <input type="text" placeholder="ISO" value="${item.meta.iso}" onchange="window.staging[${idx}].meta.iso=this.value" class="w-16 bg-[#333] border border-white/10 rounded px-2 py-1 text-xs text-brand-accent font-mono text-center">
                                    </div>
                                    <div class="flex gap-2"><button onclick="batch.setEnv(${idx},'Zoo')" class="flex-1 py-1.5 rounded text-xs border ${item.meta.env === 'Zoo' ? 'bg-brand-accent text-black font-bold' : 'border-white/20 hover:bg-white/5'}">ZOO</button><button onclick="batch.setEnv(${idx},'Sauvage')" class="flex-1 py-1.5 rounded text-xs border ${item.meta.env === 'Sauvage' ? 'bg-brand-accent text-black font-bold' : 'border-white/20 hover:bg-white/5'}">SAUVAGE</button></div>
                                    <div class="flex flex-wrap gap-1.5">${EXTRA_TAGS.map(t => `<button onclick="batch.toggleTag(${idx}, '${t}')" class="px-2 py-0.5 rounded-full text-[10px] border ${item.meta.tags.includes(t) ? 'bg-white text-black font-bold' : 'border-white/10 text-gray-500 hover:border-white/30'}">${t}</button>`).join('')}</div>
                                    <div class="flex gap-2"><textarea rows="1" placeholder="Note..." onchange="window.staging[${idx}].meta.desc = this.value" class="flex-1 bg-[#333] border border-white/10 rounded p-2 text-xs text-white bg-transparent">${item.meta.desc}</textarea><button onclick="batch.toggleFav(${idx})" class="px-3 rounded border border-white/10 ${item.meta.isFav ? 'text-red-500 border-red-500/50' : 'text-gray-600 hover:text-red-500'} transition-colors"><i class="ph-fill ph-heart text-xl"></i></button></div>
                                </div></div>
                        `).join('');
                        document.getElementById('import-count').innerText = `${window.staging.length} photos`;
            },
            removeItem: (i) => {window.staging.splice(i, 1); batch.render(); },
            setAllEnv: (e) => {window.staging.forEach(s => s.meta.env = e); batch.render(); },
            rate: (i, r) => {window.staging[i].meta.rating = r; batch.render(); },
            commit: async () => {
                try {
                    const docs = [];
                        for (let s of window.staging) {
                        if (!s.meta.env) {alert("Veuillez préciser Zoo ou Sauvage pour chaque photo."); return; }
                        const a = DB.find(x => x.name.trim() === s.meta.animalName.trim());
                        if (!a) {alert(`Animal non trouvé : "${s.meta.animalName}"`); return; }
                        docs.push({
                            animalId: a.id,
                        imageSrc: s.src,
                        thumbnailSrc: s.thumb,
                        exif: {...s.exif, settings: [s.meta.f, s.meta.s ? s.meta.s + 's' : '', s.meta.iso ? 'ISO ' + s.meta.iso : ''].filter(x => x).join(' • ') },
                        originalName: s.originalName,
                        filePath: s.filePath,
                        rating: s.meta.rating,
                        tags: [s.meta.env, ...s.meta.tags],
                        desc: s.meta.desc,
                        isFav: s.meta.isFav,
                        date: s.meta.date,
                        isCover: false
                        });


    });
};

                    }
                        if (docs.length === 0) {alert("Aucune photo à enregistrer."); return; }
                        ui.closeImporter();
                        router.go(app.view, app.currentId);
                } catch (err) {
                            console.error(err);
                        alert("Erreur lors de l'enregistrement : " + err.message);
                }
            }
        };

                        const app = {view: 'index', lastView: 'index', filter: 'all', sort: 'date', pokedexSort: 'rarity', sortDir: 'desc', detailSort: 'date', searchQuery: '', currentId: null, mode: 'normal', onlyUnlocked: false };
                        window.staging = [];
        document.getElementById('batch-input').onchange = e => batch.addFiles(Array.from(e.target.files));

                        window.ui = {
                            openImporter: () => {window.staging = []; document.getElementById('staging-area').innerHTML = ''; document.getElementById('batch-input').value = ''; document.getElementById('importer').classList.remove('hidden'); document.getElementById('filters').style.display = 'none'; },
            closeImporter: () => {document.getElementById('importer').classList.add('hidden'); document.getElementById('filters').style.display = 'flex'; },

            handleImgError: (el) => {
                            el.onerror = null;
                        el.src = 'data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>';
                        el.classList.add('bg-gray-800');
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
                            starContainer.innerHTML = [1, 2, 3, 4, 5].map(s => `
                            <i onclick="window.ui.setRating(${s})" class="ph-fill ph-star text-lg cursor-pointer hover:text-brand-gold transition-colors ${s <= obs.rating ? 'text-brand-gold' : 'text-white/20'}"></i>
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
                        app.overrides = { };
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
                        // Clear Dexie cover (Observations)

                        // Clear Shuffle override (LocalStorage)
                        if (app.overrides[animalId]) {
                            delete app.overrides[animalId];
                        localStorage.setItem('pokedex-overrides', JSON.stringify(app.overrides));
                }
                        render();
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


    });
};

            },

            closeCropper: () => {
                            document.getElementById('cropper-modal').classList.add('hidden');
                        if (window.cropperInstance) window.cropperInstance.destroy();
            },

            saveCrop: async () => {
                if (!window.cropperInstance) return;
                        const canvas = window.cropperInstance.getCroppedCanvas({
                            width: 600,
                        height: 800
                });


    });
};

                        const blob = canvas.toDataURL('image/jpeg', 0.9);

                        const obs = await db.obs.get(window.selectedObsId);
                        // Unset other covers for this animal
                        // Update this observation as cover and with cropped thumbnail

                        ui.closeCropper();
                        alert("Miniature enregistrée !");
                        render();
            },

            openSourceFolder: async () => {
                const id = window.selectedObsId;
                        const obs = await db.obs.get(id);
                        if (!obs || !obs.filePath) {alert("Chemin du fichier non trouvé."); return; }
                        if (!fs.existsSync(obs.filePath)) {
                            alert("Erreur : L'image est introuvable sur votre disque car elle a été déplacée ou supprimée.");
                        return;
                }
                        shell.showItemInFolder(obs.filePath);
            },

            setRating: async (rating) => {
                        document.getElementById('context-menu').style.display = 'none';
                        render();
            },

            updateTheme: (color) => {
                            document.documentElement.style.setProperty('--brand-accent', color);
                        localStorage.setItem('pokedex-theme', color);
            },

            resetData: async () => {
                if (confirm("⚠️ VOULEZ-VOUS VRAIMENT TOUT EFFACER ?\nCette action supprimera toutes vos photos et votre progression définitivement.")) {
                        location.reload();
                }
            },

            deleteObservation: async () => {
                if (confirm("Supprimer cette observation ?")) {
                        render();
                }
            }
        };

        window.setFilter = (f) => {app.filter = f; render(); };
        window.setMode = (m) => {
                            app.mode = m;
                        const modeLabel = m === 'normal' ? 'Tout' : (m === 'zoo' ? 'Zoo' : 'Sauvage');
                        document.getElementById('stats-mode').innerText = modeLabel;
                        render();
        };

        window.sort = (s) => {app.sort = s; render(); };
        window.sortDex = (s) => {app.pokedexSort = s; render(); };
        window.sortDetail = (s) => {app.detailSort = s; render(); };

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


    });
};

        };

        window.toggleSortDir = () => {
                            app.sortDir = app.sortDir === 'asc' ? 'desc' : 'asc';
            document.querySelectorAll('.btn-sort-dir-icon').forEach(icon => {
                            // Asc = Up (180deg), Desc = Down (0deg)
                            icon.style.transform = app.sortDir === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)';
                        // Small animation pop
                        icon.parentElement.animate([
                        {transform: 'scale(1)' },
                        {transform: 'scale(1.2)' },
                        {transform: 'scale(1)' }
                        ], {duration: 200, easing: 'ease-out' });
            });


    });
};

                        render();
        };

                        let _searchTimeout = null;
        window.setSearch = (q) => {
            if (_searchTimeout) clearTimeout(_searchTimeout);
            _searchTimeout = setTimeout(() => {
                            app.searchQuery = q.toLowerCase().trim();
                        render();
            }, 300);
        };

        window.playAudio = (id) => {alert("Audio non disponible pour le moment (Pas de fichier MP3)."); };

        window.handleCardClick = (e, animalId) => {
                            router.go('detail', animalId);
        };

                        window.router = {go: (v, id) => { if (app.view !== 'detail') {app.lastView = v === 'detail' ? app.view : v; window._lastView = app.lastView; } app.view = v; if (id) app.currentId = id; renderNav(); render(); } };
        window.loadMore = () => {
            const scrollEl = document.getElementById('content') || document.scrollingElement;
                        const savedScroll = scrollEl ? scrollEl.scrollTop : 0;
                        window._pageState.page++;
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
                            open: (i, l) => {window.pl = l; window.li = i; document.getElementById('lightbox').classList.remove('hidden'); window.lb.render(); window.lb.resetZoom(); },
            close: () => {document.getElementById('lightbox').classList.add('hidden'); window.lb.resetZoom(); },
            resetZoom: () => {
                const img = document.getElementById('lb-img');
                        img.style.transform = 'scale(1)';
                        img.style.cursor = 'zoom-in';
                        img.classList.remove('zoomed');
            },
            download: () => { const p = window.pl[window.li]; const a = document.createElement('a'); a.href = p.imageSrc; a.download = p.originalName || `LumenDex_${p.id}.jpg`; a.click(); },
            openFolder: () => {
                const p = window.pl[window.li];
                        if (!p || !p.filePath) {alert("Chemin du fichier non trouvé."); return; }
                        shell.showItemInFolder(p.filePath);
            },
            toggleZoom: (e) => {
                const img = document.getElementById('lb-img');
                        const isZoomed = img.classList.contains('zoomed');
                        if (isZoomed) {
                            img.style.transform = 'scale(1)';
                        img.style.cursor = 'zoom-in';
                        img.classList.remove('zoomed');
                } else {
                    const rect = img.getBoundingClientRect();
                        const x = (e.clientX - rect.left) / rect.width * 100;
                        const y = (e.clientY - rect.top) / rect.height * 100;
                        img.style.transformOrigin = `${x}% ${y}%`;
                        img.style.transform = 'scale(2.5)';
                        img.style.cursor = 'zoom-out';
                        img.classList.add('zoomed');
                }
            },
            // V28: INTERACTIVE RATING
            setRating: async (r, event) => {
                if (event) {
                            event.target.classList.add('star-pop');
                    setTimeout(() => event.target.classList.remove('star-pop'), 300);
                }
                        const p = window.pl[window.li];
                        const oldId = p.id;
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
            },
            render: () => {
                const p = window.pl[window.li]; const a = DB.find(x => x.id === p.animalId) || {name: '?', tips: '' };
                        document.getElementById('lb-img').src = p.imageSrc;

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
                document.getElementById('lb-stars').innerHTML = [1, 2, 3, 4, 5].map(s => `
                        <i onclick="window.lb.setRating(${s}, event)" class="ph-fill ${s <= p.rating ? 'ph-star text-brand-gold' : 'ph-star text-white/20'} hover:text-white transition-all cursor-pointer transform hover:scale-125"></i>
                        `).join('');

                        // V28: Tips removed from Lightbox (Moved to Detail Page)
                        const existingTips = document.getElementById('lb-tips');
                        if (existingTips) existingTips.remove();

                        document.getElementById('lb-counter').innerText = `${window.li + 1} / ${window.pl.length}`;
                        const btn = document.getElementById('lb-fav-btn'); btn.className = p.isFav ? 'text-2xl text-red-500 transition-all' : 'text-2xl text-gray-500 hover:text-red-500 transition-all';
                        const e = p.exif || {model: 'Inconnu', settings: '' };
                        document.getElementById('lb-exif').innerHTML = `<span><i class="ph-bold ph-camera"></i> ${e.model || 'Inconnu'}</span> <span class="text-white/30">|</span> <span>${e.settings || 'Pas de données optiques'}</span> <span class="text-white/30">|</span> <span>${p.originalName || 'Inconnu'}</span>`;
            },
            next: () => { if (window.li < window.pl.length - 1) {window.li++; window.lb.render(); window.lb.resetZoom(); } }, prev: () => { if (window.li > 0) {window.li--; window.lb.render(); window.lb.resetZoom(); } },
        };

        window.toggleGridFav = async (e, id) => {
                            e.stopPropagation();
                        const btn = e.currentTarget;
                        const p = await db.obs.get(id);
                        if (p) {
                const newFav = !p.isFav;

                        // Surgical Update if not in 'favs' view (where we need full refresh to remove item)
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

                            // Immediate movement for always-visible UI
                            ui.syncPill('mode-pill', 'btn-mode-' + app.mode, 'active-pill-text');
                        renderNav();

            // Conditional UI needs to be visible before syncing
            requestAnimationFrame(() => {
                            ui.syncPill('filter-pill', 'f-btn-' + app.filter, 'active-accent-text');
                        ui.syncPill('dex-sort-pill', 'btn-dex-' + app.pokedexSort, 'active-accent-text');
                        ui.syncPill('gal-sort-pill', 'btn-sort-' + app.sort, 'active-accent-text');
            });


    });
};


                        const tgl = document.getElementById('toggle-unlocked');
                        tgl.className = `w-8 h-4 rounded-full relative transition-colors duration-200 ${app.onlyUnlocked ? 'bg-brand-accent' : 'bg-gray-600'}`;
                        tgl.children[0].className = `absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${app.onlyUnlocked ? 'translate-x-4' : 'translate-x-0'}`;

                        const covers = new Map();
            obs.forEach(o => {
                if (o.isCover) covers.set(o.animalId, o);
            });


    });
};


            // Dynamic list based on Category AND Sidebar Mode
            let totalList = app.filter === 'all' ? DB : DB.filter(x => x.type === app.filter);


            const discoveredIds = new Set(obs.filter(o => (app.mode === 'normal' || (o.tags || []).includes(app.mode === 'zoo' ? 'Zoo' : 'Sauvage'))).map(o => o.animalId));

                        // Calculate photo counts for sorting
                        const photoCounts = new Map();
            obs.forEach(o => {
                const c = photoCounts.get(o.animalId) || 0;
                        photoCounts.set(o.animalId, c + 1);
            });


    });
};

            const countDiscovered = totalList.filter(x => discoveredIds.has(x.id)).length;

                        document.getElementById('stats-txt').innerText = `${countDiscovered} / ${totalList.length}`;
                        document.getElementById('stats-bar').style.width = `${(countDiscovered / totalList.length) * 100}%`;

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

            const renderInChunks = (container, htmlChunks, chunkSize = 100) => {
                            let index = 0;
                const nextChunk = () => {
                    if (currentRenderToken !== window._renderToken) return; // Cancelled
                        const fragment = document.createRange().createContextualFragment(htmlChunks.slice(index, index + chunkSize).join(''));
                        container.appendChild(fragment);
                        index += chunkSize;
                        if (index < htmlChunks.length) requestAnimationFrame(nextChunk);
                };
                        requestAnimationFrame(nextChunk);
            };

                        // Basic cache for sorted data
                        if (!window._sortCache) window._sortCache = {key: '', data: [] };
            const getSortedData = (list, sortKey, sortDir) => {
                // Invalidate cache if counts changed (simplified by effectively disabling cache for 'photos' sort or just including a hash of counts in key? For now, let's just use list length as proxy or assume re-render handles it)
                const cacheKey = `${sortKey}-${sortDir}-${list.length}-${app.filter}-${app.mode}-${app.onlyUnlocked}-${app.searchQuery}-${obs.length}`; // Added obs.length to invalidate on new photos
                        if (window._sortCache.key === cacheKey) return window._sortCache.data;

                        const sorted = [...list];
                sorted.sort((a, b) => {
                    // Arrow DOWN (desc) = Smallest First (1, 5, 10...)
                    // Arrow UP (asc) = Largest First (100, 50, 1...)
                    // Following user request: flèche vers le bas = du plus petit au plus grand
                    const dir = (sortDir === 'desc') ? 1 : -1;
                        if (sortKey === 'num') {
                        const nA = parseInt(a.num.replace('#', '')) || 0;
                        const nB = parseInt(b.num.replace('#', '')) || 0;
                        return (nA - nB) * dir;
                    }
                        if (sortKey === 'name') return a.name.localeCompare(b.name) * dir;
                        if (sortKey === 'weight') return (parseWeight(a.stats.weight) - parseWeight(b.stats.weight)) * dir;
                        if (sortKey === 'size') return (parseSize(a.stats.size) - parseSize(b.stats.size)) * dir;
                        if (sortKey === 'rarity') return (a.stats.rarity - b.stats.rarity) * dir;
                        if (sortKey === 'photos') return ((photoCounts.get(a.id) || 0) - (photoCounts.get(b.id) || 0)) * dir;
                        return 0;
                });


    });
};


                        window._sortCache = {key: cacheKey, data: sorted };
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
                        const isNewContext = !window._pageState || window._pageState.key !== listKey || window._lastRenderedView !== 'index';
                        window._lastRenderedView = 'index';
                        if (isNewContext) {
                            window._pageState = { key: listKey, page: 1, rendered: 0 };
                }

                        const alreadyRendered = window._pageState.rendered;
                        const upTo = window._pageState.page * PAGE_SIZE;
                        const newItems = l.slice(alreadyRendered, upTo);
                        const hasMore = upTo < l.length;

                        // Only rebuild the DOM on fresh context — otherwise just append
                        let grid;
                        if (isNewContext) {
                            c.innerHTML = '<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"></div><div id="load-more-wrapper" class="flex justify-center py-8 pb-20"></div>';
                }
                        grid = c.querySelector('.grid');

                const makeCard = (a, idx) => {
                    const discovered = u.has(a.id);
                        const coverObs = covers.get(a.id);
                        const imgSrc = coverObs ? (coverObs.thumbnailSrc || coverObs.imageSrc) : a.imgRef;
                        const objPos = (coverObs || !a.objectPosition) ? '' : `style="object-position: ${a.objectPosition}"`;
                        const stars = '★'.repeat(a.stats.rarity) + '☆'.repeat(Math.max(0, 5 - a.stats.rarity));
                        return `<div onclick="window.handleCardClick(event, '${a.id}')" oncontextmenu="window.ui.showMenu(event, null, '${a.id}')"
                            data-animal-id="${a.id}"
                            class="aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden relative cursor-pointer border ${discovered ? 'border-brand-accent' : 'border-white/5'} card-hover animate-reveal"
                            style="animation-delay: ${idx % 8 * 40}ms">
                            <img src="${imgSrc}" ${objPos} onerror="window.ui.handleImgError(this)" loading="lazy" class="img-fit ${discovered ? '' : 'grayscale opacity-50'}">
                                <div class="absolute top-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-brand-gold font-bold">R${a.stats.rarity}</div>
                                <div class="absolute bottom-0 inset-x-0 p-2 text-xs font-bold text-white bg-black/50 truncate">${a.name}</div>
                        </div>`;
                };

                const htmlChunks = newItems.map((a, i) => makeCard(a, alreadyRendered + i));
                        renderInChunks(grid, htmlChunks);
                        window._pageState.rendered = upTo;

                        // Load more button — always in its own div outside the grid
                        const wrapper = document.getElementById('load-more-wrapper');
                        if (wrapper) {
                            wrapper.innerHTML = hasMore
                                ? `<button onclick="window.loadMore()" class="bg-white/10 hover:bg-white/20 transition-colors text-white font-bold px-8 py-3 rounded-full text-sm">
                            Charger plus (${upTo} / ${l.length})
                           </button>`
                                : '';
                }

            } else if (app.view === 'detail') {
                            window._lastRenderedView = 'detail';
                const a = DB.find(x => x.id === app.currentId);
                        const isSameView = document.getElementById('detail-content-id') && document.getElementById('detail-content-id').dataset.id === app.currentId;

                        let photos = await db.obs.where('animalId').equals(app.currentId).reverse().sortBy('date');
                const has = photos.length > 0;

                if (app.detailSort === 'rating') photos.sort((a, b) => b.rating - a.rating);
                else photos.sort((a, b) => new Date(b.date) - new Date(a.date));
                        if (app.sortDir === 'asc') photos.reverse();
                        window.currentPhotos = photos;

                        const gridHtml = has ?
                        `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 pt-4">
                            ${photos.map((p, i) => `<div onclick="window.lb.open(${i},window.currentPhotos)" oncontextmenu="window.ui.showMenu(event, ${p.id})" class="aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer relative group card-hover">
                             <img src="${p.thumbnailSrc || p.imageSrc}" class="img-fit">
                             <div class="absolute bottom-1 right-1 bg-black/80 rounded px-1 text-[10px] text-brand-gold font-bold">★ ${p.rating}</div>
                             <div onclick="window.toggleGridFav(event, ${p.id})" class="absolute top-1 left-1 p-1 rounded-full hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100 ${p.isFav ? 'text-red-500 opacity-100' : 'text-white/30 hover:text-white'}">
                                 <i class="ph-fill ph-heart text-lg"></i>
                             </div>
                         </div>`).join('')}
                        </div>`
                        :
                        `<div class="h-40 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-gray-600"><i class="ph ph-camera text-3xl mb-2"></i><p>Aucune photo pour le moment. gros looser.</p><button onclick="ui.openImporter()" class="text-brand-accent font-bold text-sm mt-2 hover:underline">Importer maintenant</button></div>`;

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
                        if (btn) btn.className = `relative z-10 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${app.detailSort === t ? 'text-white' : 'text-gray-400'}`;
                    });


    });
};


                } else {
                            // Full Render
                            document.getElementById('page-title').innerText = a.name;
                        c.innerHTML = `
                        <div id="detail-content-id" data-id="${a.id}" class="max-w-6xl mx-auto pb-24 space-y-8">
                            <button onclick="window.router.go(window._lastView || 'index')" class="text-xs font-bold text-gray-400 hover:text-white uppercase flex items-center gap-2"><i class="ph-bold ph-arrow-left"></i> Retour</button>
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
                                        <div><h1 class="text-4xl font-extrabold flex items-center gap-3">${a.name} <button onclick="playAudio('${a.id}')" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-brand-accent hover:bg-white/10 hover:scale-110 transition-all"><i class="ph-fill ph-speaker-high text-xl"></i></button></h1></div>
                                        <div class="flex items-center gap-2">
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
                                <h3 class="text-xl font-bold flex items-center gap-3">Mes Photos <span class="text-sm bg-white/10 px-2 rounded-full text-gray-400">${photos.length}</span></h3>
                                <div class="flex gap-2 items-center">
                                    <div class="relative bg-white/5 rounded-full p-1 flex items-center">
                                        <div id="detail-pill" class="pill-bg bg-white/10"></div>
                                        <button id="detail-sort-date" onclick="window.sortDetail('date')" class="relative z-10 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${app.detailSort === 'date' ? 'text-white' : 'text-gray-400'}">Date</button>
                                        <button id="detail-sort-rating" onclick="window.sortDetail('rating')" class="relative z-10 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${app.detailSort === 'rating' ? 'text-white' : 'text-gray-400'}">Note</button>
                                    </div>
                                    <button onclick="window.toggleSortDir()" class="ml-2 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-95" title="Inverser le tri">
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

                // Logic Calculation (Filter by Mode)
                const filteredObs = obs.filter(o => (app.mode === 'normal' || (o.tags || []).includes(app.mode === 'zoo' ? 'Zoo' : 'Sauvage')));

                        const typeCount = { }; // {mammal: 10, bird: 5 } (photos count)
                        const typeUnique = { }; // {mammal: Set(ids) } (unique animals)
                        const animalCount = { }; // {dex_1: 5 }

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


    });
};


                        const badges = [];
                const types = [...new Set(DB.map(x => x.type))];
                        const typeNames = {mammal: 'Mammifères', bird: 'Oiseaux', exotic: 'Exotiques', aquatic: 'Aquatiques', insect: 'Insectes', reptile: 'Reptiles', amphibian: 'Amphibiens' };

                        // 1. Completionist (Unique Animals Count: 5, 10, 25, then 100%)
                        const tiersExpl = [
                        {t: 0, l: 'Novice', c: 'text-gray-600' },
                        {t: 5, l: 'Bronze', c: 'text-orange-700' },
                        {t: 10, l: 'Argent', c: 'text-gray-300' },
                        {t: 25, l: 'Or', c: 'text-yellow-400' },
                        {t: 'ALL', l: 'Diamant', c: 'text-cyan-400' } // Special tag for 100%
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
                        subtitle: currentTier.t === 0 ? 'Non classé' : currentTier.l,
                        desc: isMax ? `Vous avez photographié toutes les espèces !` : `Trouvez ${target} espèces de ${label} pour le rang ${nextTier.l}.`,
                        icon: 'ph-compass',
                        color: currentTier.c,
                        progress: found,
                        target: target,
                        unlocked: currentTier.t !== 0 || isMax
                    });


    });
};

                });


    });
};


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
};

                });


    });
};

                        */

                // Sort: Unlocked first, then by progress ratio
                badges.sort((a, b) => {
                    if (a.unlocked !== b.unlocked) return b.unlocked - a.unlocked;
                        return (b.progress / b.target) - (a.progress / a.target);
                });


    });
};


                const htmlChunks = badges.map((b, i) => `
                        <div class="bg-gray-900 border ${b.unlocked ? 'border-brand-accent/50 box-shadow-brand' : 'border-white/5'} rounded-xl p-4 flex items-center gap-4 relative overflow-hidden group transition-all hover:bg-white/5">
                            <div class="w-14 h-14 rounded-full ${b.unlocked ? 'bg-white/10' : 'bg-black/50'} flex items-center justify-center shrink-0 border border-white/5 relative">
                                ${b.unlocked ? `<div class="absolute inset-0 rounded-full bg-current opacity-10 ${b.color}"></div>` : ''}
                                <i class="ph-fill ${b.icon} text-3xl ${b.unlocked ? b.color : 'text-gray-700'}"></i>
                            </div>
                            <div class="flex-1 z-10">
                                <div class="flex justify-between items-start">
                                    <h4 class="font-bold text-sm ${b.unlocked ? 'text-white' : 'text-gray-500'}">${b.title}</h4>
                                    <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/10 ${b.unlocked ? b.color : 'text-gray-600'}">${b.subtitle}</span>
                                </div>
                                <p class="text-[10px] text-gray-400 mb-2 mt-1">${b.desc}</p>
                                <div class="h-1.5 w-full bg-black rounded-full overflow-hidden border border-white/5">
                                    <div class="h-full ${b.unlocked ? 'bg-brand-accent' : 'bg-gray-700'}" style="width: ${Math.min(100, (b.progress / b.target) * 100)}%"></div>
                                </div>
                                <div class="text-[10px] text-right mt-1 text-gray-500 font-mono">${b.progress} / ${b.target}</div>
                            </div>
                            ${b.unlocked ? '<div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-shine"></div>' : ''}
                        </div>
                        `);

                        if (badges.length === 0) {
                            grid.innerHTML = '<div class="col-span-3 text-center text-gray-500 py-20">Commencez à prendre des photos pour débloquer des badges !</div>';
                } else {
                            renderInChunks(grid, htmlChunks);
                }

            } else {
                            window._lastRenderedView = app.view;
                        const title = app.view === 'favs' ? 'Favoris' : 'Galerie';
                        let photos = await db.obs.toArray();
                if (app.mode === 'zoo') photos = photos.filter(p => (p.tags || []).includes('Zoo'));
                else if (app.mode === 'sauvage') photos = photos.filter(p => (p.tags || []).includes('Sauvage'));
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


    });
};

                }
                        document.getElementById('page-title').innerHTML = `${title} <span class="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-gray-400 ml-2 font-bold uppercase tracking-wider">${photos.length} photo${photos.length > 1 ? 's' : ''}</span>`;
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
                        const g = { }; photos.forEach(p => { const k = new Date(p.date).toLocaleDateString('fr-FR', {month: 'long', year: 'numeric' }); const K = k.charAt(0).toUpperCase() + k.slice(1); if (!g[K]) g[K] = []; g[K].push(p) });
                        c.innerHTML = '<div class="space-y-6 pb-24"></div>';
                        const container = c.querySelector('.space-y-6');

                        let globalIdx = 0;
                        for (const [mKey, lPhotos] of Object.entries(g)) {
                        const monthWrapper = document.createElement('div');
                        monthWrapper.innerHTML = `<div><h3 class="text-lg font-bold mb-2 sticky top-0 py-2 bg-[#0f0f11]/95 z-10 text-gray-400 border-b border-white/5 flex items-center gap-2"><span>${mKey}</span> <span class="text-[10px] bg-white/5 px-2 rounded-full font-bold uppercase tracking-wider opacity-50">${lPhotos.length} photo${lPhotos.length > 1 ? 's' : ''}</span></h3><div class="grid grid-cols-5 md:grid-cols-6 gap-3"></div></div>`;
                        const content = monthWrapper.firstElementChild;
                        container.appendChild(content);
                        const grid = content.querySelector('.grid');
                        const htmlChunks = lPhotos.map(p => {
                            const div = `<div onclick="window.lb.open(${photos.indexOf(p)},window.currentPhotos)" oncontextmenu="window.ui.showMenu(event, ${p.id})" class="aspect-square bg-gray-800 rounded-lg overflow-hidden relative cursor-pointer group card-hover animate-reveal" style="animation-delay: ${globalIdx % 8 * 40}ms"><img src="${p.thumbnailSrc || p.imageSrc}" loading="lazy" class="img-fit"><div class="absolute bottom-1 right-1 bg-black/80 rounded px-1 text-[10px] text-brand-gold font-bold">★ ${p.rating}</div><div onclick="window.toggleGridFav(event, ${p.id})" class="absolute top-1 left-1 p-1 rounded-full hover:bg-black/50 transition-colors ${p.isFav ? 'text-red-500' : 'text-white/30 hover:text-white'}"><i class="ph-fill ph-heart text-lg"></i></div></div>`;
                        globalIdx++;
                        return div;
                        });


    });
};

                        renderInChunks(grid, htmlChunks);
                    }
                }
            }
        }

                        // Initial Theme Load
                        const savedTheme = localStorage.getItem('pokedex-theme') || '#4FD1C5';
                        ui.updateTheme(savedTheme);
                        document.getElementById('theme-picker').value = savedTheme;


                        router.go('index');
