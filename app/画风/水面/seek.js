// 画风「水面」（方向案2 第五节）：竖屏被一条水线分成上下两半，水上是大家以为的，水下是实际发生的。
// 2026-11-07：第一关两轮过美术总监（第 2 轮过：碎光路收成一盏灯、删焦散、光柱软边、横纹压暗、浮子减量；过关那版存在 考卷\输出\第4步_水面第一关\），这里写整段。
// 只读剧本（window.JUBEN → jubenEv），全部由句型、极性、事件时刻算出，没有任何一段录音的秒数和词。
// 世界坐标：y 向下，水面 y=0。镜头 C = 画面顶边的世界 y，水面在屏幕 y = −C。三档：半水 C=−760，水下 C=−230，深处 C>0。
document.getElementById('frame').innerHTML = '<canvas id="c" width="1080" height="1920"></canvas><div id="view"></div><div id="subs"></div>';
const EV = jubenEv(window.JUBEN);
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const SKY = '#05070B', FAR = '#0A1418', NEAR = '#0E2228', DEEP = '#061016', DEEPEST = '#03070A', GOLD = '#E8B84B', INK = '#F2EFE6', DARKGOLD = '#8A6A2E';
const HALF = -760, UNDER = -230, BREACH = -1040;
const LN = EV.lines, G = EV.groups, A = EV.acts, DUR = EV.dur;
const wave0 = (x, t) => 10 * Math.sin(.011 * x + 1.1 * t) + 5 * Math.sin(.027 * x - 1.7 * t);
const under = document.createElement('canvas'); under.width = 1080; under.height = 1920; const U = under.getContext('2d');
const RATE = 60;                                   // 需要「跟随、带惯性」的量按 60 帧/秒预先算好，画面仍是 t 的纯函数
let tile = null;
const glints = [], floats = [], motes = [];
const camK = [], ampK = [], stillK = [], words = [], nums = [], buoys = [];
let crowdT = null, END = null, FINAL = null, heroObj = null;
const heroY = [], C_ARR = [];

const fsize = s => Math.min(200, 600 / Math.max([...s].length, 1));
const camAt = t => C_ARR[clamp(Math.round(t * RATE), 0, C_ARR.length - 1)];
const dent = (x, t) => END && END.kind === 'fall' ? 560 * Math.exp(-(((x - 470) / 260) ** 2)) * P(t, END.t, END.t + .36, E.inQ) * (1 - .55 * P(t, END.t + .5, END.t + 1.6, E.outC)) : 0;
const still = t => track(t, 1, stillK);
const wave = (x, t) => wave0(x, t) * still(t) + dent(x, t);
const dx = (y, t) => { const A0 = track(t, 5, ampK); return A0 * Math.sin(.032 * y + 2.1 * t) + .4 * A0 * Math.sin(.071 * y - 1.3 * t); };

