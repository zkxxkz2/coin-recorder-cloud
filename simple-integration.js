// 简单集成服务
import { authService } from './simple-auth.js';
import { syncService } from './jsonbin-sync.js';

class SimpleIntegration {
    constructor() {
        this.isInitialized = false;
        this.currentUser = null;
        // 排行榜数据缓存
        this.leaderboardDataCache = {
            users: null,
            lastUpdate: null,
            cacheTimeout: 5 * 60 * 1000, // 5分钟缓存
            isRefreshing: false
        };
        // 防止重复执行的标志
        this.isLoadingBanner = false;
        this.isGettingAllUsers = false;
        this.isSyncingFromCloud = false;
        this.isSyncingToCloud = false;
        this.isRefreshingLeaderboard = false;
        this.isJoiningLeaderboard = false;
        // 不在这里调用 init()，等待外部调用
    }

    // 初始化简单集成
    async init() {
        console.log('SimpleIntegration 开始初始化...');
        
        // 先确保同步服务初始化完成
        await this.waitForSyncService();
        
        // 等待认证服务初始化完成
        await authService.init();
        
        // 尝试加载已保存的用户信息
        await authService.loadSavedUser();
        
        // 设置认证服务到同步服务
        syncService.setAuthService(authService);
        
        // 初始化排行榜设置 - 确保所有用户都能访问排行榜数据
        this.initLeaderboardSettings();
        
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
        
        // 初始化完成后更新UI状态
        this.updateUI(this.currentUser);
        
        console.log('SimpleIntegration 初始化完成');
    }

    // 初始化排行榜设置
    initLeaderboardSettings() {
        // 设置默认的公开排行榜Bin ID，确保所有用户都能访问排行榜数据
        const defaultPublicLeaderboardBinId = '68eb2e76d0ea881f409e7470';
        
        // 如果localStorage中没有publicLeaderboardBinId，设置默认值
        if (!localStorage.getItem('publicLeaderboardBinId')) {
            localStorage.setItem('publicLeaderboardBinId', defaultPublicLeaderboardBinId);
            console.log('设置默认公开排行榜Bin ID:', defaultPublicLeaderboardBinId);
        }
        
        // 确保排行榜横幅始终显示
        this.showLeaderboardBanner();
        
        // 用户登录时只显示横幅，不自动加载数据
        if (this.currentUser) {
            this.showLeaderboardBanner();
        } else {
            // 未登录时显示空白状态
            this.showEmptyLeaderboard();
        }
    }

