// ============================================================
// JAVASCRIPT COMPLETO - SEM CONTROLES - FULLSCREEN AUTOMÁTICO
// (Ativado por clique único do utilizador; depois de F11 = autoplay)
// ============================================================

var SERVER_HOST = window.location.hostname;
var API_BASE = "http://" + SERVER_HOST + ":5000";

// ============================================================
// WEBSOCKET (com fallback)
// ============================================================
var socket = null;
try {
  socket = io("http://" + SERVER_HOST + ":5000", {
    transports: ["websocket", "polling"],
    timeout: 5000,
  });

  socket.on("connect", function () {
    console.log("✅ Conectado ao servidor WebSocket");
  });

  socket.on("disconnect", function () {
    console.log("❌ Desconectado do servidor WebSocket");
  });

  socket.on("registered", function (data) {
    console.log("📡 TV registada no WebSocket:", data);
  });

  socket.on("playlist_updated", function (data) {
    console.log("🔄 Playlist atualizada!", data);
    atualizarPlaylist();
  });
} catch (e) {
  console.log("⚠️ WebSocket não disponível, usando polling apenas");
  socket = null;
}

// ============================================================
// 1. VARIÁVEIS GLOBAIS
// ============================================================
var CODIGO_TV = null;
var intervaloPolling = null;
var reprodutorAtivo = false;
var itemsPlaylist = [];
var indiceAtual = 0;
var temporizadorAtual = null;
var elementoVideoAtual = null;
var estaEmFullscreen = false;
var fullscreenContainer = null;
var playerAtivo = false;
var iniciadoAutomaticamente = false;

// O requestFullscreen exige um gesto do utilizador. Sem --kiosk não é
// possível entrar em ecrã cheio sem pelo menos um clique, por isso
// mostramos um overlay “toque para começar” e, ao primeiro gesto, pedimos
// `requestFullscreen` no documentElement e removemos o overlay. Estando
// em ecrã cheio, o resto do fluxo (autoplay, loop, F11 mantido ao longo
// da sessão) decorre sem novas intervenções.
var iniciadoPorClique = false;
var gestoListenersAdicionados = false;

// ============================================================
// 2. ID FIXO DO DISPOSITIVO
// ============================================================
function obterIdDispositivo() {
  var deviceId = localStorage.getItem("tv_device_id");
  if (!deviceId) {
    var userAgent = navigator.userAgent;
    var screenRes = window.screen.width + "x" + window.screen.height;
    var platform = navigator.platform;
    var language = navigator.language;
    var timestamp = Date.now();
    var random = Math.random().toString(36).substring(2, 10);
    var combinedString =
      userAgent +
      "|" +
      screenRes +
      "|" +
      platform +
      "|" +
      language +
      "|" +
      timestamp +
      "|" +
      random;
    var hash = 0;
    for (var i = 0; i < combinedString.length; i++) {
      var char = combinedString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    var hashStr = Math.abs(hash).toString(36).toUpperCase();
    var timestampStr = timestamp.toString(36).toUpperCase();
    var randomStr = random.toUpperCase();
    deviceId =
      "TV-" +
      hashStr +
      "-" +
      timestampStr.substring(0, 4) +
      "-" +
      randomStr.substring(0, 4);
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
  var parts = deviceId.split("-");
  var codigoBase = parts[1] || "";
  while (codigoBase.length < 6) codigoBase += "0";
  var codigo = codigoBase.substring(0, 6);
  var checksum = 0;
  for (var i = 0; i < codigo.length; i++) {
    checksum += codigo.charCodeAt(i);
  }
  var checkChar = String.fromCharCode(65 + (checksum % 26));
  codigo = codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
  while (codigo.length < 6) codigo += "X";
  return codigo.substring(0, 6) + checkChar;
}

// ============================================================
// 4. FUNÇÕES DE API
// ============================================================
async function obterOuCriarCodigo() {
  var deviceId = obterIdDispositivo();
  var codigo = localStorage.getItem("tv_codigo");
  if (!codigo) {
    codigo = gerarCodigoFixo(deviceId);
    localStorage.setItem("tv_codigo", codigo);
    console.log("📝 Código fixo guardado:", codigo);
  }
  try {
    var response = await fetch(API_BASE + "/api/child/" + codigo + "/playlist");
    if (response.status === 404) {
      console.log("⚠️ Código não encontrado, registando...");
      // Vai registar-se na função registarTV()
    }
  } catch (error) {
    console.warn("⚠️ Erro ao verificar código:", error);
  }
  CODIGO_TV = codigo;
  return codigo;
}

// ============================================================
// FUNÇÃO REGISTAR TV CORRIGIDA (usa /api/tvs)
// ============================================================
async function registarTV() {
  try {
    if (socket) {
      socket.emit("register_tv", { codigo: CODIGO_TV });
    }
    var deviceId = obterIdDispositivo();
    var codigo = localStorage.getItem("tv_codigo") || CODIGO_TV;
    var response = await fetch(API_BASE + "/api/tvs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "TV-" + codigo,
        codigo: codigo,
        ip: null,
      }),
    });
    if (response.status === 409) {
      console.log("ℹ️ TV já registada.");
      return { status: "already_registered" };
    }
    if (!response.ok) {
      throw new Error("Erro " + response.status);
    }
    return await response.json();
  } catch (error) {
    console.error("❌ Erro ao registar TV:", error);
    return null;
  }
}

