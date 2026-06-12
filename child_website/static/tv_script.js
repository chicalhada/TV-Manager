// ============================================================
// SOLICITAR CÓDIGO ÚNICO AO BACKEND
// ============================================================
const API_BASE = "http://127.0.0.1:5000";

async function obterOuCriarCodigo() {
    // Verificar se já temos código guardado
    let codigo = localStorage.getItem("tv_codigo");
    
    if (codigo) {
        // Verificar se o código ainda existe no backend
        const response = await fetch(`${API_BASE}/api/child/${codigo}/playlist`);
        if (response.status !== 404) {
            return codigo;  // Código válido
        }
    }
    
    // Pedir novo código ao backend
    const response = await fetch(`${API_BASE}/api/tv/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})  // Não enviar código, o backend gera
    });
    const data = await response.json();
    codigo = data.codigo;
    localStorage.setItem("tv_codigo", codigo);
    return codigo;
}

// ============================================================
let CODIGO_TV = null;
let intervaloPolling = null;
let reprodutorAtivo = false;
let itemsPlaylist = [];
let indiceAtual = 0;
let temporizadorAtual = null;
let elementoVideoAtual = null;

// ==================== API CALLS ====================
async function registarTV() {
    try {
        const response = await fetch(`${API_BASE}/api/tv/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo: CODIGO_TV })
        });
        const data = await response.json();
        console.log("TV registada:", data);
        return data;
    } catch (error) {
        console.error("Erro ao registar TV:", error);
        return null;
    }
}

async function buscarPlaylist() {
    try {
        const response = await fetch(`${API_BASE}/api/child/${CODIGO_TV}/playlist`);
        
        if (response.status === 404) {
            console.log("Ainda nenhuma playlist atribuída a esta TV.");
            return null;
        }
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const playlist = await response.json();
        console.log("Playlist recebida:", playlist);
        return playlist;
    } catch (error) {
        console.error("Erro ao buscar playlist:", error);
        return null;
    }
}

// ==================== REPRODUÇÃO EM LOOP ====================
function pararReproducao() {
    if (temporizadorAtual) {
        clearTimeout(temporizadorAtual);
        temporizadorAtual = null;
    }
    if (elementoVideoAtual) {
        elementoVideoAtual.pause();
        elementoVideoAtual = null;
    }
    reprodutorAtivo = false;
}

function reproduzirItem(item, onTerminar) {
    const viewerContainer = document.getElementById('tvMediaContainer');
    if (!viewerContainer) return;
    
    // Determinar tipo de media pela extensão ou mime_type
    const url = item.url;
    const mimeType = item.mime_type || '';
    const isVideo = mimeType.startsWith('video/') || url.match(/\.(mp4|webm|mov|avi)$/i);
    const isImage = mimeType.startsWith('image/') || url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    
    if (isVideo) {
        const video = document.createElement('video');
        video.src = `${API_BASE}${encodeURI(url)}`;
        video.autoplay = true;
        video.controls = false;
        video.style.maxWidth = "100%";
        video.style.maxHeight = "70vh";
        video.style.borderRadius = "24px";
        video.onended = () => {
            elementoVideoAtual = null;
            onTerminar();
        };
        video.onerror = () => {
            console.error("Erro ao reproduzir vídeo");
            elementoVideoAtual = null;
            onTerminar();
        };
        
        viewerContainer.innerHTML = '';
        viewerContainer.appendChild(video);
        elementoVideoAtual = video;
        video.play().catch(e => console.error("Erro ao dar play:", e));
    } 
    else if (isImage) {
        const img = document.createElement('img');
        img.src = `${API_BASE}${url}`;
        img.alt = "Imagem";
        img.style.maxWidth = "100%";
        img.style.maxHeight = "70vh";
        img.style.borderRadius = "24px";
        
        viewerContainer.innerHTML = '';
        viewerContainer.appendChild(img);
        
        const duracao = (item.duration_seconds || 10) * 1000;
        temporizadorAtual = setTimeout(() => {
            temporizadorAtual = null;
            onTerminar();
        }, duracao);
    }
    else {
        // Formato não suportado
        viewerContainer.innerHTML = `<div class="no-media">Formato não suportado: ${url}</div>`;
        setTimeout(() => onTerminar(), 3000);
    }
}