function build() {
  // ---------- 镜头：按事件排出 C 的关键帧（只在档位真变时动）
  let C = HALF, since = 0;
  const go = (t, d, to) => { if (Math.abs(to - C) < 1 || t < 0) return; camK.push([t, d, to]); C = to; since = t; };
  const kick = t => ampK.push([t, .05, 14], [t + .05, .4, 5]);
  const evs = [];
  LN.forEach(l => evs.push({ t: l.t0, k: 'line', l }));
  for (const a of A) {
    if (a.k === 'trap') evs.push({ t: a.t, k: 'trap', a });
    if (a.k === 'range') evs.push({ t: a.tLo, k: 'range', a });
    if (a.k === 'stat') evs.push({ t: a.t, k: 'stat', a });
    if (a.k === 'question') evs.push({ t: a.t, k: 'question', a });
    if (a.k === 'compare') evs.push({ t: a.tL - .45, k: 'compare', a });
    if (a.k === 'cta') evs.push({ t: a.t, k: 'cta', a });
  }
  if (EV.define) evs.push({ t: LN[EV.define.line].t0, k: 'define' });
  evs.sort((p, q) => p.t - q.t);
  let lastNum = -9;
  for (const e of evs) {
    const t = e.t;
    if (e.k === 'line') {
      if (C > 0 && t - lastNum > 2.0) go(t, .6, UNDER);                                   // 深处待久了，快速上升回水下
      else if (t - since > 10 && (C === HALF || C === UNDER)) go(t, .45, C === HALF ? UNDER : HALF); // 同一档超 10 秒，强制换档
    } else if (e.k === 'trap') {
      if (C === HALF) { camK.push([Math.max(t - .3, since), .25, HALF - 50]); C = HALF - 50; }
      go(t, .3, UNDER); kick(t);
    } else if (e.k === 'range' || e.k === 'stat') {
      const a = e.a, total = e.k === 'range' ? a.hi : a.value;
      if (!(total > 0) || !(e.k === 'range' ? a.rawLo && a.rawHi : a.raw)) continue;      // 11-09 第三轮：抄不准字幕原文的数不画
      if (C < UNDER) { go(t - .3, .3, UNDER); kick(t - .3); }
      const base = Math.max(C, UNDER), depth = clamp(total * 12.5, 260, 1500);
      if (e.k === 'range') { go(a.tLo, .36, base + depth * a.lo / a.hi); go(a.tHi, .36, base + depth); }
      else go(a.t, .4, base + depth);
      nums.push({ t0: e.k === 'range' ? a.tLo : a.t, tHi: e.k === 'range' ? a.tHi : a.t, lo: e.k === 'range' ? a.lo : 0, hi: total, unit: (e.k === 'range' ? a.unit : a.suffix) || '', t1: a.t1 || t + 1.2, base, depth, rawLo: e.k === 'range' ? a.rawLo : null, rawHi: e.k === 'range' ? a.rawHi : a.raw });
      lastNum = a.t1 || t + 1.2;
    } else if (e.k === 'question') {
      go(t, .4, HALF); stillK.push([t, .3, .15], [e.a.t1 || t + 1, .4, 1]);
    } else if (e.k === 'compare') {
      go(e.a.tL - .45, .4, HALF + 60);                                                   // 先浮到半水，对比词破水时水面已经在画面里
      if (e.a.rneg) { go(e.a.tR0, .3, UNDER); kick(e.a.tR0); }
    } else if (e.k === 'define') {
      if (C < UNDER) { go(t, .35, UNDER); kick(t); }
    } else if (e.k === 'cta' && t < DUR - 2.5) {
      go(t, .45, HALF);
    }
  }
  // ---------- 结尾：最后两句都往下、没有人物词 → 水面被拖下去；其余 → 破水而出
  const last2 = LN.slice(-2), fall = last2.length > 0 && last2.every(l => l.pol < 0) && !last2.some(l => l.person);
  if (fall) {
    const t = EV.end && EV.end.t != null ? EV.end.t : LN[LN.length - 1].t0;
    if (C < UNDER) go(t - .5, .4, UNDER);
    END = { kind: 'fall', t }; camK.push([t, .36, C + 350]); C += 350; kick(t);
  } else {
    const t = Math.max((EV.end && EV.end.t != null ? EV.end.t : DUR - 1) - .4, since + .2);
    END = { kind: 'breach', t }; camK.push([t, .6, BREACH]); C = BREACH;
  }
  camK.sort((p, q) => p[0] - q[0]);
  const n = Math.ceil((DUR + 1) * RATE);
  for (let i = 0; i <= n; i++) C_ARR.push(track(i / RATE, HALF, camK, E.ioS));

  // ---------- 东西：上屏词按极性浮 / 沉 / 被水流带过；数字、对比、翻转、清单、年份各有自己的
  const busy = new Set();
  for (const a of A) if (['range', 'stat', 'compare', 'flip', 'listitem', 'pairitem', 'year'].includes(a.k)) { busy.add(a.line); if (a.lineB != null) busy.add(a.lineB); if (a.lineR != null) busy.add(a.lineR); }
  const slots = [300, 760, 470, 620, 360]; let si = 0;
  const add = o => { words.push(o); return o; };
  for (const g of G) {
    const l = LN[g.line]; if (!g.word || !l.word || l.wp || busy.has(g.line) || l.word === EV.hero) continue;
    const kind = l.person ? 'float' : l.pol > 0 ? 'rise' : l.pol < 0 ? 'sink' : 'drift';
    add({ text: l.word, t0: g.t0, kind, x: slots[si++ % slots.length], person: l.person });
  }
  for (const a of A) {
    if (a.k === 'compare' && !a.person) {
      if (a.L) add({ text: a.L, t0: a.tL, kind: 'above', x: 470, gold: true });
      if (a.R && !a.rneg) add({ text: a.R, t0: a.tR, kind: 'below', x: 470 });
    }
    if (a.k === 'flip') {
      if (a.A) add({ text: a.A, t0: a.tA, kind: 'mid', x: 330, washAt: a.person ? null : a.tB });      // 翻转：A 在水中，tB 被水流冲走
      if (a.B && a.B !== EV.hero) add({ text: a.B, t0: a.tB + .1, kind: 'mid', x: 560 });               // B 浮到中央
    }
    if (a.k === 'listitem' || a.k === 'pairitem') {
      const k = (a.n || 1) - 1, per = a.k === 'pairitem' ? 2 : 4;
      if (k < per && a.word) add({ text: a.word.slice(0, 6), t0: a.t, kind: 'item', x: per === 2 ? [300, 780][k] : 150 + 260 * k, small: true, n: a.k === 'listitem' ? a.n : null });
    }
    if (a.k === 'year') buoys.push({ t: a.t, year: String(a.year), x: 180 + 240 * (buoys.length % 4) });
  }
  // 主角词：从更深处游上来，之后一直在水下，跟着镜头慢慢走
  const hg = EV.hero ? G.find(g => g.word && LN[g.line].word === EV.hero) : null;
  const ht = EV.define ? EV.define.t : hg ? hg.t0 : null;
  if (EV.hero && ht != null) heroObj = { text: EV.hero, t0: ht };
  // 一个词最多留到后面第 4 个词出来，再被水流带走：上一句留到下一句
  const order = words.filter(w => w.kind !== 'item').sort((p, q) => p.t0 - q.t0);
  order.forEach((w, i) => { if (w.washAt != null) return; const nx = order[i + 2]; w.washAt = Math.min(nx ? nx.t0 : 1e9, w.t0 + 6); if (w.washAt > DUR) w.washAt = null; });
  words.filter(w => w.kind === 'item').forEach(w => { const nx = order.find(q => q.t0 > w.t0 + 2); w.washAt = nx ? nx.t0 : null; });
  // 水上的词在「其实不是」那一刻沉（人物句只潜不沉）
  for (const a of A) if (a.k === 'trap' && !a.person) for (const w of words) if ((w.kind === 'rise' || w.kind === 'above') && w.t0 < a.t && (w.washAt == null || w.washAt > a.t) && w.sinkAt == null) w.sinkAt = a.t + .06;
  // 结尾被拖下去：还在的东西一个接一个滑进凹陷
  if (END.kind === 'fall') words.filter(w => w.t0 < END.t && (w.washAt == null || w.washAt > END.t)).forEach((w, i) => { if (w.sinkAt == null || w.sinkAt > END.t) { w.sinkAt = END.t + .1 + i * .08; w.dragged = true; } });
  for (const w of words) if (w.kind === 'above') { const k = camK.find(q => q[0] > w.t0 && q[2] >= UNDER); if (k) w.settleAt = k[0]; }
  FINAL = END.kind === 'breach' ? (EV.end && EV.end.word) || (order.length ? order[order.length - 1].text : '') : null;
  if (FINAL && FINAL === EV.hero) FINAL = null;
  // 很多 X：浮子冒出来（人物词不放）
  const cr = (EV.crowds || []).find(c => !c.person); if (cr) crowdT = cr.t;
  // 主角词跟随（带惯性）
  if (heroObj) {
    let y = null;
    for (let i = 0; i <= n; i++) {
      const t = i / RATE, Cc = C_ARR[i], half = Cc < -500, fallen = END.kind === 'fall' && t >= END.t;
      let target = Cc + (half ? 1120 : 820);
      if (fallen) target = Cc + 1010;
      if (y == null || t < heroObj.t0) y = Cc + 860;
      else y += (target - y) * (1 - Math.exp(-1 / RATE / (fallen ? .08 : .45)));
      heroY.push(y);
    }
  }
}

