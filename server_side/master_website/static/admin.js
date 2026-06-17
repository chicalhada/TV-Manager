// admin.js - Lógica do painel administrativo
const API_BASE = 'http://localhost:5000/api';
let currentView = 'dashboard';

// ----- Autenticação -----
function checkAuth() {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    const userName = localStorage.getItem('admin_user') || 'Admin';
    document.getElementById('userName').innerText = userName;
    return true;
}

// Logout
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
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('bg-indigo-700'));
        item.classList.add('bg-indigo-700');
        loadView(view);
    });
});

async function loadView(view) {
    const container = document.getElementById('viewContainer');
    container.innerHTML = '<div class="text-center py-10">Carregando...</div>';
    switch (view) {
        case 'dashboard': await loadDashboard(container); break;
        case 'tvs': await loadTVs(container); break;
        case 'media': await loadMedia(container); break;
        case 'playlists': await loadPlaylists(container); break;
        case 'assign': await loadAssign(container); break;
        case 'users': await loadUsers(container); break;
        default: container.innerHTML = '<p>Selecione uma opção</p>';
    }
}

// ----- DASHBOARD -----
async function loadDashboard(container) {
    try {
        const tvs = await (await fetchAuth('/tvs')).json();
        const playlists = await (await fetchAuth('/playlists')).json();
        const media = await (await fetchAuth('/media')).json();
        const totalTVs = tvs.length;
        const totalPlaylists = playlists.length;
        const totalMedia = media.length;
        const firstTV = tvs[0] || { codigo: 'XXXX' };
        container.innerHTML = `
            <h2 class="text-2xl font-bold mb-6">Dashboard</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-white border rounded-xl shadow p-4 flex items-center">
                    <div class="rounded-full bg-indigo-100 p-3 mr-4"><i class="fas fa-tv text-indigo-600 text-xl"></i></div>
                    <div><p class="text-gray-500">Total TVs</p><p class="text-2xl font-bold">${totalTVs}</p></div>
                </div>
                <div class="bg-white border rounded-xl shadow p-4 flex items-center">
                    <div class="rounded-full bg-green-100 p-3 mr-4"><i class="fas fa-list text-green-600 text-xl"></i></div>
                    <div><p class="text-gray-500">Total Playlists</p><p class="text-2xl font-bold">${totalPlaylists}</p></div>
                </div>
                <div class="bg-white border rounded-xl shadow p-4 flex items-center">
                    <div class="rounded-full bg-blue-100 p-3 mr-4"><i class="fas fa-file-alt text-blue-600 text-xl"></i></div>
                    <div><p class="text-gray-500">Total Mídias</p><p class="text-2xl font-bold">${totalMedia}</p></div>
                </div>
            </div>
            <div class="bg-white border rounded-xl shadow p-4">
                <h3 class="font-semibold text-lg mb-2">TV Exemplo</h3>
                <p>Código: <strong>${firstTV.codigo}</strong></p>
                <p class="text-sm text-gray-500 mt-2">Use este código na TV para conectá-la</p>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<p class="text-red-600">Erro: ${err.message}</p>`;
    }
}

