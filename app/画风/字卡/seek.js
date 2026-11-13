// 字卡画风（原 director.js，2026-11-07 搬进 画风/字卡/）：只读剧本 window.JUBEN 和画风参数 window.OPTS（配色），按句型搭画面；seek(t) 逐帧更新。
// 搭自己的 DOM（原 stage.html 里 #frame 的内容），样式在 样式.css。
document.getElementById('frame').innerHTML = `\n  <div id="bg"><div class="blob" id="b1"></div><div class="blob" id="b2"></div><div class="blob" id="b3"></div><div id="grid"></div></div>\n  <div id="top"><div id="tag"></div><div id="ttl"></div><div id="prog"><i></i></div></div>\n  <div id="stage"><div id="cam"></div></div>\n  <div id="sweep"></div>\n  <div id="subs"></div>\n  <div id="cover"></div>\n  <div id="grain"></div>\n  <div id="flash"></div>\n`;
const PL = Object.assign({}, window.JUBEN, window.OPTS || {});   // 剧本 + 配色（theme）
const THEMES = {
  night: { bg0: '#0A0F1F', bg1: '#16244A', ink: '#F4F6FF', sub: '#9AA6C6', acc: '#FFB21E', acc2: '#4D8DFF', bad: '#FF5468', good: '#2FD9A0',
    card: 'rgba(255,255,255,.07)', cardLine: 'rgba(255,255,255,.14)', line: 'rgba(255,255,255,.12)', accInk: '#1A1203', dot: 'rgba(255,255,255,.07)',
    subBg: 'transparent', subInk: '#FFFFFF', subStroke: '10px rgba(5,8,18,.9)', sweep: 'rgba(255,255,255,.10)', grain: .10,
    shadow: '0 30px 80px rgba(0,0,0,.35)', blobs: ['rgba(77,141,255,.30)', 'rgba(255,178,30,.16)', 'rgba(160,90,255,.20)'],
    x: { css: `.num{font-family:Noto,sans-serif!important;font-weight:900!important;letter-spacing:-2px!important}` } },   // 11-12 夜：大数字从 Arial 换成思源黑体 900（方案第六节）
  paper: { bg0: '#F3EDE2', bg1: '#E8DDCB', ink: '#1C1A16', sub: '#6F6658', acc: '#E2412B', acc2: '#2B59C3', bad: '#E2412B', good: '#1E8F55',
    card: '#FFFDF8', cardLine: 'rgba(28,26,22,.12)', line: 'rgba(28,26,22,.10)', accInk: '#FFFFFF', dot: 'rgba(28,26,22,.10)',
    subBg: 'rgba(255,253,248,.92)', subInk: '#1C1A16', subStroke: '0px transparent', sweep: 'rgba(255,255,255,.55)', grain: .16,
    shadow: '0 18px 50px rgba(60,40,10,.12)', blobs: ['rgba(226,65,43,.10)', 'rgba(43,89,195,.08)', 'rgba(230,180,90,.18)'] },
  mint: { bg0: '#E7F5EE', bg1: '#CBEAD9', ink: '#0F2A20', sub: '#58766A', acc: '#0E9F6E', acc2: '#FF7A30', bad: '#F0503C', good: '#0E9F6E',
    card: '#FFFFFF', cardLine: 'rgba(15,42,32,.10)', line: 'rgba(15,42,32,.10)', accInk: '#FFFFFF', dot: 'rgba(15,42,32,.09)',
    subBg: 'rgba(255,255,255,.92)', subInk: '#0F2A20', subStroke: '0px transparent', sweep: 'rgba(255,255,255,.6)', grain: .12,
    shadow: '0 18px 50px rgba(10,60,40,.12)', blobs: ['rgba(14,159,110,.20)', 'rgba(255,122,48,.14)', 'rgba(80,200,255,.16)'] },
  // 11-12 底色样片用的四套（方案第六节）：只有样片在用，软件的配色名单里没有。x 里是样子以外的东西：字体、质感、退后的上一句留几成、关不关外发光
  paper2: { bg0: '#F3EDE2', bg1: '#F3EDE2', ink: '#1C1A16', sub: '#5F574A', acc: '#8F5A00', acc2: '#2B59C3', bad: '#B8162E', good: '#1A7347',
    card: '#FFFDF8', cardLine: 'rgba(28,26,22,.12)', line: 'rgba(28,26,22,.10)', accInk: '#FFFFFF', dot: 'rgba(0,0,0,0)',
    subBg: 'rgba(255,253,248,.92)', subInk: '#1C1A16', subStroke: '0px transparent', sweep: 'rgba(255,255,255,.55)', grain: .16,
    shadow: '0 18px 50px rgba(60,40,10,.12)', blobs: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
    x: { back: .6, glow: false, fonts: ['900 100px Noto'], css: `#grain{background-position:0 0!important} .num{font-family:Noto,sans-serif!important;font-weight:900!important;letter-spacing:-2px!important}` } },
  grid: { bg0: '#F7F8FA', bg1: '#F7F8FA', ink: '#14181F', sub: '#586070', acc: '#1F4FB5', acc2: '#8F5A00', bad: '#B8162E', good: '#1A7347',
    card: '#FFFFFF', cardLine: 'rgba(20,24,31,.12)', line: 'rgba(20,24,31,.10)', accInk: '#FFFFFF', dot: 'rgba(0,0,0,0)',
    subBg: 'rgba(255,255,255,.92)', subInk: '#14181F', subStroke: '0px transparent', sweep: 'rgba(255,255,255,.6)', grain: 0,
    shadow: '0 14px 40px rgba(20,24,31,.10)', blobs: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
    x: { fit: .9, back: .6, glow: false, kinMax: 132, fonts: ['900 100px Noto', '700 44px Noto'], css: `#grain{background-position:0 0!important} #grid{background-image:linear-gradient(rgba(20,24,31,.07) 2px,transparent 2px),linear-gradient(90deg,rgba(20,24,31,.07) 2px,transparent 2px)!important;background-size:54px 54px!important;background-position:0 0!important;opacity:1!important}
      .kin,.big,#ttl,.stamp{font-family:Noto,sans-serif!important;font-weight:900!important} .num{font-family:Noto,sans-serif!important;font-weight:900!important;letter-spacing:-2px!important} #tag,.pill,[style*="Smiley"]{font-family:Noto,sans-serif!important;font-weight:700!important} #tag{line-height:53px!important}` } },
  inkserif: { bg0: '#0E0F12', bg1: '#0E0F12', ink: '#F3F1EA', sub: '#9A9EA6', acc: '#E9B44C', acc2: '#6FB1FF', bad: '#FF5E57', good: '#4FD6A6',
    card: 'rgba(255,255,255,.06)', cardLine: 'rgba(255,255,255,.12)', line: 'rgba(255,255,255,.12)', accInk: '#16110A', dot: 'rgba(0,0,0,0)',
    subBg: 'transparent', subInk: '#FFFFFF', subStroke: '10px rgba(5,6,8,.9)', sweep: 'rgba(255,255,255,.08)', grain: .05,
    shadow: '0 30px 80px rgba(0,0,0,.4)', blobs: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
    x: { fit: .9, back: .45, glow: false, fonts: ['700 100px Serif', '700 44px Noto'], css: `@font-face{font-family:Serif;src:url(fonts/SourceHanSerifCN-Bold.otf)}
      #grain{background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")!important;background-size:256px 256px!important;background-position:0 0!important;mix-blend-mode:normal!important}
      .kin,.big,#ttl,.stamp{font-family:Serif,Noto,sans-serif!important} .num{font-family:Serif,Noto,sans-serif!important;font-weight:700!important;letter-spacing:0!important} #tag,.pill,[style*="Smiley"]{font-family:Noto,sans-serif!important;font-weight:700!important}` } },
  mint2: { bg0: '#E7F5EE', bg1: '#E7F5EE', ink: '#0F2A20', sub: '#496559', acc: '#0A7550', acc2: '#2B59C3', bad: '#B8162E', good: '#0A7550',
    card: '#FFFFFF', cardLine: 'rgba(15,42,32,.10)', line: 'rgba(15,42,32,.10)', accInk: '#FFFFFF', dot: 'rgba(0,0,0,0)',
    subBg: 'rgba(255,255,255,.92)', subInk: '#0F2A20', subStroke: '0px transparent', sweep: 'rgba(255,255,255,.6)', grain: .12,
    shadow: '0 18px 50px rgba(10,60,40,.12)', blobs: ['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)'],
    x: { back: .6, glow: false, css: `#grain{background-position:0 0!important} .kin,.big,#ttl{font-family:Smiley,Noto,sans-serif!important} .num{font-family:Smiley,Noto,sans-serif!important;font-weight:400!important;font-variant-numeric:tabular-nums;letter-spacing:0!important} .cellnum{transform:translateX(-2px)}` } },   // 11-12：得意黑数字是斜的，装进格子上半截偏右 2 像素；往左挪 2，上半截正好居中（挪 4 过头，上半截反偏左）
};
const TH = THEMES[PL.theme] || THEMES.night;
for (const [k, v] of Object.entries(TH)) if (typeof v !== 'object') document.documentElement.style.setProperty('--' + k, v);
const TX = TH.x || {};   // 11-12 样片：配色自带的字体、质感
if (TX.css) { const st = document.createElement('style'); st.textContent = TX.css; document.head.appendChild(st); }
const $ = s => document.querySelector(s);
const CAM = $('#cam'), SUBS = $('#subs');
const LN = PL.lines, SCN = [], SHAKES = [];
// 第 5 步（11-07）：修改页删掉的东西字卡也认（公共/core.js 的 said）。字卡的大字就是原话，改不了；
// 能删的是：标亮的词（大字和字幕里变色的那个）、数字图（区间条、大数字）、段落图标。删了数字图，这段改成普通的大字卡。
const kwOf = li => LN[li].kw && said(li, LN[li].kw, '标亮') ? LN[li].kw : '';
function zkScene(s) {
  const num = s.type === 'range' ? rangeText(s) : s.type === 'stat' ? (s.raw || `${+s.value}${s.unit || ''}`) : null;
  const noRaw = s.type === 'range' ? !(s.rawLo && s.rawHi) : s.type === 'stat' ? !s.raw : false;   // 11-09 第三轮：抄不准字幕原文的数不画，这段改成普通大字卡
  if (num != null && (noRaw || !said(lineOf(num, s.la), num, s.type === 'range' ? '数字带子' : '数字'))) s = Object.assign({}, s, { type: 'say' });
  if (s.type === 'stat' && s.second) {                              // 「预算1000块 → 后来加到1500块」：第二个数也是一张大数字，登记在说到它的句子下，删了就不画
    const n2 = s.second.raw || `${+s.second.value}${s.second.unit || ''}`;
    if (!s.second.raw || !said(lineOf(n2, Math.min(s.la + 1, s.lb - 1)), n2, '数字')) s = Object.assign({}, s, { second: null });
  }
  if (s.icon) {
    if ((LN[s.la] || {}).noicon) s = Object.assign({}, s, { icon: s.type === 'hook' || s.type === 'myth' ? '无' : null });   // 这两种空着会补默认图标，给个画不出来的名字
  }
  if (s.items) { const dflt = null;   // 11-12 总控令：分项卡没配图标的项画序号（这一项自己的位置），不再补对勾；去掉图标的项也画序号
    s = Object.assign({}, s, { items: s.items.map(it => {     // 清单、分项里每条的小图标：登记在那条的句子下，去掉图标就不画
      const ic = it.icon || dflt; if (!ic) return it;
      let li = LN.findIndex(l => l.t0 === it.t); if (li < 0) li = lineOf(it.head || it.text || '', s.la);
      if ((LN[li] || {}).noicon) return Object.assign({}, it, { icon: dflt ? '无' : null });   // 「无」画不出来，分项卡就不会补对勾
      said(li, ic, '图标', ic); return Object.assign({}, it, { icon: ic });
    }) }); }
  if (s.type === 'year' && s.nodes) {                                // 年份大字：每个年份登记在说到它的句子下，删了就不画；全删了这段改成普通大字卡
    const nodes = s.nodes.filter(nd => said(lineOf(String(nd.year), s.la), nd.year + '年', '年份'));
    s = nodes.length ? Object.assign({}, s, { nodes }) : Object.assign({}, s, { type: 'say' });
  }
  if (s.kw) { let li = -1; for (let i = s.la; i < s.lb; i++) if (lineText(LN[i]).includes(s.kw)) { li = i; break; } if (li < 0 || !said(li, s.kw, '标亮')) s = Object.assign({}, s, { kw: '' }); }
  if (s.tpl) {   // 11-12 夜：模板也登记，修改页列成「模板」那颗签，点 × 去掉，这张卡照普通句卡出（带图形的那句仍单独一张）
    const nm = TPL_NAME[s.tpl.kind], lab = nm && (s.tpl.kind === 'ban' || s.tpl.kind === 'example' ? `${nm}：${s.tpl.word}` : nm);
    if (!lab || !said(s.tpl.line, lab, '模板')) s = Object.assign({}, s, { tpl: null });
  }
  return s;
}
const TPL_NAME = { ban: '圈加斜杠', example: '拎出来', time: '圆盘钟点', grow: '拉开' };   // 这一版只带这四种（planner 也只认这四种）
const CY = 400;
const KCY = 330;  // 大字中心：原 400，下沿会钻进右侧按钮列（画面 y≥1000），整体上提 70
// 舞台坐标 y≥455（画面 y≥1000）的字，右缘不过 880：居中 540 时宽度不超过 680
const SAFE_W = 640;  // 居中时右缘 860；镜头慢推 1.03 加晃动后仍在 880 以内
const fitW = (s, size, w = SAFE_W) => Math.min(size, (TX.fit || 1) * w / Math.max(1, ...String(plain(s)).split('\n').map(x => [...x].length)));
const lineText = l => l.cs.map(c => c[0]).join('');
const hl = s => String(s).replace(/\[\[(.+?)\]\]/g, '<span class="hl">$1</span>');
const plain = s => String(s).replace(/\[\[|\]\]/g, '');
// 结果句：一行放下时字号够大就一行；不够大就按 planner 给的词边界拆两行，字号按长的那行算
const bigB = (sc, max, w) => {
  const mk = s => sc.kw && s.includes(sc.kw) && sc.kw.length < sc.B.length ? s.replace(sc.kw, '[[' + sc.kw + ']]') : s;
  const one = Math.min(max, fitW(sc.B, 999, w)), k = sc.Bcut;
  if (k && one < max * 0.8) {
    const a = sc.B.slice(0, k), b = sc.B.slice(k), two = Math.min(max, fitW(a + '\n' + b, 999, w));
    if (two > one * 1.15) return { html: hl(mk(a)) + '<br>' + hl(mk(b)), size: two };
  }
  return { html: hl(mk(sc.B)), size: one };
};
// 一行只能缩成小字时，按 planner 给的词边界（cut）拆两行，字号按长的那行算
const fit2 = (text, cut, max, w) => {
  text = String(text); const one = Math.min(max, fitW(text, 999, w));
  if (cut && !text.includes('\n') && one < max * 0.8) {
    const a = text.slice(0, cut), b = text.slice(cut), two = Math.min(max, fitW(a + '\n' + b, 999, w));
    if (two > one * 1.15) return { html: hl(a) + '<br>' + hl(b), size: two, lines: 2 };
  }
  return { html: hl(text).replace(/\n/g, '<br>'), size: one, lines: text.split('\n').length };
};
const kwMask = (cs, kw) => { const txt = cs.map(c => c[0]).join(''), ki = kw ? txt.indexOf(kw) : -1; let off = 0;
  return cs.map(c => { const a = off; off += c[0].length; return ki >= 0 && a < ki + kw.length && off > ki; }); };
