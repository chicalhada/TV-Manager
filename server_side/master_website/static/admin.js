// admin.js - Painel administrativo (com checkboxes de TVs por item e exportação de histórico)
const API_BASE = window.location.origin + "/api";

// ===== FUNÇÕES AUXILIARES PARA DATAS MÚLTIPLAS =====
function dateSelectorHtml(containerId, initialDates = "", playlistId = null) {
  let datesArray = [];
  if (typeof initialDates === "string" && initialDates.trim() !== "") {
    datesArray = initialDates.split(",").filter((d) => d.trim() !== "");
  } else if (Array.isArray(initialDates)) {
    datesArray = initialDates;
  }

  const dataPlaylistAttr =
    playlistId != null ? ` data-playlist="${playlistId}"` : "";

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
        <div class="date-selector" data-container="${containerId}"${dataPlaylistAttr}>
            <div class="date-tags-container">
                ${tagsHtml}
            </div>
            <div class="date-input-row">
                <input type="date" class="date-picker-input" id="${containerId}_start" title="De">
                <span class="text-xs text-gray">até</span>
                <input type="date" class="date-picker-input" id="${containerId}_end" title="Até (opcional, para adicionar um intervalo de dias)">
                <button type="button" class="btn btn-sm btn-primary add-date-btn" onclick="addDateTag('${containerId}')">+ Adicionar</button>
            </div>
            <input type="hidden" id="${containerId}_hidden" value="${datesArray.join(",")}">
        </div>
    `;
}

function parseDataLocal(dataStr) {
  const [ano, mes, dia] = dataStr.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}
function formatarDataLocal(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

window.addDateTag = function (containerId) {
  const container = document.querySelector(
    `.date-selector[data-container="${containerId}"]`,
  );
  if (!container) return;
  const startInput = document.getElementById(containerId + "_start");
  const endInput = document.getElementById(containerId + "_end");
  const tagsContainer = container.querySelector(".date-tags-container");
  const hidden = document.getElementById(containerId + "_hidden");
  const startDate = startInput.value;
  const endDate = endInput.value;

  if (!startDate) {
    showToast("Selecione pelo menos a data inicial", "warning");
    return;
  }
  if (endDate && endDate < startDate) {
    showToast("A data final tem de ser depois da data inicial", "warning");
    return;
  }

  const datasParaAdicionar = [];
  if (endDate && endDate !== startDate) {
    let atual = parseDataLocal(startDate);
    const fim = parseDataLocal(endDate);
    while (atual <= fim) {
      datasParaAdicionar.push(formatarDataLocal(atual));
      atual.setDate(atual.getDate() + 1);
    }
  } else {
    datasParaAdicionar.push(startDate);
  }

  let novasDatas = 0;
  datasParaAdicionar.forEach((date) => {
    if (tagsContainer.querySelector(`[data-date="${date}"]`)) return;
    const tag = document.createElement("span");
    tag.className = "date-tag";
    tag.dataset.date = date;
    tag.innerHTML = `${date} <span class="remove-date" onclick="removeDateTag(this)">✖</span>`;
    tagsContainer.appendChild(tag);
    novasDatas++;
  });

  const dates = Array.from(tagsContainer.querySelectorAll(".date-tag")).map(
    (el) => el.dataset.date,
  );
  hidden.value = dates.join(",");
  startInput.value = "";
  endInput.value = "";

  if (novasDatas === 0) {
    showToast("Essas datas já estavam adicionadas", "warning");
  } else if (novasDatas === 1) {
    showToast("Data adicionada", "success");
  } else {
    showToast(`${novasDatas} datas adicionadas`, "success");
  }
  // Sinaliza ao auto-save que as datas desta linha mudaram
  container.dispatchEvent(new CustomEvent("dates-changed", { bubbles: true }));
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
  container.dispatchEvent(new CustomEvent("dates-changed", { bubbles: true }));
};

function getSelectedDates(containerId) {
  const hidden = document.getElementById(containerId + "_hidden");
  if (!hidden) return [];
  return hidden.value
    ? hidden.value.split(",").filter((d) => d.trim() !== "")
    : [];
}

// ===== FUNÇÕES PARA CHECKBOX DE TVs =====
function tvCheckboxHtml(containerId, tvs, selectedIds = []) {
  const ids = (selectedIds || []).map((id) => parseInt(id, 10));
  const items = tvs
    .map(
      (tv) => `
        <label class="tv-checkbox-item">
            <input type="checkbox" class="tv-checkbox" value="${tv.id}" ${ids.includes(tv.id) ? "checked" : ""}>
            <span>${tv.name}</span>
        </label>
    `,
    )
    .join("");
  return `<div class="tv-checkbox-group" id="${containerId}">${items || '<span class="text-xs text-gray">Sem TVs</span>'}</div>`;
}

function getCheckedTvIds(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll(".tv-checkbox:checked")).map(
    (el) => parseInt(el.value, 10),
  );
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

  // Restaurar botões
  confirmBtn.style.display = "";
  cancelBtn.innerText = "Cancelar";

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
    // Restaurar botão Confirmar
    confirmBtn.style.display = "";
    cancelBtn.innerText = "Cancelar";
  };

  const handleConfirm = () => {
    const values = fields.map((f) => {
      if (f.type === "custom") {
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

// ===== CATEGORIAS DE FICHEIROS =====
const CATEGORIAS_FICHEIROS = [
  { value: "", label: "— Sem categoria —" },
  { value: "Publicidade", label: "Publicidade" },
  { value: "Informação", label: "Informação" },
  { value: "Entretenimento", label: "Entretenimento" },
  { value: "Notícias", label: "Notícias" },
  { value: "Esportes", label: "Esportes" },
  { value: "Educação", label: "Educação" },
  { value: "Outra", label: "Outra" },
];

function escapeHtml(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function categorySelectHtml(selectedValue, extraClass = "", extraAttrs = "") {
  // Se o valor guardado for uma categoria personalizada (não na lista pré-definida),
  // adiciona-a temporariamente como opção para que o utilizador a veja selecionada.
  const predefinedValues = new Set(CATEGORIAS_FICHEIROS.map((c) => c.value));
  let options = CATEGORIAS_FICHEIROS.map(
    (c) => `<option value="${escapeHtml(c.value)}" ${c.value === selectedValue ? "selected" : ""}>${escapeHtml(c.label)}</option>`,
  ).join("");
  if (selectedValue && !predefinedValues.has(selectedValue)) {
    options += `<option value="${escapeHtml(selectedValue)}" selected>${escapeHtml(selectedValue)}</option>`;
  }
  return `<select class="category-select ${extraClass}" ${extraAttrs}>${options}</select>`;
}

async function guardarCategoria(mediaId, category, selectEl) {
  try {
    const resp = await fetchAuth(`/media/${mediaId}`, {
      method: "PUT",
      body: JSON.stringify({ category: category || null }),
    });
    if (!resp.ok) throw new Error("Erro ao guardar categoria");
    showToast("Categoria atualizada", "success");
    if (selectEl) {
      selectEl.classList.add("category-saved");
      setTimeout(() => selectEl.classList.remove("category-saved"), 800);
    }
  } catch (err) {
    showToast("Erro ao guardar categoria", "error");
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
                            <tr><th>ID</th><th>Ficheiro</th><th>Pré-visualização</th><th>Tipo</th><th>Categoria</th><th>Ações</th></tr>
                        </thead>
                        <tbody>
                            ${media
                              .map((m) => {
                                const isVideo =
                                  m.mime_type &&
                                  m.mime_type.startsWith("video/");
                                const fullUrl = getFullUrl(m.url);
                                const nomeExibido =
                                  m.original_name || m.filename;
                                return `
                                        <tr class="border-b border-gray-800 hover:bg-gray-800/50 transition">
                                            <td class="py-3 px-4 text-sm text-gray">#${m.id}</td>
                                            <td class="py-3 px-4 text-sm font-medium text-white" style="word-break: break-all; max-width: 250px;">${nomeExibido}</td>
                                            <td class="py-3 px-4">
                                                ${
                                                  isVideo
                                                    ? `<video src="${fullUrl}" class="thumbnail-video" muted autoplay loop playsinline preload="metadata" onclick="showLightbox('${m.url}')"></video>`
                                                    : `<img src="${fullUrl}" alt="${nomeExibido}" class="thumbnail-image" onclick="showLightbox('${m.url}')" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="thumbnail-placeholder" style="display:none;">🖼️</div>`
                                                }
                                            </td>
                                            <td class="py-3 px-4 text-sm text-gray">${m.mime_type}</td>
                                            <td class="py-3 px-4">
                                                ${categorySelectHtml(m.category, "media-category-select", `data-media-id="${m.id}"`)}
                                            </td>
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
                <div class="table-footer" style="flex-wrap: wrap; gap: 0.75rem;">
                    <div class="flex items-center gap-2" style="min-width: 220px;">
                        <span class="text-sm text-gray">Categoria:</span>
                        ${categorySelectHtml("", "upload-category-select", `id="uploadCategorySelect"`)}
                    </div>
                    <div class="flex-1"></div>
                    <label class="btn btn-ghost cursor-pointer">
                        📦 Importar ZIP
                        <input type="file" id="zipUpload" accept=".zip,application/zip" class="hidden">
                    </label>
                    <label class="btn btn-primary cursor-pointer">
                        ⬆️ Upload
                        <input type="file" id="mediaUpload" multiple accept="image/*,video/*" class="hidden">
                    </label>
                </div>
            </div>
        `;

    document.getElementById("zipUpload")
      ?.addEventListener("change", async function () {
        const file = this.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append("file", file);
        const category = document.getElementById("uploadCategorySelect")?.value || "";
        if (category) fd.append("category", category);
        const token = localStorage.getItem("admin_token");
        try {
          const resp = await fetch(`${API_BASE}/upload/zip`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
          const data = await resp.json();
          if (resp.ok) {
            const n = data.imported ? data.imported.length : 0;
            const ignoredMsg =
              data.ignored && data.ignored.length
                ? ` (${data.ignored.length} ficheiro(s) ignorado(s) por formato não suportado)`
                : "";
            showToast(
              `${n} ficheiro(s) importado(s) do ZIP${ignoredMsg}`,
              n > 0 ? "success" : "warning",
            );
            loadMedia(container);
            loadDashboard(document.getElementById("dashboardContainer"));
          } else {
            showToast(data.error || "Erro ao importar ZIP", "error");
          }
        } catch (e) {
          showToast("Erro de conexão", "error");
        }
        this.value = "";
      });

    document
      .getElementById("mediaUpload")
      ?.addEventListener("change", async function () {
        const files = this.files;
        if (!files.length) return;
        const fd = new FormData();
        for (let f of files) fd.append("file", f);
        const category = document.getElementById("uploadCategorySelect")?.value || "";
        if (category) fd.append("category", category);
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

    // Alteração de categoria de ficheiros
    document.querySelectorAll(".media-category-select").forEach((sel) => {
      // Evita duplicar inputs personalizados em re-renderizações
      if (sel.dataset.categoryBound) return;
      sel.dataset.categoryBound = "1";
      sel.addEventListener("change", async function () {
        const mediaId = this.dataset.mediaId;
        let category = this.value;
        const wrapper = this.parentElement;
        let customInput = wrapper?.querySelector(".category-custom-input");

        if (category === "Outra") {
          if (!customInput) {
            customInput = document.createElement("input");
            customInput.type = "text";
            customInput.className = "category-custom-input";
            customInput.placeholder = "Nova categoria";
            customInput.style.marginTop = "0.25rem";
            customInput.style.width = "100%";
            customInput.maxLength = 50;
            wrapper.appendChild(customInput);
          }
          customInput.focus();
          // Guarda no blur/enter
          const saveCustom = async () => {
            const val = customInput.value.trim();
            if (!val) return;
            await guardarCategoria(mediaId, val, this);
          };
          customInput.addEventListener("blur", saveCustom);
          customInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") saveCustom();
          });
          return;
        }

        if (customInput) {
          customInput.remove();
        }
        await guardarCategoria(mediaId, category, this);
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="text-red">Erro: ${err.message}</p>`;
  }
}

