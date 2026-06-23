// admin.js - Lógica do painel administrativo
const API_BASE = 'http://localhost:5000/api';
let currentView = 'dashboard';

// ----- Sistema de notificações Toast -----
function showToast(message, type = 'success') {
    const colors = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        warning: 'bg-amber-500',
        info: 'bg-blue-500'
    };
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 ${colors[type]} text-white px-5 py-3 rounded-xl shadow-lg transform transition-all duration-500 translate-x-full max-w-sm flex items-center gap-3`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('translate-x-full');
        toast.classList.add('translate-x-0');
    }, 100);
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}

// ----- Modal personalizado (genérico) -----
function openModal(title, fields, onConfirm) {
    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('closeModalBtn');

    titleEl.innerText = title;
    body.innerHTML = fields.map(f => `
        <div class="mb-4">
            <label for="${f.id}" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">${f.label}</label>
            <input type="${f.type}" id="${f.id}" value="${f.value || ''}" placeholder="${f.placeholder || ''}" class="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>
    `).join('');

    modal.classList.remove('hidden');

    const cleanup = () => {
        modal.classList.add('hidden');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        closeBtn.removeEventListener('click', handleCancel);
    };

    const handleConfirm = () => {
        const values = fields.map(f => document.getElementById(f.id).value.trim());
        cleanup();
        onConfirm(values);
    };

    const handleCancel = () => cleanup();

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    closeBtn.addEventListener('click', handleCancel);
}

// ----- Modal de confirmação (para exclusões) -----
function confirmModal(message, onConfirm) {
    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const closeBtn = document.getElementById('closeModalBtn');

    titleEl.innerText = 'Confirmar';
    body.innerHTML = `<p class="text-gray-700 dark:text-gray-300">${message}</p>`;

    modal.classList.remove('hidden');

    const cleanup = () => {
        modal.classList.add('hidden');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        closeBtn.removeEventListener('click', handleCancel);
    };

    const handleConfirm = () => {
        cleanup();
        onConfirm();
    };

    const handleCancel = () => cleanup();

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    closeBtn.addEventListener('click', handleCancel);
}

// ----- Lightbox para imagens e vídeos -----
function showLightbox(url) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightboxImage');
    const videoContainer = document.getElementById('lightboxVideoContainer');
    
    img.style.display = 'none';
    videoContainer.style.display = 'none';
    videoContainer.innerHTML = '';

    const isVideo = url.match(/\.(mp4|webm|ogg|mov|avi)$/i);
    
    if (isVideo) {
        videoContainer.style.display = 'block';
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.autoplay = true;
        video.className = 'max-w-full max-h-[80vh] rounded-lg';
        videoContainer.appendChild(video);
    } else {
        img.style.display = 'block';
        img.src = url;
    }
    
    lightbox.classList.remove('hidden');
}

document.getElementById('closeLightbox')?.addEventListener('click', () => {
    document.getElementById('lightbox').classList.add('hidden');
    const video = document.querySelector('#lightboxVideoContainer video');
    if (video) video.pause();
});
document.getElementById('lightbox')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        document.getElementById('lightbox').classList.add('hidden');
        const video = document.querySelector('#lightboxVideoContainer video');
        if (video) video.pause();
    }
});

// ----- Autenticação -----
function checkAuth() {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    const userName = localStorage.getItem('admin_user') || 'Admin';
    document.getElementById('userName').innerText = userName;
    const initial = userName.charAt(0).toUpperCase();
    document.getElementById('userInitial').innerText = initial;
    return true;
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/login.html';
});

// ----- Helper para chamadas autenticadas -----
async function fetchAuth(url, options = {}) {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        window.location.href = '/login.html';
        throw new Error('Sem token');
    }
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };
    const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers
    });
    if (response.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.href = '/login.html';
        throw new Error('Sessão expirada');
    }
    return response;
}

// ----- Navegação -----
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        if (!view) return;
        currentView = view;
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('bg-indigo-50', 'dark:bg-indigo-900/30', 'text-indigo-600', 'dark:text-indigo-400'));
        item.classList.add('bg-indigo-50', 'dark:bg-indigo-900/30', 'text-indigo-600', 'dark:text-indigo-400');
        const titles = {
            dashboard: 'Dashboard',
            tvs: 'Televisões',
            media: 'Ficheiros',
            playlists: 'Playlists',
            schedule: 'Agendamentos'
        };
        document.getElementById('pageTitle').innerText = titles[view] || 'Dashboard';
        loadView(view);
    });
});

async function loadView(view) {
    const container = document.getElementById('viewContainer');
    container.innerHTML = '<div class="text-center py-12"><div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div><p class="mt-3 text-gray-500 dark:text-gray-400">Carregando...</p></div>';
    switch (view) {
        case 'dashboard': await loadDashboard(container); break;
        case 'tvs': await loadTVs(container); break;
        case 'media': await loadMedia(container); break;
        case 'playlists': await loadPlaylists(container); break;
        case 'schedule': await loadSchedule(container); break;
        default: container.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Selecione uma opção</p>';
    }
}

// ----- DASHBOARD -----
async function loadDashboard(container) {
    try {
        const [tvs, playlists, media] = await Promise.all([
            fetchAuth('/tvs').then(r => r.json()),
            fetchAuth('/playlists').then(r => r.json()),
            fetchAuth('/media').then(r => r.json())
        ]);
        const stats = [
            { label: 'Televisões', value: tvs.length, icon: 'fa-tv', color: 'indigo' },
            { label: 'Playlists', value: playlists.length, icon: 'fa-list-ul', color: 'emerald' },
            { label: 'Ficheiros', value: media.length, icon: 'fa-image', color: 'blue' }
        ];
        const cards = stats.map(s => `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition hover:shadow-md">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${s.label}</p>
                        <p class="text-3xl font-bold text-gray-800 dark:text-white mt-1">${s.value}</p>
                    </div>
                    <div class="w-12 h-12 rounded-xl bg-${s.color}-50 dark:bg-${s.color}-900/20 flex items-center justify-center text-${s.color}-500 dark:text-${s.color}-400">
                        <i class="fas ${s.icon} text-xl"></i>
                    </div>
                </div>
            </div>
        `).join('');
        container.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">${cards}</div>
            <div class="mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">Resumo</h3>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div><span class="text-gray-500 dark:text-gray-400">Total de TVs:</span> <span class="font-medium dark:text-white">${tvs.length}</span></div>
                    <div><span class="text-gray-500 dark:text-gray-400">Playlists:</span> <span class="font-medium dark:text-white">${playlists.length}</span></div>
                    <div><span class="text-gray-500 dark:text-gray-400">Ficheiros:</span> <span class="font-medium dark:text-white">${media.length}</span></div>
                </div>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<p class="text-red-500 dark:text-red-400">Erro: ${err.message}</p>`;
    }
}

