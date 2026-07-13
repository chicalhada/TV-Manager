// admin.js - Painel administrativo (versão com seleção múltipla de datas)
const API_BASE = window.location.origin + "/api";

// ===== FUNÇÕES AUXILIARES PARA DATAS MÚLTIPLAS =====
function dateSelectorHtml(containerId, initialDates = "") {
  // Converte string para array
  let datesArray = [];
  if (typeof initialDates === "string" && initialDates.trim() !== "") {
    datesArray = initialDates.split(",").filter((d) => d.trim() !== "");
  } else if (Array.isArray(initialDates)) {
    datesArray = initialDates;
  }

  const tagsHtml = datesArray
    .map(
      (d) => `
        <span class="date-tag" data-date="${d.trim()}">
            ${d.trim()}
            <span class="remove-date" onclick="removeDateTag(this)">✖</span>
        </span>
    `,
    )
    .join("");

  return `
        <div class="date-selector" data-container="${containerId}">
            <div class="date-tags-container">
                ${tagsHtml}
            </div>
            <div class="date-input-row">
                <input type="date" class="date-picker-input" id="${containerId}_input">
                <button type="button" class="btn btn-sm btn-primary add-date-btn" onclick="addDateTag('${containerId}')">+ Adicionar</button>
            </div>
            <input type="hidden" id="${containerId}_hidden" value="${datesArray.join(",")}">
        </div>
    `;
}

// Funções globais para manipular as tags
window.addDateTag = function (containerId) {
  const container = document.querySelector(
    `.date-selector[data-container="${containerId}"]`,
  );
  if (!container) return;
  const input = document.getElementById(containerId + "_input");
  const tagsContainer = container.querySelector(".date-tags-container");
  const hidden = document.getElementById(containerId + "_hidden");
  const date = input.value;
  if (!date) {
    showToast("Selecione uma data", "warning");
    return;
  }
  // Verificar se já existe
  if (tagsContainer.querySelector(`[data-date="${date}"]`)) {
    showToast("Data já adicionada", "warning");
    return;
  }
  const tag = document.createElement("span");
  tag.className = "date-tag";
  tag.dataset.date = date;
  tag.innerHTML = `${date} <span class="remove-date" onclick="removeDateTag(this)">✖</span>`;
  tagsContainer.appendChild(tag);
  // Atualizar hidden
  const dates = Array.from(tagsContainer.querySelectorAll(".date-tag")).map(
    (el) => el.dataset.date,
  );
  hidden.value = dates.join(",");
  input.value = "";
};

window.removeDateTag = function (el) {
  const tag = el.closest(".date-tag");
  const container = tag.closest(".date-selector");
  const hidden = container.querySelector('input[type="hidden"]');
  tag.remove();
  const dates = Array.from(container.querySelectorAll(".date-tag")).map(
    (el) => el.dataset.date,
  );
  hidden.value = dates.join(",");
};

function getSelectedDates(containerId) {
  const hidden = document.getElementById(containerId + "_hidden");
  if (!hidden) return [];
  return hidden.value
    ? hidden.value.split(",").filter((d) => d.trim() !== "")
    : [];
}

