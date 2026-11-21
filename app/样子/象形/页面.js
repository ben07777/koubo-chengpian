// 2026-11-16 象形运动图形样子（竖屏 1080×1920）。
// 底子是抄来的 engine.js（Lemo-Opuscar · pictogram-motion，MIT，文件原样；拼页面的时候只把它写死的宽、高、格子换成传进来的）。
// 下面标了「抄」的几段是照同一份 MIT 的 film.js 改的（原来写死横屏的行数列数，改成按 W、H、CELL 算）；别的是自己写的。
// 它那条片的内容（伞、雨滴、脚印、车站、它的字、它的英文装饰）一样没用。
// 每张卡只吃「通义填的那几样」：图标名、几个字。时刻是从字幕里查那几个字什么时候说到的。
// window.draw(t)：t 是整条片里的秒。同一个 t 永远同一个样子。回这一帧画了多少毫秒。
const F = G.F, { W, H, E, PAL, inv, rgba, mix, CELL } = G;       // clamp、lerp 前一段脚本里已经取了
const cv = document.getElementById('c'), ctxMain = cv.getContext('2d');
const ZH = OPT.zh === '思源' ? '"Noto Sans SC"' : 'NotoSC';      // 大字里的中文：软件现有的那份，或者它带的思源黑体
const big = px => `900 ${px}px "Inter Tight", ${ZH}`, small = px => `500 ${px}px "DM Mono", ${ZH}`;
const SUBF = '800 62px NotoSC';                                  // 字幕照软件现在的：62 号特粗
G.MOTIFS.geo = [0, 1, 2, 3, 4, 5, 7, 9, 11, 13, 0, 1, 7];        // 底纹只用它的几何纹；它那条片的雨滴、云、太阳、伞那几种不用
const MX = 84, LW = 2.7, LINES = DATA.lines;
const PALS = { icon: 'teal', stack: 'coral', hero: 'navy' };     // 一段话题一套色（它原版的色，没调过）。这三张卡配哪套是手摆的

// ───────── 抄：film.js 的 rowDrift、stageDisc、chip、拼条进场 ─────────
const rowDrift = (t, seed, sp = 26, amp = 22) => (j) => (j % 2 ? 1 : -1) * t * sp + Math.sin(j * 1.7 + seed) * amp;
function stageDisc(ctx, x, y, r, col, lt) {
  G.disc(ctx, x, y, r, col);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  const sx = x - r * 1.6 + E.o3(inv(0.1, 2.6, lt)) * r * 3.2;
  const g = ctx.createLinearGradient(sx - r * 0.5, y - r, sx + r * 0.5, y + r);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.09)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
function chip(ctx, x, y, text, fg, bg, p, font, px) {            // 一条实色小牌子，从左长出来（字体字号改成能传）
  if (p <= 0) return 0;
  ctx.save(); ctx.font = font; ctx.letterSpacing = '3px'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const tw = ctx.measureText(text).width + px, h = Math.round(px * 1.72);
  ctx.fillStyle = bg; ctx.fillRect(x, y, tw * p, h);
  ctx.beginPath(); ctx.rect(x, y, tw * p, h); ctx.clip();
  ctx.fillStyle = fg; ctx.fillText(text, x + px / 2, y + px * 1.22);
  ctx.restore(); return tw;
}
const bandBuf = G.canvas();
function assemble(ctx, lt, seed, fn) {                           // 主体由一条条横带滑进来对齐（它片名那张卡的进场）
  const asm = inv(0.0, 0.45, lt);
  if (asm >= 1) { fn(ctx); return; }
  const b = bandBuf.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W, H); fn(b);
  const bh = 54;
  for (let j = 0; j * bh < H; j++) {
    const d = (j % 2 ? 1 : -1) * (90 + 160 * G.hash(j + 5 + seed)) * (1 - E.oExp(clamp(asm * 1.25 - (j % 5) * 0.04)));
    ctx.drawImage(bandBuf, 0, j * bh, W, bh, d, j * bh, W, bh);
  }
}
const TRS = ['rows', 'cols', 'slide', 'split', 'quarter'];       // 架子给了号就按号挑转场（相邻两次不一样）；翻牌留给快闪排法
function enterSubj(ctx, lt, S, DX, DY, R, fn) {                  // 主体（圆盘加图标）进场四种，架子按种子轮：0 横带拼、1 竖带拼、2 从下滑上、3 圆盘弹开。都在 0.45 秒里到齐
  const e = S.E == null ? 0 : S.E % 4, asm = inv(0.0, 0.45, lt);
  if (e === 0 || asm >= 1) { assemble(ctx, lt, S.seed, fn); return; }
  if (e === 3) { const s = Math.max(0.001, E.oBack(asm)); ctx.save(); ctx.translate(DX, DY); ctx.scale(s, s); ctx.translate(-DX, -DY); fn(ctx); ctx.restore(); return; }
  const b = bandBuf.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W, H); fn(b);
  if (e === 1) { const bw = 54; for (let j = 0; j * bw < W; j++) { const d = (j % 2 ? 1 : -1) * (90 + 160 * G.hash(j + 5 + S.seed)) * (1 - E.oExp(clamp(asm * 1.25 - (j % 5) * 0.04))); ctx.drawImage(bandBuf, j * bw, 0, bw, H, j * bw, d, bw, H); } }
  else { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, DY + R + 24); ctx.clip(); ctx.drawImage(bandBuf, 0, (1 - E.oExp(asm)) * (R * 2 + 80)); ctx.restore(); }
}
function ground(ctx, P, seed, lt) {                              // 底：纯色加一排排一直在滑的底纹
  ctx.fillStyle = P.t[2]; ctx.fillRect(0, 0, W, H);
  G.drawPattern(ctx, G.pattern(P.key, seed, { spread: 0.42, density: 0.42, set: 'geo' }), rowDrift(lt, seed));
}

// ───────── 字 ─────────
function when(word, from = 0) {                                  // 这几个字是第几秒说到的（从字幕里查；查不到回 null）
  for (const l of LINES) { if (l.t1 < from) continue; const i = l.text.indexOf(word); if (i >= 0 && l.cs[i]) return l.cs[i][1]; }
  return null;
}
function fit(ctx, text, px, maxW, ls = 0) { ctx.save(); ctx.font = big(px); ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(text).width; ctx.restore(); return w > maxW ? Math.floor(px * maxW / w) : px; }