// ----- TVs -----
async function loadTVs(container) {
    try {
        const tvs = await (await fetchAuth('/tvs')).json();
        let filtered = tvs;

        const searchInput = document.createElement('input');
        searchInput.placeholder = '🔍 Pesquisar televisão...';
        searchInput.className = 'w-full sm:w-64 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition';

        const renderTable = (data) => {
            const tbody = document.querySelector('#tvsTable tbody');
            if (!tbody) return;
            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-gray-500 dark:text-gray-400">Nenhuma televisão encontrada</td></tr>`;
                return;
            }
            tbody.innerHTML = data.map(tv => `
                <tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    <td class="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">#${tv.id}</td>
                    <td class="py-3 px-4 font-medium text-gray-800 dark:text-white">${tv.name}</td>
                    <td class="py-3 px-4 text-sm font-mono text-gray-600 dark:text-gray-300">${tv.codigo || '—'}</td>
                    <td class="py-3 px-4">
                        <button class="delete-tv text-red-500 hover:text-red-700 dark:hover:text-red-400 transition text-sm font-medium" data-id="${tv.id}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
            document.querySelectorAll('.delete-tv').forEach(btn => btn.addEventListener('click', () => {
                confirmModal('Tem certeza que deseja remover esta TV?', async () => {
                    await fetchAuth(`/tvs/${btn.dataset.id}`, { method: 'DELETE' });
                    showToast('TV removida com sucesso', 'success');
                    loadTVs(container);
                });
            }));
        };

        container.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white">Todas as Televisões</h3>
                <button id="addTvBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition flex items-center gap-2 text-sm font-medium">
                    <i class="fas fa-plus"></i> Adicionar
                </button>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div class="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-3">
                    <div class="flex-1 min-w-[200px]">${searchInput.outerHTML}</div>
                    <span class="text-sm text-gray-400 dark:text-gray-500">${tvs.length} televisões</span>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full" id="tvsTable">
                        <thead class="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Código</th>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        `;

        const search = document.querySelector('input[placeholder="🔍 Pesquisar televisão..."]');
        search.addEventListener('input', function() {
            const term = this.value.toLowerCase().trim();
            const filteredData = tvs.filter(tv => 
                tv.name.toLowerCase().includes(term) || 
                (tv.codigo && tv.codigo.toLowerCase().includes(term))
            );
            renderTable(filteredData);
        });

        renderTable(tvs);

        document.getElementById('addTvBtn')?.addEventListener('click', () => {
            openModal('Nova Televisão', [
                { label: 'Nome', id: 'tvName', type: 'text', placeholder: 'Nome da TV' },
                { label: 'Código (opcional)', id: 'tvCodigo', type: 'text', placeholder: '1234' }
            ], async (values) => {
                const [name, codigo] = values;
                if (!name) return showToast('Nome obrigatório', 'warning');
                await fetchAuth('/tvs', {
                    method: 'POST',
                    body: JSON.stringify({ name, codigo: codigo || undefined })
                });
                showToast('TV adicionada com sucesso', 'success');
                loadTVs(container);
            });
        });

    } catch (err) {
        container.innerHTML = `<p class="text-red-500 dark:text-red-400">Erro: ${err.message}</p>`;
    }
}

// ----- Mídias -----
async function loadMedia(container) {
    try {
        const media = await (await fetchAuth('/media')).json();
        container.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white">Ficheiros</h3>
                <label class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <i class="fas fa-upload"></i> Upload
                    <input type="file" id="mediaUpload" multiple accept="image/*,video/*" class="hidden">
                </label>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ficheiro</th>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pré-visualização</th>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${media.map(m => {
                                const isVideo = m.mime_type && m.mime_type.startsWith('video/');
                                return `
                                <tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                                    <td class="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">#${m.id}</td>
                                    <td class="py-3 px-4 text-sm font-medium text-gray-800 dark:text-white">${m.filename}</td>
                                    <td class="py-3 px-4">
                                        ${isVideo ? 
                                            `<div class="w-24 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center cursor-pointer hover:opacity-80 transition" onclick="showLightbox('${m.url}')">
                                                <i class="fas fa-play-circle text-4xl text-indigo-500 dark:text-indigo-400"></i>
                                            </div>` :
                                            `<img src="${m.url}" alt="${m.filename}" class="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition" onclick="showLightbox('${m.url}')">`
                                        }
                                    </td>
                                    <td class="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">${m.mime_type}</td>
                                    <td class="py-3 px-4">
                                        <button class="delete-media text-red-500 hover:text-red-700 dark:hover:text-red-400 transition" data-id="${m.id}">
                                            <i class="fas fa-trash-alt"></i>
                                        </button>
                                    </td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('mediaUpload')?.addEventListener('change', async function() {
            const files = this.files;
            if (!files.length) return;
            const fd = new FormData();
            for (let f of files) fd.append('file', f);
            const token = localStorage.getItem('admin_token');
            try {
                const resp = await fetch(`${API_BASE}/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: fd
                });
                if (resp.ok) {
                    showToast('Upload concluído com sucesso', 'success');
                    loadMedia(container);
                } else {
                    showToast('Erro no upload', 'error');
                }
            } catch (e) {
                showToast('Erro de conexão', 'error');
            }
            this.value = '';
        });

        document.querySelectorAll('.delete-media').forEach(btn => btn.addEventListener('click', () => {
            confirmModal('Tem a certeza que deseja remover este ficheiro?', async () => {
                await fetchAuth(`/media/${btn.dataset.id}`, { method: 'DELETE' });
                showToast('Ficheiro removido', 'success');
                loadMedia(container);
            });
        }));

    } catch (err) {
        container.innerHTML = `<p class="text-red-500 dark:text-red-400">Erro: ${err.message}</p>`;
    }
}

