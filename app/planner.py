# 看内容定画面：把逐字听写变成「分镜计划」（plan）。
# 不联网、不用钥匙：靠中文口播里的常见信号判断画面——
#   数字 → 滚数；A 到 B → 区间条；第一第二第三 → 清单卡；很多人以为…其实 → 误区卡；
#   以前…现在 / 不是…而是 / A，B 却… → 对比两栏；不是A，就是B（分两句说）→ 划掉改写；
#   两件事：A 和 B → 圆章；因为 A / 所以 B → 因果箭头；2019 年 … 2023 年 → 年份时间线；
#   问句 → 问号；其余 → 大字逐字跳（三种版式轮换）。
# 2026-11-07 起：plan() 的输出是「剧本」（见 juben.py），句型之外还带 rules.py 算的词组、上屏词、主角词、上下等。
import math
import re
from difflib import SequenceMatcher
import shuzi

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
UNIT_OLD = r'(%|万|亿|倍|次|元|块|岁|年|个月|月|天|周|小时|分钟|秒|斤|公斤|米|度|台|人|家|篇|条|本|口|杯|步|分)'
UNIT_NEW = shuzi.UNIT   # 一个分组，量级可叠：「58万亿度」整个是单位（原来只认到「万」，「亿度」掉到下一行）


def num_res(unit):
    return (re.compile(r'(\d+(?:\.\d+)?)\s*' + unit + '?'),
            re.compile(r'(\d+(?:\.\d+)?)\s*' + unit + r'?\s*(?:到|至|~|－|-|—)\s*(\d+(?:\.\d+)?)\s*' + unit))


NUM_RE, RANGE_RE = num_res(UNIT_NEW)
ENUM_NEW = re.compile(r'^(第[一二三四五六七八九十\d]+(?![一二三四五六七八九十\d名次届期季轮集章节号级层代])[个点条步]?|首先|其次|再次|最后一?[个点条]?|一是|二是|三是|四是|另外|还有一个(就是)?|再一个(就是)?)[，,、：:。\s]*')
ENUM_OLD = re.compile(r'^(第[一二三四五六七八九十\d]+[个点条步]?|首先|其次|再次|最后一?[个点条]?|一是|二是|三是|四是|另外|还有一个(就是)?|再一个(就是)?)[，,、：:。\s]*')
ENUM_RE = ENUM_NEW   # 「第三名」是名次不是第几条（ENUM_OLD 是改前的，考卷拆开看时用）
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
Q_RE = re.compile(r'([?？]$|为什么|为啥|怎么办|怎么|是不是|能不能|要不要|吗$|呢$|多少)')   # 像问句（模板不挂在这种句子上；问号卡另用 is_question）
# 11-12 夜盲审七处之二：问号卡认不准就不用。两条都满足才给——一，句子里有疑问的词（什么、怎么、为什么、多少、能不能、是不是、X不X 这类）；
# 二，句尾是「呢、吗、么」。只满足一条的照普通句走（「就关系到还剩多少」「能不能及时组织起来」不给，「用起来到底可靠不可靠呢」给）
Q_WORD = re.compile(r'(什么|怎么|为什么|为啥|多少|([\u4e00-\u9fff]{1,2})[不没]\2)')   # 只认总控列的这几类；「哪些事呢」是半句，不算
Q_END = re.compile(r'(呢|吗|(?<![什怎那这多要])么)[？?]?$')   # 「锁什么」「那么」的么不是句尾的问话字
Q_RULE = {'两条都要': True}   # 11-13 总控定：问号卡只看两条（疑问的词 + 句尾呢吗么），前后停顿这版不管   # 必过考卷的牙单关用


def is_question(s):
    if not Q_RULE['两条都要']: return bool(Q_RE.search(s))
    return bool(Q_WORD.search(s) and Q_END.search(s))
CTA_RE = re.compile(r'(今天就|现在就|赶紧|记得|试试|去做|去试|收藏|下次|马上)')
SEGUE_RE = re.compile(r'(接下来|下面我们|后面我们|再来看|先来看|我们来看)')    # 「那接下来我们再来看看」是过渡，不是号召（「下一个视频见」是道别，算号召）
DANGLE_RE = re.compile(r'(就是|也是|还是|可能是|应该是|的是|和|跟|与|把|被|让|给|对|从|向|更|最|很|需|叫|要|还有|或者|因为|所以|但是|而且)$')   # 话没说完就停的字（「用得到」「是亏死的」「其实不是」是说完了的）
SUMUP_RE = re.compile(r'^(我们)?(来)?(总结|总之|以上|好了|就这些|回到|接下来|下面)')   # 「最后呢 / 我们来总结一下」：总结句不是清单的一条
# 2026-11-07 四类修法的开关，只给考卷做「拆开看」用：全关时输出必须和改前一模一样，逐个打开看每类各改了哪里
FIXES = shuzi.FIXES
FIXES.add('封面')   # 11-10：封面另算、数字落第二行整行标金、带数没画大字时问号卡照出
FIXES.update({'句卡', '模板'})   # 11-12 夜：句卡 = 长句折行点（普通句卡新排法用）；模板 = 四种按意思挂的模板（见文件末尾那一节）


def set_fixes(on):
    """考卷拆开看用：只打开 on 里的几类修法。"""
    global ENUM_RE, NUM_RE, RANGE_RE
    FIXES.clear(); FIXES.update(on)
    ENUM_RE = ENUM_NEW if '清单' in FIXES else ENUM_OLD
    NUM_RE, RANGE_RE = num_res(UNIT_NEW if '数字' in FIXES else UNIT_OLD)
FILLER = re.compile(r'^(所以|那么|然后|而且|并且|另外|还有|就是|其实|好|那|嗯|呃|啊)[，,。\s]*')
SOFT = re.compile(r'^(一般来说|总的来说|简单来说|说白了|换句话说|总之|所以|那么|好)$')
BAD_RE = re.compile(r'(伤|坏|怕|受累|掉|跌|亏|损|危险|风险|坑|错|别|不要|千万|最怕|发烫|贵|难|慢|少)')

# 关键词 → 图标（Lucide，ISC 许可）。顺序就是优先级。
ICONS = [
    ('满电|充满|电满', 'battery-full'), ('没电|低电|电量低', 'battery-low'), ('设置|打开|开关', 'settings'), ('电池|充电|电量|充放电', 'battery-charging'),
    ('高温|发烫|太热|过热|烫', 'flame'), ('游戏', 'gamepad-2'), ('手机|App|APP|微信|抖音', 'smartphone'),
    ('房东|租房|房子|房产|买房', 'house'), ('合同|签字|签约|协议', 'file-pen-line'),
    ('身份证|证件', 'id-card'), ('中介|老板|医生|老师|朋友', 'user'), ('很多人|大家|用户|客户|年轻人', 'users'),
    ('钱|工资|收入|存款|价格|便宜|贵|元|块|成本|定金', 'wallet'), ('涨|(?<!负)增长|提高|翻倍|更长|变多', 'trending-up'),
    ('跌|下降|减少|掉到|变少|缩水|负增长', 'trending-down'), ('时间|小时|分钟|每天|熬夜|早上|晚上', 'clock'),
    ('睡|失眠', 'moon'), ('吃|饭|早餐|喝', 'utensils'), ('咖啡', 'coffee'), ('学习|读书|书|课', 'book-open'),
    ('考试|毕业|学校', 'graduation-cap'), ('工作|上班|职场|公司|面试', 'briefcase'), ('健康|身体|心脏|血压', 'heart-pulse'),
    ('安全|保护|靠谱|放心', 'shield-check'), ('目标|计划|方向', 'target'), ('方法|技巧|习惯|办法|窍门|建议', 'lightbulb'),
    ('脑|思考|记忆|大脑', 'brain'), ('数据|比例|区间|百分', 'chart-column'), ('AI|人工智能|模型|智能', 'sparkles'),
    ('买|购物|下单|网购', 'shopping-cart'), ('车|开车|油', 'car'), ('旅行|出差|飞机', 'plane'),
    ('问题|为什么|怎么|吗', 'circle-question-mark'), ('坑|危险|风险|千万|最伤|最怕|跑路|小心', 'triangle-alert'),
    ('记住|一定要|正确|对得上', 'circle-check'), ('误区|错|老黄历|没用', 'circle-x'), ('快|立刻|马上|效率', 'zap'),
]


# 图标的中文名（校字页上给人看；和 中转/中转.py 的表同一份）
ICON_CN = {'banknote': '钞票', 'battery-charging': '充电的电池', 'battery-full': '满电电池', 'battery-low': '没电电池', 'book-open': '打开的书',
         'brain': '大脑', 'briefcase': '公文包', 'calendar': '日历', 'car': '汽车', 'chart-column': '柱状图', 'circle-check': '对勾',
         'circle-question-mark': '问号', 'circle-x': '叉', 'clock': '时钟', 'coffee': '咖啡杯', 'file-pen-line': '合同', 'flame': '火焰',
         'gamepad-2': '游戏手柄', 'gift': '礼物', 'graduation-cap': '学士帽', 'heart-pulse': '心跳', 'house': '房子', 'id-card': '证件',
         'lightbulb': '灯泡', 'lock': '锁', 'message-circle': '对话气泡', 'moon': '月亮', 'plane': '飞机', 'rocket': '火箭', 'search': '放大镜',
         'settings': '齿轮', 'shield-check': '盾牌', 'shopping-cart': '购物车', 'smartphone': '手机', 'sparkles': '星光', 'target': '靶心',
         'thumbs-up': '点赞', 'trending-down': '下降曲线', 'trending-up': '上升曲线', 'triangle-alert': '警示牌', 'user': '一个人',
         'users': '一群人', 'utensils': '刀叉', 'wallet': '钱包', 'zap': '闪电'}


# 11-12 总控令（这一版必修）：字卡按句型挂的图标收紧，开着「图标」开关才这样，关着照 11-06 老样子。
#   ① 记号不自动挂：星光、一个人、一群人、问号、警示牌、勾、叉、闪电、灯泡、靶心、涨跌箭头、点赞（和 rules.NOT_PROP 同一张单）；
#   ② 开场、封面没撞上词就空着，不补星光；③ 拿软件自己的切词，整个词和表里的词一样才挂，半截撞上的不挂（大家伙、出差别、有钱）；
#   ④ 表里去掉「工作」「身体」（蛋白质的工作、身体里的蛋白质画成公文包、心跳），「油」不配汽车（油气、油多不等于电多）。
#   重排三条真稿量过：字卡挂图标 43 句、不对 26 句，三张封面都是星光（画风重做_2026-11-12/图标积木）。
SIGNS = frozenset({'sparkles', 'user', 'users', 'circle-question-mark', 'triangle-alert', 'circle-check', 'circle-x', 'zap', 'lightbulb', 'target',
                   'trending-up', 'trending-down', 'thumbs-up'})
_DROP = {'briefcase': '工作', 'heart-pulse': '身体', 'car': '油'}
ICONS_TIGHT = [('|'.join(x for x in pat.split('|') if x != _DROP.get(name)), name) for pat, name in ICONS]
_TIGHT_RE = [(re.compile(pat), name) for pat, name in ICONS_TIGHT if name not in SIGNS]


def icon_for(text, default=None):
    for pat, name in (ICONS_TIGHT if '图标' in FIXES else ICONS):
        if re.search(pat, text):
            return name
    return default


def scene_icon(text, default=None):
    """字卡这类按句型挂的图标（开场、普通句、清单每条、分项、因果、数字卡、封面跟开场）。
    「图标」开关关着：照老样子，字里撞上就挂，开场没撞上补 default（星光）。开着：见上面 11-12 的四条，没对上就空着。"""
    if '图标' not in FIXES: return icon_for(text, default)
    from rules import cuts
    toks = [w for w in cuts(text) if w.strip()]
    for rx, name in _TIGHT_RE:
        if any(rx.fullmatch(w) for w in toks): return name
    return None


def normalize_text(s):
    s = CN_YEAR_RE.sub(lambda m: (lambda d: d + '年' if d[:2] in ('19', '20') else m.group(0))(''.join(CN_DIGIT[c] for c in m.group(1))), s)
    s = s.replace('百分之百', '100%')
    s = re.sub(r'百分之([一二三四五六七八九十]+)(?:点([零〇一二三四五六七八九]+))?',
               lambda m: f'{cn2num(m.group(1))}' + ('.' + ''.join(CN_DIGIT[c] for c in m.group(2)) if m.group(2) else '') + '%', s)   # 百分之二点五 → 2.5%（11-09：原来变成「2%点五」）
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
    for m in re.finditer(r'百分之([一二三四五六七八九十]+|百)(?:点([零〇一二三四五六七八九]+))?', s):   # 百分之二点五 → 2.5%，原来字幕成了「2%点五」
        a, b = m.span()
        if a < i: continue
        out += chars[i:a]; v = 100 if m.group(1) == '百' else cn2num(m.group(1))
        if m.group(2): v = f'{v}.' + ''.join(CN_DIGIT[c] for c in m.group(2))
        out.append(dict(chars[a], c=f'{v}%', t1=chars[b - 1]['t1'], **({'p': chars[b - 1]['p']} if 'p' in chars[b - 1] else {}),
                        **({'brk': True} if chars[b - 1].get('brk') else {})))
        i = b
    return out + chars[i:]