    // 等待同步服务初始化完成
    async waitForSyncService() {
        console.log('等待同步服务初始化...');

        let attempts = 0;
        while (!syncService || !syncService.isInitialized && attempts < 100) {
            console.log(`检查同步服务状态... 尝试 ${attempts + 1}/100, isInitialized: ${syncService?.isInitialized || 'syncService未定义'}`);
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!syncService) {
            console.error('syncService 未定义');
            throw new Error('同步服务不可用');
        }

        if (!syncService.isInitialized) {
            console.error('同步服务初始化超时');
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
        console.log('登录按钮样式:', loginBtn ? loginBtn.style.display : 'null');
        console.log('登录按钮是否可见:', loginBtn ? loginBtn.offsetParent !== null : 'null');
        
        if (loginBtn) {
            // 确保按钮可见
            if (loginBtn.style.display === 'none') {
                console.log('登录按钮被隐藏，设置为可见');
                loginBtn.style.display = 'flex';
            }
            
            // 移除之前的事件监听器（如果有的话）
            const newLoginBtn = loginBtn.cloneNode(true);
            loginBtn.parentNode.replaceChild(newLoginBtn, loginBtn);
            
            // 重新绑定事件
            newLoginBtn.addEventListener('click', (e) => {
                console.log('登录按钮被点击', e);
                e.preventDefault();
                e.stopPropagation();
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
        const showBinIdBtn = document.getElementById('showBinIdBtn');
        
        if (syncFromCloudBtn) {
            syncFromCloudBtn.addEventListener('click', () => this.syncFromCloud());
        }
        if (syncToCloudBtn) {
            syncToCloudBtn.addEventListener('click', () => this.syncToCloud());
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

    // 显示认证模态框（拆分为登录/注册两个独立弹窗）
    showAuthModal(tab = 'login') {
        console.log('显示认证模态框:', tab);
        const loginModal = document.getElementById('authModal');
        const registerModal = document.getElementById('registerModal');
        
        if (tab === 'register') {
            if (registerModal) {
                registerModal.style.display = 'flex';
                setTimeout(() => registerModal.classList.add('show'), 10);
            } else {
                console.error('未找到注册模态框');
            }
        } else {
            if (loginModal) {
                loginModal.style.display = 'flex';
                setTimeout(() => loginModal.classList.add('show'), 10);
            } else {
                console.error('未找到登录模态框');
            }
        }
    }

    // 隐藏认证模态框（同时尝试关闭两个）
    hideAuthModal() {
        const loginModal = document.getElementById('authModal');
        const registerModal = document.getElementById('registerModal');
        
        if (loginModal) {
            loginModal.classList.remove('show');
            setTimeout(() => { loginModal.style.display = 'none'; }, 300);
        }
        if (registerModal) {
            registerModal.classList.remove('show');
            setTimeout(() => { registerModal.style.display = 'none'; }, 300);
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

        // 显示对应的section
        const sections = ['loginSection', 'registerSection'];
        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.style.display = 'none';
                section.classList.remove('active');
            }
        });

        const activeSection = document.getElementById(`${tab}Section`);
        if (activeSection) {
            activeSection.style.display = 'block';
            activeSection.classList.add('active');
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

        // 显示登录进度提示
        this.showMessage('正在验证账户ID...', 'info');
        
        try {
            const result = await authService.login(usernameOrBinId);
            
            if (result.success) {
                this.showMessage('登录成功，正在加载数据...', 'info');
                this.hideAuthModal();
                this.showMessage(result.message, 'success');
            } else {
                this.showMessage(result.error || result.message, 'error');
            }
        } catch (error) {
            console.error('登录过程出错:', error);
            this.showMessage('登录失败，请稍后重试', 'error');
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

        // 显示注册进度提示
        this.showMessage('正在创建账户...', 'info');
        
        try {
            const result = await authService.register(username);
            
            if (result.success) {
                this.showMessage('账户创建成功，正在生成账户ID...', 'info');
                this.hideAuthModal();
                // 显示账户ID模态框
                this.showBinIdModal(result.binId);
            } else {
                this.showMessage(result.error || result.message, 'error');
            }
        } catch (error) {
            console.error('注册过程出错:', error);
            this.showMessage('注册失败，请稍后重试', 'error');
        }
    }

    // 处理用户登录
    async handleUserLogin(user) {
        console.log('用户登录:', user.username);
        
        // 登录后自动同步未登录时的记录到云端
        await this.syncPendingRecords();
        
        // 登录后检查用户是否已加入排行榜
        await this.checkAndLoadLeaderboard(user);
    }

    // 同步未登录时的记录到云端
    async syncPendingRecords() {
        try {
            // 检查是否有本地数据需要同步
            const localData = localStorage.getItem('coinTrackerData');
            if (localData && JSON.parse(localData).length > 0) {
                this.showMessage('正在同步本地记录到云端...', 'info');
                
                // 同步到云端
                const result = await syncService.syncToCloud();
                if (result.success) {
                    this.showMessage('本地记录已同步到云端', 'success');
                } else {
                    console.warn('云端同步失败:', result.message);
                    this.showMessage('云端同步失败，请稍后手动同步', 'warning');
                }
            }
        } catch (error) {
            console.error('同步本地记录失败:', error);
            this.showMessage('同步本地记录失败', 'error');
        }
    }

    // 检查用户是否已加入排行榜并加载相应内容
    async checkAndLoadLeaderboard(user) {
        try {
            // 检查本地存储中是否有加入记录
            const isJoinedLocally = localStorage.getItem('joinedPublicLeaderboard') === 'true';
            const publicLeaderboardBinId = localStorage.getItem('publicLeaderboardBinId') || '68eb2e76d0ea881f409e7470';
            
            if (isJoinedLocally) {
                // 本地记录显示已加入，验证云端数据
                const isJoinedInCloud = await this.verifyUserInLeaderboard(user, publicLeaderboardBinId);
                
                if (isJoinedInCloud) {
                    // 云端确认已加入，显示横幅并加载排行榜数据
                    console.log('用户已加入排行榜，显示排行榜内容');
                    this.showLeaderboardBanner();
                    await this.loadLeaderboardBanner();
                } else {
                    // 云端未找到，清除本地记录并显示空白状态
                    console.log('云端未找到用户，清除本地记录');
                    localStorage.removeItem('joinedPublicLeaderboard');
                    localStorage.removeItem('publicLeaderboardBinId');
                    this.showLeaderboardBanner();
                    this.showEmptyLeaderboard();
                }
            } else {
                // 本地记录显示未加入，显示空白状态（不加载排行榜数据）
                console.log('用户未加入排行榜，显示空白状态');
                this.showLeaderboardBanner();
                this.showEmptyLeaderboard();
            }
        } catch (error) {
            console.error('检查排行榜状态失败:', error);
            // 出错时显示排行榜横幅和空白状态
            this.showLeaderboardBanner();
            this.showEmptyLeaderboard();
        }
    }

    // 验证用户是否在云端排行榜中
    async verifyUserInLeaderboard(user, publicLeaderboardBinId) {
        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${publicLeaderboardBinId}/latest`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': window.jsonbinConfig.apiKey
                }
            });

            if (!response.ok) {
                return false;
            }

            const result = await response.json();
            const leaderboardData = result.record;

            if (!leaderboardData.participants) {
                return false;
            }

            // 检查用户是否在参与者列表中
            const userBinId = localStorage.getItem('coinTrackerBinId');
            return leaderboardData.participants.some(participant => 
                participant.binId === userBinId && participant.isActive
            );
        } catch (error) {
            console.error('验证用户排行榜状态失败:', error);
            return false;
        }
    }

    // 处理用户登出
    handleUserLogout() {
        console.log('用户登出');
        // 清理云端同步状态
        syncService.clearPendingChanges();
        
        // 隐藏排行榜数据，显示空白状态
        this.showLeaderboardBanner();
        this.showEmptyLeaderboard();
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
        // 防止重复执行
        if (this.isSyncingFromCloud) {
            console.log('正在从云端下载数据，跳过重复调用');
            return;
        }

        // 显示强提醒确认对话框
        const confirmed = await this.showConfirmDialog(
            '⚠️ 重要提醒',
            '从云端下载数据将完全覆盖本地数据！\n\n' +
            '• 本地的所有金币记录将被云端数据替换\n' +
            '• 成就、连续记录等数据也会被覆盖\n' +
            '• 此操作不可撤销\n\n' +
            '确定要继续吗？',
            '取消',
            '确定下载'
        );

        if (!confirmed) {
            return;
        }

        this.isSyncingFromCloud = true;

        const syncFromCloudBtn = document.getElementById('syncFromCloudBtn');
        if (syncFromCloudBtn) {
            syncFromCloudBtn.style.opacity = '0.5';
            syncFromCloudBtn.style.pointerEvents = 'none';
        }

        try {
            // 显示下载进度提示
            this.showMessage('正在从云端下载数据...', 'info');
            
            const result = await syncService.syncFromCloud();
            
            if (result.success) {
                this.showMessage('正在更新本地数据...', 'info');
                
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
                    window.coinTracker.checkAchievements(); // 检查并激活成就
                    window.coinTracker.updateStreakDisplay();
                    window.coinTracker.updateChallengeDisplay();
                    window.coinTracker.updateCharts();
                }
                
                this.showMessage('从云端下载成功', 'success');
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('云端下载失败:', error);
            this.showMessage('云端下载失败，请稍后重试', 'error');
        } finally {
            if (syncFromCloudBtn) {
                syncFromCloudBtn.style.opacity = '1';
                syncFromCloudBtn.style.pointerEvents = 'auto';
            }
            // 确保标志被重置
            this.isSyncingFromCloud = false;
        }
    }

    // 同步到云端
    async syncToCloud() {
        // 防止重复执行
        if (this.isSyncingToCloud) {
            console.log('正在上传数据到云端，跳过重复调用');
            return;
        }

        this.isSyncingToCloud = true;

        const syncToCloudBtn = document.getElementById('syncToCloudBtn');
        if (syncToCloudBtn) {
            syncToCloudBtn.style.opacity = '0.5';
            syncToCloudBtn.style.pointerEvents = 'none';
        }

        try {
            // 显示上传进度提示
            this.showMessage('正在上传数据到云端...', 'info');
            
            const result = await syncService.syncToCloud();
            
            if (result.success) {
                // 更新最后同步时间
                localStorage.setItem('lastCloudSync', Date.now().toString());
                this.showMessage('数据上传成功', 'success');
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('云端上传失败:', error);
            this.showMessage('云端上传失败，请稍后重试', 'error');
        } finally {
            if (syncToCloudBtn) {
                syncToCloudBtn.style.opacity = '1';
                syncToCloudBtn.style.pointerEvents = 'auto';
            }
            // 确保标志被重置
            this.isSyncingToCloud = false;
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
            if (loginBtn) {
                loginBtn.style.display = 'flex';
                loginBtn.style.opacity = '1';
                loginBtn.title = '切换账户';
                // 更新按钮文案为“切换账户”，保留图标
                const spans = loginBtn.querySelectorAll('span');
                if (spans && spans.length >= 2) {
                    spans[1].textContent = '切换账户';
                }
            }
            if (userEmail) userEmail.textContent = user.username;
        } else {
            // 用户未登录
            if (userStatus) userStatus.style.display = 'none';
            if (loginBtn) {
                loginBtn.style.display = 'flex';
                loginBtn.style.opacity = '1';
                loginBtn.title = '登录';
                const spans = loginBtn.querySelectorAll('span');
                if (spans && spans.length >= 2) {
                    spans[1].textContent = '登录/注册';
                }
            }
        }
    }

    // 显示消息（垂直堆叠）
    showMessage(message, type, duration = 3000) {
        let container = document.querySelector('.message-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'message-container';
            document.body.appendChild(container);
        }

        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;
        container.appendChild(messageEl);

        // 显示动画
        setTimeout(() => {
            messageEl.classList.add('show');
        }, 10);

        // 自动隐藏并清理
        setTimeout(() => {
            messageEl.classList.remove('show');
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
                if (container && container.children.length === 0) {
                    container.remove();
                }
            }, 300);
        }, duration);
    }

    // 显示持久化消息（用于长时间操作）
    showPersistentMessage(message, type) {
        // 清除之前的持久化消息
        this.hidePersistentMessage();

        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.id = 'persistentMessage';
        messageEl.className = `message ${type} persistent`;
        messageEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div class="loading-spinner" style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <span>${message}</span>
                <button class="close-persistent-btn" style="
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 4px;
                    margin-left: 8px;
                    border-radius: 4px;
                    font-size: 16px;
                    line-height: 1;
                    opacity: 0.8;
                    transition: opacity 0.2s;
                " title="关闭">×</button>
            </div>
        `;

        // 添加样式
        Object.assign(messageEl.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '600',
            zIndex: '10001',
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

        // 添加旋转动画样式
        if (!document.getElementById('loadingSpinnerStyle')) {
            const style = document.createElement('style');
            style.id = 'loadingSpinnerStyle';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(messageEl);

        // 显示动画
        setTimeout(() => {
            messageEl.style.transform = 'translateX(0)';
        }, 100);

        // 添加关闭按钮事件
        const closeBtn = messageEl.querySelector('.close-persistent-btn');
        if (closeBtn) {
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.opacity = '1';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.opacity = '0.8';
            });
            closeBtn.addEventListener('click', () => {
                this.hidePersistentMessage();
            });
        }
    }

    // 隐藏持久化消息
    hidePersistentMessage() {
        const messageEl = document.getElementById('persistentMessage');
        if (messageEl) {
            messageEl.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    document.body.removeChild(messageEl);
                }
            }, 300);
        }
    }

    // 显示确认对话框
    showConfirmDialog(title, message, cancelText = '取消', confirmText = '确定') {
        return new Promise((resolve) => {
            // 创建模态框
            const modal = document.createElement('div');
            modal.className = 'confirm-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10002;
            `;

            // 创建对话框内容
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: #ffffff;
                border: 2px solid #e74c3c;
                border-radius: 12px;
                padding: 24px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                transform: scale(0.9);
                transition: transform 0.2s ease;
            `;

            dialog.innerHTML = `
                <div style="margin-bottom: 16px;">
                    <h3 style="margin: 0 0 12px 0; color: #e74c3c; font-size: 18px; font-weight: 600;">${title}</h3>
                    <p style="margin: 0; color: #333333; line-height: 1.5; white-space: pre-line;">${message}</p>
                </div>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="cancel-btn" style="
                        padding: 8px 16px;
                        border: 1px solid #cccccc;
                        background: transparent;
                        color: #666666;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">${cancelText}</button>
                    <button class="confirm-btn" style="
                        padding: 8px 16px;
                        border: none;
                        background: #e74c3c;
                        color: white;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                    ">${confirmText}</button>
                </div>
            `;

            modal.appendChild(dialog);
            document.body.appendChild(modal);

            // 显示动画
            setTimeout(() => {
                dialog.style.transform = 'scale(1)';
            }, 10);

            // 绑定事件
            const cancelBtn = dialog.querySelector('.cancel-btn');
            const confirmBtn = dialog.querySelector('.confirm-btn');

            const cleanup = () => {
                dialog.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    if (modal.parentNode) {
                        document.body.removeChild(modal);
                    }
                }, 200);
            };

            cancelBtn.onclick = () => {
                cleanup();
                resolve(false);
            };

            confirmBtn.onclick = () => {
                cleanup();
                resolve(true);
            };

            // 点击背景关闭
            modal.onclick = (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(false);
                }
            };

            // ESC键关闭
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);
        });
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
            refreshBtn.addEventListener('click', () => this.refreshLeaderboardData());
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

