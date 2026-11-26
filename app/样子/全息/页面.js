// 2026-11-16 全息样子（竖屏 1080×1920）。画法全用抄来的 holo.js、hud.js（Lemo-Opuscar，MIT），这里只做三件事：
//   1 把咱们的线条图标变成它 modelFromPath 要的闭合外形（一笔一条带子），立成线框体；
//   2 竖屏怎么排（主体在上半屏中间，字在主体下面，字幕在更下面）；
//   3 三种现成画面：图标加几个字、几条并列的东西（一摞板子）、主角加一个数加一句话。
// 每个画面只吃「通义填的那几样」：图标名、几个字。时刻是从字幕里查那几个字什么时候说到的。
// window.draw(t)：t 是整条片里的秒。同一个 t 永远同一个样子。
const W = 1080, H = 1920, NS = 'http://www.w3.org/2000/svg', TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k;
const eo = k => 1 - Math.pow(1 - clamp(k), 3), eio = k => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const P = (t, a, b) => clamp((t - a) / (b - a));
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const T = HUD.theme(190, 38), holo = new HOLO.Holo(W, H);
const CN = 'NotoSC';                                    // 中文用软件里现有的字体
HUD.FONT.ui = 'Rajdhani, ' + CN; HUD.FONT.mono = 'ShareTechMono, ' + CN;
const LINES = DATA.lines;

// ───────── 图标 → 线框体 ─────────
function strokes(name) {                               // 把图标每一笔的中线取成一串点（24×24 的格子里）
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.style.cssText = 'position:absolute;left:-99px;top:0;width:24px;height:24px';
  svg.innerHTML = window.ICONS[name] || ''; document.body.appendChild(svg);
  const out = [], step = 0.3;
  for (const el of svg.querySelectorAll('path,circle,rect,line,polyline,polygon,ellipse')) {
    let L = 0; try { L = el.getTotalLength(); } catch (e) { continue; }
    let cur = [], prev = null; const n = Math.max(1, Math.ceil(L / step));
    for (let i = 0; i <= n; i++) {
      const p = el.getPointAtLength(L * i / n);
      if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) > (L / n) * 1.6 + 0.02) { out.push(cur); cur = []; }   // 跳了一大步：换了一笔
      cur.push([p.x, p.y]); prev = p;
    }
    out.push(cur);
  }
  svg.remove(); return out.filter(s => s.length);
}
function ribbons(sp, hw) {                             // 一笔中线 → 闭合外形。开口的一笔是一条两头圆的带子；首尾相接的一笔是内外两圈
  const n = sp.length, closed = n > 6 && Math.hypot(sp[0][0] - sp[n - 1][0], sp[0][1] - sp[n - 1][1]) < 0.12;
  if (n < 3 && Math.hypot(sp[0][0] - sp[n - 1][0], sp[0][1] - sp[n - 1][1]) < 0.3) { const c = sp[0], r = []; for (let i = 0; i < 12; i++) r.push([c[0] + Math.cos(i / 12 * TAU) * hw, c[1] + Math.sin(i / 12 * TAU) * hw]); return [r]; }   // 一个点
  const pts = closed ? sp.slice(0, n - 1) : sp, m = pts.length, L = [], R = [];
  for (let i = 0; i < m; i++) {
    const a = pts[closed ? (i - 1 + m) % m : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % m : Math.min(m - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    L.push([pts[i][0] - ty * hw, pts[i][1] + tx * hw]); R.push([pts[i][0] + ty * hw, pts[i][1] - tx * hw]);
  }
  if (closed) return [L, R];
  const cap = (c, from, k) => { const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]), r = []; for (let i = 1; i < 5; i++) r.push([c[0] + Math.cos(a0 - k * i / 5 * Math.PI) * hw, c[1] + Math.sin(a0 - k * i / 5 * Math.PI) * hw]); return r; };
  return [[...L, ...cap(pts[m - 1], L[m - 1], 1), ...R.reverse(), ...cap(pts[0], R[R.length - 1], 1)]];
}
function iconModel(name) {
  const loops = []; for (const sp of strokes(name)) for (const r of ribbons(sp, 1.0)) loops.push(r);
  const d = 3.4, n = loops.length;
  const pieces = loops.map((lp, i) => {
    const m = HOLO.modelFromPath(lp.map(([x, y]) => [x - 12, 24 - y]), { depth: d, id: name + '_' + i, slices: 3, ribEvery: 3, explode: [0, 0, (i - (n - 1) / 2) * 5 + (i % 2 ? 3 : -3)] });
    return m.parts[0].pieces[0];
  });
  return HOLO.normalizeModel(HOLO.prepModel({ name, parts: [{ id: 'obj', anchor: [0, 12, d / 2], pieces }] }), 2.3117);
}
function stackModel(n) {                               // 几条并列的东西：一摞板子，一条一块，从下往上摞
  const rr = (w, h, r) => { const p = []; for (const [cx, cy, a0] of [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 1], [-w / 2 + r, -h / 2 + r, 2], [w / 2 - r, -h / 2 + r, 3]]) for (let i = 0; i <= 4; i++) { const a = (a0 + i / 4) * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; };
  const gap = 4.4, bw = 7, bh = 2.6, bd = 6, parts = [];
  for (let i = 0; i < n; i++) {
    const y = i * gap + bh / 2, m = HOLO.modelFromPath(rr(bw, bh, 0.5).map(([x, yy]) => [x, yy + y]), { depth: bd, id: 'p' + i, slices: 4, explode: [0, -(i - (n - 1) / 2) * (gap - bh), 0] });
    const pc = m.parts[0].pieces[0]; parts.push({ id: 'p' + i, anchor: [bw / 2, y, 0], pieces: [pc] });
  }
  const tot = (n - 1) * gap + bh, kf = Math.min(1, tot / 15.8 * 1.25), M = HOLO.normalizeModel(HOLO.prepModel({ name: 'stack', parts }), 2.3117 * kf); M.kf = kf;      // 15.8 = 四行时的总高；不到四行的板子最多比四行时大四分之一
  M.tops = parts.map((_, i) => M.ymax * (i * gap + bh) / tot); return M;        // 每块板子的顶在多高（扫描面长到这儿算这块长完）
}

