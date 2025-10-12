// JSONBin.io 云端同步服务
import { jsonbinConfig, SimpleCrypto } from './jsonbin-config.js';

class JSONBinSyncService {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.pendingChanges = [];
        this.binId = null;
        this.authService = null;
        this.isInitialized = false;
        this.init();
    }

    // 初始化同步服务
    init() {
        // 监听网络状态
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncPendingChanges();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
        });

        // 认证状态变化监听器将在 setAuthService 中设置

        // 尝试加载已保存的 bin ID
        this.loadBinId();
        this.isInitialized = true;
    }

    // 设置认证服务
    setAuthService(authService) {
        this.authService = authService;
        
        // 监听认证状态变化
        if (this.authService) {
            this.authService.onAuthStateChange((user) => {
                if (user) {
                    // 不在这里设置 binId，等待从服务器获取
                    this.syncAllData();
                } else {
                    this.clearPendingChanges();
                    this.binId = null;
                }
            });
        }
    }

    // 生成 bin ID（用于标识，不是实际的 bin ID）
    generateBinId(user) {
        return `coin-recorder-${user.id}`;
    }

    // 加载 bin ID
    loadBinId() {
        try {
            const savedBinId = localStorage.getItem('coinTrackerBinId');
            if (savedBinId) {
                this.binId = savedBinId;
            }
        } catch (error) {
            console.error('加载 bin ID 失败:', error);
        }
    }

    // 保存 bin ID
    saveBinId(binId) {
        try {
            localStorage.setItem('coinTrackerBinId', binId);
            this.binId = binId;
        } catch (error) {
            console.error('保存 bin ID 失败:', error);
        }
    }

    // 检查是否可以进行同步
    canSync() {
        return this.isInitialized && this.isOnline && this.authService && this.authService.isLoggedIn() && !this.syncInProgress && jsonbinConfig.apiKey !== 'your-jsonbin-api-key';
    }

    // 创建新的 bin
    async createBin(data) {
        try {
            console.log('创建bin，数据:', data);
            const response = await fetch(`${jsonbinConfig.baseUrl}/b`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': jsonbinConfig.apiKey,
                    'X-Bin-Name': `coin-recorder-${Date.now()}`
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('创建bin失败:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const result = await response.json();
            this.binId = result.metadata.id;
            // 保存 binId 到本地存储
            localStorage.setItem('coinTrackerBinId', this.binId);
            console.log('bin 创建成功，ID:', this.binId);
            return {
                success: true,
                binId: this.binId,
                message: '云端存储创建成功'
            };
        } catch (error) {
            console.error('创建 bin 失败:', error);
            return {
                success: false,
                error: error.message,
                message: '创建云端存储失败'
            };
        }
    }

    // 读取数据
    async readBin() {
        if (!this.binId) {
            // 尝试从本地存储加载 binId
            const savedBinId = localStorage.getItem('coinTrackerBinId');
            if (savedBinId) {
                this.binId = savedBinId;
            } else {
                return { success: false, message: '未找到云端存储 ID' };
            }
        }

        try {
            console.log('读取bin:', this.binId);
            const response = await fetch(`${jsonbinConfig.baseUrl}/b/${this.binId}/latest`, {
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
            console.error('读取数据失败:', error);
            return {
                success: false,
                error: error.message,
                message: '读取云端数据失败'
            };
        }
    }

    // 更新数据
    async updateBin(data) {
        if (!this.binId) {
            // 尝试从本地存储加载 binId
            const savedBinId = localStorage.getItem('coinTrackerBinId');
            if (savedBinId) {
                this.binId = savedBinId;
            } else {
                return { success: false, message: '未找到云端存储 ID' };
            }
        }

        try {
            console.log('更新bin:', this.binId, '数据:', data);
            const response = await fetch(`${jsonbinConfig.baseUrl}/b/${this.binId}`, {
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

            return {
                success: true,
                message: '数据更新成功'
            };
        } catch (error) {
            console.error('更新数据失败:', error);
            return {
                success: false,
                error: error.message,
                message: '更新云端数据失败'
            };
        }
    }

    // 同步所有数据（双向同步）
    async syncAllData() {
        if (!this.canSync()) {
            return { success: false, message: '无法同步数据' };
        }

        this.syncInProgress = true;

        try {
            // 1. 尝试读取云端数据
            let cloudData = null;
            if (this.binId) {
                const readResult = await this.readBin();
                if (readResult.success) {
                    cloudData = readResult.data;
                }
            } else {
                // 如果没有 binId，先创建新的 bin
                console.log('没有 binId，将创建新的 bin');
            }

            // 2. 获取本地数据
            const localData = this.getLocalData();

            // 3. 合并数据（云端优先）
            const mergedData = this.mergeData(cloudData, localData);

            // 4. 更新本地存储
            this.updateLocalData(mergedData);

            // 5. 同步到云端（只有在有变化时才更新）
            if (this.binId) {
                // 检查是否有实际变化
                if (cloudData && JSON.stringify(cloudData) !== JSON.stringify(mergedData)) {
                    await this.updateBin(mergedData);
                }
            } else {
                // 创建新的 bin
                console.log('创建新的 bin...');
                const createResult = await this.createBin(mergedData);
                if (createResult.success) {
                    this.saveBinId(createResult.binId);
                    console.log('bin 创建成功，ID:', createResult.binId);
                } else {
                    console.error('bin 创建失败:', createResult);
                    throw new Error(createResult.message);
                }
            }

            this.syncInProgress = false;
            return { success: true, message: '数据同步成功' };
        } catch (error) {
            this.syncInProgress = false;
            console.error('数据同步失败:', error);
            return { success: false, message: '数据同步失败', error: error.message };
        }
    }

    // 从云端同步到本地
    async syncFromCloud() {
        if (!this.canSync()) {
            return { success: false, message: '无法从云端同步数据' };
        }

        if (!this.binId) {
            return { success: false, message: '没有 Bin ID，无法从云端同步' };
        }

        this.syncInProgress = true;

        try {
            console.log('开始从云端同步数据...');
            
            // 1. 读取云端数据
            const readResult = await this.readBin();
            if (!readResult.success) {
                throw new Error(readResult.message);
            }

            const cloudData = readResult.data;
            console.log('云端数据读取成功:', cloudData);

            // 2. 获取本地数据
            const localData = this.getLocalData();

            // 3. 合并数据（云端优先）
            const mergedData = this.mergeData(cloudData, localData);

            // 4. 更新本地存储
            this.updateLocalData(mergedData);

            this.syncInProgress = false;
            return { 
                success: true, 
                message: '从云端同步成功',
                data: mergedData
            };
        } catch (error) {
            this.syncInProgress = false;
            console.error('从云端同步失败:', error);
            return { success: false, message: '从云端同步失败', error: error.message };
        }
    }

    // 同步本地数据到云端
    async syncToCloud() {
        if (!this.canSync()) {
            return { success: false, message: '无法同步数据到云端' };
        }

        this.syncInProgress = true;

        try {
            console.log('开始同步数据到云端...');
            
            // 1. 获取本地数据
            const localData = this.getLocalData();

            // 2. 如果有 binId，更新现有 bin
            if (this.binId) {
                const updateResult = await this.updateBin(localData);
                if (!updateResult.success) {
                    throw new Error(updateResult.message);
                }
                console.log('云端数据更新成功');
            } else {
                // 3. 如果没有 binId，创建新的 bin
                console.log('创建新的 bin...');
                const createResult = await this.createBin(localData);
                if (!createResult.success) {
                    throw new Error(createResult.message);
                }
                
                this.saveBinId(createResult.binId);
                console.log('bin 创建成功，ID:', createResult.binId);
            }

            this.syncInProgress = false;
            return { 
                success: true, 
                message: '同步到云端成功',
                binId: this.binId
            };
        } catch (error) {
            this.syncInProgress = false;
            console.error('同步到云端失败:', error);
            return { success: false, message: '同步到云端失败', error: error.message };
        }
    }

    // 获取本地数据
    getLocalData() {
        const data = {
            coinRecords: JSON.parse(localStorage.getItem('coinTrackerData') || '[]'),
            streakData: JSON.parse(localStorage.getItem('coinTrackerStreak') || 'null'),
            achievements: JSON.parse(localStorage.getItem('coinTrackerAchievements') || 'null'),
            challengeData: JSON.parse(localStorage.getItem('coinTrackerChallenge') || 'null'),
            lastSync: new Date().toISOString()
        };
        
        // 添加用户数据
        const savedUser = localStorage.getItem('coinTrackerUser');
        if (savedUser) {
            const user = JSON.parse(savedUser);
            data.users = [user];
        } else {
            data.users = [];
        }
        
        return data;
    }

    // 合并数据（云端优先策略）
    mergeData(cloudData, localData) {
        if (!cloudData) {
            return localData;
        }

        // 合并金币记录（按时间戳合并）
        const mergedRecords = this.mergeCoinRecords(
            cloudData.coinRecords || [],
            localData.coinRecords || []
        );

        // 合并用户数据（云端优先，但保留本地用户）
        const mergedUsers = this.mergeUsers(
            cloudData.users || [],
            localData.users || []
        );

        return {
            coinRecords: mergedRecords,
            streakData: cloudData.streakData || localData.streakData,
            achievements: cloudData.achievements || localData.achievements,
            challengeData: cloudData.challengeData || localData.challengeData,
            users: mergedUsers,
            lastSync: new Date().toISOString()
        };
    }

    // 合并用户数据
    mergeUsers(cloudUsers, localUsers) {
        const userMap = new Map();
        
        // 添加云端用户
        cloudUsers.forEach(user => {
            userMap.set(user.id, user);
        });
        
        // 添加本地用户（如果不存在）
        localUsers.forEach(user => {
            if (!userMap.has(user.id)) {
                userMap.set(user.id, user);
            }
        });
        
        return Array.from(userMap.values());
    }

    // 合并金币记录
    mergeCoinRecords(cloudRecords, localRecords) {
        const recordMap = new Map();

        // 添加云端记录
        cloudRecords.forEach(record => {
            const key = record.date;
            if (!recordMap.has(key) || new Date(record.timestamp || 0) > new Date(recordMap.get(key).timestamp || 0)) {
                recordMap.set(key, record);
            }
        });

        // 添加本地记录（如果云端没有或本地更新）
        localRecords.forEach(record => {
            const key = record.date;
            if (!recordMap.has(key) || (record.timestamp && record.timestamp > (recordMap.get(key).timestamp || 0))) {
                recordMap.set(key, record);
            }
        });

        return Array.from(recordMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // 更新本地数据
    updateLocalData(data) {
        localStorage.setItem('coinTrackerData', JSON.stringify(data.coinRecords));
        localStorage.setItem('coinTrackerStreak', JSON.stringify(data.streakData));
        localStorage.setItem('coinTrackerAchievements', JSON.stringify(data.achievements));
        localStorage.setItem('coinTrackerChallenge', JSON.stringify(data.challengeData));
        localStorage.setItem('coinTrackerLastSync', data.lastSync);
        
        // 更新用户数据
        if (data.users && data.users.length > 0) {
            localStorage.setItem('coinTrackerUser', JSON.stringify(data.users[0]));
            localStorage.setItem('coinTrackerUserId', data.users[0].id);
        }
    }

    // 添加待同步的更改
    addPendingChange(change) {
        this.pendingChanges.push({
            ...change,
            timestamp: Date.now()
        });

        // 如果在线，立即同步
        if (this.canSync()) {
            this.syncPendingChanges();
        }
    }

    // 同步待处理的更改
    async syncPendingChanges() {
        if (this.pendingChanges.length === 0 || !this.canSync()) {
            return;
        }

        const changes = [...this.pendingChanges];
        this.pendingChanges = [];

        try {
            // 获取当前数据
            const currentData = this.getLocalData();
            
            // 应用更改
            changes.forEach(change => {
                switch (change.type) {
                    case 'addRecord':
                        currentData.coinRecords.unshift(change.data);
                        break;
                    case 'updateRecord':
                        const updateIndex = currentData.coinRecords.findIndex(r => r.date === change.data.date);
                        if (updateIndex !== -1) {
                            currentData.coinRecords[updateIndex] = change.data;
                        }
                        break;
                    case 'deleteRecord':
                        currentData.coinRecords = currentData.coinRecords.filter(r => r.date !== change.data.date);
                        break;
                    case 'updateStreak':
                        currentData.streakData = change.data;
                        break;
                    case 'updateAchievements':
                        currentData.achievements = change.data;
                        break;
                    case 'updateChallenge':
                        currentData.challengeData = change.data;
                        break;
                }
            });

            // 更新本地数据
            this.updateLocalData(currentData);

            // 同步到云端
            await this.updateBin(currentData);
        } catch (error) {
            console.error('同步更改失败:', error);
            // 重新添加到待处理列表
            this.pendingChanges.unshift(...changes);
        }
    }

    // 清空待处理的更改
    clearPendingChanges() {
        this.pendingChanges = [];
    }

    // 迁移本地数据到云端
    async migrateLocalDataToCloud() {
        if (!this.canSync()) {
            return { success: false, message: '无法迁移数据' };
        }

        try {
            const localData = this.getLocalData();

            // 检查是否有数据需要迁移
            if (!localData.coinRecords || localData.coinRecords.length === 0) {
                return { success: true, message: '没有需要迁移的数据' };
            }

            // 创建新的 bin
            const createResult = await this.createBin(localData);
            if (createResult.success) {
                this.saveBinId(createResult.binId);
                localStorage.setItem('coinTrackerDataMigrated', 'true');
                return { success: true, message: '数据迁移成功' };
            } else {
                return createResult;
            }
        } catch (error) {
            console.error('数据迁移失败:', error);
            return { success: false, message: '数据迁移失败', error: error.message };
        }
    }

    // 检查是否需要迁移数据
    needsMigration() {
        return !localStorage.getItem('coinTrackerDataMigrated') &&
            JSON.parse(localStorage.getItem('coinTrackerData') || '[]').length > 0;
    }

    // 获取同步状态
    getSyncStatus() {
        return {
            isOnline: this.isOnline,
            isLoggedIn: this.authService ? this.authService.isLoggedIn() : false,
            syncInProgress: this.syncInProgress,
            pendingChanges: this.pendingChanges.length,
            needsMigration: this.needsMigration(),
            binId: this.binId
        };
    }

    // 手动触发同步
    async manualSync() {
        if (this.needsMigration()) {
            return await this.migrateLocalDataToCloud();
        } else {
            return await this.syncAllData();
        }
    }

    // 删除云端数据
    async deleteCloudData() {
        if (!this.binId) {
            return { success: true, message: '没有云端数据需要删除' };
        }

        try {
            const response = await fetch(`${jsonbinConfig.baseUrl}/b/${this.binId}`, {
                method: 'DELETE',
                headers: {
                    'X-Master-Key': jsonbinConfig.apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.binId = null;
            localStorage.removeItem('coinTrackerBinId');
            localStorage.removeItem('coinTrackerDataMigrated');

            return {
                success: true,
                message: '云端数据已删除'
            };
        } catch (error) {
            console.error('删除云端数据失败:', error);
            return {
                success: false,
                error: error.message,
                message: '删除云端数据失败'
            };
        }
    }
}

// 创建全局实例
export const syncService = new JSONBinSyncService();
export default syncService;
