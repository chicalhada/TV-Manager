// ============================================================
// JAVASCRIPT COMPLETO - AUTOPLAY TOTAL
// ============================================================

const API_BASE = "http://127.0.0.1:5000";

// ============================================================
// WEBSOCKET
// ============================================================
const socket = io('http://127.0.0.1:5000', {
    transports: ['websocket', 'polling']
});

socket.on('connect', function() {
    console.log('✅ Conectado ao servidor WebSocket');
});

socket.on('disconnect', function() {
    console.log('❌ Desconectado do servidor WebSocket');
});

socket.on('registered', function(data) {
    console.log('📡 TV registada no WebSocket:', data);
});

socket.on('playlist_updated', function(data) {
    console.log('🔄 Playlist atualizada!', data);
    atualizarPlaylist();
});

// ============================================================
// 1. VARIÁVEIS GLOBAIS
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
let playerAtivo = false;
let iniciadoAutomaticamente = false;

// ============================================================
// 2. ID FIXO DO DISPOSITIVO
// ============================================================
function obterIdDispositivo() {
    let deviceId = localStorage.getItem("tv_device_id");
    if (!deviceId) {
        const userAgent = navigator.userAgent;
        const screenRes = `${window.screen.width}x${window.screen.height}`;
        const platform = navigator.platform;
        const language = navigator.language;
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 10);
        let combinedString = `${userAgent}|${screenRes}|${platform}|${language}|${timestamp}|${random}`;
        let hash = 0;
        for (let i = 0; i < combinedString.length; i++) {
            const char = combinedString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const hashStr = Math.abs(hash).toString(36).toUpperCase();
        const timestampStr = timestamp.toString(36).toUpperCase();
        const randomStr = random.toUpperCase();
        deviceId = `TV-${hashStr}-${timestampStr.substring(0, 4)}-${randomStr.substring(0, 4)}`;
        localStorage.setItem("tv_device_id", deviceId);
        console.log("🆕 Novo ID do dispositivo criado (FIXO):", deviceId);
    } else {
        console.log("🔄 ID do dispositivo recuperado (FIXO):", deviceId);
    }
    return deviceId;
}

// ============================================================
// 3. CÓDIGO FIXO
// ============================================================
function gerarCodigoFixo(deviceId) {
    const parts = deviceId.split('-');
    let codigoBase = parts[1] || '';
    while (codigoBase.length < 6) codigoBase += '0';
    let codigo = codigoBase.substring(0, 6);
    let checksum = 0;
    for (let i = 0; i < codigo.length; i++) {
        checksum += codigo.charCodeAt(i);
    }
    const checkChar = String.fromCharCode(65 + (checksum % 26));
    codigo = codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
    while (codigo.length < 6) codigo += 'X';
    return codigo.substring(0, 6) + checkChar;
}

// ============================================================
// 4. FUNÇÕES DE API
// ============================================================
async function obterOuCriarCodigo() {
    const deviceId = obterIdDispositivo();
    let codigo = localStorage.getItem("tv_codigo");
    if (!codigo) {
        codigo = gerarCodigoFixo(deviceId);
        localStorage.setItem("tv_codigo", codigo);
        console.log("📝 Código fixo guardado:", codigo);
    }
    try {
        const response = await fetch(`${API_BASE}/api/child/${codigo}/playlist`);
        if (response.status === 404) {
            console.log("⚠️ Código não encontrado, registando...");
            await fetch(`${API_BASE}/api/tv/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo, device_id: deviceId })
            });
        }
    } catch (error) {
        console.warn("⚠️ Erro ao verificar código:", error);
    }
    CODIGO_TV = codigo;
    return codigo;
}

async function registarTV() {
    try {
        socket.emit('register_tv', { codigo: CODIGO_TV });
        const deviceId = obterIdDispositivo();
        const codigo = localStorage.getItem("tv_codigo") || CODIGO_TV;
        const response = await fetch(`${API_BASE}/api/tv/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo, device_id: deviceId })
        });
        return await response.json();
    } catch (error) {
        console.error("❌ Erro ao registar TV:", error);
        return null;
    }
}

async function buscarPlaylist() {
    try {
        const codigo = localStorage.getItem("tv_codigo") || CODIGO_TV;
        const response = await fetch(`${API_BASE}/api/child/${codigo}/playlist`);
        if (response.status === 404) {
            console.log("📭 Ainda sem playlist.");
            return null;
        }
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        const data = await response.json();
        console.log("📋 Playlist recebida:", data);
        return data;
    } catch (error) {
        console.error("❌ Erro ao buscar playlist:", error);
        return null;
    }
}

