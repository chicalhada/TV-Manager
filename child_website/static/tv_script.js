// ============================================================
// JAVASCRIPT COMPLETO
// ============================================================

// ============================================================
// 1. CONFIGURAÇÃO INICIAL
// ============================================================
const API_BASE = "http://127.0.0.1:5000";

// ============================================================
// 2. VARIÁVEIS GLOBAIS
// ============================================================
let CODIGO_TV = null;
let intervaloPolling = null;
let reprodutorAtivo = false;
let itemsPlaylist = [];
let indiceAtual = 0;
let temporizadorAtual = null;
let elementoVideoAtual = null;
let estaEmFullscreen = false;
let fullscreenContainer = null;

// ============================================================
// 3. FUNÇÕES DE API
// ============================================================

// 3.1 Obter ou criar código único
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

// 3.2 Registrar TV no backend
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

// 3.3 Buscar playlist do backend
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

// ============================================================
// 4. FUNÇÕES DE FULLSCREEN
// ============================================================

// 4.1 Entrar em modo fullscreen
function entrarFullscreen(elemento) {
    if (document.fullscreenElement) {
        sairFullscreen();
        return;
    }

    // Criar container fullscreen
    const container = document.createElement('div');
    container.className = 'fullscreen-mode';
    container.id = 'fullscreenContainer';
    
    // Clonar o elemento para o fullscreen
    const clone = elemento.cloneNode(true);
    container.appendChild(clone);
    
    // Adicionar botão de sair
    const exitBtn = document.createElement('button');
    exitBtn.className = 'exit-fullscreen-btn';
    exitBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
        Sair da Tela Cheia
    `;
    exitBtn.onclick = sairFullscreen;
    container.appendChild(exitBtn);
    
    // Adicionar controles adicionais
    const controls = document.createElement('div');
    controls.className = 'fullscreen-controls';
    controls.innerHTML = `
        <button onclick="pauseResume()">⏸️ Pausar/Retomar</button>
        <button onclick="proximoItem()">⏭️ Próximo</button>
    `;
    container.appendChild(controls);
    
    document.body.appendChild(container);
    
    // Ativar modo fullscreen da API
    if (container.requestFullscreen) {
        container.requestFullscreen().catch(err => {
            console.log("Erro ao entrar em fullscreen:", err);
        });
    }
    
    estaEmFullscreen = true;
    fullscreenContainer = container;
    
    // Se for vídeo, dar play
    const video = container.querySelector('video');
    if (video) {
        video.play().catch(e => console.log("Erro ao dar play em fullscreen:", e));
    }
}

// 4.2 Sair do modo fullscreen
function sairFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => {
            console.log("Erro ao sair do fullscreen:", err);
        });
    }
    
    const container = document.getElementById('fullscreenContainer');
    if (container) {
        container.remove();
    }
    
    estaEmFullscreen = false;
    fullscreenContainer = null;
}

// 4.3 Pausar/Retomar vídeo
function pauseResume() {
    const container = document.getElementById('fullscreenContainer');
    if (!container) return;
    
    const video = container.querySelector('video');
    if (video) {
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    }
}

// 4.4 Avançar para próximo item
function proximoItem() {
    // Forçar avanço para o próximo item
    if (temporizadorAtual) {
        clearTimeout(temporizadorAtual);
        temporizadorAtual = null;
    }
    
    // Se estiver em fullscreen, sair e recarregar
    if (estaEmFullscreen) {
        sairFullscreen();
    }
    
    // Avançar para o próximo item
    if (reprodutorAtivo) {
        if (indiceAtual >= itemsPlaylist.length) {
            indiceAtual = 0;
        }
        const item = itemsPlaylist[indiceAtual];
        indiceAtual++;
        
        const container = document.getElementById('tvMediaContainer');
        if (container) {
            reproduzirItem(item, () => {
                if (reprodutorAtivo) {
                    // Continuar o loop
                    setTimeout(() => {
                        if (indiceAtual >= itemsPlaylist.length) {
                            indiceAtual = 0;
                        }
                        const nextItem = itemsPlaylist[indiceAtual];
                        indiceAtual++;
                        reproduzirItem(nextItem, arguments.callee);
                    }, 100);
                }
            });
        }
    }
}

// ============================================================
// 5. FUNÇÕES DE REPRODUÇÃO
// ============================================================

// 5.1 Parar reprodução
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
    
    // Se estiver em fullscreen, sair
    if (estaEmFullscreen) {
        sairFullscreen();
    }
}

// 5.2 Reproduzir um item específico
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
        
        // Quando o vídeo estiver pronto, entrar em fullscreen
        video.onloadeddata = () => {
            entrarFullscreen(video);
        };
        
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
        
        // Quando a imagem carregar, entrar em fullscreen
        img.onload = () => {
            entrarFullscreen(img);
        };
        
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

// 5.3 Iniciar loop de reprodução
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

// ============================================================
// 6. FUNÇÕES DE UI
// ============================================================

// 6.1 Renderizar interface
function renderizarUI(playlist, statusMensagem) {
    const root = document.getElementById('appRoot');
    if (!root) return;
    
    const temPlaylist = playlist && playlist.items && playlist.items.length > 0;
    const nomePlaylist = playlist?.name || "Nenhuma";
    const qtdMedia = playlist?.items?.length || 0;
    
    root.innerHTML = `
        <div class="card tv-mode">
            <div>
                <div class="fixed-code-badge">📺 CÓDIGO DE EMPARELHAMENTO</div>
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
                <h3 style="color:#ffd27a;">📽️ A REPRODUZIR</h3>
                <div id="tvMediaContainer" class="media-grid" style="min-height: 300px; display: flex; align-items: center; justify-content: center;"></div>
            </div>
        </div>
    `;
}

// ============================================================
// 7. FUNÇÃO PRINCIPAL - POLLING
// ============================================================

// 7.1 Atualizar playlist via polling
async function atualizarPlaylist() {
    const playlist = await buscarPlaylist();
    
    if (playlist && playlist.items && playlist.items.length > 0) {
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

// ============================================================
// 8. INICIALIZAÇÃO
// ============================================================

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
    
    // Listener para sair do fullscreen com ESC
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && estaEmFullscreen) {
            sairFullscreen();
        }
    });
})();