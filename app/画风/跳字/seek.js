// 画风「跳字」：从第二批样片工程 d.js 搬来（2026-11-07 第 3 步），画面代码原样未改。
// 只读剧本：window.JUBEN 由公共 core.js 的 jubenEv() 转成这里用的 EV；公共小工具（缓动、字幕、噪点、取字时刻）在 core.js，这里不另写。
document.getElementById('frame').innerHTML = '<canvas id="c" width="1080" height="1920"></canvas><div id="view"></div><div id="subs"></div>';
const EV = jubenEv(window.JUBEN);

// 方向「跳字」：一颗小球踩着他说话的节奏，跳过这段话铺成的地形。全部由 EV（rules.py）算出，这里没有任何一段录音的秒数和词。
// 吸纳：Lemo rubber-hose 跳球唱歌、game-show 落地压扁与一串波、midcentury-toon 色块错位与抖动。自己的：地形由语音时间算出，落地 = 字开始。
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const SKY = '#1E4E6B', HILL = '#25597A', SIDE = '#0F2A3A', SHAFT = '#0B202D', TOP = '#F2E9D8', BALL = '#FFD23F', BALLD = '#E0A92E', CROWD = '#7FA6B8', CROWDD = '#5F8699', INK = '#0F2A3A', HERO = '#E4572E', GOLD = '#E8B84B', GOLD2 = '#F0D58C';
const BASE = 860, R = 58, GRAV = 5200, DROP = 420, ZB = 1.3, SCREEN_Y = 800, REACH_H = 230;   // REACH_H：够对比牌那一跳最多跳多高（再高牌子就挂到画面上边外了）   // 整个世界放大 1.3 倍，手机上球才看得清
const G = EV.groups, A = EV.acts, LN = EV.lines, DUR = EV.dur;
let STATS = [], legs = [], plats = [], lands = [], moods = [], bursts = [], strips = [], signs = [], flyers = [], longs = [], crowds = [], doors = [], tags = [], rollN = [], camX = [], camY = [], zoomKeys = [], anchorKeys = [], wilts = [];
let tile = null, FALL = null;
let EL = 0, ER = 1080, ZC = 1;   // 11-10 复审：这一帧画面左右边在世界里的位置
const vis = (a, b) => clamp((a - EL) * ZC / 30) * clamp((ER - b) * ZC / 30);   // 字从 a 到 b：快被画面边切到时先淡出，切到了就不画（不露半截数）
const near = (a, b, e = .02) => Math.abs(a - b) < e;
const fontWord = px => `${px}px Glow`, fontNum = px => `900 ${px}px Noto`;
const textW = (s, px, f = fontWord) => { ctx.font = f(px); return ctx.measureText(s).width; };

