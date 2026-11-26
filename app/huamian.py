# 整条片配画面（专业版，2026-11-15 从试验夹 专业版\写画面试验_1114\跑.py 搬进来）。只有开了「云端排画面」、云端也回了话的片子走这里，免费版不碰。
# 云端模型把整条片每两到四句配一个画面（十三种老画法 + 十三种小画面 + 标题、引一句、图标词），只填词和图标名，不写代码。
# 这里三件事：
#   1 build_prompt / parse：给模型的说明（huamian_shuoming.txt）和拆回话。中转（服务器）和软件用同一份。
#   2 check_all：本机把关。填的字必须是那几句字幕里原样连着的字；好坏混排、先后排反、停在半句上的拦下；同一种不连着用、全片最多 3 次。
#      认不准的整处不要，那几句照没有画面的排法出（宁可少出，不许配错意思）。
#   3 place：排卡。说完就走，最后一样东西说到以后至少停 1.3 秒，不够往后借一句；盖到开场、收尾的不要。
# 画面在出片网页里还有一道（画风\字卡\专业版\）：字不在字幕里、出框、出错的那张当场退回一屏一句。
import collections, difflib, json, re
from pathlib import Path
import donghua

APP = Path(__file__).resolve().parent
KIND = '小画面'                 # 剧本里这种卡的 kind；修改页的签写「小画面：某某」，点 × 就不画
CAP = '+画面3+补1'                  # 软件报给中转的版本号后面带这一截：新中转看到就照这份说明叫几遍、把关、查过意思再回（11-16）；老中转不认得，照旧给老的十三种（请求里不能加新栏，老中转见到不认得的栏会整条拒掉）
MARK = re.compile(r'^(原来|但|可是|可|而|不过|然而|反过来|相反|另|再说|那|所以|第[一二三四五六七八九十])')      # 一句话拿这些字开头，多半是换了个说法或者换了个对象
SYM = re.compile(r'[\s→←↑↓↗↘✓✔✗✕×·•…?!？！+＋=≠<>＜＞:：“”"\'「」《》（）()、，。,／/|~～—-]')
norm = lambda s: SYM.sub('', str(s))
KIT = {'标题': ('大字', '小字', '图标'), '引一句': ('话', '谁', '图标'), '图标词': ('图标', '词', '小字')}      # 11-16：标题、引一句多一栏「图标」（可以不填）
KITJS = {'标题': '标题', '引一句': '引话', '图标词': '图标词'}
XIAO = ('单子', '流程', '主角', '问答', '不是', '天平', '拉开', '关卡', '里外', '连锁', '挑出', '循环', '配上', '成对')
PARA = ('几个要点', '单子', '主角', '流程', '连锁', '循环')          # 把几样东西排成并列、先后的：中间不许有转过来的话，不许好坏混着
NOT_BEFORE = re.compile(r'不是|并不是|并非|不等于|不只是|不光是|而不是|不能直接理解成|不能理解成|不算|没有|别')
NEG_W = re.compile(r'反而|显得生|尴尬|别扭|硬塞|吃亏|踩坑|糟|惨|失败|麻烦|不好|不行|不如|不值|亏了|骗')
POS_W = re.compile(r'体面|自然|划算|合适|靠谱|轻松|省心|省钱|更好|值得|放心|好处')
TURN_W = re.compile(r'但是|可是|然而|反而|反倒|没想到|结果却|却|不如|而不是')
MOST = 40                       # 一条片最多收模型几处（再多是模型乱回）
TAIL = 0.3                      # 小画面：一样东西从开口到落定
STAY = 1.3                      # 最后一样东西说到以后，到卡走至少这么久（进来 0.5 + 停 0.8）
SPAN = 6                        # 一张卡最多盖几句
SPAN_DUI = 8                    # 「成对」这一种最多盖几句
HALF = '的地得和与跟把被比向对给是在'   # 一句话停在这些字上，就是半截话
wide = lambda s: sum(1 if ord(ch) >= 0x2e80 else 0.62 for ch in str(s))   # 字宽：中文 1、字母数字 0.62（和出片网页量字的算法一样）


# ───────────── 1 说明和拆回话（中转和软件同一份） ─────────────
def _shuoming():
    for name in ('huamian_shuoming.txt',):
        p = APP / name
        if p.exists(): return p.read_text(encoding='utf-8')
    raise RuntimeError('找不到配画面的说明 huamian_shuoming.txt')


PER = 4.6                       # 写明密度的时候：大约每几句配一处（第七份试题里中档开思考真配的密度：四条稿平均 86 句配 18.5 处）
SEG = 30                        # 分段填的时候：一段大约几句


