// ============================================================
// JAVASCRIPT COMPLETO - CÓDIGO FIXO POR DISPOSITIVO
// ============================================================

// ============================================================
// 1. CONFIGURAÇÃO INICIAL
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
let playerAtivo = false;

// ============================================================
// 3. FUNÇÃO PARA GERAR ID ÚNICO E FIXO DO DISPOSITIVO
// ============================================================

function obterIdDispositivo() {
    // Tentar recuperar ID do dispositivo do localStorage
    let deviceId = localStorage.getItem("tv_device_id");
    
    if (!deviceId) {
        // GERAR ID ÚNICO BASEADO EM MÚLTIPLAS CARACTERÍSTICAS DO DISPOSITIVO
        // Isso garante que o ID seja sempre o mesmo para o mesmo dispositivo
        
        // 1. User Agent (informações do navegador)
        const userAgent = navigator.userAgent;
        
        // 2. Resolução da tela
        const screenRes = `${window.screen.width}x${window.screen.height}`;
        
        // 3. Plataforma (Windows, Mac, Linux, etc)
        const platform = navigator.platform;
        
        // 4. Idioma do navegador
        const language = navigator.language;
        
        // 5. Timestamp da primeira execução (será salvo)
        const timestamp = Date.now();
        
        // 6. Número aleatório para garantir unicidade
        const random = Math.random().toString(36).substring(2, 10);
        
        // Criar um hash combinando todas as informações
        let combinedString = `${userAgent}|${screenRes}|${platform}|${language}|${timestamp}|${random}`;
        
        // Gerar hash simples
        let hash = 0;
        for (let i = 0; i < combinedString.length; i++) {
            const char = combinedString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        // Criar ID legível
        const hashStr = Math.abs(hash).toString(36).toUpperCase();
        const timestampStr = timestamp.toString(36).toUpperCase();
        const randomStr = random.toUpperCase();
        
        deviceId = `TV-${hashStr}-${timestampStr.substring(0, 4)}-${randomStr.substring(0, 4)}`;
        
        // GUARDAR NO LOCALSTORAGE PARA SEMPRE
        localStorage.setItem("tv_device_id", deviceId);
        localStorage.setItem("tv_device_id_created", timestamp.toString());
        console.log("🆕 Novo ID do dispositivo criado (FIXO):", deviceId);
    } else {
        console.log("🔄 ID do dispositivo recuperado (FIXO):", deviceId);
    }
    
    return deviceId;
}

// ============================================================
// 4. FUNÇÃO PARA GERAR CÓDIGO FIXO BASEADO NO DEVICE ID
// ============================================================

function gerarCodigoFixo(deviceId) {
    // Pegar parte do deviceId e transformar em código legível
    // Isso garante que o código seja SEMPRE o mesmo para o mesmo dispositivo
    
    // Extrair partes do deviceId
    const parts = deviceId.split('-');
    // parts[0] = "TV"
    // parts[1] = hash
    // parts[2] = timestamp
    // parts[3] = random
    
    // Usar o hash para criar um código de 6 caracteres
    let codigoBase = parts[1] || '';
    
    // Garantir que tenha pelo menos 6 caracteres
    while (codigoBase.length < 6) {
        codigoBase += '0';
    }
    
    // Pegar os primeiros 6 caracteres
    let codigo = codigoBase.substring(0, 6);
    
    // Adicionar um caractere de verificação (checksum)
    let checksum = 0;
    for (let i = 0; i < codigo.length; i++) {
        checksum += codigo.charCodeAt(i);
    }
    const checkChar = String.fromCharCode(65 + (checksum % 26)); // A-Z
    
    // Garantir que o código seja legível (apenas letras maiúsculas e números)
    codigo = codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Se ficar muito curto, completar
    while (codigo.length < 6) {
        codigo += 'X';
    }
    
    // Formato final: 6 caracteres + 1 letra de verificação
    const codigoFinal = codigo.substring(0, 6) + checkChar;
    
    console.log("🔑 Código fixo gerado:", codigoFinal);
    return codigoFinal;
}

// ============================================================
// 5. FUNÇÕES DE API (MODIFICADAS)
// ============================================================

async function obterOuCriarCodigo() {
    // 1. Obter ID fixo do dispositivo
    const deviceId = obterIdDispositivo();
    
    // 2. Tentar recuperar código do localStorage
    let codigo = localStorage.getItem("tv_codigo");
    
    // 3. Se não tiver código no localStorage, gerar um baseado no deviceId
    if (!codigo) {
        codigo = gerarCodigoFixo(deviceId);
        localStorage.setItem("tv_codigo", codigo);
        console.log("📝 Código fixo guardado no localStorage:", codigo);
    } else {
        console.log("📝 Código fixo recuperado do localStorage:", codigo);
    }
    
    // 4. Verificar se o código existe no backend
    try {
        const response = await fetch(`${API_BASE}/api/child/${codigo}/playlist`);
        if (response.status === 404) {
            // Código não existe no backend, tentar registrar
            console.log("⚠️ Código não encontrado no backend, tentando registrar...");
            try {
                const registerResponse = await fetch(`${API_BASE}/api/tv/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        codigo: codigo,
                        device_id: deviceId
                    })
                });
                if (registerResponse.ok) {
                    const data = await registerResponse.json();
                    console.log("✅ Código registrado no backend:", data);
                } else {
                    console.warn("⚠️ Falha ao registrar código no backend");
                }
            } catch (registerError) {
                console.error("❌ Erro ao registrar código:", registerError);
            }
        } else if (response.ok) {
            console.log("✅ Código válido no backend:", codigo);
        }
    } catch (error) {
        console.warn("⚠️ Erro ao verificar código no backend:", error);
        // Mesmo com erro, manter o código fixo
    }
    
    // 5. Retornar o código (sempre o mesmo)
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
            body: JSON.stringify({ 
                codigo: codigo,
                device_id: deviceId
            })
        });
        const data = await response.json();
        console.log("TV registada no backend:", data);
        return data;
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
            console.log("📭 Ainda nenhuma playlist atribuída a esta TV.");
            return null;
        }
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const playlist = await response.json();
        console.log("📋 Playlist recebida:", playlist);
        return playlist;
    } catch (error) {
        console.error("❌ Erro ao buscar playlist:", error);
        return null;
    }
}

// ============================================================
// 6. FUNÇÃO PARA ATIVAR O PLAYER
// ============================================================

function ativarPlayer() {
    console.log("🎬 Ativando player...");
    playerAtivo = true;
    
    const appRoot = document.getElementById('appRoot');
    if (appRoot) {
        appRoot.style.display = 'none';
    }
    
    const playerContainer = document.getElementById('playerContainer');
    if (playerContainer) {
        playerContainer.classList.add('active');
    }
    
    atualizarPlaylist();
    
    if (intervaloPolling) clearInterval(intervaloPolling);
    intervaloPolling = setInterval(atualizarPlaylist, 60000);
}

// ============================================================
// 7. FUNÇÃO PARA VOLTAR À TELA INICIAL
// ============================================================

function voltarTelaInicial() {
    console.log("🏠 Voltando à tela inicial...");
    playerAtivo = false;
    
    pararReproducao();
    
    if (estaEmFullscreen) {
        sairFullscreen();
    }
    
    const playerContainer = document.getElementById('playerContainer');
    if (playerContainer) {
        playerContainer.classList.remove('active');
        playerContainer.innerHTML = '';
    }
    
    const appRoot = document.getElementById('appRoot');
    if (appRoot) {
        appRoot.style.display = 'block';
    }
    
    if (intervaloPolling) {
        clearInterval(intervaloPolling);
        intervaloPolling = null;
    }
    
    // Recarregar a UI com o código fixo
    renderizarUI(null, "Aguardando nova playlist...");
}

// ============================================================
// 8. FUNÇÕES DE FULLSCREEN
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
        <svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:white;">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
        Sair da Tela Cheia
    `;
    exitBtn.onclick = function() {
        sairFullscreen();
        voltarTelaInicial();
    };
    container.appendChild(exitBtn);
    
    const controls = document.createElement('div');
    controls.className = 'fullscreen-controls';
    controls.id = 'fullscreenControls';
    controls.innerHTML = `
        <button onclick="pauseResume()">⏸️ Pausar/Retomar</button>
        <button onclick="proximoItem()">⏭️ Próximo</button>
    `;
    container.appendChild(controls);
    
    const playerContainer = document.getElementById('playerContainer');
    if (playerContainer) {
        playerContainer.innerHTML = '';
        playerContainer.appendChild(container);
    }
    
    if (container.requestFullscreen) {
        container.requestFullscreen({
            navigationUI: 'hide'
        }).catch(err => {
            console.log("Erro ao entrar em fullscreen:", err);
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
    }
    
    estaEmFullscreen = false;
    fullscreenContainer = null;
    
    if (temporizadorMouse) {
        clearTimeout(temporizadorMouse);
        temporizadorMouse = null;
    }
}

// ============================================================
// 9. FUNÇÕES DE CONTROLE DO MOUSE
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
        const container = document.getElementById('fullscreenContainer');
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
// 10. FUNÇÕES DE REPRODUÇÃO
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
    const container = document.getElementById('fullscreenContainer');
    if (!container) {
        const playerContainer = document.getElementById('playerContainer');
        if (playerContainer) {
            const newContainer = document.createElement('div');
            newContainer.className = 'fullscreen-mode';
            newContainer.id = 'fullscreenContainer';
            playerContainer.appendChild(newContainer);
            entrarFullscreen(document.createElement('div'));
        }
        return;
    }
    
    const url = item.url;
    const mimeType = item.mime_type || '';
    const isVideo = mimeType.startsWith('video/') || url.match(/\.(mp4|webm|mov|avi)$/i);
    const isImage = mimeType.startsWith('image/') || url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    
    if (isVideo) {
        const video = document.createElement('video');
        video.src = `${API_BASE}${encodeURI(url)}`;
        video.autoplay = true;
        video.controls = false;
        
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
        
        const oldContent = container.querySelector('video, img, .no-media-fullscreen');
        if (oldContent) oldContent.remove();
        
        container.appendChild(video);
        elementoVideoAtual = video;
        video.play().catch(e => console.error("Erro ao dar play:", e));
    } 
    else if (isImage) {
        const img = document.createElement('img');
        img.src = `${API_BASE}${url}`;
        img.alt = "Imagem";
        
        img.onload = () => {
            entrarFullscreen(img);
        };
        
        const oldContent = container.querySelector('video, img, .no-media-fullscreen');
        if (oldContent) oldContent.remove();
        
        container.appendChild(img);
        
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
        entrarFullscreen(msgDiv);
        
        setTimeout(() => {
            onTerminar();
        }, 3000);
    }
}

function iniciarLoop(playlistItems) {
    pararReproducao();
    
    if (!playlistItems || playlistItems.length === 0) {
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
// 11. FUNÇÕES DE UI
// ============================================================

function renderizarUI(playlist, statusMensagem) {
    const root = document.getElementById('appRoot');
    if (!root) return;
    
    const temPlaylist = playlist && playlist.items && playlist.items.length > 0;
    const deviceId = obterIdDispositivo();
    const codigoFixo = localStorage.getItem("tv_codigo") || CODIGO_TV;
    
    root.innerHTML = `
        <div class="card tv-mode">
            <div>
                <div class="fixed-code-badge">📺 CÓDIGO DE EMPARELHAMENTO (FIXO)</div>
                <h2 style="color:#ffd9a5; margin-top: 5px;">MODO TV</h2>
                <p style="color:#bbccff; margin-bottom: 5px;">Insira o código abaixo para iniciar a reprodução</p>
                <div class="tv-code-box">
                    <div class="code-digit">${codigoFixo}</div>
                </div>
                <div style="color: #8899bb; font-size: 0.7rem; margin-top: -15px; margin-bottom: 15px;">
                    🔒 Código permanente deste dispositivo
                    <br>ID: ${deviceId.substring(0, 20)}...
                </div>
                <div class="tv-status" id="tvStatusMsg">
                    ${statusMensagem || (temPlaylist ? '✅ Playlist disponível! Clique em "INICIAR" para começar' : '⏳ Aguardando playlist...')}
                </div>
                ${temPlaylist ? `
                    <button class="btn-simular-codigo" onclick="ativarPlayer()">
                        🎬 INICIAR REPRODUÇÃO
                    </button>
                ` : `
                    <p style="color: #8899bb; font-size: 0.9rem; margin-top: 20px;">
                        Aguardando atribuição de playlist...
                    </p>
                `}
                <p style="color: #667788; font-size: 0.7rem; margin-top: 20px; border-top: 1px solid #334455; padding-top: 15px;">
                    💡 Este código é permanente para este dispositivo
                </p>
            </div>
        </div>
    `;
}

// ============================================================
// 12. FUNÇÃO PRINCIPAL - POLLING
// ============================================================

async function atualizarPlaylist() {
    if (!playerAtivo) {
        const playlist = await buscarPlaylist();
        if (playlist && playlist.items && playlist.items.length > 0) {
            renderizarUI(playlist, '✅ Playlist disponível! Clique em "INICIAR" para começar');
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

// ============================================================
// 13. INICIALIZAÇÃO
// ============================================================

(async function iniciar() {
    // 1. Obter código fixo
    CODIGO_TV = await obterOuCriarCodigo();
    console.log("🔑 CÓDIGO FIXO DA TV:", CODIGO_TV);
    console.log("🆔 ID do dispositivo:", obterIdDispositivo());
    console.log("📌 Este código NUNCA vai mudar para este dispositivo!");
    
    // 2. Registrar no backend
    await registarTV();
    
    // 3. Criar container do player
    const playerContainer = document.createElement('div');
    playerContainer.id = 'playerContainer';
    playerContainer.className = 'player-container';
    document.body.appendChild(playerContainer);
    
    // 4. Renderizar UI
    await atualizarPlaylist();
    
    // 5. Listener para sair do fullscreen
    document.addEventListener('fullscreenchange', function() {
        if (!document.fullscreenElement && estaEmFullscreen) {
            voltarTelaInicial();
        }
    });
    
    console.log("✅ TV Manager inicializado com código FIXO!");
})();