    // 检查缓存是否有效
    isLeaderboardCacheValid() {
        if (!this.leaderboardDataCache.users || !this.leaderboardDataCache.lastUpdate) {
            return false;
        }
        return Date.now() - this.leaderboardDataCache.lastUpdate < this.leaderboardDataCache.cacheTimeout;
    }

    // 一次性获取所有排行榜数据
    async loadAllLeaderboardData(forceRefresh = false) {
        // 检查缓存是否有效
        if (!forceRefresh && this.isLeaderboardCacheValid()) {
            console.log('使用缓存的排行榜数据');
            return this.leaderboardDataCache.users;
        }

        // 防止重复请求
        if (this.leaderboardDataCache.isRefreshing) {
            console.log('排行榜数据正在刷新中，等待完成...');
            // 等待刷新完成，最多等待10秒
            let waitTime = 0;
            while (this.leaderboardDataCache.isRefreshing && waitTime < 10000) {
                await new Promise(resolve => setTimeout(resolve, 100));
                waitTime += 100;
            }
            return this.leaderboardDataCache.users || [];
        }

        this.leaderboardDataCache.isRefreshing = true;

        try {
            console.log('开始获取排行榜数据...');
            const users = await this.getAllLeaderboardUsers();
            
            // 只有在成功获取数据后才更新缓存
            if (users && users.length >= 0) {
                this.leaderboardDataCache.users = users;
                this.leaderboardDataCache.lastUpdate = Date.now();
                console.log(`排行榜数据获取完成，共 ${users.length} 个用户`);
            } else {
                console.warn('获取到的排行榜数据为空，保持原有缓存');
            }
            
            this.leaderboardDataCache.isRefreshing = false;
            return this.leaderboardDataCache.users || [];
        } catch (error) {
            console.error('获取排行榜数据失败:', error);
            this.leaderboardDataCache.isRefreshing = false;
            return this.leaderboardDataCache.users || [];
        }
    }

