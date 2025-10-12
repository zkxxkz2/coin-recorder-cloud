# Firebase 云服务配置指南

## 概述

本项目已集成 Firebase 云服务，支持用户认证、数据同步和云端存储功能。

## 配置步骤

### 1. 创建 Firebase 项目

1. 访问 [Firebase Console](https://console.firebase.google.com/)
2. 点击"创建项目"
3. 输入项目名称（如：coin-recorder-cloud）
4. 选择是否启用 Google Analytics（可选）
5. 点击"创建项目"

### 2. 启用认证服务

1. 在 Firebase Console 中，点击左侧菜单的"Authentication"
2. 点击"开始使用"
3. 在"登录方法"标签页中，启用以下登录方式：
   - **电子邮件/密码**：点击启用
   - **Google**：点击启用，配置 OAuth 同意屏幕

### 3. 启用 Firestore 数据库

1. 在 Firebase Console 中，点击左侧菜单的"Firestore Database"
2. 点击"创建数据库"
3. 选择"测试模式"（开发阶段）或"生产模式"（生产环境）
4. 选择数据库位置（建议选择离用户最近的区域）

### 4. 获取项目配置

1. 在 Firebase Console 中，点击项目设置（齿轮图标）
2. 在"常规"标签页中，找到"您的应用"部分
3. 点击"Web"图标（</>）
4. 输入应用昵称（如：coin-recorder-web）
5. 点击"注册应用"
6. 复制提供的配置代码

### 5. 更新项目配置

将获取的 Firebase 配置更新到以下文件：

#### 更新 `index.html` 中的配置：

```javascript
// 在 index.html 中找到这段代码并替换
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};
```

#### 更新 `firebase-config.js` 中的配置：

```javascript
// 在 firebase-config.js 中找到这段代码并替换
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};
```

### 6. 配置 Firestore 安全规则

在 Firebase Console 的 Firestore Database 中，点击"规则"标签页，使用以下规则：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 用户只能访问自己的数据
    match /coinRecords/{document} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    match /streakData/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /achievements/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /challenges/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /userSettings/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 功能特性

### 用户认证
- 邮箱/密码注册和登录
- Google 账户登录
- 密码重置功能
- 用户状态管理

### 数据同步
- 自动同步到云端
- 离线优先策略
- 数据冲突解决
- 实时同步更新

### 数据迁移
- 本地数据自动迁移到云端
- 迁移进度提示
- 数据完整性检查

### 安全特性
- 用户数据隔离
- 加密传输
- 访问权限控制

## 使用说明

### 首次使用
1. 打开应用
2. 点击"登录"按钮
3. 选择"注册"创建新账户
4. 填写注册信息
5. 系统会自动检测本地数据并提示迁移

### 数据同步
- 登录后数据自动同步到云端
- 支持多设备访问
- 离线时数据保存在本地，联网后自动同步

### 账户管理
- 点击用户邮箱旁的"退出"按钮可登出
- 点击"同步"按钮可手动触发数据同步

## 故障排除

### 常见问题

1. **配置错误**
   - 检查 Firebase 配置是否正确
   - 确认项目 ID 和 API 密钥匹配

2. **认证失败**
   - 检查认证服务是否已启用
   - 确认域名已添加到授权域名列表

3. **数据同步失败**
   - 检查网络连接
   - 查看浏览器控制台错误信息
   - 确认 Firestore 规则配置正确

4. **权限错误**
   - 检查 Firestore 安全规则
   - 确认用户已正确登录

### 调试模式

在浏览器控制台中，可以查看详细的错误信息：

```javascript
// 检查 Firebase 连接状态
console.log('Firebase App:', window.firebaseApp);
console.log('Firebase Auth:', window.firebaseAuth);
console.log('Firebase DB:', window.firebaseDb);
```

## 部署注意事项

### 生产环境配置
1. 更新 Firestore 安全规则为生产模式
2. 配置正确的域名授权
3. 启用必要的 Firebase 服务
4. 设置适当的存储配额限制

### 性能优化
1. 启用 Firestore 缓存
2. 优化查询性能
3. 实施数据分页
4. 监控使用量

## 技术支持

如果遇到问题，请检查：
1. Firebase Console 中的项目状态
2. 浏览器控制台的错误信息
3. 网络连接状态
4. 用户权限设置

更多信息请参考 [Firebase 官方文档](https://firebase.google.com/docs)。
