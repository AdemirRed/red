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
        
        // Configuração da API - usar proxy do Vite (sem URL completa)
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
        const gridViewBtn = document.getElementById('gridViewBtn');
        if (gridViewBtn) {
            gridViewBtn.addEventListener('click', () => {
                this.setViewMode('grid');
            });
        }

        const listViewBtn = document.getElementById('listViewBtn');
        if (listViewBtn) {
            listViewBtn.addEventListener('click', () => {
                this.setViewMode('list');
            });
        }

        // Filtros
        const typeFilter = document.getElementById('typeFilter');
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        const dateFilter = document.getElementById('dateFilter');
        if (dateFilter) {
            dateFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        // Busca - usar globalSearch em vez de searchInput
        const searchInput = document.getElementById('globalSearch') || document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchFiles(e.target.value);
            });
        }

        // Upload
        const uploadBtn = document.getElementById('uploadBtn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                this.toggleUploadArea();
            });
        }

        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files);
                }
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        // Guest Access
        const guestAccessBtn = document.getElementById('guestAccess');
        if (guestAccessBtn) {
            guestAccessBtn.addEventListener('click', () => {
                this.hideAllModals();
                this.updateUIForGuestUser();
                this.loadFiles();
            });
        }

        // Login - verificar se existe
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.showLoginModal();
            });
        }

        // Login Form Submit
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin(e);
            });
        }

        // Create Account Link
        const createAccountLink = document.getElementById('createAccountLink');
        if (createAccountLink) {
            createAccountLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showRegisterPrompt();
            });
        }

        // Forgot Password Link
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showResetPasswordModal();
            });
        }

        // Reset Password Form Submit
        const resetPasswordForm = document.getElementById('resetPasswordForm');
        if (resetPasswordForm) {
            resetPasswordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleResetPassword(e);
            });
        }

        // Back to Login Link
        const backToLoginLink = document.getElementById('backToLoginLink');
        if (backToLoginLink) {
            backToLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginModal();
            });
        }

        // Profile Button
        const profileBtn = document.getElementById('profileBtn');
        if (profileBtn) {
            profileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showProfileModal();
            });
        }

        // Settings Button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSettingsModal();
            });
        }

        // Settings Tabs
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchSettingsTab(tab.dataset.tab);
            });
        });

        // Change Password Form
        const changePasswordForm = document.getElementById('changePasswordForm');
        if (changePasswordForm) {
            changePasswordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleChangePassword(e);
            });
        }

        // Email Reset Modal - Request Code Form
        const requestResetCodeForm = document.getElementById('requestResetCodeForm');
        if (requestResetCodeForm) {
            requestResetCodeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRequestResetCode(e);
            });
        }

        // Email Reset Modal - Verify Code Form
        const verifyResetCodeForm = document.getElementById('verifyResetCodeForm');
        if (verifyResetCodeForm) {
            verifyResetCodeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleVerifyResetCode(e);
            });
        }

        // Back to Login from Email Reset
        const backToLoginFromEmail = document.getElementById('backToLoginFromEmail');
        if (backToLoginFromEmail) {
            backToLoginFromEmail.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginModal();
            });
        }

        // Modal clicks
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === e.currentTarget) {
                    this.hideAllModals();
                }
            });
        }

        // Configurar drag & drop
        this.setupDragAndDrop();
    }

    // Decodificar JWT para extrair informações do usuário
    parseJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error('Erro ao decodificar JWT:', e);
            return null;
        }
    }

    async checkAuth() {
        const token = localStorage.getItem('token');
        if (token) {
            // Primeiro, decodificar o token JWT para pegar dados imediatos
            const tokenData = this.parseJWT(token);
            if (tokenData) {
                // Setar dados básicos do JWT IMEDIATAMENTE (antes da chamada à API)
                this.currentUser = {
                    id: tokenData.id,
                    username: tokenData.username,
                    email: tokenData.email || '',
                    is_admin: tokenData.isAdmin || false,
                    is_premium: tokenData.isPremium || false
                };
                this.authToken = token;
                // Atualizar UI com dados do JWT (instantâneo)
                this.updateUIForLoggedInUser();
            }

            // Depois, buscar dados completos/atualizados da API
            try {
                const response = await fetch(`${this.apiBase}/api/user`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const userData = await response.json();
                    // Atualizar com dados completos da API
                    this.currentUser = {
                        id: userData.user.id,
                        username: userData.user.username,
                        email: userData.user.email,
                        is_admin: userData.user.isAdmin,
                        is_premium: userData.user.isPremium,
                        storage_quota: userData.user.storageQuota,
                        created_at: userData.user.createdAt
                    };
                    this.updateUIForLoggedInUser();
                } else {
                    localStorage.removeItem('token');
                    this.updateUIForGuestUser();
                }
            } catch (error) {
                console.error('Erro ao verificar autenticação:', error);
                // Não remover token em caso de erro de rede - manter dados do JWT
            }
        } else {
            this.updateUIForGuestUser();
        }
    }

    updateUIForLoggedInUser() {
        // Atualizar nome do usuário se o elemento existir
        const userName = document.getElementById('userName');
        if (userName) {
            userName.textContent = this.currentUser.username;
        }

        // Atualizar role do usuário se o elemento existir
        const userRole = document.getElementById('userRole');
        if (userRole) {
            userRole.textContent = this.currentUser.is_admin ? 'Administrador' : 'Usuário';
        }

        // Esconder botão de login
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.style.display = 'none';
        }

        // Mostrar botão de logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.style.display = 'block';
        }

        // Verificar se existem seções de login/usuário para atualizar
        const loginSection = document.getElementById('loginSection');
        if (loginSection) {
            loginSection.style.display = 'none';
        }

        const userSection = document.getElementById('userSection');
        if (userSection) {
            userSection.style.display = 'flex';
        }

        const uploadSection = document.getElementById('uploadSection');
        if (uploadSection) {
            uploadSection.style.display = 'block';
        }
    }

    updateUIForGuestUser() {
        // Atualizar nome do usuário para visitante
        const userName = document.getElementById('userName');
        if (userName) {
            userName.textContent = 'Visitante';
        }

        // Atualizar role do usuário
        const userRole = document.getElementById('userRole');
        if (userRole) {
            userRole.textContent = 'Modo Público';
        }

        // Mostrar botão de login
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.style.display = 'block';
        }

        // Esconder botão de logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
        }

        // Verificar se existem seções de login/usuário para atualizar
        const loginSection = document.getElementById('loginSection');
        if (loginSection) {
            loginSection.style.display = 'flex';
        }

        const userSection = document.getElementById('userSection');
        if (userSection) {
            userSection.style.display = 'none';
        }

        const uploadSection = document.getElementById('uploadSection');
        if (uploadSection) {
            uploadSection.style.display = 'none';
        }
    }

    async logout() {
        try {
            // Fazer logout no backend
            const response = await fetch(`${this.apiBase}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });

            // Limpar dados locais independentemente da resposta do servidor
            localStorage.removeItem('token');
            this.authToken = null;
            this.currentUser = null;

            // Atualizar UI para modo visitante
            this.updateUIForGuestUser();

            // Recarregar arquivos públicos
            await this.loadFiles();

            this.showMessage('✅ Logout realizado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro no logout:', error);
            // Mesmo com erro, limpar dados locais
            localStorage.removeItem('token');
            this.authToken = null;
            this.currentUser = null;
            this.updateUIForGuestUser();
            this.showMessage('Logout realizado localmente', 'info');
        }
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

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                this.files = data.files || [];
                
                // Debug: verificar estrutura dos arquivos
                if (this.files.length > 0) {
                    console.log('🔍 Estrutura do primeiro arquivo:', this.files[0]);
                    console.log('🔍 Propriedades do arquivo:', Object.keys(this.files[0]));
                }
                
                this.applyFilters();
                this.updateFileCounts();
                console.log(`📋 ${this.files.length} arquivos carregados`);
            } else {
                console.error('❌ Erro ao carregar arquivos:', data.message);
                this.showMessage('Erro ao carregar arquivos: ' + (data.message || 'Erro desconhecido'), 'error');
            }
        } catch (error) {
            console.error('❌ Erro na conexão:', error);
            this.showMessage('Erro de conexão ao carregar arquivos: ' + error.message, 'error');
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
            filtered = filtered.filter(f => f.isPublic);
        }

        // Filtro de tipo
        const typeFilterElement = document.getElementById('typeFilter');
        if (typeFilterElement) {
            const typeFilter = typeFilterElement.value;
            if (typeFilter && typeFilter !== 'all') {
                filtered = filtered.filter(f => {
                    // Usar f.type em vez de f.mimetype (formato da API)
                    const mimetype = f.type || f.mimetype;
                    return this.getFileCategory(mimetype) === typeFilter;
                });
            }
        }

        // Filtro de data
        const dateFilterElement = document.getElementById('dateFilter');
        if (dateFilterElement) {
            const dateFilter = dateFilterElement.value;
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
            const category = this.getFileCategory(file.type || file.mimetype);
            const isVideo = category === 'video';
            const isImage = category === 'image';
            const originalName = file.originalName || file.original_name || file.filename || file.name || 'Arquivo sem nome';
            const fileName = encodeURIComponent(originalName);
            
            return `
                <div class="file-card" data-file-name="${fileName}" onclick="cloudShare.showFilePreview('${fileName}')">
                    <div class="file-thumbnail-container">
                        ${isImage || isVideo ? `
                            <img src="${this.apiBase}/api/download/${file.id}" 
                                 alt="${originalName}" 
                                 class="file-thumbnail"
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="file-icon-large" style="display: none;">
                                <i class="${this.getFileIcon(file.type || file.mimetype)}"></i>
                            </div>
                        ` : `
                            <div class="file-icon-large">
                                <i class="${this.getFileIcon(file.type || file.mimetype)}"></i>
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
                            ${file.isOwner ? `
                                <button class="action-btn" onclick="event.stopPropagation(); cloudShare.toggleVisibility(${file.id})" title="${file.isPublic ? 'Tornar Privado' : 'Tornar Público'}">
                                    <i class="fas fa-${file.isPublic ? 'lock' : 'globe'}"></i>
                                </button>
                            ` : ''}
                            ${file.canDelete ? `
                                <button class="action-btn" onclick="event.stopPropagation(); cloudShare.deleteFile('${fileName}')" title="Excluir">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="file-info">
                        <div class="file-name" title="${originalName}">${originalName}</div>
                        <div class="file-details">
                            <span class="file-size">${this.formatFileSize(file.size)}</span>
                            <span class="file-date">${this.formatDate(file.uploadedAt || file.uploaded_at || file.created_at)}</span>
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
            const originalName = file.originalName || file.original_name || file.filename || file.name || 'Arquivo sem nome';
            const fileName = encodeURIComponent(originalName);
            return `
            <div class="table-row" data-file-name="${fileName}" onclick="cloudShare.showFilePreview('${fileName}')">
                <div class="table-cell name">
                    <div class="file-icon-small">
                        <i class="${this.getFileIcon(file.type || file.mimetype)}"></i>
                    </div>
                    <span>${originalName}</span>
                </div>
                <div class="table-cell size">
                    ${this.formatFileSize(file.size)}
                </div>
                <div class="table-cell date">
                    ${this.formatDate(file.uploadedAt || file.uploaded_at || file.created_at)}
                </div>
                <div class="table-cell actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); cloudShare.shareFile('${fileName}')" title="Compartilhar">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <button class="btn-icon" onclick="event.stopPropagation(); cloudShare.downloadFile('${fileName}')" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    ${file.isOwner ? `
                        <button class="btn-icon" onclick="event.stopPropagation(); cloudShare.toggleVisibility(${file.id})" title="${file.isPublic ? 'Tornar Privado' : 'Tornar Público'}">
                            <i class="fas fa-${file.isPublic ? 'lock' : 'globe'}"></i>
                        </button>
                    ` : ''}
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
        let file = this.filteredFiles.find(f => 
            (f.originalName || f.original_name || f.filename || f.name) === decodedFileName
        ) || this.files.find(f => 
            (f.originalName || f.original_name || f.filename || f.name) === decodedFileName
        );
        
        if (!file) {
            console.log(`🔍 Arquivo "${decodedFileName}" não encontrado para compartilhamento`);
            this.showMessage('Arquivo não encontrado', 'error');
            return;
        }

        this.currentShareFile = file;
        const originalName = file.originalName || file.original_name || file.filename || file.name || 'Arquivo sem nome';
        
        // Preencher modal com informações do arquivo
        document.getElementById('shareFileName').textContent = originalName;
        document.getElementById('shareFileSize').textContent = this.formatFileSize(file.size);
        document.getElementById('shareFileIcon').className = this.getFileIcon(file.type || file.mimetype);
        
        // Gerar links de compartilhamento baseados no ID do arquivo
        const baseUrl = window.location.origin; // Use a URL atual do frontend
        const directLink = `${baseUrl}/api/download/${file.id}`;
        const downloadLink = `${baseUrl}/api/download/${file.id}`;
        
        // Preencher campos de link
        document.getElementById('shareDirectLink').value = directLink;
        document.getElementById('shareDownloadLink').value = downloadLink;
        
        // Mostrar modal
        document.getElementById('modalOverlay').style.display = 'flex';
        document.getElementById('shareModal').style.display = 'block';
        
        // Mostrar notificação de compartilhamento pronto
        this.showMessage(`🔗 Links gerados para "${originalName}"`, 'success');
    }

    // Função de download usando nome do arquivo  
    async downloadFile(fileName) {
        const decodedFileName = decodeURIComponent(fileName);
        let file = this.filteredFiles.find(f => 
            (f.originalName || f.original_name || f.filename || f.name) === decodedFileName
        ) || this.files.find(f => 
            (f.originalName || f.original_name || f.filename || f.name) === decodedFileName
        );
        
        if (!file) {
            console.log(`⚠️ Arquivo "${decodedFileName}" não encontrado`);
            this.showMessage('Arquivo não encontrado', 'error');
            return;
        }

        const originalName = file.originalName || file.original_name || file.filename || file.name || 'arquivo';
        const downloadUrl = `${this.apiBase}/api/download/${file.id}`;
        
        console.log(`📥 Iniciando download: ${originalName}`);
        console.log(`🔗 URL: ${downloadUrl}`);
        
        // Mostrar progresso
        this.showDownloadProgress(originalName);
        
        try {
            // Criar elemento de download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = originalName;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showMessage(`✅ Download de "${originalName}" iniciado!`, 'success');
            
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

    async toggleVisibility(fileId) {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;
            
            const response = await fetch(`${this.apiBase}/api/files/${fileId}/visibility`, {
                method: 'PATCH',
                headers,
                credentials: 'include'
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Erro ao alterar visibilidade');
            }
            
            const result = await response.json();
            this.showMessage(result.isPublic ? '🌐 Arquivo tornado público' : '🔒 Arquivo tornado privado', 'success');
            
            // Atualiza localmente sem recarregar tudo
            const file = this.files.find(f => f.id === fileId);
            if (file) file.isPublic = result.isPublic;
            this.applyFilters();
            this.renderFiles();
        } catch (error) {
            this.showMessage(`❌ Erro: ${error.message}`, 'error');
        }
    }

    async deleteFile(fileName) {
        const decodedFileName = decodeURIComponent(fileName);
        let file = this.filteredFiles.find(f => 
            (f.originalName || f.original_name || f.filename || f.name) === decodedFileName
        ) || this.files.find(f => 
            (f.originalName || f.original_name || f.filename || f.name) === decodedFileName
        );
        
        if (!file) {
            console.log(`⚠️ Arquivo "${decodedFileName}" não encontrado para exclusão`);
            this.showMessage('Arquivo não encontrado', 'error');
            return;
        }

        const originalName = file.originalName || file.original_name || file.filename || file.name || 'arquivo';

        // Confirmar exclusão
        if (!confirm(`Tem certeza que deseja excluir "${originalName}"?`)) {
            return;
        }

        try {
            const headers = {};
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            const response = await fetch(`${this.apiBase}/api/files/${file.id}`, {
                method: 'DELETE',
                headers,
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                this.showMessage(`✅ Arquivo "${originalName}" excluído com sucesso!`, 'success');
                
                // Remover arquivo das listas locais
                this.files = this.files.filter(f => f.id !== file.id);
                this.filteredFiles = this.filteredFiles.filter(f => f.id !== file.id);
                
                // Atualizar a visualização
                this.renderFiles();
                this.updateFileCounts();
            } else {
                this.showMessage(`❌ Erro ao excluir arquivo: ${data.message || 'Erro desconhecido'}`, 'error');
            }
        } catch (error) {
            console.error('Erro na exclusão:', error);
            this.showMessage(`❌ Erro de conexão ao excluir arquivo: ${error.message}`, 'error');
        }
    }

    // Função de preview usando nome do arquivo
    async showFilePreview(fileName) {
        try {
            const decodedFileName = decodeURIComponent(fileName);
            
            // Buscar arquivo usando diferentes propriedades possíveis
            let file = this.files.find(f => 
                f.originalName === decodedFileName || 
                f.original_name === decodedFileName || 
                f.filename === decodedFileName ||
                f.name === decodedFileName
            ) || this.filteredFiles.find(f => 
                f.originalName === decodedFileName || 
                f.original_name === decodedFileName || 
                f.filename === decodedFileName ||
                f.name === decodedFileName
            );
            
            if (!file) {
                console.log(`🔍 Arquivo "${decodedFileName}" não encontrado, recarregando...`);
                await this.loadFiles();
                file = this.files.find(f => 
                    f.originalName === decodedFileName || 
                    f.original_name === decodedFileName || 
                    f.filename === decodedFileName ||
                    f.name === decodedFileName
                ) || this.filteredFiles.find(f => 
                    f.originalName === decodedFileName || 
                    f.original_name === decodedFileName || 
                    f.filename === decodedFileName ||
                    f.name === decodedFileName
                );
            }

            // Se ainda não encontrado, criar dados básicos
            if (!file) {
                console.log(`⚠️ Criando preview genérico para "${decodedFileName}"`);
                file = {
                    id: 'unknown',
                    original_name: decodedFileName,
                    originalName: decodedFileName,
                    size: 0,
                    mimetype: 'application/octet-stream',
                    uploaded_at: new Date().toISOString()
                };
            }

            // Normalizar propriedades do arquivo
            const normalizedFile = {
                id: file.id || 'unknown',
                originalName: file.originalName || file.original_name || file.filename || file.name || decodedFileName,
                size: file.size || 0,
                type: file.type || file.mimetype || 'application/octet-stream',
                mimetype: file.mimetype || file.type || 'application/octet-stream',
                uploadedAt: file.uploadedAt || file.uploaded_at || file.created_at || new Date().toISOString()
            };

            console.log('🔍 Preview do arquivo:', normalizedFile);

            console.log('🔍 Preview do arquivo:', normalizedFile);

            const category = this.getFileCategory(normalizedFile.type || normalizedFile.mimetype);
            
            // Criar modal de preview
            const modalHTML = `
                <div class="preview-modal-overlay" id="previewModal" onclick="cloudShare.closePreview(event)">
                    <div class="preview-modal-content" onclick="event.stopPropagation()">
                        <div class="preview-header">
                            <h3>${normalizedFile.originalName}</h3>
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
                            ${this.generatePreviewContent(normalizedFile, category, fileName)}
                        </div>
                        
                        <div class="preview-footer">
                            <div class="file-details">
                                <span><strong>Tamanho:</strong> ${this.formatFileSize(normalizedFile.size)}</span>
                                <span><strong>Tipo:</strong> ${normalizedFile.type || normalizedFile.mimetype}</span>
                                <span><strong>Modificado:</strong> ${normalizedFile.uploadedAt ? new Date(normalizedFile.uploadedAt).toLocaleString('pt-BR') : 'Data não disponível'}</span>
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
                        <img src="${this.apiBase}/api/download/${file.id}" 
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
                            <source src="${this.apiBase}/api/download/${file.id}" type="${file.type || file.mimetype}">
                            Seu navegador não suporta reprodução de vídeo.
                        </video>
                    </div>
                `;
                
            case 'audio':
                return `
                    <div class="audio-preview">
                        <audio controls style="width: 100%;">
                            <source src="${this.apiBase}/api/download/${file.id}" type="${file.type || file.mimetype}">
                            Seu navegador não suporta reprodução de áudio.
                        </audio>
                        <div class="audio-info">
                            <i class="fas fa-music fa-3x"></i>
                            <h4>${decodedFileName}</h4>
                        </div>
                    </div>
                `;
                
            case 'document':
                if (file.type || file.mimetype === 'application/pdf') {
                    return `
                        <div class="pdf-preview">
                            <iframe src="${this.apiBase}/api/download/${file.id}" 
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
                    <i class="${this.getFileIcon(file.type || file.mimetype)} fa-4x"></i>
                </div>
                <h4>${file.originalName}</h4>
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
        if (!mimetype || typeof mimetype !== 'string') return 'other';
        
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
        const loadingState = document.getElementById('loadingState');
        const filesGrid = document.getElementById('filesGrid');
        const filesList = document.getElementById('filesList');
        const emptyState = document.getElementById('emptyState');

        if (loadingState) loadingState.style.display = 'flex';
        if (filesGrid) filesGrid.style.display = 'none';
        if (filesList) filesList.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
    }

    hideLoading() {
        const loadingState = document.getElementById('loadingState');
        const filesGrid = document.getElementById('filesGrid');
        const filesList = document.getElementById('filesList');

        if (loadingState) loadingState.style.display = 'none';
        
        if (this.viewMode === 'grid') {
            if (filesGrid) filesGrid.style.display = 'grid';
        } else {
            if (filesList) filesList.style.display = 'block';
        }
    }

    updateFileCounts() {
        let myFilesCount = 0;
        let publicFilesCount = 0;
        
        if (this.currentUser) {
            myFilesCount = this.files.filter(f => f.user_id === this.currentUser.id).length;
            publicFilesCount = this.files.filter(f => f.isPublic).length;
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

        const filtered = this.filteredFiles.filter(file => {
            const originalName = file.originalName || file.original_name || file.filename || file.name || '';
            return originalName.toLowerCase().includes(query.toLowerCase());
        });
        
        this.filteredFiles = filtered;
        this.renderFiles();
    }

    hideAllModals() {
        document.getElementById('modalOverlay').style.display = 'none';
        document.getElementById('shareModal').style.display = 'none';
        document.getElementById('loginModal').style.display = 'none';
        const resetModal = document.getElementById('resetPasswordModal');
        if (resetModal) {
            resetModal.style.display = 'none';
        }
        const emailResetModal = document.getElementById('emailResetModal');
        if (emailResetModal) {
            emailResetModal.style.display = 'none';
        }
        const profileModal = document.getElementById('profileModal');
        if (profileModal) {
            profileModal.style.display = 'none';
        }
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) {
            settingsModal.style.display = 'none';
        }
    }


    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        const mainContent = document.querySelector('.main-content');
        
        if (!uploadArea || !mainContent) return;
        
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, this.preventDefaults, false);
            mainContent.addEventListener(eventName, this.preventDefaults, false);
        });
        
        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('dragover');
                if (uploadArea.style.display === 'none') {
                    uploadArea.style.display = 'block';
                }
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('dragover');
            }, false);
        });
        
        // Handle dropped files
        uploadArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            this.handleFileUpload(files);
        }, false);
        
        // Also enable drag & drop on main content area
        mainContent.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (uploadArea.style.display === 'none') {
                uploadArea.style.display = 'block';
                uploadArea.classList.add('dragover');
            }
        });
        
        mainContent.addEventListener('drop', (e) => {
            e.preventDefault();
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                this.handleFileUpload(files);
            }
        });
    }
    
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    toggleUploadArea() {
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            const isVisible = uploadArea.style.display !== 'none';
            uploadArea.style.display = isVisible ? 'none' : 'block';
            
            // Mostrar seletor de visibilidade apenas quando logado
            const visSelector = document.getElementById('uploadVisibilitySelector');
            if (visSelector) {
                visSelector.style.display = (!isVisible && this.currentUser) ? 'flex' : 'none';
            }
            
            if (!isVisible) {
                const fileInput = document.getElementById('fileInput');
                if (fileInput) {
                    fileInput.click();
                }
            }
        }
    }

    async handleFileUpload(files) {
        console.log('📤 handleFileUpload chamada com:', files);
        
        if (!files || files.length === 0) {
            console.log('❌ Nenhum arquivo para upload');
            return;
        }
        
        const uploadArea = document.getElementById('uploadArea');
        
        try {
            console.log(`📤 Iniciando upload de ${files.length} arquivo(s)`);
            this.showMessage(`📤 Fazendo upload de ${files.length} arquivo(s)...`, 'info');
            
            const formData = new FormData();
            
            // Adicionar todos os arquivos ao FormData com o nome 'files' (plural)
            for (let file of files) {
                formData.append('files', file);
                console.log(`📤 Adicionado: ${file.name} (${file.size} bytes)`);
            }
            
            // Visibilidade: sem login = sempre público; logado = escolha do seletor
            if (this.currentUser) {
                const visRadio = document.querySelector('input[name="uploadVisibility"]:checked');
                const isPublic = visRadio ? visRadio.value : 'false';
                formData.append('isPublic', isPublic);
            }
            
            console.log('📤 Enviando para:', `${this.apiBase}/api/upload`);
            
            // Preparar headers com autenticação se disponível
            const headers = {};
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }
            
            const response = await fetch(`${this.apiBase}/api/upload`, {
                method: 'POST',
                headers: headers,
                body: formData,
                credentials: 'include'
            });
            
            console.log('📤 Resposta do servidor:', response.status, response.statusText);
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Upload bem-sucedido:', result);
                this.showMessage(`✅ ${files.length} arquivo(s) enviado(s) com sucesso!`, 'success');
                
                // Refresh file list
                await this.loadFiles();
            } else if (response.status === 409) {
                // Arquivo duplicado - verificar se é do mesmo usuário
                const errorData = await response.json();
                console.log('⚠️ Arquivo duplicado:', errorData);
                
                if (errorData.error_code === 'DUPLICATE_SAME_USER') {
                    // Perguntar se o usuário quer substituir
                    const confirmReplace = confirm(`${errorData.message}\n\nClique OK para substituir ou Cancelar para manter o arquivo existente.`);
                    
                    if (confirmReplace) {
                        // TODO: Implementar substituição de arquivo
                        this.showMessage('🔄 Substituição de arquivos em desenvolvimento...', 'info');
                        // Por enquanto, mostrar opção de deletar manualmente
                        this.showMessage(`❌ Para substituir, delete primeiro o arquivo "${errorData.existing_file.name}" e faça upload novamente.`, 'error');
                    } else {
                        this.showMessage('❌ Upload cancelado pelo usuário', 'info');
                    }
                } else {
                    throw new Error(errorData.message || 'Arquivo duplicado');
                }
            } else {
                const errorText = await response.text();
                console.log('❌ Erro na resposta:', errorText);
                try {
                    const error = JSON.parse(errorText);
                    throw new Error(error.message || 'Erro no upload');
                } catch (parseError) {
                    throw new Error(`Erro ${response.status}: ${errorText}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Erro no upload:', error);
            this.showMessage(`❌ Erro no upload: ${error.message}`, 'error');
        }
        
        // Hide upload area and reset input
        if (uploadArea) {
            uploadArea.style.display = 'none';
        }
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }
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

    showLoginModal() {
        document.getElementById('modalOverlay').style.display = 'flex';
        document.getElementById('loginModal').style.display = 'block';
        document.getElementById('shareModal').style.display = 'none';
        document.getElementById('resetPasswordModal').style.display = 'none';
    }

    showResetPasswordModal() {
        document.getElementById('modalOverlay').style.display = 'flex';
        document.getElementById('resetPasswordModal').style.display = 'block';
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('shareModal').style.display = 'none';
        
        // Limpar campos
        document.getElementById('resetIdentifier').value = '';
        document.getElementById('resetNewPassword').value = '';
        document.getElementById('resetConfirmPassword').value = '';
    }

    async handleResetPassword(e) {
        e.preventDefault();
        
        const identifier = document.getElementById('resetIdentifier').value.trim();
        const newPassword = document.getElementById('resetNewPassword').value;
        const confirmPassword = document.getElementById('resetConfirmPassword').value;
        
        if (!identifier || !newPassword || !confirmPassword) {
            this.showMessage('❌ Por favor, preencha todos os campos', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            this.showMessage('❌ As senhas não coincidem', 'error');
            return;
        }
        
        if (newPassword.length < 4) {
            this.showMessage('❌ A senha deve ter pelo menos 4 caracteres', 'error');
            return;
        }
        
        try {
            this.showMessage('🔄 Resetando senha...', 'info');
            
            const response = await fetch(`${this.apiBase}/api/auth/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    identifier,
                    newPassword
                }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.showMessage('✅ ' + data.message, 'success');
                
                // Fechar modal e voltar ao login
                document.getElementById('modalOverlay').style.display = 'none';
                document.getElementById('resetPasswordModal').style.display = 'none';
                
                // Mostrar modal de login após 1 segundo
                setTimeout(() => {
                    this.showLoginModal();
                    // Pre-preencher o username
                    document.getElementById('loginUsername').value = data.username || identifier;
                    document.getElementById('loginPassword').value = '';
                    document.getElementById('loginPassword').focus();
                }, 1000);
                
            } else {
                this.showMessage(`❌ ${data.message || 'Erro ao resetar senha'}`, 'error');
            }
            
        } catch (error) {
            console.error('Erro ao resetar senha:', error);
            this.showMessage(`❌ Erro de conexão: ${error.message}`, 'error');
        }
    }

    async handleLogin(event) {
        event.preventDefault();
        
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        if (!username || !password) {
            this.showMessage('❌ Por favor, preencha todos os campos', 'error');
            return;
        }
        
        try {
            this.showMessage('🔄 Fazendo login...', 'info');
            
            const response = await fetch(`${this.apiBase}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Salvar token se fornecido
                if (data.token) {
                    localStorage.setItem('token', data.token);
                    this.authToken = data.token;
                }
                
                // Salvar dados do usuário
                this.currentUser = data.user;
                
                // Atualizar UI
                this.updateUIForLoggedInUser();
                
                // Fechar modal
                this.hideAllModals();
                
                // Recarregar arquivos
                await this.loadFiles();
                
                this.showMessage(`✅ Login realizado com sucesso! Bem-vindo, ${data.user.username}!`, 'success');
                
                // Limpar campos
                document.getElementById('loginUsername').value = '';
                document.getElementById('loginPassword').value = '';
                
            } else {
                this.showMessage(`❌ Erro no login: ${data.message || 'Credenciais inválidas'}`, 'error');
            }
            
        } catch (error) {
            console.error('Erro no login:', error);
            this.showMessage(`❌ Erro de conexão: ${error.message}`, 'error');
        }
    }

    showRegisterPrompt() {
        this.hideAllModals();
        
        const username = prompt('👤 Nome de usuário:');
        if (!username) return;
        
        const email = prompt('📧 Email:');
        if (!email) return;
        
        const password = prompt('🔒 Senha (min. 6 caracteres):');
        if (!password) return;
        
        const fullName = prompt('👨‍💼 Nome completo (opcional):') || '';
        
        this.handleRegister(username, email, password, fullName);
    }

    async handleRegister(username, email, password, fullName) {
        if (!username || !email || !password) {
            this.showMessage('❌ Por favor, preencha os campos obrigatórios', 'error');
            return;
        }
        
        if (password.length < 6) {
            this.showMessage('❌ A senha deve ter pelo menos 6 caracteres', 'error');
            return;
        }
        
        try {
            this.showMessage('🔄 Criando conta...', 'info');
            
            const response = await fetch(`${this.apiBase}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    username: username.trim(),
                    email: email.trim(),
                    password,
                    full_name: fullName.trim()
                }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.showMessage('✅ Conta criada com sucesso! Faça login para continuar.', 'success');
                
                // Mostrar modal de login novamente
                setTimeout(() => {
                    this.showLoginModal();
                    // Pre-preencher o username
                    document.getElementById('loginUsername').value = username;
                    document.getElementById('loginPassword').focus();
                }, 1000);
                
            } else {
                this.showMessage(`❌ Erro ao criar conta: ${data.message || 'Erro desconhecido'}`, 'error');
            }
            
        } catch (error) {
            console.error('Erro no registro:', error);
            this.showMessage(`❌ Erro de conexão: ${error.message}`, 'error');
        }
    }

    // ========================
    // PERFIL
    // ========================
    showProfileModal() {
        if (!this.currentUser) {
            this.showMessage('❌ Você precisa estar logado para acessar o perfil', 'error');
            return;
        }

        document.getElementById('modalOverlay').style.display = 'flex';
        document.getElementById('profileModal').style.display = 'block';
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('settingsModal').style.display = 'none';
        document.getElementById('shareModal').style.display = 'none';
        document.getElementById('resetPasswordModal').style.display = 'none';
        document.getElementById('emailResetModal').style.display = 'none';
        
        // Preencher dados do perfil
        document.getElementById('profileUsername').value = this.currentUser.username || '';
        document.getElementById('profileEmail').value = this.currentUser.email || '';
        document.getElementById('profileAccountType').value = this.currentUser.is_admin ? 'Administrador' : 'Usuário Regular';
        
        // Atualizar estatísticas
        document.getElementById('profileFilesCount').textContent = this.files.filter(f => !f.is_public).length;
        
        const totalSize = this.files.reduce((acc, f) => acc + (f.size || 0), 0);
        document.getElementById('profileStorageUsed').textContent = this.formatFileSize(totalSize);
        
        const memberSince = this.currentUser.created_at ? new Date(this.currentUser.created_at).toLocaleDateString('pt-BR') : 'Desconhecido';
        document.getElementById('profileMemberSince').textContent = memberSince;
    }

    async updateProfile() {
        const email = document.getElementById('profileEmail').value.trim();
        
        if (!email || !email.includes('@')) {
            this.showMessage('❌ Digite um email válido', 'error');
            return;
        }

        try {
            this.showMessage('🔄 Atualizando perfil...', 'info');
            
            const response = await fetch(`${this.apiBase}/api/user/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ email }),
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.currentUser.email = email;
                this.showMessage('✅ Perfil atualizado com sucesso!', 'success');
            } else {
                this.showMessage(`❌ Erro ao atualizar perfil: ${data.message}`, 'error');
            }
            
        } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
            this.showMessage(`❌ Erro de conexão: ${error.message}`, 'error');
        }
    }

    // ========================
    // CONFIGURAÇÕES
    // ========================
    showSettingsModal() {
        if (!this.currentUser) {
            this.showMessage('❌ Você precisa estar logado para acessar configurações', 'error');
            return;
        }

        document.getElementById('modalOverlay').style.display = 'flex';
        document.getElementById('settingsModal').style.display = 'block';
        document.getElementById('profileModal').style.display = 'none';
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('shareModal').style.display = 'none';
        document.getElementById('resetPasswordModal').style.display = 'none';
        document.getElementById('emailResetModal').style.display = 'none';
        
        // Carregar preferências salvas
        const savedTheme = localStorage.getItem('theme') || 'dark';
        const savedView = localStorage.getItem('viewMode') || 'grid';
        
        document.getElementById('themeSelect').value = savedTheme;
        document.getElementById('defaultViewSelect').value = savedView;
        document.getElementById('showHiddenFiles').checked = localStorage.getItem('showHidden') === 'true';
        document.getElementById('autoPlayVideos').checked = localStorage.getItem('autoPlay') !== 'false';
        document.getElementById('defaultPrivateFiles').checked = localStorage.getItem('defaultPrivate') !== 'false';
        document.getElementById('requirePasswordShare').checked = localStorage.getItem('passwordShare') === 'true';
    }

    switchSettingsTab(tabName) {
        // Atualizar tabs
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`.settings-tab[data-tab="${tabName}"]`).classList.add('active');
        
        // Atualizar conteúdo
        document.querySelectorAll('.settings-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }

    async handleChangePassword(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;
        
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            this.showMessage('❌ Preencha todos os campos', 'error');
            return;
        }
        
        if (newPassword !== confirmNewPassword) {
            this.showMessage('❌ As senhas não coincidem', 'error');
            return;
        }
        
        if (newPassword.length < 4) {
            this.showMessage('❌ A senha deve ter pelo menos 4 caracteres', 'error');
            return;
        }

        try {
            this.showMessage('🔄 Alterando senha...', 'info');
            
            const response = await fetch(`${this.apiBase}/api/user/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({ 
                    currentPassword, 
                    newPassword 
                }),
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showMessage('✅ Senha alterada com sucesso!', 'success');
                
                // Limpar campos
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmNewPassword').value = '';
            } else {
                this.showMessage(`❌ Erro: ${data.message || 'Senha atual incorreta'}`, 'error');
            }
            
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            this.showMessage(`❌ Erro de conexão: ${error.message}`, 'error');
        }
    }

    savePreferences() {
        const theme = document.getElementById('themeSelect').value;
        const defaultView = document.getElementById('defaultViewSelect').value;
        const showHidden = document.getElementById('showHiddenFiles').checked;
        const autoPlay = document.getElementById('autoPlayVideos').checked;
        const defaultPrivate = document.getElementById('defaultPrivateFiles').checked;
        const passwordShare = document.getElementById('requirePasswordShare').checked;
        
        localStorage.setItem('theme', theme);
        localStorage.setItem('viewMode', defaultView);
        localStorage.setItem('showHidden', showHidden);
        localStorage.setItem('autoPlay', autoPlay);
        localStorage.setItem('defaultPrivate', defaultPrivate);
        localStorage.setItem('passwordShare', passwordShare);
        
        this.showMessage('✅ Preferências salvas com sucesso!', 'success');
        
        // Aplicar tema (se implementado)
        // this.applyTheme(theme);
        
        // Aplicar visualização
        this.setViewMode(defaultView);
    }

    // ========================
    // RECUPERAÇÃO DE SENHA COM EMAIL
    // ========================
    showResetPasswordModal() {
        // Usar o novo modal de email
        document.getElementById('modalOverlay').style.display = 'flex';
        document.getElementById('emailResetModal').style.display = 'block';
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('resetPasswordModal').style.display = 'none';
        document.getElementById('shareModal').style.display = 'none';
        document.getElementById('profileModal').style.display = 'none';
        document.getElementById('settingsModal').style.display = 'none';
        
        // Resetar para step 1
        document.getElementById('requestResetCodeForm').style.display = 'block';
        document.getElementById('verifyResetCodeForm').style.display = 'none';
        document.getElementById('emailResetStep1Text').style.display = 'block';
        document.getElementById('emailResetStep2Text').style.display = 'none';
        
        // Limpar campos
        document.getElementById('resetEmail').value = '';
        document.getElementById('resetCode').value = '';
        document.getElementById('resetNewPass').value = '';
        document.getElementById('resetConfirmPass').value = '';
    }

    async handleRequestResetCode(e) {
        e.preventDefault();
        
        const email = document.getElementById('resetEmail').value.trim();
        
        if (!email || !email.includes('@')) {
            this.showMessage('❌ Digite um email válido', 'error');
            return;
        }

        try {
            this.showMessage('📧 Enviando código de recuperação...', 'info');
            
            const response = await fetch(`${this.apiBase}/api/auth/request-reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ identifier: email }),
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showMessage('✅ Código enviado para seu email! Verifique sua caixa de entrada.', 'success');
                
                // Mudar para step 2
                document.getElementById('requestResetCodeForm').style.display = 'none';
                document.getElementById('verifyResetCodeForm').style.display = 'block';
                document.getElementById('emailResetStep1Text').style.display = 'none';
                document.getElementById('emailResetStep2Text').style.display = 'block';
                
                // Guardar email temporariamente
                this.tempResetEmail = email;
                
            } else {
                this.showMessage(`❌ Erro: ${data.message || 'Não foi possível enviar o código'}`, 'error');
            }
            
        } catch (error) {
            console.error('Erro ao solicitar código:', error);
            this.showMessage(`❌ Erro de conexão: ${error.message}`, 'error');
        }
    }

    async handleVerifyResetCode(e) {
        e.preventDefault();
        
        const code = document.getElementById('resetCode').value.trim();
        const newPassword = document.getElementById('resetNewPass').value;
        const confirmPassword = document.getElementById('resetConfirmPass').value;
        
        if (!code || code.length !== 6) {
            this.showMessage('❌ Digite um código de 6 dígitos válido', 'error');
            return;
        }
        
        if (!newPassword || !confirmPassword) {
            this.showMessage('❌ Preencha todos os campos', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            this.showMessage('❌ As senhas não coincidem', 'error');
            return;
        }
        
        if (newPassword.length < 4) {
            this.showMessage('❌ A senha deve ter pelo menos 4 caracteres', 'error');
            return;
        }

        try {
            this.showMessage('🔄 Verificando código e resetando senha...', 'info');
            
            const response = await fetch(`${this.apiBase}/api/auth/reset-password-with-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    code,
                    newPassword 
                }),
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showMessage('✅ Senha resetada com sucesso! Faça login com sua nova senha.', 'success');
                
                // Voltar para login após 2 segundos
                setTimeout(() => {
                    this.showLoginModal();
                    document.getElementById('loginUsername').value = this.tempResetEmail;
                }, 2000);
                
            } else {
                this.showMessage(`❌ Erro: ${data.message || 'Código inválido ou expirado'}`, 'error');
            }
            
        } catch (error) {
            console.error('Erro ao resetar senha:', error);
            this.showMessage(`❌ Erro de conexão: ${error.message}`, 'error');
        }
    }

    backToRequestCode() {
        document.getElementById('requestResetCodeForm').style.display = 'block';
        document.getElementById('verifyResetCodeForm').style.display = 'none';
        document.getElementById('emailResetStep1Text').style.display = 'block';
        document.getElementById('emailResetStep2Text').style.display = 'none';
        
        // Limpar campos
        document.getElementById('resetCode').value = '';
        document.getElementById('resetNewPass').value = '';
        document.getElementById('resetConfirmPass').value = '';
    }
}

// Inicializar aplicação
const cloudShare = new CloudSharePro();
window.cloudShare = cloudShare;

document.addEventListener('DOMContentLoaded', () => {
    cloudShare.init();
});

export default cloudShare;