function build() {
  let x = 300, y = BASE, level = BASE, tNow = 0, cursor = 560;
  let cur = { x: -900, w: 1460, y: BASE, column: true };
  plats.push(cur);
  let skipUntil = -1, long = null, lastLand = 0, hopSince = 0, prevWait = false, reachT = null, pushed = false;
  const trapAt = g => A.find(a => a.k === 'trap' && a.t >= g.t0 - .02 && a.t < g.t1);
  const rangeAt = g => A.find(a => a.k === 'range' && a.tLo >= g.t0 - .02 && a.tLo < g.t1);
  const statAt = g => A.find(a => a.k === 'stat' && a.t >= g.t0 - .02 && a.t < g.t1);
  const yearAt = g => A.find(a => a.k === 'year' && a.t >= g.t0 - .1 && a.t < g.t1);
  const itemAt = g => A.find(a => (a.k === 'listitem') && a.t >= g.t0 - .1 && a.t < g.t1);
  const flipA = g => A.find(a => a.k === 'flip' && a.tA >= g.t0 - .02 && a.tA < g.t1);
  const flipB = g => A.find(a => a.k === 'flip' && a.tB >= g.t0 - .02 && a.tB < g.t1);
  const cmpL = g => A.find(a => a.k === 'compare' && a.tL >= g.t0 - .02 && a.tL < g.t1);
  const lastLine = LN.length - 1;

  const push = o => legs.push(o);
  const flyTo = (tL, xL, yL, pause, hMul = 1) => {
    let T = pause >= .3 ? Math.min(pause + .15, .7) : Math.min(.62 * (tL - lastLand), .42);
    let reach = false;
    if (reachT != null) { T = Math.min(tL - reachT, .9); reachT = null; reach = true; }
    let tk = tL - T;
    if (tk < tNow) { tk = tNow; T = tL - tk; }
    if (T < .04) { x = xL; y = yL; tNow = tL; lastLand = tL; return; }
    const edge = cur.w != null ? cur.x + cur.w - 24 : Infinity;   // 主角长块没有尽头（11-07 修：原来算出 NaN，镜头从此丢了球）
    const runX = Math.max(x, Math.min(edge, x + 520 * (tk - tNow)));
    if (tk > tNow) push({ ty: 'run', t0: tNow, t1: tk, x0: x, x1: runX, y0: y, y1: y });
    let H = GRAV * T * T / 8 * hMul;
    if (tL - hopSince > 8 && hMul === 1) H *= .2;      // 连跳太久就贴地滚，防累
    if (reach) H = Math.min(H, REACH_H);
    push({ ty: 'fly', t0: tk, t1: tL, x0: runX, x1: xL, y0: y, y1: yL, H });
    lands.push({ t: tL, k: clamp(Math.abs(yL - y + H * .9) / 300, .25, 1) });
    x = xL; y = yL; tNow = tL; lastLand = tL;
    return H;
  };
  const newPlat = (g, opts = {}) => {
    const d = Math.max(g.t1 - g.t0, .12);
    const line = LN[g.line];
    let w = Math.max(520 * d, 90);
    if (opts.word) w = Math.max(w, textW(opts.word, 112) + 70);
    let ny = y;
    if (opts.y != null) ny = opts.y;
    else {
      const step = line.pol > 0 ? -60 : line.pol < 0 ? 60 : (hash(g.t0 * 7) < .5 ? -16 : 16);
      ny = clamp(y + step, level - 180, level + 120);
    }
    const pit = g.pause >= .3 ? Math.min(520 * g.pause, 380) : 0;
    const p = { x: cursor + pit, w, y: ny, column: true, word: opts.word || null, hero: opts.word && opts.word === EV.hero, wordT: g.t0, sink: g.t0, n: opts.n, tall: opts.tall };
    plats.push(p); cursor = p.x + p.w;
    return p;
  };

  for (let i = 0; i < G.length; i++) {
    const g = G[i], line = LN[g.line];
    if (g.t0 < skipUntil) continue;
    const pause = g.pause;

    // 活板门
    const trap = trapAt(g);
    if (trap && !trap.person && !long) {
      const dw = 150, dx0 = Math.max(x + 40, cur.x + cur.w - dw);
      cur.w = Math.max(cur.w, dx0 + dw - cur.x);
      const stand = dx0 + dw / 2;
      if (trap.t > tNow) push({ ty: 'run', t0: tNow, t1: trap.t, x0: x, x1: stand, y0: y, y1: y });
      const low = y + DROP, tf = Math.sqrt(2 * DROP / GRAV) * .82;
      doors.push({ t: trap.t, x: dx0, w: dw, y, low, slab: 380 });
      push({ ty: 'fall', t0: trap.t + .03, t1: trap.t + .03 + tf, x0: stand, x1: stand + 10, y0: y, y1: low });
      lands.push({ t: trap.t + .03 + tf, k: 1 });
      bursts.push({ t: trap.t + .03 + tf, x: stand, y: low, n: 5 });
      moods.push({ t0: trap.t - .3, t1: trap.t + .03, kind: 'look', dx: 0, dy: 1 });
      moods.push({ t0: trap.t + .03 + tf + .1, t1: (G[i + 1] ? G[i + 1].t0 : DUR) - .02, kind: 'look', dx: -.2, dy: -1 });
      cur.w = dx0 - cur.x;                              // 门左边还是原来的地
      x = stand + 10; y = low; level = low; tNow = trap.t + .03 + tf; lastLand = tNow;
      cur = { x: dx0 - 10, w: dw + 560 + (G[i + 1] && G[i + 1].pause > .3 ? 300 : 0), y: low, column: true };
      plats.push(cur); cursor = cur.x + cur.w;
      continue;
    }
    if (trap && trap.person) {                           // 人物闸：不开门，球刹在边上
      moods.push({ t0: trap.t, t1: g.t1 + .3, kind: 'shake' });
    }

    // 区间：一天一格的带子
    const rg = rangeAt(g);
    if (rg && !long) {
      const N = Math.min(rg.hi, 120), cw = Math.max(16, Math.min(64, 960 / N)), W = N * cw, loF = rg.lo / rg.hi;
      if (rg.tLo > tNow) push({ ty: prevWait ? 'wait' : 'stay', t0: tNow, t1: rg.tLo, x0: x, x1: x, y0: y, y1: y });
      const sx = x + R + 6, r1 = Math.min(.36, rg.tHi - rg.tLo), r2 = Math.min(.36, rg.t1 - rg.tHi);
      cur.w = Math.max(cur.w, sx + W + 150 - cur.x);
      push({ ty: 'roll', t0: rg.tLo, t1: rg.tLo + r1, x0: x, x1: sx + W * loF, y0: y, y1: y - 34 });
      if (rg.tHi > rg.tLo + r1) push({ ty: 'stay', t0: rg.tLo + r1, t1: rg.tHi, x0: sx + W * loF, x1: sx + W * loF, y0: y - 34, y1: y - 34 });
      push({ ty: 'roll', t0: rg.tHi, t1: rg.tHi + r2, x0: sx + W * loF, x1: sx + W, y0: y - 34, y1: y - 34 });
      const st = { x: sx, y, N, cw, W, loF, tLo: rg.tLo, r1, tHi: rg.tHi, r2, lo: rg.lo, hi: rg.hi, unit: rg.unit, t1: rg.t1, weld: null, up: y - 34, noNum: !(rg.rawLo && rg.rawHi) || !said(g.line, rangeText(rg), '数字带子'), rawLo: rg.rawLo, rawHi: rg.rawHi,
        conn: rg.raw && rg.rawLo && rg.rawHi && rg.raw.startsWith(rg.rawLo) && rg.raw.endsWith(rg.rawHi) && rg.raw.length > rg.rawLo.length + rg.rawHi.length ? rg.raw.slice(rg.rawLo.length, rg.raw.length - rg.rawHi.length) : '' };   // 抄不准字幕原文：带子照走，不画数；conn 是字幕原文两头中间那个「到」
      strips.push(st);
      x = sx + W; y -= 34; tNow = rg.tHi + r2; lastLand = tNow; cursor = cur.x + cur.w;
      skipUntil = rg.t1 - .01; prevWait = false;
      const backG = G.find(q => q.line === g.line && q.verb === 'back' && q.t0 >= rg.tHi);
      if (backG) { flyers.push({ kind: 'back', word: EV.single && said(g.line, EV.single, '飞出的字') ? EV.single : '', t: backG.t0, x, y }); moods.push({ t0: backG.t0 + .15, t1: backG.t1 + .5, kind: 'wow' }); }
      continue;
    }

    // 定义句：主角词。前面刚有带子就把带子焊成长块；否则这里开一条长块
    const def = EV.define && near(g.t0, EV.define.t, .06) ? EV.define : null;
    if (def && !long) {
      const st = strips.length && def.t - strips[strips.length - 1].t1 < 3.5 ? strips[strips.length - 1] : null;
      if (st) {
        st.weld = { t0: LN[def.line].t0 + .3, t: def.t, t1: def.t1 };
        long = { x: st.x - 60, y: st.y, t0: def.t, word: said(def.line, EV.hero, '主角词') ? EV.hero : '', hero: true, t1: 9e9, fromStrip: st, charT: def.t };
        const zk = Math.max(.75 / ZB, Math.min(1, 900 / (st.W + 100) / ZB));   // 拉远最多到 0.75 倍，再小手机上看不清球（11-07）
        zoomKeys.push([LN[def.line].t0, .6, zk], [def.t1 + (LN[def.line].gap || 0) + .02, .35, 1]);
        anchorKeys.push([LN[def.line].t0, .6, Math.min(953, 70 + st.W * zk * ZB)], [def.t1 + (LN[def.line].gap || 0) + .02, .35, 340]);
        moods.push({ t0: LN[def.line].t0 + .1, t1: def.t, kind: 'look', dx: -1, dy: .1 });
        moods.push({ t0: def.t1, t1: def.t1 + (LN[def.line].gap || 0), kind: 'look', dx: 0, dy: 1 });
        y = st.y; if (tNow < def.t) { push({ ty: 'stay', t0: tNow, t1: def.t, x0: x, x1: x, y0: y, y1: y }); tNow = def.t; }
        long.x = st.x - 60; longs.push(long); cur = long; lastLand = g.t0;
        skipUntil = g.t1 - .01;
        const nxt = G[i + 1];
        if (nxt && nxt.t0 > tNow) { push({ ty: 'stay', t0: tNow, t1: nxt.t0 - .02, x0: x, x1: x, y0: y, y1: y }); tNow = nxt.t0 - .02; lastLand = tNow; }
        continue;
      }
    }

    // 普通落点
    const yr = yearAt(g), it = itemAt(g);
    let word = g.word && line.word && !line.wp ? line.word : null;
    if (yr) word = yr.year;
    if (g.verb === 'push') word = null;
    const fa = flipA(g), fb = flipB(g);
    if (fa) word = null;

    if (long) {                                          // 在长块上
      const lx = x + 520 * Math.max(g.t0 - tNow, 0);
      const ov = g.verb === 'grow' ? g : null;
      if (ov) { long.grow = g.t0; }
      flyTo(g.t0, lx, long.y, pause);
      if (word && word !== EV.hero && !fa && !(FALL && near(word, 0)) && said(g.line, word, yr ? '年份' : '块上的字')) tags.push({ word, t: g.t0, x: lx, y: long.y });
    } else {
      const makeLong = EV.end.kind === 'fall' && g.line === lastLine && !longs.some(l => l.t1 > 9e8);
      if (makeLong) {
        const heroW = EV.end.word && said(endLine(EV.end.word, g.line), EV.end.word, '结尾大字') ? EV.end.word : '';
        long = { x: cursor + (pause >= .3 ? 120 : 0), y: clamp(y, level - 120, level + 120), t0: g.t0, word: heroW, hero: heroW === EV.hero, t1: 9e9, charT: g.t0 };
        longs.push(long);
        flyTo(g.t0, long.x + 60, long.y, pause);
        cur = long;
      } else if (def) {                                  // 没有带子的定义句：这里开一条长块
        long = { x: cursor + (pause >= .3 ? 120 : 0), y, t0: g.t0, word: said(def.line, EV.hero, '主角词') ? EV.hero : '', hero: true, t1: Math.min(def.t + 12, DUR), charT: def.t };
        longs.push(long);
        flyTo(g.t0, long.x + 60, long.y, pause);
        cur = long;
      } else {
        const p = newPlat(g, { word: word && said(g.line, word, yr ? '年份' : '块上的字') ? word : null, n: it ? it.n : null, tall: !!yr, y: it ? clamp(y - 60, level - 180, level + 120) : undefined });
        const landX = p.x + Math.min(p.w * .3, 60);
        flyTo(g.t0, landX, p.y, pause);
        cur = p;
      }
    }

    if (long && long.t1 < 9e8 && g.t0 > long.t1) { long = null; cursor = Math.max(cursor, x + 400); }
    if (long && g.pause >= 1 && g.t0 - long.t0 > 2 && long.t1 > 9e8 && g.line !== lastLine && !long.fromStrip) { long.t1 = g.t0; long = null; }

    // 动词：只改球的动作
    if (g.verb === 'wait') { prevWait = true; const nx = G[i + 1]; const end = nx ? nx.t0 - .05 : DUR; moods.push({ t0: g.t0 + .06, t1: end, kind: 'look', dx: 1, dy: 0 }); push({ ty: 'wait', t0: tNow, t1: end, x0: x, x1: x, y0: y, y1: y }); tNow = end; lastLand = end; }
    else prevWait = false;
    if (g.verb === 'back' && !strips.length) moods.push({ t0: g.t0, t1: g.t1 + .2, kind: 'happy' });
    if (g.verb === 'wilt' || (line.word && line.pol < 0 && g.word && /没/.test(line.word))) wilts.push({ t0: g.t0, t1: line.t1 + Math.min(line.gap, .8) });
    if (g.verb === 'push') {
      const prev = G[i - 1], label = prev && prev.line === g.line && prev.text.length >= 2 && said(g.line, prev.text, '推出去的块') ? prev.text : '';
      flyers.push({ kind: 'push', word: label, t0: prev && prev.line === g.line ? prev.t0 : g.t0 - .2, t: g.t0, t1: g.t1, x: x + 170, y });
      if (cur.w != null) { cur.w = Math.max(cur.w, x + 480 - cur.x); cursor = Math.max(cursor, cur.x + cur.w); }
      moods.push({ t0: g.t0, t1: g.t1, kind: 'look', dx: 1, dy: 0 });
    }
    // 对比：够不着的牌子
    const cp = cmpL(g);
    if (cp && cp.L && !cp.person && said(lineOf(cp.L, cp.line), cp.L, '对比牌')) {
      reachT = g.t0 + .03;
      const nx = G[i + 1], T = nx ? Math.min(nx.t0 - reachT, .9) : .6, H = Math.min(GRAV * T * T / 8, REACH_H);
      signs.push({ word: cp.L, x: x + 520 * T * .5 + 40, bottom: y - H - 2 * R - 30, t0: cp.tL - .32, t: cp.tL, tUp: cp.tR0 + .3, tEnd: cp.tR0 + .9 });
      moods.push({ t0: g.t0, t1: (nx ? nx.t0 : DUR), kind: 'look', dx: .4, dy: -1 });
    }
    // 不是这个，是这个
    if (fa && said(fa.line, fa.A, '翻牌')) flyers.push({ kind: 'flip', word: fa.A, t0: fa.tA - .3, t: fa.tA, tB: fa.tB, x: x + 330, y, person: fa.person, B: EV.end.kind === 'fall' && fa.line + 2 > lastLine ? null : (fa.B && !LN[fa.lineB].wp && said(fa.lineB, fa.B, '翻牌') ? fa.B : null) });
  }
  // 收尾
  if (EV.end.kind === 'fall') {
    const e = EV.end, tf = e.t + .18, low = y + 320;
    const l = longs[longs.length - 1];
    if (tNow < tf) { push({ ty: 'stay', t0: tNow, t1: tf, x0: x, x1: x, y0: y, y1: y }); }
    else {  // 切掉 tf 之后的腿
      legs = legs.filter(q => q.t0 < tf); const q = legs[legs.length - 1]; if (q && q.t1 > tf) { const k = (tf - q.t0) / (q.t1 - q.t0); q.x1 = lerp(q.x0, q.x1, k); q.t1 = tf; x = q.x1; if (q.ty === 'fly') { q.y1 = q.y0; q.H = 0; } }
    }
    const fallT = Math.sqrt(2 * 320 / GRAV) * 1.1;
    push({ ty: 'fall', t0: tf, t1: tf + fallT, x0: x, x1: x + 60, y0: y, y1: low });
    lands.push({ t: tf + fallT, k: 1 });
    bursts.push({ t: tf + fallT, x: x + 60, y: low, n: 8 });
    moods.push({ t0: tf - .2, t1: tf + fallT + .1, kind: 'look', dx: 0, dy: 1 });
    moods.push({ t0: tf + fallT + .25, t1: tf + fallT + .8, kind: 'look', dx: -1, dy: -.1 });
    moods.push({ t0: tf + fallT + .8, t1: 99, kind: 'look', dx: 0, dy: 0 });
    FALL = { t: e.t, tf, low, x: x, y, l, slab: 760 };
    push({ ty: 'stay', t0: tf + fallT, t1: 99, x0: x + 60, x1: x + 60, y0: low, y1: low });
    zoomKeys.push([e.t - .66, 1.1, .8]);
    anchorKeys.push([e.t - .66, 1.1, 610]);
  } else {
    push({ ty: 'stay', t0: tNow, t1: 99, x0: x, x1: x, y0: y, y1: y });
    const ll = LN[LN.length - 1];
    zoomKeys.push([ll.t1 - .2, 1.2, .62]);
    anchorKeys.push([ll.t1 - .2, 1.2, 720]);
  }
  legs.sort((a, b) => a.t0 - b.t0);

  // 一群
  const stopAfter = tt => { const d = doors.find(q => q.t > tt); return d ? d.t : (FALL && FALL.t > tt ? 1e9 : 1e9); };
  EV.crowds.forEach((c, ci) => { for (let k = 0; k < 7; k++) crowds.push({ c: ci, k, t0: c.t + k * .04, r: 18 + 8 * hash(k, ci), until: stopAfter(c.t), off: 72 + 38 * k }); });

  // 镜头：只进不退，略平滑；y 缓回
  const n = Math.ceil((DUR + .5) * 60);
  let mx = -1e9, cy = BASE; const raw = [];
  for (let i = 0; i <= n; i++) { const b = ball(i / 60); mx = Math.max(mx, b.x); raw.push(mx); }
  const sm = 5;
  for (let i = 0; i <= n; i++) { let s = 0, c = 0; for (let j = -sm; j <= sm; j++) { const v = raw[clamp(i + j, 0, n)]; s += v; c++; } camX.push(s / c); }
  for (let i = 0; i <= n; i++) { const b = ball(i / 60); const gy = b.ground; cy += (gy - cy) * (1 - Math.exp(-1 / 60 / .15)); camY.push(cy); }
}

