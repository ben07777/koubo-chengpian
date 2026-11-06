# 看内容定画面：把逐字听写变成「分镜计划」（plan）。
# 不联网、不用钥匙：靠中文口播里的常见信号判断画面——
#   数字 → 滚数；A 到 B → 区间条；第一第二第三 → 清单卡；很多人以为…其实 → 误区卡；
#   以前…现在 / 不是…而是 / A，B 却… → 对比两栏；不是A，就是B（分两句说）→ 划掉改写；
#   两件事：A 和 B → 圆章；因为 A / 所以 B → 因果箭头；2019 年 … 2023 年 → 年份时间线；
#   问句 → 问号；其余 → 大字逐字跳（三种版式轮换）。
import math
import re
from difflib import SequenceMatcher

def nice_max(hi):
    """区间条顶格取个整数：刻度是 0/¼/½/¾/1，所以顶格要能被 4 整除出像样的数。
    原来直接用 hi*1.25，90 天会得到顶格 113，刻度排出来是 0 28 56 84 113，没人这么标。"""
    t = hi * 1.25
    if t <= 0:
        return 1
    e = 10 ** math.floor(math.log10(t / 4))
    for f in (1, 2, 2.5, 3, 4, 5, 10):
        step = f * e
        if step * 4 >= t:
            return round(step * 4, 2) if step * 4 < 1 else int(round(step * 4))
    return int(round(t))


