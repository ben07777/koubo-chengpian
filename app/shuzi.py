# 数字：「懂」层里认数字的唯一一份。阿拉伯数字和中文数字都在这里归一，字幕原文不改。
# 只认「后面跟着单位」的中文数字，免得把「一下」「十分重要」「千万别」当成数。
import re

# 2026-11-07 四类修法的开关（planner、rules 共用这一份），只给考卷「拆开看」用，软件里永远全开
FIXES = {'数字', '号召', '清单', '中文数字', '名词', '图标'}   # 名词 / 图标：11-07 第 4 步，词闸先挑名词、句子挂图标
# 钱字紧挨着一个没单位的数 → 这个数是钱（「便宜1000」「人均300」）
MONEY_PRE = r'(价格|便宜|贵|工资|收入|房租|花了|赚了?|省了|月薪|年薪|人均)$'

# 量级（可叠：万亿、千亿）和计量单位，长的放前面
MAG = r'(?:万亿|千亿|百亿|十亿|亿|千万|百万|十万|万|千)'
MEAS = r'(?:美元|大卡|公斤|公里|个月|小时|分钟|%|倍|次|元|块|岁|年|月|天|周|秒|斤|米|度|台|人|家|篇|条|本|口|杯|步|分)'
UNIT = '(' + MAG + '?' + MEAS + '|' + MAG + ')'          # 一个分组：「万亿度」「天」「亿」
UNIT_HEAD = re.compile('^' + MAG + '?' + MEAS + '|^' + MAG)   # 下一行开头是不是单位

CN_DIG = dict(zip('零〇一二两三四五六七八九', [0, 0, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9]))
CN_CH = '零〇一二两三四五六七八九十百千'
# 中文数字后面允许的单位（比阿拉伯数字窄：「一度」「三人行」「十分」「两次」不算）
CN_UNIT = r'(?:成|美元|大卡|公斤|个月|小时|分钟|倍|元|块|岁|年|天|周|秒|斤|米|%)'
CN_MAG = r'(?:万亿|亿|千万|百万|十万|万)'
CN_RANGE = re.compile('([一二两三四五六七八九十][' + CN_CH + ']*)(到|至)([一二两三四五六七八九十][' + CN_CH + ']*)(' + CN_MAG + '?' + CN_UNIT + ')')
CN_ONE = re.compile('(?<![第' + CN_CH + '万亿])([一二两三四五六七八九十][' + CN_CH + ']*)(' + CN_MAG + MEAS + '?|' + CN_UNIT + ')')
# 用「点」说的小数（11-09 发版前必修：「2点4倍」被画成「4倍」）：2点4倍、三点五倍、零点五个百分点、1点5亿。后面必须跟单位，
# 免得把钟点（3点15分、八点半）当成小数；单位里不放 分 / 秒。
# 11-09 盲审：名单外的单位照样截成两半（「1点8米」「1点5个月」「3点5公里」「7点5个小时」），补上长度、时长、岁数。
DEC_UNIT = (r'(个百分点|(?:万亿|千亿|百亿|亿|千万|百万|万)?(?:倍|%|元|块|美元|公斤|斤|吨)|万亿|千亿|百亿|亿|千万|百万|万'
            r'|公里|千米|厘米|米|个多?月|个小时|小时|天|年|周|岁)')
AR_DEC = re.compile(r'(?<![\d.])(\d+)点(\d+)' + DEC_UNIT)
CN_DEC = re.compile('(?<![第' + CN_CH + '])([零〇一二两三四五六七八九十百千]+)点([零〇一二三四五六七八九]+)' + DEC_UNIT)


def cn_num(s):
    """三 / 十五 / 二十 / 一百二十 / 二零二五 → 数；认不出返回 None。"""
    if not s or any(c not in CN_CH for c in s):
        return None
    # 「两三年」「三四千」「五六十岁」是约数，不是 23、34、56：相邻两个不同的数字字、又不是四位编号，就不认
    if '中文数字' in FIXES and re.search('[一二两三四五六七八九][一二两三四五六七八九]', s) and not (len(s) >= 3 and all(c in CN_DIG for c in s)):
        return None
    if all(c in CN_DIG for c in s):
        return int(''.join(str(CN_DIG[c]) for c in s)) if len(s) > 1 else CN_DIG[s]
    total, cur = 0, 0
    for c in s:
        if c in CN_DIG: cur = CN_DIG[c]
        elif c == '十': total += (cur or 1) * 10; cur = 0
        elif c == '百': total += (cur or 1) * 100; cur = 0
        elif c == '千': total += (cur or 1) * 1000; cur = 0
    return total + cur


def _fmt(v):
    return str(int(v)) if float(v).is_integer() else str(v)