// ───────── 字 ─────────
function when(word, from = 0) {                        // 这几个字是第几秒说到的（从字幕里查；查不到回 null）
  for (const l of LINES) { if (l.t1 < from) continue; const i = l.text.indexOf(word); if (i >= 0 && l.cs[i]) return l.cs[i][1]; }
  return null;
}
function cells(text, k, frame, x, y, size, o = {}) {   // 一格一个字，从左往右一个个扫出来（11-16 夜：不再先跳字母符号，买的人会当成乱码出错）
  ctx.font = `${o.weight || 700} ${size}px ${CN}`;
  const n = text.length, advs = [...text].map(ch => /[ -~]/.test(ch) ? Math.max(size * 0.34, ctx.measureText(ch).width + size * 0.07) : size * 1.04), w = advs.reduce((p, q) => p + q, 0), x0 = o.align === 'center' ? x - w / 2 : x, a = o.alpha ?? 1; let cx = x0;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
  for (let i = 0; i < n; i++) {
    const lockAt = 0.15 + (i / Math.max(1, n)) * 0.7, on = k >= lockAt;      // 中文从左往右锁
    const adv = advs[i], xc = cx + adv / 2; cx += adv;
    if (k <= 0 || !on) continue;
    const ch = text[i];
    ctx.font = on ? `${o.weight || 700} ${size}px ${CN}` : `400 ${size * 0.8}px ShareTechMono`;
    const flash = on && k < lockAt + 0.12;
    ctx.shadowColor = T.line(0.9 * a); ctx.shadowBlur = on ? size * 0.28 : 0;
    ctx.fillStyle = on ? (flash ? '#fff' : (o.color || T.hi(0.98 * a))) : T.dim(0.75 * a);
    ctx.fillText(ch, xc, y);
  }
  ctx.restore(); return { x0, w };
}
function lockNum(str, k) {                             // 数：一位一位锁定，没锁的那一位是一个空框，半路屏上不出现别的数字
  const n = str.length; let out = [];
  for (let i = 0; i < n; i++) out.push(k >= 0.2 + (i / Math.max(1, n)) * 0.6 ? str[i] : null);      // 从左往右，跟嘴说的顺序一样
  return out;
}
function vignette(k = 0.55) { const g = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.45, H * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${k})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
const SUB_PX = 62, SUB_Y = 1580;                        // 字幕字号照软件现在的（样式.css：.sub 800 62px），不比它小
function subtitle(text, a, t) {                        // 字幕：照 hud.js 的 subtitle 改的竖屏版（中文字体、字大一号、不按空格折行）
  if (!text || a <= 0) return;
  ctx.save(); const y = SUB_Y; ctx.font = `800 ${SUB_PX}px ${CN}`; const tw = ctx.measureText(text).width, x = W / 2 - tw / 2 + 14, h = 74;
  ctx.fillStyle = `rgba(1,8,12,${0.66 * a})`; ctx.fillRect(x - 62, y - h - 16, tw + 92, h + 34);
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = T.line(0.55 * a); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x - 62, y - h - 16 + 14); ctx.lineTo(x - 62, y - h - 16); ctx.lineTo(x - 48, y - h - 16);
  ctx.moveTo(x + tw + 30 - 14, y + 18); ctx.lineTo(x + tw + 30, y + 18); ctx.lineTo(x + tw + 30, y + 4); ctx.stroke();
  ctx.fillStyle = T.line(0.9 * a);
  for (let i = 0; i < 4; i++) { const hh = 9 + 23 * Math.abs(Math.sin(t * 9 + i * 1.7)); ctx.fillRect(x - 46 + i * 8, y - h / 2 - 2 - hh / 2, 4, hh); }
  ctx.fillStyle = T.hi(0.97 * a); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, x, y - 12);
  ctx.restore();
}
function readouts(t, a = 1) {                          // 角上的小读数：只有字母和小条，没有数字（免得被当成稿子里的数）
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.font = '20px ShareTechMono'; ctx.textBaseline = 'middle';
  const col = (x, y, tag, seed, right) => {
    ctx.fillStyle = T.dim(0.8 * a); ctx.textAlign = right ? 'right' : 'left'; ctx.fillText(tag, x, y);
    for (let i = 0; i < 9; i++) { const v = 0.25 + 0.75 * Math.abs(Math.sin(t * (1.1 + i * 0.23) + seed + i * 1.3)); ctx.fillStyle = T.line((0.25 + 0.5 * v) * a); const bx = right ? x - 70 - i * 9 : x + 70 + i * 9; ctx.fillRect(bx, y + 9 - 20 * v, 5, 20 * v); }
  };
  col(70, 132, 'SIG', 1); col(70, 162, 'TRK', 4); col(W - 70, 132, 'PWR', 7, true); col(W - 70, 162, 'SYN', 9, true);
  // 底下一条：声纹一样的细条 + 来回走的游标
  const y0 = 1700, n = 84, x0 = 110, x1 = W - 110;
  for (let i = 0; i < n; i++) { const u = i / (n - 1), v = Math.abs(Math.sin(u * 19 + t * 3.1) * Math.sin(u * 7 - t * 1.7)) * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.9 + u * 3))); ctx.fillStyle = T.line(0.14 + 0.4 * v * a); ctx.fillRect(lerp(x0, x1, u) - 2, y0 - 26 * v, 4, 52 * v + 2); }
  ctx.strokeStyle = T.dim(0.5 * a); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y0 + 46); ctx.lineTo(x1, y0 + 46);
  for (let i = 0; i <= 40; i++) { const x = lerp(x0, x1, i / 40); ctx.moveTo(x, y0 + 46); ctx.lineTo(x, y0 + (i % 5 ? 52 : 60)); } ctx.stroke();
  const cx = lerp(x0, x1, 0.5 + 0.5 * Math.sin(t * 0.7)); ctx.fillStyle = T.acc(0.9 * a); ctx.fillRect(cx - 1.5, y0 + 36, 3, 28);
  ctx.fillStyle = T.dim(0.7 * a); ctx.textAlign = 'left'; ctx.fillText('VOICE·IN', x0, y0 + 84); ctx.textAlign = 'right'; ctx.fillText('LIVE', x1, y0 + 84);
  ctx.restore();
}
function sweep(t) {                                    // 一道很淡的横扫线，四秒从上到下走一趟
  const y = ((t / 4) % 1) * (H + 400) - 200; ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, y - 160, 0, y + 40); g.addColorStop(0, T.line(0)); g.addColorStop(0.8, T.line(0.045)); g.addColorStop(1, T.line(0)); ctx.fillStyle = g; ctx.fillRect(0, y - 160, W, 200);
  const gl = ctx.createLinearGradient(0, 0, W, 0); gl.addColorStop(0, T.line(0)); gl.addColorStop(0.5, T.line(0.2)); gl.addColorStop(1, T.line(0)); ctx.fillStyle = gl; ctx.fillRect(0, y - 1, W, 1.5); ctx.restore();
}
function stage(t, cam, o = {}) {                       // 底：暗场、点阵、转盘、光柱、光尘。一直在动
  HUD.background(ctx, 1920, 1920, T, { cx: cam.cx, cy: cam.cy + 80, px: t * 14, py: t * 7 });
  let pc = cam;
  if (o.padK) {                                         // 底盘缩小：镜头拉远 padK 倍，再把地面中心对回原处
    const b = new Float32Array(3), p0 = HOLO.makeCamera(cam, W, H).project(0, 0, 0, b).slice(); pc = { ...cam, dist: cam.dist * o.padK };
    const p1 = HOLO.makeCamera(pc, W, H).project(0, 0, 0, b); pc.cx = cam.cx + p0[0] - p1[0]; pc.cy = cam.cy + p0[1] - p1[1];
  }
  HOLO.drawPad(ctx, pc, W, H, { rot: t * 0.22, alpha: o.pad ?? 1 });
  HUD.beam(ctx, T, HOLO.makeCamera(pc, W, H).project, (o.beam ?? 0.9), t, { y1: (o.top ?? 1.75) * (o.padK || 1), r1: 0.95 });
}
function camOf(t, o = {}) { return { target: [0, o.ty ?? 0.82, 0], yaw: 0.10 * Math.sin(t * 0.5), pitch: o.pitch ?? 0.2, dist: (o.dist ?? 7.6) * (1 - 0.018 * Math.sin(t * 0.37)), fov: 0.6, cx: o.cx ?? 540, cy: o.cy ?? 640 }; }
const uni = bbs => bbs.filter(Boolean).reduce((a, b) => a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b.slice(), null);