async function buscarPlaylist() {
  try {
    var codigo = localStorage.getItem("tv_codigo") || CODIGO_TV;
    var response = await fetch(API_BASE + "/api/child/" + codigo + "/playlist");
    if (response.status === 404) {
      console.log("📭 Ainda sem playlist.");
      return null;
    }
    if (!response.ok) throw new Error("Erro " + response.status);
    var data = await response.json();
    console.log("📋 Playlist recebida:", data);
    return data;
  } catch (error) {
    console.error("❌ Erro ao buscar playlist:", error);
    return null;
  }
}

// ============================================================
// 5. ENVIAR ESTADO "A REPRODUZIR AGORA" PARA O SERVIDOR
// ============================================================
function enviarNowPlaying(item) {
  if (!CODIGO_TV || !socket) return;
  if (item) {
    var tipo = "desconhecido";
    if (item.mime_type && item.mime_type.startsWith("video/")) tipo = "video";
    else if (item.mime_type && item.mime_type.startsWith("image/"))
      tipo = "imagem";
    socket.emit("now_playing", {
      codigo: CODIGO_TV,
      item_name: item.original_name || item.filename || "",
      tipo: tipo,
      url: item.url || "",
    });
  } else {
    socket.emit("now_playing", {
      codigo: CODIGO_TV,
      item_name: null,
      tipo: null,
      url: null,
    });
  }
}

