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
