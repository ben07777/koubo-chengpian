// 2026-11-16 小图标并进全息的画面：一只图标加一个词（「补图标」那种）。自己写的；立体、底盘、引线、字还是用 holo.js、hud.js（MIT）和全息版那份 页面.js 里现成的。
//   能立的：自动立成的线框体（立体.js）。
//   立不好的：平的发光线条图标，放在一块全息板上，照样做白名单里配给它的那个动作（图标画.js）。
//   进场四种、摆法四种，按种子排；同一条片里相邻两次不会一样。
//   旁边那个词用引线牵出来，摆在图形外头，不压图形。
// 图标和词从哪来：云端在这张画面上填的；别的种类落回来的，图标用 yangzi.py 里那张固定的表、词取那一种最要紧的那一栏。

// ───────── 四种进场 ─────────（o：给 holo.draw 的选项；k：进场走到几成；lt：这张画面开始后第几秒；回要不要换镜头）
const IN_LEN = 1.15;
const ENTR = [
  { name: '扫描长出', fn: (o, k, lt, m, cam) => { if (k < 1) o.scan = { y: m.ymax * k + 0.001 }; o.explode = { obj: 1 - eo(P(lt, 0, 0.95)) }; return { cam, plane: k > 0 && k < 1 ? m.ymax * k : null }; } },
  { name: '碎块合拢', fn: (o, k, lt, m, cam) => { o.explode = { obj: 1 - eo(k) }; o.gain = clamp(k * 2.4); o.flash = { obj: lt > IN_LEN && lt < IN_LEN + 0.08 ? 1 : 0 }; return { cam }; } },
  { name: '转身亮相', fn: (o, k, lt, m, cam) => { o.spin += (1 - eo(k)) * 1.75; o.gain = clamp(k * 2.6); o.flash = { obj: lt > IN_LEN && lt < IN_LEN + 0.08 ? 1 : 0 }; return { cam }; } },
  { name: '顺光柱落下', fn: (o, k, lt, m, cam) => { const u = clamp(lt / 0.95), fall = u < 0.62 ? Math.pow(u / 0.62, 2) : 1 - 0.1 * Math.sin((u - 0.62) / 0.38 * Math.PI); o.gain = clamp(lt * 5); o.flash = { obj: u >= 0.62 && u < 0.7 ? 1 : 0 }; return { cam: { ...cam, cy: cam.cy - (1 - fall) * 820 } }; } },
];
// ───────── 四种摆法 ─────────（镜头、转法、词摆在哪）
const POSE = [
  { name: '正面微摆·词在下', cam: { dist: 7.0, pitch: 0.2, cx: 540, cy: 660 }, spin: lt => 0.5 * Math.sin(lt * 0.75 + 0.6), word: { at: 'below', x: 540, align: 'center' } },
  { name: '侧身近看·词在右下', cam: { dist: 6.5, pitch: 0.12, cx: 450, cy: 690 }, spin: lt => 0.52 + 0.12 * Math.sin(lt * 0.9), word: { at: 'below', x: 996, align: 'right' } },
  { name: '俯看慢转·词在上', cam: { dist: 7.3, pitch: 0.42, cx: 540, cy: 860 }, spin: lt => -0.45 + Math.min(0.9, 0.3 * lt), word: { at: 'above', x: 540, align: 'center' } },
  { name: '偏左放大·词在左下', cam: { dist: 6.2, pitch: 0.22, cx: 610, cy: 650 }, spin: lt => -0.38 + 0.2 * Math.sin(lt * 0.8), word: { at: 'below', x: 84, align: 'left' } },
];
// 按种子排：四种一轮，一轮里四种各来一回，次序由种子定；两轮接头的地方要是一样，后一轮头两个对调。所以相邻两次永远不一样
function bag(seed, n, salt = 0, K = 4) {
  const out = [];
  for (let c = 0; out.length < n; c++) {
    const a = [...Array(K).keys()]; for (let i = K - 1; i > 0; i--) { const j = Math.floor(hash(seed * 7.13 + c * 31.7 + i * 3.3 + salt) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (out.length && a[0] === out[out.length - 1]) [a[0], a[1]] = [a[1], a[0]];
    out.push(...a);
  }
  return out.slice(0, n);
}

// ───────── 平板 ─────────
let PLATE = null;
function plateModel() {
  if (PLATE) return PLATE;
  const w = 9, h = 9, r = 1.1, p = []; for (const [cx, cy, a0] of [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 1], [-w / 2 + r, -h / 2 + r, 2], [w / 2 - r, -h / 2 + r, 3]]) for (let i = 0; i <= 5; i++) { const a = (a0 + i / 5) * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r + h / 2 + 1.2]); }
  const pts = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], k = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5)); for (let j = 0; j < k; j++) pts.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); }
  const body = HOLO.modelFromPath(pts, { depth: 0.5, id: 'obj_0', slices: 2, ribEvery: 2, explode: [0, 0, -6] }).parts[0].pieces[0];
  const foot = HOLO.modelFromPath([[-1.6, 0], [1.6, 0], [1.2, 1.2], [-1.2, 1.2]], { depth: 1.6, id: 'obj_1', slices: 2, explode: [0, 0, 6] }).parts[0].pieces[0];      // 底下一个小座
  const M = HOLO.normalizeModel(HOLO.prepModel({ name: 'plate', parts: [{ id: 'obj', anchor: [0, h / 2 + 1.2, 0.25], pieces: [body, foot] }] }), 2.3117), s = M.scale;
  M.face = { cy: (h / 2 + 1.2) * s, half: 0.37 * w * s, z: 0.25 * s + 0.004 };      // 板子正面上放图标的那一块
  return (PLATE = M);
}
function plateIcon(cam, spin, m, name, o) {              // 把平的线条图标贴着板子正面画上去（跟着板子一起转），发光
  const pr = projector(cam, spin), f = m.face, size = 480;
  const tl = pr(-f.half, f.cy + f.half, f.z), tr = pr(f.half, f.cy + f.half, f.z), bl = pr(-f.half, f.cy - f.half, f.z);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.setTransform((tr[0] - tl[0]) / size, (tr[1] - tl[1]) / size, (bl[0] - tl[0]) / size, (bl[1] - tl[1]) / size, tl[0], tl[1]);
  ctx.shadowColor = T.line(0.95 * o.alpha); ctx.shadowBlur = 26; ctx.globalAlpha = o.alpha;
  ICONPIC.draw(ctx, name, { x: size / 2, y: size / 2, size, color: T.line(0.55), lw: 1.5, ...o.pose });
  ctx.shadowBlur = 8; ICONPIC.draw(ctx, name, { x: size / 2, y: size / 2, size, color: T.hi(0.96), lw: 0.62, ...o.pose });
  ctx.restore();
}