// ============================================================
// 6. PLAYER - INÍCIO AUTOMÁTICO
// ============================================================
function ativarPlayer() {
  console.log("🎬 Ativando player automaticamente...");
  playerAtivo = true;

  var appRoot = document.getElementById("appRoot");
  if (appRoot) appRoot.style.display = "none";

  var playerContainer = document.getElementById("playerContainer");
  if (playerContainer) playerContainer.classList.add("active");

  setTimeout(function () {
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

  var todosVideos = document.querySelectorAll("video");
  todosVideos.forEach(function (v) {
    v.pause();
    v.currentTime = 0;
    v.src = "";
    v.load();
  });

  if (estaEmFullscreen) sairFullscreen();

  var playerContainer = document.getElementById("playerContainer");
  if (playerContainer) {
    playerContainer.classList.remove("active");
    playerContainer.innerHTML = "";
  }

  var appRoot = document.getElementById("appRoot");
  if (appRoot) appRoot.style.display = "block";

  if (intervaloPolling) {
    clearInterval(intervaloPolling);
    intervaloPolling = null;
  }

  renderizarUI(null, "⏳ Aguardando playlist...");
}

// ============================================================
// 6.5. OVERLAY "TOQUE PARA INICIAR" + F11 AUTOMÁTICO POR GESTO
// ============================================================
function mostrarPromptIniciar() {
  if (document.getElementById("iniciarOverlay")) return;
  var overlay = document.createElement("div");
  overlay.id = "iniciarOverlay";
  overlay.className = "start-overlay";
  overlay.innerHTML =
    '<div class="start-overlay-inner">' +
    '<div class="start-icon">📺</div>' +
    '<div class="start-title">TV Manager</div>' +
    '<div class="start-text">Toque ou clique para iniciar em ecrã cheio</div>' +
    "</div>";
  document.body.appendChild(overlay);
}

function removerPromptIniciar() {
  var overlay = document.getElementById("iniciarOverlay");
  if (overlay) overlay.remove();
}

function tentarEntrarFullscreenEl(el) {
  try {
    if (el.requestFullscreen) {
      return el.requestFullscreen({ navigationUI: "hide" });
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.mozRequestFullScreen) {
      el.mozRequestFullScreen();
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
    }
  } catch (e) {
    console.warn("⚠️ Erro a pedir fullscreen:", e);
  }
  return null;
}

function iniciarPorClique() {
  // Torna-se idempotente: o utilizador pode clicar várias vezes (e.g.
  // depois de sair com Esc). Apenas saltamos se já estamos efetivamente
  // em fullscreen — caso contrário pedimos novamente e deixamos remover
  // o overlay.
  var jaFullscreen = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
  removerPromptIniciar();
  if (jaFullscreen) {
    iniciadoPorClique = true;
    // Garante que o player arranca se a playlist já chegou entretanto.
    if (itemsPlaylist && itemsPlaylist.length > 0 && !playerAtivo) {
      ativarPlayer();
    }
    return;
  }

  iniciadoPorClique = true;
  var el = document.documentElement;
  var p = tentarEntrarFullscreenEl(el);
  // Em browsers modernos, requestFullscreen devolve uma Promise que pode
  // ser rejeitada (e.g. num iframe sem allow="fullscreen"). Tratamos o erro
  // silenciosamente e continuamos em modo janela, mas o utilizador já
  // concedeu o gesto, por isso o autoplay subsequente fica desbloqueado.
  if (p && typeof p.then === "function") {
    p.then(function () {
      estaEmFullscreen = true;
    }).catch(function (err) {
      console.warn("⚠️ Fullscreen negado pelo browser:", err);
    });
  }

  // Se a playlist já tinha chegado antes do clique, arrancar já.
  if (itemsPlaylist && itemsPlaylist.length > 0 && !playerAtivo) {
    ativarPlayer();
  }
}

function instalarGestoInicial() {
  if (gestoListenersAdicionados) return;
  gestoListenersAdicionados = true;
  var opts = { passive: true };
  document.addEventListener("click", iniciarPorClique, opts);
  document.addEventListener("touchstart", iniciarPorClique, opts);
  document.addEventListener("keydown", iniciarPorClique, opts);
}

// ============================================================
// 7. FULLSCREEN AUTOMÁTICO (F11) - SEM CONTROLES
// ============================================================
function entrarFullscreen(elemento) {
  var playerContainer = document.getElementById("playerContainer");
  if (!playerContainer) return;

  var container = document.getElementById("fullscreenContainer");
  if (!container) {
    container = document.createElement("div");
    container.className = "fullscreen-mode";
    container.id = "fullscreenContainer";
    playerContainer.appendChild(container);
  }

  var oldVideo = container.querySelector("video");
  if (oldVideo) {
    oldVideo.pause();
    oldVideo.currentTime = 0;
    oldVideo.src = "";
    oldVideo.load();
  }

  var old = container.querySelector(
    "video, img, .no-media-fullscreen, .play-overlay",
  );
  if (old) old.remove();

  var clone = elemento.cloneNode(true);
  clone.style.width = "100vw";
  clone.style.height = "100vh";
  clone.style.objectFit = "contain";
  clone.style.display = "block";
  clone.style.background = "#000";
  clone.style.borderRadius = "0";
  container.appendChild(clone);

  if (clone.tagName === "VIDEO") {
    var video = clone;
    video.muted = false;
    video.controls = false;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("x-webkit-airplay", "allow");
    tryPlayVideo(video, container);
  }

  // O fullscreen já é tratado a nível do documentElement (ver
  // iniciarPorClique), portanto NÃO pedimos requestFullscreen aqui —
  // isso causaria uma transição “aninhada” mal suportada pela maioria
  // dos browsers. Limitamo-nos a registar o container ativo e a
  // mostrar o conteúdo lá dentro.
  if (!estaEmFullscreen) {
    estaEmFullscreen = true;
    fullscreenContainer = container;
  }
}

function tryPlayVideo(video, container, tentativas) {
  tentativas = tentativas || 0;
  if (tentativas > 10) {
    console.log("⚠️ Falha no autoplay após 10 tentativas");
    mostrarOverlayPlay(video, container);
    return;
  }

  var playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise
      .then(function () {
        console.log("✅ Vídeo em reprodução automática!");
      })
      .catch(function (error) {
        console.log(
          "⚠️ Tentativa " +
            (tentativas + 1) +
            ": Autoplay bloqueado, tentando novamente...",
        );
        setTimeout(function () {
          tryPlayVideo(video, container, tentativas + 1);
        }, 500);
      });
  }
}

function mostrarOverlayPlay(video, container) {
  var overlay = document.createElement("div");
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

  setTimeout(function () {
    var playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(function () {
          overlay.remove();
          console.log("✅ Vídeo iniciado após tentativa!");
        })
        .catch(function () {});
    }
  }, 2000);

  container.appendChild(overlay);
}

function sairFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(function () {});
  } else if (document.webkitFullscreenElement) {
    document.webkitExitFullscreen();
  } else if (document.msFullscreenElement) {
    document.msExitFullscreen();
  } else if (document.mozFullScreenElement) {
    document.mozCancelFullScreen();
  }

  var container = document.getElementById("fullscreenContainer");
  if (container) {
    container.removeEventListener("mousemove", mostrarControles);
    container.removeEventListener("mouseleave", ocultarControles);
  }
  estaEmFullscreen = false;
  fullscreenContainer = null;
}

// ============================================================
// 8. REPRODUÇÃO DE ITENS (com envio de now playing)
// ============================================================
function pararReproducao() {
  if (temporizadorAtual) {
    clearTimeout(temporizadorAtual);
    temporizadorAtual = null;
  }
  if (elementoVideoAtual) {
    elementoVideoAtual.pause();
    elementoVideoAtual.currentTime = 0;
    elementoVideoAtual.src = "";
    elementoVideoAtual.load();
    elementoVideoAtual = null;
  }
  var todosVideos = document.querySelectorAll("video");
  todosVideos.forEach(function (v) {
    v.pause();
    v.currentTime = 0;
  });
  reprodutorAtivo = false;
  enviarNowPlaying(null);
}

function reproduzirItem(item, onTerminar) {
  console.log("🎬 Reproduzindo item:", item);

  var playerContainer = document.getElementById("playerContainer");
  if (!playerContainer) {
    console.error("❌ Player container não encontrado");
    setTimeout(onTerminar, 1000);
    return;
  }

  var container = document.getElementById("fullscreenContainer");
  if (!container) {
    container = document.createElement("div");
    container.className = "fullscreen-mode";
    container.id = "fullscreenContainer";
    playerContainer.appendChild(container);
  }

  var url = item.url;
  var mimeType = item.mime_type || "";
  var isVideo =
    mimeType.startsWith("video/") || url.match(/\.(mp4|webm|mov|avi|mkv)$/i);
  var isImage =
    mimeType.startsWith("image/") ||
    url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);

  var oldVideo = container.querySelector("video");
  if (oldVideo) {
    oldVideo.pause();
    oldVideo.currentTime = 0;
    oldVideo.src = "";
    oldVideo.load();
  }
  var old = container.querySelector(
    "video, img, .no-media-fullscreen, .play-overlay",
  );
  if (old) old.remove();

  if (isVideo) {
    console.log("🎥 Reproduzindo vídeo:", url);
    var video = document.createElement("video");
    var videoUrl = url.startsWith("http") ? url : API_BASE + url;
    video.src = videoUrl;
    video.autoplay = true;
    video.controls = false;
    video.muted = false;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("x-webkit-airplay", "allow");
    video.style.width = "100vw";
    video.style.height = "100vh";
    video.style.objectFit = "contain";
    video.style.background = "#000";

    var duracaoTimerVideo = null;
    var videoTerminado = false;

    function finalizarVideo() {
      if (videoTerminado) return;
      videoTerminado = true;
      if (duracaoTimerVideo) {
        clearTimeout(duracaoTimerVideo);
        duracaoTimerVideo = null;
      }
      elementoVideoAtual = null;
      enviarNowPlaying(null);
      onTerminar();
    }

    video.onloadedmetadata = function () {
      console.log("📹 Vídeo carregado:", videoUrl);
      entrarFullscreen(video);
      enviarNowPlaying(item);

      // Se houver uma duração configurada e ela for menor que a duração real
      // do vídeo, corta a reprodução ao fim desse tempo.
      var duracaoConfigurada = parseInt(item.duration_seconds, 10);
      if (duracaoConfigurada && duracaoConfigurada > 0) {
        var duracaoRealMs = isFinite(video.duration)
          ? video.duration * 1000
          : null;
        if (!duracaoRealMs || duracaoConfigurada * 1000 < duracaoRealMs) {
          duracaoTimerVideo = setTimeout(
            finalizarVideo,
            duracaoConfigurada * 1000,
          );
        }
      }
    };

    video.oncanplay = function () {
      console.log("▶️ Vídeo pronto, iniciando autoplay...");
      tryPlayVideo(video, container);
    };

    video.onended = function () {
      console.log("⏹️ Vídeo terminou");
      finalizarVideo();
    };

    video.onerror = function (e) {
      console.error("❌ Erro no vídeo:", e);
      console.error("URL do vídeo:", videoUrl);
      if (videoTerminado) return;
      videoTerminado = true;
      if (duracaoTimerVideo) {
        clearTimeout(duracaoTimerVideo);
        duracaoTimerVideo = null;
      }
      elementoVideoAtual = null;
      enviarNowPlaying(null);
      setTimeout(onTerminar, 2000);
    };

    container.appendChild(video);
    elementoVideoAtual = video;

    if (video.readyState >= 2) {
      video.oncanplay();
    }
  } else if (isImage) {
    console.log("🖼️ Reproduzindo imagem:", url);
    var img = document.createElement("img");
    var imgUrl = url.startsWith("http") ? url : API_BASE + url;
    img.src = imgUrl;
    img.alt = "Imagem";
    img.style.width = "100vw";
    img.style.height = "100vh";
    img.style.objectFit = "contain";
    img.style.background = "#000";

    img.onload = function () {
      console.log("✅ Imagem carregada");
      entrarFullscreen(img);
      enviarNowPlaying(item);
    };

    img.onerror = function () {
      console.error("❌ Erro ao carregar imagem:", imgUrl);
      enviarNowPlaying(null);
      onTerminar();
    };

    container.appendChild(img);

    var duracao = (item.duration_seconds || 10) * 1000;
    temporizadorAtual = setTimeout(function () {
      temporizadorAtual = null;
      enviarNowPlaying(null);
      onTerminar();
    }, duracao);
  } else {
    console.log("📄 Item sem mídia reconhecida:", item);
    var msgDiv = document.createElement("div");
    msgDiv.className = "no-media-fullscreen";
    msgDiv.textContent = "📺 " + (item.name || "Conteúdo indisponível");
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
    enviarNowPlaying(item);
    setTimeout(function () {
      enviarNowPlaying(null);
      onTerminar();
    }, 3000);
  }
}

