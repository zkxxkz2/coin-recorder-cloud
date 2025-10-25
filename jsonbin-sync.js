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
        // 延迟初始化，确保所有依赖都已加载
        setTimeout(() => this.init(), 0);
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
                    // 登录时不自动同步，等待用户手动操作
                    console.log('用户已登录，等待手动同步操作');
                    // 尝试加载已保存的 bin ID
                    this.loadBinId();
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

            // 3. 合并数据（智能双向合并）
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

            // 3. 合并数据（智能双向合并）
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

            // 2. 如果有 binId，先读取云端数据进行合并
            if (this.binId) {
                console.log('有现有 binId，读取云端数据进行智能合并...');

                // 读取云端数据
                const readResult = await this.readBin();
                let cloudData = null;

                if (readResult.success) {
                    cloudData = readResult.data;
                    console.log('成功读取云端数据:', cloudData);

                    // 智能合并数据（本地数据优先，以保护用户新数据）
                    const mergedData = this.mergeDataWithLocalPriority(cloudData, localData);

                    // 更新云端数据
                    const updateResult = await this.updateBin(mergedData);
                    if (!updateResult.success) {
                        throw new Error(updateResult.message);
                    }
                    console.log('云端数据更新成功');
                } else {
                    // 如果读取失败，但有 binId，直接更新本地数据
                    console.warn('读取云端数据失败，使用本地数据更新:', readResult.message);
                    const updateResult = await this.updateBin(localData);
                    if (!updateResult.success) {
                        throw new Error(updateResult.message);
                    }
                }
            } else {
                // 3. 如果没有 binId，检查是否已登录
                if (!this.authService || !this.authService.isLoggedIn()) {
                    throw new Error('用户未登录，无法创建新的云端存储');
                }

                // 4. 创建新的 bin（仅在用户已登录时）
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

    // 合并数据（智能合并策略）
    mergeData(cloudData, localData) {
        if (!cloudData) {
            return localData;
        }

        if (!localData) {
            return cloudData;
        }

        console.log('开始智能合并数据...');
        console.log('云端数据:', cloudData);
        console.log('本地数据:', localData);

        // 智能合并金币记录（基于时间戳和日期去重）
        const mergedRecords = this.mergeCoinRecords(cloudData.coinRecords || [], localData.coinRecords || []);

        // 合并用户数据
        const mergedUsers = this.mergeUsers(cloudData.users || [], localData.users || []);

        // 合并其他数据（取最新的）
        const mergedStreakData = this.mergeObjectData(cloudData.streakData, localData.streakData);
        const mergedAchievements = this.mergeObjectData(cloudData.achievements, localData.achievements);
        const mergedChallengeData = this.mergeObjectData(cloudData.challengeData, localData.challengeData);

        const result = {
            coinRecords: mergedRecords,
            users: mergedUsers,
            streakData: mergedStreakData,
            achievements: mergedAchievements,
            challengeData: mergedChallengeData,
            lastSync: new Date().toISOString(),
            mergedAt: new Date().toISOString()
        };

        console.log('合并后的数据:', result);
        return result;
    }

    // 合并数据（本地数据优先策略，用于上传时保护用户新数据）
    mergeDataWithLocalPriority(cloudData, localData) {
        if (!cloudData) {
            return localData;
        }

        if (!localData) {
            return cloudData;
        }

        console.log('开始本地优先合并数据（用于上传保护）...');
        console.log('云端数据:', cloudData);
        console.log('本地数据:', localData);

        // 本地数据优先合并金币记录
        const mergedRecords = this.mergeCoinRecordsWithLocalPriority(cloudData.coinRecords || [], localData.coinRecords || []);

        // 合并用户数据
        const mergedUsers = this.mergeUsers(cloudData.users || [], localData.users || []);

        // 合并其他数据（本地优先）
        const mergedStreakData = this.mergeObjectDataWithLocalPriority(cloudData.streakData, localData.streakData);
        const mergedAchievements = this.mergeObjectDataWithLocalPriority(cloudData.achievements, localData.achievements);
        const mergedChallengeData = this.mergeObjectDataWithLocalPriority(cloudData.challengeData, localData.challengeData);

        const result = {
            coinRecords: mergedRecords,
            users: mergedUsers,
            streakData: mergedStreakData,
            achievements: mergedAchievements,
            challengeData: mergedChallengeData,
            lastSync: new Date().toISOString(),
            mergedAt: new Date().toISOString(),
            mergeStrategy: 'local-priority'
        };

        console.log('本地优先合并后的数据:', result);
        return result;
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

        // 确保所有记录都有时间戳
        const processRecord = (record) => {
            if (!record.timestamp) {
                record.timestamp = new Date(record.date).getTime();
            }
            return record;
        };

        // 添加云端记录
        cloudRecords.forEach(record => {
            const processedRecord = processRecord(record);
            const key = record.date;
            if (!recordMap.has(key) || processedRecord.timestamp > (recordMap.get(key).timestamp || 0)) {
                recordMap.set(key, processedRecord);
            }
        });

        // 添加本地记录（如果云端没有或本地更新）
        localRecords.forEach(record => {
            const processedRecord = processRecord(record);
            const key = record.date;
            if (!recordMap.has(key) || processedRecord.timestamp > (recordMap.get(key).timestamp || 0)) {
                recordMap.set(key, processedRecord);
            }
        });

        const mergedRecords = Array.from(recordMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));

        console.log(`金币记录合并完成: 云端 ${cloudRecords.length} 条, 本地 ${localRecords.length} 条, 合并后 ${mergedRecords.length} 条`);

        return mergedRecords;
    }

    // 合并金币记录（本地优先）
    mergeCoinRecordsWithLocalPriority(cloudRecords, localRecords) {
        const recordMap = new Map();

        // 确保所有记录都有时间戳
        const processRecord = (record) => {
            if (!record.timestamp) {
                record.timestamp = new Date(record.date).getTime();
            }
            return record;
        };

        // 先添加云端记录
        cloudRecords.forEach(record => {
            const processedRecord = processRecord(record);
            const key = record.date;
            if (!recordMap.has(key)) {
                recordMap.set(key, processedRecord);
            }
        });

        // 再添加本地记录（如果本地更新，覆盖云端）
        localRecords.forEach(record => {
            const processedRecord = processRecord(record);
            const key = record.date;
            if (!recordMap.has(key) || processedRecord.timestamp > (recordMap.get(key).timestamp || 0)) {
                recordMap.set(key, processedRecord);
            }
        });

        const mergedRecords = Array.from(recordMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));

        console.log(`金币记录本地优先合并完成: 云端 ${cloudRecords.length} 条, 本地 ${localRecords.length} 条, 合并后 ${mergedRecords.length} 条`);

        return mergedRecords;
    }

    // 合并对象数据（本地优先）
    mergeObjectDataWithLocalPriority(cloudObj, localObj) {
        if (!cloudObj && !localObj) {
            return {};
        }
        if (!cloudObj) {
            return localObj;
        }
        if (!localObj) {
            return cloudObj;
        }

        // 本地数据优先：比较时间戳，如果本地更新则使用本地
        const cloudTime = cloudObj.lastUpdated || cloudObj.timestamp || 0;
        const localTime = localObj.lastUpdated || localObj.timestamp || 0;

        if (localTime > cloudTime) {
            return { ...localObj, lastUpdated: new Date().toISOString() };
        } else {
            return { ...cloudObj, lastUpdated: new Date().toISOString() };
        }
    }

    // 合并对象数据（取更新的数据）
    mergeObjectData(cloudObj, localObj) {
        if (!cloudObj && !localObj) {
            return {};
        }
        if (!cloudObj) {
            return localObj;
        }
        if (!localObj) {
            return cloudObj;
        }

        // 比较 lastUpdated 或其他时间戳字段
        const cloudTime = cloudObj.lastUpdated || cloudObj.timestamp || 0;
        const localTime = localObj.lastUpdated || localObj.timestamp || 0;

        if (cloudTime > localTime) {
            return cloudObj;
        } else {
            return localObj;
        }
    }

    // 更新本地数据
    updateLocalData(data) {
        // 确保所有记录都有时间戳
        const recordsWithTimestamp = (data.coinRecords || []).map(record => {
            if (!record.timestamp) {
                record.timestamp = new Date(record.date).getTime();
            }
            return record;
        });

        localStorage.setItem('coinTrackerData', JSON.stringify(recordsWithTimestamp));
        localStorage.setItem('coinTrackerStreak', JSON.stringify(data.streakData));
        localStorage.setItem('coinTrackerAchievements', JSON.stringify(data.achievements));
        localStorage.setItem('coinTrackerChallenge', JSON.stringify(data.challengeData));
        localStorage.setItem('coinTrackerLastSync', data.lastSync);
        // 同时更新lastCloudSync时间戳
        localStorage.setItem('lastCloudSync', Date.now().toString());

        // 更新用户数据
        if (data.users && data.users.length > 0) {
            localStorage.setItem('coinTrackerUser', JSON.stringify(data.users[0]));
            localStorage.setItem('coinTrackerUserId', data.users[0].id);
        }

        console.log(`本地数据更新完成: ${recordsWithTimestamp.length} 条记录已保存`);
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
