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
        const joinLeaderboardBtn = document.getElementById('joinLeaderboardBtn');
        const showBinIdBtn = document.getElementById('showBinIdBtn');
        
        if (syncFromCloudBtn) {
            syncFromCloudBtn.addEventListener('click', () => this.syncFromCloud());
        }
        if (syncToCloudBtn) {
            syncToCloudBtn.addEventListener('click', () => this.syncToCloud());
        }
        if (joinLeaderboardBtn) {
            joinLeaderboardBtn.addEventListener('click', () => this.showJoinLeaderboardModal());
        }
        if (showBinIdBtn) {
            showBinIdBtn.addEventListener('click', () => this.showBinId());
        }

        // 认证模态框事件
        this.setupAuthModalEvents();
        
        // 数据迁移模态框事件
        this.setupMigrationModalEvents();
        
        // 公开排行榜横幅事件
        this.setupLeaderboardBannerEvents();
        
        // 加入排行榜模态框事件
        this.setupJoinLeaderboardModalEvents();
        
        // 用户详情模态框事件
        this.setupUserDetailModalEvents();
        
        // 多维度排行榜事件
        this.bindMultiLeaderboardEvents();
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

        if (!usernameOrBinId) {
            this.showMessage('请输入账户ID', 'error');
            return;
        }

        const result = await authService.login(usernameOrBinId);
        
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

        if (!username) {
            this.showMessage('请输入用户名', 'error');
            return;
        }

        if (username.length < 3) {
            this.showMessage('用户名至少3个字符', 'error');
            return;
        }

        const result = await authService.register(username);
        
        if (result.success) {
            this.hideAuthModal();
            // 显示账户ID模态框
            this.showBinIdModal(result.binId);
        } else {
            this.showMessage(result.error || result.message, 'error');
        }
    }

    // 处理用户登录
    async handleUserLogin(user) {
        console.log('用户登录:', user.username);
        
        // 登录后不自动同步，避免创建新的 bin ID
        // 用户可以通过手动点击同步按钮来控制同步行为
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
                    this.showMessage('账户ID 已复制到剪贴板', 'success');
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

    // 设置公开排行榜横幅事件
    setupLeaderboardBannerEvents() {
        const joinBtn = document.getElementById('joinPublicLeaderboardBtn');
        const refreshBtn = document.getElementById('refreshBannerBtn');
        const leaveBtn = document.getElementById('leaveLeaderboardBtn');

        if (joinBtn) {
            joinBtn.addEventListener('click', () => this.showJoinLeaderboardModal());
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshLeaderboardBanner());
        }

        if (leaveBtn) {
            leaveBtn.addEventListener('click', () => this.leavePublicLeaderboard());
        }
    }

    // 设置加入排行榜模态框事件
    setupJoinLeaderboardModalEvents() {
        const modal = document.getElementById('joinLeaderboardModal');
        if (!modal) return;

        const closeBtn = modal.querySelector('.join-leaderboard-modal-close');
        const cancelBtn = document.getElementById('cancelJoinBtn');
        const confirmBtn = document.getElementById('confirmJoinBtn');

        // 关闭模态框
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideJoinLeaderboardModal());
        }

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideJoinLeaderboardModal();
            }
        });

        // 取消加入
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideJoinLeaderboardModal());
        }

        // 确认加入
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.confirmJoinPublicLeaderboard());
        }
    }

    // 显示加入排行榜模态框
    showJoinLeaderboardModal() {
        const modal = document.getElementById('joinLeaderboardModal');
        if (!modal) return;

        // 获取当前用户信息
        const currentUser = this.authService?.currentUser || JSON.parse(localStorage.getItem('coinTrackerUser') || 'null');
        const currentBinId = this.syncService?.binId || 
                           localStorage.getItem('coinTrackerBinId') ||
                           localStorage.getItem('binId');

        if (!currentUser || !currentBinId) {
            this.showMessage('请先登录', 'error');
            return;
        }

        // 计算当前金币数 - 从CoinTracker实例获取最新数据
        let currentCoins = 0;
        if (window.coinTracker && window.coinTracker.coinRecords) {
            currentCoins = this.calculateCurrentCoins(window.coinTracker.coinRecords);
        } else {
            // 备用方案：从localStorage获取
            const coinRecords = JSON.parse(localStorage.getItem('coinRecords') || '[]');
            currentCoins = this.calculateCurrentCoins(coinRecords);
        }

        // 更新模态框内容
        const usernameEl = document.getElementById('joinModalUsername');
        const coinsEl = document.getElementById('joinModalCoins');
        const binIdEl = document.getElementById('joinModalBinId');

        if (usernameEl) usernameEl.textContent = currentUser.username;
        if (coinsEl) coinsEl.textContent = currentCoins.toLocaleString();
        if (binIdEl) binIdEl.textContent = currentBinId;

        modal.style.display = 'flex';
    }

    // 隐藏加入排行榜模态框
    hideJoinLeaderboardModal() {
        const modal = document.getElementById('joinLeaderboardModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // 显示账户ID
    showBinId() {
        // 从多个来源获取账户ID
        const currentBinId = this.syncService?.binId || 
                           localStorage.getItem('coinTrackerBinId') ||
                           localStorage.getItem('binId');
        
        if (!currentBinId) {
            this.showMessage('未找到账户ID，请先登录', 'error');
            return;
        }

        // 使用现有的showBinIdModal方法，它包含了完整的事件绑定
        this.showBinIdModal(currentBinId);
    }

    // 添加用户到排行榜
    async addUserToLeaderboard() {
        const binIdInput = document.getElementById('leaderboardBinId');
        const addBtn = document.getElementById('addToLeaderboardBtn');
        
        if (!binIdInput || !addBtn) return;

        const binId = binIdInput.value.trim();
        if (!binId) {
            this.showMessage('请输入账户ID', 'error');
            return;
        }

        if (binId.length !== 24) {
            this.showMessage('账户ID长度应为24位', 'error');
            return;
        }

        // 检查是否已存在
        const existingUsers = this.getLeaderboardUsers();
        if (existingUsers.includes(binId)) {
            this.showMessage('该用户已在排行榜中', 'warning');
            return;
        }

        addBtn.disabled = true;
        addBtn.textContent = '添加中...';

        try {
            // 验证binId是否有效
            const isValid = await this.validateBinId(binId);
            if (!isValid) {
                this.showMessage('无效的账户ID', 'error');
                return;
            }

            // 添加到本地存储
            existingUsers.push(binId);
            localStorage.setItem('leaderboardUsers', JSON.stringify(existingUsers));

            // 清空输入框
            binIdInput.value = '';

            // 刷新排行榜
            await this.loadLeaderboard();
            
            this.showMessage('用户添加成功', 'success');
        } catch (error) {
            console.error('添加用户失败:', error);
            this.showMessage('添加用户失败', 'error');
        } finally {
            addBtn.disabled = false;
            addBtn.textContent = '添加';
        }
    }

    // 验证binId是否有效
    async validateBinId(binId) {
        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': window.jsonbinConfig.apiKey
                }
            });

            if (response.ok) {
                const result = await response.json();
                return result.record && result.record.users && result.record.users.length > 0;
            }
            return false;
        } catch (error) {
            console.error('验证binId失败:', error);
            return false;
        }
    }

    // 获取排行榜用户列表
    getLeaderboardUsers() {
        try {
            const users = localStorage.getItem('leaderboardUsers');
            return users ? JSON.parse(users) : [];
        } catch (error) {
            console.error('获取排行榜用户失败:', error);
            return [];
        }
    }

    // 获取所有排行榜用户数据（用于多维度排行榜）
    async getAllLeaderboardUsers() {
        try {
            const publicLeaderboardBinId = localStorage.getItem('publicLeaderboardBinId');
            if (!publicLeaderboardBinId) {
                return [];
            }

            const response = await fetch(`https://api.jsonbin.io/v3/b/${publicLeaderboardBinId}/latest`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': window.jsonbinConfig.apiKey
                }
            });

            if (!response.ok) {
                throw new Error('无法获取排行榜数据');
            }

            const result = await response.json();
            const leaderboardData = result.record;

            if (!leaderboardData.participants) {
                return [];
            }

            // 获取所有参与者的完整数据
            const userData = [];
            const promises = leaderboardData.participants.map(async (participant) => {
                try {
                    const userResponse = await fetch(`https://api.jsonbin.io/v3/b/${participant.binId}/latest`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Master-Key': window.jsonbinConfig.apiKey
                        }
                    });

                    if (userResponse.ok) {
                        const userResult = await userResponse.json();
                        const userData = userResult.record;
                        
                        if (userData.coinRecords) {
                            // 计算当前金币数（最新记录的金币数）
                            const currentCoins = this.calculateCurrentCoins(userData.coinRecords);
                            const achievements = Object.keys(userData.achievements || {}).filter(key => userData.achievements[key].unlocked).length;
                            
                            // 计算等级信息
                            const levelInfo = this.getLevelInfo(currentCoins);
                            
                            // 计算称号
                            const titles = this.getTitles(userData.coinRecords, userData.streakData, userData.achievements);
                            
                            // 计算增长趋势
                            const growthTrend = this.calculateGrowthTrend(userData.coinRecords);
                            
                            return {
                                username: participant.username,
                                currentCoins: currentCoins,
                                coinRecords: userData.coinRecords || [],
                                streakData: userData.streakData || {},
                                achievements: userData.achievements || {},
                                achievementCount: achievements,
                                binId: participant.binId,
                                levelInfo: levelInfo,
                                titles: titles,
                                growthTrend: growthTrend
                            };
                        }
                    }
                } catch (error) {
                    console.error(`获取用户 ${participant.binId} 数据失败:`, error);
                }
                return null;
            });

            const results = await Promise.all(promises);
            return results.filter(user => user !== null);
        } catch (error) {
            console.error('获取所有排行榜用户失败:', error);
            return [];
        }
    }

    // 加载排行榜数据
    async loadLeaderboard() {
        const users = this.getLeaderboardUsers();
        if (users.length === 0) {
            this.showEmptyLeaderboard();
            return;
        }

        const leaderboardList = document.getElementById('leaderboardList');
        const leaderboardStats = document.getElementById('leaderboardStats');
        
        if (!leaderboardList || !leaderboardStats) return;

        try {
            // 显示加载状态
            leaderboardList.innerHTML = '<div class="empty-leaderboard"><div class="empty-icon">⏳</div><p>加载中...</p></div>';

            const userData = [];
            let totalCoins = 0;

            // 并行获取所有用户数据
            const promises = users.map(async (binId) => {
                try {
                    const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Master-Key': window.jsonbinConfig.apiKey
                        }
                    });

                    if (response.ok) {
                        const result = await response.json();
                        const data = result.record;
                        
                        if (data.users && data.users.length > 0) {
                            const user = data.users[0];
                            const coins = data.coinRecords?.reduce((sum, record) => sum + (record.coins || 0), 0) || 0;
                            
                            userData.push({
                                username: user.username,
                                totalCoins: coins,
                                coinRecords: data.coinRecords || [],
                                streakData: data.streakData || {},
                                achievements: data.achievements || {},
                                binId: binId
                            });
                            
                            totalCoins += coins;
                        }
                    }
                } catch (error) {
                    console.error(`获取用户 ${binId} 数据失败:`, error);
                }
            });

            await Promise.all(promises);

            // 按金币数排序
            userData.sort((a, b) => b.totalCoins - a.totalCoins);

            // 更新统计信息
            this.updateLeaderboardStats(userData.length, totalCoins);
            leaderboardStats.style.display = 'flex';

            // 更新排行榜列表
            this.updateLeaderboardList(userData);

        } catch (error) {
            console.error('加载排行榜失败:', error);
            leaderboardList.innerHTML = '<div class="empty-leaderboard"><div class="empty-icon">❌</div><p>加载失败</p></div>';
        }
    }

    // 更新排行榜统计信息
    updateLeaderboardStats(userCount, totalCoins) {
        const participantCount = document.getElementById('participantCount');
        const totalCoinsEl = document.getElementById('totalCoins');
        const averageCoins = document.getElementById('averageCoins');

        if (participantCount) participantCount.textContent = userCount;
        if (totalCoinsEl) totalCoinsEl.textContent = totalCoins.toLocaleString();
        if (averageCoins) averageCoins.textContent = userCount > 0 ? Math.round(totalCoins / userCount).toLocaleString() : '0';
    }

    // 更新排行榜列表
    updateLeaderboardList(userData) {
        const leaderboardList = document.getElementById('leaderboardList');
        if (!leaderboardList) return;

        if (userData.length === 0) {
            this.showEmptyLeaderboard();
            return;
        }

        const html = userData.map((user, index) => {
            const rank = index + 1;
            let rankClass = '';
            if (rank === 1) rankClass = 'rank-gold';
            else if (rank === 2) rankClass = 'rank-silver';
            else if (rank === 3) rankClass = 'rank-bronze';

            const achievements = Object.keys(user.achievements).filter(key => user.achievements[key].unlocked).length;

            return `
                <div class="leaderboard-item">
                    <div class="rank-number ${rankClass}">${rank}</div>
                    <div class="user-info">
                        <div class="username">${user.username}</div>
                        <div class="user-stats">
                            记录数: ${user.coinRecords.length} | 
                            连续天数: ${user.streakData.currentStreak || 0} | 
                            成就数: ${achievements}
                        </div>
                    </div>
                    <div class="total-coins">${user.totalCoins.toLocaleString()}</div>
                </div>
            `;
        }).join('');

        leaderboardList.innerHTML = html;
    }

    // 显示空排行榜
    showEmptyLeaderboard() {
        const leaderboardList = document.getElementById('leaderboardList');
        const leaderboardStats = document.getElementById('leaderboardStats');
        
        if (leaderboardList) {
            leaderboardList.innerHTML = `
                <div class="empty-leaderboard">
                    <div class="empty-icon">📊</div>
                    <p>暂无排行榜数据</p>
                    <small>添加用户账户ID开始查看排行榜</small>
                </div>
            `;
        }
        
        if (leaderboardStats) {
            leaderboardStats.style.display = 'none';
        }
    }

    // 刷新排行榜
    async refreshLeaderboard() {
        await this.loadLeaderboard();
        this.showMessage('排行榜已刷新', 'success');
    }

    // 确认加入公开排行榜
    async confirmJoinPublicLeaderboard() {
        const currentUser = this.authService?.currentUser || JSON.parse(localStorage.getItem('coinTrackerUser') || 'null');
        const currentBinId = this.syncService?.binId || 
                           localStorage.getItem('coinTrackerBinId') ||
                           localStorage.getItem('binId');

        if (!currentUser || !currentBinId) {
            this.showMessage('请先登录', 'error');
            return;
        }

        try {
            // TODO: 这里需要您提供公开排行榜数据库的Bin ID
            const publicLeaderboardBinId = '68eb2e76d0ea881f409e7470';
            
            // 获取当前公开排行榜数据
            const response = await fetch(`https://api.jsonbin.io/v3/b/${publicLeaderboardBinId}/latest`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': window.jsonbinConfig.apiKey
                }
            });

            if (!response.ok) {
                throw new Error('无法获取公开排行榜数据');
            }

            const result = await response.json();
            const leaderboardData = result.record;

            // 检查用户是否已经在排行榜中
            const existingParticipant = leaderboardData.participants?.find(p => p.binId === currentBinId);
            if (existingParticipant) {
                this.showMessage('您已经在公开排行榜中', 'warning');
                this.hideJoinLeaderboardModal();
                
                // 保存到本地存储并显示排行榜横幅
                localStorage.setItem('joinedPublicLeaderboard', 'true');
                localStorage.setItem('publicLeaderboardBinId', publicLeaderboardBinId);
                this.showLeaderboardBanner();
                await this.loadLeaderboardBanner();
                return;
            }

            // 添加用户到公开排行榜
            const newParticipant = {
                binId: currentBinId,
                username: currentUser.username,
                joinedAt: new Date().toISOString(),
                isActive: true,
                lastSync: new Date().toISOString()
            };

            if (!leaderboardData.participants) {
                leaderboardData.participants = [];
            }
            leaderboardData.participants.push(newParticipant);
            leaderboardData.lastUpdated = new Date().toISOString();

            // 更新公开排行榜数据
            const updateResponse = await fetch(`https://api.jsonbin.io/v3/b/${publicLeaderboardBinId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': window.jsonbinConfig.apiKey
                },
                body: JSON.stringify(leaderboardData)
            });

            if (!updateResponse.ok) {
                throw new Error('加入公开排行榜失败');
            }

            // 保存到本地存储
            localStorage.setItem('joinedPublicLeaderboard', 'true');
            localStorage.setItem('publicLeaderboardBinId', publicLeaderboardBinId);

            this.hideJoinLeaderboardModal();
            this.showMessage('成功加入公开排行榜！', 'success');
            
            // 显示排行榜横幅
            this.showLeaderboardBanner();
            await this.loadLeaderboardBanner();

        } catch (error) {
            console.error('加入公开排行榜失败:', error);
            this.showMessage('加入失败，请稍后重试', 'error');
        }
    }

    // 显示排行榜横幅
    showLeaderboardBanner() {
        const banner = document.getElementById('leaderboardBanner');
        if (banner) {
            banner.style.display = 'block';
        }
    }

    // 隐藏排行榜横幅
    hideLeaderboardBanner() {
        const banner = document.getElementById('leaderboardBanner');
        if (banner) {
            banner.style.display = 'none';
        }
    }

    // 加载排行榜横幅数据
    async loadLeaderboardBanner() {
        try {
            const publicLeaderboardBinId = localStorage.getItem('publicLeaderboardBinId');
            if (!publicLeaderboardBinId) {
                this.hideLeaderboardBanner();
                return;
            }

            const response = await fetch(`https://api.jsonbin.io/v3/b/${publicLeaderboardBinId}/latest`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': window.jsonbinConfig.apiKey
                }
            });

            if (!response.ok) {
                throw new Error('无法获取排行榜数据');
            }

            const result = await response.json();
            const leaderboardData = result.record;

            // 更新统计信息
            const participantCount = leaderboardData.participants?.length || 0;
            const participantCountEl = document.getElementById('bannerParticipantCount');
            if (participantCountEl) {
                participantCountEl.textContent = participantCount;
            }

            // 获取所有参与者的金币数据
            const userData = [];
            let totalCoins = 0;
            let totalRecords = 0;

            if (leaderboardData.participants) {
                const promises = leaderboardData.participants.map(async (participant) => {
                    try {
                        const userResponse = await fetch(`https://api.jsonbin.io/v3/b/${participant.binId}/latest`, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Master-Key': window.jsonbinConfig.apiKey
                            }
                        });

                        if (userResponse.ok) {
                            const userResult = await userResponse.json();
                            const userData = userResult.record;
                            
                            if (userData.coinRecords) {
                                // 计算当前金币数（最新记录的金币数）
                                const currentCoins = this.calculateCurrentCoins(userData.coinRecords);
                                const achievements = Object.keys(userData.achievements || {}).filter(key => userData.achievements[key].unlocked).length;
                                
                                // 计算等级信息
                                const levelInfo = this.getLevelInfo(currentCoins);
                                
                                // 计算称号
                                const titles = this.getTitles(userData.coinRecords, userData.streakData, userData.achievements);
                                
                                // 计算增长趋势
                                const growthTrend = this.calculateGrowthTrend(userData.coinRecords);
                                
                                return {
                                    username: participant.username,
                                    currentCoins: currentCoins,
                                    coinRecords: userData.coinRecords || [],
                                    streakData: userData.streakData || {},
                                    achievements: userData.achievements || {},
                                    achievementCount: achievements,
                                    binId: participant.binId,
                                    levelInfo: levelInfo,
                                    titles: titles,
                                    growthTrend: growthTrend
                                };
                            }
                        }
                    } catch (error) {
                        console.error(`获取用户 ${participant.binId} 数据失败:`, error);
                    }
                    return null;
                });

                const results = await Promise.all(promises);
                userData.push(...results.filter(result => result !== null));
                totalCoins = userData.reduce((sum, user) => sum + user.currentCoins, 0);
                totalRecords = userData.reduce((sum, user) => sum + user.coinRecords.length, 0);
            }

            // 更新统计信息
            const totalCoinsEl = document.getElementById('bannerTotalCoins');
            const averageCoinsEl = document.getElementById('bannerAverageCoins');
            
            if (totalCoinsEl) {
                totalCoinsEl.textContent = totalCoins.toLocaleString();
            }
            if (averageCoinsEl) {
                averageCoinsEl.textContent = participantCount > 0 ? Math.round(totalCoins / participantCount).toLocaleString() : '0';
            }

            // 更新排行榜列表
            this.updateBannerLeaderboard(userData);

            // 更新按钮状态
            this.updateBannerButtons();

        } catch (error) {
            console.error('加载排行榜横幅失败:', error);
            this.showMessage('加载排行榜失败', 'error');
        }
    }

    // 更新横幅排行榜列表
    updateBannerLeaderboard(userData) {
        const bannerLeaderboard = document.getElementById('bannerLeaderboard');
        const emptyBanner = bannerLeaderboard.querySelector('.empty-banner');
        const podiumContainer = document.getElementById('podiumContainer');
        const leaderboardList = document.getElementById('leaderboardList');
        
        if (!bannerLeaderboard) return;

        if (!userData || userData.length === 0) {
            if (emptyBanner) emptyBanner.style.display = 'block';
            if (podiumContainer) podiumContainer.style.display = 'none';
            if (leaderboardList) leaderboardList.style.display = 'none';
            return;
        }

        // 隐藏空状态
        if (emptyBanner) emptyBanner.style.display = 'none';

        // 按当前金币数排序
        const sortedUsers = userData.sort((a, b) => b.currentCoins - a.currentCoins);

        // 更新前三名领奖台
        this.updatePodium(sortedUsers.slice(0, 3));

        // 更新第四名开始的列表
        this.updateLeaderboardList(sortedUsers.slice(3));

        // 显示相应的容器
        if (podiumContainer) podiumContainer.style.display = 'flex';
        if (leaderboardList) leaderboardList.style.display = sortedUsers.length > 3 ? 'block' : 'none';
    }

    // 更新领奖台
    updatePodium(topThree) {
        const podiumContainer = document.getElementById('podiumContainer');
        if (!podiumContainer) return;

        // 确保有足够的用户数据
        const users = [null, null, null];
        topThree.forEach((user, index) => {
            users[index] = user;
        });

            // 更新第二名（左侧）
            const secondPlace = podiumContainer.querySelector('.second-place');
            if (secondPlace && users[1]) {
                const usernameEl = secondPlace.querySelector('.podium-username');
                const coinsEl = secondPlace.querySelector('.podium-coins');
                if (usernameEl) {
                    usernameEl.innerHTML = this.formatUserDisplay(users[1]);
                }
                if (coinsEl) coinsEl.textContent = users[1].currentCoins.toLocaleString();
                secondPlace.style.display = 'flex';
                secondPlace.onclick = () => this.showUserDetail(users[1], 2);
            } else if (secondPlace) {
                secondPlace.style.display = 'none';
            }

        // 更新第一名（中间）
        const firstPlace = podiumContainer.querySelector('.first-place');
        if (firstPlace && users[0]) {
            const usernameEl = firstPlace.querySelector('.podium-username');
            const coinsEl = firstPlace.querySelector('.podium-coins');
            if (usernameEl) {
                usernameEl.innerHTML = this.formatUserDisplay(users[0]);
            }
            if (coinsEl) coinsEl.textContent = users[0].currentCoins.toLocaleString();
            firstPlace.style.display = 'flex';
            firstPlace.onclick = () => this.showUserDetail(users[0], 1);
        } else if (firstPlace) {
            firstPlace.style.display = 'none';
        }

        // 更新第三名（右侧）
        const thirdPlace = podiumContainer.querySelector('.third-place');
        if (thirdPlace && users[2]) {
            const usernameEl = thirdPlace.querySelector('.podium-username');
            const coinsEl = thirdPlace.querySelector('.podium-coins');
            if (usernameEl) {
                usernameEl.innerHTML = this.formatUserDisplay(users[2]);
            }
            if (coinsEl) coinsEl.textContent = users[2].currentCoins.toLocaleString();
            thirdPlace.style.display = 'flex';
            thirdPlace.onclick = () => this.showUserDetail(users[2], 3);
        } else if (thirdPlace) {
            thirdPlace.style.display = 'none';
        }
    }

    // 更新排行榜列表
    updateLeaderboardList(users) {
        const leaderboardList = document.getElementById('leaderboardList');
        if (!leaderboardList) return;

        if (!users || users.length === 0) {
            leaderboardList.innerHTML = '';
            return;
        }

            const html = users.map((user, index) => {
                const rank = index + 4; // 从第四名开始
                return `
                    <div class="leaderboard-list-item" onclick="window.simpleIntegration.showUserDetail(${JSON.stringify(user).replace(/"/g, '&quot;')}, ${rank})">
                        <div class="rank">${rank}</div>
                        <div class="user-info">
                            <div class="username">${this.formatUserDisplay(user)}</div>
                            <div class="user-stats">
                                <span>${user.coinRecords.length}条</span>
                                <span>${user.streakData?.currentStreak || 0}天</span>
                                <span>${user.achievementCount || 0}成就</span>
                            </div>
                        </div>
                        <div class="coins">${user.currentCoins.toLocaleString()}</div>
                    </div>
                `;
            }).join('');

        leaderboardList.innerHTML = html;
    }

    // 更新横幅按钮状态
    updateBannerButtons() {
        const joinBtn = document.getElementById('joinPublicLeaderboardBtn');
        const leaveBtn = document.getElementById('leaveLeaderboardBtn');

        const isJoined = localStorage.getItem('joinedPublicLeaderboard') === 'true';

        if (joinBtn) {
            joinBtn.style.display = isJoined ? 'none' : 'block';
        }

        if (leaveBtn) {
            leaveBtn.style.display = isJoined ? 'block' : 'none';
        }
    }

    // 刷新排行榜横幅
    async refreshLeaderboardBanner() {
        await this.loadLeaderboardBanner();
        this.showMessage('排行榜已刷新', 'success');
    }

    // 退出公开排行榜
    async leavePublicLeaderboard() {
        if (!confirm('确定要退出公开排行榜吗？')) {
            return;
        }

        try {
            const publicLeaderboardBinId = localStorage.getItem('publicLeaderboardBinId');
            const currentBinId = this.syncService?.binId || 
                               localStorage.getItem('coinTrackerBinId') ||
                               localStorage.getItem('binId');

            if (!publicLeaderboardBinId || !currentBinId) {
                this.showMessage('无法退出排行榜', 'error');
                return;
            }

            // 获取当前公开排行榜数据
            const response = await fetch(`https://api.jsonbin.io/v3/b/${publicLeaderboardBinId}/latest`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': window.jsonbinConfig.apiKey
                }
            });

            if (!response.ok) {
                throw new Error('无法获取公开排行榜数据');
            }

            const result = await response.json();
            const leaderboardData = result.record;

            // 移除用户
            if (leaderboardData.participants) {
                leaderboardData.participants = leaderboardData.participants.filter(p => p.binId !== currentBinId);
                leaderboardData.lastUpdated = new Date().toISOString();

                // 更新公开排行榜数据
                const updateResponse = await fetch(`https://api.jsonbin.io/v3/b/${publicLeaderboardBinId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Master-Key': window.jsonbinConfig.apiKey
                    },
                    body: JSON.stringify(leaderboardData)
                });

                if (!updateResponse.ok) {
                    throw new Error('退出公开排行榜失败');
                }
            }

            // 清除本地存储
            localStorage.removeItem('joinedPublicLeaderboard');
            localStorage.removeItem('publicLeaderboardBinId');

            this.hideLeaderboardBanner();
            this.showMessage('已退出公开排行榜', 'success');

        } catch (error) {
            console.error('退出公开排行榜失败:', error);
            this.showMessage('退出失败，请稍后重试', 'error');
        }
    }

    // 计算当前金币数（最新记录的金币数）
    calculateCurrentCoins(coinRecords) {
        if (!coinRecords || coinRecords.length === 0) {
            return 0;
        }

        // 按时间排序，获取最新的记录
        const sortedRecords = coinRecords.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.date);
            const timeB = new Date(b.timestamp || b.date);
            return timeB - timeA;
        });

        // 返回最新记录的金币数
        return sortedRecords[0].coins || 0;
    }

    // 等级系统
    getLevelInfo(currentCoins) {
        const levels = [
            { name: '新手', min: 0, max: 1000, color: '#95a5a6', icon: '🌱' },
            { name: '白银', min: 1000, max: 5000, color: '#bdc3c7', icon: '🥈' },
            { name: '黄金', min: 5000, max: 15000, color: '#f1c40f', icon: '🥇' },
            { name: '黑金', min: 15000, max: 30000, color: '#34495e', icon: '⚫' },
            { name: '传奇', min: 30000, max: 40000, color: '#9b59b6', icon: '👑' },
            { name: '青铜传奇', min: 40000, max: 50000, color: '#cd7f32', icon: '🏆' },
            { name: '白银传奇', min: 50000, max: 70000, color: '#c0c0c0', icon: '💎' },
            { name: '黄金传奇', min: 70000, max: 100000, color: '#ffd700', icon: '⭐' },
            { name: '黑金传奇', min: 100000, max: Infinity, color: '#2c3e50', icon: '🌟' }
        ];

        for (const level of levels) {
            if (currentCoins >= level.min && currentCoins < level.max) {
                const progress = Math.min((currentCoins - level.min) / (level.max - level.min), 1);
                return {
                    ...level,
                    progress: progress,
                    nextLevel: levels[levels.indexOf(level) + 1] || null
                };
            }
        }
        return levels[levels.length - 1];
    }

    // 称号系统
    getTitles(coinRecords, streakData, achievements) {
        const titles = [];
        
        if (!coinRecords || coinRecords.length === 0) {
            return titles;
        }

        // 新手：前10条记录
        if (coinRecords.length <= 10) {
            titles.push({ name: '新手', icon: '🌱', color: '#95a5a6' });
        }

        // 成长者：连续7天记录
        if (streakData && streakData.currentStreak >= 7) {
            titles.push({ name: '成长者', icon: '📈', color: '#27ae60' });
        }

        // 坚持者：连续30天记录
        if (streakData && streakData.currentStreak >= 30) {
            titles.push({ name: '坚持者', icon: '💪', color: '#f39c12' });
        }

        // 爆发者：单日增长超过1000
        const maxDailyGrowth = this.calculateMaxDailyGrowth(coinRecords);
        if (maxDailyGrowth >= 1000) {
            titles.push({ name: '爆发者', icon: '🚀', color: '#e74c3c' });
        }

        // 稳定者：连续10天增长
        if (this.hasConsecutiveGrowth(coinRecords, 10)) {
            titles.push({ name: '稳定者', icon: '📊', color: '#3498db' });
        }

        // 传奇：总金币超过100万
        const totalCoins = coinRecords.reduce((sum, record) => sum + (record.coins || 0), 0);
        if (totalCoins >= 1000000) {
            titles.push({ name: '传奇', icon: '👑', color: '#9b59b6' });
        }

        return titles;
    }

    // 计算最大单日增长
    calculateMaxDailyGrowth(coinRecords) {
        if (!coinRecords || coinRecords.length < 2) return 0;
        
        const sortedRecords = coinRecords.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.date);
            const timeB = new Date(b.timestamp || b.date);
            return timeA - timeB;
        });

        let maxGrowth = 0;
        for (let i = 1; i < sortedRecords.length; i++) {
            const growth = sortedRecords[i].coins - sortedRecords[i-1].coins;
            maxGrowth = Math.max(maxGrowth, growth);
        }
        return maxGrowth;
    }

    // 检查是否有连续增长
    hasConsecutiveGrowth(coinRecords, days) {
        if (!coinRecords || coinRecords.length < days) return false;
        
        const sortedRecords = coinRecords.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.date);
            const timeB = new Date(b.timestamp || b.date);
            return timeA - timeB;
        });

        let consecutiveCount = 0;
        for (let i = 1; i < sortedRecords.length; i++) {
            if (sortedRecords[i].coins > sortedRecords[i-1].coins) {
                consecutiveCount++;
                if (consecutiveCount >= days - 1) return true;
            } else {
                consecutiveCount = 0;
            }
        }
        return false;
    }

    // 计算增长趋势
    calculateGrowthTrend(coinRecords) {
        if (!coinRecords || coinRecords.length < 2) return { trend: 'stable', percentage: 0 };
        
        const sortedRecords = coinRecords.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.date);
            const timeB = new Date(b.timestamp || b.date);
            return timeA - timeB;
        });

        const recent = sortedRecords.slice(-7); // 最近7天
        const older = sortedRecords.slice(-14, -7); // 前7天

        if (recent.length === 0 || older.length === 0) return { trend: 'stable', percentage: 0 };

        const recentAvg = recent.reduce((sum, r) => sum + r.coins, 0) / recent.length;
        const olderAvg = older.reduce((sum, r) => sum + r.coins, 0) / older.length;

        const percentage = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
        
        if (percentage > 5) return { trend: 'up', percentage: Math.round(percentage) };
        if (percentage < -5) return { trend: 'down', percentage: Math.round(Math.abs(percentage)) };
        return { trend: 'stable', percentage: 0 };
    }

    // 格式化用户显示（包含等级、称号、趋势）
    formatUserDisplay(user) {
        let html = `<span class="username-text">${user.username}</span>`;
        
        // 添加等级标识
        if (user.levelInfo) {
            html += ` <span class="level-badge" style="color: ${user.levelInfo.color};">${user.levelInfo.icon} ${user.levelInfo.name}</span>`;
        }
        
        // 添加主要称号
        if (user.titles && user.titles.length > 0) {
            const mainTitle = user.titles[0]; // 显示第一个称号
            html += ` <span class="title-badge" style="color: ${mainTitle.color};">${mainTitle.icon} ${mainTitle.name}</span>`;
        }
        
        // 添加增长趋势
        if (user.growthTrend) {
            let trendIcon = '';
            let trendColor = '';
            if (user.growthTrend.trend === 'up') {
                trendIcon = '📈';
                trendColor = '#27ae60';
            } else if (user.growthTrend.trend === 'down') {
                trendIcon = '📉';
                trendColor = '#e74c3c';
            } else {
                trendIcon = '➡️';
                trendColor = '#95a5a6';
            }
            html += ` <span class="trend-badge" style="color: ${trendColor};">${trendIcon}</span>`;
        }
        
        return html;
    }

    // 显示用户详情
    showUserDetail(user, rank) {
        const modal = document.getElementById('userDetailModal');
        if (!modal || !user) return;

        // 更新用户信息
        const usernameEl = document.getElementById('userDetailUsername');
        const rankEl = document.getElementById('userDetailRank');
        const totalCoinsEl = document.getElementById('userDetailTotalCoins');
        const recordCountEl = document.getElementById('userDetailRecordCount');
        const streakEl = document.getElementById('userDetailStreak');
        const achievementsEl = document.getElementById('userDetailAchievements');
        const lastActiveEl = document.getElementById('userDetailLastActive');

        if (usernameEl) {
            usernameEl.innerHTML = `<span class="username-text">${user.username}</span>`;
            if (user.levelInfo) {
                usernameEl.innerHTML += ` <span class="level-badge" style="color: ${user.levelInfo.color};">${user.levelInfo.icon} ${user.levelInfo.name}</span>`;
            }
        }
        if (rankEl) rankEl.textContent = `排名: ${rank}`;
        if (totalCoinsEl) totalCoinsEl.textContent = user.currentCoins.toLocaleString();
        if (recordCountEl) recordCountEl.textContent = user.coinRecords.length;
        if (streakEl) streakEl.textContent = user.streakData?.currentStreak || 0;
        if (achievementsEl) achievementsEl.textContent = user.achievementCount || 0;

        // 计算最后活跃时间
        if (lastActiveEl) {
            const lastActive = this.calculateLastActiveTime(user);
            lastActiveEl.textContent = lastActive;
        }

        // 更新称号
        this.updateUserDetailTitles(user);

        // 更新最近记录
        this.updateUserDetailRecords(user);

        // 显示模态框
        modal.style.display = 'block';
    }

    // 计算最后活跃时间
    calculateLastActiveTime(user) {
        if (!user.coinRecords || user.coinRecords.length === 0) {
            return '从未记录';
        }

        // 找到最新的记录时间
        const latestRecord = user.coinRecords.reduce((latest, record) => {
            const recordTime = new Date(record.timestamp || record.date);
            const latestTime = new Date(latest.timestamp || latest.date);
            return recordTime > latestTime ? record : latest;
        });

        const lastActiveTime = new Date(latestRecord.timestamp || latestRecord.date);
        
        // 格式化为年月日小时
        return lastActiveTime.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            hour12: false
        });
    }

    // 更新用户详情记录
    updateUserDetailRecords(user) {
        const recordsList = document.getElementById('userDetailRecordsList');
        if (!recordsList || !user.coinRecords) return;

        // 按时间排序，显示最近10条记录
        const sortedRecords = user.coinRecords
            .sort((a, b) => {
                const timeA = new Date(a.timestamp || a.date);
                const timeB = new Date(b.timestamp || b.date);
                return timeB - timeA;
            })
            .slice(0, 10);

        if (sortedRecords.length === 0) {
            recordsList.innerHTML = '<div class="record-item"><span class="record-date">暂无记录</span></div>';
            return;
        }

        const html = sortedRecords.map(record => {
            const date = new Date(record.timestamp || record.date);
            const dateStr = date.toLocaleDateString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `
                <div class="record-item">
                    <span class="record-date">${dateStr}</span>
                    <span class="record-coins">+${record.coins}</span>
                </div>
            `;
        }).join('');

        recordsList.innerHTML = html;
    }

    // 隐藏用户详情模态框
    hideUserDetailModal() {
        const modal = document.getElementById('userDetailModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // 更新用户详情称号
    updateUserDetailTitles(user) {
        const titlesList = document.getElementById('userDetailTitlesList');
        if (!titlesList) return;

        if (!user.titles || user.titles.length === 0) {
            titlesList.innerHTML = '<div class="no-titles">暂无称号</div>';
            return;
        }

        const html = user.titles.map(title => `
            <div class="title-item" style="color: ${title.color};">
                <span class="title-icon">${title.icon}</span>
                <span class="title-name">${title.name}</span>
            </div>
        `).join('');

        titlesList.innerHTML = html;
    }

    // 绑定多维度排行榜事件
    bindMultiLeaderboardEvents() {
        // 主排行榜标签页
        const leaderboardTabs = document.querySelectorAll('.leaderboard-tab');
        leaderboardTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabType = tab.getAttribute('data-tab');
                this.switchLeaderboardTab(tabType);
            });
        });

        // 增长排行榜子标签页
        const growthTabs = document.querySelectorAll('.growth-tab');
        growthTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const growthType = tab.getAttribute('data-growth');
                this.switchGrowthTab(growthType);
            });
        });
    }

    // 切换排行榜标签页
    switchLeaderboardTab(tabType) {
        // 更新标签页状态
        const tabs = document.querySelectorAll('.leaderboard-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        
        const activeTab = document.querySelector(`[data-tab="${tabType}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // 隐藏所有排行榜内容
        const leaderboards = ['podiumContainer', 'leaderboardList', 'growthLeaderboard', 'activityLeaderboard', 'achievementLeaderboard'];
        leaderboards.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'none';
        });

        // 显示对应的排行榜内容
        switch (tabType) {
            case 'main':
                const podiumContainer = document.getElementById('podiumContainer');
                const leaderboardList = document.getElementById('leaderboardList');
                if (podiumContainer) podiumContainer.style.display = 'flex';
                if (leaderboardList) leaderboardList.style.display = 'block';
                break;
            case 'growth':
                const growthLeaderboard = document.getElementById('growthLeaderboard');
                if (growthLeaderboard) growthLeaderboard.style.display = 'block';
                // 默认显示日增长
                this.switchGrowthTab('daily');
                break;
            case 'activity':
                const activityLeaderboard = document.getElementById('activityLeaderboard');
                if (activityLeaderboard) activityLeaderboard.style.display = 'block';
                // 加载活跃度排行榜数据
                this.loadActivityLeaderboard();
                break;
            case 'achievement':
                const achievementLeaderboard = document.getElementById('achievementLeaderboard');
                if (achievementLeaderboard) achievementLeaderboard.style.display = 'block';
                // 加载成就排行榜数据
                this.loadAchievementLeaderboard();
                break;
        }
    }

    // 切换增长排行榜子标签页
    switchGrowthTab(growthType) {
        // 更新子标签页状态
        const tabs = document.querySelectorAll('.growth-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        
        const activeTab = document.querySelector(`[data-growth="${growthType}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // 加载对应的增长排行榜数据
        this.loadGrowthLeaderboard(growthType);
    }

    // 加载增长排行榜
    async loadGrowthLeaderboard(growthType) {
        try {
            const userData = await this.getAllLeaderboardUsers();
            if (!userData || userData.length === 0) {
                this.updateGrowthLeaderboard([]);
                return;
            }

            // 计算增长数据
            const growthData = userData.map(user => {
                let growthValue = 0;
                switch (growthType) {
                    case 'daily':
                        growthValue = this.calculateDailyGrowth(user.coinRecords);
                        break;
                    case 'weekly':
                        growthValue = this.calculateWeeklyGrowth(user.coinRecords);
                        break;
                    case 'monthly':
                        growthValue = this.calculateMonthlyGrowth(user.coinRecords);
                        break;
                    case 'total':
                        growthValue = this.calculateTotalGrowth(user.coinRecords);
                        break;
                }
                return {
                    ...user,
                    growthValue: growthValue
                };
            }).filter(user => user.growthValue > 0);

            // 按增长值排序
            growthData.sort((a, b) => b.growthValue - a.growthValue);
            this.updateGrowthLeaderboard(growthData);
        } catch (error) {
            console.error('加载增长排行榜失败:', error);
            this.updateGrowthLeaderboard([]);
        }
    }

    // 计算日增长（最近24小时）
    calculateDailyGrowth(coinRecords) {
        if (!coinRecords || coinRecords.length < 2) return 0;
        
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const recentRecords = coinRecords.filter(record => {
            const recordTime = new Date(record.timestamp || record.date);
            return recordTime >= yesterday;
        });
        
        if (recentRecords.length === 0) return 0;
        
        const sortedRecords = recentRecords.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.date);
            const timeB = new Date(b.timestamp || b.date);
            return timeA - timeB;
        });
        
        return sortedRecords[sortedRecords.length - 1].coins - sortedRecords[0].coins;
    }

    // 计算周增长（最近7天）
    calculateWeeklyGrowth(coinRecords) {
        if (!coinRecords || coinRecords.length < 2) return 0;
        
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const recentRecords = coinRecords.filter(record => {
            const recordTime = new Date(record.timestamp || record.date);
            return recordTime >= weekAgo;
        });
        
        if (recentRecords.length === 0) return 0;
        
        const sortedRecords = recentRecords.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.date);
            const timeB = new Date(b.timestamp || b.date);
            return timeA - timeB;
        });
        
        return sortedRecords[sortedRecords.length - 1].coins - sortedRecords[0].coins;
    }

    // 计算月增长（最近30天）
    calculateMonthlyGrowth(coinRecords) {
        if (!coinRecords || coinRecords.length < 2) return 0;
        
        const now = new Date();
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const recentRecords = coinRecords.filter(record => {
            const recordTime = new Date(record.timestamp || record.date);
            return recordTime >= monthAgo;
        });
        
        if (recentRecords.length === 0) return 0;
        
        const sortedRecords = recentRecords.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.date);
            const timeB = new Date(b.timestamp || b.date);
            return timeA - timeB;
        });
        
        return sortedRecords[sortedRecords.length - 1].coins - sortedRecords[0].coins;
    }

    // 计算总增长（累计增长）
    calculateTotalGrowth(coinRecords) {
        if (!coinRecords || coinRecords.length < 2) return 0;
        
        const sortedRecords = coinRecords.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.date);
            const timeB = new Date(b.timestamp || b.date);
            return timeA - timeB;
        });
        
        return sortedRecords[sortedRecords.length - 1].coins - sortedRecords[0].coins;
    }

    // 更新增长排行榜显示
    updateGrowthLeaderboard(growthData) {
        const growthList = document.getElementById('growthList');
        if (!growthList) return;

        if (!growthData || growthData.length === 0) {
            growthList.innerHTML = '<div class="no-data">暂无增长数据</div>';
            return;
        }

        const html = growthData.map((user, index) => {
            const rank = index + 1;
            return `
                <div class="growth-item" onclick="window.simpleIntegration.showUserDetail(${JSON.stringify(user).replace(/"/g, '&quot;')}, ${rank})">
                    <div class="user-info">
                        <div class="rank">${rank}</div>
                        <div class="username">${this.formatUserDisplay(user)}</div>
                    </div>
                    <div class="growth-value">+${user.growthValue.toLocaleString()}</div>
                </div>
            `;
        }).join('');

        growthList.innerHTML = html;
    }

    // 加载活跃度排行榜
    async loadActivityLeaderboard() {
        try {
            const userData = await this.getAllLeaderboardUsers();
            if (!userData || userData.length === 0) {
                this.updateActivityLeaderboard([]);
                return;
            }

            // 计算活跃度数据
            const activityData = userData.map(user => {
                const streakDays = user.streakData?.currentStreak || 0;
                const totalRecords = user.coinRecords.length;
                const avgFrequency = this.calculateAverageFrequency(user.coinRecords);
                const lastActive = this.calculateLastActiveTime(user);
                
                // 活跃度评分 = 连续天数 * 2 + 总记录数 + 平均频率 * 10
                const activityScore = streakDays * 2 + totalRecords + avgFrequency * 10;
                
                return {
                    ...user,
                    streakDays: streakDays,
                    totalRecords: totalRecords,
                    avgFrequency: avgFrequency,
                    lastActive: lastActive,
                    activityScore: activityScore
                };
            });

            // 按活跃度评分排序
            activityData.sort((a, b) => b.activityScore - a.activityScore);
            this.updateActivityLeaderboard(activityData);
        } catch (error) {
            console.error('加载活跃度排行榜失败:', error);
            this.updateActivityLeaderboard([]);
        }
    }

    // 计算平均记录频率（每天记录数）
    calculateAverageFrequency(coinRecords) {
        if (!coinRecords || coinRecords.length === 0) return 0;
        
        const sortedRecords = coinRecords.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.date);
            const timeB = new Date(b.timestamp || b.date);
            return timeA - timeB;
        });
        
        const firstRecord = new Date(sortedRecords[0].timestamp || sortedRecords[0].date);
        const lastRecord = new Date(sortedRecords[sortedRecords.length - 1].timestamp || sortedRecords[sortedRecords.length - 1].date);
        
        const daysDiff = Math.max(1, (lastRecord - firstRecord) / (1000 * 60 * 60 * 24));
        return coinRecords.length / daysDiff;
    }

    // 更新活跃度排行榜显示
    updateActivityLeaderboard(activityData) {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;

        if (!activityData || activityData.length === 0) {
            activityList.innerHTML = '<div class="no-data">暂无活跃度数据</div>';
            return;
        }

        const html = activityData.map((user, index) => {
            const rank = index + 1;
            return `
                <div class="activity-item" onclick="window.simpleIntegration.showUserDetail(${JSON.stringify(user).replace(/"/g, '&quot;')}, ${rank})">
                    <div class="user-info">
                        <div class="rank">${rank}</div>
                        <div class="username">${this.formatUserDisplay(user)}</div>
                    </div>
                    <div class="activity-value">
                        <div class="activity-stats">
                            <span>${user.streakDays}天</span>
                            <span>${user.totalRecords}条</span>
                            <span>${user.avgFrequency.toFixed(1)}/天</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        activityList.innerHTML = html;
    }

    // 加载成就排行榜
    async loadAchievementLeaderboard() {
        try {
            const userData = await this.getAllLeaderboardUsers();
            if (!userData || userData.length === 0) {
                this.updateAchievementLeaderboard([]);
                return;
            }

            // 计算成就数据
            const achievementData = userData.map(user => {
                const achievementCount = user.achievementCount || 0;
                const achievementPoints = this.calculateAchievementPoints(user.achievements);
                
                return {
                    ...user,
                    achievementCount: achievementCount,
                    achievementPoints: achievementPoints
                };
            });

            // 按成就点数排序
            achievementData.sort((a, b) => b.achievementPoints - a.achievementPoints);
            this.updateAchievementLeaderboard(achievementData);
        } catch (error) {
            console.error('加载成就排行榜失败:', error);
            this.updateAchievementLeaderboard([]);
        }
    }

    // 计算成就点数
    calculateAchievementPoints(achievements) {
        if (!achievements) return 0;
        
        const achievementWeights = {
            'first_record': 10,
            'week_streak': 20,
            'month_streak': 50,
            'hundred_days': 100,
            'thousand_coins': 30,
            'ten_thousand': 60,
            'twenty_thousand': 80,
            'thirty_thousand': 100,
            'forty_thousand': 120,
            'fifty_thousand': 150
        };
        
        let totalPoints = 0;
        Object.keys(achievements).forEach(key => {
            if (achievements[key].unlocked) {
                totalPoints += achievementWeights[key] || 10;
            }
        });
        
        return totalPoints;
    }

    // 更新成就排行榜显示
    updateAchievementLeaderboard(achievementData) {
        const achievementList = document.getElementById('achievementList');
        if (!achievementList) return;

        if (!achievementData || achievementData.length === 0) {
            achievementList.innerHTML = '<div class="no-data">暂无成就数据</div>';
            return;
        }

        const html = achievementData.map((user, index) => {
            const rank = index + 1;
            return `
                <div class="achievement-item" onclick="window.simpleIntegration.showUserDetail(${JSON.stringify(user).replace(/"/g, '&quot;')}, ${rank})">
                    <div class="user-info">
                        <div class="rank">${rank}</div>
                        <div class="username">${this.formatUserDisplay(user)}</div>
                    </div>
                    <div class="achievement-value">
                        <div class="achievement-stats">
                            <span>${user.achievementCount}个</span>
                            <span>${user.achievementPoints}分</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        achievementList.innerHTML = html;
    }

    // 设置用户详情模态框事件
    setupUserDetailModalEvents() {
        const modal = document.getElementById('userDetailModal');
        const closeBtn = document.getElementById('closeUserDetailBtn');
        const closeIcon = modal?.querySelector('.user-detail-modal-close');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideUserDetailModal());
        }

        if (closeIcon) {
            closeIcon.addEventListener('click', () => this.hideUserDetailModal());
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.classList.contains('user-detail-modal-backdrop')) {
                    this.hideUserDetailModal();
                }
            });
        }
    }
}

// 创建全局实例
export const simpleIntegration = new SimpleIntegration();
export default simpleIntegration;