// ───────── 现成画面。make(S) → draw(ctx, t) ─────────
// 一、图标加几个字：{ a, b, icon, word }。大圆盘上一个粗线图标，做白名单里配给它的那个动作；底下一行超大的字
function cardIcon(S) {
  const a = S.a, said = Math.max(when(S.word, a - 0.5) ?? a + 0.6, a + 0.55), tw = S.hand || S.together ? a + 0.55 : S.early ? Math.min(said, Math.max(a + 0.55, S.b - 1.5)) : said, P = PAL[S.pal], fg = P.fg, DX = 580, DY = 640, R = 400;      // 补的图标词：字跟着图标一起进。通义配的：说到了才出，可至少留一秒半给人看
  const slots = ICONPIC.slots(S.icon, a + 0.5, S.b, [[tw - 0.05, tw + 0.6]]);
  return (ctx, t) => {
    const lt = t - a; ground(ctx, P, S.seed, lt);
    enterSubj(ctx, lt, S, DX, DY, R, c => { stageDisc(c, DX, DY, R, P.t[1], lt); ICONPIC.draw(c, S.icon, { x: DX, y: DY, size: 500, color: fg, lw: LW, ...ICONPIC.pose(slots, t) }); });
    if (S.word) G.maskText(ctx, S.word, MX, 1296, big(fit(ctx, S.word, 240, W - 2 * MX, 6)), fg, inv(tw, tw + 0.5, t), { ls: '6px' });      // 只画图标的那张（总控 11-17）：不出字
  };
}
// 二甲、单子，一条一张卡快闪：{ rows, ts, as }。每条一张卡：圆盘上一个勾（勾是这种卡固定带的，不是通义挑的）、第几条共几条、一行大字
function cardFlash(S, i) {
  const P = PAL[S.pal], fg = P.fg, n = S.rows.length, light = i % 2 === 1, DX = i % 2 ? 470 : 610, DY = 620, R = 390, a = S.as[i], ts = S.ts[i], seed = S.seed + 3 * (i + 1);
  const slots = ICONPIC.slots('check', ts + 0.75, i + 1 < n ? S.as[i + 1] : S.ra, []);      // 勾画完以后隔一会儿再做它的通用小动作
  return (ctx, t) => {
    const lt = t - a; ground(ctx, P, seed, lt);
    stageDisc(ctx, DX, DY, R, light ? P.t[4] : P.t[1], lt);
    ICONPIC.draw(ctx, 'check', { x: DX, y: DY, size: 470, color: light ? P.t[0] : fg, lw: LW, enter: t - ts - 0.04, ...ICONPIC.pose(slots, t) });
    G.typeText(ctx, `0${i + 1} / 0${n}`, MX + 4, 1128, small(34), rgba(fg, 0.78), inv(0.05, 0.35, lt), { ls: '3px' });
    G.maskText(ctx, S.rows[i], MX, 1300, big(fit(ctx, S.rows[i], 210, W - 2 * MX, 6)), fg, inv(ts, ts + 0.5, t), { ls: '6px' });
  };
}
// 二乙、单子，一屏竖排：{ rows, ts, merge }。有几条先摆几条暗空位（带小编号），说到哪条哪条亮；说完几条并成一块。pre：一上来就全有（快闪排法收尾那张）
function cardList(S, pre) {
  const P = PAL[S.pal], fg = P.fg, n = S.rows.length, ts = S.ts, tm = S.merge, a = pre ? S.ra : S.a, X0 = 60, BW = W - 120, BH = 262, GAP = 30, TOP = 791 - (n * BH + (n - 1) * GAP) / 2;      // 四行时 = 222
  return (ctx, t) => {
    const lt = t - a; ground(ctx, P, S.seed + (pre ? 17 : 0), lt);
    const m = E.ioExp(inv(tm, tm + 0.45, t)); let px = 140; for (const r of S.rows) px = Math.min(px, fit(ctx, r, 140, BW - 80, 4));
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1, y = lerp(TOP + i * (BH + GAP), TOP + 1.5 * GAP + i * BH, m);
      const pin = pre || (S.early && S.hasTr) ? 1 : E.ioExp(inv(0.04 + i * 0.07, 0.44 + i * 0.07, lt)), x = X0 + dir * W * (1 - pin);      // 总控 11-16：换屏一落定主体就得在，空位跟着换屏一起到
      ctx.fillStyle = rgba(P.t[0], S.early ? 0.55 : 0.42); ctx.fillRect(x, y, BW, BH);                                       // 暗空位
      const said = pre ? 1 : E.ioExp(inv(ts[i] - 0.06, ts[i] + 0.3, t)), tnext = i + 1 < n ? ts[i + 1] : tm;
      const q = pre ? 1 : E.ioExp(inv(tnext - 0.06, tnext + 0.24, t)), un = E.ioExp(inv(tm + i * 0.06, tm + 0.3 + i * 0.06, t)), hot = Math.min(1, (1 - q) + un);      // 刚说到的那条是亮的，下一条说到它就退成暗的；并成一块的时候全亮
      const bandCol = mix(P.t[0], fg, hot), txtCol = mix(fg, P.t[1], hot);
      if (said > 0) { const w = BW * said; ctx.fillStyle = bandCol; ctx.fillRect(dir < 0 ? x : x + BW - w, y, w, BH); }
      ctx.save(); ctx.font = small(30); ctx.letterSpacing = '2px'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = said > 0.5 ? rgba(txtCol, 0.8) : rgba(fg, 0.62 * pin); ctx.fillText('0' + (i + 1), x + 36, y + 60); ctx.restore();
      G.maskText(ctx, S.rows[i], x + 34, y + 212, big(px), txtCol, pre ? 1 : inv(ts[i] + 0.02, ts[i] + 0.5, t), { ls: '4px' });
    }
  };
}
// 三、主角加一个数加一句话：{ a, b, icon, name, num:{val,unit}, tag }。数是整个从蒙版里滑上来的，原样，不滚
function cardHero(S) {
  const P = PAL[S.pal], fg = P.fg, a = S.a, DX = 580, DY = 500, R = 330;
  const tn = Math.max(when(S.name, a - 0.5) ?? a + 0.3, a + 0.3), tv = S.num ? when(S.num.val + S.num.unit, a) ?? when(S.num.val, a) : null, tg = S.tag ? when(S.tag, tv ?? a) ?? when(S.tag.slice(1), tv ?? a) : null;
  const busy = [[tn - 0.05, tn + 0.6]]; if (tv != null) busy.push([tv - 0.05, tv + 0.7]); if (tg != null) busy.push([tg - 0.05, tg + 0.5]);
  const slots = ICONPIC.slots(S.icon, a + 0.5, S.b, busy), hi = PAL.yellow.t[2];
  return (ctx, t) => {
    const lt = t - a; ground(ctx, P, S.seed, lt);
    enterSubj(ctx, lt, S, DX, DY, R, c => { stageDisc(c, DX, DY, R, P.t[1], lt); ICONPIC.draw(c, S.icon, { x: DX, y: DY, size: 430, color: fg, lw: LW, ...ICONPIC.pose(slots, t) }); });
    G.maskText(ctx, S.name, MX, 1010, big(fit(ctx, S.name, 150, W - 2 * MX, 4)), fg, inv(tn, tn + 0.5, t), { ls: '4px' });
    if (tv != null) {
      const w = G.maskText(ctx, S.num.val, MX - 6, 1284, big(250), hi, inv(tv, tv + 0.5, t), { ls: '2px' });
      G.maskText(ctx, S.num.unit, MX + w + 26, 1284, big(86), fg, inv(tv + 0.1, tv + 0.6, t), { ls: '4px' });
    }
    if (tg != null) chip(ctx, MX, 1340, S.tag, P.t[1], fg, E.oExp(inv(tg, tg + 0.4, t)), big(62), 62);
  };
}

