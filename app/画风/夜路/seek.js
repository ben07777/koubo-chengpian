// 画风「夜路」：从第二批样片工程 e.js 搬来（2026-11-07 第 3 步），画面代码原样未改。
// 只读剧本：window.JUBEN 由公共 core.js 的 jubenEv() 转成这里用的 EV；公共小工具（缓动、字幕、噪点、取字时刻）在 core.js，这里不另写。
document.getElementById('frame').innerHTML = '<canvas id="c" width="1080" height="1920"></canvas><div id="view"></div><div id="subs"></div>';
const EV = jubenEv(window.JUBEN);

// 方向「夜路」：坐在车里开夜路听他讲。词是路上的漆，车灯照到时他正好说到；「不是」是急刹，「等」是红灯。全部由 EV 算出，没有一段录音的秒数和词。
// 吸纳：Lemo printed-long-take 一个长镜头、字活在世界里；花叔 11-长卷穿越片 镜头只进不退、事件相对定时；Lemo tilt-shift 世界自己的标牌语言。
// 自己的：路的形状由句子逻辑定；他的话就是里程；上一句在后视镜里。
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const YH = 560, X0 = 470, K = 2420, HOOD = 1330, F = 1100, CAMH = 2.2;
const PAINT = '#D9D4C4', GOLD = '#E8B84B', RED = '#D8392B', GREEN = '#3FBF6F', AMBER = '#E9A23B', POST = '#C9A35A', BLACK = '#07080A';
const LN = EV.lines, GR = EV.groups, A = EV.acts, DUR = EV.dur;
const dt = 1 / 120;
let LATER = [];   // 11-10 复审：灯阵的数等路上的东西都画完再画，牌子、车都挡不住
let S = [], speedKeys = [], lightKeys = [], latKeys = [], roadWords = [], sideSigns = [], gantries = [], boards = [], barriers = [], reds = [], curves = [], cars = [], bumps = [], tile = null, END = null;
const word2tex = {};
function tex(word, col) {
  const key = word + col;
  if (word2tex[key]) return word2tex[key];
  const chars = [...word], n = Math.max(chars.length, 1), W = 512, H = 512 * n;
  const o = document.createElement('canvas'); o.width = W; o.height = H;
  const x = o.getContext('2d'); x.fillStyle = col; x.font = `${W * .92}px Glow`; x.textAlign = 'center'; x.textBaseline = 'middle';
  chars.forEach((ch, i) => x.fillText(ch, W / 2, (i + .5) * H / n + W * .02));
  // 磨损：路上的漆不是干净的
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900 * n; i++) { const a = hash(i, 11), b = hash(i, 13), s = 1 + 7 * hash(i, 17) * hash(i, 19); x.fillStyle = `rgba(0,0,0,${.25 + .55 * hash(i, 23)})`; x.fillRect(a * W, b * H, s * 3, s); }
  word2tex[key] = o; return o;
}
const v2s = t => S[clamp(Math.round(t / dt), 0, S.length - 1)];
const zRead = v => K / (700 + 390 * v - YH);       // 读字时刻，字面 v 对应的距离
const Z_FAR = zRead(0), Z_NEAR = zRead(1);

