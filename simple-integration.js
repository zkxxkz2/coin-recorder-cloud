// 简单集成服务
import { authService } from './simple-auth.js';
import { syncService } from './jsonbin-sync.js';

class SimpleIntegration {
    constructor() {
        this.isInitialized = false;
        this.currentUser = null;
        // 不在这里调用 init()，等待外部调用
    }

    // 初始化简单集成
    async init() {
        console.log('SimpleIntegration 开始初始化...');
        
        // 先确保同步服务初始化完成
        await this.waitForSyncService();
        
        // 等待认证服务初始化完成
        await authService.init();
        
        // 设置认证服务到同步服务
        syncService.setAuthService(authService);
        
        // 直接绑定事件（此时DOM已经加载完成）
        this.bindEvents();
        this.isInitialized = true;

        // 监听认证状态变化
        authService.onAuthStateChange((user) => {
            this.currentUser = user;
            this.updateUI(user);
            
            if (user) {
                this.handleUserLogin(user);
            } else {
                this.handleUserLogout();
            }
        });
        
        console.log('SimpleIntegration 初始化完成');
    }

    // 等待同步服务初始化完成
    async waitForSyncService() {
        let attempts = 0;
        while (!syncService.isInitialized && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!syncService.isInitialized) {
            throw new Error('同步服务初始化超时');
        }
        
        console.log('同步服务初始化完成');
    }

