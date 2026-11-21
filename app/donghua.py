# 动画（专业版，2026-11-14 立）：云端模型读懂稿子、按意思挑动画、填内容。这个文件是「挑什么、怎么查」的唯一一份：
#   · 给模型的提示（build_prompt）
#   · 模型回话怎么读（parse）
#   · 每一处动画合不合格（check / check_all）：填的每个字都必须是字幕里原样连着的字，数连同单位照抄，
#     一个数被断成两行的不用，两个数单位不一样的不比。认不准、填不满的整处不要，那几句照免费版的画法走。
# 云端（中转.py）叫完模型用它查一遍；软件（planner / xieshou）画之前再用它查一遍，以软件这头为准。
# 中转打包时把这个文件原样带上（中转/打包.py），两头是同一份，不会一头松一头紧。
# 只用 Python 自带的库（3.6 以上）。cut_ok / block_ok / num_blocks 三个判法由用它的那头传进来（中转.py 和 xieshou.py 各有一模一样的一份）。
import json, re

KINDS = ('比多少', '占多少', '几组对比', '亮出大数', '并排对照', '几个要点', '圈重点', '一步接一步', '因果', '前后变化', '时间先后', '转折', '一好一坏')
CIRCLE_MAX = 4          # 圈重点一条片最多几处（它哪句话都能配，多了就不值钱）
SIDE_MAX = 10           # 因果、前后变化每边最多几个字
MAX_SPAN = 5            # 一处动画最多盖连着的几句（提示里说 4，模型常给到 5，放它一句；排卡那头也是最多 5 句）
LAB_MAX = 8             # 名字最多几个字
POINT_MAX = 12          # 要点、步最多几个字（11-14 傍晚从 8 放到 12：真正要紧的条件、步骤常有九到十二个字，8 个字时整处被拦；长的画成横纸条、折两行）
TURN_MAX = 12           # 转折、一好一坏每边最多几个字
SAY_MAX = 12            # 并排对照里每边那半句最多几个字
WHAT_MAX = 12           # 「什么」最多几个字（超了、对不上原文就不写这行小字，数照画）

