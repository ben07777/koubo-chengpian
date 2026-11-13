# 剪气口和口误：按听写出的每个字的时间，算出该剪哪儿，再用 ffmpeg 一刀剪好。
# 剪三样：句子之间过长的停顿（剪到 0.3 秒左右）；单独的「嗯」「呃」；说错重说的前一遍（只留最后一遍）。
# 切点对齐到视频帧，音视频每段一样长，剪多少刀口型都不会越走越偏；接口处 12 毫秒淡入淡出，不爆音。
import re, subprocess
from difflib import SequenceMatcher
from pathlib import Path

FILLER = set('嗯呃额唔')        # 出现就剪
SOLO = {'啊', '呀', '哦', '诶', '欸'}  # 自成一句时才剪（「好啊」里的不剪）
KEEP_GAP = 0.3   # 句间停顿剪到这么长
HEAD, TAIL = 0.15, 0.5  # 开头留多少静音，结尾留多少
PUNCT = re.compile(r"[，。！？、；：,.!?;:“”\"'（）()《》…—\-\s▁]+")


def _clauses(segs):
    """按标点和停顿把字切成小句：[{t: 文字, t0, t1, cs: [(字, 时间)]}]。"""
    out = []
    for s in segs:
        cur = []
        toks, ts = s['tokens'], s['ts']
        for i, tk in enumerate(toks):
            tk = tk.replace('▁', ' ').strip()
            if not tk: continue
            nxt = toks[i + 1].replace('▁', ' ').strip() if i + 1 < len(toks) else ''
            if cur and tk in '.．-－−:：/／,' and cur[-1][0] in '0123456789０１２３４５６７８９' and nxt[:1] and nxt[0] in '0123456789０１２３４５６７８９':
                cur.append((tk, ts[i])); continue            # 数中间的符号（. - : / ,）：不在这里断小句（和听写拍平那一步同一个认法，11-09 复审、第三轮）
            if tk in '-－−' and nxt[:1] and nxt[0] in '0123456789０１２３４５６７８９' and not (cur and cur[-1][0] in '0123456789０１２３４５６７８９'):
                cur.append(('负', ts[i])); continue           # 负号：留着，不当标点断句
            if PUNCT.fullmatch(tk):
                if cur: out.append(cur); cur = []
                continue
            for k, ch in enumerate(tk):  # 英文词可能是一整个 token
                cur.append((ch, ts[i] if k == 0 else ts[i] + 0.01 * k))
        if cur: out.append(cur)
    res = []
    for k, cs in enumerate(out):
        nxt = out[k + 1][0][1] if k + 1 < len(out) else None
        res.append(dict(t=''.join(c for c, _ in cs), cs=cs, t0=cs[0][1], t1=nxt))
    for s in segs:  # 每段话最后一句的结尾 = 这段话的结尾
        for c in res:
            if s['start'] - 0.01 <= c['t0'] <= s['end'] and (c['t1'] is None or c['t1'] > s['end']):
                c['t1'] = s['end']
    return res


def _same_take(a, b):
    """a 是不是 b 的「说错的前一遍」：b 以 a 开头，或者两句前半截一样、整体很像。"""
    if len(a) >= 2 and b.startswith(a): return True
    if len(a) >= 4 and b.startswith(a[:-1]): return True  # 前一遍最后一个字没说完、认错了
    n = 0
    while n < min(len(a), len(b)) and a[n] == b[n]: n += 1
    return len(a) >= 4 and n >= 4 and SequenceMatcher(None, a, b).ratio() >= 0.6


