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
let codigoExibido = false;

// ============================================================
// 3. FUNÇÃO PARA GERAR ID ÚNICO DO DISPOSITIVO
// ============================================================

function obterIdDispositivo() {
    let deviceId = localStorage.getItem("tv_device_id");
    
    if (!deviceId) {
        const navegador = navigator.userAgent;
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 10);
        
        let hash = 0;
        for (let i = 0; i < navegador.length; i++) {
            const char = navegador.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        deviceId = `TV-${Math.abs(hash).toString(36).toUpperCase()}-${timestamp.toString(36).toUpperCase()}-${random.toUpperCase()}`;
        localStorage.setItem("tv_device_id", deviceId);
        console.log("Novo ID do dispositivo criado:", deviceId);
    }
    
    return deviceId;
}

// ============================================================
// 4. FUNÇÕES DE API
// ============================================================

async function obterOuCriarCodigo() {
    const deviceId = obterIdDispositivo();
    let codigo = localStorage.getItem("tv_codigo");
    
    if (codigo) {
        try {
            const response = await fetch(`${API_BASE}/api/child/${codigo}/playlist`);
            if (response.status !== 404) {
                console.log("Código existente e válido:", codigo);
                return codigo;
            } else {
                console.log("Código não encontrado no backend, criando novo...");
            }
        } catch (error) {
            console.log("Erro ao verificar código, tentando criar novo...");
        }
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/tv/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                device_id: deviceId
            })
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        codigo = data.codigo;
        localStorage.setItem("tv_codigo", codigo);
        console.log("Novo código criado e guardado:", codigo);
        return codigo;
    } catch (error) {
        console.error("Erro ao criar código:", error);
        const fallbackCodigo = deviceId.substring(0, 8);
        localStorage.setItem("tv_codigo", fallbackCodigo);
        console.log("Código de fallback criado:", fallbackCodigo);
        return fallbackCodigo;
    }
}