// ───────── 三种现成画面。each: make(spec) → draw(t)，spec 里只有通义填的东西加起止时刻 ─────────
const MODELS = {};
const autoSolid = name => { if (typeof SOLID === 'undefined') return null; const m = SOLID.build(name); return m && !m.err ? m : null; };      // 拼页面时带了 立体.js 就用自动立体（177 只同一个办法）；没带还是老的一笔一条带子
const modelOf = name => MODELS[name] || (MODELS[name] = autoSolid(name) || iconModel(name));

// 一、图标加几个字：{ a, b, icon, word }
function sceneIcon(S) {
  const m = modelOf(S.icon), a = S.a, tw = Math.max(when(S.word, a - 0.5) ?? a + 0.6, a + 0.55);
  return t => {
    const cam = camOf(t, { dist: 7.0, cy: 670 }), frame = Math.floor(t * 24), out = P(t, S.b - 0.4, S.b - 0.02);
    stage(t, cam);
    const grow = eio(P(t, a + 0.05, a + 1.15)), o = { hue: T.hue, spin: 0.5 * Math.sin((t - a) * 0.75 + 0.6), explode: { obj: 1 - eo(P(t, a, a + 0.95)) }, solid: 0.22 * P(t, a + 1.1, a + 1.6), wave: { y: ((t - a) * 0.55 % 1.6) * 1.2 - 0.1, w: 0.05 } };
    if (grow < 1) o.scan = { y: m.ymax * grow + 0.001 };
    if (out > 0) o.scanDown = { y: m.ymax * (1 - eio(out)) };
    const info = holo.draw(ctx, m, cam, o);
    if (grow < 1 && grow > 0) HOLO.drawScanPlane(ctx, cam, W, H, m.ymax * grow, { rot: t * 0.6, alpha: 1 - P(t, a + 1.0, a + 1.15) });
    const A = 1 - out, lk = P(t, a + 1.0, a + 1.45), bb = info.bbox.obj;
    HUD.targetBox(ctx, T, bb, lk, { tag: 'LOCK', flash: lk > 0.93 && lk < 1 || (t > a + 1.45 && t < a + 1.52), alpha: A, pad: 30 });
    const ly = 1318, kw = P(t, tw, tw + 0.55), an = info.anchor.obj;
    if (bb) HUD.leader(ctx, T, [bb[0] + 26, bb[3] + 40], [W / 2 - 250, ly - 150], [W / 2 - 250, ly - 112], P(t, tw - 0.25, tw + 0.2), { alpha: A, pulse: P(t, tw, tw + 0.8) < 1 ? P(t, tw, tw + 0.8) : 0 });
    const c = cells(S.word, kw, frame, W / 2, ly, 124, { align: 'center', alpha: A, weight: 800 });
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = T.line(0.8 * A * kw); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c.x0, ly + 34); ctx.lineTo(c.x0 + c.w * eo(kw), ly + 34); ctx.stroke(); ctx.fillStyle = T.acc(0.95 * A * kw); ctx.fillRect(c.x0, ly + 30, 46 * eo(kw), 8); ctx.restore();
  };
}
// 二、几条并列的东西：{ a, b, rows:[…] }。一条一块板子，说到哪条哪块长出来，引线拉到那几个字
function sceneStack(S) {
  const n = S.rows.length, m = stackModel(n), ts = []; let from = S.a - 0.3;
  for (const r of S.rows) { const w = when(r, from) ?? (ts.length ? ts[ts.length - 1] + 1 : S.a + 0.5); ts.push(Math.max(S.lead && !ts.length ? S.a + 0.35 : w, S.a + 0.35)); from = w; }
  const tm = 1e9;      // 11-16 夜：不再并成一块（并完字先撤，只剩一摞方块挂两三秒，试看的人看不懂）；字和方块一直留到这张收场，一起走
  return t => {
    const cam = camOf(t, { cx: lerp(292, 540, eio(P(t, tm + 0.28, tm + 0.82))), cy: 770, dist: 7.96, ty: 1.0 * m.kf, pitch: 0.26 }), frame = Math.floor(t * 24), out = P(t, S.b - 0.38, S.b - 0.02), A = 1 - out;
    stage(t, cam, { top: 2.12 * m.kf, padK: 1.7 });
    let lvl = 0, cur = -1; for (let i = 0; i < n; i++) { const k = eio(P(t, ts[i] - 0.12, ts[i] + 0.4)); lvl += k; if (t >= ts[i] - 0.12) cur = i; }
    const partTop = i => m.tops[i], sy = lvl >= n ? null : (Math.floor(lvl) >= n ? m.ymax : lerp(Math.floor(lvl) ? partTop(Math.floor(lvl) - 1) : 0, partTop(Math.floor(lvl)), lvl - Math.floor(lvl)) + 0.002);
    const mg = eio(P(t, tm, tm + 0.7)), ex = {}, fl = {}; for (let i = 0; i < n; i++) { ex['p' + i] = mg; fl['p' + i] = (t > ts[i] + 0.36 && t < ts[i] + 0.46) ? 1 : 0; }
    const o = { hue: T.hue, spin: 0.55 + 0.35 * Math.sin((t - S.a) * 0.6), explode: ex, flash: fl, solid: 0.3, wave: mg > 0 ? { y: m.ymax * P(t, tm - 0.6, tm + 0.5), w: 0.06 } : null };
    if (sy != null) o.scan = { y: sy }; if (cur >= 0 && lvl < n && mg <= 0) { o.focus = 'p' + cur; o.dim = 0.55; }
    if (out > 0) o.scanDown = { y: m.ymax * (1 - eio(out)) };
    // 暗空位：单子有几条，填之前就知道。先摆一座暗的塔影，哪块还没说到哪块就是暗的
    const gh = P(t, S.a + 0.1, S.a + 0.65) * A, rest = []; for (let i = 0; i < n; i++) if (t < ts[i] + 0.4) rest.push('p' + i);
    const ghost = rest.length && gh > 0 && mg <= 0 ? holo.draw(ctx, m, cam, { hue: T.hue, spin: o.spin, gain: 0.3 * gh, only: rest }) : null;
    const info = holo.draw(ctx, m, cam, o), anc = { ...(ghost ? ghost.anchor : {}), ...info.anchor };
    if (sy != null && lvl > 0.02) HOLO.drawScanPlane(ctx, cam, W, H, sy, { rot: t * 0.6, r: 0.72 });
    const LX = 584;
    for (let i = 0; i < n; i++) {
      const an = anc['p' + i], k = P(t, ts[i], ts[i] + 0.5), fade = A * (1 - P(t, tm, tm + 0.3)); if (!an || fade <= 0) continue;
      const y = an[1] + 28;                                // 字跟着那块板子的高度走
      const sl = gh * P(t, S.a + 0.25 + i * 0.14, S.a + 0.7 + i * 0.14) * (1 - clamp(k * 2.5));      // 暗空位：小编号、细线、一个字一个空格
      if (sl > 0) {
        const sz = Math.min(78, Math.floor((W - 60 - LX) / (S.rows[i].length * 1.04)));
        HUD.leader(ctx, T, [an[0] + 8, an[1]], [LX - 70, y - 22], [LX - 14, y - 22], 1, { alpha: 0.32 * sl });
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.font = '26px ShareTechMono'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = T.dim(0.85 * sl); ctx.fillText('0' + (i + 1), LX, y - sz - 10);
        ctx.fillStyle = T.dim(0.45 * sl); ctx.fillRect(LX + 40, y - sz - 19, W - 70 - LX - 40, 1.5); ctx.strokeStyle = T.dim(0.55 * sl); ctx.lineWidth = 1.5;
        for (let j = 0; j < S.rows[i].length; j++) ctx.strokeRect(LX + j * sz * 1.04 + sz * 0.1, y - sz * 0.82, sz * 0.84, sz * 0.9);
        ctx.restore();
      }
      if (k <= 0) continue;
      HUD.leader(ctx, T, [an[0] + 8, an[1]], [LX - 70, y - 22], [LX - 14, y - 22], P(t, ts[i] - 0.1, ts[i] + 0.3), { alpha: fade, pulse: k < 1 ? k : 0 });
      const size = Math.min(78, Math.floor((W - 60 - LX) / (S.rows[i].length * 1.04)));
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.font = '26px ShareTechMono'; ctx.fillStyle = T.acc(0.95 * fade * clamp(k * 3)); ctx.textBaseline = 'alphabetic'; ctx.fillText('0' + (i + 1), LX, y - size - 10); ctx.fillStyle = T.line(0.5 * fade * k); ctx.fillRect(LX + 40, y - size - 19, (W - 70 - LX - 40) * eo(k), 1.5); ctx.restore();
      cells(S.rows[i], k, frame, LX, y, size, { alpha: fade, seed: i * 5 });
    }
    const bb = uni(S.rows.map((_, i) => info.bbox['p' + i])), lk = P(t, tm - 0.9, tm - 0.4);
    HUD.targetBox(ctx, T, bb, lk, { tag: 'ALL·IN', alpha: A, pad: 24, flash: t > tm + 0.66 && t < tm + 0.76 });
  };
}
// 三、主角加一个数加一句话：{ a, b, icon, name, num:{val,unit}, tag }。数先在主体下面锁定，说到下一句就收进右上的小牌子，让位给那句话
function sceneHero(S) {
  const m = modelOf(S.icon), a = S.a, tn = Math.max(when(S.name, a - 0.5) ?? a + 0.3, a + 0.3);
  const tv = S.num ? when(S.num.val + S.num.unit, a) ?? when(S.num.val, a) : null, tg = S.tag ? when(S.tag, tv ?? a) ?? when(S.tag.slice(1), tv ?? a) : null;
  return t => {
    const cam = camOf(t, { dist: 7.45, cy: 640 }), frame = Math.floor(t * 24), out = P(t, S.b - 0.4, S.b - 0.02), A = 1 - out;
    stage(t, cam);
    const grow = eio(P(t, a + 0.05, a + 1.2)), o = { hue: T.hue, spin: 0.5 * Math.sin((t - a) * 0.7 - 0.5), explode: { obj: 1 - eo(P(t, a, a + 1.0)) }, solid: 0.22 * P(t, a + 1.1, a + 1.6), wave: { y: ((t - a) * 0.5 % 1.7) * 1.2 - 0.1, w: 0.05 } };
    if (grow < 1) o.scan = { y: m.ymax * grow + 0.001 }; if (out > 0) o.scanDown = { y: m.ymax * (1 - eio(out)) };
    if (S.early && grow < 1) holo.draw(ctx, m, cam, { hue: T.hue, spin: o.spin, gain: 0.3 * P(t, a + 0.05, a + 0.4) });      // 换屏落定后半秒内主体得在：先给一只淡的整影
    const info = holo.draw(ctx, m, cam, o), bb = info.bbox.obj, an = info.anchor.obj;
    if (grow < 1 && grow > 0) HOLO.drawScanPlane(ctx, cam, W, H, m.ymax * grow, { rot: t * 0.6, alpha: 1 - P(t, a + 1.05, a + 1.2) });
    const lk = P(t, a + 1.05, a + 1.5);
    HUD.targetBox(ctx, T, bb, lk, { tag: 'AGENT', flash: (lk > 0.93 && lk < 1) || (t > a + 1.5 && t < a + 1.57), alpha: A, pad: 30 });
    // 名字
    const kn = P(t, tn, tn + 0.6), ny = 1212;
    if (bb) HUD.leader(ctx, T, [bb[2] - 26, bb[3] + 40], [W / 2 + 300, ny - 140], [W / 2 + 300, ny - 100], P(t, tn - 0.2, tn + 0.25), { alpha: A });
    const c = cells(S.name, kn, frame, W / 2, ny, Math.min(104, Math.floor(900 / (S.name.length * 1.04))), { align: 'center', alpha: A, weight: 800 });
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = T.line(0.8 * A * kn); ctx.fillRect(c.x0, ny + 28, c.w * eo(kn), 2); ctx.restore();
    // 数
    const slotY = 1332;
    if (tv != null) {
      const k = P(t, tv - 0.05, tv + 0.75), dock = tg != null ? eio(P(t, tg - 0.25, tg + 0.3)) : 0, val = S.num.val, unit = S.num.unit;
      if (k > 0) {
        const far = dock >= 0.5, size = far ? 54 : lerp(150, 132, P(dock, 0, 0.3)), x = far ? W - 250 : W / 2, y = far ? 238 : slotY + 44, locked = k >= 1;
        ctx.save(); const A0 = A, fly = far ? P(dock, 0.72, 1) : 1 - P(dock, 0, 0.3);      // 收进小牌子：原地淡没，一粒光点飞到角上，再在小牌子里亮出来
        if (dock > 0.18 && dock < 0.84) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let j = 0; j < 7; j++) { const u = eio(P(dock - j * 0.022, 0.18, 0.8)), sx = lerp(W / 2, W - 250, u) + 90 * Math.sin(Math.PI * u), sy = lerp(slotY, 232, u); ctx.shadowColor = T.acc(0.9 * A0); ctx.shadowBlur = j ? 0 : 22; ctx.fillStyle = T.acc(A0 * (1 - j / 7) * (j ? 0.5 : 1)); ctx.beginPath(); ctx.arc(sx, sy, j ? 4 - j * 0.4 : 6, 0, TAU); ctx.fill(); } ctx.restore(); }
        if (dock > 0.02) HUD.plate(ctx, T, x - 150, y - 60, 330, 84, A0 * dock * dock);
        ctx.globalCompositeOperation = 'lighter'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; { const A = A0 * fly;
        ctx.font = `600 ${size}px ${HUD.FONT.ui}`; const adv = ctx.measureText('0').width * 1.04, got = lockNum(val, k);
        ctx.font = `600 ${size * 0.42}px ${CN}`; const uw = ctx.measureText(unit).width; ctx.font = `600 ${size}px ${HUD.FONT.ui}`;
        const cw = ch => /\d/.test(ch) ? adv : size * 0.98, vw = [...val].reduce((s, ch) => s + cw(ch), 0), x0 = x - (vw + 14 + uw) / 2; let cx = x0;
        const flash = locked && k < 1.0001 && P(t, tv + 0.75, tv + 0.86) < 1;
        [...val].forEach((ch, i) => {
          const w = cw(ch);
          if (got[i] != null) { ctx.font = /\d/.test(ch) ? `600 ${size}px ${HUD.FONT.ui}` : `700 ${size * 0.86}px ${CN}`; ctx.shadowColor = T.acc(0.8 * A); ctx.shadowBlur = size * 0.16; ctx.fillStyle = flash ? '#fff' : T.acc(A); ctx.textAlign = 'center'; ctx.fillText(ch, cx + w / 2, y); ctx.shadowBlur = 0; }
          else { ctx.strokeStyle = T.line(0.75 * A * (0.5 + 0.5 * Math.abs(Math.sin(t * 14 + i)))); ctx.lineWidth = 2; ctx.strokeRect(cx + w * 0.14, y - size * 0.66, w * 0.72, size * 0.66); }
          cx += w;
        });
        ctx.textAlign = 'left'; ctx.font = `600 ${size * 0.42}px ${CN}`; ctx.fillStyle = locked ? T.acc(0.92 * A) : T.line(0.6 * A * clamp(k * 2)); ctx.fillText(unit, cx + 14, y - size * 0.04);
        if (dock < 0.5) { ctx.fillStyle = T.dim(0.35 * A * (1 - dock * 2)); ctx.fillRect(W / 2 - 260, slotY + 80, 520, 2); ctx.fillStyle = (locked ? T.acc(0.9 * A) : T.line(0.9 * A)); ctx.globalAlpha = 1 - dock * 2; ctx.fillRect(W / 2 - 260, slotY + 80, 520 * clamp(k), 2); }
        } ctx.restore();
      }
    }
    // 那句话
    if (tg != null) {
      const k = P(t, tg, tg + 0.6), size = Math.min(84, Math.floor(880 / (S.tag.length * 1.04)));
      if (k > 0) {
        const w = S.tag.length * size * 1.04; HUD.plate(ctx, T, W / 2 - w / 2 - 34, slotY - 62, (w + 68) * eo(clamp(k * 1.6)), 132, A * clamp(k * 3));
        if (bb) HUD.leader(ctx, T, [bb[0] - 4, an[1] + 60], [W / 2 - w / 2 - 34, slotY - 150], [W / 2 - w / 2 - 34, slotY - 62], P(t, tg - 0.1, tg + 0.35), { alpha: A });
        cells(S.tag, k, frame, W / 2, slotY + 32, size, { align: 'center', alpha: A, seed: 9, weight: 700 });
      }
    }
  };
}

