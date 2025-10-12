// Supabase认证服务
import { supabase } from './supabase-config.js';

class SupabaseAuthService {
  constructor() {
    this.currentUser = null;
    this.authStateListeners = [];
    this.init();
  }

  // 初始化认证状态监听
  init() {
    // 监听认证状态变化
    supabase.auth.onAuthStateChange((event, session) => {
      this.currentUser = session?.user || null;
      this.notifyAuthStateChange(this.currentUser);
    });

    // 获取当前会话
    this.getCurrentSession();
  }

  // 获取当前会话
  async getCurrentSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      this.currentUser = session?.user || null;
      this.notifyAuthStateChange(this.currentUser);
    } catch (error) {
      console.error('获取会话失败:', error);
    }
  }

  // 注册用户
  async register(email, password, displayName) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            display_name: displayName
          }
        }
      });

      if (error) {
        return {
          success: false,
          error: this.getErrorMessage(error.message),
          message: '注册失败'
        };
      }

      return {
        success: true,
        user: data.user,
        message: '注册成功！请检查邮箱验证邮件'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '注册失败'
      };
    }
  }

  // 登录用户
  async login(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        return {
          success: false,
          error: this.getErrorMessage(error.message),
          message: '登录失败'
        };
      }

      return {
        success: true,
        user: data.user,
        message: '登录成功！'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '登录失败'
      };
    }
  }

  // Google登录
  async loginWithGoogle() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) {
        return {
          success: false,
          error: this.getErrorMessage(error.message),
          message: 'Google登录失败'
        };
      }

      return {
        success: true,
        message: '正在跳转到Google登录...'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Google登录失败'
      };
    }
  }

  // 登出
  async logout() {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return {
          success: false,
          error: error.message,
          message: '退出失败'
        };
      }

      return {
        success: true,
        message: '已安全退出'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '退出失败'
      };
    }
  }

  // 重置密码
  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        return {
          success: false,
          error: this.getErrorMessage(error.message),
          message: '发送重置邮件失败'
        };
      }

      return {
        success: true,
        message: '密码重置邮件已发送'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: '发送重置邮件失败'
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

  // 错误消息映射
  getErrorMessage(errorMessage) {
    const errorMessages = {
      'Invalid login credentials': '邮箱或密码错误',
      'User not found': '用户不存在',
      'Email not confirmed': '邮箱未验证，请检查邮箱',
      'Password should be at least 6 characters': '密码长度至少6位',
      'User already registered': '用户已存在',
      'Invalid email': '邮箱格式不正确',
      'Signup requires a valid password': '密码不能为空',
      'Email rate limit exceeded': '邮件发送过于频繁，请稍后再试',
      'Password reset requires a valid email': '请输入有效的邮箱地址'
    };
    
    return errorMessages[errorMessage] || errorMessage;
  }
}

// 创建全局实例
export const authService = new SupabaseAuthService();
export default authService;
