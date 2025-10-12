// Supabase云端同步服务
import { authService } from './supabase-auth.js';
import { dbService } from './supabase-database.js';

class SupabaseSyncService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.pendingChanges = [];
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

    // 监听认证状态变化
    authService.onAuthStateChange((user) => {
      if (user) {
        this.syncAllData();
      } else {
        this.clearPendingChanges();
      }
    });
  }

  // 检查是否可以进行同步
  canSync() {
    return this.isOnline && authService.isLoggedIn() && !this.syncInProgress;
  }

  // 同步所有数据
  async syncAllData() {
    if (!this.canSync()) {
      return { success: false, message: '无法同步数据' };
    }

    this.syncInProgress = true;

    try {
      // 1. 从云端获取数据
      const cloudData = await this.downloadFromCloud();
      
      // 2. 获取本地数据
      const localData = this.getLocalData();
      
      // 3. 合并数据（云端优先）
      const mergedData = this.mergeData(cloudData, localData);
      
      // 4. 更新本地存储
      this.updateLocalData(mergedData);
      
      // 5. 同步到云端
      await this.uploadToCloud(mergedData);
      
      this.syncInProgress = false;
      return { success: true, message: '数据同步成功' };
    } catch (error) {
      this.syncInProgress = false;
      console.error('数据同步失败:', error);
      return { success: false, message: '数据同步失败', error: error.message };
    }
  }

  // 从云端下载数据
  async downloadFromCloud() {
    const [coinRecords, streakData, achievements, challengeData] = await Promise.all([
      dbService.getCoinRecords(),
      dbService.getStreakData(),
      dbService.getAchievements(),
      dbService.getChallengeData()
    ]);

    return {
      coinRecords: coinRecords.success ? coinRecords.data : [],
      streakData: streakData.success ? streakData.data : null,
      achievements: achievements.success ? achievements.data : null,
      challengeData: challengeData.success ? challengeData.data : null
    };
  }

  // 获取本地数据
  getLocalData() {
    return {
      coinRecords: JSON.parse(localStorage.getItem('coinTrackerData') || '[]'),
      streakData: JSON.parse(localStorage.getItem('coinTrackerStreak') || 'null'),
      achievements: JSON.parse(localStorage.getItem('coinTrackerAchievements') || 'null'),
      challengeData: JSON.parse(localStorage.getItem('coinTrackerChallenge') || 'null')
    };
  }

  // 合并数据（云端优先策略）
  mergeData(cloudData, localData) {
    // 合并金币记录（按时间戳合并）
    const mergedRecords = this.mergeCoinRecords(cloudData.coinRecords, localData.coinRecords);
    
    // 其他数据云端优先
    return {
      coinRecords: mergedRecords,
      streakData: cloudData.streakData || localData.streakData,
      achievements: cloudData.achievements || localData.achievements,
      challengeData: cloudData.challengeData || localData.challengeData
    };
  }

  // 合并金币记录
  mergeCoinRecords(cloudRecords, localRecords) {
    const recordMap = new Map();
    
    // 添加云端记录
    cloudRecords.forEach(record => {
      const key = record.date;
      if (!recordMap.has(key) || new Date(record.created_at) > new Date(recordMap.get(key).created_at || 0)) {
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
  }

  // 上传数据到云端
  async uploadToCloud(data) {
    const results = await Promise.all([
      this.uploadCoinRecords(data.coinRecords),
      data.streakData ? dbService.saveStreakData(data.streakData) : Promise.resolve({ success: true }),
      data.achievements ? dbService.saveAchievements(data.achievements) : Promise.resolve({ success: true }),
      data.challengeData ? dbService.saveChallengeData(data.challengeData) : Promise.resolve({ success: true })
    ]);

    return results.every(result => result.success);
  }

  // 上传金币记录
  async uploadCoinRecords(records) {
    if (!records || records.length === 0) {
      return { success: true };
    }

    try {
      // 获取云端现有记录
      const cloudResult = await dbService.getCoinRecords();
      const existingRecords = cloudResult.success ? cloudResult.data : [];
      
      // 找出需要上传的新记录
      const existingDates = new Set(existingRecords.map(r => r.date));
      const newRecords = records.filter(r => !existingDates.has(r.date));
      
      // 批量上传新记录
      if (newRecords.length > 0) {
        const uploadPromises = newRecords.map(record => dbService.saveCoinRecord(record));
        await Promise.all(uploadPromises);
      }
      
      return { success: true };
    } catch (error) {
      console.error('上传金币记录失败:', error);
      return { success: false, error: error.message };
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

    for (const change of changes) {
      try {
        switch (change.type) {
          case 'addRecord':
            await dbService.saveCoinRecord(change.data);
            break;
          case 'updateRecord':
            await dbService.updateCoinRecord(change.id, change.data);
            break;
          case 'deleteRecord':
            await dbService.deleteCoinRecord(change.id);
            break;
          case 'updateStreak':
            await dbService.saveStreakData(change.data);
            break;
          case 'updateAchievements':
            await dbService.saveAchievements(change.data);
            break;
          case 'updateChallenge':
            await dbService.saveChallengeData(change.data);
            break;
        }
      } catch (error) {
        console.error('同步更改失败:', error);
        // 重新添加到待处理列表
        this.pendingChanges.push(change);
      }
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

      // 批量上传数据
      const result = await dbService.batchSaveData(localData);
      
      if (result.success) {
        // 标记数据已迁移
        localStorage.setItem('coinTrackerDataMigrated', 'true');
        return { success: true, message: '数据迁移成功' };
      } else {
        return result;
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
      isLoggedIn: authService.isLoggedIn(),
      syncInProgress: this.syncInProgress,
      pendingChanges: this.pendingChanges.length,
      needsMigration: this.needsMigration()
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
}

// 创建全局实例
export const syncService = new SupabaseSyncService();
export default syncService;