function ball(t) {
  let lo = 0, hi = legs.length - 1, q = legs[0];
  while (lo <= hi) { const m = (lo + hi) >> 1; if (legs[m].t0 <= t) { q = legs[m]; lo = m + 1; } else hi = m - 1; }
  if (!q || t < q.t0) return { x: 300, y: BASE, ground: BASE, ty: 'stay', vy: 0, vx: 0 };
  const u = clamp((t - q.t0) / Math.max(q.t1 - q.t0, .001));
  let x = q.x0, y = q.y0, vy = 0, vx = 0;
  if (q.ty === 'run') { x = lerp(q.x0, q.x1, u); y = q.y0; vx = 1; }
  else if (q.ty === 'fly') { x = lerp(q.x0, q.x1, u); y = lerp(q.y0, q.y1, u) - 4 * q.H * u * (1 - u); vy = 1 - 2 * u; vx = 1; }
  else if (q.ty === 'fall') { x = lerp(q.x0, q.x1, u); y = lerp(q.y0, q.y1, u * u); vy = -1; }
  else if (q.ty === 'roll') { x = lerp(q.x0, q.x1, E.outC(u)); y = q.y1; vx = 1; }
  else if (t > q.t1) { x = q.x1; y = q.y1; }
  const ground = q.ty === 'fly' ? lerp(q.y0, q.y1, u) : (q.ty === 'fall' ? (u > .5 ? q.y1 : q.y0) : y);
  return { x, y, ground, ty: q.ty, vy, vx };
}
const lookup = (arr, t) => { const f = clamp(t * 60, 0, arr.length - 1), i = Math.floor(f), j = Math.min(i + 1, arr.length - 1); return lerp(arr[i], arr[j], f - i); };