// ===== AUTO-SAVE DE ITENS DA PLAYLIST (substitui o botão 🔄) =====
// As alterações em datas, horário, duração e TVs por item são guardadas
// automaticamente (com debounce) sem necessitar de clique manual.
const autoUpdateTimers = {};
function scheduleItemAutoUpdate(itemId, playlistId) {
  if (autoUpdateTimers[itemId]) clearTimeout(autoUpdateTimers[itemId]);
  autoUpdateTimers[itemId] = setTimeout(function () {
    enviarItemUpdate(itemId, playlistId);
  }, 700);
}
async function enviarItemUpdate(itemId, playlistId) {
  const startEl = document.querySelector(
    `.starttime-input[data-item="${itemId}"]`,
  );
  if (!startEl) return;
  const endEl = document.querySelector(`.endtime-input[data-item="${itemId}"]`);
  const durEl = document.querySelector(`.duration-input[data-item="${itemId}"]`);
  if (!durEl) return;
  const startTime = startEl.value;
  const endTime = endEl ? endEl.value : "";
  const duration = parseInt(durEl.value, 10);
  const selectedDates = getSelectedDates(`datesItem_${itemId}`);
  const selectedTvIds = getCheckedTvIds(`tvCheckItem_${itemId}`);
  if (!duration || duration < 1)
    return showToast("Duração inválida para guardar", "warning");
  if ((startTime && !endTime) || (!startTime && endTime))
    return showToast("Defina ambas as horas para guardar", "warning");
  if (startTime && endTime && startTime >= endTime)
    return showToast("Hora de início tem de ser antes da hora de fim", "warning");
  try {
    await fetchAuth(`/playlists/${playlistId}/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({
        start_time: startTime || null,
        end_time: endTime || null,
        selected_dates: selectedDates,
        duration_seconds: duration,
        tv_ids: selectedTvIds,
      }),
    });
    flashRowSave(itemId);
  } catch (err) {
    showToast("Erro ao guardar alterações", "error");
  }
}
function flashRowSave(itemId) {
  const startEl = document.querySelector(
    `.starttime-input[data-item="${itemId}"]`,
  );
  if (!startEl) return;
  const row = startEl.closest("tr");
  if (!row) return;
  row.classList.add("row-saved");
  setTimeout(function () {
    row.classList.add("row-saved-fading");
    setTimeout(function () {
      row.classList.remove("row-saved");
      row.classList.remove("row-saved-fading");
    }, 1200);
  }, 600);
}

// ===== PLAYLISTS (com checkboxes de TVs) =====
async function loadPlaylists(container) {
  try {
    const [playlists, media, tvs] = await Promise.all([
      fetchAuth("/playlists").then((r) => r.json()),
      fetchAuth("/media").then((r) => r.json()),
      fetchAuth("/tvs").then((r) => r.json()),
    ]);
    let html = `
            <div class="section-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <h2 class="section-title">📋 Playlists</h2>
                <button id="historyModalBtn" class="btn btn-primary">📜 Histórico</button>
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
                            ${media.map((m) => `<option value="${m.id}">${m.original_name || m.filename}</option>`).join("")}
                        </select>
                        <span class="text-xs text-gray">das</span>
                        <input type="time" id="startTime_${p.id}" class="rounded-xl border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-light">
                        <span class="text-xs text-gray">até</span>
                        <input type="time" id="endTime_${p.id}" class="rounded-xl border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-light">
                        <span class="text-xs text-gray">(vazio = sempre)</span>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray">Duração:</span>
                            <input type="number" id="duration_${p.id}" min="1" value="10" style="width:4.5rem" class="rounded-xl border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-light">
                            <span class="text-xs text-gray">seg</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray">Datas:</span>
                            ${dateSelectorHtml(`datesNew_${p.id}`)}
                            <span class="text-xs text-gray">(vazio = sempre)</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray">TVs:</span>
                            ${tvCheckboxHtml(`tvCheckNew_${p.id}`, tvs)}
                            <span class="text-xs text-gray">(nenhuma = todas)</span>
                        </div>
                        <button class="add-item btn btn-success btn-sm" data-id="${p.id}">➕ Adicionar</button>
                    </div>
                    ${
                      items.length
                        ? `
                            <div class="overflow-x-auto">
                                <table class="playlist-items-table">
                                    <thead>
                                        <tr><th>Ordem</th><th>Ficheiro</th><th>Pré‑vis.</th><th>Datas</th><th>Horário</th><th>TVs</th><th>Duração</th><th>Ações</th></tr>
                                    </thead>
                                    <tbody>
                                        ${items
                                          .map(
                                            (item) => `
                                                <tr>
                                                    <td class="py-2 px-3 text-gray">${item.display_order}</td>
                                                    <td class="py-2 px-3 text-gray-light" style="word-break: break-all; max-width: 200px;">${item.original_name || item.filename}</td>
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
                                                        ${dateSelectorHtml(`datesItem_${item.id}`, item.selected_dates || "", p.id)}
                                                    </td>
                                                    <td class="py-2 px-3">
                                                        <input type="time" class="starttime-input rounded border border-gray-700 bg-gray-800 px-1 py-0.5 text-sm text-gray-light" value="${item.start_time || ""}" data-item="${item.id}" data-playlist="${p.id}">
                                                        <span class="text-gray text-xs">até</span>
                                                        <input type="time" class="endtime-input rounded border border-gray-700 bg-gray-800 px-1 py-0.5 text-sm text-gray-light" value="${item.end_time || ""}" data-item="${item.id}" data-playlist="${p.id}">
                                                        ${!item.start_time && !item.end_time ? '<div class="text-xs text-gray mt-0.5">(sempre)</div>' : ""}
                                                    </td>
                                                    <td class="py-2 px-3">
                                                        ${tvCheckboxHtml(`tvCheckItem_${item.id}`, tvs, item.tv_ids || [])}
                                                    </td>
                                                    <td class="py-2 px-3">
                                                        <input type="number" min="1" class="duration-input rounded border border-gray-700 bg-gray-800 px-1 py-0.5 text-sm text-gray-light" style="width:4.5rem" value="${item.duration_seconds || 10}" data-item="${item.id}" data-playlist="${p.id}">
                                                        <span class="text-gray text-xs">seg</span>
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

    // ===== BOTÃO DE HISTÓRICO =====
    document
      .getElementById("historyModalBtn")
      ?.addEventListener("click", abrirModalHistorico);

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
        const durationInput = document.getElementById(`duration_${pid}`);
        const duration = durationInput ? parseInt(durationInput.value, 10) : 10;
        const selectedDates = getSelectedDates(`datesNew_${pid}`);
        const selectedTvIds = getCheckedTvIds(`tvCheckNew_${pid}`);
        if (!mid) return showToast("Selecione um ficheiro", "warning");
        if (!duration || duration < 1)
          return showToast(
            "Indique uma duração válida (em segundos)",
            "warning",
          );
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
              duration_seconds: duration,
              tv_ids: selectedTvIds,
            }),
          });
          showToast("Item adicionado", "success");
          loadPlaylists(container);
        } catch (err) {
          showToast("Erro ao adicionar item", "error");
        }
      }),
    );

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

    // Auto-save: alterações em datas, horário, duração e TVs por item são
    // enviadas automaticamente ao servidor (sem botão manual).
    document
      .querySelectorAll(".starttime-input, .endtime-input, .duration-input")
      .forEach(function (input) {
        input.addEventListener("change", function () {
          const itemId = parseInt(this.dataset.item, 10);
          const playlistId = parseInt(this.dataset.playlist, 10);
          if (itemId && playlistId)
            scheduleItemAutoUpdate(itemId, playlistId);
        });
      });
    document
      .querySelectorAll('.tv-checkbox-group[id^="tvCheckItem_"] .tv-checkbox')
      .forEach(function (cb) {
        cb.addEventListener("change", function () {
          const group = this.closest(".tv-checkbox-group");
          if (!group) return;
          const m = group.id.match(/tvCheckItem_(\d+)/);
          if (!m) return;
          const itemId = parseInt(m[1], 10);
          const dateSel = document.querySelector(
            `.date-selector[data-container="datesItem_${itemId}"]`,
          );
          const playlistId = dateSel
            ? parseInt(dateSel.dataset.playlist || "0", 10)
            : null;
          if (itemId && playlistId)
            scheduleItemAutoUpdate(itemId, playlistId);
        });
      });
    document
      .querySelectorAll('.date-selector[data-container^="datesItem_"]')
      .forEach(function (ds) {
        ds.addEventListener("dates-changed", function () {
          const m = this.dataset.container.match(/datesItem_(\d+)/);
          if (!m) return;
          const itemId = parseInt(m[1], 10);
          const playlistId = parseInt(this.dataset.playlist || "0", 10);
          if (itemId && playlistId)
            scheduleItemAutoUpdate(itemId, playlistId);
        });
      });
  } catch (err) {
    container.innerHTML = `<p class="text-red">Erro: ${err.message}</p>`;
  }
}