// ============================================================
// 5. PLAYER - INÍCIO AUTOMÁTICO
// ============================================================
function ativarPlayer() {
    console.log("🎬 Ativando player automaticamente...");
    playerAtivo = true;
    
    const appRoot = document.getElementById('appRoot');
    if (appRoot) appRoot.style.display = 'none';
    
    const playerContainer = document.getElementById('playerContainer');
    if (playerContainer) playerContainer.classList.add('active');
    
    // Iniciar reprodução imediatamente
    setTimeout(() => {
        iniciarReproducao();
    }, 500);
    
    if (intervaloPolling) clearInterval(intervaloPolling);
    intervaloPolling = setInterval(atualizarPlaylist, 30000);
}

function voltarTelaInicial() {
    console.log("🏠 Voltar à tela inicial");
    playerAtivo = false;
    iniciadoAutomaticamente = false;
    pararReproducao();
    
    if (estaEmFullscreen) sairFullscreen();
    
    const playerContainer = document.getElementById('playerContainer');
    if (playerContainer) {
        playerContainer.classList.remove('active');
        playerContainer.innerHTML = '';
    }
    
    const appRoot = document.getElementById('appRoot');
    if (appRoot) appRoot.style.display = 'block';
    
    if (intervaloPolling) { 
        clearInterval(intervaloPolling); 
        intervaloPolling = null; 
    }
    
    renderizarUI(null, "⏳ Aguardando playlist...");
}

// ============================================================
// 6. FULLSCREEN E CONTROLES
// ============================================================
function entrarFullscreen(elemento) {
    const playerContainer = document.getElementById('playerContainer');
    if (!playerContainer) return;
    
    let container = document.getElementById('fullscreenContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'fullscreen-mode';
        container.id = 'fullscreenContainer';
        playerContainer.appendChild(container);
    }

    // Remove conteúdo antigo
    const old = container.querySelector('video, img, .no-media-fullscreen, .play-overlay');
    if (old) old.remove();

    // Clona o elemento
    const clone = elemento.cloneNode(true);
    clone.style.width = '100vw';
    clone.style.height = '100vh';
    clone.style.objectFit = 'contain';
    clone.style.display = 'block';
    clone.style.background = '#000';
    clone.style.borderRadius = '0';
    container.appendChild(clone);

    // Se for vídeo, FORÇA AUTOPLAY
    if (clone.tagName === 'VIDEO') {
        const video = clone;
        video.muted = false;
        video.controls = false;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        
        // TENTAR AUTOPLAY IMEDIATAMENTE
        tryPlayVideo(video, container);
    }

    // Botão de sair
    let exitBtn = document.getElementById('exitFullscreenBtn');
    if (!exitBtn) {
        exitBtn = document.createElement('button');
        exitBtn.id = 'exitFullscreenBtn';
        exitBtn.className = 'exit-fullscreen-btn';
        exitBtn.innerHTML = '<i class="fas fa-times-circle"></i> Sair';
        exitBtn.onclick = () => { 
            sairFullscreen(); 
            voltarTelaInicial(); 
        };
        container.appendChild(exitBtn);
    }

    // Controles inferiores
    let controls = document.getElementById('fullscreenControls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'fullscreen-controls';
        controls.id = 'fullscreenControls';
        controls.innerHTML = `
            <button onclick="window.pauseResume()"><i class="fas fa-pause"></i> Pausar</button>
            <button onclick="window.proximoItem()"><i class="fas fa-forward"></i> Próximo</button>
        `;
        container.appendChild(controls);
    }

    // Mostrar controles ao mexer o mouse
    container.addEventListener('mousemove', mostrarControles);
    container.addEventListener('mouseleave', ocultarControles);

    // Ativar fullscreen da API
    if (!estaEmFullscreen) {
        if (container.requestFullscreen) {
            container.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
        }
        estaEmFullscreen = true;
        fullscreenContainer = container;
    }

    mostrarControles();
}

