// ============================================================
// JAVASCRIPT - PÁGINA PRINCIPAL
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
let playerAberto = false;

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
// 5. FUNÇÃO PARA ABRIR PLAYER
// ============================================================

function abrirPlayer() {
    if (playerAberto) return;
    
    // Abrir a página do player em uma nova janela
    const playerWindow = window.open('player.html', '_blank', 'fullscreen=yes, menubar=no, toolbar=no, location=no, status=no, scrollbars=no');
    
    if (playerWindow) {
        playerAberto = true;
        console.log("Player aberto com sucesso!");
        
        // Enviar o código para o player
        setTimeout(() => {
            playerWindow.postMessage({
                type: 'CODIGO_TV',
                codigo: CODIGO_TV
            }, '*');
        }, 1000);
        
        // Desabilitar o botão
        const btn = document.getElementById('btnAbrirPlayer');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '🎬 Player Aberto';
        }
    } else {
        alert('Por favor, permita pop-ups para abrir o player.');
    }
}

// ============================================================
// 6. FUNÇÕES DE UI
// ============================================================

function renderizarUI(playlist, statusMensagem) {
    const root = document.getElementById('appRoot');
    if (!root) return;
    
    const temPlaylist = playlist && playlist.items && playlist.items.length > 0;
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
                    ${statusMensagem || (temPlaylist ? `Playlist disponível!` : 'A aguardar pela playlist...')}
                </div>
                ${temPlaylist ? `
                    <button id="btnAbrirPlayer" class="btn-abrir-player" onclick="abrirPlayer()">
                        🎬 ABRIR PLAYER
                    </button>
                    <p style="color: #8899bb; font-size: 0.9rem; margin-top: 10px;">
                        Clique para abrir a reprodução em tela cheia
                    </p>
                ` : `
                    <p style="color: #8899bb; font-size: 0.9rem; margin-top: 20px;">
                        Aguardando atribuição de playlist...
                    </p>
                `}
            </div>
        </div>
    `;
}

// ============================================================
// 7. FUNÇÃO PRINCIPAL - POLLING
// ============================================================

async function atualizarPlaylist() {
    const playlist = await buscarPlaylist();
    
    if (playlist && playlist.items && playlist.items.length > 0) {
        renderizarUI(playlist, `Playlist: ${playlist.name} (${playlist.items.length} itens)`);
    } else {
        renderizarUI(null, "Nenhuma playlist atribuída. A aguardar...");
    }
}

// ============================================================
// 8. INICIALIZAÇÃO
// ============================================================

(async function iniciar() {
    CODIGO_TV = await obterOuCriarCodigo();
    console.log("Código da TV (fixo):", CODIGO_TV);
    console.log("ID do dispositivo:", obterIdDispositivo());
    
    await registarTV();
    await atualizarPlaylist();
    
    if (intervaloPolling) clearInterval(intervaloPolling);
    intervaloPolling = setInterval(atualizarPlaylist, 30000);
    
    // Salvar código no localStorage para o player
    localStorage.setItem("tv_codigo_player", CODIGO_TV);
})();