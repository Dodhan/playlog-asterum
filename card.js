(function () {
  'use strict';

  const themes = [
    { id: 'yejun', name: '예준 · 블루', color: '#527fc3', deep: '#284b80', soft: '#e1ebf7', background: '#edf3fa', accent: '#c9dba5', ink: '#29415e' },
    { id: 'noah', name: '노아 · 라일락', color: '#9981b8', deep: '#5c4778', soft: '#eee7f5', background: '#f2edf7', accent: '#d4dba7', ink: '#4d4260' },
    { id: 'bamby', name: '밤비 · 로즈', color: '#cb8eaa', deep: '#8e506d', soft: '#f8e6ed', background: '#f9eff2', accent: '#d2dcae', ink: '#71485c' },
    { id: 'eunho', name: '은호 · 코랄', color: '#d07c70', deep: '#994f48', soft: '#f7e6de', background: '#fbf0e8', accent: '#d2dcb1', ink: '#76483e' },
    { id: 'hamin', name: '하민 · 세이지', color: '#70978a', deep: '#2f5148', soft: '#e1ede5', background: '#edf2e9', accent: '#d8c7a2', ink: '#314d43' }
  ];
  const paper = '#171d38';
  themes.forEach(t=>{t.ink='#f2edff';t.deep='#cfc1ed';t.soft='#272e4d';t.background='#10162e';});
  const sans = '"Playlog Sans", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const renderIds = new WeakMap();
  const imageCache = new Map();

  function rounded(ctx, x, y, w, h, radius, fill, stroke, lineWidth) {
    const r = Math.max(0, Math.min(radius, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth || 1; ctx.stroke(); }
  }
  function circle(ctx, x, y, radius, fill, stroke, width) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 1; ctx.stroke(); }
  }
  function line(ctx, x1, y1, x2, y2, color, width) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width || 1; ctx.stroke();
  }
  function text(ctx, value, x, y, size, color, weight, align, family) {
    ctx.font = (weight || 500) + ' ' + size + 'px ' + (family || sans);
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color; ctx.fillText(String(value), x, y);
  }
  function tracked(ctx, value, x, y, size, color, tracking, align) {
    ctx.font = '700 ' + size + 'px "Playlog Sans", Arial, sans-serif'; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const chars = Array.from(value), widths = chars.map(ch => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + Math.max(0, chars.length - 1) * tracking;
    let px = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    chars.forEach((ch, i) => { ctx.fillText(ch, px, y); px += widths[i] + tracking; });
  }
  function graphemes(value) {
    return typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(value), v => v.segment)
      : Array.from(value);
  }
  function clean(value, fallback) { return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim() || fallback || ''; }
  function fit(ctx, value, maxWidth, size, minimum, weight, family) {
    let current = size;
    for (; current > minimum; current--) { ctx.font = (weight || 700) + ' ' + current + 'px ' + (family || sans); if (ctx.measureText(value).width <= maxWidth) break; }
    ctx.font = (weight || 700) + ' ' + current + 'px ' + (family || sans);
    const chars = graphemes(value);
    if (ctx.measureText(value).width > maxWidth) {
      while (chars.length && ctx.measureText(chars.join('') + '…').width > maxWidth) chars.pop();
      return { value: chars.join('') + '…', size: current };
    }
    return { value, size: current };
  }
  function wrap(ctx, value, maxWidth) {
    const words = graphemes(value); const lines = []; let current = '';
    for (const ch of words) {
      if (ctx.measureText(current + ch).width > maxWidth && current) { lines.push(current.trim()); current = ch.trimStart(); }
      else current += ch;
    }
    if (current) lines.push(current.trim());
    return lines;
  }
  function titleBlock(ctx, value, x, y, maxWidth, size, maxLines, color, align) {
    let actual = size, lines;
    do { ctx.font = '800 ' + actual + 'px ' + sans; lines = wrap(ctx, value, maxWidth); if (lines.length <= maxLines) break; actual -= 2; } while (actual > 30);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = fit(ctx, lines[maxLines - 1] + '…', maxWidth, actual, actual, 800).value; }
    lines.forEach((value, i) => text(ctx, value, x, y + i * actual * 1.24, actual, color, 800, align));
    return { size: actual, bottom: y + (lines.length - 1) * actual * 1.24 };
  }
  function sparkle(ctx, x, y, size, color) {
    ctx.beginPath(); ctx.moveTo(x, y - size); ctx.bezierCurveTo(x + size * .15, y - size * .15, x + size * .15, y - size * .15, x + size, y);
    ctx.bezierCurveTo(x + size * .15, y + size * .15, x + size * .15, y + size * .15, x, y + size);
    ctx.bezierCurveTo(x - size * .15, y + size * .15, x - size * .15, y + size * .15, x - size, y);
    ctx.bezierCurveTo(x - size * .15, y - size * .15, x - size * .15, y - size * .15, x, y - size); ctx.fillStyle = color; ctx.fill();
  }
  function waves(ctx, x, y, color) {
    [12, 23, 36, 49, 30, 18, 36, 25, 12].forEach((height, i) => rounded(ctx, x + i * 12, y - height / 2, 5, height, 3, color));
  }
  function placeholder(ctx, x, y, size, theme) {
    ctx.save(); rounded(ctx, x, y, size, size, 20); ctx.clip();
    ctx.fillStyle = theme.soft; ctx.fillRect(x, y, size, size);
    // A cut-paper sleeve, a real grooved disc, and a small abstract audio wave.
    ctx.save(); ctx.translate(x + size * .23, y + size * .17); ctx.rotate(-.15);
    rounded(ctx, -size * .14, -size * .12, size * .55, size * .82, 7, theme.color); ctx.restore();
    circle(ctx, x + size * .56, y + size * .48, size * .335, theme.deep);
    for (let i = 0; i < 12; i++) circle(ctx, x + size * .56, y + size * .48, size * (.16 + i * .014), null, paper + '14', 1.5);
    ctx.save(); ctx.translate(x + size * .56, y + size * .48); ctx.rotate(-.55);
    ctx.beginPath(); ctx.arc(0, 0, size * .315, -1.05, -.15); ctx.strokeStyle = paper + '30'; ctx.lineWidth = size * .045; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, size * .315, Math.PI - 1.05, Math.PI - .15); ctx.stroke(); ctx.restore();
    circle(ctx, x + size * .56, y + size * .48, size * .115, theme.accent);
    circle(ctx, x + size * .56, y + size * .48, size * .025, paper);
    circle(ctx, x + size * .56, y + size * .48, size * .009, theme.deep);
    sparkle(ctx, x + size * .83, y + size * .18, size * .045, paper);
    sparkle(ctx, x + size * .18, y + size * .74, size * .034, theme.deep);
    tracked(ctx, 'ON REPEAT', x + size * .50, y + size * .88, size * .033, theme.deep, size * .008, 'center');
    text(ctx, 'PLAVE × PLLI', x + size * .50, y + size * .945, size * .025, theme.deep, 500, 'center');
    ctx.restore();
  }
  function cover(ctx, img, x, y, size, theme) {
    ctx.save(); ctx.shadowColor = theme.deep + '18'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 14;
    rounded(ctx, x - 11, y - 11, size + 22, size + 22, 25, paper); ctx.restore();
    if (img) {
      ctx.save(); rounded(ctx, x, y, size, size, 17); ctx.clip();
      const scale = Math.max(size / img.width, size / img.height), w = img.width * scale, h = img.height * scale;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h); ctx.restore();
    } else placeholder(ctx, x, y, size, theme);
    rounded(ctx, x - 11, y - 11, size + 22, size + 22, 25, null, theme.deep + '16', 1.5);
  }
  function loadCover(url) {
    if (!/^data:image\/(?:png|jpe?g|webp|gif|avif);/i.test(String(url || ''))) return Promise.resolve(null);
    if (imageCache.has(url)) return imageCache.get(url);
    const pending = new Promise(resolve => {
      const img = new Image(); let settled = false;
      const finish = value => { if (settled) return; settled = true; clearTimeout(timer); img.onload = img.onerror = null; resolve(value); };
      const timer = setTimeout(() => finish(null), 8000);
      img.onload = () => finish(img.width && img.height ? img : null); img.onerror = () => finish(null); img.src = url;
    });
    imageCache.set(url, pending); if (imageCache.size > 5) imageCache.delete(imageCache.keys().next().value);
    return pending;
  }
  function countValue(value) {
    const raw = clean(value, '').replace(/[,\s]/g, '');
    if (!/^\d+$/.test(raw)) return '—';
    return raw.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function dateValue(value) {
    const raw = clean(value, '날짜 미입력');
    const date = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    return date ? date[1] + '.' + date[2].padStart(2, '0') + '.' + date[3].padStart(2, '0') : raw.slice(0, 24);
  }
  function footer(ctx, data, theme, height) {
    const lineY = height - 181;
    line(ctx, 96, lineY, 984, lineY, theme.deep + '22', 1.5);
    text(ctx, 'RECORDED BY', 99, lineY + 40, 14, theme.deep + 'aa', 700, 'left', '"Playlog Sans", Arial, sans-serif');
    const nick = fit(ctx, clean(data.nickname, '나의 플레이리스트'), 535, 26, 19, 700);
    text(ctx, nick.value, 98, lineY + 79, nick.size, theme.ink, 700);
    text(ctx, dateValue(data.date), 982, lineY + 77, 25, theme.ink, 500, 'right', '"Playlog Sans", Arial, sans-serif');
    const source = clean(data.sourceLabel, '지니');
    text(ctx, (source === '지니' ? 'genie' : source.slice(0, 12)) + ' · 팬메이드 기록 카드', 98, height - 48, 17, theme.deep + 'ac', 500);
    text(ctx, data.verified ? '캡처 기준 · ' + dateValue(data.date) : '미리보기 · 저장 전 정보 확인', 982, height - 48, 17, theme.deep + 'ac', 500, 'right');
  }
  async function draw(canvas, data) {
    data = data || {}; if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('StreamCard.draw requires a canvas');
    const renderId = (renderIds.get(canvas) || 0) + 1; renderIds.set(canvas, renderId);
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) await document.fonts.ready;
    const image = await loadCover(data.coverDataUrl);
    if (renderIds.get(canvas) !== renderId) return;
    const square = data.format === 'square', height = square ? 1080 : 1350;
    const theme = themes.find(t => t.id === data.theme) || themes[1];
    canvas.width = 1080; canvas.height = height;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas 2D is unavailable');
    ctx.clearRect(0, 0, 1080, height); ctx.fillStyle = theme.background; ctx.fillRect(0, 0, 1080, height);
    // Asterum star field.
    for(let i=0;i<160;i++)circle(ctx,(i*173+31)%1080,(i*257+21)%height,i%9===0?2:1,'#e6ddff88');
    rounded(ctx, 45, 35, 990, height - 70, 34, paper, theme.deep + '20', 1.3);
    rounded(ctx, 57, 47, 966, height - 94, 25, null, theme.deep + '10', 1);
    for(let i=0;i<55;i++)circle(ctx,70+(i*173)%940,65+(i*251)%(height-130),i%8===0?1.8:1,'#e6ddff55');
    rounded(ctx, 94, 83, 285, 38, 19, theme.soft);
    tracked(ctx, 'ASTERUM / PLAYLOG', 237, 108, 12, theme.deep, 1.3, 'center');
    const platform=clean(data.sourceLabel,'지니');
    const badge=platform==='벅스'?{label:'벅스 · Bugs',color:'#ffb27e'}:platform==='FLO'?{label:'FLO · 플로',color:'#b7acff'}:{label:'지니 · genie',color:'#7bdcff'};
    rounded(ctx, 650, 76, 334, 100, 24, badge.color+'20',badge.color,2);
    text(ctx,badge.label,817,139,38,badge.color,800,'center');
    text(ctx, '나의 감상 기록', 96, 169, 31, theme.ink, 700);
    const title = clean(data.title, '오늘의 한 곡'), artist = clean(data.artist, '아티스트'), count = countValue(data.count);
    if (square) {
      cover(ctx, image, 108, 220, 416, theme);
      tracked(ctx, 'NOW PLAYING', 582, 239, 13, theme.deep + 'ac', 2.5);
      const titleInfo = titleBlock(ctx, title, 578, 307, 395, 48, 3, theme.ink, 'left');
      const artistFit = fit(ctx, artist, 390, 25, 19, 500);
      text(ctx, artistFit.value, 581, Math.max(408, titleInfo.bottom + 49), artistFit.size, theme.deep + 'bc', 500);
      line(ctx, 582, 484, 965, 484, theme.deep + '22', 1.5);
      tracked(ctx, 'A SONG TO REMEMBER', 582, 525, 12, theme.deep + 'a8', 1.3);
      text(ctx, 'PLAVE × PLLI', 581, 565, 22, theme.deep, 500);
      sparkle(ctx, 954, 605, 18, theme.color);
      rounded(ctx, 96, 690, 888, 160, 23, theme.soft);
      const countFit = fit(ctx, count, 620, 109, 48, 800, '"Playlog Sans", Arial, sans-serif');
      text(ctx, countFit.value, 130, 809, countFit.size, theme.deep, 800, 'left', '"Playlog Sans", Arial, sans-serif');
      tracked(ctx, 'PLAYS', 944, 765, 19, theme.deep, 4, 'right');
      text(ctx, (data.period||'감상 횟수'), 944, 808, 19, theme.deep + 'b8', 500, 'right');
    } else {
      // The album sits high, with airy framing and a count anchored low.
      cover(ctx, image, 284, 212, 512, theme);
      ctx.save(); ctx.translate(224, 469); ctx.rotate(-Math.PI / 2); tracked(ctx, 'PLAY. REPEAT. REMEMBER.', 0, 0, 11, theme.deep + '9b', 2.2, 'center'); ctx.restore();
      sparkle(ctx, 855, 238, 23, theme.color); sparkle(ctx, 836, 278, 10, theme.accent);
      circle(ctx, 853, 685, 10, theme.accent); circle(ctx, 872, 704, 5, theme.color);
      const titleInfo = titleBlock(ctx, title, 540, 795, 850, 54, 2, theme.ink, 'center');
      const artistFit = fit(ctx, artist, 810, 26, 19, 500);
      text(ctx, artistFit.value, 540, Math.min(914, titleInfo.bottom + 46), artistFit.size, theme.deep + 'bc', 500, 'center');
      rounded(ctx, 96, 953, 888, 166, 24, theme.soft);
      tracked(ctx, 'ON REPEAT', 131, 987, 12, theme.deep + 'b8', 2.3);
      const countFit = fit(ctx, count, 640, 112, 50, 800, '"Playlog Sans", Arial, sans-serif');
      text(ctx, countFit.value, 129, 1087, countFit.size, theme.deep, 800, 'left', '"Playlog Sans", Arial, sans-serif');
      tracked(ctx, 'PLAYS', 943, 1040, 20, theme.deep, 4, 'right');
      text(ctx, (data.period||'감상 횟수'), 943, 1083, 19, theme.deep + 'b8', 500, 'right');
    }
    footer(ctx, data, theme, height);
  }
  window.StreamCard = { themes, draw };
})();
