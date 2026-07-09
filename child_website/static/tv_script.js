// ============================================================
// JAVASCRIPT COMPLETO - CORRIGIDO (com IP dinâmico)
// ============================================================

// Em vez de fixar 127.0.0.1, usa o endereço do servidor que serviu a página.
// Assim, a TV descobre automaticamente o IP do servidor.
var SERVER_HOST = window.location.hostname; // ex: 192.168.13.56
var API_BASE = "http://" + SERVER_HOST + ":5000";

// ============================================================
// WEBSOCKET (com fallback) – também dinâmico
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
var temporizadorMouse = null;
var playerAtivo = false;
var iniciadoAutomaticamente = false;

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
      await fetch(API_BASE + "/api/tv/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: codigo, device_id: deviceId }),
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
    if (socket) {
      socket.emit("register_tv", { codigo: CODIGO_TV });
    }
    var deviceId = obterIdDispositivo();
    var codigo = localStorage.getItem("tv_codigo") || CODIGO_TV;
    var response = await fetch(API_BASE + "/api/tv/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: codigo, device_id: deviceId }),
    });
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
// 5. PLAYER - INÍCIO AUTOMÁTICO
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
// 6. FULLSCREEN E CONTROLES - CORRIGIDO
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

  var exitBtn = document.getElementById("exitFullscreenBtn");
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

  var controls = document.getElementById("fullscreenControls");
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
    var elem = container;
    if (elem.requestFullscreen) {
      elem.requestFullscreen({ navigationUI: "hide" }).catch(function () {});
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    }
    estaEmFullscreen = true;
    fullscreenContainer = container;
  }

  mostrarControles();
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
  if (temporizadorMouse) {
    clearTimeout(temporizadorMouse);
    temporizadorMouse = null;
  }
}

function mostrarControles() {
  var exitBtn = document.getElementById("exitFullscreenBtn");
  var controls = document.getElementById("fullscreenControls");
  if (exitBtn) exitBtn.classList.add("visible");
  if (controls) controls.classList.add("visible");
  if (temporizadorMouse) clearTimeout(temporizadorMouse);
  temporizadorMouse = setTimeout(ocultarControles, 4000);
}

function ocultarControles() {
  var exitBtn = document.getElementById("exitFullscreenBtn");
  var controls = document.getElementById("fullscreenControls");
  if (exitBtn) exitBtn.classList.remove("visible");
  if (controls) controls.classList.remove("visible");
  if (temporizadorMouse) {
    clearTimeout(temporizadorMouse);
    temporizadorMouse = null;
  }
}

window.pauseResume = function () {
  var container = document.getElementById("fullscreenContainer");
  if (!container) return;
  var video = container.querySelector("video");
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
    var item = itemsPlaylist[indiceAtual];
    indiceAtual++;
    reproduzirItem(item, function () {
      if (reprodutorAtivo) {
        avancarLoop();
      }
    });
  }
  mostrarControles();
};

// ============================================================
// 7. REPRODUÇÃO DE ITENS - CORRIGIDO
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

    video.onloadedmetadata = function () {
      console.log("📹 Vídeo carregado:", videoUrl);
      entrarFullscreen(video);
    };

    video.oncanplay = function () {
      console.log("▶️ Vídeo pronto, iniciando autoplay...");
      tryPlayVideo(video, container);
    };

    video.onended = function () {
      console.log("⏹️ Vídeo terminou");
      elementoVideoAtual = null;
      onTerminar();
    };

    video.onerror = function (e) {
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
    };

    img.onerror = function () {
      console.error("❌ Erro ao carregar imagem:", imgUrl);
      onTerminar();
    };

    container.appendChild(img);

    var duracao = (item.duration_seconds || 10) * 1000;
    temporizadorAtual = setTimeout(function () {
      temporizadorAtual = null;
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
    setTimeout(function () {
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
// 8. UI
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
    setTimeout(function () {
      ativarPlayer();
    }, 2000);
  }
}

// ============================================================
// 9. POLLING E INICIALIZAÇÃO
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
// 10. INICIALIZAÇÃO
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

  document.addEventListener("fullscreenchange", function () {
    if (!document.fullscreenElement && estaEmFullscreen) {
      voltarTelaInicial();
    }
  });
  document.addEventListener("webkitfullscreenchange", function () {
    if (!document.webkitFullscreenElement && estaEmFullscreen) {
      voltarTelaInicial();
    }
  });
  document.addEventListener("msfullscreenchange", function () {
    if (!document.msFullscreenElement && estaEmFullscreen) {
      voltarTelaInicial();
    }
  });
  document.addEventListener("mozfullscreenchange", function () {
    if (!document.mozFullScreenElement && estaEmFullscreen) {
      voltarTelaInicial();
    }
  });

  if (intervaloPolling) clearInterval(intervaloPolling);
  intervaloPolling = setInterval(atualizarPlaylist, 30000);

  console.log("✅ TV Manager inicializado com sucesso!");
  console.log(
    "🎯 AUTOPLAY TOTAL - Iniciará automaticamente quando a playlist estiver disponível",
  );
  console.log("🌐 Compatível com Chrome, Firefox, Edge, Safari e Opera");
})();
