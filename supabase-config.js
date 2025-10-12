// Supabase配置文件
// 注意：在生产环境中，这些配置应该从环境变量中读取

const supabaseConfig = {
  // 请替换为您的Supabase项目配置
  url: "https://your-project.supabase.co",
  anonKey: "your-anon-key"
};

// Supabase初始化
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';

// 初始化Supabase客户端
export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

export default supabase;
