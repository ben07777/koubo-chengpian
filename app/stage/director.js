// 画面导演：读 window.PLAN（planner.py 生成），按镜头类型搭画面；seek(t) 逐帧更新。
const PL = window.PLAN;
const THEMES = {
  night: { bg0: '#0A0F1F', bg1: '#16244A', ink: '#F4F6FF', sub: '#9AA6C6', acc: '#FFB21E', acc2: '#4D8DFF', bad: '#FF5468', good: '#2FD9A0',
    card: 'rgba(255,255,255,.07)', cardLine: 'rgba(255,255,255,.14)', line: 'rgba(255,255,255,.12)', accInk: '#1A1203', dot: 'rgba(255,255,255,.07)',
    subBg: 'transparent', subInk: '#FFFFFF', subStroke: '10px rgba(5,8,18,.9)', sweep: 'rgba(255,255,255,.10)', grain: .10,
    shadow: '0 30px 80px rgba(0,0,0,.35)', blobs: ['rgba(77,141,255,.30)', 'rgba(255,178,30,.16)', 'rgba(160,90,255,.20)'] },
  paper: { bg0: '#F3EDE2', bg1: '#E8DDCB', ink: '#1C1A16', sub: '#6F6658', acc: '#E2412B', acc2: '#2B59C3', bad: '#E2412B', good: '#1E8F55',
    card: '#FFFDF8', cardLine: 'rgba(28,26,22,.12)', line: 'rgba(28,26,22,.10)', accInk: '#FFFFFF', dot: 'rgba(28,26,22,.10)',
    subBg: 'rgba(255,253,248,.92)', subInk: '#1C1A16', subStroke: '0px transparent', sweep: 'rgba(255,255,255,.55)', grain: .16,
    shadow: '0 18px 50px rgba(60,40,10,.12)', blobs: ['rgba(226,65,43,.10)', 'rgba(43,89,195,.08)', 'rgba(230,180,90,.18)'] },
  mint: { bg0: '#E7F5EE', bg1: '#CBEAD9', ink: '#0F2A20', sub: '#58766A', acc: '#0E9F6E', acc2: '#FF7A30', bad: '#F0503C', good: '#0E9F6E',
    card: '#FFFFFF', cardLine: 'rgba(15,42,32,.10)', line: 'rgba(15,42,32,.10)', accInk: '#FFFFFF', dot: 'rgba(15,42,32,.09)',
    subBg: 'rgba(255,255,255,.92)', subInk: '#0F2A20', subStroke: '0px transparent', sweep: 'rgba(255,255,255,.6)', grain: .12,
    shadow: '0 18px 50px rgba(10,60,40,.12)', blobs: ['rgba(14,159,110,.20)', 'rgba(255,122,48,.14)', 'rgba(80,200,255,.16)'] },
};
const TH = THEMES[PL.theme] || THEMES.night;
for (const [k, v] of Object.entries(TH)) if (typeof v !== 'object') document.documentElement.style.setProperty('--' + k, v);
const $ = s => document.querySelector(s);
const CAM = $('#cam'), SUBS = $('#subs');
const LN = PL.lines, SCN = [], SHAKES = [];
const CY = 400;
const lineText = l => l.cs.map(c => c[0]).join('');
const hl = s => String(s).replace(/\[\[(.+?)\]\]/g, '<span class="hl">$1</span>');
const plain = s => String(s).replace(/\[\[|\]\]/g, '');
const kwMask = (cs, kw) => { const txt = cs.map(c => c[0]).join(''), ki = kw ? txt.indexOf(kw) : -1; let off = 0;
  return cs.map(c => { const a = off; off += c[0].length; return ki >= 0 && a < ki + kw.length && off > ki; }); };
