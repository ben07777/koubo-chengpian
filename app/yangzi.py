# 专业版的「样子」：一份内容，多套画法（2026-11-16 从试验夹的「样子架」搬进来）。
#
# 三样东西分开：
#   内容  云端填出来、软件排好时刻的那一份（挑了哪种画面、填了什么字和图标、哪几句配哪张）。就是出片夹里的 剧本.json，和样子无关。
#   样子  一套画法。app/样子/<名字>/ 一个夹子：样子.json（它会画哪几种、进场有几种、最短几秒）和它自己的页面脚本。
#   架子  这个文件。读内容；这套样子不会画的画面，照兜底的规矩落到它会画的；排好每张画面从第几秒到第几秒、用哪种进场、哪套色；拼成一页交给出片。
#
# 换样子重出 = 读同一份剧本，换一个样子夹，本机重画。这个文件里没有一行联网的代码。
# 只管专业版的片子：免费版的片子不走这里（render.look_of 把着门）。
import collections, hashlib, json, random, re
from pathlib import Path

APP = Path(__file__).resolve().parent
HOME = APP / '样子'
LOOKS = ('象形', '全息')                                         # 加第三种：在这里添一个名字，app/样子/ 下放它的夹子，下面 PIN 里添它怎么拼页面
DEFAULT = '全息'                                                 # 总控 2026-11-16 夜：默认改成全息（此前定象形，理由是怕全息出片慢；软件里实测两套都两分半；两个盲看的人都说全息更像花钱买的东西）。修改页照样两种都能选
NAMES = {'象形': '象形图形', '全息': '全息'}
CAP_KBPS = {'全息': 4000}                                        # 压片封顶（每秒多少千比特）。全息底上细线多，不封顶一条两分半的片 100 多兆；封到 4 兆每秒约 70 兆。免费版和象形不封

# 画面一共有哪几种（照 huamian_shuoming.txt 现在这一版数的：5 + 4 + 14 + 3 = 26 种）
KINDS = [('带数的', ['比多少', '占多少', '几组对比', '亮出大数', '时间先后']),
         ('讲关系的', ['并排对照', '因果', '前后变化', '转折']),
         ('小画面', ['单子', '流程', '主角', '问答', '不是', '天平', '拉开', '关卡', '里外', '连锁', '挑出', '循环', '配上', '成对']),
         ('基本件', ['标题', '引话', '图标词'])]
ALIAS = {'引一句': '引话'}
SKIP_KEYS = ('type', 'kind', 'kit', 'args', 'pts', 'hid', 'done', 'style', 't0', 't1', 'la', 'lb', 'shan', 'hideLi', 'bu', 'liu', 'ben')      # 带数的、讲关系的那几种，软件不存 args，填的东西散在别的栏里：除了这几栏都算填法
KIND_CN = {'icon': '图标词', 'stack': '单子', 'hero': '主角', 'title': '标题', 'pair': '两块', 'num': '大数', 'quote': '引一句', 'steps': '一步接一步'}


# ───────── 内容：从剧本里取出和样子无关的那一份 ─────────
def _fp(lines, pics):
    core = dict(句子=[[l['text'], l['t0'], l['t1']] for l in lines], 画面=[[p['种'], p['填'], p['t0'], p['t1']] for p in pics])
    return hashlib.md5(json.dumps(core, ensure_ascii=False, sort_keys=True).encode('utf-8')).hexdigest()


_digits = lambda t: '|'.join(m.group(0) for m in re.finditer(r'\d+(\.\d+)?', str(t)))
_hidden = lambda hide, text: text in hide or (bool(re.search(r'\d', text)) and any(re.search(r'\d', h) and _digits(h) == _digits(text) for h in hide))      # 和 画风/公共/core.js 的 hiddenIn 一个算法


def chip_of(s):
    """这张画面在修改页登记成哪一句下面的哪颗签：回 (第几句, 签上的字)。和字卡那套 seek.js 里登记专业版画面的算法一样，所以在哪套样子里点掉的，换一套样子也认。"""
    first = lambda k: (s.get(k) or [None])[0]
    m = s.get('num') or (first('rows') or {}).get('num') or first('pts') or (s.get('L') or {}).get('name') or s.get('cw') or first('steps') or s.get('A') or (first('evs') or {}).get('when')
    if not isinstance(m, dict) or not isinstance(m.get('li'), int): return None
    return m['li'], f"{s.get('kind')}：{m.get('text') or ''}"


def content_of(jb):
    lines = [dict(i=l['i'], text=l['text'], t0=l['t0'], t1=l['t1'], cs=l['cs']) for l in jb['lines']]
    hide = {l['i']: l.get('hide') or [] for l in jb['lines']}      # 修改页点掉的东西，记在那一句的 hide 单上
    pics = []
    for s in list(jb['scenes']) + local_pics(jb['lines']):
        if s.get('type') != 'pro': continue
        chip = chip_of(s)
        kind = s.get('kit') if s.get('kind') == '小画面' else s.get('kind')
        kind = ALIAS.get(kind, kind)
        fill = s.get('args') if s.get('args') is not None else {x: y for x, y in s.items() if x not in SKIP_KEYS}
        pics.append(dict(号=len(pics) + 1, 种=kind, 填=fill, la=s['la'], lb=s['lb'], t0=round(s['t0'], 3), t1=round(s['t1'], 3), 补=bool(s.get('bu')), 本机=bool(s.get('ben')), 签=list(chip) if chip else None))
    fp = _fp(lines, pics)                                          # 指纹照点掉以前的算：点掉一张，别的画面的进场、摆法不跟着重排
    pics = [p for p in pics if p['签'] and not _hidden(hide.get(p['签'][0], []), p['签'][1])]      # 修改页点掉的不画；登记不了的也不画（字卡那套也是这样）
    for k, p in enumerate(pics, 1): p['号'] = k
    return dict(时长=jb['dur'], 指纹=fp, 话题=jb.get('topics') or [], 句子=lines, 画面=pics)