def scale_of(n):
    """长片的上限照句数放大：90 句以内（两分半上下）是 1，再长每 90 句加 1。"""
    return max(1, -(-int(n) // 90))


def split_segs(lines, size=SEG):
    """把一条片切成大约 size 句一段：[(a, b), …]（从 0 数，不含 b）。切口挑在附近停顿最长的地方。lines 是带 t0、t1 的句子。"""
    n = len(lines); k = max(1, round(n / size)); cuts = [0]
    for j in range(1, k):
        i0 = round(n * j / k); lo, hi = max(cuts[-1] + 8, i0 - 4), min(n - 8, i0 + 4)
        cuts.append(max(range(lo, hi + 1), key=lambda i: (float(lines[i]['t0']) - float(lines[i - 1]['t1']), -abs(i - i0))) if lo <= hi else max(cuts[-1] + 1, min(n - 1, i0)))
    cuts.append(n)
    return [(cuts[i], cuts[i + 1]) for i in range(k)]


PIC_RULE = ('- 带图标、带图形的画法优先：流程、主角、天平、拉开、关卡、里外、连锁、挑出、循环、配上、图标词，还有带数的那几种。'
            '「单子、问答、引一句、标题、成对、不是」只是把字装进框里：同样对得上意思的时候，先挑带图的。'
            '「单子、引一句、标题」这三种要用，就多填一栏「图标」（这几句说的那样东西，从图标名单里挑；挑不出对得上的可以不填）。\n')


def build_prompt(lines, seg=None, dense=False, pic=False):
    """lines：[{'开始': 秒, '句': 字}]（中转收到的样子）。说完的秒软件没发（老中转不收），照下一句开口和字数估一个。
    seg=(a, b)：只配第 a+1 到第 b 句这一段（编号还是整条片里的编号，前后各带几句上下文）；dense：写明要配多少处。
    两样都不给、片子在 90 句以内的，出来的题面和原来一个字不差。"""
    rows = []; N = len(lines)
    for i, x in enumerate(lines):
        s = re.sub(r'\s+', '', str(x.get('句') or '')); t0 = float(x.get('开始') or 0)
        t1 = t0 + max(0.6, len(s) * 0.24)
        if i + 1 < len(lines): t1 = min(t1, max(t0 + 0.3, float(lines[i + 1].get('开始') or 0)))
        rows.append(f'{i + 1} | {s} | {t0:.1f}–{t1:.1f}')
    p = _shuoming(); sc = scale_of(N)
    if pic:                                                 # 11-16 题面的新写法：带图的画法优先（关着的时候一个字不动）
        a_ = '- 每个画面先想清楚这几句在说什么意思，再挑最合这个意思的画法；意思合不上的不许硬配，宁可空着。\n'
        if p.count(a_) != 1: raise RuntimeError('配画面的说明对不上号（找不到这一句）：' + a_[:24])
        p = p.replace(a_, a_ + PIC_RULE)

    def rep(old, new, n=1):
        nonlocal p
        if p.count(old) != n: raise RuntimeError('配画面的说明对不上号（找不到这一句）：' + old[:24])
        p = p.replace(old, new)
    whole = seg is None or (seg[0] <= 0 and seg[1] >= N)
    if whole:
        if dense: rep('- 整条片至少七成的句子要有画面，前、中、后都要有。', f'- 这条片一共 {N} 句，要配不少于 {max(4, round(N / PER))} 处画面（大约每 4 到 5 句一处），至少七成的句子要有画面，前、中、后都要有；配少了算没做完。')
        if sc > 1:
            rep('除了「标题」「引一句」最多 2 次，别的每一种全片最多 3 次', f'除了「标题」「引一句」最多 {2 * sc} 次，别的每一种全片最多 {3 * sc} 次')
            rep('全片最多用 2 次', f'全片最多用 {2 * sc} 次', 2)
            rep('3. 同一种画法全片最多 3 次（标题、引一句最多 2 次）', f'3. 同一种画法全片最多 {3 * sc} 次（标题、引一句最多 {2 * sc} 次）')
        return p.replace('SUBS', '\n'.join(rows) + '\n')
    a, b = max(0, int(seg[0])), min(N, int(seg[1])); n = b - a; k = max(1, round(N / SEG)); c = max(1, -(-3 * sc // k))
    rep('下面是整条口播的逐句字幕', '下面是一条口播里的一段逐句字幕')
    rep('从第 3 句起，把整条片按意思分成一个一个画面', f'这回只配这条片里的一段：第 {a + 1} 到第 {b} 句（编号是整条片里的编号，照着写）。从第 {max(a + 1, 3)} 句起，把这一段按意思分成一个一个画面')
    rep('一口气配到最后一句。', f'一口气配到第 {b} 句。')
    rep('- 整条片至少七成的句子要有画面，前、中、后都要有。', (f'- 这一段一共 {n} 句，要配不少于 {max(2, round(n / PER))} 处画面（大约每 4 到 5 句一处），至少七成的句子要有画面，前、中、后都要有；配少了算没做完。' if dense else '- 这一段至少七成的句子要有画面，前、中、后都要有。'))
    rep('除了「标题」「引一句」最多 2 次，别的每一种全片最多 3 次', f'这一段里每一种画法最多用 {c} 次（「标题」「引一句」最多 1 次）')
    rep('全片最多用 2 次', '这一段最多用 1 次', 2)
    rep('3. 同一种画法全片最多 3 次（标题、引一句最多 2 次）', f'3. 同一种画法这一段最多 {c} 次（标题、引一句最多 1 次）')
    rep('从第 1 句到最后一句，每一句挑一个最要紧的词', f'从第 {a + 1} 句到第 {b} 句，每一句挑一个最要紧的词')
    if a > 0:                                               # 回话格式那个例子里的号换成这一段的号：不然第二段以后它可能照例子从 1 编（11-15 盲查）
        rep('"从": 3, "到": 5, ...}, ...], "强调": {"1": "词", "2": "词", ...}}', f'"从": {a + 3}, "到": {a + 5}, ...}}, ...], "强调": {{"{a + 1}": "词", "{a + 2}": "词", ...}}}}')
    if a > 0:
        rep('- 第 1、2 句是开场，不配（下面例子里的编号只是示意）。两个画面不许盖同一句。', '- 下面例子里的编号只是示意。两个画面不许盖同一句。')
        rep('- 开头几句（第 3 到第 10 句）挑最有把握的配，先用并排对照、亮出大数、占多少这几种稳的。\n', '')
    body = []
    if a > 0: body += ['（上文：只给你看懂意思用，不许配画面，不许抄里面的字）'] + rows[max(0, a - 3):a] + ['（要配的这一段从这里开始）']
    body += rows[a:b]
    if b < N: body += [f'（这一段到这里为止。下文：只给你看懂意思用，不许配画面；最后一个画面的「到」最多写到第 {b} 句）'] + rows[b:b + 2]
    return p.replace('SUBS', '\n'.join(body) + '\n')


def _loose(raw, key='画面'):
    """整个拆不开的回话（第七份试题里最强档有一份：一处画面后面多了一个括号），一处一处救：找到「画面」那一串，一个一个字典往下拆，拆不动的那一个跳过。"""
    raw = str(raw or ''); m = re.search(r'"%s"\s*:\s*\[' % re.escape(key), raw); out = []
    if not m: return out
    i = m.end(); dec = json.JSONDecoder()
    while i < len(raw):
        ch = raw[i]
        if ch == '{':
            try: obj, j = dec.raw_decode(raw, i); out.append(obj); i = j; continue
            except ValueError:
                m2 = re.compile(r'\}\s*,\s*\{').search(raw, i)   # 这一个坏了：跳到下一个（中间隔着空格、换行的也认，11-15 盲查）
                if not m2: break
                i = m2.end() - 1; continue
        if ch == ']': break
        if ch in ' \t\r\n,}': i += 1; continue
        break
    return out


def parse(raw):
    """模型的回话 → 一处一处的画面（只要是字典、有类型就收，查在后头）。拆不开回空。模型自己写代码的那种不收。"""
    raw = str(raw or ''); a, b = raw.find('{'), raw.rfind('}')
    try: ans = json.loads(raw[a:b + 1]) if a >= 0 and b > a else {}
    except ValueError: ans = {'画面': _loose(raw)}
    its = ans.get('画面') if isinstance(ans, dict) else None
    out = []
    for x in its if isinstance(its, list) else []:
        if not isinstance(x, dict) or not isinstance(x.get('类型'), str) or x.get('类型') == '自画' or '代码' in x: continue
        if len(json.dumps(x, ensure_ascii=False)) > 600: continue
        out.append(x)
    return out[:MOST * 8]                                   # 这里只挡乱回的；一条片最多收几处照句数算，在 check_all 里


# ───────────── 2 本机把关 ─────────────
_ICONS = None


def icons():
    """能用的图标名：软件原有的 + 专业版带的那一批。"""
    global _ICONS
    if _ICONS is None and (APP / 'tubiao.json').exists(): _ICONS = set(json.loads((APP / 'tubiao.json').read_text(encoding='utf-8')))   # 试题包里只带一份名单
    if _ICONS is None:
        dec = json.JSONDecoder(); names = set()
        s = (APP / '画风' / '公共' / 'icons.js').read_text(encoding='utf-8')
        names |= set(dec.raw_decode(s[s.index('{'):])[0])
        p = APP / '画风' / '字卡' / '专业版' / '2_图标.js'
        if p.exists():
            s = p.read_text(encoding='utf-8'); names |= set(dec.raw_decode(s[s.index('{', s.index('Object.assign(window.ICONS')):])[0])
        _ICONS = names
    return _ICONS


def mixed_check(k, ws, span):
    """并列的几样里混着一好一坏、或者中间有转过来的话 → 不算并列，拦下（11-14 试看：「显得生份 / 既体面 / 又自然」被排成并列三条，意思反了）。"""
    if k not in PARA or len(ws) < 2: return
    ps = sorted((span.find(norm(w)), norm(w)) for w in ws)
    for (i0, w0), (i1, w1) in zip(ps, ps[1:]):
        gap = span[i0 + len(w0):i1] if i1 > i0 else ''
        if TURN_W.search(gap) or TURN_W.search(w1[:3]): raise donghua.Bad(f'「{w0}」和「{w1}」中间有转过来的话，不是并列的几样')
    neg = [w for _, w in ps if NEG_W.search(w)]; pos = [w for _, w in ps if POS_W.search(w) and not NEG_W.search(w)]
    if neg and pos: raise donghua.Bad(f'「{neg[0]}」是坏的那边，「{pos[0]}」是好的那边，不能排成并列的几样')


def gate(a, T, lines, K):
    """一处画面合不合格 → 排卡要的东西；不合格抛 donghua.Bad（原因是中文）。"""
    k = a.get('类型'); n = len(lines); ICONS = icons()
    if k in donghua.KINDS:
        c = donghua.check(a, T, K)
        if c['la'] < 2: raise donghua.Bad('前两句是开场，不配')
        if k == '几个要点': mixed_check(k, list(c['点']), norm(''.join(T[c['la']:c['lb']])))
        for w_ in _strs({x: y for x, y in donghua.public(c).items() if x not in ('类型', '从', '到')}): head_neg(w_, T, c['la'], c['lb'])
        return c
    la, lb = donghua._span(a, n, SPAN_DUI if k == '成对' else SPAN)
    if la < 2: raise donghua.Bad('前两句是开场，不配')
    span = norm(''.join(T[la:lb]))
    flat = [(ch, c[1], i) for i in range(la, lb) for c in lines[i]['cs'] for ch in c[0] if not SYM.match(ch)]   # 这几句一个字一格：(字, 开口的秒, 第几句)
    used = []                                              # 这张卡上用到的词在这几句里的位置 (起, 止)

    def whole(w):                                          # 截得完整：不截半个数、不丢紧挨着的限定词、不丢否定（和老画法同一个查法。11-15 盲查：「这不是什么坏事」填成「坏事」放过了）
        w0 = w; w = norm(w); seen = False                  # 带着标点比不上字幕的，去了标点再查（二次盲查：「坏事！」整个没查）
        if not w: return False
        for m in (1, 2, 3):                                # 在一行里的、断在两行上的、断在三行上的
            for i in range(la, lb - m + 1):
                raw = ''.join(T[i:i + m]); t = raw if norm(raw) == raw else norm(raw)
                if w not in t or (m > 1 and any(w in norm(''.join(T[j:j + m - 1])) for j in (i, i + 1))): continue
                seen = True; nx = T[i + m] if i + m < n else ''
                if not (K['cut_ok'](w, t, nx) and K['block_ok'](t, w)): continue
                if t.startswith(w) and i > 0 and NEG_END.search(_mask(norm(T[i - 1]))): continue   # 词顶着一行的头，上一行是拿否定收的尾（企业不再 / 招年轻毕业生）
                return True
            if seen: break
        if not seen and w in span:                         # 断在四行以上的：拿这几句整个连起来查（宁可多拦）
            seen = True
            if K['cut_ok'](w, span, T[lb] if lb < n else '') and K['block_ok'](span, w): return True
        if seen: raise donghua.Bad(f'「{w0}」截得不完整（截了半个数，或者丢了紧挨着的「不、没」「大约、将近」这类字；否定落在上一句末尾的也算）')
        return False

    def wd(v, name, need=True, most=16, chk=True):
        w = donghua._txt(v)
        if not w:
            if need: raise donghua.Bad(f'「{name}」没填')
            return None
        try:
            if len(w) > most: raise donghua.Bad(f'「{name}」超过 {most} 个字（「{w}」）')
            if norm(w) not in span: raise donghua.Bad(f'「{w}」不是这几句字幕里原样连着的字')
            if chk: whole(w)
            if len(norm(w)) < 2 and name not in ('章', '左的词', '右的词'): raise donghua.Bad(f'「{w}」太短，单看不知道说的是什么')
        except donghua.Bad:
            if not need: return None                       # 可填可不填的那一栏填坏了，就当没填
            raise
        i0 = span.find(norm(w)); used.append((i0, i0 + len(norm(w)) - 1)); return w
    word = lambda key, need=True, most=16: wd(a.get(key), key, need, most)

    def ic(v, need=True):
        if isinstance(v, str) and v in ICONS: return v
        if need: raise donghua.Bad(f'没有这个图标：{v}')
        return None

    def lst(key, lo, hi):
        v = a.get(key)
        if not isinstance(v, list) or not lo <= len(v) <= hi: raise donghua.Bad(f'「{key}」要 {lo} 到 {hi} 个')
        return v

    def inorder(ws, what):                                 # 几样东西得照说的先后排
        ps = [span.find(norm(w)) for w in ws]
        if len(set(ws)) < len(ws): raise donghua.Bad(f'{what}里有两个一样的')
        if ps != sorted(ps): raise donghua.Bad(f'{what}的先后和说的不一样')

    def done(kit, args, first):
        if not used: raise donghua.Bad('卡上一个字都没有')
        mixed_check(k, [span[x:y + 1] for x, y in used], span)
        i0, i1 = min(x for x, _ in used), max(y for _, y in used)
        return {'类型': KIND, 'la': la, 'lb': lb, 'kit': kit, 'args': args, '原类型': k, 'first': first,
                '紧': (flat[i0][2], flat[i1][2] + 1), '末': flat[max(x for x, _ in used)][1]}

    if k in KIT:
        sub = a.get('小字')                                  # 11-15 盲比：结尾那张「拉开的距离 / 干出来的」，小字是半截话。小字停在半句上就当没填，只出大字
        if norm(donghua._txt(sub))[-1:] and norm(donghua._txt(sub))[-1] in HALF: sub = None
        if k == '图标词': args = [ic(a.get('图标')), word('词', most=10), wd(sub, '小字', need=False)]
        elif k == '标题':
            args = [word('大字', most=14), wd(sub, '小字', need=False)]
            if args[0][-1] in HALF: raise donghua.Bad(f'「{args[0]}」停在半句上（标题得是一个完整的说法）')
        else:
            args = [word('话', most=24), word('谁', need=False, most=8)]
            if args[0] and args[0][-1] in HALF: raise donghua.Bad(f'「{args[0]}」停在半句上（引的话得是一句完整的）')
        if k != '图标词': args.append(ic(a.get('图标'), need=False))      # 11-16：装字的框带一个图标（可填可不填；名单里没有的当没填）
        while args and args[-1] is None: args.pop()
        return done(KITJS[k], args, args[1] if k == '图标词' else args[0])
    if k in XIAO:
        if k == '单子':
            rows = [wd(x, '行', most=12) for x in lst('行', 2, 4)]; inorder(rows, '几行')
            d = dict(行=rows, 题=word('题', need=False, most=10), 章=word('章', need=False, most=4), 图标=ic(a.get('图标'), need=False)); first = rows[0]
        elif k == '流程':
            st = [dict(图标=ic(x.get('图标') if isinstance(x, dict) else None), 词=wd(x.get('词') if isinstance(x, dict) else None, '词', most=8)) for x in lst('步', 2, 4)]; inorder([x['词'] for x in st], '几步')
            d = dict(步=st); first = st[0]['词']
        elif k == '主角':
            tags = [wd(x, '签', most=8) for x in lst('签', 1, 3)]; inorder(tags, '几张标签')
            d = dict(图标=ic(a.get('图标')), 名=word('名', need=False, most=8), 签=tags); first = tags[0]
        elif k == '问答':
            d = dict(问=word('问', most=16), 答=word('答', most=16), 答的=ic(a.get('答的'), need=False)); inorder([d['问'], d['答']], '问和答'); first = d['问']
        elif k == '不是':
            d = dict(不是=word('不是', most=12), 是=word('是', most=12)); first = d['不是']
            i0 = span.find(norm(d['不是'])); j0 = span.find(norm(d['是']))
            if not NOT_BEFORE.search(span[max(0, i0 - 8):i0]): raise donghua.Bad(f'「{d["不是"]}」前面没有「不是、不等于、而不是」这类话，不能划掉')
            if NOT_BEFORE.search(span[max(0, j0 - 5):j0]) and not re.search(r'而是|是$', span[max(0, j0 - 4):j0]): raise donghua.Bad(f'「{d["是"]}」前面是否定的话，不能当成「是」的那一边')
        elif k == '天平':
            if a.get('重') not in ('左', '右'): raise donghua.Bad('「重」只能填 左 或者 右')
            d = dict(左=word('左', most=10), 右=word('右', most=10), 重=a['重']); first = d['左']
            if d['左'] == d['右']: raise donghua.Bad('左和右是同一个')
        elif k == '拉开':
            d = dict(上=word('上', most=10), 下=word('下', most=10), 差=word('差', need=False, most=10)); first = d['上']
            if d['上'] == d['下']: raise donghua.Bad('上和下是同一个')
        elif k == '关卡':
            if a.get('结果') not in ('拦', '过'): raise donghua.Bad('「结果」只能填 拦 或者 过')
            d = dict(来的=word('来的', most=10), 图标=ic(a.get('图标'), need=False), 关=word('关', most=10), 结果=a['结果']); first = d['来的']
        elif k == '里外':
            d = dict(里=word('里', most=14), 外=word('外', most=14)); first = d['里']
            if d['里'] == d['外']: raise donghua.Bad('里和外是同一个')
        elif k == '连锁':
            ws = [wd(x, '环', most=10) for x in lst('环', 3, 4)]; inorder(ws, '几环'); d = dict(环=ws); first = ws[0]
        elif k == '挑出':
            num = word('数', need=False, most=10)
            if num and not re.search(r'[\d零一二两三四五六七八九十百千万亿]', num): raise donghua.Bad(f'「{num}」里没有数')
            d = dict(数=num, 词=word('词', most=10), 几=a.get('几') if isinstance(a.get('几'), int) and not isinstance(a.get('几'), bool) and 1 <= a['几'] <= 5 else None); first = d['词']
        elif k == '循环':
            ws = [wd(x, '点', most=5) for x in lst('点', 3, 5)]; inorder(ws, '几个点'); d = dict(点=ws); first = ws[0]
        elif k == '成对':                                   # 两三样东西各有各的下场，一行一行对着摆（11-15：真答卷里模型拿「因果」配这种话，原话没有因为所以，被拦）
            rows = []
            for x in lst('对', 2, 3):
                if not isinstance(x, dict): raise donghua.Bad('「对」里每一行要有 名、说')
                r = dict(名=wd(x.get('名'), '名', most=10, chk=False), 说=wd(x.get('说'), '说', most=10, chk=False), 数=wd(x.get('数'), '数', need=False, most=10))
                if r['数'] and not re.search(r'[\d零一二两三四五六七八九十百千万亿]', r['数']): r['数'] = None
                if r['名'] == r['说']: raise donghua.Bad('名和说是同一个')
                rows.append({x_: y_ for x_, y_ in r.items() if y_})
            if len(rows) == 3 and any(r.get('数') for r in rows):   # 11-15：两行的，网页已经能把长名字折成两行；三行又带数的折不下
                for r in rows:
                    for f_ in ('名', '说'):
                        if wide(r[f_]) > 8: raise donghua.Bad(f'三行又带数的时候，「{f_}」不超过 8 个字（「{r[f_]}」）')
            def seq():                                      # 一行一行说的：名在前，说和数紧跟在它后头；下一行的东西都得在这一行说完以后（防把两行的下场对调、把数挂错行）
                pos = 0; out = []
                for r in rows:
                    nm, sh = norm(r['名']), norm(r['说'])
                    pn = span.find(nm, pos); ps = span.find(sh, pn + len(nm)) if pn >= 0 else -1
                    if pn < 0 or ps < 0: return '几行的先后和说的不一样，或者把两行的下场对调了（每一行得是：名在前，说跟在后）'
                    if ps - pn - len(nm) > GAP: return f'「{r["说"]}」离「{r["名"]}」太远，不像是在说它'
                    end = ps + len(sh)
                    if r.get('数'):
                        pu = span.find(norm(r['数']), pn + len(nm))
                        if pu < 0: return f'「{r["数"]}」不在它那一行的话后头（数挂错行了）'
                        if pu - end > GAP: return f'「{r["数"]}」离「{r["名"]}」那一行太远，不像是它的数'
                        end = max(end, pu + len(norm(r['数'])))
                    out.append((pn, ps, nm, sh)); pos = end
                return out
            got = seq()
            if isinstance(got, str):                        # 另一种说法：先把几样东西都点出来，再挨个说（大厂和小厂 / 一个在裁员 / 一个在招人）。这种不带数
                pn_ = [span.find(norm(r['名'])) for r in rows]
                base = max(p + len(norm(r['名'])) for p, r in zip(pn_, rows)) if min(pn_) >= 0 else -1
                ps_ = [span.find(norm(r['说']), base) if base >= 0 else -1 for r in rows]
                if base < 0 or min(ps_) < 0 or pn_ != sorted(pn_) or ps_ != sorted(ps_) or len(set(ps_)) < len(ps_) or len(set(pn_)) < len(pn_) or any(r.get('数') for r in rows): raise donghua.Bad(got)
                for r in rows: whole(r['名']); whole(r['说'])
            else:
                for pn, ps, nm, sh in got:
                    seg = span[pn:ps + len(sh)]; mid = span[pn + len(nm):ps]
                    # 名和说中间夹着否定的字，或者「很难、拒绝、避免、很少、零、负」这类（小公司很难赚钱 → 小公司 / 赚钱）：摆出来意思会反
                    if NEGCH.search(_mask(mid)) or not K['cut_ok'](sh, mid + sh, ''): raise donghua.Bad(f'「{nm}」和「{sh}」中间夹着否定的字，这样摆出来意思会反')
                    if not (K['block_ok'](seg, nm) and K['block_ok'](seg, sh)): raise donghua.Bad(f'「{nm}」「{sh}」把一个数从中间切开了')
                    if not whole(seg): whole(nm); whole(sh)     # 名连着说一起查：否定在「说」里头的（老员工 / 没被裁掉）不算丢了否定
            d = dict(对=rows); first = rows[0]['名']
        else:                                               # 配上
            L, R_ = a.get('左') or {}, a.get('右') or {}
            if not isinstance(L, dict) or not isinstance(R_, dict): raise donghua.Bad('左、右各要一个图标一个词')
            d = dict(左=dict(图标=ic(L.get('图标')), 词=wd(L.get('词'), '左的词', most=8)), 右=dict(图标=ic(R_.get('图标')), 词=wd(R_.get('词'), '右的词', most=8)), 合=word('合', need=False, most=10)); first = d['左']['词']
            if d['左']['词'] == d['右']['词']: raise donghua.Bad('左和右是同一个')
        return done(k, [{x: y for x, y in d.items() if y is not None}], first)
    raise donghua.Bad(f'没有这种画面：{k}')


# ───────────── 2.5 模型少抄了几个字的：算过（11-15 看了真通义的答卷以后加，试验夹第七轮） ─────────────
FILL = '啊呢诶欸呀嘛哎哦嗯呃哈吧'
TAIL_FILL = '啊呢诶欸呀嘛哎哦嗯呃吧'                                # 句尾只去这些；「哈」不去（奥马哈、多哈、嘻哈这类词尾分不清，11-15 复查）
TAIL_KEEP = re.compile(r'(?:酒吧|网吧|贴吧|书吧|氧吧|水吧|清吧|茶吧|咖啡吧|喇嘛|干嘛|嘻哈|毛呢|花呢|哈哈)$')   # 尾巴上那个字其实是词的一部分：不去
NEGCH = re.compile(r'[不没别未非无莫勿否]')
TAIL_OK = re.compile(r'差不多|不得不|了不起|对不起|别人|别的|特别|区别|分别|个别|级别|差别|类别|识别|性别|告别|未来|非常|不过|不错|没错|不同|不仅|不但|不少|不断|不久|无论|不管|不论|无数|不只|除非|是否|能否')   # 带着否定字、其实不是在说「不」的词
NEG_END = re.compile(r'(?:[不没未别]|没有|并非|而非|无法|难以|很难|未必|拒绝|避免|防止|否认|不是|不再|并不|从不|绝不|毫不|不可能|不[再太]?[会能要用该想敢愿肯可])$')   # 一句话是拿否定收的尾（话没说完，否定管着下一句）
_mask = lambda s: TAIL_OK.sub(lambda m: '_' * len(m.group()), s)
ADJ = re.compile(r'[不没别未非无莫勿否难零负\d二两三四五六七八九十百千万亿几半]')   # 少抄的字要是紧挨着这些字，就不是「不要紧的字」了
GAP = 8                         # 「成对」里，说离名、数离那一行，中间最多隔几个字


def _strs(x):
    if isinstance(x, dict): return [w for v in x.values() for w in _strs(v)]
    if isinstance(x, (list, tuple)): return [w for v in x for w in _strs(v)]
    return [x] if isinstance(x, str) and x else []


def head_neg(w, T, la, lb):
    """词顶着一行的头，上一行尾巴上挂着否定（企业不再 / 招年轻毕业生）：单拿出来意思会反。这几句里每一处出现都是这样才拦。"""
    w = norm(w); hit = False
    if len(w) < 2: return
    for i in range(la, lb):
        t = norm(T[i])
        if w not in t: continue
        if not (t.startswith(w) and i > 0 and NEG_END.search(_mask(norm(T[i - 1])))): return
        hit = True
    if hit: raise donghua.Bad(f'「{w}」前面那一句的末尾挂着否定的字，单拿出来意思会反')
SOFT = re.compile(r'(?:[啊呢诶欸呀嘛哎哦嗯呃哈吧的了得就都也还会去来很又这那他她它你我]|这个|那个|我们|你们|他们|大家|其实|好像|有点|看起来|可以)+')   # 少抄了也不改意思的字
FIT_SKIP = ('类型', '图标', '重', '从', '到', '结果', '几', '答的')
CUTSUB = re.compile(r'^(原来|但|可是|不过|然而|而|反过来|相反|另)')
AGE_UNIT = re.compile(r'周?岁|年|年代|月|号|日|点|点钟|时')
STOPW = re.compile(r'^(这个|那个|这些|那些|我们|你们|他们|什么|怎么|一个|就是|所以|但是|可是|因为|然后|其实|可能|已经|好像|如果|还是|或者|而且|以及|的话|时候|这样|那样|自己|大家)$')


def _virt(lines, dele):
    """照「删」把字幕里那几个字拿掉以后的样子（只给这一处画面查字、取时刻用；片子上的字幕不动）。dele：[[第几句, 这句里第几个字], ...]"""
    if not dele: return lines
    gone = collections.defaultdict(set)
    for i, p in dele: gone[i].add(p)
    out = []
    for i, l in enumerate(lines):
        if i not in gone: out.append(l); continue
        cs, p = [], 0
        for c in l['cs']:
            keep = ''
            for ch in c[0]:
                if ch.isspace(): continue
                if p not in gone[i]: keep += ch
                p += 1
            if keep: cs.append([keep] + list(c[1:]))
        out.append(dict(l, cs=cs))
    return out


def fit(a, T, lines, K):
    """模型填的字不是原样连着的，但只是少抄了几个字（按先后一个不落都找得到）：
    少的全是语气词，或者少得不多 → 照它写的短写法算（查字的时候把那几个字从这几句里拿掉再查，时刻照剩下的字取）；
    少得多的 → 贴回原话那一截（去掉语气词）。少的字里有数、有否定的不认；名字带「数」的那几栏必须原样。
    返回 (项, T, lines, 记录或 None)。"""
    try: la, lb = int(a.get('从')) - 1, int(a.get('到'))
    except (TypeError, ValueError): return a, T, lines, None
    if isinstance(a.get('从'), bool) or not 0 <= la < lb <= len(T) or lb - la > 12: return a, T, lines, None
    cells = [(ch, i, p) for i in range(la, lb) for p, ch in enumerate(T[i]) if not SYM.match(ch)]
    alive = [True] * len(cells); log = []

    def one(v, key):
        if '数' not in key:                                 # 11-15 夜：卡上的字只去句尾的语气字（颜色鲜艳哎 → 颜色鲜艳）；去完还是原话里连着的字，字幕不用动
            v2 = v.rstrip()
            while v2 and v2[-1] in TAIL_FILL and not TAIL_KEEP.search(v2): v2 = v2[:-1].rstrip()
            if v2 != v.rstrip() and len(norm(v2)) >= 2 and v2[-1] not in HALF:     # 去完停在「的、是、在」这类字上的（挺好的呀 → 挺好的）就成了半截话，会被后头拦：不去（11-15 复查）
                log.append(dict(栏=key, 写的=norm(v), 原话=norm(v), 贴=v2, 法='去句尾语气字')); v = v2
        w = norm(donghua._txt(v))
        if len(w) < 2: return v
        idx = [k for k in range(len(cells)) if alive[k]]; s = ''.join(cells[k][0] for k in idx)
        if w in s or '数' in key: return v
        best = None
        for i0 in range(len(s)):
            if s[i0] != w[0]: continue
            j, k = i0, 0
            while j < len(s) and k < len(w):
                if s[j] == w[k]: k += 1
                j += 1
            if k == len(w) and (best is None or j - i0 < best[1] - best[0]): best = (i0, j)
        if not best or best[1] - best[0] > 2 * len(w) + 2: return v
        i0, j = best; dele, k = [], 0
        for q in range(i0, j):
            if k < len(w) and s[q] == w[k]: k += 1
            else: dele.append(q)
        hard = [q for q in dele if s[q] not in FILL]; d = ''.join(s[q] for q in hard)
        try: blocks = K['num_blocks'](s)
        except Exception: blocks = []
        runs, r_ = [], ''                                   # 少抄的字一段一段看
        for q in range(i0, j):
            if q in dele: r_ += s[q]
            elif r_: runs.append(r_); r_ = ''
        # 短写法只认「少抄的每一段都是不要紧的字」（的、了、就、这个、我们……）：少抄了实词的（很难赚钱 → 赚钱、大厂裁员小厂招人 → 大厂小厂招人）不认短写法，贴回原话（11-15 盲查）
        near = any((q > i0 and (q - 1) not in dele and ADJ.match(s[q - 1])) or (q + 1 < j and (q + 1) not in dele and ADJ.match(s[q + 1])) for q in hard)
        soft = all(SOFT.fullmatch(x) for x in runs) and not near and not (re.search(r'[\d%％‰]', d) or NEGCH.search(d) or any(x <= q < y for q in hard for x, y in blocks))
        if soft and len(hard) <= max(2, len(w) // 2):
            for q in dele: alive[idx[q]] = False
            log.append(dict(栏=key, 写的=w, 原话=s[i0:j], 法='短写法' if hard else '去语气词')); return v
        soft = set(q for q in dele if s[q] in FILL)
        for q in soft: alive[idx[q]] = False
        back = ''.join(s[q] for q in range(i0, j) if q not in soft)
        log.append(dict(栏=key, 写的=w, 原话=s[i0:j], 贴=back, 法='贴回原话')); return back

    def walk(x, key=''):
        if isinstance(x, dict): return {k: (v if k in FIT_SKIP else walk(v, k)) for k, v in x.items()}
        if isinstance(x, list): return [walk(v, key) for v in x]
        return one(x, key) if isinstance(x, str) else x
    b = walk(a)
    if not log: return a, T, lines, None
    dele = [[cells[k][1], cells[k][2]] for k in range(len(cells)) if not alive[k]]
    L2 = _virt(lines, dele)
    if any(not l['cs'] for l in L2[la:lb]): return a, T, lines, None
    T2 = [re.sub(r'\s+', '', ''.join(c[0] for c in l['cs'])) for l in L2]
    return b, T2, L2, dict(删=dele, 改=log)


def parse_words(raw):
    """模型顺带回的强调词 {"强调": {"3": "词", ...}} → {第几句（从 0 数）: 词}。拆不开回空。"""
    raw = str(raw or ''); a, b = raw.find('{'), raw.rfind('}')
    try: ans = json.loads(raw[a:b + 1]) if a >= 0 and b > a else {}
    except ValueError:                                      # 整个拆不开：「强调」那一截单独找（"3": "词" 这样的一对一对）
        m = re.search(r'"强调"\s*:\s*\{', raw)
        ans = {'强调': dict(re.findall(r'"(\d+)"\s*:\s*"([^"]*)"', raw[m.end():]))} if m else {}
    ws = ans.get('强调') if isinstance(ans, dict) else None; out = {}
    for k, v in (ws.items() if isinstance(ws, dict) else []):
        try: i = int(k) - 1
        except (TypeError, ValueError): continue
        if isinstance(v, str) and v.strip(): out[i] = re.sub(r'\s+', '', v)
    return out


def check_words(ws, lines, K):
    """强调词逐个查：得是那一句里原样连着的字、2 到 6 个字、截得完整、不是虚词。返回 (能用的 {句: 词}, 不能用的 [{句, 词, 原因}])。"""
    T = [re.sub(r'\s+', '', ''.join(c[0] for c in l['cs'])) for l in lines]; good, bad = {}, []
    for i, w in sorted((ws or {}).items()):
        why = ''
        if not 0 <= i < len(T): why = '没有这一句'
        elif not 2 <= len(w) <= 6: why = '要 2 到 6 个字'
        elif w not in T[i]: why = '不是这一句里原样连着的字'
        elif STOPW.match(w): why = '是虚词'
        elif not (K['cut_ok'](w, T[i], T[i + 1] if i + 1 < len(T) else '') and K['block_ok'](T[i], w)): why = '截得不完整（截了半个数，或者丢了否定）'
        if why: bad.append(dict(句=i + 1, 词=w, 原因=why))
        else: good[i] = w
    return good, bad


# ───────────── 2.6 碎片：把半句话装进框里的，只看字面拦三种（11-15 夜量过以后加，试验夹；量法和数在 七\量碎片_记录.txt、七\检查碎片_记录.txt） ─────────────
# 只拦得住碎片里的小头（量下来两成上下），拦得准；别的碎片要靠查意思那一问。不用分词，台式机上也是同一个结果。
SUIPIAN = True                  # 开关。关掉以后把关和加这一段以前一模一样（第八份试题在台式机上跑的那份把关没有这一段，算它的数要关）
SP_LINK = re.compile(r'^(?:然而|但是|可是|不过|所以|另外|而且|其实|那么|首先|其次|最后|接下来|再说|然后)')            # 整栏就是一句过渡话
SP_REF = re.compile(r'(?<![其吉利排])[他她它]|(?<!的)这[个些样种]?|(?<!的)那[个些样种]?|哪[个些儿里]?')            # 「其他」「的这个、的那个」不算
SP_END = re.compile(r'(?:的|了|(?<![其吉利排])[他她它]|[他她它我你咱]们|自己|其实|其他人|别人)$')                 # 收在这些字上、后头的话又被切了
SP_END_KEEP = re.compile(r'(?:目的|标的|为了|除了|明了)$')                                               # 尾巴上那个字其实是词的一部分
SP_SKIP = ('图标', '结果', '重', '答的', '几', '类型', '从', '到')


def _sp_shown(c):
    """这一处真上屏的是哪几栏、什么字（把关改过、扔掉的栏照改过以后的算）。"""
    k = c.get('原类型') or c['类型']
    if c['类型'] == KIND:
        a = c['args']
        return a[0] if len(a) == 1 and isinstance(a[0], dict) else dict(zip(KIT.get(k, ()), a))
    try: return {x: y for x, y in donghua.public(c).items() if x not in ('类型', '从', '到')}
    except Exception: return {x: y for x, y in (c.get('项') or {}).items() if x not in ('类型', '从', '到')}


def _sp_tail(T, la, lb, w):
    """这一栏的字在这几句字幕里收尾的那一句，后头还剩什么（语气字不算）。找不到回 None。"""
    for drop in (False, True):                              # 字幕里的语气字拿掉以后再找一遍（把关认「少抄了语气字」的写法）
        chars = [(ch, i, p) for i in range(la, lb) for p, ch in enumerate(norm(T[i])) if not (drop and ch in FILL)]
        k = ''.join(x[0] for x in chars).find(w)
        if k < 0: continue
        _, j, p1 = chars[k + len(w) - 1]
        return ''.join(ch for ch in norm(T[j])[p1 + 1:] if ch not in FILL)
    return None


def suipian(c, T):
    """过了前头把关的一处，卡上每一栏的字再看三样，犯了就拦：
    一、整栏只是一句过渡话（然而、但是其实）；
    二、同一句字幕里后头的话被切了，这一栏又收在「的、了、他、自己、其实」这类字上（交给他、完整的、你要看的）。「谁说的」那一栏不算；
    三、带着「他、这、那、哪」，后头的话又被切了（哪些事儿、问了他喜欢）。一问一答、引的那句话不算。
    带「数」的栏不看。"""
    def walk(x, key=''):
        if isinstance(x, dict):
            for k, v in x.items():
                if k in SP_SKIP or '数' in k: continue
                yield from walk(v, k)
        elif isinstance(x, (list, tuple)):
            for v in x: yield from walk(v, key)
        elif isinstance(x, str) and len(norm(x)) >= 2: yield key, norm(x)
    for key, w in walk(_sp_shown(c)):
        if SP_LINK.match(w) and len(w) <= 5: raise donghua.Bad(f'「{w}」只是一句过渡的话，单放在画面上没有内容')
        tail = _sp_tail(T, c['la'], c['lb'], w)
        if not tail: continue
        if key != '谁' and SP_END.search(w) and not SP_END_KEEP.search(w):
            raise donghua.Bad(f'「{w}」是半截话，原话后面还连着「{tail[:10]}」：把这半句抄完整，或者换成一个说得完整的词')
        if key not in ('问', '答', '话') and SP_REF.search(w):
            raise donghua.Bad(f'「{w}」带着「他、这、那、哪」这样的字，原话后面还连着「{tail[:10]}」，单看不知道在说谁、说什么：抄完整，或者换成说得清楚的词')


# ───────────── 2.7 照起止取字（2026-11-22 改）：模型抄的字和字幕差一两个字，不再整处退回 ─────────────
# 第九份真答卷里，挑中的画面一半被退，多数是「不是这几句字幕里原样连着的字」：模型把「更好开的」抄成「更好的」、「AIA」抄成「AI」。
# 办法：这一处画面本来就报了从第几句到第几句。哪一栏的字在这几句里找不到原样的，只认它写的头两个字和尾两个字，
# 在这几句字幕里找「头两个字开头、尾两个字收尾」的那一截，上屏的字换成字幕里这一截原样的字。中间的字一律照字幕，不照模型写的。
# 不放宽：换上去的字就是字幕原文，后面查截得完不完整、半句话、带指代、查意思，全照旧一道不少。
# 只救原来过不了的：原来就过得了的一个字不动（照旧走 fit 和 gate）；过不了的才照起止取一次字，再从头查一遍。
# 不取的：带「数」的栏（数必须原样）、4 个字以下的、取出来比写的多了或少了「不、没」这类否定字的、取出来的数和写的数不一样的、
#         长短差太多的（取出来短于写的六成、长于写的一倍半加两个字）、和写的像不到六成的。
QIZHI = True                    # 开关。软件这头默认开；中转那头照软件报的版本号决定（见中转的 wants_qz）
QZ_MIN = 4                      # 写的字至少几个，才照起止取字
QZ_RATIO = 0.6                  # 取出来那一截和写的至少像几成（difflib 的比法）
QZ_SKIP = FIT_SKIP


def _qz_find(w, span):
    """w：模型写的字（去过符号）；span：这几句字幕连起来（去过符号）。回字幕里照 w 的头两个字、尾两个字找到的那一截；找不到、不放心的回 None。"""
    h, t = w[:2], w[-2:]; lo, hi = max(3, int(len(w) * 0.6)), int(len(w) * 1.5) + 2; best = None
    i = span.find(h)
    while i >= 0:
        j = span.find(t, i + 1)
        while j >= 0:
            c = span[i:j + len(t)]
            if len(c) > hi: break
            if len(c) >= lo:
                r = difflib.SequenceMatcher(None, w, c).ratio()
                if best is None or r > best[0] + 1e-9: best = (r, c)
            j = span.find(t, j + 1)
        i = span.find(h, i + 1)
    if not best or best[0] < QZ_RATIO: return None
    c = best[1]
    if sorted(NEGCH.findall(_mask(c))) != sorted(NEGCH.findall(_mask(w))): return None       # 多了或少了否定字：意思可能反了，不取
    if re.findall(r'\d+(?:\.\d+)?', c) != re.findall(r'\d+(?:\.\d+)?', w): return None   # 数对不上，不取
    return c


def qizhi(a, T):
    """一处画面里，在那几句字幕里找不到原样的栏，照头尾两个字换成字幕原文。回 (换过的项, [{栏, 写的, 取的}])；一栏都没换回 (None, None)。"""
    try: la, lb = int(a.get('从')) - 1, int(a.get('到'))
    except (TypeError, ValueError, OverflowError): return None, None
    if isinstance(a.get('从'), bool) or not 0 <= la < lb <= len(T) or lb - la > 12: return None, None
    span = norm(''.join(T[la:lb])); log = []

    def one(v, key):
        if not isinstance(v, str) or '数' in key: return v
        w = norm(v)
        if len(w) < QZ_MIN or w in span: return v
        c = _qz_find(w, span)
        if c is None: return v
        log.append(dict(栏=key, 写的=w, 取的=c)); return c

    def walk(x, key=''):
        if isinstance(x, dict): return {k: (v if k in QZ_SKIP else walk(v, k)) for k, v in x.items()}
        if isinstance(x, list): return [walk(v, key) for v in x]
        return one(x, key)
    b = walk(a)
    return (b, log) if log else (None, None)


def check_all(items, lines, K, sp=None, qz=None):
    """云端配的画面逐处查。返回 (合格的（排卡要的样子，按先后）, 拦下的 [{项, 原因}])。
    sp：碎片那三条拦不拦；不给就照上面的开关 SUIPIAN。中转那头把关时给 False（见中转.py 的 pick_scenes）。
    qz：过不了的那处照起止取一次字再查（见 2.7）；不给就照开关 QIZHI。照起止取过字才过的，卡上记一笔「取字」。"""
    n = len(lines)
    T = [re.sub(r'\s+', '', ''.join(c[0] for c in l['cs'])) for l in lines]
    sc = scale_of(n)
    items = [dict(x) for x in (items if isinstance(items, list) else []) if isinstance(x, dict)][:MOST * sc]
    try:                                                   # 数前面紧贴的限定词（大约、将近、不到……）模型漏抄的，照原话补回去
        import shuzi
        def _neg(v_, f_, t_):
            if isinstance(v_, dict): return {k_: _neg(y_, f_, t_) for k_, y_ in v_.items()}
            if isinstance(v_, list): return [_neg(y_, f_, t_) for y_ in v_]
            if isinstance(v_, str) and re.search(r'\d', v_):
                for i_ in range(max(0, f_ - 1), min(n, t_)):
                    if v_ in T[i_] and shuzi.with_neg(T[i_], v_) != v_: return shuzi.with_neg(T[i_], v_)
            return v_
        for x in items:
            try: f_, t_ = int(x.get('从')), int(x.get('到'))
            except (TypeError, ValueError, OverflowError): continue
            for k_ in list(x):
                if k_ not in ('类型', '从', '到', '图标'): x[k_] = _neg(x[k_], f_, t_)
    except Exception: pass
    good, held = [], []

    def one(a):                                            # 一处照原来的规矩查：过了回卡，不过抛 donghua.Bad（原因是中文）
        note = None
        try:
            b, T2, L2, note = fit(a, T, lines, K)
            c = gate(b, T2, L2, K); c['项'] = a
            if SUIPIAN if sp is None else sp:
                try: suipian(c, T2)
                except donghua.Bad: raise
                except Exception: pass                       # 这一段自己出了意外：不拦（它只是多看一眼字面，出错不该把好卡扔掉）
            if note: c['删'] = note['删']; c['写法'] = note['改']
            return c
        except donghua.Bad as e:
            why = str(e); tie = [x for x in (note or {}).get('改', []) if x['法'] == '贴回原话']     # 贴回原话以后才不合格的：原因里得说它自己写的那几个字，不然它看不懂
            hit = next((x for x in tie if x.get('贴') and '「{}」'.format(x['贴']) in why), None) or next((x for x in tie if '「{}」'.format(x['原话']) in why), None)                 # 出毛病的正是贴回原话的那一栏
            if hit: why = '「{}」不是这几句字幕里原样连着的字；照原话该是「{}」，可是{}'.format(hit['写的'], hit['原话'], why)
            elif tie: why += '；另外，' + '、'.join('「{}」照原话该是「{}」'.format(x['写的'], x['原话']) for x in tie[:2])   # 出毛病的是别的栏：两件事分开说
            raise donghua.Bad(why)
    for a in items:
        try: good.append(one(a)); continue
        except donghua.Bad as e: why = str(e)
        except Exception as e: held.append(dict(项=a, 原因=f'格式不对（{type(e).__name__}）', 道='把关')); continue
        a2, qlog = qizhi(a, T) if (QIZHI if qz is None else qz) else (None, None)      # 过不了的：照起止取一次字，再从头查一遍
        if a2 is not None:
            try: c = one(a2); c['取字'] = qlog; good.append(c); continue
            except donghua.Bad as e2: why += '；照字幕取字以后还是不行：' + str(e2)
            except Exception: pass
        held.append(dict(项=a, 原因=why, 道='把关'))
    kind = lambda c: c.get('原类型') or c['类型']
    as_item = lambda c: {'类型': kind(c), '从': c['la'] + 1, '到': c['lb']}
    good.sort(key=lambda c: (c['la'], c['lb'])); keep = []
    for c in good:
        if keep and c['la'] < keep[-1]['lb']: held.append(dict(项=c.get('项') or as_item(c), 原因='和上一处盖了同一句', 道='排重')); continue
        keep.append(c)
    good, keep, cnt = keep, [], collections.Counter()
    for c in good:
        cap = (2 if kind(c) == '标题' else 3) * sc; why = ''
        if keep and kind(keep[-1]) == kind(c) and c['la'] - keep[-1]['lb'] <= 2: why = '和上一处是同一种画面，不连着用'
        elif cnt[kind(c)] >= cap: why = f'这一种画面全片已经用了 {cap} 次'
        if why: held.append(dict(项=c.get('项') or as_item(c), 原因=why, 道='排重')); continue
        cnt[kind(c)] += 1; keep.append(c)
    for i, c in enumerate(keep): c['hid'] = i
    return keep, held


# ───────────── 3 排卡（替 planner.pro_place；只在专业版这条片排的时候换上） ─────────────
def place(scenes, lines, T, dur, pro):
    import planner
    planner.PRO_TAIL.setdefault(KIND, TAIL)
    S = [dict(x) for x in scenes]; nn = len(lines)
    span_of = lambda h: h.get('紧') or (h['la'], h['lb'])
    for x in S:                                                # 「Meta微软这 / 4家」：十以内的个数砸成大数字，标签是硬截的半句，专业版里这种改回普通句卡
        try:
            if x['type'] == 'stat' and not x.get('second') and float(x.get('value') or 0) < 10 and str(x.get('unit') or '') in tuple('家个种条件位名次项点步类只台部'): x['type'] = 'say'; x.setdefault('icon', None)
        except (TypeError, ValueError): pass
    S0, S = S, []
    for x in S0:                                               # 11-15 试看：「15 到 644 岁」画成了刻度带；「将近 10%」的卡挂到了「原来经营的好了」上
        if x['type'] == 'range' and AGE_UNIT.fullmatch(str(x.get('unit') or '')): x['type'] = 'say'; x.setdefault('icon', None)      # 岁数、年份的范围不画刻度带
        j = x['lb'] - 1
        if x['type'] == 'stat' and not x.get('second') and x.get('sub') and j > x['la'] and x['sub'][-1] == T[j] and CUTSUB.match(T[j]):   # 数字卡底下那行小字是换了说法的下一句：不挂，那句自己出
            S.append(dict(x, lb=j, sub=x['sub'][:-1], subT=(x.get('subT') or [])[:-1])); S.append(dict(type='say', la=j, lb=x['lb'], icon=planner.scene_icon(T[j]))); continue
        S.append(x)
    t1_of = lambda e: lines[e]['t0'] - 0.15 if e < nn else dur
    enough = lambda c, t0, e: planner.pro_hold(c, t0, t1_of(e)) >= planner.PRO_HOLD + planner.TPL_MARGIN - 1e-6
    for a in pro:
        if a.get('空'): continue
        la, lb = span_of(a); kind = a.get('原类型') or a['类型']
        no = lambda why: planner._pro_no({'类型': kind}, a['la'], a['lb'], lines, why)
        if a['类型'] == KIND:
            w = a.get('first')
            li = next((i for i in range(la, lb) if w and norm(w)[:2] in norm(T[i])), la)
            c = dict(kind=KIND, pts=[dict(text=(w or KIND), li=li, t=round(lines[la]['t0'], 3))], kit=a['kit'], args=a['args'], hid=a.get('hid', 0))
            if a.get('补'): c['bu'] = 1                         # 11-16 补的图标词：网页那头字跟着图标一起进
        else:
            c = planner.pro_card(a, _virt(lines, a.get('删')))
            ps = [x for x in planner.pro_parts(c) if x]
            if ps:                                           # 老的画法也说完就走：只盖用到的那几句；停不够的，先把模型自己圈的后几句要回来
                la, lb = max(la, min(x['li'] for x in ps)), min(lb, max(x['li'] for x in ps) + 1)
                t0_ = max(0.0, lines[la]['t0'] - 0.15)
                while lb < a['lb'] and not enough(c, t0_, lb): lb += 1
        if a.get('删'): c['shan'] = a['删']                   # 这张卡上的字是少抄了几个字的短写法：出片网页查字、取时刻的时候照样把这几个字拿掉
        why = ''
        for _ in range(3):                                   # 盖到半张数字卡、问号卡的，整张一起盖
            hit = [k for k, x in enumerate(S) if x['la'] < lb and x['lb'] > la]
            if not hit: why = '这几句不在片子里'; break
            grow = False
            for k in hit:
                x = S[k]
                if k == 0 or x['type'] in ('hook', 'cta', 'pro'): why = '盖到了开场、收尾或者另一处画面'; break
                if x['type'] != 'say' and not (x['la'] >= la and x['lb'] <= lb): la, lb = min(la, x['la']), max(lb, x['lb']); grow = True
            if why or not grow: break
        if not why and lb - la > (SPAN_DUI if kind == '成对' else SPAN): why = '连着盖的句子太多'
        if not why and a.get('末') is not None:               # 小画面：最后一样东西说到以后停不够，先用模型自己圈的后一句，再照规矩借一句（那句得是普通句卡里的、别的画面没要、不长）
            free = lambda e: (lambda x: x is not None and x['type'] == 'say')(next((x for x in S[1:] if x['la'] <= e < x['lb']), None)) and not any(h is not a and not h.get('补') and span_of(h)[0] <= e < span_of(h)[1] for h in pro)
            while t1_of(lb) - a['末'] < STAY and lb < nn and lb - la < (SPAN_DUI + 1 if kind == '成对' else SPAN) and free(lb) and lines[lb]['t1'] - lines[lb]['t0'] <= planner.PRO_OWN + 0.2: lb += 1
            if t1_of(lb) - a['末'] < STAY: why = '最后一样东西说到以后停不够'
            if not why and any(k_ == 0 or S[k_]['type'] in ('hook', 'cta', 'pro') for k_, x in enumerate(S) if x['la'] < lb and x['lb'] > la): why = '盖到了开场、收尾或者另一处画面'
            if not why and any(x['type'] != 'say' and not (x['la'] >= la and x['lb'] <= lb) for x in S if x['la'] < lb and x['lb'] > la): why = '只盖住了免费版一张卡的一部分'
        if not why and c['kind'] != KIND:
            t0 = max(0.0, lines[la]['t0'] - 0.15)
            if not enough(c, t0, lb):
                why = f'落定以后停不够 {planner.PRO_HOLD} 秒'
                nx = next((x for x in S[1:] if x['la'] <= lb < x['lb']), None)     # 照正式排卡的规矩往后借一句
                if (nx and nx['type'] == 'say' and lb < nn and lb - la < planner.PRO_SPAN and not any(h['la'] <= lb < h['lb'] for h in pro)
                        and lines[lb]['t1'] - lines[lb]['t0'] <= planner.PRO_BORROW and enough(c, t0, lb + 1)): lb += 1; why = ''
        if why: no(why); continue
        # 卡上的东西说完以后多盖的那几句，要是拿「原来、但是、而」这种字开头（换了说法），那句的字幕不出：免得「更差了 10%」的卡底下配着「原来经营得好的」
        last = max([x['li'] for x in planner.pro_parts(c) if x] or [la]) if c['kind'] != KIND else span_of(a)[1] - 1
        hid = [e for e in range(max(la, last + 1), lb) if MARK.match(T[e])]
        if hid: c['hideLi'] = hid
        out, put = [], False
        for x in S:
            if x['lb'] <= la or x['la'] >= lb: out.append(x); continue
            if x['type'] == 'say' and x['la'] < la: out.append(dict(type='say', la=x['la'], lb=la, icon=planner.scene_icon(''.join(T[x['la']:la]))))
            if not put: out.append(dict(type='pro', la=la, lb=lb, **c)); put = True
            if x['type'] == 'say' and x['lb'] > lb: out.append(dict(type='say', la=lb, lb=x['lb'], icon=planner.scene_icon(''.join(T[lb:x['lb']]))))
        S = out
    if JIE: S = _liu(S, lines, T, dur, JIE)
    return S


JIE = None                      # 11-16 第九轮：被判成「还在讲上一句那件事」的句子（从 0 数的行号）。None 就是画面不多留，和原来一样。
LIU_LOG = []                    # 这一回排卡多留了哪几处：[(画面从第几句, 原来到第几句, 现在到第几句, 多留几秒)]
LINGER_BU_N = 1                 # 补的图标词最多多留几句（0 就是不留）
LINGER_BU_S = 2.5               # 补的图标词最多多留几秒


def _liu(S, lines, T, dur, jie):
    """小画面后头紧跟的一两句要是「还在讲上一句那件事」、又是普通句卡里的句子，画面留着，这一两句走字幕。只动「盖第几句到第几句」。
    规矩（保守）：最多多留 LINGER_N 句、LINGER_S 秒（补的图标词更少：LINGER_BU_N 句、LINGER_BU_S 秒）；拿「但是、另外、第二」这类字开头的不留；不吃到片子最后一张。"""
    import planner
    nn = len(lines); t1_of = lambda e: lines[e]['t0'] - 0.15 if e < nn else dur
    S = [dict(x) for x in S]; del LIU_LOG[:]; i = 0
    while i < len(S) - 1:
        a, b = S[i], S[i + 1]
        if a.get('type') == 'pro' and b.get('type') == 'say' and a['lb'] == b['la']:
            e0 = e = a['lb']; nmax, smax = (LINGER_BU_N, LINGER_BU_S) if a.get('bu') else (LINGER_N, LINGER_S)
            while (e < b['lb'] and e in jie and e - e0 < nmax and not MARK.match(T[e]) and t1_of(e + 1) - t1_of(e0) <= smax
                   and (e + 1 < b['lb'] or i + 2 < len(S) - 1)): e += 1      # 后面要还剩东西：这张句卡没吃完，或者它后头还有不是收尾的卡
            if e > e0:
                a['lb'] = e; a['liu'] = e - e0; LIU_LOG.append((a['la'], e0, e, round(t1_of(e) - t1_of(e0), 2)))
                if e >= b['lb']: S.pop(i + 1)
                else: b['la'] = e; b['icon'] = planner.scene_icon(''.join(T[e:b['lb']]))
        i += 1
    return S


PIC_KINDS = ('流程', '主角', '天平', '拉开', '关卡', '里外', '连锁', '挑出', '循环', '配上', '图标词', '占多少', '比多少', '几组对比', '因果', '时间先后')


def has_pic(x):
    """模型填的这一处带不带图（有图形的画法，或者填了图标）。"""
    def ico(v):
        if isinstance(v, dict): return any((k in ('图标', '答的') and isinstance(y, str) and y in icons()) or ico(y) for k, y in v.items())
        if isinstance(v, list): return any(ico(y) for y in v)
        return False
    return isinstance(x, dict) and (x.get('类型') in PIC_KINDS or ico(x))


def merge_runs(runs, lines, dur, K, pic=False, **kw):
    """同一条稿叫了几遍，合成一份。runs：每一遍过了把关、查过意思以后留下的那几处（模型填的原样，先后照遍数）。
    一处一处往里试：加进去以后它真排得进片子、已经排进去的一张不少，才留。
    为什么不直接并在一起：同几句话各遍画法不一样，头一个占了位置，排卡时要是停不够被扔掉，后面那个排得进的也跟着没了
    （11-15 留出稿：「28.8% 对 16.2%」第 2 遍圈了 4 句、停不够；第 3 遍多圈了一句、排得进，原来的合法把它当重样的丢了）。
    先到先得会吃亏（头一遍的一张占了位置，挡掉后两遍的两张），所以从每一遍起头各试一回，再和「直接并在一起」比，挑排进去最多的（一样多挑画面时间长的）。
    回 (留下的几处, 排进了几张)。"""
    def pro_of(its):
        if not its: return []
        return [s for s in plan(lines, dur, check_all(its, lines, K)[0], **kw)['scenes'] if s['type'] == 'pro']
    score = lambda its: (lambda ps: (len(ps), round(sum(s['t1'] - s['t0'] for s in ps), 2)))(pro_of(its))

    def greedy(order):
        cur, n = [], 0
        for x in [x for r in order for x in r]:
            if any(x == y for y in cur): continue
            try: m = len(pro_of(cur + [x]))
            except Exception: continue
            if m == n + 1 and len(check_all(cur + [x], lines, K)[0]) == len(cur) + 1: cur.append(x); n = m
        return cur
    runs = [r for r in runs if r]
    if pic: runs = [sorted(r, key=lambda x: not has_pic(x)) for r in runs]      # 11-16：同一处有带图的和纯字的，先试带图的（每一遍里带图的排前头，先后不变）
    if not runs: return [], 0
    cands = [greedy(runs[i:] + runs[:i]) for i in range(len(runs))]
    flat = []
    for x in [x for r in runs for x in r]:
        if not any(x == y for y in flat): flat.append(x)
    cands.append(flat)                                      # 直接并在一起（原来的合法）
    if pic:                                                 # 再加一种：所有遍里带图的先都试一轮，纯字的后试
        allx = [x for r in runs for x in r]; cands.append(greedy([[x for x in allx if has_pic(x)], [x for x in allx if not has_pic(x)]]))
        gt = lambda its: round(sum(s['t1'] - s['t0'] for s in pro_of(its) if (s.get('kit') or s.get('kind')) in PIC_KINDS or has_pic({'x': s.get('args')}) or (s.get('kit') in ('标题', '引话') and len(s.get('args') or []) > 2 and bool(s['args'][2]))), 2)   # 排进去的画面里带图的一共多少秒
        best = max(cands, key=lambda its: (score(its)[0], gt(its), score(its)[1]))      # 一样多张的时候，挑带图的时间长的
        return best, score(best)[0]
    best = max(cands, key=score)
    return best, score(best)[0]


def plan(lines, dur, good, **kw):
    """专业版这条片排卡：排卡那一步换成上面的 place，排完换回去（免费版的排法一个字不动）。"""
    import copy, planner
    planner.PRO_TAIL.setdefault(KIND, TAIL)
    old = planner.pro_place; planner.pro_place = place
    try: return planner.plan(copy.deepcopy(lines), dur, pro=good or [dict(空=True)], **kw)   # 云端一处都没过也走专业版的排法（顺手修的那两处照样管）
    finally: planner.pro_place = old


# ───────────── 4 叫几遍：改写、查意思的题面和拆回话（只有中转用；2026-11-16 从第八份试题的跑题程序原样搬来） ─────────────
# 一条片的走法（中转.py 的 pick_scenes）：照配置表同时叫几遍 → 每一遍过 check_all → 被拦的交便宜档改一次（rewrite_prompt、as_hua、add_fixed）
# → 同一种填法的几遍并在一起交中档查一遍意思（check_prompt、verdict）→ 去掉对不上的 → 几遍分开回给软件，软件那头 merge_runs 合。
kind_of = lambda c: c.get('原类型') or c['类型']
sig_of = lambda good: [[kind_of(c), c['la'] + 1, c['lb']] for c in good]
key_of = lambda x: json.dumps(x, ensure_ascii=False, sort_keys=True)


def cs_of(rows):
    """中转收到的 [{'开始', '句'}] → 把关要的样子（一个字一格，带秒）。说完的秒、每个字的秒软件没发，照下一句开口和字数估；估的只影响「最后一样东西说到的时刻」，排卡在软件那头照真的秒重算。"""
    out = []
    for i, x in enumerate(rows):
        s = re.sub(r'\s+', '', str(x.get('句') or '')); t0 = float(x.get('开始') or 0); t1 = t0 + max(0.6, len(s) * 0.24)
        if i + 1 < len(rows): t1 = min(t1, max(t0 + 0.3, float(rows[i + 1].get('开始') or 0)))
        n = max(1, len(s)); out.append(dict(t0=t0, t1=t1, cs=[[ch, t0 + (t1 - t0) * j / n, t0 + (t1 - t0) * (j + 1) / n] for j, ch in enumerate(s)]))
    return out


def has_list(raw, key='画面'):
    raw = str(raw or ''); a, b = raw.find('{'), raw.rfind('}')
    try: d = json.loads(raw[a:b + 1]) if a >= 0 and b > a else None
    except ValueError: return bool(_loose(raw, key))        # 多一个括号那种：一处一处拆得出来也算
    return isinstance(d, dict) and isinstance(d.get(key), list)


def as_hua(raw):
    """改写的回话要是光回了一个列表 [{…}, …]（没包「画面」那一层），包上再用。"""
    if has_list(raw, '画面'): return raw
    s = str(raw or ''); a, b = s.find('['), s.rfind(']')
    try: d = json.loads(s[a:b + 1]) if a >= 0 and b > a else None
    except ValueError: d = None
    return json.dumps({'画面': d}, ensure_ascii=False) if isinstance(d, list) and all(isinstance(x, dict) for x in d) else raw


def _rows(T, la, lb): return '\n'.join('  {} {}'.format(i + 1, T[i]) for i in range(max(0, la), min(len(T), lb)))


def rewrite_prompt(base, T, bad, good):
    """base：整条片的标准题面（build_prompt(rows)）；bad：被把关拦下的 [{项, 原因}]；good：这一遍已经过了的。"""
    sc = scale_of(len(T))
    out = [base, '\n———\n上面这条片已经配过一遍。其中下面 {} 处不合规矩，被退回了。现在只改这几处。\n'.format(len(bad))]
    for n, h in enumerate(bad, 1):
        a = h['项']
        try: la, lb = int(a.get('从')) - 1, int(a.get('到'))
        except (TypeError, ValueError, OverflowError): la, lb = 0, 0
        out.append('第 {} 处：填的是 {}\n退回的原因：{}\n这几句字幕原话是：\n{}\n'.format(n, json.dumps(a, ensure_ascii=False), h['原因'], _rows(T, la, lb) or '  （从、到写得不对）'))
    cnt = collections.Counter(kind_of(c) for c in good); top = lambda k: (2 if k == '标题' else 3) * sc
    full = [k for k, v in cnt.items() if v >= top(k)]; part = ['{} {} 次'.format(k, v) for k, v in cnt.items() if v < top(k)]
    out.append('改的办法：字不对的，照字幕原话重新抄一截；太长的，抄短一点；这种画法对不上的，可以换一种画法，也可以把「从」「到」改一改；实在改不好的那一处就不要了，不用硬凑。\n'
               '照「回之前再对一遍」那三条逐处对过再回。别的已经配好的画面不用再回。\n'
               '- 改的时候不要盖到这些已经有画面的句子：{}。\n'
               '- 这几种画法已经用满了，不要再用：{}。\n'
               '- 别的已经用过的：{}（同一种全片最多 {} 次，标题最多 {} 次；同一种不要紧挨着用）。\n'
               '只回 JSON，不要别的字：{{"画面": [改好的那几处]}}（这次不用回「强调」）'.format(
                   '、'.join('{}–{}'.format(c['la'] + 1, c['lb']) for c in good) or '没有', '、'.join(full) or '没有', '、'.join(part) or '没有', 3 * sc, 2 * sc))
    return '\n'.join(out)


def add_fixed(good, new, lines, K, sp=None):
    """改写回来的一处一处往里加：加了以后头一遍已经过了的一个不许少，自己也得过，不然不加。回 (合起来过的, 没加进去的 [{项, 原因}])。"""
    cur = [c['项'] for c in good]; lost = []
    for x in new:
        g2, h2 = check_all(cur + [x], lines, K, sp); have = [tuple(s) for s in sig_of(g2)]
        if len(g2) == len(good) + 1 and all(tuple(s) in have for s in sig_of(good)): good = g2; cur = [c['项'] for c in g2]; continue
        why = h2[-1]['原因'] if h2 and len(g2) == len(good) and all(tuple(s) in have for s in sig_of(good)) else '加进去会挤掉头一遍已经过了的'
        lost.append(dict(项=x, 原因=why))
    return good, lost


DESC = {'比多少': '两根柱子比高矮', '占多少': '一个整体里占了多少', '几组对比': '几根柱子摆在一起比', '亮出大数': '一个大数字单独亮出来', '时间先后': '一条时间线，几个时候各发生一件事',
        '并排对照': '左右两张卡对着摆，表示这两样有反差', '几个要点': '几条并列的要点', '圈重点': '把一个词圈出来', '一步接一步': '有先后的几步', '因果': '箭头从原因指到结果',
        '前后变化': '同一样东西从前一个样子变成后一个样子', '转折': '前半句被后半句转过来', '一好一坏': '一个好的一个坏的对着摆',
        '单子': '一张单子列出几条并列的要求或特点', '流程': '有先后的几步，每步一个图标', '主角': '一样东西带着它的几个特点', '问答': '一问一答两个对话气泡', '不是': '前一个说法被划掉，换成后一个说法',
        '天平': '两样东西上天平，「重」的那边沉下去，表示它更重、更要紧', '拉开': '两样东西差距越拉越大，「上」跑在前头', '关卡': '一样东西走到一道门槛前，被拦下或者过去', '里外': '圈里一种待遇，圈外另一种',
        '连锁': '一环推一环，最后一环是结果', '挑出': '从一大堆里挑出很少的几个', '循环': '几样东西首尾相接转成一个圈', '配上': '两样东西正好配成一对', '成对': '两三行对着摆，每行是一样东西和它的下场',
        '标题': '一行大字当标题', '引一句': '加引号转述别人说的一句话', '图标词': '一个图标配一个词'}


def shown(c):
    """这一处真上屏的是哪几栏、什么字（把关改过、扔掉的栏照改过以后的算）。"""
    k = kind_of(c)
    if c['类型'] == KIND:
        a = c['args']
        return k, (a[0] if len(a) == 1 and isinstance(a[0], dict) else dict(zip(KIT.get(k, ()), a)))
    try: return k, {x: y for x, y in donghua.public(c).items() if x not in ('类型', '从', '到')}
    except Exception: return k, {x: y for x, y in c['项'].items() if x not in ('类型', '从', '到')}


STRICT_RULE = ('- 把半句话、没说完的话当成一整句装进了框里（单看框里那几个字不成一句话，或者意思悬在半空：「因为这个原因」「所以他们就」）；\n'
               '- 把讲的人自己的话（过渡话、旁白：「我们来看看」「那你想想」「他是这么说的」）放进了说话气泡、引号里；问答、引一句里只能是原话里真有人说出口、问出口的话；\n')


def check_prompt(T, good, strict=False):
    out = ['下面是一条口播里的几段字幕，和软件给每一段配的画面。请你一处一处判断：这个画面和这几句话的意思对得上吗？\n'
           '判「对不上」的几种情况：\n'
           '- 把不是一对的两样东西摆成了一对（原话对着说的是甲和乙，画面摆的是甲和丙）；\n'
           '- 原话是并列的两件事，画成了比轻重、比多少；原话没有因果，画成了因果；原话没有否定，画成了「不是这个、是那个」；\n'
           '- 画面上的字单看会让人误会原话（丢了主语、把半句当整句、好坏说反）；\n'
           '- 数配错了对象（这个数说的不是画面上写的那样东西）。\n'
           + (STRICT_RULE + '- 图标和这几句说的那样东西对不上（说的是药，配了一把锤子）。\n' if strict else '') +
           '画面只是把原话照样摆出来、没有歪曲的，算「对得上」。拿不准的判「对不上」。\n']
    for n, c in enumerate(good, 1):
        la, lb = c['la'], c['lb']; k, a = shown(c)
        body = '；'.join('{}={}'.format(x, json.dumps(y, ensure_ascii=False) if not isinstance(y, str) else y) for x, y in a.items() if y not in (None, ''))
        out.append('第 {} 处（第 {}–{} 句）\n字幕：\n{}{}\n{}画面：{}（{}）。填的是：{}\n'.format(
            n, la + 1, lb, ('  （前一句：{}）\n'.format(T[la - 1]) if la > 0 else ''), _rows(T, la, lb), ('  （后一句：{}）\n'.format(T[lb]) if lb < len(T) else ''), k, DESC.get(k, ''), body))
    out.append('只回 JSON，不要别的字：{"查": [{"号": 1, "对得上": true, "为什么": "不超过 20 个字"}, ...]}（每一处都要回，号照上面的）')
    return '\n'.join(out)


YES = ('true', '是', '对', '1', 'yes'); NO = ('false', '否', '0', 'no')
LOST = '（这一处它没回，照对不上收）'


def verdict(raw, n, lax=False):
    """查意思的回话 → (判「对不上」的那几个号, 各号的理由)。不是每个号都有：回 (None, {})。
    lax（重叫一次还不全才用）：一共至少五处、缺的号不超过两成的，缺的照「对不上」收下，理由里标出来。
    冒号后面的值认不得的（不是 true / false / 是 / 否 这类）：这个号算没读懂，不默认「对得上」（11-15 盲查）。
    真答卷里有四种写法，意思都清楚，都认："对得上": true/false；"对不上": true；光写一个 "对不上"；"对不上": "为什么": …。
    所以不整个当 JSON 拆，按「号」一段一段找：先看到「对得上」还是「对不上」，后面有 true / false 就照它，没有就照词的字面。"""
    parts = re.split(r'"号"\s*:\s*"?(\d+)"?', str(raw or '')); ok = {}; why = {}
    for i in range(1, len(parts) - 1, 2):
        seg = parts[i + 1]; m = re.search(r'"(对得上|对不上)"\s*(?::\s*"?([^\s",}\]]*)"?)?', seg)
        if not m: continue
        val = m.group(2).lower() if m.group(2) is not None else None
        k = m.group(1)
        if val is None or val in ('为什么', 'why') or val == k: v = True     # 光写一个词、后面直接跟「为什么」、或者值就是栏名自己（"对不上": "对不上"）：照词的字面
        elif val in YES: v = True
        elif val in NO: v = False
        elif k == '对得上' and val in ('不', '不是', '不对', '对不上'): v = False
        elif k == '对不上' and val == '对得上': v = False
        elif k == '对不上' and len(val) >= 3 and val not in ('不对', '不是'): v = True   # "对不上": "数配错了对象" 这种：冒号后面直接是理由
        else: continue                                       # 认不得的（"对不上": "不对" 这种两头都说得通的也算）：没读懂
        ok[int(parts[i])] = v if m.group(1) == '对得上' else not v
        w = re.search(r'"(?:为什么|why)"\s*:\s*"([^"]*)"', seg) or re.search(r':\s*"([^"]{4,})"\s*}', seg) or re.search(r',\s*"([^"]{4,})"\s*}', seg)
        why[int(parts[i])] = w.group(1) if w else ''
    miss = [i for i in range(1, n + 1) if i not in ok]
    if miss and not (lax and ok and n >= 5 and len(miss) <= n // 5): return None, {}     # 宽收：至少五处、缺的不超过两成
    return sorted(i for i in range(1, n + 1) if ok.get(i) is not True), {str(i): (LOST if i in miss else why.get(i, '')) for i in range(1, n + 1)}


# ───────────── 5 补图标（2026-11-16 第九轮，还在试验夹）：没配上画面的句子，让便宜档只用「图标词」再补一遍 ─────────────
BU_SPAN = 2                     # 补的一处最多盖几句
BU_SAME = 3                     # 同一个图标全片最多用几次（长片照 scale_of 放大）
BU_SEG = 60                     # 片子长的时候分段补：一段大约几句
BU_GLOSS = dict(x.split('=') for x in (
    'activity=起伏的波形 apple=苹果 arrow-down=向下、下降 arrow-right=向右、下一步 arrow-up=向上、上升 baby=婴儿 badge-check=认证过的徽章 ban=禁止 banknote=钞票 bath=浴缸 '
    'battery-charging=充电 battery-full=电满了 battery-low=电快没了 bed-double=床、睡觉 bell=铃铛、提醒 book=书 book-open=翻开的书、读书 bot=机器人、AI boxes=一堆箱子、库存 brain=大脑、动脑 '
    'briefcase=公文包、上班 building-2=办公楼、公司 bus=公交车 calculator=计算器、算账 calendar=日历、日子 camera=相机、拍照 car=小汽车 cat=猫 chart-column=柱状图 chart-line=折线图 chart-pie=饼图 '
    'check=对勾 circle-check=做成了、通过 circle-dollar-sign=钱 circle-question-mark=问号、疑问 circle-x=不行、失败 clipboard-list=清单 clock=钟、时间 cloud=云 code=代码、编程 coffee=咖啡 coins=硬币、小钱 '
    'cpu=芯片、算力 credit-card=银行卡、刷卡 crown=皇冠、第一名 database=数据库、数据 dna=基因 dog=狗 door-closed=关着的门 door-open=开着的门 download=下载 droplet=水滴 dumbbell=哑铃、健身 egg=鸡蛋 '
    'equal=等于 eye=眼睛、看 factory=工厂 file-pen-line=写文件、签字 file-text=文件 fingerprint=指纹 fish=鱼 flag=旗子 flame=火 flask-conical=烧瓶、做实验 fuel=加油 gamepad-2=游戏手柄 gavel=法槌、判决 '
    'gift=礼物 globe=地球、全世界 graduation-cap=学位帽、毕业 hammer=锤子 hand=手掌、停下 hand-coins=手里接钱、付钱收钱 handshake=握手、合作 heart=心、喜欢 heart-pulse=心跳、健康 hospital=医院 '
    'hourglass=沙漏、等待 house=房子、家 id-card=证件 image=图片 key-round=钥匙 lamp=台灯 landmark=银行、政府大楼 laptop=笔记本电脑 layers=一层一层 leaf=叶子 lightbulb=灯泡、想到主意 link=连上了 '
    'lock=锁上 lock-open=锁开了 mail=信、邮件 map-pin=地点 medal=奖牌 megaphone=喇叭、宣传 message-circle=聊天、说话 mic=话筒 microscope=显微镜、做研究 minus=减 monitor=显示器、屏幕 moon=月亮、夜里 '
    'music=音乐 newspaper=报纸、新闻 package=包裹、快递 paint-roller=刷墙、装修 pencil=铅笔、写 percent=百分比 phone=电话 phone-call=打电话 piggy-bank=存钱罐、存钱 pill=药 plane=飞机 plus=加 puzzle=拼图 '
    'qr-code=二维码 receipt=小票、账单 refresh-cw=刷新、重来 repeat=来回重复 rocket=火箭、涨得快 satellite-dish=卫星天线、信号 scale=天平、权衡 scan-face=刷脸 school=学校 scissors=剪刀、裁掉 '
    'scroll-text=条文、合同 search=放大镜、找 send=发出去 server=服务器 settings=齿轮、设置、维护 shield-alert=有风险 shield-check=有保障、安全 ship=轮船 shopping-bag=购物袋、买东西 shopping-cart=购物车 '
    'siren=警报 smartphone=手机 sofa=沙发 sparkles=亮点、焕然一新 stamp=盖章 star=星星 stethoscope=听诊器、看病 store=店铺 sun=太阳、白天 swords=两把剑、竞争 syringe=针筒、打针 tag=价签、价格 '
    'target=靶子、目标 thermometer=温度计 thumbs-up=点赞、叫好 ticket=票 timer=计时 tractor=拖拉机、种地 train-front=火车、地铁 trending-down=往下走、下跌 trending-up=往上走、上涨 triangle-alert=警告、小心 '
    'trophy=奖杯 truck=卡车、运货 tv=电视 unlink=断开了 upload=上传 user=一个人 user-round=一个人 user-round-check=通过的人 user-round-plus=加人、招人 user-round-x=被刷掉的人 users=几个人 users-round=一群人 '
    'utensils=刀叉、吃饭 video=摄像机、视频 wallet=钱包 warehouse=仓库 wheat=麦穗、粮食 wifi=无线信号 wrench=扳手、修理 x=叉 zap=闪电、电、很快').split())


def bu_white():
    """补图标能用的图标名单：只认白名单那一处（试验夹里是「九」夹下的 白名单.json；搬进软件以后放 app 夹里）。读不到就用软件全部的图标。"""
    for p in (APP / '白名单.json', APP / 'baimingdan.json', APP.parent / '白名单.json'):      # baimingdan.json：服务器上那一份（包里的文件名得是英文）
        if p.exists():
            d = json.loads(p.read_text(encoding='utf-8')); names = d.get('图标')
            if names is None: names = list(d.get('图标小动作_照库') or []) + list(d.get('图标小动作_通用') or [])
            return [x for x in sorted(icons()) if x in set(names)]
    return sorted(icons())


# 补图标那一问：第十份新题面（词最多 8 个字、栏名只许中文、「到」每条都写），11-17 定放行换进来
def bu_prompt(lines, seg=None):
    """lines：[{'开始', '句'}]（中转收到的样子）。seg=(a, b)：只补第 a+1 到第 b 句。"""
    N = len(lines); a, b = (0, N) if seg is None else (max(0, int(seg[0])), min(N, int(seg[1])))
    rows = ['{} | {}'.format(i + 1, re.sub(r'\s+', '', str(x.get('句') or ''))) for i, x in enumerate(lines)]
    first = max(a + 1, 3); sc = scale_of(N)
    body = []
    if a > 0: body += ['（上文：只给你看懂意思用，不许配，不许抄里面的字）'] + rows[max(0, a - 3):a] + ['（要配的这一段从这里开始）']
    body += rows[a:b]
    if b < N: body += ['（这一段到这里为止。下文：只给你看懂意思用，不许配）'] + rows[b:b + 2]
    return ('你给一条口播短视频的句子配图标。下面是逐句字幕（编号 | 这句话），是语音识别的结果，可能有错字，一句话常被断成几行。\n'
            '画面上一次只出「一个图标加几个字」，整句话在底下的字幕里，不用你管。\n'
            f'你要做的：从第 {first} 句到第 {b} 句，一句一句看。这句话说的是一样看得见的东西、一个动作、一种状态，名单里又正好有对得上的图标，就给它配一个图标、挑一个词。\n'
            '要求：\n'
            '- 只有这一种写法：{"从": 12, "到": 12, "图标": "train-front", "词": "坐地铁上下班"}。'
            '栏名只许用「从」「到」「图标」「词」这四个中文，从头到尾都不许换成英文（写成 from、to、icon、word 的，整条作废）。'
            '「到」每一条都要写，只盖一句的，「到」写成和「从」一样。「从」「到」是句子编号：一处盖 1 句；一句话被断成两行的，可以盖连着的 2 句。两处不许盖同一句。\n'
            '- 「词」最多 8 个字，这是死规矩：9 个字以上的整条作废，不会帮你截短。不要把整句话塞进来，只挑这句话的意思落在哪儿的那几个字，让人单看也看得懂：\n'
            '    错「我每天早上坐地铁上下班要一个多小时」（17 个字，作废）  对「坐地铁上下班」\n'
            '    错「房租呢今年又涨了将近10%」（作废）  对「将近10%」\n'
            '    错「但是生意反而更差了」（作废）  对「生意反而更差了」\n'
            '  挑不出 8 个字以内、单看又看得懂的，这一句就不写。\n'
            '- 词必须是这一句（这两句）字幕里原样连着的字，照抄：不许改、不许加、不许换说法，字幕里的错别字也照抄。不要截半个词，不要填「这个、那些」这种指代的话。\n'
            '- 图标只能从下面的名单里挑，名字一个字母都不许改。图标得和这句话说的那样东西对得上（说钱配钞票、硬币，说等待配沙漏，说医院看病配听诊器）。对不上的不许硬配，这一句就不写。\n'
            '- 纯过渡的话（「下面我们来看看」「也就是说」「对吧」）不写。\n'
            '- 数连同单位原样照抄，一个字不许少。带「不、没、别」这类否定的话，照抄时把否定一起带上。\n'
            f'- 同一个图标不要连着用，全片最多用 {BU_SAME * sc} 次。\n'
            f'- 能配的都配上：这一段一共 {b - first + 1} 句，除了纯过渡的话，每一句都试着配，至少七成的句子要配上，前、中、后都要有；配少了算没做完。但图标对不上的宁可不写。\n\n'
            '图标名单（等号后面是它画的是什么）：\n' + '  '.join('{}={}'.format(x, BU_GLOSS.get(x, '')) for x in bu_white()) + '\n\n'
            '只回 JSON，不要别的字：{"图标词": [{"从": 3, "到": 3, "图标": "...", "词": "八个字以内"}, ...]}\n'
            '回之前，把每一条的「词」数一遍字：超过 8 个字的，改短到 8 个字以内，改不短就删掉这一条；栏名都是中文、每条都有「到」。\n\n'
            '逐句字幕：\n' + '\n'.join(body) + '\n')


def bu_parse(raw):
    """补图标的回话 → [{从, 到, 图标, 词}]。认「图标词」这一层；光回了一个列表的也认。"""
    s = str(raw or ''); a, b = s.find('{'), s.rfind('}'); d = None
    try: d = json.loads(s[a:b + 1]) if a >= 0 and b > a else None
    except ValueError: d = None
    its = d.get('图标词') if isinstance(d, dict) else None
    if not isinstance(its, list): its = _loose(s, '图标词')
    if not its:
        a, b = s.find('['), s.rfind(']')
        try: its = json.loads(s[a:b + 1]) if a >= 0 and b > a else []
        except ValueError: its = []
    return [x for x in (its or []) if isinstance(x, dict)]


BU_SHORT = 8                    # 11-17：补的词太长，取原话里紧挨的短词，最多这么多字；取不出来就只画图标
BU_WORD_MOST = 10               # 图标词的词最多几个字（和把关 check_all 里那条同一个数）
_BU_TURN = ('但是', '可是', '不过', '然而', '反而', '但', '却')
_BU_CAUSE = ('所以', '因此', '因而', '于是', '结果', '导致', '使得')
_BU_NUM = re.compile(r'(?:大约|将近|超过|不到|约|近)?\d+(?:\.\d+)?(?:%|％|[万亿千百]+)?[个件种人元块年天岁倍成次台条家位名分秒米斤克度]?')


def bu_short(w):
    """太长的词 → 取一个短的（照兜底的规矩：转折取后半、因果取果、带数取数）。取不出 2 到 BU_SHORT 个字的回 None。"""
    s = norm(w)
    for ws in (_BU_TURN, _BU_CAUSE):
        hit = [(s.rfind(x), x) for x in ws if s.rfind(x) >= 0]
        if hit:
            i, x = max(hit); s = s[i + len(x):]
            if 2 <= len(s) <= BU_SHORT: return s
            break
    m = _BU_NUM.search(s)
    return m.group(0) if m and 2 <= len(m.group(0)) <= BU_SHORT else None


def _bu_bare(a, lines, f, t):
    """只画图标、不出大字的那一张（底下字幕照出）。"""
    la, lb = f - 1, t
    return {'类型': KIND, 'la': la, 'lb': lb, 'kit': '图标词', 'args': [a['图标'], '', None], '原类型': '图标词', 'first': BU_GLOSS.get(a['图标']) or a['图标'],
            '紧': (la, lb), '末': float(lines[la]['t0']) + 0.3, '项': dict(a, 词=''), '只图标': True, '补': True}


def bu_check(items, lines, K, white=None, sp=None):
    """补的图标词一处一处查。回 (合格的（排卡要的样子，按先后）, 拦下的 [{项, 原因}])。把关就是 check_all 那一套（一处一处单过，所以「每种最多三次」那条不管它）。"""
    n = len(lines); sc = scale_of(n); white = set(bu_white() if white is None else white)
    good, held = [], []
    for x in (items if isinstance(items, list) else [])[:n]:
        if not isinstance(x, dict): continue
        a = {'类型': '图标词', '从': x.get('从', x.get('from')), '到': x.get('到', x.get('to')), '图标': x.get('图标', x.get('icon')), '词': x.get('词', x.get('word'))}      # 栏名写成英文 from、to、icon、word 的也认（第九份购物稿两遍里有 41 处）
        if a['到'] is None and isinstance(a['从'], int) and not isinstance(a['从'], bool): a['到'] = a['从']      # 11-17：没写盖到第几句的，当只盖一句
        try: f, t = int(a['从']), int(a['到'])
        except (TypeError, ValueError, OverflowError): held.append(dict(项=a, 原因='「从」「到」写得不对', 道='补图标')); continue
        why = ''
        if f < 3: why = '第 1、2 句是开场，不配'
        elif t - f + 1 > BU_SPAN or t < f: why = f'一处最多盖 {BU_SPAN} 句'
        elif a['图标'] not in white: why = '图标不在名单里'
        if why: held.append(dict(项=a, 原因=why, 道='补图标')); continue
        if a['词'] == '': good.append(_bu_bare(a, lines, f, t)); continue      # 中转那头已经定了只画图标的（软件这头再把一遍关时认它）
        long = isinstance(a['词'], str) and len(norm(a['词'])) > BU_WORD_MOST
        if long:                                         # 11-17：词太长不再整张扔掉。图标照画，大字换成原话里紧挨的短词；取不出来就只画图标
            sw = bu_short(a['词']); g = check_all([dict(a, 词=sw)], lines, K, sp)[0] if sw else []
            if g and g[0]['args'][1][-1:] not in HALF: g[0]['项'] = a
            else:
                c = _bu_bare(a, lines, f, t); good.append(c); continue
        else:
            g, h = check_all([a], lines, K, sp)
            if not g: held.append(dict(项=a, 原因=(h[0]['原因'] if h else '没过把关'), 道='把关')); continue
        c = g[0]
        if c['args'][1][-1:] in HALF: held.append(dict(项=a, 原因='「{}」停在半句上'.format(c['args'][1]), 道='把关')); continue
        if long: c['短写'] = True
        c['补'] = True; c['末'] = float(lines[c['la']]['t0']) + 0.3      # 字跟着图标一起进：停够没有，从这一屏开头再往后 0.3 秒算（贴着线过的，后一步前后一挤又会不够）
        good.append(c)
    good.sort(key=lambda c: (c['la'], c['lb'])); keep = []; cnt = collections.Counter()
    for c in good:
        ic = c['args'][0]; why = ''
        if keep and c['la'] < keep[-1]['lb']: why = '和上一处盖了同一句'
        elif keep and keep[-1]['args'][0] == ic and c['la'] - keep[-1]['lb'] <= 2: why = '同一个图标连着用了'
        elif cnt[ic] >= BU_SAME * sc: why = f'这个图标全片已经用了 {BU_SAME * sc} 次'
        if why: held.append(dict(项=c['项'], 原因=why, 道='排重')); continue
        cnt[ic] += 1; keep.append(c)
    return keep, held


def with_bu(good, bu):
    """主画面在前、补的图标词在后（排卡先到先得：主画面占了的句子，补的盖不到）。hid 接着往下编。"""
    out = list(good or [])
    for c in bu or []:
        if any(c['la'] < g['lb'] and c['lb'] > g['la'] for g in (good or [])): continue
        out.append(dict(c, hid=len(out)))
    return out


# ───────────── 6 补的图标查意思、画面多留一句（2026-11-16 第九轮，还在试验夹） ─────────────
def bu_check_prompt(T, good):
    """补的图标词交给模型查一遍：图标和这句话说的那样东西对不对得上、词单看会不会让人误会。回话的样子和 check_prompt 一样，用 verdict 读。"""
    out = ['下面是一条口播里的若干句字幕。软件给每一句配了「一个图标加几个字」。请你一处一处判断：这个图标、这几个字，和这句话的意思对得上吗？\n'
           '判「对不上」的几种情况：\n'
           '- 图标画的东西和这句话说的不是一回事（说的是药，配了一把锤子；说的是等很久，配了一道闪电）；\n'
           '- 图标只沾了一个字的边，意思不搭（「打开思路」配了一扇门；「银行」这句其实在说河岸）；\n'
           '- 那几个字单看会让人误会原话（丢了主语、把半句当整句、好坏说反、丢了「不、没」）；\n'
           '- 这句只是过渡话，没有说到任何看得见的东西，图标是硬凑的。\n'
           '图标和这句话说的那样东西、那个动作对得上，字也没有歪曲原话的，算「对得上」。拿不准的判「对不上」。\n']
    for n, c in enumerate(good, 1):
        la, lb = c['la'], c['lb']; ic, w = c['args'][0], c['args'][1]
        out.append('第 {} 处（第 {}{} 句）\n字幕：\n{}{}\n{}图标：{}（{}）；字：{}\n'.format(
            n, la + 1, '' if lb - la == 1 else '–{}'.format(lb), ('  （前一句：{}）\n'.format(T[la - 1]) if la > 0 else ''), _rows(T, la, lb),
            ('  （后一句：{}）\n'.format(T[lb]) if lb < len(T) else ''), ic, BU_GLOSS.get(ic, ''), w or '（不出字，只画图标）'))
    out.append('只回 JSON，不要别的字：{"查": [{"号": 1, "对得上": true, "为什么": "不超过 20 个字"}, ...]}（每一处都要回，号照上面的）')
    return '\n'.join(out)


def bu_verdict(raw, n):
    """查补的图标的回话 → 去掉哪几个号（判对不上的，加上读不出来的）。11-17：回话读不出来的那几处一律当没查过，不进片子，哪一档都一样。
    只认「"对得上": true / false」（是、否也认）；写成「对不上」的、值认不得的、缺的号，都算读不出来。一个号都读不出来回 None（好重叫）。"""
    parts = re.split(r'"号"\s*:\s*"?(\d+)"?', str(raw or '')); ok = {}
    for i in range(1, len(parts) - 1, 2):
        m = re.search(r'"(对得上|对不上)"\s*:\s*"?([^\s",}\]]*)"?', parts[i + 1])
        if not m or m.group(1) != '对得上': continue
        v = m.group(2).lower()
        if v in YES: ok[int(parts[i])] = True
        elif v in NO: ok[int(parts[i])] = False
    if not ok: return None
    return sorted(i for i in range(1, n + 1) if ok.get(i) is not True)


def jie_prompt(lines):
    """lines：[{'开始', '句'}]。逐句判：这一句是不是还在讲上一句那件事。"""
    rows = ['{} | {}'.format(i + 1, re.sub(r'\s+', '', str(x.get('句') or ''))) for i, x in enumerate(lines)]
    return ('下面是一条口播的逐句字幕（编号 | 这句话），是语音识别的结果，一句话常被断成几行。\n'
            '请你从第 2 句起一句一句看：这一句是不是还在讲上一句那件事？\n'
            '算「还在讲」的：把上一句没说完的话说完；给上一句补一句、举个例子；换个说法把上一句再说一遍。\n'
            '不算的：说到了新的东西；转了意思（拿「但是、可是、不过、另外、第二、接下来、那」开头的多半是）；开了一个新话头；问了一个新问题。拿不准的不算。\n\n'
            '只回 JSON，不要别的字：{"接": [5, 9, 10]}（只列「还在讲上一句那件事」的句子编号）\n\n'
            '逐句字幕：\n' + '\n'.join(rows) + '\n')


def jie_parse(raw, n):
    """回话 → 还在讲上一句那件事的句子（从 0 数的行号，集合）。读不出来回 None。"""
    s = str(raw or ''); a, b = s.find('{'), s.rfind('}')
    try: s = json.dumps(json.loads(s[a:b + 1]), ensure_ascii=False) if a >= 0 and b > a else s      # 先照 JSON 读一遍（栏名写成 \u63a5 这种转义的也认）
    except ValueError: pass
    m = re.search(r'"接"\s*:\s*\[([^\]]*)\]', s)
    if not m: return None
    out = set()
    for x in re.findall(r'\d+', m.group(1)):
        i = int(x) - 1
        if 1 <= i < n: out.add(i)
    return out


LINGER_N = 2                    # 画面最多多留几句
LINGER_S = 4.0                  # 画面最多多留几秒


def linger(scenes, lines, dur, jie):
    """小画面后头紧跟的一两句要是「还在讲上一句那件事」（jie：从 0 数的行号）、自己又没有画面，画面留着，这一两句走字幕。回 (新的几张卡, 留了几处, 多留的秒数)。
    只吃普通句卡（say）里的句子；拿转折、另起的字开头的不吃；留完那张句卡空了就去掉。卡的顺序、别的卡一概不动。"""
    S = [dict(x) for x in scenes]; nn = len(lines); T = [re.sub(r'\s+', '', ''.join(c[0] for c in l['cs'])) for l in lines]
    t1_of = lambda e: lines[e]['t0'] - 0.15 if e < nn else dur
    n = 0; sec = 0.0; i = 0
    while i < len(S) - 1:
        a, b = S[i], S[i + 1]
        if a.get('type') == 'pro' and b.get('type') == 'say' and a['lb'] == b['la']:
            e = a['lb']; t_old = a['t1']
            while e < b['lb'] and e in jie and e - a['lb'] < LINGER_N and not MARK.match(T[e]) and t1_of(e + 1) - t_old <= LINGER_S: e += 1
            if e > a['lb'] and (e < b['lb'] or i + 2 < len(S)):      # 不吃到片尾最后一张
                a['lb'] = e; a['t1'] = round(t1_of(e), 3) if e < b['lb'] else b['t1']; a['liu'] = e - b['la']
                n += 1; sec += a['t1'] - t_old
                if e >= b['lb']: S.pop(i + 1)
                else: b['la'] = e; b['t0'] = a['t1']
        i += 1
    return S, n, round(sec, 2)
