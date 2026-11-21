
// ===== 专业版·版式（2026-11-15 从试验夹搬入）：专业版的版面。只有专业版的片子才接上，免费版不走这里。=====
// 他定的上线的线是「体面、说得过去、不坑人」。总控看两段市场参照后点的三样基本功，这里补：
// 1 左上角：原来那行灰字是第一句硬截的半句话，不出了。换成「第几段 / 共几段」+ 这一段的短题 + 分段进度条。
//   短题只用模型填的「标题」卡的大字（字幕里原样的字）；这一段没有标题卡就只出段号，绝不自己截半句。
// 2 舞台放大 1.15 倍、往下放，字幕跟着下移；最底下那一条（1540 以下）平台会盖上作者名和文案，不放要紧的字，只放一个淡淡的大段号和底色的图形。
// 3 一条片按段换底：三种底轮着来，一个色系里的深浅（原样 / 斜着一道加两个圆 / 底下一道光加大方格），换段时 0.6 秒化过去。同一个 t 永远同一个样子。
// 只借做法（分段号、一屏一件事、敢放大），画风、配色、版式是自己的。
window.BAN_ON = true;
function banDuan() {                                    // 分段：标题卡的起点优先，其次剧本自带的分段；每段不短于 15 秒（最后一段 10 秒），两分半的片最多 6 段
  const D = PL.dur, MIN = 15, c = [];
  for (const sc of SCN) if (sc.kind === '小画面' && sc.kit === '标题' && !(sc.hua && sc.hua.root.style.display === 'none')) c.push({ t: sc.t0, name: String((sc.args || [])[0] || ''), pri: 2, end: sc.t1 + 3 });   // 11-16：end = 这个章节名挂到几秒（标题卡走了以后 3 秒）
  for (const tp of PL.topics || []) { let best = null; for (const sc of SCN) if (!best || Math.abs(sc.t0 - tp.t0) < Math.abs(best.t0 - tp.t0)) best = sc; if (best && Math.abs(best.t0 - tp.t0) < 3) c.push({ t: best.t0, name: '', pri: 1 });
    else { const li = LN.findIndex(l => Math.abs(l.t0 - tp.t0) < 0.05), sc = li > 0 ? SCN.find(x => x.type === 'say' && x.la < li && li < x.lb) : null;   // 11-15 盲比：这一段的头一句夹在一张句卡中间（前后都是画面，卡的起点离得远），原来这一刀就丢了，后面的段号全少一号。句卡是一屏一句，就在那一句开口的地方切
      if (sc) c.push({ t: Math.max(0, LN[li].t0 - 0.15), name: '', pri: 1, li }); } }
  c.sort((a, b) => b.pri - a.pri || a.t - b.t);
  const keep = [{ t: 0, name: '', pri: 3 }];
  for (const x of c) if (x.t >= MIN && D - x.t >= 10 && keep.every(k => Math.abs(k.t - x.t) >= MIN)) keep.push(x);
  keep.sort((a, b) => a.t - b.t);
  while (keep.length > Math.max(3, Math.min(6, Math.round(D / 25)))) {                              // 多了就把最碎的那一刀去掉（标题卡那几刀不动）
    let bi = -1, bl = 1e9;
    for (let i = 1; i < keep.length; i++) { if (keep[i].pri > 1) continue; const l = Math.min(keep[i].t - keep[i - 1].t, (i + 1 < keep.length ? keep[i + 1].t : D) - keep[i].t); if (l < bl) { bl = l; bi = i; } }
    if (bi < 0) keep.splice(keep.length - 1, 1); else keep.splice(bi, 1);
  }
  // 没有标题卡的段：这一段头一句要是「先来说说算力」「再说资本」这种自己报题的话，就用他报的那个词（字幕原字，整词，到句尾）；认不出就空着
  const RE = /(?:先来说说|先说说|先来说|再来说说|再说说|再来说|再说|接着说说|接着说|然后说说|最后说说|最后说)([^，。？！]{2,8}?)[呢啊吧呀]?$/;
  const RE2 = /^第(?:[一二三四五六七八九十]|\d+)[个点条件][呢啊吧呀]?是([^，。？！]{2,8}?)[呢啊吧呀]?$/;                    // 「第三个呢是能不能用上AI」
  for (const k of keep) if (!k.name && k.t > 0) { const sc = SCN.find(x => Math.abs(x.t0 - k.t) < 1e-3), li = k.li != null ? k.li : sc ? sc.la : -1, tx = li >= 0 ? lineText(LN[li]).replace(/\s+/g, '') : '', m = RE.exec(tx) || RE2.exec(tx); if (m) k.name = m[1]; }
  return keep.map((k, i) => ({ a: k.t, b: i + 1 < keep.length ? keep[i + 1].t : D + 1, name: k.name, end: k.pri === 2 ? k.end : 0 }));
}
function banshi() {
  const SEG = banDuan(), N = SEG.length, OFF = (SEG.length > 2 && !SEG[0].name && SEG.slice(1).some(x => x.name)) ? 1 : 0,   /* 头一段没有题、后面有题：头一段算开场，不占段号（嘴里说「第三个」时屏上也是第 3 段） */
        frame = $('#frame'), top = $('#top'), tag0 = $('#tag');
  const ORD = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const SAID = SEG.map(s => { const li = LN.findIndex(l => l.t0 >= s.a - 0.01), m = li >= 0 ? /^第([一二三四五六七八九十]|\d+)[个点条件步]/.exec(lineText(LN[li]).replace(/\s+/g, '')) : null; return m ? (ORD[m[1]] || +m[1]) : 0; });
  const CLASH = SAID.some((v, i) => v && v !== i + 1 - OFF);   // 11-15 盲比：屏上「第 2 段」、嘴上「第三个」。哪一段开口报的数和屏上的段号对不上，整条片就不出段号（只留这一段的题和进度条）
  window.BAN_SEG = SEG; window.BAN_CLASH = CLASH;
  const lum = (h => { const m = /^#(..)(..)(..)$/.exec(h); return m ? (0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16)) / 255 : 0; })(TH.bg0), dark = lum < 0.45;
  const mix = (c, p, base) => `color-mix(in srgb, var(--${c}) ${p}%, ${base || 'var(--bg0)'})`, ink = p => `color-mix(in srgb, var(--ink) ${p}%, transparent)`;
  // ---- 1 左上角 ----
  $('#ttl').style.display = 'none'; $('#prog').style.display = 'none'; tag0.style.visibility = 'hidden';
  const rows = SEG.map((s, i) => {
    const r = abs(el('div', null, null, top, { display: 'flex', alignItems: 'center', gap: '24px', whiteSpace: 'nowrap', height: '76px' }), 70, 186, 940);
    if (N > 1 && !CLASH) el('div', null, (OFF && !i) ? '开场' : `第 ${i + 1 - OFF} / ${N - OFF} 段`, r, { font: '50px Smiley', color: 'var(--accInk)', background: 'var(--acc)', padding: '6px 26px 8px', borderRadius: '16px' });
    if (s.name) { const n = uW(s.name); el('div', 'big', null, r, { fontSize: Math.min(60, Math.floor((N > 1 ? 620 : 900) / Math.max(1, n))) + 'px', lineHeight: '76px', color: 'var(--ink)' }).textContent = s.name; r.nm = r.lastElementChild; r.nmEnd = s.end || 0; }
    return r;
  });
  const bar = abs(el('div', null, null, top, { height: '10px', display: 'flex', gap: '10px' }), 70, 290, 940);
  const fills = SEG.map(s => { const d = el('div', null, null, bar, { flex: `${Math.min(s.b, PL.dur) - s.a} 1 0`, height: '10px', borderRadius: '5px', background: 'var(--line)', overflow: 'hidden', position: 'relative' }); return el('i', null, null, d, { position: 'absolute', left: 0, top: 0, bottom: 0, width: '0%', background: 'var(--acc)', borderRadius: '5px' }); });
  // ---- 2 舞台放大下移 ----
  Object.assign($('#stage').style, { top: '400px', transform: 'scale(1.15)', transformOrigin: '520px 0' });
  Object.assign(SUBS.style, { top: '1350px', left: '35px', width: '860px' });
  SUBS.querySelectorAll('.sub').forEach(d => {                               // 小画面底下那行字幕也去语气词（只藏不加；分词以后单独成词的才藏）
    const sp = [...d.children], s = d.textContent, tk = xhTok(s); let p = 0, cut = 0;
    if (tk.join('') === s) tk.forEach((w, i) => {
      if (BAN_FILL.test(w) || (w === '吧' && i === tk.length - 1)) { let q = 0; sp.forEach(e => { const L = e.textContent.length; if (q >= p && q < p + w.length) { e.dataset.fill = '1'; cut += L; } q += L; }); }
      p += w.length; });
    if (cut && cut < s.length) sp.forEach(e => { if (e.dataset.fill) e.style.display = 'none'; }); else cut = 0;
    const n = s.length - cut; d.style.maxWidth = '860px'; d.style.fontSize = (n > 12 ? Math.floor(830 / n) : 68) + 'px'; });   // 字幕放大一成
  SCN.forEach(sc => { if (sc.type === 'say' && !sc.ban1) sc.el.style.top = '180px'; if (sc.type !== 'pro' && !sc.ban1) sc.el.style.scale = '0.94';   /* 免费版自己的卡排满了 90 到 990，舞台放大以后贴边；这些卡少放大一点 */ if (sc.type === 'pro' && !sc.fell) sc.el.style.left = '40px'; /* 小画面原来整体偏左 55（给右边的按钮让位），往回挪 40，和普通句卡对齐些 */ if (sc.hideLi) sc.hideLines = new Set([...(sc.hideLines || []), ...sc.hideLi]); });   // 普通句卡原来贴着舞台顶，往中间挪；多盖的那句换了说法的，字幕不出
  const nums = SEG.map((s, i) => N > 1 && !CLASH ? abs(el('div', null, (OFF && !i) ? '' : String(i + 1 - OFF).padStart(2, '0'), frame, { font: '900 250px/1 Arial, sans-serif', letterSpacing: '-6px', color: 'transparent', webkitTextStroke: `3px ${ink(dark ? 20 : 16)}`, pointerEvents: 'none' }), 62, 1612) : null);
  nums.forEach(n => n && frame.insertBefore(n, top));
  // ---- 3 按段换底 ----
  const bg = $('#bg');
  const tint = p => dark ? mix('acc2', p) : `color-mix(in srgb, var(--ink) ${(p / 3.2).toFixed(1)}%, var(--bg0))`;   // 一个色系里的深浅：深色底用配色的第二色（夜幕是蓝），浅色底用字色
  const V1 = el('div', null, null, bg, { background: `repeating-linear-gradient(0deg, ${ink(dark ? 4 : 5)} 0 2px, transparent 2px 64px), linear-gradient(152deg, ${tint(30)} 0%, var(--bg0) 58%, ${tint(11)} 100%)`, opacity: 0 });
  [[470, 1180, 1000], [640, 1350, 660]].forEach(([x, y, d]) => el('div', null, null, V1, { position: 'absolute', left: x + 'px', top: y + 'px', width: d + 'px', height: d + 'px', borderRadius: '50%', border: `3px solid ${ink(dark ? 9 : 10)}`, boxSizing: 'border-box' }));
  const V2 = el('div', null, null, bg, { background: `linear-gradient(${ink(dark ? 3.5 : 4.5)} 2px, transparent 2px) 0 0 / 108px 108px, linear-gradient(90deg, ${ink(dark ? 3.5 : 4.5)} 2px, transparent 2px) 0 0 / 108px 108px, radial-gradient(135% 52% at 50% 106%, ${tint(34)} 0%, var(--bg0) 74%)`, opacity: 0 });
  const VS = [null, V1, V2];
  const on = (s, t, w) => P(t, s.a - w, s.a + w, E.ioC) * (1 - P(t, s.b - w, s.b + w, E.ioC));
  // 把关那一遍照原来的框量（横向 100 到 870、纵向 555 到 1335），量完再放大
  const probe0 = window.huaProbe;
  if (probe0) window.huaProbe = () => { const st = $('#stage').style, k = [st.top, st.transform]; st.top = '545px'; st.transform = 'none'; try { return probe0(); } finally { st.top = k[0]; st.transform = k[1]; } };
  const seek0 = window.seek;
  window.seek = t => {
    const r = seek0(t), kd = parseFloat(tag0.style.opacity || '1');
    const vo = [0, 0, 0];
    SEG.forEach((s, i) => {
      const first = i === 0, a = first ? 1 : P(t, s.a + 0.05, s.a + 0.45, E.outC), b = 1 - P(t, s.b - 0.25, s.b + 0.02, E.inC);
      set(rows[i], { o: kd * a * b, y: (1 - a) * 22 });
      if (rows[i].nm && rows[i].nmEnd) rows[i].nm.style.opacity = (1 - P(t, rows[i].nmEnd, rows[i].nmEnd + 0.4)).toFixed(3);   // 11-16：标题卡来的章节名只挂到它管的那几句说完，过了就退回只有「第几段」
      fills[i].style.width = (clamp((t - s.a) / (Math.min(s.b, PL.dur) - s.a)) * 100).toFixed(2) + '%';
      if (nums[i]) set(nums[i], { o: kd * a * b, x: (1 - a) * -30 });
      vo[i % 3] = Math.max(vo[i % 3], on(s, t, 0.3));
    });
    bar.style.opacity = kd;
    SUBS.querySelectorAll('.sub span').forEach(c => { if (c.style.opacity === '0.42') c.style.opacity = '0.6'; });   // 还没念到的字别灰得看不清
    V1.style.opacity = vo[1].toFixed(4); V2.style.opacity = vo[2].toFixed(4);
    return r;
  };
}
// 老画法里的放字换成按词折行的（原来按字数硬折，见过「拉平的只是大 / 家手里的工具」）
if (typeof xhFit === 'function') proText = function (parent, s, w, h, cap, color) {
  s = String(s); const best = xhFit(s, w, h, cap) || { ls: [s], fs: 40 }, fs = Math.max(40, best.fs);
  const box = el('div', null, null, parent, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' });
  const d = el('div', 'big', null, box, { width: w + 'px', textAlign: 'center', fontSize: fs + 'px', lineHeight: 1.16, color: color || 'inherit', whiteSpace: 'nowrap' });
  d.dataset.w = s; best.ls.forEach((l, i) => { if (i) d.appendChild(document.createElement('br')); d.appendChild(document.createTextNode(l)); });
  return box;
};
// 「比多少、几组对比」：名字说完要等一阵才到数的，柱子先慢慢垫到三成半，数到了再长满，不让中间空着等（盲看：28.8% 之前空了两秒）
PRO._stacks = function (sc) {
  const R = sc.rows, n = R.length, sp = n === 2 ? 380 : 770 / n, w = Math.min(250, sp - 50), M = 50, TH = 8, BASE = 690;
  const mx = Math.max(...R.map(r => r.num.val)), tail = PRO_TAIL[sc.kind];
  const G = R.map((r, i) => {
    const cx = PRO_CX + (i - (n - 1) / 2) * sp, cnt = Math.max(1, Math.round(r.num.val / mx * M)), T = proAt(sc, r.num.t);
    const st = proStack(sc.el, cx, BASE, w, cnt, TH);
    const nb = abs(el('div', null, null, sc.el, { textAlign: 'center' }), cx - sp / 2 + 8, 0, sp - 16);
    const num = proNum(nb, r.num, sp - 28, n === 2 ? 118 : 96, { color: r.num.val === mx ? 'var(--acc)' : 'var(--ink)' });
    const nm = r.name ? abs(el('div', 'big', r.name.text, sc.el, { textAlign: 'center', fontSize: Math.min(72, Math.floor((sp - 24) / Math.max(2, uW(r.name.text)))) + 'px', whiteSpace: 'nowrap', color: 'var(--ink)', lineHeight: 1.1 }), cx - sp / 2 + 8, BASE + 30, sp - 16) : null;
    const tn = r.name ? Math.min(proAt(sc, r.name.t), T) : T;
    return { st, cnt, T, nb, num, nm, tn, pre: T - tn > 1.0 ? 0.35 : 0 };
  });
  const rule = proRule(sc, 40);
  return t => {
    rule.style.transform = `scaleX(${P(t, sc.t0 + 0.05, sc.t0 + 0.45, E.outC).toFixed(4)})`;
    G.forEach(g => {
      const p = g.pre * P(t, g.tn + 0.15, g.T - 0.15, E.ioS), k = p + (1 - p) * P(t, g.T - 0.12, g.T + tail - 0.12, E.outQn); g.st.show(g.cnt * k);
      g.nb.style.top = (g.st.topY(Math.max(1, g.cnt * k)) - g.num.nsz - 22) + 'px'; set(g.nb, { o: P(t, g.T, g.T + 0.18), s: 0.86 + 0.14 * P(t, g.T, g.T + tail, E.outB) });
      if (g.nm) set(g.nm, { o: P(t, g.tn - 0.05, g.tn + 0.2), y: (1 - P(t, g.tn - 0.05, g.tn + 0.3, E.outC)) * 20 });
    });
  };
};
// 「占多少」：数旁边那行「是什么的」原来硬挤成一行，字很小；放得开就折成两行放大（盲看：手机上看不清）
{ const f0 = PRO['占多少']; PRO['占多少'] = sc => {
  const upd = f0(sc);
  if (sc.what) { const d = [...sc.el.querySelectorAll('.big')].find(e => e.textContent === sc.what.text), best = d && xhFit(sc.what.text, 340, 180, 76);
    if (best && best.ls.length > 1) { d.textContent = ''; d.style.fontSize = best.fs + 'px'; d.style.lineHeight = 1.16; best.ls.forEach((l, i) => { if (i) d.appendChild(document.createElement('br')); d.appendChild(document.createTextNode(l)); }); } }
  return upd;
}; }
// 11-16：老画法卡片顶上那根重点色的线（proRule），在专业版的版面里悬在卡片上方，没有意思，不要了（标题卡底下那一道是另一样东西，不动）
for (const k of Object.keys(PRO)) { const f0 = PRO[k]; PRO[k] = sc => { const upd = f0(sc); for (const e of sc.el.children) if (e.style.height === '6px' && e.style.borderRadius === '3px' && e.style.width === '770px') e.style.display = 'none'; return upd; }; }
// 11-16「前后变化」：后来的样子隔很久才说的，纸先只有原来那一行那么高，快说到了才长开，不让大半张纸空着等
{ const f0 = PRO['前后变化']; PRO['前后变化'] = sc => {
  const upd = f0(sc), TA = sc.t0 + 0.35, TB = Math.max(proAt(sc, sc.B.t), TA), long = TB - sc.t0 >= 1.6;
  const pp = [...sc.el.children].filter(e => e.style.display !== 'none').pop(), ta = pp.querySelector('.big'), H = 560, h0 = 236, y0 = 130;
  return t => { upd(t);
    if (ta && t < TA + 0.25) {                              // 头一行字跟着纸一起进（原来纸先空着亮 0.3 秒才出字）；过了这一刻和原来一模一样
      ta.style.opacity = (P(t, sc.t0 + 0.06, sc.t0 + 0.2) * (1 - 0.5 * P(t, TB - 0.05, TB + 0.2))).toFixed(4);
      ta.style.transform = `translate(0px,${((1 - P(t, sc.t0 + 0.06, sc.t0 + 0.35, E.outC)) * 16).toFixed(2)}px)`; }
    if (!long) return;
    const g = P(t, TB - 0.4, TB - 0.08, E.outC), h = h0 + (H - h0) * g; pp.style.height = h.toFixed(1) + 'px'; pp.style.top = (y0 + (H - h) / 2).toFixed(1) + 'px'; pp.style.overflow = g < 1 ? 'hidden' : 'visible'; };
}; }
// 「亮出大数」：数还没说到的时候纸只有标签那一条高，快说到了才长开，不让大半张纸空着等
{ const f0 = PRO['亮出大数']; PRO['亮出大数'] = sc => {
  const upd = f0(sc), T = proAt(sc, sc.num.t); if (!sc.what || T - sc.t0 < 1.3) return upd;
  const pp = sc.el.lastElementChild, H = 470, h0 = 132, y0 = 170;
  return t => { upd(t); const g = P(t, T - 0.36, T - 0.06, E.outC), h = h0 + (H - h0) * g; pp.style.height = h.toFixed(1) + 'px'; pp.style.top = (y0 + (H - h) / 2).toFixed(1) + 'px'; pp.style.overflow = g < 1 ? 'hidden' : 'visible'; };
}; }
// ---- 没有画面的句子：一屏一句（11-15 总控令）。整句一次出来，位置和字号固定，只强调一个词；不逐字打。----
// 上屏的字去掉语气词（只删不加，数字和否定词不动）；半句话照停顿拼成整句；按词折行，一屏最多三行，放不下拆成两屏。
// 带着免费版小动画记号（tpl）的句卡不动，照免费版画。
const BAN_F = 100, BAN_CY = 450, BAN_W = 900;        // 字号、块的中心高度、块宽
let BAN_PER_ = 0;
function banPer() {                                       // 每行最多几个字宽：照这套配色的真字体量（得意黑那类窄一点，一行放得下九个字；满格的黑体只放八个半），屏上最宽到八成半
  if (BAN_PER_) return BAN_PER_;
  let k = 1;
  try { const d = el('div', 'big', '国', document.body, { position: 'absolute', visibility: 'hidden', fontSize: '100px' }), cs = getComputedStyle(d), cx = window.BAN_CX || (window.BAN_CX = document.createElement('canvas').getContext('2d'));
    cx.font = `${cs.fontWeight} 100px ${cs.fontFamily}`; k = cx.measureText('国').width / 100 || 1; d.remove(); } catch (e) { k = 1; }
  return BAN_PER_ = 850 / BAN_F / Math.min(1.05, Math.max(0.85, k)) + 0.05;
}
function banRows(parts) {                                 // 一屏里的几句话照说话的断处分行：挨着的短句放得下就并一行；一句太长自己折成两行；折不进去返回 null
  const P = banPer(), m = [];
  let dang = false;                                       // 上一句是不是停在半句上（听写断句断在「离、的、就」这类字上，或者下一句拿「的、了」开头）
  for (const tk of parts) { const t = tk.join(''); if (m.length && (dang || XH_BACK.test(tk[0]) || (uW(m[m.length - 1] + t) <= P && !BAN_NEW.test(t)))) m[m.length - 1] += t; else m.push(t); dang = BAN_DANG.test(t) || XH_FWD.test(tk[tk.length - 1]); }
  const rows = [];
  for (const t of m) { if (uW(t) <= P) rows.push(t); else { const ls = xhCut(t, 2); if (!ls || Math.max(...ls.map(uW)) > P) return null; rows.push(...ls); } }
  return rows;
}
const BAN_FILL = /^[啊呢诶欸呀嘛哎哦嗯呃哈]$/, BAN_DANG = /(?:的|地|得|和|与|跟|把|被|比|向|对|给|是|在|离|就|用|本来|这|新|让)$/;
const BAN_STOP = /^(?:好像|看起来|来说|其实|可能|已经|然后|所以|就是|这个|那个|我们|他们|你们|什么|怎么|一个|一期|一句|一旦|估算|专门)$/;
const BAN_NEW = /^(?:可是|但是|但|不过|然而|而且|而|所以|因为|如果|甚至|再说|那|第[一二三四五六七八九十])/;
function banClean(s) {                                    // 去语气词：分词以后单独成词的那几个字才删；句尾的「吧」也删。只删不加
  const tk = xhTok(String(s).replace(/\s+/g, ''));
  const out = tk.filter((w, i) => !(BAN_FILL.test(w) || (w === '吧' && i === tk.length - 1)));
  return out.length ? out : tk;
}
function banScreens(sc) {                                 // 这张句卡里的几句话拼成几屏：[{a, b, tk, t0}]
  const S = []; let cur = null;
  for (let li = sc.la; li < Math.max(sc.lb, sc.la + 1); li++) {
    const l = LN[li], tk = banClean(lineText(l)), w = uW(tk.join(''));
    const prev = cur && LN[cur.b - 1], glue = cur && !BAN_NEW.test(tk.join('')) && (prev.gap < 0.2 || uW(lineText(prev)) <= 3 || BAN_DANG.test(cur.tk.join('')) || w <= 2.5 || (/\d/.test(tk.join('')) && w <= 5 && prev.gap < 0.6));   /* 只有一个数的短句（「15%以上」）跟着上一句出，别单独挂一屏 */
    const rows = cur && glue && cur.b - cur.a < 3 ? banRows(cur.parts.concat([tk])) : null;
    if (rows && rows.length <= 3) { cur.tk = cur.tk.concat(tk); cur.parts.push(tk); cur.b = li + 1; }      // 拼得进三行（照说话的断处分行）才拼
    else { cur = { a: li, b: li + 1, tk, parts: [tk], t0: l.t0 }; S.push(cur); }
  }
  return S;
}
function banLines(tk) {                                   // 折成一到三行：每行不超过 BAN_PER 个字宽，能少折就少折；折不进去返回 null（那就缩字）
  const s = tk.join('');
  for (let L = 1; L <= 3; L++) { const ls = xhCut(s, L); if (ls && Math.max(...ls.map(uW)) <= banPer()) return ls; }
  return null;
}
function banKw(scr) {                                     // 这一屏强调哪个词：先数，再逐句挑词那一步挑的词（得是整词、不是虚词），都没有就不强调
  const s = scr.tk.join(''); let pick = null;
  for (let li = scr.a; li < scr.b; li++) {
    const k = kwOf(li); if (!k || s.indexOf(k) < 0) continue;
    const p = s.indexOf(k); let acc = 0, okA = false, okB = false; for (const w of scr.tk) { if (acc === p) okA = true; acc += w.length; if (acc === p + k.length) okB = true; }
    if (!(okA && okB) || BAN_STOP.test(k) || (!/\d/.test(k) && xhTok(k).length !== 1)) continue;
    const c = LN[li].cs; let t = LN[li].t0; { const raw = lineText(LN[li]), q = raw.indexOf(k); if (q >= 0) { let n = 0; for (const x of c) { if (n >= q) { t = x[1]; break; } n += x[0].length; } } }
    const cand = { k, p, t, num: /\d/.test(k) };
    if (!pick || (cand.num && !pick.num) || (cand.num === pick.num && !cand.num)) pick = cand;      // 有数的优先；都没数取后说的那个
  }
  return pick;
}
// ---- 11-16 没有画面、也没补到图标的句子：只出本机挑的那个高亮词做大字，整句走字幕 ----
function banBig(sc, S) {
  if (PL.nopic) return null;                              // 剧本里写了 nopic 就不走这一套（对比用）
  const kw = banKw(S); if (!kw) return null;
  const H = 400, box = abs(el('div', null, null, sc.el, { height: H + 'px', transformOrigin: '50% 50%' }), 90, BAN_CY - H / 2, BAN_W);
  const F = Math.min(230, Math.floor(820 / Math.max(2, uW(kw.k)))), d = abs(el('div', 'big', null, box, { textAlign: 'center', fontSize: F + 'px', lineHeight: 1.1, whiteSpace: 'nowrap', color: 'var(--ink)' }), 0, (H - F * 1.1) / 2 - 16, BAN_W);
  const sp = el('span', null, null, d, { display: 'inline-block', position: 'relative', transformOrigin: '50% 60%' }); sp.appendChild(document.createTextNode(kw.k));
  const ul = el('i', null, null, sp, { position: 'absolute', left: '0', right: '0', bottom: (-F * 0.16) + 'px', height: Math.max(8, Math.round(F * 0.09)) + 'px', borderRadius: '99px', background: 'var(--acc)', transformOrigin: '0 50%' });
  const tk = Math.max(kw.t, S.t0 + 0.1);
  return { S, box, ke: [sp], tk, pic: 1, upd: t => { ul.style.transform = `scaleX(${P(t, tk + 0.02, tk + 0.42, E.outC).toFixed(4)})`; } };
}
{ const say0 = BUILD.say;
  BUILD.say = sc => {
    if (sc.tpl || PL.person) return say0(sc);
    sc.hideSubs = true; sc.ban1 = true;
    const scr = banScreens(sc).map(S => {
      const big = banBig(sc, S); if (big) return big;
      let ls = banRows(S.parts), F = BAN_F;
      if (!ls || ls.length > 3) ls = banLines(S.tk);
      if (!ls) { ls = xhCut(S.tk.join(''), 3) || [S.tk.join('')]; F = Math.max(56, Math.floor(BAN_W / (Math.max(...ls.map(uW)) * 1.03))); }
      const kw = banKw(S), h = ls.length * F * 1.24;
      const box = abs(el('div', 'big', null, sc.el, { textAlign: 'center', fontSize: F + 'px', lineHeight: 1.24, whiteSpace: 'nowrap', color: 'var(--ink)', transformOrigin: '50% 50%' }), 90, BAN_CY - h / 2, BAN_W);
      { const cs = getComputedStyle(box), cx = window.BAN_CX || (window.BAN_CX = document.createElement('canvas').getContext('2d'));   // 各套配色字体宽窄不一样（方格本那套是满格的黑体）：照真字体量一下最宽那行，超了就缩字
        if (cs.fontFamily) { cx.font = `${cs.fontWeight} ${F}px ${cs.fontFamily}`; const wid = Math.max(...ls.map(l => cx.measureText(l).width)); if (wid > BAN_W - 100) { const F2 = Math.floor(F * (BAN_W - 100) / wid); box.style.fontSize = F2 + 'px'; box.style.top = (BAN_CY - ls.length * F2 * 1.24 / 2) + 'px'; } } }
      let pos = 0, ke = null;
      ls.forEach((l, i) => {
        if (i) box.appendChild(document.createElement('br'));
        const a = pos, b = pos + l.length; pos = b;
        if (kw && kw.p < b && kw.p + kw.k.length > a) {                                   // 强调的词落在这一行（整词不会被折开，万一跨行就两行各亮一段）
          const x = Math.max(kw.p, a) - a, y = Math.min(kw.p + kw.k.length, b) - a;
          if (x > 0) box.appendChild(document.createTextNode(l.slice(0, x)));
          const sp = el('span', null, null, box, { display: 'inline-block', transformOrigin: '50% 60%' }); sp.textContent = l.slice(x, y); (ke = ke || []).push(sp);
          if (y < l.length) box.appendChild(document.createTextNode(l.slice(y)));
        } else box.appendChild(document.createTextNode(l));
      });
      return { S, box, ke, tk: kw ? Math.max(kw.t, S.t0 + 0.1) : 0 };
    });
    if (scr.some(s => s.pic)) { sc.hideSubs = false; sc.hideLines = new Set(); scr.forEach(s => { if (!s.pic) for (let li = s.S.a; li < s.S.b; li++) sc.hideLines.add(li); }); }   // 只出大词的那几句，整句走字幕；还打着整句的那几句照旧不出字幕
    return t => scr.forEach((s, i) => {
      const a = i === 0 ? sc.t0 : s.S.t0 - 0.12, nx = scr[i + 1], b = nx ? nx.S.t0 - 0.12 : sc.t1 + 1;
      const on = t >= a - 0.02 && t < b; s.box.style.display = on ? '' : 'none'; if (!on) return;
      const k = i === 0 ? 1 : P(t, a, a + 0.3, E.outC), out = nx ? P(t, b - 0.14, b - 0.02, E.inC) : 0;
      set(s.box, { o: (i === 0 ? 1 : P(t, a, a + 0.14)) * (1 - out), y: (1 - k) * 26, s: 0.975 + 0.025 * k });
      if (s.upd) s.upd(t);
      if (s.ke) { const g = P(t, s.tk - 0.04, s.tk + 0.1), bump = Math.sin(Math.PI * P(t, s.tk - 0.04, s.tk + 0.34, E.lin)); s.ke.forEach(e => { e.style.color = g > 0.5 ? 'var(--acc)' : 'var(--ink)'; e.style.transform = `scale(${(1 + 0.1 * bump).toFixed(4)})`; }); }
    });
  };
}
// 开场那几句也照一屏一句出（原来是逐字打，说完往上飞成片名；片名那行专业版里已经不出了）。整句从第一帧就在
{ const hook0 = BUILD.hook; BUILD.hook = sc => { if (PL.person) return hook0(sc); sc.noEnter = true; return BUILD.say(sc); }; }
{ const build0 = build; build = function () { build0(); if (!PL.person && !Q.get('plain') && !Q.get('cover')) { banshi(); try { if (window.huaProbe) window.huaProbe(); } catch (e) {} } }; }   // 搭完自己先过一遍把关：出框、空着、字不对的小画面当场退回一屏一句