// ===== TOAST =====
function showToast(message, type = "success") {
  const colors = {
    success: "#10b981",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
  };
  const icons = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.style.background = colors[type];
  toast.innerHTML = `<span style="font-size:1.2rem;">${icons[type]}</span><span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 500);
  }, 3500);
}

// ===== MODAL GENÉRICO =====
function openModal(title, fields, onConfirm) {
  const modal = document.getElementById("customModal");
  const titleEl = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");
  const confirmBtn = document.getElementById("modalConfirmBtn");
  const cancelBtn = document.getElementById("modalCancelBtn");
  const closeBtn = document.getElementById("closeModalBtn");

  titleEl.innerText = title;

  body.innerHTML = fields
    .map((f) => {
      if (f.type === "select") {
        const options = f.options
          .map(
            (o) =>
              `<option value="${o.value}" ${
                o.value == f.value ? "selected" : ""
              }>${o.label}</option>`,
          )
          .join("");
        return `
                    <div class="input-group">
                        <label for="${f.id}">${f.label}</label>
                        <select id="${f.id}">${options}</select>
                    </div>
                `;
      } else if (f.type === "custom") {
        // Para campos custom como o date selector
        return `
                    <div class="input-group">
                        <label>${f.label}</label>
                        ${f.html || ""}
                    </div>
                `;
      } else {
        return `
                    <div class="input-group">
                        <label for="${f.id}">${f.label}</label>
                        <input type="${f.type}" id="${f.id}" value="${f.value || ""}" placeholder="${f.placeholder || ""}">
                    </div>
                `;
      }
    })
    .join("");

  modal.classList.add("active");

  const cleanup = () => {
    modal.classList.remove("active");
    confirmBtn.removeEventListener("click", handleConfirm);
    cancelBtn.removeEventListener("click", handleCancel);
    closeBtn.removeEventListener("click", handleCancel);
  };

  const handleConfirm = () => {
    const values = fields.map((f) => {
      if (f.type === "custom") {
        // Para o date selector, obter o valor do hidden
        const hidden = document.getElementById(f.id + "_hidden");
        return hidden ? hidden.value : "";
      }
      const el = document.getElementById(f.id);
      return el ? el.value.trim() : "";
    });
    cleanup();
    onConfirm(values);
  };

  const handleCancel = () => cleanup();

  confirmBtn.addEventListener("click", handleConfirm);
  cancelBtn.addEventListener("click", handleCancel);
  closeBtn.addEventListener("click", handleCancel);
}

function confirmModal(message, onConfirm) {
  const modal = document.getElementById("customModal");
  const titleEl = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");
  const confirmBtn = document.getElementById("modalConfirmBtn");
  const cancelBtn = document.getElementById("modalCancelBtn");
  const closeBtn = document.getElementById("closeModalBtn");

  titleEl.innerText = "Confirmar";
  body.innerHTML = `<p class="text-gray-light">${message}</p>`;
  modal.classList.add("active");

  const cleanup = () => {
    modal.classList.remove("active");
    confirmBtn.removeEventListener("click", handleConfirm);
    cancelBtn.removeEventListener("click", handleCancel);
    closeBtn.removeEventListener("click", handleCancel);
  };

  const handleConfirm = () => {
    cleanup();
    onConfirm();
  };
  const handleCancel = () => cleanup();

  confirmBtn.addEventListener("click", handleConfirm);
  cancelBtn.addEventListener("click", handleCancel);
  closeBtn.addEventListener("click", handleCancel);
}

// ===== LIGHTBOX =====
function showLightbox(url) {
  const lightbox = document.getElementById("lightbox");
  const img = document.getElementById("lightboxImage");
  const videoContainer = document.getElementById("lightboxVideoContainer");

  img.style.display = "none";
  videoContainer.style.display = "none";
  videoContainer.innerHTML = "";

  const fullUrl = getFullUrl(url);
  const isVideo =
    /\.(mp4|webm|ogg|mov|avi)$/i.test(fullUrl) ||
    (fullUrl.includes("video") &&
      !fullUrl.endsWith(".jpg") &&
      !fullUrl.endsWith(".png"));

  if (isVideo) {
    videoContainer.style.display = "block";
    const video = document.createElement("video");
    video.src = fullUrl;
    video.controls = true;
    video.autoplay = true;
    video.style.maxWidth = "90vw";
    video.style.maxHeight = "80vh";
    video.className = "rounded-lg";
    videoContainer.appendChild(video);
    video.play().catch(() => {});
  } else {
    img.style.display = "block";
    img.src = fullUrl;
    img.alt = "Pré-visualização";
    img.className = "rounded-lg";
    img.style.maxWidth = "90vw";
    img.style.maxHeight = "80vh";
    img.style.objectFit = "contain";
  }
  lightbox.classList.add("active");
}

document.getElementById("closeLightbox")?.addEventListener("click", () => {
  document.getElementById("lightbox").classList.remove("active");
  const video = document.querySelector("#lightboxVideoContainer video");
  if (video) video.pause();
});
document.getElementById("lightbox")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    document.getElementById("lightbox").classList.remove("active");
    const video = document.querySelector("#lightboxVideoContainer video");
    if (video) video.pause();
  }
});

function getFullUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const origin = window.location.origin;
  return origin + (url.startsWith("/") ? url : "/" + url);
}

// ===== AUTENTICAÇÃO =====
function checkAuth() {
  const token = localStorage.getItem("admin_token");
  if (!token) {
    window.location.href = "/login.html";
    return false;
  }
  const userName = localStorage.getItem("admin_user") || "Admin";
  document.getElementById("userName").innerText = userName;
  document.getElementById("userInitial").innerText = userName
    .charAt(0)
    .toUpperCase();
  return true;
}

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_user");
  window.location.href = "/login.html";
});

async function fetchAuth(url, options = {}) {
  const token = localStorage.getItem("admin_token");
  if (!token) {
    window.location.href = "/login.html";
    throw new Error("Sem token");
  }
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };
  const response = await fetch(`${API_BASE}${url}`, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    window.location.href = "/login.html";
    throw new Error("Sessão expirada");
  }
  return response;
}

// ===== CARREGAR TUDO =====
async function carregarTudo() {
  const secoes = [
    ["dashboardContainer", loadDashboard],
    ["tvsContainer", loadTVs],
    ["mediaContainer", loadMedia],
    ["playlistsContainer", loadPlaylists],
    ["scheduleContainer", loadSchedule],
  ];
  for (const [containerId, loader] of secoes) {
    const container = document.getElementById(containerId);
    if (!container) continue;
    container.innerHTML = `<div class="text-center py-12"><div class="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div><p class="mt-3 text-gray">Carregando...</p></div>`;
    await loader(container);
  }
}

