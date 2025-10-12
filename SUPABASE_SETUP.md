# Supabase 配置指南

## 为什么选择 Supabase？

Supabase 是一个开源的 Firebase 替代方案，提供：
- ✅ **完全免费**：无需绑定银行卡，中国大陆用户友好
- ✅ **PostgreSQL 数据库**：功能强大，性能优秀
- ✅ **实时订阅**：支持数据实时同步
- ✅ **身份认证**：支持邮箱、Google 等多种登录方式
- ✅ **自动 API**：自动生成 RESTful API
- ✅ **中文支持**：界面支持中文

## 1. 创建 Supabase 项目

### 步骤 1：注册账户
1. 访问 [Supabase 官网](https://supabase.com)
2. 点击 "Start your project" 或 "Sign up"
3. 使用 GitHub 账户或邮箱注册

### 步骤 2：创建新项目
1. 登录后点击 "New Project"
2. 选择组织（或创建新组织）
3. 填写项目信息：
   - **Name**: `coin-recorder-cloud`
   - **Database Password**: 设置一个强密码（请保存好）
   - **Region**: 选择离您最近的区域（推荐新加坡）
4. 点击 "Create new project"

### 步骤 3：等待项目创建
- 项目创建需要 1-2 分钟
- 创建完成后会自动跳转到项目仪表板

## 2. 获取项目配置

### 步骤 1：进入项目设置
1. 在项目仪表板左侧菜单点击 "Settings"
2. 选择 "API"

### 步骤 2：复制配置信息
您会看到以下信息：
```javascript
const supabaseConfig = {
  url: "https://your-project-ref.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
};
```

## 3. 配置项目文件

### 步骤 1：更新 `index.html`
找到以下代码并替换为您的实际配置：
```html
<!-- Supabase SDK -->
<script type="module">
    import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';
    
    // Supabase配置 - 请替换为您的实际配置
    const supabaseConfig = {
        url: "https://your-project.supabase.co",  // 替换为您的项目URL
        anonKey: "your-anon-key"                 // 替换为您的匿名密钥
    };
    
    // 初始化Supabase
    window.supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
</script>
```

### 步骤 2：更新 `supabase-config.js`
```javascript
const supabaseConfig = {
  url: "https://your-project.supabase.co",  // 替换为您的项目URL
  anonKey: "your-anon-key"                 // 替换为您的匿名密钥
};
```

## 4. 设置数据库表

### 步骤 1：进入 SQL 编辑器
1. 在项目仪表板左侧菜单点击 "SQL Editor"
2. 点击 "New query"

### 步骤 2：创建数据表
复制以下 SQL 代码并执行：

```sql
-- 创建金币记录表
CREATE TABLE coin_records (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    coins INTEGER NOT NULL,
    difference INTEGER NOT NULL,
    note TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- 创建连击数据表
CREATE TABLE streak_data (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_record_date DATE,
    today_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 创建成就数据表
CREATE TABLE achievements (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    achievements JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 创建挑战数据表
CREATE TABLE challenges (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    target INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    current_progress INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    completed_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 创建用户设置表
CREATE TABLE user_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 创建索引以提高查询性能
CREATE INDEX idx_coin_records_user_id ON coin_records(user_id);
CREATE INDEX idx_coin_records_date ON coin_records(date);
CREATE INDEX idx_streak_data_user_id ON streak_data(user_id);
CREATE INDEX idx_achievements_user_id ON achievements(user_id);
CREATE INDEX idx_challenges_user_id ON challenges(user_id);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
```

### 步骤 3：创建批量保存函数
```sql
-- 创建批量保存用户数据的函数
CREATE OR REPLACE FUNCTION batch_save_user_data(
    p_user_id UUID,
    p_coin_records JSONB,
    p_streak_data JSONB,
    p_achievements JSONB,
    p_challenge_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB := '{}';
BEGIN
    -- 批量插入金币记录
    IF p_coin_records IS NOT NULL AND jsonb_array_length(p_coin_records) > 0 THEN
        INSERT INTO coin_records (user_id, date, coins, difference, note)
        SELECT 
            p_user_id,
            (value->>'date')::DATE,
            (value->>'coins')::INTEGER,
            (value->>'difference')::INTEGER,
            COALESCE(value->>'note', '')
        FROM jsonb_array_elements(p_coin_records)
        ON CONFLICT (user_id, date) DO UPDATE SET
            coins = EXCLUDED.coins,
            difference = EXCLUDED.difference,
            note = EXCLUDED.note,
            updated_at = NOW();
        
        result := result || jsonb_build_object('coin_records', 'saved');
    END IF;
    
    -- 保存连击数据
    IF p_streak_data IS NOT NULL THEN
        INSERT INTO streak_data (user_id, current_streak, longest_streak, last_record_date, today_completed)
        VALUES (
            p_user_id,
            COALESCE((p_streak_data->>'currentStreak')::INTEGER, 0),
            COALESCE((p_streak_data->>'longestStreak')::INTEGER, 0),
            (p_streak_data->>'lastRecordDate')::DATE,
            COALESCE((p_streak_data->>'todayCompleted')::BOOLEAN, FALSE)
        )
        ON CONFLICT (user_id) DO UPDATE SET
            current_streak = EXCLUDED.current_streak,
            longest_streak = EXCLUDED.longest_streak,
            last_record_date = EXCLUDED.last_record_date,
            today_completed = EXCLUDED.today_completed,
            updated_at = NOW();
        
        result := result || jsonb_build_object('streak_data', 'saved');
    END IF;
    
    -- 保存成就数据
    IF p_achievements IS NOT NULL THEN
        INSERT INTO achievements (user_id, achievements)
        VALUES (p_user_id, p_achievements)
        ON CONFLICT (user_id) DO UPDATE SET
            achievements = EXCLUDED.achievements,
            updated_at = NOW();
        
        result := result || jsonb_build_object('achievements', 'saved');
    END IF;
    
    -- 保存挑战数据
    IF p_challenge_data IS NOT NULL THEN
        INSERT INTO challenges (user_id, target, start_date, end_date, current_progress, completed, completed_date)
        VALUES (
            p_user_id,
            (p_challenge_data->>'target')::INTEGER,
            (p_challenge_data->>'startDate')::DATE,
            (p_challenge_data->>'endDate')::DATE,
            COALESCE((p_challenge_data->>'currentProgress')::INTEGER, 0),
            COALESCE((p_challenge_data->>'completed')::BOOLEAN, FALSE),
            (p_challenge_data->>'completedDate')::DATE
        )
        ON CONFLICT (user_id) DO UPDATE SET
            target = EXCLUDED.target,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            current_progress = EXCLUDED.current_progress,
            completed = EXCLUDED.completed,
            completed_date = EXCLUDED.completed_date,
            updated_at = NOW();
        
        result := result || jsonb_build_object('challenge_data', 'saved');
    END IF;
    
    RETURN result;
END;
$$;
```

## 5. 设置行级安全策略 (RLS)

### 步骤 1：启用 RLS
```sql
-- 为所有表启用行级安全
ALTER TABLE coin_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE streak_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
```

### 步骤 2：创建安全策略
```sql
-- 金币记录表策略
CREATE POLICY "Users can view their own coin records" ON coin_records
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own coin records" ON coin_records
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own coin records" ON coin_records
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own coin records" ON coin_records
    FOR DELETE USING (auth.uid() = user_id);

-- 连击数据表策略
CREATE POLICY "Users can view their own streak data" ON streak_data
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streak data" ON streak_data
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streak data" ON streak_data
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own streak data" ON streak_data
    FOR DELETE USING (auth.uid() = user_id);

-- 成就数据表策略
CREATE POLICY "Users can view their own achievements" ON achievements
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own achievements" ON achievements
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own achievements" ON achievements
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own achievements" ON achievements
    FOR DELETE USING (auth.uid() = user_id);

-- 挑战数据表策略
CREATE POLICY "Users can view their own challenges" ON challenges
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own challenges" ON challenges
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own challenges" ON challenges
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own challenges" ON challenges
    FOR DELETE USING (auth.uid() = user_id);

-- 用户设置表策略
CREATE POLICY "Users can view their own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON user_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings" ON user_settings
    FOR DELETE USING (auth.uid() = user_id);
```

## 6. 配置身份认证

### 步骤 1：进入认证设置
1. 在项目仪表板左侧菜单点击 "Authentication"
2. 选择 "Settings"

### 步骤 2：配置认证提供商
1. **邮箱认证**（默认启用）：
   - 确保 "Enable email confirmations" 已启用
   - 设置 "Site URL" 为您的网站地址

2. **Google 认证**（可选）：
   - 点击 "Google" 提供商
   - 启用 Google 认证
   - 添加 Google OAuth 客户端 ID 和密钥

### 步骤 3：设置重定向 URL
在 "Site URL" 和 "Redirect URLs" 中添加：
- `http://localhost:3000`（开发环境）
- `https://your-domain.com`（生产环境）

## 7. 测试配置

### 步骤 1：启动项目
1. 使用本地服务器启动项目
2. 打开浏览器开发者工具查看控制台

### 步骤 2：测试功能
1. **注册用户**：点击登录按钮，尝试注册新用户
2. **数据迁移**：如果有本地数据，测试迁移功能
3. **数据同步**：添加金币记录，检查是否同步到云端
4. **多设备测试**：在不同设备登录同一账户，检查数据同步

## 8. 常见问题

### Q: 为什么选择 Supabase 而不是 Firebase？
A: Supabase 对中国大陆用户更友好，无需绑定银行卡，提供 PostgreSQL 数据库，功能更强大。

### Q: 数据安全如何保障？
A: Supabase 使用行级安全策略 (RLS)，确保用户只能访问自己的数据，数据在传输和存储时都经过加密。

### Q: 免费版本有什么限制？
A: Supabase 免费版本包括：
- 500MB 数据库存储
- 2GB 带宽
- 50,000 次认证请求
- 实时连接数限制

### Q: 如何备份数据？
A: Supabase 提供自动备份，您也可以在项目设置中手动创建备份。

### Q: 支持哪些认证方式？
A: 支持邮箱/密码、Google、GitHub、Apple 等多种认证方式。

## 9. 部署建议

### 开发环境
- 使用 `http://localhost:3000` 作为 Site URL
- 在 Supabase 设置中添加本地重定向 URL

### 生产环境
- 使用 HTTPS 域名
- 更新 Supabase 的 Site URL 和重定向 URL
- 考虑使用 CDN 加速静态资源

## 10. 技术支持

- [Supabase 官方文档](https://supabase.com/docs)
- [Supabase 中文社区](https://github.com/supabase/supabase/discussions)
- [GitHub Issues](https://github.com/supabase/supabase/issues)

---

**注意**：请妥善保管您的数据库密码和 API 密钥，不要将其提交到公共代码仓库中。