// FUNÇÃO PARA TENTAR AUTOPLAY REPETIDAS VEZES
function tryPlayVideo(video, container, tentativas = 0) {
    if (tentativas > 10) {
        console.log("⚠️ Falha no autoplay após 10 tentativas");
        mostrarOverlayPlay(video, container);
        return;
    }
    
    const playPromise = video.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log("✅ Vídeo em reprodução automática!");
        }).catch((error) => {
            console.log(`⚠️ Tentativa ${tentativas + 1}: Autoplay bloqueado, tentando novamente...`);
            setTimeout(() => {
                tryPlayVideo(video, container, tentativas + 1);
            }, 500);
        });
    }
}

function mostrarOverlayPlay(video, container) {
    const overlay = document.createElement('div');
    overlay.className = 'play-overlay';
    overlay.innerHTML = '<i class="fas fa-play-circle"></i> Clique para tocar';
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.3);
        z-index: 9999;
        cursor: pointer;
        color: #fff;
        font-size: 1.2rem;
        gap: 15px;
    `;
    overlay.querySelector('i').style.fontSize = '4rem';
    
    overlay.addEventListener('click', function() {
        video.play();
        this.remove();
    });
    
    // Tenta novamente após 2 segundos
    setTimeout(() => {
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                overlay.remove();
                console.log("✅ Vídeo iniciado após tentativa!");
            }).catch(() => {});
        }
    }, 2000);
    
    container.appendChild(overlay);
}

function sairFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
    const container = document.getElementById('fullscreenContainer');
    if (container) {
        container.removeEventListener('mousemove', mostrarControles);
        container.removeEventListener('mouseleave', ocultarControles);
    }
    estaEmFullscreen = false;
    fullscreenContainer = null;
    if (temporizadorMouse) { clearTimeout(temporizadorMouse); temporizadorMouse = null; }
}

function mostrarControles() {
    const exitBtn = document.getElementById('exitFullscreenBtn');
    const controls = document.getElementById('fullscreenControls');
    if (exitBtn) exitBtn.classList.add('visible');
    if (controls) controls.classList.add('visible');
    if (temporizadorMouse) clearTimeout(temporizadorMouse);
    temporizadorMouse = setTimeout(ocultarControles, 4000);
}

function ocultarControles() {
    const exitBtn = document.getElementById('exitFullscreenBtn');
    const controls = document.getElementById('fullscreenControls');
    if (exitBtn) exitBtn.classList.remove('visible');
    if (controls) controls.classList.remove('visible');
    if (temporizadorMouse) { clearTimeout(temporizadorMouse); temporizadorMouse = null; }
}

// Funções globais para os botões
window.pauseResume = function() {
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
};

window.proximoItem = function() {
    if (temporizadorAtual) { clearTimeout(temporizadorAtual); temporizadorAtual = null; }
    if (reprodutorAtivo && itemsPlaylist.length > 0) {
        if (indiceAtual >= itemsPlaylist.length) indiceAtual = 0;
        const item = itemsPlaylist[indiceAtual];
        indiceAtual++;
        reproduzirItem(item, () => {
            if (reprodutorAtivo) {
                avancarLoop();
            }
        });
    }
    mostrarControles();
};

// ============================================================
// 7. REPRODUÇÃO DE ITENS
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
    console.log("🎬 Reproduzindo item:", item);
    
    const playerContainer = document.getElementById('playerContainer');
    if (!playerContainer) {
        console.error("❌ Player container não encontrado");
        setTimeout(onTerminar, 1000);
        return;
    }

    let container = document.getElementById('fullscreenContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'fullscreen-mode';
        container.id = 'fullscreenContainer';
        playerContainer.appendChild(container);
    }

    const url = item.url;
    const mimeType = item.mime_type || '';
    const isVideo = mimeType.startsWith('video/') || url.match(/\.(mp4|webm|mov|avi|mkv)$/i);
    const isImage = mimeType.startsWith('image/') || url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);

    // Remove conteúdo antigo
    const old = container.querySelector('video, img, .no-media-fullscreen, .play-overlay');
    if (old) old.remove();

    if (isVideo) {
        console.log("🎥 Reproduzindo vídeo:", url);
        const video = document.createElement('video');
        const videoUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
        video.src = videoUrl;
        video.autoplay = true;
        video.controls = false;
        video.muted = false;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.style.width = '100vw';
        video.style.height = '100vh';
        video.style.objectFit = 'contain';
        video.style.background = '#000';

        video.onloadedmetadata = function() {
            console.log("📹 Vídeo carregado:", videoUrl);
            entrarFullscreen(video);
        };

        video.oncanplay = function() {
            console.log("▶️ Vídeo pronto, iniciando autoplay...");
            tryPlayVideo(video, container);
        };

        video.onended = () => {
            console.log("⏹️ Vídeo terminou");
            elementoVideoAtual = null;
            onTerminar();
        };

        video.onerror = (e) => {
            console.error("❌ Erro no vídeo:", e);
            console.error("URL do vídeo:", videoUrl);
            elementoVideoAtual = null;
            setTimeout(onTerminar, 2000);
        };

        container.appendChild(video);
        elementoVideoAtual = video;

        if (video.readyState >= 2) {
            video.oncanplay();
        }

    } else if (isImage) {
        console.log("🖼️ Reproduzindo imagem:", url);
        const img = document.createElement('img');
        const imgUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
        img.src = imgUrl;
        img.alt = "Imagem";
        img.style.width = '100vw';
        img.style.height = '100vh';
        img.style.objectFit = 'contain';
        img.style.background = '#000';
        
        img.onload = () => {
            console.log("✅ Imagem carregada");
            entrarFullscreen(img);
        };
        
        img.onerror = () => {
            console.error("❌ Erro ao carregar imagem:", imgUrl);
            onTerminar();
        };
        
        container.appendChild(img);

        const duracao = (item.duration_seconds || 10) * 1000;
        temporizadorAtual = setTimeout(() => {
            temporizadorAtual = null;
            onTerminar();
        }, duracao);

    } else {
        console.log("📄 Item sem mídia reconhecida:", item);
        const msgDiv = document.createElement('div');
        msgDiv.className = 'no-media-fullscreen';
        msgDiv.textContent = `📺 ${item.name || 'Conteúdo indisponível'}`;
        msgDiv.style.cssText = `
            color: #fff;
            font-size: 1.8rem;
            text-align: center;
            padding: 30px 40px;
            background: rgba(0,0,0,0.8);
            border-radius: 24px;
            border: 2px solid rgba(251,191,36,0.3);
            max-width: 80%;
        `;
        entrarFullscreen(msgDiv);
        setTimeout(() => { onTerminar(); }, 3000);
    }
}

function avancarLoop() {
    if (!reprodutorAtivo) return;
    if (indiceAtual >= itemsPlaylist.length) indiceAtual = 0;
    const item = itemsPlaylist[indiceAtual];
    indiceAtual++;
    reproduzirItem(item, () => { avancarLoop(); });
}

function iniciarReproducao() {
    pararReproducao();
    
    if (!itemsPlaylist || itemsPlaylist.length === 0) {
        console.log("📭 Nenhum item para reproduzir");
        return;
    }
    
    console.log("▶️ Iniciando loop de reprodução com", itemsPlaylist.length, "itens");
    indiceAtual = 0;
    reprodutorAtivo = true;
    
    const playerContainer = document.getElementById('playerContainer');
    if (playerContainer) {
        let container = document.getElementById('fullscreenContainer');
        if (!container) {
            container = document.createElement('div');
            container.className = 'fullscreen-mode';
            container.id = 'fullscreenContainer';
            playerContainer.appendChild(container);
        }
    }
    
    avancarLoop();
}

// ============================================================
// 8. UI - COM AUTOPLAY TOTAL
// ============================================================
function renderizarUI(playlist, statusMensagem) {
    const root = document.getElementById('appRoot');
    if (!root) return;
    
    const temPlaylist = playlist && playlist.items && playlist.items.length > 0;
    const deviceId = obterIdDispositivo();
    const codigoFixo = localStorage.getItem("tv_codigo") || CODIGO_TV;

    root.innerHTML = `
        <div class="card tv-mode">
            <div class="fixed-code-badge"><i class="fas fa-code"></i> CÓDIGO DE EMPARELHAMENTO</div>
            <h2>TV Manager</h2>
            <p class="subtitle">Insira o código abaixo para iniciar a reprodução</p>
            <div class="tv-code-box">
                <div class="code-digit">${codigoFixo}</div>
            </div>
            <div class="device-id">ID: ${deviceId.substring(0, 20)}...</div>
            <div class="tv-status" id="tvStatusMsg">
                ${statusMensagem || (temPlaylist ? '✅ Playlist disponível! Iniciando automaticamente...' : '⏳ Aguardando playlist...')}
            </