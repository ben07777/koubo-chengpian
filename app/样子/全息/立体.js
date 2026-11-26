// 2026-11-16 把白名单里的小图标并进全息：每只图标全自动走一遍「线条加粗成轮廓，再立成线框体」，再让机器量一遍。不手调任何一只。
// 自己写的。立体和画法还是用抄来的 holo.js（MIT，原样）；页面.js（全息版那份，原样）里的镜头、底盘、字也照用。
// 和头三遍的不同：那三遍是一笔一条带子、各立各的（笔画交叉的地方会互相穿，尖角里侧会打结）。
// 这里改成先把整只图标按原来的线宽画成实心剪影，再沿着剪影的边取轮廓，一圈轮廓立一个体。交叉、尖角、圆点都是同一个办法，不分图标。
const SOLID = (() => {
  const HW = 1.0, PPU = 12, PAD = 2, DEPTH = 3.4, STEP = 0.3;
  const NSV = 'http://www.w3.org/2000/svg';
  function shapesOf(name) {                              // 咱们自己的线条（window.ICONS），一笔一个 Path2D
    const svg = document.createElementNS(NSV, 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.innerHTML = window.ICONS[name] || '';
    return [...svg.children].map(el => ICONPIC.path2d(el)).filter(Boolean);
  }
  function silhouette(name) {                            // 剪影：线宽 2（和原图标一样），圆头圆角
    const N = (24 + 2 * PAD) * PPU, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d', { willReadFrequently: true });
    g.translate(PAD * PPU, PAD * PPU); g.scale(PPU, PPU); g.lineWidth = HW * 2; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#fff';
    for (const p of shapesOf(name)) g.stroke(p);
    const d = g.getImageData(0, 0, N, N).data, f = new Float32Array(N * N); for (let i = 0; i < N * N; i++) f[i] = d[i * 4 + 3] / 255;
    return { f, N };
  }
  function trace(f, N) {                                 // 沿着剪影的边走：每个小方格看四个角在里在外，边上的点按深浅插出来，所以轮廓是光滑的
    const at = (x, y) => f[y * N + x], segs = [], T = 0.5;
    const ip = (x0, y0, x1, y1) => { const a = at(x0, y0), b = at(x1, y1), k = (T - a) / (b - a || 1e-9); return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k]; };
    for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) {
      const a = at(x, y) >= T, b = at(x + 1, y) >= T, c = at(x + 1, y + 1) >= T, d = at(x, y + 1) >= T, id = (a ? 8 : 0) | (b ? 4 : 0) | (c ? 2 : 0) | (d ? 1 : 0);
      if (id === 0 || id === 15) continue;
      const top = () => ['h' + x + ',' + y, ip(x, y, x + 1, y)], rt = () => ['v' + (x + 1) + ',' + y, ip(x + 1, y, x + 1, y + 1)], bot = () => ['h' + x + ',' + (y + 1), ip(x, y + 1, x + 1, y + 1)], lf = () => ['v' + x + ',' + y, ip(x, y, x, y + 1)];
      const mid = (at(x, y) + at(x + 1, y) + at(x + 1, y + 1) + at(x, y + 1)) / 4 >= T;
      const add = (p, q) => segs.push([p(), q()]);
      switch (id) {
        case 1: case 14: add(lf, bot); break; case 2: case 13: add(bot, rt); break; case 3: case 12: add(lf, rt); break;
        case 4: case 11: add(top, rt); break; case 6: case 9: add(top, bot); break; case 7: case 8: add(lf, top); break;
        case 5: if (mid) { add(lf, top); add(bot, rt); } else { add(lf, bot); add(top, rt); } break;
        case 10: if (mid) { add(top, rt); add(lf, bot); } else { add(lf, top); add(bot, rt); } break;
      }
    }
    const adj = new Map(); segs.forEach((s, i) => { for (const e of s) { if (!adj.has(e[0])) adj.set(e[0], []); adj.get(e[0]).push(i); } });
    const used = new Uint8Array(segs.length), loops = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue; const lp = []; let cur = i, key = segs[i][0][0]; const start = key;
      for (let guard = 0; guard < segs.length + 2; guard++) {
        used[cur] = 1; const s = segs[cur], other = s[0][0] === key ? s[1] : s[0]; lp.push(other[1]); key = other[0];
        if (key === start) break;
        const nx = (adj.get(key) || []).find(j => !used[j]); if (nx == null) break; cur = nx;
      }
      if (lp.length >= 6) loops.push(lp.map(([x, y]) => [x / PPU - PAD, y / PPU - PAD]));
    }
    return loops;
  }
  function rdp(pts, eps) {                               // 去掉多余的点（闭合的一圈）
    const n = pts.length; if (n < 8) return pts; let far = 0, fd = -1; for (let i = 1; i < n; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
    const run = (a) => { const keep = new Uint8Array(a.length); keep[0] = keep[a.length - 1] = 1; const st = [[0, a.length - 1]];
      while (st.length) { const [i0, i1] = st.pop(); let mx = 0, mi = -1; const ax = a[i0][0], ay = a[i0][1], bx = a[i1][0] - ax, by = a[i1][1] - ay, L = Math.hypot(bx, by) || 1e-9;
        for (let i = i0 + 1; i < i1; i++) { const d = Math.abs((a[i][0] - ax) * by - (a[i][1] - ay) * bx) / L; if (d > mx) { mx = d; mi = i; } }
        if (mx > eps) { keep[mi] = 1; st.push([i0, mi], [mi, i1]); } }
      return a.filter((_, i) => keep[i]); };
    const A = run(pts.slice(0, far + 1)), B = run([...pts.slice(far), pts[0]]); return [...A.slice(0, -1), ...B.slice(0, -1)];
  }
  function even(pts, step) {                             // 每一段再匀着加点（角原样留着），竖线才排得匀
    const out = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(L / step)); for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); }
    return out;
  }
  const area = lp => { let s = 0; for (let i = 0; i < lp.length; i++) { const a = lp[i], b = lp[(i + 1) % lp.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  const cache = {};
  function build(name) {
    if (name in cache) return cache[name];
    let R = null;
    try {
      const { f, N } = silhouette(name), raw = trace(f, N).map(lp => rdp(lp, 0.035)).filter(lp => lp.length >= 4);
      if (!raw.length) throw new Error('没取到轮廓');
      const big = raw.reduce((m, lp) => Math.max(m, Math.abs(area(lp))), 0), ink = (x, y) => f[Math.round((y + PAD) * PPU) * N + Math.round((x + PAD) * PPU)] >= 0.5;
      const isHole = lp => {                             // 这一圈是实心的外边，还是里头的洞：从最长的一段往圈里迈一小步，踩到的是空的就是洞
        let bi = 0, bl = -1; for (let i = 0; i < lp.length; i++) { const a = lp[i], b = lp[(i + 1) % lp.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > bl) { bl = L; bi = i; } }
        const a = lp[bi], b = lp[(bi + 1) % lp.length], sg = Math.sign(area(lp)) || 1, nx = -(b[1] - a[1]) / bl * sg, ny = (b[0] - a[0]) / bl * sg;
        return !ink((a[0] + b[0]) / 2 + nx * 0.2, (a[1] + b[1]) / 2 + ny * 0.2); };
      const loops = raw.map(lp => ({ pts: even(lp, STEP), area: Math.abs(area(lp)), hole: isHole(lp) })).sort((a, b) => b.area - a.area);
      const n = loops.length, xs = loops.flatMap(l => l.pts.map(p => p[0] - 12)), ys = loops.flatMap(l => l.pts.map(p => 24 - p[1]));
      const pieces = loops.map((l, i) => HOLO.modelFromPath(l.pts.map(([x, y]) => [x - 12, 24 - y]), { depth: DEPTH, id: name + '_' + i, slices: 3, ribEvery: 3, explode: [0, 0, (i - (n - 1) / 2) * 5 + (i % 2 ? 3 : -3)] }).parts[0].pieces[0]);
      const M = HOLO.normalizeModel(HOLO.prepModel({ name, parts: [{ id: 'obj', anchor: [0, 12, DEPTH / 2], pieces }] }), 2.3117);
      const ox = (Math.min(...xs) + Math.max(...xs)) / 2, oy = Math.min(...ys), s = M.scale;
      if (!isFinite(s) || !isFinite(M.ymax) || M.ymax <= 0) throw new Error('量不出大小');
      M.to3 = (ix, iy, z) => [(ix - 12 - ox) * s, (24 - iy - oy) * s, z * s];      // 图标格子里的一个点 → 立起来以后的位置
      M.loops = loops; M.depth = DEPTH; M.big = big; R = M;
    } catch (e) { R = { err: String(e.message || e) }; }
    return (cache[name] = R);
  }
  return { build, HW, DEPTH };
})();

// ───────── 机器量：每只图标立起来以后，在片里转得最偏的那个角度上量 ─────────
const CAM0 = { target: [0, 0.82, 0], yaw: 0, pitch: 0.2, dist: 7.0, fov: 0.6, cx: 540, cy: 670 }, SPIN_MAX = 0.5;
function projector(cam, spin) { const C = HOLO.makeCamera(cam, W, H), cs = Math.cos(spin), sn = Math.sin(spin), o = new Float32Array(3); return (x, y, z) => { C.project(x * cs + z * sn, y, -x * sn + z * cs, o); return [o[0], o[1], o[2]]; }; }
const WORK = document.createElement('canvas'); WORK.width = W; WORK.height = H; const wctx = WORK.getContext('2d', { willReadFrequently: true });
const MSK = document.createElement('canvas'); MSK.width = W; MSK.height = H; const mctx = MSK.getContext('2d', { willReadFrequently: true });
function measure(name) {
  const M = SOLID.build(name); if (M.err) return { name, ok: false, err: M.err };
  const pr = projector(CAM0, SPIN_MAX), d = M.depth, loops = M.loops;
  const face = (g, z) => { g.beginPath(); for (const l of loops) { l.pts.forEach(([x, y], i) => { const p = pr(...M.to3(x, y, z)); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.closePath(); } g.fill('evenodd'); };
  // 一、正面那一层的剪影；二、从正面到背面扫过去占的地方（侧壁都在这里面）
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, W, H); mctx.fillStyle = '#f00'; face(mctx, d / 2);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const l of loops) for (const [x, y] of l.pts) for (const z of [d / 2, -d / 2]) { const p = pr(...M.to3(x, y, z)); x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  x0 = Math.floor(x0) - 2; y0 = Math.floor(y0) - 2; x1 = Math.ceil(x1) + 2; y1 = Math.ceil(y1) + 2; const bw = x1 - x0, bh = y1 - y0;
  const A = mctx.getImageData(x0, y0, bw, bh).data;
  mctx.clearRect(0, 0, W, H); for (let k = 0; k <= 12; k++) face(mctx, d / 2 - d * k / 12);
  const S = mctx.getImageData(x0, y0, bw, bh).data;
  let nA = 0, nS = 0; for (let i = 3; i < A.length; i += 4) { if (A[i] > 127) nA++; if (S[i] > 127) nS++; }
  const tot = bw * bh, lost = 1 - (tot - nS) / Math.max(1, tot - nA), cover = nS / tot;
  // 三、真画一遍线框，看正面和背面的轮廓线是不是都画出来了（没画出来 = 线断了）
  wctx.setTransform(1, 0, 0, 1, 0, 0); wctx.globalCompositeOperation = 'source-over'; wctx.globalAlpha = 1; wctx.fillStyle = '#000'; wctx.fillRect(0, 0, W, H);
  holo.draw(wctx, M, CAM0, { hue: T.hue, spin: SPIN_MAX });
  const R = wctx.getImageData(x0, y0, bw, bh).data, lit = (x, y) => { x = Math.round(x) - x0; y = Math.round(y) - y0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue; const i = (yy * bw + xx) * 4; if (Math.max(R[i], R[i + 1], R[i + 2]) > 70) return true; } return false; };
  let hit = 0, all = 0; for (const l of loops) for (const [x, y] of l.pts) for (const z of [d / 2, -d / 2]) { const p = pr(...M.to3(x, y, z)); all++; if (lit(p[0], p[1])) hit++; }
  // 四、碎不碎：一共几块、几个洞、里头有几块是小点小段（长宽都不到 3.2 格）
  const small = l => { const xs = l.pts.map(p => p[0]), ys = l.pts.map(p => p[1]); return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < 3.2; };
  const bodies = loops.filter(l => !l.hole), holes = loops.filter(l => l.hole);
  return { name, ok: true, bodies: bodies.length, holes: holes.length, bits: bodies.filter(small).length, pinholes: holes.filter(l => l.area < 1.5).length, pts: loops.reduce((s, l) => s + l.pts.length, 0),
    lost: +lost.toFixed(3), cover: +cover.toFixed(3), recall: +(hit / Math.max(1, all)).toFixed(3) };
}
// 机器筛的线（量完 177 只、看过数怎么分布以后定的，写死在这里；改线要另外再定）
const LINE = { lost: 0.42, bits: 3, bodies: 6, pinholes: 2, recall: 0.97 };
// 11-16 看过拼图定的：拿不准的一律平板，平板永远认得清。机器筛出来的里头 thermometer 改回立；机器没筛出来、看着偏密的七只改平板。合下来平板 22 只、立 155 只
const RULED = { flat: ['bus', 'file-text', 'image', 'tractor', 'school', 'globe', 'fish'], stand: ['thermometer'] };
function verdict(m) {
  if (!m.ok) return { stand: false, why: ['立不起来：' + m.err] };
  if (RULED.stand.includes(m.name)) return { stand: true, why: [], ruled: '人工定：立（机器原来筛出来了）' };
  if (RULED.flat.includes(m.name)) return { stand: false, why: ['人工定：改平板（机器没筛出来，看着偏密）'], ruled: '人工定：改平板' };
  const why = [];
  if (m.lost > LINE.lost) why.push('糊：转过去以后，线条之间的空当被侧壁盖掉 ' + Math.round(m.lost * 100) + '%');
  if (m.pinholes >= LINE.pinholes) why.push('糊：有 ' + m.pinholes + ' 个针眼大的洞');
  if (m.bits >= LINE.bits) why.push('碎：有 ' + m.bits + ' 块小点小段');
  if (m.bodies > LINE.bodies) why.push('碎：一共散成 ' + m.bodies + ' 块');
  if (m.recall < LINE.recall) why.push('线断：轮廓线只画出来 ' + Math.round(m.recall * 100) + '%');
  return { stand: !why.length, why };
}
// 177 格的拼图：每格是真画出来的全息样子（转到 0.4），底下是图标名和机器量的数
function grid(names, cols = 15) {
  const CW = 240, CH = 300, rows = Math.ceil(names.length / cols), cvs = document.createElement('canvas'); cvs.width = cols * CW; cvs.height = rows * CH + 70; const g = cvs.getContext('2d');
  g.fillStyle = '#04090d'; g.fillRect(0, 0, cvs.width, cvs.height); const out = [];
  g.font = `600 30px ${CN}`; g.fillStyle = '#dff'; g.textBaseline = 'alphabetic';
  names.forEach((name, i) => {
    const m = measure(name), v = verdict(m), x = (i % cols) * CW, y = 70 + Math.floor(i / cols) * CH; out.push({ ...m, ...v });
    if (m.ok) {
      const M = SOLID.build(name);
      wctx.setTransform(1, 0, 0, 1, 0, 0); wctx.globalCompositeOperation = 'source-over'; wctx.globalAlpha = 1; wctx.fillStyle = '#04090d'; wctx.fillRect(0, 0, W, H);
      const info = holo.draw(wctx, M, CAM0, { hue: T.hue, spin: 0.4, solid: 0.22 }), bb = info.bbox.obj, cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, S = Math.max(bb[2] - bb[0], bb[3] - bb[1]) + 70;
      g.drawImage(WORK, cx - S / 2, cy - S / 2, S, S, x + 8, y + 4, CW - 16, CW - 16);
    }
    g.fillStyle = v.stand ? '#19c37d' : '#ffb020'; g.fillRect(x + 8, y + CW - 6, CW - 16, 5);
    g.font = '600 19px ShareTechMono'; g.fillStyle = '#e8ffff'; g.fillText(name, x + 10, y + CW + 20);
    g.font = `500 15px ${CN}`; g.fillStyle = v.stand ? '#7fd6b0' : '#ffcf70';
    g.fillText(m.ok ? `${v.stand ? '能立' : '改平板'} 盖${Math.round(m.lost * 100)}% ${m.bodies}块${m.bits ? '(小' + m.bits + ')' : ''} 洞${m.holes}${m.pinholes ? '(针' + m.pinholes + ')' : ''}` : '立不起来', x + 10, y + CW + 42);
  });
  const ok = out.filter(o => o.stand).length;
  g.font = `600 30px ${CN}`; g.fillStyle = '#e8ffff'; g.fillText(`白名单 ${names.length} 只图标，全自动立成线框体（没手调任何一只）。绿条 = 立（${ok} 只），黄条 = 改平板（${names.length - ok} 只）。机器筛过，11-16 又人工定了 8 只。「盖」= 转过去以后线条之间的空当被侧壁盖掉几成。`, 16, 44);
  return { list: out, png: cvs.toDataURL('image/png').slice(22) };
}
window.SOLID_API = { measure, verdict, grid, LINE, RULED };