function build() {
  // ① 车速：v = 8 × 语速比；停顿 ×0.75；然后叠事件
  const base = t => {
    let l = LN[0];
    for (const r of LN) if (r.t0 <= t) l = r;
    const inGap = t > l.t1;
    return 8 * clamp(l.rate, .85, 1.2) * (inGap && l.gap >= .3 ? .75 : 1);
  };
  const stops = [];
  for (const a of A) {
    if (a.k === 'trap') {
      const nx = LN[a.line + 1], resume = nx ? nx.t0 : a.t + 1, hard = !a.person;
      stops.push({ a: a.t0, b: a.t, v: hard ? 5 : 6, kind: 'ease' }, { a: a.t, b: a.t + .3, v: hard ? .8 : 3, kind: 'ease' }, { a: a.t + .3, b: resume, v: hard ? .8 : 3, kind: 'hold' }, { a: resume, b: resume + .48, v: 6.5, kind: 'free' });
      barriers.push({ t: a.t, tSee: a.t0 - .4, person: a.person, resume, hard });
      if (hard) { bumps.push({ t: a.t, amp: 26 }); latKeys.push([resume, .84, 2.4], [resume + 2.6, 1.2, 0]); }
      else latKeys.push([resume, .84, 1.2], [resume + 2.2, 1.2, 0]);
    }
    if ((a.k === 'range' || a.k === 'stat') && a.wait) {
      const tLo = a.tLo != null ? a.tLo : a.t, end = a.t1, settle = a.tLo != null ? a.tHi + .36 : a.t + .4, tGreen = Math.max(end - .18, tLo + .3, settle + .7);   // 11-10 复审：数停稳以后至少亮 0.7 秒再变绿（原来句子短，「90天」滚到 87 就熄灯）
      const ease = .48, tb = Math.max(tLo - ease, 0);
      stops.push({ a: tb, b: tLo, v: 0, kind: 'ease' }, { a: tLo, b: tGreen, v: 0, kind: 'hold' }, { a: tGreen, b: tGreen + .56, v: 8, kind: 'free' });
      const hasRaw = a.k === 'stat' ? !!a.raw : !!(a.rawLo && a.rawHi);                     // 11-09 第三轮：抄不准字幕原文的数，灯阵不亮数
      reds.push({ t: tLo, tGreen, a, noNum: !hasRaw || !(a.k === 'stat' ? said(a.line, statText(a), '数字') : said(a.line, rangeText(a), '数字带子')) });   // 删了数：红灯照停，灯阵不亮数
    }
  }
  if (EV.end.kind === 'fall') stops.push({ a: EV.end.t, b: EV.end.t1, v: 0, kind: 'ease' }, { a: EV.end.t1, b: 999, v: 0, kind: 'hold' });
  else { const t0 = LN[LN.length - 1].t1 - .3; stops.push({ a: t0, b: t0 + 1.2, v: 0, kind: 'ease' }, { a: t0 + 1.2, b: 999, v: 0, kind: 'hold' }); }
  if (EV.define) { const d = EV.define, g = LN[d.line].gap; stops.push({ a: d.t1, b: d.t1 + Math.max(g, .3), v: 4, kind: 'ease' }, { a: d.t1 + Math.max(g, .3), b: d.t1 + Math.max(g, .3) + .55, v: 8, kind: 'free' }); }
  stops.sort((p, q) => p.a - q.a);

  S = [0]; const V = [];
  let v = 7.5;
  const n = Math.ceil((DUR + 1) / dt);
  for (let i = 0; i <= n; i++) {
    const t = i * dt; let target = base(t), active = null;
    for (const s of stops) if (t >= s.a && t < s.b) active = s;
    if (active) {
      if (active.kind === 'hold') { v = active.v; target = v; }
      else { const left = Math.max(active.b - t, dt); v += (active.v - v) * Math.min(dt / left, 1); target = v; }
    } else v += (target - v) * Math.min(dt / .35, 1);
    V.push(v); S.push(S[S.length - 1] + v * dt);
  }

  // ② 词上路面；路面字每 1.6 秒最多一个，第二个改右路肩立牌，再挤就不放；到下一次停车不足字长不放
  let lastRoad = -9, lastSign = -9;
  const stopTimes = reds.map(r => r.t).concat(barriers.filter(b => b.hard).map(b => b.t));
  for (const r of LN) {
    if (!r.word) continue;
    if (A.some(a => (a.k === 'range' && a.line === r.i) || (a.k === 'stat' && a.line === r.i))) continue;
    if (A.some(a => a.k === 'compare' && (a.line === r.i))) continue;
    if (EV.define && EV.define.line === r.i) continue;
    if (A.some(a => a.k === 'flip' && a.lineB === r.i) && EV.end.kind === 'fall' && r.i === LN.length - 1) continue;
    if (A.some(a => a.k === 'compare' && a.lineR === r.i && a.rneg)) continue;
    const t = r.wt0, sNow = v2s(t);
    const nextStop = stopTimes.find(q => q > t), room = nextStop != null ? v2s(nextStop) - sNow : 99;
    const hero = r.word === EV.hero;
    if (r.wp) { if (said(r.i, r.word, '路牌')) { sideSigns.push({ word: r.word, t, s: sNow + 12, col: PAINT }); lastSign = t; } continue; }
    if (t - lastRoad >= 1.6 && room >= Z_FAR - Z_NEAR) { if (said(r.i, r.word, '路面字')) { roadWords.push({ word: r.word, t, s: sNow, col: hero ? GOLD : PAINT, stretch: 1 }); lastRoad = t; } }
    else if (t - lastSign >= 1.2 && t - lastRoad < 1.6) { if (said(r.i, r.word, '路牌')) { sideSigns.push({ word: r.word, t, s: sNow + 12, col: PAINT }); lastSign = t; } }
  }
  // ②b 道具（11-07 第 4 步）：剧本里挂了图标的词 → 右路肩一块方牌，牌上是图标，车灯照亮；
  //     这个词自己已经上了右路肩立牌，图标就印在那块牌上；前后 1.2 秒已有立牌、1.5 秒内有左边大牌，就不另立
  let lastIcon = -9;
  for (const q of jubenProps(window.JUBEN)) {
    const same = sideSigns.find(g => g.word === q.text && Math.abs(g.t - q.t) < .05);
    if (same) { same.icon = q.icon; same.off = q.t1 + Math.min(q.gap, .4); lastIcon = q.t; said(q.line, q.text, '图标', q.icon); continue; }
    if (q.t - lastIcon < 1.4 || sideSigns.some(g => Math.abs(g.t - q.t) < 1.2)) continue;
    if (A.some(a => a.k === 'compare' && a.L && Math.abs(a.tL - q.t) < 1.5)) continue;
    sideSigns.push({ icon: q.icon, word: '', t: q.t, s: v2s(q.t) + 13, col: PAINT, off: q.t1 + Math.min(q.gap, .4) }); lastIcon = q.t; said(q.line, q.text, '图标', q.icon);
  }
  // ③ 定义句：门架
  if (EV.define && said(EV.define.line, EV.hero, '主角词')) gantries.push({ word: EV.hero, t: EV.define.t, t1: EV.define.t1, s: v2s(EV.define.t) + 13, hero: true });
  for (const a of A) if (a.k === 'year' && said(a.line, a.year, '年份')) gantries.push({ word: a.year, t: a.t, t1: a.t + .3, s: v2s(a.t) + 13 });
  // 主角词再被说到时：路面金字
  // ④ 对比：左边大牌
  for (const a of A) if (a.k === 'compare' && a.L && said(lineOf(a.L, a.line), a.L, '对比牌')) boards.push({ word: a.L, t: a.tL, s: v2s(a.tL) + 18 });
  // 列表：右路肩出口牌
  for (const a of A) if (a.k === 'listitem' && a.word && said(a.line, a.word, '清单牌')) sideSigns.push({ word: a.word, t: a.t, s: v2s(a.t) + 12, col: PAINT, n: a.n });
  // ⑤ 车灯：句极性下 → 60%，上 → 100%；对比句 R 含没 → 35%
  lightKeys.push([0, .01, 1]);
  for (const r of LN) lightKeys.push([r.t0, .3, r.pol < 0 ? .62 : r.pol > 0 ? 1 : .88]);
  for (const a of A) if (a.k === 'compare' && a.rneg) lightKeys.push([a.tR, .24, .35], [a.tR1 + Math.min(LN[a.lineR].gap, .8), .3, .6]);
  lightKeys.sort((p, q) => p[0] - q[0]);
  if (EV.end.kind === 'fall') lightKeys.push([EV.end.t, .1, .4], [EV.end.t + .18, .12, 0]);
  // ⑥ 转折词 → 路向一边弯，相邻至少隔 3 秒，左右交替
  let side = 1, last = -9;
  for (const t of EV.turns) if (t - last >= 3) { curves.push({ t, side }); side = -side; last = t; }
  // ⑦ 「很多 X」→ 路肩一排：不是人物词是抛锚车，是人物词是窗灯
  EV.crowds.forEach((c, i) => { if (i === 0 && c.t < 1) return; for (let k = 0; k < 12; k++) cars.push({ t: c.t + k * .04, s: v2s(c.t) + 18 + k * 7, X: 5.2, person: c.person, tEnd: c.t + 4 }); });
  if (EV.end.kind === 'fall') {
    END = { t: EV.end.t, t1: EV.end.t1, word: EV.end.word && said(endLine(EV.end.word, LN.length - 1), EV.end.word, '结尾大字') ? EV.end.word : '', tMir: LN[LN.length - 1].t0 + (LN[LN.length - 1].wt0 - LN[LN.length - 1].t0) * .35, push0: Math.max(EV.end.t - .48, 0) };
  }
}

