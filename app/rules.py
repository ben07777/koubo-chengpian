# 「懂」层的第二半：吃句型（planner 排好的 scenes）和字的时间，算出画风要用的事件：
# 词组、每句上屏的词、主角词、上下、人物闸、数字动作、一群、结尾、转折。结果并进剧本（见 juben.py）。
# 2026-11-07 从 样片工程 的 rules.py 搬进软件；代码里不许有任何一段录音的秒数和词。
# 规则来自 方向案2.md 第二节，写的时候只看了少量文字，可能过拟合。
#   python rules.py plan.js     打印一张人能读的表
import json, re, sys, statistics
from pathlib import Path
import jieba
import shuzi
jieba.setLogLevel(60)
# 11-12 盲审中1：分词缓存放在软件自己的 runtime 夹里，不写系统临时夹，也不和电脑上别的 jieba 共用一份。
# 服务器一启动就经 xieshou 载入本文件，赶在第一次切词之前定好。建不了夹就照 jieba 原样。
try:
    (Path(__file__).resolve().parent.parent / 'runtime').mkdir(exist_ok=True)
    jieba.dt.tmp_dir = str(Path(__file__).resolve().parent.parent / 'runtime')
except OSError:
    pass

GENERIC = set("""知道 记得 试试 喜欢 过程 东西 这个 那个 一个 我们 你们 他们 它们 什么 怎么 因为 所以 就是 其实 不是 可能 时候 今天 现在
以前 这样 那样 如果 但是 可是 可以 没有 真的 已经 还是 自己 大家 很多 很多人 有些 一些 这段 时间 一样 一下 一点 这些 那些 以为 觉得 认为
这种 那种 这么 那么 为什么 然后 而且 或者 还有 比如 其中 只是 不会 不要 不能 能够 应该 需要 一定 特别 非常 问题 事情 意思 地方 方面
一直 一起 一次 一种 还要 只要 不过 虽然 然而 而是 另外 同样 当然 毕竟 甚至 确实 别急 说话 看到 说明
出来 起来 上去 下来 过去 回去 进去 这里 那里 哪里 怎样 多少 大概 差不多 比较 尤其 主要 基本 整个 所有 每个 任何 别人 有人 人们 他说 我说""".split())
PARTICLE = set('的了呢着吧啊吗呀嘛哦么')
STOP1 = set('的了呢着吧啊吗呀嘛哦么是不就也都在有和跟与或又很太更最才再还却被把给让对从到向为以于这那它他她你我们个些上下里中后前会能要想说看做去来一二三四五六七八九十多少大小好')
UP = '回来 到账 到手 涨 赚 增长 翻倍 成功 上升 升职 好转 学会 省 抬头 起来 赢'.split()
DOWN = '跟不上 买不起 看不见 下降 缩水 流失 失败 亏 跌 沉 垮 拖 压 没 掉 少 慢 等 累 难 熬 欠 坑 贵 烧 哭'.split()
# 这些词里的字不算上下（方向案第 ④ 步的局限：单字一定误伤）
MASK = """没关系 没事 没错 没想到 没准 至少 不少 多少 少数 少年 年少 等于 等等 等级 平等 同等 对等 高等 中等 初等 难道 难怪 掉头 慢慢 宝贵 贵州 发烧
省份 省市 全省 反省 沉淀 沉稳 深沉 拖鞋 看起来 说起来 想起来 比起来 听起来 用起来 做起来 一起来 起来说 起来看 难得 不难""".split()
NEG_PREV = set('不没别未')
PERSON = '孩子 宝宝 小孩 小朋友 婴儿 学生 女儿 儿子 爸妈 爸爸 妈妈 父母 家长 老人 爷爷 奶奶 老公 老婆 孕妇 病人'.split()
TURN = '其实 但是 可是 然而 不过 却 反而'.split()
NUM_UNIT = r'(?:美元|大卡|个月|小时|分钟|公斤|万元|亿元|元|块|岁|年|天|周|秒|斤|米|度|台|倍|次|人|家|篇|条|本|口|杯|步|种|%)'
NUM_WORD = re.compile(r'\d+(?:\.\d+)?(?:万亿|千亿|百亿|十亿|亿|千万|百万|十万|万|千|百)?' + NUM_UNIT + r'?')
CN_DIG = dict(zip('零〇一二两三四五六七八九', [0, 0, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9]))
CN_RE = re.compile(r'[零〇一二两三四五六七八九十百千]+')
VERBS = [('push', '交出去 给 递 付 发 送'.split()), ('wait', '等 排队 熬 耗'.split()), ('reach', '想要 够 追'.split()),
         ('wilt', '没 空 丢 亏'.split()), ('back', '回来 到账 到手'.split()), ('grow', '一长 变长 拉长 涨 翻倍'.split())]