PROMPT = """你给口播短视频配动画。下面是一段口播的逐句字幕（编号 | 这句话），是语音识别的结果，可能有错字，一句话常被断成几行。
你要挑出「正好在说下面十三种意思之一」的地方。把整段话从头到尾过一遍，意思合得上的都挑出来，一条两三分钟的片通常有 8 到 14 处，前、中、后都要有，别只挑前半段；意思合不上的不挑，不许配错意思。

先找最值得配的：话锋一转的地方（转折）、好处和坏处对着说的地方（一好一坏）、因果、前后变化、带数的（比多少、占多少、几组对比、亮出大数）、有先后的步骤、时间先后。这些是一段话的筋骨。
并列的清单（几个要点）软件自己也会排，只挑真正要紧的：别人提的几个条件、一样东西的几个特点、结论里的几条。一句话里顺口带过的两个词不挑。

十三种动画，和各自要填的内容：
1. 比多少：两个同一类的数在比大小（这个是多少，那个是多少）。填：甲、甲数、乙、乙数。两个数的单位必须一样。一个是赚一个是亏的不算。
   例：「去年卖了3万台」「今年卖了8万台」→ {{"类型":"比多少","从":1,"到":2,"甲":"去年","甲数":"3万台","乙":"今年","乙数":"8万台"}}
2. 占多少：一个整体里占了百分之几、几成。填：什么（是什么占了这么多，不超过 12 个字，要填）、数。
   例：「来这家店的客人里有七成是回头客」→ {{"类型":"占多少","从":5,"到":5,"什么":"回头客","数":"七成"}}
3. 几组对比：三个到五个同一类的数摆在一起比。填：组（每组一个名、一个数），单位必须一样。
   例：{{"类型":"几组对比","从":7,"到":9,"组":[{{"名":"北京","数":"3万"}},{{"名":"上海","数":"2万"}},{{"名":"成都","数":"1万"}}]}}
4. 亮出大数：一个要紧的数，值得单独亮出来（很大、很小，或者出人意料）。填：什么（这个数说的是什么，不超过 12 个字，要填，不能填「这个数」这种话）、数（必须带单位，光一个数字不行）。年份、日期、钟点、年龄、第几名、几个人、「三年之后」这种说时候的都不算。
   例：「全国一共有2800万家小店」→ {{"类型":"亮出大数","从":3,"到":3,"什么":"小店","数":"2800万家"}}
5. 并排对照：两样东西、两种做法、两个时候对着说，而且两边有反差（以前和现在、用了和没用、这个和那个）。填：左、右（两边各叫什么，要是读得通的完整的词，不超过 8 个字，不要截在「的、是、把」这种字上），左说、右说（两边各自那半句里最要紧的几个字，每边不超过 12 个字，不能和名字一样；两边都要填，凑不齐就不挑这处）。两个并列的条件不算对照，那是「几个要点」；一件事引出另一件事也不算，那是「因果」。
   例：「以前要等很久」「现在一下就好」→ {{"类型":"并排对照","从":4,"到":5,"左":"以前","左说":"要等很久","右":"现在","右说":"一下就好"}}
6. 几个要点：一口气并列说出两样到四样东西、条件、特点。填：点（两到四个，每个是那一样里最要紧的几个字，不超过 12 个字，能短就短，不带「哎、啊、呢」这类语气词）。并列的几样要挑全，从第一样盖到最后一样，别漏掉最后一样；前面说了「三种」就得是三个。
   例：「这双鞋又轻」「又透气」「还不贵」→ {{"类型":"几个要点","从":6,"到":8,"点":["轻","透气","不贵"]}}
7. 一步接一步：有先后的两到四步（先怎样、再怎样、然后、最后）。填：步（两到四个，按先后，每个不超过 12 个字，能短就短）。
   例：「先把面和好」「再醒上半小时」「最后下锅煮」→ {{"类型":"一步接一步","从":2,"到":4,"步":["把面和好","醒上半小时","下锅煮"]}}
8. 因果：因为一件事，所以另一件事（因为、所以、导致、于是、结果）。填：因、果（各是那半句里最要紧的几个字，每边不超过 10 个字）。
   例：「因为下了一夜的雨」「所以路上特别堵」→ {{"类型":"因果","从":3,"到":4,"因":"下了一夜的雨","果":"路上特别堵"}}
9. 前后变化：同一样东西从一个样子变成另一个样子（原来、后来、变成、涨到、降到）。填：前、后（每边不超过 10 个字）。
   例：「这条街以前全是书店」「现在全变成了奶茶店」→ {{"类型":"前后变化","从":5,"到":6,"前":"全是书店","后":"全变成了奶茶店"}}
10. 时间先后：两到四个时候，每个时候发生了一件事（哪年、哪月、周几、上午下午）。填：时间点（每个有 时、事；时 不超过 8 个字，事 不超过 10 个字），按说的先后。
   例：「周一他交了申请」「周三就批下来了」→ {{"类型":"时间先后","从":1,"到":2,"时间点":[{{"时":"周一","事":"交了申请"}},{{"时":"周三","事":"批下来了"}}]}}
11. 转折：前面说一个意思，后面拿「但是、可是、然而、结果、没想到、反而」转到相反的、出人意料的意思（本以为怎样，结果怎样；嘴上怎样，做的怎样）。这是一段话里最要紧的地方，有就挑。填：前半、后半（各是那半句里最要紧的几个字，每边不超过 12 个字；前半在前，后半在转过来之后）。
   例：「大家都以为开店能赚钱」「结果一年下来还倒贴了房租」→ {{"类型":"转折","从":7,"到":8,"前半":"开店能赚钱","后半":"还倒贴了房租"}}
12. 一好一坏：一样东西、一种做法的好处和坏处对着说，或者哪种情况合适、哪种情况不合适。填：好、坏（各是那半句里最要紧的几个字，每边不超过 12 个字）。两边都是好处、或者都是坏处的不算，那是「几个要点」。
   例：「坐高铁是省时间」「就是票太难抢」→ {{"类型":"一好一坏","从":3,"到":4,"好":"省时间","坏":"票太难抢"}}
13. 圈重点：上面十二种都配不上，但这一句里有全片最要紧的一个词（核心的说法、结论里的关键词、出人意料的那个词）。填：词（两到八个字）。一条片最多挑 4 处，不要挑「我们、这个、时候」这种谁都会说的词，不要挑数。
   例：「说到底拼的还是耐心」→ {{"类型":"圈重点","从":9,"到":9,"词":"耐心"}}

规矩：
- 「从」「到」是这处动画盖住的句子编号（从第几句到第几句，最多连着 5 句；圈重点最多 2 句）；要填的内容都必须出自这几句。
- 所有填的字都必须是字幕里原样连着的字，一个字都不许改、不许加、不许换说法、不许跨行拼；字幕里的错别字也照抄。数连同单位原样照抄（82% 不能写成 百分之八十二，2800万家 不能写成 2800万，1000块钱 可以写成 1000块）。数前面有「约、近、超过、不到」这类字的，连着一起抄。
- 一个数被断在两行（上一行末尾是数字、下一行开头也是数字或单位，比如「一共卖了10」「58万台」），这个数不用。
- 带「不、没、别」这类否定的话，照抄时把否定一起带上，带不上就不挑这处。
- 填的字要让人单看也看得懂：不要截半个词，不要填「这个、那些」这种指代的话。
- 听写明显错了、读不通的句子不挑。
- 两处动画不要盖同一句。第 1 句不挑。
- 回之前逐个对一遍：每一个填的词，都要能在「从」到「到」那几句里一字不差地找到；找不到的那一处删掉。
只回 JSON，不要别的字，栏名照上面的中文写，不要换成英文：{{"动画": [{{"类型": "...", "从": 1, "到": 1}}, ...]}}；一处都没有就回 {{"动画": []}}

逐句字幕：
{lines}"""