// ----- Playlists -----
async function loadPlaylists(container) {
    try {
        const [playlists, media] = await Promise.all([
            fetchAuth('/playlists').then(r => r.json()),
            fetchAuth('/media').then(r => r.json())
        ]);
        let html = `
            <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white">Playlists</h3>
                <button id="createPlaylistBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition flex items-center gap-2 text-sm font-medium">
                    <i class="fas fa-plus"></i> Nova Playlist
                </button>
            </div>
            <div class="space-y-4">
        `;
        for (let p of playlists) {
            const items = p.items || [];
            html += `
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                    <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <h4 class="font-semibold text-gray-800 dark:text-white">${p.name}</h4>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-400 dark:text-gray-500">${items.length} itens</span>
                            <button class="delete-playlist text-red-500 hover:text-red-700 dark:hover:text-red-400 transition text-sm" data-id="${p.id}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 mb-3">
                        <select id="mediaSelect_${p.id}" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
                            <option value="">Selecione um ficheiro</option>
                            ${media.map(m => `<option value="${m.id}">${m.filename}</option>`).join('')}
                        </select>
                        <input type="number" id="duration_${p.id}" placeholder="Segundos" value="10" class="w-20 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300">
                        <button class="add-item bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-xl transition text-sm" data-id="${p.id}">Adicionar</button>
                    </div>
                    ${items.length ? `
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm">
                                <thead class="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                                    <tr><th class="text-left py-2 px-3">Ordem</th><th class="text-left py-2 px-3">Ficheiro</th><th class="text-left py-2 px-3">Duração (s)</th><th class="text-left py-2 px-3">Ação</th></tr>
                                </thead>
                                <tbody>
                                    ${items.map(item => `
                                        <tr class="border-b border-gray-50 dark:border-gray-800">
                                            <td class="py-2 px-3 text-gray-600 dark:text-gray-400">${item.display_order}</td>
                                            <td class="py-2 px-3 text-gray-700 dark:text-gray-300">${item.filename}</td>
                                            <td class="py-2 px-3">
                                                <input type="number" class="duration-input w-16 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-1 py-0.5 text-sm text-gray-700 dark:text-gray-300" value="${item.duration_seconds}" min="1" data-item="${item.id}" data-playlist="${p.id}">
                                                <button class="update-duration bg-blue-500 hover:bg-blue-600 text-white px-2 py-0.5 rounded text-xs transition ml-1" data-item="${item.id}" data-playlist="${p.id}">Atualizar</button>
                                            </td>
                                            <td class="py-2 px-3">
                                                <button class="move-up bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-xs transition mr-1" data-item="${item.id}" data-playlist="${p.id}">▲</button>
                                                <button class="move-down bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-xs transition" data-item="${item.id}" data-playlist="${p.id}">▼</button>
                                                <button class="remove-item text-red-400 hover:text-red-600 transition ml-1" data-item="${item.id}"><i class="fas fa-times"></i></button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p class="text-sm text-gray-400 dark:text-gray-500">Nenhum item nesta playlist</p>'}
                </div>
            `;
        }
        html += `</div>`;
        container.innerHTML = html;

        document.getElementById('createPlaylistBtn')?.addEventListener('click', () => {
            openModal('Nova Playlist', [
                { label: 'Nome', id: 'playlistName', type: 'text', placeholder: 'Nome da playlist' }
            ], async (values) => {
                const [name] = values;
                if (!name) return showToast('Nome obrigatório', 'warning');
                await fetchAuth('/playlists', { method: 'POST', body: JSON.stringify({ name }) });
                showToast('Playlist criada', 'success');
                loadPlaylists(container);
            });
        });

        document.querySelectorAll('.add-item').forEach(btn => btn.addEventListener('click', async () => {
            const pid = btn.dataset.id;
            const mid = document.getElementById(`mediaSelect_${pid}`).value;
            const dur = document.getElementById(`duration_${pid}`).value;
            if (!mid) return showToast('Selecione um ficheiro', 'warning');
            await fetchAuth(`/playlists/${pid}/items`, {
                method: 'POST',
                body: JSON.stringify({ media_id: parseInt(mid), duration: parseInt(dur) })
            });
            showToast('Item adicionado', 'success');
            loadPlaylists(container);
        }));

        document.querySelectorAll('.update-duration').forEach(btn => {
            btn.addEventListener('click', async function() {
                const itemId = this.dataset.item;
                const playlistId = this.dataset.playlist;
                const input = document.querySelector(`.duration-input[data-item="${itemId}"]`);
                const duration = parseInt(input.value);
                
                if (!duration || duration < 1) {
                    showToast('Duração inválida (mínimo 1 segundo)', 'warning');
                    return;
                }
                
                try {
                    await fetchAuth(`/playlists/${playlistId}/items/${itemId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ duration: duration })
                    });
                    showToast('Duração atualizada!', 'success');
                    loadPlaylists(container);
                } catch (err) {
                    showToast('Erro ao atualizar', 'error');
                }
            });
        });

        document.querySelectorAll('.remove-item').forEach(btn => btn.addEventListener('click', () => {
            const pid = btn.closest('.border')?.querySelector('.delete-playlist')?.dataset.id;
            confirmModal('Remover este item?', async () => {
                await fetchAuth(`/playlists/${pid}/items/${btn.dataset.item}`, { method: 'DELETE' });
                showToast('Item removido', 'success');
                loadPlaylists(container);
            });
        }));

        document.querySelectorAll('.move-up').forEach(btn => {
            btn.addEventListener('click', async function() {
                const itemId = parseInt(this.dataset.item);
                const playlistId = parseInt(this.dataset.playlist);
                
                const playlist = await (await fetchAuth(`/playlists/${playlistId}`)).json();
                const items = playlist.items || [];
                const currentIndex = items.findIndex(item => item.id === itemId);
                
                if (currentIndex <= 0) {
                    showToast('Já está no topo', 'warning');
                    return;
                }
                
                const newOrder = items.map(item => item.id);
                [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
                
                await fetchAuth(`/playlists/${playlistId}/items/reorder`, {
                    method: 'POST',
                    body: JSON.stringify({ item_ids: newOrder })
                });
                showToast('Item movido para cima', 'success');
                loadPlaylists(container);
            });
        });

        document.querySelectorAll('.move-down').forEach(btn => {
            btn.addEventListener('click', async function() {
                const itemId = parseInt(this.dataset.item);
                const playlistId = parseInt(this.dataset.playlist);
                
                const playlist = await (await fetchAuth(`/playlists/${playlistId}`)).json();
                const items = playlist.items || [];
                const currentIndex = items.findIndex(item => item.id === itemId);
                
                if (currentIndex === -1 || currentIndex >= items.length - 1) {
                    showToast('Já está no fundo', 'warning');
                    return;
                }
                
                const newOrder = items.map(item => item.id);
                [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
                
                await fetchAuth(`/playlists/${playlistId}/items/reorder`, {
                    method: 'POST',
                    body: JSON.stringify({ item_ids: newOrder })
                });
                showToast('Item movido para baixo', 'success');
                loadPlaylists(container);
            });
        });

        document.querySelectorAll('.delete-playlist').forEach(btn => btn.addEventListener('click', () => {
            confirmModal('Remover esta playlist?', async () => {
                await fetchAuth(`/playlists/${btn.dataset.id}`, { method: 'DELETE' });
                showToast('Playlist removida', 'success');
                loadPlaylists(container);
            });
        }));

    } catch (err) {
        container.innerHTML = `<p class="text-red-500 dark:text-red-400">Erro: ${err.message}</p>`;
    }
}

// ----- AGENDAMENTOS (NOVA SECÇÃO) -----
async function loadSchedule(container) {
    try {
        const [tvs, playlists, schedules] = await Promise.all([
            fetchAuth('/tvs').then(r => r.json()),
            fetchAuth('/playlists').then(r => r.json()),
            fetchAuth('/schedule').then(r => r.json())
        ]);

        const daysOfWeek = [
            { value: 'MON', label: 'Segunda-feira' },
            { value: 'TUE', label: 'Terça-feira' },
            { value: 'WED', label: 'Quarta-feira' },
            { value: 'THU', label: 'Quinta-feira' },
            { value: 'FRI', label: 'Sexta-feira' },
            { value: 'SAT', label: 'Sábado' },
            { value: 'SUN', label: 'Domingo' }
        ];

        const daysOptions = daysOfWeek.map(d => 
            `<option value="${d.value}">${d.label}</option>`
        ).join('');

        const tvsOptions = tvs.map(tv => 
            `<option value="${tv.codigo}">${tv.name} (${tv.codigo})</option>`
        ).join('');

        const playlistsOptions = playlists.map(p => 
            `<option value="${p.id}">${p.name}</option>`
        ).join('');

        container.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white">Agendamentos</h3>
                <button id="addScheduleBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition flex items-center gap-2 text-sm font-medium">
                    <i class="fas fa-plus"></i> Novo Agendamento
                </button>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">TV</th>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Playlist</th>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dia</th>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Início</th>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fim</th>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ativo</th>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${schedules.map(s => `
                                <tr class="border-b border-gray-100 dark:border-gray-700">
                                    <td class="py-3 px-4 text-gray-700 dark:text-gray-300">${s.child_site_name}</td>
                                    <td class="py-3 px-4 text-gray-700 dark:text-gray-300">${s.playlist_name}</td>
                                    <td class="py-3 px-4 text-gray-700 dark:text-gray-300">${daysOfWeek.find(d => d.value === s.day_of_week)?.label || s.day_of_week}</td>
                                    <td class="py-3 px-4 text-gray-700 dark:text-gray-300">${s.start_time}</td>
                                    <td class="py-3 px-4 text-gray-700 dark:text-gray-300">${s.end_time || '—'}</td>
                                    <td class="py-3 px-4">
                                        <span class="px-2 py-1 text-xs rounded-full ${s.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                                            ${s.active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td class="py-3 px-4">
                                        <button class="delete-schedule text-red-500 hover:text-red-700 dark:hover:text-red-400 transition" data-id="${s.id}">
                                            <i class="fas fa-trash-alt"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                            ${schedules.length === 0 ? `
                                <tr>
                                    <td colspan="7" class="text-center py-8 text-gray-500 dark:text-gray-400">Nenhum agendamento encontrado</td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Modal para criar agendamento
        document.getElementById('addScheduleBtn')?.addEventListener('click', () => {
            openModal('Novo Agendamento', [
                { label: 'TV', id: 'scheduleTV', type: 'select', options: tvsOptions },
                { label: 'Playlist', id: 'schedulePlaylist', type: 'select', options: playlistsOptions },
                { label: 'Dia da Semana', id: 'scheduleDay', type: 'select', options: daysOptions },
                { label: 'Hora de Início (HH:MM)', id: 'scheduleStart', type: 'text', placeholder: '09:00' },
                { label: 'Hora de Fim (HH:MM, opcional)', id: 'scheduleEnd', type: 'text', placeholder: '18:00' }
            ], async (values) => {
                const [child_site_codigo, playlist_id, day_of_week, start_time, end_time] = values;
                
                if (!child_site_codigo || !playlist_id || !day_of_week || !start_time) {
                    showToast('Preencha todos os campos obrigatórios', 'warning');
                    return;
                }

                try {
                    await fetchAuth('/schedule', {
                        method: 'POST',
                        body: JSON.stringify({
                            child_site_codigo,
                            playlist_id: parseInt(playlist_id),
                            day_of_week,
                            start_time,
                            end_time: end_time || null
                        })
                    });
                    showToast('Agendamento criado com sucesso!', 'success');
                    loadSchedule(container);
                } catch (err) {
                    showToast('Erro ao criar agendamento', 'error');
                }
            });
        });

        // Apagar agendamento
        document.querySelectorAll('.delete-schedule').forEach(btn => {
            btn.addEventListener('click', () => {
                const scheduleId = btn.dataset.id;
                confirmModal('Remover este agendamento?', async () => {
                    await fetchAuth(`/schedule/${scheduleId}`, { method: 'DELETE' });
                    showToast('Agendamento removido', 'success');
                    loadSchedule(container);
                });
            });
        });

    } catch (err) {
        container.innerHTML = `<p class="text-red-500 dark:text-red-400">Erro: ${err.message}</p>`;
    }
}

// ----- Atribuições -----
async function loadAssign(container) {
    try {
        const [tvs, playlists, assignments] = await Promise.all([
            fetchAuth('/tvs').then(r => r.json()),
            fetchAuth('/playlists').then(r => r.json()),
            fetchAuth('/assign').then(r => r.json())
        ]);
        container.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Atribuir Playlist a TV (Fallback)</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Esta atribuição é usada quando não há agendamento ativo para a TV.</p>
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mb-6">
                <div class="flex flex-wrap items-end gap-4">
                    <div>
                        <label class="block text-sm text-gray-500 dark:text-gray-400 mb-1">TV</label>
                        <select id="assignTV" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-700 dark:text-gray-300">
                            ${tvs.map(tv => `<option value="${tv.codigo}">${tv.name}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm text-gray-500 dark:text-gray-400 mb-1">Playlist</label>
                        <select id="assignPlaylist" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-700 dark:text-gray-300">
                            ${playlists.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                        </select>
                    </div>
                    <button id="assignBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl transition">Atribuir</button>
                </div>
            </div>
            <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-3">Atribuições Atuais</h4>
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">TV</th>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Playlist</th>
                                <th class="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Atribuída em</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${assignments.map(a => `
                                <tr class="border-b border-gray-100 dark:border-gray-700">
                                    <td class="py-3 px-4 text-gray-700 dark:text-gray-300">${a.child_site_name}</td>
                                    <td class="py-3 px-4 text-gray-700 dark:text-gray-300">${a.playlist_name}</td>
                                    <td class="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">${new Date(a.assigned_at).toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        document.getElementById('assignBtn')?.addEventListener('click', async () => {
            const codigo = document.getElementById('assignTV').value;
            const playlist_id = document.getElementById('assignPlaylist').value;
            if (!codigo || !playlist_id) return showToast('Selecione ambos', 'warning');
            
            const token = localStorage.getItem('admin_token');
            if (!token) {
                showToast('Sessão expirada. Faça login novamente.', 'error');
                window.location.href = '/login.html';
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE}/assign`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ child_site_codigo: codigo, playlist_id: parseInt(playlist_id) })
                });
                
                if (response.status === 401) {
                    localStorage.removeItem('admin_token');
                    localStorage.removeItem('admin_user');
                    window.location.href = '/login.html';
                    return;
                }
                
                const data = await response.json();
                if (response.ok) {
                    showToast('Atribuído com sucesso', 'success');
                    loadAssign(container);
                } else {
                    showToast(data.error || 'Erro ao atribuir', 'error');
                }
            } catch (err) {
                showToast('Erro de conexão', 'error');
            }
        });
    } catch (err) {
        container.innerHTML = `<p class="text-red-500 dark:text-red-400">Erro: ${err.message}</p>`;
    }
}

// Iniciar
if (checkAuth()) loadView('dashboard');