// ───────── 一只图标加一个词 ─────────（S：{ a, b, icon, word, flat, E, P }）
function sceneAdd(S) {
  const flat = S.flat, m = flat ? plateModel() : SOLID.build(S.icon), a = S.a, E = ENTR[S.E], PZ = POSE[S.P], tw = S.tw ?? a + IN_LEN + 0.1;      // 词什么时候出：这里是摆的；真用的时候照字幕里说到的时刻
  const slots = flat ? ICONPIC.slots(S.icon, a + IN_LEN + 0.6, S.b - 0.3, [[tw - 0.05, tw + 0.7]]) : [], inf = flat ? ICONPIC.info(S.icon) : null;
  let far = 1;                                            // 镜头退多少（见下面：图形出屏的就往后退）
  const camAt = t => ({ target: [0, 0.82, 0], yaw: 0.10 * Math.sin(t * 0.5), pitch: PZ.cam.pitch, dist: PZ.cam.dist * far * (1 - 0.018 * Math.sin(t * 0.37)), fov: 0.6, cx: PZ.cam.cx, cy: PZ.cam.cy });
  let box = null;                                         // 这张画面里图形一共占过哪一块（落定以后；词摆在这一块外头）
  const ubox = () => { if (box) return box; for (let i = 0; i <= 14; i++) { const t = a + IN_LEN + (S.b - a - IN_LEN) * i / 14, pr = projector(camAt(t), PZ.spin(t - a));
      const pts = flat ? [[-1, 0], [1, 0], [-1, 1], [1, 1]].flatMap(([sx, sy]) => [-1, 1].map(sz => pr(sx * m.face.half / 0.74, sy * m.ymax, sz * 0.03))) : m.loops.flatMap(l => l.pts.flatMap(([x, y]) => [m.depth / 2, -m.depth / 2].map(z => pr(...m.to3(x, y, z)))));
      for (const p of pts) box = box ? [Math.min(box[0], p[0]), Math.min(box[1], p[1]), Math.max(box[2], p[0]), Math.max(box[3], p[1])] : [p[0], p[1], p[0], p[1]]; }
    return box; };
  if (S.early) for (let i = 0; i < 14; i++) { box = null; const b = ubox(); if (Math.max(48 - b[0], b[2] - (W - 48), 196 - b[1]) <= 0) break; far *= 1.05; box = null; }      // 左右各留 48、顶上留出角上的小读数；宽的、高的图标有的摆法会出屏
  return t => {
    const lt = t - a, cam = camAt(t), frame = Math.floor(t * 24), out = P(t, S.b - 0.36, S.b - 0.02), A = 1 - out, k = eio(P(lt, 0.05, IN_LEN));
    stage(t, cam);
    const o = { hue: T.hue, spin: PZ.spin(lt), solid: (flat ? 0.12 : 0.22) * P(lt, IN_LEN, IN_LEN + 0.5), wave: { y: (lt * 0.55 % 1.6) * 1.2 - 0.1, w: 0.05 } };
    const r = E.fn(o, k, lt, m, cam); if (out > 0) o.scanDown = { y: m.ymax * (1 - eio(out)) };
    if (S.early && o.scan && k < 1) holo.draw(ctx, m, r.cam, { hue: T.hue, spin: o.spin, gain: 0.3 * P(lt, 0.05, 0.4) });      // 11-16：换屏落定后半秒内主体得在。扫描长出的，先给一只淡的整影，再一层层扫实
    const info = holo.draw(ctx, m, r.cam, o);
    if (r.plane != null) HOLO.drawScanPlane(ctx, cam, W, H, r.plane, { rot: t * 0.6, alpha: 1 - P(lt, IN_LEN - 0.15, IN_LEN) });
    if (flat) {                                           // 板子落定了，线条图标描上去；描完隔一会儿做它的小动作
      const en = lt - IN_LEN + 0.1, pose = inf.once ? { enter: en } : { k: clamp(en / 0.7), ...(en > 0.7 ? ICONPIC.pose(slots, t) : {}) };
      if (en > 0) plateIcon(r.cam, o.spin, m, S.icon, { alpha: A, pose });
    }
    // 词：摆在图形外头，用引线牵过去
    const bb = ubox(), W0 = PZ.word, size = Math.min(104, Math.floor(620 / (S.word.length * 1.04))), ww = S.word.length * size * 1.04;
    const y = W0.at === 'below' ? Math.min(Math.max(bb[3] + 60 + size, 1150), 1400) : Math.max(bb[1] - 96, 300);      // 字的底线。在下：离图形底边留六十；在上：离图形顶边留出一行
    const x0 = W0.align === 'center' ? W0.x - ww / 2 : W0.align === 'right' ? W0.x - ww : W0.x, kw = P(t, tw, tw + 0.55);
    const from = W0.at === 'below' ? [W0.align === 'right' ? bb[2] - 40 : bb[0] + 40, bb[3] + 8] : [bb[2] - 60, bb[1] - 8];
    const to = W0.at === 'below' ? [x0 + (W0.align === 'right' ? ww - 30 : 30), y - size - 22] : [x0 + ww - 30, y + 44];
    if (!S.word) return;                                   // 11-17：补的图标词太长又取不出短词的，只画图标，不出字也不牵引线（底下字幕照出）
    HUD.leader(ctx, T, from, [to[0], from[1] + (W0.at === 'below' ? 26 : -26)], to, P(t, tw - 0.25, tw + 0.2), { alpha: A, pulse: P(t, tw, tw + 0.8) < 1 ? P(t, tw, tw + 0.8) : 0 });
    cells(S.word, kw, frame, x0, y, size, { alpha: A, weight: 800, seed: S.E * 3 + S.P });
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = T.line(0.8 * A * kw); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y + 30); ctx.lineTo(x0 + ww * eo(kw), y + 30); ctx.stroke(); ctx.fillStyle = T.acc(0.95 * A * kw); ctx.fillRect(x0, y + 26, 46 * eo(kw), 8); ctx.restore();
  };
}

