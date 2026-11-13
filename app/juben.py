# 剧本：「懂」层的唯一输出、画风的唯一输入、用户看和改的唯一对象（架构 2026-11-07 契约一）。
# 只有相对于说话的时刻，没有任何一段录音的常数。画风不许读原文自己猜，剧本里没有的画面里就没有。
#
# 剧本.json 的字段（键名用英文，便于程序读；意思如下）：
#   ver            剧本格式版本（今天 1）
#   writer         谁写的（xieshou.py 里的写手名：规则 / AI）
#   dur            片长（秒）
#   title / tag / cover   封面大字、角标、封面
#   hero / heroLine / define   主角词、它在第几句被定义、定义句时刻
#   single         重复最多的单字（钱、电），没有主角词时可用
#   persons        含人物词（孩子、老人……）的句数
#   lines[]        每句：
#       text / t0 / t1 / cs        文字、起止、每个字 [字, 起, 止]
#       kw                         旧版强调词（字卡画风用）
#       show[]                     这句上屏的东西：{text, t0, t1, asset}。asset = Lucide 图标名（11-07 起由关键词→图标表填，
#                                  查不到为 null；以后可挂一张图）。上屏词本身查到图标，图标挂在它身上；
#                                  是这句别的词查到的，另起一项（text = 触发的词）。一句最多一个图标
#       word / wt0 / wt1           上屏词和它的时刻（有上屏词时就是 show 的第一项）；放不出词时 word 为 null
#       pol                        上下：1 往上、-1 往下、0 不动
#       person / wp                这句有人物词 / 上屏词本身是人物词
#       gap / rate                 到下一句的停顿、相对语速
#       brk                        字幕在第几个字前换行（没有为 null）
#       nums[]                     这句里的数：{text 原文, value, unit, a, b 字下标, t, cn 是否中文说的, cut 是否被切成两行}
#       pcut                       普通句卡新排法的折点列表：第几个字块前折（一排最多八个字，planner.para_fold）；不用折的不写
#   scenes[]       句型段落：type（13 种之一）、la/lb 行范围、t0/t1、句型字段；style 今天空着，以后可给这段指定画风
#                  tpl（11-12 夜）：按意思挂的模板，planner 认出来的：kind 禁止 ban / 举例 example / 时间 time / 增长 grow，line 第几句，
#                  key 关键词的字下标 [起, 止)，word 关键词，done / fade / gone 主动作做完、卡开始淡出、卡退完的时刻（时间账用），其余是各模板自己的字段
#   groups[]       词组：能踩的小段（line, a, b, text, t0, t1, verb, word, pause）
#   acts[]         数字、对比、翻转、清单等动作事件
#   crowds[]       「很多人」一群
#   end            结尾：kind = fall（往下砸）/ calm，word，t，t1
#   turns[]        转折词（其实、但是……）时刻
#   segs[]         换段时刻：句间停顿 ≥0.3 秒后的那句开头
#   topics[]       真换话题分段：停顿 ≥1.0 秒切开，{la, lb, t0, t1}
import json, re

VER = 1
SEG_GAP, TOPIC_GAP = 0.3, 1.0   # 方向案2 第二节 ⑦


