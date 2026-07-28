import './style.css'

/**
 * CloudShare Pro - Sistema baseado em nomes de arquivo
 */

class CloudSharePro {
    constructor() {
        this.currentUser = null;
        this.authToken = null;
        this.currentView = 'my-files';
        this.viewMode = localStorage.getItem('viewMode') || 'grid';
        this.files = [];
        this.filteredFiles = [];
        this.videoPreviewTimers = new Map();
        this.currentShareFile = null;
        
        // Configuração da API - usar caminho relativo para aproveitar o proxy do Vite
        this.apiBase = '';
    }

    async init() {
        console.log('🚀 Inicializando CloudShare Pro com sistema baseado em nomes...');
        
        // Mostrar loading
        this.showLoadingScreen();
        
        // Event listeners
        this.setupEventListeners();
        
        // Verificar autenticação
        await this.checkAuth();
        
        // Carregar arquivos
        await this.loadFiles();
        
        // Configurar view mode inicial
        this.setViewMode(this.viewMode);
        
        // Esconder loading e mostrar app
        this.hideLoadingScreen();
        
        console.log('✅ CloudShare Pro iniciado com sistema baseado em nomes');
    }

    showLoadingScreen() {
        document.getElementById('loading-screen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
    }

    hideLoadingScreen() {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
    }

    setupEventListeners() {
        // Navegação lateral
        document.querySelectorAll('.nav-link[data-view]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchView(link.dataset.view);
            });
        });

        // Filtros de categoria
        document.querySelectorAll('.nav-link[data-filter]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.applyCategoryFilter(link.dataset.filter);
            });
        });

        // Toggle de visualização
        document.getElementById('gridViewBtn').addEventListener('click', () => {
            this.setViewMode('grid');
        });

        document.getElementById('listViewBtn').addEventListener('click', () => {
            this.setViewMode('list');
        });

        // Filtros
        document.getElementById('typeFilter').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('dateFilter').addEventListener('change', () => {
            this.applyFilters();
        });

        // Busca
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchFiles(e.target.value);
        });

        // Upload
        document.getElementById('uploadBtn').addEventListener('click', () => {
            this.toggleUploadArea();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files);
            }
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Login
        document.getElementById('loginBtn').addEventListener('click', () => {
            this.showLoginModal();
        });

        // Modal clicks
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideAllModals();
            }
        });

        // Configurar drag & drop
        this.setupDragAndDrop();
    }

    async checkAuth() {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const response = await fetch(`${this.apiBase}/api/user`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const userData = await response.json();
                    this.currentUser = userData;
                    this.authToken = token;
                    this.updateUIForLoggedInUser();
                } else {
                    localStorage.removeItem('token');
                    this.updateUIForGuestUser();
                }
            } catch (error) {
                console.error('Erro ao verificar autenticação:', error);
                localStorage.removeItem('token');
                this.updateUIForGuestUser();
            }
        } else {
            this.updateUIForGuestUser();
        }
    }

    updateUIForLoggedInUser() {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('userSection').style.display = 'flex';
        document.getElementById('uploadSection').style.display = 'block';
        document.getElementById('userName').textContent = this.currentUser.username;
    }

    updateUIForGuestUser() {
        document.getElementById('loginSection').style.display = 'flex';
        document.getElementById('userSection').style.display = 'none';
        document.getElementById('uploadSection').style.display = 'none';
    }

    async loadFiles() {
        try {
            this.showLoading();
            
            const headers = {};
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            const response = await fetch(`${this.apiBase}/api/files`, {
                headers,
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                this.files = data.files || [];
                this.applyFilters();
                this.updateFileCounts();
                console.log(`📋 ${this.files.length} arquivos carregados`);
            } else {
                console.error('Erro ao carregar arquivos:', data.message);
                this.showMessage('Erro ao carregar arquivos', 'error');
            }
        } catch (error) {
            console.error('Erro na conexão:', error);
            this.showMessage('Erro de conexão ao carregar arquivos', 'error');
        } finally {
            this.hideLoading();
        }
    }

    applyFilters() {
        let filtered = [...this.files];

        // Filtro de visualização
        if (this.currentView === 'my-files' && this.currentUser) {
            filtered = filtered.filter(f => f.user_id === this.currentUser.id);
        } else if (this.currentView === 'public-files') {
            filtered = filtered.filter(f => f.is_public);
        }

        // Filtro de tipo
        const typeFilter = document.getElementById('typeFilter').value;
        if (typeFilter && typeFilter !== 'all') {
            filtered = filtered.filter(f => this.getFileCategory(f.mimetype) === typeFilter);
        }

        // Filtro de data
        const dateFilter = document.getElementById('dateFilter').value;
        if (dateFilter && dateFilter !== 'all') {
            const now = new Date();
            const filterDate = new Date();
            
            switch (dateFilter) {
                case 'today':
                    filterDate.setHours(0, 0, 0, 0);
                    break;
                case 'week':
                    filterDate.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    filterDate.setMonth(now.getMonth() - 1);
                    break;
            }
            
            filtered = filtered.filter(f => new Date(f.created_at) >= filterDate);
        }

        this.filteredFiles = filtered;
        this.renderFiles();
    }

    renderFiles() {
        if (this.viewMode === 'grid') {
            this.renderGridView();
        } else {
            this.renderListView();
        }
    }

    renderGridView() {
        const container = document.getElementById('filesGrid');
        const emptyState = document.getElementById('emptyState');
        
        if (this.filteredFiles.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        
        container.innerHTML = this.filteredFiles.map(file => {
            const category = this.getFileCategory(file.mimetype);
            const isVideo = category === 'video';
            const isImage = category === 'image';
            const fileName = encodeURIComponent(file.original_name);
            
            return `
                <div class="file-card" data-file-name="${fileName}" onclick="cloudShare.showFilePreview('${fileName}')">
                    <div class="file-thumbnail-container">
                        ${isImage || isVideo ? `
                            <img src="${this.apiBase}/${fileName}" 
                                 alt="${file.original_name}" 
                                 class="file-thumbnail"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="file-icon-large" style="display: none;">
                                <i class="${this.getFileIcon(file.mimetype)}"></i>
                            </div>
                        ` : `
                            <div class="file-icon-large">
                                <i class="${this.getFileIcon(file.mimetype)}"></i>
                            </div>
                        `}
                        
                        ${isVideo ? `
                            <div class="video-overlay">
                                <div class="play-icon">
                                    <i class="fas fa-play"></i>
                                </div>
                                <div class="video-duration">0:00</div>
                            </div>
                        ` : ''}
                        
                        <div class="file-actions">
                            <button class="action-btn" onclick="event.stopPropagation(); cloudShare.shareFile('${fileName}')" title="Compartilhar">
                                <i class="fas fa-share-alt"></i>
                            </button>
                            <button class="action-btn" onclick="event.stopPropagation(); cloudShare.downloadFile('${fileName}')" title="Download">
                                <i class="fas fa-download"></i>
                            </button>
                            ${file.canDelete ? `
                                <button class="action-btn" onclick="event.stopPropagation(); cloudShare.deleteFile('${fileName}')" title="Excluir">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="file-info">
                        <div class="file-name" title="${file.original_name}">${file.original_name}</div>
                        <div class="file-details">
                            <span class="file-size">${this.formatFileSize(file.size)}</span>
                            <span class="file-date">${this.formatDate(file.created_at)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderListView() {
        const container = document.getElementById('filesList');
        const emptyState = document.getElementById('emptyState');
        
        if (this.filteredFiles.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        
        container.innerHTML = this.filteredFiles.map(file => {
            const fileName = encodeURIComponent(file.original_name);
            return `
            <div class="table-row" data-file-name="${fileName}" onclick="cloudShare.showFilePreview('${fileName}')">
                <div class="table-cell name">
                    <div class="file-icon-small">
                        <i class="${this.getFileIcon(file.mimetype)}"></i>
                    </div>
                    <span>${file.original_name}</span>
                </div>
                <div class="table-cell size">
                    ${this.formatFileSize(file.size)}
                </div>
                <div class="table-cell date">
                    ${this.formatDate(file.created_at)}
                </div>
                <div class="table-cell actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); cloudShare.shareFile('${fileName}')" title="Compartilhar">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <button class="btn-icon" onclick="event.stopPropagation(); cloudShare.downloadFile('${fileName}')" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    ${file.canDelete ? `
                        <button class="btn-icon" onclick="event.stopPropagation(); cloudShare.deleteFile('${fileName}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        }).join('');
    }

    // Função de compartilhamento usando nome do arquivo
    shareFile(fileName) {
        const decodedFileName = decodeURIComponent(fileName);
        let file = this.filteredFiles.find(f => f.original_name === decodedFileName) || this.files.find(f => f.original_name === decodedFileName);
        
        if (!file) {
            console.log(`🔍 Arquivo "${decodedFileName}" não encontrado para compartilhamento`);
            this.showMessage('Arquivo não encontrado', 'error');
            return;
        }

        this.currentShareFile = file;
        
        // Preencher modal com informações do arquivo
        document.getElementById('shareFileName').textContent = file.original_name;
        document.getElementById('shareFileSize').textContent = this.formatFileSize(file.size);
        document.getElementById('shareFileIcon').className = this.getFileIcon(file.mimetype);
        
        // Gerar links de compartilhamento baseados no nome do arquivo
        const baseUrl = 'redblackspy.ddns.net:8181';
        const directLink = `http://${baseUrl}/${fileName}`;
        const downloadLink = `http://${baseUrl}/${fileName}`;
        
        // Preencher campos de link
        document.getElementById('shareDirectLink').value = directLink;
        document.getElementById('shareDownloadLink').value = downloadLink;
        
        // Mostrar modal
        document.getElementById('modalOverlay').style.display = 'flex';
        document.getElementById('shareModal').style.display = 'block';
        
        // Mostrar notificação de compartilhamento pronto
        this.showMessage(`🔗 Links gerados para "${file.original_name}"`, 'success');
    }

    // Função de download usando nome do arquivo  
    async downloadFile(fileName) {
        const decodedFileName = decodeURIComponent(fileName);
        let file = this.filteredFiles.find(f => f.original_name === decodedFileName) || this.files.find(f => f.original_name === decodedFileName);
        
        if (!file) {
            console.log(`⚠️ Arquivo "${decodedFileName}" não encontrado`);
            this.showMessage('Arquivo não encontrado', 'error');
            return;
        }

        const downloadUrl = `${this.apiBase}/${fileName}`;
        
        console.log(`📥 Iniciando download: ${decodedFileName}`);
        console.log(`🔗 URL: ${downloadUrl}`);
        
        // Mostrar progresso
        this.showDownloadProgress(file.original_name);
        
        try {
            // Criar elemento de download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = file.original_name;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showMessage(`✅ Download de "${file.original_name}" iniciado!`, 'success');
            
            // Esconder progresso após delay
            setTimeout(() => {
                this.hideDownloadProgress();
            }, 2000);
            
        } catch (error) {
            console.error('Erro no download:', error);
            this.showMessage(`❌ Erro no download: ${error.message}`, 'error');
            this.hideDownloadProgress();
        }
    }

    // Função de preview usando nome do arquivo
    async showFilePreview(fileName) {
        try {
            const decodedFileName = decodeURIComponent(fileName);
            let file = this.files.find(f => f.original_name === decodedFileName) || this.filteredFiles.find(f => f.original_name === decodedFileName);
            
            if (!file) {
                console.log(`🔍 Arquivo "${decodedFileName}" não encontrado, recarregando...`);
                await this.loadFiles();
                file = this.files.find(f => f.original_name === decodedFileName) || this.filteredFiles.find(f => f.original_name === decodedFileName);
            }

            // Se ainda não encontrado, criar dados básicos
            if (!file) {
                console.log(`⚠️ Criando preview genérico para "${decodedFileName}"`);
                file = {
                    id: 'unknown',
                    original_name: decodedFileName,
                    size: 0,
                    mimetype: 'application/octet-stream',
                    uploaded_at: new Date().toISOString()
                };
            }

            const category = this.getFileCategory(file.mimetype);
            
            // Criar modal de preview
            const modalHTML = `
                <div class="preview-modal-overlay" id="previewModal" onclick="cloudShare.closePreview(event)">
                    <div class="preview-modal-content" onclick="event.stopPropagation()">
                        <div class="preview-header">
                            <h3>${file.original_name}</h3>
                            <div class="preview-actions">
                                <button onclick="cloudShare.downloadFile('${fileName}')" class="preview-btn">
                                    <i class="fas fa-download"></i> Download
                                </button>
                                <button onclick="cloudShare.shareFile('${fileName}')" class="preview-btn">
                                    <i class="fas fa-share-alt"></i> Compartilhar
                                </button>
                                <button onclick="cloudShare.closePreview()" class="preview-btn close-btn">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="preview-content">
                            ${this.generatePreviewContent(file, category, fileName)}
                        </div>
                        
                        <div class="preview-footer">
                            <div class="file-details">
                                <span><strong>Tamanho:</strong> ${this.formatFileSize(file.size)}</span>
                                <span><strong>Tipo:</strong> ${file.mimetype}</span>
                                <span><strong>Modificado:</strong> ${file.uploaded_at ? new Date(file.uploaded_at).toLocaleString('pt-BR') : 'Data não disponível'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remover modal anterior se existir
            const existingModal = document.getElementById('previewModal');
            if (existingModal) existingModal.remove();
            
            // Adicionar novo modal
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // Animar abertura
            requestAnimationFrame(() => {
                document.getElementById('previewModal').classList.add('show');
            });
            
        } catch (error) {
            console.error('Erro ao carregar preview:', error);
            this.showMessage(`Erro ao carregar preview: ${error.message}`, 'error');
        }
    }

    generatePreviewContent(file, category, fileName) {
        const decodedFileName = decodeURIComponent(fileName);
        
        switch (category) {
            case 'image':
                return `
                    <div class="image-preview">
                        <img src="${this.apiBase}/${fileName}" 
                             alt="${decodedFileName}"
                             onload="this.style.opacity=1"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                        <div class="preview-error" style="display: none;">
                            <i class="fas fa-image"></i>
                            <p>Não foi possível carregar a imagem</p>
                        </div>
                    </div>
                `;
                
            case 'video':
                return `
                    <div class="video-preview">
                        <video controls preload="metadata" style="max-width: 100%; max-height: 70vh;">
                            <source src="${this.apiBase}/${fileName}" type="${file.mimetype}">
                            Seu navegador não suporta reprodução de vídeo.
                        </video>
                    </div>
                `;
                
            case 'audio':
                return `
                    <div class="audio-preview">
                        <audio controls style="width: 100%;">
                            <source src="${this.apiBase}/${fileName}" type="${file.mimetype}">
                            Seu navegador não suporta reprodução de áudio.
                        </audio>
                        <div class="audio-info">
                            <i class="fas fa-music fa-3x"></i>
                            <h4>${decodedFileName}</h4>
                        </div>
                    </div>
                `;
                
            case 'document':
                if (file.mimetype === 'application/pdf') {
                    return `
                        <div class="pdf-preview">
                            <iframe src="${this.apiBase}/${fileName}" 
                                    style="width: 100%; height: 70vh; border: none;">
                            </iframe>
                        </div>
                    `;
                }
                return this.generateGenericPreview(file, fileName);
                
            default:
                return this.generateGenericPreview(file, fileName);
        }
    }

    generateGenericPreview(file, fileName) {
        return `
            <div class="generic-preview">
                <div class="file-icon-preview">
                    <i class="${this.getFileIcon(file.mimetype)} fa-4x"></i>
                </div>
                <h4>${file.original_name}</h4>
                <p>Preview não disponível para este tipo de arquivo</p>
                <div class="preview-actions-center">
                    <button onclick="cloudShare.downloadFile('${fileName}')" class="btn btn-primary">
                        <i class="fas fa-download"></i> Baixar arquivo
                    </button>
                </div>
            </div>
        `;
    }

    closePreview(event) {
        if (event && event.target !== event.currentTarget) return;
        
        const modal = document.getElementById('previewModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    }

    // Utility functions...
    getFileCategory(mimetype) {
        if (mimetype.startsWith('image/')) return 'image';
        if (mimetype.startsWith('video/')) return 'video';
        if (mimetype.startsWith('audio/')) return 'audio';
        if (mimetype.includes('pdf') || mimetype.includes('document') || mimetype.includes('text')) return 'document';
        if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('7z')) return 'archive';
        if (mimetype.includes('executable') || mimetype.includes('msdownload') || mimetype.includes('android')) return 'executable';
        return 'other';
    }

    getFileIcon(mimetype) {
        const category = this.getFileCategory(mimetype);
        const icons = {
            image: 'fas fa-image',
            video: 'fas fa-video',
            audio: 'fas fa-music',
            document: 'fas fa-file-alt',
            archive: 'fas fa-file-archive',
            executable: 'fas fa-cogs'
        };
        return icons[category] || 'fas fa-file';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'Hoje';
        if (days === 1) return 'Ontem';
        if (days < 7) return `${days} dias atrás`;
        
        return date.toLocaleDateString('pt-BR');
    }

    showMessage(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) {
            console.log(`${type.toUpperCase()}: ${message}`);
            return;
        }

        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="toast-icon ${icons[type] || icons.info}"></i>
            <div class="toast-message">${message}</div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            this.removeToast(toast);
        });

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        setTimeout(() => {
            this.removeToast(toast);
        }, 5000);
    }

    removeToast(toast) {
        if (!toast.parentNode) return;
        
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    showDownloadProgress(fileName) {
        this.hideDownloadProgress();
        
        const progressDiv = document.createElement('div');
        progressDiv.id = 'downloadProgress';
        progressDiv.className = 'download-progress';
        progressDiv.innerHTML = `
            <div class="download-progress-header">
                <i class="fas fa-download" style="color: var(--accent-blue);"></i>
                <span>Baixando arquivo...</span>
            </div>
            <div class="download-progress-file">${fileName}</div>
        `;
        
        document.body.appendChild(progressDiv);
    }

    hideDownloadProgress() {
        const existing = document.getElementById('downloadProgress');
        if (existing) {
            existing.remove();
        }
    }

    showLoading() {
        document.getElementById('loadingState').style.display = 'flex';
        document.getElementById('filesGrid').style.display = 'none';
        document.getElementById('filesList').style.display = 'none';
        document.getElementById('emptyState').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loadingState').style.display = 'none';
        if (this.viewMode === 'grid') {
            document.getElementById('filesGrid').style.display = 'grid';
        } else {
            document.getElementById('filesList').style.display = 'block';
        }
    }

    updateFileCounts() {
        let myFilesCount = 0;
        let publicFilesCount = 0;
        
        if (this.currentUser) {
            myFilesCount = this.files.filter(f => f.user_id === this.currentUser.id).length;
            publicFilesCount = this.files.filter(f => f.is_public).length;
        } else {
            publicFilesCount = this.files.length;
            myFilesCount = 0;
        }
        
        const myFilesElement = document.getElementById('myFilesCount');
        const publicFilesElement = document.getElementById('publicFilesCount');
        
        if (myFilesElement) myFilesElement.textContent = myFilesCount;
        if (publicFilesElement) publicFilesElement.textContent = publicFilesCount;
    }

    setViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('viewMode', mode);
        
        // Atualizar botões
        document.getElementById('gridViewBtn').classList.toggle('active', mode === 'grid');
        document.getElementById('listViewBtn').classList.toggle('active', mode === 'list');
        
        this.renderFiles();
    }

    switchView(view) {
        this.currentView = view;
        
        // Atualizar navegação
        document.querySelectorAll('.nav-link[data-view]').forEach(link => {
            link.classList.toggle('active', link.dataset.view === view);
        });
        
        this.applyFilters();
    }

    applyCategoryFilter(filter) {
        document.getElementById('typeFilter').value = filter;
        this.applyFilters();
    }

    searchFiles(query) {
        if (!query.trim()) {
            this.applyFilters();
            return;
        }

        const filtered = this.filteredFiles.filter(file => 
            file.original_name.toLowerCase().includes(query.toLowerCase())
        );
        
        this.filteredFiles = filtered;
        this.renderFiles();
    }

    hideAllModals() {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('shareModal').style.display = 'none';
        document.getElementById('loginModal').style.display = 'none';
    }

    setupDragAndDrop() {
        // Placeholder para drag & drop
        console.log('🖱️ Drag & drop configurado');
    }

    toggleUploadArea() {
        // Placeholder para upload
        console.log('📤 Upload área');
    }

    async copyToClipboard(inputId) {
        const input = document.getElementById(inputId);
        const linkText = input.value;
        
        try {
            await navigator.clipboard.writeText(linkText);
            this.showMessage('📋 Link copiado para a área de transferência!', 'success');
        } catch (err) {
            console.error('Erro ao copiar:', err);
            input.select();
            document.execCommand('copy');
            this.showMessage('📋 Link copiado!', 'success');
        }
    }

    closeShareModal() {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('shareModal').style.display = 'none';
        this.currentShareFile = null;
    }
}

// Inicializar aplicação
const cloudShare = new CloudSharePro();
window.cloudShare = cloudShare;

document.addEventListener('DOMContentLoaded', () => {
    cloudShare.init();
});

export default cloudShare;