def normalize(text, strict=False):
    """把带单位的中文数字换成阿拉伯数字，「四成」换成「40%」。strict：单说的数只换配得上数字卡的（见 cn_value_ok），区间照换。
    返回 (新文字, 下标表)：下标表[j] = 新文字第 j 个字对应原文第几个字，用来找回每个字的时间。
    换不了的原样返回。"""
    spans = []                                   # (起, 止, 替换成)
    for m in AR_DEC.finditer(text):              # 2点4倍 → 2.4倍
        spans.append((m.start(), m.end(), f'{m.group(1)}.{m.group(2)}{m.group(3)}'))
    for m in CN_DEC.finditer(text):              # 三点五倍 → 3.5倍、零点五个百分点 → 0.5个百分点
        a = cn_num(m.group(1)); u = m.group(3)
        if a is None: continue
        d = ''.join(str(CN_DIG[c]) for c in m.group(2))
        if strict and u != '个百分点' and not cn_value_ok(float(f'{a}.{d}'), u): continue
        spans.append((m.start(), m.end(), f'{a}.{d}{u}'))
    taken = lambda i: any(s <= i < e for s, e, _ in spans)
    for m in CN_RANGE.finditer(text):
        if taken(m.start()) or taken(m.end() - 1): continue
        a, b = cn_num(m.group(1)), cn_num(m.group(3))
        if a is None or b is None or a >= b: continue
        u = m.group(4)
        if u == '成': spans.append((m.start(), m.end(), f'{a * 10}%到{b * 10}%')); continue
        spans.append((m.start(), m.end(), f'{a}{m.group(2)}{b}{u}'))
    taken = lambda i: any(s <= i < e for s, e, _ in spans)
    for m in CN_ONE.finditer(text):
        if taken(m.start()): continue
        v = cn_num(m.group(1))
        if v is None: continue
        u = m.group(2)
        nxt = text[m.end():m.end() + 1]
        if nxt and nxt in CN_CH: continue          # 「一万二」「三千五」是口语里省了后半个单位，不是一万、三千
        if u in ('年', '天', '个月', '周') and nxt in ('前', '后', '级', '代'): continue
        if u == '成':
            if v > 10 or (strict and v == 10): continue
            spans.append((m.start(), m.end(), f'{v * 10}%')); continue
        if strict and not cn_value_ok(v, u): continue
        spans.append((m.start(), m.end(), f'{v}{u}'))
    if not spans:
        return text, list(range(len(text)))
    spans.sort()
    out, idx, at = [], [], 0
    for s, e, rep in spans:
        out.append(text[at:s]); idx += list(range(at, s))
        # 换成的阿拉伯数字逐字摊回原来那几个中文字上：数字部分对数字部分，单位对单位
        n_src = e - s
        for k in range(len(rep)):
            idx.append(s + min(n_src - 1, round(k * (n_src - 1) / max(1, len(rep) - 1))))
        out.append(rep); at = e
    out.append(text[at:]); idx += list(range(at, len(text)))
    return ''.join(out), idx


def cn_value_ok(v, unit):
    """中文数字单说一个数时，什么情况才配一张数字卡：≥10，或者是成数、百分比、倍数、钱、万亿级。"""
    return v >= 10 or unit.endswith(('%', '倍', '元', '块', '美元')) or bool(re.match(CN_MAG, unit))


def broken_tail(lines):
    """一个数被切成两行：上一行以数字结尾、下一行以数字开头（「发电量10 / 58万亿度」其实是 10.58 万亿度）。
    返回 {行号: 'tail' | 'head'}，这两段数字都不能单独拿来当数。"""
    out = {}
    T = [''.join(c[0] for c in l['cs']) for l in lines]
    for i in range(len(T) - 1):
        if re.search(r'\d$', T[i]) and re.match(r'\d', T[i + 1]):
            out[i] = 'tail'; out[i + 1] = 'head' if i + 1 not in out else 'both'
    return out


def unit_from_next(lines, i):
    """这一行以数字结尾、单位被切到了下一行开头（「平台的40 / 亿件商品」）→ 返回单位；否则空字符串。"""
    if i + 1 >= len(lines): return ''
    t = ''.join(c[0] for c in lines[i]['cs']); nx = ''.join(c[0] for c in lines[i + 1]['cs'])
    if not re.search(r'\d$', t): return ''
    m = UNIT_HEAD.match(nx)
    return m.group(0) if m else ''


def unit_after(text, end):
    """数字后面跟着单位吗：「25岁」「100多个小时」「22到25岁」（区间的前半）都算。"""
    rest = text[end:]
    if re.match(r'[多余来几]*' + MAG, rest): return False   # 「3000多万」：后面还有量级，单拿「3000」差一万倍
    return bool(re.match(r'(?:[多余来几]+)?个?' + UNIT, rest)) or rest[:1] in ('到', '至', '~', '-', '－', '—')