def assemble(p, ev):
    """planner 排的句型 p + rules 算的事件 ev → 剧本。"""
    L = []
    nums = p.get('_nums') or [[] for _ in p['lines']]
    breaks = {int(k): v for k, v in ev['breaks'].items()}
    for i, (pl, r) in enumerate(zip(p['lines'], ev['lines'])):
        show = [dict(text=w, t0=r['wt0'], t1=r['wt1'], asset=None) for w in ev['kw'][i]]
        pr = (ev.get('props') or [None] * len(p['lines']))[i]
        if pr and show and pr['own']: show[0]['asset'] = pr['icon']
        elif pr: show.append(dict(text=pr['text'], t0=pr['t0'], t1=pr['t1'], asset=pr['icon']))
        L.append(dict(i=i, text=r['text'], t0=pl['t0'], t1=pl['t1'], cs=pl['cs'], kw=pl['kw'], show=show,
                      word=r['word'], wt0=r['wt0'], wt1=r['wt1'], pol=r['pol'], person=r['person'], wp=r['wp'],
                      gap=r['gap'], rate=r['rate'], brk=breaks.get(i), nums=nums[i], **({'pcut': pl['pcut']} if pl.get('pcut') else {})))   # pcut：普通句卡新排法的折行点（11-12 夜，planner.para_cut）
    segs, topics, a = [], [], 0
    for i in range(1, len(L)):
        g = L[i]['t0'] - L[i - 1]['t1']
        if g >= SEG_GAP: segs.append(L[i]['t0'])
        if g >= TOPIC_GAP:
            topics.append(dict(la=a, lb=i, t0=L[a]['t0'], t1=L[i - 1]['t1'])); a = i
    if L: topics.append(dict(la=a, lb=len(L), t0=L[a]['t0'], t1=L[-1]['t1']))
    scenes = [dict(s, style=None) for s in p['scenes']]
    return dict(ver=VER, dur=p['dur'], title=p['title'], tag=p['tag'], cover=p['cover'],
                hero=ev['hero'], heroLine=ev['heroLine'], define=ev['define'], single=ev['single'], persons=ev['persons'],
                lines=L, scenes=scenes, groups=ev['groups'], acts=ev['acts'], crowds=ev['crowds'], end=ev['end'],
                turns=ev['turns'], segs=segs, topics=topics)


ROW_KEYS = ('i', 'text', 't0', 't1', 'word', 'wt0', 'wt1', 'pol', 'person', 'wp', 'gap', 'rate')


def to_ev(j):
    """剧本 → 11-06 样片工程那份事件格式（跳字、夜路的画面程序吃这个）。用来证明并进来以后结果没变。"""
    return dict(single=j['single'], dur=j['dur'], hero=j['hero'], heroLine=j['heroLine'], define=j['define'],
                lines=[{k: l[k] for k in ROW_KEYS} for l in j['lines']], groups=j['groups'], acts=j['acts'], crowds=j['crowds'],
                end=j['end'], turns=j['turns'], kw=[[s['text'] for s in l['show']] for l in j['lines']],
                breaks={str(l['i']): l['brk'] for l in j['lines'] if l['brk'] is not None}, persons=j['persons'])


def to_plan(j, theme='night'):
    """剧本 → 旧版 plan（字卡画风还没搬家前，director.js 吃这个）。"""
    return dict(dur=j['dur'], theme=theme, tag=j['tag'], title=j['title'], cover=j['cover'],
                lines=[dict(t0=l['t0'], t1=l['t1'], cs=l['cs'], kw=l['kw']) for l in j['lines']],
                scenes=[{k: v for k, v in s.items() if k != 'style'} for s in j['scenes']])


def check(j):
    """剧本自查：缺字段、时刻倒着走、留的空位被删了，都报出来。返回问题清单（空 = 没问题）。"""
    bad = []
    for k in ('ver', 'dur', 'title', 'lines', 'scenes', 'groups', 'acts', 'end', 'segs', 'topics'):
        if k not in j: bad.append(f'缺 {k}')
    for l in j.get('lines', []):
        if l['t1'] < l['t0']: bad.append(f"第 {l['i']} 句结束早于开始")
        if any('asset' not in s for s in l['show']): bad.append(f"第 {l['i']} 句上屏词缺 asset 空位")
        if ''.join(c[0] for c in l['cs']) != l['text']: bad.append(f"第 {l['i']} 句文字和逐字不一致")
    if any('style' not in s for s in j.get('scenes', [])): bad.append('有段落缺 style 空位')
    return bad


def load(path):
    return json.loads(open(path, encoding='utf-8').read())


def save(j, path):
    """先写临时文件再整份换上去。重新生成时原稿是硬链接带进新文件夹的，原地写会连着改掉别的修改版的原稿（11-09 盲审）；
    换上去以后新文件夹这份就是自己的了。"""
    import os, time
    path = str(path); tmp = path + '.tmp'
    open(tmp, 'w', encoding='utf-8').write(json.dumps(j, ensure_ascii=False, indent=1))
    for _ in range(100):
        try: os.replace(tmp, path); return
        except PermissionError: time.sleep(0.05)                 # Windows：网页正读着，等一下再换
    os.replace(tmp, path)