# ───────── 本机兜底（总控 2026-11-18 定）：云端给得少，本机给句子配「立体图标加词」 ─────────
# 他在台式机出的一条：三句十秒，云端只配了一张纯字的标题卡。他原话「全是字儿，没有图案或动画」，放大的数在他眼里也是字。
# 所以本机补的一律是图标词（全息那套是转着的线框立体图标）：
#   带数的句子：图标加那个数（「负18度」带上负）；年份、几月几号几点、汉字写的数、光数没单位的，不当数用。
#   图标怎么挑：先看这句里有没有下面这张表里的东西（电费配闪电、冷冻室配温度计、片子配摄像机）；再看免费版那张收紧过的表（切词后整个词对上才算）；
#   带数的再按单位挑（%、度、分钟、元……）。都挑不到就不补（宁可少出，不乱配）。图标库里没有的东西，表里写的是最近的那只。
# 用在哪儿：一、哪句没被云端的画面盖着，就补；二、短录音（整条不过 30 秒）里，云端给的纯字画面（标题、引话、大数）盖着的句子，本机能配上图标的，换成图标。
# 补的照样过本机那几道拦（否定截掉、医疗宣称、语气词），照样登记到修改页、能点 × 去掉（点掉了，原来云端那张回来）。不叫云端，不扣条数。
NUM_PRE = ('零下', '负')
UNIT_NO = ('月', '日', '号', '点', '时', '月份', '点钟')                     # 几月、几号、几点：是日子不是量（「今年7月」）
NUM_MOST, SHORT_SEC = 8, 30.0
TEXT_ONLY = ('标题', '引话', '亮出大数', '占多少')                          # 短录音里，这几种云端画面本机能配上图标就换掉
THINGS = [                                                                # 句子里有这些字就配这只图标；靠前的先算（「电脑」要排在「电」前头）
    ('电脑|笔记本电脑', 'laptop'), ('手机', 'smartphone'), ('电视', 'tv'), ('电影|视频|片子|短片|拍片|剪片|剪辑|录像|口播', 'video'),
    ('电池|充电|电量', 'battery-charging'), ('电费|电价|用电|发电|电力|停电|电网', 'zap'),
    ('冰箱|冷冻|冷藏|冰冻|零下|温度|气温|体温|发烧', 'thermometer'),
    ('房租|房价|房子|买房|租房|房贷|首付|住房', 'house'), ('工资|收入|薪水|月薪|年薪|奖金', 'wallet'), ('存款|攒钱|储蓄|存钱', 'piggy-bank'),
    ('银行|贷款|利息|利率', 'landmark'), ('股票|股市|基金|大盘|指数', 'chart-line'), ('价格|价钱|涨价|降价|物价|多少钱', 'tag'),
    ('咖啡', 'coffee'), ('外卖|吃饭|做饭|早餐|午饭|晚饭|饭店|餐厅', 'utensils'), ('药|吃药|药品', 'pill'), ('医院|看病|挂号', 'hospital'),
    ('医生|大夫', 'stethoscope'), ('学校|上学|老师|学生', 'school'), ('读书|看书|书本', 'book-open'), ('开车|汽车|打车|堵车', 'car'),
    ('飞机|机票|航班|坐飞机', 'plane'), ('高铁|火车', 'train-front'), ('公交|地铁', 'bus'), ('快递|包裹|物流', 'package'),
    ('网购|下单|购物|买东西', 'shopping-cart'), ('超市|商店|门店|开店', 'store'), ('工厂|车间|生产线', 'factory'), ('农民|种地|粮食|庄稼', 'wheat'),
    ('猫', 'cat'), ('狗', 'dog'), ('孩子|宝宝|婴儿', 'baby'), ('睡觉|失眠|熬夜', 'moon'), ('跑步|健身|锻炼', 'dumbbell'),
    ('邮件|邮箱', 'mail'), ('电话|打电话', 'phone'), ('照片|拍照|相机', 'camera'), ('音乐|唱歌|听歌|歌曲', 'music'), ('天气|太阳', 'sun'), ('下雨|雨水', 'droplet')]      # 单字的「歌、雨、晒」不认：「谷歌」配了音符（11-18 在留出稿上撞上的）
UNITS = [('%', 'percent'), ('度', 'thermometer'), ('分钟|小时|秒', 'timer'), ('元|块|毛钱', 'banknote'), ('天|周|个月|年', 'calendar'), ('岁', 'user-round'),
         ('公里|米', 'map-pin'), ('斤|公斤|克|吨', 'scale'), ('人|个人', 'users'), ('倍', 'trending-up')]
ICON_WORD_NO = {'时间', '数据', '比例', '区间', '百分', '安全', '保护', '靠谱', '放心', '每天', '早上', '晚上'}      # 免费版那张表里撞上也不用的词：太虚（「时间组织防御」配时钟）
_THINGS = [(re.compile(p), n) for p, n in THINGS]


def _num_of(l):
    """这句里能当「数」上屏的那一截（「2.5%」「负18度」「3到5分钟」），没有回 None。"""
    text, nums = l['text'], [n for n in (l.get('nums') or []) if isinstance(n.get('a'), int) and isinstance(n.get('b'), int)]
    if not nums: return None
    n0 = nums[0]; a, b, last = n0['a'], n0['b'], n0
    if len(nums) > 1 and text[n0['b']:nums[1]['a']] in ('到', '至', '-', '~', '—'): b, last = nums[1]['b'], nums[1]      # 3到5分钟
    if not last.get('unit') or last['unit'] in UNIT_NO or any(n.get('cn') for n in nums): return None      # 光一个数没单位、日子、汉字写的数（「这一天」）
    if last['unit'] == '年' and 1900 <= (last.get('value') or 0) <= 2100: return None      # 年份
    pre = next((x for x in NUM_PRE if text[max(0, a - len(x)):a] == x), '')
    num = text[a - len(pre):b]
    return num if num and len(num) <= NUM_MOST else None


def _icon_of(l, num=None):
    """回 (图标, 撞上的词)；挑不到回 None。"""
    text = l['text']
    if num and re.search('(分钟|小时|秒)$', num) and 'timer' in white(): return 'timer', None      # 说的是要多久：配计时器（「做一条片子要3到5分钟」配摄像机，盲看读成「视频长3到5分钟」）
    for rx, name in _THINGS:
        m = rx.search(text)
        if m and name in white(): return name, m.group(0)
    try:
        from planner import _TIGHT_RE                                          # 免费版那张收紧过的表，只读来用，不改它
        from rules import cuts
        toks = [w for w in cuts(text) if w.strip()]
        hits = [(len(w), -k, name, w) for k, (rx, name) in enumerate(_TIGHT_RE) for w in toks if rx.fullmatch(w) and name in white() and w not in ICON_WORD_NO]
        if hits: _, _, name, w = max(hits); return name, w                      # 撞上几个取最长的词（「喝了一杯咖啡」配咖啡杯，不配刀叉）
    except Exception: pass
    if num:
        for p, name in UNITS:
            if re.search(p + '$', num) and name in white(): return name, None
    return None