// 四、标题：{ a, b, big, small }。一条通栏色带跟着换屏一起到，大字从蒙版里滑上来；小字是底下一条小牌子。深色带、浅色带两种，架子按种子轮
function cardTitle(S) {
  const P = PAL[S.pal], fg = P.fg, a = S.a, said = when(S.big, a - 0.5) ?? a + 0.3, tw = Math.min(Math.max(said, a + 0.12), a + 0.35);      // 标题只有字，字就是主体：换屏落定后半秒内得在，所以最晚 0.35 秒就出
  const ts = S.small ? Math.max(when(S.small, a - 0.5) ?? tw + 0.4, a + 0.3) : null, light = (S.E ?? 0) % 2 === 1, BY = 600, BH = 400;
  return (ctx, t) => {
    const lt = t - a; ground(ctx, P, S.seed, lt);
    const pin = S.early && S.hasTr ? 1 : E.ioExp(inv(0.02, 0.36, lt));
    ctx.fillStyle = light ? fg : P.t[0]; ctx.fillRect(0, BY, W * pin, BH);
    ctx.fillStyle = fg; ctx.fillRect(MX, BY - 52, 200 * E.oExp(inv(0.08, 0.48, lt)), 18);      // 色带上头一小截短杠
    const px = fit(ctx, S.big, 250, W - 2 * MX, 6);
    G.maskText(ctx, S.big, MX, BY + BH / 2 + px * 0.36, big(px), light ? P.t[1] : fg, inv(tw, tw + 0.5, t), { ls: '6px' });
    if (ts != null) { const spx = Math.min(62, Math.floor((W - 2 * MX - 80) / (S.small.length * 1.06))); chip(ctx, MX, BY + BH + 40, S.small, P.t[1], fg, E.oExp(inv(ts, ts + 0.4, t)), big(spx), spx); }
  };
}

// ───────── 2026-11-16 夜补的四组骨架：两块、大数、引一句、一步接一步（自己写的，没有抄的）─────────
// 架子给的一段字：{ t 字, at 第几秒说到（云端那头查到了才有）}。没有 at 就去字幕里找这几个字，再没有回 null
const atOf = (T, from) => !T || !T.t ? null : T.at != null ? T.at : when(T.t, from);
const NOBRK = /[A-Za-z0-9.%+\-]/, HEADP = /[，。、！？：；,.!?:;）》」』”’%]/;
function splitN(text, n, br) {                                    // 切成 n 行，尽量一样长；不在英文词、数字中间切，不让标点打头；架子给了「哪些位置可以折」（br，词和词中间）就只在那些位置折
  const cs = [...text], out = []; let i0 = 0;
  for (let k = 1; k < n; k++) {
    const cut = Math.round(cs.length * k / n), ok = c => c > i0 && c < cs.length && !(NOBRK.test(cs[c - 1]) && NOBRK.test(cs[c])) && !HEADP.test(cs[c]) && (!br || br.includes(c));
    let best = null; for (let d = 0; d < cs.length && best == null; d++) best = ok(cut - d) ? cut - d : ok(cut + d) ? cut + d : null;
    if (best == null) return null; out.push(cs.slice(i0, best).join('')); i0 = best;
  }
  out.push(cs.slice(i0).join('')); return out;
}
function layText(ctx, text, px0, maxW, maxLines, ls = 4, maxH = 1e9, br = null) {      // 一段字排成几行、多大：行数少优先，多一行要大出一成半才换；整块不许高过 maxH
  let best = null;
  for (let n = 1; n <= maxLines; n++) {
    const rows = splitN(text, n, br) || (br && n > 1 && !best ? splitN(text, n) : null); if (!rows) continue;      // 照词折不出来、又还一种排法都没有：才照字数平分
    let px = Math.min(px0, Math.floor(maxH / (n * 1.24))); for (const r of rows) px = Math.min(px, fit(ctx, r, px0, maxW, ls));
    if (!best || px > best.px * 1.15) best = { px, rows };
    if (px >= px0) break;
  }
  return best || { px: Math.min(fit(ctx, text, px0, maxW, ls), Math.floor(maxH / 1.24)), rows: [text] };
}
function textBlock(ctx, L, x, yMid, col, t0, t, ls = 4) {         // 几行字，整块竖着居中在 yMid；一行一行从蒙版里滑上来（字是原样的，不滚不跳）
  const lh = L.px * 1.24, y0 = yMid - (L.rows.length - 1) * lh / 2 + L.px * 0.36;
  L.rows.forEach((r, i) => G.maskText(ctx, r, x, y0 + i * lh, big(L.px), col, inv(t0 + i * 0.08, t0 + i * 0.08 + 0.45, t), { ls: ls + 'px' }));
}
function sayTimes(S, ats) {                                       // 几块东西各在第几秒亮：说到了才亮；头一块换屏落定半秒内必须在；最后一块至少留 1.2 秒给人看
  const n = ats.length, ts = [];
  for (let i = 0; i < n; i++) {
    let x = ats[i] ?? (i ? ts[i - 1] + 1.0 : S.a + 0.3);
    x = i ? Math.max(x, ts[i - 1] + 0.45) : Math.min(Math.max(x, S.a + 0.12), S.a + 0.3);
    const latest = S.b - 1.2 - (n - 1 - i) * 0.5; if (i && x > latest) x = Math.max(ts[i - 1] + 0.3, latest);
    ts.push(x);
  }
  return ts;
}
function arrowGlyph(ctx, x, y, s, col, p, bent) {                 // 两块中间的记号：朝下的粗箭头；bent = 先横着走一截再拐下来（转折）
  if (p <= 0) return; const k = E.oExp(p), y0 = y - s * 0.5, ty = y0 + s * k;
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = Math.min(1, p * 2.5); ctx.beginPath();
  if (bent) { ctx.moveTo(x - s * 0.8, y0); ctx.lineTo(x, y0); } else ctx.moveTo(x, y0);
  ctx.lineTo(x, ty); ctx.moveTo(x - s * 0.36, ty - s * 0.36); ctx.lineTo(x, ty); ctx.lineTo(x + s * 0.36, ty - s * 0.36);
  ctx.stroke(); ctx.restore();
}
function sameSize(ctx, texts, px0, lay) {                         // 几段字各自排好以后，统一用最小的那个字号再排一遍：一屏里的几块字一样大
  const a = texts.map((x, i) => lay(x, px0, i)), px = Math.min(...a.map(l => l.px));
  return a.map((l, i) => l.px === px ? l : lay(texts[i], px, i));
}
const chipPx = (text, most = 62) => Math.min(most, Math.floor((W - 2 * MX - 80) / (text.length * 1.06)));

