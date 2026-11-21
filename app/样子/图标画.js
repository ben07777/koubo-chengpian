// 2026-11-16 图标 → 画布上的线条（圆头、纯色、粗细能传），并且会做白名单里配给它的那一个动作。象形样子和全息样子（平板上的发光线条）共用这一份。
// 自己写的。动作参数那几张表和按时刻求值（MOT_LIB / MOT_ONCE / MOT_GEN / MOT_G / motVal）是 专业版改\5_动作.js 的前半份，原样拿来；
// 这里做的事和那份脚本里 motOn 做的一样，只是那边是改网页上的 SVG，这边是往画布上画。
// 先要有：window.ICONS、上面那几张表、lerp、clamp。
const ICONPIC = (() => {
  const NS = 'http://www.w3.org/2000/svg', TAU = Math.PI * 2, cache = {}, BOX24 = { x: 0, y: 0, width: 24, height: 24 };
  const A = (el, k) => parseFloat(el.getAttribute(k)) || 0;
  function path2d(el) {                                  // 一笔的走法（起点和方向跟 SVG 一样，描线的时候才对得上）
    const tg = el.tagName.toLowerCase(), p = new Path2D();
    if (tg === 'path') return new Path2D(el.getAttribute('d') || '');
    if (tg === 'circle') { p.arc(A(el, 'cx'), A(el, 'cy'), A(el, 'r'), 0, TAU); p.closePath(); }
    else if (tg === 'ellipse') { p.ellipse(A(el, 'cx'), A(el, 'cy'), A(el, 'rx'), A(el, 'ry'), 0, 0, TAU); p.closePath(); }
    else if (tg === 'rect') { const rx = el.hasAttribute('rx') ? A(el, 'rx') : A(el, 'ry'), ry = el.hasAttribute('ry') ? A(el, 'ry') : rx; p.roundRect(A(el, 'x'), A(el, 'y'), A(el, 'width'), A(el, 'height'), [{ x: rx, y: ry }]); }
    else if (tg === 'line') { p.moveTo(A(el, 'x1'), A(el, 'y1')); p.lineTo(A(el, 'x2'), A(el, 'y2')); }
    else if (tg === 'polyline' || tg === 'polygon') { const v = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number); for (let i = 0; i + 1 < v.length; i += 2) i ? p.lineTo(v[i], v[i + 1]) : p.moveTo(v[i], v[i + 1]); if (tg === 'polygon') p.closePath(); }
    else return null;
    return p;
  }
  function org(str, box, pxk) {                          // 'a b' → 绕着转的那个点。百分数按 box 算；写 px 的乘 pxk 再从 box 左上角起
    const KW = { left: '0%', top: '0%', center: '50%', right: '100%', bottom: '100%' }, ps = String(str || '50% 50%').trim().split(/\s+/).map(s => KW[s] || s); if (ps.length < 2) ps.push('50%');
    const one = (s, lo, len) => s.endsWith('%') ? lo + len * parseFloat(s) / 100 : lo + parseFloat(s) * pxk;
    return [one(ps[0], box.x, box.width), one(ps[1], box.y, box.height)];
  }
  const pct = v => typeof v === 'number' ? (v * 100) + '%' : String(v);
  function build(name) {
    if (name in cache) return cache[name];
    const src = window.ICONS[name]; if (!src) return (cache[name] = null);
    const M = MOT_LIB[name] || null, Gn = MOT_G[MOT_GEN[name]] || null;
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.style.cssText = 'position:absolute;left:-99px;top:0;width:24px;height:24px;overflow:visible'; document.body.appendChild(svg);
    let root;
    if (M && !M.own) {                                   // 照库的：线条用它那一份（动作是按它的笔画写的）
      if (M.vb && M.vb !== '0 0 24 24') throw new Error(name + '：库里这只不是 24 格的');
      const mk = (n, par, isRoot) => { const x = isRoot ? svg : document.createElementNS(NS, n.tag); if (!isRoot) { for (const [k, v] of Object.entries(n.a || {})) x.setAttribute(k, v); par.appendChild(x); }
        const node = { n, root: isRoot, el: x, kids: [] }; (n.c || []).forEach(c => node.kids.push(mk(c, x, false))); return node; };
      root = mk(M.root, null, true);
    } else {                                             // 咱们自己的线条；库的动作要是只是整只在动（own），动法照借
      svg.innerHTML = src; root = { n: M ? M.root : null, root: true, el: svg, kids: [...svg.children].map(el => ({ n: null, root: false, el, kids: [] })) };
    }
    const shapes = [];
    const fin = node => { const el = node.el; if (!node.root) { node.path = path2d(el); try { node.bb = el.getBBox(); } catch (e) { node.bb = BOX24; }
        if (node.path) { try { node.len = el.getTotalLength(); } catch (e) { node.len = 0; } node.idx = shapes.length; shapes.push(node); } }
      node.kids.forEach(fin); };
    fin(root); svg.remove();
    const I = { name, M, G: Gn, root, shapes, once: !!M && MOT_ONCE.has(name), lenM: M ? Math.min(M.len, 2.4) : 0, lenG: Gn ? Gn.len : 0 };
    return (cache[name] = I);
  }
  function node(ctx, nd, S) {
    ctx.save(); let alpha = 1, dash = null; const n = nd.n;
    if (n && (n.tr || n.b)) {                            // 照库的动作第 S.mt 秒：和 5_动作.js 里 lib() 一个算法
      const b = n.b || {}, v = {}, base = p => (typeof b[p] === 'number' ? b[p] : MOT_BASE[p]);
      const back = S.entry ? 0 : (S.mt > S.lenM ? MOT_E.easeInOut(clamp((S.mt - S.lenM - 0.1) / 0.35)) : 0), tc = Math.min(S.mt, S.lenM);
      for (const tr of n.tr || []) v[tr.p] = (tc <= 0 && !S.entry) ? base(tr.p) : lerp(motVal(tr, Math.max(tc, 0)), base(tr.p), back);
      const g = p => (p in v ? v[p] : base(p));
      if (MOT_MOVE.some(p => p in v || typeof b[p] === 'number')) {
        const o = org(b.transformOrigin || (pct(b.originX == null ? 0.5 : b.originX) + ' ' + pct(b.originY == null ? 0.5 : b.originY)), nd.root ? BOX24 : nd.bb, nd.root ? 24 / 28 : 1), u = nd.root ? 24 / 28 : 1, sc = g('scale');
        ctx.translate(o[0] + (g('x') + g('translateX')) * u, o[1] + (g('y') + g('translateY')) * u); ctx.scale(sc * g('scaleX'), sc * g('scaleY')); ctx.rotate((g('rotate') + g('rotateZ')) * Math.PI / 180); ctx.translate(-o[0], -o[1]);
      }
      if (S.entry || S.k >= 1) { if ('opacity' in v) alpha = v.opacity; if ('pathLength' in v || 'pathOffset' in v) dash = [g('pathLength'), g('pathSpacing'), -g('pathOffset')]; }
    }
    ctx.globalAlpha *= clamp(alpha);
    if (nd.path) {
      let kk = 1; if (!dash && S.k < 1) kk = clamp(S.k * 1.35 - 0.35 * nd.idx / Math.max(1, S.count - 1));      // 描线进场：一笔一笔错开
      if (S.last && nd.idx === S.count - 1) { dash = [S.last[0], 1, 0]; ctx.globalAlpha *= clamp(S.last[1]); }       // 最后一笔再描一遍（G5）
      const L = nd.len || 1;
      if (dash) { if (dash[0] > 0.002) { ctx.setLineDash([dash[0] * L, Math.max(dash[1], 0.0001) * L]); ctx.lineDashOffset = dash[2] * L; ctx.stroke(nd.path); } }
      else if (kk >= 1) { ctx.setLineDash([]); ctx.stroke(nd.path); }
      else if (kk > 0.002) { ctx.setLineDash([kk * L, L * 1.01]); ctx.lineDashOffset = 0; ctx.stroke(nd.path); }
    }
    nd.kids.forEach(k => node(ctx, k, S));
    ctx.restore();
  }
  // o：{ x, y 中心；size 多大（像素）；color；lw 线多粗（按 24 格算，原来是 2）；
  //      mode 'lib' / 'gen' 加 mt：正在做小动作的第 mt 秒；enter：从开始进场起第几秒（只当进场用的那几只照库的动作进，别的普通描线 0.6 秒）；k：描线进场走到几成 }
  function draw(ctx, name, o) {
    const I = build(name); if (!I) return false;
    const size = o.size || 24; let mode = o.mode || null, mt = o.mt || 0, k = o.k == null ? 1 : o.k, entry = false;
    if (o.enter != null) { if (o.enter <= 0) return true; if (I.once && o.enter < I.lenM) { entry = true; mode = 'lib'; mt = o.enter; k = clamp(o.enter / I.lenM); } else if (!I.once) k = clamp(o.enter / 0.6); }
    if (k < 1 && !entry) mode = null;
    ctx.save(); ctx.translate((o.x || 0) - size / 2, (o.y || 0) - size / 2); ctx.scale(size / 24, size / 24);
    ctx.lineWidth = o.lw || 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = o.color || '#fff';
    let last = null; const Gn = I.G;
    if (Gn && mode === 'gen' && mt > 0 && mt < Gn.len) {  // 通用小动作：整只动
      const v = { y: 0, rotate: 0, scale: 1 }; for (const tr of Gn.tr || []) v[tr.p] = motVal(tr, mt);
      const c = org(Gn.origin, BOX24, 1); ctx.translate(c[0], c[1] + v.y); ctx.scale(v.scale, v.scale); ctx.rotate(v.rotate * Math.PI / 180); ctx.translate(-c[0], -c[1]);
      if (Gn.last) last = [motVal(Gn.last[0], mt), motVal(Gn.last[1], mt)];
    }
    node(ctx, I.root, { mt: mode === 'lib' ? mt : 0, entry, k, count: I.shapes.length, last, lenM: I.lenM });
    ctx.restore(); return true;
  }
  // 小动作排在哪几秒：落定以后停一下再做；忙的时候（别的东西正在进场）不做；同一只隔 MOT_PERIOD 秒再做；最多 MOT_MAX 回。和 5_动作.js 的 motPlan 一个规矩。
  function slots(name, settle, end, busy = []) {
    const I = build(name), out = []; if (!I) return out;
    const mode = I.M && !I.once ? 'lib' : I.G ? 'gen' : null; if (!mode) return out;
    const L = mode === 'lib' ? I.lenM + MOT_BACK : I.lenG, free = a => { let t = a; for (let go = true; go;) { go = false; for (const [b0, b1] of busy) if (t < b1 - 1e-9 && t + L > b0 + 1e-9) { t = b1; go = true; } } return t; };
    for (let n = 0; n < MOT_MAX; n++) { const prev = out[out.length - 1], t = free(Math.max(settle + MOT_WAIT, prev ? prev.t + MOT_PERIOD : -1e9)); if (t + L > end - 0.25) break; out.push({ t, len: L, mode }); }
    return out;
  }
  const pose = (sl, t) => { const s = sl.find(s => t >= s.t && t < s.t + s.len); return s ? { mode: s.mode, mt: t - s.t } : {}; };
  const info = name => { const I = build(name); return I ? { lib: !!I.M, own: !!(I.M && I.M.own), once: I.once, gen: I.G ? MOT_GEN[name] : null, lenM: I.lenM, lenG: I.lenG, shapes: I.shapes.length } : null; };
  return { build, draw, slots, pose, info, path2d };
})();