function avancarLoop() {
  if (!reprodutorAtivo) return;
  if (indiceAtual >= itemsPlaylist.length) indiceAtual = 0;
  var item = itemsPlaylist[indiceAtual];
  indiceAtual++;
  reproduzirItem(item, function () {
    avancarLoop();
  });
}

function iniciarReproducao() {
  pararReproducao();

  if (!itemsPlaylist || itemsPlaylist.length === 0) {
    console.log("📭 Nenhum item para reproduzir");
    enviarNowPlaying(null);
    return;
  }

  console.log(
    "▶️ Iniciando loop de reprodução com",
    itemsPlaylist.length,
    "itens",
  );
  indiceAtual = 0;
  reprodutorAtivo = true;

  var playerContainer = document.getElementById("playerContainer");
  if (playerContainer) {
    var container = document.getElementById("fullscreenContainer");
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
// 9. UI
// ============================================================
function renderizarUI(playlist, statusMensagem) {
  var root = document.getElementById("appRoot");
  if (!root) return;

  var temPlaylist = playlist && playlist.items && playlist.items.length > 0;
  var deviceId = obterIdDispositivo();
  var codigoFixo = localStorage.getItem("tv_codigo") || CODIGO_TV;

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
                ${statusMensagem || (temPlaylist ? "✅ Playlist disponível! Iniciando automaticamente..." : "⏳ Aguardando playlist...")}
            </div>
            ${
              temPlaylist
                ? iniciadoPorClique
                  ? `
                <div class="autoplay-status">
                    <i class="fas fa-spinner fa-spin"></i> A iniciar automaticamente...
                </div>
            `
                  : `
                <div class="autoplay-status">
                    <i class="fas fa-hand-pointer"></i> Toque em qualquer ponto do ecrã para iniciar em ecrã cheio
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

  if (temPlaylist && !playerAtivo && !iniciadoAutomaticamente && iniciadoPorClique) {
    iniciadoAutomaticamente = true;
    console.log("🚀 Iniciando reprodução automática em 2 segundos...");
    setTimeout(function () {
      ativarPlayer();
    }, 2000);
  } else if (temPlaylist && !playerAtivo && !iniciadoAutomaticamente && !iniciadoPorClique) {
    iniciadoAutomaticamente = true;
    // Pré-carregamos os itens mas só arrancamos com a reprodução depois
    // do gesto (clique/tecla) — caso contrário o autoplay seria
    // bloqueado pelos browsers modernos.
    console.log("ℹ️ Playlist disponível. Aguardando gesto do utilizador para F11 + autoplay...");
  }
}

// ============================================================
// 10. POLLING E INICIALIZAÇÃO
// ============================================================
async function atualizarPlaylist() {
  console.log("🔄 Atualizando playlist...");

  var playlist = await buscarPlaylist();

  if (playlist && playlist.items && playlist.items.length > 0) {
    itemsPlaylist = playlist.items;
    console.log("📋 Playlist carregada:", itemsPlaylist.length, "itens");

    if (!playerAtivo) {
      renderizarUI(
        playlist,
        "✅ Playlist disponível! Iniciando automaticamente...",
      );
    } else {
      iniciarReproducao();
    }
  } else {
    iniciadoAutomaticamente = false;
    if (!playerAtivo) {
      renderizarUI(null, "⏳ Aguardando playlist...");
    } else {
      voltarTelaInicial();
    }
  }
}

// ============================================================
// 11. INICIALIZAÇÃO
// ============================================================
(async function iniciar() {
  console.log("🚀 Inicializando TV Manager com AUTOPLAY TOTAL...");
  console.log("🌐 Servidor detectado:", API_BASE);

  CODIGO_TV = await obterOuCriarCodigo();
  console.log("🔑 CÓDIGO FIXO:", CODIGO_TV);

  await registarTV();
  console.log("📡 TV registada no servidor");

  var playerContainer = document.createElement("div");
  playerContainer.id = "playerContainer";
  playerContainer.className = "player-container";
  document.body.appendChild(playerContainer);

  await atualizarPlaylist();

  // Reação à saída de fullscreen (Esc, alt-tab, etc.): voltar a apresentar
  // o overlay para que o utilizador re-entre em ecrã cheio com um único
  // clique, mantendo o resto do comportamento automático na próxima
  // interação.
  function reagirMudancaFullscreen() {
    var emFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    estaEmFullscreen = emFullscreen;
    if (!emFullscreen) {
      fullscreenContainer = null;
      if (iniciadoPorClique) {
        mostrarPromptIniciar();
        instalarGestoInicial();
      }
    }
  }
  document.addEventListener("fullscreenchange", reagirMudancaFullscreen, false);
  document.addEventListener("webkitfullscreenchange", reagirMudancaFullscreen, false);
  document.addEventListener("mozfullscreenchange", reagirMudancaFullscreen, false);
  document.addEventListener("MSFullscreenChange", reagirMudancaFullscreen, false);

  if (intervaloPolling) clearInterval(intervaloPolling);
  intervaloPolling = setInterval(atualizarPlaylist, 30000);

  // Os browsers exigem um gesto do utilizador em cada sessão para entrar
  // em fullscreen, por isso mostramos sempre o overlay no arranque.
  mostrarPromptIniciar();
  instalarGestoInicial();

  console.log("✅ TV Manager inicializado com sucesso!");
  console.log(
    "🎯 AUTOPLAY TOTAL - Iniciará automaticamente quando a playlist estiver disponível",
  );
  console.log(
    "🖥️ FULLSCREEN AUTOMÁTICO (F11) - Ativado no primeiro clique, mantém-se até sair com Esc",
  );
  console.log("🌐 Compatível com Chrome, Firefox, Edge, Safari e Opera");
})();