def plan(segs, total):
    """返回 (要保留的时间段, 剪掉的清单)。清单每项：dict(t0, t1, kind, text)，时间都是原素材的。"""
    cuts = []
    if not segs: return [(0, total)], []
    cl = _clauses(segs)
    # 1. 语气词
    for c in cl:
        if all(ch in FILLER | SOLO for ch, _ in c['cs']) and c['t1']:
            cuts.append(dict(t0=c['t0'] - 0.03, t1=c['t1'], kind='语气词', text=c['t']))
            c['gone'] = True; continue
        for j, (ch, t) in enumerate(c['cs']):
            if ch in FILLER:
                t1 = c['cs'][j + 1][1] if j + 1 < len(c['cs']) else c['t1']
                if t1: cuts.append(dict(t0=t - 0.03, t1=t1 - 0.02, kind='语气词', text=ch))
    # 2. 说错重说：往后看两句（跳过已剪的语气词）
    live = [c for c in cl if not c.get('gone')]
    for k, a in enumerate(live):
        for b in live[k + 1:k + 3]:
            if _same_take(PUNCT.sub('', a['t']), PUNCT.sub('', b['t'])):
                cuts.append(dict(t0=a['t0'] - 0.05, t1=b['t0'] - 0.08, kind='重说', text=a['t']))
                break
    # 3. 停顿：两段话之间超过 KEEP_GAP 的，剪掉中间
    sp = sorted((s['start'], s['end']) for s in segs)
    if sp[0][0] > HEAD + 0.05: cuts.append(dict(t0=0, t1=sp[0][0] - HEAD, kind='停顿', text=''))
    for (_, e), (s, _) in zip(sp, sp[1:]):
        if s - e > KEEP_GAP + 0.1:
            cuts.append(dict(t0=e + KEEP_GAP / 2, t1=s - KEEP_GAP / 2, kind='停顿', text=''))
    if total - sp[-1][1] > TAIL + 0.05: cuts.append(dict(t0=sp[-1][1] + TAIL, t1=total, kind='停顿', text=''))
    # 合并成要保留的段；和重说、语气词重叠的停顿并进去，清单上不重复列
    cuts = [dict(c, t0=max(0, c['t0']), t1=min(total, c['t1'])) for c in cuts]
    cuts = sorted((c for c in cuts if c['t1'] - c['t0'] > 0.04), key=lambda c: c['t0'])
    main = [c for c in cuts if c['kind'] != '停顿']
    for c in [c for c in cuts if c['kind'] == '停顿']:
        hit = next((m for m in main if c['t0'] < m['t1'] + 0.05 and c['t1'] > m['t0'] - 0.05), None)
        if hit:
            hit['t0'], hit['t1'] = min(hit['t0'], c['t0']), max(hit['t1'], c['t1']); cuts.remove(c)
    keep, at = [], 0.0
    for c in cuts:
        if c['t0'] > at: keep.append([at, c['t0']])
        at = max(at, c['t1'])
    if at < total: keep.append([at, total])
    keep = [k for k in keep if k[1] - k[0] > 0.06]
    return keep, cuts


def summary(cuts, keep, total):
    n = {k: sum(1 for c in cuts if c['kind'] == k) for k in ('停顿', '语气词', '重说')}
    return dict(n=sum(n.values()), sec=round(total - sum(b - a for a, b in keep), 1), **n)


def _fps(src, ffmpeg):
    r = subprocess.run([ffmpeg, '-i', str(src)], capture_output=True, text=True, encoding='utf-8', errors='ignore')
    m = re.search(r'Video:.*?(\d+(?:\.\d+)?) fps', r.stderr or '')
    return float(m.group(1)) if m else None


def apply(src, keep, out, ffmpeg, video):
    """按保留段把素材剪好。video=True 时连画面一起剪（重新编码），否则只出声音。"""
    fps = _fps(src, ffmpeg) if video else None
    if fps:  # 切点对齐视频帧，每段音视频一样长
        keep = [[round(a * fps) / fps, round(b * fps) / fps] for a, b in keep]
        keep = [k for k in keep if k[1] - k[0] >= 2 / fps]
    lines, ins = [], []
    for i, (a, b) in enumerate(keep):
        f = min(0.012, (b - a) / 4)
        lines.append(f'[0:a]atrim=start={a:.4f}:end={b:.4f},asetpts=PTS-STARTPTS,'
                     f'afade=t=in:d={f:.3f},afade=t=out:st={b - a - f:.4f}:d={f:.3f}[a{i}];')
        if fps:
            lines.append(f'[0:v]trim=start={a:.4f}:end={b:.4f},setpts=PTS-STARTPTS[v{i}];')
            ins.append(f'[v{i}][a{i}]')
        else:
            ins.append(f'[a{i}]')
    lines.append(''.join(ins) + f'concat=n={len(keep)}:v={1 if fps else 0}:a=1' + ('[v][a]' if fps else '[a]'))
    script = Path(out).with_name('_剪辑.txt'); script.write_text('\n'.join(lines), encoding='utf-8')
    cmd = [ffmpeg, '-y', '-loglevel', 'error', '-i', str(src), '-/filter_complex', str(script)]
    if fps:
        cmd += ['-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '192k', str(out)]
    else:
        cmd += ['-map', '[a]', '-c:a', 'pcm_s16le', '-ar', '48000', str(out)]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='ignore')
    script.unlink(missing_ok=True)
    if r.returncode: raise RuntimeError('ffmpeg: ' + (r.stderr or '').strip()[-600:])
    return out


def write_list(cuts, path):
    """剪辑清单：原素材里哪几秒被剪了、为什么。"""
    def mmss(x): return f'{int(x // 60)}:{x % 60:05.2f}'
    rows = ['下面是自动剪掉的地方（时间是原素材里的位置）。不想剪，导入时把「自动剪掉气口和口误」关掉再生成一次。', '']
    for c in cuts:
        rows.append(f"{mmss(c['t0'])} - {mmss(c['t1'])}  {c['kind']}" + (f"：{c['text']}" if c['text'] else f"（{c['t1'] - c['t0']:.1f} 秒）"))
    Path(path).write_text('\n'.join(rows) + '\n', encoding='utf-8-sig')