// ----- TVs -----
async function loadTVs(container) {
    try {
        const tvs = await (await fetchAuth('/tvs')).json();
        container.innerHTML = `
            <h2 class="text-2xl font-bold mb-4">Televisões</h2>
            <div class="mb-6 bg-gray-50 p-4 rounded-lg">
                <h3 class="font-semibold mb-2">Adicionar TV</h3>
                <div class="flex flex-wrap gap-2">
                    <input type="text" id="tvName" placeholder="Nome" class="border rounded px-3 py-1">
                    <input type="text" id="tvIp" placeholder="IP (opcional)" class="border rounded px-3 py-1">
                    <input type="text" id="tvCodigo" placeholder="Código (opcional)" class="border rounded px-3 py-1">
                    <button id="addTvBtn" class="bg-indigo-600 text-white px-4 py-1 rounded hover:bg-indigo-700">Adicionar</button>
                </div>
            </div>
            <div class="overflow-x-auto"><table class="min-w-full bg-white border"><thead class="bg-gray-100"><tr><th class="py-2 px-3 border">ID</th><th>Nome</th><th>IP</th><th>Código</th><th>Ações</th></tr></thead><tbody>
                ${tvs.map(tv => `<tr><td class="py-1 px-3 border">${tv.id}</td><td class="py-1 px-3 border">${tv.name}</td><td class="py-1 px-3 border">${tv.ip || '-'}</td><td class="py-1 px-3 border">${tv.codigo || '-'}</td><td class="py-1 px-3 border"><button class="delete-tv bg-red-500 text-white px-2 py-1 rounded text-sm" data-id="${tv.id}">Remover</button></td></tr>`).join('')}
            </tbody></table></div>
        `;
        document.getElementById('addTvBtn')?.addEventListener('click', async () => {
            const name = document.getElementById('tvName').value;
            if (!name) return alert('Nome obrigatório');
            const ip = document.getElementById('tvIp').value;
            const codigo = document.getElementById('tvCodigo').value;
            await fetchAuth('/tvs', {
                method: 'POST',
                body: JSON.stringify({ name, ip, codigo: codigo || undefined })
            });
            loadTVs(container);
        });
        document.querySelectorAll('.delete-tv').forEach(btn => btn.addEventListener('click', async () => {
            if (confirm('Remover TV?')) {
                await fetchAuth(`/tvs/${btn.dataset.id}`, { method: 'DELETE' });
                loadTVs(container);
            }
        }));
    } catch (err) { container.innerHTML = `<p class="text-red-600">Erro: ${err.message}</p>`; }
}

// ----- Mídias (Upload e Listagem) -----
async function loadMedia(container) {
    try {
        const media = await (await fetchAuth('/media')).json();
        container.innerHTML = `
            <h2 class="text-2xl font-bold mb-4">Mídias</h2>
            <div class="mb-6 bg-gray-50 p-4 rounded-lg">
                <h3 class="font-semibold mb-2">Upload</h3>
                <input type="file" id="mediaUpload" multiple accept="image/*,video/*" class="mb-2"><br>
                <button id="uploadBtn" class="bg-green-600 text-white px-4 py-1 rounded">Enviar</button>
            </div>
            <div class="overflow-x-auto"><table class="min-w-full bg-white border"><thead class="bg-gray-100"><tr><th>ID</th><th>Ficheiro</th><th>Tipo</th><th>URL</th><th>Ações</th></tr></thead><tbody>
                ${media.map(m => `<tr><td class="py-1 px-3 border">${m.id}</td><td class="py-1 px-3 border">${m.filename}</td><td class="py-1 px-3 border">${m.mime_type}</td><td class="py-1 px-3 border"><a href="${m.url}" target="_blank">Ver</a></td><td class="py-1 px-3 border"><button class="delete-media bg-red-500 text-white px-2 py-1 rounded" data-id="${m.id}">Remover</button></td></tr>`).join('')}
            </tbody></table></div>
        `;
        document.getElementById('uploadBtn')?.addEventListener('click', async () => {
            const files = document.getElementById('mediaUpload').files;
            if (!files.length) return;
            const fd = new FormData();
            for (let f of files) fd.append('file', f);
            const token = localStorage.getItem('admin_token');
            const resp = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: fd
            });
            if (resp.ok) { alert('Upload concluído'); loadMedia(container); }
            else alert('Erro no upload');
        });
        document.querySelectorAll('.delete-media').forEach(btn => btn.addEventListener('click', async () => {
            if (confirm('Remover?')) {
                await fetchAuth(`/media/${btn.dataset.id}`, { method: 'DELETE' });
                loadMedia(container);
            }
        }));
    } catch (err) { container.innerHTML = `<p class="text-red-600">Erro: ${err.message}</p>`; }
}