// ===== MODAL DE HISTÓRICO COM EXPORTAÇÃO =====
async function abrirModalHistorico() {
  // Buscar todas as TVs para o filtro
  let tvs = [];
  try {
    tvs = await fetchAuth("/tvs").then((r) => r.json());
  } catch (e) {}

  // Buscar histórico inicial (últimos 500)
  let historyData = [];
  try {
    historyData = await fetchAuth("/history?limit=500").then((r) => r.json());
  } catch (e) {
    showToast("Erro ao carregar histórico", "error");
    return;
  }

  // Construir opções de ano/mês
  const now = new Date();
  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const anos = [];
  for (let y = now.getFullYear(); y >= 2020; y--) anos.push(y);

  const filtersHtml = `
        <div class="history-modal-filters">
            <label>
                Categoria:
                <select id="historyFilterTipo">
                    <option value="">Todas</option>
                    <option value="video">🎬 Vídeos</option>
                    <option value="imagem">🖼️ Imagens</option>
                </select>
            </label>
            <label>
                TV:
                <select id="historyFilterTv">
                    <option value="">Todas</option>
                    ${tvs.map((tv) => `<option value="${tv.id}">${tv.name}</option>`).join("")}
                </select>
            </label>
            <label>
                Mês:
                <select id="historyFilterMes">
                    <option value="">Todos</option>
                    ${meses.map((m, i) => `<option value="${String(i + 1).padStart(2, "0")}">${m}</option>`).join("")}
                </select>
            </label>
            <label>
                Ano:
                <select id="historyFilterAno">
                    <option value="">Todos</option>
                    ${anos.map((a) => `<option value="${a}">${a}</option>`).join("")}
                </select>
            </label>
            <button id="historyFilterBtn" class="btn btn-primary btn-sm">Filtrar</button>
            <button id="historyExportBtn" class="btn btn-success btn-sm">📥 Exportar Resumo</button>
        </div>
    `;

  const bodyHtml = `
        ${filtersHtml}
        <div id="historyTableWrapper" style="max-height: 50vh; overflow-y: auto;">
            <table class="history-modal-table">
                <thead>
                    <tr><th>TV</th><th>Item</th><th>Tipo</th><th>Data/Hora</th></tr>
                </thead>
                <tbody id="historyModalBody">
                    ${renderHistoryRows(historyData)}
                </tbody>
            </table>
        </div>
    `;

  openModal(
    "📜 Histórico de Reprodução",
    [{ type: "custom", label: "", id: "historyCustom", html: bodyHtml }],
    () => {
      // Fechar apenas
    },
  );

  // Esconder botão Confirmar e mudar Cancelar para Fechar
  document.getElementById("modalConfirmBtn").style.display = "none";
  document.getElementById("modalCancelBtn").innerText = "Fechar";

  // Evento de filtro
  document
    .getElementById("historyFilterBtn")
    ?.addEventListener("click", function () {
      aplicarFiltrosHistorico(historyData);
    });
  document
    .querySelectorAll(
      "#historyFilterTipo, #historyFilterTv, #historyFilterMes, #historyFilterAno",
    )
    .forEach((el) =>
      el.addEventListener("change", () => aplicarFiltrosHistorico(historyData)),
    );

  // Evento de exportação
  document
    .getElementById("historyExportBtn")
    ?.addEventListener("click", function () {
      exportarHistorico(historyData);
    });

  function aplicarFiltrosHistorico(data) {
    const tipo = document.getElementById("historyFilterTipo").value;
    const tvId = document.getElementById("historyFilterTv").value;
    const mes = document.getElementById("historyFilterMes").value;
    const ano = document.getElementById("historyFilterAno").value;

    let filtered = data;
    if (tipo) filtered = filtered.filter((h) => h.tipo === tipo);
    if (tvId) filtered = filtered.filter((h) => h.child_site_id == tvId);
    if (mes || ano) {
      filtered = filtered.filter((h) => {
        if (!h.played_at) return false;
        const d = new Date(h.played_at.replace(" ", "T"));
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const a = d.getFullYear();
        if (mes && m !== mes) return false;
        if (ano && a != ano) return false;
        return true;
      });
    }
    const tbody = document.getElementById("historyModalBody");
    if (tbody) tbody.innerHTML = renderHistoryRows(filtered);
  }

  function exportarHistorico(data) {
    // Aplicar os mesmos filtros atuais
    const tipo = document.getElementById("historyFilterTipo").value;
    const tvId = document.getElementById("historyFilterTv").value;
    const mes = document.getElementById("historyFilterMes").value;
    const ano = document.getElementById("historyFilterAno").value;

    let filtered = data;
    if (tipo) filtered = filtered.filter((h) => h.tipo === tipo);
    if (tvId) filtered = filtered.filter((h) => h.child_site_id == tvId);
    if (mes || ano) {
      filtered = filtered.filter((h) => {
        if (!h.played_at) return false;
        const d = new Date(h.played_at.replace(" ", "T"));
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const a = d.getFullYear();
        if (mes && m !== mes) return false;
        if (ano && a != ano) return false;
        return true;
      });
    }

    if (!filtered.length) {
      showToast("Não há dados para exportar com esses filtros", "warning");
      return;
    }

    // Construir resumo
    let csv = "TV;Item;Tipo;Data/Hora\n";
    filtered.forEach((h) => {
      const dataHora = h.played_at
        ? new Date(h.played_at.replace(" ", "T")).toLocaleString("pt-PT")
        : "—";
      csv += `${h.child_site_name};${h.item_name || "—"};${h.tipo || "—"};${dataHora}\n`;
    });

    // Adicionar resumo no final
    const total = filtered.length;
    const videos = filtered.filter((h) => h.tipo === "video").length;
    const imagens = filtered.filter((h) => h.tipo === "imagem").length;
    const outros = total - videos - imagens;
    const resumo = `
\n=== RESUMO ===
Total de itens: ${total}
Vídeos: ${videos}
Imagens: ${imagens}
Outros: ${outros}
Período: ${mes ? `Mês ${mes}` : "Todos"} ${ano ? `Ano ${ano}` : ""}
TV: ${tvId ? tvs.find((t) => t.id == tvId)?.name || tvId : "Todas"}
Categoria: ${tipo || "Todas"}
`;
    csv += resumo;

    // Download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    const nomeArquivo = `historico_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute("download", nomeArquivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Exportação concluída!", "success");
  }
}

