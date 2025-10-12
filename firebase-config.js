// Firebase配置文件
// 注意：在生产环境中，这些配置应该从环境变量中读取

const firebaseConfig = {
  // 请替换为您的Firebase项目配置
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Firebase初始化
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 初始化Firebase
const app = initializeApp(firebaseConfig);

// 初始化Firebase服务
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