// 道具（11-07 第 4 步）：剧本里挂了图标的词，图标印在台子的立面上，跟着世界走，不贴卡。
// 说到这个词时，图标在球前方约 380 像素那块台子上亮出来，球跑过去踩上它（放在脚下那块，镜头一走半秒就出画了）。
// 相邻两个至少隔 300 像素。
let props = [];
function buildProps() {
  let lastX = -1e9;
  for (const q of jubenProps(window.JUBEN)) {
    const ahead = ball(q.t + .03).x + 380;
    const p = plats.find(p => p.w != null && ahead >= p.x && ahead <= p.x + p.w) || plats.filter(p => p.w != null && p.x >= ahead && p.x < ahead + 400).sort((a, c) => a.x - c.x)[0];
    const lg = !p && longs.find(l => ahead >= l.x && q.t < l.t1);
    const under = !p && !lg && plats.find(p => p.w != null && ball(q.t + .03).x >= p.x - 4 && ball(q.t + .03).x <= p.x + p.w + 4);   // 片尾前方没台子了：印在脚下这块
    let x, y, size = 150;
    const pp = p || under;
    if (pp) { size = Math.min(150, Math.max(pp.w - 24, 110)); x = pp.w > 360 ? Math.max(pp.x + 90, Math.min(p ? ahead : ball(q.t + .03).x + 140, pp.x + pp.w - 90)) : pp.x + pp.w / 2; y = pp.y; }
    else if (lg) { x = ahead; y = lg.y; }
    else continue;
    if (x - lastX < 300) continue;
    props.push({ ...q, p: pp || null, x, y, size, off: q.t1 + Math.min(q.gap, .4) }); lastX = x; said(q.line, q.text, '图标', q.icon);
  }
}

window.boot = () => {
  tile = noiseTile(10);
  build();
  buildProps();
  STATS = A.filter(a => a.k === 'stat' && a.raw && said(a.line, statText(a), '数字'));   // 11-09 第三轮：没有原文的数不画
  setupSubs({ top: 1400, height: 170, color: '#F2E9D8', gold: BALL });
};