def _local_pic(l):
    num = _num_of(l); ic = _icon_of(l, num)
    if not ic: return None
    name, w = ic
    if num: word = num                                                        # 带数的：图标加那个数，同一屏
    else: word = next((x for x in (l.get('kw'), l.get('word')) if x and w in x and 2 <= len(x) <= 8 and not re.search(r'\d', x)), w)      # 重点词带着撞上的词就用重点词（「喝咖啡」）
    if not word: return None
    return dict(type='pro', ben=True, la=l['i'], lb=l['i'] + 1, kind='小画面', kit='图标词', args=[name, word], pts=[dict(text=word, li=l['i'], t=l['t0'])], t0=l['t0'], t1=l['t1'])


def local_pics(lines):
    out = []
    for l in lines:
        if l.get('person'): continue
        try: s = _local_pic(l)
        except Exception: s = None
        if s: out.append(s)
    return out


def load_style(name):
    s = json.loads((HOME / name / '样子.json').read_text(encoding='utf-8')); s['夹'] = HOME / name; return s


# ───────── 兜底：这套样子不会画的画面，落到哪种 ─────────
# 总控 2026-11-16 定：不会画的统一落回这套样子的「图标加词」。先看有没有意思不走样的落法（流程、连锁、循环落成单子，字一个不少）；没有的落回图标加词。
# 图标：云端在这张画面上填了图标就用它填的；没填的，每一种配一只固定的中性图标。词：这一种最要紧的那一栏，原样，一个字不改。
NEUTRAL = {'标题': 'flag', '引话': 'message-circle', '亮出大数': 'chart-column', '占多少': 'chart-pie', '比多少': 'chart-column', '时间先后': 'clock', '并排对照': 'layers',
           '因果': 'arrow-right', '前后变化': 'arrow-right', '转折': 'flag', '问答': 'circle-question-mark', '不是': 'circle-check', '天平': 'scale', '拉开': 'chart-line',
           '关卡': 'door-closed', '里外': 'target', '挑出': 'search', '成对': 'clipboard-list', '配上': 'puzzle', '单子': 'clipboard-list'}
WORD_FROM = {'标题': '大字', '引话': '引的那句话', '亮出大数': '那个数（原样）', '占多少': '那个数（原样）', '比多少': '头一行的数（原样）', '时间先后': '最后一件事', '并排对照': '后一边说的',
             '因果': '果', '前后变化': '后来的样子', '转折': '后半句', '问答': '答', '不是': '「是」的那一边', '天平': '重的那一边', '拉开': '差多少（没填就取下面那个）',
             '关卡': '那道关（拦就配关着的门，过就配开着的门）', '里外': '里头的', '挑出': '挑出来的那个词', '成对': '最后一行说的', '配上': '合起来的那个词（没填就取左边的）', '单子': '单子的题目（没有题目就只出字幕）'}
WORD_MOST = 12                                                   # 词比这个还长，字小得看不清，不落，那几句只出底和字幕
_WHITE = []
tx = lambda x: ((x.get('text') if isinstance(x, dict) else x) or '')


def white():
    if not _WHITE: _WHITE.extend(json.loads((APP / '白名单.json').read_text(encoding='utf-8'))['图标'])
    return _WHITE


def icon_word(kind, fill):
    """落回图标加词要的三样：(图标, 词, 小字)。落不了回 None。"""
    L = fill if isinstance(fill, list) else []; d = L[0] if L and isinstance(L[0], dict) else (fill if isinstance(fill, dict) else {})
    given = sm = None
    if kind in ('标题', '引话'): w = L[0]; sm = L[1] if len(L) > 1 else None; given = L[2] if len(L) > 2 else None
    elif kind in ('亮出大数', '占多少'): w = tx(d['num']); sm = tx(d.get('what'))
    elif kind == '比多少': r = d['rows'][0]; w = tx(r['num']); sm = tx(r['name'])
    elif kind == '时间先后': e = d['evs'][-1]; w = tx(e['what']); sm = tx(e['when'])
    elif kind == '并排对照': w = tx(d['R']['say']); sm = tx(d['R']['name'])
    elif kind in ('因果', '前后变化', '转折'): w = tx(d['B'])
    elif kind == '问答': w = d['答']; given = d.get('答的')
    elif kind == '不是': w = d['是']
    elif kind == '天平': w = d['左' if d['重'] == '左' else '右']
    elif kind == '拉开': w = d.get('差') or d['下']
    elif kind == '关卡': w = d['关']; sm = d.get('来的'); given = d.get('图标') or ('door-closed' if d['结果'] == '拦' else 'door-open')
    elif kind == '里外': w = d['里']
    elif kind == '挑出': w = d['词']; sm = d.get('数')
    elif kind == '成对': r = d['对'][-1]; w = r['说']; sm = r['名']
    elif kind == '配上': w = d.get('合') or d['左']['词']
    elif kind == '单子': w = tx(d.get('题'))                    # 只在清单被本机拦下时走到这里（两套样子都会画单子）
    else: return None
    if not w or len(w) > WORD_MOST: return None
    return (given if given in white() else NEUTRAL[kind]), w, (sm or None)


def fallback(kind, fill):
    """回 (落到哪种, 那种要的填法, 少了什么)；落不了回 None。"""
    try:
        if kind == '流程': return '单子', [{'行': [x['词'] for x in fill[0]['步']]}], '每一步的图标没了，只剩几行字'
        if kind == '连锁': return '单子', [{'行': [str(x) for x in fill[0]['环']]}], '「一环推一环」的箭头没了，只剩几行字'
        if kind == '循环': return '单子', [{'行': [str(x) for x in fill[0]['点']]}], '「转一圈」的意思没了，只剩几行字'
        iw = icon_word(kind, fill)
        if iw: return '图标词', [iw[0], iw[1]] + ([iw[2]] if iw[2] else []), f'只剩一只图标和一个词（词取的是{WORD_FROM[kind]}），别的都没了'
    except Exception:
        return None
    return None


