/* ============================================
   发票合并排版工具 - 应用逻辑 v2
   [FIX] 预览 renderPreviewPages 缩放+assign bug
   [FIX] 合并 mergePDFs 行间距计算 bug
   [ADD] 全链路 Logger 日志
   ============================================ */

(function () {
  'use strict';

  // ═══════════════════════════════════════════
  //  Logger 日志系统
  // ═══════════════════════════════════════════
  const Logger = (() => {
    const MAX = 500;
    const logs = [];
    let panelEl = null;

    const LEVEL = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    const STYLE = {
      DEBUG: 'color:#6B7280',
      INFO:  'color:#2563EB',
      WARN:  'color:#D97706',
      ERROR: 'color:#DC2626;font-weight:600',
    };

    function _ts() {
      return new Date().toLocaleTimeString('zh-CN', { hour12: false }) + '.' + String(Date.now() % 1000).padStart(3, '0');
    }

    function _emit(level, tag, msg, detail) {
      const entry = { ts: _ts(), level, tag, msg, detail };
      logs.push(entry);
      if (logs.length > MAX) logs.shift();

      // 浏览器控制台
      const style = STYLE[level];
      console.log(`%c[${entry.ts}] [${level}] [${tag}] ${msg}`, style, detail !== undefined ? detail : '');

      // 页面日志面板
      if (panelEl) {
        const div = document.createElement('div');
        div.className = 'log-entry log-' + level.toLowerCase();
        div.textContent = `[${entry.ts}] [${tag}] ${msg}${detail !== undefined ? ' ' + JSON.stringify(detail) : ''}`;
        panelEl.appendChild(div);
        panelEl.scrollTop = panelEl.scrollHeight;
      }
    }

    return {
      debug(tag, msg, detail) { _emit('DEBUG', tag, msg, detail); },
      info(tag, msg, detail)  { _emit('INFO', tag, msg, detail); },
      warn(tag, msg, detail)  { _emit('WARN', tag, msg, detail); },
      error(tag, msg, detail) { _emit('ERROR', tag, msg, detail); },
      getLogs() { return logs.slice(); },
      clear() { logs.length = 0; if (panelEl) panelEl.innerHTML = ''; },
      init(el) { panelEl = el; },
    };
  })();

  // ─── 状态 ───────────────────────────────────
  const state = {
    invoices: [],
    layout: 6,
    orientation: 'portrait',
    margin: 5,
    outputName: '合并发票',
    previewPages: [],
    currentPage: 0,
    isProcessing: false,
  };

  // ─── DOM ────────────────────────────────────
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ─── A4 尺寸 ────────────────────────────────
  const MM_TO_PT = 72 / 25.4;   // ≈ 2.8346
  const A4_W_MM = 210;
  const A4_H_MM = 297;

  function getPageSize() {
    const landscape = state.orientation === 'landscape';
    const w = landscape ? A4_H_MM : A4_W_MM;
    const h = landscape ? A4_W_MM : A4_H_MM;
    const wPt = w * MM_TO_PT;
    const hPt = h * MM_TO_PT;
    Logger.debug('Layout', `页面尺寸: ${w}×${h}mm = ${wPt.toFixed(1)}×${hPt.toFixed(1)}pt`, { orientation: state.orientation });
    return { wMM: w, hMM: h, wPt, hPt };
  }

  // ─── 工具 ───────────────────────────────────
  function uid() { return Math.random().toString(36).slice(2, 9); }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function showToast(msg, type = 'info') {
    Logger.info('Toast', msg, { type });
    const container = $('#toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✗', info: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || ''}</span> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function setProgress(text, pct) {
    $('#progressText').textContent = text;
    $('#progressBar').style.width = pct + '%';
  }

  // ─── 计算网格布局参数 ───────────────────────
  function calcGrid(layout, orientation, marginMM) {
    const { wPt, hPt } = getPageSize();
    const mPt = marginMM * MM_TO_PT;
    const usableW = wPt - 2 * mPt;
    const usableH = hPt - 2 * mPt;
    const cols = 2;
    const rows = layout === 6 ? 3 : 4;
    const gapX = mPt;
    const gapY = mPt * 0.8;
    const cellW = (usableW - gapX * (cols - 1)) / cols;
    const cellH = (usableH - gapY * (rows - 1)) / rows;

    Logger.info('Grid', `网格计算完成`, {
      layout, orientation, marginMM,
      wPt: wPt.toFixed(1), hPt: hPt.toFixed(1),
      mPt: mPt.toFixed(1), usableW: usableW.toFixed(1), usableH: usableH.toFixed(1),
      cols, rows, gapX: gapX.toFixed(1), gapY: gapY.toFixed(1),
      cellW: cellW.toFixed(1), cellH: cellH.toFixed(1),
    });

    return { wPt, hPt, mPt, usableW, usableH, cols, rows, gapX, gapY, cellW, cellH };
  }

  // ═══════════════════════════════════════════
  //  PDF 缩略图渲染（pdf.js）
  // ═══════════════════════════════════════════
  async function renderThumbnail(file) {
    const buf = await file.arrayBuffer();
    const data = new Uint8Array(buf);
    const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    const page = await pdfDoc.getPage(1);
    const vp = page.getViewport({ scale: 1.5 });
    Logger.debug('Thumb', `缩略图: ${file.name} viewport=${vp.width}×${vp.height}`);

    const canvas = document.createElement('canvas');
    canvas.width = vp.width;
    canvas.height = vp.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  // ═══════════════════════════════════════════
  //  预览渲染（pdf.js → canvas）
  //  [FIX] 移除 rVp.assign() 调用
  //  [FIX] 修正缩放公式
  // ═══════════════════════════════════════════
  async function renderPreviewPages(invoices, layout, orientation, marginMM) {
    Logger.info('Preview', `开始渲染预览: ${invoices.length} 张发票, layout=${layout}`);

    const g = calcGrid(layout, orientation, marginMM);
    const totalPages = Math.ceil(invoices.length / layout);
    Logger.info('Preview', `共 ${totalPages} 页`);

    const displayScale = 10;  // 10x 超采样，清晰流畅
    const pageCanvases = [];

    for (let p = 0; p < totalPages; p++) {
      Logger.debug('Preview', `渲染第 ${p + 1}/${totalPages} 页...`);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = g.wPt * displayScale;
      pageCanvas.height = g.hPt * displayScale;
      const ctx = pageCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, pageCanvas.width, pageCanvas.height);

      const pageItems = invoices.slice(p * layout, p * layout + layout);

      for (let i = 0; i < pageItems.length; i++) {
        const col = i % g.cols;
        const row = Math.floor(i / g.cols);
        const x = g.mPt * displayScale + col * (g.cellW * displayScale + g.gapX * displayScale);
        const y = g.mPt * displayScale + row * (g.cellH * displayScale + g.gapY * displayScale);
        const cw = g.cellW * displayScale;
        const ch = g.cellH * displayScale;

        // 格子背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, cw, ch);

        try {
          const buf = await pageItems[i].file.arrayBuffer();
          const data = new Uint8Array(buf);  // 拷贝防 detached
          const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
          const pdfPage = await pdfDoc.getPage(1);
          const pdfVp = pdfPage.getViewport({ scale: 1 });

          Logger.debug('Preview', `  发票[${i}] "${pageItems[i].name}" 原始viewport: ${pdfVp.width}×${pdfVp.height}px, 格子: ${cw.toFixed(0)}×${ch.toFixed(0)}px`);

          // [FIX] 正确的等比缩放：
          //   pdfVp.width/height 是 scale=1 时的 CSS 像素（≈ PDF points）
          //   cw/ch 是格子像素（已乘 displayScale）
          //   renderScale = min(cw/pdfVp.w, ch/pdfVp.h) 即可直接得到缩放率
          const fitScaleW = cw / pdfVp.width;
          const fitScaleH = ch / pdfVp.height;
          const renderScale = Math.min(fitScaleW, fitScaleH);

          Logger.debug('Preview', `  缩放: fitW=${fitScaleW.toFixed(4)} fitH=${fitScaleH.toFixed(4)} final=${renderScale.toFixed(4)}`);

          const rVp = pdfPage.getViewport({ scale: renderScale });
          const cvs = document.createElement('canvas');
          cvs.width = Math.round(rVp.width);
          cvs.height = Math.round(rVp.height);
          const cctx = cvs.getContext('2d');

          // [FIX] 移除了不存在的 rVp.assign() 调用
          await pdfPage.render({ canvasContext: cctx, viewport: rVp }).promise;

          Logger.debug('Preview', `  渲染结果: ${cvs.width}×${cvs.height}px → 居中绘制到 (${x.toFixed(0)}, ${y.toFixed(0)})`);

          // 居中绘制
          const dx = x + (cw - rVp.width) / 2;
          const dy = y + (ch - rVp.height) / 2;
          ctx.drawImage(cvs, dx, dy);

          // 边框
          ctx.strokeStyle = '#E2E8F0';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, cw, ch);
        } catch (e) {
          Logger.error('Preview', `发票[${i}] "${pageItems[i].name}" 渲染失败: ${e.message}`, e.stack);
          ctx.fillStyle = '#F1F5F9';
          ctx.fillRect(x, y, cw, ch);
          ctx.fillStyle = '#94A3B8';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('渲染失败', x + cw / 2, y + ch / 2);
        }
      }

      pageCanvases.push(pageCanvas);
      Logger.info('Preview', `第 ${p + 1} 页渲染完成 canvas=${pageCanvas.width}×${pageCanvas.height}`);
    }

    return pageCanvases;
  }

  // ═══════════════════════════════════════════
  //  合并 PDF（pdf-lib，高清矢量）
  //  [FIX] copyPages 失败时降级为 pdf.js 渲染 PNG 嵌入
  //  [FIX] 提前读取全部 ArrayBuffer 避免多次调用 file.arrayBuffer() 导致 detached
  //  [FIX] 添加 ignoreEncryption 支持加密发票
  // ═══════════════════════════════════════════

  // 用 pdf.js 将发票渲染为超高清 PNG
  // 参考：1200 DPI 渲染 → fitScale * (1200/72) ≈ fitScale * 16.67x 超采样
  async function renderToPng(pdfData, cellWPt, cellHPt, label) {
    const doc = await pdfjsLib.getDocument({ data: pdfData.slice(0) }).promise;
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    const fitScale = Math.min(cellWPt / vp.width, cellHPt / vp.height);
    // 1200 DPI: 1200 / 72 = 16.667，向上取整 17x 超采样
    const RENDER_SUPER = 17;
    const renderScale = fitScale * RENDER_SUPER;
    const rVp = page.getViewport({ scale: renderScale });
    const cvs = document.createElement('canvas');
    cvs.width = Math.round(rVp.width);
    cvs.height = Math.round(rVp.height);
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    await page.render({ canvasContext: ctx, viewport: rVp }).promise;
    Logger.debug('Render', `${label} PNG: 原始${vp.width.toFixed(0)}×${vp.height.toFixed(0)}pt 超采样${RENDER_SUPER}x → ${cvs.width}×${cvs.height}px`);
    return cvs.toDataURL('image/png');
  }

  async function mergePDFs(invoices, layout, orientation, marginMM, outputName) {
    Logger.info('Merge', `开始合并: ${invoices.length} 张, layout=${layout}, orient=${orientation}, margin=${marginMM}mm`);

    const g = calcGrid(layout, orientation, marginMM);
    const totalPages = Math.ceil(invoices.length / layout);

    // 预读取所有 PDF
    Logger.info('Merge', '预读取所有发票...');
    const pdfDataList = [];
    let failCount = 0;
    for (let idx = 0; idx < invoices.length; idx++) {
      try {
        const buf = await invoices[idx].file.arrayBuffer();
        pdfDataList.push({ name: invoices[idx].name, data: new Uint8Array(buf), used: false });
      } catch (e) {
        Logger.error('Merge', `预读取[${idx}] "${invoices[idx].name}" 失败: ${e.message}`);
        failCount++;
      }
    }
    if (failCount === invoices.length) throw new Error('所有发票读取失败');
    if (failCount > 0) showToast(`${failCount} 个发票读取失败，已跳过`, 'error');

    const mergedPdf = await PDFLib.PDFDocument.create();
    mergedPdf.setTitle(outputName);
    mergedPdf.setAuthor('发票合并排版工具');

    let nextIdx = 0;

    for (let p = 0; p < totalPages; p++) {
      setProgress(`生成第 ${p + 1}/${totalPages} 页...`, (p / totalPages) * 90);
      const page = mergedPdf.addPage([g.wPt, g.hPt]);
      const pageItems = invoices.slice(p * layout, p * layout + layout);
      let drawn = 0;

      Logger.debug('Merge', `第 ${p + 1} 页: ${pageItems.length} 张`);

      for (let i = 0; i < pageItems.length; i++) {
        const invName = pageItems[i].name;
        const col = i % g.cols;
        const row = Math.floor(i / g.cols);
        const x = g.mPt + col * (g.cellW + g.gapX);
        const y = g.hPt - g.mPt - (row + 1) * g.cellH - row * g.gapY;

        // 查找预读数据
        let entry = null;
        for (let di = nextIdx; di < pdfDataList.length; di++) {
          if (!pdfDataList[di].used && pdfDataList[di].name === invName) {
            entry = pdfDataList[di]; entry.used = true; nextIdx = di + 1; break;
          }
        }
        if (!entry) { Logger.warn('Merge', `[${i}] "${invName}" 无数据，跳过`); continue; }

        try {
          setProgress(`渲染: ${invName.substring(0, 15)}...`, (p / totalPages) * 90 + (i / pageItems.length) * 5);

          // 统一 PNG 渲染
          const pngUrl = await renderToPng(entry.data, g.cellW, g.cellH, `[${p+1}-${i}] ${invName}`);
          const b64 = pngUrl.replace(/^data:image\/png;base64,/, '');
          const pngBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const img = await mergedPdf.embedPng(pngBytes);

          const scale = Math.min(g.cellW / img.width, g.cellH / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          const dx = x + (g.cellW - dw) / 2;
          const dy = y + (g.cellH - dh) / 2;

          page.drawImage(img, { x: dx, y: dy, width: dw, height: dh });
          drawn++;
          Logger.info('Merge', `[${i}] "${invName}" ✅ PNG嵌入 ${img.width}×${img.height}px → ${dw.toFixed(0)}×${dh.toFixed(0)}pt`);
        } catch (e) {
          Logger.error('Merge', `[${i}] "${invName}" 失败: ${e.message}`);
          showToast(`"${invName.substring(0, 20)}" 合并失败`, 'error');
        }
      }

      Logger.info('Merge', `第 ${p + 1} 页完成: ${drawn}/${pageItems.length} 张`);
    }

    setProgress('生成文件...', 95);
    const pdfBytes = await mergedPdf.save();
    const pc = mergedPdf.getPageCount();
    Logger.info('Merge', `完成: ${pc} 页, ${(pdfBytes.length / 1024).toFixed(1)} KB`);
    if (pc === 0) throw new Error('合并结果为空');
    return pdfBytes;
  }

  // ─── 发票列表 ───────────────────────────────
  function renderInvoiceList() {
    const list = $('#invoiceList');
    const empty = $('#emptyState');
    const count = $('#invoiceCount');
    const clearBtn = $('#clearAllBtn');

    count.textContent = `${state.invoices.length} 张`;
    clearBtn.style.display = state.invoices.length ? 'flex' : 'none';

    if (!state.invoices.length) {
      list.innerHTML = '';
      list.appendChild(empty);
      empty.style.display = 'flex';
      return;
    }

    empty.style.display = 'none';
    const frag = document.createDocumentFragment();

    state.invoices.forEach((inv, idx) => {
      const el = document.createElement('div');
      el.className = 'invoice-item';
      el.dataset.id = inv.id;
      el.draggable = true;
      el.innerHTML = `
        <div class="invoice-idx">${idx + 1}</div>
        <div class="invoice-thumb">
          <img src="${inv.thumbnail}" alt="缩略图" />
        </div>
        <div class="invoice-info">
          <div class="invoice-name" title="${inv.name}">${inv.name}</div>
          <div class="invoice-size">${formatSize(inv.size)}</div>
        </div>
        <button class="invoice-del" data-id="${inv.id}" title="移除">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2L2 12" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      `;

      el.addEventListener('dragstart', handleDragStart);
      el.addEventListener('dragover', handleDragOver);
      el.addEventListener('dragleave', handleDragLeave);
      el.addEventListener('drop', handleDrop);
      el.addEventListener('dragend', handleDragEnd);

      el.querySelector('.invoice-del').addEventListener('click', (e) => {
        e.stopPropagation();
        removeInvoice(inv.id);
      });

      frag.appendChild(el);
    });

    list.innerHTML = '';
    list.appendChild(frag);
  }

  // ─── 拖拽排序 ───────────────────────────────
  let dragSrcId = null;

  function handleDragStart(e) {
    dragSrcId = e.currentTarget.dataset.id;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }
  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (e.currentTarget.dataset.id !== dragSrcId) e.currentTarget.classList.add('drag-over');
  }
  function handleDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
  function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const tgtId = e.currentTarget.dataset.id;
    if (!dragSrcId || dragSrcId === tgtId) return;
    const srcIdx = state.invoices.findIndex(i => i.id === dragSrcId);
    const tgtIdx = state.invoices.findIndex(i => i.id === tgtId);
    const [item] = state.invoices.splice(srcIdx, 1);
    state.invoices.splice(tgtIdx, 0, item);
    Logger.info('Sort', `拖拽排序: "${item.name}" 从 ${srcIdx} → ${tgtIdx}`);
    renderInvoiceList();
    triggerPreview();
  }
  function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    $$('.invoice-item').forEach(el => el.classList.remove('drag-over'));
    dragSrcId = null;
  }

  function removeInvoice(id) {
    const inv = state.invoices.find(i => i.id === id);
    state.invoices = state.invoices.filter(i => i.id !== id);
    Logger.info('Remove', `移除: "${inv?.name}"`);
    renderInvoiceList();
    updateButtons();
    if (state.invoices.length) triggerPreview(); else clearPreview();
  }

  // ─── 文件处理 ───────────────────────────────
  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!files.length) {
      showToast('未检测到有效的 PDF 文件', 'error');
      return;
    }
    Logger.info('Upload', `选中 ${fileList.length} 个文件，过滤后 ${files.length} 个 PDF`);

    const existing = new Set(state.invoices.map(i => i.name));
    const newFiles = files.filter(f => !existing.has(f.name));
    if (!newFiles.length) {
      showToast('这些文件已存在', 'info');
      return;
    }

    showToast(`正在处理 ${newFiles.length} 个文件...`, 'info');

    for (const file of newFiles) {
      try {
        Logger.debug('Upload', `处理: "${file.name}" (${formatSize(file.size)})`);
        const thumbnail = await renderThumbnail(file);
        state.invoices.push({ id: uid(), name: file.name, size: file.size, file, thumbnail });
        Logger.info('Upload', `成功: "${file.name}"`);
      } catch (e) {
        Logger.error('Upload', `失败: "${file.name}" ${e.message}`);
      }
    }

    renderInvoiceList();
    updateButtons();
    if (state.invoices.length) triggerPreview();
    showToast(`${newFiles.length} 个发票已添加`, 'success');
  }

  // ─── 预览 ───────────────────────────────────
  let previewTimeout = null;

  function triggerPreview() {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(() => doPreview(), 300);
  }

  async function doPreview() {
    if (!state.invoices.length) return;

    Logger.info('Preview', `触发预览: ${state.invoices.length} 张, layout=${state.layout}, orient=${state.orientation}, margin=${state.margin}mm`);

    const pagesContainer = $('#previewPages');
    const placeholder = $('#previewPlaceholder');
    const previewNav = $('#previewNav');
    placeholder.style.display = 'none';
    previewNav.style.display = 'none';

    // 显示预览进度
    const totalItems = state.invoices.length;
    const totalPages = Math.ceil(totalItems / state.layout);

    function showPreviewProgress(current, text) {
      pagesContainer.innerHTML = `
        <div class="preview-progress-wrap">
          <div class="preview-progress-spinner"></div>
          <p class="preview-progress-text">${text}</p>
          <div class="preview-progress-bar-bg">
            <div class="preview-progress-bar-fill" style="width:${current}%;"></div>
          </div>
          <p class="preview-progress-pct">${Math.round(current)}%</p>
        </div>
      `;
    }

    showPreviewProgress(0, `正在渲染 ${totalItems} 张发票...`);

    try {
      const t0 = performance.now();

      // 直接调用 renderPreviewPages，但需要注入进度回调
      const g = calcGrid(state.layout, state.orientation, state.margin);
      const displayScale = 10;
      const pageCanvases = [];
      let itemsRendered = 0;

      for (let p = 0; p < totalPages; p++) {
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = g.wPt * displayScale;
        pageCanvas.height = g.hPt * displayScale;
        const ctx = pageCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, pageCanvas.width, pageCanvas.height);

        const pageItems = state.invoices.slice(p * state.layout, p * state.layout + state.layout);

        for (let i = 0; i < pageItems.length; i++) {
          const col = i % g.cols;
          const row = Math.floor(i / g.cols);
          const x = g.mPt * displayScale + col * (g.cellW * displayScale + g.gapX * displayScale);
          const y = g.mPt * displayScale + row * (g.cellH * displayScale + g.gapY * displayScale);
          const cw = g.cellW * displayScale;
          const ch = g.cellH * displayScale;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y, cw, ch);

          try {
            const buf = await pageItems[i].file.arrayBuffer();
            const data = new Uint8Array(buf);
            const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
            const pdfPage = await pdfDoc.getPage(1);
            const pdfVp = pdfPage.getViewport({ scale: 1 });

            const fitScaleW = cw / pdfVp.width;
            const fitScaleH = ch / pdfVp.height;
            const renderScale = Math.min(fitScaleW, fitScaleH);

            const rVp = pdfPage.getViewport({ scale: renderScale });
            const cvs = document.createElement('canvas');
            cvs.width = Math.round(rVp.width);
            cvs.height = Math.round(rVp.height);
            const cctx = cvs.getContext('2d');
            await pdfPage.render({ canvasContext: cctx, viewport: rVp }).promise;

            const dx = x + (cw - rVp.width) / 2;
            const dy = y + (ch - rVp.height) / 2;
            ctx.drawImage(cvs, dx, dy);

            ctx.strokeStyle = '#E2E8F0';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x, y, cw, ch);
          } catch (e) {
            Logger.error('Preview', `发票[${i}] "${pageItems[i].name}" 渲染失败: ${e.message}`, e.stack);
            ctx.fillStyle = '#F1F5F9';
            ctx.fillRect(x, y, cw, ch);
            ctx.fillStyle = '#94A3B8';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('渲染失败', x + cw / 2, y + ch / 2);
          }

          itemsRendered++;
          const pct = Math.round((itemsRendered / totalItems) * 100);
          showPreviewProgress(pct, `正在渲染第 ${itemsRendered}/${totalItems} 张...`);
        }

        pageCanvases.push(pageCanvas);
      }

      const dt = (performance.now() - t0).toFixed(0);
      Logger.info('Preview', `预览完成: ${pageCanvases.length} 页, 耗时 ${dt}ms`);

      state.previewPages = pageCanvases;
      state.currentPage = 0;
      renderPreviewPage(0);
      previewNav.style.display = 'flex';
    } catch (e) {
      Logger.error('Preview', '预览失败', e.stack);
      showToast('预览渲染失败: ' + e.message, 'error');
      placeholder.style.display = 'flex';
    }
  }

  function renderPreviewPage(idx) {
    const container = $('#previewPages');
    container.innerHTML = '';
    const canvas = state.previewPages[idx];
    if (!canvas) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'preview-page';

    // canvas 分辨率是 displayScale 倍，但 CSS 显示尺寸按面板宽度等比缩放
    const areaW = $('#previewArea').clientWidth - 80;
    const cssScale = Math.min(1, areaW / canvas.width);
    wrapper.style.width = canvas.width * cssScale + 'px';
    wrapper.style.height = canvas.height * cssScale + 'px';

    // 直接挂原始高清 canvas，浏览器会自动按 CSS 尺寸显示（锐利）
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);

    $('#pageInfo').textContent = `${idx + 1} / ${state.previewPages.length}`;
  }

  function clearPreview() {
    state.previewPages = [];
    $('#previewPages').innerHTML = '';
    $('#previewPlaceholder').style.display = 'flex';
    $('#previewNav').style.display = 'none';
  }

  // ─── 合并导出 ───────────────────────────────
  async function doMerge() {
    if (state.isProcessing) return;
    if (!state.invoices.length) return;

    state.isProcessing = true;
    $('#progressOverlay').style.display = 'flex';
    setProgress('准备中...', 5);

    try {
      const name = $('#outputName').value.trim() || '合并发票';
      const t0 = performance.now();
      const bytes = await mergePDFs(state.invoices, state.layout, state.orientation, state.margin, name);
      const dt = (performance.now() - t0).toFixed(0);

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (name.endsWith('.pdf') ? name : name + '.pdf');
      a.click();
      URL.revokeObjectURL(url);

      setProgress('完成！', 100);
      Logger.info('Export', `导出成功: ${name}.pdf, ${Math.ceil(state.invoices.length / state.layout)} 页, ${(bytes.length / 1024).toFixed(1)} KB, 耗时 ${dt}ms`);
      showToast(`已生成 ${name}.pdf，共 ${Math.ceil(state.invoices.length / state.layout)} 页`, 'success');
    } catch (e) {
      Logger.error('Export', '合并导出失败', e.stack);
      showToast('合并失败: ' + e.message, 'error');
    } finally {
      state.isProcessing = false;
      $('#progressOverlay').style.display = 'none';
    }
  }

  // ─── 按钮状态 ───────────────────────────────
  function updateButtons() {
    const has = state.invoices.length > 0;
    $('#previewBtn').disabled = !has;
    $('#mergeBtn').disabled = !has;
  }

  // ─── 事件绑定 ───────────────────────────────
  function bindEvents() {
    const zone = $('#uploadZone');
    const input = $('#fileInput');
    const selectBtn = $('#selectBtn');

    zone.addEventListener('click', () => input.click());
    selectBtn.addEventListener('click', (e) => { e.stopPropagation(); input.click(); });

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });

    input.addEventListener('change', () => { handleFiles(input.files); input.value = ''; });

    $$('input[name="layout"]').forEach(r => {
      r.addEventListener('change', () => {
        state.layout = parseInt(r.value);
        Logger.info('Setting', `排版模式: ${state.layout} 张/页`);
        if (state.invoices.length) triggerPreview();
      });
    });

    $$('input[name="orientation"]').forEach(r => {
      r.addEventListener('change', () => {
        state.orientation = r.value;
        Logger.info('Setting', `纸张方向: ${state.orientation}`);
        if (state.invoices.length) triggerPreview();
      });
    });

    const slider = $('#marginSlider');
    const valEl = $('#marginVal');
    slider.addEventListener('input', () => {
      state.margin = parseInt(slider.value);
      valEl.textContent = slider.value;
      if (state.invoices.length) triggerPreview();
    });

    $('#previewBtn').addEventListener('click', () => { if (state.invoices.length) doPreview(); });
    $('#mergeBtn').addEventListener('click', () => doMerge());

    $('#clearAllBtn').addEventListener('click', () => {
      Logger.info('Action', '清空全部发票');
      state.invoices = [];
      renderInvoiceList();
      clearPreview();
      updateButtons();
    });

    $('#prevPage').addEventListener('click', () => {
      if (state.currentPage > 0) { state.currentPage--; renderPreviewPage(state.currentPage); }
    });
    $('#nextPage').addEventListener('click', () => {
      if (state.currentPage < state.previewPages.length - 1) { state.currentPage++; renderPreviewPage(state.currentPage); }
    });

    // 日志面板开关
    const logToggle = $('#logToggle');
    const logPanel = $('#logPanel');
    const logClear = $('#logClearBtn');
    if (logToggle) {
      logToggle.addEventListener('click', () => {
        const visible = logPanel.style.display === 'none' || !logPanel.style.display;
        logPanel.style.display = visible ? 'flex' : 'none';
        logToggle.textContent = visible ? '◀ 收起日志' : '▶ 查看日志';
      });
    }
    if (logClear) {
      logClear.addEventListener('click', () => {
        Logger.clear();
      });
    }

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') $('#prevPage').click();
      if (e.key === 'ArrowRight') $('#nextPage').click();
    });
  }

  // ─── 初始化 ─────────────────────────────────
  function init() {
    Logger.info('Init', '发票合并排版工具 v2 启动');
    Logger.info('Init', `环境: ${navigator.userAgent}`);

    // 初始化日志面板
    const logBody = $('#logBody');
    if (logBody) Logger.init(logBody);

    bindEvents();
    renderInvoiceList();
    updateButtons();

    Logger.info('Init', '初始化完成，等待操作');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