CN_NUM = {'零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}
UNIT = r'(%|万|亿|倍|次|元|块|岁|年|个月|月|天|周|小时|分钟|秒|斤|公斤|米|度|台|人|家|篇|条|本|口|杯|步|分)'
NUM_RE = re.compile(r'(\d+(?:\.\d+)?)\s*' + UNIT + '?')
RANGE_RE = re.compile(r'(\d+(?:\.\d+)?)\s*' + UNIT + r'?\s*(?:到|至|~|－|-|—)\s*(\d+(?:\.\d+)?)\s*' + UNIT)
ENUM_RE = re.compile(r'^(第[一二三四五六七八九十\d]+[个点条步]?|首先|其次|再次|最后一?[个点条]?|一是|二是|三是|四是|另外|还有一个(就是)?|再一个(就是)?)[，,、：:。\s]*')
COUNT_RE = re.compile(r'([两二三四五六七八九十\d])\s*(件事|个习惯|个原因|个方法|个步骤|个技巧|个坑|个误区|个问题|个建议|个办法|个关键|个细节|招|点|种|步)')
MYTH_RE = re.compile(r'((很多|好多|不少|大多数|有些|有的)(人|妈妈|家长|朋友|老板|同学|女生|男生)(都)?(觉得|以为|认为|说|会)|大部分人(都)?(觉得|以为)|大家(都)?(觉得|以为|说)|你(是不是|可能|一定)?(也)?(以为|觉得)|总有人说|网上(都)?说|老一辈(都)?说)')
FACT_RE = re.compile(r'^(其实|但是|但|可是|然而|事实上|真相是|实际上|恰恰相反)[，,\s]*')
OLD_RE = re.compile(r'^(以前|过去|原来|从前|之前|早年)(的)?')
NEW_RE = re.compile(r'^(现在|如今|而现在|而如今|后来|今天)(的)?')
NOTBUT_RE = re.compile(r'不是(.{2,14}?)[，,]?而是(.{2,14})')
FLIP_A = re.compile(r'^(.{0,8}?)不是(.{1,5})$')                  # 「很多公司不是亏死的」；被划掉的超过 5 个字一行放不下
FLIP_B = re.compile(r'^(而是|就是|反而是|只是|是)(.{2,11})$')       # 「就是被这个东西拖垮的」
EITHER_RE = re.compile(r'(天天|每天|总是|老是|整天|成天|一天到晚|要么|平时|经常)')  # 「天天不是喝酒 / 就是打牌」是二选一，不是改正
BUT_RE = re.compile(r'.{1,6}(?<![冷忘推了退])却.{1,6}')            # 「手里却没钱」；冷却、忘却这类不算
YEAR_RE = re.compile(r'((?:19|20)\d{2})\s*年(?![代级纪报度终初底末]|中报|中期)')   # 「2019年」；「90年代」「2024年报」「年度」「年终奖」「年底」不算
CN_YEAR_RE = re.compile(r'([一二][零〇一二三四五六七八九]{3})年')       # 听写偶尔写成「二零一九年」
CN_DIGIT = dict(zip('零〇一二三四五六七八九', '00123456789'))
CAUSE_ONE = re.compile(r'^(.{0,4}?)(因为|由于)(.{2,10}?)[，,]?(所以|因此|于是)(.{2,10})$')   # 一句话说完：因为便宜，所以卖得快
CAUSE_A = re.compile(r'^(.{0,4}?)(因为|由于)(.{3,13})$')                                   # 分两句说：因为它要等客户付款
CAUSE_B = re.compile(r'^(所以|因此|于是|结果(?!出来|出|显示|是|怎么|呢)|这就导致|导致)(.{3,13})$')   # 「结果出来以后再说」的结果是名词                     #           所以账上没钱
def dur_before(s, i):   # 「有2000年的历史」「近2000年」「过去2000年」是时长；「熬过了2008年」「到了2023年」是时间点
    return s[i - 1:i] in ('有', '近', '约') or s[max(0, i - 2):i] == '过去'
CAUSE_BAD = ('说', '呢', '啊', '吧', '嘛', '呀', '的话')   # 「所以说啊」是口头禅，不是结果
CAUSE_CHAT = re.compile(r'(问我|私信|留言|催更|今天.{0,4}(聊|讲|说|出一期)|长话短说|下期再|篇幅|时间(有限|关系))')   # 开场、收尾的套话
def cause_weak(b):   # 结果半句只是「你看啊」「我觉得吧」「接下来我讲讲」这类过渡话，不画箭头；「所以公司倒了啊」照画
    b = re.sub('[啊吧呢嘛呀]+$', '', str(b))
    return len(b) < 2 or re.fullmatch('(你看|我觉得|我跟你说|就是说|也就是说)', b) is not None or re.match('(接下来|下面|那|今天)?(我们|我)?(就|来)?(讲讲|讲一讲|说说|说一说|聊聊|聊一聊|给大家讲|跟大家聊|跟大家说)', b) is not None
Q_RE = re.compile(r'([?？]$|为什么|为啥|怎么办|怎么|是不是|能不能|要不要|吗$|呢$|多少)')
CTA_RE = re.compile(r'(今天就|现在就|赶紧|记得|试试|去做|去试|收藏|下次|马上)')
FILLER = re.compile(r'^(所以|那么|然后|而且|并且|另外|还有|就是|其实|好|那|嗯|呃|啊)[，,。\s]*')
SOFT = re.compile(r'^(一般来说|总的来说|简单来说|说白了|换句话说|总之|所以|那么|好)$')
BAD_RE = re.compile(r'(伤|坏|怕|受累|掉|跌|亏|损|危险|风险|坑|错|别|不要|千万|最怕|发烫|贵|难|慢|少)')

# 关键词 → 图标（Lucide，ISC 许可）。顺序就是优先级。
ICONS = [
    ('满电|充满|电满', 'battery-full'), ('没电|低电|电量低', 'battery-low'), ('设置|打开|开关', 'settings'), ('电池|充电|电量|充放电', 'battery-charging'),
    ('高温|发烫|太热|过热|烫', 'flame'), ('游戏', 'gamepad-2'), ('手机|App|APP|微信|抖音', 'smartphone'),
    ('房东|租房|房子|房产|买房', 'house'), ('合同|签字|签约|协议', 'file-pen-line'),
    ('身份证|证件', 'id-card'), ('中介|老板|医生|老师|朋友', 'user'), ('很多人|大家|用户|客户|年轻人', 'users'),
    ('钱|工资|收入|存款|价格|便宜|贵|元|块|成本|定金', 'wallet'), ('涨|增长|提高|翻倍|更长|变多', 'trending-up'),
    ('跌|下降|减少|掉到|变少|缩水', 'trending-down'), ('时间|小时|分钟|每天|熬夜|早上|晚上', 'clock'),
    ('睡|失眠', 'moon'), ('吃|饭|早餐|喝', 'utensils'), ('咖啡', 'coffee'), ('学习|读书|书|课', 'book-open'),
    ('考试|毕业|学校', 'graduation-cap'), ('工作|上班|职场|公司|面试', 'briefcase'), ('健康|身体|心脏|血压', 'heart-pulse'),
    ('安全|保护|靠谱|放心', 'shield-check'), ('目标|计划|方向', 'target'), ('方法|技巧|习惯|办法|窍门|建议', 'lightbulb'),
    ('脑|思考|记忆|大脑', 'brain'), ('数据|比例|区间|百分', 'chart-column'), ('AI|人工智能|模型|智能', 'sparkles'),
    ('买|购物|下单|网购', 'shopping-cart'), ('车|开车|油', 'car'), ('旅行|出差|飞机', 'plane'),
    ('问题|为什么|怎么|吗', 'circle-question-mark'), ('坑|危险|风险|千万|最伤|最怕|跑路|小心', 'triangle-alert'),
    ('记住|一定要|正确|对得上', 'circle-check'), ('误区|错|老黄历|没用', 'circle-x'), ('快|立刻|马上|效率', 'zap'),
]


def icon_for(text, default=None):
    for pat, name in ICONS:
        if re.search(pat, text):
            return name
    return default


def normalize_text(s):
    s = CN_YEAR_RE.sub(lambda m: (lambda d: d + '年' if d[:2] in ('19', '20') else m.group(0))(''.join(CN_DIGIT[c] for c in m.group(1))), s)
    s = s.replace('百分之百', '100%')
    s = re.sub(r'百分之([一二三四五六七八九十]+)', lambda m: f'{cn2num(m.group(1))}%', s)
    return s


def cn2num(s):
    if s == '十': return 10
    if '十' in s:
        a, _, b = s.partition('十')
        return (CN_NUM.get(a, 1) if a else 1) * 10 + (CN_NUM.get(b, 0) if b else 0)
    return CN_NUM.get(s, 0)


def count_of(s):
    m = COUNT_RE.search(s)
    if not m: return 0
    d = m.group(1)
    return int(d) if d.isdigit() else CN_NUM.get(d, 0)


# ---------- 听写结果 → 字幕行 ----------
def norm_chars(chars):
    """「百分之百」「百分之二十」这类没被写成数字的，合成一个「100%」字块，时间取首尾。"""
    s = ''.join(c['c'] for c in chars); out = []; i = 0
    for m in re.finditer(r'百分之([一二三四五六七八九十]+|百)', s):
        a, b = m.span()
        if a < i: continue
        out += chars[i:a]; v = 100 if m.group(1) == '百' else cn2num(m.group(1))
        out.append(dict(chars[a], c=f'{v}%', t1=chars[b - 1]['t1'], **({'p': chars[b - 1]['p']} if 'p' in chars[b - 1] else {}),
                        **({'brk': True} if chars[b - 1].get('brk') else {})))
        i = b
    return out + chars[i:]


def build_lines(chars):
    """按停顿和标点切行；句号问号叹号必断；每行最多 15 字，太长先从逗号断，再按词断，不把一个词劈成两半。"""
    chars = norm_chars(chars)
    lines, cur = [], []
    for ch in chars:
        cur.append(ch)
        if ch.get('brk') or (re.search('[。！？!?]', ch.get('p', '')) and len(cur) >= 2):
            lines.append(cur); cur = []
    if cur: lines.append(cur)

    def word_cut(ln):
        """离中间最近的词边界（只在 4 到 15 字之间找）。"""
        import jieba
        text = ''.join(c['c'] for c in ln); pos, at, best = [], 0, None
        for w in jieba.cut(text):
            at += len(w); pos.append(at)
        # 拼回字的下标：数字合成「20%」后一个元素可能是多字，按元素累加
        acc, bounds = 0, set()
        for i, c in enumerate(ln):
            acc += len(c['c'])
            if acc in pos: bounds.add(i + 1)
        for b in sorted(bounds, key=lambda b: abs(b - len(ln) / 2)):
            if 4 <= b <= 15 and len(ln) - b >= 2: best = b; break
        return best or min(len(ln) // 2 + 1, 15)

    def comma(ln):  # 超过 12 字、中间有逗号的，也从逗号断开，竖屏一行太长看着累
        return next((i + 1 for i in range(len(ln) - 3, 3, -1) if ln[i].get('p')), None) if len(ln) > 12 else None

    out = []
    for ln in lines:
        while len(ln) <= 15 and comma(ln):
            k = comma(ln); out.append(ln[:k]); ln = ln[k:]
        while len(ln) > 15:
            cut = next((i + 1 for i in range(min(len(ln), 15) - 1, 3, -1) if ln[i].get('p') and len(ln) - i - 1 >= 2), None) or word_cut(ln)
            out.append(ln[:cut]); ln = ln[cut:]
        if ln: out.append(ln)
    res = []
    for ln in out:
        text = ''.join(c['c'] for c in ln)
        res.append(dict(t0=ln[0]['t0'], t1=ln[-1]['t1'], cs=[[c['c'], c['t0'], c['t1']] for c in ln], text=text))
    return res


def apply_edits(lines, edited_texts):
    """用户在网页里改了字幕：逐行对齐原来的字，改了的字沿用原时间，新加的字按前后插值。"""
    out = []
    for ln, new in zip(lines, edited_texts):
        new = re.sub(r'\s+', '', new)
        old = [c[0] for c in ln['cs']]
        if new == ''.join(old):
            out.append(ln); continue
        if not new:
            continue
        sm = SequenceMatcher(None, old, list(new), autojunk=False)
        cs = []
        for op, a0, a1, b0, b1 in sm.get_opcodes():
            src = ln['cs'][a0:a1]
            if op == 'equal':
                cs += [list(c) for c in src]
            elif op in ('replace', 'insert'):
                t_start = src[0][1] if src else (cs[-1][2] if cs else ln['t0'])
                t_end = src[-1][2] if src else (ln['cs'][a0][1] if a0 < len(ln['cs']) else ln['t1'])
                n = b1 - b0; step = max(0.04, (t_end - t_start) / max(n, 1))
                for k in range(n):
                    a = t_start + k * step
                    cs.append([new[b0 + k], round(a, 3), round(a + step, 3)])
        out.append(dict(t0=cs[0][1], t1=cs[-1][2], cs=cs, text=new))
    return out + lines[len(edited_texts):]


def clean(s):
    s = re.sub(r'[，。！？、；：,.!?;:]+$', '', s)
    return s.strip('，。！？、；：,.!?;: ')


def strip_fact(s):
    prev = None
    while prev != s:
        prev = s; s = FACT_RE.sub('', s)
    return clean(s)


def strip_filler(s):
    prev = None
    while prev != s:
        prev = s; s = FILLER.sub('', s)
    return s


def find_kw(text):
    """一行里最值得高亮的词：数字优先，其次图标词，再次 jieba 关键词。"""
    m = NUM_RE.search(text)
    if m and (m.group(2) or len(m.group(1)) >= 2):
        return m.group(0).strip()
    try:
        import jieba.analyse
        tags = jieba.analyse.extract_tags(text, topK=2, allowPOS=('n', 'nz', 'vn', 'v', 'a', 'an', 'i', 'l'))
        tags = [t for t in tags if len(t) >= 2 and t in text]
        if tags: return tags[0]
    except Exception:
        pass
    return ''


# ---------- 分镜 ----------
def plan(lines, dur, title=None, theme='night', tag=None):
    for ln in lines:
        ln['text'] = normalize_text(ln['text'])
    T = [clean(ln['text']) for ln in lines]
    n = len(lines); scenes = []; i = 0

    def is_cue(k):
        s = T[k]
        return bool(ENUM_RE.match(s) or NUM_RE.search(s) and re.search(r'\d', s) or MYTH_RE.search(s) or OLD_RE.match(s)
                    or NOTBUT_RE.search(s) or COUNT_RE.search(s) or SOFT.match(s) or s.endswith(('？', '?')))

    def add(typ, a, b, **kw):
        scenes.append(dict(type=typ, la=a, lb=b, **kw))

    # 开场：头一两行做大字标题，说完飞到顶上
    hook_end = 0
    if n:
        hook_end = 1 if len(T[0]) >= 9 or n == 1 else 2
        hook_end = min(hook_end, n)
        if hook_end == 2 and is_cue(1) and not NUM_RE.search(T[0]): hook_end = 1
        # 第一句太长被拆成两行、中间没停顿：两行一起当标题，免得只截半句
        if hook_end == 1 and n > 1 and len(T[0]) + len(T[1]) <= 22 and lines[1]['t0'] - lines[0]['t1'] < 0.3 and not is_cue(1):
            hook_end = 2
    head_lines = [strip_filler(T[k]) for k in range(hook_end)]
    if title:
        tl = [x for x in title if x.strip()][:2]
    else:
        tl = split_title(''.join(head_lines) if len(head_lines) == 1 else head_lines)
    def flip_at(k):
        m = FLIP_A.match(T[k]) if k + 1 < n else None   # 问句（「你是不是很累」）不算，两句里哪句是问句都不算
        mb = FLIP_B.match(T[k + 1]) if m else None
        if not (m and mb) or m.group(2) in ('吧', '啊', '呀', '的', '了', '吗', '嘛', '呢') or NOTBUT_RE.search(T[k]):
            return False
        if Q_RE.search(T[k]) or Q_RE.search(T[k + 1]) or T[k + 1].startswith(('是吧', '是啊', '是的', '是否')):
            return False
        # 「就是」也常当二选一用：前句有「天天 / 总是」，或者后半句不比前半句长（「喝酒 / 打牌」），就不当改正
        if mb.group(1) == '就是' and (EITHER_RE.search(T[k]) or len(mb.group(2)) <= len(m.group(2))):
            return False
        return True

    def but_at(k):  # 「账上写着赚钱 / 手里却没钱」：前一句摆现象，后一句带「却」
        return (k + 1 < n and BUT_RE.fullmatch(T[k + 1]) is not None and 3 <= len(T[k]) <= 14
                and '却' not in T[k] and not NUM_RE.search(T[k] + T[k + 1]) and not MYTH_RE.search(T[k]))

    def cause_at(k):  # 「因为它要等客户付款 / 所以账上没钱」→ (A, B, A 起点, B 起点, 连接词, 结束行)
        s = T[k]
        if Q_RE.search(s) or re.search(r'\d', s) or MYTH_RE.search(s) or CAUSE_CHAT.search(s + (T[k + 1] if k + 1 < n else '')):
            return None
        m = CAUSE_ONE.match(s)
        if m and not m.group(5).startswith(CAUSE_BAD) and len(clean(m.group(3))) >= 2 and not cause_weak(m.group(5)):
            return clean(m.group(3)), clean(m.group(5)), char_time(lines, k, m.group(3)), char_time(lines, k, m.group(4)), m.group(2), m.group(4), k + 1
        if k + 1 < n:
            ma, mb = CAUSE_A.match(s), CAUSE_B.match(T[k + 1])
            if ma and mb and not Q_RE.search(T[k + 1]) and not re.search(r'\d', T[k + 1]) and not mb.group(2).startswith(CAUSE_BAD) and not cause_weak(mb.group(2)):
                return clean(ma.group(3)), clean(mb.group(2)), char_time(lines, k, ma.group(3)), lines[k + 1]['t0'], ma.group(2), mb.group(1), k + 2
        return None

    def try_years(i):  # 「2019年我开始做自媒体 / 到了2023年……」→ 一到三个年份节点
        if not any(not dur_before(T[i], m.start()) for m in YEAR_RE.finditer(T[i])):
            return None
        nodes, k = [], i
        while k < n and len(nodes) < 3:
            ms = [m for m in YEAR_RE.finditer(T[k]) if not dur_before(T[k], m.start())]
            if not ms or (nodes and ms[0].group(1) == nodes[-1]['year']):
                break
            end = k + 1
            for q, m in enumerate(ms[:3 - len(nodes)]):
                seg = T[k][m.end():ms[q + 1].start()] if q + 1 < len(ms) else T[k][m.end():]
                txt = clean(re.sub(r'^(的时候|那年|时|的|到|至|开始|说起|以来|以后|之后|起|，|,)+', '', seg))
                if len(txt) < 2 and q == 0 and len(ms) == 1:
                    txt = clean(re.sub(r'^(在|到了|从|是|早在|直到|等到)', '', strip_filler(T[k][:m.start()])))
                if len(txt) < 2 and q == len(ms) - 1 and end < n and not is_cue(end) and not YEAR_RE.search(T[end]) and len(T[end]) <= 12:
                    txt = T[end]; end += 1
                if (len(txt) < 2 and len(ms) == 1) or re.search('[从到在得]$', txt):   # 「这事得从 2008 年说起」：剩下的字说不成一句，不做这个节点；「从2008年到2015年」前一个年份不配字也留着
                    continue
                nodes.append(dict(year=m.group(1), text=txt[:12], t=char_time(lines, k, m.group(1), after=m.start())))
            if not nodes: return None
            k = end
        return (k, nodes) if nodes and k > i else None

    m0 = MYTH_RE.search(T[0]) if n >= 2 else None
    m0 = m0 if m0 and re.search('(以为|觉得|认为)$', m0.group(0)) else None
    jf = next((k for k in range(1, min(4, n)) if FACT_RE.match(T[k])), None) if m0 else None
    rest0 = clean(MYTH_RE.split(T[0])[-1]) if jf else ''
    if jf and len(rest0) >= 4:
        if not title and len(clean(m0.group(0))) <= 12 and len(rest0) <= 12:
            tl = [clean(m0.group(0)), rest0]          # 软件自己起的标题：「很多人以为 / 合同一签钱就到手了」，不吃「其实不是」那行
        fact = strip_fact(T[jf]) or T[jf]
        add('myth', 0, jf + 1, label=clean(MYTH_RE.search(T[0]).group(0)), myth=rest0, mythT=lines[0]['t0'],
            fact=fact, factFull=T[jf] if len(fact) <= 3 else '', factT=lines[jf]['t0'], icon=icon_for(''.join(T[:jf + 1]), 'sparkles'),
            mythCut=b_cut(rest0))
        i = jf + 1
    else:
        add('hook', 0, hook_end, icon=icon_for(''.join(T[:hook_end]), 'sparkles'))
        i = hook_end

    while i < n:
        s = T[i]
        # 软开头（「所以」「一般来说」）并进下一个镜头
        lead = i
        if SOFT.match(s) and i + 1 < n:
            i += 1; s = T[i]
        # 两件事：A 和 B（可能分在两三行）
        pair = try_pair(T, i)
        if pair:
            j, title_txt, items = pair
            add('pair', lead, j + 1, title=title_txt, items=[dict(text=it, t=char_time(lines, j, it), icon=icon_for(it)) for it in items])
            i = j + 1; continue
        # 清单：记住三个习惯 + 第一第二第三
        lst = try_list(T, i)
        if lst:
            j, title_txt, items = lst
            add('list', lead, j, title=title_txt,
                items=[dict(head=h, t=lines[k]['t0'], icon=icon_for(h + T[min(k + 1, n - 1)], None)) for k, h in items])
            i = j; continue
        # 误区：很多人以为 … 其实 …
        if MYTH_RE.search(s):
            j = next((k for k in range(i + 1, min(i + 5, n)) if FACT_RE.match(T[k])), None)
            if j:
                rest = clean(MYTH_RE.split(s)[-1])
                myth_k = i if len(rest) >= 4 else i + 1
                myth = rest if len(rest) >= 4 else T[i + 1]
                fact = strip_fact(T[j]) or T[j]
                add('myth', lead, j + 1, label=clean(MYTH_RE.search(s).group(0)), myth=myth, mythT=lines[myth_k]['t0'],
                    fact=fact, factFull=T[j] if len(fact) <= 3 else '', factT=lines[j]['t0'])
                i = j + 1; continue
        # 对比：以前 … 现在 …
        if OLD_RE.match(s):
            j = next((k for k in range(i + 1, min(i + 4, n)) if NEW_RE.match(T[k])), None)
            if j:
                L = dict(label=OLD_RE.match(s).group(1), text=clean(OLD_RE.sub('', s)), t=lines[i]['t0'])
                rt = clean(NEW_RE.sub('', T[j])); end = j + 1
                if end < n and not is_cue(end) and len(rt) + len(T[end]) <= 22:
                    rt = rt + '\n' + T[end]; end += 1
                R = dict(label=NEW_RE.match(T[j]).group(1), text=rt, t=lines[j]['t0'])
                add('compare', lead, end, L=L, R=R)
                i = end; continue
        if flip_at(i):
            ma, mb = FLIP_A.match(s), FLIP_B.match(T[i + 1])
            add('flip', lead, i + 2, head=clean(ma.group(1)) + '不是', A=clean(ma.group(2)), tA=char_time(lines, i, ma.group(2)),
                bLabel=mb.group(1), B=clean(mb.group(2)), tB=lines[i + 1]['t0'], kw=find_kw(mb.group(2)))
            scenes[-1]['Bcut'] = b_cut(scenes[-1]['B'], scenes[-1]['kw'])
            i += 2; continue
        if but_at(i):
            add('compare', lead, i + 2, L=dict(label='看上去', text=clean(strip_filler(s)), t=lines[i]['t0']),
                R=dict(label='实际上', text=clean(T[i + 1]), t=lines[i + 1]['t0']))
            i += 2; continue
        m = NOTBUT_RE.search(s)
        if m:
            add('compare', lead, i + 1, L=dict(label='不是', text=clean(m.group(1)), t=lines[i]['t0'], icon='circle-x'),
                R=dict(label='而是', text=clean(m.group(2)), t=char_time(lines, i, '而是'), icon='circle-check'))
            i += 1; continue
        # 年份：2019 年 … 2023 年（年份不滚数，也不当区间）
        yr = try_years(i)
        if yr:
            j, nodes = yr
            add('year', lead, j, nodes=nodes)
            i = j; continue
        # 因果：因为 A，所以 B
        ca = cause_at(i)
        if ca:
            A, B, tA, tB, la_, lb_, j = ca
            add('cause', lead, j, A=A, B=B, tA=tA, tB=tB, aLabel=la_, bLabel=lb_, kw=find_kw(B), icon=icon_for(A + B))
            scenes[-1]['Bcut'] = b_cut(B, scenes[-1]['kw']); scenes[-1]['Acut'] = b_cut(A)
            i = j; continue
        # 区间：20% 到 80%
        m = RANGE_RE.search(s)
        if m and (m.group(2) or m.group(4)):
            unit = m.group(4) or m.group(2) or ''
            lo, hi = float(m.group(1)), float(m.group(3))
            add('range', lead, i + 1, label=clean(strip_filler(s[:m.start()])).rstrip('是在为'), lo=lo, hi=hi, unit=unit,
                tLo=char_time(lines, i, m.group(1)), tHi=char_time(lines, i, m.group(3), after=m.start(3)),
                max=100 if unit == '%' else nice_max(hi))
            i += 1; continue
        # 数字：滚数（下一行还有数字就做成 A → B）
        m = num_in(s)
        if m:
            v, unit, pos = m
            label = clean(strip_filler(s[:pos])) or ''
            after = clean(s[pos + len(fmt(v)) + len(unit):])
            sub = [after] if after and after not in ('左右', '以上') else []
            subT = [char_time(lines, i, after)] if sub else []
            j = i + 1; second = None
            while j < n and j < i + 3 and not ENUM_RE.match(T[j]) and not MYTH_RE.search(T[j]) and not SOFT.match(T[j]):
                m2 = num_in(T[j])
                if m2 and second is None and len(sub) == 0:
                    v2, u2, p2 = m2
                    second = dict(value=v2, unit=u2, label=clean(strip_filler(T[j][:p2])), t=char_time(lines, j, fmt(v2)))
                    j += 1; continue
                if m2 or second or COUNT_RE.search(T[j]) or len(sub) >= 1 or len(T[j]) > 9: break
                sub.append(T[j]); subT.append(lines[j]['t0']); j += 1
            if not unit and v >= 10 and re.search(r'(价格|便宜|贵|工资|收入|房租|花了|赚了?|省了|月薪|年薪)$', s[max(0, pos - 6):pos]) and not re.match(r'[\d.,]+\s*[单个人件次点名位台条家只份]', s[pos:]): unit = '元'   # 钱字紧挨着这个数才补「元」（盲审：「下个月10号发工资」补成 10元）
            tone = 'bad' if BAD_RE.search(s + ''.join(sub) + (second['label'] if second else '')) else 'acc'
            add('stat', lead, j, label=label, value=v, unit=unit, t=char_time(lines, i, fmt(v)), sub=sub, subT=subT, second=second, tone=tone,
                icon=icon_for(s + ''.join(sub)))
            i = j; continue
        # 问句
        if Q_RE.search(s) and len(s) >= 4:
            add('question', lead, i + 1)
            i += 1; continue
        # 其余：大字逐字跳，最多 3 行一组
        j = i + 1
        while j < n and j < i + 3 and not is_cue(j) and not flip_at(j) and not but_at(j) and not cause_at(j) and lines[j]['t1'] - lines[i]['t0'] < 6.5                 and not (CTA_RE.search(T[j]) and j >= n - 3):
            j += 1
        add('say', lead, j, icon=icon_for(''.join(T[i:j])))
        i = j

    # 最后一组如果是号召（今天就去 / 记得 / 收藏）→ 收尾印章
    last = scenes[-1]
    if last['type'] == 'say' and (CTA_RE.search(''.join(T[last['la']:last['lb']])) or len(scenes) > 3):
        last['type'] = 'cta'

    # 时间：镜头从第一句话前 0.15 秒开始，到下一个镜头开始为止
    for k, sc in enumerate(scenes):
        sc['t0'] = 0.0 if k == 0 else max(scenes[k - 1]['t0'] + 0.8, lines[sc['la']]['t0'] - 0.15)
    for k, sc in enumerate(scenes):
        sc['t1'] = scenes[k + 1]['t0'] if k + 1 < len(scenes) else dur
    for ln in lines:
        ln['kw'] = find_kw(ln['text'])

    if not tag:
        lst = next((s for s in scenes if s['type'] in ('list', 'pair')), None)
        tag = ((lst.get('title') or f"{len(lst['items'])} 个要点") if lst and lst['type'] == 'list' else '一分钟讲清楚' if dur <= 65 else '讲清楚')  # 角标和封面小字用同一句
    kw2 = find_kw(''.join(tl))
    cover = dict(title=[mark(x, kw2) for x in tl], kicker=next((s['title'] for s in scenes if s['type'] == 'list' and s.get('title')), tag),
                 icon=scenes[0]['icon'])
    for sc in scenes:   # 对比卡两边的长句：给拆两行的词边界
        if sc['type'] == 'myth' and not sc.get('mythCut'):   # 中段误区卡（开场那张在上面已给）
            sc['mythCut'] = b_cut(sc['myth'])
        if sc['type'] == 'list':
            for it in sc['items']: it['cut'] = b_cut(it['head'])
        if sc['type'] == 'compare':
            for side in (sc['L'], sc['R']):
                side['cut'] = b_cut(side['text'])

    return dict(dur=round(dur, 3), theme=theme, tag=tag, title=[mark(x, kw2) for x in tl], cover=cover,
                lines=[dict(t0=l['t0'], t1=l['t1'], cs=l['cs'], kw=l['kw']) for l in lines], scenes=scenes)


def mark(s, kw):
    return s.replace(kw, f'[[{kw}]]', 1) if kw and kw in s and len(kw) < len(s) else s


def b_cut(s, kw=None):
    """结果句太长要拆两行时的拆点：词边界里离中间最近的，平局取前一行长的，不切开关键词；拆不了返回 None。"""
    s = str(s); n = len(s)
    if n < 6 or '\n' in s: return None
    ki = s.find(kw) if kw else -1
    try:
        import jieba
        bounds, at = [], 0
        for w in jieba.cut(s):
            at += len(w); bounds.append(at)
    except Exception:
        bounds = list(range(1, n))
    ok = [b for b in bounds if 2 <= b <= n - 2 and not (ki >= 0 and ki < b < ki + len(kw))]
    return min(ok, key=lambda b: (abs(b - n / 2), -b)) if ok else None


def split_title(head):
    if isinstance(head, list):
        parts = [p for p in head if p]
        if len(parts) == 2 and all(len(p) <= 12 for p in parts): return parts
        head = ''.join(parts)
    head = clean(head)
    if len(head) <= 9: return [head]
    for sep in '，,：:':
        if sep in head:
            a, b = head.split(sep, 1)
            if 2 <= len(a) <= 12 and len(b) <= 13: return [a, clean(b)]
    k = (len(head) + 1) // 2
    try:
        import jieba
        bounds, at = [], 0
        for w in jieba.cut(head):
            at += len(w); bounds.append(at)
        ok = [b for b in bounds if 3 <= b <= len(head) - 3 and b <= 12 and len(head) - b <= 13]
        if ok: k = min(ok, key=lambda b: abs(b - len(head) / 2))
    except Exception:
        pass
    return [head[:k], head[k:]]


def fmt(v):
    return str(int(v)) if float(v).is_integer() else str(v)


def num_in(s):
    for m in NUM_RE.finditer(s):
        v = float(m.group(1)); unit = m.group(2) or ''
        nx, pv = s[m.end():m.end() + 1], s[m.start() - 1:m.start()]
        if unit == '年' and nx in ('代', '级', '报', '度', '终', '初', '底', '末'):   # 「90年代」「三年级」「2024年报」不是数
            continue
        if unit == '年' and 1900 <= v <= 2100 and not dur_before(s, m.start()):   # 「还到2030年」是年份，不是 2030 个年
            continue
        if not unit and nx in ('号', '点', '后', '日'):   # 「10号」「11点」「90后」
            continue
        if unit == '月' or (unit in ('年', '个月', '天', '周') and nx in ('前', '后')):   # 「3月」是日子，「5年前」是时间点
            continue
        if pv == '双' or (pv.isascii() and pv.isalpha()):   # 「双11」「iPhone15」是名字
            continue
        p2 = s[max(0, m.start() - 2):m.start()]
        if pv == '第' or (not unit and pv == ' ' and p2[:1].isascii() and p2[:1].isalpha()) or (not unit and p2 in ('小米', '红米', '苹果', '华为', '荣耀', '三星', '一加', '魅族')):   # 「第10名」「iPhone 15」「小米14」；「ROE 15%」「苹果15块」带单位的照常
            continue
        if not unit and v in (315, 520, 618, 996, 1111, 12315) and not re.search('(花了|工资|收入|价格|房租|赚了?|省了)$', s[max(0, m.start() - 4):m.start()]):   # 「618」「996」「12315」是节日、作息、热线；「花了520」是钱
            continue
        if unit or v >= 10:
            return v, unit, m.start()
    return None


def char_time(lines, k, word, after=0):
    text = ''.join(c[0] for c in lines[k]['cs'])
    p = text.find(word, after if after < len(text) else 0)
    if p < 0: p = text.find(word)
    if p < 0: return lines[k]['t0']
    pos = 0
    for c in lines[k]['cs']:            # 一个字块可能是好几个字（比如「100%」）
        if pos + len(c[0]) > p: return c[1]
        pos += len(c[0])
    return lines[k]['cs'][-1][1]


def try_pair(T, i):
    """「锂电池最怕的 / 是两件事 / 满电和高温」→ 标题 + 2–4 个短词。"""
    for a, b in ((i, i + 1), (i, i)):
        if b >= len(T): continue
        cnt = count_of(T[b])
        if not cnt or cnt > 4: continue
        k = b + 1
        if k >= len(T): continue
        rest = T[b].split('：')[-1] if '：' in T[b] else ''
        src = rest if rest and re.search('[和、与跟]', rest) else T[k]
        items = [clean(x) for x in re.split('[和、与跟,，]|还有', src) if clean(x)]
        if len(items) == cnt and all(1 <= len(x) <= 6 for x in items):
            title = clean(strip_filler(T[a] if a != b else COUNT_RE.split(T[b])[0])) if a != b else clean(T[b])
            return (k if src is T[k] else b), title, items
    return None


def try_list(T, i):
    """「记住三个习惯」后面跟着「第一…第二…」，或者直接从「第一」开始。"""
    n = len(T); title = ''; want = 0
    start = i
    if not ENUM_RE.match(T[i]):
        if count_of(T[i]) and i + 1 < n and ENUM_RE.match(T[i + 1]):
            title = clean(strip_filler(T[i])); start = i + 1; want = count_of(T[i])
        else:
            return None
    items = []; k = start
    while k < n:
        m = ENUM_RE.match(T[k])
        if m:
            head = clean(T[k][m.end():]); hk = k; k += 1
            if len(head) < 2 and k < n:
                head = T[k]; k += 1
            items.append((hk, head)); continue
        if not items: break
        nxt = next((j for j in range(k, min(k + 4, n)) if ENUM_RE.match(T[j])), None)
        if nxt is not None and (not want or len(items) < want):
            k = nxt; continue                      # 中间那几条：一直吃到下一个「第 X」
        # 最后一条的补充句：最多 3 行，碰到别的信号就停
        if k - items[-1][0] <= 3 and not (NUM_RE.search(T[k]) and re.search(r'\d', T[k])) and not SOFT.match(T[k])                 and not MYTH_RE.search(T[k]) and not COUNT_RE.search(T[k]) and not (k + 1 < n and COUNT_RE.search(T[k + 1])):
            k += 1; continue
        break
    if len(items) < 2: return None
    if not title: title = f'{len(items)} 个要点'
    return k, title, items
