// Firebase数据库服务
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase-config.js';
import { authService } from './firebase-auth.js';

class FirebaseDatabaseService {
  constructor() {
    this.collections = {
      coinRecords: 'coinRecords',
      streakData: 'streakData',
      achievements: 'achievements',
      challenges: 'challenges',
      userSettings: 'userSettings'
    };
  }

  // 获取当前用户ID
  getCurrentUserId() {
    const user = authService.getCurrentUser();
    return user ? user.uid : null;
  }

  // 检查用户是否已登录
  checkAuth() {
    if (!this.getCurrentUserId()) {
      throw new Error('用户未登录');
    }
  }

  // 保存金币记录
  async saveCoinRecord(record) {
    this.checkAuth();
    
    try {
      const userId = this.getCurrentUserId();
      const docRef = await addDoc(collection(db, this.collections.coinRecords), {
        userId: userId,
        date: record.date,
        coins: record.coins,
        difference: record.difference,
        note: record.note || '',
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString()
      });
      
      return {
        success: true,
        id: docRef.id,
        message: '记录保存成功'
      };
    } catch (error) {
      console.error('保存金币记录失败:', error);
      return {
        success: false,
        error: error.message,
        message: '保存记录失败'
      };
    }
  }

  // 更新金币记录
  async updateCoinRecord(recordId, record) {
    this.checkAuth();
    
    try {
      const docRef = doc(db, this.collections.coinRecords, recordId);
      await updateDoc(docRef, {
        date: record.date,
        coins: record.coins,
        difference: record.difference,
        note: record.note || '',
        updatedAt: new Date().toISOString()
      });
      
      return {
        success: true,
        message: '记录更新成功'
      };
    } catch (error) {
      console.error('更新金币记录失败:', error);
      return {
        success: false,
        error: error.message,
        message: '更新记录失败'
      };
    }
  }

  // 删除金币记录
  async deleteCoinRecord(recordId) {
    this.checkAuth();
    
    try {
      await deleteDoc(doc(db, this.collections.coinRecords, recordId));
      return {
        success: true,
        message: '记录删除成功'
      };
    } catch (error) {
      console.error('删除金币记录失败:', error);
      return {
        success: false,
        error: error.message,
        message: '删除记录失败'
      };
    }
  }