const clampN = (v, a, b) => Math.min(Math.max(v, a), b);
const fmtN = (v, unit) => (Number.isInteger(v) ? v : v.toFixed(1)) + (unit || '');
function icon(name, size, parent, style) {
  const e = el('span', 'ic', ICONS[name] ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>` : '', parent,
    Object.assign({ width: size + 'px', height: size + 'px' }, style || {}));
  return e;
}
function abs(e, x, y, w) { Object.assign(e.style, { position: 'absolute', left: x + 'px', top: y + 'px' }); if (w) e.style.width = w + 'px'; return e; }
const kinSize = n => n <= 5 ? 150 : n <= 7 ? 128 : n <= 9 ? 108 : n <= 12 ? 92 : 84;
const txtSize = (s, big = 84) => { const n = Math.max(...String(plain(s)).split('\n').map(x => x.length)); return n <= 6 ? big : n <= 8 ? big * .86 : n <= 11 ? big * .74 : big * .64; };

// ---------- 逐字跳的大字 ----------
function kinLine(parent, li, size) {
  const l = LN[li], m = kwMask(l.cs, l.kw || '');
  const box = el('div', 'kin', null, parent, { fontSize: size + 'px', lineHeight: 1.16, top: '0px' });
  const ch = l.cs.map((c, i) => {
    const sp = el('span', null, c[0], box);
    if (m[i]) sp.style.color = 'var(--acc)';
    return { e: sp, t: c[1] };
  });
  return { box, ch, t0: l.t0, t1: l.t1, h: 0 };
}
function updChars(ch, t) {
  for (const c of ch) {
    const k = P(t, c.t - 0.07, c.t + 0.2, E.outC), kb = P(t, c.t - 0.07, c.t + 0.32, E.outB);
    set(c.e, { o: k, y: (1 - k) * 40, s: 1.3 - 0.3 * kb, b: (1 - k) * 7 });
  }
}
function KinStack(sc, cy, maxSize = 150) {
  const blocks = [];
  for (let li = sc.la; li < sc.lb; li++) blocks.push(kinLine(sc.el, li, Math.min(maxSize, kinSize(LN[li].cs.length))));
  sc.measure.push(() => blocks.forEach(b => { b.h = b.box.offsetHeight; b.box.style.top = (cy - b.h / 2) + 'px'; }));
  return {
    blocks,
    upd(t) {
      blocks.forEach((b, k) => {
        if (t < b.t0 - 0.1) { b.box.style.opacity = 0; return; }
        const n1 = blocks[k + 1], n2 = blocks[k + 2];
        const k1 = n1 ? P(t, n1.t0 - 0.12, n1.t0 + 0.3, E.outC) : 0, k2 = n2 ? P(t, n2.t0 - 0.12, n2.t0 + 0.3, E.outC) : 0;
        const up = k1 * (b.h * 0.29 + (n1 ? n1.h * 0.5 : 0) + 40) + k2 * (b.h * 0.2 + 120);
        set(b.box, { o: 1 - 0.62 * k1 - 0.38 * k2, y: -up, s: 1 - 0.42 * k1 - 0.1 * k2 });
        updChars(b.ch, t);
      });
    }
  };
}

// ---------- 各类镜头 ----------
const BUILD = {
  hook(sc) {
    const bgI = icon(sc.icon || 'sparkles', 560, sc.el, { position: 'absolute', left: '260px', top: '120px', opacity: .1 });
    const ks = KinStack(sc, CY - 20, 150);
    sc.noEnter = true; sc.noExit = true;
    return t => {
      const k = P(t, sc.t1 - 0.45, sc.t1 + 0.05, E.ioC);
      set(sc.el, { o: 1 - P(t, sc.t1 - 0.4, sc.t1 - 0.08, E.inC), y: -520 * k, s: 1 - 0.4 * k, b: 6 * k });
      set(bgI, { r: noise1(t * .4, 4) * 8 + t * 3, s: 1 + 0.04 * Math.sin(t * 1.3), o: 0.1 });
      ks.upd(t);
    };
  },
  say(sc) {
    const bgI = sc.icon ? icon(sc.icon, 470, sc.el, { position: 'absolute', left: '305px', top: '165px', opacity: .09 }) : null;
    const ks = KinStack(sc, CY);
    sc.hideSubs = true;
    return t => { if (bgI) set(bgI, { r: noise1(t * .3, 7) * 9, y: Math.sin(t * 1.1) * 14, o: .09 }); ks.upd(t); };
  },
  question(sc) {
    const q = abs(el('div', 'big', '?', sc.el, { fontSize: '420px', lineHeight: 1, color: 'var(--acc)', width: '1080px', textAlign: 'center' }), 0, -40);
    const ks = KinStack(sc, 590, 100);
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
    const pill = el('div', 'pill', '', sc.el); icon('users', 46, pill, { color: 'var(--sub)' }); el('span', null, sc.label, pill);
    abs(pill, 0, 30); pill.style.left = '50%'; pill.style.translate = '-50% 0';
    const card = abs(el('div', 'card', null, sc.el, { height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }), 100, 150, 880);
    el('div', 'big', `“${sc.myth}”`, card, { fontSize: txtSize(sc.myth + '00', 96) + 'px', textAlign: 'center', padding: '0 50px', lineHeight: 1.2 });
    const strike = abs(el('div', null, null, card, { height: '12px', background: 'var(--bad)', borderRadius: '6px', transformOrigin: '0 50%' }), 50, 154, 780);
    const stamp = abs(el('div', 'stamp', '✕ 误区', sc.el), 620, 95);
    const fact = abs(el('div', null, null, sc.el, { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '18px', font: `${txtSize(sc.fact + '000', 78)}px Glow`, color: 'var(--good)' }), 90, 540, 900);
    icon('circle-check', 80, fact, { color: 'var(--good)' }); el('span', null, '其实：' + sc.fact, fact);
    SHAKES.push([sc.factT + 0.12, 16]);
    return t => {
      const kp = P(t, sc.t0, sc.t0 + 0.45, E.outB); pill.style.opacity = kp; pill.style.transform = `translateY(${(1 - kp) * 30}px)`;
      const kc = P(t, sc.mythT - 0.2, sc.mythT + 0.35, E.outB), kd = P(t, sc.factT, sc.factT + 0.35, E.outC);
      set(card, { o: kc * (1 - 0.45 * kd), y: (1 - kc) * 90, s: (0.94 + 0.06 * kc) * (1 - 0.03 * kd), r: -2 * kd });
      strike.style.transform = `scaleX(${P(t, sc.factT, sc.factT + 0.3, E.outC)})`;
      const ks = P(t, sc.factT - 0.04, sc.factT + 0.26, E.outB2);
      set(stamp, { o: t > sc.factT - 0.04 ? 1 : 0, s: 2.6 - 1.6 * ks, r: -14 + 4 * ks });
      const kf = P(t, sc.factT + 0.25, sc.factT + 0.65, E.outC);
      set(fact, { o: kf, y: (1 - kf) * 40 });
    };
  },
  compare(sc) {
    const mk = (side, top, h, hot) => {
      const c = abs(el('div', 'card', null, sc.el, { height: h + 'px', padding: '30px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '18px' }), 100, top, 880);
      if (hot) Object.assign(c.style, { borderColor: 'var(--acc)', boxShadow: '0 0 0 6px color-mix(in srgb, var(--acc) 18%, transparent), var(--shadow)' });
      el('div', null, side.label, c, { font: '50px Smiley', color: hot ? 'var(--acc)' : 'var(--sub)' });
      el('div', 'big', side.text.replace(/\n/g, '<br>'), c, { fontSize: txtSize(side.text, 84) + 'px', lineHeight: 1.18, color: hot ? 'var(--ink)' : 'var(--sub)' });
      return c;
    };
    const A = mk(sc.L, 20, 300, false), B = mk(sc.R, 420, 360, true);
    const arr = abs(el('div', null, '<svg viewBox="0 0 60 60" width="84" height="84"><path d="M30 6v44M12 32l18 18 18-18" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>', sc.el, { color: 'var(--acc)' }), 498, 330);
    return t => {
      const ka = P(t, sc.L.t - 0.2, sc.L.t + 0.3, E.outB), kb = P(t, sc.R.t - 0.2, sc.R.t + 0.35, E.outB);
      set(A, { o: ka * (1 - 0.4 * kb), x: (1 - ka) * -140, s: 1 - 0.04 * kb });
      set(B, { o: kb, x: (1 - kb) * 140, s: 0.94 + 0.06 * kb });
      const kr = P(t, sc.R.t - 0.3, sc.R.t + 0.1, E.outC); set(arr, { o: kr, y: (1 - kr) * -30 });
    };
  },
  pair(sc) {
    const N = sc.items.length, D = N === 2 ? 300 : N === 3 ? 240 : 196, gap = N === 2 ? 150 : 70;
    const ttl = abs(el('div', 'big', sc.title, sc.el, { fontSize: txtSize(sc.title, 96) + 'px', textAlign: 'center' }), 90, 40, 900);
    const W0 = N * D + (N - 1) * gap, x0 = 540 - W0 / 2;
    const its = sc.items.map((it, k) => {
      const g = abs(el('div', null, null, sc.el, { width: D + 'px', textAlign: 'center' }), x0 + k * (D + gap), 250);
      const c = el('div', 'card', null, g, { position: 'relative', width: D + 'px', height: D + 'px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: 'var(--acc)', borderWidth: '6px' });
      icon(it.icon || 'circle-check', D * 0.46, c, { color: k % 2 ? 'var(--acc2)' : 'var(--acc)' });
      el('div', 'big', it.text, g, { fontSize: (it.text.length <= 3 ? 92 : 70) + 'px', marginTop: '26px', whiteSpace: 'nowrap', marginLeft: '-60px', marginRight: '-60px' });
      return { g, t: it.t };
    });
    const plus = sc.items.slice(1).map((_, k) => abs(el('div', 'num', '+', sc.el, { fontSize: '110px', color: 'var(--sub)', width: gap + 'px', textAlign: 'center' }), x0 + (k + 1) * (D + gap) - gap, 250 + D / 2 - 66));
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
    const max = sc.max || 100, BW = 820, X = 110, Y = 400, BH = 150;
    const ttl = abs(el('div', 'big', sc.label, sc.el, { fontSize: txtSize(sc.label, 92) + 'px', textAlign: 'center' }), 90, 40, 900);
    const bar = abs(el('div', null, null, sc.el, { height: BH + 'px', borderRadius: '30px', border: '8px solid var(--ink)', background: 'var(--card)', overflow: 'hidden' }), X, Y, BW);
    const nub = /battery/.test(sc.icon || '') || /电/.test(sc.label) ? abs(el('div', null, null, sc.el, { width: '30px', height: '70px', borderRadius: '0 14px 14px 0', background: 'var(--ink)' }), X + BW, Y + BH / 2 - 35) : null;
    const band = abs(el('div', null, null, bar, { top: '8px', bottom: '8px', height: 'auto', borderRadius: '16px', background: 'var(--acc)', boxShadow: '0 0 40px var(--acc)' }), 0, 8);
    const ticks = [0, .25, .5, .75, 1].map(f => abs(el('div', null, fmtN(Math.round(max * f), sc.unit === '%' ? '' : ''), sc.el, { font: '600 42px Arial', color: 'var(--sub)', width: '120px', textAlign: 'center' }), X + BW * f - 60, Y + BH + 22));
    const mk = () => abs(el('div', 'num', '', sc.el, { fontSize: '118px', color: 'var(--acc)', whiteSpace: 'nowrap' }), 0, Y - 150);
    const mLo = mk(), mHi = mk(), wCache = new Map();
    // 两头的数字各自多宽，得量出来：区间一窄，「60天」和「90天」会叠在一起（盲审 11-04：终值叠成「60夭90天」）
    const put = (e, s2) => { e.textContent = s2; if (!wCache.has(s2)) wCache.set(s2, e.offsetWidth); return wCache.get(s2); };
    const xOf = v => X + 8 + (BW - 16) * clamp(v / max);
    return t => {
      const k0 = P(t, sc.t0, sc.t0 + 0.4, E.outC); set(ttl, { o: k0, y: (1 - k0) * 30 }); set(bar, { o: k0 }); if (nub) nub.style.opacity = k0;
      ticks.forEach(e => e.style.opacity = k0 * 0.9);
      // 条要比嘴快一点：句子一开头就往上涨，说到数字时已经到位（盲审：慢半拍、截到 71% 像出错）
      const kl = P(t, sc.t0 + 0.25, Math.max(sc.tLo, sc.t0 + 0.6) + 0.1, E.outC), kh = P(t, sc.tLo + 0.05, Math.max(sc.tHi, sc.tLo + 0.4) + 0.1, E.outC);
      const lo = sc.lo * kl, hi = lerp(sc.lo, sc.hi, kh);
      const x1 = xOf(lo) - X - 8, x2 = xOf(Math.max(hi, lo)) - X - 8;
      band.style.left = (8 + (kl > 0 ? x1 : 0)) + 'px'; band.style.width = Math.max(kl > 0 ? 10 : 0, x2 - x1) + 'px'; band.style.opacity = kl > 0 ? 1 : 0;
      const wl = put(mLo, fmtN(Math.round(lo), sc.unit)), wh = put(mHi, fmtN(Math.round(hi), sc.unit));
      let cl = xOf(lo), ch = xOf(hi), need = (wl + wh) / 2 + 30;
      if (ch - cl < need) { const m = (cl + ch) / 2; cl = m - need / 2; ch = m + need / 2; }   // 挤到一起就对称撑开
      cl = clampN(cl, wl / 2 + 20, 1080 - wl / 2 - 20); ch = clampN(ch, wh / 2 + 20, 1080 - wh / 2 - 20);
      mLo.style.left = (cl - wl / 2) + 'px'; set(mLo, { o: kl > 0 ? 1 : 0, s: 0.8 + 0.2 * kl });
      mHi.style.left = (ch - wh / 2) + 'px'; set(mHi, { o: kh > 0 ? 1 : 0, s: 0.8 + 0.2 * kh });
    };
  },
  stat(sc) {
    const col = sc.tone === 'bad' ? 'var(--bad)' : 'var(--acc)';
    const grp = (label, value, unit, y) => {
      const g = abs(el('div', null, null, sc.el, { textAlign: 'center' }), 90, y, 900);
      const lb = el('div', 'big', label, g, { fontSize: txtSize(label, 88) + 'px', minHeight: '20px' });
      const row = el('div', null, null, g, { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '12px', marginTop: '6px', color: col });
      const nm = el('div', 'num', '0', row, { fontSize: (String(value).length > 4 ? 220 : 290) + 'px' });
      el('div', 'big', unit === '%' ? '%' : unit, row, { fontSize: '140px' });
      let barF = null;
      if (unit === '%') { const b = el('div', null, null, g, { margin: '18px auto 0', width: '720px', height: '28px', borderRadius: '14px', background: 'var(--line)', overflow: 'hidden' }); barF = el('div', null, null, b, { height: '100%', width: '0', background: col, borderRadius: '14px' }); }
      return { g, nm, barF, value };
    };
    const G1 = grp(sc.label, sc.value, sc.unit, 90);
    const G2 = sc.second ? grp(sc.second.label, sc.second.value, sc.second.unit, 90) : null;
    const warn = sc.tone === 'bad' ? icon('triangle-alert', 120, sc.el, { position: 'absolute', left: '840px', top: '210px', color: 'var(--bad)' }) : null;
    const ring = abs(el('div', null, null, sc.el, { width: '620px', height: '620px', borderRadius: '50%', border: `6px solid ${col}` }), 230, 110);
    SHAKES.push([sc.t + 0.6, sc.tone === 'bad' ? 14 : 8]);
    const count = (G, t0, t) => { const k = P(t, t0 - 0.4, t0 + 0.3, E.outQt); G.nm.textContent = fmtN(G.value * k >= 10 ? Math.round(G.value * k) : +(G.value * k).toFixed(G.value < 10 ? 1 : 0)); if (G.barF) G.barF.style.width = clamp(G.value * k / 100) * 100 + '%'; return k; };
    return t => {
      const k0 = P(t, sc.t0, sc.t0 + 0.4, E.outC);
      const k1 = count(G1, sc.t, t);
      const kx = G2 ? P(t, sc.second.t - 0.35, sc.second.t + 0.15, E.ioC) : 0;
      set(G1.g, { o: k0 * (1 - 0.6 * kx), y: -200 * kx, s: (0.92 + 0.08 * P(t, sc.t - 0.1, sc.t + 0.4, E.outB)) * (1 - 0.55 * kx) });
      if (G2) { count(G2, sc.second.t, t); const k2 = P(t, sc.second.t - 0.05, sc.second.t + 0.4, E.outB); set(G2.g, { o: P(t, sc.second.t - 0.05, sc.second.t + 0.15), y: 210 + (1 - k2) * 90, s: 0.82 + 0.1 * k2 }); }
      if (warn) { const kw = clamp((t - sc.t - 0.4) / 0.8); set(warn, { o: kw > 0 ? 1 - kx : 0, s: SP(kw, 1.5, 5), r: Math.sin(t * 5) * 6 * (kw > 0 ? 1 : 0) }); }
      const kr = clamp((t - sc.t - 0.55) / 0.9); set(ring, { o: kr > 0 && kr < 1 ? 0.6 * (1 - kr) : 0, s: 0.6 + 0.7 * E.outC(kr) });
    };
  },
  list(sc) {
    const N = sc.items.length, top0 = 170, sp = Math.min(190, (800 - top0 - 10) / N), ch = sp - 26;
    const hd = abs(el('div', null, null, sc.el, { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '22px' }), 90, 20, 900);
    const badge = el('div', 'num', String(N), hd, { width: '118px', height: '118px', borderRadius: '50%', background: 'var(--acc)', color: 'var(--accInk)', fontSize: '76px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0' });
    el('div', 'big', sc.title.replace(/^[^一-龥]*/, ''), hd, { fontSize: txtSize(sc.title, 92) + 'px' });
    const cards = sc.items.map((it, k) => {
      const c = abs(el('div', 'card', null, sc.el, { height: ch + 'px', display: 'flex', alignItems: 'center', gap: '26px', padding: '0 40px' }), 100, top0 + k * sp, 860);
      el('div', 'num', String(k + 1).padStart(2, '0'), c, { fontSize: '64px', color: 'var(--acc)', letterSpacing: '-2px', minWidth: '84px' });
      if (it.icon) icon(it.icon, 64, c, { color: 'var(--ink)', flex: 'none' });
      el('div', 'big', it.head, c, { fontSize: (it.head.length > 10 ? 54 : 64) + 'px', whiteSpace: 'nowrap' });
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
  const prog = $('#prog i');
  const PS = PL.person, PLAIN = !!Q.get('plain');
  const hook = PL.scenes[0], tDock = PS ? 0.25 : hook.t1;  // 真人版：标题一开场就在，不等开场大字
  PL.scenes.slice(1).forEach(s => { const b = el('b', null, null, $('#prog')); b.style.left = (s.t0 / PL.dur * 940) + 'px'; });

  // 镜头
  for (const s of PL.scenes) {
    const sc = Object.assign({}, s, { el: el('div', 'scene', null, CAM), measure: [] });
    sc.upd = (BUILD[s.type] || BUILD.say)(sc);
    SCN.push(sc);
  }
  for (const sc of SCN) { sc.el.style.display = 'block'; sc.measure.forEach(f => f()); sc.el.style.display = 'none'; }

  // 字幕
  const SUB = LN.map(l => {
    const d = el('div', 'sub', null, SUBS, { display: 'none' });
    if (l.cs.length > 13) d.style.fontSize = '54px';
    const m = kwMask(l.cs, l.kw || '');
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
  const SPLIT = new Set(['myth', 'compare', 'pair', 'range', 'stat', 'list']), SH = 900;  // 只有带数据的卡才分屏；问号、收尾留给人
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
        const a = sc.noEnter ? 1 : P(t, sc.t0 - 0.14, sc.t0 + 0.36, E.outC), b = sc.noExit ? 0 : P(t, sc.t1 - 0.26, sc.t1 + 0.05, E.inC);
        set(sc.el, { o: a * (1 - b), s: (0.93 + 0.07 * a) * (1 + 0.08 * b), y: (1 - a) * 60 - b * 30, b: (1 - a) * 9 + b * 9 });
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
    icon(PL.cover.icon || 'sparkles', 860, C, { position: 'absolute', right: '-170px', bottom: (H === 1440 ? -150 : -40) + 'px', opacity: .14, transform: 'rotate(-12deg)' });
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
Promise.all(['86px Glow', '800 62px Noto', '44px Smiley', '800 100px Arial', '600 36px Arial'].map(f => document.fonts.load(f, '测试字1%'))).then(() => { build(); if (!Q.get('cover')) window.seek(0); });