def resolve(kind, fill, can):
    """这张画面在这套样子里最后画成哪种。回 (画成哪种或 None, 填法, 一路经过, 少了什么)。"""
    path, lost = [kind], []
    while kind not in can:
        nx = fallback(kind, fill)
        if not nx or nx[0] in path: return None, None, path, lost
        kind, fill = nx[0], nx[1]; path.append(kind); lost.append(nx[2])
    return kind, fill, path, lost


PAIR_LINK = {'成对': '对', '并排对照': '对', '转折': '转', '因果': '因', '前后变化': '变', '问答': '问', '配上': '配'}      # 「两块」这一组骨架：七种画面都摆成上下两三块，中间的记号不一样
_ic = lambda name: name if name in white() else None


_HEAD_BAN = set('的得地了着过们吗呢吧啊么嘛呀啦')                  # 这些字不许打头
_TAIL_BAN = set('既又就才都也还再更最很太不没别把被给让请向从在对和与或跟是有用为而但却将得这那每各几大小好新老')      # 「请」11-17 补（引话卡折成「请 / 吃饭」）      # 这些单字是往后贴的，不许落在行尾


def _cuts(text):
    """这段字哪几个位置可以折行（词和词中间；数的是第几个字后面）。分词用不了就回 None，页面那头照字数平分。"""
    try:
        import rules  # noqa: F401  软件自己那份：分词的缓存放哪、不往屏上打字，都在它里头定了
        import jieba
        ws, out, i = list(jieba.cut(str(text))), [], 0
        for k, w in enumerate(ws[:-1]):
            i += len(w)
            if ws[k + 1][0] in _HEAD_BAN or (len(w) == 1 and w in _TAIL_BAN): continue      # 「做/的」「既/体面」「有/什么」这种不折
            out.append(i)
        return out
    except Exception: return None


def _T(x):
    """一段字交给页面：t 是字（原样）；at 是它第几秒说到的（云端那头查到了才有）；带数的另有 pre、n、u（前头的字、数、单位）和 val（数的大小）。"""
    if not isinstance(x, dict): return dict(t=str(x or ''), at=None, br=_cuts(x or ''))
    out = dict(t=x.get('text') or '', at=x.get('t'), br=_cuts(x.get('text') or ''))
    out.update({k: x[k] for k in ('pre', 'n', 'u', 'val') if x.get(k) is not None}); return out


def fields(kind, fill):
    """几种基本画法各要哪几样（样子的页面只认这几样）。读不出来就抛错，plan 那头当这套样子不会画它，照兜底往下落。"""
    if kind == '图标词': return dict(icon=fill[0], word=fill[1], small=fill[2] if len(fill) > 2 else None)
    if kind == '单子': d = fill[0]; return dict(rows=list(d['行']), head=d.get('题'), stamp=d.get('章'))
    if kind == '主角': d = fill[0]; tags = d.get('签') or []; return dict(icon=d['图标'], name=d.get('名') or '', tag=tags[0] if tags else None, tags=tags)
    if kind == '标题': return dict(big=fill[0], small=fill[1] if len(fill) > 1 and fill[1] else None)      # 字旁边的图标（fill[2]）两套样子现在都不画
    if kind in PAIR_LINK:                                        # 两块
        d = fill[0] if isinstance(fill, list) else fill; foot = None
        if kind == '成对': bl = [dict(head=_T(r.get('名')), body=_T(r['说']), num=_T(r['数']) if r.get('数') else None) for r in d['对']]
        elif kind == '并排对照': bl = [dict(head=_T(d[k]['name']), body=_T(d[k]['say'])) for k in ('L', 'R')]
        elif kind == '问答': bl = [dict(body=_T(d['问']), icon=_ic('circle-question-mark')), dict(body=_T(d['答']), icon=_ic(d.get('答的')))]
        elif kind == '配上': bl = [dict(body=_T(d[k]['词']), icon=_ic(d[k].get('图标'))) for k in ('左', '右')]; foot = d.get('合') or None
        else: bl = [dict(body=_T(d['A'])), dict(body=_T(d['B']))]
        if kind == '前后变化':                                     # 总控 11-16 夜：两块上永远带「以前」「现在」两个小字（盲看有人把前后读成了因果）
            for b, w in zip(bl, ('以前', '现在')): b['head'] = dict(t=w, at=b['body']['at'], br=None)
        if not 2 <= len(bl) <= 4 or not all(b['body']['t'] for b in bl): raise ValueError(kind)
        return dict(blocks=bl, link=PAIR_LINK[kind], foot=foot)
    if kind in ('亮出大数', '占多少'):                            # 大数（占多少也照一个大数画，不画圆环）
        num = _T(fill['num'])
        if not num['t']: raise ValueError(kind)
        return dict(num=num, what=_T(fill['what']) if tx(fill.get('what')) else None)
    if kind == '比多少':
        rows = [dict(name=_T(r.get('name')), num=_T(r['num'])) for r in fill['rows']]
        if not 2 <= len(rows) <= 4 or not all(r['num']['t'] for r in rows): raise ValueError(kind)
        return dict(rows=rows)
    if kind == '引话':
        if not fill[0]: raise ValueError(kind)
        return dict(text=str(fill[0]), br=_cuts(fill[0]), who=fill[1] if len(fill) > 1 and fill[1] else None)      # 字旁边的图标（fill[2]）不画
    if kind in ('流程', '连锁'):                                  # 一步接一步
        d = fill[0]; rows = [dict(t=x['词'], icon=_ic(x.get('图标')), br=_cuts(x['词'])) for x in d['步']] if kind == '流程' else [dict(t=str(x), icon=None, br=_cuts(x)) for x in d['环']]
        if not 2 <= len(rows) <= 5 or not all(r['t'] for r in rows): raise ValueError(kind)
        return dict(rows=rows)
    raise KeyError(kind)


# ───────── 排：每张画面从第几秒到第几秒、哪种进场、哪套色 ─────────
GAP_JOIN, EARLY, IDLE_LEAD = 2.5, 1.5, 0.6      # 两张隔得不到 2.5 秒就接上；后一张最多提前 1.5 秒进场；隔得远的中间只出底和字幕，后一张提前 0.6 秒进场
LEAD_MOST = 30.0                                # 11-18 加：第一张前头还有它没盖着的句子，就不提前，按它自己那句出（他那条：标题卡盖着前两句从 0 秒打字）。总控 11-16 夜：开头空着超过一秒，第一张提前到第 0 秒出（买家第一眼别以为软件没干活）。第一张晚过半分钟的就不算「开头」了，不提前，免得一张画面挂半分钟讲别的事