// 错位印刷：描边不动，色块错开 3 像素，每秒抖 12 次
let OX = 3, OY = -2;
function pRect(c, x, y, w, h, col, line = INK) {
  c.fillStyle = col; c.fillRect(x + OX, y + OY, w, h);
  if (line) { c.strokeStyle = line; c.lineWidth = 4; c.strokeRect(x, y, w, h); }
}
function drawBall(c, x, y, sx, sy, o = {}) {
  const r = o.r || R, col = o.col || BALL, dk = o.dk || BALLD;
  c.save(); c.translate(x, y - r * sy); c.scale(sx, sy);
  c.fillStyle = col; c.beginPath(); c.arc(OX, OY, r, 0, 7); c.fill();
  c.save(); c.beginPath(); c.arc(OX, OY, r, 0, 7); c.clip(); c.fillStyle = dk; c.beginPath(); c.arc(OX - r * .38, OY - r * .34, r * 1.12, 0, 7); c.rect(-r * 2, -r * 2, r * 4, r * 4); c.fill('evenodd'); c.restore();
  c.strokeStyle = INK; c.lineWidth = o.small ? 3 : 4; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke();
  const lk = o.look || { dx: 1, dy: 0 }, ex = r * .18 + lk.dx * r * .1, ey = -r * .16 + lk.dy * r * .06, es = r * .29, gap = r * .42;
  for (const s of [-1, 1]) {
    const X = ex + s * gap, Y = ey;
    if (o.blink) { c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(X - es * .8, Y); c.lineTo(X + es * .8, Y); c.stroke(); continue; }
    if (o.mood === 'happy') { c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.arc(X, Y + es * .3, es * .75, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); continue; }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(X, Y, es * (o.mood === 'wow' ? 1.18 : 1), 0, 7); c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    const pu = es * (o.mood === 'wow' ? .62 : .46);
    c.fillStyle = INK; c.beginPath(); c.arc(X + lk.dx * es * .42, Y + lk.dy * es * .42, pu, 0, 7); c.fill();
    if (o.mood === 'sad') { c.fillStyle = col; c.fillRect(X - es - 2, Y - es - 2, es * 2 + 4, es * .95); c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(X - es, Y - es * .05 - s * 3); c.lineTo(X + es, Y - es * .05 + s * 3); c.stroke(); }
  }
  c.restore();
}
function stamp(c, word, x, y, w, h, col, t, tWord, px = 112) {
  if (t < tWord || !word) return;
  const k = 1 + .3 * (1 - P(t, tWord, tWord + .09, E.outC));
  c.save(); c.translate(x + w / 2, y + h / 2); c.scale(k, k); c.fillStyle = col; c.font = fontWord(px); c.textAlign = 'center'; c.textBaseline = 'middle';
  const m = textW(word, px); const sc = Math.min(1, (w - 24) / m); c.scale(sc, sc); c.fillStyle = col; c.font = fontWord(px); c.fillText(word, 0, 6); c.restore();
}
function blockText(c, s, x, y, w, h, bg, ink, px = 92) {
  pRect(c, x, y, w, h, bg);
  if (!s) return;
  c.fillStyle = ink; c.font = fontWord(px); c.textAlign = 'center'; c.textBaseline = 'middle';
  const m = c.measureText(s).width, sc = Math.min(1, (w - 20) / m);
  c.save(); c.translate(x + w / 2, y + h / 2 + 3); c.scale(sc, sc); c.fillText(s, 0, 0); c.restore();
}