NUM_TOKEN = re.compile(r'(\d+(?:\.\d+)?)' + UNIT + '?')


def line_nums(line, i, lines, broken):
    """一行里的数，给剧本用：原文、值、单位、在这行的第几个字、开始时刻、是不是中文说的、是不是被切断的。"""
    text = ''.join(c[0] for c in line['cs'])
    tm = []
    for c in line['cs']:
        for _ in c[0]: tm.append(c[1])
    norm, idx = normalize(text)
    out = []
    for m in NUM_TOKEN.finditer(norm):
        a, b = idx[m.start()], idx[m.end() - 1] + 1
        unit = m.group(2) or ''
        if not unit and m.end() == len(norm): unit = unit_from_next(lines, i)
        cn = not re.match(r'\d', text[a])
        cut = (broken.get(i) in ('tail', 'both') and m.end() == len(norm)) or (broken.get(i) in ('head', 'both') and m.start() == 0)
        out.append(dict(text=text[a:b], value=float(m.group(1)), unit=unit, a=a, b=b, t=tm[a] if a < len(tm) else line['t0'], cn=cn, cut=cut))
    return out


# ---------- 数块（11-09 第三轮返修）----------
# 字幕里的一个数，连着它的写法整个算一块：负号、正负、零下、小数点、冒号、斜杠、分数、钟点、日期、范围、比分、单位。
# 断行、封面两行、金色、挑词都不许把一块切开；数字大字只照抄「简单的块」（见 plain_at），抄不准就不画。
# 开关「数块」只给考卷拆开看用，软件里永远开着。
FIXES.add('数块')
_AR = r'\d+(?:[.,:/]\d+)*'                                         # 2.4、1,200、3:15、1/3、1.2.0
_CN = '[零〇一二两三四五六七八九十几][零〇一二两三四五六七八九十百千万亿几]*'
_SIGN = r'(?:正负|零下|负|[±+＋])?'
_FRAC = '(?:' + _AR + '|' + _CN + '|[千百万])分之(?:' + _AR + '|' + _CN + ')'   # 3分之1、千分之3、三分之一
_MEASB = (r'(?:美元|港元|欧元|日元|英镑|大卡|公斤|公里|千米|厘米|个?多?月|个?小时|分钟|%|％|‰|倍|次|元|块|角|毛|岁|年|天|周|秒|斤|吨|米|度'
          r'|台|人|家|篇|条|本|口|杯|步|分|折|成|番|股|手)')
_PLAIN_U = '(?:个百分点|个基点|百分点|基点|个' + MAG + '|' + MAG + '?' + _MEASB + '|' + MAG + ')'   # 能照抄进数字大字的单位
_TAILQ = '[半次件位名户辆张份款例套笔宗桩趟颗枚粒棵株层届座场]'   # 11-10 复审：单位后面还跟着的字（3岁半、3000万人次、40亿件）也算这一块，块不再只认到「3岁」「3000万人」「40亿」；这样的块照抄不进数字大字，不画，金色也不罩半块
_BU = r'(?:块\d+|米\d+|' + _PLAIN_U + _TAILQ + '?|[号日])'                  # 块的尾巴：再加「9块9」「1米8」「9号」
_MID = '[多余来几]?'
_AR_ATOM = _SIGN + '(?:' + _FRAC + '|' + _AR + r'(?:点(?:\d+|半|钟))?)' + '(?:' + _MID + _BU + '多?)?'   # 「3倍多」整块，不照抄
_CN_ATOM = _SIGN + '(?:' + _FRAC + '|' + _CN + '(?:点[零〇一二三四五六七八九]+)?' + _MID + _BU + '多?|' + _CN + '点[零〇一二三四五六七八九]+)'
_ATOM = '(?:' + _AR_ATOM + '|' + _CN_ATOM + ')'
_SEP = '(?:到|至|~|～|-|－|—|比)'
BLOCK = re.compile(_ATOM + '(?:' + _SEP + '?' + _ATOM + ')*')
PLAIN = re.compile(r'(\d+(?:\.\d+)?)(' + _PLAIN_U + ')')


def blocks(text):
    """这句字幕里所有数块：[(起, 止)]。开关关着返回空，各处保护自动不起作用。"""
    if '数块' not in FIXES or not text: return []
    return [(m.start(), m.end()) for m in BLOCK.finditer(text) if re.search(r'\d|[一二两三四五六七八九十]', m.group(0))]


def digit_blocks(text):
    """只要带阿拉伯数字的块（切词时整块保护用）。"""
    return [(a, b) for a, b in blocks(text) if re.search(r'\d', text[a:b])]


