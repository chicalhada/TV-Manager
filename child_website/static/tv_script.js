// ============================================================
// JAVASCRIPT COMPLETO - CÓDIGO FIXO + AUTOPLAY
// ============================================================

const API_BASE = "http://127.0.0.1:5000";


// ============================================================
// WEBSOCKET
// ============================================================
const socket = io('http://127.0.0.1:5000', {
    transports: ['websocket', 'polling']
});

socket.on('connect', function() {
    console.log('Conectado ao servidor WebSocket');
});

socket.on('disconnect', function() {
    console.log('Desconectado do servidor WebSocket');
});

socket.on('registered', function(data) {
    console.log('TV registada no WebSocket:', data);
});

socket.on('playlist_updated', function(data) {
    console.log('Playlist atualizada!', data);
    // Forçar atualização imediata
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
let overlayPlay = null;

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
        console.error("Erro ao registar TV:", error);
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
        return await response.json();
    } catch (error) {
        console.error("❌ Erro ao buscar playlist:", error);
        return null;
    }
}

// ============================================================
// 5. PLAYER
// ============================================================
function ativarPlayer() {
    console.log("🎬 Ativando player...");
    playerAtivo = true;
    const appRoot = document.getElementById('appRoot');
    if (appRoot) appRoot.style.display = 'none';
    const playerContainer = document.getElementById('playerContainer');
    if (playerContainer) playerContainer.classList.add('active');
    atualizarPlaylist();
    if (intervaloPolling) clearInterval(intervaloPolling);
    intervaloPolling = setInterval(atualizarPlaylist, 60000);
}

function voltarTelaInicial() {
    console.log("🏠 Voltar à tela inicial");
    playerAtivo = false;
    pararReproducao();
    if (estaEmFullscreen) sairFullscreen();
    const playerContainer = document.getElementById('playerContainer');
    if (playerContainer) {
        playerContainer.classList.remove('active');
        playerContainer.innerHTML = '';
    }
    const appRoot = document.getElementById('appRoot');
    if (appRoot) appRoot.style.display = 'block';
    if (intervaloPolling) { clearInterval(intervaloPolling); intervaloPolling = null; }
    renderizarUI(null, "Aguardando playlist...");
}

// ============================================================
// 6. FULLSCREEN E CONTROLES
// ============================================================
function entrarFullscreen(elemento) {
    const container = document.getElementById('fullscreenContainer') || (() => {
        const c = document.createElement('div');
        c.className = 'fullscreen-mode';
        c.id = 'fullscreenContainer';
        document.getElementById('playerContainer').appendChild(c);
        return c;
    })();

    // Remove conteúdo antigo
    const old = container.querySelector('video, img, .no-media-fullscreen, .play-overlay');
    if (old) old.remove();

    // Clona o elemento para não perder referências
    const clone = elemento.cloneNode(true);
    clone.style.width = '100vw';
    clone.style.height = '100vh';
    clone.style.objectFit = 'contain';
    clone.style.display = 'block';
    clone.style.background = '#000';
    clone.style.borderRadius = '0';
    container.appendChild(clone);

    // Se for vídeo, tenta autoplay
    if (clone.tagName === 'VIDEO') {
        const video = clone;
        video.muted = false; // Pode ser necessário para autoplay em alguns browsers
        video.controls = false;
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                // Autoplay bloqueado: mostra overlay de play
                const overlay = document.createElement('div');
                overlay.className = 'play-overlay';
                overlay.innerHTML = '<i class="fas fa-play-circle"></i>';
                overlay.addEventListener('click', () => {
                    video.play();
                    overlay.remove();
                });
                container.appendChild(overlay);
            });
        }
    }

    // Botão de sair
    let exitBtn = document.getElementById('exitFullscreenBtn');
    if (!exitBtn) {
        exitBtn = document.createElement('button');
        exitBtn.id = 'exitFullscreenBtn';
        exitBtn.className = 'exit-fullscreen-btn';
        exitBtn.innerHTML = '<i class="fas fa-times-circle"></i> Sair';
        exitBtn.onclick = () => { sairFullscreen(); voltarTelaInicial(); };
        container.appendChild(exitBtn);
    }

    // Controles inferiores
    let controls = document.getElementById('fullscreenControls');
    if (!controls) {
        controls = document.createElement('div');
        controls.className = 'fullscreen-controls';
        controls.id = 'fullscreenControls';
        controls.innerHTML = `
            <button onclick="pauseResume()"><i class="fas fa-pause"></i> Pausar</button>
            <button onclick="proximoItem()"><i class="fas fa-forward"></i> Próximo</button>
        `;
        container.appendChild(controls);
    }

    // Mostrar controles ao mexer o mouse
    container.addEventListener('mousemove', mostrarControles);
    container.addEventListener('mouseleave', ocultarControles);

    if (!estaEmFullscreen) {
        if (container.requestFullscreen) {
            container.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
        }
        estaEmFullscreen = true;
        fullscreenContainer = container;
    }

    mostrarControles();
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
        if (video.paused) { video.play(); } else { video.pause(); }
    }
    mostrarControles();
};