function renderHistoryRows(history) {
  if (!history || history.length === 0) {
    return `<tr><td colspan="4" class="history-modal-empty">Sem registos</td></tr>`;
  }
  return history
    .map((h) => {
      const icone =
        h.tipo === "video" ? "🎬" : h.tipo === "imagem" ? "🖼️" : "📄";
      const dataHora = h.played_at
        ? new Date(h.played_at.replace(" ", "T")).toLocaleString("pt-PT")
        : "—";
      return `
                <tr>
                    <td>${h.child_site_name} <span class="text-xs text-gray font-mono">(${h.codigo})</span></td>
                    <td style="word-break: break-all; max-width: 250px;">${h.item_name || "—"}</td>
                    <td>${icone} ${h.tipo || "—"}</td>
                    <td class="text-sm text-gray-light">${dataHora}</td>
                </tr>
            `;
    })
    .join("");
}

// ===== AGENDAMENTOS =====
async function loadSchedule(container) {
  try {
    const [tvs, playlists, schedules] = await Promise.all([
      fetchAuth("/tvs").then((r) => r.json()),
      fetchAuth("/playlists").then((r) => r.json()),
      fetchAuth("/schedule").then((r) => r.json()),
    ]);

    container.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">📅 Agendamentos</h2>
            </div>
            <div class="table-container">
                <div class="overflow-x-auto">
                    <table>
                        <thead>
                            <tr><th>TV</th><th>Playlist</th><th>Datas específicas</th><th>Início</th><th>Fim</th><th>Ativo</th><th>Ações</th></tr>
                        </thead>
                        <tbody>
                            ${schedules
                              .map(
                                (s) => `
                                    <tr class="border-b border-gray-800">
                                        <td class="py-3 px-4 text-gray-light">${s.child_site_name}</td>
                                        <td class="py-3 px-4 text-gray-light">${s.playlist_name}</td>
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
                            ${schedules.length === 0 ? `<tr><td colspan="7" class="text-center py-8 text-gray">Nenhum agendamento encontrado</td></tr>` : ""}
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
          label: "Datas específicas",
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
            selected_dates_str,
            start_time,
            end_time,
          ] = values;
          const selectedDates = selected_dates_str
            ? selected_dates_str.split(",").filter((d) => d.trim() !== "")
            : [];
          if (!child_site_codigo || !playlist_id || !start_time) {
            return showToast(
              "Preencha todos os campos obrigatórios",
              "warning",
            );
          }
          if (selectedDates.length === 0) {
            return showToast("Indique pelo menos uma data", "warning");
          }
          try {
            if (isEdit) {
              await fetchAuth(`/schedule/${schedule.id}`, {
                method: "PUT",
                body: JSON.stringify({
                  child_site_codigo,
                  playlist_id: parseInt(playlist_id),
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
if (checkAuth()) {
  carregarTudo();
}
