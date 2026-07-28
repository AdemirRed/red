import './style.css'

/**
 * CloudShare Pro - Sistema Profissional de Gerenciamento de Arquivos
 * Frontend moderno com Vite
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
        console.log('🚀 Inicializando CloudShare Pro...');
        
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
        
        // Adicionar comandos de debug ao console
        console.log('🔧 Comandos de debug disponíveis:');
        console.log('- cloudShare.debugFileAccess(78) // Debugar acesso ao arquivo');
        console.log('- cloudShare.forceDirectDownload(78) // Tentar download direto');
        console.log('- cloudShare.listBackendFiles() // Listar arquivos do backend + órfãos');
        console.log('- cloudShare.downloadOrphanFile(78, "beckup_vilmar.rar") // Baixar arquivo órfão');
        console.log('- cloudShare.testUpload() // Testar funcionalidade de upload');
        console.log('- cloudShare.toggleUploadArea() // Mostrar/esconder área de upload');
        console.log('- cloudShare.loadFiles() // Recarregar lista de arquivos');
        
        console.log('✅ CloudShare Pro iniciado');
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

        document.getElementById('sortFilter').addEventListener('change', () => {
            this.applyFilters();
        });

        // Busca global
        document.getElementById('globalSearch').addEventListener('input', () => {
            this.applyFilters();
        });

        // Upload
        document.getElementById('uploadBtn').addEventListener('click', () => {
            this.toggleUploadArea();
        });

        document.getElementById('uploadArea').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });

        // Drag & Drop
        this.setupDragAndDrop();

        // Login
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            this.handleLogin(e);
        });

        document.getElementById('guestAccess').addEventListener('click', (e) => {
            e.preventDefault();
            this.enterGuestMode();
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
    }

    async checkAuth() {
        try {
            const authData = localStorage.getItem('cloudshare_auth');
            if (authData) {
                const parsed = JSON.parse(authData);
                if (parsed.token && Date.now() < parsed.expiresAt) {
                    this.authToken = parsed.token;
                    this.currentUser = parsed.user;
                    this.updateUserInterface();
                    this.hideLoginModal();
                    return;
                }
            }
            
            // Não autenticado - mostrar modal de login
            this.showLoginModal();
        } catch (error) {
            console.error('Erro na verificação de auth:', error);
            this.showLoginModal();
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        if (!username || !password) {
            this.showMessage('Preencha todos os campos', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success) {
                this.authToken = data.token;
                this.currentUser = data.user;
                
                // Salvar no localStorage
                localStorage.setItem('cloudshare_auth', JSON.stringify({
                    token: data.token,
                    user: data.user,
                    expiresAt: Date.now() + (data.expiresIn || 7 * 24 * 60 * 60 * 1000)
                }));

                this.updateUserInterface();
                this.hideLoginModal();
                await this.loadFiles();
                this.showMessage('Login realizado com sucesso!', 'success');
            } else {
                this.showMessage(data.message || 'Credenciais inválidas', 'error');
            }
        } catch (error) {
            console.error('Erro no login:', error);
            this.showMessage('Erro na conexão', 'error');
        }
    }

    enterGuestMode() {
        this.currentUser = null;
        this.authToken = null;
        this.currentView = 'public-files'; // Visitantes veem arquivos públicos por padrão
        this.hideLoginModal();
        this.updateUserInterface();
        this.loadFiles();
    }

    logout() {
        localStorage.removeItem('cloudshare_auth');
        this.currentUser = null;
        this.authToken = null;
        this.showLoginModal();
        this.updateUserInterface();
    }

    updateUserInterface() {
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        const userRole = document.getElementById('userRole');
        const adminSection = document.getElementById('adminSection');

        if (this.currentUser) {
            userAvatar.textContent = this.currentUser.username.charAt(0).toUpperCase();
            userName.textContent = this.currentUser.username;
            userRole.textContent = this.currentUser.is_admin ? 'Administrador' : 'Usuário';
            
            if (this.currentUser.is_admin) {
                adminSection.style.display = 'block';
            }
            
            document.getElementById('userInfo').style.display = 'block';
        } else {
            userAvatar.textContent = '👤';
            userName.textContent = 'Visitante';
            userRole.textContent = 'Modo Público';
            adminSection.style.display = 'none';
            document.getElementById('userInfo').style.display = 'block';
        }
        
        // Atualizar informações de limite de upload
        this.updateUploadLimitsInfo();
    }

    updateUploadLimitsInfo() {
        const uploadLimitsInfo = document.getElementById('uploadLimitsInfo');
        
        if (this.currentUser) {
            if (this.currentUser.is_admin) {
                uploadLimitsInfo.innerHTML = `
                    <p><i class="fas fa-crown"></i> <strong>Upload Ilimitado</strong></p>
                    <p style="font-size: 12px; margin-top: 4px;">Como administrador, você pode enviar arquivos de qualquer tamanho</p>
                `;
                uploadLimitsInfo.className = 'upload-limits-info admin-unlimited';
            } else {
                uploadLimitsInfo.innerHTML = `
                    <p><i class="fas fa-info-circle"></i> <strong>Limite de 200MB por arquivo</strong></p>
                    <p style="font-size: 12px; margin-top: 4px;">Suporte para múltiplos arquivos</p>
                `;
                uploadLimitsInfo.className = 'upload-limits-info user-limited';
            }
        } else {
            uploadLimitsInfo.innerHTML = `
                <p><i class="fas fa-users"></i> <strong>Modo Público</strong></p>
                <p style="font-size: 12px; margin-top: 4px;">Faça login para fazer upload de arquivos</p>
            `;
            uploadLimitsInfo.className = 'upload-limits-info';
        }
    }

    switchView(view) {
        // Atualizar navegação ativa
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`[data-view="${view}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        this.currentView = view;
        
        // Atualizar título da página
        const titles = {
            'my-files': 'Meus Arquivos',
            'public-files': 'Arquivos Públicos',
            'recent': 'Arquivos Recentes',
            'shared': 'Compartilhados'
        };
        
        document.getElementById('pageTitle').textContent = titles[view] || 'Arquivos';
        
        // Recarregar arquivos
        this.loadFiles();
    }

    applyCategoryFilter(category) {
        // Atualizar navegação ativa
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`[data-filter="${category}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        // Definir filtro e aplicar
        document.getElementById('typeFilter').value = category;
        this.applyFilters();
    }

    setViewMode(mode) {
        this.viewMode = mode;
        
        // Atualizar botões
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.getElementById(mode === 'grid' ? 'gridViewBtn' : 'listViewBtn').classList.add('active');
        
        // Atualizar visualização
        const filesGrid = document.getElementById('filesGrid');
        const filesList = document.getElementById('filesList');
        
        if (mode === 'grid') {
            filesGrid.classList.add('active');
            filesList.classList.remove('active');
        } else {
            filesGrid.classList.remove('active');
            filesList.classList.add('active');
        }
        
        // Salvar preferência
        localStorage.setItem('viewMode', mode);
        
        // Re-renderizar arquivos
        this.renderFiles();
    }

    async loadFiles() {
        this.showLoading();
        
        try {
            const params = new URLSearchParams();
            
            // Filtros baseados na view atual
            if (this.currentView === 'public-files') {
                params.append('public_only', 'true');
            } else if (this.currentView === 'my-files' && this.currentUser) {
                // Apenas arquivos do usuário logado
            } else if (this.currentView === 'recent') {
                params.append('sort', 'created_at');
                params.append('order', 'DESC');
                params.append('limit', '50');
            }

            const headers = {};
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            const response = await fetch(`${this.apiBase}/api/files?${params}`, {
                headers,
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                // Mapear dados da API para estrutura interna
                this.files = data.files.map(file => ({
                    id: file.id,
                    original_name: file.originalName,
                    filename: file.filename,
                    size: file.size,
                    mimetype: file.type,
                    created_at: file.uploadedAt,
                    user_id: file.isOwner ? (this.currentUser ? this.currentUser.id : null) : null,
                    is_public: file.isPublic,
                    owner_username: file.owner,
                    canDelete: file.canDelete,
                    deleteToken: file.deleteToken
                }));
                
                this.applyFilters();
                this.updateFileCounts();
            } else {
                this.showMessage(data.message || 'Erro ao carregar arquivos', 'error');
                this.files = [];
                this.renderFiles();
            }
        } catch (error) {
            console.error('Erro ao carregar arquivos:', error);
            this.showMessage('Erro na conexão', 'error');
            this.files = [];
            this.renderFiles();
        } finally {
            this.hideLoading();
        }
    }

    applyFilters() {
        let filtered = [...this.files];
        
        // Filtro de tipo
        const typeFilter = document.getElementById('typeFilter').value;
        if (typeFilter !== 'all') {
            filtered = filtered.filter(file => this.getFileCategory(file.mimetype) === typeFilter);
        }
        
        // Filtro de data
        const dateFilter = document.getElementById('dateFilter').value;
        if (dateFilter !== 'all') {
            const now = new Date();
            
            filtered = filtered.filter(file => {
                const fileDate = new Date(file.created_at);
                switch (dateFilter) {
                    case 'today':
                        return fileDate.toDateString() === now.toDateString();
                    case 'week':
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        return fileDate >= weekAgo;
                    case 'month':
                        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        return fileDate >= monthAgo;
                    case 'year':
                        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                        return fileDate >= yearAgo;
                    default:
                        return true;
                }
            });
        }
        
        // Busca
        const searchTerm = document.getElementById('globalSearch').value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(file => 
                file.original_name.toLowerCase().includes(searchTerm)
            );
        }
        
        // Ordenação
        const sortFilter = document.getElementById('sortFilter').value;
        filtered.sort((a, b) => {
            switch (sortFilter) {
                case 'name_asc':
                    return a.original_name.localeCompare(b.original_name);
                case 'name_desc':
                    return b.original_name.localeCompare(a.original_name);
                case 'size_asc':
                    return a.size - b.size;
                case 'size_desc':
                    return b.size - a.size;
                case 'date_asc':
                    return new Date(a.created_at) - new Date(b.created_at);
                case 'date_desc':
                default:
                    return new Date(b.created_at) - new Date(a.created_at);
            }
        });
        
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
                        <div class="file-meta">
                            <div class="file-size">${this.formatFileSize(file.size)}</div>
                            <div class="file-date">${this.formatDate(file.created_at)}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Configurar preview de vídeo
        this.setupVideoPreview();
    }

    renderListView() {
        const container = document.getElementById('filesTableBody');
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

    setupVideoPreview() {
        document.querySelectorAll('.file-card[data-file-id]').forEach(card => {
            const fileId = card.dataset.fileId;
            const file = this.filteredFiles.find(f => f.id == fileId);
            
            if (file && this.getFileCategory(file.mimetype) === 'video') {
                card.addEventListener('mouseenter', () => {
                    this.startVideoPreview(fileId);
                });
                
                card.addEventListener('mouseleave', () => {
                    this.stopVideoPreview(fileId);
                });
            }
        });
    }

    startVideoPreview(fileId) {
        // Implementar preview automático de vídeo aqui
        console.log('Iniciar preview do vídeo:', fileId);
    }

    stopVideoPreview(fileId) {
        // Parar preview de vídeo
        console.log('Parar preview do vídeo:', fileId);
    }

    // Ações de arquivo
    shareFile(fileName) {
        // Decodificar nome do arquivo
        const decodedFileName = decodeURIComponent(fileName);
        let file = this.filteredFiles.find(f => f.original_name === decodedFileName) || this.files.find(f => f.original_name === decodedFileName);
        
        if (!file) {
            console.log(`🔍 Arquivo "${decodedFileName}" não encontrado localmente para compartilhamento`);
            this.showMessage('Arquivo não encontrado. Recarregando lista...', 'warning');
            
            // Tentar recarregar e procurar novamente
            this.loadFiles().then(() => {
                file = this.filteredFiles.find(f => f.original_name === decodedFileName) || this.files.find(f => f.original_name === decodedFileName);
                if (file) {
                    this.shareFile(fileName); // Chamar novamente após recarregar
                } else {
                    this.showMessage('Arquivo não encontrado após recarregamento', 'error');
                }
            });
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
        this.showMessage(`🔗 Links de compartilhamento gerados para "${file.original_name}"`, 'success');
    }

    closeShareModal() {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('shareModal').style.display = 'none';
        this.currentShareFile = null;
    }

    async copyToClipboard(inputId) {
        const input = document.getElementById(inputId);
        const linkText = input.value;
        
        try {
            // Tentar usar a API moderna de clipboard primeiro
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(linkText);
                this.showMessage('🔗 Link copiado para a área de transferência!', 'success');
            } else {
                // Fallback para método antigo
                input.select();
                input.setSelectionRange(0, 99999);
                
                const successful = document.execCommand('copy');
                if (successful) {
                    this.showMessage('🔗 Link copiado para a área de transferência!', 'success');
                } else {
                    throw new Error('Comando de cópia falhou');
                }
            }
            
            // Destacar temporariamente o input
            input.style.backgroundColor = '#28a745';
            input.style.color = 'white';
            setTimeout(() => {
                input.style.backgroundColor = '';
                input.style.color = '';
            }, 1000);
            
        } catch (err) {
            console.error('Erro ao copiar:', err);
            this.showMessage('❌ Erro ao copiar link. Tente selecionar manualmente.', 'error');
            
            // Selecionar o texto para o usuário copiar manualmente
            input.focus();
            input.select();
        }
        
        input.blur();
    }

    openShareLink() {
        if (this.currentShareFile) {
            const baseUrl = 'redblackspy.ddns.net:8181';
            const directLink = `http://${baseUrl}/${encodeURIComponent(this.currentShareFile.original_name)}`;
            
            try {
                window.open(directLink, '_blank');
                this.showMessage(`🌐 Abrindo "${this.currentShareFile.original_name}" em nova aba...`, 'info');
            } catch (error) {
                this.showMessage('❌ Erro ao abrir link. Verifique se pop-ups estão bloqueados.', 'error');
                console.error('Erro ao abrir link:', error);
            }
        } else {
            this.showMessage('❌ Nenhum arquivo selecionado para compartilhamento', 'error');
        }
    }

    async downloadFile(fileName) {
        // Decodificar nome do arquivo
        const decodedFileName = decodeURIComponent(fileName);
        let file = this.filteredFiles.find(f => f.original_name === decodedFileName) || this.files.find(f => f.original_name === decodedFileName);
        
        if (!file) {
            // Tentar recarregar a lista de arquivos
            console.log(`⚠️ Arquivo "${decodedFileName}" não encontrado na lista atual, recarregando...`);
            try {
                await this.loadFiles();
                file = this.filteredFiles.find(f => f.original_name === decodedFileName) || this.files.find(f => f.original_name === decodedFileName);
            } catch (error) {
                console.error('Erro ao recarregar arquivos:', error);
            }
            
            if (!file) {
                console.error(`❌ Arquivo "${decodedFileName}" não encontrado após recarregamento`);
                this.showMessage(`Arquivo "${decodedFileName}" não encontrado. O arquivo pode ter sido removido ou você não tem permissão para acessá-lo.`, 'error');
                return;
            }
        }

        // Construir URL de download baseada no nome do arquivo
        console.log(`🔍 Verificando existência do arquivo "${decodedFileName}" no backend...`);
        
        const fileSizeMB = file.size / (1024 * 1024);
        const downloadUrl = `${this.apiBase}/${fileName}`;
        
        console.log('Construindo URL de download:', {
            fileName: decodedFileName,
            encodedFileName: fileName,
            fullUrl: downloadUrl,
            currentLocation: window.location.href
        });
        
        try {
            const headers = {};
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }
            
            // Verificar se arquivo existe e está acessível
            const checkResponse = await fetch(downloadUrl, {
                method: 'HEAD',
                headers,
                credentials: 'include'
            });
            
            if (!checkResponse.ok) {
                if (checkResponse.status === 404) {
                    console.error(`❌ Arquivo "${decodedFileName}" não existe no backend (404)`);
                    // Recarregar lista para sincronizar com backend
                    console.log('📋 Recarregando lista de arquivos para sincronizar...');
                    await this.loadFiles();
                    this.showMessage(`Arquivo não encontrado no servidor. A lista foi atualizada.`, 'error');
                    return;
                } else if (checkResponse.status === 403) {
                    console.log(`⚠️ Arquivo "${decodedFileName}" existe mas requer autenticação (403)`);
                    // Arquivo existe, mas precisamos de autenticação - continuar com o download
                } else {
                    console.error(`❌ Erro ao verificar arquivo "${decodedFileName}": ${checkResponse.status}`);
                    this.showMessage(`Erro ao verificar arquivo no servidor (${checkResponse.status})`, 'error');
                    return;
                }
            } else {
                console.log(`✅ Arquivo "${decodedFileName}" existe e está acessível no backend`);
            }
        } catch (error) {
            console.error('Erro na verificação de existência:', error);
            // Se a verificação falhar, continuar com o download mesmo assim
            console.log('⚠️ Falha na verificação, mas continuando com download...');
        }

        // Encontrar o botão que foi clicado para adicionar loading
        const downloadButton = document.querySelector(`[onclick="cloudShare.downloadFile('${fileName}')"]`);
        if (downloadButton) {
            this.setButtonLoading(downloadButton, true);
        }

        try {
            // Verificar se o token é válido antes de tentar o download
            if (this.authToken) {
                console.log('Verificando validade do token...');
                try {
                    // Usar a rota /api/files para verificar se o token funciona
                    const authCheck = await fetch(`${this.apiBase}/api/files?limit=1`, {
                        headers: { 'Authorization': `Bearer ${this.authToken}` },
                        credentials: 'include'
                    });
                    
                    if (!authCheck.ok) {
                        console.log('Token inválido, removendo...');
                        this.authToken = null;
                        localStorage.removeItem('cloudshare_auth');
                        this.updateUserInterface();
                    } else {
                        const authData = await authCheck.json();
                        console.log('Token válido, arquivos carregados:', authData.files?.length || 0);
                    }
                } catch (error) {
                    console.log('Erro na verificação do token:', error);
                }
            }

            // Mostrar progresso de download
            this.showDownloadProgress(file.original_name);
            
            // Determinar tipo de notificação baseado no tamanho do arquivo
            let message = `📥 Iniciando download de "${file.original_name}"...`;
            
            if (fileSizeMB > 100) {
                message += ` (arquivo grande: ${this.formatFileSize(file.size)})`;
                this.showMessage(message, 'warning');
            } else {
                this.showMessage(message, 'info');
            }

            // Criar elemento de download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = file.original_name;
            link.style.display = 'none';
                headers['Authorization'] = `Bearer ${this.authToken}`;
                console.log('Token encontrado, adicionando ao header');
            } else {
                console.log('Nenhum token encontrado, requisição sem autenticação');
            }

            const checkResponse = await fetch(downloadUrl, {
                method: 'HEAD',
                headers,
                credentials: 'include'
            });

            // Log detalhado para debug
            console.log('Download check response:', {
                status: checkResponse.status,
                statusText: checkResponse.statusText,
                headers: Object.fromEntries([...checkResponse.headers.entries()]),
                url: downloadUrl,
                hasToken: !!this.authToken
            });

            if (!checkResponse.ok) {
                let errorMessage;
                let retrySuccess = false;
                
                // Se for 404, tentar várias URLs alternativas
                if (checkResponse.status === 404) {
                    console.log('Erro 404 detectado, tentando URLs alternativas...');
                    
                    const alternativeUrls = [
                        `http://localhost:8181/api/files/${fileId}/download`,
                        `http://127.0.0.1:8181/api/files/${fileId}/download`,
                        `${window.location.protocol}//${window.location.hostname}:8181/api/files/${fileId}/download`
                    ];
                    
                    for (const testUrl of alternativeUrls) {
                        try {
                            console.log(`Testando URL alternativa: ${testUrl}`);
                            const retryResponse = await fetch(testUrl, {
                                method: 'HEAD',
                                headers,
                                credentials: 'include'
                            });
                            
                            console.log(`Resultado: ${retryResponse.status} ${retryResponse.statusText}`);
                            
                            if (retryResponse.ok || retryResponse.status === 403) {
                                console.log(`Sucesso com URL: ${testUrl}`);
                                // Atualizar a URL de download para usar a que funciona
                                downloadUrl = testUrl;
                                
                                // Se for 403, ainda é um erro, mas a URL está correta
                                if (retryResponse.status === 403) {
                                    checkResponse = retryResponse; // Usar essa resposta para processar o erro 403
                                } else {
                                    retrySuccess = true;
                                }
                                break;
                            }
                        } catch (retryError) {
                            console.log(`Erro na tentativa com ${testUrl}:`, retryError);
                        }
                    }
                }
                
                // Se ainda há erro após as tentativas
                if (!retrySuccess && !checkResponse.ok) {
                    switch(checkResponse.status) {
                        case 404:
                            // Forçar reload da lista e informar que o arquivo não existe mais
                            console.error(`❌ Arquivo ID ${fileId} retornou 404 - removendo da lista local`);
                            await this.loadFiles(); // Sincronizar com backend
                            errorMessage = `Arquivo não encontrado no servidor. O arquivo pode ter sido removido. A lista foi atualizada.`;
                            break;
                        case 403:
                            if (!this.authToken) {
                                errorMessage = `Acesso negado. Este arquivo requer autenticação. Clique no botão "Login" para acessar.`;
                                // Mostrar modal de login automaticamente
                                setTimeout(() => this.showLoginModal(), 1000);
                            } else {
                                errorMessage = `Acesso negado. Este arquivo é privado e você não tem permissão para baixá-lo.`;
                            }
                            break;
                        case 500:
                            errorMessage = `Erro interno do servidor. Tente novamente em alguns instantes.`;
                            break;
                        default:
                            errorMessage = `Erro ao acessar arquivo (${checkResponse.status}). Tente novamente.`;
                    }
                    
                    // Log adicional para debug
                    console.error('Erro no download:', {
                        fileId,
                        fileName: file.original_name,
                        status: checkResponse.status,
                        statusText: checkResponse.statusText,
                        hasToken: !!this.authToken,
                        originalUrl: `${this.apiBase}/api/files/${fileId}/download`,
                        finalUrl: downloadUrl,
                        errorMessage,
                        fileExistsLocally: this.filteredFiles.some(f => f.id == fileId)
                    });
                    
                    throw new Error(errorMessage);
                }
            }

            // Criar elemento de download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = file.original_name;
            link.style.display = 'none';
            
            // Para arquivos grandes (>50MB) ou com autenticação, usar download progressivo
            const useProgressiveDownload = fileSizeMB > 50 || this.authToken;
            
            if (useProgressiveDownload) {
                console.log('Usando download progressivo para arquivo grande/autenticado');
                
                // Mostrar progresso detalhado
                this.showDetailedDownloadProgress(file.original_name, file.size);
                
                // Download progressivo com chunks
                const response = await fetch(downloadUrl, {
                    headers,
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    let errorMessage;
                    switch(response.status) {
                        case 404:
                            errorMessage = `Arquivo não encontrado durante o download. O arquivo pode ter sido removido.`;
                            break;
                        case 403:
                            errorMessage = `Acesso negado durante o download. Verifique suas permissões.`;
                            break;
                        case 500:
                            errorMessage = `Erro interno do servidor durante o download. Tente novamente.`;
                            break;
                        default:
                            errorMessage = `Erro no download (${response.status}). Tente novamente.`;
                    }
                    throw new Error(errorMessage);
                }
                
                // Ler o stream em chunks
                const reader = response.body.getReader();
                const chunks = [];
                let receivedLength = 0;
                
                try {
                    while(true) {
                        if (this.downloadCanceled) {
                            reader.cancel();
                            throw new Error('Download cancelado pelo usuário');
                        }
                        
                        const { done, value } = await reader.read();
                        
                        if (done) break;
                        
                        chunks.push(value);
                        receivedLength += value.length;
                        
                        // Atualizar progresso
                        this.updateDownloadProgress(receivedLength, file.size);
                        
                        // Pequena pausa para não travar a UI (a cada 5MB)
                        if (chunks.length % 50 === 0) { // Aproximadamente a cada 5MB (assumindo chunks de ~100KB)
                            await new Promise(resolve => setTimeout(resolve, 1));
                        }
                    }
                    
                    // Download completo - mostrar finalização
                    this.showDownloadCompleting();
                    
                    // Combinar todos os chunks
                    const blob = new Blob(chunks);
                    const url = window.URL.createObjectURL(blob);
                    link.href = url;
                    
                    // Cleanup do blob URL após o download
                    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                    
                } catch (error) {
                    if (this.downloadCanceled) {
                        throw new Error('Download cancelado');
                    }
                    throw error;
                }
                
            } else {
                console.log('Usando download direto para arquivo pequeno');
                // Para arquivos pequenos sem autenticação, download direto
            }

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Mostrar notificação de sucesso com instruções se necessário
            let successMessage;
            if (useProgressiveDownload) {
                successMessage = `✅ Download de "${file.original_name}" processado com sucesso! O arquivo foi baixado e está sendo salvo pelo navegador.`;
                
                // Para arquivos muito grandes, dar dica adicional
                if (fileSizeMB > 500) {
                    setTimeout(() => {
                        this.showMessage(`💡 Dica: Arquivo muito grande (${this.formatFileSize(file.size)}). O salvamento pode demorar alguns instantes dependendo do seu dispositivo.`, 'info');
                    }, 2000);
                }
            } else {
                successMessage = fileSizeMB > 100 
                    ? `✅ Download de "${file.original_name}" iniciado! Aguarde o download do arquivo grande...`
                    : `✅ Download de "${file.original_name}" iniciado com sucesso!`;
            }
                
            this.showMessage(successMessage, 'success');

            // Esconder progresso após um delay
            setTimeout(() => {
                this.hideDownloadProgress();
            }, 2000);

        } catch (error) {
            console.error('Erro no download:', error);
            this.showMessage(`❌ Erro no download: ${error.message}`, 'error');
            this.hideDownloadProgress();
        } finally {
            // Remover loading do botão
            if (downloadButton) {
                this.setButtonLoading(downloadButton, false);
            }
        }
    }

    async deleteFile(fileId) {
        if (!confirm('Tem certeza que deseja excluir este arquivo?')) {
            return;
        }

        try {
            const headers = {};
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            const response = await fetch(`${this.apiBase}/api/files/${fileId}`, {
                method: 'DELETE',
                headers
            });

            const data = await response.json();

            if (data.success) {
                this.showMessage('Arquivo excluído com sucesso!', 'success');
                await this.loadFiles();
            } else {
                this.showMessage(data.message || 'Erro ao excluir arquivo', 'error');
            }
        } catch (error) {
            console.error('Erro ao excluir arquivo:', error);
            this.showMessage('Erro na conexão', 'error');
        }
    }

    // Utilitários
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

    updateFileCounts() {
        // Para usuários logados: contar arquivos próprios
        // Para visitantes: mostrar todos os arquivos como públicos
        let myFilesCount = 0;
        let publicFilesCount = 0;
        
        if (this.currentUser) {
            myFilesCount = this.files.filter(f => f.user_id === this.currentUser.id).length;
            publicFilesCount = this.files.filter(f => f.is_public).length;
        } else {
            // Visitante - todos os arquivos são públicos
            publicFilesCount = this.files.length;
            myFilesCount = 0;
        }
        
        const myFilesElement = document.getElementById('myFilesCount');
        const publicFilesElement = document.getElementById('publicFilesCount');
        
        if (myFilesElement) myFilesElement.textContent = myFilesCount;
        if (publicFilesElement) publicFilesElement.textContent = publicFilesCount;
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

    showLoginModal() {
        document.getElementById('modalOverlay').style.display = 'flex';
        document.getElementById('loginModal').style.display = 'block';
    }

    hideLoginModal() {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('loginModal').style.display = 'none';
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

        // Adicionar eventos
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            this.removeToast(toast);
        });

        // Adicionar ao container
        container.appendChild(toast);

        // Mostrar com animação
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        // Remover automaticamente após 5 segundos
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

    // Funções auxiliares para feedback visual
    setButtonLoading(buttonElement, loading = true) {
        if (loading) {
            buttonElement.classList.add('loading');
            buttonElement.disabled = true;
        } else {
            buttonElement.classList.remove('loading');
            buttonElement.disabled = false;
        }
    }

    showDownloadProgress(fileName) {
        // Remover progresso anterior se existir
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
        
        // Auto-remover após 3 segundos
        setTimeout(() => {
            this.hideDownloadProgress();
        }, 3000);
    }

    showDetailedDownloadProgress(fileName, totalSize) {
        // Remover progresso anterior se existir
        this.hideDownloadProgress();
        
        const progressDiv = document.createElement('div');
        progressDiv.id = 'downloadProgress';
        progressDiv.className = 'download-progress detailed';
        progressDiv.innerHTML = `
            <div class="download-progress-header">
                <i class="fas fa-download" style="color: var(--accent-blue);"></i>
                <span>Baixando arquivo...</span>
                <button class="download-close-btn" onclick="cloudShare.cancelDownload()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="download-progress-file">${fileName}</div>
            <div class="download-progress-size">
                <span class="downloaded">0 B</span> / <span class="total">${this.formatFileSize(totalSize)}</span>
            </div>
            <div class="download-progress-bar">
                <div class="download-progress-fill" style="width: 0%"></div>
            </div>
            <div class="download-progress-stats">
                <span class="download-percentage">0%</span>
                <span class="download-speed">Calculando...</span>
                <span class="download-eta">Estimando tempo...</span>
            </div>
        `;
        
        document.body.appendChild(progressDiv);
        
        // Inicializar variáveis de progresso
        this.downloadStartTime = Date.now();
        this.downloadCanceled = false;
    }

    updateDownloadProgress(receivedLength, totalSize) {
        const progressDiv = document.getElementById('downloadProgress');
        if (!progressDiv || this.downloadCanceled) return;
        
        const percentage = Math.round((receivedLength / totalSize) * 100);
        const elapsed = Date.now() - this.downloadStartTime;
        const speed = receivedLength / (elapsed / 1000); // bytes per second
        const remaining = totalSize - receivedLength;
        const eta = remaining / speed; // seconds
        
        // Atualizar elementos
        const downloadedSpan = progressDiv.querySelector('.downloaded');
        const progressFill = progressDiv.querySelector('.download-progress-fill');
        const percentageSpan = progressDiv.querySelector('.download-percentage');
        const speedSpan = progressDiv.querySelector('.download-speed');
        const etaSpan = progressDiv.querySelector('.download-eta');
        
        if (downloadedSpan) downloadedSpan.textContent = this.formatFileSize(receivedLength);
        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (percentageSpan) percentageSpan.textContent = `${percentage}%`;
        if (speedSpan) speedSpan.textContent = `${this.formatFileSize(speed)}/s`;
        if (etaSpan && eta < Infinity && eta > 0) {
            etaSpan.textContent = `${this.formatTime(eta)} restante`;
        }
    }

    showDownloadCompleting() {
        const progressDiv = document.getElementById('downloadProgress');
        if (!progressDiv) return;
        
        const header = progressDiv.querySelector('.download-progress-header span');
        const stats = progressDiv.querySelector('.download-progress-stats');
        
        if (header) {
            header.innerHTML = 'Preparando download...';
            const icon = header.previousElementSibling;
            if (icon) {
                icon.className = 'fas fa-check-circle';
                icon.style.color = 'var(--accent-green)';
            }
        }
        
        if (stats) {
            stats.innerHTML = `
                <span style="color: var(--accent-green); font-weight: 600;">100% - Download concluído!</span>
                <span style="color: var(--text-secondary);">Iniciando no navegador...</span>
            `;
        }
    }

    cancelDownload() {
        this.downloadCanceled = true;
        this.hideDownloadProgress();
        this.showMessage('Download cancelado pelo usuário', 'warning');
    }

    formatTime(seconds) {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        return `${Math.round(seconds / 3600)}h`;
    }

    hideDownloadProgress() {
        const existing = document.getElementById('downloadProgress');
        if (existing) {
            existing.remove();
        }
    }

    // Função de debug para diagnóstico
    async debugFileAccess(fileId) {
        console.log('=== DEBUG FILE ACCESS ===');
        console.log('File ID:', fileId);
        console.log('Current user:', this.currentUser);
        console.log('Auth token:', this.authToken ? 'Present' : 'None');
        console.log('API base:', this.apiBase);
        console.log('Current location:', window.location.href);
        
        const file = this.filteredFiles.find(f => f.id == fileId);
        console.log('File in local list:', file);
        
        // Testar várias URLs
        const urls = [
            `${this.apiBase}/api/files/${fileId}/download`,
            `http://localhost:8181/api/files/${fileId}/download`,
            `http://127.0.0.1:8181/api/files/${fileId}/download`,
            `http://localhost:3000/api/files/${fileId}/download`,
            `${window.location.protocol}//${window.location.hostname}:8181/api/files/${fileId}/download`
        ];
        
        console.log('Testando URLs disponíveis:');
        for (const url of urls) {
            console.log(`Testing URL: ${url}`);
            try {
                const response = await fetch(url, {
                    method: 'HEAD',
                    headers: this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {},
                    credentials: 'include'
                });
                console.log(`  Status: ${response.status} ${response.statusText}`);
                if (response.status === 200) {
                    console.log(`  ✅ SUCESSO! URL funcional encontrada: ${url}`);
                } else if (response.status === 403) {
                    console.log(`  🔒 Arquivo existe mas requer autenticação: ${url}`);
                }
            } catch (error) {
                console.log(`  ❌ Error:`, error.message);
            }
        }
        
        console.log('=========================');
    }

    // Função para forçar download direto (bypass proxy)
    async forceDirectDownload(fileId) {
        console.log('🔧 Forçando download direto...');
        const directUrl = `http://localhost:8181/api/files/${fileId}/download`;
        
        try {
            const headers = {};
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }
            
            const response = await fetch(directUrl, {
                headers,
                credentials: 'include'
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                
                const file = this.filteredFiles.find(f => f.id == fileId);
                const link = document.createElement('a');
                link.href = url;
                link.download = file ? file.original_name : `arquivo_${fileId}`;
                link.style.display = 'none';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                
                this.showMessage('✅ Download direto bem-sucedido!', 'success');
                return true;
            } else {
                console.error('Erro no download direto:', response.status, response.statusText);
                return false;
            }
        } catch (error) {
            console.error('Erro no download direto:', error);
            return false;
        }
    }

    // Lista arquivos disponíveis no backend (para debug)
    async listBackendFiles() {
        console.log('🔍 Consultando arquivos diretamente no backend...');
        try {
            const headers = {};
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }
            
            const response = await fetch(`http://localhost:8181/api/files`, {
                headers,
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log(`📋 Arquivos disponíveis no backend (${data.files.length}):`);
                data.files.forEach(f => {
                    console.log(`- ID ${f.id}: ${f.originalName} (${this.formatFileSize(f.size)})`);
                });
                
                // Também tentar listar arquivos órfãos (que existem fisicamente mas não no banco)
                console.log('\n🔍 Verificando arquivos órfãos...');
                await this.listOrphanFiles();
                
                return data.files;
            } else {
                console.error('Erro ao listar arquivos do backend:', data.message);
                return [];
            }
        } catch (error) {
            console.error('Erro na conexão com backend:', error);
            return [];
        }
    }

    // Nova função: detectar arquivos que existem fisicamente mas não no banco
    async listOrphanFiles() {
        try {
            console.log('🔍 Buscando arquivos órfãos (existem fisicamente mas não no banco)...');
            
            // Tentar acessar rota de diagnóstico (se existir) ou usar método heurístico
            const possibleIds = [78, 45, 44, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 79, 80];
            const foundOrphans = [];
            
            const headers = {};
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }
            
            console.log('🔍 Testando IDs de arquivos órfãos...');
            
            for (const testId of possibleIds) {
                try {
                    const response = await fetch(`http://localhost:8181/api/files/${testId}/download`, {
                        method: 'HEAD',
                        headers,
                        credentials: 'include'
                    });
                    
                    if (response.ok || response.status === 403) {
                        // Arquivo existe (200 = acessível, 403 = existe mas restrito)
                        foundOrphans.push({
                            id: testId,
                            status: response.status,
                            accessible: response.status === 200
                        });
                        console.log(`📁 Arquivo órfão encontrado: ID ${testId} (${response.status === 200 ? 'acessível' : 'restrito'})`);
                    }
                } catch (error) {
                    // Erro de rede, ignorar
                }
                
                // Pequena pausa para não sobrecarregar
                if (possibleIds.indexOf(testId) % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            if (foundOrphans.length > 0) {
                console.log(`\n📁 Encontrados ${foundOrphans.length} arquivos órfãos:`);
                foundOrphans.forEach(orphan => {
                    console.log(`- ID ${orphan.id}: ${orphan.accessible ? '✅ Acessível' : '🔒 Restrito'}`);
                });
                
                console.log('\n💡 Para baixar um arquivo órfão, use:');
                console.log(`cloudShare.downloadOrphanFile(${foundOrphans[0]?.id || 78})`);
            } else {
                console.log('❌ Nenhum arquivo órfão encontrado nos IDs testados');
            }
            
            return foundOrphans;
            
        } catch (error) {
            console.error('Erro ao buscar arquivos órfãos:', error);
            return [];
        }
    }

    // Nova função: baixar arquivo órfão diretamente
    async downloadOrphanFile(fileId, fileName = null) {
        console.log(`🚀 Tentando download de arquivo órfão ID ${fileId}...`);
        
        const displayName = fileName || `arquivo_${fileId}`;
        
        try {
            const headers = {};
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }
            
            // Tentar várias URLs
            const urls = [
                `http://localhost:8181/api/files/${fileId}/download`,
                `http://127.0.0.1:8181/api/files/${fileId}/download`,
                `${window.location.protocol}//${window.location.hostname}:8181/api/files/${fileId}/download`
            ];
            
            let successUrl = null;
            
            for (const url of urls) {
                try {
                    console.log(`🔗 Testando: ${url}`);
                    const response = await fetch(url, {
                        method: 'HEAD',
                        headers,
                        credentials: 'include'
                    });
                    
                    if (response.ok) {
                        successUrl = url;
                        console.log(`✅ URL funcional encontrada: ${url}`);
                        break;
                    } else if (response.status === 403) {
                        console.log(`🔒 Arquivo existe mas requer permissão: ${url}`);
                        this.showMessage(`Arquivo ID ${fileId} existe mas você não tem permissão para baixá-lo.`, 'error');
                        return;
                    }
                } catch (error) {
                    console.log(`❌ Falha em ${url}:`, error.message);
                }
            }
            
            if (!successUrl) {
                this.showMessage(`Arquivo órfão ID ${fileId} não encontrado ou inacessível.`, 'error');
                return;
            }
            
            // Fazer download
            this.showMessage(`📥 Iniciando download de arquivo órfão ID ${fileId}...`, 'info');
            
            const link = document.createElement('a');
            link.href = successUrl;
            link.download = displayName;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showMessage(`✅ Download do arquivo órfão ID ${fileId} iniciado!`, 'success');
            
        } catch (error) {
            console.error('Erro no download de arquivo órfão:', error);
            this.showMessage(`❌ Erro no download: ${error.message}`, 'error');
        }
    }

    // Nova função: testar upload (para debug)
    async testUpload() {
        console.log('🧪 Testando funcionalidade de upload...');
        
        if (!this.currentUser) {
            console.log('❌ Usuário não logado');
            this.showMessage('Faça login para testar upload', 'warning');
            return;
        }
        
        // Verificar elementos do DOM
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const uploadBtn = document.getElementById('uploadBtn');
        
        console.log('DOM Elements Check:');
        console.log('- uploadArea:', uploadArea ? '✅ Encontrado' : '❌ Não encontrado');
        console.log('- fileInput:', fileInput ? '✅ Encontrado' : '❌ Não encontrado');
        console.log('- uploadBtn:', uploadBtn ? '✅ Encontrado' : '❌ Não encontrado');
        
        // Verificar configuração de API
        console.log('Configuração:');
        console.log('- apiBase:', this.apiBase);
        console.log('- authToken:', this.authToken ? '✅ Presente' : '❌ Ausente');
        console.log('- currentUser:', this.currentUser ? `✅ ${this.currentUser.username}` : '❌ Não logado');
        
        // Testar conectividade com a rota de upload
        try {
            const testUrl = `${this.apiBase}/api/upload`;
            console.log(`🔗 Testando conectividade com: ${testUrl}`);
            
            const headers = {};
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }
            
            const response = await fetch(testUrl, {
                method: 'OPTIONS', // Teste de conectividade
                headers,
                credentials: 'include'
            });
            
            console.log(`📡 Resposta do servidor: ${response.status} ${response.statusText}`);
            
            if (response.ok || response.status === 405) { // 405 = Method Not Allowed é normal para OPTIONS
                console.log('✅ Rota de upload está acessível');
            } else {
                console.log('⚠️ Possível problema com a rota de upload');
            }
            
        } catch (error) {
            console.error('❌ Erro ao testar conectividade:', error);
        }
        
        // Instruções para o usuário
        console.log('\n📋 Para testar upload:');
        console.log('1. Clique no botão "Upload" ou execute: cloudShare.toggleUploadArea()');
        console.log('2. Arraste um arquivo para a área de upload');
        console.log('3. Ou clique na área e selecione arquivos');
        console.log('4. Monitore o console para logs detalhados');
        
        this.showMessage('✅ Teste de upload concluído. Verifique o console para detalhes.', 'info');
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        
        if (!uploadArea) {
            console.error('❌ Elemento uploadArea não encontrado para drag & drop');
            return;
        }
        
        console.log('🖱️ Configurando drag & drop para upload');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('dragover');
                console.log('🖱️ Arquivo sendo arrastado sobre a área de upload');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('dragover');
            }, false);
        });

        uploadArea.addEventListener('drop', (e) => {
            console.log('🖱️ Arquivos soltos na área de upload');
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                console.log(`📁 ${files.length} arquivo(s) detectado(s):`, Array.from(files).map(f => f.name));
                this.handleFileUpload(files);
            } else {
                console.log('⚠️ Nenhum arquivo válido detectado no drop');
                this.showMessage('Nenhum arquivo válido detectado', 'warning');
            }
        }, false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    toggleUploadArea() {
        const uploadArea = document.getElementById('uploadArea');
        const uploadBtn = document.getElementById('uploadBtn');
        
        if (!uploadArea) {
            console.error('❌ Elemento uploadArea não encontrado');
            return;
        }
        
        const isHidden = uploadArea.style.display === 'none' || !uploadArea.style.display;
        
        if (isHidden) {
            // Mostrar área de upload
            uploadArea.style.display = 'block';
            if (uploadBtn) {
                uploadBtn.classList.add('active');
                uploadBtn.innerHTML = '<i class="fas fa-times"></i> Fechar Upload';
            }
            console.log('📤 Área de upload aberta');
        } else {
            // Esconder área de upload
            uploadArea.style.display = 'none';
            if (uploadBtn) {
                uploadBtn.classList.remove('active');
                uploadBtn.innerHTML = '<i class="fas fa-plus"></i> Upload';
            }
            console.log('📤 Área de upload fechada');
        }
    }

    async handleFileUpload(files) {
        if (!files || files.length === 0) return;
        
        if (!this.currentUser) {
            this.showMessage('Faça login para fazer upload de arquivos', 'warning');
            this.showLoginModal(); // Mostrar modal de login
            return;
        }

        const formData = new FormData();
        let totalSize = 0;
        
        // Adicionar todos os arquivos ao FormData
        Array.from(files).forEach(file => {
            formData.append('files', file);
            totalSize += file.size;
        });

        // Verificar limites de tamanho
        const maxFileSize = this.currentUser.is_admin ? Infinity : 200 * 1024 * 1024; // 200MB para usuários normais
        const oversizedFiles = Array.from(files).filter(file => file.size > maxFileSize);
        
        if (oversizedFiles.length > 0) {
            const fileNames = oversizedFiles.map(f => f.name).join(', ');
            this.showMessage(`❌ Arquivos muito grandes: ${fileNames}. Limite: ${this.currentUser.is_admin ? 'Ilimitado' : '200MB'}`, 'error');
            return;
        }

        // Mostrar informações sobre o upload
        const sizeText = this.formatFileSize(totalSize);
        const fileCount = files.length;
        const fileText = fileCount === 1 ? 'arquivo' : 'arquivos';
        
        console.log(`📤 Iniciando upload de ${fileCount} ${fileText} (${sizeText})`);
        
        // Mostrar barra de progresso para upload
        this.showUploadProgress(files);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Timeout mais longo para arquivos grandes
            const timeoutMs = Math.max(120000, totalSize / (1024 * 1024) * 2000); // 2s por MB, mínimo 2min
            xhr.timeout = timeoutMs;
            
            console.log(`⏱️ Timeout configurado: ${Math.round(timeoutMs/1000)}s`);

            // Fazer requisição ANTES de configurar headers
            const uploadUrl = `${this.apiBase}/api/upload`;
            console.log(`🔗 URL de upload: ${uploadUrl}`);
            
            xhr.open('POST', uploadUrl, true);
            xhr.withCredentials = true; // Para incluir cookies

            // Configurar headers de autenticação APÓS open()
            if (this.authToken) {
                xhr.setRequestHeader('Authorization', `Bearer ${this.authToken}`);
            }

            // Progresso do upload
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    const loaded = e.loaded;
                    const total = e.total;
                    const speed = this.calculateUploadSpeed(loaded);
                    const eta = this.calculateETA(loaded, total, speed);
                    
                    this.updateUploadProgress(percentComplete, loaded, total, speed, eta);
                    
                    console.log(`📊 Upload: ${percentComplete.toFixed(1)}% (${this.formatFileSize(loaded)}/${this.formatFileSize(total)}) - ${this.formatFileSize(speed)}/s`);
                }
            });

            // Resposta
            xhr.addEventListener('load', async () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        
                        if (result.success) {
                            this.hideUploadProgress();
                            this.showMessage(`✅ Upload concluído! ${fileCount} ${fileText} enviado(s) com sucesso.`, 'success');
                            
                            // Recarregar arquivos para mostrar os novos uploads
                            console.log('🔄 Recarregando lista de arquivos...');
                            await this.loadFiles();
                            
                            // Limpar input de arquivo
                            const fileInput = document.getElementById('fileInput');
                            if (fileInput) fileInput.value = '';
                            
                            // Fechar área de upload se estiver aberta
                            this.toggleUploadArea();
                            
                            resolve(result);
                        } else {
                            throw new Error(result.message || 'Erro no upload');
                        }
                    } catch (error) {
                        console.error('❌ Erro ao fazer parse da resposta:', error);
                        this.hideUploadProgress();
                        this.showMessage(`❌ Erro no upload: Resposta inválida do servidor`, 'error');
                        reject(error);
                    }
                } else {
                    // Erro HTTP
                    let errorMessage = `Erro no servidor (${xhr.status})`;
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        errorMessage = errorData.message || errorMessage;
                    } catch (e) {
                        errorMessage = xhr.responseText.substring(0, 200) || errorMessage;
                    }
                    
                    this.hideUploadProgress();
                    this.showMessage(`❌ Erro no upload: ${errorMessage}`, 'error');
                    reject(new Error(errorMessage));
                }
            });

            // Erros de rede
            xhr.addEventListener('error', () => {
                console.error('❌ Erro de rede no upload');
                this.hideUploadProgress();
                this.showMessage('❌ Erro de conexão durante o upload. Verifique sua internet.', 'error');
                reject(new Error('Network error'));
            });

            // Timeout
            xhr.addEventListener('timeout', () => {
                console.error('❌ Timeout no upload');
                this.hideUploadProgress();
                this.showMessage('❌ Upload cancelado por timeout. Tente com arquivos menores.', 'error');
                reject(new Error('Upload timeout'));
            });

            // Cancelamento
            xhr.addEventListener('abort', () => {
                console.error('❌ Upload cancelado');
                this.hideUploadProgress();
                this.showMessage('❌ Upload cancelado pelo usuário.', 'warning');
                reject(new Error('Upload aborted'));
            });

            // Enviar dados
            xhr.send(formData);
            
            // Salvar referência do XHR para poder cancelar se necessário
            this.currentUploadXHR = xhr;
        });
    }

    // Funções auxiliares para upload
    calculateUploadSpeed(loaded) {
        if (!this.uploadStartTime) {
            this.uploadStartTime = Date.now();
            this.lastLoaded = 0;
            return 0;
        }
        
        const now = Date.now();
        const timeDiff = (now - this.uploadStartTime) / 1000; // em segundos
        const bytesDiff = loaded - this.lastLoaded;
        
        if (timeDiff < 1) return this.lastSpeed || 0; // Evitar cálculos muito frequentes
        
        const speed = bytesDiff / timeDiff;
        this.lastSpeed = speed;
        this.lastLoaded = loaded;
        this.uploadStartTime = now;
        
        return speed;
    }

    calculateETA(loaded, total, speed) {
        if (speed <= 0) return 'Calculando...';
        
        const remaining = total - loaded;
        const etaSeconds = remaining / speed;
        
        if (etaSeconds < 60) {
            return `${Math.round(etaSeconds)}s`;
        } else if (etaSeconds < 3600) {
            return `${Math.round(etaSeconds / 60)}m`;
        } else {
            return `${Math.round(etaSeconds / 3600)}h`;
        }
    }

    showUploadProgress(files) {
        // Remover progresso anterior se existir
        this.hideUploadProgress();
        
        const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
        const fileCount = files.length;
        const fileText = fileCount === 1 ? 'arquivo' : 'arquivos';
        
        const progressDiv = document.createElement('div');
        progressDiv.id = 'uploadProgress';
        progressDiv.innerHTML = `
            <div class="upload-progress-overlay">
                <div class="upload-progress-container">
                    <div class="upload-progress-header">
                        <h3>📤 Enviando ${fileCount} ${fileText}</h3>
                        <button onclick="cloudShare.cancelUpload()" class="cancel-btn">✕</button>
                    </div>
                    
                    <div class="file-list">
                        ${Array.from(files).map(file => `
                            <div class="file-item">
                                <span class="file-name">${file.name}</span>
                                <span class="file-size">${this.formatFileSize(file.size)}</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="progress-bar-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: 0%"></div>
                        </div>
                        <div class="progress-text">0% - Iniciando...</div>
                    </div>
                    
                    <div class="upload-stats">
                        <div class="stat">
                            <span class="label">Velocidade:</span>
                            <span class="value" id="uploadSpeed">Calculando...</span>
                        </div>
                        <div class="stat">
                            <span class="label">Tempo restante:</span>
                            <span class="value" id="uploadETA">Calculando...</span>
                        </div>
                        <div class="stat">
                            <span class="label">Transferido:</span>
                            <span class="value" id="uploadTransferred">0 de ${this.formatFileSize(totalSize)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(progressDiv);
        
        // Reset upload timing
        this.uploadStartTime = Date.now();
        this.lastLoaded = 0;
        this.lastSpeed = 0;
    }

    updateUploadProgress(percentComplete, loaded, total, speed, eta) {
        const progressDiv = document.getElementById('uploadProgress');
        if (!progressDiv) return;
        
        const progressFill = progressDiv.querySelector('.progress-fill');
        const progressText = progressDiv.querySelector('.progress-text');
        const speedElement = progressDiv.querySelector('#uploadSpeed');
        const etaElement = progressDiv.querySelector('#uploadETA');
        const transferredElement = progressDiv.querySelector('#uploadTransferred');
        
        if (progressFill) {
            progressFill.style.width = `${percentComplete}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${percentComplete.toFixed(1)}% - Enviando...`;
        }
        
        if (speedElement) {
            speedElement.textContent = speed > 0 ? `${this.formatFileSize(speed)}/s` : 'Calculando...';
        }
        
        if (etaElement) {
            etaElement.textContent = eta;
        }
        
        if (transferredElement) {
            transferredElement.textContent = `${this.formatFileSize(loaded)} de ${this.formatFileSize(total)}`;
        }
    }

    hideUploadProgress() {
        const progressDiv = document.getElementById('uploadProgress');
        if (progressDiv) {
            progressDiv.remove();
        }
        
        // Reset upload state
        this.uploadStartTime = null;
        this.lastLoaded = 0;
        this.lastSpeed = 0;
        this.currentUploadXHR = null;
    }

    cancelUpload() {
        if (this.currentUploadXHR) {
            this.currentUploadXHR.abort();
            console.log('🚫 Upload cancelado pelo usuário');
        }
    }

    async showFilePreview(fileName) {
        try {
            // Decodificar nome do arquivo
            const decodedFileName = decodeURIComponent(fileName);
            
            // Primeiro, tentar encontrar o arquivo na lista local (mais rápido)
            let file = this.files.find(f => f.original_name === decodedFileName) || this.filteredFiles.find(f => f.original_name === decodedFileName);
            
            if (!file) {
                console.log(`🔍 Arquivo "${decodedFileName}" não encontrado localmente, buscando no servidor...`);
                
                // Se não encontrado localmente, recarregar lista de arquivos primeiro
                await this.loadFiles();
                file = this.files.find(f => f.original_name === decodedFileName) || this.filteredFiles.find(f => f.original_name === decodedFileName);
            }

            // Se ainda não temos o arquivo, criar dados básicos de fallback
            if (!file) {
                console.log(`⚠️ Criando preview genérico para arquivo "${decodedFileName}"`);
                file = {
                    id: 'unknown',
                    original_name: decodedFileName,
                    size: 0,
                    mimetype: 'application/octet-stream',
                    uploaded_at: new Date().toISOString()
                };
            }
                    try {
                        console.log(`🔗 Tentando URL: ${url}`);
                        const response = await fetch(url, {
                            headers: this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {},
                            credentials: 'include'
                        });

                        if (response.ok) {
                            file = await response.json();
                            fetchSuccess = true;
                            console.log(`✅ Arquivo encontrado via ${url}`);
                            break;
                        } else {
                            console.log(`❌ Falha em ${url}: ${response.status}`);
                        }
                    } catch (error) {
                        console.log(`❌ Erro em ${url}:`, error.message);
                    }
                }
                
                if (!fetchSuccess) {
                    throw new Error(`Arquivo ID ${fileId} não encontrado em nenhuma rota da API`);
                }
            }

            // Se ainda não temos o arquivo, usar dados básicos de fallback
            if (!file) {
                console.log(`⚠️ Criando preview genérico para arquivo ID ${fileId}`);
                file = {
                    id: fileId,
                    original_name: `Arquivo ${fileId}`,
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
                                <button onclick="cloudShare.downloadFile(${fileId})" class="preview-btn">
                                    <i class="fas fa-download"></i> Download
                                </button>
                                <button onclick="cloudShare.shareFile(${fileId})" class="preview-btn">
                                    <i class="fas fa-share-alt"></i> Compartilhar
                                </button>
                                <button onclick="cloudShare.closePreview()" class="preview-btn close-btn">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="preview-content">
                            ${this.generatePreviewContent(file, category)}
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

    generatePreviewContent(file, category) {
        const fileId = file.id;
        
        switch (category) {
            case 'image':
                return `
                    <div class="image-preview">
                        <img src="${this.apiBase}/api/files/${fileId}/preview" 
                             alt="${file.original_name}"
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
                            <source src="${this.apiBase}/api/files/${fileId}/preview" type="${file.mimetype}">
                            Seu navegador não suporta reprodução de vídeo.
                        </video>
                    </div>
                `;
                
            case 'audio':
                return `
                    <div class="audio-preview">
                        <audio controls style="width: 100%;">
                            <source src="${this.apiBase}/api/files/${fileId}/preview" type="${file.mimetype}">
                            Seu navegador não suporta reprodução de áudio.
                        </audio>
                        <div class="audio-info">
                            <i class="fas fa-music fa-3x"></i>
                            <h4>${file.original_name}</h4>
                        </div>
                    </div>
                `;
                
            case 'document':
                if (file.mimetype === 'application/pdf') {
                    return `
                        <div class="pdf-preview">
                            <iframe src="${this.apiBase}/api/files/${fileId}/preview" 
                                    style="width: 100%; height: 70vh; border: none;">
                            </iframe>
                        </div>
                    `;
                }
                return this.generateGenericPreview(file);
                
            case 'text':
                return `
                    <div class="text-preview">
                        <iframe src="${this.apiBase}/api/files/${fileId}/preview" 
                                style="width: 100%; height: 70vh; border: 1px solid #ccc;">
                        </iframe>
                    </div>
                `;
                
            default:
                return this.generateGenericPreview(file);
        }
    }

    generateGenericPreview(file) {
        return `
            <div class="generic-preview">
                <div class="file-icon-preview">
                    <i class="${this.getFileIcon(file.mimetype)} fa-4x"></i>
                </div>
                <h4>${file.original_name}</h4>
                <p>Preview não disponível para este tipo de arquivo</p>
                <div class="preview-actions-center">
                    <button onclick="cloudShare.downloadFile(${file.id})" class="btn btn-primary">
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
}

// Inicializar aplicação
const cloudShare = new CloudSharePro();

// Expor globalmente para eventos onclick
window.cloudShare = cloudShare;

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    cloudShare.init();
});