    // 获取所有排行榜用户数据（用于多维度排行榜）
    async getAllLeaderboardUsers() {
        // 防止重复执行
        if (this.isGettingAllUsers) {
            console.log('正在获取所有用户数据，跳过重复调用');
            return [];
        }

        this.isGettingAllUsers = true;

        try {
            const publicLeaderboardBinId = localStorage.getItem('publicLeaderboardBinId');
            if (!publicLeaderboardBinId) {
                console.warn('未找到公开排行榜Bin ID');
                return [];
            }

            console.log('获取排行榜数据，Bin ID:', publicLeaderboardBinId);

            const response = await fetch(`https://api.jsonbin.io/v3/b/${publicLeaderboardBinId}/latest`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': window.jsonbinConfig.apiKey
                }
            });

            if (!response.ok) {
                console.error('获取排行榜数据失败，状态码:', response.status);
                throw new Error(`无法获取排行榜数据: ${response.status}`);
            }

            const result = await response.json();
            const leaderboardData = result.record;

            console.log('排行榜数据结构:', leaderboardData);

            if (!leaderboardData.participants || !Array.isArray(leaderboardData.participants)) {
                console.warn('排行榜数据中没有参与者信息');
                return [];
            }

            console.log(`找到 ${leaderboardData.participants.length} 个参与者`);

            // 获取所有参与者的完整数据（添加请求间隔避免限流）
            const validUsers = [];
            
            // 分批处理，每批最多2个请求，间隔800ms（增加间隔减少并发冲突）
            const batchSize = 2;
            const delay = 800;
            
            // 记录获取开始时间，确保所有数据在同一时间点获取
            const fetchStartTime = Date.now();
            