function seek(t) {
  const c = ctx;
  const j = Math.floor(t * 12); OX = 3 + Math.round(hash(j) * 2 - 1); OY = -2 + Math.round(hash(j, 5) * 2 - 1);
  const b = ball(t);
  const w = wilts.find(q => t >= q.t0 && t < q.t1);
  const z = track(t, 1, zoomKeys) * ZB, ax = track(t, 340, anchorKeys);
  const cx = lookup(camX, t), cy = lookup(camY, t);
  // 天
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = SKY; c.fillRect(0, 0, 1080, 1920);
  // 远处的色块山，慢慢过
  c.fillStyle = HILL;
  for (let i = -1; i < 9; i++) { const base = Math.floor(cx * .22 / 300) + i, X = base * 300 - cx * .22 + 40, h = 120 + 240 * hash(base, 3); c.fillRect(X, 860 - (cy - BASE) * .12 - h, 190 + 90 * hash(base, 8), h + 500); }
  // 世界
  c.setTransform(z, 0, 0, z, ax - cx * z, SCREEN_Y - cy * z);
  const vx0 = cx - (ax + 40) / z, vx1 = cx + (1120 - ax) / z, vyB = cy + (1960 - SCREEN_Y) / z;
  EL = cx - ax / z; ER = cx + (1080 - ax) / z; ZC = z;
  for (const p of plats) {
    if (p.x > vx1 || p.x + p.w < vx0) continue;
    let topY = p.y;
    if (p.sink != null && t >= p.sink) topY += 10 * Math.sin(Math.PI * clamp((t - p.sink) / .2));
    const door = doors.find(d => Math.abs(d.y - p.y) < 1 && d.x >= p.x - 2 && d.x <= p.x + p.w + 200);
    c.fillStyle = SIDE; c.fillRect(p.x, topY, p.w, vyB - topY);
    c.fillStyle = TOP; c.fillRect(p.x + OX * .6, topY + OY * .6, p.w, 18);
    if (p.word) {
      const by = topY + 14, bh = 134, bw = p.w - 8, bx = p.x + 4, col = p.hero ? HERO : TOP, ink = p.hero ? TOP : INK;
      pRect(c, bx, by, bw, bh, col, null);
      const tw = Math.min(textW(p.word, 112), bw - 24), tc = bx + bw / 2;   // 11-10 复审：台阶块滑出画面时「负5%」露成「5%」；字快被切到就先淡出
      c.globalAlpha = vis(tc - tw / 2, tc + tw / 2); if (c.globalAlpha > 0) stamp(c, p.word, bx, by, bw, bh, ink, t, p.wordT - .02); c.globalAlpha = 1;
    }
    if (p.n && t >= p.sink) { c.fillStyle = BALL; c.font = fontNum(60); c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText(String(p.n), p.x + p.w / 2, topY - 12); }
  }
  // 道具：印在台子立面上（有字带就印在字带下面），说到这个词时从立面里亮出来
  for (const o of props) {
    if (o.x + o.size < vx0 || o.x - o.size > vx1 || t < o.t - .06) continue;
    const pw = o.p && o.p.word ? 134 + 14 : 18, cy0 = o.y + pw + 26 + o.size / 2;
    if (t > o.off + .25) continue;                       // 这句说完就收起，不和下一句的词并排
    const k = P(t, o.t - .06, o.t + .16, E.outB) * (1 - P(t, o.off, o.off + .25, E.inC));
    c.save(); c.translate(o.x, cy0); c.scale(k, k);
    drawIcon(c, o.icon, OX * .6, OY * .6, o.size, GOLD2, 2.6);
    c.restore();
  }
  // 活板门和门后的一块台子
  for (const d of doors) {
    if (d.x > vx1 + 400 || d.x + d.w + d.slab < vx0) continue;
    const a = P(t, d.t, d.t + .1, E.inQ) * 1.45;
    if (t < d.t) {
      c.fillStyle = SIDE; c.fillRect(d.x, d.y, d.w, d.low - d.y); c.fillStyle = TOP; c.fillRect(d.x + OX * .6, d.y + OY * .6, d.w, 18);
      if (t > d.t - .12) { c.fillStyle = SIDE; c.fillRect(d.x + d.w - 5, d.y, 8, 18); c.fillRect(d.x - 3, d.y, 8, 18); }
    } else {
      c.fillStyle = SHAFT; c.fillRect(d.x, d.y, d.w + d.slab, d.low - d.y);
      c.save(); c.translate(d.x, d.y); c.rotate(a); c.fillStyle = TOP; c.fillRect(0, 0, d.w, 18); c.fillStyle = SIDE; c.fillRect(0, 18, d.w, 16); c.restore();
    }
    c.fillStyle = SIDE; c.fillRect(d.x + d.w, d.y, d.slab, 46); c.fillStyle = TOP; c.fillRect(d.x + d.w + OX * .6, d.y + OY * .6, d.slab, 18);
    if (t >= d.t) { c.fillStyle = SKY; c.fillRect(d.x + d.w + d.slab, d.y - 40, 2, 2); }
  }
  // 带子
  for (const s of strips) {
    if (t < s.tLo - .25) continue;
    const welded = s.weld ? P(t, s.weld.t0, s.weld.t, E.ioC) : 0;
    if (s.weld && t >= s.weld.t) continue;
    const hh = lerp(34, 120, welded);
    const ballAtCell = q => { // 第 q 格被碾过的时刻
      const f = q / s.N;
      if (f <= s.loF) return s.tLo + s.r1 * inv(f / s.loF);
      return s.tHi + s.r2 * inv((f - s.loF) / (1 - s.loF));
    };
    const shown = Math.min(s.N, Math.ceil((t - s.tLo + .25) / .36 * s.N * s.loF * 1.1) + (t > s.tHi - .2 ? s.N : 0));
    for (let q = 0; q < shown; q++) {
      const X = s.x + q * s.cw, hit = t >= ballAtCell(q);
      c.fillStyle = hit ? (q / s.N <= s.loF ? GOLD : GOLD2) : TOP;
      if (welded > 0) c.fillStyle = mix(c.fillStyle, HERO, welded);
      const gapx = Math.max(0, 3 * (1 - welded));
      c.fillRect(X, s.y - hh + (welded ? hh - 34 - (hh - 34) : 0), s.cw - gapx, hh);
    }
  }
  // 长块
  for (const l of longs) {
    if (t < l.t0 - .02) continue;
    if (l.t1 < 9e8 && t > l.t1 + 2.5) continue;
    drawLong(c, l, t, z, vx0, vx1, b);
  }
  // 吊牌（人物词也走这里，球不踩）
  for (const s of signs) {
    if (t < s.t0 || t > s.tEnd) continue;
    const fall = 1 - P(t, s.t0, s.t, E.inQ), up = P(t, s.tUp, s.tEnd, E.inC);
    const sw = Math.max(textW(s.word, 92) + 80, 300), sh = 140;
    const bt = Math.max(s.bottom, cy + (70 - SCREEN_Y) / z + sh) - 900 * fall - 900 * up;   // 兜底：挂好时牌子上沿离画面顶至少 70 像素
    const xL = cx + (30 - ax) / z + sw / 2, xR = cx + (1050 - ax) / z - sw / 2, sx = xL <= xR ? clamp(s.x, xL, xR) : s.x;   // 左右也不出画
    c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(sx - sw * .32, bt - sh); c.lineTo(sx - sw * .32, bt - sh - 900); c.moveTo(sx + sw * .32, bt - sh); c.lineTo(sx + sw * .32, bt - sh - 900); c.stroke();
    blockText(c, t >= s.t ? s.word : '', sx - sw / 2, bt - sh, sw, sh, GOLD, INK);
  }
  // 飞的东西
  for (const f of flyers) drawFlyer(c, f, t, b);
  // 长块上落下来的词
  for (const g of tags) {
    if (t < g.t || (FALL && t > FALL.t)) continue;
    const m = textW(g.word, 74);
    c.globalAlpha = vis(g.x - m / 2 - 20, g.x + m / 2 + 20); if (c.globalAlpha > 0) blockText(c, g.word, g.x - m / 2 - 20, g.y - 96 + 0, m + 40, 96, TOP, INK, 74); c.globalAlpha = 1;   // 11-10 复审：同台阶块
  }
  // 一群
  for (const k of crowds) drawCrowd(c, k, t);
  // 主角球
  let sx = 1, sy = 1;
  const ld = lastBefore(lands, t);
  if (ld && t - ld.t < .16) { const p = 1 - (t - ld.t) / .16; sy = 1 - .32 * ld.k * p; sx = 1 + .26 * ld.k * p; }
  else if (b.ty === 'fly' || b.ty === 'fall') { const v = Math.abs(b.vy); sy = 1 + .12 * v; sx = 1 - .08 * v; }
  if (b.ty === 'wait') { sy *= .85; sx *= 1.08; }
  let mood = null, look = { dx: b.vx ? 1 : .4, dy: b.vy > .3 ? -.4 : b.vy < -.3 ? .6 : 0 };
  for (const m of moods) if (t >= m.t0 && t < m.t1) {
    if (m.kind === 'look') look = { dx: m.dx, dy: m.dy };
    else if (m.kind === 'shake') look = { dx: Math.sin(t * 14), dy: 0 };
    else mood = m.kind;
  }
  if (w) { sy *= lerp(1, .72, P(t, w.t0, w.t0 + .15)); sx *= lerp(1, 1.1, P(t, w.t0, w.t0 + .15)); mood = 'sad'; look = { dx: .2, dy: 1 }; }
  const blink = (t % 2.4) < .09 && b.ty !== 'fly';
  drawBall(c, b.x, b.y, sx, sy, { look, mood, blink, col: w ? '#D9B236' : BALL, dk: w ? '#BE9426' : BALLD });
  // 碎块
  for (const u of bursts) for (let i = 0; i < u.n; i++) {
    const d = t - u.t; if (d < 0 || d > .55) continue;
    const a = -2.7 + 2.3 * (i + .5) / u.n + (hash(i, u.t) - .5) * .3, v = 420 + 380 * hash(i, u.t, 2);
    const X = u.x + Math.cos(a) * v * d, Y = u.y + Math.sin(a) * v * d + .5 * 2400 * d * d;
    if (Y > u.y + 10) continue;
    c.fillStyle = i % 2 ? TOP : BALLD; c.fillRect(X - 9, Y - 9, 18, 18);
  }
  // 屏幕上不动的：数字
  c.setTransform(1, 0, 0, 1, 0, 0);
  for (const s of strips) drawCount(c, s, t);
  for (const a of STATS) drawStat(c, a, t);
  for (const a of A) if (a.k === 'question' && t >= a.t && t < Math.max(a.t1, a.t + .6)) {
    const by = b.y + (BASE - cy) * 1 - 340 + Math.sin(t * 7) * 12;
    blockText(c, '？', 340 - 60, by, 120, 120, BALL, INK, 92);
  }
  if (w) { c.fillStyle = 'rgba(6,20,30,.14)'; c.fillRect(0, 0, 1080, 1340); }
  // 字幕落在深色上
  c.fillStyle = SIDE; c.fillRect(0, 1340, 1080, 580);
  c.drawImage(tile, 0, 0, 1080, 1920);
  updSubs(t);
}
window.seek = seek;