// 四、标题：{ a, b, big, small }。一块牌子浮在光柱里先打开，大字一格一格锁定；小字在牌子底下
function sceneTitle(S) {
  const a = S.a, said = when(S.big, a - 0.5) ?? a + 0.3, tw = Math.min(Math.max(said, a + 0.12), a + 0.35);      // 标题只有字，字就是主体：换屏落定后半秒内得在
  const ts = S.small ? Math.max(when(S.small, a - 0.5) ?? tw + 0.5, a + 0.3) : null, n = [...S.big].length, size = Math.min(170, Math.floor(880 / (n * 1.04))), w = n * size * 1.04, cy = 800, ph = size + 150;
  return t => {
    const cam = camOf(t, { dist: 7.6, cy: 820 }), frame = Math.floor(t * 24), out = P(t, S.b - 0.36, S.b - 0.02), A = 1 - out, open = eo(P(t, a + 0.02, a + 0.36)), k = P(t, tw, tw + 0.6);
    stage(t, cam, { beam: 0.7 });
    const pw = (w + 130) * open, x0 = W / 2 - pw / 2, y0 = cy - ph / 2;
    HUD.plate(ctx, T, x0, y0, pw, ph, A * open);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = T.hi(0.9 * A * open); ctx.lineWidth = 3; ctx.beginPath();      // 四个角的角标
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const cx = W / 2 + sx * (pw / 2 + 14), y = cy + sy * (ph / 2 + 14); ctx.moveTo(cx, y - sy * 44); ctx.lineTo(cx, y); ctx.lineTo(cx - sx * 44, y); }
    ctx.stroke(); ctx.restore();
    cells(S.big, k, frame, W / 2, cy + size * 0.36, size, { align: 'center', alpha: A, weight: 800 });
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = T.acc(0.9 * A * k); ctx.fillRect(W / 2 - w / 2, y0 + ph - 26, w * eo(k), 3); ctx.restore();
    if (ts != null) { const m = [...S.small].length, sz = Math.min(64, Math.floor(860 / (m * 1.04))); cells(S.small, P(t, ts, ts + 0.5), frame, W / 2, y0 + ph + 110, sz, { align: 'center', alpha: A, seed: 5, weight: 600 }); }
  };
}

