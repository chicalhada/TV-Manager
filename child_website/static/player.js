// ============================================================
// JAVASCRIPT - PÁGINA DE REPRODUÇÃO (PLAYER)
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
let temporizadorMouse = null;
let fullscreenAtivado = false;

// ============================================================
// 3. INICIALIZAÇÃO DO PLAYER
// ============================================================

// Tentar obter código do localStorage
CODIGO_TV = localStorage.getItem("tv_codigo_player");

// Escutar mensagens da página principal
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'CODIGO_TV') {
        CODIGO_TV = event.data.codigo;
        localStorage.setItem("tv_codigo_player", CODIGO_TV);
        console.log("Código recebido da página principal:", CODIGO_TV);
        iniciarPlayer();
    }
});

// Se já tiver código, iniciar
if (CODIGO_TV) {
    console.log("Código encontrado no localStorage:", CODIGO_TV);
    iniciarPlayer();
} else {
    const root = document.getElementById('playerRoot');
    if (root) {
        root.innerHTML = `
            <div class="fullscreen-mode" style="display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 20px;">
                <div class="loading-player" style="font-size: 2rem; color: #ffb347;">📺 Aguardando código da TV...</div>
                <div style="color: #8899bb; font-size: 1.2rem;">Volte à página principal e clique em "ABRIR PLAYER"</div>
            </div>
        `;
    }
}

// ============================================================
// 4. FUNÇÕES DE API
// ============================================================

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
// 5. FUNÇÕES DE FULLSCREEN
// ============================================================

function entrarFullscreen(elemento) {
    if (estaEmFullscreen) {
        const container = document.getElementById('fullscreenContainer');
        if (container) {
            const oldContent = container.querySelector('video, img, .no-media-fullscreen');
            if (oldContent) oldContent.remove();
            
            const clone = elemento.cloneNode(true);
            clone.style.width = '100vw';
            clone.style.height = '100vh';
            clone.style.objectFit = 'cover';
            clone.style.display = 'block';
            clone.style.background = '#000';
            clone.style.borderRadius = '0';
            container.insertBefore(clone, container.firstChild);
            
            if (clone.tagName === 'VIDEO') {
                clone.play().catch(e => console.log("Erro ao dar play:", e));
            }
        }
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
    clone.style.display = 'block';
    clone.style.background = '#000';
    clone.style.borderRadius = '0';
    container.appendChild(clone);
    
    const exitBtn = document.createElement('button');
    exitBtn.className = 'exit-fullscreen-btn';
    exitBtn.id = 'exitFullscreenBtn';
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
    controls.id = 'fullscreenControls';
    controls.innerHTML = `
        <button onclick="pauseResume()">⏸️ Pausar/Retomar</button>
        <button onclick="proximoItem()">⏭️ Próximo</button>
    `;
    container.appendChild(controls);
    
    document.body.appendChild(container);
    
    if (container.requestFullscreen && !fullscreenAtivado) {
        container.requestFullscreen({
            navigationUI: 'hide'
        }).then(() => {
            fullscreenAtivado = true;
            console.log("Fullscreen ativado automaticamente!");
        }).catch(err => {
            console.log("Erro ao entrar em fullscreen:", err);
            setTimeout(() => {
                container.requestFullscreen({
                    navigationUI: 'hide'
                }).catch(e => console.log("Falha ao ativar fullscreen:", e));
            }, 1000);
        });
    }
    
    estaEmFullscreen = true;
    fullscreenContainer = container;
    
    container.addEventListener('mousemove', mostrarControles);
    container.addEventListener('mouseleave', ocultarControles);
    
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
        container.removeEventListener('mousemove', mostrarControles);
        container.removeEventListener('mouseleave', ocultarControles);
        container.remove();
    }
    
    estaEmFullscreen = false;
    fullscreenContainer = null;
    fullscreenAtivado = false;
    
    if (temporizadorMouse) {
        clearTimeout(temporizadorMouse);
        temporizadorMouse = null;
    }
}

// ============================================================
// 6. FUNÇÕES DE CONTROLE
// ============================================================

function mostrarControles() {
    const exitBtn = document.getElementById('exitFullscreenBtn');
    const controls = document.getElementById('fullscreenControls');
    
    if (exitBtn) exitBtn.classList.add('visible');
    if (controls) controls.classList.add('visible');
    
    if (temporizadorMouse) {
        clearTimeout(temporizadorMouse);
        temporizadorMouse = null;
    }
    
    temporizadorMouse = setTimeout(() => {
        ocultarControles();
    }, 3000);
}

function ocultarControles() {
    const exitBtn = document.getElementById('exitFullscreenBtn');
    const controls = document.getElementById('fullscreenControls');
    
    if (exitBtn) exitBtn.classList.remove('visible');
    if (controls) controls.classList.remove('visible');
    
    if (temporizadorMouse) {
        clearTimeout(temporizadorMouse);
        temporizadorMouse = null;
    }
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
    mostrarControles();
}

function proximoItem() {
    if (temporizadorAtual) {
        clearTimeout(temporizadorAtual);
        temporizadorAtual = null;
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
    mostrarControles();
}

// ============================================================
// 7. FUNÇÕES DE REPRODUÇÃO
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
        const msgDiv = document.createElement('div');
        msgDiv.className = 'no-media-fullscreen';
        msgDiv.textContent = `📺 ${item.name || 'Conteúdo indisponível'}`;
        msgDiv.style.cssText = `
            color: #fff;
            font-size: 2rem;
            text-align: center;
            padding: 30px;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 20px;
            border: 2px solid #ffb347;
            max-width: 80%;
        `;
        entrarFullscreen(msgDiv);
        
        setTimeout(() => {
            onTerminar();
        }, 3000);
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
// 8. FUNÇÕES PRINCIPAIS
// ============================================================

async function atualizarPlaylist() {
    const playlist = await buscarPlaylist();
    
    if (playlist && playlist.items && playlist.items.length > 0) {
        console.log("Playlist atualizada:", playlist);
        iniciarLoop(playlist.items);
    } else {
        pararReproducao();
        const container = document.getElementById('tvMediaContainer');
        if (container) {
            container.innerHTML = `<div class="no-media">Nenhuma playlist atribuída. Aguardando...</div>`;
        }
    }
}

async function iniciarPlayer() {
    console.log("Iniciando player com código:", CODIGO_TV);
    
    const root = document.getElementById('playerRoot');
    if (root) {
        root.innerHTML = `
            <div id="tvMediaContainer" style="width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background: #000;">
                <div class="loading-player">📺 Carregando playlist...</div>
            </div>
        `;
    }
    
    await atualizarPlaylist();
    
    if (intervaloPolling) clearInterval(intervaloPolling);
    intervaloPolling = setInterval(atualizarPlaylist, 30000);
    
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && estaEmFullscreen) {
            sairFullscreen();
        }
    });
}