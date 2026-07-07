// ============================================================
// JAVASCRIPT COMPLETO - SEM AUTO-REGISTO (CORRIGIDO)
// ============================================================

// Antes: const API_BASE = "http://127.0.0.1:5000";
// Agora usa o mesmo host/protocolo de onde a página tv.html foi carregada,
// mas mantém a porta 5000 do servidor Flask. Isto permite que a TV funcione
// quando corre num dispositivo diferente do PC onde está o servidor.
const API_BASE = `${window.location.protocol}//${window.location.hostname}:5000`;

// ============================================================
// WEBSOCKET
// ============================================================
const socket = io(API_BASE, {
  transports: ["websocket", "polling"],
});

socket.on("connect", function () {
  console.log("✅ Conectado ao servidor WebSocket");
  const codigo = localStorage.getItem("tv_codigo");
  if (codigo) {
    socket.emit("register_tv", { codigo });
  }
});

socket.on("disconnect", function () {
  console.log("❌ Desconectado do servidor WebSocket");
});

socket.on("playlist_updated", function (data) {
  console.log("🔄 Playlist atualizada!", data);
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
let ultimaPlaylistJSON = null; // usado para saber se a playlist realmente mudou
let audioDesbloqueado = false; // torna-se true depois de um clique/toque no botão "Ativar som"

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
      hash = (hash << 5) - hash + char;
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
// 3. CÓDIGO FIXO (gerado localmente, nunca enviado para registo)
// ============================================================
function gerarCodigoFixo(deviceId) {
  const parts = deviceId.split("-");
  let codigoBase = parts[1] || "";
  while (codigoBase.length < 6) codigoBase += "0";
  let codigo = codigoBase.substring(0, 6);
  let checksum = 0;
  for (let i = 0; i < codigo.length; i++) {
    checksum += codigo.charCodeAt(i);
  }
  const checkChar = String.fromCharCode(65 + (checksum % 26));
  codigo = codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
  while (codigo.length < 6) codigo += "X";
  return codigo.substring(0, 6) + checkChar;
}

// ============================================================
// 4. FUNÇÕES DE API (apenas consulta, sem registo)
// ============================================================
async function obterOuCriarCodigo() {
  const deviceId = obterIdDispositivo();
  let codigo = localStorage.getItem("tv_codigo");
  if (!codigo) {
    codigo = gerarCodigoFixo(deviceId);
    localStorage.setItem("tv_codigo", codigo);
    console.log("📝 Código fixo gerado:", codigo);
  }
  CODIGO_TV = codigo;
  return codigo;
}

async function buscarPlaylist() {
  try {
    const codigo = localStorage.getItem("tv_codigo") || CODIGO_TV;
    const response = await fetch(`${API_BASE}/api/child/${codigo}/playlist`);
    if (response.status === 404) {
      console.log("📭 Ainda sem playlist atribuída.");
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

  const appRoot = document.getElementById("appRoot");
  if (appRoot) appRoot.style.display = "none";

  const playerContainer = document.getElementById("playerContainer");
  if (playerContainer) playerContainer.classList.add("active");

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

  // Avisa o painel administrativo que esta TV já não está a mostrar nada.
  if (CODIGO_TV) {
    socket.emit("now_playing", {
      codigo: CODIGO_TV,
      item_name: null,
      tipo: null,
    });
  }

  const playerContainer = document.getElementById("playerContainer");
  if (playerContainer) {
    playerContainer.classList.remove("active");
    playerContainer.innerHTML = "";
  }

  const appRoot = document.getElementById("appRoot");
  if (appRoot) appRoot.style.display = "block";

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
  const playerContainer = document.getElementById("playerContainer");
  if (!playerContainer) return;

  let container = document.getElementById("fullscreenContainer");
  if (!container) {
    container = document.createElement("div");
    container.className = "fullscreen-mode";
    container.id = "fullscreenContainer";
    playerContainer.appendChild(container);
  }

  const old = container.querySelector(
    "video, img, .no-media-fullscreen, .play-overlay",
  );
  if (old && old !== elemento) {
    old.remove();
  }

  if (elemento.parentNode !== container) {
    if (elemento.parentNode) elemento.parentNode.removeChild(elemento);
    container.appendChild(elemento);
  }

  elemento.style.width = "100vw";
  elemento.style.height = "100vh";
  elemento.style.objectFit = "contain";
  elemento.style.display = "block";
  elemento.style.background = "#000";
  elemento.style.borderRadius = "0";

  if (elemento.tagName === "VIDEO") {
    const video = elemento;
    // O vídeo só toca com som se o utilizador já tiver clicado uma vez
    // no botão "Ativar som" nesta sessão (audioDesbloqueado). Antes
    // disso, tem de estar "muted" para o autoplay ser permitido pelo
    // browser sem interação humana.
    video.muted = !audioDesbloqueado;
    video.controls = false;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    tryPlayVideo(video);
  }

  let exitBtn = document.getElementById("exitFullscreenBtn");
  if (!exitBtn) {
    exitBtn = document.createElement("button");
    exitBtn.id = "exitFullscreenBtn";
    exitBtn.className = "exit-fullscreen-btn";
    exitBtn.innerHTML = '<i class="fas fa-times-circle"></i> Sair';
    exitBtn.onclick = function () {
      sairFullscreen();
      voltarTelaInicial();
    };
    container.appendChild(exitBtn);
  }

  let controls = document.getElementById("fullscreenControls");
  if (!controls) {
    controls = document.createElement("div");
    controls.className = "fullscreen-controls";
    controls.id = "fullscreenControls";
    controls.innerHTML = `
            <button onclick="window.pauseResume()"><i class="fas fa-pause"></i> Pausar</button>
            <button onclick="window.proximoItem()"><i class="fas fa-forward"></i> Próximo</button>
        `;
    container.appendChild(controls);
  }

  container.addEventListener("mousemove", mostrarControles);
  container.addEventListener("mouseleave", ocultarControles);

  if (!estaEmFullscreen) {
    if (container.requestFullscreen) {
      container.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    }
    estaEmFullscreen = true;
    fullscreenContainer = container;
  }

  mostrarControles();
}

function tryPlayVideo(video, tentativas = 0) {
  if (tentativas > 10) {
    console.log("⚠️ Falha no autoplay após 10 tentativas");
    mostrarOverlayPlay(video);
    return;
  }

  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        console.log(
          "✅ Vídeo em reprodução automática!" +
            (video.muted ? " (sem som)" : " (com som)"),
        );
        if (video.muted && !audioDesbloqueado) {
          // O vídeo está a tocar, mas sem som (bloqueio do browser).
          // Mostra um botão discreto para ativar o som com um clique.
          mostrarBotaoAtivarSom();
        } else {
          esconderBotaoAtivarSom();
        }
      })
      .catch((error) => {
        if (!video.muted) {
          // O browser bloqueou o autoplay COM som. Em vez de ficar
          // preso, muta o vídeo já para pelo menos continuar a
          // mostrar a imagem, e mostra o botão para ativar o som.
          console.log(
            "⚠️ Autoplay com som bloqueado, a tocar sem som por agora...",
          );
          video.muted = true;
          tryPlayVideo(video, 0);
          return;
        }
        console.log(
          `⚠️ Tentativa ${tentativas + 1}: Autoplay bloqueado, tentando novamente...`,
        );
        setTimeout(() => {
          tryPlayVideo(video, tentativas + 1);
        }, 500);
      });
  }
}

function mostrarBotaoAtivarSom() {
  if (document.getElementById("ativarSomBtn")) return;

  const btn = document.createElement("button");
  btn.id = "ativarSomBtn";
  btn.innerHTML = '<i class="fas fa-volume-mute"></i> Ativar som';
  btn.style.cssText = `
        position: fixed;
        bottom: 40px;
        left: 40px;
        z-index: 10000;
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(12px);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.15);
        padding: 12px 22px;
        border-radius: 40px;
        font-size: 0.95rem;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
    `;

  btn.onclick = function () {
    // A partir daqui, este e todos os próximos vídeos desta sessão
    // (até a página recarregar) tocam com som automaticamente.
    audioDesbloqueado = true;
    const video = document.querySelector("#fullscreenContainer video");
    if (video) {
      video.muted = false;
      video.play().catch(() => {});
    }
    btn.remove();
  };

  document.body.appendChild(btn);
}

function esconderBotaoAtivarSom() {
  const btn = document.getElementById("ativarSomBtn");
  if (btn) btn.remove();
}

function mostrarOverlayPlay(video) {
  const container = video.parentNode;
  if (!container) return;

  const overlay = document.createElement("div");
  overlay.className = "play-overlay";
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
  overlay.querySelector("i").style.fontSize = "4rem";

  overlay.addEventListener("click", function () {
    video.play();
    this.remove();
  });

  container.appendChild(overlay);

  setTimeout(() => {
    video
      .play()
      .then(() => {
        overlay.remove();
      })
      .catch(() => {});
  }, 2000);
}

function sairFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  const container = document.getElementById("fullscreenContainer");
  if (container) {
    container.removeEventListener("mousemove", mostrarControles);
    container.removeEventListener("mouseleave", ocultarControles);
  }
  estaEmFullscreen = false;
  fullscreenContainer = null;
  if (temporizadorMouse) {
    clearTimeout(temporizadorMouse);
    temporizadorMouse = null;
  }
}