// ───────── 这一段的排法（照第八份候选甲的真答卷：三张小画面的起止、图标、字都是通义填的；数那一样是照原话手加的，答卷里没配） ─────────
// 没配上画面的那几句：只有底盘、光柱在转（还有角上的小读数和字幕）。屏上放什么还没设计，这是个空位
// 2026-11-22 改：空位不再空着。这句的要紧词（架子给的 big）放大摆在台上，这句一开口就一格一格锁定出来，停顿时留着，下一句开口或说完 1.2 秒后收
function bigWord(t) {
  const l = LINES.filter(l => l.big && t >= l.t0 - 0.12 && t < (l.be ?? l.t1 + 0.32)).pop(); if (!l) return;
  const w = l.big, n = [...w].length, size = Math.min(190, Math.floor(860 / (n * 1.04))), cy = 760, end = l.be ?? l.t1 + 0.32;
  const at = l.t0 - 0.12, k = P(t, at, at + 0.4), A = clamp((end - t) * 5);
  const r = cells(w, k, Math.floor(t * 24), W / 2, cy + size * 0.36, size, { align: 'center', alpha: A, weight: 800 });
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = T.acc(0.9 * A * k); ctx.fillRect(W / 2 - r.w / 2, cy + size * 0.62, r.w * eo(k), 3); ctx.restore();
}
function sceneIdle(S) { return t => { stage(t, camOf(t, { dist: 7.6, cy: 700 }), { beam: 0.55 }); bigWord(t); }; }
const SCENES = { icon: sceneIcon, stack: sceneStack, hero: sceneHero, title: sceneTitle, none: sceneIdle };      // 后面的脚本可以往里换画法（并图标的 场面.js 把 icon 换成自动立体那种），换完把 SHOTS 清掉
let SHOTS = null;
const shotsOf = () => SHOTS || (SHOTS = DATA.shots.map(s => ({ ...s, fn: SCENES[s.kind](s) })));
let lastMs = 0;
window.draw = t => {
  const t0 = performance.now();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  const SH = shotsOf(), s = SH.find(s => t >= s.a && t < s.b) || SH[SH.length - 1];
  s.fn(t);
  sweep(t);
  HUD.chrome(ctx, W, H, T, { px: t * 16, tl: 'HOLO·SCAN', tr: s.kind === 'stack' ? 'LIST·MODE' : 'OBJ·MODE', bl: '', br: 'REC' });      // 左下角原来写着试验时的记号「AS·DEMO」，用户的片子上不该有，搬进软件时拿掉了（2026-11-16）
  readouts(t);
  const l = LINES.filter(l => t >= l.t0 - 0.02 && t < l.t1 + 0.32).pop();      // 两句挨着的时候显示后开口的那句
  if (l) subtitle(l.text, clamp((t - l.t0 + 0.02) * 12) * clamp((l.t1 + 0.32 - t) * 8), t);
  vignette(0.5);
  const cut = SH.map(s => s.a).filter(a => a > SH[0].a).find(a => t >= a && t < a + 0.085);
  if (cut != null) HUD.glitch(ctx, W, H, 0.55, Math.floor(t * 30));
  lastMs = performance.now() - t0; return lastMs;
};
window.READY = document.fonts.ready.then(() => Promise.all(['600 40px Rajdhani', '300 40px Rajdhani', '400 20px ShareTechMono', `700 40px ${CN}`].map(f => document.fonts.load(f, '淘宝AI助手40亿')))).then(() => { shotsOf().forEach(s => s.fn(s.a)); return true; });