window.boot = () => {
  tile = noiseTile(9);
  build();
  setupSubs({ top: 1400, height: 170, color: '#F2EFE6', gold: GOLD });
};
const curveAt = t => { let c = 0; for (const q of curves) c += q.side * .0018 * P(t, q.t, q.t + .35) * (1 - P(t, q.t + .85, q.t + 1.2)); return c; };
const glow = (c, x, y, r, col, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalAlpha = 1; };
const DIG = { '.': '00000000000000000000000000000000100', 0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100010001000100011111', 3: '11111000100010000010000011000101110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110', 6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110', 9: '01110100011000101111000010001001100' };
function ledNum(c, s, x, y, cell, col) { // 灯阵：小方块拼字
  let X = x; c.fillStyle = col;
  for (const ch of String(s)) { const m = DIG[ch]; if (!m) { X += cell * 3; continue; } for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (m[r * 5 + q] === '1') c.fillRect(X + q * cell, y + r * cell, cell * .78, cell * .78); X += cell * 6; }
  return X - x;
}

// 画路。mode=front：前方；mirror：后视镜（同一个路函数再画一遍，朝后看）
function road(c, t, o) {
  const s = o.s, light = o.light, carX = o.carX, curv = o.curv, h0 = o.yh, y1 = o.y1, x0 = o.x0, step = o.step || 1, dir = o.dir || 1, kk = o.K || K, sc = o.sc || 1;
  const ypm = y => (y - h0) / (2.2 / sc);    // 这一行每米多少像素
  for (let y = Math.ceil(h0 + 1); y < y1; y += step) {
    const z = kk / (y - h0), sw = s + dir * z, ppm = ypm(y), shift = dir * curv * z * z / 2;
    const cx = x0 + (shift - carX) * ppm;
    const fall = light * Math.exp(-z / 26) * (1.1 - .1 * Math.min(z / 6, 1));
    const grit = hash(Math.floor(sw * 2.7)) * .05 + hash(Math.floor(sw * .61), 3) * .05;
    const lum = clamp(.082 + .10 * fall + grit * (fall + .12));
    const col = Math.round(lum * 255);
    const left = cx - 5.6 * ppm, right = cx + 3.4 * ppm;
    c.fillStyle = `rgb(${Math.round(col * .36)},${Math.round(col * .36)},${Math.round(col * .4)})`; c.fillRect(0, y, 1080 * sc, step);   // 路肩
    c.fillStyle = `rgb(${col},${col},${Math.round(col * 1.08)})`; c.fillRect(left, y, right - left, step);
    // 车灯的光斑：越靠路中越亮
    if (fall > .02) { const lw = (1.9 + z * .06) * ppm; const g = Math.round(fall * 42); c.fillStyle = `rgba(${200},${192},${170},${Math.min(g / 255, .3)})`; c.fillRect(cx - lw, y, lw * 2, step); }
    // 黄虚线：2 米画 4 米空，在左边
    const m = ((sw % 6) + 6) % 6;
    if (m < 2) { const dx = -1.9 * ppm, w = Math.max(.16 * ppm, .6); c.globalAlpha = clamp(.18 + fall * 1.1); c.fillStyle = GOLD; c.fillRect(cx + dx - w / 2, y, w, step); c.globalAlpha = 1; }
    // 路面的字
    for (const w of o.words) {
      const zz = sw - w.s;   // 相对读字时刻的距离
      const zF = Z_FAR * (w.stretch || 1);
      if (zz < Z_NEAR - .001 || zz > zF) continue;
      const yr = YH + K / (zz / (w.stretch || 1)), v = clamp((yr - 700) / 390);
      const T = tex(w.word, w.col), sy = Math.floor(v * (T.height - 1));
      const lw = 1.65 * ppm;
      c.globalAlpha = clamp(.22 + (o.paintGain || 1) * fall * 1.65 + (w.col === GOLD ? .12 : 0));
      c.drawImage(T, 0, sy, T.width, 1, cx - lw, y, lw * 2, step + .5);
      c.globalAlpha = 1;
    }
  }
}