def _hide(l, w, on=True):
    """第 l 句不许再画 w（画风登记时查这张单，见 画风/公共/core.js 的 said）；on=False 是从单上拿掉。"""
    h = [x for x in l.get('hide', []) if x != w]
    if on and w: h.append(w)
    if h: l['hide'] = h
    else: l.pop('hide', None)


def apply_show_edits(j, edits):
    """校字页的修改（第 5 步）。edits 是一轮一轮的修改（merge_show_edits 存的样子），也收单独一轮（每句一项）。
    从写手原稿起，一轮一轮按先后套：每一轮都是照上一条片子改的，先后套就是「后说的算」（第九轮验收：跨画风加回被盖掉）。
    返回真改了的处数（各轮加起来）。"""
    return sum(_apply_round(j, r) for r in _as_rounds(edits))


def _apply_round(j, edits):
    """一轮修改：edits 每句一项，None = 没动；字典里可以有：
       word: 新上屏词或 null（跳字、夜路这类画风画的词）；kw: 新标亮词或 null（字卡标亮的词）；
       icon: false 去掉这句的图标；drop: [字…] 这句画面里别的地方画出来的字，不许再画。
    不许再画的字记进这句的 hide 单；画风每画一个字都先查这张单（画风/公共/core.js 的 said），所以删哪个字都删得干净。
    上屏词删了或换了：旧词进 hide 单，它挂的图标去掉；对比牌、翻牌里同一个字跟着换；换上的词查得到图标就挂上。
    换的词必须是这句字幕里有的字（找不到就当没改）。返回真改了的处数。"""
    from planner import icon_for
    from rules import NOT_PROP, pos_time
    n = 0
    for l, e in zip(j['lines'], edits or []):
        if not isinstance(e, dict): continue
        i, text = l['i'], ''.join(c[0] for c in l['cs'])
        kw0 = l['kw'] or ''; via = False
        hid = lambda v: bool(v) and any(_same(x, v) for x in l.get('hide', []))   # 前几轮删掉的
        if 'kw' in e and 'word' not in e and ((l['word'] or '') == kw0 or (l['word'] is None and hid(_in_line(text, re.sub(r'\s+', '', e.get('kw') or ''))))):
            e = dict(e, word=e['kw']); via = True                       # 字卡里删、换、加标亮词，它也是这句的上屏词：跳字、夜路跟着删、换、加（连它挂的图标）；
                                                                        # 跳字里删掉的词，到字卡里填回来：跳字也画回来
        if 'word' in e:
            old, w = l['word'], re.sub(r'\s+', '', e.get('word') or '') or None   # 字幕里的空格听写时就没了，填的词也去掉空格再比
            if w is not None: w = _in_line(text, w) or old
            if w != old:
                n += 1; back = hid(w)
                if old and not _same(old, w): _hide(l, old)   # 「2025年」换成「2025」是同一个数：旧的不进单，不然新的跟着被藏（第九轮验收）
                if w: _unhide(l, w)
                if old:                                     # 片头和封面大字里这个词的标亮也去掉（封面一律按字卡画）
                    unmark = lambda t: t.replace('[[' + old + ']]', old)
                    j['title'] = [unmark(t) for t in j.get('title', [])]
                    if isinstance(j.get('cover'), dict): j['cover']['title'] = [unmark(t) for t in j['cover'].get('title', [])]
                if w is None:
                    l['word'], l['wt0'], l['wt1'], l['wp'] = None, l['t0'], l['t1'], False
                else:
                    t0, t1 = pos_time(l, w)                 # 一个字块可能是好几个字母（「fo」「two」），不能拿第几个字当第几块
                    l['word'], l['wt0'], l['wt1'], l['wp'] = w, t0, t1, False
                if (l['kw'] or '') == (old or ''): l['kw'] = w or ''
                elif back and not l['kw']: l['kw'] = w              # 字卡里删掉的标亮词，在跳字、夜路里填回来：字卡也标回来（第九轮验收：跨画风加回）
                ic = icon_for(w) if w else None
                own = [dict(text=w, t0=l['wt0'], t1=l['wt1'], asset=ic if ic not in NOT_PROP else None)] if w else []
                rest = [s for s in l['show'] if s.get('asset') and s['text'] not in (old, w) and not (own and own[0]['asset'])][:1]
                l['show'] = own + rest
                for g in j.get('groups', []):
                    if g['line'] == i: g['word'] = bool(w) and g['a'] <= text.find(w) < g['b']
                if w:                                       # 换词：对比牌、翻牌里用了同一个字的跟着换（删词靠 hide 单）
                    for a in j.get('acts', []):
                        if a.get('k') == 'compare':
                            if a['line'] == i and a.get('L') == old: a['L'], a['tL'], a['tL1'] = w, l['wt0'], l['wt1']
                            if a.get('lineR') == i and a.get('R') == old: a['R'], a['tR'], a['tR1'] = w, l['wt0'], l['wt1']
                        if a.get('k') == 'flip':
                            if a['line'] == i and a.get('A') == old: a['A'], a['tA'] = w, l['wt0']
                            elif a.get('lineB') == i and a.get('B') == old: a['B'], a['tB'] = w, l['wt0']
        if 'kw' in e:
            old, w = kw0, re.sub(r'\s+', '', e.get('kw') or '')
            if w: w = _in_line(text, w) or old
            if w == old and w != (l['kw'] or ''):          # 上屏词那步把标亮词带走了，可修改里要的是原来的：放回来
                n += 1; l['kw'] = w
                if w: _unhide(l, w)
            if w != old:
                n += 0 if via else 1; l['kw'] = w
                if old and old != (l['word'] or '') and not _same(old, w): _hide(l, old)   # 删掉的标亮词进不许画单：大数字、换别的画风都不再画它（它要是这句现在的上屏词，或和新词同一个数，不进）
                if w: _unhide(l, w)
                for s in j.get('scenes', []):
                    if s['la'] <= i < s['lb'] and s.get('kw') == old: s['kw'] = w if w and w in str(s.get('B', '')) else ''
                if old:                                     # 片头和封面大字里同一个词的标亮也去掉（字卡）
                    fix = lambda t: t.replace('[[' + old + ']]', old)
                    j['title'] = [fix(t) for t in j.get('title', [])]
                    if isinstance(j.get('cover'), dict): j['cover']['title'] = [fix(t) for t in j['cover'].get('title', [])]
        for k in ('word', 'kw'):                            # 填的词这句已经是了（字卡删了「80%」、标亮还是「八成」，再填一遍）：单上同一个字、同一个数也拿掉
            v = _in_line(text, re.sub(r'\s+', '', e.get(k) or '')) if isinstance(e.get(k), str) else None
            if v and _unhide(l, v): n += 1
        for x in e.get('drop') or []:
            if isinstance(x, str) and x and x not in l.get('hide', []): _hide(l, x); n += 1
        if e.get('icon') is False and (any(s.get('asset') for s in l['show']) or not l.get('noicon')):
            n += 1; l['noicon'] = True                      # 字卡的段落图标认这一笔（画风/字卡/seek.js 的 zkScene）
            l['show'] = [dict(s, asset=None) for s in l['show'] if s['text'] == l['word']]
    return n