// 一个词在时刻 t 的世界位置：{x, y, a(不透明), size}
function wpos(w, t) {
  if (t < w.t0 - .35) return null;
  let x = w.x, y = 0, a = 1;
  const k = P(t, w.t0, w.t0 + .3, E.outC);
  if (w.kind === 'rise' || w.kind === 'float' || w.kind === 'item') {
    const C0 = camAt(w.t0), deep = C0 > -500;                                    // 镜头在水下：从画面中间慢慢浮上去，读得到再变黑影
    const kk = deep ? P(t, w.t0, w.t0 + 1.4, E.ioC) : k;
    y = lerp(deep ? C0 + 700 : 260, -40, kk) + 4 * Math.sin(t * 1.1 + x); a = t >= w.t0 ? 1 : 0;
  }
  else if (w.kind === 'mid') { const C0 = camAt(w.t0); y = C0 + lerp(800, C0 < -500 ? 1050 : 470, k); a = P(t, w.t0, w.t0 + .2); }
  else if (w.kind === 'above') { y = lerp(80, -260, E.outB(clamp((t - w.t0) / .35))); a = P(t, w.t0, w.t0 + .08); if (w.settleAt != null) y = lerp(y, -40, P(t, w.settleAt, w.settleAt + .35, E.ioC)); }
  else if (w.kind === 'below') { y = 330; a = P(t, w.t0, w.t0 + .3); }
  else if (w.kind === 'sink') { const tin = w.t0; y = t < tin ? lerp(-700, 160, P(t, tin - .18, tin, E.inQ)) : 160 + 140 * (t - tin) / (1 + .6 * (t - tin)) + 45 * (t - tin); }   // 落水后沉在浮着的词下面一层
  else if (w.kind === 'drift') { const Cc = camAt(w.t0); y = Cc < -500 ? -30 : Cc + 600; x = lerp(-260, w.x, E.outC(clamp((t - w.t0 + .35) / .6))); }
  if (w.sinkAt != null && t >= w.sinkAt) {
    const u = t - w.sinkAt;
    if (w.dragged) { x = lerp(x, 470, P(t, w.sinkAt, w.sinkAt + .4)); y += 2400 * u * u + 40 * u; }
    else y += 150 * u / (1 + .5 * u) + 30 * u;
  }
  if (w.washAt != null && t >= w.washAt) { const u = P(t, w.washAt, w.washAt + .3, E.inQ); x = lerp(x, 1500, u); if (u >= 1) return null; }
  const size = w.small ? Math.min(120, 600 / Math.max([...w.text].length, 1)) : fsize(w.text), hw = size * [...w.text].length / 2;
  if (w.washAt == null || t < w.washAt) x = clamp(x, hw + 50, 1030 - hw);        // 整个词留在画面里
  return { x, y, a, size };
}