async function registarTV() {
    try {
        const deviceId = obterIdDispositivo();
        const response = await fetch(`${API_BASE}/api/tv/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                codigo: CODIGO_TV,
                device_id: deviceId
            })
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

// ============================================================
// 5. FUNÇÕES DE FULLSCREEN - TELA CHEIA TOTAL
// ============================================================

function entrarFullscreen(elemento) {
    if (document.fullscreenElement) {
        sairFullscreen();
        return;
    }

    const container = document.createElement('div');
    container.className = 'fullscreen-mode';
    container.id = 'fullscreenContainer';
    container.style.padding = '0';
    container.style.margin = '0';
    container.style.overflow = 'hidden';
    
    const clone = elemento.cloneNode(true);
    
    clone.style.width = '100vw';
    clone.style.height = '100vh';
    clone.style.objectFit = 'cover';
    clone.style.position = 'absolute';
    clone.style.top = '50%';
    clone.style.left = '50%';
    clone.style.transform = 'translate(-50%, -50%)';
    clone.style.borderRadius = '0';
    
    container.appendChild(clone);
    
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
    
    const controls = document.createElement('div');
    controls.className = 'fullscreen-controls';
    controls.innerHTML = `
        <button onclick="pauseResume()">⏸️ Pausar/Retomar</button>
        <button onclick="proximoItem()">⏭️ Próximo</button>
    `;
    container.appendChild(controls);
    
    document.body.appendChild(container);
    
    if (container.requestFullscreen) {
        container.requestFullscreen({
            navigationUI: 'hide'
        }).catch(err => {
            console.log("Erro ao entrar em fullscreen:", err);
        });
    }
    
    estaEmFullscreen = true;
    fullscreenContainer = container;
    
    const video = container.querySelector('video');
    if (video) {
        video.play().catch(e => console.log("Erro ao dar play em fullscreen:", e));
    }
}

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

function proximoItem() {
    if (temporizadorAtual) {
        clearTimeout(temporizadorAtual);
        temporizadorAtual = null;
    }
    if (estaEmFullscreen) {
        sairFullscreen();
    }
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
// 6. FUNÇÕES DE REPRODUÇÃO
// ============================================================

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
    if (estaEmFullscreen) {
        sairFullscreen();
    }
}

function reproduzirItem(item, onTerminar) {
    const viewerContainer = document.getElementById('tvMediaContainer');
    if (!viewerContainer) return;
    
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
        
        video.onloadeddata = () => {
            if (codigoExibido) {
                entrarFullscreen(video);
            }
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
        
        img.onload = () => {
            if (codigoExibido) {
                entrarFullscreen(img);
            }
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
            indiceAtual = 0;
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
// 7. FUNÇÕES DE UI
// ============================================================

function renderizarUI(playlist, statusMensagem) {
    const root = document.getElementById('appRoot');
    if (!root) return;
    
    const temPlaylist = playlist && playlist.items && playlist.items.length > 0;
    const nomePlaylist = playlist?.name || "Nenhuma";
    const qtdMedia = playlist?.items?.length || 0;
    const deviceId = obterIdDispositivo();
    
    root.innerHTML = `
        <div class="card tv-mode">
            <div>
                <div class="fixed-code-badge">📺 CÓDIGO DE EMPARELHAMENTO</div>
                <h2 style="color:#ffd9a5; margin-top: 5px;">MODO TV</h2>
                <p style="color:#bbccff; margin-bottom: 5px;">Usa o código abaixo para emparelhar esta TV</p>
                <div class="tv-code-box">
                    <div class="code-digit">${CODIGO_TV}</div>
                </div>
                <div style="color: #8899bb; font-size: 0.8rem; margin-top: -15px; margin-bottom: 15px;">
                    ID do dispositivo: ${deviceId.substring(0, 15)}...
                </div>
                <div class="tv-status" id="tvStatusMsg">
                    ${statusMensagem || (temPlaylist ? `A reproduzir: ${nomePlaylist} (${qtdMedia} itens)` : 'A aguardar pela playlist...')}
                </div>
                ${temPlaylist ? `<button class="btn-fullscreen" onclick="iniciarFullscreen()">🎬 INICIAR EM TELA CHEIA</button>` : ''}
            </div>
            <div style="margin-top: 40px; width:100%;">
                <h3 style="color:#ffd27a;">📽️ A REPRODUZIR</h3>
                <div id="tvMediaContainer" class="media-grid" style="min-height: 300px; display: flex; align-items: center; justify-content: center;"></div>
            </div>
        </div>
    `;
    
    if (temPlaylist && codigoExibido) {
        setTimeout(() => {
            const container = document.getElementById('tvMediaContainer');
            if (container) {
                const video = container.querySelector('video');
                const img = container.querySelector('img');
                if (video) {
                    entrarFullscreen(video);
                } else if (img) {
                    entrarFullscreen(img);
                }
            }
        }, 500);
    }
}

function iniciarFullscreen() {
    codigoExibido = true;
    const container = document.getElementById('tvMediaContainer');
    if (container) {
        const video = container.querySelector('video');
        const img = container.querySelector('img');
        if (video) {
            entrarFullscreen(video);
        } else if (img) {
            entrarFullscreen(img);
        }
    }
}

// ============================================================
// 8. FUNÇÃO PRINCIPAL - POLLING
// ============================================================

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
// 9. INICIALIZAÇÃO
// ============================================================

(async function iniciar() {
    CODIGO_TV = await obterOuCriarCodigo();
    console.log("Código da TV (fixo):", CODIGO_TV);
    console.log("ID do dispositivo:", obterIdDispositivo());
    
    codigoExibido = true;
    
    await registarTV();
    await atualizarPlaylist();
    
    if (intervaloPolling) clearInterval(intervaloPolling);
    intervaloPolling = setInterval(atualizarPlaylist, 30000);
    
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && estaEmFullscreen) {
            sairFullscreen();
        }
    });
})();