function mostrarControles() {
  const exitBtn = document.getElementById("exitFullscreenBtn");
  const controls = document.getElementById("fullscreenControls");
  if (exitBtn) exitBtn.classList.add("visible");
  if (controls) controls.classList.add("visible");
  if (temporizadorMouse) clearTimeout(temporizadorMouse);
  temporizadorMouse = setTimeout(ocultarControles, 4000);
}

function ocultarControles() {
  const exitBtn = document.getElementById("exitFullscreenBtn");
  const controls = document.getElementById("fullscreenControls");
  if (exitBtn) exitBtn.classList.remove("visible");
  if (controls) controls.classList.remove("visible");
  if (temporizadorMouse) {
    clearTimeout(temporizadorMouse);
    temporizadorMouse = null;
  }
}

window.pauseResume = function () {
  const container = document.getElementById("fullscreenContainer");
  if (!container) return;
  const video = container.querySelector("video");
  if (video) {
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }
  mostrarControles();
};

window.proximoItem = function () {
  if (temporizadorAtual) {
    clearTimeout(temporizadorAtual);
    temporizadorAtual = null;
  }
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
    elementoVideoAtual.currentTime = 0;
    elementoVideoAtual = null;
  }
  reprodutorAtivo = false;
}

function reproduzirItem(item, onTerminar) {
  console.log("🎬 Reproduzindo item:", item);

  // Garante que só chamamos onTerminar uma vez por item, mesmo que
  // vários caminhos (onended, timeout de segurança, onerror) disparem.
  let jaTerminou = false;
  const terminarUmaVez = () => {
    if (jaTerminou) return;
    jaTerminou = true;
    onTerminar();
  };

  const playerContainer = document.getElementById("playerContainer");
  if (!playerContainer) {
    console.error("❌ Player container não encontrado");
    setTimeout(terminarUmaVez, 1000);
    return;
  }

  let container = document.getElementById("fullscreenContainer");
  if (!container) {
    container = document.createElement("div");
    container.className = "fullscreen-mode";
    container.id = "fullscreenContainer";
    playerContainer.appendChild(container);
  }

  const url = item.url;
  const mimeType = item.mime_type || "";
  const isVideo =
    mimeType.startsWith("video/") || /\.(mp4|webm|mov|avi|mkv)$/i.test(url);
  const isImage =
    mimeType.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);

  // Avisa o servidor (e assim o painel administrativo) do que esta TV está
  // a mostrar agora, para aparecer em "A reproduzir agora" no painel.
  socket.emit("now_playing", {
    codigo: CODIGO_TV,
    item_name: item.name || item.filename || "Sem nome",
    tipo: isVideo ? "video" : isImage ? "imagem" : "outro",
  });

  const oldContent = container.querySelector(
    "video, img, .no-media-fullscreen, .play-overlay",
  );
  if (oldContent) oldContent.remove();

  if (isVideo) {
    console.log("🎥 Reproduzindo vídeo:", url);
    const video = document.createElement("video");
    const videoUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
    video.src = videoUrl;
    video.autoplay = true;
    video.controls = false;
    // O vídeo começa mudo, a não ser que o som já tenha sido desbloqueado
    // nesta sessão (ver mostrarBotaoAtivarSom / tryPlayVideo). Sem isto,
    // o autoplay com som é bloqueado pelo browser (não há interação do
    // utilizador na TV) e o vídeo fica preso para sempre, nunca disparando
    // "onended" e nunca avançando para o item seguinte da playlist.
    video.muted = !audioDesbloqueado;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.style.width = "100vw";
    video.style.height = "100vh";
    video.style.objectFit = "contain";
    video.style.background = "#000";

    video.onloadedmetadata = function () {
      console.log("📹 Vídeo carregado:", videoUrl);
      entrarFullscreen(video);
    };

    video.oncanplay = function () {
      console.log("▶️ Vídeo pronto, iniciando autoplay...");
      tryPlayVideo(video);
    };

    video.onended = function () {
      console.log("⏹️ Vídeo terminou");
      elementoVideoAtual = null;
      terminarUmaVez();
    };

    video.onerror = function (e) {
      console.error("❌ Erro no vídeo:", e);
      console.error("URL do vídeo:", videoUrl);
      elementoVideoAtual = null;
      setTimeout(terminarUmaVez, 2000);
    };

    container.appendChild(video);
    elementoVideoAtual = video;

    if (video.readyState >= 2) {
      video.oncanplay();
    }

    // ADICIONADO: rede de segurança. Se por qualquer motivo o vídeo
    // nunca chegar a reproduzir (ex.: ficheiro corrompido, formato não
    // suportado, política do browser), a playlist avança mesmo assim
    // ao fim de duration_seconds (ou 15s por defeito), em vez de
    // ficar presa para sempre neste item.
    const duracaoMaximaVideo = (item.duration_seconds || 15) * 1000 + 15000;
    temporizadorAtual = setTimeout(() => {
      temporizadorAtual = null;
      terminarUmaVez();
    }, duracaoMaximaVideo);
  } else if (isImage) {
    console.log("🖼️ Reproduzindo imagem:", url);
    const img = document.createElement("img");
    const imgUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
    img.src = imgUrl;
    img.alt = "Imagem";
    img.style.width = "100vw";
    img.style.height = "100vh";
    img.style.objectFit = "contain";
    img.style.background = "#000";

    img.onload = function () {
      console.log("✅ Imagem carregada");
      entrarFullscreen(img);
    };

    img.onerror = function () {
      console.error("❌ Erro ao carregar imagem:", imgUrl);
      terminarUmaVez();
    };

    container.appendChild(img);

    const duracao = (item.duration_seconds || 10) * 1000;
    temporizadorAtual = setTimeout(() => {
      temporizadorAtual = null;
      terminarUmaVez();
    }, duracao);
  } else {
    console.log("📄 Item sem mídia reconhecida:", item);
    const msgDiv = document.createElement("div");
    msgDiv.className = "no-media-fullscreen";
    msgDiv.textContent = `📺 ${item.name || "Conteúdo indisponível"}`;
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
    setTimeout(() => {
      terminarUmaVez();
    }, 3000);
  }
}