window.proximoItem = function() {
    if (temporizadorAtual) { clearTimeout(temporizadorAtual); temporizadorAtual = null; }
    if (reprodutorAtivo) {
        if (indiceAtual >= itemsPlaylist.length) indiceAtual = 0;
        const item = itemsPlaylist[indiceAtual++];
        const container = document.getElementById('fullscreenContainer');
        if (container) {
            reproduzirItem(item, () => {
                if (reprodutorAtivo) {
                    setTimeout(() => {
                        if (indiceAtual >= itemsPlaylist.length) indiceAtual = 0;
                        const nextItem = itemsPlaylist[indiceAtual++];
                        reproduzirItem(nextItem, arguments.callee);
                    }, 100);
                }
            });
        }
    }
    mostrarControles();
};

// ============================================================
// 7. REPRODUÇÃO DE ITENS
// ============================================================
function pararReproducao() {
    if (temporizadorAtual) { clearTimeout(temporizadorAtual); temporizadorAtual = null; }
    if (elementoVideoAtual) { elementoVideoAtual.pause(); elementoVideoAtual = null; }
    reprodutorAtivo = false;
}

function reproduzirItem(item, onTerminar) {
    const container = document.getElementById('fullscreenContainer');
    if (!container) {
        // Se não houver container, cria um
        const playerContainer = document.getElementById('playerContainer');
        if (playerContainer) {
            const c = document.createElement('div');
            c.className = 'fullscreen-mode';
            c.id = 'fullscreenContainer';
            playerContainer.appendChild(c);
            // Reentra na função após criar
            setTimeout(() => reproduzirItem(item, onTerminar), 50);
        }
        return;
    }

    const url = item.url;
    const mimeType = item.mime_type || '';
    const isVideo = mimeType.startsWith('video/') || url.match(/\.(mp4|webm|mov|avi)$/i);
    const isImage = mimeType.startsWith('image/') || url.match(/\.(jpg|jpeg|png|gif|webp)$/i);

    // Remove conteúdo antigo e overlays
    const old = container.querySelector('video, img, .no-media-fullscreen, .play-overlay');
    if (old) old.remove();

    if (isVideo) {
        const video = document.createElement('video');
        video.src = `${API_BASE}${url}`;
        video.autoplay = true;
        video.controls = false;
        video.muted = false;
        video.playsInline = true;

        video.onloadeddata = () => {
            // Tenta dar play
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // Autoplay bloqueado: overlay de play
                    const overlay = document.createElement('div');
                    overlay.className = 'play-overlay';
                    overlay.innerHTML = '<i class="fas fa-play-circle"></i>';
                    overlay.addEventListener('click', () => {
                        video.play();
                        overlay.remove();
                    });
                    container.appendChild(overlay);
                });
            }
            // Entrar em fullscreen com o vídeo
            entrarFullscreen(video);
        };

        video.onended = () => {
            elementoVideoAtual = null;
            onTerminar();
        };
        video.onerror = () => {
            console.error("Erro no vídeo");
            elementoVideoAtual = null;
            onTerminar();
        };

        container.appendChild(video);
        elementoVideoAtual = video;

        // Se o vídeo já estiver carregado, chama onloadeddata manualmente
        if (video.readyState >= 2) {
            video.onloadeddata();
        }

    } else if (isImage) {
        const img = document.createElement('img');
        img.src = `${API_BASE}${url}`;
        img.alt = "Imagem";
        img.onload = () => {
            entrarFullscreen(img);
        };
        container.appendChild(img);

        const duracao = (item.duration_seconds || 10) * 1000;
        temporizadorAtual = setTimeout(() => {
            temporizadorAtual = null;
            onTerminar();
        }, duracao);

    } else {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'no-media-fullscreen';
        msgDiv.textContent = `📺 ${item.name || 'Conteúdo indisponível'}`;
        entrarFullscreen(msgDiv);
        setTimeout(() => { onTerminar(); }, 3000);
    }
}