def _nums(t):
    """一个词里的数，中文数字先换成阿拉伯数字（「八成」→ 80，「两千零二十五年」→ 2025）。"""
    from shuzi import normalize
    return re.findall(r'\d+(?:\.\d+)?', normalize(t or '', strict=True)[0])


def _same(a, b):
    """同一个字，或同一个数（「2025」和「2025年」，字幕里的「八成」和画出来的「80%」）。
    画风 core.js 的 hiddenIn 也按同一个数藏，这里再认中文数字：拿掉、不藏都要比它宽，不然加回来的会被吞。"""
    if a == b: return True
    na = _nums(a)
    return bool(na) and na == _nums(b)


def _unhide(l, w):
    """第 l 句又要画 w：不许画单上同一个字、同一个数都拿掉。返回拿掉了几个。"""
    h0 = l.get('hide', []); h = [x for x in h0 if not _same(x, w)]
    if h: l['hide'] = h
    else: l.pop('hide', None)
    return len(h0) - len(h)


def _in_line(text, w):
    """填的词在这句字幕里找：找得到就用它；找不到，再按画面上的写法找（填「80%」，字幕里是「八成」），换回字幕里的说法。
    都找不到回 None（当没改）。"""
    if not w or w in text: return w or None
    from shuzi import normalize
    t, ix = normalize(text, strict=True)
    a = t.find(w)
    if a < 0: return None
    b = a + len(w)
    return text[ix[a]:ix[b] if b < len(ix) else len(text)] or None