async function loadDashboard(container) {
  try {
    const [tvs, playlists, media] = await Promise.all([
      fetchAuth("/tvs").then((r) => r.json()),
      fetchAuth("/playlists").then((r) => r.json()),
      fetchAuth("/media").then((r) => r.json()),
    ]);
    const stats = [
      { label: "Televisões", value: tvs.length, icon: "📺" },
      { label: "Playlists", value: playlists.length, icon: "📋" },
      { label: "Ficheiros", value: media.length, icon: "🖼️" },
    ];
    container.innerHTML = stats
      .map(
        (s) => `
                    <div class="stat-item">
                        <span class="stat-icon">${s.icon}</span>
                        <div>
                            <div class="stat-value">${s.value}</div>
                            <div class="stat-label">${s.label}</div>
                        </div>
                    </div>
                `,
      )
      .join("");
  } catch (err) {
    container.innerHTML = `<p class="text-red">Erro: ${err.message}</p>`;
  }
}

// ===== TELEVISÕES =====
let intervaloStatusTVs = null;

async function loadTVs(container) {
  try {
    const [tvs, statuses] = await Promise.all([
      fetchAuth("/tvs").then((r) => r.json()),
      fetchAuth("/tvs/status").then((r) => r.json()),
    ]);

    const statusMap = {};
    statuses.forEach((s) => (statusMap[s.id] = s.active_playlist));
    const nowPlayingMap = {};
    statuses.forEach((s) => (nowPlayingMap[s.id] = s.now_playing));
    const onlineMap = {};
    statuses.forEach((s) => (onlineMap[s.id] = !!s.online));

    const tvsWithStatus = tvs.map((tv) => ({
      ...tv,
      active_playlist: statusMap[tv.id] || null,
      now_playing: nowPlayingMap[tv.id] || null,
      online: onlineMap[tv.id] || false,
    }));

    const searchInput = document.createElement("input");
    searchInput.placeholder = "🔍 Pesquisar televisão...";
    searchInput.className =
      "w-full sm:w-64 px-4 py-2 rounded-xl border border-gray-800 bg-gray-800 text-gray-light focus:outline-none focus:ring-2 focus:ring-indigo-500 transition";

    const nowPlayingKey = (tv) => {
      if (!tv.online) return "offline";
      if (!tv.now_playing || !tv.now_playing.item_name) return "idle";
      return `${tv.now_playing.tipo}|${tv.now_playing.url}|${tv.now_playing.item_name}`;
    };

    const renderNowPlaying = (tv) => {
      if (!tv.online) return '<span class="text-gray">🔴 TV desligada</span>';
      if (!tv.now_playing || !tv.now_playing.item_name)
        return '<span class="text-gray">⏸ Nada em reprodução</span>';
      const np = tv.now_playing;
      const icone =
        np.tipo === "video" ? "🎬" : np.tipo === "imagem" ? "🖼️" : "📄";
      const fullUrl = np.url ? getFullUrl(np.url) : null;
      let miniatura = "";
      if (fullUrl) {
        miniatura =
          np.tipo === "video"
            ? `<video src="${fullUrl}" class="thumbnail-video" muted autoplay loop playsinline onclick="showLightbox('${np.url}')"></video>`
            : `<img src="${fullUrl}" class="thumbnail-image" onclick="showLightbox('${np.url}')" />`;
      }
      return `<div class="flex items-center gap-2">${miniatura}<span class="text-indigo text-xs">${icone} ${np.item_name}</span></div>`;
    };

    const atualizarCelulaNowPlaying = (cell, tv) => {
      const chave = nowPlayingKey(tv);
      if (cell.dataset.chaveAtual === chave) return;
      cell.dataset.chaveAtual = chave;
      cell.innerHTML = renderNowPlaying(tv);
    };

    const renderTable = (data) => {
      const tbody = document.querySelector("#tvsTable tbody");
      if (!tbody) return;
      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray">Nenhuma televisão encontrada</td></tr>`;
        return;
      }
      tbody.innerHTML = data
        .map(
          (tv) => `
                        <tr class="border-b border-gray-800 hover:bg-gray-800/50 transition">
                            <td class="py-3 px-4 text-sm text-gray">#${tv.id}</td>
                            <td class="py-3 px-4 font-medium text-white">${tv.name}</td>
                            <td class="py-3 px-4 text-sm font-mono text-gray-light">${tv.codigo || "—"}</td>
                            <td class="py-3 px-4 text-sm text-gray">${tv.active_playlist ? `<span class="text-emerald font-medium">${tv.active_playlist.name}</span> <span class="text-xs text-gray">(${tv.active_playlist.items_count} itens)</span>` : '<span class="text-gray">Nenhuma</span>'}</td>
                            <td class="py-3 px-4 text-sm" data-now-playing="${tv.id}" data-chave-atual="${nowPlayingKey(tv)}">${renderNowPlaying(tv)}</td>
                            <td class="py-3 px-4">
                                <button class="delete-tv text-red hover:text-red transition text-sm font-medium" data-id="${tv.id}">🗑️</button>
                            </td>
                        </tr>
                    `,
        )
        .join("");

      document.querySelectorAll(".delete-tv").forEach((btn) =>
        btn.addEventListener("click", () => {
          confirmModal("Tem certeza que deseja remover esta TV?", async () => {
            await fetchAuth(`/tvs/${btn.dataset.id}`, { method: "DELETE" });
            showToast("TV removida com sucesso", "success");
            loadTVs(container);
            loadDashboard(document.getElementById("dashboardContainer"));
          });
        }),
      );
    };

    container.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">📺 Televisões</h2>
            </div>
            <div class="table-container">
                <div class="toolbar">
                    <div class="flex-1 min-w-[200px]">${searchInput.outerHTML}</div>
                    <span class="text-sm text-gray">${tvsWithStatus.length} televisões</span>
                </div>
                <div class="overflow-x-auto">
                    <table id="tvsTable">
                        <thead>
                            <tr>
                                <th>ID</th><th>Nome</th><th>Código</th><th>Playlist Atual</th><th>A reproduzir agora</th><th>Ações</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
                <div class="table-footer">
                    <button id="addTvBtn" class="btn btn-primary">➕ Adicionar</button>
                </div>
            </div>
        `;

    const search = document.querySelector(
      'input[placeholder="🔍 Pesquisar televisão..."]',
    );
    search.addEventListener("input", function () {
      const term = this.value.toLowerCase().trim();
      const filtered = tvsWithStatus.filter(
        (tv) =>
          tv.name.toLowerCase().includes(term) ||
          (tv.codigo && tv.codigo.toLowerCase().includes(term)) ||
          (tv.active_playlist &&
            tv.active_playlist.name.toLowerCase().includes(term)),
      );
      renderTable(filtered);
    });

    renderTable(tvsWithStatus);

    document.getElementById("addTvBtn")?.addEventListener("click", () => {
      openModal(
        "Nova Televisão",
        [
          {
            label: "Nome",
            id: "tvName",
            type: "text",
            placeholder: "Nome da TV",
          },
          {
            label: "Código (fornecido pela TV)",
            id: "tvCodigo",
            type: "text",
            placeholder: "Ex: ABC123",
          },
        ],
        async (values) => {
          const [name, codigo] = values;
          if (!name || !codigo)
            return showToast("Nome e código são obrigatórios", "warning");
          await fetchAuth("/tvs", {
            method: "POST",
            body: JSON.stringify({ name, codigo }),
          });
          showToast("TV adicionada com sucesso", "success");
          loadTVs(container);
          loadDashboard(document.getElementById("dashboardContainer"));
        },
      );
    });

    if (intervaloStatusTVs) clearInterval(intervaloStatusTVs);
    intervaloStatusTVs = setInterval(async () => {
      if (!document.getElementById("tvsTable")) {
        clearInterval(intervaloStatusTVs);
        intervaloStatusTVs = null;
        return;
      }
      try {
        const statusesAtualizados = await fetchAuth("/tvs/status").then((r) =>
          r.json(),
        );
        statusesAtualizados.forEach((s) => {
          const cell = document.querySelector(`[data-now-playing="${s.id}"]`);
          if (cell) {
            atualizarCelulaNowPlaying(cell, {
              online: !!s.online,
              now_playing: s.now_playing,
            });
          }
        });
      } catch (e) {}
    }, 5000);
  } catch (err) {
    container.innerHTML = `<p class="text-red">Erro: ${err.message}</p>`;
  }
}

// ===== MÍDIAS =====
async function loadMedia(container) {
  try {
    const media = await (await fetchAuth("/media")).json();
    container.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">🖼️ Ficheiros</h2>
            </div>
            <div class="table-container">
                <div class="overflow-x-auto">
                    <table>
                        <thead>
                            <tr><th>ID</th><th>Ficheiro</th><th>Pré-visualização</th><th>Tipo</th><th>Ações</th></tr>
                        </thead>
                        <tbody>
                            ${media
                              .map((m) => {
                                const isVideo =
                                  m.mime_type &&
                                  m.mime_type.startsWith("video/");
                                const fullUrl = getFullUrl(m.url);
                                return `
                                        <tr class="border-b border-gray-800 hover:bg-gray-800/50 transition">
                                            <td class="py-3 px-4 text-sm text-gray">#${m.id}</td>
                                            <td class="py-3 px-4 text-sm font-medium text-white" style="word-break: break-all; max-width: 250px;">${m.filename}</td>
                                            <td class="py-3 px-4">
                                                ${
                                                  isVideo
                                                    ? `<video src="${fullUrl}" class="thumbnail-video" muted autoplay loop playsinline preload="metadata" onclick="showLightbox('${m.url}')"></video>`
                                                    : `<img src="${fullUrl}" alt="${m.filename}" class="thumbnail-image" onclick="showLightbox('${m.url}')" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="thumbnail-placeholder" style="display:none;">🖼️</div>`
                                                }
                                            </td>
                                            <td class="py-3 px-4 text-sm text-gray">${m.mime_type}</td>
                                            <td class="py-3 px-4">
                                                <button class="delete-media text-red hover:text-red transition" data-id="${m.id}">🗑️</button>
                                            </td>
                                        </tr>
                                    `;
                              })
                              .join("")}
                        </tbody>
                    </table>
                </div>
                <div class="table-footer">
                    <label class="btn btn-primary cursor-pointer">
                        ⬆️ Upload
                        <input type="file" id="mediaUpload" multiple accept="image/*,video/*" class="hidden">
                    </label>
                </div>
            </div>
        `;

    document
      .getElementById("mediaUpload")
      ?.addEventListener("change", async function () {
        const files = this.files;
        if (!files.length) return;
        const fd = new FormData();
        for (let f of files) fd.append("file", f);
        const token = localStorage.getItem("admin_token");
        try {
          const resp = await fetch(`${API_BASE}/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          if (resp.ok) {
            showToast("Upload concluído", "success");
            loadMedia(container);
            loadDashboard(document.getElementById("dashboardContainer"));
          } else showToast("Erro no upload", "error");
        } catch (e) {
          showToast("Erro de conexão", "error");
        }
        this.value = "";
      });

    document.querySelectorAll(".delete-media").forEach((btn) =>
      btn.addEventListener("click", () => {
        confirmModal(
          "Tem a certeza que deseja remover este ficheiro?",
          async () => {
            await fetchAuth(`/media/${btn.dataset.id}`, { method: "DELETE" });
            showToast("Ficheiro removido", "success");
            loadMedia(container);
            loadDashboard(document.getElementById("dashboardContainer"));
          },
        );
      }),
    );
  } catch (err) {
    container.innerHTML = `<p class="text-red">Erro: ${err.message}</p>`;
  }
}

// ===== PLAYLISTS (com seleção múltipla de datas) =====
async function loadPlaylists(container) {
  try {
    const [playlists, media] = await Promise.all([
      fetchAuth("/playlists").then((r) => r.json()),
      fetchAuth("/media").then((r) => r.json()),
    ]);
    let html = `
            <div class="section-header">
                <h2 class="section-title">📋 Playlists</h2>
            </div>
            <div class="space-y-4">
        `;
    for (let p of playlists) {
      const items = p.items || [];
      html += `
                <div class="playlist-card">
                    <div class="playlist-header">
                        <h4 class="playlist-name">${p.name}</h4>
                        <div class="playlist-actions">
                            <span class="playlist-count">${items.length} itens</span>
                            <button class="delete-playlist btn btn-danger btn-sm" data-id="${p.id}">🗑️ Eliminar</button>
                        </div>
                    </div>
                    <div class="playlist-add-item">
                        <select id="mediaSelect_${p.id}" class="rounded-xl border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-light">
                            <option value="">Selecione um ficheiro</option>
                            ${media.map((m) => `<option value="${m.id}">${m.filename}</option>`).join("")}
                        </select>
                        <span class="text-xs text-gray">das</span>
                        <input type="time" id="startTime_${p.id}" class="rounded-xl border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-light">
                        <span class="text-xs text-gray">até</span>
                        <input type="time" id="endTime_${p.id}" class="rounded-xl border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-light">
                        <span class="text-xs text-gray">(vazio = sempre)</span>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray">Datas:</span>
                            ${dateSelectorHtml(`datesNew_${p.id}`)}
                            <span class="text-xs text-gray">(vazio = sempre)</span>
                        </div>
                        <button class="add-item btn btn-success btn-sm" data-id="${p.id}">➕ Adicionar</button>
                    </div>
                    ${
                      items.length
                        ? `
                            <div class="overflow-x-auto">
                                <table class="playlist-items-table">
                                    <thead>
                                        <tr><th>Ordem</th><th>Ficheiro</th><th>Pré‑vis.</th><th>Datas</th><th>Horário</th><th></th><th>Ações</th></tr>
                                    </thead>
                                    <tbody>
                                        ${items
                                          .map(
                                            (item) => `
                                                <tr>
                                                    <td class="py-2 px-3 text-gray">${item.display_order}</td>
                                                    <td class="py-2 px-3 text-gray-light" style="word-break: break-all; max-width: 200px;">${item.filename}</td>
                                                    <td class="py-2 px-3">
                                                        ${
                                                          item.mime_type &&
                                                          item.mime_type.startsWith(
                                                            "video/",
                                                          )
                                                            ? `<video src="${getFullUrl(item.url)}" class="thumbnail-video" muted autoplay loop playsinline preload="metadata" onclick="showLightbox('${item.url}')"></video>`
                                                            : `<img src="${getFullUrl(item.url)}" class="thumbnail-image" onclick="showLightbox('${item.url}')" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="thumbnail-placeholder" style="display:none;">🖼️</div>`
                                                        }
                                                    </td>
                                                    <td class="py-2 px-3">
                                                        ${dateSelectorHtml(`datesItem_${item.id}`, item.selected_dates || "")}
                                                    </td>
                                                    <td class="py-2 px-3">
                                                        <input type="time" class="starttime-input rounded border border-gray-700 bg-gray-800 px-1 py-0.5 text-sm text-gray-light" value="${item.start_time || ""}" data-item="${item.id}" data-playlist="${p.id}">
                                                        <span class="text-gray text-xs">até</span>
                                                        <input type="time" class="endtime-input rounded border border-gray-700 bg-gray-800 px-1 py-0.5 text-sm text-gray-light" value="${item.end_time || ""}" data-item="${item.id}" data-playlist="${p.id}">
                                                        ${!item.start_time && !item.end_time ? '<div class="text-xs text-gray mt-0.5">(sempre)</div>' : ""}
                                                    </td>
                                                    <td class="py-2 px-3">
                                                        <button class="update-horario btn btn-primary btn-sm" data-item="${item.id}" data-playlist="${p.id}">🔄</button>
                                                    </td>
                                                    <td class="py-2 px-3">
                                                        <button class="move-up btn btn-ghost btn-sm" data-item="${item.id}" data-playlist="${p.id}">▲</button>
                                                        <button class="move-down btn btn-ghost btn-sm" data-item="${item.id}" data-playlist="${p.id}">▼</button>
                                                        <button class="remove-item text-red hover:text-red transition" data-item="${item.id}">✖</button>
                                                    </td>
                                                </tr>
                                            `,
                                          )
                                          .join("")}
                                    </tbody>
                                </table>
                            </div>
                        `
                        : '<p class="text-sm text-gray mt-2">Nenhum item nesta playlist</p>'
                    }
                </div>
            `;
    }
    html += `
            </div>
            <div class="mt-6 flex justify-end">
                <button id="createPlaylistBtn" class="btn btn-primary">➕ Nova Playlist</button>
            </div>
        `;
    container.innerHTML = html;

    document
      .getElementById("createPlaylistBtn")
      ?.addEventListener("click", () => {
        openModal(
          "Nova Playlist",
          [
            {
              label: "Nome",
              id: "playlistName",
              type: "text",
              placeholder: "Nome da playlist",
            },
          ],
          async (values) => {
            const [name] = values;
            if (!name) return showToast("Nome obrigatório", "warning");
            await fetchAuth("/playlists", {
              method: "POST",
              body: JSON.stringify({ name }),
            });
            showToast("Playlist criada", "success");
            loadPlaylists(container);
            loadDashboard(document.getElementById("dashboardContainer"));
          },
        );
      });

    document.querySelectorAll(".add-item").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const pid = btn.dataset.id;
        const mid = document.getElementById(`mediaSelect_${pid}`).value;
        const startTime = document.getElementById(`startTime_${pid}`).value;
        const endTime = document.getElementById(`endTime_${pid}`).value;
        const selectedDates = getSelectedDates(`datesNew_${pid}`);
        if (!mid) return showToast("Selecione um ficheiro", "warning");
        if ((startTime && !endTime) || (!startTime && endTime))
          return showToast(
            "Defina as duas horas ou deixe ambas vazias",
            "warning",
          );
        if (startTime && endTime && startTime >= endTime)
          return showToast(
            "A hora de início tem de ser antes da hora de fim",
            "warning",
          );
        try {
          await fetchAuth(`/playlists/${pid}/items`, {
            method: "POST",
            body: JSON.stringify({
              media_id: parseInt(mid),
              start_time: startTime || null,
              end_time: endTime || null,
              selected_dates: selectedDates,
            }),
          });
          showToast("Item adicionado", "success");
          loadPlaylists(container);
        } catch (err) {
          showToast("Erro ao adicionar item", "error");
        }
      }),
    );

    document.querySelectorAll(".update-horario").forEach((btn) => {
      btn.addEventListener("click", async function () {
        const itemId = this.dataset.item;
        const playlistId = this.dataset.playlist;
        const startTime = document.querySelector(
          `.starttime-input[data-item="${itemId}"]`,
        ).value;
        const endTime = document.querySelector(
          `.endtime-input[data-item="${itemId}"]`,
        ).value;
        const selectedDates = getSelectedDates(`datesItem_${itemId}`);
        if ((startTime && !endTime) || (!startTime && endTime))
          return showToast(
            "Defina as duas horas ou deixe ambas vazias",
            "warning",
          );
        if (startTime && endTime && startTime >= endTime)
          return showToast(
            "A hora de início tem de ser antes da hora de fim",
            "warning",
          );
        try {
          await fetchAuth(`/playlists/${playlistId}/items/${itemId}`, {
            method: "PUT",
            body: JSON.stringify({
              start_time: startTime || null,
              end_time: endTime || null,
              selected_dates: selectedDates,
            }),
          });
          showToast("Dados atualizados!", "success");
          loadPlaylists(container);
        } catch (err) {
          showToast("Erro ao atualizar", "error");
        }
      });
    });

    document.querySelectorAll(".remove-item").forEach((btn) =>
      btn.addEventListener("click", () => {
        const pid = btn
          .closest(".playlist-card")
          ?.querySelector(".delete-playlist")?.dataset.id;
        confirmModal("Remover este item?", async () => {
          await fetchAuth(`/playlists/${pid}/items/${btn.dataset.item}`, {
            method: "DELETE",
          });
          showToast("Item removido", "success");
          loadPlaylists(container);
        });
      }),
    );

    document.querySelectorAll(".move-up").forEach((btn) => {
      btn.addEventListener("click", async function () {
        const itemId = parseInt(this.dataset.item);
        const playlistId = parseInt(this.dataset.playlist);
        const playlist = await (
          await fetchAuth(`/playlists/${playlistId}`)
        ).json();
        const items = playlist.items || [];
        const currentIndex = items.findIndex((item) => item.id === itemId);
        if (currentIndex <= 0) return showToast("Já está no topo", "warning");
        const newOrder = items.map((item) => item.id);
        [newOrder[currentIndex - 1], newOrder[currentIndex]] = [
          newOrder[currentIndex],
          newOrder[currentIndex - 1],
        ];
        await fetchAuth(`/playlists/${playlistId}/items/reorder`, {
          method: "POST",
          body: JSON.stringify({ item_ids: newOrder }),
        });
        showToast("Item movido para cima", "success");
        loadPlaylists(container);
      });
    });

    document.querySelectorAll(".move-down").forEach((btn) => {
      btn.addEventListener("click", async function () {
        const itemId = parseInt(this.dataset.item);
        const playlistId = parseInt(this.dataset.playlist);
        const playlist = await (
          await fetchAuth(`/playlists/${playlistId}`)
        ).json();
        const items = playlist.items || [];
        const currentIndex = items.findIndex((item) => item.id === itemId);
        if (currentIndex === -1 || currentIndex >= items.length - 1)
          return showToast("Já está no fundo", "warning");
        const newOrder = items.map((item) => item.id);
        [newOrder[currentIndex], newOrder[currentIndex + 1]] = [
          newOrder[currentIndex + 1],
          newOrder[currentIndex],
        ];
        await fetchAuth(`/playlists/${playlistId}/items/reorder`, {
          method: "POST",
          body: JSON.stringify({ item_ids: newOrder }),
        });
        showToast("Item movido para baixo", "success");
        loadPlaylists(container);
      });
    });

    document.querySelectorAll(".delete-playlist").forEach((btn) =>
      btn.addEventListener("click", () => {
        confirmModal("Remover esta playlist?", async () => {
          await fetchAuth(`/playlists/${btn.dataset.id}`, { method: "DELETE" });
          showToast("Playlist removida", "success");
          loadPlaylists(container);
          loadDashboard(document.getElementById("dashboardContainer"));
        });
      }),
    );
  } catch (err) {
    container.innerHTML = `<p class="text-red">Erro: ${err.message}</p>`;
  }
}

// ===== AGENDAMENTOS (com seleção múltipla de datas) =====
async function loadSchedule(container) {
  try {
    const [tvs, playlists, schedules] = await Promise.all([
      fetchAuth("/tvs").then((r) => r.json()),
      fetchAuth("/playlists").then((r) => r.json()),
      fetchAuth("/schedule").then((r) => r.json()),
    ]);

    const daysOfWeek = [
      { value: "MON", label: "Segunda-feira" },
      { value: "TUE", label: "Terça-feira" },
      { value: "WED", label: "Quarta-feira" },
      { value: "THU", label: "Quinta-feira" },
      { value: "FRI", label: "Sexta-feira" },
      { value: "SAT", label: "Sábado" },
      { value: "SUN", label: "Domingo" },
    ];

    container.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">📅 Agendamentos</h2>
            </div>
            <div class="table-container">
                <div class="overflow-x-auto">
                    <table>
                        <thead>
                            <tr><th>TV</th><th>Playlist</th><th>Dia da semana</th><th>Datas específicas</th><th>Início</th><th>Fim</th><th>Ativo</th><th>Ações</th></tr>
                        </thead>
                        <tbody>
                            ${schedules
                              .map(
                                (s) => `
                                    <tr class="border-b border-gray-800">
                                        <td class="py-3 px-4 text-gray-light">${s.child_site_name}</td>
                                        <td class="py-3 px-4 text-gray-light">${s.playlist_name}</td>
                                        <td class="py-3 px-4 text-gray-light">${daysOfWeek.find((d) => d.value === s.day_of_week)?.label || "—"}</td>
                                        <td class="py-3 px-4 text-gray-light">${s.selected_dates ? s.selected_dates.replace(/,/g, ", ") : "—"}</td>
                                        <td class="py-3 px-4 text-gray-light">${s.start_time}</td>
                                        <td class="py-3 px-4 text-gray-light">${s.end_time || "—"}</td>
                                        <td class="py-3 px-4">
                                            <span class="px-2 py-1 text-xs rounded-full ${s.active ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}">
                                                ${s.active ? "✅ Ativo" : "⛔ Inativo"}
                                            </span>
                                        </td>
                                        <td class="py-3 px-4">
                                            <button class="edit-schedule text-indigo hover:text-indigo transition mr-2" data-id="${s.id}">✏️</button>
                                            <button class="delete-schedule text-red hover:text-red transition" data-id="${s.id}">🗑️</button>
                                        </td>
                                    </tr>
                                `,
                              )
                              .join("")}
                            ${schedules.length === 0 ? `<tr><td colspan="8" class="text-center py-8 text-gray">Nenhum agendamento encontrado</td></tr>` : ""}
                        </tbody>
                    </table>
                </div>
                <div class="table-footer">
                    <button id="addScheduleBtn" class="btn btn-primary">➕ Novo Agendamento</button>
                </div>
            </div>
        `;

    document
      .getElementById("addScheduleBtn")
      ?.addEventListener("click", () => abrirModalAgendamento(null));

    document.querySelectorAll(".edit-schedule").forEach((btn) => {
      btn.addEventListener("click", () => {
        const scheduleId = parseInt(btn.dataset.id);
        const schedule = schedules.find((s) => s.id === scheduleId);
        if (schedule) abrirModalAgendamento(schedule);
      });
    });

    function abrirModalAgendamento(schedule) {
      const isEdit = !!schedule;
      const tvAtual = isEdit
        ? tvs.find((t) => t.id === schedule.child_site_id)
        : null;

      // Criar um ID único para o date selector
      const dateSelectorId = isEdit
        ? `scheduleDates_edit_${schedule.id}`
        : `scheduleDates_new`;
      const initialDates =
        isEdit && schedule.selected_dates ? schedule.selected_dates : "";

      const fields = [
        {
          label: "TV",
          id: "scheduleTV",
          type: "select",
          options: tvs.map((tv) => ({
            value: tv.codigo,
            label: `${tv.name} (${tv.codigo})`,
          })),
          value: tvAtual ? tvAtual.codigo : "",
        },
        {
          label: "Playlist",
          id: "schedulePlaylist",
          type: "select",
          options: playlists.map((p) => ({ value: p.id, label: p.name })),
          value: isEdit ? schedule.playlist_id : "",
        },
        {
          label: "Dia da Semana (opcional)",
          id: "scheduleDay",
          type: "select",
          options: [{ value: "", label: "— Nenhum —" }].concat(
            daysOfWeek.map((d) => ({ value: d.value, label: d.label })),
          ),
          value: isEdit && schedule.day_of_week ? schedule.day_of_week : "",
        },
        {
          label: "Datas específicas (opcional)",
          id: dateSelectorId,
          type: "custom",
          html: dateSelectorHtml(dateSelectorId, initialDates),
        },
        {
          label: "Hora de Início",
          id: "scheduleStart",
          type: "time",
          value: isEdit ? schedule.start_time : "",
        },
        {
          label: "Hora de Fim (opcional)",
          id: "scheduleEnd",
          type: "time",
          value: isEdit && schedule.end_time ? schedule.end_time : "",
        },
      ];

      openModal(
        isEdit ? "Editar Agendamento" : "Novo Agendamento",
        fields,
        async (values) => {
          const [
            child_site_codigo,
            playlist_id,
            day_of_week,
            selected_dates_str,
            start_time,
            end_time,
          ] = values;
          // selected_dates_str vem do hidden
          const selectedDates = selected_dates_str
            ? selected_dates_str.split(",").filter((d) => d.trim() !== "")
            : [];
          if (!child_site_codigo || !playlist_id || !start_time) {
            return showToast(
              "Preencha todos os campos obrigatórios",
              "warning",
            );
          }
          if (!day_of_week && selectedDates.length === 0) {
            return showToast(
              "Indique o dia da semana ou pelo menos uma data",
              "warning",
            );
          }
          try {
            if (isEdit) {
              await fetchAuth(`/schedule/${schedule.id}`, {
                method: "PUT",
                body: JSON.stringify({
                  child_site_codigo,
                  playlist_id: parseInt(playlist_id),
                  day_of_week: day_of_week || null,
                  start_time,
                  end_time: end_time || null,
                  selected_dates: selectedDates,
                }),
              });
              showToast("Agendamento atualizado!", "success");
            } else {
              await fetchAuth("/schedule", {
                method: "POST",
                body: JSON.stringify({
                  child_site_codigo,
                  playlist_id: parseInt(playlist_id),
                  day_of_week: day_of_week || null,
                  start_time,
                  end_time: end_time || null,
                  selected_dates: selectedDates,
                }),
              });
              showToast("Agendamento criado!", "success");
            }
            loadSchedule(container);
          } catch (err) {
            showToast("Erro ao guardar agendamento", "error");
          }
        },
      );
    }

    document.querySelectorAll(".delete-schedule").forEach((btn) => {
      btn.addEventListener("click", () => {
        const scheduleId = btn.dataset.id;
        confirmModal("Remover este agendamento?", async () => {
          await fetchAuth(`/schedule/${scheduleId}`, { method: "DELETE" });
          showToast("Agendamento removido", "success");
          loadSchedule(container);
        });
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="text-red">Erro: ${err.message}</p>`;
  }
}

// ===== INICIALIZAR =====
if (checkAuth()) carregarTudo();