function avancarLoop() {
  if (!reprodutorAtivo) return;
  if (indiceAtual >= itemsPlaylist.length) indiceAtual = 0;
  const item = itemsPlaylist[indiceAtual];
  indiceAtual++;
  reproduzirItem(item, () => {
    avancarLoop();
  });
}

function iniciarReproducao() {
  pararReproducao();

  if (!itemsPlaylist || itemsPlaylist.length === 0) {
    console.log("📭 Nenhum item para reproduzir");
    return;
  }

  console.log(
    "▶️ Iniciando loop de reprodução com",
    itemsPlaylist.length,
    "itens",
  );
  indiceAtual = 0;
  reprodutorAtivo = true;

  const playerContainer = document.getElementById("playerContainer");
  if (playerContainer) {
    let container = document.getElementById("fullscreenContainer");
    if (!container) {
      container = document.createElement("div");
      container.className = "fullscreen-mode";
      container.id = "fullscreenContainer";
      playerContainer.appendChild(container);
    }
  }

  avancarLoop();
}

// ============================================================
// 8. UI
// ============================================================
function renderizarUI(playlist, statusMensagem) {
  const root = document.getElementById("appRoot");
  if (!root) return;

  const temPlaylist = playlist && playlist.items && playlist.items.length > 0;
  const deviceId = obterIdDispositivo();
  const codigoFixo = localStorage.getItem("tv_codigo") || CODIGO_TV;

  root.innerHTML = `
        <div class="card tv-mode">
            <div class="fixed-code-badge"><i class="fas fa-code"></i> CÓDIGO DE EMPARELHAMENTO</div>
            <h2>TV Manager</h2>
            <p class="subtitle">Insira o código abaixo no painel administrativo</p>
            <div class="tv-code-box">
                <div class="code-digit">${codigoFixo}</div>
            </div>
            <div class="device-id">ID: ${deviceId.substring(0, 20)}...</div>
            <div class="tv-status" id="tvStatusMsg">
                ${statusMensagem || (temPlaylist ? "✅ Playlist disponível! Iniciando automaticamente..." : "⏳ Aguardando playlist...")}
            </div>
            ${
              temPlaylist
                ? `
                <div class="autoplay-status">
                    <i class="fas fa-spinner fa-spin"></i> A iniciar automaticamente...
                </div>
            `
                : `
                <p style="color: #64748b; margin-top: 20px; font-size: 0.9rem;">
                    <i class="fas fa-circle-notch fa-spin"></i> Aguardando atribuição de playlist...
                </p>
            `
            }
            <div class="footer-note">
                <i class="fas fa-lock"></i> Código permanente para este dispositivo
            </div>
        </div>
    `;

  if (temPlaylist && !playerAtivo && !iniciadoAutomaticamente) {
    iniciadoAutomaticamente = true;
    console.log("🚀 Iniciando reprodução automática em 2 segundos...");
    setTimeout(() => {
      ativarPlayer();
    }, 2000);
  }
}

