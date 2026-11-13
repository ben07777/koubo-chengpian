// 时间轴小工具：一切画面都是 t（秒）的纯函数，seek(t) 可以任意跳帧，渲染器逐帧截图。
// 缓动、弹簧、噪声、DOM 小函数摘自 motion-video-workflow/motion-kit 的 engine/core.js
// （MIT License, Copyright (c) 2026 Isaac Chang，全文见 许可证/motion-kit_LICENSE.txt）。
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  lin: x => x,
  outQ: x => 1 - (1 - x) * (1 - x), ioQ: x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2,
  inC: x => x * x * x, outC: x => 1 - Math.pow(1 - x, 3), ioC: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  outQt: x => 1 - Math.pow(1 - x, 4), outQn: x => 1 - Math.pow(1 - x, 5),
  outX: x => x === 1 ? 1 : 1 - Math.pow(2, -10 * x),
  outB: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  outB2: x => { const c1 = 2.6, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  ioS: x => -(Math.cos(Math.PI * x) - 1) / 2,
};
const P = (t, a, b, e = E.ioC) => e(clamp((t - a) / (b - a)));
function SP(x, f = 1.6, d = 6) { if (x <= 0) return 0; return 1 - Math.exp(-d * x) * Math.cos(f * 2 * Math.PI * x); }
function noise1(x, seed = 1) { const i = Math.floor(x), f = x - i; const h = n => { const s = Math.sin((n + seed * 131.7) * 127.1) * 43758.5453; return s - Math.floor(s); }; const u = f * f * (3 - 2 * f); return lerp(h(i), h(i + 1), u) * 2 - 1; }
function el(tag, cls, html, parent, style) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (style) Object.assign(e.style, style);
  if (parent) parent.appendChild(e);
  return e;
}
function set(e, o) {
  if (!e) return;
  if ('o' in o) e.style.opacity = clamp(o.o).toFixed(4);
  let s = '';
  if (o.x || o.y) s += `translate(${(o.x || 0).toFixed(2)}px,${(o.y || 0).toFixed(2)}px) `;
  if (o.r) s += `rotate(${o.r.toFixed(3)}deg) `;
  if (o.s != null) s += `scale(${(+o.s).toFixed(4)}) `;
  e.style.transform = s || 'none';
  if ('b' in o) e.style.filter = o.b > 0.05 ? `blur(${o.b.toFixed(2)}px)` : 'none';
}
function drift(t, amp = 6, seed = 5) { return { x: noise1(t * .35, seed) * amp, y: noise1(t * .3, seed + 3) * amp * .7, r: noise1(t * .25, seed + 9) * .15 }; }
function shake(t, t0, dur, amp, freq = 28, seed = 3) { const k = t - t0; if (k < 0 || k > dur) return { x: 0, y: 0 }; const a = amp * Math.pow(1 - k / dur, 2); return { x: noise1(k * freq, seed) * a, y: noise1(k * freq, seed + 7) * a }; }