// 和公共 clamp 只差一处：上下限倒挂时（词宽过 1040 像素）它取上限，clamp 取下限；为画面一帧不变留着
const clampN = (v, a, b) => Math.min(Math.max(v, a), b);
const fmtN = (v, unit) => (Number.isInteger(v) ? v : v.toFixed(1)) + (unit || '');
let ZK_LINE = null, ZK_SKIP = new Set();   // 正在搭哪段（它第一句）；清单、分项里每条的图标另记在那条的句子下（zkScene），这里跳过
function icon(name, size, parent, style) {
  if (ZK_LINE != null && name && !ZK_SKIP.has(name)) {          // 画了才登记，修改页才列；这句去了图标，卡片自带的（星光、日历、一群人、对勾、警示牌）也不画
    if ((LN[ZK_LINE] || {}).noicon) name = '无'; else said(ZK_LINE, name, '图标', name);
  }
  const e = el('span', 'ic', ICONS[name] ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>` : '', parent,
    Object.assign({ width: size + 'px', height: size + 'px' }, style || {}));
  return e;
}
function drawOn(e) {  // 线条图标描边画出：k=0 看不见，k=1 画完
  const ps = [...e.querySelectorAll('path,circle,rect,line,polyline,polygon,ellipse')];
  ps.forEach(p => { p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1 1'; p.style.strokeDashoffset = '1'; });
  return k => ps.forEach((p, i) => { const kk = clamp(k * 1.35 - 0.35 * i / Math.max(1, ps.length - 1)); p.style.strokeDashoffset = (1 - kk).toFixed(4); p.style.opacity = kk > 0.001 ? 1 : 0; });
}
function abs(e, x, y, w) { Object.assign(e.style, { position: 'absolute', left: x + 'px', top: y + 'px' }); if (w) e.style.width = w + 'px'; return e; }
const kinSize = n => n <= 5 ? 150 : n <= 7 ? 128 : n <= 9 ? 108 : n <= 12 ? 92 : 84;
const txtSize = (s, big = 84) => { const n = Math.max(...String(plain(s)).split('\n').map(x => x.length)); return n <= 6 ? big : n <= 8 ? big * .86 : n <= 11 ? big * .74 : big * .64; };

// ---------- 逐字跳的大字 ----------
function kinLine(parent, li, size) {
  const l = LN[li], m = kwMask(l.cs, kwOf(li));
  const box = el('div', 'kin', null, parent, { fontSize: size + 'px', lineHeight: 1.16, top: '0px' });
  const nb = Array.isArray(l.nb) ? l.nb : [];          // 11-10 复审第 4 条：一个数块（「3分之1」）的字包进一个不折行的格子，折行只在块外
  let grp = null, gEnd = -1;
  const ch = l.cs.map((c, i) => {
    if (i >= gEnd) { grp = null; const b = nb.find(b => b[0] === i && b[1] - b[0] > 1); if (b) { grp = el('span', null, null, box, { whiteSpace: 'nowrap' }); gEnd = b[1]; } }
    const sp = el('span', null, c[0], grp || box);
    if (m[i]) Object.assign(sp.style, { color: 'var(--acc)', backgroundRepeat: 'no-repeat', backgroundSize: '0% 100%',
      backgroundImage: 'linear-gradient(transparent 64%, color-mix(in srgb, var(--acc) 24%, transparent) 64%, color-mix(in srgb, var(--acc) 24%, transparent) 94%, transparent 94%)' });
    return { e: sp, t: c[1], kw: m[i] };
  });
  return { box, ch, t0: l.t0, t1: l.t1, h: 0 };
}
function updChars(ch, t) {
  for (const c of ch) {
    const ct = c.tr != null ? c.tr : c.t;
    const k = P(t, ct - 0.07, ct + 0.2, E.outC), kb = P(t, ct - 0.07, ct + 0.32, E.outB);
    set(c.e, { o: k, y: (1 - k) * 40, s: 1.3 - 0.3 * kb, b: (1 - k) * 7 });
    if (c.kw) c.e.style.backgroundSize = (P(t, ct + 0.08, ct + 0.34, E.outC) * 100).toFixed(1) + '% 100%';
  }
}
function KinStack(sc, cy, maxSize = 150, opt = {}) {
  const blocks = [];
  for (let li = sc.la; li < sc.lb; li++) blocks.push(kinLine(sc.el, li, Math.min(maxSize, TX.kinMax || 999, kinSize(LN[li].cs.length) * (TX.fit || 1), opt.w ? fitW(lineText(LN[li]), 999, opt.w) : 999)));
  if (opt.w) blocks.forEach(b => Object.assign(b.box.style, { left: (opt.x != null ? opt.x : 540 - opt.w / 2) + 'px', width: opt.w + 'px' }));
  if (opt.align) blocks.forEach(b => { b.box.style.textAlign = opt.align; });
  const cap = sc.t1 - (sc.type === 'hook' ? 0.66 : 0.5);   // 退场开始前 0.2 秒，最后一个字要出完
  blocks.forEach(b => {
    const floor = Math.max(b.t0 - 0.45, Math.min(b.t0 - 0.08, cap - 0.045 * b.ch.length));
    let nx = cap + 0.045; for (let i = b.ch.length - 1; i >= 0; i--) { const c = b.ch[i]; c.tr = Math.max(floor, Math.min(c.t, nx - 0.045)); nx = c.tr; }
    b.ts = Math.min(b.t0, b.ch.length ? b.ch[0].tr + 0.08 : b.t0);
  });
  sc.measure.push(() => blocks.forEach(b => { b.h = b.box.offsetHeight; b.box.style.top = (cy - b.h / 2) + 'px'; }));
  return {
    blocks,
    upd(t) {
      blocks.forEach((b, k) => {
        if (t < b.ts - 0.1) { b.box.style.opacity = 0; return; }
        const n1 = blocks[k + 1], n2 = blocks[k + 2];
        const k1 = n1 ? P(t, n1.ts - 0.12, n1.ts + 0.3, E.outC) : 0, k2 = n2 ? P(t, n2.ts - 0.12, n2.ts + 0.3, E.outC) : 0;
        const up = k1 * (b.h * 0.29 + (n1 ? n1.h * 0.5 : 0) + 40) + k2 * (b.h * 0.2 + 120);
        const BK = TX.back != null ? TX.back : 0.38;
        set(b.box, { o: 1 - (1 - BK) * k1 - BK * k2, y: -up, s: 1 - 0.42 * k1 - 0.1 * k2 });
        updChars(b.ch, t);
      });
    }
  };
}

// ---------- 按意思挂的模板（11-12 小样：记号由剧本手写在普通句卡上 sc.tpl，字卡照记号画；不认识的记号、对不上的，照普通句卡出） ----------
// 方案：画风重做_2026-11-12/说法模板与底色_方案.md 第三、四节。舞台坐标 y + 545 = 画面 y；画面 y≥1000（舞台 455）以下右缘不过 870，图形横向中心放 490。
// 颜色只用配色里的六样：--ink 字色、--sub 灰字、--line 淡线色、--acc 重点色、--bad 坏色、--good 好色（方案第三节第 15 条）。
// 主动作做完的时刻算法，和草稿夹 模板小样\手排_第一批.py 里的一样（那边据此定换卡时刻），两边要一起改。
window.TPLLOG = [];
const TPL_Y = 215;                                    // 带图形的模板：句子中心（画面 760）；图形在画面 930–1300（舞台 385–755）
const TPL_GX = 490;                                   // 带图形的模板：图形横向中心
const tplDone = (sc, done) => window.TPLLOG.push({ line: sc.tpl.line, kind: sc.tpl.kind, done: +done.toFixed(3), t0: +sc.t0.toFixed(3), t1: +sc.t1.toFixed(3) });
const chT = (li, i) => LN[li].cs[Math.min(i, LN[li].cs.length - 1)][1];                // 第 i 个字开口
const chEnd = (li, i) => i + 1 < LN[li].cs.length ? LN[li].cs[i + 1][1] : LN[li].t1;  // 第 i 个字说完
const mixC = (a, b, k) => `color-mix(in srgb, ${b} ${(clamp(k) * 100).toFixed(1)}%, ${a})`;
function svgEl(tag, attrs, parent) { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (parent) parent.appendChild(e); return e; }
function svgBox(parent, x, y, w, h) { const s = svgEl('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}` }, parent); Object.assign(s.style, { position: 'absolute', left: x + 'px', top: y + 'px', overflow: 'visible', pointerEvents: 'none' }); return s; }
function dash(p, k) { if (!p._dl) { p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1 1'; p._dl = 1; } p.style.strokeDashoffset = (1 - clamp(k)).toFixed(4); p.style.opacity = k > 0.001 ? 1 : 0; }
function noKw(ch) { ch.forEach(c => { c.kw = false; c.e.style.color = ''; c.e.style.backgroundImage = 'none'; }); }   // 模板这句不再标亮：一屏颜色最多三种
function tplText(parent, li, a, b, size, color) {   // 这句 [a,b) 的字，逐字跳（和普通句卡同一套 updChars）；color 可以是「第几个字 → 颜色」
  const box = el('div', 'kin', null, parent, { fontSize: size + 'px', lineHeight: 1.16, top: '0px', whiteSpace: 'nowrap' });
  const ch = LN[li].cs.slice(a, b).map((c, j) => { const col = typeof color === 'function' ? color(a + j) : color; return { e: el('span', null, c[0], box, col ? { color: col } : null), t: c[1] }; });
  return { box, ch };
}
const inR = (rs, i) => (rs || []).some(r => i >= r[0] && i < r[1]);
// 禁止的圈和斜杠（11-12 夜盲审：斜杠两头伸到圈外、压住「孔」的右下角）：斜杠从圈心往左上、右下两头伸，伸到圈的里沿就停，
// 里沿 = 圈线的一半 6 + 斜杠圆头的一半 5，再让 5；圆角也算进去。斜杠粗 10（原 14；12 时量过「AA」右边那个字被盖住 22.5%，过了方案的两成）。
function banMarks(parent, x, y, w, h, rx) {
  const svg = svgBox(parent, x, y, w, h);
  const ring = svgEl('rect', { x: 0, y: 0, width: w, height: h, rx, fill: 'none', stroke: 'var(--bad)', 'stroke-width': 12 }, svg);
  const d = 16, hw = w / 2 - d, hh = h / 2 - d, ri = Math.max(0, rx - d), vx = w * 0.8, vy = h * 0.88, vl = Math.hypot(vx, vy), ux = vx / vl, uy = vy / vl;
  const inside = s => { const px = Math.abs(ux * s), py = Math.abs(uy * s); if (px > hw || py > hh) return false; const qx = Math.max(px - (hw - ri), 0), qy = Math.max(py - (hh - ri), 0); return qx * qx + qy * qy <= ri * ri; };
  let lo = 0, hi = Math.hypot(w, h); for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (inside(m)) lo = m; else hi = m; }
  const s = lo;
  const slash = svgEl('line', { x1: (w / 2 - ux * s).toFixed(2), y1: (h / 2 - uy * s).toFixed(2), x2: (w / 2 + ux * s).toFixed(2), y2: (h / 2 + uy * s).toFixed(2), stroke: 'var(--bad)', 'stroke-width': 10, 'stroke-linecap': 'round' }, svg);
  return { ring, slash };
}
const LIGHT = (h => { const n = parseInt(String(h).slice(1, 7), 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) > 140; })(TH.bg0);   // 浅底的样式
function tplRows(sc, rows) {   // 几行字（可以来自不同的句子），各自字号、哪几个字用重点色
  return rows.map(r => Object.assign(tplText(sc.el, r.line, r.a, r.b, r.size, i => inR(r.acc, i) ? 'var(--acc)' : null), { row: r }));
}
const TPL = {
  // 禁止·圈加斜杠（模板五变化一）：否定词一开口变坏色；被禁的词从第一个字开口起被长圆框围住，说完合上（至少 0.3 秒）；
  // 再压一道斜杠 0.12 秒，到位整张卡震一下。被禁的词保持字色。照普通句卡排字，后面的句子来时连同记号一起缩上去。
  ban(sc) {
    const tp = sc.tpl, li = tp.line, k = li - sc.la;
    if (tp.var !== 'slash' || k < 0 || li >= sc.lb) return null;
    sc.hideSubs = true;
    const ks = KinStack(sc, KCY), b = ks.blocks[k];
    noKw(b.ch);
    const neg = b.ch.slice(tp.neg[0], tp.neg[1]), obj = b.ch.slice(tp.obj[0], tp.obj[1]);
    const s0 = parseFloat(b.box.style.fontSize), fs = Math.min(s0, Math.floor(900 / (b.ch.length + 0.72))), gap = Math.round(fs * 0.36);
    b.box.style.fontSize = fs + 'px';                                          // 被圈的词前后各让出一点空，圈才不压到旁边的字；整行放不下就把字缩一点
    obj[0].e.style.marginLeft = gap + 'px'; obj[obj.length - 1].e.style.marginRight = gap + 'px';
    const tNeg = chT(li, tp.neg[0]), tO0 = chT(li, tp.obj[0]), tO1 = chEnd(li, tp.obj[1] - 1);
    const tRing = Math.max(tO0 + 0.3, Math.min(tO1, tO0 + 0.6)), tSl = tRing + 0.12;
    let ring = null, slash = null;
    sc.measure.push(() => {
      const r0 = obj[0].e, r1 = obj[obj.length - 1].e;
      const gh = r0.offsetHeight / 1.16, h = gh + 44, rx = h * 0.38, padX = Math.min(gap - 10, Math.max(30, rx - Math.sqrt(Math.max(0, (rx - 10) ** 2 - (rx - 22) ** 2))));   // 大圆角长框：字的四个角不顶圈，圈也不出让出的空
      const x = r0.offsetLeft - padX, w = r1.offsetLeft + r1.offsetWidth - r0.offsetLeft + padX * 2, y = r0.offsetTop + (r0.offsetHeight - h) / 2;
      ({ ring, slash } = banMarks(b.box, x, y, w, h, rx));
    });
    SHAKES.push([tSl, 10]); tplDone(sc, tSl);
    return t => {
      ks.upd(t);
      const kc = P(t, tNeg - 0.02, tNeg + 0.15, E.outC); neg.forEach(c => { c.e.style.color = mixC('var(--ink)', 'var(--bad)', kc); });
      if (ring) { dash(ring, P(t, tO0, tRing, E.ioQ)); dash(slash, P(t, tRing, tSl, E.outC)); }
    };
  },
  // 钱·数字格（模板二变化一）：钱数以外的字在上面；一位一格，格子从左到右立起来、数字往上滚；从数的第一个字开口起一格一格停住，
  // 最后一格停在数说完；停时平平一沉 6 像素再回正，不弹；然后一道重点色的线 0.25 秒从左画到右。单位照剧本原样写法。
  money(sc) {
    const tp = sc.tpl, li = tp.line;
    if (tp.var !== 'cells' || sc.la !== li || sc.lb !== li + 1) return null;
    const digits = LN[li].cs.slice(tp.num[0], tp.num[1]).map(c => c[0]);
    if (!digits.length || digits.length > 6 || !digits.every(d => /^[0-9]$/.test(d))) return null;
    sc.hideSubs = true;
    const n = digits.length, CW = 124, CH = 176, G = 12, ROW_Y = 400, RW = n * CW + (n - 1) * G;
    const pre = tplText(sc.el, li, tp.pre[0], tp.pre[1], 128);
    const post = tplText(sc.el, li, tp.post[0], tp.post[1], 120); post.box.style.width = 'max-content';
    const row = el('div', null, null, sc.el, { position: 'absolute', left: '0px', top: ROW_Y + 'px', width: RW + 'px', height: CH + 'px' });
    const cells = digits.map((d, i) => {
      const c = el('div', null, null, row, { position: 'absolute', left: i * (CW + G) + 'px', top: '0px', width: CW + 'px', height: CH + 'px', borderRadius: '20px',
        background: 'var(--line)', overflow: 'hidden', transformOrigin: '50% 100%' });
      const strip = el('div', null, null, c, { position: 'absolute', left: '0px', top: '0px', width: '100%' });
      for (let r = 0; r < 20; r++) el('div', 'num cellnum', String(r % 10), strip, { height: CH + 'px', lineHeight: CH + 'px', fontSize: '132px', textAlign: 'center', letterSpacing: '0px' });
      return { c, strip, d: +d };
    });
    const line = el('div', null, null, row, { position: 'absolute', left: '0px', top: (CH + 18) + 'px', height: '10px', borderRadius: '5px', background: 'var(--acc)', width: '0px' });
    const tUp = Math.max(LN[li].t0 - 0.05, sc.t0 - 0.12);                    // 格子起立、开始滚（卡晚进来的，跟着卡）
    const tN0 = chT(li, tp.num[0]), tN1 = tp.post[1] > tp.post[0] ? chT(li, tp.post[0]) : chEnd(li, tp.num[1] - 1);
    const stops = []; cells.forEach((_, i) => stops.push(Math.max(tN0 + (i + 1) * (tN1 - tN0) / n, tUp + i * 0.04 + 0.18 + 0.04, i ? stops[i - 1] + 0.05 : -1)));
    const tLine = stops[n - 1], tDone = tLine + 0.25, SPD = 18, TD = 0.12;   // 每秒滚 18 位，停前 0.12 秒减速
    const g = tau => tau >= TD ? SPD * (tau - TD / 2) : SPD * tau * tau / (2 * TD);
    sc.measure.push(() => {
      const pw = post.box.offsetWidth, tot = RW + 22 + pw, x0 = TPL_GX - tot / 2;
      row.style.left = x0 + 'px';
      Object.assign(post.box.style, { left: (x0 + RW + 22) + 'px', width: pw + 'px', textAlign: 'left', top: (ROW_Y + CH - post.box.offsetHeight * 0.9) + 'px' });
      Object.assign(pre.box.style, { top: (TPL_Y - pre.box.offsetHeight / 2) + 'px', left: (x0 + RW / 2 - 450) + 'px' });   // 钱数以外的字对着格子居中
    });
    tplDone(sc, tDone);
    return t => {
      updChars(pre.ch, t); updChars(post.ch, t);
      cells.forEach((c, i) => {
        const ku = P(t, tUp + i * 0.04, tUp + i * 0.04 + 0.18, E.outC);
        c.c.style.opacity = ku > 0.001 ? 1 : 0; c.c.style.transform = `scaleY(${Math.max(0.001, ku).toFixed(4)})`;
        const st = stops[i], f = 40 + c.d, o = t < st ? f - g(st - t) : f;
        const sink = t >= st ? 6 * Math.sin(Math.PI * P(t, st, st + 0.22, E.lin)) : 0;
        const om = ((o % 10) + 10) % 10;
        c.strip.style.transform = `translateY(${(-om * CH + sink).toFixed(2)}px)`;
        c.strip.style.color = t >= st ? 'var(--acc)' : 'var(--sub)';
        const bl = t < st ? 2 * clamp((st - t) / TD) : 0; c.strip.style.filter = bl > 0.05 ? `blur(${bl.toFixed(2)}px)` : 'none';
      });
      line.style.width = (P(t, tLine, tDone, E.outC) * RW).toFixed(1) + 'px';
    };
  },
  // 时间·圆盘钟点（模板一变化一）：开口时底圈和 12 个点 0.3 秒画出来，两根针指正上方；说到几点，短针从那个数开口前 0.1 秒起转，0.5 秒转到（越过一点再回来）；
  // 从正上方到那个钟点的一段圈是重点色，填上以后不再动。长针指正上方（几点半指正下方）。
  time(sc) {
    const tp = sc.tpl, li = tp.line;
    if (tp.var === 'bar') return timeBar(sc);
    if (tp.var !== 'clock' || sc.la !== li || sc.lb !== li + 1) return null;
    const cs = LN[li].cs, di = tp.digit != null ? tp.digit : cs.findIndex((c, i) => i >= tp.key[0] && i < tp.key[1] && /[0-9]/.test(c[0]));
    if (di < 0 || !(tp.hour >= 1 && tp.hour <= 12)) return null;
    sc.hideSubs = true; sc.el.dataset.tpl = 'time';   // 量帧用
    const n2 = cs.length - tp.key[1], s1 = Math.min(128, Math.floor(740 / tp.key[1])), s2 = n2 ? Math.min(84, Math.floor(740 / n2)) : 84;   // 11-12 夜：钟点前面有字的也带上（原来只写钟点，前面的字丢了）
    const L1 = tplText(sc.el, li, 0, tp.key[1], s1, i => i >= tp.key[0] ? 'var(--acc)' : null), L2 = tplText(sc.el, li, tp.key[1], cs.length, s2);
    const CX = TPL_GX, CY = 570, R = 163;                                      // 直径 340（含线粗），圆心画面 (490, 1115)
    const svg = svgBox(sc.el, CX - 200, CY - 200, 400, 400); svg.dataset.tplmark = 1;   // 量帧用
    const gr = svgEl('g', { transform: 'translate(200 200)' }, svg);
    const base = svgEl('circle', { cx: 0, cy: 0, r: R, fill: 'none', stroke: 'var(--line)', 'stroke-width': 14, transform: 'rotate(-90)' }, gr);
    const arc = svgEl('circle', { cx: 0, cy: 0, r: R, fill: 'none', stroke: 'var(--acc)', 'stroke-width': 14, transform: 'rotate(-90)', 'stroke-linecap': 'round' }, gr);
    const dots = [...Array(12)].map((_, i) => svgEl('circle', { cx: (Math.sin(i * Math.PI / 6) * 128).toFixed(2), cy: (-Math.cos(i * Math.PI / 6) * 128).toFixed(2), r: 6, fill: 'var(--sub)' }, gr));
    const hm = svgEl('line', { x1: 0, y1: 0, x2: 0, y2: -118, stroke: 'var(--ink)', 'stroke-width': 10, 'stroke-linecap': 'round' }, gr);
    const hh = svgEl('line', { x1: 0, y1: 0, x2: 0, y2: -84, stroke: 'var(--ink)', 'stroke-width': 16, 'stroke-linecap': 'round' }, gr);
    const hub = svgEl('circle', { cx: 0, cy: 0, r: 13, fill: 'var(--ink)' }, gr);
    const C = 2 * Math.PI * R;
    const tBase = LN[li].t0, tH = chT(li, di), A = (tp.hour % 12) * 30 + (tp.minute || 0) * 0.5, AM = (tp.minute || 0) * 6;
    const tH0 = tp.h0 != null ? tp.h0 : tH - 0.10, tH1 = tp.done != null ? tp.done : tH + 0.40;   // 11-12 夜：最晚在关键词最后一个字开口时转到（planner 算好）
    sc.measure.push(() => {
      Object.assign(L1.box.style, { top: (TPL_Y - (n2 ? 70 : 0) - L1.box.offsetHeight / 2) + 'px', left: (TPL_GX - 450) + 'px' });   // 字和圆盘对在同一条中线上
      Object.assign(L2.box.style, { top: (TPL_Y + 90 - L2.box.offsetHeight / 2) + 'px', left: (TPL_GX - 450) + 'px' });
    });
    tplDone(sc, tH1);
    return t => {
      updChars(L1.ch, t); updChars(L2.ch, t);
      const kb = P(t, tBase - 0.05, tBase + 0.25, E.outC);
      dash(base, kb); dots.forEach((d, i) => { d.style.opacity = P(t, tBase + i * 0.012, tBase + 0.2 + i * 0.012, E.outC).toFixed(3); });
      const ka = clamp((t - tH0) / (tH1 - tH0)), ang = A * (ka <= 0 ? 0 : E.outB(ka));
      hh.setAttribute('transform', `rotate(${ang.toFixed(2)})`); hm.setAttribute('transform', `rotate(${(AM * E.outC(ka)).toFixed(2)})`);
      const fill = Math.min(A, Math.max(0, ang)) / 360 * C; arc.style.strokeDasharray = `${fill.toFixed(2)} ${C.toFixed(2)}`; arc.style.opacity = fill > 0.5 ? 1 : 0;
      [hh, hm, hub].forEach(h => { h.style.opacity = kb.toFixed(3); });
    };
  },
};
// ---------- 模板第二批（11-12 小样）：注意·框住、时间·长条、增长·多出来的一截和拉开、举例·拎出来。接在第一批后面，同一套规矩 ----------
// 时间·长条（模板一变化三）：一根横轨（第 120 到 870 像素；11-12 总控令左头往里收 10，镜头推近时不出线；粗 20，圆头），开口时 0.3 秒画出来，重点色从左头往右走，右头淡出不封口。
// 走不完的（mode: 'endless'）：第 1 秒走到四成，之后越走越慢，到换卡还在挪；分两步的（mode: 'steps'）：说到哪个词走到哪儿，0.4 秒。
function timeBar(sc) {
  const tp = sc.tpl;
  if (!tp.rows || !(tp.mode === 'endless' || (tp.mode === 'steps' && tp.steps))) return null;
  sc.hideSubs = true;
  const R = tplRows(sc, tp.rows), Y = 570, X0 = 120, X1 = 870, W_ = X1 - X0;
  const track = el('div', null, null, sc.el, { position: 'absolute', left: X0 + 'px', top: (Y - 10) + 'px', width: W_ + 'px', height: '20px', borderRadius: '10px', background: 'var(--line)', transformOrigin: '0 50%' });
  const fill = el('div', null, null, track, { position: 'absolute', left: '0px', top: '0px', height: '20px', width: '0px', borderRadius: '10px 0 0 10px',
    background: 'linear-gradient(90deg, var(--acc) 0, var(--acc) calc(100% - 70px), color-mix(in srgb, var(--acc) 0%, transparent) 100%)' });
  const tB = LN[tp.rows[0].line].t0;
  let frac, tDone;
  if (tp.mode === 'endless') {
    const T = 1.07, A = 0.4 / (1 - Math.exp(-1 / T));
    frac = t => A * (1 - Math.exp(-Math.max(0, t - tB) / T));
    tDone = LN[tp.line].t1;                                                       // 走不完：算到关键词说完
  } else {
    const st = tp.steps.map(s => ({ t: chT(s.line, s.ch), to: s.to }));
    frac = t => { let f = 0; st.forEach(s => { f = f + (s.to - f) * P(t, s.t, s.t + 0.4, E.outC); }); return f; };
    tDone = st[st.length - 1].t + 0.4;
  }
  const two = R.length === 2 && tp.mode === 'steps', tR2 = two ? LN[tp.rows[1].line].t0 - 0.05 : 0;
  sc.measure.push(() => {
    R.forEach(r => { r.h = r.box.offsetHeight; r.box.style.left = (TPL_GX - 450) + 'px'; });
    if (two) { R[0].box.style.top = (TPL_Y - R[0].h / 2) + 'px'; R[1].box.style.top = (TPL_Y + 52 - R[1].h / 2) + 'px'; R[0].box.style.transformOrigin = '50% 50%'; }
    else { const hs = R.map(r => r.h * 0.86), tot = hs[0] + hs[1] + 20; R[0].box.style.top = (TPL_Y - tot / 2 - R[0].h * 0.07) + 'px'; R[1].box.style.top = (TPL_Y - tot / 2 + hs[0] + 20 - R[1].h * 0.07) + 'px'; }
  });
  tplDone(sc, tDone);
  return t => {
    R.forEach(r => updChars(r.ch, t));
    if (two) { const k2 = P(t, tR2, tR2 + 0.3, E.outC); R[0].box.style.transform = `translateY(${(-92 * k2).toFixed(1)}px) scale(${(1 - 0.3 * k2).toFixed(4)})`; }
    const kb = P(t, tB - 0.05, tB + 0.25, E.outC); track.style.transform = `scaleX(${Math.max(0.001, kb).toFixed(4)})`; track.style.opacity = kb > 0.001 ? 1 : 0;
    fill.style.width = (W_ * clamp(frac(t))).toFixed(1) + 'px';
  };
}
Object.assign(TPL, {
  // 注意·框住（模板四变化一）：关键词第一个字开口时起笔，从左上角顺时针画一个圆角框（线粗 10，四边各大 18），最后一个字说完时合上、不短于 0.3 秒；
  // 同时这句别的字淡到 45%（浅底 60%），整个卡片区朝关键词推近到 1.06 倍，0.5 秒。只动字，照普通句卡排。
  attn(sc) {
    const tp = sc.tpl, li = tp.line, k = li - sc.la;
    if (tp.var !== 'frame' || k < 0 || li >= sc.lb) return null;
    sc.hideSubs = true;
    const wrap = el('div', null, null, sc.el, { position: 'absolute', left: '0px', top: '0px', width: '1080px', height: '1000px' });
    const ks = KinStack({ el: wrap, la: sc.la, lb: sc.lb, t1: sc.t1, type: sc.type, measure: sc.measure }, KCY), b = ks.blocks[k];
    noKw(b.ch);
    const key = b.ch.slice(tp.key[0], tp.key[1]), rest = b.ch.filter((_, i) => i < tp.key[0] || i >= tp.key[1]);
    const tK0 = chT(li, tp.key[0]), tF = Math.max(tK0 + 0.3, chEnd(li, tp.key[1] - 1));
    const col = tp.color === 'bad' ? 'var(--bad)' : 'var(--acc)', DIM = LIGHT ? 0.6 : 0.45, PD = 18, GAP = PD + 14;
    // 11-12 第二版：框前后各让出一点空，框才不压到旁边的字；整行连让出的空放不下 860 宽（第 110 到 970 像素）就把字缩一点
    const s0 = parseFloat(b.box.style.fontSize), fs = Math.min(s0, Math.floor((860 - 2 * GAP) / b.ch.length));
    b.box.style.fontSize = fs + 'px';
    if (tp.key[0] > 0) key[0].e.style.marginLeft = GAP + 'px';
    if (tp.key[1] < b.ch.length) key[key.length - 1].e.style.marginRight = GAP + 'px';
    let frame = null, sF = 1.06;
    sc.measure.push(() => {
      const r0 = key[0].e, r1 = key[key.length - 1].e, gh = r0.offsetHeight / 1.16;
      const x = r0.offsetLeft - PD, w = r1.offsetLeft + r1.offsetWidth - r0.offsetLeft + 2 * PD, h = gh + 2 * PD, y = r0.offsetTop + (r0.offsetHeight - h) / 2;
      frame = svgEl('rect', { x: 0, y: 0, width: w, height: h, rx: Math.min(24, h / 4), fill: 'none', stroke: col, 'stroke-width': 10 }, svgBox(b.box, x, y, w, h));
      const ox = b.box.offsetLeft + x + w / 2, a0 = b.ch[0].e, a1 = b.ch[b.ch.length - 1].e;
      const L = Math.min(b.box.offsetLeft + a0.offsetLeft, ox - w / 2 - 5), R = Math.max(b.box.offsetLeft + a1.offsetLeft + a1.offsetWidth, ox + w / 2 + 5);
      sF = Math.max(1, Math.min(1.06, L < ox ? (ox - 110) / (ox - L) : 9, R > ox ? (970 - ox) / (R - ox) : 9));   // 推近到 1.06 倍，推了会出边就少推一点
      wrap.style.transformOrigin = `${ox}px ${b.box.offsetTop + y + h / 2}px`;   // 推近的中心对着关键词
    });
    tplDone(sc, tF);
    return t => {
      ks.upd(t);
      const kd = P(t, tK0 - 0.05, tK0 + 0.3, E.outC);
      rest.forEach(c => { c.e.style.opacity = (parseFloat(c.e.style.opacity || 1) * (1 - (1 - DIM) * kd)).toFixed(3); });
      if (frame) dash(frame, P(t, tK0, tF, E.ioQ));
      wrap.style.transform = `scale(${(1 + (sF - 1) * P(t, tK0, tK0 + 0.5, E.ioC)).toFixed(4)})`;
    };
  },
  // 增长（模板三）：变化二「多出来的一截」，灰条是原来的，说到数时右头长出重点色的一截，长度按数算；
  // 变化三「拉开」，两条线从左边同一点出发，灰的平着走，重点色的先贴着、说到那个词往上翘，两条同时到头，右头一道竖线标着中间的空当。
  grow(sc) {
    const tp = sc.tpl, li = tp.line;
    if (sc.la !== li || sc.lb !== li + 1 || !tp.rows) return null;
    sc.hideSubs = true; sc.el.dataset.tpl = 'grow';   // 量帧用
    const R = tplRows(sc, tp.rows.map(r => Object.assign({ line: li }, r))), GAP = 20;
    sc.measure.push(() => {
      const hs = R.map(r => r.box.offsetHeight * 0.86), tot = hs.reduce((a, b) => a + b, 0) + GAP * (R.length - 1);
      let y = TPL_Y - tot / 2; R.forEach((r, i) => { Object.assign(r.box.style, { top: (y - r.box.offsetHeight * 0.07) + 'px', left: (TPL_GX - 450) + 'px' }); y += hs[i] + GAP; });
    });
    const textUpd = t => R.forEach(r => updChars(r.ch, t));
    if (tp.var === 'extra') {
      const v = +tp.value; if (!(v >= 0.05 && v <= 9)) return null;
      const L0 = Math.min(640, 760 / (1 + v)), LX = L0 * v, X0 = TPL_GX - (L0 + LX) / 2, Y = 570, TK = 56;
      const base = el('div', null, null, sc.el, { position: 'absolute', left: X0 + 'px', top: (Y - TK / 2) + 'px', height: TK + 'px', width: '0px', borderRadius: `${TK / 2}px 0 0 ${TK / 2}px`, background: 'var(--sub)' });
      const ext = el('div', null, null, sc.el, { position: 'absolute', left: (X0 + L0) + 'px', top: (Y - TK / 2) + 'px', height: TK + 'px', width: '0px', borderRadius: `0 ${TK / 2}px ${TK / 2}px 0`, background: 'var(--acc)' });
      const tB = LN[li].t0, tN = chT(li, tp.num), tX = tN + 0.45;
      tplDone(sc, tX);
      return t => {
        textUpd(t);
        const kb = P(t, tB - 0.05, tB + 0.25, E.outC); base.style.width = (L0 * kb).toFixed(1) + 'px'; base.style.opacity = kb > 0.001 ? 1 : 0;
        ext.style.width = (LX * P(t, tN, tX, E.outC)).toFixed(1) + 'px';
      };
    }
    if (tp.var === 'spread') {
      const XA = 150, XB = 830, YB = 705, H = 280, KX = 3.2, OFF = 13;
      const svg = svgBox(sc.el, 0, 0, 1080, 1000); svg.dataset.tplmark = 1;   // 量帧用
      const grey = svgEl('polyline', { points: '', fill: 'none', stroke: 'var(--sub)', 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
      const acc = svgEl('polyline', { points: '', fill: 'none', stroke: 'var(--acc)', 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
      const gapL = svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: 'var(--sub)', 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
      const tS = chT(li, tp.start) - 0.10, tE = tp.done != null ? tp.done : LN[li].t1, tU = chT(li, tp.up);   // 11-12 夜：最晚在「差距」最后一个字开口时到头（planner 算好）
      const xs = XA + (XB - XA) * clamp((tU - tS) / (tE - tS));
      const yAcc = x => YB - OFF - (x <= xs ? 0 : H * (Math.exp(KX * (x - xs) / (XB - xs)) - 1) / (Math.exp(KX) - 1));
      tplDone(sc, tE);
      return t => {
        textUpd(t);
        const p = P(t, tS, tE, E.lin), xc = XA + (XB - XA) * p, on = p > 0.001;
        const pts = []; for (let x = XA; x < xc; x += 6) pts.push(x); if (on) pts.push(xc);
        grey.setAttribute('points', pts.map(x => `${x.toFixed(1)},${YB}`).join(' ')); acc.setAttribute('points', pts.map(x => `${x.toFixed(1)},${yAcc(x).toFixed(1)}`).join(' '));
        grey.style.opacity = acc.style.opacity = on ? 1 : 0;
        const ya = yAcc(xc); gapL.style.opacity = YB - OFF - ya > 18 ? 1 : 0;
        Object.entries({ x1: xc, x2: xc, y1: YB - 12, y2: ya + 12 }).forEach(([a, v]) => gapL.setAttribute(a, v.toFixed(1)));
      };
    }
    return null;
  },
  // 举例·拎出来（模板六变化一）：整句先照常跳出来；说完后 0.1 秒，被举的词离开原位往下落 150、放大（字高不超过 150）、变重点色，0.4 秒；
  // 留在上面的字缩到七成（11-12 总控令：六成时字高 22 不够 24）、变灰，原位留一个空；一根细竖线（粗 4，灰）把空位和下面的词连起来。只动字，照普通句卡排。
  example(sc) {
    const tp = sc.tpl, li = tp.line, k = li - sc.la;
    if (tp.var !== 'lift' || k < 0 || li >= sc.lb) return null;
    sc.hideSubs = true;
    const ks = KinStack(sc, KCY), b = ks.blocks[k];
    noKw(b.ch);
    const key = b.ch.slice(tp.key[0], tp.key[1]), rest = b.ch.filter((_, i) => i < tp.key[0] || i >= tp.key[1]);
    const tL = LN[li].t1 + 0.1, tL1 = tL + 0.4, DY = 150;
    const thread = el('div', null, null, b.box, { position: 'absolute', width: '4px', borderRadius: '2px', background: 'var(--sub)', opacity: 0 });
    let geo = null;
    sc.measure.push(() => {
      const fs = parseFloat(b.box.style.fontSize), S1 = Math.min(1.5, 150 / fs), r0 = key[0].e, r1 = key[key.length - 1].e, a0 = b.ch[0].e, a1 = b.ch[b.ch.length - 1].e;
      const kx = (r0.offsetLeft + r1.offsetLeft + r1.offsetWidth) / 2, cx = (a0.offsetLeft + a1.offsetLeft + a1.offsetWidth) / 2, h = r0.offsetHeight, ky = r0.offsetTop + h / 2;
      geo = { S1, kx, cx, ky, h, gx: cx + (kx - cx) * 0.7, rest: rest.map(c => c.e.offsetLeft + c.e.offsetWidth / 2), kc: key.map(c => c.e.offsetLeft + c.e.offsetWidth / 2) };
      b.h += DY * 0.75;   // 落下来的词算进这一句的高度：后面的句子来时多让一点，别压上
    });
    tplDone(sc, tL1);
    return t => {
      ks.upd(t);
      const kl = P(t, tL, tL1, E.outC); if (!geo || kl <= 0) return;
      const g = geo, gx = g.cx + (g.gx - g.cx) * kl;
      rest.forEach((c, i) => { c.e.style.transform = `translate(${((g.cx - g.rest[i]) * 0.3 * kl).toFixed(2)}px,0) scale(${(1 - 0.3 * kl).toFixed(4)})`; c.e.style.color = mixC('var(--ink)', 'var(--sub)', kl); });
      key.forEach((c, j) => { const dx = (g.gx - g.kx) * kl + (g.kc[j] - g.kx) * (g.S1 - 1) * kl; c.e.style.transform = `translate(${dx.toFixed(2)}px,${(DY * kl).toFixed(2)}px) scale(${(1 + (g.S1 - 1) * kl).toFixed(4)})`; c.e.style.color = 'var(--acc)'; });
      const top = g.ky + g.h * 0.3, bot = g.ky + DY * kl - g.h * g.S1 * 0.42;
      Object.assign(thread.style, { left: (gx - 2).toFixed(1) + 'px', top: top.toFixed(1) + 'px', height: Math.max(0, bot - top).toFixed(1) + 'px', opacity: P(t, tL1 - 0.15, tL1, E.outC).toFixed(3) });
    };
  },
});

// ---------- 普通句卡改法一（11-12 夜按总控令改主次）：所有普通句卡一个排法。第二步起默认开，OPTS.para12 === false 才走老的三种轮换 ----------
// 字号：一张卡里统一，按这张卡最长的一排定。一排最多八个字（一句的卡七个），超了按排卡程序算的折点折行（planner.para_fold，按词折）。
//   字号 = 720 ÷ 最长一排的字宽（一句的卡 640 ÷），上限 120、下限 90（11-12 夜总控改：原来下限 72，说过的缩到 360 宽只剩 19 像素高）。
//   字宽：中文一个字算 1，字母数字算 0.62，和 planner._uw 一个算法。一张卡这样排装不下的，排卡程序已经拆成两张。
// 正在说的那句：原大、字色、重点词用重点色。说过的：原地缩到八成（左上角不动），变灰，重点词颜色收掉。
// 变灰和冒头同一刻（11-12 夜总控定）：下一句第一个字开始冒头的那一刻，上一句开始缩小变灰，0.3 秒做完；竖线也在这一刻往下长。屏上一直有一句是亮的。
// 下一句排在上一句缩小后的正下方。整段位置按最后停住的样子先算好：镜头最多推近 1.03 倍，推近后上不过画面 580、下不过 1300、右不过 870。
// 只装一句的卡：居中，按词折行，字号同样的上下限。
// 有图标的卡：图标放到这段字下面的空处，淡淡的，不压字；放不下就不挂。
// 整段的中心：画面 740（第一步交了 740 和 800 两个给总控挑，先用推荐的 740；OPTS.paraCY 可改）。
// 禁止、举例两种模板接在这个排法里（第二步）：这句说完变灰缩小时，圈、斜杠、拎出来的词跟着留在原地，一直留到这张卡结束。
const P12 = PL.para12 !== false;
const PARA_X = 136, PARA_W = 720, PARA_SHR = 0.8, PARA_TOP = 46, PARA_BOT = 744;
const PARA_ROW = 8, PARA_ROW1 = 7, PARA_MIN = 90, PARA_MAX = 120;   // 一排最多八个字（一句的卡七个）；字号 90 到 120
const paraCY = () => (+PL.paraCY || 740) - 545;   // 画面 y 换成舞台 y
const uW = u => [...u].reduce((a, ch) => a + (ch.codePointAt(0) >= 0x2e80 ? 1 : 0.62), 0);   // 字宽：中文 1、字母数字 0.62
const paraRows = (l, cuts) => { const b = [0, ...cuts, l.cs.length], r = []; for (let i = 1; i < b.length; i++) r.push(l.cs.slice(b[i - 1], b[i]).reduce((a, c) => a + uW(c[0]), 0)); return r; };
// 旧剧本没有排卡程序算的折点时自己折：每排不超过 m，不切开重点词、上屏词和数块，新一排不拿「的了呀啊吧呢」开头（实在折不出来才放开）；排数最少，再比最长那排最短
function paraCut(l, m) {
  const s = l.cs.map(c => c[0]), n = s.length, str = s.join(''), spans = (l.nb || []).slice(), pos = [0];
  s.forEach(u => pos.push(pos[pos.length - 1] + u.length));
  const add = w => { if (!w) return; let i = str.indexOf(w); while (i >= 0) { const a = pos.findIndex(p => p > i) - 1, e = pos.findIndex(p => p >= i + w.length); spans.push([a, e < 0 ? n : e]); i = str.indexOf(w, i + 1); } };
  add(l.kw); add(l.word); (l.show || []).forEach(x => add(x.text));
  const w = s.map(uW), pre = [0]; w.forEach(x => pre.push(pre[pre.length - 1] + x));
  for (const strict of [true, false]) {
    const f = Array(n + 1).fill(null); f[0] = { r: 0, mx: 0, cuts: [] };
    for (let i = 1; i <= n; i++) {
      if (i < n && (spans.some(([a, e]) => i > a && i < e) || (strict && '的了呀啊吧呢'.includes(s[i][0])))) continue;
      for (let j = 0; j < i; j++) {
        if (!f[j] || pre[i] - pre[j] > m + 1e-6) continue;
        const c = { r: f[j].r + 1, mx: Math.max(f[j].mx, pre[i] - pre[j]), cuts: j ? [...f[j].cuts, j] : [] };
        if (!f[i] || c.r < f[i].r || (c.r === f[i].r && c.mx < f[i].mx - 1e-6)) f[i] = c;
      }
    }
    if (f[n]) return f[n].cuts;
  }
  const out = []; let acc = 0; w.forEach((x, k) => { if (k && acc + x > m + 1e-6) { out.push(k); acc = 0; } acc += x; }); return out;
}
// 在哪折：先用排卡程序算的折点（pcut，列表，第几个字块前折），每排都不超过 m 才用；
// 旧剧本（pcut 是一个数或者没有）：字幕折行点 brk 折出来两排都不超过 m 就用（第二排拿「的了呀啊吧呢」开头的，这个字挪回第一排），再不行自己折
const paraCuts = (l, m) => {
  const n = l.cs.length; if (paraRows(l, [])[0] <= m + 1e-6) return [];
  const ok = cs => cs.length > 0 && cs.every((c, i) => c > (i ? cs[i - 1] : 0) && c < n) && Math.max(...paraRows(l, cs)) <= m + 1e-6;
  if (Array.isArray(l.pcut) && ok(l.pcut)) return l.pcut;
  if (l.brk) { const c = '的了呀啊吧呢'.includes((l.cs[l.brk] || [''])[0]) && ok([l.brk + 1]) ? l.brk + 1 : l.brk; if (ok([c])) return [c]; }
  return paraCut(l, m);
};
const paraFont = (rows, w) => clampN(Math.floor(w / Math.max(1, ...rows)), PARA_MIN, PARA_MAX);
function foldAt(b, cuts) { b.box.style.whiteSpace = 'nowrap'; b.box.style.textWrap = 'nowrap'; (cuts || []).forEach(cut => { const e = b.ch[cut - 1].e, host = e.parentElement !== b.box ? e.parentElement : e; host.after(document.createElement('br')); }); }
function sayPara(sc) {
  const X = PARA_X, W = PARA_W, SHR = PARA_SHR, TOP = PARA_TOP, BOT = PARA_BOT, CYs = paraCY();
  const ks = KinStack(sc, CYs), bl = ks.blocks;   // 借它造字、算每个字跳出来的时刻；位置和动法这里自己管
  const ls = bl.map((_, k) => LN[sc.la + k]), one = bl.length === 1;
  const W1 = one ? 700 : W, RW = one ? 640 : W;   // 一句的居中：宽 700；排出来的字最宽 640（推近后右边才不过 870），多句的最宽 720
  let tp = sc.tpl && (sc.tpl.kind === 'ban' || sc.tpl.kind === 'example') ? sc.tpl : null;
  const tk = tp ? tp.line - sc.la : -1, tb = tp && tk >= 0 && tk < bl.length ? bl[tk] : null;
  if (!tb) tp = null;
  const lim = k => (one ? PARA_ROW1 : PARA_ROW) - (tp && tp.kind === 'ban' && k === tk ? 1 : 0);   // 禁止那句被圈的词两边要让空：一排再少一个字
  const cuts = ls.map((l, k) => paraCuts(l, lim(k)));
  let fs = paraFont(ls.flatMap((l, k) => paraRows(l, cuts[k])), RW);
  if (tp && tp.kind === 'ban') {   // 被圈的词前后各让出 0.36 个字的空，圈才不压到旁边的字；那一排连让出的空放不下就把整卡的字缩一点，缩到 90 还放不下就不用模板
    const bd = [0, ...cuts[tk], ls[tk].cs.length], [o0, o1] = tp.obj, r = bd.findIndex((c, i) => i < bd.length - 1 && c <= o0 && o0 < bd[i + 1]);
    const row = r >= 0 && o1 <= bd[r + 1] ? paraRows(ls[tk], cuts[tk])[r] : 0;
    const f2 = row ? Math.floor(RW / (row + 0.72)) : 0;
    if (f2 < PARA_MIN) tp = null; else fs = Math.min(fs, f2);
  }
  if (tp) tb.box.dataset.tpl = tp.kind;   // 量帧用：模板那句的框
  let G = Math.round(fs * 0.3);
  bl.forEach((b, k) => {
    Object.assign(b.box.style, { left: (one ? 540 - W1 / 2 : X) + 'px', width: W1 + 'px', textAlign: one ? 'center' : 'left', transformOrigin: one ? '50% 0' : '0 0',
      fontSize: fs + 'px', whiteSpace: 'nowrap', textWrap: 'nowrap' });
    foldAt(b, cuts[k]);
  });
  // 两种只动字的模板（11-12 夜第二步）：主动作做完的时刻和 planner._tpl_time 一个算法
  let ban = null, lift = null;
  if (tp) noKw(tb.ch);                                     // 模板这句不再标亮：一屏颜色最多三种
  if (tp && tp.kind === 'ban') {
    const li = tp.line, neg = tb.ch.slice(tp.neg[0], tp.neg[1]), obj = tb.ch.slice(tp.obj[0], tp.obj[1]), gap = Math.round(fs * 0.36);
    obj[0].e.style.marginLeft = gap + 'px'; obj[obj.length - 1].e.style.marginRight = gap + 'px';
    const tNeg = chT(li, tp.neg[0]), tO0 = chT(li, tp.obj[0]), tO1 = chEnd(li, tp.obj[1] - 1);
    const tRing = tp.early ? tO0 + 0.3 : Math.max(tO0 + 0.3, Math.min(tO1, tO0 + 0.6)), tSl = tRing + 0.12;   // 11-12 夜盲审七处之三：停不够时提早（被圈的词一开口起笔，0.3 秒合上）；planner._text_done 同一算法
    ban = { neg, obj, gap, tNeg, tO0, tRing, tSl, ring: null, slash: null };
    tplDone(sc, tSl);   // 不再震：斜杠压完，大样子原样停住（盲审把震的那 0.35 秒读成还没画完）
  }
  if (tp && tp.kind === 'example') {
    const key = tb.ch.slice(tp.key[0], tp.key[1]), rest = tb.ch.filter((_, i) => i < tp.key[0] || i >= tp.key[1]);
    const tL = tp.early ? chT(tp.line, tp.key[0]) : LN[tp.line].t1 + 0.1, tL1 = tL + 0.4, DY = 150;   // 11-12 夜盲审七处之三：停不够时提早，被举的词一开口就往下拎；planner._text_done 同一算法
    const thread = el('div', null, null, tb.box, { position: 'absolute', width: '4px', borderRadius: '2px', background: 'var(--sub)', opacity: 0 });
    thread.dataset.tplmark = 1; key.forEach(c => { c.e.dataset.tplmark = 1; });   // 量帧用：主动作是被举的词和细线
    lift = { key, rest, tL, tL1, DY, thread, g: null };
    tplDone(sc, tL1);
  }
  const bar = one ? null : el('div', null, null, sc.el, { position: 'absolute', left: '96px', top: '0px', width: '14px', height: '0px', background: 'var(--acc)', borderRadius: '7px' });
  const ic = sc.icon ? icon(sc.icon, 200, sc.el, { position: 'absolute', left: '0px', top: '0px', opacity: 0, color: 'var(--acc)' }) : null;
  const dw = ic ? drawOn(ic) : null;
  let geo = null;
  sc.measure.push(() => {
    let rw0 = 0; bl.forEach(b => { let a = 1e9, e = -1e9; b.ch.forEach(c => { a = Math.min(a, c.e.offsetLeft); e = Math.max(e, c.e.offsetLeft + c.e.offsetWidth); }); rw0 = Math.max(rw0, one ? e - a : e); });
    if (rw0 > RW + 1 && fs > PARA_MIN) {   // 排出来比放得下的宽（字比算的宽的样式）：整卡字缩一点，不小于 90
      fs = Math.max(PARA_MIN, Math.floor(fs * RW / rw0)); G = Math.round(fs * 0.3);
      bl.forEach(b => { b.box.style.fontSize = fs + 'px'; });
      if (ban) { ban.gap = Math.round(fs * 0.36); ban.obj[0].e.style.marginLeft = ban.gap + 'px'; ban.obj[ban.obj.length - 1].e.style.marginRight = ban.gap + 'px'; }
    }
    // 11-12 夜盲审七处之四：停住时高装不下，先缩字，缩到 90 为止，还装不下才拆（拆在 planner；para_card 同一算法，拎出来那句按落下来的词算高）
    const estH = () => { const hs = bl.map(b => b.box.offsetHeight); if (lift) { const h1 = fs * 1.16; hs[tk] = Math.max(hs[tk], h1 / 2 + 150 + h1 * Math.min(1.5, 150 / fs) / 2 + 6); } return hs.reduce((a, h, k) => a + (k < hs.length - 1 ? h * SHR + G : h), 0); };
    for (let n = 0; n < 40 && fs > PARA_MIN && estH() > BOT - TOP; n++) {
      fs -= 1; G = Math.round(fs * 0.3); bl.forEach(b => { b.box.style.fontSize = fs + 'px'; });
      if (ban) { ban.gap = Math.round(fs * 0.36); ban.obj[0].e.style.marginLeft = ban.gap + 'px'; ban.obj[ban.obj.length - 1].e.style.marginRight = ban.gap + 'px'; }
    }
    if (ban) {   // 大圆角长框：字的四个角不顶圈，圈也不出让出的空
      const r0 = ban.obj[0].e, r1 = ban.obj[ban.obj.length - 1].e;
      const gh = r0.offsetHeight / 1.16, h = gh + 44, rx = h * 0.38, padX = Math.min(ban.gap - 10, Math.max(30, rx - Math.sqrt(Math.max(0, (rx - 10) ** 2 - (rx - 22) ** 2))));
      const x = r0.offsetLeft - padX, w = r1.offsetLeft + r1.offsetWidth - r0.offsetLeft + padX * 2, y = r0.offsetTop + (r0.offsetHeight - h) / 2;
      Object.assign(ban, banMarks(tb.box, x, y, w, h, rx)); ban.ring.ownerSVGElement.dataset.tplmark = 1;   // 量帧用：主动作的笔画
    }
    const hs = bl.map(b => b.box.offsetHeight);
    if (lift) {   // 拎下来的词算进这一句的高度：下一句排在它下面，不压上
      const S1 = Math.min(1.5, 150 / fs), r0 = lift.key[0].e, r1 = lift.key[lift.key.length - 1].e, a0 = tb.ch[0].e, a1 = tb.ch[tb.ch.length - 1].e;
      const kx = (r0.offsetLeft + r1.offsetLeft + r1.offsetWidth) / 2, cx = (a0.offsetLeft + a1.offsetLeft + a1.offsetWidth) / 2, h = r0.offsetHeight, ky = r0.offsetTop + h / 2;
      const RS = Math.max(0.7, 72 / fs), ax = one ? cx : a0.offsetLeft;   // 11-12 夜盲审七处之三：剩下那排缩完不小于 72 号；多句的卡朝左边缩，和上下几排左边对齐（一句的卡朝中间）
      lift.g = { S1, RS, ax, kx, cx, ky, h, gx: ax + (kx - ax) * RS, rest: lift.rest.map(c => c.e.offsetLeft + c.e.offsetWidth / 2), kc: lift.key.map(c => c.e.offsetLeft + c.e.offsetWidth / 2) };
      hs[tk] = Math.max(hs[tk], ky + lift.DY + h * S1 / 2 + 6);
    }
    const H = hs.reduce((a, h, k) => a + (k < hs.length - 1 ? h * SHR + G : h), 0);
    let y = Math.max(TOP, Math.min(BOT - H, CYs - H / 2));
    const ys = hs.map(h => { const r = y; y += h * SHR + G; return r; });
    bl.forEach((b, k) => { b.box.style.top = ys[k].toFixed(1) + 'px'; });
    const bottom = ys[ys.length - 1] + hs[hs.length - 1];
    geo = { ys, hs, top: ys[0] + hs[0] * 0.07, ic: false };
    sc.paraH = H; sc.paraFs = fs; sc.paraRows = cuts.map(c => c.length + 1);   // 样片量高、量字号用：高超过 698 装不下
    if (ic) {   // 图标放在字下面的空处：离字 50，最大 220，放不下 140 就不挂
      const sz = Math.min(220, BOT - bottom - 60);
      if (sz < 140) ic.style.display = 'none';
      else {
        let rw = 0; bl.forEach(b => b.ch.forEach(c => { rw = Math.max(rw, c.e.offsetLeft + c.e.offsetWidth); }));
        const cx = one ? 540 : X + Math.min(W, rw) / 2;
        Object.assign(ic.style, { width: sz + 'px', height: sz + 'px', left: (cx - sz / 2).toFixed(1) + 'px', top: (bottom + 50).toFixed(1) + 'px' });
        geo.ic = true;
      }
    }
  });
  const base = bl.map(b => b.ch.map(c => c.kw ? 'var(--acc)' : 'var(--ink)'));
  const tIn = k => (bl[k].ch.length ? bl[k].ch[0].tr : bl[k].t0) - 0.07;   // 这句第一个字开始冒头（updChars 里字从 tr 前 0.07 秒起跳）
  const shr = (k, t) => bl[k + 1] ? P(t, tIn(k + 1), tIn(k + 1) + 0.3, E.outC) : 0;   // 下一句冒头的同一刻，上一句开始缩小变灰，0.3 秒做完
  return t => {
    bl.forEach((b, k) => {
      b.box.style.opacity = t < tIn(k) ? 0 : 1;
      updChars(b.ch, t);
      const g = shr(k, t);
      b.box.style.transform = g > 0 ? `scale(${(1 - (1 - SHR) * g).toFixed(4)})` : '';
      b.ch.forEach((c, i) => { c.e.style.color = g > 0 ? mixC(base[k][i], 'var(--sub)', g) : base[k][i]; if (c.kw && g > 0) c.e.style.backgroundSize = ((1 - g) * parseFloat(c.e.style.backgroundSize || 100)).toFixed(1) + '% 100%'; });
    });
    if (ban) {   // 否定词一开口变坏色，缩小变灰时也不褪；圈从被禁的词第一个字开口起画，说完合上；再压一道斜杠
      const kc = P(t, ban.tNeg - 0.02, ban.tNeg + 0.15, E.outC); ban.neg.forEach(c => { c.e.style.color = mixC('var(--ink)', 'var(--bad)', kc); });
      if (ban.ring) { dash(ban.ring, P(t, ban.tO0, ban.tRing, E.ioQ)); dash(ban.slash, P(t, ban.tRing, ban.tSl, E.outC)); }
    }
    if (lift && lift.g) {   // 说完后 0.1 秒，被举的词往下落 150、放大、变重点色；别的字缩到七成、变灰；一根细竖线连着空位和落下来的词。缩上去以后照样留着
      // 11-12 夜盲审七处之三：这句缩灰时，落下来的词缩回原大、剩下的字回到原样（缩灰以后「淘宝」不比正在说的那句大，剩下的字不小于 72 号）；提早做时字还在冒，冒的动作照算
      const kl = P(t, lift.tL, lift.tL1, E.outC);
      if (kl > 0) {
        const L = lift, g = L.g, gs = shr(tk, t), rs = 1 - (1 - g.RS) * kl * (1 - gs), S = 1 + (g.S1 - 1) * kl * (1 - gs), gx = g.ax + (g.kx - g.ax) * rs;
        const pop = c => { const ct = c.tr != null ? c.tr : c.t; return [(1 - P(t, ct - 0.07, ct + 0.2, E.outC)) * 40, 1.3 - 0.3 * P(t, ct - 0.07, ct + 0.32, E.outB)]; };
        L.rest.forEach((c, i) => { const [py, ps] = pop(c); c.e.style.transform = `translate(${((g.ax - g.rest[i]) * (1 - rs)).toFixed(2)}px,${py.toFixed(2)}px) scale(${(rs * ps).toFixed(4)})`; c.e.style.color = mixC('var(--ink)', 'var(--sub)', Math.max(kl, gs)); });
        L.key.forEach((c, j) => { const [py, ps] = pop(c), dx = (gx - g.kx) + (g.kc[j] - g.kx) * (S - 1); c.e.style.transform = `translate(${dx.toFixed(2)}px,${(L.DY * kl + py).toFixed(2)}px) scale(${(S * ps).toFixed(4)})`; c.e.style.color = 'var(--acc)'; });
        const top = g.ky + g.h * 0.3, bot = g.ky + L.DY * kl - g.h * S * 0.42;
        Object.assign(L.thread.style, { left: (gx - 2).toFixed(1) + 'px', top: top.toFixed(1) + 'px', height: Math.max(0, bot - top).toFixed(1) + 'px', opacity: P(t, L.tL1 - 0.15, L.tL1, E.outC).toFixed(3) });
      }
    }
    if (!geo) return;
    if (geo.ic) { set(ic, { o: 0.2 * P(t, sc.t0, sc.t0 + 0.5, E.outC), y: Math.sin(t * 1.1) * 5 }); dw(P(t, sc.t0 + 0.05, sc.t0 + 1.0, E.ioC)); }
    if (!bar) return;
    let j = -1; bl.forEach((b, k) => { if (t >= tIn(k)) j = k; });
    if (j < 0) { bar.style.opacity = 0; return; }
    const bot = k => geo.ys[k] + geo.hs[k] * (1 - (1 - SHR) * shr(k, t)) * 0.93;
    const from = j ? bot(j - 1) : geo.top, grow = j ? P(t, tIn(j), tIn(j) + 0.3, E.outC) : P(t, sc.t0, sc.t0 + 0.45, E.outB);   // 竖线和变灰同一刻往下长
    const h = from + (bot(j) - from) * grow - geo.top;
    bar.style.top = geo.top.toFixed(1) + 'px'; bar.style.height = Math.max(0, h).toFixed(1) + 'px'; bar.style.opacity = h > 0.5 ? 1 : 0;
  };
}

// 11-12 夜盲审七处之五：对比卡这张卡期间说的每一句都要在主区（画面 545–1345）出现过，字号不低于 72；盒子推近以后右边不过 870。
// 排法：「以前」「现在」两个盒子上下摆；每边按句分块（planner.cmp_parts 分好、折好），一边不超过三排就一句句往下摞，摞不下就说到哪句换哪句。
function cmpParts(sc) {
  const X = 100, W = 724, PX = 38, PY = 24, LAB = 62, GAP = 12, IW = W - 2 * PX, TOP = 24, ROOM = 752, MID = 96;
  const plan = s => {
    const ps = s.parts.map(p => { const cs = [...p.text], b = [0, ...(p.cut || []), cs.length]; return { t: p.t, rows: b.slice(1).map((e, i) => cs.slice(b[i], e).join('')) }; });
    const fs = Math.max(72, Math.min(84, Math.floor(IW / Math.max(1, ...ps.flatMap(p => p.rows.map(uW))))));
    const lh = Math.round(fs * 1.18), nr = ps.reduce((a, p) => a + p.rows.length, 0);
    const hS = PY * 2 + LAB + nr * lh + (ps.length - 1) * GAP, hW = PY * 2 + LAB + Math.max(...ps.map(p => p.rows.length)) * lh;
    return { s, ps, fs, lh, can: nr <= 3, hS, hW };
  };
  const pa = plan(sc.L), pb = plan(sc.R);
  const pick = [[true, true], [false, true], [true, false], [false, false]].find(([a, b]) => (!a || pa.can) && (!b || pb.can) && (a ? pa.hS : pa.hW) + MID + (b ? pb.hS : pb.hW) <= ROOM) || [false, false];
  const box = (p, stack, top, hot) => {
    const h = stack ? p.hS : p.hW;
    const c = abs(el('div', 'card', null, sc.el, { height: h + 'px', padding: '0', boxSizing: 'border-box' }), X, top, W);
    if (hot) Object.assign(c.style, { borderColor: 'var(--acc)', boxShadow: '0 0 0 6px color-mix(in srgb, var(--acc) 18%, transparent), var(--shadow)' });
    el('div', null, p.s.label, c, { position: 'absolute', left: PX + 'px', top: PY + 'px', font: '50px Smiley', color: hot ? 'var(--acc)' : 'var(--sub)' });
    let y = PY + LAB;
    const bl = p.ps.map(q => { const e = el('div', 'big', q.rows.join('<br>'), c, { position: 'absolute', left: PX + 'px', top: y + 'px', fontSize: p.fs + 'px', lineHeight: p.lh + 'px', whiteSpace: 'nowrap', color: hot ? 'var(--ink)' : 'var(--sub)' }); if (stack) y += q.rows.length * p.lh + GAP; return { e, t: q.t }; });
    return { c, bl, stack, h };
  };
  const A = box(pa, pick[0], TOP, false), B = box(pb, pick[1], TOP + A.h + MID, true);
  const arr = abs(el('div', null, '<svg viewBox="0 0 60 60" width="84" height="84"><path d="M30 6v44M12 32l18 18 18-18" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>', sc.el, { color: 'var(--acc)' }), X + W / 2 - 42, TOP + A.h + 6);
  const tA = A.bl[0].t, tB = B.bl[0].t;
  return t => {
    const ka = P(t, tA - 0.2, tA + 0.3, E.outB), kb = P(t, tB - 0.2, tB + 0.35, E.outB);
    set(A.c, { o: ka * (1 - 0.4 * kb), x: (1 - ka) * -140, s: 1 - 0.04 * kb });
    set(B.c, { o: kb, y: (1 - kb) * 60, s: 0.94 + 0.06 * kb });   // 从下面上来，不从右边滑进（右边不许过 870）
    const kr = P(t, tB - 0.3, tB + 0.1, E.outC); set(arr, { o: kr, y: (1 - kr) * -30 });
    [A, B].forEach(S => S.bl.forEach((b, k) => {   // 说到哪句出哪句；换着放的，下一句出来这句就退
      const nx = S.bl[k + 1], kin = k === 0 ? 1 : P(t, b.t - 0.15, b.t + 0.1, E.outC), kout = S.stack || !nx ? 0 : P(t, nx.t - 0.15, nx.t + 0.1, E.outC);
      set(b.e, { o: kin * (1 - kout), y: (1 - kin) * 24 });
    }));
  };
}

// 11-12 夜盲审七处之一：数字卡、年份卡、区间卡不滚数，屏上只出现这句话里的数。数从 max(说到前 0.2 秒, 卡开始进来后 0.15 秒) 起淡入、0.2 秒淡满，
// 同时从 0.86 放大落定；这三种卡等上一张退干净再进（卡开始后 0.05 秒起，0.3 秒进满，见下面镜头那段的 sc.late）。planner.num_full 是同一算法，两边一起改
const numIn = (t, T, t0) => { const a = Math.max(T - 0.2, t0 + 0.15); return { a, o: P(t, a, a + 0.2, E.outC), s: 0.86 + 0.14 * P(t, a, a + 0.45, E.outB) }; };

// ---------- 各类镜头 ----------
const BUILD = {
  hook(sc) {
    const bgI = sc.icon ? icon(sc.icon, 560, sc.el, { position: 'absolute', left: '260px', top: '70px', opacity: .14, color: 'var(--acc)' }) : null;   // 11-12：开场没撞上词就空着，不补星光
    const dw = bgI ? drawOn(bgI) : null;
    const ks = KinStack(sc, KCY - 20, 150);
    sc.noEnter = true; sc.noExit = true;
    return t => {
      const k = P(t, sc.t1 - 0.45, sc.t1 + 0.05, E.ioC);
      set(sc.el, { o: 1 - P(t, sc.t1 - 0.4, sc.t1 - 0.08, E.inC), y: -520 * k, s: 1 - 0.4 * k, b: 6 * k });
      if (bgI) { set(bgI, { r: noise1(t * .4, 4) * 8 + t * 3, s: 1 + 0.04 * Math.sin(t * 1.3), o: 0.14 }); dw(P(t, sc.t0, sc.t0 + 1.1, E.ioC)); }
      ks.upd(t);
    };
  },
  say(sc) {
    const inPara = P12 && sc.tpl && (sc.tpl.kind === 'ban' || sc.tpl.kind === 'example');   // 11-12 夜第二步：只动字的两种接在新排法里
    if (sc.tpl && TPL[sc.tpl.kind] && !inPara) { const f = TPL[sc.tpl.kind](sc); if (f) return f; }   // 认得的记号照模板画，认不得照普通句卡
    sc.hideSubs = true;
    let v = P12 ? 3 : sc.sayN % 3; if (v === 2 && !sc.icon) v = 1;   // 11-12 夜：所有普通句卡一个排法（一句的居中、多句的排成一段），不再三种轮换
    if (v === 3) return sayPara(sc);
    if (v === 1) {   // 左对齐 + 竖条：大字靠左排，左边一根色条随镜头长出来
      const bar = abs(el('div', null, null, sc.el, { width: '14px', height: '230px', background: 'var(--acc)', borderRadius: '7px', transformOrigin: '50% 50%' }), 96, KCY - 115);
      const ks = KinStack(sc, KCY, 128, { w: 740, x: 140, align: 'left' });
      ks.blocks.forEach(b => { b.box.style.transformOrigin = '0 50%'; });
      return t => { const kb = P(t, sc.t0, sc.t0 + 0.45, E.outB); set(bar, { o: kb > 0 ? 1 : 0, s: 1 }); bar.style.transform = `scaleY(${Math.max(0.001, kb).toFixed(4)})`; ks.upd(t); };
    }
    if (v === 2) {   // 居中 + 底部图标章：大字下面一枚实心圆章，图标一笔一笔画出来
      const ks = KinStack(sc, KCY - 30);
      const seal = abs(el('div', null, null, sc.el, { width: '150px', height: '150px', borderRadius: '50%', background: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 14px color-mix(in srgb, var(--acc) 16%, transparent)' }), 465, 440);
      const ic = icon(sc.icon, 84, seal, { color: 'var(--accInk)' }); const dw = drawOn(ic);
      return t => { const x = clamp((t - sc.t0 - 0.15) / 0.8); set(seal, { o: x > 0 ? 1 : 0, s: SP(x, 1.3, 5) || 0.001, y: Math.sin(t * 1.4) * 5 }); dw(P(t, sc.t0 + 0.25, sc.t0 + 1.1, E.ioC)); ks.upd(t); };
    }
    const bgI = sc.icon ? icon(sc.icon, 470, sc.el, { position: 'absolute', left: '305px', top: '115px', opacity: .15, color: 'var(--acc)' }) : null;
    const dw = bgI ? drawOn(bgI) : null;
    const ks = KinStack(sc, KCY);
    return t => {
      if (bgI) { set(bgI, { r: noise1(t * .3, 7) * 9, y: Math.sin(t * 1.1) * 14, s: 0.9 + 0.1 * P(t, sc.t0, sc.t0 + 1.0, E.outB), o: .15 }); dw(P(t, sc.t0 + 0.05, sc.t0 + 1.0, E.ioC)); }
      ks.upd(t);
    };
  },
  question(sc) {   // 11-12 夜总控：下面那句照一句的普通句卡排，一排最多七个字（居中最宽 640）、按排卡程序的折点折、字号 90 到 120；大问号往上让 60，句子顶在画面 945，离问号底一百来像素
    const q = abs(el('div', 'big', '?', sc.el, { fontSize: '420px', lineHeight: 1, color: 'var(--acc)', width: '1080px', textAlign: 'center' }), 0, P12 ? -100 : -40);
    const ks = KinStack(sc, 590, 100, { w: SAFE_W });
    if (P12) {   // 软开头（「所以」这类）并进来的那句也一样排，整卡一个字号
      const bl = ks.blocks, cuts = bl.map((_, k) => paraCuts(LN[sc.la + k], PARA_ROW1));
      let fs = paraFont(bl.flatMap((_, k) => paraRows(LN[sc.la + k], cuts[k])), SAFE_W);
      bl.forEach((b, k) => { Object.assign(b.box.style, { fontSize: fs + 'px', textAlign: 'center' }); foldAt(b, cuts[k]); });
      sc.paraFs = fs; sc.paraRows = cuts.map(c => c.length + 1);
      sc.measure.push(() => {   // 排在 KinStack 自己的定位后面：顶对齐，不再按中心放；字比算的宽的样式整卡缩一点，不小于 90
        let rw = 0; bl.forEach(b => { let a = 1e9, e = -1e9; b.ch.forEach(c => { a = Math.min(a, c.e.offsetLeft); e = Math.max(e, c.e.offsetLeft + c.e.offsetWidth); }); rw = Math.max(rw, e - a); });
        if (rw > SAFE_W + 1 && fs > PARA_MIN) { fs = Math.max(PARA_MIN, Math.floor(fs * SAFE_W / rw)); bl.forEach(b => { b.box.style.fontSize = fs + 'px'; }); sc.paraFs = fs; }
        // 问句（最后一句）顶在舞台 400（画面 945）；两句时各句照 KinStack 的中心对齐放，先出的那句被顶上去（h0×0.29 + h1×0.5 + 40）、缩到 0.58，
        // 它缩完的上沿 = 问句顶 − 0.58×h0 − 40，要离问号底（舞台 298）还有 40，所以问句顶放到 378 + 0.58×h0
        const hs = bl.map(b => b.box.offsetHeight), n = hs.length, Y = n > 1 ? Math.round(378 + 0.58 * hs[n - 2]) : 400, cy = Y + hs[n - 1] / 2;
        bl.forEach((b, k) => { b.h = hs[k]; b.box.style.top = (cy - hs[k] / 2) + 'px'; }); sc.paraH = hs; sc.paraTop = Y;
      });
    }
    sc.hideSubs = true;
    const t0 = LN[sc.la].t0;
    return t => {
      const x = clamp((t - t0 + 0.1) / 1.0);
      set(q, { o: P(t, t0 - 0.1, t0 + 0.1), s: 0.4 + 0.6 * SP(x, 1.2, 5), r: (1 - SP(x, 1.5, 4)) * -25 + Math.sin(t * 2) * 3 });
      ks.upd(t);
    };
  },
  cta(sc) {
    const ks = KinStack(sc, 300, 120);
    sc.hideSubs = true;
    const tEnd = LN[sc.lb - 1].t1;
    const seal = abs(el('div', null, null, sc.el, { width: '210px', height: '210px', borderRadius: '50%', background: 'var(--acc)', color: 'var(--accInk)', display: 'flex', alignItems: 'center', justifyContent: 'center' }), 435, 545);
    icon('circle-check', 120, seal, { color: 'var(--accInk)' });
    const ring = abs(el('div', null, null, sc.el, { width: '210px', height: '210px', borderRadius: '50%', border: '8px solid var(--acc)' }), 435, 545);
    SHAKES.push([tEnd - 0.05, 12]);
    return t => {
      ks.upd(t);
      const x = clamp((t - tEnd + 0.15) / 0.8);
      set(seal, { o: x > 0 ? 1 : 0, s: SP(x, 1.3, 5), r: (1 - E.outC(x)) * -30 });
      const r = clamp((t - tEnd) / 0.7);
      set(ring, { o: r > 0 ? 1 - r : 0, s: 1 + r * 0.9 });
    };
  },
  myth(sc) {
    if (sc.idx === 0) sc.el.style.top = '-250px';  // 开场就是误区卡时，顶上的标题带还没落下，整张卡往上提，别让上半屏空着
    const pill = el('div', 'pill', '', sc.el); icon('users', 46, pill, { color: 'var(--sub)' }); el('span', null, sc.label, pill);
    abs(pill, 0, 30); pill.style.left = '50%'; pill.style.translate = '-50% 0';
    const card = abs(el('div', 'card', null, sc.el, { height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }), 100, 150, 880);
    const mq = fit2('“' + sc.myth + '”', sc.mythCut ? sc.mythCut + 1 : null, Math.min(96, txtSize(sc.myth + '00', 96) * (sc.mythCut ? 1.5 : 1)), 780);
    el('div', 'big', mq.html, card, { fontSize: mq.size + 'px', textAlign: 'center', padding: '0 50px', lineHeight: 1.2 });
    const strikes = (mq.lines === 2 ? [154 - mq.size * 0.6, 154 + mq.size * 0.6] : [154]).map(y => abs(el('div', null, null, card, { height: '12px', background: 'var(--bad)', borderRadius: '6px', transformOrigin: '0 50%' }), 50, Math.round(y), 780));
    const XMARK = '<svg viewBox="0 0 64 64" style="width:.7em;height:.7em;vertical-align:.01em;margin-right:.2em;overflow:visible"><path d="M8 8L56 56M56 8L8 56" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round"/></svg>';   // 11-12：「✕」三款自带字都没有，原来靠电脑上别的字补，换台电脑长得不一样；改两道线画
    const stamp = abs(el('div', 'stamp', XMARK + '误区', sc.el), mq.lines === 2 ? 700 : 620, mq.lines === 2 ? 0 : 65), S0 = mq.lines === 2 ? 1.2 : 2.6, SB = mq.lines === 2 ? 0.8 : 1;   // 两行时砸下来别放那么大，不然冲进顶栏   // 原话两行时章贴到卡片上沿；一行时字放大了，章再往上 30，别擦到后引号
    const factTxt = sc.factFull || ('其实：' + sc.fact);
    const fact = abs(el('div', null, null, sc.el, { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '18px', font: `${Math.min(txtSize(sc.fact + '000', 78), fitW(factTxt, 99, SAFE_W - 98))}px Glow`, color: 'var(--good)' }), 90, 540, 900);
    icon('circle-check', 80, fact, { color: 'var(--good)' }); el('span', null, factTxt, fact, { whiteSpace: 'nowrap' });
    SHAKES.push([sc.factT + 0.12, 16]);
    return t => {
      const kp = P(t, sc.t0, sc.t0 + 0.45, E.outB); pill.style.opacity = kp; pill.style.transform = `translateY(${(1 - kp) * 30}px)`;
      const kc = P(t, sc.mythT - 0.2, sc.mythT + 0.35, E.outB), kd = P(t, sc.factT, sc.factT + 0.35, E.outC);
      set(card, { o: kc * (1 - 0.45 * kd), y: (1 - kc) * 90, s: (0.94 + 0.06 * kc) * (1 - 0.03 * kd), r: -2 * kd });
      strikes.forEach((st, q) => { st.style.transform = `scaleX(${P(t, sc.factT + q * 0.12, sc.factT + 0.3 + q * 0.12, E.outC)})`; });
      const ks = P(t, sc.factT - 0.04, sc.factT + 0.26, E.outB2);
      set(stamp, { o: t > sc.factT - 0.04 ? 1 : 0, s: SB * (S0 - (S0 - 1) * ks), r: -14 + 4 * ks });
      const kf = P(t, sc.factT + 0.05, sc.factT + 0.35, E.outC);
      set(fact, { o: kf, y: (1 - kf) * 40 });
    };
  },
  compare(sc) {
    if (sc.L.parts && sc.R.parts && sc.L.parts.length && sc.R.parts.length) return cmpParts(sc);   // 新剧本：每句都上主区（老剧本照老排法）
    const mk = (side, top, h, hot) => {
      const c = abs(el('div', 'card', null, sc.el, { height: h + 'px', padding: '30px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '18px' }), 100, top, 800);
      if (hot) Object.assign(c.style, { borderColor: 'var(--acc)', boxShadow: '0 0 0 6px color-mix(in srgb, var(--acc) 18%, transparent), var(--shadow)' });
      el('div', null, side.label, c, { font: '50px Smiley', color: hot ? 'var(--acc)' : 'var(--sub)' });
      const ft = fit2(side.text, side.cut, 84, 700), fs = ft.lines === 2 && !hot ? Math.min(ft.size, 68) : ft.size;
      el('div', 'big', ft.html, c, { fontSize: fs + 'px', lineHeight: 1.18, color: hot ? 'var(--ink)' : 'var(--sub)', whiteSpace: 'nowrap' });
      return c;
    };
    const A = mk(sc.L, 20, 300, false), B = mk(sc.R, 420, 360, true);
    const arr = abs(el('div', null, '<svg viewBox="0 0 60 60" width="84" height="84"><path d="M30 6v44M12 32l18 18 18-18" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>', sc.el, { color: 'var(--acc)' }), 458, 330);
    return t => {
      const ka = P(t, sc.L.t - 0.2, sc.L.t + 0.3, E.outB), kb = P(t, sc.R.t - 0.2, sc.R.t + 0.35, E.outB);
      set(A, { o: ka * (1 - 0.4 * kb), x: (1 - ka) * -140, s: 1 - 0.04 * kb });
      set(B, { o: kb, x: (1 - kb) * 140, s: 0.94 + 0.06 * kb });
      const kr = P(t, sc.R.t - 0.3, sc.R.t + 0.1, E.outC); set(arr, { o: kr, y: (1 - kr) * -30 });
    };
  },
  flip(sc) {
    sc.hideSubs = true;
    const hd = abs(el('div', 'big', sc.head, sc.el, { fontSize: txtSize(sc.head, 72) + 'px', color: 'var(--sub)', textAlign: 'center' }), 90, 10, 900);
    const aw = abs(el('div', null, null, sc.el, { textAlign: 'center' }), 90, 118, 900);
    const aT = el('span', 'big', sc.A, aw, { display: 'inline-block', fontSize: txtSize(sc.A, 170) + 'px', lineHeight: 1.1 });
    const strike = el('div', null, null, sc.el, { position: 'absolute', height: '20px', background: 'var(--bad)', borderRadius: '10px', transformOrigin: '0 50%' });
    sc.measure.push(() => { const w = aT.offsetWidth, h = aT.offsetHeight; Object.assign(strike.style, { left: (540 - w / 2 - 28) + 'px', width: (w + 56) + 'px', top: (118 + h * 0.52 - 10) + 'px' }); });
    const bw = abs(el('div', null, null, sc.el, { textAlign: 'center' }), 60, 430, 960);
    el('div', null, sc.bLabel, bw, { display: 'inline-block', font: '58px Smiley', color: 'var(--accInk)', background: 'var(--acc)', padding: '4px 28px 10px', borderRadius: '16px', marginBottom: '20px' });
    el('br', null, null, bw);
    const bb = bigB(sc, 128, 590);
    el('span', 'big', bb.html, bw, { display: 'inline-block', fontSize: bb.size + 'px', lineHeight: 1.12, whiteSpace: 'nowrap' });
    SHAKES.push([sc.tB + 0.1, 14]);
    return t => {
      const k0 = P(t, sc.t0, sc.t0 + 0.4, E.outC); set(hd, { o: k0, y: (1 - k0) * 30 });
      const ka = clamp((t - sc.tA + 0.15) / 0.7), ks = P(t, sc.tB - 0.14, sc.tB + 0.16, E.outC);
      set(aw, { o: (ka > 0 ? 1 : 0) * (1 - 0.6 * ks), s: (0.6 + 0.4 * SP(ka, 1.2, 5)) * (1 - 0.08 * ks) });
      strike.style.transform = `rotate(-2.5deg) scaleX(${ks.toFixed(4)})`; strike.style.opacity = ks > 0 ? 1 : 0;
      const kb = P(t, sc.tB - 0.02, sc.tB + 0.32, E.outB2);
      set(bw, { o: P(t, sc.tB - 0.05, sc.tB + 0.08), s: (1.45 - 0.45 * kb) * (1 + 0.025 * Math.sin(Math.max(0, t - sc.tB - 0.3) * 2.2)), y: (1 - kb) * -40 });
    };
  },
  cause(sc) {   // 因为 A → 所以 B：上面一张小卡写原因，箭头一笔画下来，结果砸在下面
    sc.hideSubs = true;
    const ca = abs(el('div', 'card', null, sc.el, { padding: '26px 40px', display: 'flex', alignItems: 'center', gap: '24px' }), 100, 30, 800);
    el('div', null, sc.aLabel, ca, { font: '50px Smiley', color: 'var(--bg0)', background: 'var(--sub)', padding: '2px 22px 8px', borderRadius: '14px', flex: 'none' });
    const fa = fit2(sc.A, sc.Acut, 76, 560);
    el('div', 'big', fa.html, ca, { fontSize: fa.size + 'px', color: 'var(--sub)', whiteSpace: 'nowrap', lineHeight: 1.15 });
    const arr = abs(el('div', null, '<svg viewBox="0 0 120 220" width="120" height="220" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M60 8 V198"/><path d="M22 160 L60 204 L98 160"/></svg>', sc.el, { color: 'var(--acc)' }), 480, 215);
    const dw = drawOn(arr);
    const chip = abs(el('div', null, sc.bLabel, sc.el, { font: '54px Smiley', color: 'var(--accInk)', background: 'var(--acc)', padding: '2px 26px 8px', borderRadius: '14px', whiteSpace: 'nowrap' }), 630, 275);
    const bw = abs(el('div', null, null, sc.el, { textAlign: 'center' }), 0, 455, 1080);
    const bb = bigB(sc, 124, 590);
    el('span', 'big', bb.html, bw, { display: 'inline-block', fontSize: bb.size + 'px', lineHeight: 1.12, whiteSpace: 'nowrap' });
    SHAKES.push([sc.tB + 0.12, 12]);
    return t => {
      const ka = P(t, sc.tA - 0.25, sc.tA + 0.3, E.outB); set(ca, { o: ka * (1 - 0.35 * P(t, sc.tB, sc.tB + 0.3)), y: (1 - ka) * -60 });
      dw(P(t, sc.tB - 0.55, sc.tB - 0.05, E.ioC));
      const kc = P(t, sc.tB - 0.3, sc.tB + 0.05, E.outB); set(chip, { o: kc, s: 0.6 + 0.4 * kc });
      const kb = P(t, sc.tB - 0.02, sc.tB + 0.32, E.outB2);
      set(bw, { o: P(t, sc.tB - 0.05, sc.tB + 0.08), s: 1.35 - 0.35 * kb, y: (1 - kb) * -40 });
    };
  },
  year(sc) {   // 年份：一个就大字放大落定；两三个就竖排时间线，说到哪个点亮哪个。年份照抄字幕，不滚
    const N = sc.nodes.length;
    sc.late = true;
    const yearEl = (y, size) => { const e = el('div', 'num', null, sc.el, { fontSize: size + 'px', color: 'var(--acc)', whiteSpace: 'nowrap', letterSpacing: '-3px' }); el('span', null, y, e); el('span', 'big', '年', e, { fontSize: '.42em', marginLeft: '10px', letterSpacing: '0' }); return e; };
    if (N === 1) {
      const nd = sc.nodes[0];
      const bgI = icon('calendar', 520, sc.el, { position: 'absolute', left: '280px', top: '20px', opacity: .12, color: 'var(--acc)' }); const dw = drawOn(bgI);
      const yr = abs(yearEl(nd.year, 250), 0, 110); Object.assign(yr.style, { width: '1080px', textAlign: 'center' });
      const ln = abs(el('div', null, null, sc.el, { height: '10px', background: 'var(--acc)', borderRadius: '5px' }), 290, 395, 500);
      const tx = abs(el('div', 'big', nd.text, sc.el, { fontSize: Math.min(92, fitW(nd.text, 99)) + 'px', textAlign: 'center', whiteSpace: 'nowrap' }), 0, 440, 1080);
      SHAKES.push([nd.t + 0.2, 10]);
      return t => {
        dw(P(t, sc.t0, sc.t0 + 1.0, E.ioC)); set(bgI, { r: noise1(t * .3, 3) * 6, o: .12 });
        const q = numIn(t, nd.t, sc.t0); set(yr, { o: q.o, s: q.s });
        ln.style.transform = `scaleX(${P(t, nd.t + 0.05, nd.t + 0.45, E.outC).toFixed(4)})`;
        const kt = P(t, nd.t + 0.25, nd.t + 0.65, E.outC); set(tx, { o: kt, y: (1 - kt) * 36 });
      };
    }
    const X0 = 170, top0 = N === 2 ? 60 : 20, gap = N === 2 ? 330 : 245;
    const rail = abs(el('div', null, null, sc.el, { width: '8px', height: ((N - 1) * gap) + 'px', background: 'var(--line)', borderRadius: '4px' }), X0 - 4, top0 + 60);
    const fill = abs(el('div', null, null, sc.el, { width: '8px', height: ((N - 1) * gap) + 'px', background: 'var(--acc)', borderRadius: '4px', transformOrigin: '50% 0' }), X0 - 4, top0 + 60);
    const its = sc.nodes.map((nd, k) => {
      const y = top0 + k * gap;
      const dot = abs(el('div', null, null, sc.el, { width: '44px', height: '44px', borderRadius: '50%', background: 'var(--acc)', boxShadow: '0 0 0 10px color-mix(in srgb, var(--acc) 22%, transparent)' }), X0 - 22, y + 38);
      const yr = abs(yearEl(nd.year, 116), X0 + 60, y);
      const tx = nd.text ? abs(el('div', 'big', nd.text, sc.el, { fontSize: Math.min(68, fitW(nd.text, 99, 620)) + 'px', whiteSpace: 'nowrap', color: 'var(--ink)' }), X0 + 64, y + 128) : null;
      return { nd, dot, yr, tx };
    });
    return t => {
      let cur = -1; its.forEach((it, k) => { if (t >= it.nd.t - 0.2) cur = k; });
      its.forEach((it, k) => {
        const x = clamp((t - it.nd.t + 0.25) / 0.7), dim = k < cur ? 0.5 : 1;
        set(it.dot, { o: x > 0 ? 1 : 0, s: SP(x, 1.4, 5) || 0.001 });
        const q = numIn(t, it.nd.t, sc.t0), kx = P(t, q.a, q.a + 0.45, E.outC); set(it.yr, { o: q.o * dim, x: (1 - kx) * 80 });
        if (it.tx) { const kt = P(t, it.nd.t + 0.15, it.nd.t + 0.55, E.outC); set(it.tx, { o: kt * dim, x: (1 - kt) * 60 }); }
      });
      const a = its[0].nd.t, b = its[N - 1].nd.t;
      let f = 0; for (let k = 1; k < N; k++) f += P(t, its[k - 1].nd.t + 0.1, its[k].nd.t - 0.1, E.ioC) / (N - 1);
      fill.style.transform = `scaleY(${Math.max(0.001, f).toFixed(4)})`; set(rail, { o: P(t, a - 0.3, a) });
    };
  },
  pair(sc) {
    const N = sc.items.length, grid = N >= 4, cols = grid ? 2 : N;
    const D = N === 2 ? 260 : N === 3 ? 180 : 160, gap = N === 2 ? 110 : N === 3 ? 40 : 160, TW = N === 2 ? 250 : N === 3 ? 180 : 300;
    if (grid) sc.hideSubs = true;   // 两行排满了，字幕会压在第二行字上
    const ttl = abs(el('div', 'big', sc.title, sc.el, { fontSize: txtSize(sc.title, 96) + 'px', textAlign: 'center' }), 90, 40, 900);
    const W0 = cols * D + (cols - 1) * gap, x0 = 540 - W0 / 2, Y0 = grid ? 210 : 250;
    const its = sc.items.map((it, k) => {
      const col = grid ? k % 2 : k, row = grid ? (k / 2) | 0 : 0;
      const g = abs(el('div', null, null, sc.el, { width: D + 'px', textAlign: 'center' }), x0 + col * (D + gap), Y0 + row * 300);
      const c = el('div', 'card', null, g, { position: 'relative', width: D + 'px', height: D + 'px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: 'var(--acc)', borderWidth: '6px' });
      if (it.icon) icon(it.icon, D * 0.46, c, { color: k % 2 ? 'var(--acc2)' : 'var(--acc)' });
      else el('div', 'num', String(k + 1), c, { fontSize: Math.round(D * 0.5) + 'px', letterSpacing: '0px', color: k % 2 ? 'var(--acc2)' : 'var(--acc)' });   // 11-12：没图标画序号
      const n = [...it.text].length, two = n >= 4 && fitW(it.text, 99, TW) < 64;
      const fz = two ? Math.min(80, TW / Math.ceil(n / 2)) : Math.min(n <= 3 ? 92 : 70, fitW(it.text, 99, TW));
      const tx = two ? it.text.slice(0, Math.ceil(n / 2)) + '<br>' + it.text.slice(Math.ceil(n / 2)) : it.text;
      el('div', 'big', tx, g, { fontSize: fz + 'px', lineHeight: 1.1, marginTop: '22px', whiteSpace: 'nowrap', width: TW + 'px', marginLeft: ((D - TW) / 2) + 'px' });
      return { g, t: it.t };
    });
    // 最后一项常在句尾才说到：每项最晚在退场前 0.45 秒站稳（复测：三件事的「快充」、四件事的「费用」刚冒出来就退场）
    its.forEach((o, k) => { o.t = Math.max(sc.t0 + 0.15 * k, Math.min(o.t, sc.t1 - 1.03 - (its.length - 1 - k) * 0.15)); });
    const PF = N === 2 ? 110 : 70;
    const plus = grid ? [] : sc.items.slice(1).map((_, k) => abs(el('div', 'num', '+', sc.el, { fontSize: PF + 'px', color: 'var(--sub)', width: gap + 'px', textAlign: 'center' }), x0 + (k + 1) * (D + gap) - gap, Y0 + D / 2 - PF * 0.6));
    return t => {
      const k0 = P(t, sc.t0, sc.t0 + 0.4, E.outC); set(ttl, { o: k0, y: (1 - k0) * 30 });
      its.forEach((it, k) => {
        const x = clamp((t - it.t + 0.12) / 0.7);
        set(it.g, { o: x > 0 ? 1 : 0, s: SP(x, 1.4, 5.5), r: (1 - E.outC(x)) * (k % 2 ? 12 : -12), y: Math.sin(t * 1.6 + k) * 6 });
      });
      plus.forEach((p, k) => { const x = P(t, its[k + 1].t - 0.2, its[k + 1].t + 0.1); set(p, { o: x, s: 0.5 + 0.5 * x }); });
    };
  },
  range(sc) {
    const max = sc.max || 100, BW = 700, X = 100, Y = 400, BH = 150;
    sc.late = true;
    const ttl = abs(el('div', 'big', sc.label, sc.el, { fontSize: txtSize(sc.label, 92) + 'px', textAlign: 'center' }), 90, 40, 900);
    const bar = abs(el('div', null, null, sc.el, { height: BH + 'px', borderRadius: '30px', border: '8px solid var(--ink)', background: 'var(--card)', overflow: 'hidden' }), X, Y, BW);
    const nub = /battery/.test(sc.icon || '') || /电/.test(sc.label) ? abs(el('div', null, null, sc.el, { width: '30px', height: '70px', borderRadius: '0 14px 14px 0', background: 'var(--ink)' }), X + BW, Y + BH / 2 - 35) : null;
    const band = abs(el('div', null, null, bar, { top: '8px', bottom: '8px', height: 'auto', borderRadius: '16px', background: 'var(--acc)', boxShadow: TX.glow === false ? 'none' : '0 0 40px var(--acc)' }), 0, 8);
    const ticks = [0, .25, .5, .75, 1].map(f => abs(el('div', null, fmtN(Math.round(max * f), sc.unit === '%' ? '' : ''), sc.el, { font: '600 42px Arial', color: 'var(--sub)', width: '120px', textAlign: 'center' }), X + BW * f - 60, Y + BH + 22));
    const mk = () => abs(el('div', 'num', '', sc.el, { fontSize: '118px', color: 'var(--acc)', whiteSpace: 'nowrap' }), 0, Y - 150);
    const mLo = mk(), mHi = mk(), wCache = new Map();
    // 两头的数字各自多宽，得量出来：区间一窄，「60天」和「90天」会叠在一起（盲审 11-04：终值叠成「60夭90天」）
    const put = (e, s2) => { e.textContent = s2; if (!wCache.has(s2)) wCache.set(s2, e.offsetWidth); return wCache.get(s2); };
    const xOf = v => X + 8 + (BW - 16) * clamp(v / max);
    // 11-09 第三轮抽帧：两头挨得近时落定读成「1.5 2.5倍」，像一个数。这时把字幕原文中间那个「到」照抄补在前半后面，读出来是「1.5到 2.5倍」
    const conn = sc.raw && sc.rawLo && sc.rawHi && sc.raw.startsWith(sc.rawLo) && sc.raw.endsWith(sc.rawHi) && sc.raw.length > sc.rawLo.length + sc.rawHi.length ? sc.raw.slice(sc.rawLo.length, sc.raw.length - sc.rawHi.length) : '';
    let tight = null;
    return t => {
      if (tight === null && conn) { mLo.textContent = sc.rawLo + conn; mHi.textContent = sc.rawHi; const fl = mLo.offsetWidth, fh = mHi.offsetWidth; if (fl > 0 && fh > 0) tight = xOf(sc.hi) - xOf(sc.lo) < (fl + fh) / 2 + 30; }
      const k0 = P(t, sc.t0, sc.t0 + 0.4, E.outC); set(ttl, { o: k0, y: (1 - k0) * 30 }); set(bar, { o: k0 }); if (nub) nub.style.opacity = k0;
      ticks.forEach(e => e.style.opacity = k0 * 0.9);
      // 条要比嘴快一点：句子一开头就往上涨，说到数字时已经到位（盲审：慢半拍、截到 71% 像出错）
      const kl = P(t, sc.t0 + 0.25, Math.max(sc.tLo, sc.t0 + 0.6) + 0.1, E.outC), kh = P(t, sc.tLo + 0.05, Math.max(sc.tHi, sc.tLo + 0.4) + 0.1, E.outC);
      const lo = sc.lo * kl, hi = lerp(sc.lo, sc.hi, kh);
      const x1 = xOf(lo) - X - 8, x2 = xOf(Math.max(hi, lo)) - X - 8;
      band.style.left = (8 + (kl > 0 ? x1 : 0)) + 'px'; band.style.width = Math.max(kl > 0 ? 10 : 0, x2 - x1) + 'px'; band.style.opacity = kl > 0 ? 1 : 0;
      const qL = numIn(t, sc.tLo, sc.t0), qH = numIn(t, sc.tHi, sc.t0);   // 11-12 夜盲审七处之一：两头的数一出来就是字幕原文，不滚；条照旧涨
      const wl = put(mLo, rollNum(sc.lo, sc.rawLo, true) + rawUnit(sc.rawLo) + (tight && qH.o > 0 ? conn : '')), wh = put(mHi, rollNum(sc.hi, sc.rawHi, true) + rawUnit(sc.rawHi));
      let cl = xOf(sc.lo), ch = xOf(sc.hi), need = (wl + wh) / 2 + (tight ? 12 : 30);
      if (ch - cl < need) { const m = (cl + ch) / 2; cl = m - need / 2; ch = m + need / 2; }   // 挤到一起就对称撑开
      // 11-09 第三轮抽帧：「4%到6%」在 0–100 的条上两头都挤在最左边，撑开后左边那个被拉回屏内，又压回右边那个上（读成「4%6%」）。拉回屏内时另一个跟着让开
      cl = clampN(cl, wl / 2 + 20, 1080 - wl / 2 - 20); if (ch - cl < need) ch = cl + need;
      ch = clampN(ch, wh / 2 + 20, 1080 - wh / 2 - 20); if (ch - cl < need) cl = Math.max(wl / 2 + 20, ch - need);
      mLo.style.left = (cl - wl / 2) + 'px'; set(mLo, { o: qL.o, s: qL.s });
      mHi.style.left = (ch - wh / 2) + 'px'; set(mHi, { o: qH.o, s: qH.s });
    };
  },
  stat(sc) {
    const col = sc.tone === 'bad' ? 'var(--bad)' : 'var(--acc)';
    sc.late = true;
    const grp = (label, value, unit, y, raw) => {
      const g = abs(el('div', null, null, sc.el, { textAlign: 'center' }), 90, y, 900);
      const lb = el('div', 'big', label, g, { fontSize: txtSize(label, 88) + 'px', minHeight: '20px' }); g.lb = lb;
      const row = el('div', null, null, g, { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '12px', marginTop: '6px', color: col, lineHeight: 1 });
      const nd = String(rawSplit(raw).n).length, ul = rawUnit(raw).length;
      // 11-09 第三轮抽帧：「3.85个百分点」单位折成「个百分 / 点」两行。单位不许折行；数加单位放不下 880 像素就整体缩小
      const nsz = Math.min(nd <= 2 ? 290 : nd === 3 ? 260 : nd === 4 ? 225 : 185, Math.floor(868 / (0.64 * nd + 0.5 * ul)));
      const nm = el('div', 'num', rollNum(value, raw, true), row, { fontSize: nsz + 'px' });   // 11-12 夜盲审七处之一：一出来就是字幕原文的数，不滚
      g.un = el('div', 'big', rawUnit(raw), row, { fontSize: Math.round(nsz * 0.48) + 'px', lineHeight: 1, whiteSpace: 'nowrap' });   // 单位照抄字幕原文
      g.row = row;
      let barF = null;
      if (unit === '%') { const b = el('div', null, null, g, { margin: '18px auto 0', width: '720px', height: '28px', borderRadius: '14px', background: 'var(--line)', overflow: 'hidden' }); barF = el('div', null, null, b, { height: '100%', width: '0', background: col, borderRadius: '14px' }); }
      return { g, nm, barF, value, raw };
    };
    const G1 = grp(sc.label, sc.value, sc.unit, 40, sc.raw);
    const G2 = sc.second ? grp(sc.second.label, sc.second.value, sc.second.unit, 40, sc.second.raw) : null;
    const warn = null;   // 11-12：警示牌不自动挂（「坏」是按少、贵、跌这些单字判的，跟半截撞上一个病）；数的颜色、震动照旧
    let warnOff = false;
    if (warn) sc.measure.push(() => {                  // 11-10 复审第 7 条：「累计亏损1234.56万美元」三角压在「元」上。量一下，三角不许压数和单位
      const g = G1.g, row = g.row, un = g.un, lb = g.lb, x0 = 90, y0 = 40;
      const keep = G1.nm.textContent; G1.nm.textContent = rollNum(G1.value, G1.raw, true) || keep;   // 11-10 第二次：按最后停住的数量宽度（排版时数还只显示「0」）
      const xr = x0 + un.offsetLeft + un.offsetWidth, rt = y0 + row.offsetTop, rh = row.offsetHeight;
      G1.nm.textContent = keep;
      const rg = document.createRange(); rg.selectNodeContents(lb);
      const k = lb.getBoundingClientRect().width / Math.max(1, lb.offsetWidth);       // 页面整体缩放的比例，量出的字宽换回 1080 宽的像素
      const lw = rg.getBoundingClientRect().width / (k || 1), lr = x0 + 450 + lw / 2;  // 标签字居中，右边沿
      if (xr + 24 + 120 <= 1060) Object.assign(warn.style, { left: (xr + 24) + 'px', top: (rt + Math.max(0, rh - 120) / 2) + 'px' });          // 数右边放得下
      else if (lr + 30 <= 840 && lb.offsetHeight >= 60) Object.assign(warn.style, { left: '850px', top: (y0 + lb.offsetTop + (lb.offsetHeight - 120) / 2) + 'px' });   // 挪到标签那一行右边
      else warnOff = true;                                                                                                                        // 都放不下：不画
    });
    const ring = abs(el('div', null, null, sc.el, { width: '620px', height: '620px', borderRadius: '50%', border: `6px solid ${col}` }), 230, 110);
    SHAKES.push([sc.t + 0.6, sc.tone === 'bad' ? 14 : 8]);
    const count = (G, T, t) => { const q = numIn(t, T, sc.t0); set(G.g.row, { o: q.o, s: q.s }); if (G.barF) G.barF.style.width = clamp(G.value * P(t, q.a, q.a + 0.6, E.outC) / 100) * 100 + '%'; return q.o; };   // 数和单位一起放大落定；百分比的条照旧涨
    return t => {
      const k0 = P(t, sc.t0, sc.t0 + 0.4, E.outC);
      const k1 = count(G1, sc.t, t);
      const kx = G2 ? P(t, sc.second.t - 0.35, sc.second.t + 0.15, E.ioC) : 0;
      set(G1.g, { o: k0 * (1 - 0.6 * kx), y: -200 * kx, s: (0.92 + 0.08 * P(t, sc.t - 0.1, sc.t + 0.4, E.outB)) * (1 - 0.55 * kx) });
      if (G2) { count(G2, sc.second.t, t); const k2 = P(t, sc.second.t - 0.05, sc.second.t + 0.4, E.outB); set(G2.g, { o: P(t, sc.second.t - 0.05, sc.second.t + 0.15), y: 210 + (1 - k2) * 90, s: 0.82 + 0.1 * k2 }); }
      if (warn) { const kw = clamp((t - sc.t - 0.4) / 0.8); set(warn, { o: kw > 0 && !warnOff ? 1 - kx : 0, s: SP(kw, 1.5, 5), r: Math.sin(t * 5) * 6 * (kw > 0 ? 1 : 0) }); }
      const kr = clamp((t - sc.t - 0.55) / 0.9); set(ring, { o: kr > 0 && kr < 1 ? 0.6 * (1 - kr) : 0, s: 0.6 + 0.7 * E.outC(kr) });
    };
  },
  list(sc) {
    const N = sc.items.length, top0 = 170, sp = Math.min(190, (800 - top0 - 10) / N), ch = sp - 26;
    const hd = abs(el('div', null, null, sc.el, { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '22px' }), 90, 20, 900);
    const badge = el('div', 'num', String(N), hd, { width: '118px', height: '118px', borderRadius: '50%', background: 'var(--acc)', color: 'var(--accInk)', fontSize: '76px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0' });
    el('div', 'big', sc.title.replace(/^[^一-龥]*/, ''), hd, { fontSize: txtSize(sc.title, 92) + 'px' });
    const cards = sc.items.map((it, k) => {
      const c = abs(el('div', 'card', null, sc.el, { height: ch + 'px', display: 'flex', alignItems: 'center', gap: '26px', padding: '0 40px' }), 100, top0 + k * sp, 780);
      el('div', 'num', String(k + 1).padStart(2, '0'), c, { fontSize: '64px', color: 'var(--acc)', letterSpacing: '-2px', minWidth: '84px' });
      if (it.icon) icon(it.icon, 64, c, { color: 'var(--ink)', flex: 'none' });
      const W = it.icon ? 490 : 580, one = Math.min(64, fitW(it.head, 99, W)), fh = fit2(it.head, it.cut, 64, W);
      const two = fh.lines === 2 ? Math.min(fh.size, Math.floor((ch - 12) / 2.3)) : 0, useTwo = two > one;   // 五项时卡片矮，拆两行反而更小，就不拆
      el('div', 'big', useTwo ? fh.html : it.head, c, { fontSize: (useTwo ? two : one) + 'px', whiteSpace: 'nowrap', lineHeight: 1.1 });
      return { c, t: it.t };
    });
    return t => {
      const k0 = P(t, sc.t0, sc.t0 + 0.4, E.outC); set(hd, { o: k0, y: (1 - k0) * 30 });
      const kb = clamp((t - sc.t0) / 0.8); set(badge, { s: SP(kb, 1.3, 5) || 0.001 });
      let cur = -1; cards.forEach((c, k) => { if (t >= c.t - 0.12) cur = k; });
      cards.forEach((c, k) => {
        const kk = P(t, c.t - 0.15, c.t + 0.35, E.outB), act = P(t, c.t - 0.1, c.t + 0.2) * (cur === k ? 1 : 1 - P(t, cards[k + 1] ? cards[k + 1].t - 0.1 : 1e9, (cards[k + 1] ? cards[k + 1].t : 1e9) + 0.2));
        set(c.c, { o: kk * (0.5 + 0.5 * act), x: (1 - kk) * 160, s: 1 + 0.03 * act });
        c.c.style.borderColor = act > 0.5 ? 'var(--acc)' : 'var(--cardLine)';
      });
    };
  },
};

// ---------- 搭建 ----------
function build() {
  // 顶部标题带
  const tag = $('#tag'); tag.textContent = PL.tag || '';
  const ttl = $('#ttl'); const tch = [];
  (PL.title || []).forEach(line => {
    const row = el('span', 'tl', null, ttl);
    const parts = String(line).split(/(\[\[.+?\]\])/);
    parts.forEach(p => { const isH = /^\[\[/.test(p); for (const c of plain(p)) { const s = el('span', isH ? 'hl' : null, c, row, { display: 'inline-block' }); tch.push(s); } });
  });
  const longest = Math.max(1, ...(PL.title || ['']).map(x => plain(x).length));
  ttl.style.fontSize = Math.min(86, 930 / (longest * 0.92)) + 'px';
  if (P12) {   // 11-12 改法二（跟着新排法，第二步起默认开）：开场过后标题只当名牌，一排 44 号灰字，超过 17 个字照原来两排；进度条从 520 上移到 380
    if ((PL.title || []).map(x => plain(x)).join('').length <= 17) ttl.querySelectorAll('.tl').forEach(r => { r.style.display = 'inline'; });
    Object.assign(ttl.style, { fontSize: '44px', lineHeight: '1.25', color: 'var(--sub)' }); ttl.querySelectorAll('.hl').forEach(s => { s.style.color = 'var(--sub)'; });
    $('#prog').style.top = Math.max(380, ttl.offsetTop + ttl.offsetHeight + 16) + 'px';   // 一排时在 380；标题超过 17 个字折两排时跟在标题下面
  }
  const prog = $('#prog i');
  const PS = PL.person, PLAIN = !!Q.get('plain');
  const hook = PL.scenes[0], tDock = PS ? 0.25 : hook.t1;  // 真人版：标题一开场就在，不等开场大字
  PL.scenes.slice(1).forEach(s => { const b = el('b', null, null, $('#prog')); b.style.left = (s.t0 / PL.dur * 940) + 'px'; });

  // 镜头
  for (const s0 of PL.scenes) {
    const s = zkScene(s0);
    const sc = Object.assign({}, s, { el: el('div', 'scene', null, CAM), measure: [], idx: SCN.length, sayN: SCN.filter(x => x.type === 'say').length });
    if (!SCN.length) sc.noEnter = true;  // 第一帧就要有东西，不从透明淡进
    ZK_LINE = s.la; ZK_SKIP = new Set((s.items || []).map(it => it.icon).filter(Boolean));
    sc.upd = (BUILD[s.type] || BUILD.say)(sc);
    ZK_LINE = null; ZK_SKIP = new Set();
    SCN.push(sc);
  }
  for (const sc of SCN) { sc.el.style.display = 'block'; sc.measure.forEach(f => f()); sc.el.style.display = 'none'; }

  // 字幕
  const subOn = li => SCN.some(sc => li >= sc.la && li < Math.max(sc.lb, sc.la + 1) && (PS ? true : !sc.hideSubs && sc.type !== 'hook'));   // 这句的字幕会不会露出来
  const SUB = LN.map((l, li) => {
    const d = el('div', 'sub', null, SUBS, { display: 'none' });
    { const n = lineText(l).length; if (n > 12) d.style.fontSize = Math.floor(752 / n) + 'px'; }
    const m = kwMask(l.cs, subOn(li) ? kwOf(li) : (l.hide || []).includes(l.kw) ? '' : l.kw || '');
    const ch = l.cs.map((c, i) => ({ e: el('span', null, c[0], d), t: c[1], kw: m[i] }));
    return { d, ch, l };
  });
  const sceneAt = t => { let k = 0; for (let i = 0; i < SCN.length; i++) if (t >= SCN[i].t0) k = i; return SCN[k]; };

  const b1 = $('#b1'), b2 = $('#b2'), b3 = $('#b3'), grid = $('#grid'), grain = $('#grain'), sweep = $('#sweep');
  b1.style.background = `radial-gradient(circle, ${TH.blobs[0]}, transparent 65%)`;
  b2.style.background = `radial-gradient(circle, ${TH.blobs[1]}, transparent 65%)`;
  b3.style.background = `radial-gradient(circle, ${TH.blobs[2]}, transparent 65%)`;
  $('#bg').style.background = `linear-gradient(180deg, ${TH.bg1} 0%, ${TH.bg0} 55%, ${TH.bg0} 100%)`;

  // 真人画面：平时人占满屏；说到数字、清单、对比这些，人缩到上半屏，卡片在下半屏出
  const SPLIT = new Set(['myth', 'compare', 'pair', 'range', 'stat', 'list', 'cause', 'year']), SH = 900;  // 只有带数据的卡才分屏；问号、收尾留给人
  const segs = [];
  if (PS && !PLAIN) for (const s of PL.scenes) if (SPLIT.has(s.type)) {
    const L = segs[segs.length - 1];
    if (L && s.t0 - L[1] < 1.2) L[1] = s.t1; else segs.push([s.t0, s.t1]);  // 隔得近就连起来，免得来回跳
  }
  const kAt = t => { let k = 0; for (const [a, b] of segs) k = Math.max(k, Math.min(P(t, a - 0.32, a + 0.18, E.ioC), 1 - P(t, b - 0.12, b + 0.38, E.ioC))); return k; };
  let pwin, pimg, scrT, scrB, seam;
  if (PS) {
    pwin = el('div', null, null, null, { position: 'absolute', left: 0, top: 0, width: '1080px', height: '1920px', overflow: 'hidden', background: '#000' });
    $('#frame').insertBefore(pwin, $('#top'));
    pimg = el('img', null, null, pwin, { position: 'absolute', left: 0, top: 0, width: PS.w + 'px', height: PS.h + 'px', transformOrigin: '0 0', maxWidth: 'none' });
    scrT = el('div', null, null, pwin, { position: 'absolute', left: 0, top: 0, width: '1080px', height: '640px', background: 'linear-gradient(180deg, rgba(0,0,0,.58), rgba(0,0,0,0))' });
    scrB = el('div', null, null, pwin, { position: 'absolute', left: 0, bottom: 0, width: '1080px', height: '780px', background: 'linear-gradient(0deg, rgba(0,0,0,.62), rgba(0,0,0,0))' });
    seam = el('div', null, null, null, { position: 'absolute', left: 0, width: '1080px', height: '8px', background: 'var(--acc)', opacity: 0 });
    $('#frame').insertBefore(seam, $('#top'));
    $('#top').style.setProperty('--ink', '#FFFFFF'); $('#ttl').style.textShadow = '0 4px 28px rgba(0,0,0,.55)';
    Object.assign($('#stage').style, { top: '930px', transform: 'scale(.96)', transformOrigin: '540px 0' });  // 分屏时卡片放大，下半屏不空
    if (PLAIN) [scrT, scrB].forEach(e => e.style.display = 'none');
  }
  const face = t => {
    const tr = PS.track, f = clamp(t * PS.fps / PS.step, 0, tr.length - 1), i = Math.floor(f), j = Math.min(i + 1, tr.length - 1), u = f - i;
    return [0, 1, 2].map(n => lerp(tr[i][n], tr[j][n], u));
  };
  // 把人放进 W×H 的窗：铺满不留黑边，脸放在横向正中、纵向 aimY 处
  const place = (W, H, z, aimY, f, safe = true) => {
    const s = Math.max(W / PS.w, H / PS.h) * Math.max(1, z);  // z 小于 1 会露出黑边
    if (safe) aimY = Math.min(0.72, Math.max(aimY, (0.8 * f[2] * PS.h * s + 0.05 * H) / H));  // 脸大时往下放，保住头顶
    return [clamp(W / 2 - f[0] * PS.w * s, W - PS.w * s, 0), clamp(aimY * H - f[1] * PS.h * s, H - PS.h * s, 0), s];
  };
  const fullScenes = PL.scenes.filter(s => !SPLIT.has(s.type));
  const zoomAt = t => {  // 人占满屏时：每换一段话切一次远近景，段内慢慢推近
    if (PLAIN) return 1;
    let i = 0; for (let n = 0; n < fullScenes.length; n++) if (t >= fullScenes[n].t0) i = n;
    const s = fullScenes[i]; return (i % 2 ? 1.16 : 1.0) * (1 + 0.035 * P(t, s.t0, s.t1, E.lin));
  };
  const personAt = (t, W = 1080, H = 1920) => {
    const f = face(t), k = kAt(t), z = zoomAt(t);
    const a = place(W, H, z, f[1], f), b = place(W, SH, 1.015 + 0.015 * Math.sin(t * .4), 0.5, f, false);  // 分屏窗矮：脸放正中，保嘴不保头顶
    const h = lerp(H, SH, k);
    pwin.style.height = h.toFixed(1) + 'px';
    pimg.style.transform = `translate(${lerp(a[0], b[0], k).toFixed(1)}px,${lerp(a[1], b[1], k).toFixed(1)}px) scale(${lerp(a[2], b[2], k).toFixed(4)})`;
    scrB.style.opacity = 1 - k; seam.style.top = (h - 4).toFixed(1) + 'px'; seam.style.opacity = P(k, 0.6, 1);
    $('#top').style.opacity = 1 - k; $('#stage').style.opacity = k;
    SUBS.style.top = lerp(1372, SH - 215, k).toFixed(1) + 'px';  // 分屏时字幕压在人像下沿、分界线上方
    const src = PS.dir + String(Math.min(PS.n - 1, Math.floor(t * PS.fps + 1e-4))).padStart(5, '0') + '.jpg';
    if (pimg.dataset.src !== src) { pimg.dataset.src = src; pimg.src = src; return pimg.decode().catch(() => {}); }
  };

  window.seek = t => {
    // 背景
    set(b1, { x: -300 + noise1(t * .06, 1) * 260, y: 300 + noise1(t * .05, 2) * 300 });
    set(b2, { x: 300 + noise1(t * .05, 3) * 260, y: 900 + noise1(t * .06, 4) * 300 });
    set(b3, { x: noise1(t * .04, 5) * 300, y: 1300 + noise1(t * .05, 6) * 260 });
    grid.style.backgroundPosition = `0px ${(-t * 14) % 54}px`;
    const fr = Math.floor(t * 30); grain.style.backgroundPosition = `${(fr * 173) % 512}px ${(fr * 311) % 512}px`;
    // 标题带：开场说完飞上去
    const kd = P(t, tDock - 0.3, tDock + 0.35, E.outC);
    tag.style.opacity = kd; tag.style.transform = `translateY(${(1 - kd) * 24}px)`;
    tch.forEach((s, i) => { const k = P(t, tDock - 0.12 + i * 0.018, tDock + 0.3 + i * 0.018, E.outC); set(s, { o: k, y: (1 - k) * 50, b: (1 - k) * 6 }); });
    prog.style.width = (clamp(t / PL.dur) * 100) + '%'; $('#prog').style.opacity = kd;
    // 镜头
    let cur = null;
    for (const sc of SCN) {
      const on = t >= sc.t0 - 0.14 && t < sc.t1 + 0.05;
      if (on !== sc._on) { sc.el.style.display = on ? 'block' : 'none'; sc._on = on; }
      if (!on) continue;
      if (t >= sc.t0) cur = sc;
      sc.upd(t);
      if (!sc.noEnter || !sc.noExit) {
        const a = sc.noEnter ? 1 : sc.late ? P(t, sc.t0 + 0.05, sc.t0 + 0.35, E.outC) : P(t, sc.t0 - 0.14, sc.t0 + 0.36, E.outC), b = sc.noExit ? 0 : P(t, sc.t1 - 0.26, sc.t1 + 0.05, E.inC);   // 数字卡等上一张退干净再进（盲审：年份卡进来时压在上一张没退干净的字上）
        const v = sc.idx % 3;
        if (v === 1) set(sc.el, { o: a * (1 - b), x: (1 - a) * 260 - b * 260, r: (1 - a) * 2.5 - b * 2.5, s: 1, b: (1 - a) * 6 + b * 6 });
        else if (v === 2) set(sc.el, { o: a * (1 - b), s: (1.16 - 0.16 * a) * (1 - 0.1 * b), b: (1 - a) * 10 + b * 8 });
        else set(sc.el, { o: a * (1 - b), s: (0.93 + 0.07 * a) * (1 + 0.08 * b), y: (1 - a) * 60 - b * 30, b: (1 - a) * 9 + b * 9 });
      }
    }
    cur = cur || SCN[0];
    // 镜头漂移 + 震
    const d = drift(t, 7); let sx = 0, sy = 0;
    for (const [t0, a] of SHAKES) { const s = shake(t, t0, 0.35, a); sx += s.x; sy += s.y; }
    const push = 1 + 0.03 * P(t, cur.t0, cur.t1, E.lin);
    CAM.style.transform = `translate(${(d.x + sx).toFixed(2)}px,${(d.y + sy).toFixed(2)}px) rotate(${d.r.toFixed(3)}deg) scale(${push.toFixed(4)})`;
    // 转场扫光
    let sw = 0, sxp = -600;
    for (const sc of SCN.slice(1)) { const k = (t - sc.t0 + 0.16) / 0.55; if (k > 0 && k < 1) { sw = Math.sin(k * Math.PI); sxp = -600 + k * 2000; } }
    sweep.style.opacity = 0;
    // 字幕
    const showSubs = PS ? ((kAt(t) < 0.5 || !cur.hideSubs) && cur.type !== 'hook') : (!cur.hideSubs && cur.type !== 'hook');  // 开场那几句标题已经写着，不再重复字幕
    let act = -1;
    if (showSubs) for (let i = 0; i < LN.length; i++) if (t >= LN[i].t0 - 0.1 && i >= cur.la && i < Math.max(cur.lb, cur.la + 1)) act = i;
    if (act >= 0 && t > LN[act].t1 + 0.9 && !(LN[act + 1] && t >= LN[act + 1].t0 - 0.1)) act = -1;
    SUB.forEach((s, i) => {
      const on = i === act; if (on !== s._on) { s.d.style.display = on ? '' : 'none'; s._on = on; }
      if (!on) return;
      const k = P(t, s.l.t0 - 0.1, s.l.t0 + 0.14, E.outB); set(s.d, { o: P(t, s.l.t0 - 0.1, s.l.t0), s: 0.9 + 0.1 * k });
      for (const c of s.ch) { const said = t >= c.t - 0.02; c.e.style.color = c.kw ? 'var(--acc)' : ''; c.e.style.opacity = said ? 1 : 0.42; }
    });
  };

  if (PS) { const s0 = window.seek; window.seek = t => { s0(t); return personAt(t); }; }

  if (PLAIN) {
    ['#top', '#stage', '#sweep', '#b1', '#b2', '#b3', '#grid', '#grain'].forEach(s => $(s).style.display = 'none');
    $('#bg').style.background = '#000'; SUBS.style.top = '1250px';
    const s0 = window.seek;
    window.seek = t => { const r = s0(t); let a = -1; for (let i = 0; i < LN.length; i++) if (t >= LN[i].t0 - 0.05) a = i;
      SUB.forEach((s, i) => { s.d.style.display = i === a ? '' : 'none'; set(s.d, { o: 1, s: 1 }); s.d.style.background = 'transparent'; s.d.style.color = '#fff';
        s.d.style.webkitTextStroke = '8px #000'; s.ch.forEach(c => { c.e.style.opacity = 1; c.e.style.color = ''; }); });
      return r; };
  }
  // 封面模式
  const cv = Q.get('cover');
  if (cv) {
    ['#top', '#stage', '#subs', '#sweep'].forEach(s => $(s).style.display = 'none');
    const H = cv === '34' ? 1440 : 1920; $('#frame').style.height = H + 'px';
    const C = $('#cover'); C.style.display = 'block';
    // 封面大图标：只认修改页封面大字那行的「封面的…」（三个画风一样，不跟着第一句的图标走）
    if (!PL.cover.noicon && PL.cover.icon) icon(PL.cover.icon, 860, C, { position: 'absolute', right: '-170px', bottom: (H === 1440 ? -150 : -40) + 'px', opacity: .14, transform: 'rotate(-12deg)' });   // 11-12：封面跟开场，没撞上词就空着，不补星光
    const box = abs(el('div', null, null, C, { display: 'flex', flexDirection: 'column', gap: '34px' }), 80, 0, 920);
    el('div', null, PL.cover.kicker || PL.tag || '', box, { font: '64px Smiley', color: 'var(--accInk)', background: 'var(--acc)', padding: '8px 30px 12px', borderRadius: '18px', alignSelf: 'flex-start' });
    const n = Math.max(...PL.cover.title.map(x => plain(x).length));
    const ct = el('div', 'big', PL.cover.title.map(hl).join('<br>'), box, { fontSize: Math.min(176, 900 / (n * 0.9)) + 'px', lineHeight: 1.1 });
    ct.querySelectorAll('.hl').forEach(h => { h.style.background = `linear-gradient(transparent 62%, color-mix(in srgb, var(--acc) 30%, transparent) 62%)`; });
    box.style.top = ((H - box.offsetHeight) / 2 - (H === 1440 ? 30 : 90)) + 'px';
    window.seek(0);
    if (PS) {  // 真人版封面：用片中一帧的人做底，标题压在下半
      C.querySelector('.ic').style.display = 'none'; $('#bg').style.display = 'none'; $('#grain').style.display = 'none';
      C.style.color = '#FFFFFF'; ct.style.textShadow = '0 6px 34px rgba(0,0,0,.6)';  // 压在人像暗底上，三种风格都用白字
      const tc = PS.cover_t != null ? PS.cover_t : PL.dur * 0.3, f = face(tc), [x, y, s] = place(1080, H, 1, H === 1440 ? 0.3 : 0.28, f);
      pwin.style.height = H + 'px'; seam.style.opacity = 0; scrT.style.display = 'none';
      Object.assign(scrB.style, { height: (H * 0.62) + 'px', opacity: 1, background: 'linear-gradient(0deg, rgba(0,0,0,.82) 30%, rgba(0,0,0,0))' });
      pimg.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s.toFixed(4)})`;
      box.style.top = (H - box.offsetHeight - (H === 1440 ? 110 : 330)) + 'px';
      pimg.src = PS.dir + String(Math.min(PS.n - 1, Math.floor(tc * PS.fps))).padStart(5, '0') + '.jpg';
      pimg.decode().catch(() => {}).then(() => { window.READY = true; });
      return;
    }
  }
  window.READY = true;
}
Promise.all(['86px Glow', '800 62px Noto', '44px Smiley', '800 100px Arial', '600 36px Arial', ...(TX.fonts || [])].map(f => document.fonts.load(f, '测试字1%'))).then(() => { build(); if (!Q.get('cover')) window.seek(0); });