// ───────── 两段样子 ─────────
const DUANS = {
  '四种': { len: 2.9, seed: 7, items: [['shopping-cart', '加购物车'], ['tag', '比价格'], ['truck', '看物流'], ['wallet', '去付款']] },
  '平板': { len: 4.2, seed: 3, items: [['qr-code', '扫码'], ['receipt', '看小票'], ['siren', '有提醒'], ['scan-face', '刷脸']] },
};
let SEQ = [];
window.setDuan = name => {
  const D = DUANS[name], n = D.items.length, es = bag(D.seed, n, 0), ps = bag(D.seed, n, 9);
  SEQ = D.items.map(([icon, word], i) => { const v = SOLID_API.verdict(SOLID_API.measure(icon)), S = { a: i * D.len, b: (i + 1) * D.len, icon, word, flat: !v.stand, E: es[i], P: ps[i] }; return { ...S, fn: sceneAdd(S) }; });
  return { dur: n * D.len, list: SEQ.map(s => ({ icon: s.icon, word: s.word, 平板: s.flat, 进场: ENTR[s.E].name, 摆法: POSE[s.P].name, a: s.a })) };
};
window.draw2 = t => {
  const t0 = performance.now();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  const s = SEQ.find(s => t >= s.a && t < s.b) || SEQ[SEQ.length - 1];
  s.fn(t); sweep(t);
  HUD.chrome(ctx, W, H, T, { px: t * 16, tl: 'HOLO·SCAN', tr: s.flat ? 'FLAT·MODE' : 'OBJ·MODE', bl: '', br: 'REC' });      // 左下角原来写着试验时的记号「AS·DEMO」，用户的片子上不该有，搬进软件时拿掉了（2026-11-16）
  readouts(t); vignette(0.5);
  const cut = SEQ.map(s => s.a).filter(a => a > 0).find(a => t >= a && t < a + 0.085); if (cut != null) HUD.glitch(ctx, W, H, 0.55, Math.floor(t * 30));
  return performance.now() - t0;
};
window.BAG = bag;
// 接架子：内容里的「图标词」走这种画面。能立的自动立；机器筛出来的放平板；进场和摆法按种子轮（整条片的第几只图标词就取第几个，所以只出一段和出整条是一样的）；词照字幕里说到的时刻出
if (typeof DATA !== 'undefined' && DATA.nIcon != null) {
  const es = bag(DATA.seed, Math.max(1, DATA.nIcon), 0), ps = bag(DATA.seed, Math.max(1, DATA.nIcon), 9);
  SCENES.icon = S => { const v = SOLID_API.verdict(SOLID_API.measure(S.icon)), i = S.ord || 0; return sceneAdd({ ...S, flat: !v.stand, E: S.Ei ?? es[i], P: S.P ?? ps[i], tw: S.hand || S.together ? S.a + 0.75 : Math.min(Math.max(when(S.word, S.a - 0.5) ?? S.a + IN_LEN + 0.1, S.a + 0.55), Math.max(S.a + 0.75, S.b - 1.6)) }); };      // 补的图标词：字跟着图标一起进（软件里补图标那一步的规矩）。通义配的：说到了才出，可至少留一秒半给人看
  SHOTS = null;
}