// ---------- 2026-11-07 并进来的：第二批样片工程 lib.js 里的小工具（画风共用，不许各写一份） ----------
E.inQ = x => x * x;
const D2R = Math.PI / 180;
const hash = (a, b = 0, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
// track(t, 初值, [[起始, 时长, 新值], ...])：值保持到起始时刻，再缓动到新值
function track(t, init, keys, ease = E.ioC) {
  let v = init;
  for (const [t0, d, nv] of keys) {
    if (t < t0) break;
    const k = ease(clamp((t - t0) / d));
    v = Array.isArray(nv) ? nv.map((x, i) => lerp(v[i], x, k)) : lerp(v, nv, k);
  }
  return v;
}
// 剧本 → 第二批画风吃的事件格式（和 app/juben.py 的 to_ev 一一对应）
function jubenEv(j) {
  const K = ['i', 'text', 't0', 't1', 'word', 'wt0', 'wt1', 'pol', 'person', 'wp', 'gap', 'rate'];
  const breaks = {}; j.lines.forEach(l => { if (l.brk != null) breaks[l.i] = l.brk; });
  return { single: j.single, dur: j.dur, hero: j.hero, heroLine: j.heroLine, define: j.define,
    lines: j.lines.map(l => Object.fromEntries(K.map(k => [k, l[k]]))), groups: j.groups, acts: j.acts, crowds: j.crowds,
    end: j.end, turns: j.turns, kw: j.lines.map(l => l.show.map(s => s.text)), breaks, persons: j.persons };
}
// 底部字幕：每句一行，上屏词说到时变色；换行点用剧本里的 brk
let _SUBS = [];
function setupSubs({ top, height, color, gold, stroke }) {
  const box = document.getElementById('subs');
  box.style.top = top + 'px'; box.style.height = height + 'px';
  const LINES = window.JUBEN.lines;
  _SUBS = LINES.map((l, i) => {
    const el_ = document.createElement('div'); el_.className = 'sub'; el_.style.color = color;
    if (stroke) el_.style.webkitTextStroke = stroke, el_.style.paintOrder = 'stroke fill';
    const text = l.cs.map(c => c[0]).join('');
    const marks = new Array(text.length).fill(false);
    for (const s of l.show) { if (s.text !== l.word) continue; const w = s.text, at = text.indexOf(w); if (at >= 0 && said(i, w, '字幕标亮')) for (let j = 0; j < w.length; j++) marks[at + j] = true; }   // 只给上屏词变色；只挂图标的词不变色。
    // 字幕里标金色也算画了：登记（修改页列出来、能删）；删了就不标，删了同一个数（年份「2025」）也不标「2025年」
    let pos = 0;                                                     // 一块可能是好几个字母（「fo」「two」）：按字算到块上
    const spans = l.cs.map((c, j) => {
      if (l.brk === j) el_.appendChild(document.createElement('br'));
      const s = document.createElement('span'); s.textContent = c[0]; el_.appendChild(s);
      const hot = marks.slice(pos, pos + c[0].length).some(Boolean); pos += c[0].length;
      return { s, t0: c[1], hot };
    });
    box.appendChild(el_);
    return { el: el_, spans, t0: l.t0, t1: i + 1 < LINES.length ? Math.min(LINES[i + 1].t0 - .03, l.t1 + .35) : 99, gold, color };
  });
}
function updSubs(t) {
  for (const S of _SUBS) {
    const on = t >= S.t0 - .04 && t < S.t1;
    S.el.style.display = on ? 'block' : 'none';
    if (on) for (const c of S.spans) c.s.style.color = c.hot && t >= c.t0 ? S.gold : S.color;
  }
}
// 当前正在说的字：返回张嘴幅度 0–1
function mouth(t) {
  for (const l of window.JUBEN.lines) for (const c of l.cs) if (t >= c[1] && t < c[2]) return Math.sin(Math.PI * (t - c[1]) / (c[2] - c[1]));
  return 0;
}
function noiseTile(alpha = 26) {
  const n = document.createElement('canvas'); n.width = n.height = 256;
  const x = n.getContext('2d'), d = x.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const v = hash(i, 3) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = alpha; }
  x.putImageData(d, 0, 0); return n;
}
// 画风启动：等字体（[字体, 要用到的字] 若干组）→ 画风自己的 boot() → 第 0 帧 → 告诉渲染器可以截了
async function startStage(...fonts) {
  await Promise.all(fonts.map(([f, s]) => document.fonts.load(f, s)));
  if (window.boot) await window.boot();
  seek(0);
  window.READY = true;
}
// 图标（11-07 第 4 步）：剧本 show[].asset 里的 Lucide 图标名 → 画在画布上。画风把它当世界里的东西画（块面上、路牌上），不贴卡。
const _ICP = {};
function iconPaths(name) {
  if (_ICP[name] !== undefined) return _ICP[name];
  const src = (window.ICONS || {})[name];
  if (!src) return (_ICP[name] = null);
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${src}</svg>`, 'image/svg+xml');
  const out = [], n = (e, k) => parseFloat(e.getAttribute(k) || 0);
  for (const e of doc.documentElement.children) {
    const p = new Path2D(), tag = e.tagName.toLowerCase();
    if (tag === 'path') p.addPath(new Path2D(e.getAttribute('d')));
    else if (tag === 'circle') p.arc(n(e, 'cx'), n(e, 'cy'), n(e, 'r'), 0, Math.PI * 2);
    else if (tag === 'ellipse') p.ellipse(n(e, 'cx'), n(e, 'cy'), n(e, 'rx'), n(e, 'ry'), 0, 0, Math.PI * 2);
    else if (tag === 'line') { p.moveTo(n(e, 'x1'), n(e, 'y1')); p.lineTo(n(e, 'x2'), n(e, 'y2')); }
    else if (tag === 'rect') { const r = n(e, 'rx'); if (p.roundRect) p.roundRect(n(e, 'x'), n(e, 'y'), n(e, 'width'), n(e, 'height'), r); else p.rect(n(e, 'x'), n(e, 'y'), n(e, 'width'), n(e, 'height')); }
    else if (tag === 'polyline' || tag === 'polygon') { const v = (e.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number); for (let i = 0; i + 1 < v.length; i += 2) i ? p.lineTo(v[i], v[i + 1]) : p.moveTo(v[i], v[i + 1]); if (tag === 'polygon') p.closePath(); }
    else continue;
    out.push(p);
  }
  return (_ICP[name] = out);
}
// 以 (cx, cy) 为中心画一个边长 size 的图标；lw 是 24 格里的线宽（Lucide 原本 2）
function drawIcon(c, name, cx, cy, size, color, lw = 2.4) {
  const ps = iconPaths(name); if (!ps) return false;
  c.save(); c.translate(cx - size / 2, cy - size / 2); c.scale(size / 24, size / 24);
  c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const p of ps) c.stroke(p);
  c.restore(); return true;
}
// 剧本里所有挂了图标的上屏东西，按时刻排：{icon, t, text, own（就是上屏词）, line, t1 这句说完, gap 到下句的停顿}；人物词句不出图标
// 图标只陪它那句话：说完（再留一点停顿）就该收起，否则会和下一句的词并排，被读成一对
// 画面用词登记（11-07 第 5 步返工）：画风每排一个要画出来的字就登记一次（第几句、什么字、画成什么）。
// 修改页删掉的字记在剧本 lines[i].hide 里：登记时返回 false，调用处就不排它。修改页列的词只取这张表，列的就是画的。
// 图标只登记不查 hide（图标由修改页的「去掉图标」管，剧本里直接没有）。
window.DRAWN = [];
// 不许画单：字面一样算；带数字的按数字比（字卡叫「300元」、跳字叫「300」，「2亿」和「2亿种」，是同一个数，换画风也要拦住）
const digitsOf = t => (String(t).match(/\d+(\.\d+)?/g) || []).join('|');
const hiddenIn = (hide, text) => hide.includes(text) || (/\d/.test(text) && hide.some(h => /\d/.test(h) && digitsOf(h) === digitsOf(text)));
function said(line, text, kind, icon) {
  text = text == null ? '' : String(text); if ((!text && !icon) || line == null) return false;   // 只配图标、没配词的句子：图标照样登记
  const L = window.JUBEN.lines[line];
  if (!icon && L && hiddenIn(L.hide || [], text)) return false;
  window.DRAWN.push(icon ? { line, text, kind, icon } : { line, text, kind }); return true;
}
// 结尾大字登记在哪句名下：最后一句说到这个词的（结尾那句常常不含这个词，挂在那句下面就删不掉）
function endLine(word, dflt) {
  const L = window.JUBEN.lines;
  for (let i = L.length - 1; i >= 0; i--) if ((L[i].cs || []).map(c => c[0]).join('').includes(word)) return i;
  return dflt;
}
// 一个字登记在哪句名下：先看给的那句，没有就找最近一句说到它的（对比牌、数字图记的句号有时差一两句，挂错句就删不掉）
function lineOf(text, li) {
  const L = window.JUBEN.lines, has = i => i >= 0 && i < L.length && (L[i].cs || []).map(c => c[0]).join('').includes(text);
  if (!text || has(li)) return li;
  for (let d = 1; d < L.length; d++) { if (has(li - d)) return li - d; if (has(li + d)) return li + d; }
  return li;
}
const rangeText = a => a.raw || `${+a.lo}到${+a.hi}${a.unit || ''}`;
// 11-09 第三轮：数字停住时只许照抄字幕原文（剧本里的 raw / rawLo / rawHi），滚动中按原文的小数位数走；
// 没有 raw 的（旧剧本、负号、分数、钟点这类抄不准的）各画风一律不画数
const rawSplit = r => { const m = String(r == null ? '' : r).match(/^(\d+(?:\.\d+)?)(.*)$/); return m ? { n: m[1], u: m[2], d: (m[1].split('.')[1] || '').length } : null; };
const rollNum = (v, r, done) => { const p = rawSplit(r); return !p ? '' : done ? p.n : Math.max(0, v).toFixed(p.d); };
const rawUnit = r => (rawSplit(r) || { u: '' }).u;
const statText = a => a.word || String(+a.value) + (a.suffix || '');
function jubenProps(j) {
  const out = [];
  for (const l of j.lines) { if (l.wp) continue; for (const s of l.show) if (s.asset && (window.ICONS || {})[s.asset]) out.push({ icon: s.asset, t: s.t0, text: s.text, own: s.text === l.word, line: l.i, t1: l.t1, gap: l.gap || 0 }); }
  return out.sort((a, b) => a.t - b.t);
}