function iniciarLoop(playlistItems) {
    pararReproducao();
    
    if (!playlistItems || playlistItems.length === 0) {
        const container = document.getElementById('tvMediaContainer');
        if (container) {
            container.innerHTML = `<div class="no-media">Nenhum conteúdo na playlist.<br>A aguardar atribuição...</div>`;
        }
        return;
    }
    
    itemsPlaylist = playlistItems;
    indiceAtual = 0;
    reprodutorAtivo = true;
    
    function avancar() {
        if (!reprodutorAtivo) return;
        
        if (indiceAtual >= itemsPlaylist.length) {
            indiceAtual = 0;  // Loop infinito
        }
        
        const item = itemsPlaylist[indiceAtual];
        indiceAtual++;
        
        reproduzirItem(item, () => {
            avancar();
        });
    }
    
    avancar();
}

// ==================== RENDER UI ====================
function renderizarUI(playlist, statusMensagem) {
    const root = document.getElementById('appRoot');
    if (!root) return;
    
    const temPlaylist = playlist && playlist.items && playlist.items.length > 0;
    const nomePlaylist = playlist?.name || "Nenhuma";
    const qtdMedia = playlist?.items?.length || 0;
    
    root.innerHTML = `
        <div class="card tv-mode">
            <div>
                <div class="fixed-code-badge">CÓDIGO DE EMPARELHAMENTO</div>
                <h2 style="color:#ffd9a5; margin-top: 5px;">MODO TV</h2>
                <p style="color:#bbccff; margin-bottom: 5px;">Usa o código abaixo para emparelhar esta TV</p>
                <div class="tv-code-box">
                    <div class="code-digit">${CODIGO_TV}</div>
                </div>
                <div class="tv-status" id="tvStatusMsg">
                    ${statusMensagem || (temPlaylist ? `A reproduzir: ${nomePlaylist} (${qtdMedia} itens)` : 'A aguardar pela playlist...')}
                </div>
            </div>
            <div style="margin-top: 40px; width:100%;">
                <h3 style="color:#ffd27a;">A REPRODUZIR</h3>
                <div id="tvMediaContainer" class="media-grid" style="min-height: 300px; display: flex; align-items: center; justify-content: center;"></div>
            </div>
        </div>
    `;
}

// ==================== POLLING E MAIN ====================
async function atualizarPlaylist() {
    const playlist = await buscarPlaylist();
    
    if (playlist && playlist.items) {
        renderizarUI(playlist, `Playlist: ${playlist.name} (${playlist.items.length} itens)`);
        iniciarLoop(playlist.items);
    } else {
        renderizarUI(null, "Nenhuma playlist atribuída. A aguardar...");
        pararReproducao();
        const container = document.getElementById('tvMediaContainer');
        if (container) {
            container.innerHTML = `<div class="no-media">Nenhuma playlist atribuída.<br><br> <strong>Como emparelhar:</strong><br>1. Aceda ao painel de administração<br>2. Encontre o código <strong style="color:#ffb347;">${CODIGO_TV}</strong><br>3. Atribua uma playlist a esta TV</div>`;
        }
    }
}

// ==================== INICIALIZAÇÃO ASSÍNCRONA ====================
(async function iniciar() {
    // Obter ou criar código
    CODIGO_TV = await obterOuCriarCodigo();
    console.log("Código da TV:", CODIGO_TV);
    
    // Registar a TV
    await registarTV();
    
    // Buscar playlist inicial
    await atualizarPlaylist();
    
    // Polling a cada 30 segundos
    if (intervaloPolling) clearInterval(intervaloPolling);
    intervaloPolling = setInterval(atualizarPlaylist, 30000);
})();