def build_lines(chars):
    """按停顿和标点切行；句号问号叹号必断；每行最多 15 字，太长先从逗号断，再按词断，不把一个词劈成两半。"""
    chars = norm_chars(chars)
    bad = bad_cuts(chars)          # 在这些字后面断开会把一个数切成两行（11-09 第三轮：数和单位不许分两行）
    lines, cur = [], []
    for ch in chars:
        cur.append(ch)
        if (ch.get('brk') or (re.search('[。！？!?]', ch.get('p', '')) and len(cur) >= 2)) and id(ch) not in bad:
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
            if acc in pos and id(c) not in bad: bounds.add(i + 1)
        for b in sorted(bounds, key=lambda b: abs(b - len(ln) / 2)):
            if 4 <= b <= 15 and len(ln) - b >= 2: best = b; break
        if best: return best
        free = [b for b in range(4, min(len(ln) - 2, 15) + 1) if id(ln[b - 1]) not in bad]   # 词边界都在数中间：找最近一个不切数的地方
        if free: return min(free, key=lambda b: abs(b - len(ln) / 2))
        if '数块' in FIXES:   # 11-10 复审：一个数块占了大半行（「年收入3000多万到5000多万」）：不从数中间硬切；行太长（20 字以上）才在块外最近处断
            alt = [b for b in range(2, len(ln) - 1) if id(ln[b - 1]) not in bad]
            return min(alt, key=lambda b: abs(b - len(ln) / 2)) if alt and len(ln) > 20 else None
        return min(len(ln) // 2 + 1, 15)

    def comma(ln):  # 超过 12 字、中间有逗号的，也从逗号断开，竖屏一行太长看着累
        return next((i + 1 for i in range(len(ln) - 3, 3, -1) if ln[i].get('p') and id(ln[i]) not in bad), None) if len(ln) > 12 else None   # 11-10：逗号在数块里（3000多万，到5000多万）不断

    out = []
    for ln in lines:
        while len(ln) <= 15 and comma(ln):
            k = comma(ln); out.append(ln[:k]); ln = ln[k:]
        while len(ln) > 15:
            cut = next((i + 1 for i in range(min(len(ln), 15) - 1, 3, -1) if ln[i].get('p') and len(ln) - i - 1 >= 2 and id(ln[i]) not in bad), None) or word_cut(ln)
            if not cut: break                                # 11-10 复审：只剩从数中间切的地方，这一行整个留着
            out.append(ln[:cut]); ln = ln[cut:]
        if ln: out.append(ln)
    res = []
    for ln in out:
        text = ''.join(c['c'] for c in ln)
        # se：这一行是不是在句末断的（11-10 封面用：第一句被拆成两行，封面要两行一起放）
        res.append(dict(t0=ln[0]['t0'], t1=ln[-1]['t1'], cs=[[c['c'], c['t0'], c['t1']] for c in ln], text=text,
                        se=bool(ln[-1].get('brk') or re.search('[。！？!?]', ln[-1].get('p', '')))))
    return res


def bad_cuts(chars):
    """哪些字后面不能断：断开会把一个数块切成两半（「1.2亿」「3.85个百分点」「3点15分」）。返回这些字的 id。"""
    if '数块' not in FIXES: return set()
    text, ends = '', []
    for k, ch in enumerate(chars):
        text += ch['c']; ends.append(len(text))
        if not re.match(r'[到至]\d', ''.join(c['c'] for c in chars[k + 1:k + 3])): text += ch.get('p', '')   # 11-10 复审：「3000多万，到5000多万」逗号两边是一个范围，算一块
    sp = shuzi.blocks(text)
    return {id(ch) for ch, e in zip(chars, ends) if shuzi.splits(sp, e)}


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


# 11-12 夜盲审七处之六：标重点别标虚词。下面这些词不标（总控列的加同类），一句里挑不出实词就不标。
KW_RULE = {'不标虚词': True}   # 必过考卷的牙单关用
KW_STOP = set("""比如 例如 大家 我们 他们 你们 咱们 她们 它们 对方 自己 别人 人家 开头 然后 就是 这个 那个 这些 那些 这样 那样 这种 那种 这里 那里
有没有 能不能 是不是 会不会 要不要 可不可以 什么 怎么 怎么样 为什么 因为 所以 但是 不过 其实 而且 或者 还是 还有 已经 可能 应该 可以 需要 知道 觉得 认为 发现
不能 不会 不是 没有 不要 提到 说到 讲到 时候 东西 事情 情况 样子 地方 方面 一下 一些 一点 一个 现在 如果 的话 起来 出来 下去 进去 来说 来讲 一样 一般 特别 非常 真的 当然""".split())
KW_TAIL = re.compile(r'[给的了着过地得吧呢吗啊呀把被在]$')        # jieba 偶尔切出「修给」这种带虚字尾巴的，不算实词
KW_XNX = re.compile(r'^(.+)[不没]\1')                                 # 有没有、好不好、可不可靠这类问话的架子


def kw_ok(w):
    """这个词配不配标重点色：不在不标表里、不带虚字尾巴、不是「X不X」的问话架子。"""
    if not KW_RULE['不标虚词']: return True
    return w not in KW_STOP and not KW_TAIL.search(w) and not KW_XNX.match(w)


def find_kw(text, num=True):
    """一行里最值得高亮的词：数字优先，其次图标词，再次 jieba 关键词。num=False：不取数字（没单位的、被切成两半的数）。"""
    d = (shuzi.AR_DEC.search(text) or shuzi.CN_DEC.search(text)) if num and '数字' in FIXES else None
    if d and shuzi.whole_ok(text, d.group(0)): return d.group(0)   # 用「点」说的小数整个高亮：2点4倍、三点五倍（11-09 发版前必修）
    if num and '数块' in FIXES:                             # 11-09 第三轮：数字整块高亮（负5%、1.5个亿、3.85个百分点），不框半个
        for a, b in shuzi.digit_blocks(text):
            w = text[a:b]
            if (re.search(r'[^\d.,]', w) or len(re.sub(r'\D', '', w)) >= 2) and shuzi.whole_ok(text, w): return w
        num = False
    m = next((x for x in NUM_RE.finditer(text) if not re.match(r'[.．]\d', text[x.end():]) and not re.search(r'\d[.．]$', text[:x.start()])), None) if num else None   # 「1.2.0版」这类连着几个点的不框一截（11-09）
    if m and (m.group(2) or len(m.group(1)) >= 2):
        return m.group(0).strip()
    try:
        import jieba.analyse
        tags = jieba.analyse.extract_tags(text, topK=8 if KW_RULE['不标虚词'] else 4, allowPOS=('n', 'nz', 'vn', 'v', 'a', 'an', 'i', 'l'), withFlag=True)
        tags = [w for w, f in sorted(tags, key=lambda x: KW_RULE['不标虚词'] and x.flag in ('a', 'an'))]   # 名词、动词在前，「容易」这种形容词往后放
        tags = [t for t in tags if len(t) >= 2 and t in text and shuzi.whole_ok(text, t) and kw_ok(t)]
        if tags: return tags[0]
    except Exception:
        pass
    return ''


# ---------- 分镜 ----------
def plan(lines, dur, title=None, theme='night', tag=None, audio_end=None):
    """字 + 时间 → 剧本（见 juben.py）。theme 只为兼容旧调用留着，剧本里不放配色，配色归画风。
    audio_end：录音本身多长（片长 dur 可能补了空白）；用来判断录音停的时候话说没说完。"""
    if audio_end is None: audio_end = dur
    for ln in lines:
        ln['text'] = normalize_text(ln['text'])
    T = [clean(ln['text']) for ln in lines]
    n = len(lines); scenes = []; i = 0
    # 中文数字归一（只换配得上数字卡的，见 shuzi.cn_value_ok）：TN 只用来认数，字幕和画面上的字仍用原文
    NI = [shuzi.normalize(t, strict=True) if '中文数字' in FIXES else (t, list(range(len(t)))) for t in T]
    TN = [x[0] for x in NI]
    broken = shuzi.broken_tail(lines) if '数字' in FIXES else {}   # 一个数被切成两行的，两半都不当数

    def is_cue(k):
        s = TN[k]
        return bool(ENUM_RE.match(s) or NUM_RE.search(s) and re.search(r'\d', s) or MYTH_RE.search(s) or OLD_RE.match(s)
                    or NOTBUT_RE.search(s) or COUNT_RE.search(s) or SOFT.match(s) or s.endswith(('？', '?')))

    def add(typ, a, b, **kw):
        scenes.append(dict(type=typ, la=a, lb=b, **kw))

    def q_card(k, a):
        """第 k 句（软开头从第 a 句起）配不配问号卡：真问句、不少于四个字（11-13 总控定：前后停顿这版不管）。"""
        return is_question(T[k]) and len(T[k]) >= 4

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
    elif '封面' in FIXES:
        # 11-10（1.2 复审挑出、新版同样有）：封面和片头顶上那条标题另算，开场大字逐字跳的那几行不动。
        # 字数照老版的数法（听写补回的小数点、负号这些不算），老版出两行的这版也出两行；
        # 第一句被字幕拆成两行、第二行带数的，封面也两行一起放，不再只剩半句（「毛利率从38.2%」后面的「降到31.5%」）。
        ce = 1 if n == 1 or n and n12(T[0]) >= 9 else 2
        ce = min(ce, n)
        if ce == 2 and is_cue(1) and not NUM_RE.search(T[0]): ce = 1
        if ce == 1 and n > 1 and n12(T[0]) + n12(T[1]) <= 22 and lines[1]['t0'] - lines[0]['t1'] < 0.3 and (not is_cue(1) or lines[0].get('se') is False):
            ce = 2
        half = '数块' in FIXES and 0 < ce < n and re.match(r'[到至]\d', T[ce]) and re.search(r'\d', T[ce - 1])   # 11-10 总控改判：封面最后一行后面接着「到5000多万」，范围被拆开了
        if half and ce == 1 and n12(T[0]) + n12(T[1]) <= 26: ce, half = 2, False   # 放得下：两行一起放
        ch = [strip_filler(T[k]) for k in range(ce)]
        if half:                                              # 放不下：这一行的数不上封面，封面停在数前面
            bl = shuzi.blocks(ch[-1]); hd = ch[-1][:bl[-1][0]].rstrip('，,、 ') if bl else ch[-1]
            if len(hd) >= 2: ch[-1] = hd
            elif len(ch) > 1: ch = ch[:-1]
        tl = split_title(''.join(ch) if len(ch) == 1 else ch, n12) if ch else []
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
                if '封面' in FIXES and len(txt) < 2 and len(clean(seg)) >= 2: txt = clean(seg)   # 11-10 第三节第 9 条：「2024年开始的」这行自己有字，用自己的，不借下一句
                if len(txt) < 2 and q == len(ms) - 1 and end < n and not is_cue(end) and not YEAR_RE.search(T[end]) and len(T[end]) <= 12:
                    txt = T[end]; end += 1
                if (len(txt) < 2 and len(ms) == 1) or re.search('[从到在得]$', txt):   # 「这事得从 2008 年说起」：剩下的字说不成一句，不做这个节点；「从2008年到2015年」前一个年份不配字也留着
                    continue
                if broken.get(k) in ('tail', 'both') and q == len(ms) - 1:
                    txt = re.sub(r'[\d.]+$', '', txt)       # 「发电量10 / 58万亿度」：后半个数在下一行，卡上只留「发电量」
                if '数块' in FIXES and not sub_has(lines, k, m.group(1)): continue   # 「二零一九年」归一成的 2019 字幕里没有，不照抄就不画
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
            fact=fact, factFull=T[jf] if len(fact) <= 3 else '', factT=lines[jf]['t0'], icon=scene_icon(''.join(T[:jf + 1]), 'sparkles'),
            mythCut=b_cut(rest0))
        i = jf + 1
    else:
        add('hook', 0, hook_end, icon=scene_icon(''.join(T[:hook_end]), 'sparkles'))
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
            add('pair', lead, j + 1, title=title_txt, items=[dict(text=it, t=char_time(lines, j, it), icon=scene_icon(it)) for it in items])
            i = j + 1; continue
        # 清单：记住三个习惯 + 第一第二第三
        lst = try_list(T, i)
        if lst:
            j, title_txt, items = lst
            add('list', lead, j, title=title_txt,
                items=[dict(head=h, t=lines[k]['t0'], icon=scene_icon(h + T[min(k + 1, n - 1)], None)) for k, h in items])
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
            add('cause', lead, j, A=A, B=B, tA=tA, tB=tB, aLabel=la_, bLabel=lb_, kw=find_kw(B), icon=scene_icon(A + B))
            scenes[-1]['Bcut'] = b_cut(B, scenes[-1]['kw']); scenes[-1]['Acut'] = b_cut(A)
            i = j; continue
        # 区间：20% 到 80%；「三到五分钟」先归一成「3到5分钟」再认，时刻取回原来那几个中文字的
        m = RANGE_RE.search(s); sn = s
        if not (m and (m.group(2) or m.group(4))) and TN[i] != s:
            m = RANGE_RE.search(TN[i]); sn = TN[i]
        rr = None
        if m and (m.group(2) or m.group(4)) and '数块' in FIXES:   # 11-09 第三轮：带子上停住的字只许照抄字幕；中文说的、带负号的、抄不准的不画
            rr = shuzi.plain_range(sn, m.start(1), m.start(3) - 1, m.end()) if sn is s and sub_has(lines, i, sn[m.start(1):m.end()]) else None
            if not rr: m = None
        if m and (m.group(2) or m.group(4)):
            unit = m.group(4) or m.group(2) or ''
            lo, hi = float(m.group(1)), float(m.group(3))
            if sn is s:
                tLo, tHi = char_time(lines, i, m.group(1)), char_time(lines, i, m.group(3), after=m.start(3))
            else:
                tLo, tHi = idx_time(lines, i, NI[i][1][m.start(1)]), idx_time(lines, i, NI[i][1][m.start(3)])
            add('range', lead, i + 1, label=clean(strip_filler(sn[:m.start()])).rstrip('是在为'), lo=lo, hi=hi, unit=unit,
                tLo=tLo, tHi=tHi, max=100 if unit == '%' else nice_max(hi), **(dict(raw=sn[m.start(1):m.end()], rawLo=rr[0], rawHi=rr[1]) if rr else {}))
            i += 1; continue
        # 数字：滚数（下一行还有数字就做成 A → B）
        m = num_in(s); sn = s
        if not m and TN[i] != s:
            m = num_in(TN[i]); sn = TN[i]
        if m and broken.get(i) and ((broken[i] in ('tail', 'both') and re.fullmatch(r'[\d.]+', sn[m[2]:] or 'x') and not m[1])
                                    or (broken[i] in ('head', 'both') and m[2] == 0)):
            m = None                                 # 「发电量10 / 58万亿度」：数被切成两半，哪半都不能单拿出来滚
        if m and '数块' in FIXES and ((i + 1 < n and re.match(r'[到至]\d', T[i + 1]) and re.search(r'\d', T[i])) or (i > 0 and re.match(r'[到至]\d', T[i]) and re.search(r'\d', T[i - 1]))):
            m = None                                 # 11-10 总控改判：范围被拆在两行（「年收入3000多万 / 到5000多万」），哪半都不单画
        if m and not m[1] and '数字' in FIXES:
            nu = shuzi.unit_from_next(lines, i) if sn.endswith(fmt(m[0])) else ''
            if nu: m = (m[0], nu, m[2])              # 「平台的40 / 亿件商品」：单位被切到下一行
        if m and not m[1] and re.search(shuzi.MONEY_PRE if '数字' in FIXES else shuzi.MONEY_PRE.replace('|人均', ''), sn[max(0, m[2] - 6):m[2]]) and m[0] >= 10 \
                and not re.match(r'[\d.,]+\s*[单个人件次点名位台条家只份]', sn[m[2]:]):
            m = (m[0], '元', m[2])                  # 钱字紧挨着这个数才补「元」（盲审：「下个月10号发工资」补成 10元）
        if m and not m[1] and '数字' in FIXES:
            m = None                                 # 没有单位的数（「是41」「100兆番」）观众看不懂，不做数字卡
        raw = None
        if m and '数块' in FIXES:                    # 11-09 第三轮：数字大字停住的字只许照抄字幕；负号、分数、钟点、约数、中文说的、补出来的单位，抄不准就不画
            raw = shuzi.plain_at(sn, m[2]) if sn is s else None
            if not raw or float(raw[0]) != m[0] or not sub_has(lines, i, raw[0] + raw[1]): m = raw = None
            elif shuzi.qual_after(sn, m[2] + len(raw[0] + raw[1])): m = raw = None   # 11-10 第三节第 5 条：「毛利率40%左右」大字只画得出「40%」，标签又不带「左右」，不画
            else: m = (m[0], raw[1], m[2])
        if m:
            v, unit, pos = m
            s = sn
            label = clean(strip_filler(s[:pos])) or ''
            after = clean(s[pos + (len(raw[0]) if raw else len(fmt(v))) + len(unit):])
            sub = [after] if after and after not in ('左右', '以上') else []
            subT = [char_time(lines, i, after)] if sub else []
            j = i + 1; second = None
            while j < n and j < i + 3 and not ENUM_RE.match(T[j]) and not MYTH_RE.search(T[j]) and not SOFT.match(T[j]):
                m2 = num_in(T[j]); sj = T[j]
                if not m2 and '数字' in FIXES and TN[j] != T[j] and (shuzi.AR_DEC.search(T[j]) or shuzi.CN_DEC.search(T[j])):
                    m2 = num_in(TN[j]); sj = TN[j]           # 11-09：下一行是「2点4倍」，拿归一后的「2.4倍」
                raw2 = shuzi.plain_at(sj, m2[2]) if m2 and '数块' in FIXES and sj is T[j] else None
                if raw2 and (float(raw2[0]) != m2[0] or not sub_has(lines, j, raw2[0] + raw2[1])): raw2 = None
                if m2 and raw2: m2 = (m2[0], raw2[1], m2[2])
                if m2 and second is None and len(sub) == 0 and (m2[1] == unit or '数字' not in FIXES) and (raw2 or '数块' not in FIXES):   # 前后两个数单位得一样才连成「A → B」（「443万亿度 / 24倍」不连）；第二个数也得能照抄
                    v2, u2, p2 = m2
                    second = dict(value=v2, unit=u2, label=clean(strip_filler(sj[:p2])),
                                  t=char_time(lines, j, fmt(v2)) if sj is T[j] else idx_time(lines, j, NI[j][1][p2]),
                                  **(dict(raw=raw2[0] + raw2[1], rawN=raw2[0], rawU=raw2[1]) if raw2 else {}))
                    j += 1; continue
                if m2 or second or COUNT_RE.search(T[j]) or len(sub) >= 1 or len(T[j]) > 9: break
                sub.append(T[j]); subT.append(lines[j]['t0']); j += 1
            tone = 'bad' if BAD_RE.search(s + ''.join(sub) + (second['label'] if second else '')) else 'acc'
            tv = char_time(lines, i, fmt(v)) if s is T[i] or fmt(v) in T[i] else idx_time(lines, i, NI[i][1][pos])
            add('stat', lead, j, label=label, value=v, unit=unit, t=tv, sub=sub, subT=subT, second=second, tone=tone,
                icon=scene_icon(s + ''.join(sub)), **(dict(raw=raw[0] + raw[1], rawN=raw[0], rawU=raw[1]) if raw else {}))
            i = j; continue
        # 问句
        if q_card(i, lead):
            add('question', lead, i + 1)
            i += 1; continue
        # 其余：大字逐字跳，最多 3 行一组
        j = i + 1
        while j < n and j < i + 3 and not is_cue(j) and not flip_at(j) and not but_at(j) and not cause_at(j) and lines[j]['t1'] - lines[i]['t0'] < 6.5                 and not (CTA_RE.search(T[j]) and j >= n - 3) \
                and not ('封面' in FIXES and re.search(r'\d', s) and is_question(T[j]) and len(T[j]) >= 4)                 and not (Q_RULE['两条都要'] and q_card(j, j)):   # 11-12 夜盲审七处之二：真问句不并进大字组，自己出问号卡   # 11-10：带数的这句没画数字大字，后面的问句照出问号卡，不并进大字组
            j += 1
        add('say', lead, j, icon=scene_icon(''.join(T[i:j])))
        i = j

    # 最后一组如果是号召（今天就去 / 记得 / 收藏）→ 收尾印章
    # 2026-11-07：半句话不当号召。话停在半截（录音结束时话还没说完、末字是「的 / 更 / 需」这类）、或是过渡话，都不盖章
    last = scenes[-1]
    lt = ''.join(T[last['la']:last['lb']]); tail = T[last['lb'] - 1]
    cut_off = audio_end - lines[last['lb'] - 1]['t1'] < 0.3    # 录音停的时候这句还没说完
    dangling = bool(DANGLE_RE.search(tail)) or len(re.sub('^[啊呃嗯那]+', '', tail)) <= 2
    if '号召' not in FIXES: cut_off = dangling = False
    if last['type'] == 'say' and not cut_off and not dangling and not ('号召' in FIXES and SEGUE_RE.search(lt)) and (CTA_RE.search(lt) or len(scenes) > 3):
        last['type'] = 'cta'

    for ln in lines:   # 标亮词（11-12 夜挪到排卡前面：普通句卡拆卡要按折行算高，折行不许切开标亮词）
        ln['kw'] = find_kw(ln['text'])
        if '数字' in FIXES and re.match(r'[\d.]', ln['kw'] or ''):
            k_ = lines.index(ln); tx = ''.join(c[0] for c in ln['cs'])
            cut_kw = (broken.get(k_) in ('head', 'both') and tx.startswith(ln['kw'])) or (broken.get(k_) in ('tail', 'both') and tx.endswith(ln['kw']))
            at_ = tx.find(ln['kw'])
            bare = re.fullmatch(r'[\d.]+', ln['kw']) and not re.search(shuzi.MONEY_PRE, tx[:at_][-6:]) and not shuzi.unit_after(tx, at_ + len(ln['kw']))
            if cut_kw or bare: ln['kw'] = find_kw(ln['text'], num=False)   # 「是41」「58万亿度（前半在上一行）」不当强调词
    # 时间：镜头从第一句话前 0.15 秒开始，到下一个镜头开始为止
    scenes = cards(scenes, lines, T, dur)   # 11-12 夜盲审七处：普通句卡按停顿分卡、模板做完要停住、数字卡对的数停够 0.8 秒，三样互相牵着，一起排到不再变（见 cards）
    if '句卡' in FIXES: para_fold_all(scenes, lines)                                      # 普通句卡的折点（一排最多八个字），按最后的卡算

    if not tag:
        lst = next((s for s in scenes if s['type'] in ('list', 'pair')), None)
        tag = ((lst.get('title') or f"{len(lst['items'])} 个要点") if lst and lst['type'] == 'list' else '一分钟讲清楚' if dur <= 65 else '讲清楚')  # 角标和封面小字用同一句
    kw2 = find_kw(''.join(tl)); w2 = '封面' in FIXES and len(tl) == 2
    cover = dict(title=[mark(x, kw2, w2) for x in tl], kicker=next((s['title'] for s in scenes if s['type'] == 'list' and s.get('title')), tag),
                 icon=scenes[0]['icon'])
    for sc in scenes:   # 对比卡两边的长句：给拆两行的词边界
        if sc['type'] == 'myth' and not sc.get('mythCut'):   # 中段误区卡（开场那张在上面已给）
            sc['mythCut'] = b_cut(sc['myth'])
        if sc['type'] == 'list':
            for it in sc['items']: it['cut'] = b_cut(it['head'])
        if sc['type'] == 'compare':
            if CMP_RULE['去语气字']:
                for side in (sc['L'], sc['R']): side['text'] = cmp_clean(side['text'])
            for side in (sc['L'], sc['R']):
                side['cut'] = b_cut(side['text'])
            if CMP_RULE['每句都上']: cmp_parts(sc, lines)

    p = dict(dur=round(dur, 3), theme=theme, tag=tag, title=[mark(x, kw2, w2) for x in tl], cover=cover,
             lines=[dict(t0=l['t0'], t1=l['t1'], cs=l['cs'], kw=l['kw'], **({'pcut': l['pcut']} if l.get('pcut') else {})) for l in lines], scenes=scenes)
    # 2026-11-07：句型之外再跑 rules（词组、上屏词、主角词、上下……），并成一份剧本返回
    import json as _json, rules, juben
    ev = rules.build(_json.loads(_json.dumps(p)))
    p['_nums'] = [shuzi.line_nums(l, k, p['lines'], broken) for k, l in enumerate(p['lines'])]
    return juben.assemble(p, ev)


