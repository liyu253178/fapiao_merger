# 📄 发票合并排版工具

> 批量合并电子发票 PDF，自动排版到 A4 纸，本地处理、隐私安全

---

## 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [目录结构](#目录结构)
- [使用方法](#使用方法)
- [技术架构](#技术架构)
- [核心代码说明](#核心代码说明)
- [配置说明](#配置说明)
- [常见问题](#常见问题)
- [开发指南](#开发指南)
- [许可证](#许可证)

---

## 功能特性

### 核心功能

| 功能 | 描述 |
|------|------|
| 📁 批量上传 | 支持多选、拖拽上传 PDF 发票文件 |
| 🔄 拖动排序 | 自由调整发票顺序，支持删除单张 |
| 📐 智能排版 | 2列3行（6张/页）或 2列4行（8张/页）|
| 📏 纸张方向 | 支持纵向/横向 A4 纸张 |
| 🔍 实时预览 | 快速预览排版效果，带进度提示 |
| 🎯 高清输出 | 1200 DPI 超高清渲染，二维码可扫描 |
| 🔒 隐私安全 | 纯本地处理，文件不上传服务器 |
| 📦 便携版本 | 无需安装 Node.js，双击即可运行 |

### 界面预览

```
┌─────────────────────────────────────────────────────────────┐
│  📄 发票合并排版工具              本地处理 · 隐私安全      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────────┐ │
│  │ 📤 上传  │  │ 📋 列表  │  │      🔍 预览区域          │ │
│  │  区域    │  │  面板    │  │                            │ │
│  │          │  │          │  │   ┌─────┬─────┐           │ │
│  │ 排版设置 │  │ 发票排序 │  │   │发票1│发票2│           │ │
│  │          │  │          │  │   ├─────┼─────┤           │ │
│  │ ○ 6张/页 │  │ 1.发票A  │  │   │发票3│发票4│           │ │
│  │ ○ 8张/页 │  │ 2.发票B  │  │   └─────┴─────┘           │ │
│  │          │  │ 3.发票C  │  │                            │ │
│  │ [预览]   │  │          │  │  ◀ 1/3 页 ▶               │ │
│  │ [导出]   │  │          │  │                            │ │
│  └──────────┘  └──────────┘  └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 快速开始

### 方式一：便携版（推荐）

无需安装任何依赖，双击即可运行：

```bash
1. 解压 fapiao_merger 文件夹
2. 双击「启动工具.bat」
3. 浏览器自动打开 http://localhost:9988
4. 开始使用！
```

### 方式二：开发模式

需要安装 Node.js 16+：

```bash
# 克隆仓库
git clone https://github.com/your-username/fapiao_merger.git
cd fapiao_merger

# 启动服务
node server-entry.js

# 浏览器访问
open http://localhost:9988
```

---

## 目录结构

```
fapiao_merger/
├── node.exe              # Node.js 运行时（便携版）
├── server-entry.js       # 服务端入口
├── 启动工具.bat          # 启动脚本（显示窗口）
├── 静默启动.vbs          # 启动脚本（无窗口）
├── static/               # 前端静态资源
│   ├── index.html        # 主页面 HTML
│   ├── style.css         # 样式文件
│   └── app.js            # 核心业务逻辑
├── README.md             # 项目文档
├── LICENSE               # MIT 许可证
└── .gitignore            # Git 忽略配置
```

---

## 使用方法

### 步骤一：上传发票

| 操作方式 | 说明 |
|----------|------|
| 点击上传 | 点击上传区域，选择 PDF 文件 |
| 拖拽上传 | 直接拖拽 PDF 文件到上传区域 |
| 多选上传 | 支持一次选择多个文件 |

### 步骤二：调整设置

| 设置项 | 选项 | 默认值 |
|--------|------|--------|
| 排版模式 | 2列3行（6张/页）/ 2列4行（8张/页） | 6张/页 |
| 纸张方向 | 纵向 / 横向 | 纵向 |
| 间距 | 2-15 mm | 5 mm |
| 文件名 | 自定义 | 合并发票 |

### 步骤三：预览与导出

```
1. 点击「预览排版」→ 查看实时效果
2. 调整设置 → 预览自动更新
3. 点击「合并导出 PDF」→ 自动下载
```

---

## 技术架构

### 技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 前端 | HTML5/CSS3/JavaScript | - | 界面结构与交互 |
| PDF预览 | PDF.js | v3.11 | PDF 渲染为 Canvas |
| PDF生成 | pdf-lib | v1.17 | PDF 合并与嵌入 |
| 后端 | Node.js | v18+ | 本地 HTTP 服务器 |

### 架构图

```
┌─────────────────────────────────────────────────────────┐
│                     浏览器前端                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────────────┐ │
│  │ UI 层   │  │ 状态管理 │  │    Logger 日志系统      │ │
│  └────┬────┘  └────┬────┘  └───────────┬─────────────┘ │
│       │            │                    │               │
│       └────────────┼────────────────────┘               │
│                    ▼                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │              核心业务逻辑 (app.js)               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │   │
│  │  │文件处理  │  │布局计算  │  │ PDF 渲染/合并│  │   │
│  │  └──────────┘  └──────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼ HTTP
┌─────────────────────────────────────────────────────────┐
│                Node.js 本地服务器                       │
│              (server-entry.js)                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  静态文件服务 → 返回 HTML/CSS/JS                 │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 核心代码说明

### 1. 文件处理流程 (app.js)

```javascript
// 文件上传处理
async function handleFiles(fileList) {
  // 1. 过滤非 PDF 文件
  const files = Array.from(fileList).filter(f => 
    f.type === 'application/pdf' || f.name.endsWith('.pdf')
  );
  
  // 2. 生成缩略图
  for (const file of files) {
    const thumbnail = await renderThumbnail(file);
    state.invoices.push({ id, name, size, file, thumbnail });
  }
}
```

### 2. 网格布局计算

```javascript
// A4 尺寸常量
const MM_TO_PT = 72 / 25.4;  // mm 转 pt
const A4_W_MM = 210, A4_H_MM = 297;

function calcGrid(layout, orientation, marginMM) {
  // 计算可用区域
  const usableW = wPt - 2 * marginMM * MM_TO_PT;
  const usableH = hPt - 2 * marginMM * MM_TO_PT;
  
  // 计算单元格大小
  const cellW = (usableW - gapX) / cols;
  const cellH = (usableH - gapY * (rows - 1)) / rows;
  
  return { cellW, cellH, cols, rows };
}
```

### 3. 高清渲染算法

```javascript
// 1200 DPI 超高清渲染
const RENDER_SUPER = 17;  // 17x 超采样 ≈ 1200 DPI

async function renderToPng(pdfData, cellWPt, cellHPt) {
  // 1. 加载 PDF
  const doc = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const page = await doc.getPage(1);
  
  // 2. 计算缩放
  const fitScale = Math.min(cellWPt / vp.width, cellHPt / vp.height);
  const renderScale = fitScale * RENDER_SUPER;  // 超采样
  
  // 3. 渲染为 Canvas
  const viewport = page.getViewport({ scale: renderScale });
  await page.render({ canvasContext, viewport }).promise;
  
  // 4. 输出 PNG
  return canvas.toDataURL('image/png');
}
```

### 4. PDF 合并生成

```javascript
async function mergePDFs(invoices, layout) {
  const mergedPdf = await PDFLib.PDFDocument.create();
  
  for (const invoice of invoices) {
    // 1. 渲染为高清 PNG
    const pngData = await renderToPng(invoice.data, cellW, cellH);
    
    // 2. 嵌入 PDF
    const pngImage = await mergedPdf.embedPng(pngBytes);
    
    // 3. 绘制到页面
    page.drawImage(pngImage, { x, y, width, height });
  }
  
  return mergedPdf.save();
}
```

### 5. 日志系统

```javascript
const Logger = {
  debug(tag, msg, detail) { /* 灰色 */ },
  info(tag, msg, detail)  { /* 蓝色 */ },
  warn(tag, msg, detail)  { /* 黄色 */ },
  error(tag, msg, detail) { /* 红色 */ },
};

// 使用示例
Logger.info('Merge', `开始合并: ${invoices.length} 张`);
Logger.debug('Grid', `单元格尺寸: ${cellW}×${cellH}pt`);
```

---

## 配置说明

### 修改端口

编辑 `server-entry.js`：

```javascript
const PORT = 9988;  // 改为你需要的端口
```

### 修改渲染清晰度

编辑 `static/app.js`：

```javascript
// 预览清晰度（影响预览速度）
const displayScale = 10;  // 10x = 720 DPI

// 导出清晰度（影响最终 PDF 质量）
const RENDER_SUPER = 17;  // 17x = 1200 DPI
```

| 倍率 | DPI | 清晰度 | 文件大小 | 渲染时间 |
|------|-----|--------|----------|----------|
| 3x | 216 | 一般 | 小 | 快 |
| 10x | 720 | 良好 | 中 | 中 |
| 17x | 1200 | 高清 | 大 | 慢 |

---

## 常见问题

### Q1: 端口被占用怎么办？

```powershell
# 查找占用进程
netstat -ano | findstr :9988

# 结束进程
taskkill /PID <进程ID> /F
```

### Q2: 预览加载慢？

降低预览清晰度：
```javascript
const displayScale = 5;  // 从 10 改为 5
```

### Q3: 导出的 PDF 文件太大？

降低导出清晰度：
```javascript
const RENDER_SUPER = 10;  // 从 17 改为 10
```

### Q4: 发票合并后空白？

检查日志面板，可能原因：
- 原始 PDF 有加密
- PDF 格式不标准
- 内存不足

---

## 开发指南

### 本地开发

```bash
# 安装依赖（可选，用于打包）
npm install

# 启动开发服务器
node server-entry.js
```

### 打包便携版

需要将 `node.exe` 复制到项目目录：

```bash
# Windows
copy %NODE_HOME%\node.exe .\

# 或从已安装目录复制
copy "C:\Program Files\nodejs\node.exe" .\
```

### 目录规范

```
新增功能 → static/app.js
界面样式 → static/style.css
页面结构 → static/index.html
服务配置 → server-entry.js
```

---

## 许可证

[MIT License](LICENSE)

---

## 致谢

- [PDF.js](https://mozilla.github.io/pdf.js/) - Mozilla PDF 渲染库
- [pdf-lib](https://pdf-lib.js.org/) - PDF 创建修改库
- [参考项目](https://github.com/liyu253178/PDF-Invoice-Merger-Tool) - 算法灵感

---

**如有问题或建议，欢迎提交 Issue！** 🙏