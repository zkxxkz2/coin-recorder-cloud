// JSONBin.io 配置文件
// 这是一个超级简单的云端存储方案

const jsonbinConfig = {
    // JSONBin.io API 配置
    baseUrl: 'https://api.jsonbin.io/v3',
    // 请替换为您的 JSONBin.io API 密钥
    apiKey: '$2a$10$lzTGizSjITzjqFfFLVRKK.D6sTi07OqOE7Nea1t5pWQNFQEfe/k9C',
    // 数据存储的 bin ID（会自动创建）
    binId: null
};

// 简单的加密/解密函数（用于密码保护）
class SimpleCrypto {
    // 简单的字符串加密
    static encrypt(text, key) {
        if (!text || !key) return text;
        
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            const keyChar = key.charCodeAt(i % key.length);
            result += String.fromCharCode(charCode ^ keyChar);
        }
        return btoa(result);
    }
    
    // 简单的字符串解密
    static decrypt(encryptedText, key) {
        if (!encryptedText || !key) return encryptedText;
        
        try {
            const text = atob(encryptedText);
            let result = '';
            for (let i = 0; i < text.length; i++) {
                const charCode = text.charCodeAt(i);
                const keyChar = key.charCodeAt(i % key.length);
                result += String.fromCharCode(charCode ^ keyChar);
            }
            return result;
        } catch (error) {
            return encryptedText;
        }
    }
    
    // 生成简单的哈希
    static hash(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(16);
    }
}

export { jsonbinConfig, SimpleCrypto };