def _as_rounds(edits):
    """show_edits 转成「一轮一份」：新的存法 [[第一轮每句一项], [第二轮…]]；单独一轮（每句一项，11-08 以前的片子存的叠好的一份）当一轮。"""
    if not edits: return []
    if any(isinstance(x, list) for x in edits):
        return [r for r in edits if isinstance(r, list) and any(isinstance(x, dict) for x in r)]
    return [edits] if any(isinstance(x, dict) for x in edits) else []


def merge_show_edits(old, new):
    """第二轮修改叠在第一轮上：一轮一份按先后存，重出时从写手原稿起一轮一轮套（apply_show_edits）。
    每一轮都是照上一条片子改的，先后套就是「后说的算」：前一轮删的、换的，后一轮加回来、换回来就照画；
    在字卡里删、到跳字里加回（或反过来）也一样（第九轮验收：原来叠成一份，字卡的「标亮词」和跳字的「上屏词」各记各的，旧的盖不掉）。"""
    return (_as_rounds(old) + _as_rounds(new)) or None


def show_rows(j, drawn=None, style=None):
    """给校字页看的每句一行。drawn = 画风登记的「画出来的字」（渲染时存的 画面用词.json），style = 那条片子的画风。
    有 drawn：右边只列真画了的。regs 这句登记的字（字和画成什么）；word_on / kw_on 上屏词 / 标亮词画没画
    （不是那个画风的为 None）；icon 画出来的图标。没有 drawn（真人版、老片子）就照剧本列。
    more = regs 里除上屏词以外的（跳字、夜路用）。"""
    from planner import ICON_CN
    from shuzi import normalize
    by = {}
    for d in drawn or []:
        if isinstance(d, dict) and isinstance(d.get('line'), int): by.setdefault(d['line'], []).append(d)
    card = style == '字卡'
    out = []
    for l in j['lines']:
        ds = by.get(l['i'], [])
        if drawn is None:
            ic = next((s for s in l['show'] if s.get('asset')), None)
            icon, iw = (ic['asset'], ic['text']) if ic else (None, None)
            regs, w_on, k_on = [], True, True
        else:
            ic = next((d for d in ds if d.get('icon')), None)
            icon, iw = (ic['icon'], ic['text']) if ic else (None, None)
            if card and ic: iw = None                        # 字卡的图标挂在整段上，不挂在哪个词上
            ics = list(dict.fromkeys(d['icon'] for d in ds if d.get('icon')))   # 一句下画了好几个（误区卡：一群人、对勾），都写出来；去掉是一起去
            seen, regs = set(), []
            for d in ds:
                if d.get('icon') or d['text'] in seen: continue
                seen.add(d['text']); regs.append(dict(text=d['text'], kind=d['kind']))
            w_on = None if card else any(r['text'] == l['word'] for r in regs)
            k_on = any(r['text'] == l['kw'] for r in regs) if card else None
        more = [r for r in regs if r['text'] != l['word']]
        if drawn is None: ics = [icon] if icon else []
        text = ''.join(c[0] for c in l['cs']); tn = normalize(text, strict=True)[0]   # 画面上的写法（「八成」→「80%」）：修改页填「80%」也认
        out.append(dict(text=text, textn=tn if tn != text else None, word=l['word'], word_on=w_on, kw=l['kw'] or None, kw_on=k_on, icon=icon,
                        icon_cn='、'.join(ICON_CN.get(x, '') or '图标' for x in ics), icon_word=iw, regs=regs, more=more))
    return out