WEAK_NUM = re.compile(r'^(1|一)(个|天|年|次|种|条|家|人|本|口|步|杯)$')


cn_num = shuzi.cn_num   # 三 / 十五 / 一百二十 → 数（和 planner 共用一份）


def norm_num(text):
    """把后面跟着单位的中文数字换成阿拉伯数字，只用来认数字，不改字幕。返回 新文字。"""
    def rep(m):
        if '中文数字' in shuzi.FIXES and text[m.end():m.end() + 1] in tuple('零〇一二两三四五六七八九'):
            return m.group(0)                      # 「一万二」不是一万
        if '数字' in shuzi.FIXES and m.start() > 0 and text[m.start() - 1] == '点':
            return m.group(0)                      # 「三点五倍」的「五倍」是小数的后半截，不单独换
        v = cn_num(m.group(1))
        return m.group(0) if v is None else str(v) + m.group(2)
    return re.sub(r'([零〇一二两三四五六七八九十百千]+)(万亿|亿|千万|百万|万|千|到|至|' + NUM_UNIT + ')', rep, text)


def line_text(l):
    return ''.join(c[0] for c in l['cs'])


def time_map(l):
    """每个字的下标 → (开始, 结束)。一个字块可能是好几个字。"""
    out = []
    for c in l['cs']:
        for _ in c[0]:
            out.append((c[1], c[2]))
    return out


def cuts(text):
    """数字加单位先保护，其余 jieba 普通切词（不用词性）。11-09 第三轮起整个数块一起保护（负5%、1.5个亿、3点15分、3分之1）。"""
    out, at = [], 0
    spans = shuzi.digit_blocks(text) if '数块' in shuzi.FIXES else [m.span() for m in NUM_WORD.finditer(text)]
    for a, b in spans:
        if a > at: out += list(jieba.cut(text[at:a]))
        out.append(text[a:b]); at = b
    if at < len(text): out += list(jieba.cut(text[at:]))
    return out


def groups_of(i, l):
    text, tm = line_text(l), time_map(l)
    raw, at = [], 0
    for w in cuts(text):
        raw.append([at, at + len(w)]); at += len(w)
    merged = []
    for a, b in raw:                                   # 语气词并到前一组
        if merged and all(c in PARTICLE for c in text[a:b]):
            merged[-1][1] = b
        else:
            merged.append([a, b])
    out, k = [], 0
    while k < len(merged):                             # 不足 0.2 秒并到后一组
        a, b = merged[k]
        while tm[b - 1][1] - tm[a][0] < .2 and k + 1 < len(merged):
            k += 1; b = merged[k][1]
        out.append([a, b]); k += 1
    if len(out) > 1 and tm[out[-1][1] - 1][1] - tm[out[-1][0]][0] < .12:
        out[-2][1] = out[-1][1]; out.pop()
    return [dict(line=i, a=a, b=b, text=text[a:b], t0=tm[a][0], t1=tm[b - 1][1]) for a, b in out]


def polarity(text):
    masked = text
    for w in MASK:
        masked = masked.replace(w, '＿' * len(w))
    up = down = 0
    for lst, sign in ((UP, 1), (DOWN, -1)):
        taken = masked
        for w in lst:
            for m in re.finditer(w, taken):
                neg = m.start() > 0 and taken[m.start() - 1] in NEG_PREV
                s = -sign if neg and w != '没' else sign
                if s > 0: up += 1
                else: down += 1
            taken = taken.replace(w, '＿' * len(w))
    return 1 if up and not down else -1 if down and not up else 0