def timing(scenes, lines, dur):
    """镜头从第一句话前 0.15 秒开始（和上一个镜头至少隔 0.8 秒），到下一个镜头开始为止。"""
    for k, sc in enumerate(scenes):
        sc['t0'] = 0.0 if k == 0 else max(scenes[k - 1]['t0'] + 0.8, lines[sc['la']]['t0'] - 0.15)
    for k, sc in enumerate(scenes):
        sc['t1'] = scenes[k + 1]['t0'] if k + 1 < len(scenes) else dur


# ---------- 普通句卡新排法：折行、字号、拆卡（11-12 夜总控改规矩，和 seek.js 的 sayPara 一个算法，两边一起改） ----------
# 一排最多八个字，超了按词折行；字号下限 90、上限 120（说过的缩到八成，不小于 72，缩到 360 宽够 24 像素高）。
# 字宽：中文一个字算 1，字母数字一个算 0.62（「ai」这种两个字母的字块算 1.24）。折点记的是第几个字块前折（不是第几个字）。
# 一句的卡居中，排出来最宽 640（推近 1.03 倍右边才不过 870）：一排最多 7 个字，8 个 90 号字 720 宽放不下。
# 禁止那句被圈的词两边各让出 0.36 个字的空：这句一排再少一个字。
# 一张卡这样排完的高（舞台 46 到 744，共 698）装不下，拆成两张；拆在哪：拆出来张数最少，再比最高那张最矮，再比前一张句子多。
PARA_ROW, PARA_ROW1 = 8, 7
PARA_FS = (90, 120)
PARA_W, PARA_W1 = 720, 640
PARA_LH, PARA_SHR, PARA_GAP, PARA_HMAX = 1.16, 0.8, 0.3, 694     # 698 留 4 像素余量
PARA_RULE = {'按词折': True, '不切标亮词': True, '语气字不打头': True, '拆卡': True, '问号卡': True}   # 必过考卷的牙单关用；软件里一直开着
PARA_HEAD = '的了呀啊吧呢'                                          # 新一排不拿这几个字开头


def _uw(u):
    return sum(1 if ord(ch) >= 0x2e80 else 0.62 for ch in u)


def para_fold(ln, m, keep=()):
    """这一句折成每排不超过 m 个字宽。返回折点列表（第几个字块前折），放得下返回 []；keep 里的段（模板的词）折不全返回 None。
    按词折：只在切词边界折（数块整块）；不切开标亮词和 keep；新一排不拿「的了呀啊吧呢」开头；每排至少两个字块。
    排数最少；排数一样，最长那排最短；再一样，各排最齐；再一样，前面的排长。
    按词折不出来（有比一排还长的词）放开词边界；还不行放开开头字和两个字块；标亮词实在折不全就不管它（keep 不放）。"""
    import rules
    from itertools import combinations
    us = [c[0] for c in ln['cs']]; n = len(us); w = [_uw(u) for u in us]
    pre = [0.0]
    for x in w: pre.append(pre[-1] + x)
    if pre[-1] <= m + 1e-6: return []
    s = ''.join(us); pos = [0]
    for u in us: pos.append(pos[-1] + len(u))
    unit = {p: k for k, p in enumerate(pos)}
    def to_units(a, b):                                   # 字的位置换成字块的位置
        ua = max(k for k, p in enumerate(pos[:-1]) if p <= a); ub = min(k for k, p in enumerate(pos) if p >= b)
        return ua, ub
    kws = []
    kw = ln.get('kw') or ''
    if kw and s.find(kw) >= 0 and PARA_RULE['不切标亮词']: kws.append(to_units(s.find(kw), s.find(kw) + len(kw)))
    hard = [to_units(a, b) for a, b in keep]
    wb, at = set(), 0
    for tk in rules.cuts(s):
        at += len(tk)
        if at in unit: wb.add(unit[at])
    def best(spans, words, strict):
        C = [c for c in range(1, n) if not any(a < c < b for a, b in spans) and (c in wb or not words)
             and not (strict and PARA_RULE['语气字不打头'] and us[c][:1] in PARA_HEAD)]
        for r in range(1, n):
            got = None
            for cs in combinations(C, r):
                bd = (0,) + cs + (n,)
                if strict and any(bd[i + 1] - bd[i] < 2 for i in range(r + 1)): continue
                rows = [pre[bd[i + 1]] - pre[bd[i]] for i in range(r + 1)]
                if max(rows) > m + 1e-6: continue
                mean = pre[-1] / (r + 1)
                key = (round(max(rows), 3), round(sum((x - mean) ** 2 for x in rows), 3), tuple(-x for x in rows))
                if got is None or key < got[0]: got = (key, list(cs))
            if got: return got[1]
            if r + 1 > len(C): return None
        return None
    tiers = [(True, True), (False, True), (False, False)] if PARA_RULE['按词折'] else [(False, False)]
    for spans in (kws + hard, hard):
        for words, strict in tiers:
            got = best(spans, words, strict)
            if got is not None: return got
    if hard: return None
    out, acc = [], 0.0                                    # 一个字块就比一排宽（很长的英文）：一块一排
    for k, x in enumerate(w):
        if k and acc + x > m + 1e-6: out.append(k); acc = 0.0
        acc += x
    return out