            // 显示获取数据的进度提示
            this.showPersistentMessage(`正在获取排行榜数据 (0/${leaderboardData.participants.length}) - 0%`, 'info');
            
            for (let i = 0; i < leaderboardData.participants.length; i += batchSize) {
                const batch = leaderboardData.participants.slice(i, i + batchSize);
                
                const batchPromises = batch.map(async (participant) => {
                    try {
                        console.log(`获取用户数据: ${participant.username} (${participant.binId})`);
                        
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
                            
                            if (userData.coinRecords && Array.isArray(userData.coinRecords)) {
                                // 计算当前金币数（最新记录的金币数）
                                const currentCoins = this.calculateCurrentCoins(userData.coinRecords);
                                const achievements = Object.keys(userData.achievements || {}).filter(key => userData.achievements[key].unlocked).length;
                                
                                // 计算等级信息
                                const levelInfo = this.getLevelInfo(currentCoins);
                                
                                // 计算称号
                                const titles = this.getTitles(userData.coinRecords, userData.streakData, userData.achievements);
                                
                                // 计算增长趋势
                                const growthTrend = this.calculateGrowthTrend(userData.coinRecords);
                                
                                console.log(`用户 ${participant.username} 数据获取成功，当前金币: ${currentCoins}`);
                                
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
                                    growthTrend: growthTrend,
                                    fetchTime: fetchStartTime // 添加获取时间戳，确保数据一致性
                                };
                            } else {
                                console.warn(`用户 ${participant.username} 没有金币记录数据`);
                            }
                        } else {
                            console.error(`获取用户 ${participant.username} 数据失败，状态码: ${userResponse.status}`);
                        }
                    } catch (error) {
                        console.error(`获取用户 ${participant.binId} 数据失败:`, error);
                    }
                    return null;
                });

                const batchResults = await Promise.all(batchPromises);
                const batchValidUsers = batchResults.filter(user => user !== null);
                validUsers.push(...batchValidUsers);
                
                // 更新进度提示
                const processedCount = Math.min(i + batchSize, leaderboardData.participants.length);
                const progressPercentage = Math.round((processedCount / leaderboardData.participants.length) * 100);
                this.showPersistentMessage(`正在获取排行榜数据 (${processedCount}/${leaderboardData.participants.length}) - ${progressPercentage}%`, 'info');
                
                // 如果不是最后一批，等待一段时间再继续
                if (i + batchSize < leaderboardData.participants.length) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            
            // 按用户名排序，确保每次获取的数据顺序一致
            validUsers.sort((a, b) => a.username.localeCompare(b.username));
            
            console.log(`成功获取 ${validUsers.length} 个用户的数据`);
            
            // 隐藏持久化消息
            this.hidePersistentMessage();
            
            return validUsers;
        } catch (error) {
            console.error('获取所有排行榜用户失败:', error);
            // 出错时也要隐藏持久化消息
            this.hidePersistentMessage();
            return [];
        } finally {
            // 确保标志被重置
            this.isGettingAllUsers = false;
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
        // 防止重复执行
        if (this.isJoiningLeaderboard) {
            console.log('正在加入排行榜，跳过重复调用');
            return;
        }

        this.isJoiningLeaderboard = true;

        const currentUser = this.authService?.currentUser || JSON.parse(localStorage.getItem('coinTrackerUser') || 'null');
        const currentBinId = this.syncService?.binId || 
                           localStorage.getItem('coinTrackerBinId') ||
                           localStorage.getItem('binId');

        if (!currentUser || !currentBinId) {
            this.showMessage('请先登录', 'error');
            this.isJoiningLeaderboard = false;
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

                // 既然用户已在排行榜中，直接加载排行榜数据并显示
                console.log('用户已在排行榜中，直接加载排行榜数据');
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

            // 更新公开排行榜数据到云端
            console.log('正在同步用户到云端排行榜数据库...');
            const updateResponse = await fetch(`https://api.jsonbin.io/v3/b/${publicLeaderboardBinId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': window.jsonbinConfig.apiKey
                },
                body: JSON.stringify(leaderboardData)
            });

            if (!updateResponse.ok) {
                const errorText = await updateResponse.text();
                console.error('云端同步失败:', updateResponse.status, errorText);
                throw new Error(`加入公开排行榜失败: ${updateResponse.status}`);
            }

            console.log('用户已成功同步到云端排行榜数据库');

            // 保存到本地存储
            localStorage.setItem('joinedPublicLeaderboard', 'true');
            localStorage.setItem('publicLeaderboardBinId', publicLeaderboardBinId);

            this.hideJoinLeaderboardModal();
            this.showMessage('成功加入公开排行榜！', 'success');
            
            // 显示排行榜横幅
            this.showLeaderboardBanner();
            // 加入后不自动加载数据，用户需要手动刷新

        } catch (error) {
            console.error('加入公开排行榜失败:', error);
            this.showMessage('加入失败，请稍后重试', 'error');
        } finally {
            // 确保标志被重置
            this.isJoiningLeaderboard = false;
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
        // 防止重复执行
        if (this.isLoadingBanner) {
            console.log('排行榜横幅正在加载中，跳过重复调用');
            return;
        }

        this.isLoadingBanner = true;

        try {
            // 始终显示排行榜横幅，不管用户是否加入
            const publicLeaderboardBinId = localStorage.getItem('publicLeaderboardBinId') || '68eb2e76d0ea881f409e7470';
            
            console.log('加载排行榜横幅，Bin ID:', publicLeaderboardBinId);

            // 显示加载提示（仅在初始化时显示，避免频繁提示）
            if (!this.leaderboardDataCache.users) {
                this.showPersistentMessage('正在初始化排行榜数据...', 'info');
            }

            // 使用缓存数据加载排行榜横幅
            const users = await this.loadAllLeaderboardData();
            console.log('排行榜横幅获取到用户数据:', users.length);
            
            if (users.length === 0) {
                // 即使没有用户数据也显示排行榜横幅，显示空状态
                console.log('没有用户数据，显示空状态');
                this.showLeaderboardBanner();
                this.showEmptyLeaderboard();
                return;
            }

            // 获取参与者信息
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

            if (leaderboardData.participants && leaderboardData.participants.length > 0) {
                // 分批处理，每批最多2个请求，间隔300ms
                const batchSize = 2;
                const delay = 300;
                
                for (let i = 0; i < leaderboardData.participants.length; i += batchSize) {
                    const batch = leaderboardData.participants.slice(i, i + batchSize);
                    
                    const batchPromises = batch.map(async (participant) => {
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

                    const batchResults = await Promise.all(batchPromises);
                    const batchValidUsers = batchResults.filter(result => result !== null);
                    userData.push(...batchValidUsers);
                    
                    // 进度提示由 getAllLeaderboardUsers 统一管理
                    
                    // 如果不是最后一批，等待一段时间再继续
                    if (i + batchSize < leaderboardData.participants.length) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
                
                totalCoins = userData.reduce((sum, user) => sum + user.currentCoins, 0);
                totalRecords = userData.reduce((sum, user) => sum + user.coinRecords.length, 0);
            } else {
                // 没有参与者数据
                await new Promise(resolve => setTimeout(resolve, 200));
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
            
            // 确保本地存储状态正确
            localStorage.setItem('joinedPublicLeaderboard', 'true');

            // UI更新完成
            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            console.error('加载排行榜横幅失败:', error);
            // 即使出错也显示排行榜横幅，显示空状态
            this.showLeaderboardBanner();
            this.showEmptyLeaderboard();
        } finally {
            // 确保标志被重置
            this.isLoadingBanner = false;
        }
    }

    // 更新横幅排行榜列表
    updateBannerLeaderboard(userData) {
        const bannerLeaderboard = document.getElementById('leaderboardBanner');
        const emptyBanner = document.querySelector('.empty-banner');
        const leaderboardList = document.getElementById('leaderboardList');

        if (!bannerLeaderboard) return;

        if (!userData || userData.length === 0) {
            if (emptyBanner) emptyBanner.style.display = 'block';
            if (leaderboardList) leaderboardList.style.display = 'none';
            return;
        }

        // 隐藏空状态
        if (emptyBanner) emptyBanner.style.display = 'none';

        // 按当前金币数排序
        const sortedUsers = userData.sort((a, b) => b.currentCoins - a.currentCoins);

        // 更新排行榜列表（显示所有用户）
        this.updateLeaderboardList(sortedUsers);

        // 显示列表容器
        if (leaderboardList) leaderboardList.style.display = 'block';
    }


    // 获取排名对应的勋章图标
    getMedalIcon(rank) {
        const medals = {
            1: '🥇',
            2: '🥈',
            3: '🥉'
        };
        return medals[rank] || '';
    }

    // 获取用户头像字符
    getUserAvatar(user) {
        const name = this.formatUserDisplay(user);
        return name.charAt(0).toUpperCase();
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
            const rank = index + 1; // 从第一名开始
            const rankClass = rank <= 3 ? `rank-${rank}` : '';
            const medalIcon = this.getMedalIcon(rank);

            return `
                <div class="leaderboard-item ${rankClass}" onclick="window.simpleIntegration.showUserDetail(${JSON.stringify(user).replace(/"/g, '&quot;')}, ${rank})">
                    <div class="rank rank-${rank}">${rank}</div>
                    ${medalIcon ? `<div class="medal">${medalIcon}</div>` : ''}
                    <div class="user-info">
                        <div class="user-avatar">${this.getUserAvatar(user)}</div>
                        <div class="user-details">
                            <div class="username">${this.formatUserDisplay(user)}</div>
                            <div class="user-stats">
                                <span class="stat-badge">🏆 ${user.achievementCount || 0}成就</span>
                                <span class="stat-badge">🔥 ${user.streakData?.currentStreak || 0}天</span>
                                <span class="stat-badge">⚡ 今日活跃</span>
                            </div>
                        </div>
                    </div>
                    <div class="coins">
                        <span class="coins-value">${user.currentCoins.toLocaleString()}</span>
                        <span class="coins-label">总金币</span>
                    </div>
                </div>
            `;
        }).join('');

        leaderboardList.innerHTML = html;
    }

    // 刷新排行榜数据
    async refreshLeaderboard() {
        try {
            console.log('开始刷新排行榜数据...');
            await this.loadLeaderboardBanner();
            this.showMessage('排行榜数据刷新成功', 'success');
        } catch (error) {
            console.error('刷新排行榜失败:', error);
            this.showMessage('排行榜刷新失败，请稍后重试', 'error');
        }
    }

    // 更新横幅按钮状态
    updateBannerButtons() {
        const joinBtn = document.getElementById('joinPublicLeaderboardBtn');
        const leaveBtn = document.getElementById('leaveLeaderboardBtn');
        const refreshBtn = document.getElementById('refreshBannerBtn');

        const isJoined = localStorage.getItem('joinedPublicLeaderboard') === 'true';

        if (joinBtn) {
            joinBtn.style.display = isJoined ? 'none' : 'block';
        }

        if (leaveBtn) {
            leaveBtn.style.display = isJoined ? 'block' : 'none';
        }

        if (refreshBtn) {
            refreshBtn.style.display = isJoined ? 'block' : 'none';
            // 绑定刷新事件
            refreshBtn.onclick = () => this.refreshLeaderboard();
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

                // 更新公开排行榜数据到云端
                console.log('正在从云端排行榜数据库移除用户...');
                const updateResponse = await fetch(`https://api.jsonbin.io/v3/b/${publicLeaderboardBinId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Master-Key': window.jsonbinConfig.apiKey
                    },
                    body: JSON.stringify(leaderboardData)
                });

                if (!updateResponse.ok) {
                    const errorText = await updateResponse.text();
                    console.error('云端同步失败:', updateResponse.status, errorText);
                    throw new Error(`退出公开排行榜失败: ${updateResponse.status}`);
                }

                console.log('用户已成功从云端排行榜数据库移除');
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

    // 同步用户数据到排行榜（当用户数据更新时调用）
    async syncUserDataToLeaderboard() {
        try {
            const isJoined = localStorage.getItem('joinedPublicLeaderboard') === 'true';
            if (!isJoined) {
                console.log('用户未加入排行榜，跳过数据同步');
                return;
            }

            const publicLeaderboardBinId = localStorage.getItem('publicLeaderboardBinId');
            const currentBinId = this.syncService?.binId || 
                               localStorage.getItem('coinTrackerBinId') ||
                               localStorage.getItem('binId');

            if (!publicLeaderboardBinId || !currentBinId) {
                console.warn('缺少必要的Bin ID，无法同步用户数据到排行榜');
                return;
            }

            console.log('同步用户数据到排行榜...');

            // 获取当前公开排行榜数据
            const response = await fetch(`https://api.jsonbin.io/v3/b/${publicLeaderboardBinId}/latest`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': window.jsonbinConfig.apiKey
                }
            });

            if (!response.ok) {
                console.error('获取排行榜数据失败:', response.status);
                return;
            }

            const result = await response.json();
            const leaderboardData = result.record;

            // 更新用户的最后同步时间
            if (leaderboardData.participants) {
                const userIndex = leaderboardData.participants.findIndex(p => p.binId === currentBinId);
                if (userIndex !== -1) {
                    leaderboardData.participants[userIndex].lastSync = new Date().toISOString();
                    leaderboardData.lastUpdated = new Date().toISOString();

                    // 更新到云端
                    const updateResponse = await fetch(`https://api.jsonbin.io/v3/b/${publicLeaderboardBinId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Master-Key': window.jsonbinConfig.apiKey
                        },
                        body: JSON.stringify(leaderboardData)
                    });

                    if (updateResponse.ok) {
                        console.log('用户数据已同步到排行榜');
                    } else {
                        console.error('同步用户数据到排行榜失败:', updateResponse.status);
                    }
                }
            }
        } catch (error) {
            console.error('同步用户数据到排行榜失败:', error);
        }
    }

    // 计算当前金币数（最新记录的金币数）
    calculateCurrentCoins(coinRecords) {
        if (!coinRecords || coinRecords.length === 0) {
            return 0;
        }

        // 按时间排序，获取最新的记录（确保排序稳定）
        const sortedRecords = [...coinRecords].sort((a, b) => {
            // 优先使用 timestamp，如果没有则使用 date
            const timeA = a.timestamp ? new Date(a.timestamp) : new Date(a.date);
            const timeB = b.timestamp ? new Date(b.timestamp) : new Date(b.date);
            
            // 如果时间相同，按金币数降序排序（确保排序稳定）
            if (timeA.getTime() === timeB.getTime()) {
                return (b.coins || 0) - (a.coins || 0);
            }
            
            return timeB.getTime() - timeA.getTime();
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
        const leaderboards = ['leaderboardList'];
        leaderboards.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'none';
        });

        // 使用缓存数据立即显示
        switch (tabType) {
            case 'main':
                this.updateMainLeaderboard();
                break;
            case 'growth':
                this.updateGrowthLeaderboard();
                break;
            case 'activity':
                this.updateActivityLeaderboard();
                break;
            case 'achievement':
                this.updateAchievementLeaderboard();
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

        // 使用缓存数据更新增长排行榜
        this.updateGrowthLeaderboard(growthType);
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

    // 更新主排行榜（使用缓存数据）
    updateMainLeaderboard() {
        const users = this.leaderboardDataCache.users || [];
        if (users.length === 0) {
            this.showEmptyLeaderboard();
            return;
        }

        // 按当前金币数排序
        const sortedUsers = users.sort((a, b) => b.currentCoins - a.currentCoins);
        
        // 更新排行榜列表（显示所有用户）
        this.updateLeaderboardList(sortedUsers);

        // 显示主排行榜
        const leaderboardList = document.getElementById('leaderboardList');
        if (leaderboardList) leaderboardList.style.display = 'block';
    }

    // 更新增长排行榜（使用缓存数据）
    updateGrowthLeaderboard(growthType = 'daily') {
        const users = this.leaderboardDataCache.users || [];
        if (users.length === 0) {
            this.showEmptyGrowthLeaderboard();
            return;
        }

        // 计算增长数据
        const growthData = users.map(user => {
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
            return { ...user, growthValue };
        }).filter(user => user.growthValue > 0);

        // 按增长值排序
        growthData.sort((a, b) => b.growthValue - a.growthValue);
        
        // 更新显示
        this.updateGrowthLeaderboardDisplay(growthData);

    }

    // 更新活跃度排行榜（使用缓存数据）
    updateActivityLeaderboard() {
        const users = this.leaderboardDataCache.users || [];
        if (users.length === 0) {
            this.showEmptyActivityLeaderboard();
            return;
        }

        // 计算活跃度数据
        const activityData = users.map(user => {
            const streakData = user.streakData || {};
            
            return {
                ...user,
                currentStreak: streakData.currentStreak || 0,
                totalRecords: user.coinRecords?.length || 0
            };
        });

        // 按连续记录天数排序
        activityData.sort((a, b) => b.currentStreak - a.currentStreak);
        
        // 更新显示
        this.updateActivityLeaderboardDisplay(activityData);
    }

    // 更新成就排行榜（使用缓存数据）
    updateAchievementLeaderboard() {
        const users = this.leaderboardDataCache.users || [];
        if (users.length === 0) {
            this.showEmptyAchievementLeaderboard();
            return;
        }

        // 计算成就数据
        const achievementData = users.map(user => {
            const achievementPoints = this.calculateAchievementPoints(user.achievements);
            return { ...user, achievementPoints };
        });

        // 按成就点数排序
        achievementData.sort((a, b) => b.achievementPoints - a.achievementPoints);
        
        // 更新显示
        this.updateAchievementLeaderboardDisplay(achievementData);
    }

    // 显示空排行榜状态
    showEmptyLeaderboard() {
        const emptyBanner = document.querySelector('.empty-banner');
        if (emptyBanner) emptyBanner.style.display = 'block';
        
        // 更新按钮状态为未加入状态
        this.updateBannerButtons();
    }

    showEmptyGrowthLeaderboard() {
        const growthList = document.getElementById('growthList');
        if (growthList) {
            growthList.innerHTML = '<div class="no-data">暂无增长数据</div>';
        }
    }

    showEmptyActivityLeaderboard() {
        const activityList = document.getElementById('activityList');
        if (activityList) {
            activityList.innerHTML = '<div class="no-data">暂无活跃度数据</div>';
        }
    }

    showEmptyAchievementLeaderboard() {
        const achievementList = document.getElementById('achievementList');
        if (achievementList) {
            achievementList.innerHTML = '<div class="no-data">暂无成就数据</div>';
        }
    }

    // 更新增长排行榜显示
    updateGrowthLeaderboardDisplay(growthData) {
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

    // 更新活跃度排行榜显示
    updateActivityLeaderboardDisplay(activityData) {
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
                    <div class="activity-stats">
                        <span>${user.totalRecords}条记录</span>
                    </div>
                    <div class="activity-value">${user.currentStreak}天</div>
                </div>
            `;
        }).join('');

        activityList.innerHTML = html;
    }

    // 更新成就排行榜显示
    updateAchievementLeaderboardDisplay(achievementData) {
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
                    <div class="achievement-stats">
                        <span>${user.achievementCount}个成就</span>
                    </div>
                    <div class="achievement-value">${user.achievementPoints}</div>
                </div>
            `;
        }).join('');

        achievementList.innerHTML = html;
    }

    // 刷新排行榜数据
    async refreshLeaderboardData() {
        // 防止重复执行
        if (this.isRefreshingLeaderboard) {
            console.log('正在刷新排行榜数据，跳过重复调用');
            return;
        }

        this.isRefreshingLeaderboard = true;

        try {
            console.log('用户手动刷新排行榜数据');
            
            // 检查用户是否已加入排行榜
            const isJoinedLocally = localStorage.getItem('joinedPublicLeaderboard') === 'true';
            if (!isJoinedLocally) {
                this.showMessage('请先加入排行榜', 'warning');
                return;
            }
            
            // 显示持久化加载提示
            this.showPersistentMessage('正在刷新排行榜数据，请稍候...', 'info');
            
            // 保存当前显示的标签页
            const activeTab = document.querySelector('.leaderboard-tab.active');
            const currentTabType = activeTab ? activeTab.getAttribute('data-tab') : 'main';
            
            // 清除缓存并强制刷新
            this.leaderboardDataCache.users = null;
            this.leaderboardDataCache.lastUpdate = null;
            this.leaderboardDataCache.isRefreshing = false;
            
            // 更新进度提示 - 获取排行榜结构
            this.showPersistentMessage('正在获取排行榜参与者信息...', 'info');
            
            const users = await this.loadAllLeaderboardData(true); // 强制刷新
            console.log('排行榜数据刷新完成，获取到用户数:', users.length);
            
            // 更新进度提示 - 更新显示
            this.showPersistentMessage('正在更新排行榜界面...', 'info');

            // 只更新横幅显示，不自动加载数据
            this.showLeaderboardBanner();

            // 等待一小段时间确保UI更新完成
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 更新当前显示的排行榜
            this.switchLeaderboardTab(currentTabType);
            
            // 隐藏持久化消息并显示成功消息
            this.hidePersistentMessage();
            this.showMessage(`排行榜刷新完成，共 ${users.length} 位参与者`, 'success', 5000);
        } catch (error) {
            console.error('刷新排行榜数据失败:', error);
            this.hidePersistentMessage();
            this.showMessage('排行榜刷新失败', 'error', 5000);
        } finally {
            // 确保标志被重置
            this.isRefreshingLeaderboard = false;
        }
    }
}

// 创建全局实例
export const simpleIntegration = new SimpleIntegration();
export default simpleIntegration;