def find_hero(lines):
    for i, t in enumerate(lines):
        m = re.search(r'(?:就叫|这叫|叫做|称为|叫)([^，。？！]{2,5})$', t)
        if m:
            w = re.sub(r'[的了呢吧啊吗]+$', '', m.group(1))
            if len(w) >= 2 and w not in GENERIC and not re.search('什么|啥|这|那', w):
                return w, i
    cnt = {}
    for t in lines:
        for w in cuts(t):
            cnt[w] = cnt.get(w, 0) + 1
    two = [(c, -lines.index(next(t for t in lines if w in t)), w) for w, c in cnt.items() if len(w) >= 2 and c >= 2 and w not in GENERIC and not re.search(r'\d', w) and w not in PERSON]
    if two:
        return max(two)[2], None
    one = [(c, w) for w, c in cnt.items() if len(w) == 1 and c >= 3 and w not in STOP1 and re.match(r'[一-鿿]', w)]
    if one:
        return max(one)[1], None
    return None, None


def gate(text, kw, hero, cut_at=None):
    """词闸：这句放什么词；放不出就返回 None。cut_at：'head' / 'tail' / 'both'，这行开头或结尾的数被切成了两半，那个数不上屏。"""
    if hero and hero in text: return hero
    tk, cut, at = cuts(text), set(), 0
    if '数字' not in shuzi.FIXES: cut_at = None
    for w in tk:
        a, at = at, at + len(w)
        if '数字' in shuzi.FIXES and re.fullmatch(r'\d+(?:\.\d+)?', w) and not re.search(shuzi.MONEY_PRE, text[:a][-6:]) and not shuzi.unit_after(text, at):
            cut.add(w)                                  # 没单位的裸数（「是41」）观众看不懂，不上屏；「便宜1000」是钱，照上
        if '中文数字' in shuzi.FIXES and a > 0 and text[a - 1] in '一二两三四五六七八九十' and w[0] in shuzi.CN_CH:
            cut.add(w)                                  # 「两三百万」被切出的「三百万」是半个约数，不上屏
        if (cut_at in ('head', 'both') and a == 0 and re.match(r'\d', w)) or (cut_at in ('tail', 'both') and at == len(text) and re.search(r'\d$', w)):
            cut.add(w)
        if '数字' in shuzi.FIXES and a > 1 and text[a - 1] == '点' and text[a - 2] in '0123456789' + shuzi.CN_CH and w[0] in '0123456789' + shuzi.CN_CH:
            cut.add(w)                                  # 「2点4倍」切出的「4倍」是半个小数，不上屏（11-09 发版前必修）
    tk = [w for w in tk if w not in cut]
    if '数块' in shuzi.FIXES:                            # 11-09 第三轮：上屏词不许是半个数（「3分之1」截「3分」、「十几万」截「几万」）
        tk = [w for w in tk if shuzi.whole_ok(text, w)]
        for w in tk:
            if re.search(r'\d', w) and shuzi.BLOCK.fullmatch(w) and not WEAK_NUM.match(w)                     and (re.search(r'[^\d.,]', w) or (re.fullmatch(r'\d+(?:\.\d+)?', w) and float(w) >= 10)): return shuzi.with_neg(text, w)   # 11-10：「负增长3%」整个上屏
    for w in tk:
        if NUM_WORD.fullmatch(w) and not WEAK_NUM.match(w) and (re.search(r'\D', w) or float(w) >= 10): return w
    if kw and kw in tk and kw not in GENERIC and not kw.startswith('第'): return kw
    for w in ('没钱', '没电', '没人', '没用', '没空'):
        if w in text: return w
    fine = [w for w in tk if len(w) >= 2 and w not in GENERIC and not w.startswith('第') and re.match(r'[一-鿿A-Za-z]', w)]
    if '名词' in shuzi.FIXES:                            # 11-07：先挑名词（他在说的东西），没有名词再按原来取第一个词
        ns = nouns_of(text)
        for w in fine:
            if w in ns: return w
    return fine[0] if fine else None