def para_rows(ln, cuts):
    """按折点算每排多宽（字宽单位）。"""
    w = [_uw(c[0]) for c in ln['cs']]; bd = [0] + list(cuts or []) + [len(w)]
    return [sum(w[bd[i]:bd[i + 1]]) for i in range(len(bd) - 1)]


def _para_tpl(sc):
    tp = sc.get('tpl')
    return tp if tp and tp.get('kind') in TPL_TEXT else None


def para_card(lines, a, b, tp=None):
    """普通句卡 [a,b) 按新排法排：每句的折点、整卡字号、停住时多高。tp 是这张卡上只动字的模板（禁止、举例），没有给 None。
    返回 (cuts, fs, H)；模板那句的词折不全（被圈的词和否定词要在一排、举例那句要一排放下）返回 None。"""
    one = b - a == 1; W = PARA_W1 if one else PARA_W; m0 = PARA_ROW1 if one else PARA_ROW
    cuts, rows = {}, {}
    for i in range(a, b):
        keep, m = (), m0
        if tp and tp['line'] == i:
            if tp['kind'] == 'ban': keep, m = [(tp['neg'][0], tp['obj'][1])], m0 - 1
            elif tp['kind'] in ('attn', 'auto'): keep, m = [tuple(tp['key'])], m0 - 1   # 1.3.2：框、勾要让出空，这句一排少一个字
            elif tp['kind'] == 'quote': m = m0 - 1                                     # 对话框左右各让出一点
            else: keep = [tuple(tp['key'])]
        c = para_fold(lines[i], m, keep)
        if c is None or (tp and tp['line'] == i and tp['kind'] == 'example' and c): return None
        cuts[i] = c; rows[i] = para_rows(lines[i], c)
    fs = int(max(PARA_FS[0], min(PARA_FS[1], W // max(1e-6, max(max(r) for r in rows.values())))))
    if tp and tp['kind'] in ('ban', 'attn', 'auto', 'quote'):   # 被圈、被框、打勾的词那排连让出的空也得放下；对话框每排都让
        li = tp['line']; bd = [0] + cuts[li] + [len(lines[li]['cs'])]
        if tp['kind'] == 'quote': need = max(rows[li]) + 0.72
        else: o0 = tp['obj'][0]; k = max(j for j in range(len(bd) - 1) if bd[j] <= o0); need = rows[li][k] + 0.72
        fs = min(fs, int(W // need))
        if fs < PARA_FS[0]: return None
    def height(fs):
        G = round(fs * PARA_GAP); hs = []
        for i in range(a, b):
            h = len(rows[i]) * fs * PARA_LH
            if tp and tp['kind'] == 'example' and tp['line'] == i:   # 拎下来的词往下落 150、放大，算进这句的高
                h1 = fs * PARA_LH; h = max(h, h1 / 2 + 150 + h1 * min(1.5, 150 / fs) / 2 + 6)
            if tp and tp['kind'] == 'quote' and tp['line'] == i: h += fs * 0.4   # 对话框上下各让 0.2 个字号
            hs.append(h)
        return sum(h * PARA_SHR + G for h in hs[:-1]) + hs[-1]
    H = height(fs)
    while CARD_RULE['先缩字'] and H > PARA_HMAX and fs > PARA_FS[0]:   # 11-12 夜盲审七处之四：高装不下先缩字，缩到 90 为止，还装不下才拆（seek.js sayPara 同一算法）
        fs -= 1; H = height(fs)
    return cuts, fs, H


def para_split(lines, a, b, tp_of):
    """普通句卡 [a,b) 装不下就拆。tp_of(a, b) 给出这一截会挂的只动字模板（没有给 None）。返回 [(a, b), ...]。"""
    def fits(x, y):
        r = para_card(lines, x, y, tp_of(x, y))
        if r is None: r = para_card(lines, x, y, None)
        return r[2] <= PARA_HMAX
    if b - a <= 1 or fits(a, b) or not PARA_RULE['拆卡']: return [(a, b)]
    got = None
    for c in range(a + 1, b):
        L, R = para_split(lines, a, c, tp_of), para_split(lines, c, b, tp_of)
        hmax = max((para_card(lines, x, y, tp_of(x, y)) or para_card(lines, x, y, None))[2] for x, y in L + R)
        key = (len(L) + len(R), round(hmax, 1), -(c - a))
        if got is None or key < got[0]: got = (key, L + R)
    return got[1]


def para_fold_all(scenes, lines):
    """按最后的卡给普通句卡、问号卡每句写折点 pcut（列表）；不用折的不写。带图形模板那张卡不是这个排法，不写。"""
    for ln in lines: ln.pop('pcut', None)
    for sc in scenes:
        if sc['type'] == 'question' and PARA_RULE['问号卡']:   # 问号卡下面那句（11-12 夜总控）：照一句的普通句卡折，一排最多七个字；带软开头的两句各折各的，不拆卡
            for i in range(sc['la'], sc['lb']):
                c = para_fold(lines[i], PARA_ROW1)
                if c: lines[i]['pcut'] = c
            continue
        if sc['type'] != 'say' or (sc.get('tpl') and sc['tpl']['kind'] in TPL_GRAPH): continue
        r = para_card(lines, sc['la'], sc['lb'], _para_tpl(sc))
        if r is None:                                      # 模板那句折不全：这张卡不用模板
            sc.pop('tpl', None); r = para_card(lines, sc['la'], sc['lb'], None)
        for i, c in r[0].items():
            if c: lines[i]['pcut'] = c


def para_fold_line(j, l):
    """云端写手换了标亮词以后，这一句的折点照这张卡重算（xieshou._merge_line 用）。j 是剧本，l 是 j['lines'] 里的一句。"""
    l.pop('pcut', None)
    sc = next((s for s in j.get('scenes', []) if s.get('type') in ('say', 'question') and s['la'] <= l['i'] < s['lb']), None)
    if not sc or (sc.get('tpl') and sc['tpl'].get('kind') in TPL_GRAPH): return
    if sc['type'] == 'question':
        if not PARA_RULE['问号卡']: return
        c = para_fold(l, PARA_ROW1)
        if c: l['pcut'] = c
        return
    tp = _para_tpl(sc); r = para_card(j['lines'], sc['la'], sc['lb'], tp) or para_card(j['lines'], sc['la'], sc['lb'], None)
    c = r[0].get(l['i'])
    if c: l['pcut'] = c


# ---------- 按意思挂的模板（1.3.2，11-13 夜总控定十种；钱不单做，钱数照旧走数字卡） ----------
# 方案：画风重做_2026-11-12/说法模板与底色_方案.md 第三、四节；1.3.2 单子在共用笔记夹「口播成片_1.3.2模板单子_1113.md」。认字眼在这里，画风（seek.js）只照 scenes[].tpl 画，不自己猜。
# 只动字的（接在普通句卡新排法里，这句变灰缩小时记号留在原地到卡结束）：
#   禁止·圈加斜杠（ban）、举例·拎出来（example）、注意·框住和四个角（attn）、自动化·打勾（auto）、引话·对话框（quote：框住说出来的那句话）。
# 带图形的（认出的那句是这张卡最后一句，在它后面换卡）：时间·圆盘钟点和长条（time）、增长·拉开、往上和多出一截（grow）、下降·往下（drop）。
# 自己一整张卡的：排比（para，三条以上，一张卡）。
# 一句只用一个，先后是禁止、增长、下降、时间、注意、自动化、举例（方案第三节第 11 条，钱不带）；引话、排比几句一起认，排比那几句里只动字的模板、引话让给排比。
# 一张卡一个。只挂在普通句卡（say）上。一条片里每种最多 4 次（引话最多 6 次）；紧挨着的两张卡不用同一种；同一个钟点 10 秒内第二遍不用。
# 停多久（时间以「开始淡出」为准，不以换完为准）：
#   只动字的：主动作做完到这张卡开始淡出不少于 0.5 秒；这句是卡尾、停不够的，下一张卡可以等那句开口才换（借 0.15 秒，字不比嘴晚；
#     下一张是数字卡、年份卡、区间卡的不借，它们停不停得够照原来的换卡时刻算）；还不够就不用。不为它拖卡。
#   带图形的：主动作最晚在关键词最后一个字开口时做完；做完到开始淡出不少于 0.8 秒；不借下一句，下一张卡最晚在那句开口时换（11-13 夜总控：字不许比嘴晚，盖过 11-12 的借 0.15 秒）；不够就不用。
#   排比：最后一条开口后 0.3 秒出齐，出齐到开始淡出不少于 0.5 秒。
# 分卡（1.3.2）：连着两句认出同一种带图形的（钟点除外），合成一张卡；带图形的那句，前一句和它是一口气（停不到 0.2 秒）的，一起上这张卡。
# 卡怎么退（seek.js 卡的进退）：换卡时刻 t1 前 0.26 秒开始淡出，t1 后 0.05 秒退完。
TPL_FADE, TPL_GONE, TPL_BORROW, TPL_TBORROW = 0.26, 0.05, 0.0, 0.15   # 带图形的不借（11-13 夜总控，原 0.15）
TPL_HOLD = {'ban': 0.5, 'example': 0.5, 'attn': 0.5, 'auto': 0.5, 'quote': 0.5, 'para': 0.5, 'time': 0.8, 'grow': 0.8, 'drop': 0.8}
TPL_GRAPH = ('time', 'grow', 'drop')
TPL_TEXT = ('ban', 'example', 'attn', 'auto', 'quote')
TPL_BLOCK = ('para',)
TPL_NUMCARD = ('stat', 'year', 'range')
TPL_MAX, TPL_MAXK = 4, {'quote': 6}
TPL_NAME = {'ban': '圈加斜杠', 'example': '拎出来', 'time': '圆盘钟点', 'grow': '拉开', 'drop': '往下', 'attn': '框住', 'auto': '打勾', 'para': '排比', 'quote': '对话框'}   # 修改页上那颗签的名字（画风登记用）
TPL_VNAME = {'bar': '长条', 'rise': '往上', 'extra': '多出一截', 'corner': '四个角'}   # 同一种里换了画法的，签上写这个
BAN_NEG = ('不能', '不许', '不让', '不要', '不准', '禁止', '别')
BAN_NEVER = ('叫停', '禁止', '限制', '拦住', '不许', '不准', '不让', '不要', '不能')          # 这类词自己就是禁，永远不许被圈
BAN_SOFT = ('这样', '那样', '这么', '那么', '这个', '那个', '什么', '怎么', '一直', '总是', '老是', '再', '还')
PARTS = '了啊呀吧呢嘛哈哦啦的'
PRON = ('你', '我', '他', '她', '它', '咱', '大家', '人家', '别人', '自己')
EX_PAT = (re.compile(r'(?:就)?拿(.{2,8}?)(?:的例子)?来说([啊呀吧呢嘛哈]*)$'), re.compile(r'以(.{2,8}?)为例([啊呀吧呢嘛哈]*)$'),
          re.compile(r'比如(.{2,8}?)([啊呀吧呢嘛哈]*)$'))
EX_Q = ('一部分', '一些', '这种', '这类', '某些', '某个', '某种')     # 1.3.2：被举的东西前面的数量词去掉再认（拿一部分医药来说 → 医药）
# 「不许用」那几条、不连用、1.3.2 加的几条，必过考卷的牙一条条单关
TPL_RULE = {'正反问': True, '切词边界': True, '语气词收尾': True, '认识的词': True, '区间和小数': True, '不连用': True,
            '否定不算': True, '功能名不算': True, '注意到不算': True, '不是引话': True, '应答不算': True, '至少三个字': True,
            '两句合一张': True, '带上前一句': True}
CLOCK_RE = re.compile(r'(早上|上午|中午|下午|傍晚|晚上|凌晨|夜里)(\d{1,2}|[一二两三四五六七八九十]{1,3})点(半|钟)?')


def _toks(s):
    import rules
    out, at = [], 0
    for w in rules.cuts(s):
        out.append((at, at + len(w), w)); at += len(w)
    return out


def _known(w):
    """切词工具认识的词（词典里有），或纯字母数字。听写错字（「品完」）多半不认识，挡一部分。"""
    if re.fullmatch(r'[A-Za-z0-9]+', w): return True
    try:
        import jieba
        return (jieba.get_FREQ(w) or 0) > 0
    except Exception:
        return False


def tpl_ban(s, tk):
    """禁止·圈加斜杠：否定词（不能、不许、不让、不要、不准、禁止、别）后面紧跟一个切词切出来的完整的词，2 到 6 个字，后面到句尾只剩语气词。
    「能不能、要不要」这种正反问不算；否定词必须单独切成一个词（差别、区别、特别、别人里的「别」都不算）；「别太……」是提醒不是禁止；
    「不能不」是双重否定；被圈的不许是叫停、禁止、限制这类自己就是禁的词。"""
    starts = {a for a, _, _ in tk}; ends = {b for _, b, _ in tk}
    for neg in BAN_NEG:
        p = s.find(neg)
        while p >= 0:
            e = p + len(neg)
            ok = (p in starts and e in ends) or not TPL_RULE['切词边界']   # 否定词要切词切出来单独一个词：差别、特别、别人里的「别」，不受、不得不里的「不」都不算
            if ok and TPL_RULE['正反问'] and neg.startswith('不') and p > 0 and s[p - 1] == s[p + 1]: ok = False   # 能不能、要不要
            if ok and s[e:e + 1] == '不': ok = False
            ob = next(((a, b, w) for a, b, w in tk if a == e), None)
            if ok and ob:
                a, b, w = ob
                if (2 <= b - a <= 6 and re.fullmatch(r'[\u4e00-\u9fffA-Za-z0-9]+', w) and w not in BAN_NEVER and not w.startswith(('太', '不', '没'))
                        and w not in BAN_SOFT and not w.startswith(PRON) and (all(c in PARTS for c in s[b:]) or not TPL_RULE['语气词收尾'])):
                    return dict(kind='ban', var='slash', neg=[p, e], obj=[a, b], key=[a, b], word=w)
            p = s.find(neg, p + 1)
    return None


def tpl_grow(s, tk):
    """增长·拉开：这句同时有「拉开」和「差距」（或「差别」）。「拉开」前面紧挨着不、没、别（没有拉开差距）的不认。"""
    p = s.find('拉开'); q = max(s.find('差距'), s.find('差别'))
    if p < 0 or q < 0 or q < p + 2: return None
    if s[max(0, p - 1):p] in ('不', '没', '别') or s[max(0, p - 2):p] == '没有': return None
    n = len(s)
    if n <= 9: rows = [(0, n)]
    elif max(p, n - p) <= 10 and p >= 3: rows = [(0, p), (p, n)]   # 第二排从「拉开」起
    else:
        c = b_cut(s)
        if not c or max(c, n - c) > 10: return None
        rows = [(0, c), (c, n)]
    size = min(110, int(740 / max(b - a for a, b in rows)))
    if size < 72: return None
    acc = [[p, p + 2], [q, q + 2]]
    return dict(kind='grow', var='spread', start=p, up=min(p + 2, q), last=q + 1, key=[p, q + 2], word=s[q:q + 2],
                rows=[dict(a=a, b=b, size=size, acc=[x for x in acc if a <= x[0] < b]) for a, b in rows])


def tpl_clock(s, tk):
    """时间·圆盘钟点：钟点前面要有早上、上午、下午、晚上、凌晨这类词；点后面还跟着数字的是小数；两个数带「到」的是区间，不认。"""
    m = CLOCK_RE.search(s)
    if not m: return None
    h = m.group(2); hour = int(h) if h.isdigit() else cn2num(h)
    if not 1 <= hour <= 12: return None
    a, e = m.span()
    if TPL_RULE['区间和小数'] and (re.match(r'[\d零一二两三四五六七八九十]', s[e:e + 1]) or s[e:e + 1] in ('到', '至') or s[max(0, a - 1):a] in ('到', '至')): return None
    if len(CLOCK_RE.findall(s)) > 1: return None
    di = m.start(2)
    if e > 7 or len(s) - e > 10: return None                      # 上排（钟点和它前面的字）最多 7 个字、下排最多 10 个字，再多字就小过 72 了
    return dict(kind='time', var='clock', key=[a, e], hour=hour, minute=30 if m.group(3) == '半' else 0, digit=di, word=s[a:e])


def tpl_example(s, tk):
    """举例·拎出来：「拿某某来说」「拿某某的例子来说」「就拿某某来说」「以某某为例」「比如某某」，某某后面最多只跟语气词。
    这一版只带拎出来：某某 2 到 3 个字；某某不许是你我他、大家这类；必须是切词切出来的完整的词，而且切词工具认识（听写错字放大最扎眼）。
    拎出来要这句一排放得下（不超过八个字；一句的卡七个字，排卡时再查）。"""
    if len(s) > PARA_ROW: return None
    starts = {a for a, _, _ in tk}; ends = {b for _, b, _ in tk}
    for pat in EX_PAT:
        m = pat.search(s)
        if not m: continue
        a, b = m.span(1); x = m.group(1)
        q = next((q for q in EX_Q if x.startswith(q)), '')            # 1.3.2：拿一部分医药来说 → 拎「医药」
        a += len(q); x = x[len(q):]
        if not 2 <= len(x) <= 3 or x.startswith(PRON) or x.startswith('说') or a not in starts or b not in ends: continue
        if TPL_RULE['认识的词'] and not all(_known(w) for a2, b2, w in tk if a <= a2 and b2 <= b): continue
        return dict(kind='example', var='lift', key=[a, b], word=x)
    return None


NEG_WIN = 3
RISE_RE = re.compile(r'涨了|涨到|上涨|增长了|增长到|增加了|提高了|提升了|翻了?一?倍|翻番|越来越(?:多|高|大|贵|快|强)')
DROP_RE = re.compile(r'跌了|下跌|跌到|暴跌|大跌|下降了?|降了|降到|降价|降低了|减少了|少了一半|缩水|下滑|腰斩')
DROP_FUNC = ('提醒', '通知', '模式', '功能')
PCT_RE = re.compile(r'(\d+(?:\.\d+)?)%')
LONG_RE = re.compile(r'(?:很长|好长|挺长|那么长)(?:的|一段)?时间|太?耗时间|好久|很久|老半天|等了?半天'
                     r'|(?:持续|坚持)了?(?:好几|十几|几十|好些|几)(?:年|个月|天|小时)|(?:花了?|用了?|等了?|干了?|做了?)(?:好几|十几|几十|好些)(?:年|个月|天|小时)'
                     r'|^(?:好几|十几|几十)(?:年|个月)$')
LONG_NOT = ('好久不见', '很久以前', '很久之前', '好久以前', '好久没')
DANGER_RE = re.compile(r'踩坑|踩雷|有坑|大坑|是个坑|有风险|风险(?:很|太|更|非常|特别)?(?:大|高)|异常|小心|当心|警惕')
REMIND_RE = re.compile(r'记着|记住|注意|留意')
ATTN_SKIP = ('这个', '那个', '一下', '一定', '这', '那', '好', '着', '了')
ATTN_STOP = PRON + BAN_SOFT + ('一下', '一点', '一定', '千万', '我们', '你们', '时候', '的是', '这些', '那些', '就是', '事情', '东西', '事项')
ATTN_HYPO = ('认定', '如果', '要是', '是否', '若是', '一旦', '假如', '万一')   # 「认定有风险就能叫停」「如果有风险」：假设的话，不是在提醒观众
AUTO_RE = re.compile(r'(?:帮你|替你|帮我|替我|自动)(?:.{0,6}?)(办好|定好|订好|弄好|搞定|做好|买好|写好|整理好|下好单|找好|安排好|办妥)')
QUOTE_WHO = r'记者|用户|网友|AI|ai|他|她|你|朋友|老板|客户|医生|老师|助手|有人|对方|专家'
QUOTE_RE = re.compile(rf'(?:{QUOTE_WHO}).{{0,6}}?(?:问了?(?:{QUOTE_WHO})?|回答(?:{QUOTE_WHO})?说|说)$')
QUOTE_NOT = ('听说', '就是说', '比如说', '也就是说', '所以说', '怎么说', '再说', '来说', '据说', '可以说', '虽说', '话说', '说说', '不用说', '应该说')
PARA_ACK = ('对', '是', '好', '行', '嗯', '对对', '是的', '好的', '对吧', '没错', '可以', '对对对', '没问题', '是这样', '就是这样', '没错没错', '好的好的', '可以可以', '是的是的')
PARA_TAIL = '啊呀呢吧嘛哈哎哦'
PARA_HEAD_NOT = ('我们', '你们', '他们', '大家', '这个', '那个', '然后', '所以', '但是', '其实', '就是', '因为', '如果', '现在', '今天')   # 甲：拿这些开头的连着三句，多半是在讲经过，不算排比
PARA_IW, PARA_IROW = 720, 9                      # 排比：一排最宽 720、最多九个字（1.3.2 第二批：和普通句卡一样从 136 排起，右边才不过 870；原 760）
G_TEXT_H = 350                                   # 带图形的模板，字那块最高（舞台 46 到 396，图形画在下面）：每排高 = 字号 × 1.16 × 0.86，排间 20


def _negged(s, a):
    """a 前面三个字以内有不、没、别（没有上涨、不会再涨、别涨了、没帮你办好）。宁可不出：「不仅收入翻了一倍」也不认。"""
    return TPL_RULE['否定不算'] and any(c in '不没别' for c in s[max(0, a - NEG_WIN):a])


def _g_rows(s, p, acc, line=None):
    """带图形的模板那句怎么排字（和拉开一个排法）：九个字以内一排；长了从关键词前折，或者按词折，一排最多十个字；字号 72 到 110。排不下返回 None。"""
    n = len(s)
    if n <= 9: rows = [(0, n)]
    elif max(p, n - p) <= 10 and p >= 3: rows = [(0, p), (p, n)]
    else:
        c = b_cut(s)
        if not c or max(c, n - c) > 10: return None
        rows = [(0, c), (c, n)]
    size = min(110, int(740 / max(b - a for a, b in rows)))
    if size < 72: return None
    out = [dict(a=a, b=b, size=size, acc=[x for x in acc if a <= x[0] < b]) for a, b in rows]
    return [dict(r, line=line) for r in out] if line is not None else out


def _g_fit(rows):
    """几排字（带图形的模板）统一字号：从各排能用的最小那个往下试，高不过 G_TEXT_H；到 72 还放不下返回 None。"""
    for sz in range(min(110, min(r['size'] for r in rows)), 71, -1):
        if sum(sz * PARA_LH * 0.86 for _ in rows) + 20 * (len(rows) - 1) <= G_TEXT_H + 1e-6: return sz
    return None


def _g_merge(lines, f, x):
    """带图形的模板那张卡带上前面的句子 [f, 认出的那句)：前面的句子各排一到两排（一排最多十个字），排在上面；整卡统一字号。排不下返回 None。"""
    li = x['line']; rows = []
    for k in range(f, li):
        s = _ltxt(lines, k); n = len(s)
        if n <= 10: rr = [(0, n)]
        else:
            c = b_cut(s)
            if not c or max(c, n - c) > 10: return None
            rr = [(0, c), (c, n)]
        rows += [dict(line=k, a=a, b=b, size=min(110, int(740 / (b - a))), acc=[]) for a, b in rr]
    rows += [dict(r, line=li) for r in x['rows']]
    sz = _g_fit(rows)
    return [dict(r, size=sz) for r in rows] if sz else None


def _focus(w):
    """被框的重点词：2 到 4 个汉字、切词工具认识、不是你我他、这个那个这类。"""
    return 2 <= len(w) <= 4 and re.fullmatch(r'[\u4e00-\u9fff]+', w) and w not in ATTN_STOP and not w.startswith(PRON) and _known(w)


def tpl_trend(s, tk, kind):
    """增长·往上（grow/rise，有百分数的 grow/extra 多出一截）、下降·往下（drop/fall）：涨了、增长了、翻倍、越来越多 / 跌了、下降、减少了、缩水……
    切词边界上的词才算（投降了的「降了」不算）；前面三个字以内有不、没、别的不认；「降价提醒」这种功能名不认。"""
    starts = {a for a, _, _ in tk}
    for m in (RISE_RE if kind == 'grow' else DROP_RE).finditer(s):
        a, b = m.span()
        if TPL_RULE['切词边界'] and a not in starts: continue
        if _negged(s, a): continue
        if kind == 'drop' and TPL_RULE['功能名不算'] and s[b:b + 2] in DROP_FUNC: continue
        x = dict(kind=kind, var='rise' if kind == 'grow' else 'fall', start=a, key=[a, b], word=m.group(0))
        n = PCT_RE.match(s, b) or PCT_RE.match(s, b + 1)
        if n:
            x['key'] = [a, n.end()]; x['num'] = n.start()
            v = float(n.group(1)) / 100
            if kind == 'grow' and 0.05 <= v <= 9: x.update(var='extra', value=v)
        rows = _g_rows(s, a, [x['key']])
        if not rows: return None
        x['rows'] = rows
        return x
    return None


def tpl_long(s, tk):
    """时间·长条（time/bar）：没有确数的久。很长的时间、太耗时间、好久、等了半天、持续几年、整句就是「十几年」。
    「好久不见」「很久以前」不认；前面三个字以内有不、没、别的不认（不用等很久）。"""
    if any(w in s for w in LONG_NOT): return None
    m = LONG_RE.search(s)
    if not m or _negged(s, m.start()): return None
    a, b = m.span()
    rows = _g_rows(s, a, [[a, b]])
    return dict(kind='time', var='bar', mode='endless', key=[a, b], word=m.group(0), rows=rows) if rows else None


def tpl_attn(s, tk):
    """注意（1.3.2 改法，11-12 盲审「框错了词」「只是记号」）：
    危险类（踩坑、有坑、有风险、风险大、异常、小心、当心、警惕）四个角、坏色，框危险的那个词；「小心骗子」框「骗子」，小心后面没有词的不认；
    「小心翼翼」「不小心」「没有风险」「异常值」「异常检测」不认。
    提醒类（记着、记住、注意、留意）框这句的重点词，不框「记着」本身：「这个细节大家记着」框「细节」，「注意安全」框「安全」；找不到重点词的（别高兴太早）不出；
    「注意到」（看见了）「注意力」「记住了」不认。"""
    starts = {a for a, _, _ in tk}; ends = {b for _, b, _ in tk}
    m = DANGER_RE.search(s)
    if m:
        a, b = m.span(); w = m.group(0)
        if (a in starts or not TPL_RULE['切词边界']) and not _negged(s, a) and s[b:b + 1] not in ('翼', '值', '检', '测') and not any(h in s[max(0, a - 4):a] for h in ATTN_HYPO):
            key = None
            if w in ('小心', '当心', '警惕'):
                ob = next(((p, q, x) for p, q, x in tk if p == b), None)
                if ob and _focus(ob[2]): key = [ob[0], ob[1]]
            elif '风险' in w: p = s.find('风险', a); key = [p, p + 2]
            else: key = [a, b]
            if key: return dict(kind='attn', var='corner', color='bad', key=key, obj=key, word=s[key[0]:key[1]])
    m = REMIND_RE.search(s)
    if not m: return None
    a, b = m.span()
    if TPL_RULE['切词边界'] and a not in starts: return None
    if TPL_RULE['注意到不算'] and s[b:b + 1] in ('到', '力', '了', '的'): return None   # 「需要大家注意的是」要注意的在下一句，这句不框
    toks = list(tk); key = None
    q = next((q for p, q, x in toks if p == a), b)
    if q > b:                                              # 「注意安全」切词切成一个词：框后半「安全」
        return dict(kind='attn', var='frame', color='acc', key=[b, q], obj=[b, q], word=s[b:q]) if _focus(s[b:q]) else None
    for j, (p, q, x) in enumerate(toks):                   # 这个细节大家记着：「这个」「这」后面紧跟的那个词
        if q <= a and x in ('这个', '那个', '这', '那') and j + 1 < len(toks) and toks[j + 1][1] <= a and _focus(toks[j + 1][2]):
            key = [toks[j + 1][0], toks[j + 1][1]]
    if not key:                                            # 注意安全、记住这一点：动词后面那个词（跳过这个、一下、一定）
        for p, q, x in toks:
            if p < b: continue
            if x in ATTN_SKIP: continue
            if _focus(x): key = [p, q]
            break
    return dict(kind='attn', var='frame', color='acc', key=key, obj=key, word=s[key[0]:key[1]]) if key else None


def tpl_auto(s, tk):
    """自动化·打勾：帮你、替你、帮我、自动……后面六个字以内跟着办成了的词（办好、定好、搞定、做好、买好……），在这个词旁边打勾。
    只说「帮你找」、没说办成的不认（不知道办成了什么，画不出）；前面三个字以内有不、没、别的不认（没帮你办好）。"""
    m = AUTO_RE.search(s)
    if not m or _negged(s, m.start()) or _negged(s, m.start(1)): return None
    a, b = m.span(1)
    return dict(kind='auto', var='tick', key=[a, b], obj=[a, b], word=m.group(1))


def quote_src(s):
    """这句是不是在引一个人的话：以「说、问、问了、回答说」收尾（后面只剩语气字），前面六个字以内有说话的人（记者、用户、AI、你、他……）。
    「听说、就是说、比如说、对你来说」这类不是引话。"""
    s = re.sub(r'[啊呀呢吧嘛哈哎]+$', '', s)
    if TPL_RULE['不是引话'] and s.endswith(QUOTE_NOT): return False
    return bool(QUOTE_RE.search(s))


def _bare(t): return re.sub(f'[{PARA_TAIL}]+$', '', t)


def _para_short(T, k):
    t = _bare(T[k])
    return ((3 if TPL_RULE['至少三个字'] else 1) <= len(t) <= 5 and not (TPL_RULE['应答不算'] and t in PARA_ACK)
            and not quote_src(T[k]) and not t.startswith('比如'))


def para_fit(lines, g):
    """排比那张卡怎么排（和 seek.js 的排比一个算法，两边一起改）。
    甲（head）：共同的开头在最上面写一遍（字号 110，下面空 30），每条从开头和开头后面的语气字以后写起；接着说的句子（停不到 0.2 秒）接在那条下面。
    乙（dots）：每句一条，前面一个小圆点（占 0.6 个字宽）。
    每句按词折，一排最多九个字、最宽 720；整卡字号 72 到 110 取放得下的最大；条与条之间空 0.3 个字号；高不过 694。放不下返回 None。
    返回 parts：每句 (line, a 从第几个字起写, fold 折点, item 第几条)；fs 字号。"""
    parts, wid = [], []
    dot = 0.6 if g['var'] == 'dots' else 0.0
    for n_it, it in enumerate(g['items']):
        for j, k in enumerate(it):
            cs = lines[k]['cs']; a = 0
            if g['var'] == 'head' and j == 0:
                a = 2
                while a < len(cs) and cs[a][0] in PARA_TAIL: a += 1
            sub = dict(cs=cs[a:], kw='')
            if not sub['cs']: return None
            c = para_fold(sub, PARA_IROW - dot)
            if c is None: return None
            parts.append(dict(line=k, a=a, fold=c, item=n_it)); wid += [w + dot for w in para_rows(sub, c)]
    head = 110 * PARA_LH + 30 if g['var'] == 'head' else 0.0

    def height(fs):
        return head + sum((len(p['fold']) + 1) * fs * PARA_LH for p in parts) + round(fs * PARA_GAP) * (len(g['items']) - 1)
    fs = int(max(72, min(110, PARA_IW // max(wid))))
    while fs > 72 and height(fs) > PARA_HMAX: fs -= 1
    return dict(parts=parts, fs=fs) if height(fs) <= PARA_HMAX else None


def _para_at(lines, T, ok, i):
    n = len(lines); h = T[i][:2]
    for var in ('head', 'dots'):
        if var == 'head' and not (len(T[i]) >= 4 and re.fullmatch(r'[\u4e00-\u9fff]{2}', h) and h not in PARA_HEAD_NOT): continue
        if var == 'dots' and not _para_short(T, i): continue
        same = (lambda k: T[k][:2] == h and len(T[k]) >= 4) if var == 'head' else (lambda k: _para_short(T, k))
        items, k = [[i]], i + 1
        while k < n and ok(k):
            if same(k) and (var == 'head' or _gap(lines, k - 1) >= 0.4 - 1e-9): items.append([k])
            elif _gap(lines, k - 1) < GAP_KEEP - 1e-9:
                if var == 'head': items[-1].append(k)
                else: items.append([k])                      # 乙：接着说的也算一条（鞋带一拧就紧的越野跑鞋）
            else: break
            k += 1
        while sum(map(len, items)) > CARD_MAX: items.pop()   # 一组最多四句（一张卡），多了从后面整条去掉
        if sum(1 for it in items if same(it[0])) < 3: continue
        g = dict(kind='para', var=var, line=i, first=i, end=items[-1][-1], items=items, head=[0, 2] if var == 'head' else None,
                 word=h if var == 'head' else _bare(T[i]))
        fit = para_fit(lines, g)
        if fit: return dict(g, **fit)
    return None


def para_find(lines, T, ok):
    """排比：甲，连着三句开头两个字一样（有些……有些……有些……），每句至少四个字；乙，连着三句以上，每句 3 到 5 个字（去掉句尾语气字），
    句间停顿都不少于 0.4 秒，不是「对、是、好、没错」这类应答，不是「比如你说」这种引话的头。中间、后面停不到 0.2 秒接着说的句子一起进卡。
    一组最多四句（一张卡）。ok(i)：这句在普通句卡上、能挂模板。返回 {第一句: 记号}。"""
    out, i = {}, 0
    while i < len(lines):
        g = _para_at(lines, T, ok, i) if ok(i) else None
        if g: out[i] = g; i = g['end'] + 1
        else: i += 1
    return out


def tpl_line(s, tk):
    for f in (tpl_ban, tpl_grow, lambda s, tk: tpl_trend(s, tk, 'grow'), lambda s, tk: tpl_trend(s, tk, 'drop'), tpl_clock, tpl_long, tpl_attn, tpl_auto, tpl_example):
        x = f(s, tk)
        if x: return x
    return None


def tpl_find(scenes, lines, T):
    """普通句卡里每句认模板（一句只认一种）；再认引话（上一句是「谁说」，这句是他说的话）和排比（几句一组）；带图形的按两条分卡规矩带上前面的句子。
    返回 {锚句: 记号}：一句的记号锚在这句；带图形的合卡后锚在认出的那句（first 记最前面那句）；排比锚在第一句（first、end 记第一句、最后一句）。"""
    say = {i for sc in scenes if sc['type'] == 'say' for i in range(sc['la'], sc['lb'])}
    txt = lambda i: ''.join(c[0] for c in lines[i]['cs'])
    ok = lambda i: i in say and not any(len(c[0]) != 1 for c in lines[i]['cs']) and not Q_RE.search(T[i])
    found = {}
    for i in sorted(say):
        if not ok(i): continue
        s = txt(i); x = tpl_line(s, _toks(s))
        if x: found[i] = dict(x, line=i)
    for i in sorted(say):                                  # 引话：上一句是「谁说」，这句就是他说的话，套对话框
        if i in found or i == 0 or not ok(i) or not quote_src(txt(i - 1)): continue
        s = txt(i); found[i] = dict(kind='quote', var='bubble', line=i, src=i - 1, key=[0, len(s)], word=s)
    for f, g in para_find(lines, T, ok).items():          # 排比：几句里有带图形的就不认；只动字的、引话让给排比
        mem = range(g['first'], g['end'] + 1)
        if any(k in found and found[k]['kind'] in TPL_GRAPH for k in mem): continue
        for k in mem: found.pop(k, None)
        found[f] = g
    for i in sorted(found):                                # 两条分卡规矩（钟点那种不合）
        x = found.get(i)
        if not x or x['kind'] not in TPL_GRAPH or x.get('var') == 'clock': continue
        p, y = i - 1, found.get(i - 1)
        if y and TPL_RULE['两句合一张'] and y['kind'] == x['kind'] and y.get('var') == x.get('var') and 'first' not in y and p in say:
            r = _g_merge(lines, p, x)
            if r:
                for rw in r:                               # 前一句自己的词也用重点色；长条说到前一句的词先走一段（seek.js timeBar 用 pkey）
                    if rw['line'] == p: rw['acc'] = [[max(rw['a'], y['key'][0]), min(rw['b'], y['key'][1])]] if y['key'][0] < rw['b'] and y['key'][1] > rw['a'] else []
                found[i] = dict(x, first=p, rows=r, pkey=list(y['key'])); del found[p]
            continue
        if TPL_RULE['带上前一句'] and p in say and p not in found and _gap(lines, p) < GAP_KEEP - 1e-9:
            r = _g_merge(lines, p, x)
            if r: found[i] = dict(x, first=p, rows=r)
    return found


# ---------- 排卡后半截（11-12 夜盲审七处之一、三、四） ----------
# 普通句卡不再按「最多三句、6.5 秒」一组：两张别的卡之间的普通句连成一段，一起分卡：
#   1. 装不下先缩字，缩到 90 为止，还装不下才拆（para_card 里缩）。
#   2. 换卡点优先落在句间停顿大的地方；两句之间隔不到 0.2 秒的不拆到两张卡上，除非这张卡已经四句、或者缩到 90 还装不下。一张卡一到四句。
#   3. 不到四个字的句子不放在卡头。
#   4. 单独一句居中的卡，只有这句前后停顿都不少于 0.3 秒才用，否则并进旁边的卡。
#   5. 卡头不拿「的、了、呢」开头：数字卡、模板卡拿走半句以后，剩下那半句并回去；并不回去的，那张数字卡不做、那个模板不用。
# 2 是硬的；3、4、5 能做到的一定做到，实在没法（前后都是别的卡，这句只能自己一张）才留着，交付时照实报。
# 模板（规矩见上面「按意思挂的模板」）：主动作做完以后大样子原样停住，只动字的不少于 0.5 秒，带图形的不少于 0.8 秒，这期间这句不许缩小变灰
#   （只动字的：停到这张卡开始淡出、或者同一张卡下一句冒头，哪个早算哪个）。停不够依次：先把动作提早（关键词一开口就做）；
#   还不够，把这句排成这张卡的最后一句（分卡时罚分，让它当卡尾）；再不够，这句不用模板。时刻都按每秒 30 帧对齐，再多留一帧。
# 数字卡、年份卡、区间卡（11-12 夜盲审七处之一）：屏上只出现这句话里的数，不滚数；对的数从完整出现到这张卡开始淡出不少于 0.8 秒，
#   不够的这句不做数字卡，照普通句卡走，数用重点色（标亮词换成这个数）。
CARD_RULE = {'看停顿': True, '短句不打头': True, '单句要停顿': True, '的了呢不打头': True, '先缩字': True}   # 必过考卷的牙单关用；软件里一直开着
CARD_MAX, GAP_KEEP, GAP_ONE, HEAD_MIN, HEAD_BAD = 4, 0.2, 0.3, 4, ('的', '了', '呢')
CARD_BAD, SPLIT_W, CARD_ONE, TPL_MISS = 6.0, 1.5, 1.0, 1.5   # 分卡打分：一张卡 1 分；违规一条罚 6；单句卡另加 1；在停顿 g 秒处换卡奖 1.5g（g 最多算 1 秒，停 0.67 秒以上才划算）；卡上只动字的模板停不够罚 1.5（让它当卡尾）
FPS, TPL_MARGIN = 30, 1.0 / 30
NUM_HOLD = 0.8
NUM_RULE = {'停够': True, '不另起': True}
NUM_LOG = []                                    # 这次排卡哪几张数字卡没做、为什么（交付说明照实报用）


def _gap(lines, i):
    """第 i 句说完到第 i+1 句开口隔多久；前后没句子的算很长。"""
    if i < 0 or i + 1 >= len(lines): return 9.0
    return lines[i + 1]['t0'] - lines[i]['t1']


def _nch(s): return len(re.sub(r'[^\u4e00-\u9fffA-Za-z0-9]', '', s))
def _ltxt(lines, i): return ''.join(c[0] for c in lines[i]['cs'])
def _fr_up(t): return math.ceil(t * FPS - 1e-6) / FPS              # t 以后（含）第一帧
def _fr_after(t): return (math.floor(t * FPS + 1e-6) + 1) / FPS     # t 以后（不含）第一帧


def card_cost(lines, x, y):
    c = 1.0; head = _ltxt(lines, x)
    if CARD_RULE['短句不打头'] and _nch(head) < HEAD_MIN: c += CARD_BAD
    if CARD_RULE['的了呢不打头'] and head[:1] in HEAD_BAD: c += CARD_BAD
    if y - x == 1:
        c += CARD_ONE
        if CARD_RULE['单句要停顿'] and (_gap(lines, x - 1) < GAP_ONE - 1e-9 or _gap(lines, x) < GAP_ONE - 1e-9): c += CARD_BAD
    return c + 0.4 * max(0.0, lines[y - 1]['t1'] - lines[x]['t0'] - 6.0)   # 一张卡说太久（过 6 秒）也罚一点（原来一张最多 6.5 秒）


def split_ok(lines, w, x, fits):
    """[w,x) 这张卡在 x 前换卡行不行：隔够 0.2 秒；或者这张已经四句；或者再加一句缩到 90 也装不下。"""
    return not CARD_RULE['看停顿'] or _gap(lines, x - 1) >= GAP_KEEP - 1e-9 or x - w >= CARD_MAX or not fits(w, x + 1)


def card_part(lines, a, b, fits, extra):
    """普通句 [a,b) 分卡。fits(x, y)：这几句一张卡缩到 90 装得下；extra(x, y)：这张卡另外罚的分。返回 [(x, y), ...]。"""
    best = {}
    for y in range(a + 1, b + 1):
        for x in range(max(a, y - CARD_MAX), y):
            if not fits(x, y): continue
            c = card_cost(lines, x, y) + extra(x, y)
            if x == a: best[(x, y)] = (c, None); continue
            got = None
            for w in range(max(a, x - CARD_MAX), x):
                if (w, x) in best and split_ok(lines, w, x, fits):
                    v = best[(w, x)][0] + c - SPLIT_W * min(_gap(lines, x - 1), 1.0)
                    if got is None or v < got[0] - 1e-9: got = (v, (w, x))
            if got: best[(x, y)] = got
    ends = sorted((v[0], k) for k, v in best.items() if k[1] == b)
    if not ends: return [(i, i + 1) for i in range(a, b)]
    k, out = ends[0][1], []
    while k: out.append(k); k = best[k][1]
    return out[::-1]


def _text_done(lines, x, early):
    """只动字的模板：(主动作最后一笔, 做完)。做完 = 主动作最后一笔画完（圈加斜杠：斜杠压完；拎出来：词落定）。和 seek.js sayPara 一个算法。
    这句字冒齐的时刻另记在 tpl.settle（时间账照实报）。"""
    li = x['line']; cs = lines[li]['cs']
    chT = lambda i: cs[min(i, len(cs) - 1)][1]
    chEnd = lambda i: cs[i + 1][1] if i + 1 < len(cs) else lines[li]['t1']
    if x['kind'] in ('ban', 'attn', 'auto'):
        tO0, tO1 = chT(x['obj'][0]), chEnd(x['obj'][1] - 1)
        stroke = (tO0 + 0.3 if early else max(tO0 + 0.3, min(tO1, tO0 + 0.6))) + (0.12 if x['kind'] == 'ban' else 0.0)   # 提早：被圈的词一开口起笔，0.3 秒合上，不等它说完；禁止再压 0.12 秒斜杠
    elif x['kind'] == 'quote':
        stroke = lines[li]['cs'][0][1] + 0.3                                            # 对话框：说的那句话一开口，0.3 秒框好
    else:
        stroke = (chT(x['key'][0]) if early else lines[li]['t1'] + 0.1) + 0.4          # 提早：被举的词一开口就往下拎，不等整句说完
    return stroke, stroke


def _text_hold(lines, x, y, t1, borrow=0.0, cap=None):
    """只动字的模板挂在卡 [.., y) 上（换卡时刻 t1）停不停得够：先照常，不够再提早；这句是卡尾的，再让下一张卡晚换 borrow 秒（不晚过 cap，就是下一句开口）。
    够了返回 (提早没有, 最后一笔, 做完, 停到, 借了多少)，不够返回 None。"""
    li = x['line']; bs = [0.0]
    if borrow > 0 and li + 1 >= y and cap is not None and cap - t1 > 1e-6: bs.append(min(borrow, cap - t1))   # 1.3.2：下一张卡等那句开口才换
    for bo in bs:
        end = t1 + bo - TPL_FADE
        if li + 1 < y: end = min(end, lines[li + 1]['cs'][0][1] - 0.07)   # 同一张卡下一句冒头，这句就开始缩小变灰
        for early in (False, True):
            stroke, done = _text_done(lines, x, early)
            if _fr_after(end) - _fr_up(done) >= TPL_HOLD[x['kind']] + TPL_MARGIN - 1e-6: return early, stroke, done, end, bo
    return None


def _block_ok(lines, f, e, a, b):
    """带图形的模板、排比那几句 [f, e] 自己一张卡：它前后换卡也得守分卡的规矩。一句一张的，前后停顿都不少于 0.3 秒（11-13 补）；
    几句一张的（1.3.2 合卡、排比），前后停顿不少于 0.2 秒；后面那句当卡头，不短于四个字、不拿「的了呢」开头。"""
    if not ('句卡' in FIXES and CARD_RULE['看停顿']): return True
    if f == e and CARD_RULE['单句要停顿'] and min(_gap(lines, f - 1), _gap(lines, f)) < GAP_ONE - 1e-9: return False
    if f > a and _gap(lines, f - 1) < GAP_KEEP - 1e-9: return False
    if e + 1 < b:
        h = _ltxt(lines, e + 1)
        if _gap(lines, e) < GAP_KEEP - 1e-9 or _nch(h) < HEAD_MIN or h[:1] in HEAD_BAD: return False
    return True


def _graph_ok(lines, i, a, b): return _block_ok(lines, i, i, a, b)


def cards_build(base, lines, T, dur, found, skip):
    """按 base 的卡排一遍：别的卡原样；连着的普通句卡并成一段重新分卡，带图形的模板那句单独成卡，只动字的挂在卡上。
    返回 (卡, 这次没挂上的带图形模板那几句)。"""
    import copy
    new = '句卡' in FIXES and CARD_RULE['看停顿']
    S, rej, last_kind, cnt, clocks, fc = [], set(), None, {}, [], {}
    tp_of = lambda x, y: next((found[i] for i in range(x, y) if i in found and i not in skip and found[i]['kind'] in TPL_TEXT), None)

    def fits(x, y):
        if not PARA_RULE['拆卡']: return True                   # 量牙用：不管装不装得下都不拆
        if (x, y) not in fc:
            r = para_card(lines, x, y, tp_of(x, y)) or para_card(lines, x, y, None)
            fc[(x, y)] = r[2] <= PARA_HMAX
        return fc[(x, y)]
    t1_of = lambda y: lines[y]['t0'] - 0.15 if y < len(lines) else dur
    extra = lambda x, y: 0.0 if not tp_of(x, y) or _text_hold(lines, tp_of(x, y), y, t1_of(y), TPL_TBORROW if y < len(lines) else 0.0, lines[y]['t0'] if y < len(lines) else None) else TPL_MISS
    k = 0
    while k < len(base):
        sc = base[k]; k += 1
        if sc['type'] != 'say':
            S.append(copy.deepcopy(sc)); last_kind = None; continue
        a, b = sc['la'], sc['lb']
        if new:
            while k < len(base) and base[k]['type'] == 'say' and base[k]['la'] == b: b = base[k]['lb']; k += 1
        pieces, p = [], a
        own = sorted((found[i].get('first', i), found[i].get('end', i), i) for i in found if a <= i < b and i not in skip and found[i]['kind'] not in TPL_TEXT)
        for f, e, i in own:                                   # 带图形的、排比：自己一张卡（1.3.2：可以是几句）
            if f < max(a, p) or e >= b or not _block_ok(lines, f, e, a, b): rej.add(i); continue
            if p < f: pieces.append((p, f, None))
            pieces.append((f, e + 1, found[i])); p = e + 1
        if p < b: pieces.append((p, b, None))
        parts = []
        for p, q, x in pieces:
            if x: parts.append((p, q, x))
            elif new: parts += [(u, v, None) for u, v in card_part(lines, p, q, fits, extra)]
            elif '句卡' in FIXES: parts += [(u, v, None) for u, v in para_split(lines, p, q, tp_of)]
            else: parts.append((p, q, None))
        for p, q, x in parts:
            c = dict(type='say', la=p, lb=q, icon=scene_icon(''.join(T[p:q])))
            own = x
            if not x:                                             # 只动字的：这张卡里第一句认出来的
                x = tp_of(p, q)
                if x and '句卡' in FIXES and para_card(lines, p, q, x) is None: x = None   # 模板那句折不全（被圈的词和否定词不在一排、举例那句一排放不下）
            if x and (cnt.get(x['kind'], 0) >= TPL_MAXK.get(x['kind'], TPL_MAX) or (TPL_RULE['不连用'] and last_kind == x['kind'])): x = None
            if x and x.get('var') == 'clock' and any(h == x['hour'] and lines[x['line']]['t0'] - t < 10 for h, t in clocks): x = None
            if own and not x: rej.add(own['line'])                 # 带图形的、排比已经自己一张卡却挂不上：这句不用模板，重排
            if x:
                c['tpl'] = copy.deepcopy(x); c['icon'] = None; cnt[x['kind']] = cnt.get(x['kind'], 0) + 1
                if x.get('var') == 'clock': clocks.append((x['hour'], lines[x['line']]['t0']))
            last_kind = x['kind'] if x else None
            S.append(c)
    return S, rej


def _tpl_time(S, lines, dur):
    """算每个模板主动作做完的时刻（和 seek.js 里的画法一个算法，两边一起改），够不够停；带图形的按需要借下一句的时间。
    返回时间不够的句子（这句不用模板）。tpl 里记下 done（做完）、fade（开始淡出）、gone（退完）、settle（字冒齐），时间账用；只动字的另记 early（提早没有）、stroke（最后一笔）、hold_to（停到）。"""
    bad = set()
    chT = lambda li, i: lines[li]['cs'][min(i, len(lines[li]['cs']) - 1)][1]
    for k, sc in enumerate(S):
        x = sc.get('tpl')
        if not x: continue
        li = x['line']; nxt = S[k + 1] if k + 1 < len(S) else None
        settle = lines[li]['cs'][-1][1] + 0.32
        if x['kind'] in TPL_GRAPH:
            cap = (lines[nxt['la']]['t0'] + TPL_BORROW) if nxt else dur          # 下一张卡最晚在下一句开口时换（TPL_BORROW 现为 0，字不比嘴晚）
            hold = TPL_HOLD[x['kind']] + TPL_MARGIN
            latest = _fr_up(cap - TPL_FADE - hold) - 1.0 / FPS                  # 做完最晚这一帧，才够停（按帧算再多留一帧）
            v = x.get('var')
            if v == 'clock':
                done = min(chT(li, x['key'][1] - 1), latest)                     # 最晚在关键词最后一个字开口时
                h0 = min(chT(li, x['digit']) - 0.10, done - 0.25)                # 短针从那个数开口前 0.1 秒起转，至少转 0.25 秒
                if h0 < sc['t0'] or done <= sc['t0']: bad.add(li); continue
                x['h0'] = round(h0, 3)
            elif v == 'spread':
                t_s = chT(li, x['start']) - 0.10; t_u = chT(li, x['up'])
                done = min(chT(li, x['last']), latest)
                if done < t_u + 0.3 or done - t_s < 0.6: bad.add(li); continue
            else:                                                                # 1.3.2 长条、往上、多出一截、往下：从 a0 动到做完，至少动 0.3 秒
                if v == 'bar': a0 = max(sc['t0'], lines[x.get('first', li)]['t0'] - 0.05)          # 长条：卡上第一句开口就开始走
                elif v == 'extra': a0 = max(sc['t0'] + 0.1, chT(li, x['num']) - 0.1)              # 多出一截：说到那个数才长
                else: a0 = max(sc['t0'] + 0.1, chT(li, x['key'][0]) - 0.4)                        # 往上、往下的一笔：关键词开口前 0.4 秒起笔
                done = min(chT(li, x['key'][1] - 1), latest)
                if done - a0 < 0.3 - 1e-6: bad.add(li); continue
                x['a0'] = round(a0, 3)
            need = done + hold + TPL_FADE
            if need > sc['t1'] + 1e-6:
                sc['t1'] = round(need, 3)
                if nxt: nxt['t0'] = sc['t1']
        elif x['kind'] in TPL_BLOCK:                                             # 排比：最后一条开口后 0.3 秒出齐，停够 0.5 秒
            done = lines[x['items'][-1][0]]['t0'] + 0.3
            if _fr_after(sc['t1'] - TPL_FADE) - _fr_up(done) < TPL_HOLD[x['kind']] + TPL_MARGIN - 1e-6: bad.add(li); continue
        else:
            bor = TPL_TBORROW if nxt and nxt['type'] not in TPL_NUMCARD else 0.0   # 1.3.2：下一张是数字卡、年份卡、区间卡的不借
            r = _text_hold(lines, x, sc['lb'], sc['t1'], bor, lines[nxt['la']]['t0'] if nxt else None)
            if r is None: bad.add(li); continue
            x['early'], x['stroke'], done, x['hold_to'] = r[0], round(r[1], 3), r[2], round(r[3], 3)
            if r[4] > 1e-9:                                                       # 借了：下一张卡等那句开口才换
                sc['t1'] = round(sc['t1'] + r[4], 3); nxt['t0'] = sc['t1']; x['borrow'] = round(r[4], 3)
        x['done'] = round(done, 3); x['settle'] = round(settle, 3); x['fade'] = round(sc['t1'] - TPL_FADE, 3); x['gone'] = round(sc['t1'] + TPL_GONE, 3)
    return bad


def num_full(T, t0):
    """数字卡上一个数完整出现的时刻：数从 max(说到前 0.2 秒, 卡开始进来后 0.15 秒) 起淡入，0.2 秒淡满；卡自己 0.35 秒进满。和 seek.js 的 numIn、NUM_LATE 一个算法。"""
    return max(T, t0 + 0.35)


def num_ts(sc):
    if sc['type'] == 'stat': return [sc['t']] + ([sc['second']['t']] if sc.get('second') else [])
    if sc['type'] == 'year': return [nd['t'] for nd in sc['nodes']]
    return [sc['tLo'], sc['tHi']]


def num_hold(sc):
    """这张数字卡上最晚完整出现的那个数，到卡开始淡出停多久（按帧算）。"""
    return min(_fr_after(sc['t1'] - TPL_FADE) - _fr_up(num_full(T, sc['t0'])) for T in num_ts(sc))


def num_words(sc):
    if sc['type'] == 'stat': return [sc.get('raw')] + ([sc['second'].get('raw')] if sc.get('second') else [])
    if sc['type'] == 'year': return [nd['year'] + '年' for nd in sc['nodes']]
    return [sc.get('raw')]


def num_demote(S, lines):
    """数字卡停不够、或者后面那张普通句卡拿「的了呢」开头（数字卡拿走了半句）：这张不做数字卡，照普通句卡走，数用重点色。返回改了几张。"""
    n = 0
    for k, sc in enumerate(S):
        if sc['type'] not in ('stat', 'year', 'range'): continue
        why = ''
        if NUM_RULE['停够'] and num_hold(sc) < NUM_HOLD + TPL_MARGIN - 1e-6: why = f'对的数完整出现到开始淡出只有 {max(0.0, num_hold(sc)):.2f} 秒'
        nx = S[k + 1] if k + 1 < len(S) else None
        if not why and NUM_RULE['不另起'] and nx and nx['type'] == 'say' and nx['la'] == sc['lb'] and _ltxt(lines, nx['la'])[:1] in HEAD_BAD:
            why = f'后面那张拿「{_ltxt(lines, nx["la"])[:1]}」开头（这张拿走了半句）'
        if not why: continue
        ws = [w for w in num_words(sc) if w]
        for i in range(sc['la'], sc['lb']):
            w = next((w for w in ws if w in _ltxt(lines, i)), None)
            if w: lines[i]['kw'] = w
        NUM_LOG.append(dict(type=sc['type'], la=sc['la'], lb=sc['lb'], text=' / '.join(_ltxt(lines, i) for i in range(sc['la'], sc['lb'])), why=why))
        S[k] = dict(type='say', la=sc['la'], lb=sc['lb'], icon=None)
        n += 1
    return n


def cards(scenes, lines, T, dur):
    """排卡后半截：分卡、模板、数字卡停够互相牵着（模板借时间会推后下一张卡，数字卡不做了又要和旁边的句子一起重新分卡），一起转到不再变。"""
    del NUM_LOG[:]
    skip, S = set(), scenes
    for _ in range(20):
        found = tpl_find(S, lines, T) if '模板' in FIXES else {}
        S, rej = cards_build(S, lines, T, dur, found, skip)
        timing(S, lines, dur)
        bad = _tpl_time(S, lines, dur) | rej
        dem = num_demote(S, lines)
        if not bad and not dem: return S
        skip |= bad
    for sc in S: sc.pop('tpl', None)
    timing(S, lines, dur)
    return S


# ---------- 对比卡（11-12 夜盲审七处之五） ----------
# 这张卡期间说的每一句话都要在主区（画面 545–1345）出现过，字号不低于 72；盒子里的字去掉句首的语气字（呢、啊、呀、哎、嗯）；「现在」盒子右边收到 870 以内。
# 选的排法：「以前」「现在」两个盒子上下摆（原样），每边按句分块，说到哪句盒子里出哪句——一边不超过三排就一句句往下摞，摞不下就换成正在说的那句。
CMP_RULE = {'每句都上': True, '去语气字': True}   # 必过考卷的牙单关用
CMP_HEAD = re.compile(r'^[呢啊呀哎嗯，,、\s]+')
CMP_ROW = 9                                        # 盒子里一排最多 9 个字（盒子宽 740，左右各留 44，72 号字放 9 个）


def cmp_clean(t): return '\n'.join(CMP_HEAD.sub('', x) for x in str(t).split('\n'))


def cmp_parts(sc, lines):
    """对比卡按句分块：「现在」那句以前的句子归以前一边，以后的归现在一边；一句里说完的（不是…而是…）两边各一块，就是原来那两段。
    软开头（所以、那么这种，卡最前面那句）并进以前那边第一块。每块按词折成一排不超过 9 个字（cut：第几个字前折）。"""
    L, R, la, lb = sc['L'], sc['R'], sc['la'], sc['lb']
    txt = lambda k: ''.join(c[0] for c in lines[k]['cs'])
    lk = next((k for k in range(la, lb) if abs(lines[k]['t0'] - L['t']) < 1e-6), la)
    rj = next((k for k in range(la, lb) if lines[k]['t0'] >= R['t'] - 1e-6), None)
    if rj is None or rj <= lk:
        Lp, Rp = [[L['text'], L['t'], [lk]]], [[R['text'], R['t'], [lk]]]
    else:
        Lp = [[L['text'] if k == lk else txt(k), lines[k]['t0'], [k]] for k in range(lk, rj)]
        Rp = [[R['text'].split('\n')[0] if k == rj else txt(k), lines[k]['t0'], [k]] for k in range(rj, lb)]
    if lk > la: Lp[0] = [''.join(txt(k) for k in range(la, lk)) + Lp[0][0], lines[la]['t0'], list(range(la, lk + 1))]

    def mk(ps):
        out = []
        for text, t, ks in ps:
            text = cmp_clean(text) if CMP_RULE['去语气字'] else text
            if not text: continue
            out.append(dict(text=text, t=round(t, 3), lines=ks, cut=para_fold(dict(cs=[[c, 0, 0] for c in text], kw=''), CMP_ROW) or []))
        return out
    L['parts'], R['parts'] = mk(Lp), mk(Rp)


def retitle(j, title):
    """只换封面和片头大字（校字页改了封面大字、画面沿用上次排的时候用）。和 plan 里给了 title 时同一条规则。"""
    tl = [x for x in (title or []) if x.strip()][:2]
    if not tl: return
    kw2 = find_kw(''.join(tl)); t = [mark(x, kw2, '封面' in FIXES and len(tl) == 2) for x in tl]
    j['title'] = t
    if isinstance(j.get('cover'), dict): j['cover']['title'] = list(t)


def mark(s, kw, whole=False):
    # whole：两行的标题里，一行正好就是这个数（「营收同比下降 / 12.5%」的第二行），整行标金色（11-10，不然数字落到第二行金色就没了）
    if not (kw and kw in s and (len(kw) < len(s) or whole)): return s
    if '数块' in FIXES:                                   # 11-09 第三轮：金色不标在半个数上（「涨到1[[9.9块]]」）
        p = s.find(kw)
        while p >= 0 and not shuzi.whole_ok(s, kw, p): p = s.find(kw, p + 1)
        return s[:p] + f'[[{kw}]]' + s[p + len(kw):] if p >= 0 else s
    return s.replace(kw, f'[[{kw}]]', 1)


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


NUM_CH = '0123456789０１２３４５６７８９零〇一二两三四五六七八九十百千万亿'


def n12(s):
    """照老版那样数字数：夹在两个数字中间的小数点、冒号、斜杠、逗号、横杠，数字前的「负」，老版听写时都丢了，这里不算（11-10 封面用）。"""
    return len(re.sub(r'(?<=\d)[.:/,\-](?=\d)|负(?=\d)', '', s))


def split_title(head, ln=len):
    # ln 是数字数的办法：默认 len；封面用 n12（11-10）
    if isinstance(head, list):
        parts = [p for p in head if p]
        if len(parts) == 2 and all(ln(p) <= 12 for p in parts): return parts
        head = ''.join(parts)
    head = clean(head)
    if ln(head) <= 9: return [head]
    sp = shuzi.blocks(head)                                 # 11-09 第三轮：数和单位不许分两行（「价格从9.9 / 元涨到19.9元」）
    for sep in '，,：:':
        at = next((k for k, c in enumerate(head) if c == sep and not any(a <= k < b for a, b in sp)), -1)   # 「3:15」「1,200」里的符号不算断处
        if at >= 0:
            a, b = head[:at], head[at + 1:]
            if 2 <= ln(a) <= 12 and ln(b) <= 13: return [a, clean(b)]
    k = (len(head) + 1) // 2
    try:
        import jieba
        bounds, at = [], 0
        for w in jieba.cut(head):
            at += len(w); bounds.append(at)
        inside = lambda b: (head[b - 1] in NUM_CH + '.．点' and head[b] in NUM_CH + '.．%％') or (head[b - 1] in NUM_CH and head[b] in '点')   # 不从一个数中间断：「睡7 / 点5个小时」（11-09 复审）
        L = ln(head)
        ok = [b for b in bounds if 3 <= ln(head[:b]) <= L - 3 and ln(head[:b]) <= 12 and L - ln(head[:b]) <= 13 and not inside(b) and not shuzi.splits(sp, b)]
        if ok: k = min(ok, key=lambda b: abs(ln(head[:b]) - L / 2))
    except Exception:
        pass
    if shuzi.splits(sp, k):                                 # 实在找不到词边界：挪到最近的数块边上
        edges = [x for a, b in sp for x in (a, b) if 2 <= x <= len(head) - 2]
        if edges: k = min(edges, key=lambda x: abs(x - k))
    return [head[:k], head[k:]]


def fmt(v):
    return str(int(v)) if float(v).is_integer() else str(v)


def num_in(s):
    for m in NUM_RE.finditer(s):
        v = float(m.group(1)); unit = m.group(2) or ''
        if not unit and '数块' in FIXES:
            mu = re.match('个(?:百分点|基点|' + shuzi.MAG + ')', s[m.end():])
            if mu: unit = mu.group(0)                 # 11-09 第三轮：「1.5个亿」「3.85个百分点」整个是单位
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
        if '数字' in FIXES and pv == '点' and re.search(r'[\d零〇一二两三四五六七八九十]点$', s[:m.start()]):
            continue                                 # 11-09 盲审：「3点15分」是钟点，「2点4倍」的 4倍 是后半个数，都不单拿
        p2 = s[max(0, m.start() - 2):m.start()]
        if pv == '第' or (not unit and pv == ' ' and p2[:1].isascii() and p2[:1].isalpha()) or (not unit and p2 in ('小米', '红米', '苹果', '华为', '荣耀', '三星', '一加', '魅族')):   # 「第10名」「iPhone 15」「小米14」；「ROE 15%」「苹果15块」带单位的照常
            continue
        if not unit and v in (315, 520, 618, 996, 1111, 12315) and not re.search('(花了|工资|收入|价格|房租|赚了?|省了)$', s[max(0, m.start() - 4):m.start()]):   # 「618」「996」「12315」是节日、作息、热线；「花了520」是钱
            continue
        if unit or v >= 10:
            return v, unit, m.start()
    return None


def sub_has(lines, k, w):
    """字幕第 k 行原文里有没有这几个字（照抄前再核一遍，免得拿归一过的字当原文）。"""
    return w in ''.join(c[0] for c in lines[k]['cs'])


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


def idx_time(lines, k, p):
    """这一行第 p 个字的开始时刻（中文数字归一后用下标找回原字）。"""
    pos = 0
    for c in lines[k]['cs']:
        if pos + len(c[0]) > p: return c[1]
        pos += len(c[0])
    return lines[k]['cs'][-1][1]


def enum_no(s):
    """清单开头词是第几条：第三 → 3，首先 → 1，其次 → 2；「最后 / 另外 / 还有一个」→ 'next'；不是开头词 → None。"""
    m = ENUM_RE.match(s)
    if not m: return None
    w = m.group(1)
    for k, v in (('首先', 1), ('其次', 2), ('再次', 3), ('一是', 1), ('二是', 2), ('三是', 3), ('四是', 4)):
        if w.startswith(k): return v
    d = re.match(r'第([一二三四五六七八九十\d]+)', w)
    if d:
        x = d.group(1)
        return int(x) if x.isdigit() else cn2num(x)
    return 'next'


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


# 11-12 夜盲审七处之七：清单条目去掉残头。「第一件呢叫扛不住」切走「第一」以后剩「件呢叫扛不住」，把「件呢叫」这截也去掉，只留「扛不住」。
LIST_RULE = {'去残头': True}   # 必过考卷的牙单关用
LIST_HEAD = re.compile(r'^(?:[件样种类招项块个点条步](?=[呢啊呀嘛吧也就叫是，,、：:。\s]|$))?[呢啊呀嘛吧]*(?:也就是|就是|就叫|叫做|叫|是)?[，,、：:。\s]*')


def list_head(h):
    if not LIST_RULE['去残头']: return h
    out = clean(LIST_HEAD.sub('', h, count=1))
    return out if len(out) >= 2 else h


def try_list(T, i):
    """「记住三个习惯」后面跟着「第一…第二…」，或者直接从「第一」开始。"""
    n = len(T); title = ''; want = 0
    start = i
    if not ENUM_RE.match(T[i]):
        if count_of(T[i]) and i + 1 < n and ENUM_RE.match(T[i + 1]):
            title = clean(strip_filler(T[i])); start = i + 1; want = count_of(T[i])
        else:
            return None
    items = []; k = start; last_no = 0
    # 2026-11-07：条目要按顺序来，第一条必须是「第一 / 首先 / 一是」，后面一条接一条（「第三名…第二关」不是清单）
    def in_order(j):
        if '清单' not in FIXES: return True
        no = enum_no(T[j])
        return no == last_no + 1 or (no == 'next' and last_no >= 1)
    while k < n:
        m = ENUM_RE.match(T[k])
        if m and in_order(k):
            last_no += 1
            if '清单' in FIXES and enum_no(T[k]) == 'next' and len(clean(T[k][m.end():])) < 2 and k + 1 < n and SUMUP_RE.match(T[k + 1]):
                break                                  # 「最后呢 / 我们来总结一下」：总结句不当最后一条
            head = list_head(clean(T[k][m.end():])); hk = k; k += 1
            if len(head) < 2 and k < n:
                head = list_head(T[k]); k += 1
            items.append((hk, head)); continue
        if not items: break
        nxt = next((j for j in range(k, min(k + 4, n)) if ENUM_RE.match(T[j])), None)
        if nxt is not None and not in_order(nxt): nxt = None     # 下一个「第 X」接不上顺序：不往那儿吃
        if nxt is not None and (not want or len(items) < want):
            k = nxt; continue                      # 中间那几条：一直吃到下一个「第 X」
        # 最后一条的补充句：最多 3 行，碰到别的信号就停
        if k - items[-1][0] <= 3 and not (NUM_RE.search(T[k]) and re.search(r'\d', T[k])) and not SOFT.match(T[k])                 and not MYTH_RE.search(T[k]) and not COUNT_RE.search(T[k]) and not (k + 1 < n and COUNT_RE.search(T[k + 1])):
            k += 1; continue
        break
    if len(items) < 2: return None
    if not title: title = f'{len(items)} 个要点'
    return k, title, items