const inv = x => 1 - Math.cbrt(1 - clamp(x));     // E.outC 的反函数
function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const f = s => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, k));
  return `rgb(${f(16)},${f(8)},${f(0)})`;
}
const lastBefore = (arr, t) => { let r = null; for (const a of arr) { if (a.t <= t && (!r || a.t > r.t)) r = a; } return r; };

function drawLong(c, l, t, z, vx0, vx1, b) {
  const th = 174 / z;
  let right = Math.max(b.x + 300, l.fromStrip ? l.fromStrip.x + l.fromStrip.W + 40 : b.x + 300);
  if (l.grow != null) right += P(t, l.grow, l.grow + .5, E.inQ) * 2400;
  if (FALL && FALL.l === l) right = Math.max(right, FALL.x + 900);
  const heroCol = l.hero ? HERO : TOP, ink = l.hero ? TOP : INK;
  const lowFloor = () => {
    c.fillStyle = SIDE; const fy = l.y + 320;
    c.fillRect(vx0 - 200, fy + 26, vx1 - vx0 + 400, 2000); c.fillStyle = TOP; c.fillRect(vx0 - 200, fy + OY * .6 + 26 - 18, vx1 - vx0 + 400, 18);
  };
  if (FALL && FALL.l === l) {
    // 地面一直在下面；到了那一刻块断开
    c.fillStyle = SKY; c.fillRect(vx0 - 200, l.y + th, vx1 - vx0 + 400, 320 - th + 10);
    lowFloor();
    const u = P(t, FALL.t, FALL.t + .32, E.inC), sag = P(t, FALL.t - .24, FALL.t, E.ioC) * 22;
    const brk = FALL.x, L = FALL.slab, ang = u * Math.atan2(320 + 26 - th * .2, L);
    // 左半截：绕远端转下去，正好插地
    c.save(); c.translate(brk - L, l.y); c.rotate(ang); c.translate(0, sag * .5);
    pRect(c, -2200, 0, 2200 + L, th, heroCol, null);
    repeatWord(c, l, t, -2200, L, th, ink, z, true);
    c.restore();
    // 右半截：掉下去
    const d = Math.max(0, t - FALL.t), yy = .5 * GRAV * d * d;
    if (yy < 700) {
      c.save(); c.translate(brk, l.y + sag + yy); c.rotate(-u * .32); c.fillStyle = heroCol; c.fillRect(OX, OY, right - brk, th); c.restore();
    }
    // 断口之外的地面放到最上面
    return;
  }
  c.fillStyle = SKY; c.fillRect(l.x, l.y + th, right - l.x, 330);
  c.fillStyle = SIDE; c.fillRect(l.x - 40, l.y + 320, right - l.x + 80, 2000);
  c.fillStyle = heroCol; c.fillRect(l.x + OX, l.y + OY, right - l.x, th);
  repeatWord(c, l, t, l.x, right, th, ink, z, false);
}
function repeatWord(c, l, t, x0, x1, th, ink, z, local) {
  if (t < l.charT || !l.word) return;
  const sp = 760 / z, px = 146 / z, chars = [...l.word];
  // 字贴着世界，不跟镜头；先出现的是球脚下那一个
  const base = local ? ((Math.floor((FALL.x - FALL.slab + 0) / sp)) * sp - (FALL.x - FALL.slab)) : 0;
  const start = Math.floor(x0 / sp) * sp;
  c.fillStyle = ink; c.font = fontWord(px); c.textAlign = 'left'; c.textBaseline = 'middle';
  const k = 1 + .3 * (1 - P(t, l.charT, l.charT + .09, E.outC));
  for (let X = start + (local ? base : 0); X < x1; X += sp) {
    if (X + textW(l.word, px) < x0) continue;
    if (!local) { c.globalAlpha = vis(X, X + textW(l.word, px)); if (!(c.globalAlpha > 0)) { c.globalAlpha = 1; continue; } }   // 11-10 复审：被画面边切到的先淡出
    let dx = 0;
    chars.forEach((ch, i) => {
      if (t >= l.charT + i * .12) { c.save(); c.translate(X + dx, th / 2 + (local ? 0 : l.y) + 4); c.scale(k, k); c.fillText(ch, 0, 0); c.restore(); }
      c.font = fontWord(px); dx += c.measureText(ch).width;
    });
    c.globalAlpha = 1;
  }
}
function drawFlyer(c, f, t, b) {
  if (f.kind === 'push') {
    if (t < f.t0 || t > f.t1 + .6) return;
    const rise = P(t, f.t0, f.t0 + .12, E.outC), bw = Math.max(textW(f.word || '', 92) + 60, 180), bh = 130;
    const hit = f.t + .07, slide = t > hit ? Math.pow((t - hit) / Math.max(f.t1 - hit, .15), 2) * 1500 : 0;
    blockText(c, f.word, f.x + slide, f.y - bh * rise, bw, bh * rise, TOP, INK);
  } else if (f.kind === 'back') {
    if (t < f.t - .18) return;
    const u = P(t, f.t - .18, f.t, E.inQ), bw = 170, bh = 130, X = lerp(f.x + 1000, f.x + 70, u);
    if (t > f.t + 1) return;
    blockText(c, f.word, X, f.y - bh, bw, bh, GOLD, INK);
  } else if (f.kind === 'flip') {
    if (t < f.t0) return;
    const bw = Math.max(textW(f.word, 92) + 60, 180), bh = 130, fall = 1 - P(t, f.t0, f.t, E.inQ);
    if (f.person || t < f.tB) { blockText(c, t >= f.t ? f.word : '', f.x, f.y - bh - 900 * fall, bw, bh, TOP, INK); return; }
    const d = t - f.tB;
    if (d > 1.1) return;
    c.save(); c.translate(f.x + bw / 2 + 1100 * d, f.y - bh / 2 - 900 * d + 1100 * d * d); c.rotate(d * 9.4); blockText(c, f.word, -bw / 2, -bh / 2, bw, bh, TOP, INK); c.restore();
    if (f.B) { const u = P(t, f.tB, f.tB + .2, E.inQ); blockText(c, f.B, f.x, f.y - bh - 900 * (1 - u), Math.max(textW(f.B, 92) + 60, 180), bh, TOP, INK); }
  }
}
function groundAt(x, t) {
  let g = null;
  for (const p of plats) if (x >= p.x && x <= p.x + p.w) g = p.y;
  for (const l of longs) if (t >= l.t0 && x >= l.x) g = l.y;
  return g;
}
function drawCrowd(c, k, t) {
  if (t < k.t0) return;
  const d = .06 + k.k * .04;
  const tt = Math.min(t, k.until), bb = ball(Math.max(tt - d, k.t0 - .3));
  const x = bb.x - k.off;
  let gy = groundAt(x, tt); if (gy == null) gy = bb.ground;
  let y = gy - .6 * (bb.ground - bb.y);
  if (t > k.until) y = gy - Math.abs(Math.sin((t + k.k * .04) * 9)) * 34;
  const inT = (t - k.t0) / .22; if (inT < 1) y = gy - 900 * (1 - inT) * (1 - inT);
  let sx = 1, sy = 1;
  if (FALL && t > FALL.t + k.k * .05) {
    const e = t - FALL.t - k.k * .05, drop = Math.min(.5 * 3000 * e * e, 346);
    y = gy + drop; sx = drop >= 346 ? 1.1 : 1; sy = drop >= 346 ? .9 : 1;
  }
  if (inT >= 1 && inT < 1.7) { sy = .82; sx = 1.14; }
  drawBall(c, x, y, sx, sy, { r: k.r, col: CROWD, dk: CROWDD, small: true, look: { dx: FALL && t > FALL.t ? 0 : 1, dy: FALL && t > FALL.t - .5 ? 1 : 0 } });
}
function drawCount(c, s, t) {
  if (s.noNum || t < s.tLo || t > s.t1 + .35) return;   // 修改页删了这个数：带子照走，不画数
  const up = P(t, s.t1, s.t1 + .3, E.inQ) * 420;
  const k1 = clamp((t - s.tLo) / s.r1), k2 = clamp((t - s.tHi) / s.r2);
  const v = t < s.tLo + s.r1 ? lerp(0, s.lo, E.outC(k1)) : t < s.tHi ? s.lo : lerp(s.lo, s.hi, E.outC(k2));
  const hiNow = t >= s.tHi, rw = hiNow ? s.rawHi : s.rawLo;                              // 停住时照抄字幕原文：先是前半「1.5」，再是后半「2.5倍」
  const num = rollNum(v, rw, hiNow ? k2 >= 1 : t >= s.tLo + s.r1);
  // 11-09 第三轮抽帧：落定只剩后半「5倍」，大字把「3到5倍」说成了 5 倍。后半一出来，前面照抄字幕原文的前半和「到」，落定读「3到5倍」；放不下 1000 像素就整体缩小
  const pre = hiNow && s.conn ? s.rawLo : '', cn = pre ? s.conn : '';
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  const u = rawUnit(rw), mw = (sz, x) => { c.font = fontNum(sz); return x ? c.measureText(x).width : 0; };
  const f = Math.min(1, 1000 / (mw(120, pre) + mw(90, cn) + (pre ? 24 : 0) + mw(200, num) + mw(90, u) + 16));
  const pw = mw(120 * f, pre), cnw = mw(90 * f, cn), w = mw(200 * f, num), uw = mw(90 * f, u), g = pre ? 12 * f : 0;
  const X0 = 540 - (pw + cnw + 2 * g + w + uw + 16 * f) / 2, X = X0 + pw + cnw + 2 * g, Y = 470 - up;
  c.lineJoin = 'round'; c.strokeStyle = INK;   // 11-10 复审：描深色边，同 drawStat
  if (pre) { c.font = fontNum(120 * f); c.fillStyle = INK; c.fillText(pre, X0 + 4, Y + 4); c.lineWidth = 10 * f; c.strokeText(pre, X0, Y); c.fillStyle = GOLD; c.fillText(pre, X0, Y); c.font = fontNum(90 * f); c.lineWidth = 8 * f; c.strokeText(cn, X0 + pw + g, Y); c.fillStyle = TOP; c.fillText(cn, X0 + pw + g, Y); }
  c.font = fontNum(200 * f); c.fillStyle = INK; c.fillText(num, X + 5, Y + 5); c.lineWidth = 12 * f; c.strokeText(num, X, Y); c.fillStyle = t >= s.tHi ? GOLD2 : GOLD; c.fillText(num, X, Y);
  if (u && (hiNow || t >= s.tLo + s.r1)) { c.font = fontNum(90 * f); c.lineWidth = 8 * f; c.strokeText(u, X + w + 16 * f, Y); c.fillStyle = TOP; c.fillText(u, X + w + 16 * f, Y); }
}
function drawStat(c, a, t) {
  if (t < a.t || t > a.t1 + .5) return;
  const k = P(t, a.t, a.t + .4, E.lin), v = lerp(0, a.value, E.outC(k)), up = P(t, a.t1 + .2, a.t1 + .5, E.inQ) * 420;
  const num = rollNum(v, a.raw, k >= 1), suf = rawUnit(a.raw);                          // 停住时照抄字幕原文
  c.font = fontNum(180); c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  const w = c.measureText(num).width; c.font = fontNum(80); const uw = c.measureText(suf).width;
  const X = Math.max(40, 540 - (w + uw + 14) / 2), Y = 460 - up;
  c.lineJoin = 'round'; c.strokeStyle = INK;   // 11-10 复审：描一圈深色边。小球也是黄的，跳到数后面时「12.5%」的「1」看不出来，像「2.5%」
  c.font = fontNum(180); c.fillStyle = INK; c.fillText(num, X + 5, Y + 5); c.lineWidth = 12; c.strokeText(num, X, Y); c.fillStyle = GOLD; c.fillText(num, X, Y);
  c.font = fontNum(80); c.lineWidth = 8; c.strokeText(suf, X + w + 14, Y); c.fillStyle = TOP; c.fillText(suf, X + w + 14, Y);
}

// 启动：字体到齐 → 搭场景 → 第 0 帧 → 告诉渲染器可以截了
startStage(['200px Glow', [...new Set(EV.groups.map(g => g.text).join('') + '？0123456789')].join('')], ['800 62px Noto', EV.lines.map(l => l.text).join('').slice(0, 200)], ['900 120px Noto', '0123456789']);