// ----- Playlists (listar, criar, adicionar itens) -----
async function loadPlaylists(container) {
    try {
        const [playlists, media] = await Promise.all([
            (await fetchAuth('/playlists')).json(),
            (await fetchAuth('/media')).json()
        ]);
        let html = `<h2 class="text-2xl font-bold mb-4">Playlists</h2>
            <div class="mb-6 bg-gray-50 p-4 rounded-lg"><h3 class="font-semibold mb-2">Nova Playlist</h3><div class="flex gap-2"><input type="text" id="playlistName" placeholder="Nome" class="border rounded px-3 py-1"><button id="createPlaylistBtn" class="bg-indigo-600 text-white px-4 py-1 rounded">Criar</button></div></div>
            <div class="space-y-6">`;
        for (let p of playlists) {
            const items = p.items || [];
            html += `<div class="border rounded-lg p-4 bg-white"><div class="flex justify-between items-center mb-3"><h3 class="text-xl font-semibold">${p.name}</h3><button class="delete-playlist bg-red-500 text-white px-3 py-1 rounded" data-id="${p.id}">Remover Playlist</button></div>
                <div class="mb-3 flex flex-wrap gap-2"><select id="mediaSelect_${p.id}" class="border rounded px-2 py-1"><option value="">Selecione</option>${media.map(m => `<option value="${m.id}">${m.filename}</option>`).join('')}</select>
                <input type="number" id="duration_${p.id}" placeholder="Duração (s)" value="10" class="border rounded px-2 py-1 w-24">
                <button class="add-item bg-green-600 text-white px-3 py-1 rounded" data-id="${p.id}">Adicionar item</button></div>
                <table class="min-w-full border text-sm"><thead class="bg-gray-100"><tr><th>Ordem</th><th>Mídia</th><th>Duração</th><th>Ação</th></tr></thead><tbody id="items_${p.id}">`;
            for (let item of items) {
                html += `<tr><td class="py-1 px-2 border">${item.display_order}</td><td class="py-1 px-2 border">${item.filename}</td><td class="py-1 px-2 border">${item.duration_seconds}s</td><td class="py-1 px-2 border"><button class="remove-item bg-red-400 text-white px-2 py-0.5 rounded" data-item="${item.id}">Remover</button></td></tr>`;
            }
            html += `</tbody></table></div>`;
        }
        html += `</div>`;
        container.innerHTML = html;
        document.getElementById('createPlaylistBtn')?.addEventListener('click', async () => {
            const name = document.getElementById('playlistName').value;
            if (!name) return alert('Nome obrigatório');
            await fetchAuth('/playlists', { method: 'POST', body: JSON.stringify({ name }) });
            loadPlaylists(container);
        });
        document.querySelectorAll('.add-item').forEach(btn => btn.addEventListener('click', async () => {
            const pid = btn.dataset.id;
            const mid = document.getElementById(`mediaSelect_${pid}`).value;
            const dur = document.getElementById(`duration_${pid}`).value;
            if (!mid) return alert('Selecione mídia');
            await fetchAuth(`/playlists/${pid}/items`, {
                method: 'POST',
                body: JSON.stringify({ media_id: parseInt(mid), duration: parseInt(dur) })
            });
            loadPlaylists(container);
        }));
        document.querySelectorAll('.remove-item').forEach(btn => btn.addEventListener('click', async () => {
            if (confirm('Remover item?')) {
                const pid = btn.closest('.border')?.querySelector('.delete-playlist')?.dataset.id;
                await fetchAuth(`/playlists/${pid}/items/${btn.dataset.item}`, { method: 'DELETE' });
                loadPlaylists(container);
            }
        }));
        document.querySelectorAll('.delete-playlist').forEach(btn => btn.addEventListener('click', async () => {
            if (confirm('Remover playlist?')) {
                await fetchAuth(`/playlists/${btn.dataset.id}`, { method: 'DELETE' });
                loadPlaylists(container);
            }
        }));
    } catch (err) { container.innerHTML = `<p class="text-red-600">Erro: ${err.message}</p>`; }
}

