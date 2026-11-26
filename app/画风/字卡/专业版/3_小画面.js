
// ---------- 现成的小画面（2026-11-14 夜，定）：版式是提前画好的，模型只挑哪一种、填图标名和短词 ----------
// 接在 写画面.js 后面。每一种 = HUA_KIT 里的一个函数 (S, d)：d 是把关以后的那几栏（词都是这几句字幕里原样的字，图标名都在名单里）。
// 规矩（每一种都守）：第一样东西跟着卡进来，别的说到才出；东西收在 770×780 里，四边留 20；字不小于 44；一屏不超过三种颜色。
// 颜色只用配色里的变量（白纸、方格本是浅底：写死的白色在浅底上看不见，11-14 夜改成按字色调淡）。
// 清单是从四条不同题材的稿里归纳的（购物、饭局、EP13 财经、11-03 新闻），不是照着哪一条做的。
const xhSeq = (ts, gap) => { for (let i = 1; i < ts.length; i++) ts[i] = Math.max(ts[i], ts[i - 1] + (gap || 0.3)); return ts; };
const xhLeft = b => { b.firstChild.style.justifyContent = 'flex-start'; b.firstChild.firstChild.style.textAlign = 'left'; b.firstChild.firstChild.style.width = 'auto'; b.firstChild.firstChild.style.maxWidth = '100%'; return b; };
function xhSlip(S, s, x, y, w, h, size, o = {}) {      // 一张小纸条，上面一个词
  const p = S.paper(x, y, w, h, o.parent); if (o.bg) { p.style.background = o.bg; }
  xhT(S,s, 18, 8, w - 36, h - 16, { parent: p, size: size || 72, color: o.color || PRO_INK }); return p;
}
// 小画面自己的放字：先按词切开（数字和它后面的单位算一块，不拆），一行、两行、三行各算一遍能放多大，挑字最大的那种；
// 不留孤零零一个字的行；怎么都放不到 42 就整张卡不要（退回免费版的画法）。看样时见过：「预算10 / 00块钱」、五个字的纸条缩到 50。
const XH_SEG = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('zh', { granularity: 'word' }) : null;
function xhTok(s) {
  const raw = XH_SEG ? [...XH_SEG.segment(s)].map(x => x.segment) : [...s], out = [];
  raw.forEach(w => {
    const p = out[out.length - 1];
    if (p != null && (/\d$/.test(p) && /^[\d.,%％]/.test(w) || /\d[.,]$/.test(p) && /^\d/.test(w))) out[out.length - 1] = p + w;   // 数字接着数字、小数点、百分号
    else if (p != null && /\d$/.test(p) && !/^[A-Za-z\s]/.test(w)) out[out.length - 1] = p + w;                                    // 数字后面紧跟的那个词当单位
    else out.push(w);
  });
  for (let i = 0; i < out.length - 1; i++) for (const g of XH_GLUE) {       // 「怎么回事」这种常说的整话，分词分开了也粘回去
    let j = i, acc = ''; while (j < out.length && g.startsWith(acc + out[j]) && acc.length < g.length) acc += out[j++];
    if (acc === g && j - i > 1) { out.splice(i, j - i, g); break; }
  }
  return out;
}
const XH_GLUE = ['怎么回事', '怎么办', '为什么', '是不是', '能不能', '有没有', '会不会', '不一样', '差不多', '一点点', '用得起', '用得上', '用不起', '用不上', '看得见', '看不见', '看不出', '看得出', '买得起', '买不起', '用上', '用好', '用不好', '充话费', '话费'];
const XH_FWD = /^[不没很最更也就都又还才把被和与或及离让比向对给在跟从]$/, XH_BACK = /^(?:[的了呢啊吧吗着]|人员|机构|公司|行业|领域|时候|之后|以后|之前|以前|来说|来讲|一下|起来|出来|下去|的话|而已)$/;   // 这些字不放行尾 / 不放行首
function xhCut(s, L) {                                    // 折成 L 行，最长那行最短；折不出来回 null
  if (L === 1) return [s];
  const tk = xhTok(s), n = tk.length; if (n < L) return null;
  let best = null;
  const tryIt = cuts => { const b = [0, ...cuts, n], ls = []; for (let i = 1; i < b.length; i++) ls.push(tk.slice(b[i - 1], b[i]).join(''));
    if (ls.some(l => uW(l) < 1.5)) return;
    let pen = 0;                                          // 折在不该折的地方要罚：「不 / 一样」「用 / 好」这种把一个意思拆开的
    for (let i = 1; i < b.length - 1; i++) { const u = tk[b[i] - 1], v = tk[b[i]]; if (XH_FWD.test(u) || XH_BACK.test(v)) pen += 2.5; else if (/^[一-鿿]$/.test(u) && /^[一-鿿]$/.test(v) && !XH_FWD.test(v)) pen += 0.5; }
    const m = Math.max(...ls.map(uW)) + pen, d = m - Math.min(...ls.map(uW)); if (!best || m < best.m - 0.01 || (Math.abs(m - best.m) < 0.01 && d < best.d)) best = { ls, m, d }; };
  if (L === 2) for (let i = 1; i < n; i++) tryIt([i]);
  else for (let i = 1; i < n - 1; i++) for (let j = i + 1; j < n; j++) tryIt([i, j]);
  return best && best.ls;
}
function xhFit(s, w, h, cap) {                           // 这段字放进 w×h 最大能多大、折成哪几行
  let best = null;
  for (let L = 1; L <= 3; L++) { const ls = xhCut(s, L); if (!ls) continue; const m = Math.max(...ls.map(uW)), fs = Math.floor(Math.min(cap || 96, w / (m * 1.03), h / (L * 1.16))); if (!best || fs > best.fs * 1.12) best = { ls, fs }; }
  return best;
}
const xhSame = (ws, w, h, cap) => Math.min(...ws.map(s => xhFit(String(s), w, h, cap).fs));   // 并列的几样用一样大的字：取最小的那个
function xhByLine(S, s) {                               // 这段字要是跨了几句字幕，照字幕的句子断开；断不出来（不跨句、少抄过字、哪一行太短）回 null
  const k = huaNorm(s); if (k.length !== String(s).length) return null;
  let acc = ''; const cuts = [];
  for (const l of S.lines) { acc += huaNorm(l.text); cuts.push(acc.length); }
  const i = acc.indexOf(k); if (i < 0) return null;
  const ls = []; let a = i;
  for (const c of cuts) { if (c <= a) continue; const e = Math.min(c, i + k.length); ls.push(k.slice(a - i, e - i)); a = e; if (e >= i + k.length) break; }
  return ls.length >= 2 && ls.length <= 3 && ls.every(l => uW(l) >= 1.5) ? ls : null;
}
function xhT(S, s, x, y, w, h, o = {}) {
  s = String(s); const b = S.box(x, y, w, h, null, o.parent); let best = xhFit(s, w, h, o.size);
  if (o.lines) {                                           // 给了照句子断好的几行：字不比原来小太多就用它
    const L = o.lines, fs = Math.floor(Math.min(o.size || 96, w / (Math.max(...L.map(uW)) * 1.03), h / (L.length * 1.16)));
    if (fs >= 42 && fs >= best.fs * 0.7) best = { ls: L, fs };
  }
  if (best.fs < 42) throw new Error('字放不下（只能放到 ' + best.fs + '）：「' + s + '」');
  const fx = S.el('div', { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }, b);
  const d = S.el('div', { width: w + 'px', textAlign: 'center', fontSize: best.fs + 'px', lineHeight: '1.16', whiteSpace: 'nowrap', color: o.color || 'inherit' }, fx); d.className = 'big'; d.dataset.w = s;
  best.ls.forEach((l, i) => { if (i) d.appendChild(document.createElement('br')); d.appendChild(document.createTextNode(l)); });
  return b;
}
function xhMark(S, ok, size, x, y, parent, color) {      // 一个勾或者一个叉，一笔画出来。返回 k => 画到几成
  const g = S.svg(x, y, size, size, parent), z = size;
  const p = S.s('path', { d: ok ? `M${z * .16} ${z * .55}L${z * .41} ${z * .79}L${z * .85} ${z * .23}` : `M${z * .2} ${z * .2}L${z * .8} ${z * .8}M${z * .8} ${z * .2}L${z * .2} ${z * .8}`, fill: 'none', 'stroke-width': (z * 0.15).toFixed(1), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  p.style.stroke = color || (ok ? 'var(--good)' : 'var(--bad)'); S.dash(p, 0);
  return k => S.dash(p, k);
}
const xhLine = (S, g, d, sw, color) => { const p = S.s('path', { d, fill: 'none', 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g); p.style.stroke = color; return p; };
const XH_W = 'color-mix(in srgb, var(--ink) 82%, transparent)', XH_DIM = 'color-mix(in srgb, var(--ink) 30%, transparent)';

Object.assign(HUA_KIT, {
  单子(S, d) {          // 一张单子：几行条件一行一行打上勾，最后可以盖一个章。{题?, 行[2..4], 章?}
    const rows = d.行, n = rows.length, RH = n > 3 ? 120 : 138, top = d.题 ? 150 : 56, H = top + n * RH + (d.章 ? 70 : 40), W = 650, x0 = 60, y0 = Math.round((780 - H) / 2);
    const pp = S.paper(x0, y0, W, H), FZ = xhSame(rows, W - 176, RH - 20, 76); pp.style.overflow = 'hidden';
    const bg = xhBadge(S, d.图标, x0 + W - 74, y0 - 46);      // 11-16：填了图标的，纸的右上角多一块圆底托着它
    if (d.题) { xhLeft(xhT(S,d.题, 46, 30, W - 92, 92, { parent: pp, size: 68, color: 'rgba(34,30,23,.72)' })); S.box(46, 128, W - 92, 4, { background: 'rgba(34,30,23,.22)', borderRadius: '2px' }, pp); }
    const ts = xhSeq(rows.map((r, i) => i || d.题 ? S.say(r) : S.in));   // 11-16：没有题的单子，头一行和纸一起进（原来纸先亮半秒才出字）   // 有题的单子先只出题，行跟着嘴来（试看：头一行比嘴早了两秒）
    const its = rows.map((r, i) => {
      const y = top + i * RH, by = y + (RH - 64) / 2;
      const bx = S.box(46, by, 64, 64, { border: '6px solid ' + PRO_INK, borderRadius: '12px', boxSizing: 'border-box' }, pp);
      const tick = xhMark(S, true, 74, 44, by - 12, pp, PRO_INK);   // 勾用墨色，不用绿色：单子里列的不一定是好事（试看：差商家干的事打了绿勾）
      const tx = xhLeft(xhT(S, r, 136, y + 10, W - 176, RH - 20, { parent: pp, size: FZ, color: PRO_INK }));
      return { bx, tick, tx };
    });
    let st = null, Ts = 0;
    if (d.章) {
      Ts = Math.max(S.say(d.章), ts[n - 1] + 0.4);
      st = S.box(W - 268, H - 150, 240, 124, { border: '9px solid var(--bad)', borderRadius: '18px', boxSizing: 'border-box', transformOrigin: '50% 50%', background: 'rgba(239,230,210,.86)' }, pp);
      xhT(S,d.章, 10, 4, 202, 98, { parent: st, size: 78, color: 'var(--bad)' }); S.shake(Ts + 0.1, 7);
    }
    return t => {
      const g = Math.max(d.题 ? 0 : 1, its.reduce((x, _, i) => x + S.P(t, ts[i] - 0.3, ts[i] + 0.05, S.E.outC), 0));   // 说到第几行，纸就长到第几行，不空着等
      const hNow = top + g * RH + 40 + (d.章 ? 30 * S.P(t, Ts - 0.3, Ts - 0.02, S.E.outC) : 0); pp.style.height = hNow.toFixed(1) + 'px'; pp.style.overflow = hNow < H - 0.5 ? 'hidden' : 'visible';
      const k = S.P(t, S.in, S.in + 0.45, S.E.outB); S.set(pp, { o: S.P(t, S.in, S.in + 0.15), y: (1 - k) * 50 + (H - hNow) / 2, r: -1 });
      if (bg) bg.upd(t, S.in + 0.25, (H - hNow) / 2);
      its.forEach((it, i) => { const a = S.P(t, ts[i] - 0.05, ts[i] + 0.2); it.tx.style.opacity = a.toFixed(3); it.bx.style.opacity = (0.3 + 0.7 * a).toFixed(3); it.tick(S.P(t, ts[i] + 0.12, ts[i] + 0.42, S.E.outC)); });
      if (st) { const q = S.P(t, Ts, Ts + 0.22, S.E.outC); S.set(st, { o: S.P(t, Ts, Ts + 0.08), s: 1.9 - 0.9 * q, r: -8 }); }
    };
  },

  流程(S, d) {          // 几步连着走：每一步一个图标、一个短词，往下一根线接着。{步[2..4]{图标, 词}}
    const st = d.步, n = st.length, RH = n > 3 ? 182 : n === 3 ? 236 : 310, D = n > 3 ? 124 : 156, y0 = (780 - n * RH) / 2, X = 46;
    const ts = xhSeq(st.map((s, i) => i ? S.say(s.词) : Math.min(S.say(s.词), S.in + 0.4)), 0.35);
    const FZ = xhSame(st.map(s => s.词), 770 - (X + D + 40) - 24, 160, 96);
    const rows = st.map((s, i) => {
      const cy = y0 + i * RH + RH / 2;
      const ln = i < n - 1 ? S.box(X + D / 2 - 4, cy + D / 2 + 14, 8, RH - D - 28, { background: 'var(--acc)', borderRadius: '4px', transformOrigin: '50% 0', opacity: '0.6' }) : null;
      const disc = S.box(X, cy - D / 2, D, D, { borderRadius: '50%', background: 'color-mix(in srgb, var(--ink) 7%, transparent)', border: '5px solid var(--acc)', boxSizing: 'border-box' });
      const ic = S.icon(s.图标, Math.round(D * 0.54), Math.round(D * 0.23) - 5, Math.round(D * 0.23) - 5, { parent: disc });
      const tx = xhLeft(xhT(S, s.词, X + D + 40, cy - 80, 770 - (X + D + 40) - 24, 160, { size: FZ }));
      return { ln, disc, ic, tx };
    });
    return t => rows.forEach((r, i) => {
      const T = ts[i], k = S.P(t, T - 0.05, T + 0.35, S.E.outB);
      S.set(r.disc, { o: S.P(t, T - 0.05, T + 0.1), s: 0.6 + 0.4 * k }); r.ic.draw(S.P(t, T, T + 0.6, S.E.outC)); S.pop(r.tx, t, T, { dy: 0, from: 1.12 });
      if (r.ln) r.ln.style.transform = `scaleY(${S.P(t, T + 0.3, Math.max(T + 0.6, ts[i + 1] - 0.05), S.E.ioC).toFixed(4)})`;
    });
  },

  主角(S, d) {          // 一样东西当主角，旁边贴一到三张标签。{图标, 名?, 签[1..3]}
    const tags = d.签, n = tags.length, IC = 250, ix = 34, iy = d.名 ? 160 : 265;
    const g = S.svg(0, 0, 770, 780);
    const ring = S.box(ix - 18, iy - 18, IC + 36, IC + 36, { borderRadius: '50%', background: 'color-mix(in srgb, var(--ink) 6%, transparent)', border: '4px solid color-mix(in srgb, var(--ink) 20%, transparent)', boxSizing: 'border-box' });
    const ic = S.icon(d.图标, 170, ix + 40, iy + 40);
    let nm = null, Tn = 0; if (d.名) { Tn = S.say(d.名); nm = xhT(S,d.名, 0, iy + IC + 30, 330, 190, { size: 78 }); }
    const TH = n === 1 ? 190 : n === 2 ? 160 : 132, gap = 36, tot = n * TH + (n - 1) * gap, ty0 = (780 - tot) / 2, tx0 = 366, TW = 384;
    const ts = xhSeq(tags.map(w => S.say(w))), FZ = xhSame(tags, TW - 36, TH - 16, 80);
    const rows = tags.map((w, i) => {
      const y = ty0 + i * (TH + gap), ln = xhLine(S, g, `M${ix + IC + 22} ${iy + IC / 2}C${ix + IC + 66} ${iy + IC / 2} ${tx0 - 60} ${y + TH / 2} ${tx0 - 8} ${y + TH / 2}`, 5, 'color-mix(in srgb, var(--ink) 42%, transparent)');
      return { p: xhSlip(S, w, tx0, y, TW, TH, FZ), ln, r: [-2, 1.6, -1.2][i] };
    });
    return t => {
      ic.draw(S.P(t, S.in, S.in + 0.8, S.E.outC)); S.set(ring, { o: S.P(t, S.in, S.in + 0.2), s: 0.85 + 0.15 * S.P(t, S.in, S.in + 0.5, S.E.outB) }); if (nm) S.pop(nm, t, Tn);
      rows.forEach((r, i) => { const T = ts[i], k = S.P(t, T, T + 0.4, S.E.outB); S.dash(r.ln, S.P(t, T - 0.18, T + 0.12)); S.set(r.p, { o: S.P(t, T, T + 0.12), x: (1 - k) * 60, r: r.r }); });
    };
  },

  问答(S, d) {          // 一问一答：上面是人问的一句，下面是答的一句。{问, 答, 答的?: 图标}
    const Tq = Math.min(S.say(d.问), S.in + 0.3), Ta = Math.max(S.say(d.答), Tq + 0.6);
    const qb = S.paper(24, 44, 600, 280); qb.style.borderRadius = '40px 40px 8px 40px';
    xhT(S,d.问, 30, 20, 540, 240, { parent: qb, size: 90, color: PRO_INK });
    const qi = S.box(644, 214, 110, 110, { borderRadius: '50%', background: 'color-mix(in srgb, var(--ink) 14%, transparent)' }); const qic = S.icon('user', 66, 22, 22, { parent: qi, color: 'var(--ink)' });
    const ab = S.box(146, 420, 600, 300, { borderRadius: '8px 40px 40px 40px', background: 'color-mix(in srgb, var(--ink) 7%, transparent)', border: '5px solid var(--acc)', boxSizing: 'border-box' });
    xhT(S,d.答, 30, 20, 530, 250, { parent: ab, size: 90, color: 'var(--ink)' });
    const ai = S.box(16, 420, 110, 110, { borderRadius: '50%', background: 'var(--acc)' }); const aic = S.icon(d.答的 || 'message-circle', 66, 22, 22, { parent: ai, color: 'var(--accInk)' });
    return t => {
      const k = S.P(t, Tq, Tq + 0.4, S.E.outB), q = S.P(t, Ta, Ta + 0.4, S.E.outB);
      S.set(qb, { o: S.P(t, Tq, Tq + 0.12), y: (1 - k) * 40 }); S.set(qi, { o: S.P(t, Tq, Tq + 0.12), s: 0.6 + 0.4 * k }); qic.draw(S.P(t, Tq, Tq + 0.5));
      S.set(ab, { o: S.P(t, Ta, Ta + 0.12), y: (1 - q) * 40 }); S.set(ai, { o: S.P(t, Ta - 0.25, Ta - 0.1), s: 0.6 + 0.4 * S.P(t, Ta - 0.25, Ta + 0.1, S.E.outB) }); aic.draw(S.P(t, Ta - 0.2, Ta + 0.4));
    };
  },

  不是(S, d) {          // 不是这个，是那个：上面那张被一笔划掉，下面那个亮出来。{不是, 是}
    const Tn = Math.min(S.say(d.不是), S.in + 0.4), Ty = Math.max(S.say(d.是), Tn + 1.0), Tx = Math.min(Tn + 0.75, Ty - 0.4);
    const p = S.paper(95, 70, 580, 210); xhT(S,d.不是, 30, 20, 520, 170, { parent: p, size: 92, color: PRO_INK });
    const g = S.svg(0, 0, 770, 780), ln = xhLine(S, g, 'M64 196L706 154', 18, 'var(--bad)'); S.dash(ln, 0);
    const ar = S.arrow([[385, 318], [385, 404]], 10);
    const yes = xhT(S,d.是, 30, 424, 710, 236, { size: 136, color: 'var(--ink)' });
    const ul = S.box(185, 676, 400, 14, { background: 'var(--acc)', borderRadius: '7px', transformOrigin: '0 50%' });
    S.shake(Ty + 0.1, 6);
    return t => {
      const k = S.P(t, S.in, S.in + 0.45, S.E.outB), x = S.P(t, Tx, Tx + 0.3, S.E.outC);
      S.set(p, { o: S.P(t, S.in, S.in + 0.15) * (1 - 0.4 * x), y: (1 - k) * 40, r: -1.5 }); S.dash(ln, x); ar(S.P(t, Ty - 0.3, Ty + 0.05));
      S.pop(yes, t, Ty, { from: 1.35, dy: 0 }); ul.style.transform = `scaleX(${S.P(t, Ty + 0.15, Ty + 0.6, S.E.outC).toFixed(4)})`;
    };
  },

  天平(S, d) {          // 两样东西上秤：说完两边，秤往重的那边沉。{左, 右, 重: '左' | '右'}
    const Tl = S.say(d.左), Tr = S.say(d.右), T1 = Math.min(Tl, Tr, S.in + 0.6), Tt = Math.max(Tl, Tr) + 0.45, dir = d.重 === '左' ? -1 : 1, A = 9, R = 215, cx = 385, cy = 190, SW = 300, SH = 190;
    const g = S.svg(0, 0, 770, 780);
    xhLine(S, g, `M${cx} ${cy}L${cx} 700M${cx - 120} 712L${cx + 120} 712`, 12, XH_W);
    const beam = xhLine(S, g, `M${cx - R} ${cy}L${cx + R} ${cy}`, 14, 'var(--acc)'), hub = S.s('circle', { cx, cy, r: 18 }, g); hub.style.fill = 'var(--acc)';
    const strs = [-1, 1].map(s => xhLine(S, g, '', 5, XH_DIM));
    const FZ = xhSame([d.左, d.右], SW - 36, SH - 16, 78), L = xhSlip(S, d.左, cx - R - SW / 2, cy + 150, SW, SH, FZ), Rr = xhSlip(S, d.右, cx + R - SW / 2, cy + 150, SW, SH, FZ);
    return t => {
      const a = dir * A * S.P(t, Tt, Tt + 0.9, S.E.outB), dy = R * Math.sin(a * Math.PI / 180);
      beam.setAttribute('transform', `rotate(${a.toFixed(3)} ${cx} ${cy})`);
      [[L, -1, Tl], [Rr, 1, Tr]].forEach(([p, s, T], i) => {
        const y = s * dy, ex = cx + s * R * Math.cos(a * Math.PI / 180), k = S.P(t, T, T + 0.4, S.E.outB);
        strs[i].setAttribute('d', `M${ex.toFixed(1)} ${(cy + y).toFixed(1)}L${(cx + s * R - 90).toFixed(1)} ${(cy + 150 + y).toFixed(1)}M${ex.toFixed(1)} ${(cy + y).toFixed(1)}L${(cx + s * R + 90).toFixed(1)} ${(cy + 150 + y).toFixed(1)}`);
        S.set(p, { o: S.P(t, T, T + 0.12), y: y + (1 - k) * -40, s: 1 + (s === dir ? 0.05 : 0) * S.P(t, Tt + 0.3, Tt + 0.8) });
      });
      g.style.opacity = S.P(t, S.in, S.in + 0.25).toFixed(3);
    };
  },

  拉开(S, d) {          // 两条线从一个地方出发，越拉越开。{上, 下, 差?}
    const Tu = S.say(d.上), Td = S.say(d.下), Te = Math.max(Tu, Td) + 0.5, g = S.svg(0, 0, 770, 780), x0 = 60, yb = 640, x1 = 700, N = 40;
    const curve = (f) => 'M' + Array.from({ length: N + 1 }, (_, i) => { const k = i / N; return (x0 + (x1 - x0) * k).toFixed(1) + ' ' + f(k).toFixed(1); }).join('L');
    const dot = S.s('circle', { cx: x0, cy: yb - 30, r: 17 }, g); dot.style.fill = XH_W;   // 11-15 盲比：原来画了横竖两根坐标轴，讲数字的片子里像一张编出来的数据图。不画坐标，只留一个起点、两条越走越开的线
    const up = xhLine(S, g, curve(k => yb - 30 - 420 * Math.pow(k, 2.2)), 14, 'var(--acc)'), dn = xhLine(S, g, curve(k => yb - 30 - 70 * k), 14, XH_W);
    S.dash(up, 0); S.dash(dn, 0);
    const lu = xhT(S,d.上, 90, 40, 500, 130, { size: 84, color: 'var(--acc)' }), ld = xhT(S,d.下, 300, 590, 450, 110, { size: 72, color: 'var(--ink)' });
    let gap = null, lg = null, Tg = 0;
    if (d.差) { Tg = Math.max(S.say(d.差), Te); gap = xhLine(S, g, `M${x1 + 8} 216L${x1 + 8} 532M${x1 - 12} 236L${x1 + 8} 216L${x1 + 28} 236M${x1 - 12} 512L${x1 + 8} 532L${x1 + 28} 512`, 8, 'var(--bad)'); S.dash(gap, 0); lg = xhLeft(xhT(S, d.差, 96, 200, 420, 130, { size: 92, color: 'var(--bad)' })); }   // 放在两条线都够不着的左上角，颜色跟右边那道差距线一样
    return t => {
      g.style.opacity = S.P(t, S.in - 0.3, S.in - 0.1).toFixed(3);   // 11-15 夜：原来卡露满以后才开始画，开头空着半秒（盲比点过两回）。提早三成秒，卡露满的时候起点和线头已经在了
      const k = S.P(t, S.in - 0.2, Math.max(Te, S.in + 1.2), S.E.ioC); S.dash(up, k); S.dash(dn, k);
      S.pop(lu, t, Tu); S.pop(ld, t, Td); if (gap) { S.dash(gap, S.P(t, Tg, Tg + 0.4, S.E.outC)); S.pop(lg, t, Tg + 0.1, { from: 1.2, dy: 0 }); }
    };
  },

  关卡(S, d) {          // 一样东西走到一道关前：被拦下，或者放行。{来的, 图标?, 关, 结果: '拦' | '过'}
    const pass = d.结果 === '过', Tc = Math.min(S.say(d.来的), S.in + 0.3), Tg = Math.max(S.say(d.关), S.in + 0.3), Tr = Math.max(Tc, Tg) + 0.7, WX = 470;
    const sign = xhT(S,d.关, WX - 250, 30, 500, 130, { size: 84, color: 'var(--acc)' });
    const wall = S.box(WX - 11, 180, 22, 470, { background: 'var(--acc)', borderRadius: '11px', transformOrigin: '50% 0' });
    const foot = S.box(WX - 60, 650, 120, 12, { background: XH_W, borderRadius: '6px' });
    const it = S.box(0, 300, 330, d.图标 ? 300 : 180, {}), slip = xhSlip(S, d.来的, 0, d.图标 ? 130 : 0, 330, 170, 76, { parent: it });
    const ic = d.图标 ? S.icon(d.图标, 110, 110, 0, { parent: it, color: 'var(--ink)' }) : null;
    const mk = xhMark(S, pass, 150, pass ? 560 : 540, 330);
    if (!pass) S.shake(Tr + 0.05, 8);
    return t => {
      S.pop(sign, t, Tg); wall.style.opacity = S.P(t, S.in, S.in + 0.2).toFixed(3); foot.style.opacity = wall.style.opacity;
      const go = S.P(t, Tc, Tr, S.E.ioC), k = S.P(t, Tr, Tr + 0.5, S.E.outB);
      let x = -40 + 150 * go;
      if (pass) { wall.style.transform = `scaleY(${(1 - 0.82 * S.P(t, Tr - 0.1, Tr + 0.35, S.E.ioC)).toFixed(4)})`; x += 320 * S.P(t, Tr + 0.15, Tr + 0.9, S.E.ioC); } else x -= 46 * k;
      S.set(it, { o: S.P(t, Tc, Tc + 0.15), x }); if (ic) ic.draw(S.P(t, Tc, Tc + 0.6, S.E.outC));
      mk(S.P(t, Tr + (pass ? 0.7 : 0.05), Tr + (pass ? 1.05 : 0.4), S.E.outC));
    };
  },

  成对(S, d) {          // 两三张纸条上下对着摆：每张一样东西（小字）和它的下场（大字），带数的数放右边。{对:[{名, 说, 数?}]}（11-15 第七轮）
    const rows = d.对, n = rows.length, GAP = 28, W = 690, x0 = 40, TW = rows.some(r => r.数) ? W - 330 : W - 80;
    const two = n === 2 && rows.some(r => xhFit(String(r.名), TW, 72, 54).fs < 42);   // 11-15 盲比：名字长、一行放不下（「原来经营得本来就差的」），原来整张退回，丢的正是最值钱的那组数。只有两张的时候把纸条加高，名字折成两行
    const RH = n > 2 ? 210 : two ? 330 : 280, NH = n > 2 ? 60 : two ? 110 : 72, SH = RH - NH - 78, y0 = Math.round((780 - n * RH - (n - 1) * GAP) / 2);
    const FN = xhSame(rows.map(r => r.名), TW, NH, 54), FS = xhSame(rows.map(r => r.说), TW, SH, 88);
    const its = rows.map((r, i) => {
      const pp = S.paper(x0, y0 + i * (RH + GAP), W, RH);
      const nm = xhLeft(xhT(S, r.名, 40, 22, TW, NH, { parent: pp, size: FN, color: 'rgba(34,30,23,.62)' }));
      S.box(40, 22 + NH + 10, 96, 7, { background: 'var(--acc)', borderRadius: '4px' }, pp);
      const sy = xhLeft(xhT(S, r.说, 40, 22 + NH + 34, TW, SH, { parent: pp, size: FS, color: PRO_INK }));
      const nu = r.数 ? S.num(r.数, W - 290, 20, 260, RH - 40, { size: 130, parent: pp, color: PRO_INK }) : null;
      return { pp, sy, nu, Tn: i ? S.say(r.名) : Math.min(S.say(r.名), S.in + 0.4), Ts: S.say(r.说), Tu: r.数 ? S.say(r.数) : 0 };
    });
    const H0 = 22 + NH + 10 + 7 + 24;                       // 11-16：纸条只有名字那一截的高度
    its.forEach((it, i) => { if (i) it.Tn = Math.max(it.Tn, its[i - 1].Tn + 0.4); it.Ts = Math.max(it.Ts, it.Tn + 0.15); if (it.nu) it.Tu = Math.max(it.Tu, it.Tn + 0.15); });
    return t => its.forEach(it => {
      S.set(it.pp, { o: S.P(t, it.Tn - 0.3, it.Tn - 0.05), y: 36 * (1 - S.P(t, it.Tn - 0.3, it.Tn + 0.1, S.E.outC)) });
      const Tg = it.nu ? Math.min(it.Ts, it.Tu) : it.Ts;      // 11-16：名字说完隔一秒以上才说下场的，纸条先只有名字那么高，快说到了再长开，不空着等
      if (Tg - it.Tn > 1.0) { const g = S.P(t, Tg - 0.34, Tg - 0.04, S.E.outC); it.pp.style.height = (H0 + (RH - H0) * g).toFixed(1) + 'px'; it.pp.style.overflow = g < 1 ? 'hidden' : 'visible'; }
      S.pop(it.sy, t, it.Ts); if (it.nu) S.pop(it.nu, t, it.Tu, { from: 1.25, dy: 0 });
    });
  },
  里外(S, d) {          // 一道门：里头的照旧，外头的进不去。{里, 外}
    const Ti = S.say(d.里), To = Math.max(S.say(d.外), S.in + 0.3), g = S.svg(0, 0, 770, 780), X = 300, Y = 90, W = 440, H = 560, dy0 = 300, dy1 = 450;
    const room = xhLine(S, g, `M${X} ${Y + dy0}L${X} ${Y + 28}Q${X} ${Y} ${X + 28} ${Y}L${X + W - 28} ${Y}Q${X + W} ${Y} ${X + W} ${Y + 28}L${X + W} ${Y + H - 28}Q${X + W} ${Y + H} ${X + W - 28} ${Y + H}L${X + 28} ${Y + H}Q${X} ${Y + H} ${X} ${Y + H - 28}L${X} ${Y + dy1}`, 10, XH_W); S.dash(room, 0);
    const door = xhLine(S, g, `M${X} ${Y + dy0}L${X} ${Y + dy1}`, 16, 'var(--bad)'); S.dash(door, 0);
    const ins = S.icon('users', 170, X + 135, Y + 70, { color: 'var(--acc)' }), li = xhT(S,d.里, X + 30, Y + 270, W - 60, 230, { size: 80, color: 'var(--ink)' });
    const who = S.box(40, Y + dy0 - 5, 150, 150, {}), wic = S.icon('user', 150, 0, 0, { parent: who, color: 'var(--ink)' });
    const lo = xhT(S,d.外, 0, Y + dy1 + 40, 280, 190, { size: 68, color: 'var(--ink)' });
    S.shake(To + 0.75, 6);
    return t => {
      S.dash(room, S.P(t, S.in, S.in + 0.9, S.E.ioC)); ins.draw(S.P(t, S.in + 0.2, S.in + 1.0, S.E.outC)); S.pop(li, t, Ti);
      const go = S.P(t, To, To + 0.7, S.E.ioC), back = S.P(t, To + 0.7, To + 1.1, S.E.outB);
      S.set(who, { o: S.P(t, To, To + 0.15), x: -30 + 110 * go - 60 * back }); wic.draw(S.P(t, To, To + 0.5)); S.dash(door, S.P(t, To + 0.55, To + 0.8)); S.pop(lo, t, To + 0.3);
    };
  },

  连锁(S, d) {          // 一环推一环：几张牌往下一张推一张，最后一张是结果。{环[3..4]}
    const ws = d.环, n = ws.length, W = 400, H = 150, x0 = 10, dx = (770 - 2 * x0 - W) / (n - 1), dyy = Math.min(250, (780 - 60 - H) / (n - 1)), y0 = (780 - (n - 1) * dyy - H) / 2;
    const ts = xhSeq(ws.map((w, i) => i ? S.say(w) : Math.min(S.say(w), S.in + 0.4)), 0.35);
    const FZ = xhSame(ws, W - 36, H - 16, 74);
    const rows = ws.map((w, i) => {
      const x = x0 + i * dx, y = y0 + i * dyy, last = i === n - 1;
      const ar = i < n - 1 ? S.arrow([[x + 70, y + H + 12], [x + 70, y + dyy + H / 2], [x + dx - 16, y + dyy + H / 2]], 9) : null;
      const p = xhSlip(S, w, x, y, W, H, FZ, last ? { bg: 'var(--acc)', color: 'var(--accInk)' } : {});
      return { p, ar, r: last ? 0 : [-1.5, 1.2, -1][i % 3] };
    });
    S.shake(ts[n - 1] + 0.12, 6);
    return t => rows.forEach((r, i) => {
      const T = ts[i], k = S.P(t, T, T + 0.4, S.E.outB);
      S.set(r.p, { o: S.P(t, T, T + 0.12), y: (1 - k) * -46, r: r.r + (1 - k) * -8 });
      if (r.ar) r.ar(S.P(t, Math.max(T + 0.35, ts[i + 1] - 0.45), ts[i + 1] - 0.02, S.E.ioC));
    });
  },

  挑出(S, d) {          // 一大片里头挑出几个：一片小方块铺开，数砸下来，最后只剩几块亮着。{数?, 词, 几?: 1 到 5}
    const Tw = S.say(d.词), Tn = d.数 ? S.say(d.数) : 0, T1 = d.数 ? Math.min(Tn, Tw) : Tw, g = S.svg(0, 0, 770, 780), dots = [], C = 14, Rw = d.数 ? 7 : 9;
    for (let i = 0; i < C * Rw; i++) { const r = S.s('rect', { x: 42 + (i % C) * 50, y: 40 + Math.floor(i / C) * 50, width: 34, height: 34, rx: 7 }, g); r.style.fill = 'color-mix(in srgb, var(--ink) 18%, transparent)'; dots.push(r); }
    const m = Math.max(1, Math.min(5, d.几 || 3)), pick = [C * 2 + 4, C * 4 + 9, C * 1 + 11, C * 5 + 2, C * 3 + 6].slice(0, m);
    const nb = d.数 ? S.num(d.数, 85, 400, 600, 190, { size: 170, color: 'var(--ink)' }) : null;
    const lab = xhT(S,d.词, 35, d.数 ? 600 : 530, 700, d.数 ? 140 : 190, { size: d.数 ? 84 : 110, color: 'var(--acc)' });
    if (nb) S.shake(Tn + 0.1, 7);
    return t => {
      const k = S.P(t, S.in, Math.max(S.in + 0.9, T1), S.E.outC), q = S.P(t, Tw, Tw + 0.5);
      dots.forEach((e, i) => { const on = i / dots.length < k ? 1 : 0, hit = pick.includes(i); e.style.opacity = hit ? on : (on * (1 - 0.72 * q)).toFixed(3); e.style.fill = hit && q > 0.5 ? 'var(--acc)' : 'color-mix(in srgb, var(--ink) 18%, transparent)'; });
      if (nb) S.pop(nb, t, Tn, { from: 1.4, dy: 0 }); S.pop(lab, t, Tw);
    };
  },

  循环(S, d) {          // 一个圈：几样东西首尾相接，转起来。{点[3..5]}
    const ws = d.点, n = ws.length, cx = 385, cy = 390, SW = n === 5 ? 240 : 300, SH = n === 5 ? 120 : 130, RX = (770 - SW) / 2 - 4, RY = 300, g = S.svg(0, 0, 770, 780);
    const ang = i => -Math.PI / 2 + i * 2 * Math.PI / n, pt = a => [cx + Math.cos(a) * RX, cy + Math.sin(a) * RY];
    const ts = xhSeq(ws.map((w, i) => i ? S.say(w) : Math.min(S.say(w), S.in + 0.4)), 0.3), Tend = ts[n - 1] + 0.5;
    const mid = S.icon('repeat', 150, cx - 75, cy - 75, { color: 'color-mix(in srgb, var(--ink) 28%, transparent)' });
    const clear = (i, dir) => { const [nx, ny] = pt(ang(i)); for (let dl = 0.04; dl < 1.3; dl += 0.02) { const [x, y] = pt(ang(i) + dir * dl); if (Math.abs(x - nx) > SW / 2 + 18 || Math.abs(y - ny) > SH / 2 + 18) return dl; } return 1.3; };   // 从这张纸条底下钻出来要转多少
    const arcs = ws.map((w, i) => { let a0 = ang(i) + clear(i, 1), a1 = ang(i + 1) - clear((i + 1) % n, -1); const q = [];
      if (a1 < a0 + 0.04) { const m = (a0 + a1) / 2; a0 = m - 0.02; a1 = m + 0.02; }                                    // 两张纸条挨得近：只剩一个箭头尖
      for (let j = 0; j <= 16; j++) q.push(pt(a0 + (a1 - a0) * j / 16).map(v => v.toFixed(1)).join(' '));
      const [ex, ey] = pt(a1), ta = Math.atan2(RY * Math.cos(a1), -RX * Math.sin(a1)), hp = s => (ex - 26 * Math.cos(ta + s)).toFixed(1) + ' ' + (ey - 26 * Math.sin(ta + s)).toFixed(1);
      const p = xhLine(S, g, 'M' + q.join('L') + `M${hp(0.5)}L${ex.toFixed(1)} ${ey.toFixed(1)}L${hp(-0.5)}`, 9, 'var(--acc)'); S.dash(p, 0); return p; });
    const FZ = xhSame(ws, SW - 36, SH - 16, 72);
    const slips = ws.map((w, i) => { const [x, y] = pt(ang(i)); return xhSlip(S, w, x - SW / 2, y - SH / 2, SW, SH, FZ); });
    const dot = S.s('circle', { r: 13 }, g); dot.style.fill = 'var(--ink)';
    return t => {
      mid.draw(S.P(t, S.in, S.in + 0.8, S.E.outC));
      slips.forEach((p, i) => { const T = ts[i], k = S.P(t, T, T + 0.4, S.E.outB); S.set(p, { o: S.P(t, T, T + 0.12), s: 0.7 + 0.3 * k }); S.dash(arcs[i], S.P(t, i < n - 1 ? Math.max(T + 0.3, ts[i + 1] - 0.4) : T + 0.35, i < n - 1 ? ts[i + 1] : T + 0.8, S.E.ioC)); });
      const a = -Math.PI / 2 + Math.max(0, t - Tend) * 1.5, [x, y] = pt(a); dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1)); dot.style.opacity = S.P(t, Tend, Tend + 0.2).toFixed(3);
    };
  },

  配上(S, d) {          // 两样东西对上了：一左一右靠到一起，咔一下。{左{图标, 词}, 右{图标, 词}, 合?}
    const Tl = Math.min(S.say(d.左.词), S.in + 0.4), Tr = Math.max(S.say(d.右.词), Tl + 0.4), Tm = d.合 ? Math.max(S.say(d.合), Tr + 0.5) : Tr + 0.7, D = 270, y = d.合 ? 60 : 150;
    const mk = (o, x) => { const b = S.box(x, y, D, D, { borderRadius: '50%', background: 'color-mix(in srgb, var(--ink) 7%, transparent)', border: '7px solid var(--acc)', boxSizing: 'border-box' }); return { b, ic: S.icon(o.图标, 150, 53, 53, { parent: b }) }; };
    const A = mk(d.左, 25), B = mk(d.右, 475);            // 靠拢以后：左圆 55–325，右圆 445–715，中间正好放下那个勾（开头各往里收了 15，右圆不出 745 那条线）
    const FZ = xhSame([d.左.词, d.右.词], 330, 150, 88), la = xhT(S, d.左.词, 25, y + D + 34, 330, 150, { size: FZ }), lb = xhT(S, d.右.词, 415, y + D + 34, 330, 150, { size: FZ });
    const bd = S.box(325, y + D / 2 - 60, 120, 120, { borderRadius: '50%', background: 'var(--good)', transformOrigin: '50% 50%' }), ok = xhMark(S, true, 84, 18, 18, bd, 'var(--accInk)');
    const all = d.合 ? xhT(S,d.合, 35, 560, 700, 170, { size: 110, color: 'var(--acc)' }) : null;
    S.shake(Tm + 0.05, 6);
    return t => {
      const m = S.P(t, Tm - 0.35, Tm, S.E.ioC);
      S.set(A.b, { o: S.P(t, Tl, Tl + 0.12), x: 30 * m, s: 0.6 + 0.4 * S.P(t, Tl, Tl + 0.4, S.E.outB) }); A.ic.draw(S.P(t, Tl, Tl + 0.6, S.E.outC));
      S.set(B.b, { o: S.P(t, Tr, Tr + 0.12), x: -30 * m, s: 0.6 + 0.4 * S.P(t, Tr, Tr + 0.4, S.E.outB) }); B.ic.draw(S.P(t, Tr, Tr + 0.6, S.E.outC));
      S.set(bd, { o: S.P(t, Tm - 0.02, Tm + 0.1), s: 0.4 + 0.6 * S.P(t, Tm, Tm + 0.35, S.E.outB) });
      S.pop(la, t, Tl + 0.1); S.pop(lb, t, Tr + 0.1); ok(S.P(t, Tm + 0.08, Tm + 0.38, S.E.outC)); if (all) S.pop(all, t, Tm, { from: 1.25, dy: 0 });
    };
  },
});

// 11-16：装字的框（单子、标题、引话）带的那个图标：一块圆底托着，鼓出来，图标描出来以后照样有小动作
function xhBadge(S, name, x, y, D = 112) {
  if (!name || !ICONS[name]) return null;
  const b = S.box(x, y, D, D, { borderRadius: '50%', background: 'var(--acc)', transformOrigin: '50% 50%', boxShadow: '0 10px 24px rgba(0,0,0,.35)' });
  const ic = S.icon(name, Math.round(D * 0.6), Math.round(D * 0.2), Math.round(D * 0.2), { parent: b, color: PRO_INK });
  return { b, upd(t, T, dy) { const k = P(t, T, T + 0.4, E.outB); set(b, { o: P(t, T, T + 0.1), s: 0.5 + 0.5 * k, y: dy || 0 }); ic.draw(P(t, T + 0.08, T + 0.6, E.outC)); } };
}
// 11-14 夜：三样基本件（标题、引一句、图标词）也换成自己的放字（按词折行、放得下就放大）。原来那版算好折两行却没真折，字缩得很小。
Object.assign(HUA_KIT, {
  标题(S, big, small, icn) {       // 一句要紧的话当标题：大字砸下来，底下一道重点色，小字是补一句。11-16：填了图标的，大字上头多一块圆底托着它
    if (window.BAN_ON && small && /^第[一二三四五六七八九十\d]+[个点条件]?[呢啊]?$/.test(small)) small = null;   // 左上角有段号了，卡上再写「第三个」会和「第 4 段」打架
    const bg = xhBadge(S, icn, 329, small ? 0 : 36);
    const T = S.in, b = bg ? xhT(S, big, 20, small ? 122 : 170, 730, small ? 368 : 400, { size: 176 }) : xhT(S, big, 20, small ? 70 : 150, 730, 420, { size: 176 });
    const ul = S.box(235, small ? 512 : 592, 300, 14, { background: 'var(--acc)', borderRadius: '7px', transformOrigin: '0 50%' });
    let sm, Ts; if (small) { Ts = S.say(small); sm = xhT(S, small, 60, 548, 650, 140, { size: 76, color: 'var(--sub)' }); }
    S.shake(T + 0.1, 5);
    return t => { S.pop(b, t, T, { from: 1.3, dy: 0 }); ul.style.transform = `scaleX(${P(t, T + 0.12, T + 0.6, E.outC).toFixed(4)})`; if (sm) S.pop(sm, t, Ts); if (bg) bg.upd(t, T + 0.2); };
  },
  引话(S, words, who, icn) {       // 别人说的一句话：一张纸、一个大引号。11-16：填了图标的，纸的右上角多一块圆底托着它
    const T = S.in, pp = S.paper(35, who ? 120 : 160, 700, 460), bg = xhBadge(S, icn, 35 + 700 - 136, (who ? 120 : 160) - 50);
    S.el('div', { position: 'absolute', left: '34px', top: '-6px', font: '210px Glow', color: 'var(--acc)', lineHeight: '1' }, pp, '“');
    xhT(S, words, 46, 136, 608, 290, { parent: pp, size: 104, color: PRO_INK, lines: xhByLine(S, words) });   // 11-15 盲比：跨了几句字幕的话照句子断行
    let w, Tw; if (who) { Tw = S.say(who); w = xhT(S, who, 195, 600, 540, 110, { size: 72, color: 'var(--sub)' }); }
    return t => { const k = P(t, T, T + 0.45, E.outB); set(pp, { o: P(t, T, T + 0.15), y: (1 - k) * 50, r: -1.5 }); if (w) S.pop(w, t, Tw); if (bg) bg.upd(t, T + 0.25); };
  },
  图标词(S, name, word, small) {   // 一个图标配一个词。11-16：四种摆法轮着用（补的图标词一多，一个样子连着看会腻）；带小字的、词长的只用上下两种
    if (!word) { const a = S.in, ic = S.icon(name, 300, 235, 70); return t => { ic.draw(P(t, a, a + 0.7, E.outC)); set(ic.e, { o: P(t, a, a + 0.1) }); }; }      // 11-17：补的词太长又取不出短词的，只画图标（底下字幕照出）
    const a = S.in, T = S.bu ? (S.say(word), a + 0.12) : S.say(word), side = !small && uW(String(word)) <= 4;      // 补的图标词：字跟着图标一起进，不等嘴说到
    const v = side ? HUA_TB.n++ % 4 : [0, 2][HUA_TB.m++ % 2];
    if (v === 0 || v === 2) {                              // 0 图标在上，一笔一笔描出来；2 一块圆底托着图标，鼓出来。词都在下面
      let ic, bd = null;
      if (v === 0) ic = S.icon(name, 300, 235, small ? 40 : 70);
      else { bd = S.box(240, small ? 35 : 65, 290, 290, { borderRadius: '50%', background: 'var(--acc)', transformOrigin: '50% 50%' }); ic = S.icon(name, 176, 57, 57, { parent: bd, color: PRO_INK }); }
      const b = xhT(S, word, 25, small ? 360 : 400, 720, 250, { size: 150 });
      let sm, Ts; if (small) { Ts = S.say(small); sm = xhT(S, small, 60, 630, 650, 120, { size: 70, color: 'var(--sub)' }); }
      return t => {
        if (bd) { const k = P(t, a, a + 0.42, E.outB); set(bd, { o: P(t, a, a + 0.12), s: 0.6 + 0.4 * k }); ic.draw(P(t, a + 0.12, a + 0.75, E.outC)); }
        else { ic.draw(P(t, a, a + 0.7, E.outC)); set(ic.e, { o: P(t, a, a + 0.1) }); }
        S.pop(b, t, T, { from: 1.2, dy: 0 }); if (sm) S.pop(sm, t, Ts); };
    }
    if (v === 1) {                                         // 1 图标在左，从左边滑进来；词在右
      const ic = S.icon(name, 220, 30, 220), b = xhT(S, word, 272, 205, 470, 250, { size: 150 });
      return t => { const k = P(t, a, a + 0.45, E.outC); ic.draw(P(t, a, a + 0.6, E.outC)); set(ic.e, { o: P(t, a, a + 0.12), x: (k - 1) * 36 }); S.pop(b, t, T, { from: 1.15, dy: 0 }); };
    }
    const b = xhT(S, word, -30, 205, 515, 250, { size: 150 }), ic = S.icon(name, 220, 515, 220);      // 3 词在左，底下画一道线；图标在右，描出来
    const ul = S.box(28, 474, 400, 12, { background: 'var(--acc)', borderRadius: '6px', transformOrigin: '0 50%' });
    return t => { ic.draw(P(t, a, a + 0.7, E.outC)); set(ic.e, { o: P(t, a, a + 0.1) }); S.pop(b, t, T, { from: 1.15, dy: 0 }); ul.style.transform = `scaleX(${P(t, T + 0.15, T + 0.6, E.outC).toFixed(4)})`; };
  },
});