def build_prompt(texts):
    """texts：逐句字幕（文字）。"""
    return PROMPT.format(lines='\n'.join('{} | {}'.format(i + 1, t) for i, t in enumerate(texts)))


def parse(txt):
    """模型的回话 → 一串动画（还没查的）。回话前后夹了别的字也行；读不出来回空串。"""
    txt, dec = txt or '', json.JSONDecoder()
    for m in re.finditer(r'\{', txt):
        try: d, _ = dec.raw_decode(txt, m.start())
        except ValueError: continue
        if isinstance(d, dict) and isinstance(d.get('动画'), list): return [x for x in d['动画'] if isinstance(x, dict)]
    m = re.search(r'"动画"\s*:\s*\[', txt)                      # 整段读不出（多写了括号之类）：一项一项捡，读不出的那项跳过
    out, i = [], m.end() if m else len(txt)
    while i < len(txt) and txt[i] != ']':
        if txt[i] == '{':
            try:
                d, j = dec.raw_decode(txt, i)
                if isinstance(d, dict) and d.get('类型'): out.append(d)
                i = j; continue
            except ValueError: pass
        i += 1
    return out


# ---------- 数：值和单位 ----------
_QPRE = re.compile(r'^(?:超过|将近|接近|大约|大概|近|约|至少|不到|不足|只有|仅有|高达|多达|足足)')
_QPOST = re.compile(r'(?:左右|以上|以下|上下)$')
_MAG = [('万亿', 1e12), ('千亿', 1e11), ('百亿', 1e10), ('十亿', 1e9), ('亿', 1e8), ('千万', 1e7), ('百万', 1e6), ('十万', 1e5), ('万', 1e4), ('千', 1e3)]
_CN = {'一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}
_NOT_NUM = re.compile(r'(?:\d{4}|[一二][零〇一二三四五六七八九]{3})年|\d+年代|\d+月(?!薪)|\d+[号日](?!元)|\d+点(?:钟|半|\d+分)?$|\d+岁|第\d+|第[一二三四五六七八九十]|\d+[个位名](?:人|$)|\d+人$')


def num_val(w):
    """数的原文 → (值, 量级之外的单位, 拿掉限定词的那一段)。认不出回 None。
    「443万亿度」→ (4.43e14, '度')；「82%」→ (82, '%')；「八成」→ (80, '%')；「将近10%」→ (10, '%')；「3000多万」→ (3e7, '')。
    带负号、零下、范围、分数、钟点的不认（这些只在「亮出大数」里原样写，不拿来比高矮）。"""
    s = _QPOST.sub('', _QPRE.sub('', w or ''))
    m = re.fullmatch(r'([一二两三四五六七八九十])成(半)?', s)
    if m: return _CN[m.group(1)] * 10 + (5 if m.group(2) else 0), '%', s
    if s == '一半': return 50.0, '%', s
    m = re.fullmatch(r'(\d+(?:\.\d+)?)[多余来几]?(.{0,8})', s)
    if not m or re.search(r'\d|[到至比~～/／:：\-－—]', m.group(2)): return None
    v, u = float(m.group(1)), m.group(2).replace('％', '%')
    for k, mul in _MAG:
        if u.startswith(k): v *= mul; u = u[len(k):]; break
    if u[:1] == '多': u = u[1:]
    return v, u, s


def num_split(w):
    """数的原文切成 (前面的限定词, 数字那一截, 后面的单位和别的字)，画的时候数字大、别的小。没有阿拉伯数字的整段当数字。"""
    m = re.search(r'[-－+＋]?\d+(?:[.,]\d+)*', w or '')
    if not m: return '', w or '', ''
    return w[:m.start()], m.group(0), w[m.end():]


_TIME_U = re.compile(r'(?:年|个月|天|周|个星期|小时|分钟|秒)$')
_TIME_AFTER = re.compile(r'之后|以后|之前|以前|以来|之内|以内|后|前|内|来')
_TIME_IN = re.compile(r'(?:年|个月|天|周|个星期|小时|分钟|秒)(?:之后|以后|之前|以前|以来|之内|以内|后|前|内)$')
_POINTER = re.compile(r'这个|那个|这些|那些|这种|那种|上述')                 # 指代的词上了画面等于没说（「什么」填成「这个数」）
_CHAIN = re.compile(r'然后|于是|接着|导致|所以')                            # 一件事接一件事，不是两样对着看
_EMPTY_LAB = ('范围', '规模', '程度', '情况', '结果', '问题', '原因', '影响')   # 当不了对照的一边
_LOSS = re.compile(r'亏|赤字|负债|负的|为负')                               # 有亏有赚的不摆成两摞比高矮
_COUNT = re.compile(r'([两二三四五六七八九]|[2-9])(?:大)?(?:种|点|件|样|条|步|类|项|个(?=条件|要求|步骤|办法|方法|原因|问题|东西|特点|方面|理由|建议|好处|坏处))')
_CN_N = {'两': 2, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9}
_DAYPART = ('晚上', '早上', '上午', '下午', '中午', '凌晨', '夜里')
_STEP = re.compile(r'先|再|然后|接着|之后|最后|第[一二三四]步|第[二三]|下一步')                       # 一步接一步：那几句里得有先后的话
_CAUSE = re.compile(r'因为|所以|导致|于是|因此|造成|使得|之所以|以至于|结果|才会|就会|才能|怪不得|难怪')   # 因果
_CHANGE = re.compile(r'变成|变为|变得|变了|涨到|降到|升到|跌到|增加到|减少到|缩到|从|原来|原先|以前|过去|曾经|当年|后来|现在|如今|到了')   # 前后变化
_WHEN = re.compile(r'\d{2,4}年|\d+月|\d+[号日]|\d+点|[去今明前后]年|上个?月|这个?月|下个?月|[昨今明前后]天|早上|上午|中午|下午|晚上|夜里|凌晨|第[一二三四五六七八九十\d]+(?:天|周|个月|年|季度|阶段|轮)|[一二三四]季度|上半年|下半年|年初|年中|年底|月初|月底|周[一二三四五六日末]|星期[一二三四五六日天]|[春夏秋冬]天|小时候|长大后|毕业后|刚开始|一开始|后来|最后|现在|以前|当年')
_COMMON = ('我们', '你们', '他们', '大家', '时候', '东西', '事情', '问题', '一个', '什么', '怎么', '因为', '所以', '但是', '然后', '就是', '可以', '可能', '没有', '已经', '还是', '自己', '知道', '觉得', '非常', '比较', '其实', '如果', '虽然', '而且', '或者', '一些', '很多', '现在', '今天')
_LAB_HEAD = re.compile(r'^(?:不是|就是|而是|是|的|和|跟|与|而)')
_LAB_TAIL = re.compile(r'(?:的|和|跟|与|把|被|是|让|给|更|很|最|太|也|就|都|又|才|却)$')   # 第三轮盲判：牌子「让设备更」话没说完
_MIDP = re.compile(r'.[呢呀啊哎嘛].')                                      # 牌子、纸条中间夹着语气词：是整句口水话，不是要点（第三轮盲判：「死活呢不让AA」）
_SUMUP = re.compile(r'[两二三四五六七八九][套种类项样条件点个大]')            # 要点里带着总数的话（第三轮盲判：「功能量两套方案」把「两套方案」粘在了后一样上）
_NTH = re.compile(r'^第[一二三四五六七八九十\d]')                           # 「第三种」这类过渡的序号，圈起来没有意思
_NTH_STEP = re.compile(r'第[一二三四五六七八九十\d]步')
_CHG_V = re.compile(r'变成|变为|变得')
_CLOCK = re.compile(r'\d+点|早上|上午|中午|下午|晚上|夜里|凌晨')
_YM = re.compile(r'年|月|季度')
_SHARE_AFTER = re.compile(r'(?:都|全|还)?(?:是|为|来自|属于|靠)')
_TURN = re.compile(r'但是|可是|然而|反而|反倒|没想到|谁知道|哪知道|结果|偏偏|转头|却|但')   # 转折：前半和后半之间得有转过来的话。「不过、其实」不算：口播里多半是换个话头（11-14 小模型试答：「不过呀……其实对AI还有一个更重要的期待」）


class Bad(Exception):
    pass


class TooWide(Bad):
    pass


ASK_SPAN = 12          # 模型给的范围最多认这么宽；超过 MAX_SPAN 的，收到它填的字实际占的那几句再查


def _span(a, n, most):
    try: f, t = int(a.get('从')), int(a.get('到'))
    except (TypeError, ValueError): raise Bad('从、到不是编号')
    if isinstance(a.get('从'), bool) or isinstance(a.get('到'), bool): raise Bad('从、到不是编号')
    if not 1 <= f <= t <= n: raise Bad('从、到超出了这段话')
    if t - f + 1 > most: raise TooWide('盖的句子超过 {} 句'.format(MAX_SPAN))
    return f - 1, t                                # 变成从 0 数的 [la, lb)


def _txt(v):
    if isinstance(v, bool) or v is None: return ''
    if isinstance(v, (int, float)): return '%g' % v
    return re.sub(r'\s+', '', v) if isinstance(v, str) else ''


def _find(w, T, la, lb, K, cross=False):
    """w 在 [la, lb) 哪一句里原样出现、截得完整。返回 (第几句, 第几个字)；没有就报不合格。"""
    seen = False
    for i in range(la, lb):
        p = T[i].find(w)
        if p < 0: continue
        seen = True
        nxt = T[i + 1] if i + 1 < len(T) else ''
        if K['cut_ok'](w, T[i], nxt) and K['block_ok'](T[i], w): return i, p
    if cross and not seen:                                  # 字幕把它断成了两行（上一行尾接下一行头，原样连着）：认，从上一行那个字算起
        for i in range(la, lb - 1):
            j = T[i] + T[i + 1]; p = j.find(w)
            while p >= 0:
                if p < len(T[i]) < p + len(w):
                    seen = True
                    if K['cut_ok'](w, j, T[i + 2] if i + 2 < len(T) else '') and K['block_ok'](j, w): return i, p
                p = j.find(w, p + 1)
    raise Bad('「{}」{}'.format(w, '截得不完整（截了半个数，或者丢了否定）' if seen else '不是这几句字幕里原样连着的字'))


_TAILP = re.compile(r'[哎啊呢吧呀嘛哦啦哈]+$')


def _label(v, T, la, lb, K, most, need=True, what='名字'):
    w = _txt(v)
    if len(_TAILP.sub('', w)) >= 2: w = _TAILP.sub('', w)   # 末尾的语气词不上画面（11-14 盲判：「颜色鲜艳哎」）
    if not w:
        if need: raise Bad('缺{}'.format(what))
        return '', None
    if len(w) > most: raise Bad('{}「{}」超过 {} 个字'.format(what, w, most))
    if _POINTER.search(w): raise Bad('{}「{}」是指代的话，单看不知道说的是什么'.format(what, w))
    return w, _find(w, T, la, lb, K, cross=True)


_NEXT_HEAD = re.compile(r'[\d.．点%％‰]|万亿|千亿|百亿|十亿|亿|千万|百万|十万|万|千|百|倍|多|余|来|个百分点|百分点')
_PREV_TAIL = re.compile(r'[\d.．]$|\d点$')


def _number(v, T, la, lb, K, plain=False):
    """一个数：原样在某一句里，是完整的一块数，没被断到上下行，不是年份日期钟点岁数。plain：要拿来比高矮，还得认得出值。
    返回 (原文, (第几句, 第几个字), 值, 单位)。"""
    w = _txt(v)
    if not w: raise Bad('缺数')
    if len(w) > 14: raise Bad('数「{}」太长'.format(w))
    i, p = _find(w, T, la, lb, K)
    bl = K['num_blocks'](w)
    if len(bl) != 1: raise Bad('「{}」里不是正好一个数'.format(w))
    if _NOT_NUM.search(w): raise Bad('「{}」是年份、日期、钟点、岁数或人数，不当数画'.format(w))
    e = p + len(w); t = T[i]
    if e == len(t) and i + 1 < len(T) and (_NEXT_HEAD.match(T[i + 1]) or (T[i + 1][:1] == '成' and w[-1:] in '0123456789一二两三四五六七八九十')):   # 「成都」的成不算，「八 / 成」才算
        raise Bad('数「{}」后半截在下一行'.format(w))
    if p == 0 and i > 0 and _PREV_TAIL.search(T[i - 1]): raise Bad('数「{}」前半截在上一行'.format(w))
    nv = num_val(w)
    if plain and (nv is None or nv[0] <= 0): raise Bad('数「{}」认不出大小，没法比'.format(w))
    return w, (i, p), (nv[0] if nv else None), (nv[1] if nv else None)


def _lines_of(c, T):
    """合格的一项里，填的字实际落在哪几句。"""
    ls = set()
    def add(w, at):
        ls.add(at[0])
        if at[1] + len(w) > len(T[at[0]]): ls.add(at[0] + 1)
    for key, at in c['at'].items():
        if at and isinstance(at[0], list):
            for w, x in zip(c[key], at): add(w, x)
        else: add(c[key], at)
    for g in c.get('组') or []: add(g['名'], g['at']['名']); add(g['数'], g['at']['数'])
    for g in c.get('时间点') or []: add(g['时'], g['at']['时']); add(g['事'], g['at']['事'])
    return ls


def check(a, T, K):
    """一处动画合不合格（见 _check）。模型给的范围太宽的，收到它填的字实际占的那几句，再照原来的规矩查一遍。"""
    try: return _check(a, T, K, MAX_SPAN)
    except TooWide:
        ls = _lines_of(_check(a, T, K, ASK_SPAN), T)          # 放宽查一遍，只为知道填的字落在哪几句
        return _check(dict(a, 从=min(ls) + 1, 到=max(ls) + 1), T, K, MAX_SPAN)


def _check(a, T, K, most):
    """一处动画合不合格。a：模型回的一项；T：逐句字幕（去掉空格的文字）；K：{'cut_ok', 'block_ok', 'num_blocks'} 三个判法。
    合格回洗干净的一项（只留认得的栏，外加 la / lb 从 0 数的句子范围、at 每个填的字在哪句第几个字、val 认出的值）；不合格抛 Bad(原因)。"""
    if not isinstance(a, dict): raise Bad('不是一项')
    kind = _txt(a.get('类型'))
    if kind not in KINDS: raise Bad('没有「{}」这种动画'.format(kind))
    if kind == '几组对比' and isinstance(a.get('组'), list) and len(a['组']) == 2 and all(isinstance(g, dict) for g in a['组']):   # 只有两组：当「比多少」画
        g1, g2 = a['组']; a = dict(a, 类型='比多少', 甲=g1.get('名'), 甲数=g1.get('数'), 乙=g2.get('名'), 乙数=g2.get('数')); kind = '比多少'
    la, lb = _span(a, len(T), most)
    out = {'类型': kind, '从': la + 1, '到': lb, 'la': la, 'lb': lb, 'at': {}, 'val': {}}

    def lab(key, most, need=True, what='名字'):
        w, at = _label(a.get(key), T, la, lb, K, most, need, what)
        out[key] = w
        if at: out['at'][key] = list(at)
        return w

    def soft(key, most, what):
        """可有可无的小字：太长、对不上原文就留空，不连累这一处。"""
        try: return lab(key, most, need=False, what=what)
        except Bad:
            out[key] = ''; out['at'].pop(key, None); return ''

    def num(key, plain=False, src=None):
        w, at, v, u = _number((src or a).get(key), T, la, lb, K, plain)
        return w, at, v, u

    span = ''.join(T[la:lb])
    if kind in ('比多少', '几组对比') and _LOSS.search(span): raise Bad('这几句里有亏有赚，不摆成高矮比')   # 第二轮盲判：利润 10 亿和亏损 6 亿被摆成两摞
    if kind == '比多少':
        x, y = lab('甲', LAB_MAX), lab('乙', LAB_MAX)
        if x == y: raise Bad('甲和乙是同一个')
        (w1, a1, v1, u1), (w2, a2, v2, u2) = num('甲数', True), num('乙数', True)
        if u1 != u2: raise Bad('两个数单位不一样（{} 和 {}），不比'.format(w1, w2))
        if (a1 == a2): raise Bad('两个数是同一处')
        out.update(甲数=w1, 乙数=w2); out['at'].update(甲数=list(a1), 乙数=list(a2)); out['val'].update(甲数=v1, 乙数=v2)
    elif kind == '占多少':
        w, at, v, u = num('数', True)
        if u != '%' or not 0 < v <= 100: raise Bad('「{}」不是百分之几、几成'.format(w))
        soft('什么', WHAT_MAX, '什么')
        if out.get('什么') and out['at']['什么'] < list(at) and _SHARE_AFTER.match(T[at[0]][at[1] + len(w):]):   # 「甲里头有 82% 是乙」：占的是乙，写甲就把数安错了头，这行小字不要
            out['什么'] = ''; out['at'].pop('什么', None)
        out['数'] = w; out['at']['数'] = list(at); out['val']['数'] = v
    elif kind == '几组对比':
        gs = a.get('组')
        if not isinstance(gs, list) or not 3 <= len(gs) <= 5 or not all(isinstance(g, dict) for g in gs): raise Bad('组要三到五个')
        rows, unit, seen, spots = [], None, set(), set()
        for k, g in enumerate(gs):
            nm, nat = _label(g.get('名'), T, la, lb, K, LAB_MAX)
            w, at, v, u = num('数', True, src=g)
            if unit is None: unit = u
            if u != unit: raise Bad('几组的单位不一样，不比')
            if nm in seen or at in spots: raise Bad('有两组是同一个')
            seen.add(nm); spots.add(at)
            rows.append({'名': nm, '数': w, 'at': {'名': list(nat), '数': list(at)}, 'val': v})
        out['组'] = rows
    elif kind == '亮出大数':
        w, at, v, u = num('数')
        if re.search(r'\d$', _QPOST.sub('', w)): raise Bad('数「{}」没带单位，亮出来不知道是什么'.format(w))   # 11-14 盲判：「失业率是41」
        rest = T[at[0]][at[1] + len(w):] or (T[at[0] + 1] if at[0] + 1 < len(T) else '')
        if _TIME_IN.search(w): raise Bad('「{}」说的是时候，不当数画'.format(w))   # 第二份考卷：数里自己带着「之后」
        if _TIME_U.search(w) and _TIME_AFTER.match(rest): raise Bad('「{}{}」说的是时候，不当数画'.format(w, _TIME_AFTER.match(rest).group(0)))   # 11-14 盲判：「35年之后」
        soft('什么', WHAT_MAX, '什么')
        out['数'] = w; out['at']['数'] = list(at)
    elif kind == '并排对照':
        x, y = lab('左', LAB_MAX), lab('右', LAB_MAX)
        if x == y: raise Bad('左和右是同一个')
        if _CHAIN.search(span): raise Bad('这几句是一件事接一件事，不是两样对着看')   # 第二轮盲判：替代→失业→没人消费→停摆
        for w in (x, y):
            if w in _EMPTY_LAB: raise Bad('名字「{}」当不了对照的一边'.format(w))     # 第二轮盲判：AI开药 / 范围
            if _LAB_HEAD.search(w) or _LAB_TAIL.search(w): raise Bad('名字「{}」截得读不通'.format(w))   # 11-14 盲判：「不是把人」「是不让新人」「没用的」
        if not (soft('左说', SAY_MAX, '左说') and soft('右说', SAY_MAX, '右说')):   # 11-14 盲判后收紧：两边的说明凑不齐就整处不要（两个并列的条件被当成对照，就是这样混进来的）
            raise Bad('并排对照两边都要有说明，凑不齐')
        for w in (out['左说'], out['右说']):
            if len(w) < 3 or _LAB_TAIL.search(w): raise Bad('并排对照的说明「{}」单看读不通'.format(w))
        if out['左说'] in (x, y) or out['右说'] in (x, y) or out['左说'] == out['右说']: raise Bad('并排对照的说明和名字是同一句话')   # 第二份考卷
    elif kind == '圈重点':
        if lb - la > 2 and most == MAX_SPAN: raise TooWide('圈重点最多盖 2 句')
        w = lab('词', LAB_MAX, what='词')
        if len(w) < 2: raise Bad('圈的词太短')
        if w in _COMMON: raise Bad('「{}」是谁都会说的词，不圈'.format(w))
        if _NTH.search(w): raise Bad('「{}」只是个序号，不圈'.format(w))        # 第三轮盲判：「第三种」
        if re.search(r'\d', w) or len(K['num_blocks'](w)): raise Bad('「{}」是数，不圈'.format(w))
    elif kind == '一步接一步':
        ps = a.get('步')
        if not isinstance(ps, list) or not 2 <= len(ps) <= 4: raise Bad('步要两到四个')
        if not _STEP.search(span) and most == MAX_SPAN: raise Bad('这几句里没有先后的话，不算一步接一步')
        if len(set(_NTH_STEP.findall(span))) == 1: raise Bad('这几句讲的是其中一步里头的事，不是几步')   # 第三轮盲判：「训练的第二步 / 模仿 / 示范回答 / 照着去学」，模仿是这一步的名字
        pts, ats = [], []
        for v in ps:
            w, at = _label(v, T, la, lb, K, POINT_MAX, what='步')
            if w in pts: raise Bad('有两步是同一个')
            if _MIDP.search(w) or _LAB_TAIL.search(w): raise Bad('步「{}」单看读不通'.format(w))
            pts.append(w); ats.append(list(at))
        if ats != sorted(ats): raise Bad('步的先后和说的先后不一样')
        out['步'] = pts; out['at']['步'] = ats
    elif kind in ('因果', '前后变化'):
        k1, k2 = ('因', '果') if kind == '因果' else ('前', '后')
        x, y = lab(k1, SIDE_MAX, what=k1), lab(k2, SIDE_MAX, what=k2)
        if x == y or x in y or y in x: raise Bad('{}和{}是同一句话'.format(k1, k2))
        if not (_CAUSE if kind == '因果' else _CHANGE).search(span): raise Bad('这几句里没有{}的话'.format('因为、所以这类' if kind == '因果' else '原来、后来、变成这类'))
        if kind == '前后变化' and out['at'][k1] > out['at'][k2]: raise Bad('前和后的先后和说的不一样')
        if kind == '前后变化' and _CHG_V.search(x): raise Bad('「前」自己就是一句「变成」，是一环接一环，不是一样东西变了样')   # 第三轮盲判：工资变成消费 / 消费变成企业收入
        for w in (x, y):
            if _LAB_TAIL.search(w) or len(w) < 2: raise Bad('「{}」截得读不通'.format(w))
    elif kind in ('转折', '一好一坏'):                                           # 11-14 傍晚加（整片盲审：最有戏的转折没画面；一好一坏被挂成并列的牌子）
        k1, k2 = ('前半', '后半') if kind == '转折' else ('好', '坏')
        x, y = lab(k1, TURN_MAX, what=k1), lab(k2, TURN_MAX, what=k2)
        if x == y or x in y or y in x: raise Bad('{}和{}是同一句话'.format(k1, k2))
        for w in (x, y):
            if len(w) < 2 or _LAB_TAIL.search(w) or _MIDP.search(w): raise Bad('「{}」截得读不通'.format(w))
        if kind == '转折':
            if out['at'][k1] > out['at'][k2]: raise Bad('前半和后半的先后和说的不一样')
            pos = lambda at: sum(len(T[i]) for i in range(la, at[0])) + at[1]
            if not _TURN.search(span[pos(out['at'][k1]) + len(x):pos(out['at'][k2]) + len(y)]): raise Bad('前半和后半之间没有「但是、可是、结果」这类转过来的话')
    elif kind == '时间先后':
        ps = a.get('时间点')
        if not isinstance(ps, list) or not 2 <= len(ps) <= 4 or not all(isinstance(g, dict) for g in ps): raise Bad('时间点要两到四个')
        rows, ats, seen = [], [], set()
        for g in ps:
            tm, tat = _label(g.get('时'), T, la, lb, K, LAB_MAX, what='时')
            ev, eat = _label(g.get('事'), T, la, lb, K, SIDE_MAX, what='事')
            if not _WHEN.search(tm): raise Bad('「{}」不是个时候'.format(tm))
            if tm in seen: raise Bad('有两个时候是同一个')
            seen.add(tm); rows.append({'时': tm, '事': ev, 'at': {'时': list(tat), '事': list(eat)}}); ats.append(list(tat))
        if ats != sorted(ats): raise Bad('时间点的先后和说的先后不一样')
        if any(_CLOCK.search(g['时']) for g in rows) and any(_YM.search(g['时']) for g in rows): raise Bad('钟点和年月不在一条时间线上')   # 第三轮盲判：「今年7月升级」和订餐要求里的「晚上7点」
        out['时间点'] = rows
    else:   # 几个要点
        ps = a.get('点')
        if not isinstance(ps, list) or not 2 <= len(ps) <= 4: raise Bad('要点要两到四个')   # 11-14 夜：两样并列的也挂牌子（原先只收三四样，两样的被模型拿去凑对照）
        pts, ats = [], []
        for v in ps:
            w, at = _label(v, T, la, lb, K, POINT_MAX, what='要点')
            if w in pts: raise Bad('有两个要点是同一个')
            if _MIDP.search(w) or _LAB_TAIL.search(w): raise Bad('要点「{}」单看读不通'.format(w))
            if _SUMUP.search(w): raise Bad('要点「{}」里带着总数的话'.format(w))
            pts.append(w); ats.append(list(at))
        if ats != sorted(ats): raise Bad('要点的先后和说的先后不一样')
        if len(pts) == 2 and ats[0][0] == ats[1][0]: raise Bad('一句话里顺口带过的两个词，不算几样')   # 整片盲审：「既体面又自然」挂成两块牌子，是一句带过的话
        near = ''.join(T[max(0, la - 2):lb])
        for m in _COUNT.finditer(near):                                        # 第二轮盲判：前面说「这三种东西」，牌子只挂了两块
            if m.group(0).endswith('点') and (m.group(1).isdigit() or near[max(0, m.start() - 2):m.start()] in _DAYPART): continue   # 「晚上7点」是钟点，不是七点（11-14 整片：订餐的几个条件因此整处被拦）
            k = _CN_N.get(m.group(1)) or int(m.group(1))
            if k != len(pts): raise Bad('前面说的是 {} 样，牌子却是 {} 块'.format(k, len(pts)))
        if re.search(r'第一|首先', span) and not re.search(r'第二|其次|然后|再', span): raise Bad('只说到第一样，后面的没盖进来')
        out['点'] = pts; out['at']['点'] = ats
    return out


def check_all(items, texts, K, most=16):
    """一串动画逐处查。返回 (合格的, 拦下的)：合格的按先后排好、互不重叠、最多 most 处；拦下的是 [{'项': 原样, '原因': 中文}]。
    第 1 句不许盖（那是开场的大字）。"""
    T = [re.sub(r'\s+', '', t or '') for t in texts]
    good, bad = [], []
    for a in items or []:
        try:
            c = check(a, T, K)
            if c['la'] < 1: raise Bad('第 1 句是开场，不配动画')
            good.append(c)
        except Bad as e: bad.append({'项': a, '原因': str(e)})
        except Exception as e: bad.append({'项': a, '原因': '格式不对（{}）'.format(type(e).__name__)})
    good.sort(key=lambda c: (c['类型'] == '圈重点', c['la'], c['lb']))   # 圈重点哪句都能配，和别的撞了让别的
    keep, circles = [], 0
    for c in good:
        if any(c['la'] < k['lb'] and k['la'] < c['lb'] for k in keep): bad.append({'项': c, '原因': '和另一处盖了同一句'}); continue
        if c['类型'] == '圈重点':
            if circles >= CIRCLE_MAX: bad.append({'项': c, '原因': '圈重点一条片最多 {} 处'.format(CIRCLE_MAX)}); continue
            if any(k['类型'] == '圈重点' and abs(k['la'] - c['la']) < 6 for k in keep): bad.append({'项': c, '原因': '离上一处圈重点太近'}); continue
            circles += 1
        if len(keep) >= most: bad.append({'项': c, '原因': '一条片最多 {} 处'.format(most)}); continue
        keep.append(c)
    keep.sort(key=lambda c: (c['la'], c['lb']))
    return keep, bad


def public(c):
    """合格的一项 → 回给软件的样子（只留模型填的栏，位置和值软件自己再算一遍）。"""
    out = {k: c[k] for k in ('类型', '从', '到', '甲', '甲数', '乙', '乙数', '什么', '数', '左', '左说', '右', '右说', '点', '词', '步', '因', '果', '前', '后', '前半', '后半', '好', '坏') if k in c and c[k] != ''}
    if '组' in c: out['组'] = [{'名': g['名'], '数': g['数']} for g in c['组']]
    if '时间点' in c: out['时间点'] = [{'时': g['时'], '事': g['事']} for g in c['时间点']]
    return out