function seek(t) {
  const c = ctx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#04050A'; c.fillRect(0, 0, 1080, 1920);
  const s = v2s(t), L = track(t, 1, lightKeys, E.lin);
  const lat = track(t, 0, latKeys);
  const curv = curveAt(t);
  let yh = YH;
  for (const b of bumps) yh -= b.amp * Math.sin(Math.PI * clamp((t - b.t) / .22)) * Math.exp(-(Math.max(t - b.t, 0)) * 3);
  const red = reds.find(r => t >= r.t - .1 && t < r.tGreen + .3);
  // 推镜：红灯时慢推；结尾推向后视镜
  let zoom = 1, zcx = X0, zcy = 320;
  if (red) { const a = P(t, red.t, red.t + .36) * (1 - P(t, red.tGreen, red.tGreen + .3)); zoom = lerp(1, 1.25, a); }
  c.save();
  if (zoom !== 1) { c.translate(zcx, zcy); c.scale(zoom, zoom); c.translate(-zcx, -zcy); }
  // 天和远山
  c.fillStyle = '#080B12'; c.fillRect(-300, -300, 1700, yh + 300);
  const curShift = curv * 2200;
  c.fillStyle = '#0D1119';
  for (let i = -2; i < 12; i++) { const X = i * 140 - (s * .9 % 140) + curShift * .5, h = 20 + 56 * hash(Math.floor((s * .9) / 140) + i, 2); c.fillRect(X, yh - h, 148, h + 2); }
  // 路
  const front = roadWords;
  road(c, t, { s, light: L, carX: lat, curv, yh, yh, y1: HOOD + 2, x0: X0 + curShift * .06, words: front, yh: yh });
  // 路肩反光柱，每 12 米一根（右边），世界里的尺子
  const ppmz = z => 1100 / z;
  const proj = (X, H, z) => ({ x: X0 + curShift * .06 + (X - lat + curv * z * z / 2) * ppmz(z), y: yh + F * (CAMH - H) / z, k: ppmz(z) });
  const first = Math.floor(s / 12) + 1;
  for (let i = 12; i >= 0; i--) {
    const sw = (first + i) * 12, z = sw - s; if (z < 2) continue;
    const p = proj(3.9, 1, z), b = clamp(L * Math.exp(-z / 34) * 1.3);
    c.fillStyle = `rgba(201,163,90,${b})`; c.fillRect(p.x - .05 * p.k, p.y, Math.max(.1 * p.k, 1), .9 * p.k);
  }
  // 由远到近的东西
  const obj = [];
  for (const g of gantries) obj.push({ s: g.s, draw: z => drawGantry(c, g, t, z, proj, L) });
  for (const b of boards) obj.push({ s: b.s, draw: z => drawBoard(c, b, t, z, proj, L) });
  for (const g of sideSigns) obj.push({ s: g.s, draw: z => drawSign(c, g, t, z, proj, L) });
  for (const r of reds) obj.push({ s: v2s(r.t) + 9.5, draw: z => drawRed(c, r, t, z, proj, yh) });
  for (const b of barriers) obj.push({ s: v2s(b.t) + 4.6, draw: z => drawBarrier(c, b, t, z, proj, L) });
  for (const k of cars) obj.push({ s: k.s, draw: z => drawCar(c, k, t, z, proj, L) });
  obj.sort((p, q) => q.s - p.s);
  for (const o of obj) { const z = o.s - s; if (z > .9 && z < 120) o.draw(z); }
  // 对比句 L：大牌金光洒路
  const bb = boards.find(b => t >= b.t && t < b.t + 1.2);
  if (bb) { const a = P(t, bb.t, bb.t + .06) * (1 - P(t, bb.t + .5, bb.t + 1.2)); c.fillStyle = `rgba(232,184,75,${.09 * a})`; c.fillRect(0, 0, 1080, 1330); }
  // 没电时前路压暗
  c.restore();
  // 车头：不跟推镜
  drawHood(c, t);
  drawMirror(c, t, s, L);
  for (const f of LATER) f(); LATER = [];   // 11-10 第二次：灯阵的数在后视镜之后画
  c.drawImage(tile, 0, 0, 1080, 1920);
  updSubs(t);
}
window.seek = seek;

