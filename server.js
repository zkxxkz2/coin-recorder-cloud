const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8001;

// MIME类型映射
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    let pathname = url.parse(req.url).pathname;

    // 默认文件
    if (pathname === '/') {
        pathname = '/index.html';
    }

    const filePath = path.join(__dirname, pathname);

    // 安全检查 - 防止目录遍历攻击
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    // 检查文件是否存在
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        // 读取并发送文件
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error');
                return;
            }

            res.writeHead(200, {
                'Content-Type': mimeType,
                'Cache-Control': 'no-cache'
            });
            res.end(data);
        });
    });
});

server.listen(PORT, () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    console.log(`📁 服务目录: ${__dirname}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`❌ 端口 ${PORT} 已被占用`);
    } else {
        console.log(`❌ 服务器错误: ${err.message}`);
    }
});
