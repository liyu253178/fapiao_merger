/**
 * 发票合并排版工具 - 打包入口
 * 双击运行后自动打开浏览器访问 http://localhost:9988
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 9988;

// MIME 类型映射
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

// 静态资源目录
let STATIC_DIR;
if (process.pkg) {
  STATIC_DIR = path.join(path.dirname(process.execPath), 'static');
} else {
  STATIC_DIR = path.join(__dirname, 'static');
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const filePath = path.join(STATIC_DIR, url === '/' ? 'index.html' : url);

  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`发票合并排版工具已启动: http://localhost:${PORT}`);

  const url = `http://localhost:${PORT}`;
  const cmd = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) console.log('请手动打开浏览器访问:', url);
  });
});

if (process.platform === 'win32') {
  process.stdin.resume();
  console.log('\n按 Ctrl+C 退出程序\n');
}