def splits(spans, k):
    """在第 k 个字前面断开，会不会把一个块切成两半。"""
    return any(a < k < b for a, b in spans)


def block_at(text, pos):
    """第 pos 个字所在的块：(起, 止)；不在块里返回 None。"""
    for a, b in blocks(text):
        if a <= pos < b: return a, b
    return None


def whole_ok(text, w, at=None):
    """词 w（从第 at 个字起，不给就取第一次出现）有没有只盖住半个数块：盖住半块返回 False。
    整块、块外、把整块连同别的字一起盖住，都算行。"""
    if not w: return True
    p = text.find(w) if at is None else at
    if p < 0: return True
    e = p + len(w)
    return not any(a < e and p < b and not (p <= a and b <= e) for a, b in blocks(text))


def plain_at(text, pos):
    """数字大字只照抄简单的块：从第 pos 个字起、整块就是「数 + 单位」，数只有数字和一个小数点，单位在名单里。
    返回 (数的原文, 单位原文)；带负号、范围、分数、钟点、日期、约数（3000多万）、没单位的，一律返回 None（抄不准就不画）。"""
    if '数块' not in FIXES: return None
    bk = block_at(text, pos)
    if not bk or bk[0] != pos: return None
    m = PLAIN.fullmatch(text[bk[0]:bk[1]])
    return (m.group(1), m.group(2)) if m else None


NEG_PRE = re.compile(r'负(?:增长|的|值|数|收益率?|回报率?|利率)(?:了|是|为|约|达)?$')   # 11-10 总控改判：数前面紧挨着这些，单拿这个数就成了正的（负增长3% → 3%）


def neg_before(text, a):
    """第 a 个字起的数，前面紧挨着「负增长、负的」这类：返回这几个字有多长；没有返回 0。"""
    if a is None or a < 0 or '数块' not in FIXES: return 0
    m = NEG_PRE.search(text[:a])
    return len(m.group(0)) if m else 0


QUAL_PRE = re.compile(r'(?:超过|将近|(?<![最附亲接靠])近|(?<![合预节契签公条制隐])约|至少|不到|不足)$')   # 11-10 总控第三节第 5 条：紧贴数前面的限定词
QUAL_POST = re.compile(r'^(?:左右|以上|以下)')                 # 紧跟数后面的


def qual_after(text, e):
    """第 e 个字起紧跟着「左右、以上、以下」：返回这几个字有多长；没有、或数块开关关着返回 0。"""
    m = QUAL_POST.match(text[e:]) if '数块' in FIXES and e is not None and e >= 0 else None
    return len(m.group(0)) if m else 0


def qual_ok(text, w, at=None):
    """11-10 合并盲审：词 w（从第 at 个字起，不给就取第一次出现）从一个数块的头截起、前面紧贴着限定词（超过、不到……），
    或者截到数块的尾、后面紧跟着「左右、以上、以下」：限定词丢了，返回 False。中转那头 block_ok 有一模一样的判法。"""
    if not w or '数块' not in FIXES: return True
    p = text.find(w) if at is None else at
    if p < 0: return True
    e = p + len(w)
    return not any(p <= a < b <= e and ((a == p and QUAL_PRE.search(text[:p])) or (b == e and QUAL_POST.match(text[e:]))) for a, b in blocks(text))


def with_neg(text, w):
    """上屏词是个数、前面紧挨着「负增长」这类：连着它一起上屏（「负增长3%」），不单拿「3%」。
    11-10 第三节：紧贴的限定词（超过、不到、左右、以上……）也连着一起上屏（「不到3%」「40%左右」）。"""
    p = text.find(w); k = neg_before(text, p)
    if '数块' in FIXES and p >= 0 and not k:
        m = QUAL_PRE.search(text[:p]); k = len(m.group(0)) if m else 0
    e = p + len(w) + (qual_after(text, p + len(w)) if p >= 0 else 0)
    return text[p - k:e] if p >= 0 and (k or e > p + len(w)) else w


def plain_range(text, a, sep_at, b_end):
    """范围「1.5到2.5倍」「4%到6%」：整块从 a 起、到 b_end 止，中间一个连接词。返回 (前半原文, 后半原文) 或 None。"""
    if '数块' not in FIXES: return None
    bk = block_at(text, a)
    if not bk or bk != (a, b_end): return None
    lo, hi = text[a:sep_at], text[sep_at + 1:b_end]
    okl = re.fullmatch(r'\d+(?:\.\d+)?', lo) or PLAIN.fullmatch(lo)
    mh = PLAIN.fullmatch(hi)
    if okl and mh and okl.re is PLAIN and not mh.group(2).startswith(okl.group(2)): return None   # 11-10：两头单位对不上（「3000万到2025年」）不当范围
    return (lo, hi) if okl and mh else None