  // 获取用户的所有金币记录
  async getCoinRecords() {
    this.checkAuth();
    
    try {
      const userId = this.getCurrentUserId();
      const q = query(
        collection(db, this.collections.coinRecords),
        where('userId', '==', userId),
        orderBy('date', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const records = [];
      
      querySnapshot.forEach((doc) => {
        records.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return {
        success: true,
        data: records,
        message: '获取记录成功'
      };
    } catch (error) {
      console.error('获取金币记录失败:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        message: '获取记录失败'
      };
    }
  }

  // 实时监听金币记录变化
  subscribeToCoinRecords(callback) {
    this.checkAuth();
    
    const userId = this.getCurrentUserId();
    const q = query(
      collection(db, this.collections.coinRecords),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const records = [];
      querySnapshot.forEach((doc) => {
        records.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(records);
    });
  }

  // 保存连击数据
  async saveStreakData(streakData) {
    this.checkAuth();
    
    try {
      const userId = this.getCurrentUserId();
      const docRef = doc(db, this.collections.streakData, userId);
      
      await updateDoc(docRef, {
        ...streakData,
        updatedAt: serverTimestamp()
      }).catch(async () => {
        // 如果文档不存在，创建新文档
        await addDoc(collection(db, this.collections.streakData), {
          userId: userId,
          ...streakData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      
      return {
        success: true,
        message: '连击数据保存成功'
      };
    } catch (error) {
      console.error('保存连击数据失败:', error);
      return {
        success: false,
        error: error.message,
        message: '保存连击数据失败'
      };
    }
  }

  // 获取连击数据
  async getStreakData() {
    this.checkAuth();
    
    try {
      const userId = this.getCurrentUserId();
      const docRef = doc(db, this.collections.streakData, userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          success: true,
          data: docSnap.data(),
          message: '获取连击数据成功'
        };
      } else {
        return {
          success: true,
          data: null,
          message: '暂无连击数据'
        };
      }
    } catch (error) {
      console.error('获取连击数据失败:', error);
      return {
        success: false,
        error: error.message,
        data: null,
        message: '获取连击数据失败'
      };
    }
  }

  // 保存成就数据
  async saveAchievements(achievements) {
    this.checkAuth();
    
    try {
      const userId = this.getCurrentUserId();
      const docRef = doc(db, this.collections.achievements, userId);
      
      await updateDoc(docRef, {
        ...achievements,
        updatedAt: serverTimestamp()
      }).catch(async () => {
        // 如果文档不存在，创建新文档
        await addDoc(collection(db, this.collections.achievements), {
          userId: userId,
          ...achievements,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      
      return {
        success: true,
        message: '成就数据保存成功'
      };
    } catch (error) {
      console.error('保存成就数据失败:', error);
      return {
        success: false,
        error: error.message,
        message: '保存成就数据失败'
      };
    }
  }

  // 获取成就数据
  async getAchievements() {
    this.checkAuth();
    
    try {
      const userId = this.getCurrentUserId();
      const docRef = doc(db, this.collections.achievements, userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          success: true,
          data: docSnap.data(),
          message: '获取成就数据成功'
        };
      } else {
        return {
          success: true,
          data: null,
          message: '暂无成就数据'
        };
      }
    } catch (error) {
      console.error('获取成就数据失败:', error);
      return {
        success: false,
        error: error.message,
        data: null,
        message: '获取成就数据失败'
      };
    }
  }

  // 保存挑战数据
  async saveChallengeData(challengeData) {
    this.checkAuth();
    
    try {
      const userId = this.getCurrentUserId();
      const docRef = doc(db, this.collections.challenges, userId);
      
      await updateDoc(docRef, {
        ...challengeData,
        updatedAt: serverTimestamp()
      }).catch(async () => {
        // 如果文档不存在，创建新文档
        await addDoc(collection(db, this.collections.challenges), {
          userId: userId,
          ...challengeData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      
      return {
        success: true,
        message: '挑战数据保存成功'
      };
    } catch (error) {
      console.error('保存挑战数据失败:', error);
      return {
        success: false,
        error: error.message,
        message: '保存挑战数据失败'
      };
    }
  }

  // 获取挑战数据
  async getChallengeData() {
    this.checkAuth();
    
    try {
      const userId = this.getCurrentUserId();
      const docRef = doc(db, this.collections.challenges, userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          success: true,
          data: docSnap.data(),
          message: '获取挑战数据成功'
        };
      } else {
        return {
          success: true,
          data: null,
          message: '暂无挑战数据'
        };
      }
    } catch (error) {
      console.error('获取挑战数据失败:', error);
      return {
        success: false,
        error: error.message,
        data: null,
        message: '获取挑战数据失败'
      };
    }
  }

  // 批量保存数据（用于数据迁移）
  async batchSaveData(data) {
    this.checkAuth();
    
    try {
      const userId = this.getCurrentUserId();
      const batch = writeBatch(db);
      
      // 保存金币记录
      if (data.coinRecords && data.coinRecords.length > 0) {
        data.coinRecords.forEach(record => {
          const docRef = doc(collection(db, this.collections.coinRecords));
          batch.set(docRef, {
            userId: userId,
            ...record,
            createdAt: serverTimestamp()
          });
        });
      }
      
      // 保存其他数据
      if (data.streakData) {
        const streakRef = doc(db, this.collections.streakData, userId);
        batch.set(streakRef, {
          userId: userId,
          ...data.streakData,
          createdAt: serverTimestamp()
        });
      }
      
      if (data.achievements) {
        const achievementsRef = doc(db, this.collections.achievements, userId);
        batch.set(achievementsRef, {
          userId: userId,
          ...data.achievements,
          createdAt: serverTimestamp()
        });
      }
      
      if (data.challengeData) {
        const challengeRef = doc(db, this.collections.challenges, userId);
        batch.set(challengeRef, {
          userId: userId,
          ...data.challengeData,
          createdAt: serverTimestamp()
        });
      }
      
      await batch.commit();
      
      return {
        success: true,
        message: '数据迁移成功'
      };
    } catch (error) {
      console.error('批量保存数据失败:', error);
      return {
        success: false,
        error: error.message,
        message: '数据迁移失败'
      };
    }
  }

  // 清空用户数据
  async clearUserData() {
    this.checkAuth();
    
    try {
      const userId = this.getCurrentUserId();
      const batch = writeBatch(db);
      
      // 删除所有相关文档
      const collections = Object.values(this.collections);
      for (const collectionName of collections) {
        const q = query(collection(db, collectionName), where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
      }
      
      await batch.commit();
      
      return {
        success: true,
        message: '数据清空成功'
      };
    } catch (error) {
      console.error('清空用户数据失败:', error);
      return {
        success: false,
        error: error.message,
        message: '清空数据失败'
      };
    }
  }
}

// 创建全局实例
export const dbService = new FirebaseDatabaseService();
export default dbService;