def bag(seed, n, K, salt=0):
    """K 种一轮，一轮里各来一回，次序由种子定；两轮接头撞了就把后一轮头两个对调。所以相邻两次永远不一样。哪套样子都用这一个。"""
    rnd = random.Random(seed * 1000 + salt); out = []
    while len(out) < n:
        a = list(range(K)); rnd.shuffle(a)
        if out and K > 1 and a[0] == out[-1]: a[0], a[1] = a[1], a[0]
        out += a
    return out[:n]


def timeline(drawn, T0, T1, pal0, head=None, need=None):
    shots, prev = [], None
    idle = lambda a, b, k, pl: shots.append(dict(kind='none', a=round(a, 3), b=round(b, 3), k=k, pal=pl)) if b - a > 0.05 else None
    for d0 in drawn:
        d = dict(d0)
        if prev is None:
            a = T0 if d['t0'] - T0 <= LEAD_MOST and (head is None or head(d)) else d['t0'] - IDLE_LEAD
            if a == T0 and d['t0'] - T0 > 1.0: d['together'] = True; d['lead'] = round(d['t0'] - T0, 2)      # 提前出的这张：图标和字一起进，单子头一行也跟着进，不空着等说到
            idle(T0, a, d['k'], d['pal'])
        elif d['t0'] - prev['t1'] <= GAP_JOIN:
            a = min(d['t0'], max(prev['t1'] + 0.1, d['t0'] - EARLY, prev['a'] + (need(prev) if need else 0))); prev['b'] = round(a, 3)      # need：本机补的那张不够这套样子最短秒，就晚一点接，最晚接到下一句开口
        else:
            prev['b'] = round(prev['t1'] + 0.1, 3); a = d['t0'] - IDLE_LEAD; idle(prev['b'], a, prev['k'], prev['pal'])
        d['a'] = round(max(T0, a), 3); shots.append(d); prev = d
    if prev is None: idle(T0, T1, 1, pal0)
    elif T1 - prev['t1'] <= GAP_JOIN: prev['b'] = T1
    else: prev['b'] = round(prev['t1'] + 0.1, 3); idle(prev['b'], T1, prev['k'], prev['pal'])
    return shots


# ───────── 本机再拦一道（总控 2026-11-16 夜定）：只用规矩判，不叫通义；宁可少拦也别错拦 ─────────
# 转折、因果：两块出自同一句（同一行字幕或挨着的两行），那几行里又没有转折词、因果词，就不许画成两块加箭头，照兜底落回图标加词。
# 问答：问的那块没有问的样子，或者答的那块在原话里排在问的前面，就不画成问答，照兜底落回图标加词。
# 并排对照：有一边的小标题不是原话里挨着正文的字（中间隔了六个字以上，或者压根找不到），两边的小标题都去掉，只画正文。
# 引话：出处超过 8 个字，不画出处，只画那句话。
# 大数没填说的是什么：照画，不拦。
# 单子、流程、连锁（总控 11-17 夜）：各格出自同一句话就不画成清单（「优势持续 / 几年十几年 / 变成什么样」读不通）。字幕行里没有断句记号，所以这样判：
#   有一格跨了两行字幕，或者两格落在同一行字幕里，就算同一句切出来的；各格各占一行的（「早点发现 / 排查 / 安排检修」）照画。格里的字在原话里找不到原样的（改写过），判不了，不拦。
#   拦下的落回图标加词（单子有题目用题目），落不了就只出字幕。
TURN_W = ('但', '可', '却', '不过', '其实', '然而', '只是', '反而', '反倒', '偏偏', '没想到', '谁知')
CAUSE_W = ('因为', '所以', '于是', '结果', '导致', '因此', '因而', '使得', '造成', '既然', '难怪', '怪不得', '以至', '才', '让')
ASK_W = ('什么', '怎么', '怎样', '为啥', '多少', '哪', '谁', '如何', '是否', '难道', '吗', '？', '?')
ASK_TAIL = ('呢', '吗', '么', '嘛', '？', '?')
_ABA = re.compile(r'(.)[不没]\1')                              # 能不能、是不是、有没有 这一类
NAME_GAP, WHO_MOST = 6, 8
LIST_KINDS = ('单子', '流程', '连锁')


def _items(kind, d):
    if kind == '单子': return [tx(x) for x in d['行']]
    if kind == '流程': return [tx(x['词']) for x in d['步']]
    return [tx(x) for x in d['环']]


def guard(kind, fill, lines, la, lb):
    """回 None（不拦），或 ('落', None, 为什么)：不许照这一种画，照兜底往下落；或 ('改', 新填法, 为什么)：照新填法画。判不了的一律不拦。"""
    try:
        d = fill[0] if isinstance(fill, list) and fill and isinstance(fill[0], dict) else fill
        if kind in ('转折', '因果'):
            A, B = d['A'], d['B']
            if not (isinstance(A, dict) and isinstance(B, dict) and isinstance(A.get('li'), int) and isinstance(B.get('li'), int)): return None
            lo, hi = sorted((A['li'], B['li']))
            if hi - lo > 1: return None
            text = ''.join(l['text'] for l in lines[lo:hi + 1])
            if any(w in text for w in (TURN_W if kind == '转折' else CAUSE_W)): return None
            return '落', None, f'两块出自同一句，中间没有{"转折" if kind == "转折" else "因果"}词'
        if kind == '问答':
            q, a = tx(d['问']), tx(d['答']); text = ''.join(l['text'] for l in lines[la:lb]); iq, ia = text.find(q), text.find(a)
            if not q or iq < 0: return None
            if 0 <= ia < iq: return '落', None, '答的那块在原话里排在问的前面'
            tail = text[iq + len(q):iq + len(q) + 1]
            if any(w in q for w in ASK_W) or _ABA.search(q) or tail in ASK_TAIL or q[-1:] in ASK_TAIL: return None
            return '落', None, '问的那块没有问的样子'
        if kind == '并排对照':
            at = lambda x: (sum(len(l['text']) for l in lines[:x['li']]) + lines[x['li']]['text'].index(x['text'])) if isinstance(x, dict) and isinstance(x.get('li'), int) and x.get('text') else None
            bad = False
            for k in ('L', 'R'):
                n, s = d[k].get('name'), d[k].get('say')
                if not tx(n): continue
                pn, ps = at(n), at(s)
                if pn is None or ps is None: return None
                gap = ps - (pn + len(tx(n))) if pn <= ps else pn - (ps + len(tx(s)))
                if gap > NAME_GAP: bad = True
            if not bad: return None
            new = dict(d); new['L'] = dict(d['L'], name=None); new['R'] = dict(d['R'], name=None)
            return '改', ([new] + list(fill[1:]) if isinstance(fill, list) else new), '小标题不是原话里挨着正文的字，去掉小标题'
        if kind in LIST_KINDS:
            its = [_qi(str(x)) for x in _items(kind, d)]; rows = [_qi(l['text']) for l in lines[max(0, la):min(len(lines), max(lb, la + 1))]]
            if len(its) < 2 or not all(its) or not rows: return None
            whole, home, j0 = ''.join(rows), [], 0
            for x in its:
                j = next((j for j in list(range(j0, len(rows))) + list(range(j0)) if x in rows[j]), None)
                if j is None: return ('落', None, '清单各格出自同一句话（「{}」跨了两行字幕）'.format(x)) if x in whole else None
                home.append(j); j0 = j
            if len(set(home)) < len(home): return '落', None, '清单有两格出自同一行字幕（同一句话切开的）'
            return None
        if kind == '引话':
            who = fill[1] if len(fill) > 1 else None
            if who and len(str(who)) > WHO_MOST: return '改', [fill[0], None] + list(fill[2:]), '出处太长，不画出处'
    except Exception:
        return None
    return None


