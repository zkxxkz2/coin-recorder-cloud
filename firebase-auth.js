// Firebase认证服务
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth } from './firebase-config.js';

class FirebaseAuthService {
  constructor() {
    this.currentUser = null;
    this.authStateListeners = [];
    this.init();
  }

  // 初始化认证状态监听
  init() {
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      this.notifyAuthStateChange(user);
    });
  }

  // 注册用户
  async register(email, password, displayName) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // 更新用户显示名称
      if (displayName) {
        await updateProfile(userCredential.user, {
          displayName: displayName
        });
      }
      
      return {
        success: true,
        user: userCredential.user,
        message: '注册成功！'
      };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error.code),
        message: '注册失败'
      };
    }
  }

  // 登录用户
  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return {
        success: true,
        user: userCredential.user,
        message: '登录成功！'
      };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error.code),
        message: '登录失败'
      };
    }
  }

  // Google登录
  async loginWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      return {
        success: true,
        user: result.user,
        message: 'Google登录成功！'
      };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error.code),
        message: 'Google登录失败'
      };
    }
  }

  // 登出
  async logout() {
    try {
      await signOut(auth);
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
      await sendPasswordResetEmail(auth, email);
      return {
        success: true,
        message: '密码重置邮件已发送'
      };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error.code),
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
  getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/user-not-found': '用户不存在',
      'auth/wrong-password': '密码错误',
      'auth/email-already-in-use': '邮箱已被使用',
      'auth/weak-password': '密码强度不够',
      'auth/invalid-email': '邮箱格式不正确',
      'auth/user-disabled': '用户已被禁用',
      'auth/too-many-requests': '请求过于频繁，请稍后再试',
      'auth/network-request-failed': '网络连接失败',
      'auth/popup-closed-by-user': '登录窗口被关闭',
      'auth/cancelled-popup-request': '登录请求被取消'
    };
    
    return errorMessages[errorCode] || '未知错误';
  }
}

// 创建全局实例
export const authService = new FirebaseAuthService();
export default authService;