// ───────── 补的四组骨架（2026-11-16 夜；自己写的，没有抄的）：两块、大数（含比多少）、引一句、一步接一步 ─────────
// 画法全用全息这套现成的家什：底盘和光柱照转，字放在半透的暗牌子上，一格一格锁定；带数的字不走乱码，没锁的那一位是空框（半路屏上不出现别的数）。
// 填的东西和象形那套一模一样（yangzi.fields 给的那几样），时刻的规矩也一样：暗空位跟着换屏先到，说到哪块哪块亮，前头那块退暗；
// 头一块换屏落定半秒内必须在；最后一块至少留 1.2 秒给人看。包在一个函数里，免得名字和别的脚本撞。
(() => {
  const atOf = (X, from) => !X || !X.t ? null : X.at != null ? X.at : when(X.t, from);
  const NOBRK = /[A-Za-z0-9.%+\-]/, HEADP = /[，。、！？：；,.!?:;）》」』”’%]/;
  function splitN(text, n, br) {                           // 切成 n 行，尽量一样长；不在英文词、数字中间切，不让标点打头；架子给了可折的位置（br）就只在那些位置折
    const cs = [...text], out = []; let i0 = 0;
    for (let k = 1; k < n; k++) {
      const cut = Math.round(cs.length * k / n), ok = c => c > i0 && c < cs.length && !(NOBRK.test(cs[c - 1]) && NOBRK.test(cs[c])) && !HEADP.test(cs[c]) && (!br || br.includes(c));
      let best = null; for (let d = 0; d < cs.length && best == null; d++) best = ok(cut - d) ? cut - d : ok(cut + d) ? cut + d : null;
      if (best == null) return null; out.push(cs.slice(i0, best).join('')); i0 = best;
    }
    out.push(cs.slice(i0).join('')); return out;
  }
  const advOf = (ch, size) => /[ -~]/.test(ch) ? Math.max(size * 0.34, ctx.measureText(ch).width + size * 0.07) : size * 1.04;      // 和 cells 里一格多宽是同一个算法
  const widthOf = (text, size, weight = 700) => { ctx.font = `${weight} ${size}px ${CN}`; return [...text].reduce((s, ch) => s + advOf(ch, size), 0); };
  const fitPx = (text, px0, maxW, weight = 700) => Math.min(px0, Math.floor(px0 * maxW / Math.max(1, widthOf(text, px0, weight))));
  function lay(text, px0, maxW, maxLines, maxH, br, weight = 700) {      // 一段字排成几行、多大：行数少优先，多一行要大出一成半才换；整块不许高过 maxH
    let best = null;
    for (let n = 1; n <= maxLines; n++) {
      const rows = splitN(text, n, br) || (br && n > 1 && !best ? splitN(text, n) : null); if (!rows) continue;
      let px = Math.min(px0, Math.floor(maxH / (n * 1.28))); for (const r of rows) px = Math.min(px, fitPx(r, px0, maxW, weight));
      if (!best || px > best.px * 1.15) best = { px, rows };
      if (px >= px0) break;
    }
    return best || { px: Math.min(fitPx(text, px0, maxW, weight), Math.floor(maxH / 1.28)), rows: [text] };
  }
  const sameSize = (texts, px0, f) => { const a = texts.map((x, i) => f(x, px0, i)), px = Math.min(...a.map(l => l.px)); return a.map((l, i) => l.px === px ? l : f(texts[i], px, i)); };      // 一屏里的几块字一样大
  function boxes(text, k, x, y, size, o = {}) {            // 带数的字：从左往右一位一位锁定，没锁的那一位是个空框
    const wt = o.weight || 700; ctx.font = `${wt} ${size}px ${CN}`;
    const cs = [...text], advs = cs.map(ch => advOf(ch, size)), w = advs.reduce((p, q) => p + q, 0), x0 = o.align === 'center' ? x - w / 2 : x, a = o.alpha ?? 1; let cx = x0;
    if (k <= 0) return { x0, w };
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    cs.forEach((ch, i) => {
      const lockAt = 0.15 + (i / Math.max(1, cs.length)) * 0.7, adv = advs[i], xc = cx + adv / 2; cx += adv;
      if (k >= lockAt) { ctx.shadowColor = (o.glow || T.line)(0.9 * a); ctx.shadowBlur = size * 0.28; ctx.fillStyle = k < lockAt + 0.12 ? '#fff' : (o.color || T.hi(0.98 * a)); ctx.fillText(ch, xc, y); ctx.shadowBlur = 0; }
      else { ctx.strokeStyle = T.line(0.6 * a * (0.5 + 0.5 * Math.abs(Math.sin((o.t || 0) * 14 + i)))); ctx.lineWidth = 2; ctx.strokeRect(xc - adv * 0.36, y - size * 0.8, adv * 0.72, size * 0.86); }
    });
    ctx.restore(); return { x0, w };
  }
  const put = (text, k, frame, x, y, size, o) => /\d/.test(text) ? boxes(text, k, x, y, size, o) : cells(text, k, frame, x, y, size, o);
  function rowsAt(L, x, yMid, t, t0, frame, o = {}) {      // 几行字，整块竖着居中在 yMid；一行接一行锁定
    const lh = L.px * 1.28, y0 = yMid - (L.rows.length - 1) * lh / 2 + L.px * 0.36;
    L.rows.forEach((r, i) => put(r, P(t, t0 + i * 0.14, t0 + i * 0.14 + 0.5), frame, x, y0 + i * lh, L.px, { ...o, seed: (o.seed || 0) + i * 3, t }));
  }
  function sayTimes(S, ats) {                              // 几块东西各在第几秒亮（和象形那套同一个规矩）
    const n = ats.length, ts = [];
    for (let i = 0; i < n; i++) {
      let x = ats[i] ?? (i ? ts[i - 1] + 1.0 : S.a + 0.3);
      x = i ? Math.max(x, ts[i - 1] + 0.45) : Math.min(Math.max(x, S.a + 0.12), S.a + 0.3);
      const latest = S.b - 1.2 - (n - 1 - i) * 0.5; if (i && x > latest) x = Math.max(ts[i - 1] + 0.3, latest);
      ts.push(x);
    }
    return ts;
  }
  function glowIcon(name, x, y, size, alpha, enter) {      // 平的发光线条图标（不立起来）
    if (alpha <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.shadowColor = T.line(0.95); ctx.shadowBlur = 22;
    ICONPIC.draw(ctx, name, { x, y, size, color: T.line(0.55), lw: 1.7, enter });
    ctx.shadowBlur = 8; ICONPIC.draw(ctx, name, { x, y, size, color: T.hi(0.96), lw: 0.8, enter });
    ctx.restore();
  }
  function arrow(x, y, s, p, a, bent) {                    // 两块中间的记号：朝下的发光箭头；bent = 先横着走一截再拐下来（转折）
    if (p <= 0 || a <= 0) return; const k = eo(p), y0 = y - s * 0.5, ty = y0 + s * k;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = T.acc(0.95 * a * clamp(p * 2.5)); ctx.shadowColor = T.acc(0.8 * a); ctx.shadowBlur = 16; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    if (bent) { ctx.moveTo(x - s * 0.9, y0); ctx.lineTo(x, y0); } else ctx.moveTo(x, y0);
    ctx.lineTo(x, ty); ctx.moveTo(x - s * 0.34, ty - s * 0.34); ctx.lineTo(x, ty); ctx.lineTo(x + s * 0.34, ty - s * 0.34); ctx.stroke(); ctx.restore();
  }
  function slot(x, y, w, h, open, said, A, lit = 1) {      // 一块牌子：先打开、暗着（暗空位）；说到了亮起来，左边亮一条竖杠、顶上一条线
    const pw = w * open; if (pw <= 2) return;
    HUD.plate(ctx, T, x + (w - pw) / 2, y, pw, h, A * lerp(0.45, 1, said * lit), { op: lerp(0.5, 0.76, said) });
    if (said <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = T.acc(0.8 * A * lit); ctx.shadowBlur = 12; ctx.fillStyle = T.acc(0.95 * A * said * lit); ctx.fillRect(x, y + h * (1 - said) / 2, 6, h * said);
    ctx.shadowBlur = 0; ctx.fillStyle = T.line(0.55 * A * said * lit); ctx.fillRect(x, y, w * said, 1.5); ctx.restore();
  }
  const base = (S, t, o = {}) => { const cam = camOf(t, { dist: 7.6, cy: o.cy ?? 820 }); stage(t, cam, { beam: o.beam ?? 0.5 }); return { lt: t - S.a, frame: Math.floor(t * 24), A: 1 - P(t, S.b - 0.36, S.b - 0.02) }; };

  // 五、两块：{ blocks:[{head, body, num, icon}], link, foot }。两到四块牌子上下摞着
  // link：对（中间不画记号）、因、变（中间一个朝下的箭头）、转（箭头先横后竖）、问（头一块带问号图标）、配（两块各带图标，底下一块小牌子写合起来是什么）
  function scenePair(S) {
    const B = S.blocks, n = B.length, a = S.a, arr = S.link === '因' || S.link === '变' || S.link === '转';
    const X0 = 70, BW = W - 140, GAP = arr ? 116 : 36, top0 = 250, bot0 = 1440 - (S.foot ? 140 : 0), BH = Math.min(460, (bot0 - top0 - (n - 1) * GAP) / n), TOP = top0 + (bot0 - top0 - n * BH - (n - 1) * GAP) / 2;
    let from = a - 0.5; const ats = B.map(b => { const x = [atOf(b.head, from), atOf(b.body, from)].filter(v => v != null), v = x.length ? Math.min(...x) : null; if (v != null) from = v; return v; });
    const ts = sayTimes(S, ats), cap = i => Math.max(ts[i], S.b - 1.0);
    const tb = B.map((b, i) => !(b.head && b.head.t) ? ts[i] : Math.min(Math.max(atOf(b.body, ts[i] - 0.3) ?? ts[i], ts[i]), ts[i] + (i ? 0.6 : 0.08), cap(i))), tn = B.map((b, i) => b.num ? Math.min(Math.max(atOf(b.num, tb[i] - 0.3) ?? tb[i] + 0.3, tb[i]), cap(i)) : null);
    const tf = S.foot ? Math.min(Math.max(when(S.foot, ts[0] - 0.5) ?? ts[n - 1] + 0.6, ts[0] + 0.3), Math.max(ts[n - 1], S.b - 0.9)) : null; let L = null;
    const dims = b => ({ ix: b.icon ? 220 : 0, headH: b.head && b.head.t ? 100 : 0, numH: b.num ? 112 : 0 });
    return t => {
      const { lt, frame, A } = base(S, t);
      L = L || sameSize(B.map(b => b.body.t), 108, (x, px, i) => { const d = dims(B[i]), h = BH - d.headH - d.numH; return lay(x, px, BW - 96 - d.ix, h > 330 ? 3 : 2, h - 48, B[i].body.br, 800); });
      for (let i = 0; i < n; i++) {
        const b = B[i], y = TOP + i * (BH + GAP), { ix, headH, numH } = dims(b);
        const open = i ? eo(P(t, ts[i] - 0.38, ts[i] - 0.03)) : eo(P(lt, 0.03, 0.38)), said = eio(P(t, ts[i] - 0.06, ts[i] + 0.3)), tnext = i + 1 < n ? ts[i + 1] : 1e9, lit = lerp(0.5, 1, 1 - eio(P(t, tnext - 0.06, tnext + 0.24)));
        slot(X0, y, BW, BH, open, said, A, lit);
        const tx = X0 + 48 + ix, aT = A * lit;
        if (b.icon && said > 0) glowIcon(b.icon, X0 + 136, y + BH / 2, 168, aT * clamp(said * 2), t - ts[i]);
        if (headH) put(b.head.t, P(t, ts[i] + 0.02, ts[i] + 0.45), frame, tx, y + 84, fitPx(b.head.t, 56, BW - 96 - ix, 600), { alpha: aT, weight: 600, color: T.line(0.95 * aT), seed: i * 7 + 1, t });
        rowsAt(L[i], tx, y + headH + (BH - headH - numH) / 2, t, tb[i] + 0.02, frame, { alpha: aT, weight: 800, seed: i * 11 });
        if (b.num) put(b.num.t, P(t, tn[i], tn[i] + 0.55), frame, tx, y + BH - 40, fitPx(b.num.t, 84, BW - 96 - ix, 700), { alpha: aT, weight: 700, color: T.acc(0.98 * aT), glow: T.acc, seed: i * 5 + 2, t });
        if (arr && i + 1 < n) arrow(W / 2, y + BH + GAP / 2, 84, P(t, ts[i + 1] - 0.3, ts[i + 1] + 0.1), A, S.link === '转');
      }
      if (tf != null) {
        const k = P(t, tf, tf + 0.5), sz = fitPx(S.foot, 64, BW - 120, 700), w = widthOf(S.foot, sz, 700) + 90;
        if (k > 0) { const pw = w * eo(clamp(k * 1.6)); HUD.plate(ctx, T, W / 2 - pw / 2, bot0 + 30, pw, 104, A * clamp(k * 3)); put(S.foot, k, frame, W / 2, bot0 + 30 + 52 + sz * 0.36, sz, { align: 'center', alpha: A, weight: 700, color: T.acc(0.98 * A), glow: T.acc, seed: 13, t }); }
      }
    };
  }

  // 六甲、大数：{ num:{t, at, pre, n, u}, what }。一块牌子浮在光柱里先打开，数最大，一位一位锁定；前头的字在上面小一号，单位跟在后头（放不下就另起一行）；说的是什么在牌子底下
  const NUMF = size => `600 ${size}px ${HUD.FONT.ui}`, isA = ch => /[ -~]/.test(ch);
  const numAdv = (ch, size) => { if (!isA(ch)) return size * 0.9; ctx.font = NUMF(size); return /\d/.test(ch) ? ctx.measureText('0').width * 1.06 : ctx.measureText(ch).width + size * 0.05; };
  const numW = (str, size) => [...str].reduce((s, ch) => s + numAdv(ch, size), 0);
  function numCells(str, k, t, xc0, y, size, A) {          // 数：数字用细长的那套字，一位一位锁定，没锁的是空框；锁定那一下闪一下白
    const cs = [...str], n = cs.length, w = numW(str, size); let cx = xc0 - w / 2;
    if (k <= 0) return w;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    cs.forEach((ch, i) => {
      const adv = numAdv(ch, size), lockAt = 0.2 + (i / Math.max(1, n)) * 0.6;
      if (k >= lockAt) { ctx.font = isA(ch) ? NUMF(size) : `700 ${size * 0.84}px ${CN}`; ctx.shadowColor = T.acc(0.8 * A); ctx.shadowBlur = size * 0.14; ctx.fillStyle = k < lockAt + 0.1 ? '#fff' : T.acc(A); ctx.fillText(ch, cx + adv / 2, y); ctx.shadowBlur = 0; }
      else { ctx.strokeStyle = T.line(0.75 * A * (0.5 + 0.5 * Math.abs(Math.sin(t * 14 + i)))); ctx.lineWidth = 2; ctx.strokeRect(cx + adv * 0.14, y - size * 0.66, adv * 0.72, size * 0.66); }
      cx += adv;
    });
    ctx.restore(); return w;
  }
  function sceneNum(S) {
    if (S.rows) return sceneBars(S);
    const N = S.num, a = S.a, maxW = 840, cy = 800;
    const tn = Math.min(Math.max(N.at ?? when(N.t, a - 0.5) ?? a + 0.3, a + 0.12), a + 0.2), tw = S.what ? Math.min(Math.max(atOf(S.what, a - 0.5) ?? tn + 0.5, a + 0.3), Math.max(a + 0.3, S.b - 0.9)) : null;
    const split = N.n && (N.pre || '') + N.n + (N.u || '') === N.t; let L = null;      // 拆成「前头的字、数、单位」三截；拼回去和原样对不上就不拆，整个当一行字画
    const mk = () => {
      if (!split) { const whole = lay(N.t, 240, maxW, 2, 460, N.br, 800), hh = whole.rows.length * whole.px * 1.28; return { whole, pw: Math.max(...whole.rows.map(r => widthOf(r, whole.px, 800))) + 140, ph: hh + 130 }; }
      let npx = 400; while (npx > 80 && numW(N.n, npx) > maxW) npx -= 10;
      const nw = numW(N.n, npx); let upx = Math.round(npx * 0.4), same = true, uw = 0;
      if (N.u) { uw = widthOf(N.u, upx, 600); same = nw + 22 + uw <= maxW; if (!same) { upx = fitPx(N.u, 130, maxW, 600); uw = widthOf(N.u, upx, 600); } }
      const ppx = N.pre ? fitPx(N.pre, 84, maxW, 700) : 0, hPre = N.pre ? 122 : 0, hN = npx * 0.7, hU = N.u && !same ? upx * 1.34 : 0, hh = hPre + hN + hU, y0 = cy - hh / 2;
      const cw = Math.max(same ? nw + (N.u ? 22 + uw : 0) : Math.max(nw, uw), N.pre ? widthOf(N.pre, ppx, 700) : 0);
      return { npx, nw, upx, uw, same, ppx, yPre: y0 + 86, yN: y0 + hPre + hN, yU: y0 + hPre + hN + upx * 1.12, pw: Math.max(cw + 150, 520), ph: hh + 150 };
    };
    return t => {
      const { lt, frame, A } = base(S, t, { beam: 0.7 }); L = L || mk();
      const open = eo(P(lt, 0.02, 0.36)), k = P(t, tn, tn + 0.5), pw = L.pw * open, y0 = cy - L.ph / 2;
      HUD.plate(ctx, T, W / 2 - pw / 2, y0, pw, L.ph, A * open);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = T.hi(0.9 * A * open); ctx.lineWidth = 3; ctx.beginPath();      // 四个角的角标
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = W / 2 + sx * (pw / 2 + 14), y = cy + sy * (L.ph / 2 + 14); ctx.moveTo(x, y - sy * 44); ctx.lineTo(x, y); ctx.lineTo(x - sx * 44, y); }
      ctx.stroke(); ctx.fillStyle = T.dim(0.4 * A * open); ctx.fillRect(W / 2 - L.pw / 2 + 40, y0 + L.ph - 24, (L.pw - 80) * open, 2); ctx.fillStyle = T.acc(0.9 * A); ctx.fillRect(W / 2 - L.pw / 2 + 40, y0 + L.ph - 24, (L.pw - 80) * clamp(k), 2); ctx.restore();
      if (L.whole) rowsAt2(L.whole, t, tn, frame, A);
      else {
        if (N.pre) put(N.pre, P(t, tn - 0.04, tn + 0.4), frame, W / 2, L.yPre, L.ppx, { align: 'center', alpha: A, weight: 700, seed: 3, t });
        const xc = L.same && N.u ? W / 2 - (22 + L.uw) / 2 : W / 2; numCells(N.n, k, t, xc, L.yN, L.npx, A);
        if (N.u) { const ku = P(t, tn + 0.2, tn + 0.6); if (L.same) put(N.u, ku, frame, xc + L.nw / 2 + 22, L.yN - L.npx * 0.02, L.upx, { alpha: A, weight: 600, color: T.acc(0.92 * A), glow: T.acc, seed: 5, t }); else put(N.u, ku, frame, W / 2, L.yU, L.upx, { align: 'center', alpha: A, weight: 600, color: T.acc(0.92 * A), glow: T.acc, seed: 5, t }); }
      }
      if (tw != null) put(S.what.t, P(t, tw, tw + 0.5), frame, W / 2, y0 + L.ph + 112, fitPx(S.what.t, 64, 900, 600), { align: 'center', alpha: A, weight: 600, seed: 7, t });
    };
    function rowsAt2(Lw, t, t0, frame, A) {                // 没拆开的数：整段字居中，照带数的字那样一位一位锁定
      const lh = Lw.px * 1.28, yy = cy - (Lw.rows.length - 1) * lh / 2 + Lw.px * 0.36;
      Lw.rows.forEach((r, i) => boxes(r, P(t, t0 + i * 0.14, t0 + i * 0.14 + 0.45), W / 2, yy + i * lh, Lw.px, { align: 'center', alpha: A, weight: 800, color: T.acc(0.98 * A), glow: T.acc, t }));
    }
  }
  // 六乙、比多少：{ rows:[{name, num:{t, at, val}}] }。一行一块牌子：名字小、数大；底下一条细条按数的大小长出来（没读出大小就不画条）
  function sceneBars(S) {
    const R = S.rows, n = R.length, a = S.a, X0 = 70, BW = W - 140, top0 = 270, bot0 = 1436, RH = Math.min(420, (bot0 - top0) / n), TOP = top0 + (bot0 - top0 - n * RH) / 2;
    let from = a - 0.5; const ats = R.map(r => { const x = [atOf(r.name, from), atOf(r.num, from)].filter(v => v != null), v = x.length ? Math.min(...x) : null; if (v != null) from = v; return v; });
    const ts = sayTimes(S, ats), tv = R.map((r, i) => Math.min(Math.max(atOf(r.num, ts[i] - 0.3) ?? ts[i], ts[i]), i ? Math.max(ts[i], S.b - 1.0) : ts[i] + 0.1));
    const vals = R.map(r => +r.num.val), vmax = Math.max(...vals), bars = vals.every(v => v > 0) && vmax > 0;
    return t => {
      const { lt, frame, A } = base(S, t);
      for (let i = 0; i < n; i++) {
        const r = R[i], y = TOP + i * RH + 14, h = RH - 28, open = eo(P(lt, 0.03 + i * 0.07, 0.38 + i * 0.07)), said = eio(P(t, ts[i] - 0.06, ts[i] + 0.3));
        slot(X0, y, BW, h, open, said, A);
        if (r.name && r.name.t) put(r.name.t, P(t, ts[i] + 0.02, ts[i] + 0.45), frame, X0 + 48, y + 86, fitPx(r.name.t, 58, BW - 96, 600), { alpha: A, weight: 600, color: T.line(0.95 * A), seed: i * 7 + 1, t });
        const npx = fitPx(r.num.t, Math.min(170, h - 210), BW - 96, 800);
        boxes(r.num.t, P(t, tv[i], tv[i] + 0.6), X0 + 48, y + h - 96, npx, { alpha: A, weight: 800, color: T.acc(0.98 * A), glow: T.acc, t });
        if (bars) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = T.dim(0.4 * A * open); ctx.fillRect(X0 + 48, y + h - 58, (BW - 96) * open, 14); ctx.shadowColor = T.acc(0.8 * A); ctx.shadowBlur = 12; ctx.fillStyle = T.acc(0.95 * A); ctx.fillRect(X0 + 48, y + h - 58, (BW - 96) * vals[i] / vmax * eo(P(t, tv[i] + 0.05, tv[i] + 0.7)), 14); ctx.restore(); }
      }
    };
  }

  // 七、引一句：{ text, who }。一块大牌子先打开，左上压一个大引号、左边一条亮杠；话排成几行大字，一行接一行锁定；谁说的在牌子底下
  function sceneQuote(S) {
    const a = S.a, X0 = 70, BW = W - 140, X = X0 + 76, areaT = 400, areaH = 900;
    const tq = Math.min(Math.max(when(S.text.slice(0, 4), a - 0.5) ?? a + 0.3, a + 0.12), a + 0.2), tw = S.who ? Math.min(Math.max(when(S.who, a - 0.5) ?? tq + 0.5, a + 0.3), Math.max(a + 0.3, S.b - 0.9)) : null; let L = null;
    return t => {
      const { lt, frame, A } = base(S, t, { beam: 0.6 }); L = L || lay(S.text, 120, BW - 76 - 56, 5, areaH - 220, S.br, 800);
      const lh = L.px * 1.3, hh = L.rows.length * lh, y0 = areaT + (areaH - hh) / 2, open = eo(P(lt, 0.02, 0.36)), pw = BW * open;
      HUD.plate(ctx, T, W / 2 - pw / 2, y0 - 76, pw, hh + 140, A * open);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = T.acc(0.8 * A); ctx.shadowBlur = 12; ctx.fillStyle = T.acc(0.95 * A * open); ctx.fillRect(X0 + 30, y0 - 12, 8, (hh + 12) * eo(P(lt, 0.06, 0.5)));
      ctx.shadowBlur = 26; ctx.font = `900 300px ${CN}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = T.acc(0.95 * A * eo(P(lt, 0.04, 0.4))); ctx.fillText('“', X0 + 4, y0 + 78); ctx.restore();      // 大引号压在牌子的上沿
      L.rows.forEach((r, i) => put(r, P(t, tq + i * 0.14, tq + i * 0.14 + 0.5), frame, X, y0 + i * lh + L.px * 0.94, L.px, { alpha: A, weight: 800, seed: i * 3, t }));
      if (tw != null) { const k = P(t, tw, tw + 0.5), sz = fitPx(S.who, 60, BW - 160, 600), yy = y0 + hh + 64 + 96; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = T.acc(0.95 * A * k); ctx.fillRect(X, yy - sz * 0.42, 46 * eo(k), 8); ctx.restore(); put(S.who, k, frame, X + 66, yy, sz, { alpha: A, weight: 600, color: T.line(0.95 * A), seed: 9, t }); }
    };
  }

  // 八、一步接一步：{ rows:[{t, icon}] }。竖着一串圆环，一根线串起来；说到哪步哪步亮（有图标画图标，没有就写第几步），亮线跟着往下长；字在右边的牌子上
  function sceneSteps(S) {
    const R = S.rows, n = R.length, a = S.a, top0 = 260, bot0 = 1436, RH = Math.min(290, (bot0 - top0) / n), TOP = top0 + (bot0 - top0 - n * RH) / 2, CX = 166, RAD = Math.min(88, RH * 0.33), TX = CX + RAD + 78, PX = TX - 34, PW = W - 70 - PX;
    let from = a - 0.5; const ats = R.map(r => { const v = when(r.t, from); if (v != null) from = v; return v; }), ts = sayTimes(S, ats); let L = null;
    return t => {
      const { lt, frame, A } = base(S, t);
      L = L || sameSize(R.map(r => r.t), 100, (x, px, i) => lay(x, px, PW - 74, 2, RH - 80, R[i].br, 800));
      const pin = eo(P(lt, 0.02, 0.4)), yOf = i => TOP + i * RH + RH / 2;
      const rp = i => i ? eio(P(t, ts[i] - 0.45, ts[i] - 0.05)) : pin;      // 11-17 夜：还没说到的那步不先摆（空圈、空框、02 挂几秒像没加载出来），说到它才连着线长出来，照两块
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = T.dim(0.5 * A); for (let i = 1; i < n; i++) if (rp(i) > 0) ctx.fillRect(CX - 1.5, yOf(i - 1), 3, RH * rp(i));      // 暗的轨
      ctx.shadowColor = T.acc(0.8 * A); ctx.shadowBlur = 12; ctx.fillStyle = T.acc(0.95 * A);
      for (let i = 1; i < n; i++) { const g = eio(P(t, ts[i] - 0.45, ts[i] - 0.05)); if (g > 0) ctx.fillRect(CX - 2.5, yOf(i - 1), 5, RH * g); }      // 亮的线从上一步长到这一步
      ctx.restore();
      for (let i = 0; i < n; i++) {
        const rpi = rp(i); if (rpi <= 0) continue;
        const r = R[i], cy = yOf(i), said = eio(P(t, ts[i] - 0.05, ts[i] + 0.3)), tnext = i + 1 < n ? ts[i + 1] : 1e9, lit = lerp(0.55, 1, 1 - eio(P(t, tnext - 0.06, tnext + 0.24))), aT = A * lit;
        slot(PX, cy - RH / 2 + 16, PW, RH - 32, rpi, said, A, lit);
        ctx.save(); ctx.fillStyle = 'rgba(1,8,12,0.86)'; ctx.beginPath(); ctx.arc(CX, cy, RAD * rpi, 0, TAU); ctx.fill();      // 圆环：先垫一块暗底把线挡住，再描圈
        ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2; ctx.strokeStyle = T.dim(0.7 * A * rpi); ctx.beginPath(); ctx.arc(CX, cy, RAD * rpi, 0, TAU); ctx.stroke();
        if (said > 0) { ctx.shadowColor = T.line(0.9 * aT); ctx.shadowBlur = 16; ctx.lineWidth = 3.5; ctx.strokeStyle = T.line(0.95 * aT); ctx.beginPath(); ctx.arc(CX, cy, RAD, -Math.PI / 2, -Math.PI / 2 + TAU * said); ctx.stroke(); }
        ctx.restore();
        if (r.icon) { if (said > 0) glowIcon(r.icon, CX, cy, RAD * 1.24, aT * clamp(said * 2), t - ts[i]); }
        else { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.font = `${Math.round(RAD * 0.6)}px ShareTechMono`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = said > 0.5 ? T.acc(0.95 * aT) : T.dim(0.8 * A * rpi); ctx.fillText('0' + (i + 1), CX, cy + 2); ctx.restore(); }
        rowsAt(L[i], TX, cy, t, ts[i] + 0.04, frame, { alpha: aT, weight: 800, seed: i * 11 });
      }
    };
  }
  SCENES.pair = scenePair; SCENES.num = sceneNum; SCENES.quote = sceneQuote; SCENES.steps = sceneSteps; SHOTS = null;
})();