# ───────── 屏上的字再过一道（总控 11-16 夜定，本机规矩，不叫通义）─────────
# 一、大字、小标题、图标旁边的词里的语气词（啊、呢、吧、呀、哎、嘛、哦、嗯）去掉；去完不成话（剩不到两个字）就不画这张。
# 二、原话那句带否定或辟谣的字，截出来上屏的字没带上，不画这张（「不是 A」截成「A」，意思就反了）。
# 三、上屏的字里有治好、治愈、根治、包治、特效、保证这类字，一律不画（像医疗宣称）。补的图标词也走这三条。
#     11-17 夜总控加：这张画面盖到的原话里带这类字（再加降血糖、抗癌），也一律不画（「听说玉石床垫能治好糖尿病」配医院图标加「糖尿病」，单截一帧像在宣称疗效）。
QI_W = '啊呢吧呀哎嘛哦嗯'
QI_KEEP = ('酒吧', '网吧', '贴吧', '吧台', '干嘛', '呢子', '呢绒')      # 这几个词里的字不是语气词
NEG_W = ('不', '没', '别', '未', '虚假', '谣言', '辟谣', '骗', '假的', '忽悠', '智商税')
NEG_NOT = ('不仅', '不但', '不只', '不光', '不单', '不管', '不论', '不久', '不少', '不断', '不同', '不错', '不过', '不然', '要不', '差不多', '了不起', '没想到',
           '别的', '别人', '别处', '别家', '特别', '区别', '分别', '级别', '类别', '告别', '性别', '差别', '识别', '辨别', '个别', '未来')      # 带「不、没、别、未」可不是在否定（在第八、九份真答卷上试过：不加这些，拦下的五张全是错拦）
MED_W = ('治好', '治愈', '根治', '包治', '特效', '保证', '痊愈', '药到病除', '神药')
MED_SRC = MED_W + ('降血糖', '抗癌')


def _qi(s):
    for i, w in enumerate(QI_KEEP): s = s.replace(w, '\x00{}\x01'.format(i))
    s = ''.join(c for c in s if c not in QI_W)
    for i, w in enumerate(QI_KEEP): s = s.replace('\x00{}\x01'.format(i), w)
    return s


def _clean(x):
    """填法里上屏的字一律去掉语气词（数、图标名、时刻这些不是中文字的，不受影响）。"""
    if isinstance(x, str): return _qi(x)
    if isinstance(x, list): return [_clean(v) for v in x]
    if isinstance(x, dict): return {k: _clean(v) for k, v in x.items()}
    return x


def _texts(x):
    """填法里上屏的那些中文字（图标名这种纯英文的不算）。"""
    if isinstance(x, str): return [x] if re.search(r'[\u4e00-\u9fff]', x) else []
    if isinstance(x, list): return [s for v in x for s in _texts(v)]
    if isinstance(x, dict): return [s for k, v in x.items() if k not in ('图标', '答的', '结果', '重') for s in _texts(v)]
    return []


def _neg(s):
    for w in NEG_NOT: s = s.replace(w, '')
    return any(w in s for w in NEG_W)


def screen_check(fill_raw, fill, lines, la, lb):
    """回 None（照画），或者为什么不画。fill_raw 是去语气词以前的，fill 是去了以后的。"""
    try:
        before, after = _texts(fill_raw), _texts(fill)
        if any(_qi(x) != x and len(_qi(x).strip()) < 2 for x in before): return '去掉语气词以后不成话'
        for s in after:
            if any(w in s for w in MED_W): return '屏上的字像医疗宣称（{}）'.format(next(w for w in MED_W if w in s))
        rows = [l['text'] for l in lines[max(0, la):min(len(lines), max(lb, la + 1))]]
        for r in rows:
            if any(w in r for w in MED_SRC): return '原话那句像医疗宣称（{}）'.format(next(w for w in MED_SRC if w in r))
        for s in after:
            if len(s) < 2 or _neg(s): continue
            src = next((r for r in rows if s in _qi(r)), None)
            if src is None:                                      # 找不到原样的：取和它挨着的字最多的那一行（至少连着三个字一样）
                best = max(((max((k for k in range(3, len(s) + 1) for i in range(len(s) - k + 1) if s[i:i + k] in _qi(r)), default=0), r) for r in rows), default=(0, None))
                src = best[1] if best[0] >= 3 else None
            if src is not None and _neg(src): return '原话那句带否定或辟谣的字，上屏的「{}」没带上'.format(s)
    except Exception:
        return None
    return None


