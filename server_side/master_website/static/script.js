// ============================================================
// CODIGO FIXO E PERMANENTE
// ============================================================
const FIXED_CODE = "5827";  // CODIGO DE 4 DIGITOS - VOCE PODE ALTERAR
// ============================================================

// Gerenciador de midia (usando localStorage para persistencia entre abas/recarregamentos)
class PersistentMediaManager {
    constructor(code) {
        this.storageKey = `cast_media_${code}`;
        this.listeners = new Set();
        this.loadMedia();
    }
    
    loadMedia() {
        const stored = localStorage.getItem(this.storageKey);
        if(stored) {
            try {
                this.mediaItems = JSON.parse(stored);
            } catch(e) { 
                this.mediaItems = []; 
            }
        } else {
            this.mediaItems = [];
        }
    }
    
    saveMedia() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.mediaItems));
        this.notifyListeners();
    }
    
    getMedia() {
        return [...this.mediaItems];
    }
    
    addMedia(mediaItem) {
        this.mediaItems.push(mediaItem);
        this.saveMedia();
        return true;
    }
    
    removeMedia(mediaId) {
        this.mediaItems = this.mediaItems.filter(m => m.id !== mediaId);
        this.saveMedia();
        return true;
    }
    
    clearAllMedia() {
        this.mediaItems = [];
        this.saveMedia();
    }
    
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
    
    notifyListeners() {
        this.listeners.forEach(cb => cb(this.getMedia()));
    }
    
    // Sincronizar com mudancas em outras abas
    startSync() {
        window.addEventListener('storage', (e) => {
            if(e.key === this.storageKey) {
                this.loadMedia();
                this.notifyListeners();
            }
        });
    }
}

// Instancia unica do gerenciador (codigo fixo)
const mediaManager = new PersistentMediaManager(FIXED_CODE);
mediaManager.startSync();

const root = document.getElementById('appRoot');
let tvUnsubscribe = null;

// ==================== MODO TV ====================
function initTVMode() {
    if(tvUnsubscribe) tvUnsubscribe();
    
    tvUnsubscribe = mediaManager.subscribe((mediaItems) => {
        renderTVMediaContent(mediaItems);
    });
    
    renderTVScreen();
}

function renderTVScreen() {
    const mediaItems = mediaManager.getMedia();
    root.innerHTML = `
        <div class="card tv-mode">
            <div>
                <div class="fixed-code-badge">CODIGO DE PAREO</div>
                <h2 style="color:#ffd9a5; margin-top: 5px;">MODO TV</h2>
                <p style="color:#bbccff; margin-bottom: 5px;">Use o codigo abaixo para conectar do seu PC ou celular</p>
                <div class="tv-code-box">
                    <div class="code-digit">${FIXED_CODE}</div>
                </div>
                <p style="color:#b9c8ff; font-size:0.9rem;">Digite este codigo no seu dispositivo para enviar arquivos</p>
                <p style="color:#88aadd; font-size:0.85rem; margin-top: 8px;">Acesse o mesmo site no seu dispositivo e envie arquivos</p>
                <div class="tv-status" id="tvStatusMsg">
                    ${mediaItems.length === 0 ? '' : `${mediaItems.length} midia(s) recebida(s)`}
                </div>
                <button id="clearTvMediaBtn" class="clear-btn">Limpar todas as midias</button>
            </div>
            <div style="margin-top: 40px; width:100%;">
                <h3 style="color:#ffd27a;">Transmissao ao vivo</h3>
                <div id="tvMediaContainer" class="media-grid"></div>
            </div>
        </div>
    `;
    
    renderTVMediaContent(mediaItems);
    
    document.getElementById('clearTvMediaBtn')?.addEventListener('click', () => {
        if(confirm('Tem certeza que deseja LIMPAR TODAS as midias da TV?')) {
            mediaManager.clearAllMedia();
        }
    });
}

function renderTVMediaContent(mediaItems) {
    const container = document.getElementById('tvMediaContainer');
    const statusSpan = document.getElementById('tvStatusMsg');
    
    if(!container) return;
    
    if(statusSpan) {
        statusSpan.innerHTML = mediaItems.length === 0 ? '' : `${mediaItems.length} midia(s) recebida(s)`;
    }
    
    if(mediaItems.length === 0) {
        container.innerHTML = `<div class="no-media">Nenhuma midia enviada ainda.<br><br><strong>Como enviar:</strong><br>1. Abra o mesmo site no seu PC ou celular<br>2. Digite o codigo <strong style="color:#ffb347;">${FIXED_CODE}</strong><br>3. Envie fotos e videos para a TV</div>`;
        return;
    }
    
    container.innerHTML = mediaItems.map(item => `
        <div class="media-card">
            <div class="media-title">${escapeHtml(item.name)} (${item.type?.split('/')[0] || 'arquivo'})</div>
            <div class="media-viewer">
                ${item.type?.startsWith('image/') ? `<img src="${item.dataURL}" alt="imagem" style="max-width:100%; border-radius:24px;">` : 
                  item.type?.startsWith('video/') ? `<video controls src="${item.dataURL}" style="max-width:100%; max-height:280px; border-radius:24px;"></video>` : 
                  `<div style="padding:20px; background:#1f2a36;">${escapeHtml(item.name)} (arquivo nao visualizavel diretamente)</div>`}
            </div>
        </div>
    `).join('');
}

function escapeHtml(str) {
    if(!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if(m === '&') return '&amp;';
        if(m === '<') return '&lt;';
        if(m === '>') return '&gt;';
        return m;
    });
}

// Inicializar a TV diretamente
initTVMode();