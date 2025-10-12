// 简单的认证服务
import { SimpleCrypto, jsonbinConfig } from './jsonbin-config.js';
import { syncService } from './jsonbin-sync.js';

class SimpleAuthService {
    constructor() {
        this.currentUser = null;
        this.authStateListeners = [];
        this.isInitialized = false;
        this.syncService = syncService; // 直接引用导入的 syncService
        // 不在这里调用 init()，等待外部调用
    }

    // 初始化认证服务
    async init() {
        console.log('SimpleAuthService 开始初始化...');
        // 检查是否有保存的用户信息
        await this.loadSavedUser();
        this.isInitialized = true;
        console.log('SimpleAuthService 初始化完成');
    }

    // 加载保存的用户信息
    async loadSavedUser() {
        try {
            // 首先尝试从本地存储加载
            const savedUser = localStorage.getItem('coinTrackerUser');
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
                this.notifyAuthStateChange(this.currentUser);
                return;
            }

            // 如果本地没有，尝试从云端加载用户列表
            await this.loadUsersFromCloud();
        } catch (error) {
            console.error('加载用户信息失败:', error);
            localStorage.removeItem('coinTrackerUser');
        }
    }

    // 从云端加载用户列表
    async loadUsersFromCloud() {
        try {
            const result = await syncService.readBin();
            if (result.success && result.data && result.data.users) {
                // 检查是否有保存的用户ID
                const savedUserId = localStorage.getItem('coinTrackerUserId');
                if (savedUserId) {
                    const user = result.data.users.find(u => u.id === savedUserId);
                    if (user) {
                        this.currentUser = user;
                        this.notifyAuthStateChange(user);
                    }
                }
            }
        } catch (error) {
            console.error('从云端加载用户失败:', error);
        }
    }

    // 保存用户信息
    async saveUser(user) {
        try {
            localStorage.setItem('coinTrackerUser', JSON.stringify(user));
            localStorage.setItem('coinTrackerUserId', user.id);
            
            // 注意：云端保存由 createUserBin 或专门的更新方法处理
        } catch (error) {
            console.error('保存用户信息失败:', error);
        }
    }

    // 保存用户到云端
    async saveUserToCloud(user) {
        try {
            // 确保同步服务已初始化
            if (!syncService.authService) {
                console.log('同步服务尚未初始化，等待...');
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // 首先尝试找到包含用户数据的 bin
            const binIds = await this.getAllPossibleBinIds();
            let targetBinId = null;
            let existingData = null;
            
            // 查找包含用户数据的 bin
            for (const binId of binIds) {
                const result = await this.readBinById(binId);
                if (result.success && result.data && result.data.users) {
                    const existingUser = result.data.users.find(u => u.id === user.id);
                    if (existingUser) {
                        targetBinId = binId;
                        existingData = result.data;
                        console.log(`找到用户数据在 bin: ${binId}`);
                        break;
                    }
                }
            }
            
            // 如果没有找到包含用户数据的 bin，使用当前 binId 或创建新的
            if (!targetBinId) {
                targetBinId = syncService.binId || localStorage.getItem('coinTrackerBinId');
                if (targetBinId) {
                    const result = await this.readBinById(targetBinId);
                    if (result.success) {
                        existingData = result.data;
                    }
                }
            }
            
            // 如果没有现有数据，创建新的 bin
            if (!existingData) {
                console.log('没有找到现有的 bin，创建新的 bin 用于用户数据');
                const data = {
                    users: [user],
                    coinRecords: [],
                    streakData: { currentStreak: 0, longestStreak: 0, lastRecordDate: null },
                    achievements: {},
                    challengeData: { currentChallenge: null, completedChallenges: [] },
                    lastSync: new Date().toISOString()
                };
                
                const result = await syncService.createBin(data);
                if (result.success) {
                    console.log('用户数据 bin 创建成功:', result.binId);
                    // 保存 binId
                    localStorage.setItem('coinTrackerBinId', result.binId);
                    syncService.binId = result.binId;
                    return;
                } else {
                    console.error('创建用户数据 bin 失败:', result.error);
                    return;
                }
            }
            
            // 更新现有数据
            if (!existingData.users) {
                existingData.users = [];
            }
            
            // 查找并更新用户，或添加新用户
            const existingUserIndex = existingData.users.findIndex(u => u.id === user.id);
            if (existingUserIndex >= 0) {
                existingData.users[existingUserIndex] = user;
            } else {
                existingData.users.push(user);
            }
            
            // 保存到云端
            await this.updateBinById(targetBinId, existingData);
            console.log('用户数据保存到云端成功');
            
            // 确保 binId 正确保存
            localStorage.setItem('coinTrackerBinId', targetBinId);
            syncService.binId = targetBinId;
        } catch (error) {
            console.error('保存用户到云端失败:', error);
        }
    }

    // 根据 binId 更新数据
    async updateBinById(binId, data) {
        try {
            const response = await fetch(`${jsonbinConfig.baseUrl}/b/${binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': jsonbinConfig.apiKey
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('更新bin失败:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const result = await response.json();
            return {
                success: true,
                data: result.record,
                message: '数据更新成功'
            };
        } catch (error) {
            console.error('更新 bin 失败:', error);
            return {
                success: false,
                error: error.message,
                message: '更新云端数据失败'
            };
        }
    }

    // 注册用户
    async register(username, password, email = '') {
        try {
            // 验证输入
            if (!username || !password) {
                return {
                    success: false,
                    error: '用户名和密码不能为空',
                    message: '注册失败'
                };
            }

            if (username.length < 3) {
                return {
                    success: false,
                    error: '用户名至少3个字符',
                    message: '注册失败'
                };
            }

            if (password.length < 6) {
                return {
                    success: false,
                    error: '密码至少6个字符',
                    message: '注册失败'
                };
            }

            // 检查用户名是否已存在（从云端检查）
            const existingUser = await this.getUserByUsernameFromCloud(username);
            if (existingUser) {
                return {
                    success: false,
                    error: '用户名已存在',
                    message: '注册失败'
                };
            }

            // 创建新用户
            const user = {
                id: SimpleCrypto.hash(username + Date.now()),
                username: username,
                email: email,
                passwordHash: SimpleCrypto.hash(password),
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            };

            // 创建专用的 bin 并同步数据
            const binResult = await this.createUserBin(user);
            if (!binResult.success) {
                throw new Error(binResult.message);
            }

            // 保存用户信息
            this.saveUser(user);
            this.currentUser = user;
            this.notifyAuthStateChange(user);

            return {
                success: true,
                user: user,
                binId: binResult.binId,
                message: '注册成功！'
            };
        } catch (error) {
            console.error('注册失败:', error);
            return {
                success: false,
                error: error.message,
                message: '注册失败'
            };
        }
    }

    // 登录用户（支持用户名+密码或 bin ID）
    async login(usernameOrBinId, password) {
        try {
            // 验证输入
            if (!usernameOrBinId) {
                return {
                    success: false,
                    error: '用户名或 Bin ID 不能为空',
                    message: '登录失败'
                };
            }

            let user = null;
            let binId = null;

            // 判断是 bin ID 还是用户名
            if (this.isValidBinId(usernameOrBinId)) {
                // 通过 bin ID 登录
                const result = await this.loginByBinId(usernameOrBinId);
                if (!result.success) {
                    return result;
                }
                user = result.user;
                binId = usernameOrBinId;
            } else {
                // 通过用户名+密码登录
                if (!password) {
                    return {
                        success: false,
                        error: '密码不能为空',
                        message: '登录失败'
                    };
                }

                // 查找用户（从云端查找）
                user = await this.getUserByUsernameFromCloud(usernameOrBinId);
                if (!user) {
                    return {
                        success: false,
                        error: '用户不存在',
                        message: '登录失败'
                    };
                }

                // 验证密码
                const passwordHash = SimpleCrypto.hash(password);
                if (user.passwordHash !== passwordHash) {
                    return {
                        success: false,
                        error: '密码错误',
                        message: '登录失败'
                    };
                }

                // 获取用户的 bin ID
                binId = localStorage.getItem('coinTrackerBinId');
            }

            // 更新最后登录时间
            user.lastLogin = new Date().toISOString();
            this.saveUser(user);
            this.currentUser = user;
            this.notifyAuthStateChange(user);

            // 保存 binId
            if (binId) {
                localStorage.setItem('coinTrackerBinId', binId);
                this.saveKnownBinId(binId);
                
                // 确保同步服务设置了正确的 binId
                if (this.syncService) {
                    this.syncService.binId = binId;
                }
            }

            return {
                success: true,
                user: user,
                binId: binId,
                message: '登录成功！'
            };
        } catch (error) {
            console.error('登录失败:', error);
            return {
                success: false,
                error: error.message,
                message: '登录失败'
            };
        }
    }

    // 通过 bin ID 登录
    async loginByBinId(binId) {
        try {
            // 读取 bin 数据
            const binData = await this.readBinById(binId);
            if (!binData.success) {
                return {
                    success: false,
                    error: 'Bin ID 无效或不存在',
                    message: '登录失败'
                };
            }

            // 检查是否有用户数据
            if (!binData.data.users || binData.data.users.length === 0) {
                return {
                    success: false,
                    error: '该 Bin ID 没有关联的用户',
                    message: '登录失败'
                };
            }

            const user = binData.data.users[0];
            
            // 保存 binId 到本地存储和同步服务
            localStorage.setItem('coinTrackerBinId', binId);
            this.saveKnownBinId(binId);
            
            // 确保同步服务设置了正确的 binId
            if (this.syncService) {
                this.syncService.binId = binId;
            }

            return {
                success: true,
                user: user,
                binId: binId,
                message: 'Bin ID 登录成功'
            };
        } catch (error) {
            console.error('Bin ID 登录失败:', error);
            return {
                success: false,
                error: error.message,
                message: 'Bin ID 登录失败'
            };
        }
    }

    // 验证是否为有效的 bin ID
    isValidBinId(input) {
        // JSONBin.io bin ID 通常是 24 位十六进制字符串
        return /^[a-f0-9]{24}$/i.test(input);
    }

    // 根据用户名从云端查找用户
    async getUserByUsernameFromCloud(username) {
        try {
            // 首先检查本地存储
            const savedUser = localStorage.getItem('coinTrackerUser');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                if (user.username === username) {
                    return user;
                }
            }

            // 确保同步服务已初始化
            if (!syncService.authService) {
                console.log('同步服务尚未初始化，等待...');
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // 尝试从所有可能的 bin 中查找用户
            const binIds = await this.getAllPossibleBinIds();
            console.log('尝试从以下 bin 中查找用户:', binIds);
            
            for (const binId of binIds) {
                const result = await this.readBinById(binId);
                console.log(`从 bin ${binId} 查找用户，结果:`, result);
                
                if (result.success && result.data && result.data.users) {
                    console.log('云端用户列表:', result.data.users);
                    const user = result.data.users.find(u => u.username === username);
                    if (user) {
                        console.log('找到用户:', user);
                        // 保存到本地存储
                        localStorage.setItem('coinTrackerUser', JSON.stringify(user));
                        localStorage.setItem('coinTrackerUserId', user.id);
                        // 保存正确的 binId
                        localStorage.setItem('coinTrackerBinId', binId);
                        syncService.binId = binId;
                        return user;
                    }
                }
            }
            
            console.log('未找到用户:', username);
            return null;
        } catch (error) {
            console.error('查找用户失败:', error);
            return null;
        }
    }

    // 获取所有可能的 bin ID
    async getAllPossibleBinIds() {
        const binIds = [];
        
        // 1. 当前保存的 binId
        const savedBinId = localStorage.getItem('coinTrackerBinId');
        if (savedBinId) {
            binIds.push(savedBinId);
        }
        
        // 2. 从本地存储获取所有已知的 binId
        const knownBinIds = JSON.parse(localStorage.getItem('knownBinIds') || '[]');
        knownBinIds.forEach(binId => {
            if (!binIds.includes(binId)) {
                binIds.push(binId);
            }
        });
        
        console.log('所有可能的 bin ID:', binIds);
        return binIds;
    }

    // 保存 binId 到已知列表
    saveKnownBinId(binId) {
        const knownBinIds = JSON.parse(localStorage.getItem('knownBinIds') || '[]');
        if (!knownBinIds.includes(binId)) {
            knownBinIds.push(binId);
            localStorage.setItem('knownBinIds', JSON.stringify(knownBinIds));
        }
    }

    // 为用户创建专用的 bin
    async createUserBin(user) {
        try {
            // 确保同步服务已初始化
            if (!this.syncService || !this.syncService.isInitialized) {
                console.log('同步服务未初始化，等待中...');
                let attempts = 0;
                while ((!this.syncService || !this.syncService.isInitialized) && attempts < 20) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
                
                if (!this.syncService || !this.syncService.isInitialized) {
                    throw new Error('同步服务初始化超时');
                }
            }

            // 创建初始数据
            const initialData = {
                coinRecords: [],
                streakData: {
                    currentStreak: 0,
                    longestStreak: 0,
                    lastRecordDate: null,
                    todayCompleted: false
                },
                achievements: null,
                challengeData: {
                    target: 0,
                    startDate: null,
                    endDate: null,
                    currentProgress: 0,
                    completed: false,
                    completedDate: null
                },
                lastSync: new Date().toISOString(),
                users: [user]
            };

            // 创建 bin
            const result = await this.syncService.createBin(initialData);
            if (!result.success) {
                throw new Error(result.message);
            }

            // 保存 binId
            localStorage.setItem('coinTrackerBinId', result.binId);
            this.saveKnownBinId(result.binId);
            
            // 确保同步服务设置了正确的 binId
            if (this.syncService) {
                this.syncService.binId = result.binId;
            }

            return {
                success: true,
                binId: result.binId,
                message: '用户 bin 创建成功'
            };
        } catch (error) {
            console.error('创建用户 bin 失败:', error);
            return {
                success: false,
                message: '创建用户 bin 失败: ' + error.message
            };
        }
    }


    // 根据 binId 读取数据
    async readBinById(binId) {
        try {
            const response = await fetch(`${jsonbinConfig.baseUrl}/b/${binId}/latest`, {
                method: 'GET',
                headers: {
                    'X-Master-Key': jsonbinConfig.apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('读取bin失败:', response.status, errorText);
                if (response.status === 404) {
                    return { success: false, message: '云端存储不存在' };
                }
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const result = await response.json();
            return {
                success: true,
                data: result.record,
                message: '数据读取成功'
            };
        } catch (error) {
            console.error('读取 bin 失败:', error);
            return {
                success: false,
                error: error.message,
                message: '读取云端数据失败'
            };
        }
    }

    // 根据用户名查找用户（兼容旧方法）
    getUserByUsername(username) {
        try {
            const savedUser = localStorage.getItem('coinTrackerUser');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                if (user.username === username) {
                    return user;
                }
            }
            return null;
        } catch (error) {
            console.error('查找用户失败:', error);
            return null;
        }
    }

    // 登出
    async logout() {
        try {
            this.currentUser = null;
            localStorage.removeItem('coinTrackerUser');
            localStorage.removeItem('coinTrackerUserId');
            this.notifyAuthStateChange(null);

            return {
                success: true,
                message: '已安全退出'
            };
        } catch (error) {
            console.error('退出失败:', error);
            return {
                success: false,
                error: error.message,
                message: '退出失败'
            };
        }
    }

    // 获取当前用户
    getCurrentUser() {
        return this.currentUser;
    }

    // 检查用户是否已登录
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // 添加认证状态变化监听器
    onAuthStateChange(callback) {
        this.authStateListeners.push(callback);
    }

    // 通知认证状态变化
    notifyAuthStateChange(user) {
        this.authStateListeners.forEach(callback => {
            callback(user);
        });
    }

    // 更新用户信息
    updateUser(updates) {
        if (!this.currentUser) {
            return false;
        }

        try {
            this.currentUser = { ...this.currentUser, ...updates };
            this.saveUser(this.currentUser);
            this.notifyAuthStateChange(this.currentUser);
            return true;
        } catch (error) {
            console.error('更新用户信息失败:', error);
            return false;
        }
    }

    // 删除账户
    async deleteAccount() {
        try {
            if (this.currentUser) {
                // 从云端删除用户
                await this.deleteUserFromCloud(this.currentUser.id);
            }
            
            this.currentUser = null;
            localStorage.removeItem('coinTrackerUser');
            localStorage.removeItem('coinTrackerUserId');
            this.notifyAuthStateChange(null);

            return {
                success: true,
                message: '账户已删除'
            };
        } catch (error) {
            console.error('删除账户失败:', error);
            return {
                success: false,
                error: error.message,
                message: '删除账户失败'
            };
        }
    }

    // 从云端删除用户
    async deleteUserFromCloud(userId) {
        try {
            const result = await syncService.readBin();
            if (result.success && result.data && result.data.users) {
                result.data.users = result.data.users.filter(u => u.id !== userId);
                await syncService.updateBin(result.data);
            }
        } catch (error) {
            console.error('从云端删除用户失败:', error);
        }
    }
}

// 创建全局实例
export const authService = new SimpleAuthService();
export default authService;