def plan(content, style):
    """回 (给页面的 DATA, 每张画面落到了哪儿的清单, 这条片的几个数)。先只排云端的；排完哪几句没被画面盖着，再把本机给这几句备的加进去重排一遍。"""
    cloud = [p for p in content['画面'] if not p.get('本机')]; mine = [p for p in content['画面'] if p.get('本机')]
    if content['时长'] <= SHORT_SEC:                             # 短录音：云端的纯字画面，盖着的句子本机都配得上图标，就换成图标（他：「全是字儿，没有图案」）
        has = {p['la'] for p in mine}
        cloud = [p for p in cloud if not (p['种'] in TEXT_ONLY and all(i in has for i in range(p['la'], max(p['lb'], p['la'] + 1))))]
    out = _plan(dict(content, 画面=cloud), style)
    if not mine: return out
    on = {s['k'] for s in out[0]['shots'] if s['kind'] != 'none'}
    cov = {i for r in out[1] if r['号'] in on for i in range(r['la'], max(r['lb'], r['la'] + 1))}
    need = [p for p in mine if p['la'] not in cov]
    return _plan(dict(content, 画面=cloud + need), style) if need else out


def _plan(content, style):
    dur = content['时长']; can = style['会画']; pals = style.get('几套色') or [None]; mins = style.get('最短秒') or {}
    pics = sorted(content['画面'], key=lambda p: p['t0'])
    topic = lambda la: next((i for i, t in enumerate(content['话题']) if t['la'] <= la < t['lb']), 0)
    drawn, report, las = [], [], {}
    for k, p in enumerate(pics, 1):
        can2, f, bad = dict(can), None, []
        g = guard(p['种'], p['填'], content['句子'], p['la'], p['lb']) if p['种'] in can else None      # 本机再拦一道（这套样子本来就不会画的不用拦，反正要落）
        fill0 = g[1] if g and g[0] == '改' else p['填']
        if g and g[0] == '落':
            can2.pop(p['种'], None)
            if p['种'] in LIST_KINDS:
                for x in LIST_KINDS: can2.pop(x, None)      # 流程、连锁本来会落成单子：清单被拦下的，单子也不许画
        fill1 = _clean(fill0); no = screen_check(fill0, fill1, content['句子'], p['la'], p['lb']); fill0 = fill1      # 屏上的字再过一道：去语气词、否定截掉了、像医疗宣称
        if no: g = ('不画', None, no); can2 = {}
        while True:                                              # 这一种填的东西读不出来：当这套样子不会画它，照兜底往下落
            kind, fill, path, lost = resolve(p['种'], fill0, can2)
            if not kind: break
            try: f = fields(kind, fill); break
            except Exception: bad.append(kind); can2.pop(kind, None)
        row = dict(号=k, t0=p['t0'], t1=p['t1'], la=p['la'], lb=p['lb'], 云端挑的=p['种'], 补的=bool(p.get('补')), 本机补的=bool(p.get('本机')), 画成=kind or ('不画，只出底和字幕（填的东西读不出来）' if bad else '不画，只出底和字幕（{}）'.format(no) if no else '不画，只出底和字幕'), 少了什么=lost, 签=p.get('签'), 拦=g[2] if g else None)
        if kind:
            if f:
                together = bool(p.get('补')) or (len(path) > 1 and kind == '图标词') or (bool(p.get('本机')) and kind == '图标词')      # 补的图标词、别的种类落回来的图标加词：字跟着图标一起进
                f.update(kind=can[kind], k=k, pal=pals[topic(p['la']) % len(pals)], t0=p['t0'], t1=p['t1'], hand=False, early=True, together=together)
                drawn.append(f); las[k] = p['la']
        report.append(row)
    while True:                                                  # 这套样子嫌太短、画不完进场的：先丢补的、再丢最短的，一次丢一张，丢完重排
        shots = timeline(drawn, 0.0, dur, pals[0], head=lambda d: las.get(d['k'], 0) == 0, need=lambda d: mins.get(d['kind'], 0) + 0.02 if report[d['k'] - 1]['本机补的'] else 0)
        short = [s for s in shots if s['kind'] != 'none' and s['b'] - s['a'] < mins.get(s['kind'], 0) - 1e-6]
        if not short: break
        s = min(short, key=lambda s: (not (report[s['k'] - 1]['补的'] or report[s['k'] - 1]['本机补的']), s['b'] - s['a'])); drawn = [d for d in drawn if d['k'] != s['k']]
        report[s['k'] - 1]['画成'] = f'不画，只出底和字幕（只有 {s["b"] - s["a"]:.1f} 秒，这套样子的进场画不完）'
    seed = int(content['指纹'][:6], 16) % 1000; real = [s for s in shots if s['kind'] != 'none']
    subj = [s for s in real if s['kind'] in ('icon', 'hero')]; icons = [s for s in real if s['kind'] == 'icon']; titles = [s for s in real if s['kind'] == 'title']
    nums = [s for s in real if s['kind'] == 'num']
    for lst, key, K, salt in ((subj, 'E', 4, 0), (icons, 'Ei', 4, 1), (icons, 'P', 4, 9), (real, 'T', 5, 5), (titles, 'E', 2, 3), (nums, 'E', 2, 7)):
        for s, v in zip(lst, bag(seed, len(lst), K, salt)): s[key] = v
    for i, s in enumerate(icons): s['ord'] = i
    names = style.get('进场') or {}; which = style.get('进场号') or {}
    for s in real:
        lst = names.get(s['kind']) or ['（没登记）']; s['进场'] = lst[s.get(which.get(s['kind'], 'E'), 0) % len(lst)]
    empty = sum(s['b'] - s['a'] for s in shots if s['kind'] == 'none')
    stat = dict(一共秒=round(dur, 1), 空屏秒=round(empty, 1), 空屏占几成=round(empty / dur, 3) if dur else 0, 画了几张=len(real), 里头补的=sum(1 for s in real if report[s['k'] - 1]['补的']), 本机补的=sum(1 for s in real if report[s['k'] - 1]['本机补的']), 本机拦了=sum(1 for r in report if r.get('拦')),
                各种进场来了几回=dict(collections.Counter(f"{KIND_CN[s['kind']]}：{s['进场']}" for s in real)))
    data = dict(lines=content['句子'], shots=shots, t0=0.0, t1=dur, k0=shots[0]['k'] if shots else 1, nAll=len(pics), nIcon=len(icons), seed=seed, 指纹=content['指纹'])
    return data, report, stat


# ───────── 拼页面：一套样子一个拼法。页面起来以后要有 window.READY === true 和 seek(t)，和别的画风页一样，出片照旧一帧一帧截 ─────────
_js = lambda obj: json.dumps(obj, ensure_ascii=False).replace('</', '<\\/')      # 塞进网页脚本里的数据：字幕里万一有 </script> 这种字也不会把脚本截断
SEEK = "<script>(() => { const r = window.READY; window.READY = false; window.seek = t => { window.draw(t); }; Promise.resolve(r).then(() => { window.READY = true; }); })();</script>"