// ============================================================
// 9. POLLING E INICIALIZAÇÃO
// ============================================================
async function atualizarPlaylist() {
  console.log("🔄 Atualizando playlist...");

  const playlist = await buscarPlaylist();

  if (playlist && playlist.items && playlist.items.length > 0) {
    const playlistJSON = JSON.stringify(playlist.items);
    const mudou = playlistJSON !== ultimaPlaylistJSON;
    ultimaPlaylistJSON = playlistJSON;
    itemsPlaylist = playlist.items;
    console.log("📋 Playlist carregada:", itemsPlaylist.length, "itens");

    if (!playerAtivo) {
      renderizarUI(
        playlist,
        "✅ Playlist disponível! Iniciando automaticamente...",
      );
    } else if (mudou) {
      // CORRIGIDO: só reinicia a reprodução se a playlist realmente
      // mudou. Antes, isto reiniciava do zero a cada 30 segundos
      // mesmo sem nenhuma alteração, interrompendo o vídeo/imagem
      // que estava a ser mostrado.
      console.log("🔄 Playlist mudou, reiniciando reprodução...");
      iniciarReproducao();
    }
  } else {
    ultimaPlaylistJSON = null;
    iniciadoAutomaticamente = false;
    if (!playerAtivo) {
      renderizarUI(null, "⏳ Aguardando playlist...");
    } else {
      voltarTelaInicial();
    }
  }
}

// ============================================================
// 10. INICIALIZAÇÃO
// ============================================================
(async function iniciar() {
  console.log("🚀 Inicializando TV Manager (sem auto-registo)...");

  CODIGO_TV = await obterOuCriarCodigo();
  console.log("🔑 CÓDIGO FIXO:", CODIGO_TV);

  socket.emit("register_tv", { codigo: CODIGO_TV });

  // CORRIGIDO: removida a criação de um segundo <div id="playerContainer">.
  // O tv.html já tem este elemento estático; criar outro com o mesmo id
  // gera HTML inválido (dois elementos com o mesmo id) e um nó órfão
  // sem uso real, porque getElementById sempre devolve o primeiro.

  await atualizarPlaylist();

  document.addEventListener("fullscreenchange", function () {
    if (!document.fullscreenElement && estaEmFullscreen) {
      voltarTelaInicial();
    }
  });

  if (intervaloPolling) clearInterval(intervaloPolling);
  intervaloPolling = setInterval(atualizarPlaylist, 30000);

  console.log("✅ TV Manager inicializado com sucesso!");
  console.log("🎯 Aguardando atribuição de playlist pelo administrador.");
})();