    // 绑定事件监听器
    bindEvents() {
        console.log('开始绑定事件...');
        
        // 登录按钮
        const loginBtn = document.getElementById('loginBtn');
        console.log('登录按钮:', loginBtn);
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                console.log('登录按钮被点击');
                this.showAuthModal('login');
            });
        } else {
            console.error('未找到登录按钮');
        }

        // 登出按钮
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // 同步按钮
        const syncFromCloudBtn = document.getElementById('syncFromCloudBtn');
        const syncToCloudBtn = document.getElementById('syncToCloudBtn');
        
        if (syncFromCloudBtn) {
            syncFromCloudBtn.addEventListener('click', () => this.syncFromCloud());
        }
        if (syncToCloudBtn) {
            syncToCloudBtn.addEventListener('click', () => this.syncToCloud());
        }

        // 认证模态框事件
        this.setupAuthModalEvents();
        
        // 数据迁移模态框事件
        this.setupMigrationModalEvents();
    }

    // 设置认证模态框事件
    setupAuthModalEvents() {
        const authModal = document.getElementById('authModal');
        const closeBtn = authModal?.querySelector('.auth-modal-close');
        const backdrop = authModal?.querySelector('.auth-modal-backdrop');

        // 关闭模态框
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideAuthModal());
        }

        if (backdrop) {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    this.hideAuthModal();
                }
            });
        }

        // 标签页切换
        const showLoginTab = document.getElementById('showLoginTab');
        const showRegisterTab = document.getElementById('showRegisterTab');

        if (showLoginTab) {
            showLoginTab.addEventListener('click', () => this.switchAuthTab('login'));
        }
        if (showRegisterTab) {
            showRegisterTab.addEventListener('click', () => this.switchAuthTab('register'));
        }

        // 表单提交
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
    }

    // 设置数据迁移模态框事件
    setupMigrationModalEvents() {
        const migrationModal = document.getElementById('migrationModal');
        const skipBtn = document.getElementById('migrationSkipBtn');
        const confirmBtn = document.getElementById('migrationConfirmBtn');

        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.skipMigration());
        }
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.confirmMigration());
        }
    }

    // 显示认证模态框
    showAuthModal(tab = 'login') {
        console.log('显示认证模态框:', tab);
        const authModal = document.getElementById('authModal');
        console.log('认证模态框:', authModal);
        if (authModal) {
            authModal.style.display = 'flex';
            setTimeout(() => {
                authModal.classList.add('show');
                this.switchAuthTab(tab);
            }, 10);
        } else {
            console.error('未找到认证模态框');
        }
    }

    // 隐藏认证模态框
    hideAuthModal() {
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.classList.remove('show');
            setTimeout(() => {
                authModal.style.display = 'none';
            }, 300);
        }
    }

    // 切换认证标签页
    switchAuthTab(tab) {
        // 更新标签页状态
        const tabs = ['showLoginTab', 'showRegisterTab'];
        tabs.forEach(tabId => {
            const tabElement = document.getElementById(tabId);
            if (tabElement) {
                tabElement.classList.remove('active');
            }
        });

        const activeTab = document.getElementById(`show${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // 显示对应表单
        const forms = ['loginForm', 'registerForm'];
        forms.forEach(formId => {
            const formElement = document.getElementById(formId);
            if (formElement) {
                formElement.style.display = 'none';
            }
        });

        const activeForm = document.getElementById(`${tab}Form`);
        if (activeForm) {
            activeForm.style.display = 'flex';
        }

        // 更新标题
        const titleElement = document.getElementById('authModalTitle');
        const subtitleElement = document.getElementById('authModalSubtitle');
        
        if (titleElement && subtitleElement) {
            switch (tab) {
                case 'login':
                    titleElement.textContent = '登录';
                    subtitleElement.textContent = '登录以同步您的数据到云端';
                    break;
                case 'register':
                    titleElement.textContent = '注册';
                    subtitleElement.textContent = '创建账户以开始使用云端同步';
                    break;
            }
        }
    }

    // 处理登录
    async handleLogin(e) {
        e.preventDefault();
        
        const usernameOrBinId = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        if (!usernameOrBinId) {
            this.showMessage('请输入用户名或 Bin ID', 'error');
            return;
        }

        const result = await authService.login(usernameOrBinId, password);
        
        if (result.success) {
            this.hideAuthModal();
            this.showMessage(result.message, 'success');
        } else {
            this.showMessage(result.error || result.message, 'error');
        }
    }

    // 处理注册
    async handleRegister(e) {
        e.preventDefault();
        
        const username = document.getElementById('registerUsername').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!username || !password || !confirmPassword) {
            this.showMessage('请填写完整信息', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showMessage('两次输入的密码不一致', 'error');
            return;
        }

        if (username.length < 3) {
            this.showMessage('用户名至少3个字符', 'error');
            return;
        }

        if (password.length < 6) {
            this.showMessage('密码长度至少6位', 'error');
            return;
        }

        const result = await authService.register(username, password);
        
        if (result.success) {
            this.hideAuthModal();
            // 显示 Bin ID 模态框
            this.showBinIdModal(result.binId);
        } else {
            this.showMessage(result.error || result.message, 'error');
        }
    }

    // 处理用户登录
    async handleUserLogin(user) {
        console.log('用户登录:', user.username);
        
        // 检查是否需要数据迁移
        if (syncService.needsMigration()) {
            this.showMigrationModal();
        } else {
            // 直接同步数据
            await syncService.syncAllData();
        }
    }

    // 处理用户登出
    handleUserLogout() {
        console.log('用户登出');
        // 清理云端同步状态
        syncService.clearPendingChanges();
    }

    // 显示数据迁移模态框
    showMigrationModal() {
        const migrationModal = document.getElementById('migrationModal');
        if (migrationModal) {
            // 更新迁移信息
            this.updateMigrationInfo();
            
            migrationModal.style.display = 'flex';
            setTimeout(() => {
                migrationModal.classList.add('show');
            }, 10);
        }
    }

    // 更新迁移信息
    updateMigrationInfo() {
        const localData = syncService.getLocalData();
        
        const recordsCount = document.getElementById('migrationRecordsCount');
        const streakStatus = document.getElementById('migrationStreakStatus');
        const achievementsStatus = document.getElementById('migrationAchievementsStatus');

        if (recordsCount) {
            recordsCount.textContent = localData.coinRecords?.length || 0;
        }
        if (streakStatus) {
            streakStatus.textContent = localData.streakData ? '有' : '无';
        }
        if (achievementsStatus) {
            achievementsStatus.textContent = localData.achievements ? '有' : '无';
        }
    }

    // 跳过迁移
    skipMigration() {
        const migrationModal = document.getElementById('migrationModal');
        if (migrationModal) {
            migrationModal.classList.remove('show');
            setTimeout(() => {
                migrationModal.style.display = 'none';
            }, 300);
        }
        
        // 标记为已跳过迁移
        localStorage.setItem('coinTrackerDataMigrated', 'true');
    }

    // 确认迁移
    async confirmMigration() {
        const result = await syncService.migrateLocalDataToCloud();
        
        const migrationModal = document.getElementById('migrationModal');
        if (migrationModal) {
            migrationModal.classList.remove('show');
            setTimeout(() => {
                migrationModal.style.display = 'none';
            }, 300);
        }
        
        if (result.success) {
            this.showMessage(result.message, 'success');
        } else {
            this.showMessage(result.message, 'error');
        }
    }

    // 从云端下载数据
    async syncFromCloud() {
        const syncFromCloudBtn = document.getElementById('syncFromCloudBtn');
        if (syncFromCloudBtn) {
            syncFromCloudBtn.style.opacity = '0.5';
            syncFromCloudBtn.style.pointerEvents = 'none';
        }

        try {
            const result = await syncService.syncFromCloud();
            
            if (result.success) {
                this.showMessage('从云端下载成功', 'success');
                // 立即刷新页面数据，无需手动刷新页面
                if (window.coinTracker) {
                    // 重新加载所有数据
                    window.coinTracker.coinData = window.coinTracker.loadData();
                    window.coinTracker.achievements = window.coinTracker.loadAchievements();
                    window.coinTracker.streakData = window.coinTracker.loadStreakData();
                    window.coinTracker.challengeData = window.coinTracker.loadChallengeData();
                    
                    // 刷新所有UI组件
                    window.coinTracker.updateDisplay();
                    window.coinTracker.renderHistory();
                    window.coinTracker.updateAchievements();
                    window.coinTracker.updateStreakDisplay();
                    window.coinTracker.updateChallengeDisplay();
                    window.coinTracker.updateCharts();
                }
            } else {
                this.showMessage(result.message, 'error');
            }
        } finally {
            if (syncFromCloudBtn) {
                syncFromCloudBtn.style.opacity = '1';
                syncFromCloudBtn.style.pointerEvents = 'auto';
            }
        }
    }

    // 同步到云端
    async syncToCloud() {
        const syncToCloudBtn = document.getElementById('syncToCloudBtn');
        if (syncToCloudBtn) {
            syncToCloudBtn.style.opacity = '0.5';
            syncToCloudBtn.style.pointerEvents = 'none';
        }

        try {
            const result = await syncService.syncToCloud();
            
            if (result.success) {
                this.showMessage(result.message, 'success');
            } else {
                this.showMessage(result.message, 'error');
            }
        } finally {
            if (syncToCloudBtn) {
                syncToCloudBtn.style.opacity = '1';
                syncToCloudBtn.style.pointerEvents = 'auto';
            }
        }
    }

    // 登出
    async logout() {
        const result = await authService.logout();
        
        if (result.success) {
            this.showMessage(result.message, 'success');
        } else {
            this.showMessage(result.message, 'error');
        }
    }

    // 更新UI
    updateUI(user) {
        const userStatus = document.getElementById('userStatus');
        const loginBtn = document.getElementById('loginBtn');
        const userEmail = document.getElementById('userEmail');

        if (user) {
            // 用户已登录
            if (userStatus) userStatus.style.display = 'flex';
            if (loginBtn) loginBtn.style.display = 'none';
            if (userEmail) userEmail.textContent = user.username;
        } else {
            // 用户未登录
            if (userStatus) userStatus.style.display = 'none';
            if (loginBtn) loginBtn.style.display = 'flex';
        }
    }

    // 显示消息
    showMessage(message, type) {
        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;

        // 添加样式
        Object.assign(messageEl.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '600',
            zIndex: '1000',
            transform: 'translateX(400px)',
            transition: 'transform 0.3s ease'
        });

        // 根据类型设置背景色
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            warning: '#f39c12',
            info: '#3498db'
        };
        messageEl.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(messageEl);

        // 显示动画
        setTimeout(() => {
            messageEl.style.transform = 'translateX(0)';
        }, 100);

        // 自动隐藏
        setTimeout(() => {
            messageEl.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    document.body.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }

    // 获取当前用户
    getCurrentUser() {
        return this.currentUser;
    }

    // 检查是否已登录
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // 添加认证状态变化监听器（供外部调用）
    onAuthStateChange(callback) {
        authService.onAuthStateChange(callback);
    }

    // 显示 Bin ID 模态框
    showBinIdModal(binId) {
        const modal = document.getElementById('binIdModal');
        const binIdDisplay = document.getElementById('binIdDisplay');
        const copyBtn = document.getElementById('copyBinIdBtn');
        const closeBtn = document.getElementById('binIdModalClose');

        if (modal && binIdDisplay) {
            binIdDisplay.value = binId;
            modal.style.display = 'flex';

            // 绑定复制功能
            if (copyBtn) {
                copyBtn.onclick = () => {
                    binIdDisplay.select();
                    document.execCommand('copy');
                    this.showMessage('Bin ID 已复制到剪贴板', 'success');
                };
            }

            // 绑定关闭功能
            if (closeBtn) {
                closeBtn.onclick = () => {
                    modal.style.display = 'none';
                };
            }

            // 点击背景关闭
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            };
        }
    }
}

// 创建全局实例
export const simpleIntegration = new SimpleIntegration();
export default simpleIntegration;