function panelText(c, word, x, y, w, h, col, lit) {
  c.fillStyle = col; c.globalAlpha = lit; c.font = `${h * .86}px Glow`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const m = c.measureText(word).width, sc = Math.min(1, w * .9 / m);
  c.save(); c.translate(x + w / 2, y + h / 2 + h * .03); c.scale(sc, 1); c.fillText(word, 0, 0); c.restore(); c.globalAlpha = 1;
}
function drawGantry(c, g, t, z, proj, L) {
  const a = proj(-5.6, 0, z), b = proj(3.4, 0, z), top = proj(0, 5.7, z), low = proj(-3, 2.7, z), hi = proj(3, 5.7, z);
  const dim = clamp(.5 * Math.exp(-z / 40) + .08);
  c.fillStyle = `rgba(36,38,44,${dim * 2})`;
  const pw = Math.max(.22 * a.k, 2);
  c.fillRect(a.x, top.y - .3 * a.k, pw, a.y - top.y + .3 * a.k); c.fillRect(b.x, top.y - .3 * a.k, pw, b.y - top.y + .3 * a.k); c.fillRect(a.x, top.y, b.x - a.x, Math.max(.22 * a.k, 2));
  c.fillStyle = '#10131A'; c.fillRect(low.x, hi.y, hi.x - low.x, low.y - hi.y);
  c.strokeStyle = 'rgba(180,170,140,.28)'; c.lineWidth = Math.max(.04 * a.k, 1); c.strokeRect(low.x, hi.y, hi.x - low.x, low.y - hi.y);
  const chars = [...g.word], W = hi.x - low.x, H = low.y - hi.y, cw = W / Math.max(chars.length, 2);
  chars.forEach((ch, i) => {
    const tc = g.t + i * .12; if (t < tc) return;
    const on = P(t, tc, tc + .06);
    c.fillStyle = g.hero ? GOLD : PAINT; c.globalAlpha = on; c.font = `${Math.min(H * .86, cw * .96)}px Glow`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(ch, low.x + (W - cw * chars.length) / 2 + cw * (i + .5), hi.y + H * .54); c.globalAlpha = 1;
  });
  if (t >= g.t) glow(c, low.x + W / 2, hi.y + H / 2, W * .9, 'rgba(232,184,75,.25)', .8);
}
function drawBoard(c, b, t, z, proj, L) {
  const lo = proj(-6.2, 3.1, z), hi = proj(-2.0, 6.1, z), W = hi.x - lo.x, H = lo.y - hi.y;   // 11-07：整块往路这边挪 1.2 米，读字时左边不出画
  const pole = proj(-4.1, 0, z);
  c.fillStyle = '#14171E'; c.fillRect(pole.x - .12 * pole.k, lo.y, .24 * pole.k, pole.y - lo.y);
  const on = t >= b.t;
  c.fillStyle = on ? GOLD : '#10131A'; c.fillRect(lo.x, hi.y, W, H);
  if (on) { glow(c, lo.x + W / 2, hi.y + H / 2, W * 1.2, 'rgba(232,184,75,.42)', 1); panelText(c, b.word, lo.x, hi.y, W, H, '#0B0D12', 1); }
}
function drawSign(c, g, t, z, proj, L) {
  const lo = proj(2.5, 1.6, z), hi = proj(5.1, 3.5, z), W = hi.x - lo.x, H = lo.y - hi.y, pole = proj(3.8, 0, z);
  c.fillStyle = '#14171E'; c.fillRect(pole.x - .06 * pole.k, lo.y, .12 * pole.k, pole.y - lo.y);
  const b = clamp(L * Math.exp(-z / 30) * 1.6);
  c.fillStyle = `rgb(${Math.round(16 + 20 * b)},${Math.round(18 + 22 * b)},${Math.round(24 + 24 * b)})`; c.fillRect(lo.x, hi.y, W, H);
  c.strokeStyle = GOLD; c.globalAlpha = b; c.lineWidth = Math.max(.05 * lo.k, 1); c.strokeRect(lo.x, hi.y, W, H); c.globalAlpha = 1;
  if (t < g.t - .15) return;
  if (g.icon && t < g.off + .3) {                        // 道具牌：图标占大半，有词时词在下面一行；这句说完图标就灭（车慢时牌子还远，不让它亮着配到下一句）
    const lit = clamp(b + .35) * (1 - P(t, g.off, g.off + .3, E.inC)), sz = Math.min(W * .72, H * (g.word ? .62 : .84));
    c.globalAlpha = lit; drawIcon(c, g.icon, lo.x + W / 2, hi.y + (g.word ? H * .38 : H / 2), sz, GOLD, 2.2); c.globalAlpha = 1;
    if (g.word) panelText(c, g.word, lo.x + W * .1, hi.y + H * .7, W * .8, H * .26, g.col, lit);
    return;
  }
  if (g.word) panelText(c, (g.n ? g.n + ' ' : '') + g.word, lo.x, hi.y, W, H, g.col, clamp(b + .25));
}
function drawBarrier(c, b, t, z, proj, L) {
  if (b.person) { const p = proj(0, 2.2, z); const on = Math.floor(t * 4) % 2 === 0; glow(c, p.x, p.y, 2.2 * p.k, 'rgba(233,162,59,.8)', on ? .9 : .25); c.fillStyle = on ? AMBER : '#3A2A10'; c.beginPath(); c.arc(p.x, p.y, .22 * p.k, 0, 7); c.fill(); return; }
  const lo = proj(-3.4, .35, z), hi = proj(2.4, 1.45, z), W = hi.x - lo.x, H = lo.y - hi.y, b0 = proj(0, 0, z);
  c.save(); c.beginPath(); c.rect(lo.x, hi.y, W, H); c.clip();
  c.fillStyle = PAINT; c.fillRect(lo.x, hi.y, W, H); c.fillStyle = '#101116';
  const st = H * 1.6; for (let i = -2; i < W / st + 2; i++) { c.beginPath(); const X = lo.x + i * st * 2; c.moveTo(X, hi.y + H); c.lineTo(X + st, hi.y + H); c.lineTo(X + st * 2, hi.y); c.lineTo(X + st, hi.y); c.fill(); }
  c.restore();
  c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(lo.x, b0.y - .05 * b0.k, W, .1 * b0.k);
  const lit = clamp(L * 1.2);
  c.fillStyle = `rgba(7,8,10,${1 - lit})`; c.fillRect(lo.x, hi.y, W, H);
  const on = Math.floor(t * 4) % 2 === 0;
  for (const X of [-3.2, 2.2]) { const p = proj(X, 1.75, z); glow(c, p.x, p.y, 1.3 * p.k, 'rgba(233,162,59,.9)', on ? 1 : .22); c.fillStyle = on ? AMBER : '#3A2A10'; c.beginPath(); c.arc(p.x, p.y, .15 * p.k, 0, 7); c.fill(); }
}
function drawRed(c, r, t, z, proj, yh) {
  const a = r.a, green = t >= r.tGreen;
  const lamp = proj(0, 8.8, z), arm = proj(-5.4, 8.3, z), right = proj(3.6, 8.3, z), base = proj(3.6, 0, z);
  c.fillStyle = '#12141A'; c.fillRect(base.x - .13 * base.k, right.y, .26 * base.k, base.y - right.y); c.fillRect(arm.x, right.y - .08 * base.k, right.x - arm.x, .16 * base.k);
  const hw = 1.1 * lamp.k, hh = .9 * lamp.k;
  c.fillStyle = '#0A0B0F'; c.fillRect(lamp.x - hw * .55, lamp.y - hh, hw * 1.1, hh * 1.2);
  const col = green ? GREEN : RED;
  glow(c, lamp.x, lamp.y - hh * .4, 3.4 * lamp.k, green ? 'rgba(63,191,111,.65)' : 'rgba(216,57,43,.75)', 1);
  c.fillStyle = col; c.beginPath(); c.arc(lamp.x, lamp.y - hh * .4, .42 * lamp.k, 0, 7); c.fill();
  // 灯阵数字
  const lo = a.tLo != null ? a.lo : 0, hi = a.tLo != null ? a.hi : a.value, tHi = a.tLo != null ? a.tHi : a.t;
  const dr = .36;
  const v = t < r.t ? 0 : a.tLo != null ? (t < a.tLo + dr ? lerp(0, lo, E.outC((t - a.tLo) / dr)) : t < tHi ? lo : lerp(lo, hi, E.outC(clamp((t - tHi) / dr)))) : lerp(0, hi, E.outC(clamp((t - a.t) / .4)));
  const hiNow = t >= tHi, rw = a.tLo != null ? (hiNow ? a.rawHi : a.rawLo) : a.raw;    // 停住时照抄字幕原文
  const done = a.tLo != null ? (hiNow ? t >= tHi + dr : t >= a.tLo + dr) : t >= a.t + .4;
  if (!green && t >= r.t - .02 && !r.noNum) {
    // 11-10 复审：范围原来一次只亮一头（先 30 后 60），单位画在数右边、被牌子挡住（「2个月」看着像「21」）。
    // 现在后半一出来，前半和「到」照抄字幕原文一起亮，落定读「30到60天」；数和单位一起居中，太宽整体缩小；等路上的东西都画完再画，谁也挡不住
    const pan = proj(0, 6.9, z), col = tHi <= t ? '#A82A20' : RED, parts = [];
    if (a.tLo != null && hiNow) {
      const lo = rawSplit(a.rawLo), cn = a.raw && a.rawLo && a.rawHi && a.raw.startsWith(a.rawLo) && a.raw.endsWith(a.rawHi) ? a.raw.slice(a.rawLo.length, a.raw.length - a.rawHi.length) : '到';
      if (lo) parts.push({ led: lo.n }, { txt: lo.u });
      parts.push({ txt: cn });
    }
    parts.push({ led: rollNum(v, rw, done) }, { txt: hiNow || done ? rawUnit(rw) : '' });
    const PT = parts.filter(p => p.led || p.txt);
    const M = c.getTransform(), zs = Math.hypot(M.a, M.b), px = M.a * pan.x + M.c * pan.y + M.e, py = M.b * pan.x + M.d * pan.y + M.f;   // 推镜后的屏幕位置
    LATER.push(() => {
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);   // 11-10 第二次：在屏幕上画，排在后视镜后面
      const wOf = (p, cl) => { if (p.led) return p.led.length * cl * 6; c.font = `900 ${cl * 5}px Noto`; return c.measureText(p.txt).width; };
      const tot = cl => PT.reduce((s, p) => s + wOf(p, cl), 0) + cl * 1.5 * Math.max(0, PT.length - 1);
      const RX = 610;   // 后视镜左边沿约 633 像素：灯阵整块放在它左边
      let cell = .155 * lamp.k * zs; cell *= Math.min(1, (RX - 40 - cell * 4) / Math.max(1, tot(cell)));
      const w = tot(cell), Y = Math.max(py - 3.5 * cell, 220 + cell * 2);   // 11-07：灯阵上沿不高过 220 像素
      let X = Math.max(40 + cell * 2, Math.min(px - w / 2, RX - cell * 2 - w));
      c.fillStyle = '#090A0E'; c.fillRect(X - cell * 2, Y - cell * 2, w + cell * 4, cell * 11);
      for (const p of PT) {
        if (p.led) ledNum(c, p.led, X, Y, cell, col);
        else { c.fillStyle = col; c.font = `900 ${cell * 5}px Noto`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(p.txt, X, Y + cell * 3.5); }
        X += wOf(p, cell) + cell * 1.5;
      }
      c.restore();
    });
    // 红光照路
    c.fillStyle = 'rgba(216,57,43,.07)'; c.fillRect(-300, yh, 1700, 1000);
  }
}
function drawCar(c, k, t, z, proj, L) {
  if (t < k.t - .6) return;
  const on = t >= k.t;
  if (k.person) { const p = proj(k.X + 8, 3.5, z); if (on) { c.fillStyle = 'rgba(232,184,75,.8)'; c.fillRect(p.x, p.y, 1.1 * p.k, .8 * p.k); glow(c, p.x + .5 * p.k, p.y, 2 * p.k, 'rgba(232,184,75,.3)', 1); } return; }
  const b = proj(k.X, 0, z), W = 1.8 * b.k, H = 1.25 * b.k;
  c.fillStyle = '#0B0D12'; c.beginPath(); c.moveTo(b.x - W / 2, b.y); c.lineTo(b.x - W / 2, b.y - H * .52); c.lineTo(b.x - W * .34, b.y - H); c.lineTo(b.x + W * .34, b.y - H); c.lineTo(b.x + W / 2, b.y - H * .52); c.lineTo(b.x + W / 2, b.y); c.fill();
  if (on) {
    const f = Math.floor((t + k.t) * 3) % 2 === 0 ? 1 : .4;
    for (const s of [-1, 1]) { c.fillStyle = RED; c.globalAlpha = f; c.fillRect(b.x + s * W * .36 - .1 * b.k, b.y - H * .56, .2 * b.k, .12 * b.k); c.globalAlpha = 1; glow(c, b.x + s * W * .36, b.y - H * .5, .9 * b.k, 'rgba(216,57,43,.6)', f); }
  }
}
function drawHood(c, t) {
  let idle = 0; for (const r of reds) if (t >= r.t && t < r.tGreen) idle = Math.sin(t * 60) * 1;
  c.fillStyle = BLACK; c.beginPath(); c.moveTo(-10, 1920); c.lineTo(-10, HOOD + 66 + idle); c.quadraticCurveTo(470, HOOD - 22 + idle, 1090, HOOD + 72 + idle); c.lineTo(1090, 1920); c.fill();
  const g = c.createLinearGradient(0, HOOD - 18, 0, HOOD + 120); g.addColorStop(0, 'rgba(120,120,110,.14)'); g.addColorStop(.3, 'rgba(40,40,40,.05)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save(); c.beginPath(); c.moveTo(-10, HOOD + 66 + idle); c.quadraticCurveTo(470, HOOD - 22 + idle, 1090, HOOD + 72 + idle); c.lineTo(1090, HOOD + 130); c.lineTo(-10, HOOD + 130); c.closePath(); c.clip(); c.fillStyle = g; c.fillRect(0, HOOD - 30, 1080, 170); c.restore();
}
function drawMirror(c, t, s, L) {
  // 结尾：推进镜子里，车灯全灭，只剩这一条亮光
  let scale = 1, cx = 830, cy = 328, ending = 0;
  if (END) { const u = P(t, END.push0, END.t1, E.ioC); ending = P(t, END.t, END.t1); scale = lerp(1, 3.4, u); cx = lerp(830, 470, u); cy = lerp(328, 810, u); }
  const W = 380 * scale, H = 184 * scale, X = cx - W / 2, Y = cy - H / 2;
  if (ending > 0) { c.fillStyle = `rgba(3,4,7,${ending})`; c.fillRect(0, 0, 1080, 1340); }
  c.save(); c.fillStyle = '#050608'; rr(c, X - 7, Y - 7, W + 14, H + 14, 18 * Math.sqrt(scale)); c.fill();
  rr(c, X, Y, W, H, 14 * Math.sqrt(scale)); c.clip();
  c.fillStyle = '#0A0C12'; c.fillRect(X, Y, W, H);
  // 朝后看的路：缩小的路面
  const k = W / 380, hz = Y + H * .28;
  const words = [];
  for (const w of roadWords) { const back = s - w.s; if (back > -Z_FAR && back < 60) words.push(w); }
  c.translate(X, 0); c.scale(k, 1);
  const col = END && t >= END.push0 ? 'rgba(216,57,43,' : 'rgba(150,150,140,';
  for (let y = Math.ceil(hz); y < Y + H; y += Math.max(2, Math.round(2 * scale / 2))) {
    const z = (H * .72 * 11.0) / (y - hz + .5), sw = s - z, ppm = (y - hz) / (H * .72) * 160, cx0 = 190;
    const grit = hash(Math.floor(sw * 2.7)) * .05;
    const bright = END && t >= END.push0 ? .9 : .55;
    c.fillStyle = `rgb(${Math.round((22 + 34 * Math.exp(-z / 16) + grit * 60) * bright * (END && t >= END.push0 ? 1.8 : 1))},${Math.round((22 + 22 * Math.exp(-z / 16)) * bright * .7)},${Math.round((26 + 18 * Math.exp(-z / 16)) * bright * .7)})`;
    c.fillRect(cx0 - 5.6 * ppm / 1.6, y, 9 * ppm / 1.6, 3);
    for (const w of words) {
      const dz = sw - w.s;
      if (dz < Z_NEAR || dz > Z_FAR) continue;
      const T = tex(w.word, w.col), yr = YH + K / dz, v = clamp((yr - 700) / 390), sy = Math.floor(v * (T.height - 1)), lw = 1.65 * ppm / 1.6;
      c.globalAlpha = .85; c.drawImage(T, 0, sy, T.width, 1, cx0 - lw, y, lw * 2, 3); c.globalAlpha = 1;
    }
  }
  // 结尾：主角词在镜子里追上来
  if (END && END.word && t >= END.tMir) {
    const u = P(t, END.tMir, END.t + .1, E.outC), d = lerp(.1, 1, u);
    // 11-07：原来跟着镜子横向拉伸了 k 倍，两个字挤叠；现在回到不拉伸的画布，字号按镜子高度算，字间留一成空
    const chars = [...END.word], n = chars.length, gap = H * .84 / Math.max(n, 2);
    const size = Math.min(gap * .88, W * .8) * d, top = Y + H * .08 + (1 - d) * H * .22;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = GOLD; c.font = `${size}px Glow`; c.textAlign = 'center'; c.textBaseline = 'middle';
    chars.forEach((ch, i) => { c.fillText(ch, X + W / 2, top + (i + .5) * gap * d); });
  }
  // 结尾的红光
  if (END && t >= END.push0) { const a = P(t, END.push0, END.t); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(216,57,43,${.14 * a})`; c.fillRect(X, Y, W, H); }
  c.restore();
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath(); }

// 启动：字体到齐 → 搭场景 → 第 0 帧 → 告诉渲染器可以截了
startStage(['200px Glow', [...new Set(EV.groups.map(g => g.text).join('') + '？0123456789')].join('')], ['800 62px Noto', EV.lines.map(l => l.text).join('').slice(0, 200)], ['900 120px Noto', '0123456789']);