// 五、两块：{ blocks:[{head, body, num, icon}], link, foot }。两三块上下摞着，先摆暗空位；说到哪块哪块亮成浅色，前头那块退成深色，一深一浅对着看
// link：对（成对、并排对照，中间不画记号）、因、变（中间一个朝下的箭头）、转（箭头先横后竖）、问（头一块带问号）、配（两块各带图标，底下一条小牌子写合起来是什么）
function cardPair(S) {
  const P = PAL[S.pal], fg = P.fg, hi = PAL.yellow.t[2], B = S.blocks, n = B.length, a = S.a, arrow = S.link === '因' || S.link === '变' || S.link === '转';
  const X0 = 60, BW = W - 120, GAP = arrow ? 116 : 30, top0 = 236, bot0 = 1424 - (S.foot ? 170 : 0), BH = Math.min(520, (bot0 - top0 - (n - 1) * GAP) / n), TOP = top0 + (bot0 - top0 - n * BH - (n - 1) * GAP) / 2;
  let from = a - 0.5; const ats = B.map(b => { const x = [atOf(b.head, from), atOf(b.body, from)].filter(v => v != null), v = x.length ? Math.min(...x) : null; if (v != null) from = v; return v; });
  const ts = sayTimes(S, ats), cap = i => Math.max(ts[i], S.b - 1.0);
  // 没有小标题的块：带子一亮字就在，不许亮着一块空带子等。有小标题的：小标题跟着带子到，大字说到了才出，可最晚 0.6 秒也得出
  const tb = B.map((b, i) => !(b.head && b.head.t) ? ts[i] : Math.min(Math.max(atOf(b.body, ts[i] - 0.3) ?? ts[i], ts[i]), ts[i] + (i ? 0.6 : 0.08), cap(i))), tn = B.map((b, i) => b.num ? Math.min(Math.max(atOf(b.num, tb[i] - 0.3) ?? tb[i] + 0.3, tb[i]), cap(i)) : null);
  const tf = S.foot ? Math.min(Math.max(when(S.foot, ts[0] - 0.5) ?? ts[n - 1] + 0.6, ts[0] + 0.3), Math.max(ts[n - 1], S.b - 0.9)) : null; let lay = null;
  const dims = b => ({ ix: b.icon ? 250 : 0, headH: b.head && b.head.t ? 108 : 0, numH: b.num ? 116 : 0 });
  return (ctx, t) => {
    const lt = t - a; ground(ctx, P, S.seed, lt);
    lay = lay || sameSize(ctx, B.map(b => b.body.t), 132, (x, px, i) => { const d = dims(B[i]), h = BH - d.headH - d.numH; return layText(ctx, x, px, BW - 80 - d.ix, h > 330 ? 3 : 2, 4, h - 44, B[i].body.br); });
    for (let i = 0; i < n; i++) {
      const b = B[i], dir = i % 2 ? 1 : -1, y = TOP + i * (BH + GAP), { ix, headH, numH } = dims(b);
      const pin = i ? E.ioExp(inv(ts[i] - 0.4, ts[i], t)) : S.early && S.hasTr ? 1 : E.ioExp(inv(0.04, 0.44, lt)), x = X0 + dir * W * (1 - pin);
      if (pin <= 0) continue;                                                                                              // 总控 11-16 夜：没进场的那块不画框（空着的深色框挂几秒像没加载出来），说到它才滑进来
      ctx.fillStyle = rgba(P.t[0], 0.55); ctx.fillRect(x, y, BW, BH);                                                        // 暗空位
      const said = E.ioExp(inv(ts[i] - 0.06, ts[i] + 0.3, t)), tnext = i + 1 < n ? ts[i + 1] : 1e9, hot = 1 - E.ioExp(inv(tnext - 0.06, tnext + 0.24, t));
      const bandCol = mix(P.t[0], fg, hot), txtCol = mix(fg, P.t[1], hot);
      if (said > 0) { const w = BW * said; ctx.fillStyle = bandCol; ctx.fillRect(dir < 0 ? x : x + BW - w, y, w, BH); }
      if (b.icon && said > 0) { const cy = y + BH / 2, r = 104 * E.oBack(said); G.disc(ctx, x + 146, cy, r, P.t[1]); ICONPIC.draw(ctx, b.icon, { x: x + 146, y: cy, size: 136, color: fg, lw: LW, enter: t - ts[i] }); }
      if (headH) G.maskText(ctx, b.head.t, x + 40 + ix, y + 92, big(fit(ctx, b.head.t, 64, BW - 80 - ix, 3)), rgba(txtCol, 0.86), inv(ts[i] + 0.02, ts[i] + 0.45, t), { ls: '3px' });
      textBlock(ctx, lay[i], x + 40 + ix, y + headH + (BH - headH - numH) / 2, txtCol, tb[i] + 0.02, t);
      if (b.num) G.maskText(ctx, b.num.t, x + 40 + ix, y + BH - 40, big(fit(ctx, b.num.t, 92, BW - 80 - ix, 3)), mix(hi, P.t[0], hot), inv(tn[i], tn[i] + 0.5, t), { ls: '3px' });
      if (arrow && i + 1 < n) arrowGlyph(ctx, W / 2, y + BH + GAP / 2, 84, fg, inv(ts[i + 1] - 0.3, ts[i + 1] + 0.1, t), S.link === '转');
    }
    if (tf != null) chip(ctx, X0, bot0 + 36, S.foot, P.t[1], fg, E.oExp(inv(tf, tf + 0.4, t)), big(chipPx(S.foot, 68)), chipPx(S.foot, 68));
  };
}
// 六甲、大数：{ num:{t, at, pre, n, u}, what }。一个数占一屏：数字最大，前头的字在上面小一号，单位跟在后头（放不下就另起一行）。整个从蒙版里滑上来，原样，不滚
// 深色底配黄色的数、浅色带配深色的数两种，架子按种子轮
function cardNum(S) {
  const P = PAL[S.pal], fg = P.fg, hi = PAL.yellow.t[2], a = S.a, N = S.num, light = (S.E ?? 0) % 2 === 1, maxW = W - 2 * MX, BY = 500, BHH = 620;
  const tn = Math.min(Math.max(N.at ?? when(N.t, a - 0.5) ?? a + 0.3, a + 0.12), a + 0.2), tw = S.what ? Math.min(Math.max(atOf(S.what, a - 0.5) ?? tn + 0.5, a + 0.3), Math.max(a + 0.3, S.b - 0.9)) : null;
  const split = N.n && (N.pre || '') + N.n + (N.u || '') === N.t; let L = null;      // 拆成「前头的字、数、单位」三截；拼回去和原样对不上就不拆，整个当一行字画
  const mk = ctx => {
    if (!split) return { whole: layText(ctx, N.t, 300, maxW, 2, 4, BHH - 120, N.br) };
    const npx = fit(ctx, N.n, 380, maxW, 2); ctx.save(); ctx.font = big(npx); ctx.letterSpacing = '2px'; const nw = ctx.measureText(N.n).width;
    let upx = Math.round(npx * 0.4), same = true;
    if (N.u) { ctx.font = big(upx); ctx.letterSpacing = '4px'; same = nw + 28 + ctx.measureText(N.u).width <= maxW; if (!same) upx = fit(ctx, N.u, 150, maxW, 4); }
    ctx.restore();
    const hPre = N.pre ? 124 : 0, hN = npx * 0.76, hU = N.u && !same ? upx * 1.3 : 0, y0 = BY + (BHH - hPre - hN - hU) / 2;
    return { npx, nw, upx, same, yPre: y0 + 94, yN: y0 + hPre + hN, yU: y0 + hPre + hN + upx * 1.16 };
  };
  return (ctx, t) => {
    const lt = t - a; ground(ctx, P, S.seed, lt); L = L || mk(ctx);
    const pin = S.early && S.hasTr ? 1 : E.ioExp(inv(0.02, 0.36, lt)), cN = light ? P.t[0] : hi, cT = light ? P.t[1] : fg;
    ctx.fillStyle = light ? fg : rgba(P.t[0], 0.62); ctx.fillRect(0, BY, W * pin, BHH);
    ctx.fillStyle = fg; ctx.fillRect(MX, BY - 52, 200 * E.oExp(inv(0.08, 0.48, lt)), 18);
    if (L.whole) textBlock(ctx, L.whole, MX, BY + BHH / 2, cN, tn, t);
    else {
      if (N.pre) G.maskText(ctx, N.pre, MX, L.yPre, big(fit(ctx, N.pre, 96, maxW, 4)), cT, inv(tn, tn + 0.45, t), { ls: '4px' });
      G.maskText(ctx, N.n, MX - 6, L.yN, big(L.npx), cN, inv(tn + 0.04, tn + 0.54, t), { ls: '2px' });
      if (N.u) G.maskText(ctx, N.u, L.same ? MX + L.nw + 22 : MX, L.same ? L.yN : L.yU, big(L.upx), cT, inv(tn + 0.14, tn + 0.64, t), { ls: '4px' });
    }
    if (tw != null) chip(ctx, MX, BY + BHH + 40, S.what.t, P.t[1], fg, E.oExp(inv(tw, tw + 0.4, t)), big(chipPx(S.what.t)), chipPx(S.what.t));
  };
}
// 六乙、比多少：{ rows:[{name, num:{t, at, val}}] }。一行一个数；底下一条粗条按数的大小长出来（云端那头没读出大小就不画条，只摆数）
function cardBars(S) {
  const P = PAL[S.pal], fg = P.fg, hi = PAL.yellow.t[2], a = S.a, R = S.rows, n = R.length, maxW = W - 2 * MX, top0 = 280, bot0 = 1400, RH = Math.min(440, (bot0 - top0) / n), TOP = top0 + (bot0 - top0 - n * RH) / 2;
  let from = a - 0.5; const ats = R.map(r => { const x = [atOf(r.name, from), atOf(r.num, from)].filter(v => v != null), v = x.length ? Math.min(...x) : null; if (v != null) from = v; return v; });
  const ts = sayTimes(S, ats), tv = R.map((r, i) => Math.min(Math.max(atOf(r.num, ts[i] - 0.3) ?? ts[i], ts[i]), i ? Math.max(ts[i], S.b - 1.0) : ts[i] + 0.1));
  const vals = R.map(r => +r.num.val), vmax = Math.max(...vals), bars = vals.every(v => v > 0) && vmax > 0;
  return (ctx, t) => {
    const lt = t - a; ground(ctx, P, S.seed, lt);
    for (let i = 0; i < n; i++) {
      const r = R[i], y = TOP + i * RH, pin = S.early && S.hasTr ? 1 : E.ioExp(inv(0.04 + i * 0.07, 0.44 + i * 0.07, lt));
      ctx.fillStyle = rgba(P.t[0], 0.55); ctx.fillRect(60, y + 14, (W - 120) * pin, RH - 28);
      if (r.name && r.name.t) G.maskText(ctx, r.name.t, MX, y + 104, big(fit(ctx, r.name.t, 64, maxW, 3)), fg, inv(ts[i] + 0.02, ts[i] + 0.45, t), { ls: '3px' });
      G.maskText(ctx, r.num.t, MX - 4, y + RH - 118, big(fit(ctx, r.num.t, Math.min(190, RH - 240), maxW, 3)), hi, inv(tv[i], tv[i] + 0.5, t), { ls: '3px' });
      if (bars) { ctx.fillStyle = rgba(fg, 0.22); ctx.fillRect(MX, y + RH - 86, maxW * pin, 34); ctx.fillStyle = hi; ctx.fillRect(MX, y + RH - 86, maxW * vals[i] / vmax * E.oExp(inv(tv[i] + 0.05, tv[i] + 0.7, t)), 34); }
    }
  };
}
// 七、引一句：{ text, who }。左上一对大引号，话排成几行大字垫在一块深色底上，一行一行滑上来；谁说的是底下一条小牌子
function cardQuote(S) {
  const P = PAL[S.pal], fg = P.fg, hi = PAL.yellow.t[2], a = S.a, X = MX + 16, areaT = 560, areaH = 780;
  const tq = Math.min(Math.max(when(S.text.slice(0, 4), a - 0.5) ?? a + 0.3, a + 0.12), a + 0.2), tw = S.who ? Math.min(Math.max(when(S.who, a - 0.5) ?? tq + 0.5, a + 0.3), Math.max(a + 0.3, S.b - 0.9)) : null; let L = null;
  return (ctx, t) => {
    const lt = t - a; ground(ctx, P, S.seed, lt); L = L || layText(ctx, S.text, 150, W - X - MX, 5, 4, areaH, S.br);
    const lh = L.px * 1.3, hh = L.rows.length * lh, y0 = areaT + (areaH - hh) / 2, pin = S.early && S.hasTr ? 1 : E.ioExp(inv(0.02, 0.36, lt));
    ctx.fillStyle = rgba(P.t[0], 0.62); ctx.fillRect(0, y0 - 64, W * pin, hh + 112);
    ctx.fillStyle = hi; ctx.fillRect(MX - 34, y0 - 14, 16, (hh + 12) * E.oExp(inv(0.06, 0.5, lt)));              // 左边一条竖杠
    G.maskText(ctx, '“', MX - 30, y0 + 40, big(380), hi, inv(0.04, 0.44, lt));                                    // 大引号：压在深色底的上沿
    L.rows.forEach((r, i) => G.maskText(ctx, r, X, y0 + i * lh + L.px * 0.94, big(L.px), fg, inv(tq + i * 0.12, tq + i * 0.12 + 0.45, t), { ls: '4px' }));
    if (tw != null) chip(ctx, X, y0 + hh + 84, S.who, P.t[1], fg, E.oExp(inv(tw, tw + 0.4, t)), big(chipPx(S.who)), chipPx(S.who));
  };
}
// 八、一步接一步：{ rows:[{t, icon}] }。竖着一串圆点，一根线串起来；说到哪步哪步亮（有图标画图标，没有就写第几步），线跟着往下长
function cardSteps(S) {
  const P = PAL[S.pal], fg = P.fg, a = S.a, R = S.rows, n = R.length, top0 = 250, bot0 = 1420, RH = Math.min(300, (bot0 - top0) / n), TOP = top0 + (bot0 - top0 - n * RH) / 2, CX = 196, RAD = Math.min(104, RH * 0.36), TX = CX + RAD + 60, TW = W - 84 - TX;
  let from = a - 0.5; const ats = R.map(r => { const v = when(r.t, from); if (v != null) from = v; return v; }), ts = sayTimes(S, ats); let lay = null;
  return (ctx, t) => {
    const lt = t - a; ground(ctx, P, S.seed, lt);
    const pin = S.early && S.hasTr ? 1 : E.ioExp(inv(0.02, 0.4, lt)); lay = lay || sameSize(ctx, R.map(r => r.t), 118, (x, px, i) => layText(ctx, x, px, TW, 2, 4, RH - 64, R[i].br));
    const rp = i => i ? E.ioExp(inv(ts[i] - 0.45, ts[i] - 0.05, t)) : pin;      // 总控 11-17 夜：还没说到的那步不先摆（空圈、空带、02 挂几秒像没加载出来），说到它才连着线长出来，照两块
    ctx.fillStyle = rgba(P.t[0], 0.6); for (let i = 1; i < n; i++) if (rp(i) > 0) ctx.fillRect(CX - 9, TOP + (i - 0.5) * RH, 18, RH * rp(i));      // 暗的轨
    for (let i = 1; i < n; i++) { const g = E.ioExp(inv(ts[i] - 0.45, ts[i] - 0.05, t)); if (g > 0) { ctx.fillStyle = fg; ctx.fillRect(CX - 9, TOP + (i - 0.5) * RH, 18, RH * g); } }      // 亮的线从上一步长到这一步
    for (let i = 0; i < n; i++) {
      const rpi = rp(i); if (rpi <= 0) continue;
      const r = R[i], cy = TOP + i * RH + RH / 2, said = E.ioExp(inv(ts[i] - 0.05, ts[i] + 0.3, t)), tnext = i + 1 < n ? ts[i + 1] : 1e9, hot = 1 - E.ioExp(inv(tnext - 0.06, tnext + 0.24, t));
      ctx.fillStyle = rgba(P.t[0], 0.42 + 0.2 * said); ctx.fillRect(TX - 28, cy - RH / 2 + 18, (W - 60 - TX + 28) * rpi, RH - 36);  // 字底下垫一条暗带
      G.disc(ctx, CX, cy, RAD * rpi, P.t[0]);
      const col = mix(fg, P.t[1], hot), num = '0' + (i + 1);
      if (said > 0) G.disc(ctx, CX, cy, RAD * E.oBack(said), mix(P.t[1], fg, hot));
      if (said > 0 && r.icon) ICONPIC.draw(ctx, r.icon, { x: CX, y: cy, size: RAD * 1.3, color: col, lw: LW, enter: t - ts[i] });
      else { ctx.save(); ctx.font = small(Math.round(RAD * 0.62)); ctx.letterSpacing = '2px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = said > 0.5 ? col : rgba(fg, 0.6 * rpi); ctx.fillText(num, CX + 1, cy + 2); ctx.restore(); }
      textBlock(ctx, lay[i], TX, cy, fg, ts[i] + 0.04, t);
    }
  };
}

// ───────── 这一段的排法 ─────────
const TA = 0.12, TB = 0.26;
// 没配上画面的那几句：只有底纹在滑（还有角上的小字和字幕）。屏上放什么还没设计，这是个空位
function cardIdle(S) { const P = PAL[S.pal]; return (ctx, t) => ground(ctx, P, S.seed, t - S.a); }
function buildShots() {
  const out = [], src = DATA.shots; let k = DATA.k0;
  for (const st of src) if (st.kind === 'stack') {            // 每张单子：每一行是第几秒说到的；说完最后一行过一会儿并成一块（架子没给时刻就照这个规矩）
    st.ts = []; let from = st.a - 0.3; for (const r of st.rows) { const w = when(r, from) ?? (st.ts.length ? st.ts[st.ts.length - 1] + 1 : st.a + 0.5); st.ts.push(Math.max(st.lead && !st.ts.length ? st.a + 0.35 : w, st.a + 0.35)); from = w; }
    if (st.merge == null) st.merge = Math.max(st.ts[st.ts.length - 1] + 0.9, Math.min(st.b - 1.0, st.ts[st.ts.length - 1] + 1.4));
  }
  src.forEach((s0, i) => {
    const s = { ...s0, pal: s0.pal || PALS[s0.kind] || 'teal', seed: 11 + i * 20 }, st = src[i + 1] && src[i + 1].kind === 'stack' ? src[i + 1] : null;
    if (s0.k != null) k = s0.k;                                // 架子给了「这是整条片的第几张小画面」就用它的
    const tr = (dflt) => !i ? null : s0.T != null ? TRS[s0.T % TRS.length] : dflt; s.hasTr = !!i;
    if (s.kind === 'none') out.push({ a: s.a, k, pal: s.pal, fn: cardIdle(s), tr: i ? 'slide' : null, fast: [] });
    else if (s.kind === 'icon') { if (OPT.list === '闪' && st) s.b = st.ts[0] - 0.15; out.push({ a: s.a, k, pal: s.pal, fn: cardIcon(s), tr: tr('split'), fast: [[s.a, s.a + 0.5]] }); }
    else if (s.kind === 'hero') out.push({ a: s.a, k, pal: s.pal, fn: cardHero(s), tr: tr('quarter'), fast: [[s.a, s.a + 0.5]] });
    else if (s.kind === 'title') out.push({ a: s.a, k, pal: s.pal, fn: cardTitle(s), tr: tr('rows'), fast: [[s.a, s.a + 0.5]] });
    else if (s.kind === 'pair') out.push({ a: s.a, k, pal: s.pal, fn: cardPair(s), tr: tr('rows'), fast: [[s.a, s.a + 0.6]] });
    else if (s.kind === 'num') out.push({ a: s.a, k, pal: s.pal, fn: s.rows ? cardBars(s) : cardNum(s), tr: tr('split'), fast: [[s.a, s.a + 0.6]] });
    else if (s.kind === 'quote') out.push({ a: s.a, k, pal: s.pal, fn: cardQuote(s), tr: tr('slide'), fast: [[s.a, s.a + 0.6]] });
    else if (s.kind === 'steps') out.push({ a: s.a, k, pal: s.pal, fn: cardSteps(s), tr: tr('cols'), fast: [[s.a, s.a + 0.6]] });
    else if (OPT.list === '闪') {
      s.as = s.ts.map(x => x - 0.15); s.ra = s.merge - 0.75;
      s.rows.forEach((_, j) => out.push({ a: s.as[j], k, pal: s.pal, fn: cardFlash(s, j), tr: j ? 'cols' : (i ? 'rows' : null), fast: [] }));
      out.push({ a: s.ra, k, pal: s.pal, fn: cardList(s, true), tr: 'flip', fast: [[s.merge, s.merge + 0.5]] });
    } else out.push({ a: s.a, k, pal: s.pal, fn: cardList(s, false), tr: tr('rows'), fast: [[s.a, s.a + 0.75], ...s.ts.map(x => [x - 0.06, x + 0.32]), [s.merge, s.merge + 0.5]] });
    if (s0.k == null) k++;
  });
  return out;
}
const SHOTS = buildShots();
const shotIdx = t => { for (let i = SHOTS.length - 1; i >= 0; i--) if (t >= SHOTS[i].a) return i; return 0; };
const drawShot = (ctx, s, t) => { ctx.save(); s.fn(ctx, t); ctx.restore(); };

// ───────── 角上的小字、进度小格、字幕 ─────────
function hud(ctx, P, k) {                                        // 只放这条片真有的：第几张小画面、一共几张。格子一张一格
  const fg = P.fg, n = DATA.nAll; ctx.save();
  ctx.font = small(26); ctx.letterSpacing = '3px'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = rgba(fg, 0.8);
  if (OPT.hudText !== false) { ctx.textAlign = 'left'; ctx.fillText(`第 ${k} 屏`, 64, 150); ctx.textAlign = 'right'; ctx.fillText(`共 ${n} 屏`, W - 64, 150); }      // 总控 11-16：角上的字去掉，只留底下那排小格（架子拼的页面不出字；老的出片脚本照旧）
  const x0 = 64, x1 = W - 64, y = 1700;                          // 抄：film.js 的进度小格（当前的又粗又高，过了的亮一点，没到的暗）
  for (let i = 1; i <= n; i++) {
    const x = lerp(x0, x1, (i - 1) / Math.max(1, n - 1)), now = i === k, done = i < k;
    ctx.fillStyle = rgba(fg, now ? 1 : done ? 0.75 : 0.28); ctx.fillRect(Math.round(x) - (now ? 3 : 1.5), y - (now ? 20 : 9), now ? 6 : 3, now ? 30 : 18);
  }
  ctx.restore();
}
const SUB = LINES.map((l, i) => { const nx = LINES[i + 1], end = nx ? Math.min(l.t1 + 0.3, nx.t0 - 0.01) : l.t1 + 0.3; return { text: l.text, t0: l.t0, end }; });
SUB.forEach((s, i) => { s.jp = i > 0 && s.t0 - SUB[i - 1].end < 0.2; s.jn = i + 1 < SUB.length && SUB[i + 1].t0 - s.end < 0.2; });
function subW(ctx, s) { if (s.w == null) { ctx.save(); ctx.font = SUBF; ctx.letterSpacing = '0px'; s.w = ctx.measureText(s.text).width + 92; ctx.restore(); } return s.w; }
function subtitles(ctx, t, P) {                                  // 抄：film.js 的字幕做法（实色带、字从蒙版里滑上来）；字号字体位置照软件和全息版
  const i = SUB.findIndex(s => t >= s.t0 - 0.01 && t < s.end); if (i < 0) return;
  const s = SUB[i], lt = t - s.t0, out = s.end - t, band = P.fg === G.CREAM ? P.t[0] : PAL.ink.t[1], y = 1490, bh = 108;
  let bw = subW(ctx, s); if (s.jp) bw = lerp(subW(ctx, SUB[i - 1]), bw, E.oExp(inv(0, 0.2, lt)));      // 两句挨着：带子不收，只变宽窄
  const p = (s.jp ? 1 : E.oExp(inv(0, 0.22, lt))) * (s.jn ? 1 : E.oExp(inv(0, 0.2, out))), x = W / 2 - bw * p / 2;
  if (!s.text || bw * p < 80) return;                                // 总控 11-17 夜：没有字的时候不画底条（两次盲看都说字幕条空着闪一下）
  ctx.save(); ctx.fillStyle = band; ctx.fillRect(x, y, bw * p, bh); ctx.beginPath(); ctx.rect(x, y, bw * p, bh); ctx.clip();
  G.maskText(ctx, s.text, W / 2, 1568, SUBF, G.CREAM, 1, { align: 'center' });      // 字一直摆好，底条从中间拉开到哪字就露到哪
  ctx.restore();
}

// ───────── 抄：film.js 的转场（rows、cols、slide、split、quarter、flip）、整帧、运动模糊 ─────────
const bufA = G.canvas(), bufB = G.canvas(), bufSub = G.canvas();
function composite(ctx, type, p, A, B) {
  const S = CELL, NR = Math.ceil(H / S), NC = Math.ceil(W / S);
  if (type === 'rows') {
    ctx.drawImage(A, 0, 0);
    for (let j = 0; j < NR; j++) {
      const pj = E.ioExp(clamp(p * 1.5 - j * 0.5 / (NR - 1))), dir = j % 2 ? 1 : -1;
      ctx.drawImage(A, 0, j * S, W, S, dir * W * 0.25 * pj, j * S, W, S);
      ctx.drawImage(B, 0, j * S, W, S, -dir * W * (1 - pj), j * S, W, S);
    }
  } else if (type === 'cols') {
    const n = Math.max(2, Math.round(W / 240)), cw = W / n; ctx.drawImage(A, 0, 0);
    for (let i = 0; i < n; i++) {
      const pj = E.ioExp(clamp(p * 1.5 - i * 0.5 / (n - 1))), dir = i % 2 ? 1 : -1;
      ctx.drawImage(B, i * cw, 0, cw, H, i * cw, -dir * H * (1 - pj), cw, H);
    }
  } else if (type === 'slide') {
    const pj = E.ioExp(p);
    ctx.drawImage(A, -W * 0.3 * pj, 0); ctx.drawImage(B, W * (1 - pj), 0);
    ctx.fillStyle = `rgba(0,0,0,${0.15 * (1 - Math.abs(pj - 0.5) * 2)})`; ctx.fillRect(W * (1 - pj) - 8, 0, 8, H);
  } else if (type === 'split') {
    const pj = E.ioExp(p); ctx.drawImage(A, 0, 0);
    ctx.drawImage(B, 0, 0, W / 2, H, 0, -H * (1 - pj), W / 2, H);
    ctx.drawImage(B, W / 2, 0, W / 2, H, W / 2, H * (1 - pj), W / 2, H);
  } else if (type === 'quarter') {
    ctx.drawImage(A, 0, 0);
    ctx.save(); ctx.beginPath();
    for (let j = 0; j < NR; j++) for (let i = 0; i < NC; i++) {
      const d = (i + j) * 0.525 / (NR + NC - 2), r = S * 1.42 * E.o3(clamp((p - d) / 0.55));
      if (r <= 0) continue;
      const corner = (i + j) % 4, cx = i * S + (corner === 1 || corner === 2 ? S : 0), cy = j * S + (corner >= 2 ? S : 0);
      ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
  } else if (type === 'flip') flip(ctx, p, A, B);
}
function flip(ctx, p, A, B) {
  const S = CELL, cols = Math.ceil(W / S), rows = Math.ceil(H / S);
  ctx.drawImage(B, 0, 0); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, W, H);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const d = ((i * 0.6 + j) / (cols * 0.6 + rows)) * 0.5, pc = clamp((p - d) / 0.5);
    const src = pc < 0.5 ? A : B, sx = Math.abs(Math.cos(pc * Math.PI)), x = i * S, y = j * S, w = S * sx;
    ctx.drawImage(src, x, y, S, S, x + (S - w) / 2, y, Math.max(1, w), S);
    if (pc > 0 && pc < 1) { ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 - sx)})`; ctx.fillRect(x + (S - w) / 2, y, w, S); }
  }
}
const buffers = () => { const ca = bufA.getContext('2d'), cb = bufB.getContext('2d'); ca.setTransform(1, 0, 0, 1, 0, 0); cb.setTransform(1, 0, 0, 1, 0, 0); return [ca, cb]; };
function frame(ctx, t) {
  const i = shotIdx(t), s = SHOTS[i], nx = SHOTS[i + 1]; let tr = null;
  if (nx && nx.tr && t >= nx.a - TA) tr = [s, nx]; else if (i > 0 && s.tr && t < s.a + TB) tr = [SHOTS[i - 1], s];
  if (tr) { const [a, b] = tr, p = clamp((t - (b.a - TA)) / (TA + TB)), [ca, cb] = buffers(); drawShot(ca, a, t); drawShot(cb, b, Math.max(t, b.a)); composite(ctx, b.tr, p, bufA, bufB); }
  else drawShot(ctx, s, t);
  const P = PAL[s.pal]; hud(ctx, P, s.k); subtitles(ctx, t, P);
}
const FAST = []; SHOTS.forEach(s => { if (s.tr) FAST.push([s.a - TA, s.a + TB]); FAST.push(...s.fast); });
const isFast = t => FAST.some(([a, b]) => t >= a && t < b);
function render(t) {
  const ctx = ctxMain; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  if (!OPT.blur || !isFast(t)) { frame(ctx, t); return 1; }
  const N = 5, shutter = 0.45 / 24, sc = bufSub.getContext('2d'), i0 = shotIdx(t);      // 动得快的那几段：一帧里画五回再平均
  for (let k = 0; k < N; k++) {
    sc.setTransform(1, 0, 0, 1, 0, 0);
    let ts = t - shutter / 2 + (shutter * k) / (N - 1);
    if (shotIdx(ts) !== i0) ts = t;
    frame(sc, ts);
    ctx.globalAlpha = 1 / (k + 1); ctx.drawImage(bufSub, 0, 0);
  }
  ctx.globalAlpha = 1; return N;
}
window.draw = t => { const t0 = performance.now(); render(t); return performance.now() - t0; };
window.isFast = isFast;
window.transStill = (type, p) => { const [ca, cb] = buffers(), a = SHOTS[0], b = SHOTS[SHOTS.length - 1]; drawShot(ca, a, a.a + 3); drawShot(cb, b, b.a + 3); ctxMain.setTransform(1, 0, 0, 1, 0, 0); composite(ctxMain, type, p, bufA, bufB); return true; };   // 核对用：某种转场走到 p 的样子
const ALLTXT = LINES.map(l => l.text).join('') + DATA.shots.map(s => JSON.stringify(s)).join('') + '第共屏0123456789/“”';
window.READY = document.fonts.ready.then(() => Promise.all(['900 40px "Inter Tight"', `900 40px ${ZH}`, '800 40px NotoSC', '500 20px "DM Mono"', `500 20px ${ZH}`].map(f => document.fonts.load(f, 'Aa' + ALLTXT))))
  .then(() => { SHOTS.forEach(s => drawShot(bufA.getContext('2d'), s, s.a + 1)); return { shots: SHOTS.map(s => [+s.a.toFixed(2), s.tr || '', s.pal]), fast: FAST.map(f => f.map(x => +x.toFixed(2))) }; });