window.boot = () => {
  tile = noiseTile(8);
  for (let i = 0; i < 60; i++) glints.push({ p: Math.pow(hash(i, 1), .7), r: hash(i, 2) - .5, ph: hash(i, 3) * 6.28, f: 1 + 2 * hash(i, 4) });
  for (let i = 0; i < 24; i++) floats.push({ x: 40 + 1000 * hash(i, 11), p: .35 + .65 * hash(i, 12), d: hash(i, 13) * .2 });
  for (let i = 0; i < 40; i++) motes.push({ x: 1080 * hash(i, 21), y: 1920 * hash(i, 22), r: 1.5 + 2.5 * hash(i, 23) });
  build();
  setupSubs({ top: 1400, height: 170, color: INK, gold: GOLD, stroke: '6px #03070A' });
};

function drawWord(c, text, x, sy, size, col, alpha, clipTop, clipBot, s = 1, rot = 0) {
  if (alpha <= .01 || sy < -400 || sy > 2300 || clipBot <= clipTop) return;
  c.save(); c.beginPath(); c.rect(-50, clipTop, 1180, clipBot - clipTop); c.clip();
  c.globalAlpha = alpha; c.fillStyle = col; c.font = `${size}px Glow`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.translate(x, sy); if (rot) c.rotate(rot); c.scale(s, s); c.fillText(text, 0, 0); c.restore();
}

