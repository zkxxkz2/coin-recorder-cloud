// Firebase集成服务
import { authService } from './firebase-auth.js';
import { dbService } from './firebase-database.js';
import { syncService } from './cloud-sync.js';

class FirebaseIntegration {
    constructor() {
        this.isInitialized = false;
        this.currentUser = null;
        this.init();
    }

    // 初始化Firebase集成
    init() {
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

        // 绑定UI事件
        this.bindEvents();
        
        this.isInitialized = true;
    }

    // 绑定事件监听器
    bindEvents() {
        // 登录按钮
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.showAuthModal('login'));
        }

        // 登出按钮
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // 同步按钮
        const syncBtn = document.getElementById('syncBtn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => this.manualSync());
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
        const showResetTab = document.getElementById('showResetTab');

        if (showLoginTab) {
            showLoginTab.addEventListener('click', () => this.switchAuthTab('login'));
        }
        if (showRegisterTab) {
            showRegisterTab.addEventListener('click', () => this.switchAuthTab('register'));
        }
        if (showResetTab) {
            showResetTab.addEventListener('click', () => this.switchAuthTab('reset'));
        }

        // 表单提交
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const resetForm = document.getElementById('resetForm');
        const googleLoginBtn = document.getElementById('googleLoginBtn');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
        if (resetForm) {
            resetForm.addEventListener('submit', (e) => this.handleResetPassword(e));
        }
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', () => this.handleGoogleLogin());
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
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.style.display = 'flex';
            setTimeout(() => {
                authModal.classList.add('show');
                this.switchAuthTab(tab);
            }, 10);
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
        const tabs = ['showLoginTab', 'showRegisterTab', 'showResetTab'];
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
        const forms = ['loginForm', 'registerForm', 'resetForm'];
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
                case 'reset':
                    titleElement.textContent = '重置密码';
                    subtitleElement.textContent = '输入邮箱地址以接收重置邮件';
                    break;
            }
        }
    }

    // 处理登录
    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showMessage('请填写完整信息', 'error');
            return;
        }

        const result = await authService.login(email, password);
        
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
        
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!name || !email || !password || !confirmPassword) {
            this.showMessage('请填写完整信息', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showMessage('两次输入的密码不一致', 'error');
            return;
        }

        if (password.length < 6) {
            this.showMessage('密码长度至少6位', 'error');
            return;
        }

        const result = await authService.register(email, password, name);
        
        if (result.success) {
            this.hideAuthModal();
            this.showMessage(result.message, 'success');
        } else {
            this.showMessage(result.error || result.message, 'error');
        }
    }

    // 处理重置密码
    async handleResetPassword(e) {
        e.preventDefault();
        
        const email = document.getElementById('resetEmail').value;

        if (!email) {
            this.showMessage('请输入邮箱地址', 'error');
            return;
        }

        const result = await authService.resetPassword(email);
        
        if (result.success) {
            this.hideAuthModal();
            this.showMessage(result.message, 'success');
        } else {
            this.showMessage(result.error || result.message, 'error');
        }
    }

    // 处理Google登录
    async handleGoogleLogin() {
        const result = await authService.loginWithGoogle();
        
        if (result.success) {
            this.hideAuthModal();
            this.showMessage(result.message, 'success');
        } else {
            this.showMessage(result.error || result.message, 'error');
        }
    }

    // 处理用户登录
    async handleUserLogin(user) {
        console.log('用户登录:', user.email);
        
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

    // 手动同步
    async manualSync() {
        const syncBtn = document.getElementById('syncBtn');
        if (syncBtn) {
            syncBtn.style.opacity = '0.5';
            syncBtn.style.pointerEvents = 'none';
        }

        try {
            const result = await syncService.manualSync();
            
            if (result.success) {
                this.showMessage(result.message, 'success');
            } else {
                this.showMessage(result.message, 'error');
            }
        } finally {
            if (syncBtn) {
                syncBtn.style.opacity = '1';
                syncBtn.style.pointerEvents = 'auto';
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
            if (userEmail) userEmail.textContent = user.email;
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
}

// 创建全局实例
export const firebaseIntegration = new FirebaseIntegration();
export default firebaseIntegration;