NOUN_FLAGS = ('n', 'vn', 'eng')


def nouns_of(text):
    import jieba.posseg as pseg
    return {w for w, f in pseg.cut(text) if f.startswith(NOUN_FLAGS) and f != 'nr' or (f == 'nr' and len(w) >= 3)}


def pos_time(l, word, after=0):
    text, tm = line_text(l), time_map(l)
    p = text.find(word, after)
    if p < 0: p = text.find(word)
    if p < 0: return l['t0'], l['t1']
    return tm[p][0], tm[p + len(word) - 1][1]


def verb_of(g):
    t = g['text']
    for name, ws in VERBS:
        for w in ws:
            if len(w) >= 2 and w in t: return name
            if len(w) == 1 and (t == w or t.startswith(w) and len(t) <= 3) and not any(x in t for x in MASK) and t not in ('没有', '给你', '发现', '发展', '送给'):
                return name
    return None


def first_polar_word(text, hero):
    """对比句里，优先取带上下色彩的词（账上写着赚钱 → 赚钱），别再取一遍主角词。"""
    tk = [w for w in cuts(text) if len(w) >= 2 and w != hero and w not in GENERIC]
    for w in tk:
        if polarity(w): return w
    return tk[-1] if tk else None


def build(plan):
    L = plan['lines']; T = [line_text(l) for l in L]; dur = plan['dur']
    hero, hero_line = find_hero(T)
    broken = shuzi.broken_tail(L)
    rows, kw_marks, breaks = [], [], {}
    for i, l in enumerate(L):
        t = T[i]; person = any(p in t for p in PERSON)
        dec = (shuzi.AR_DEC.search(t) or shuzi.CN_DEC.search(t)) if '数字' in shuzi.FIXES and not (hero and hero in t) else None
        src = t if '数块' in shuzi.FIXES else norm_num(t) if not re.search(r'\d', t) and norm_num(t) != t else t   # 11-09 第三轮：不拿中文数字换成的「30%」上屏，字幕里是「三成」
        word = dec.group(0) if dec and shuzi.whole_ok(t, dec.group(0)) else gate(src, l.get('kw', ''), hero, broken.get(i))   # 用「点」说的小数整个上屏
        if word and word not in t: word = None if not re.search(r'\d', word) else word      # 中文数字转成的词，字幕里找不到
        pol = 0 if person else polarity(t)
        wp = bool(word) and any(p in word for p in PERSON)
        wt0, wt1 = pos_time(l, word) if word and word in t else (l['t0'], l['t1'])
        gap = (L[i + 1]['t0'] if i + 1 < len(L) else dur) - l['t1']
        chars = sum(len(c[0]) for c in l['cs'])
        rows.append(dict(i=i, text=t, t0=l['t0'], t1=l['t1'], word=word, wt0=wt0, wt1=wt1, pol=pol, person=person, wp=wp, gap=round(gap, 3), rate=chars / max(l['t1'] - l['t0'], .2)))
        kw_marks.append([word] if word and word in t else [])
    med = statistics.median(r['rate'] for r in rows) if rows else 5
    for r in rows:
        r['rate'] = round(r['rate'] / med, 3)

    groups = []
    for i, l in enumerate(L):
        gs = groups_of(i, l)
        for g in gs:
            g['verb'] = verb_of(g)
            w = rows[i]['word']
            p = T[i].find(w) if w else -1
            g['word'] = bool(w) and p >= 0 and g['a'] <= p < g['b']
        if len(T[i]) > 12:                                # 字幕在词组边上换行
            mid = len(T[i]) / 2
            sp = shuzi.blocks(T[i])                       # 11-09 第三轮：不在一个数中间换行
            b = min((g['a'] for g in gs if g['a'] > 0 and not shuzi.splits(sp, g['a'])), key=lambda a: abs(a - mid), default=None)
            if b is not None: breaks[i] = sum(1 for _ in T[i][:b])
        groups += gs
    for k, g in enumerate(groups):
        prev_end = groups[k - 1]['t1'] if k else 0
        g['pause'] = round(g['t0'] - prev_end, 3)
        for x in ('t0', 't1'): g[x] = round(g[x], 3)

    acts = []
    covered = set()
    for s in plan['scenes']:
        ty = s['type']; la, lb = s.get('la', 0), s.get('lb', s.get('la', 0) + 1)
        person = any(rows[j]['person'] for j in range(la, min(lb, len(rows))))
        if ty == 'myth':
            fi = next((j for j in range(la, lb) if s.get('factFull') and T[j].find(s['factFull'][:2]) >= 0 and j > la), lb - 1)
            ft = T[fi].find('不')
            tn = time_map(L[fi])[ft][0] if ft >= 0 else L[fi]['t0']
            acts.append(dict(k='trap', t=round(tn, 3), t0=L[fi]['t0'], person=person, line=fi))
            covered.add(fi)
        elif ty == 'range':
            prev = T[la - 1] if la else ''
            wait = s.get('unit') in ('天', '周', '个月', '月', '年', '小时', '分钟', '秒') and bool(re.search('等|要|才|熬', T[la] + prev))
            if '数块' in shuzi.FIXES and not s.get('rawLo'): continue     # 抄不准就不画
            acts.append(dict(k='range', lo=s['lo'], hi=s['hi'], unit=s.get('unit', ''), tLo=s['tLo'], tHi=s['tHi'], t1=L[lb - 1]['t1'], wait=wait, line=la,
                             **({'raw': s['raw'], 'rawLo': s['rawLo'], 'rawHi': s['rawHi']} if s.get('rawLo') else {})))
        elif ty == 'stat':
            w = rows[la]['word'] if rows[la]['word'] and re.search(r'\d', rows[la]['word']) else None
            if '数块' in shuzi.FIXES and w != s.get('raw'): w = None    # 11-09 第三轮：上屏词就是字幕里那个数的原样，才滚数；否则不画
            if '数块' in shuzi.FIXES and w and (shuzi.neg_before(T[la], T[la].find(w)) or len(shuzi.digit_blocks(T[la])) >= 2): w = None   # 11-10 总控改判：「负增长3%」单画 3% 像正的；一句两个数（从2.5%降到1.8%），跳字没标签，单画前一个像现值：都不画
            m = re.match(r'(\d+(?:\.\d+)?)(.*)', w or '')
            if m:
                acts.append(dict(k='stat', value=float(m.group(1)), suffix=m.group(2), word=w, t=rows[la]['wt0'], t1=L[la]['t1'], line=la,
                                 wait=bool(re.search('等|熬', T[la])) and m.group(2) in ('天', '周', '个月', '年', '小时', '分钟', '秒'),
                                 **({'raw': s['raw'], 'rawN': s['rawN'], 'rawU': s['rawU']} if s.get('raw') else {})))
        elif ty == 'year':
            for n in s.get('nodes', []):
                acts.append(dict(k='year', year=n['year'], t=n['t'], line=la))
        elif ty == 'compare':
            lj = next((j for j in range(la, lb) if abs(L[j]['t0'] - s['L']['t']) < .3), la) if isinstance(s.get('L'), dict) and 't' in s['L'] else la
            rj = next((j for j in range(lj + 1, lb) if isinstance(s.get('R'), dict) and abs(L[j]['t0'] - s['R'].get('t', -9)) < .3), lb - 1)
            lw = first_polar_word(''.join(T[lj:rj]), hero)
            rneg = bool(re.search('没|无|空|不', T[rj]))
            lt = pos_time(L[lj], lw) if lw and lw in T[lj] else next((pos_time(L[j], lw) for j in range(lj, rj) if lw and lw in T[j]), (L[lj]['t0'], L[lj]['t1']))
            acts.append(dict(k='compare', L=lw, tL=lt[0], tL1=lt[1], R=rows[rj]['word'], tR=rows[rj]['wt0'], tR0=L[rj]['t0'], tR1=L[rj]['t1'], rneg=rneg, person=person, line=lj, lineR=rj))
        elif ty == 'flip':
            bj = lb - 1
            aw = re.sub('[的了]+$', '', s.get('A', ''))
            aw = s.get('kwA') or next((w for w in cuts(s.get('A', '')) if len(w) >= 2 and w not in GENERIC), aw[:4])
            acts.append(dict(k='flip', A=aw, tA=s.get('tA'), B=rows[bj]['word'], tB=s.get('tB'), t1=L[bj]['t1'], person=person, line=la, lineB=bj))
        elif ty == 'cause':
            acts.append(dict(k='cause', tA=L[la]['t0'], tB=L[lb - 1]['t0'], A=rows[la]['word'], B=rows[lb - 1]['word'], line=la, lineB=lb - 1))
        elif ty == 'list':
            n = 0
            for it in s.get('items', []):
                n += 1
                t = it.get('t', L[la]['t0'])
                j = next((j for j in range(la, lb) if L[j]['t0'] - .05 <= t <= L[j]['t1'] + .05), la)
                acts.append(dict(k='listitem', n=n, word=rows[j]['word'], t=t, line=j))
        elif ty == 'pair':
            for n, it in enumerate(s.get('items', [])):
                acts.append(dict(k='pairitem', n=n, word=it['text'], t=it['t'], line=la))
        elif ty == 'question':
            acts.append(dict(k='question', t=L[la]['t1'] - .1, t1=(L[lb]['t0'] if lb < len(L) else dur), line=la))
        elif ty == 'cta':
            acts.append(dict(k='cta', t=L[la]['t0'], t1=L[lb - 1]['t1'], line=la))

    # 普通句里漏掉的中文数字（三到五分钟）
    busy = {a['line'] for a in acts if a['k'] in ('range', 'stat')}
    for i, t in enumerate(T):
        if i in busy or re.search(r'\d', t) or '数块' in shuzi.FIXES: continue     # 11-09 第三轮：中文说的范围带子上照抄不出来，不画
        n = norm_num(t)
        if n == t: continue
        m = re.search(r'(\d+)(?:到|至)(\d+)(' + NUM_UNIT + ')', n)
        if m:
            cn = re.search(r'[零〇一二两三四五六七八九十百千]+(?:到|至)[零〇一二两三四五六七八九十百千]+', t)
            if cn:
                tm = time_map(L[i]); wait = bool(re.search('等|要|才|熬', t))
                acts.append(dict(k='range', lo=float(m.group(1)), hi=float(m.group(2)), unit=m.group(3), tLo=tm[cn.start()][0], tHi=tm[min(cn.end() - 1, len(tm) - 1)][0], t1=L[i]['t1'], wait=wait, line=i))
                busy.add(i)

    # 定义句：这句说出主角词之后留白
    define = None
    if hero and hero_line is not None:
        r = rows[hero_line]
        define = dict(line=hero_line, t=r['wt0'], t1=r['wt1'], t0=r['t0'])
    # 「很多 X」→ 一群
    crowds = []
    for i, t in enumerate(T):
        m = re.search(r'很多|好多|不少|大多数|大部分|有些', t)
        if m and any(a['k'] == 'trap' and L[a['line']]['t0'] > L[i]['t0'] for a in acts) or (m and t.startswith(m.group(0))):
            tm = time_map(L[i])
            crowds.append(dict(t=tm[m.start()][0], line=i, person=rows[i]['person']))

    # 结尾：最后一句往下、前一句不往上、没有人物词 → 那一下大的
    last = rows[-1]; prev = rows[-2] if len(rows) > 1 else last
    fall = last['pol'] < 0 and prev['pol'] <= 0 and not last['person'] and not prev['person']
    tEnd = last['wt0'] if last['word'] else last['t0']
    if fall:
        for w in DOWN:
            p = last['text'].find(w)
            if p >= 0:
                tEnd = time_map(L[-1])[p][0]; break
    target = hero or next((r['word'] for r in reversed(rows) if r['word'] and not r['wp']), None)
    end = dict(kind='fall' if fall else 'calm', word=target, t=round(tEnd, 3), t1=round(last['t1'], 3))
    turns = []
    for k, g in enumerate(groups):
        if any(w == g['text'] or g['text'].startswith(w) for w in TURN):
            turns.append(g['t0'])
    acts.sort(key=lambda a: a.get('t', a.get('tLo', a.get('tL', a.get('tA', a.get('tB', 0))))) or 0)
    cnt1 = {}
    for t in T:
        for w in cuts(t):
            if len(w) == 1 and w not in STOP1 and re.match(r'[\u4e00-\u9fff]', w): cnt1[w] = cnt1.get(w, 0) + 1
    single = max(cnt1, key=cnt1.get) if cnt1 and max(cnt1.values()) >= 3 else None
    props = [prop_of(T[i], rows[i]['word'], L[i]) for i in range(len(L))]
    return dict(single=single, dur=dur, hero=hero, heroLine=hero_line, define=define, lines=rows, groups=groups, acts=acts, crowds=crowds, end=end, turns=turns, kw=kw_marks, breaks=breaks,
                persons=sum(r['person'] for r in rows), props=props)


