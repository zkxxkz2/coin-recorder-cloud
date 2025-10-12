// Supabase数据库服务
import { supabase } from './supabase-config.js';
import { authService } from './supabase-auth.js';

class SupabaseDatabaseService {
  constructor() {
    this.tables = {
      coinRecords: 'coin_records',
      streakData: 'streak_data',
      achievements: 'achievements',
      challenges: 'challenges',
      userSettings: 'user_settings'
    };
  }

  // 获取当前用户ID
  getCurrentUserId() {
    const user = authService.getCurrentUser();
    return user ? user.id : null;
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
      const { data, error } = await supabase
        .from(this.tables.coinRecords)
        .insert({
          user_id: userId,
          date: record.date,
          coins: record.coins,
          difference: record.difference,
          note: record.note || '',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return {
        success: true,
        data: data,
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
      const { data, error } = await supabase
        .from(this.tables.coinRecords)
        .update({
          date: record.date,
          coins: record.coins,
          difference: record.difference,
          note: record.note || '',
          updated_at: new Date().toISOString()
        })
        .eq('id', recordId)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return {
        success: true,
        data: data,
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
      const { error } = await supabase
        .from(this.tables.coinRecords)
        .delete()
        .eq('id', recordId);
      
      if (error) {
        throw error;
      }
      
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
      const { data, error } = await supabase
        .from(this.tables.coinRecords)
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return {
        success: true,
        data: data || [],
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
    
    return supabase
      .channel('coin_records_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: this.tables.coinRecords,
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        console.log('金币记录变化:', payload);
        // 重新获取所有记录
        this.getCoinRecords().then(result => {
          if (result.success) {
            callback(result.data);
          }
        });
      })
      .subscribe();
  }

  // 保存连击数据
  async saveStreakData(streakData) {
    this.checkAuth();
    
    try {
      const userId = this.getCurrentUserId();
      const { data, error } = await supabase
        .from(this.tables.streakData)
        .upsert({
          user_id: userId,
          current_streak: streakData.currentStreak,
          longest_streak: streakData.longestStreak,
          last_record_date: streakData.lastRecordDate,
          today_completed: streakData.todayCompleted,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return {
        success: true,
        data: data,
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
      const { data, error } = await supabase
        .from(this.tables.streakData)
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      
      return {
        success: true,
        data: data || null,
        message: data ? '获取连击数据成功' : '暂无连击数据'
      };
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
      const { data, error } = await supabase
        .from(this.tables.achievements)
        .upsert({
          user_id: userId,
          achievements: achievements,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return {
        success: true,
        data: data,
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
      const { data, error } = await supabase
        .from(this.tables.achievements)
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      
      return {
        success: true,
        data: data || null,
        message: data ? '获取成就数据成功' : '暂无成就数据'
      };
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
      const { data, error } = await supabase
        .from(this.tables.challenges)
        .upsert({
          user_id: userId,
          target: challengeData.target,
          start_date: challengeData.startDate,
          end_date: challengeData.endDate,
          current_progress: challengeData.currentProgress,
          completed: challengeData.completed,
          completed_date: challengeData.completedDate,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return {
        success: true,
        data: data,
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
      const { data, error } = await supabase
        .from(this.tables.challenges)
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      
      return {
        success: true,
        data: data || null,
        message: data ? '获取挑战数据成功' : '暂无挑战数据'
      };
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
      
      // 开始事务
      const { data: result, error } = await supabase.rpc('batch_save_user_data', {
        p_user_id: userId,
        p_coin_records: data.coinRecords || [],
        p_streak_data: data.streakData || null,
        p_achievements: data.achievements || null,
        p_challenge_data: data.challengeData || null
      });
      
      if (error) {
        throw error;
      }
      
      return {
        success: true,
        data: result,
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
      
      // 删除所有相关数据
      const tables = Object.values(this.tables);
      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('user_id', userId);
        
        if (error) {
          throw error;
        }
      }
      
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
export const dbService = new SupabaseDatabaseService();
export default dbService;