function iniciarLoop(playlistItems) {
    pararReproducao();
    if (!playlistItems || playlistItems.length === 0) return;
    itemsPlaylist = playlistItems;
    indiceAtual = 0;
    reprodutorAtivo = true;

    function avancar() {
        if (!reprodutorAtivo) return;
        if (indiceAtual >= itemsPlaylist.length) indiceAtual = 0;
        const item = itemsPlaylist[indiceAtual++];
        reproduzirItem(item, () => { avancar(); });
    }
    avancar();
}

// ============================================================
// 8. UI
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
                ${statusMensagem || (temPlaylist ? '✅ Playlist disponível! Clique em "INICIAR"' : '⏳ Aguardando playlist...')}
            </div>
            ${temPlaylist ? `
                <button class="btn-primary" onclick="ativarPlayer()">
                    <i class="fas fa-play"></i> INICIAR REPRODUÇÃO
                </button>
            ` : `
                <p style="color: #64748b; margin-top: 20px; font-size: 0.9rem;">
                    <i class="fas fa-circle-notch fa-spin"></i> Aguardando atribuição de playlist...
                </p>
            `}
            <div class="footer-note">
                <i class="fas fa-lock"></i> Código permanente para este dispositivo
            </div>
        </div>
    `;
}

// ============================================================
// 9. POLLING E INICIALIZAÇÃO
// ============================================================
async function atualizarPlaylist() {
    if (!playerAtivo) {
        const playlist = await buscarPlaylist();
        if (playlist && playlist.items && playlist.items.length > 0) {
            renderizarUI(playlist, '✅ Playlist disponível! Clique em "INICIAR"');
        } else {
            renderizarUI(null, '⏳ Aguardando playlist...');
        }
        return;
    }
    const playlist = await buscarPlaylist();
    if (playlist && playlist.items && playlist.items.length > 0) {
        iniciarLoop(playlist.items);
    } else {
        pararReproducao();
        voltarTelaInicial();
    }
}

(async function iniciar() {
    CODIGO_TV = await obterOuCriarCodigo();
    console.log("🔑 CÓDIGO FIXO:", CODIGO_TV);
    await registarTV();

    const playerContainer = document.createElement('div');
    playerContainer.id = 'playerContainer';
    playerContainer.className = 'player-container';
    document.body.appendChild(playerContainer);

    await atualizarPlaylist();

    document.addEventListener('fullscreenchange', function() {
        if (!document.fullscreenElement && estaEmFullscreen) {
            voltarTelaInicial();
        }
    });

    console.log("✅ TV Manager inicializado com código FIXO e autoplay melhorado!");
})();