def _mot():
    """图标自己的小动作那几张表和算法（专业版脚本 5_动作.js 的前半份，和字卡那套共用一份）。"""
    src = (APP / '画风' / '字卡' / '专业版' / '5_动作.js').read_text(encoding='utf-8'); src = src[:src.index('// 把一个已经画好的图标')]
    if 'function motVal' not in src or 'huaApi' in src: raise RuntimeError('专业版的动作脚本对不上，请把软件重新解压一次。')
    return src


def _icons_js():
    return '<script>window.ICONS = {};</script><script src="/icons.js"></script>\n<script>\n' + (APP / '画风' / '字卡' / '专业版' / '2_图标.js').read_text(encoding='utf-8') + '\n</script>'


def _pin_pic(data):
    H = HOME / '象形'; face = lambda fam, url, wt: f"@font-face{{font-family:\"{fam}\";src:url('{url}');font-weight:{wt};font-display:block}}"
    eng = (H / 'engine.js').read_text(encoding='utf-8')      # 抄来的那份不动；只在拼出来的页面里把写死的宽、高、格子换成竖屏的
    for old, new in (('const W = 1920, H = 1080;', 'const W = window.PIC_W || 1920, H = window.PIC_H || 1080;'), ('const CELL = 180;', 'const CELL = window.PIC_CELL || 180;')):
        if eng.count(old) != 1: raise RuntimeError('象形样子的脚本对不上，请把软件重新解压一次。')
        eng = eng.replace(old, new)
    opt = dict(zh='软件', list='竖', blur=True, hudText=False)      # 总控 11-16 定：竖排、软件现有的中文字体、运动模糊开着、角上不出字
    faces = face('Inter Tight', '/yz/InterTightwght.ttf', '100 900') + face('DM Mono', '/yz/DMMono-Medium.ttf', '500') + face('NotoSC', '/fonts/NotoSansSC-VF.ttf', '100 900')
    html = f'''<!doctype html><html><head><meta charset="utf-8"><style>{faces} html,body{{margin:0;background:#000;overflow:hidden}} canvas{{display:block}}</style></head><body>
<canvas id="c" width="1080" height="1920"></canvas>
<script>window.PIC_W = 1080; window.PIC_H = 1920; window.PIC_CELL = 180;</script>
{_icons_js()}
<script>
{eng}
</script>
<script>
const {{ clamp, lerp }} = G;
const OPT = {_js(opt)};
const DATA = {_js(data)};
{_mot()}
{(HOME / '图标画.js').read_text(encoding='utf-8')}
{(H / '页面.js').read_text(encoding='utf-8')}
</script>
{SEEK}</body></html>'''
    return html, {'/yz/InterTightwght.ttf': H / 'fonts' / 'InterTightwght.ttf', '/yz/DMMono-Medium.ttf': H / 'fonts' / 'DMMono-Medium.ttf'}


def _wrap(name, path):                                   # 抄来的文件原样不动；拼页面时去掉 export、包成一个对象
    src = path.read_text(encoding='utf-8'); names = re.findall(r'^export (?:async )?(?:function|class|const) (\w+)', src, flags=re.M)
    return f'const {name} = (() => {{\n' + re.sub(r'^export ', '', src, flags=re.M) + f'\nreturn {{ {", ".join(names)} }};\n}})();\n'


def _pin_holo(data):
    H = HOME / '全息'; wts = (('Light', 300), ('Regular', 400), ('Medium', 500), ('SemiBold', 600))
    faces = ''.join(f"@font-face{{font-family:'Rajdhani';src:url('/yz/Rajdhani-{n}.ttf');font-weight:{w}}}" for n, w in wts)
    faces += "@font-face{font-family:'ShareTechMono';src:url('/yz/ShareTechMono-Regular.ttf');font-weight:400}@font-face{font-family:'NotoSC';src:url('/fonts/NotoSansSC-VF.ttf');font-weight:100 900}"
    html = f'''<!doctype html><html><head><meta charset="utf-8"><style>{faces} html,body{{margin:0;background:#000;overflow:hidden}} canvas{{display:block}}</style></head><body>
<canvas id="c" width="1080" height="1920"></canvas>
{_icons_js()}
<script>
{_wrap('HOLO', H / 'engine' / 'holo.js')}
{_wrap('HUD', H / 'engine' / 'hud.js')}
const DATA = {_js(data)};
const WL = {_js(dict(icons=list(white())))};
{(H / '页面.js').read_text(encoding='utf-8')}
</script>
<script>
{_mot()}
{(HOME / '图标画.js').read_text(encoding='utf-8')}
</script>
<script>
{(H / '立体.js').read_text(encoding='utf-8')}
</script>
<script>
{(H / '场面.js').read_text(encoding='utf-8')}
</script>
{SEEK}</body></html>'''
    files = {f'/yz/Rajdhani-{n}.ttf': H / 'fonts' / f'Rajdhani-{n}.ttf' for n, _ in wts}; files['/yz/ShareTechMono-Regular.ttf'] = H / 'fonts' / 'ShareTechMono-Regular.ttf'
    return html, files


PIN = {'象形': _pin_pic, '全息': _pin_holo}


def page(juben_json, look):
    """这条专业版的片子，照这套样子拼出来的一页。回 (网页, 它要的字体文件 {网址: 本机文件}, 账)。"""
    jb = json.loads(Path(juben_json).read_text(encoding='utf-8'))
    data, report, stat = plan(content_of(jb), load_style(look))
    html, files = PIN[look](data)
    on = {s['k'] for s in data['shots'] if s['kind'] != 'none'}      # 这套样子真画出来的那几张：登记给修改页（列的就是画的），点 × 就是把这颗签记进那一句的 hide 单
    drawn = [dict(line=r['签'][0], text=r['签'][1], kind='动画') for r in report if r['号'] in on and r.get('签')]
    if html.count(SEEK) != 1: raise RuntimeError('样子的页面拼得不对，请把软件重新解压一次。')
    html = html.replace(SEEK, f'<script>window.DRAWN = {_js(drawn)};</script>\n' + SEEK)
    return html, files, dict(样子=look, 落到哪儿=report, 数=stat)