# 只画「东西」：人不画（人物闸，含中介、老板、朋友这类没进人物词表的人）；记号不画（星光、警示、勾叉、闪电、灯泡、靶心、涨跌箭头、问号），
# 它们不是他说的那样东西，11-07 盲审查出星光一项就占全部图标的 22%，按句盲判里也是规则版的主要错因（万能占位）
NOT_PROP = {'circle-question-mark', 'user', 'users', 'sparkles', 'triangle-alert', 'circle-x', 'circle-check', 'zap', 'lightbulb', 'target',
            'trending-up', 'trending-down', 'thumbs-up'}


def prop_of(text, word, l):
    """2026-11-07 第 4 步：这句画面里放的道具（软件现成的关键词→图标表，Lucide）。
    只查过了词闸的词：先上屏词本身，再名词，再其余；人物词不查（人物闸）；一句最多一个。
    返回 {text 触发的词, icon 图标名, t0, t1, own 是否就是上屏词}，查不到返回 None。"""
    if '图标' not in shuzi.FIXES: return None
    from planner import icon_for
    ok = lambda w: len(w) >= 2 and w not in GENERIC and not w.startswith('第') and re.match(r'[一-鿿A-Za-z]', w) and not any(p in w for p in PERSON)
    nouns = nouns_of(text)
    toks = [w for w in cuts(text) if ok(w)]
    cands = ([word] if word and not any(p in word for p in PERSON) else []) + [w for w in toks if w in nouns] + [w for w in toks if w not in nouns]
    for w in cands:
        ic = icon_for(w)
        if ic == 'car' and '车' not in w: ic = None    # 表里「油」也指向车，原油、油气画成车不对
        if ic and ic not in NOT_PROP:
            t0, t1 = pos_time(l, w) if w in text else (l['t0'], l['t1'])
            return dict(text=w, icon=ic, t0=round(t0, 3), t1=round(t1, 3), own=(w == word))
    return None


def load_plan(p):
    s = Path(p).read_text(encoding='utf-8')
    return json.loads(s[s.index('{'):s.rindex('}') + 1])


def show(ev):
    print('主角词', ev['hero'], '| 结尾', ev['end'], '| 人物句', ev['persons'])
    for r in ev['lines']:
        print(f"{r['t0']:7.2f} {r['pol']:+d} {'人' if r['person'] else ' '} {str(r['word']):8s} {r['text']}")
    print('词组', len(ev['groups']), '｜'.join(g['text'] + ('*' if g['word'] else '') + (f"[{g['verb']}]" if g['verb'] else '') for g in ev['groups'][:60]))
    for a in ev['acts']:
        print('  ', {k: (round(v, 2) if isinstance(v, float) else v) for k, v in a.items()})
    print('一群', ev['crowds'])


if __name__ == '__main__':
    show(build(load_plan(sys.argv[1])))