function seek(t) {
  const c = ctx, Cc = camAt(t), wl = -Cc;            // 水面在屏幕上的 y（不算波）
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  const fallen = END.kind === 'fall' && t > END.t;
  // ================= 水下（离屏画，再逐行横移）
  let g = U.createLinearGradient(0, 0, 0, 1920);
  for (let i = 0; i <= 4; i++) { const d = clamp((i * 480 + Cc) / 1800); g.addColorStop(i / 4, d < .15 ? NEAR : d < .5 ? DEEP : DEEPEST); }
  U.fillStyle = g; U.fillRect(0, 0, 1080, 1920);
  const light = clamp(1 - Math.max(Cc, 0) / 1400) * (1 - .5 * (fallen ? P(t, END.t, END.t + 1) : 0));
  // 光柱：灯在水面上方，从它正下方斜下来；横向软边、往下渐隐，三层错开
  for (const off of [-40, 0, 40]) {
    const sw = 8 * Math.sin(t * .7 + off);
    for (let y = Math.max(wl, 0); y < 1700; y += 8) {
      const k = clamp((y - wl) / 940), al = .03 * (1 - k) * light;
      if (al <= .001) break;
      const x0 = 380 + off + sw + 60 * k, x1 = 560 + off + sw + 260 * k, hg = U.createLinearGradient(x0, 0, x1, 0);
      hg.addColorStop(0, 'rgba(232,217,168,0)'); hg.addColorStop(.45, `rgba(232,217,168,${al})`); hg.addColorStop(1, 'rgba(232,217,168,0)');
      U.fillStyle = hg; U.fillRect(x0, y, x1 - x0, 8);
    }
  }
  // 水面底下的亮带
  if (wl > -60 && wl < 1980) for (let x = 0; x < 1080; x += 6) {
    const y = wl + wave(x, t) * .6, h = 18 + 10 * Math.sin(.02 * x + 2 * t);
    const a = (.32 + .18 * Math.sin(.05 * x - 3 * t) * Math.sin(.013 * x + t)) * (fallen ? .6 : 1);
    U.fillStyle = `rgba(232,217,168,${a})`; U.fillRect(x, y, 6, h);
  }
  // 浮子在水面下的底
  const fl = crowdT != null && t >= crowdT - .1;
  if (fl) {
    U.fillStyle = 'rgba(3,7,10,.85)';
    floats.forEach((f, i) => {
      const k = P(t, crowdT + i * .009, crowdT + i * .009 + .3, E.outC); if (k <= 0) return;
      let fy = wl + wave(f.x, t) * .6 + 6 + (1 - k) * 80, fx = f.x;
      if (fallen && t > END.t + f.d) { const u = t - END.t - f.d; fx = lerp(f.x, 470, P(t, END.t + f.d, END.t + f.d + .5)); fy += 700 * u * u; }
      const s = 12 + 18 * f.p; U.beginPath(); U.ellipse(fx, fy, s * .5, s * .16, 0, 0, 7); U.fill();
    });
  }
  // 刻度：潜下去时左边 x 60–130 一格格往上过，一格 = 一个单位（按比例），每十格一根长的
  for (const q of nums) {
    if (t < q.t0 - .2 || t > q.t1 + 1.5) continue;
    const a = P(t, q.t0 - .2, q.t0) * (1 - P(t, q.t1 + .6, q.t1 + 1.5)), cell = q.depth / Math.max(q.hi, 1);
    if (cell < 4) continue;
    U.fillStyle = `rgba(242,239,230,${.35 * a})`;
    for (let k = 0; k <= q.hi; k++) {
      const sy = q.base + k * cell - Cc + 700; if (sy < wl || sy > 1330) continue;
      U.fillRect(60, sy, k % 10 === 0 ? 70 : 30, k % 10 === 0 ? 3 : 2);
    }
  }
  // 水下的词：越深越暗（隔水看）
  for (const w of words) {
    const p = wpos(w, t); if (!p) continue;
    const sy = p.y - Cc; if (sy + p.size < wl) continue;
    const dim = 1 - .6 * clamp(p.y / 1600), surf = Cc > -500 && p.y < 60 && w.kind !== 'sink' && w.kind !== 'mid';   // 镜头在水下时，浮在水面的东西只剩亮带上一块黑影
    const low = 1 - P(sy, 1100, 1300, E.lin);                                    // 进字幕区之前淡掉
    drawWord(U, w.text, p.x, sy, p.size, surf ? 'rgba(3,7,10,.9)' : w.gold ? GOLD : `rgba(242,239,230,${dim})`, p.a * low * (surf ? 1 : w.gold ? .7 : .85), Math.max(wl + wave(p.x, t), 0), 1920);
  }
  // 主角词
  if (heroObj && t >= heroObj.t0 - .02) {
    const hy = Math.min(heroY[clamp(Math.round(t * RATE), 0, heroY.length - 1)] - Cc, 1180);   // 不压字幕区
    const k = P(t, heroObj.t0, heroObj.t0 + .36, E.outC), half = Cc < -500;
    let br = half ? .4 : 1; if (fallen) br = lerp(1, .5, P(t, END.t + .4, END.t + 1.3));
    drawWord(U, heroObj.text, 470, hy, Math.min(300, 960 / [...heroObj.text].length), br < .6 ? DARKGOLD : GOLD, k * Math.max(br, .45), Math.max(wl + 10, 0), 1920, lerp(.72, 1, k), fallen ? 4 * D2R * P(t, END.t + .3, END.t + .9) : 0);
  }
  // 数字：屏幕 (470, 500)，滚到位，说完慢慢漂上去
  for (const q of nums) {
    if (t < q.t0 || t > q.t1 + 1.2) continue;
    const v = t < q.tHi ? lerp(0, q.lo || q.hi, E.outC(clamp((t - q.t0) / .36))) : lerp(q.lo || 0, q.hi, E.outC(clamp((t - q.tHi) / .36)));
    const up = P(t, q.t1, q.t1 + 1.2, E.inQ) * 700, a = 1 - P(t, q.t1 + .6, q.t1 + 1.2);
    const hiNow = t >= q.tHi, rw = hiNow || !q.rawLo ? q.rawHi : q.rawLo;             // 停住时照抄字幕原文
    const s = rollNum(v, rw, hiNow ? t >= q.tHi + .36 : t >= q.t0 + .36), qu = rawUnit(rw);
    U.save(); U.globalAlpha = a; U.fillStyle = INK; U.textBaseline = 'alphabetic'; U.textAlign = 'left';
    U.font = '900 230px Noto'; const w0 = U.measureText(s).width; U.font = '900 90px Noto'; const w1 = qu ? U.measureText(qu).width + 16 : 0;
    const X = 470 - (w0 + w1) / 2;
    U.font = '900 230px Noto'; U.fillText(s, X, 500 - up);
    if (qu) { U.font = '900 90px Noto'; U.fillText(qu, X + w0 + 16, 500 - up); }
    U.restore();
  }
  // 悬浮物：平时慢漂，有东西被冲走时拉成短条
  const flowing = words.some(w => w.washAt != null && t >= w.washAt && t < w.washAt + .5);
  for (const m of motes) {
    const sy = ((m.y - Cc * .9) % 1920 + 1920) % 1920; if (sy < wl) continue;
    U.fillStyle = 'rgba(200,210,200,.16)'; const mx = (m.x + 18 * t) % 1080;
    if (flowing) U.fillRect(mx, sy, 26, m.r * .8); else { U.beginPath(); U.arc(mx, sy + 6 * Math.sin(t + m.x), m.r, 0, 7); U.fill(); }
  }
  // 逐行横移贴回主画布（两边各多出 12 像素，不露黑缝）
  const top = clamp(Math.floor(wl - 40), 0, 1920);
  c.fillStyle = DEEPEST; c.fillRect(0, top, 1080, 1920 - top);
  for (let y = top; y < 1920; y += 2) c.drawImage(under, 0, y, 1080, 2, dx(y, t) - 12, y, 1104, 2);

  // ================= 水上（只在水面还在画面里时）
  if (wl > -30) {
    const HZ = wl - 460, glow = END.kind === 'breach' ? P(t, END.t, END.t + .6) : 0;
    c.save(); c.beginPath(); c.moveTo(0, -10); c.lineTo(1080, -10);
    for (let x = 1080; x >= 0; x -= 12) c.lineTo(x, wl + wave(x, t));
    c.closePath(); c.clip();
    c.fillStyle = SKY; c.fillRect(0, 0, 1080, wl + 600);
    g = c.createLinearGradient(0, HZ, 0, wl + 20); g.addColorStop(0, '#071016'); g.addColorStop(1, FAR); c.fillStyle = g; c.fillRect(0, HZ, 1080, wl + 600 - HZ);
    for (let i = 23; i < 46; i++) {
      const p = Math.pow(i / 46, 1.8), y = HZ + p * (wl - HZ) + 2 * Math.sin(t * 1.4 + i) * still(t);
      c.fillStyle = `rgba(120,150,150,${.02 + .02 * p})`; c.fillRect(0, y, 1080, 1 + 2.5 * p);
    }
    // 碎光路：一盏灯，在画面中线正后方
    c.globalCompositeOperation = 'lighter';
    for (const q of glints) {
      const y = HZ + 6 + q.p * (wl - HZ - 10), spread = 20 + 200 * q.p, x = 470 + q.r * spread + 6 * Math.sin(t * 1.1 + q.ph) * still(t);
      const b = clamp(.5 + .5 * Math.sin(q.f * t + q.ph) * Math.sin(.6 * q.f * t + 2 * q.ph)), w = 6 + 84 * q.p;
      c.fillStyle = `rgba(232,184,75,${Math.min(1, (.15 + .45 * b) * (1 + glow))})`; c.fillRect(x - w / 2, y, w, 1 + q.p);
    }
    c.globalCompositeOperation = 'source-over';
    // 浮子
    if (fl) {
      c.fillStyle = 'rgba(2,3,4,.7)';
      floats.forEach((f, i) => {
        const k = P(t, crowdT + i * .009, crowdT + i * .009 + .3, E.outC); if (k <= 0 || (fallen && t > END.t + f.d)) return;
        const s = (12 + 18 * f.p) * k, y = wl - 190 + 180 * f.p;
        c.beginPath(); c.ellipse(f.x, y + wave(f.x, t) * f.p, s * .5, s * .22, 0, 0, 7); c.fill();
      });
    }
    // 浮标：年份
    for (const b of buoys) {
      if (t < b.t - .1) continue;
      const k = P(t, b.t, b.t + .35, E.outB), y = wl + wave(b.x, t) - 30 * k;
      c.fillStyle = 'rgba(232,184,75,.9)'; c.fillRect(b.x - 6, y - 70 * k, 12, 70 * k);
      c.fillStyle = INK; c.font = '900 64px Noto'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.globalAlpha = clamp(k); c.fillText(b.year, b.x, y - 84 * k); c.globalAlpha = 1;
    }
    // 水上的词（含露出水面的上半截）；对比句的金色词带一道压扁的倒影
    for (const w of words) {
      if (wl < 300) break;                                                      // 水面贴着顶边时不画水上的字（顶边是遮挡区）
      const p = wpos(w, t); if (!p) continue;
      const sy = p.y - Cc; if (sy - p.size > wl + 20) continue;
      const col = w.gold ? GOLD : INK, line = wl + wave(p.x, t);
      if (w.kind === 'above') { c.save(); c.globalAlpha = .22 * p.a; c.translate(p.x, line + 6); c.scale(1, -.28); c.fillStyle = col; c.font = `${p.size}px Glow`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText(w.text, 0, 0); c.restore(); }
      drawWord(c, w.text, p.x, sy, p.size, col, p.a, 0, line);
      if (w.n) { c.fillStyle = GOLD; c.font = '900 56px Noto'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText(String(w.n), p.x, sy - p.size * .7); }
    }
    // 结尾破水：最后一个词浮在光路上
    if (FINAL && t >= END.t) {
      const k = P(t, END.t + .1, END.t + .5, E.outC);
      drawWord(c, FINAL, 470, wl - 120 + 60 * (1 - k), fsize(FINAL), GOLD, k, 0, wl + 4);
    }
    c.restore();
    // 水线：半透明软带
    for (let x = 0; x < 1080; x += 6) {
      const y = wl + wave(x, t), gg = c.createLinearGradient(0, y - 22, 0, y + 26);
      gg.addColorStop(0, 'rgba(18,48,58,0)'); gg.addColorStop(.5, 'rgba(60,96,104,.35)'); gg.addColorStop(1, 'rgba(18,48,58,0)');
      c.fillStyle = gg; c.fillRect(x, y - 22, 6, 48);
    }
  }
  // 字幕区再压暗一层
  c.fillStyle = 'rgba(3,7,10,.55)'; c.fillRect(0, 1330, 1080, 590);
  c.drawImage(tile, 0, 0, 1080, 1920);
  updSubs(t);
}
window.seek = seek;

startStage(['200px Glow', [...new Set(EV.groups.map(g => g.text).join('') + '？0123456789')].join('')], ['800 62px Noto', EV.lines.map(l => l.text).join('').slice(0, 200)], ['900 230px Noto', '0123456789.']);