// ----- Atribuições (assign) -----
async function loadAssign(container) {
    try {
        const [tvs, playlists, assignments] = await Promise.all([
            (await fetchAuth('/tvs')).json(),
            (await fetchAuth('/playlists')).json(),
            (await fetchAuth('/assign')).json() // precisa de criar esta rota no backend
        ]);
        container.innerHTML = `
            <h2 class="text-2xl font-bold mb-4">Atribuir Playlist a TV</h2>
            <div class="mb-6 bg-gray-50 p-4 rounded-lg flex flex-wrap gap-4 items-end">
                <div><label class="block text-sm">TV (código)</label><select id="assignTV" class="border rounded px-3 py-1">${tvs.map(tv => `<option value="${tv.codigo}">${tv.name} (${tv.codigo})</option>`).join('')}</select></div>
                <div><label class="block text-sm">Playlist</label><select id="assignPlaylist" class="border rounded px-3 py-1">${playlists.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select></div>
                <button id="assignBtn" class="bg-indigo-600 text-white px-4 py-1 rounded">Atribuir</button>
            </div>
            <h3 class="text-xl font-semibold mb-2">Atribuições Atuais</h3>
            <div class="overflow-x-auto"><table class="min-w-full bg-white border"><thead class="bg-gray-100"><tr><th>TV</th><th>Playlist</th><th>Atribuída em</th></tr></thead><tbody>
                ${assignments.map(a => `<tr><td class="py-1 px-3 border">${a.child_site_name}</td><td class="py-1 px-3 border">${a.playlist_name}</td><td class="py-1 px-3 border">${new Date(a.assigned_at).toLocaleString()}</td></tr>`).join('')}
            </tbody></table></div>
        `;
        document.getElementById('assignBtn')?.addEventListener('click', async () => {
            const codigo = document.getElementById('assignTV').value;
            const playlist_id = document.getElementById('assignPlaylist').value;
            if (!codigo || !playlist_id) return alert('Selecione ambos');
            await fetchAuth('/assign', {
                method: 'POST',
                body: JSON.stringify({ child_site_codigo: codigo, playlist_id: parseInt(playlist_id) })
            });
            alert('Atribuído'); loadAssign(container);
        });
    } catch (err) { container.innerHTML = `<p class="text-red-600">Erro: ${err.message}</p>`; }
}

// ----- Utilizadores -----
async function loadUsers(container) {
    try {
        const users = await (await fetchAuth('/users')).json();
        container.innerHTML = `
            <h2 class="text-2xl font-bold mb-4">Utilizadores</h2>
            <div class="mb-6 bg-gray-50 p-4 rounded-lg">
                <h3 class="font-semibold mb-2">Adicionar Utilizador</h3>
                <div class="flex flex-wrap gap-2">
                    <input type="text" id="newUsername" placeholder="Usuário" class="border rounded px-3 py-1">
                    <input type="password" id="newPassword" placeholder="Senha" class="border rounded px-3 py-1">
                    <input type="email" id="newEmail" placeholder="Email" class="border rounded px-3 py-1">
                    <select id="newRole" class="border rounded px-3 py-1"><option value="admin">Admin</option><option value="viewer">Visualizador</option></select>
                    <button id="addUserBtn" class="bg-indigo-600 text-white px-4 py-1 rounded">Adicionar</button>
                </div>
            </div>
            <div class="overflow-x-auto"><table class="min-w-full bg-white border"><thead class="bg-gray-100"><tr><th>ID</th><th>Usuário</th><th>Email</th><th>Função</th><th>Criado em</th><th>Ações</th></tr></thead><tbody>
                ${users.map(u => `<tr><td class="py-1 px-3 border">${u.id}</td><td class="py-1 px-3 border">${u.username}</td><td class="py-1 px-3 border">${u.email || '-'}</td><td class="py-1 px-3 border">${u.role}</td><td class="py-1 px-3 border">${new Date(u.created_at).toLocaleDateString()}</td><td class="py-1 px-3 border"><button class="delete-user bg-red-500 text-white px-2 py-1 rounded" data-id="${u.id}">Remover</button></td></tr>`).join('')}
            </tbody></table></div>
        `;
        document.getElementById('addUserBtn')?.addEventListener('click', async () => {
            const username = document.getElementById('newUsername').value;
            const password = document.getElementById('newPassword').value;
            const email = document.getElementById('newEmail').value;
            const role = document.getElementById('newRole').value;
            if (!username || !password) return alert('Usuário e senha obrigatórios');
            await fetchAuth('/users', {
                method: 'POST',
                body: JSON.stringify({ username, password, email, role })
            });
            loadUsers(container);
        });
        document.querySelectorAll('.delete-user').forEach(btn => btn.addEventListener('click', async () => {
            if (confirm('Remover utilizador?')) {
                await fetchAuth(`/users/${btn.dataset.id}`, { method: 'DELETE' });
                loadUsers(container);
            }
        }));
    } catch (err) { container.innerHTML = `<p class="text-red-600">Erro: ${err.message}</p>`; }
}

// Iniciar
if (checkAuth()) loadView('dashboard');