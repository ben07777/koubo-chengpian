
// ---------- 专业版·画面件（2026-11-15 从试验夹搬入）：只有专业版的片子，出片程序才把这个文件夹里的四份脚本接在 seek.js 后面；免费版拿到的 seek.js 一个字不变 ----------
// 一种新的动画卡「小画面」：画法都是现成的（标题、引话、图标词，加 3_小画面.js 里的十三种），云端模型只填词和图标名，不写代码。
// 把关：字只许是这几句字幕里原样的字；东西不许出框、字不许太小；出一点岔子这张卡整张不要，这几句当场退回一屏一句。
window.HUA_BAD = [];
const HUA_SYM = /[\s→←↑↓↗↘✓✔✗✕×·•…?!？！+＋=≠<>＜＞:：“”"'「」《》（）()、，。,／\/|~～—-]/g;
const huaNorm = s => String(s).replace(HUA_SYM, '');
function huaFlat(sc) {            // 这张卡盖住的几句：一个字一格 [字, 开口的秒]
  const flat = [], gone = new Set((sc.shan || []).map(x => x[0] + ':' + x[1]));      // shan：这张卡上的字是少抄了几个字的短写法，把关那头认过了；这里照样把那几个字拿掉再查字、取时刻（片子底下的字幕不动）
  for (let i = sc.la; i < sc.lb; i++) { let p = 0; LN[i].cs.forEach(c => { for (const ch of c[0]) { if (/\s/.test(ch)) continue; const k = i + ':' + (p++); if (!gone.has(k) && huaNorm(ch)) flat.push([ch, c[1]]); } }); }
  return flat;
}
function huaApi(sc, root) {
  const flat = huaFlat(sc), TXT = flat.map(c => c[0]).join('');
  const find = w => { const k = huaNorm(w), i = k ? TXT.indexOf(k) : -1; if (i < 0) throw new Error('这几句字幕里没有「' + w + '」'); return i; };
  const S = {
    root, W: 770, H: 780, t0: sc.t0, t1: sc.t1, in: sc.t0 + 0.35, P, E, clamp, lerp, set,
    lines: LN.slice(sc.la, sc.lb).map(l => ({ text: lineText(l), t0: l.t0, t1: l.t1 })),
    C: { acc: 'var(--acc)', acc2: 'var(--acc2)', ink: 'var(--ink)', sub: 'var(--sub)', good: 'var(--good)', bad: 'var(--bad)', paper: PRO_PAPER, paperInk: PRO_INK, card: 'var(--card)', line: 'var(--cardLine)' },
    say: w => Math.max(flat[find(w)][1], sc.t0 + 0.35),          // 这个词开口的秒（卡还没露满就说到的，等卡露满）
    el(tag, style, parent, text) { const e = document.createElement(tag); if (style) Object.assign(e.style, style); if (text != null) e.textContent = text; (parent || root).appendChild(e); return e; },
    box(x, y, w, h, style, parent) { return S.el('div', Object.assign({ position: 'absolute', left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }, style || {}), parent); },
    paper(x, y, w, h, parent) { return proPaper(parent || root, x, y, w, h); },
    text(s, x, y, w, h, o = {}) { const b = S.box(x, y, w, h, null, o.parent); proText(b, String(s), w, h, o.size || 96, o.color); return b; },
    num(s, x, y, w, h, o = {}) {
      const b = S.box(x, y, w, h, { display: 'flex', alignItems: 'center', justifyContent: 'center', transformOrigin: '50% 60%' }, o.parent); if (o.color) b.style.color = o.color;
      const m = /^([^\d零一二两三四五六七八九十百千]*)(\d[\d.,]*|[零一二两三四五六七八九十百千]+)(.*)$/.exec(String(s));
      proNum(b, m ? { pre: m[1], n: m[2], u: m[3] } : { pre: '', n: String(s), u: '' }, w, o.size || 220); return b;
    },
    icon(name, size, x, y, o = {}) {
      if (!ICONS[name]) throw new Error('没有这个图标：' + name);
      const e = icon(name, size, o.parent || root, { position: 'absolute', left: x + 'px', top: y + 'px', color: o.color || 'var(--acc)' }); return { e, draw: drawOn(e) };
    },
    arrow(pts, sw, parent) { return proArrow(parent || root, pts, sw || 10); },
    ring(x, y, w, h, sw, parent) { return proHand(parent || root, x, y, w, h, sw || 10, sc.idx + 1); },
    svg(x, y, w, h, parent) { return svgBox(parent || root, x, y, w, h); },
    s(tag, attrs, parent) { return svgEl(tag, attrs, parent); },
    dash,
    pop(e, t, T, o = {}) {                                       // 一样东西在 T 秒出来：淡进、往上落定；o.from 给了就从这个倍数缩回 1
      const k = P(t, T, T + (o.d || 0.4), E.outB), q = { o: P(t, T - 0.02, T + 0.14), y: (1 - k) * (o.dy == null ? 36 : o.dy) };
      if (o.from) q.s = o.from + (1 - o.from) * k; if (o.r) q.r = o.r; set(e, q);
    },
    shake(T, amp) { SHAKES.push([T, amp || 6]); },
  };
  S.件 = { 标题: (a, b) => HUA_KIT.标题(S, a, b), 引话: (a, b) => HUA_KIT.引话(S, a, b), 图标词: (a, b, c) => HUA_KIT.图标词(S, a, b, c) };
  S._txt = TXT; S.bu = !!sc.bu;                          // bu：这张是补的图标词（字跟着图标一起进，不等嘴说到）
  return S;
}
const HUA_TB = { n: 0, m: 0 };     // 「图标词」摆到第几种了（照剧本里的先后数，同一份剧本永远一个样）
const HUA_KIT = {
  标题(S, big, small) {            // 一句要紧的话当标题：大字砸下来，底下一道重点色，小字是补一句
    const T = S.in, b = S.text(big, 20, small ? 130 : 190, 730, 320, { size: 170 });
    const ul = S.box(235, small ? 470 : 530, 300, 12, { background: 'var(--acc)', borderRadius: '6px', transformOrigin: '0 50%' });
    let sm, Ts; if (small) { Ts = S.say(small); sm = S.text(small, 60, 500, 650, 130, { size: 68, color: 'var(--sub)' }); }
    S.shake(T + 0.1, 5);
    return t => { S.pop(b, t, T, { from: 1.3, dy: 0 }); ul.style.transform = `scaleX(${P(t, T + 0.12, T + 0.6, E.outC).toFixed(4)})`; if (sm) S.pop(sm, t, Ts); };
  },
  引话(S, words, who) {            // 别人说的一句话：一张纸、一个大引号
    const T = S.in, pp = S.paper(45, 150, 680, 420);
    S.el('div', { position: 'absolute', left: '34px', top: '-6px', font: '210px Glow', color: 'var(--acc)', lineHeight: '1' }, pp, '“');
    S.text(words, 50, 130, 580, 250, { parent: pp, size: 96 });
    let w, Tw; if (who) { Tw = S.say(who); w = S.text(who, 185, 590, 540, 100, { size: 66, color: 'var(--sub)' }); }
    return t => { const k = P(t, T, T + 0.45, E.outB); set(pp, { o: P(t, T, T + 0.15), y: (1 - k) * 50, r: -1.5 }); if (w) S.pop(w, t, Tw); };
  },
  图标词(S, name, word, small) {   // 一个图标一笔一笔画出来，底下一个词（3_小画面.js 里重写了，真在用的是那一份）
    const T = S.say(word), a = S.in, ic = S.icon(name, 290, 240, 70);
    const b = S.text(word, 35, 400, 700, 200, { size: 140 });
    let sm, Ts; if (small) { Ts = S.say(small); sm = S.text(small, 60, 610, 650, 110, { size: 62, color: 'var(--sub)' }); }
    return t => { ic.draw(P(t, a, a + 0.7, E.outC)); set(ic.e, { o: P(t, a, a + 0.1) }); S.pop(b, t, T, { from: 1.2, dy: 0 }); if (sm) S.pop(sm, t, Ts); };
  },
};
function huaTextCheck(sc, root, TXT) {       // 画面上每一段字都得是这几句字幕里原样连着的字
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const k = huaNorm(n.nodeValue); if (k && !TXT.includes(k)) throw new Error('画面上的字不在这几句字幕里：「' + n.nodeValue.trim().slice(0, 30) + '」'); const fs = parseFloat(getComputedStyle(n.parentElement).fontSize); if (k && fs < 34) throw new Error('字太小（' + Math.round(fs) + '）：「' + k.slice(0, 12) + '」'); }
}
function huaOver(root) {                      // 看得见的东西有没有出框（横向 100 到 870，纵向 555 到 1335，各放 30 的余量）
  const vis = e => { let o = 1; for (let x = e; x && x !== root.parentElement; x = x.parentElement) { const c = getComputedStyle(x); if (c.display === 'none' || c.visibility === 'hidden') return 0; o *= parseFloat(c.opacity); } return o; };
  for (const e of root.querySelectorAll('*')) {
    if (e.children.length && !(e instanceof SVGElement)) continue;
    if (e.tagName === 'svg' || e.tagName === 'g' || e.tagName === 'defs') continue;
    const r0 = e.getBoundingClientRect(); if (r0.width < 2 || r0.height < 2 || vis(e) < 0.08) continue;
    let grow = false;                                        // 11-15 夜：它自己或者外面哪一层正放大着（进场那一下从 1.2、1.3 倍缩回来）：这一眼不量
    for (let x = e; x && x !== root.parentElement && !grow; x = x.parentElement) { const m = /^matrix\(([^)]+)\)/.exec(getComputedStyle(x).transform || ''); if (m) { const v = m[1].split(',').map(Number); if (Math.hypot(v[0], v[1]) > 1.02) grow = true; } }
    if (grow) continue;
    let r = { left: r0.left, right: r0.right, top: r0.top, bottom: r0.bottom };              // 11-15：外面哪一层是「超出不显示」的，就只算露在它里面的那一块；整个藏住的不算
    for (let x = e.parentElement; x && x !== root.parentElement; x = x.parentElement) if (getComputedStyle(x).overflow === 'hidden') { const c = x.getBoundingClientRect(); r = { left: Math.max(r.left, c.left), right: Math.min(r.right, c.right), top: Math.max(r.top, c.top), bottom: Math.min(r.bottom, c.bottom) }; }
    if (r.right - r.left < 2 || r.bottom - r.top < 2) continue;
    if (r.left < 66 || r.right > 904 || r.top < 520 || r.bottom > 1366) return `东西出框了（${e.tagName} 左 ${Math.round(r.left)} 右 ${Math.round(r.right)} 上 ${Math.round(r.top)} 下 ${Math.round(r.bottom)}）`;
  }
  return '';
}
PRO['小画面'] = sc => {
  const root = abs(el('div', null, null, sc.el, { height: '780px' }), 100, 10, 770);
  let upd = null, dead = false, S = null, fb = null;
  const bad = why => { if (dead) return; dead = true; window.HUA_BAD.push({ la: sc.la, lb: sc.lb, why: String(why).slice(0, 200) }); root.style.display = 'none';
    sc.hideLines = null; sc.hideLi = null; sc.fell = true; sc.el.style.left = '';      // 这张不要了：这几句照没有画面的句子出（一屏一句），字幕该出照出
    try { if (window.BAN_ON) fb = BUILD.say(sc); } catch (e) { fb = null; sc.hideSubs = false; } };
  try {
    S = huaApi(sc, root);
    if (!sc.kit || !Object.prototype.hasOwnProperty.call(HUA_KIT, sc.kit)) throw new Error('没有这种小画面');
    upd = HUA_KIT[sc.kit](S, ...(sc.args || []));
    if (typeof upd !== 'function') throw new Error('没有交回按时间更新的那个函数');
    huaTextCheck(sc, root, S._txt);
    if (sc.kit) {                                        // 卡上已经写着的那句，底下的字幕让一让：这句的字有六成以上在卡上，就不再出字幕
      const mark = new Array(S._txt.length).fill(0), w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let nd;
      while ((nd = w.nextNode())) { const k = huaNorm(nd.parentElement.dataset.w || nd.nodeValue), i = k ? S._txt.indexOf(k) : -1; if (i >= 0) for (let j = 0; j < k.length; j++) mark[i + j] = 1; }
      sc.hideLines = new Set(); let p0 = 0;
      for (let li = sc.la; li < sc.lb; li++) { const n = huaNorm(lineText(LN[li])).length; let c = 0; for (let j = 0; j < n; j++) c += mark[p0 + j] || 0; if (n && c / n >= 0.6) sc.hideLines.add(li); p0 += n; }
    }
  } catch (e) { bad(e && e.message || e); }
  sc.hua = { root, bad, empty() { if (dead) return; let n = 0; for (const e of root.querySelectorAll('*')) { if (e.children.length && !(e instanceof SVGElement)) continue; if (e.tagName === 'svg' || e.tagName === 'g') continue; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; let o = 1; for (let x = e; x && x !== root.parentElement; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity); if (o > 0.3) n++; } if (!n) bad('卡进来一秒了，画面还是空的'); }, check() { if (dead) return; try { huaTextCheck(sc, root, S._txt); const o = huaOver(root); if (o) bad(o); } catch (e) { bad(e && e.message || e); } } };
  return t => { if (!dead) { try { upd(t); } catch (e) { bad(e && e.message || e); } } if (dead && fb) fb(t); };
};
window.huaProbe = () => {          // 出片之前先过一遍：每张小画面的卡在开头、中间、快完的时候各看一眼
  let n = 0;
  for (const sc of SCN) { if (sc.kind !== '小画面' || !sc.hua) continue; n++;
    window.seek(sc.t0 + 1.0); sc.hua.empty();
    for (const t of [sc.t0 + 0.5, (sc.t0 + sc.t1) / 2, sc.t1 - 0.3]) { window.seek(t); sc.hua.check(); } }
  return { n, bad: window.HUA_BAD };
};
