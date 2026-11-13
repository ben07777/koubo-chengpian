# 写手：「懂」层的接口（2026-11-07 第 4 步立，第 5.5 步接上 AI）。谁来写剧本，只在这里换；剧本契约（juben.py）不变，画风不用知道是谁写的。
#
# 一个写手 = 一个函数：write(lines, dur, title=None, audio_end=None) → 剧本（dict，必须过 juben.check）
#   lines      听层出的字幕：每句 {t0, t1, cs:[[字, 起, 止]...], text}；改字后的也是这个样子
#   dur        片长（秒，可能补了空白）
#   title      封面标题（可空）
#   audio_end  录音本身多长
# 写手只许改「放什么、什么时候放」（show / word / scenes / acts…），不许增删句子、不许改时间（规则写手会把「百分之二十」这类写法归一成 20%，这是字幕写法，不算改字）。
#
# 现在有两个：
#   规则   离线、免费，planner + rules 那套（免费版的底；没网、次数用完、模型出错都靠它）
#   AI     把逐句文字（带开始秒）发给我们自己的「中转」（中转/中转.py），中转去叫模型、按句校验后回来；录音不发。
#          软件里没有模型的钥匙。中转地址写在软件根目录 设置.json 的「中转地址」，空着就不走 AI。
#          AI 回的只是每句「上屏词 / 道具 / 动作」和全片主角词；时间、词组、数字动作、句型段落仍由规则那套算，AI 的选择盖在上面。
# 11-07 考卷盲判：规则版真帮上忙 9%、错 38%；AI 版 41%、错 6%（正本 考卷/AI剧本测试/结果.md，那次是 Claude 小模型，换国内模型要重测）。
import copy, hashlib, json, os, re, socket, threading, time, unicodedata, urllib.error, urllib.request, uuid
from pathlib import Path
import juben
import planner
import shuzi
from rules import pos_time

VERSION = '1.3.1'
ROOT = Path(__file__).resolve().parent.parent
DEFAULT = '规则'
TIMEOUT = 95                       # 等中转最多几秒；必须比中转的「总时限秒」（默认 85）长，不然软件先放弃


def _rules(lines, dur, title=None, audio_end=None, **kw):
    return planner.plan(lines, dur, title=title, audio_end=audio_end)


# ───────── AI 写手：请求中转 ─────────
def settings():
    p = ROOT / '设置.json'
    try: return json.loads(p.read_text(encoding='utf-8'))
    except (OSError, ValueError): return {}


def relay_url():
    u = (settings().get('中转地址') or '').strip().rstrip('/')
    return u if not u or '://' in u else 'http://' + u              # 漏写 http:// 也认


_NAME = [0.0, {}, None]   # 上次问到的时刻、中转 /health 报的东西、正在问的线程
def relay_info(wait=0.6):
    """中转 /health 报的：公示名（模型名）、专业版条数和天数、每台电脑试用几条。只问 /health，不发任何文字；问过的记 5 分钟。
    默认最多等 0.6 秒（第八轮验收：中转没开时首页晚 3 秒），没等到就先回上次的，后台接着问。
    只在用户开了云端、填了码或打开「了解专业版」时才问（server.py 管）。"""
    url = relay_url()
    if not url: return {}
    if time.time() - _NAME[0] >= 300 and not (_NAME[2] and _NAME[2].is_alive()):
        def ask():
            try:
                with urllib.request.urlopen(url + '/health', timeout=3) as f: r = json.loads(f.read())
            except Exception: r = {}
            _NAME[0], _NAME[1] = time.time(), (r if isinstance(r, dict) else {})
        _NAME[2] = threading.Thread(target=ask, daemon=True); _NAME[2].start()
    if _NAME[2] and _NAME[2].is_alive(): _NAME[2].join(wait)
    return _NAME[1] if isinstance(_NAME[1], dict) else {}


def relay_name():
    """中转报的模型名（中转配置里的「公示名」，比如「通义千问（阿里云百炼）」）。没问到回空（页面用 设置.json 的「云端模型名」）。"""
    return str(relay_info().get('公示名') or '').strip()[:40]


def relay_beian():
    """中转报的算法备案号（中转配置里模型那一道的「备案号」）。没问到回空，页面用 设置.json 的「云端备案号」（11-09 第三轮：页面不再写死）。"""
    b = str(relay_info().get('备案号') or '').strip()[:60]
    return b if re.fullmatch(r'[^<>&"\']{4,60}', b) else ''


SALES_LINE = '软件本身免费，想让大家都用得上。云端排画面要租服务器，所以这一项收 {价钱} 元，{期限}内最多 {条数} 条。'
SALES_LINE_NO_N = '软件本身免费，想让大家都用得上。云端排画面要租服务器，所以这一项收 {价钱} 元。'   # 11-10：问不到中转的条数、期限时用，价钱是本地的照样写
QR_LINE = '扫码付 {价钱} 元，付款时在备注里写上你的邮箱。24 小时内把码发到这个邮箱。'
QR_MAX = 2 * 1024 * 1024


def sale_local():
    """开卖页的价钱、购买链接、收款码图片：读软件包里自带的 开卖.json，图放在 开卖\\ 夹里（11-09 第三轮：传输加密之前，这三样不从服务器取，
    免得同一个无线网里懂行的人在半路换成自己的收款码、链接、价钱，买家的钱付给了别人）。没配、配错都当没有，页面写「还没开卖」。"""
    try: d = json.loads((ROOT / '开卖.json').read_text(encoding='utf-8'))
    except Exception: d = {}
    if not isinstance(d, dict): d = {}
    price = str(d.get('专业版价钱') or '').strip()
    if not re.fullmatch(r'\d{1,5}(\.\d{1,2})?', price) or float(price) <= 0: price = ''   # 0 元、不是数都当没设
    link = str(d.get('购买链接') or '').strip()
    if not re.fullmatch(r'https://[^\s"<>\\]{4,500}', link): link = ''               # 只认 https 开头
    return dict(价钱=price, 链接=link, 收款码=_qr_local(d.get('收款码图片')))


def _qr_local(name):
    """开卖.json 里「收款码图片」写的文件名 → 开卖\\ 夹里那张图的路径。只认这个夹子里的一个 png / jpg 文件名，100 字节到 2 MB，文件头得真是图；
    别处的路径、不在、读不了、不像图都当没有（页面就不出收款码）。"""
    name = str(name or '').strip()
    if not re.fullmatch(r'[^\\/:*?"<>|]{1,80}\.(?:png|jpg|jpeg)', name, re.I) or name.startswith('.'): return None
    p = ROOT / '开卖' / name
    try:
        if not p.is_file() or not 100 <= p.stat().st_size <= QR_MAX: return None
        with open(p, 'rb') as f: head = f.read(4)
    except OSError: return None
    return p if head.startswith(b'\x89PNG') or head.startswith(b'\xff\xd8\xff') else None


def pro_info():
    """「了解专业版」（开卖页）要的。价钱、购买链接、收款码读软件包里的 开卖.json（见 sale_local）；条数、期限、退款那几句、每台电脑试几条、
    模型名、备案号问中转（条数和期限是发码时真给的，最多等 3 秒）。开卖那句话、收款码下面那段字由这里拿本地价钱加中转的条数、期限生成。
    没问到中转：条数、期限都空着，页面写「现在连不上云端」；本地没配价钱：页面写「还没开卖」。"""
    r = relay_info(wait=3)
    pos = lambda v: v if isinstance(v, int) and not isinstance(v, bool) and v > 0 else None
    t = r.get('试用共'); s = lambda k, n: str(r.get(k) or '').strip()[:n]
    loc = sale_local(); price = loc['价钱']; n, days = pos(r.get('专业版条数')), pos(r.get('专业版天数'))
    term = s('专业版期限', 20) or ('一年' if days == 365 else f'{days} 天' if days else '')
    refund = [str(x).strip()[:200] for x in r.get('退款') if str(x).strip()][:6] if isinstance(r.get('退款'), list) else []
    return dict(条=n, 天=days, 试用=t if isinstance(t, int) and not isinstance(t, bool) and t >= 0 else None, model=relay_name(), 备案号=relay_beian(),
                价钱=price, 链接=loc['链接'],
                那句话=SALES_LINE.format(价钱=price, 期限=term, 条数=n) if price and n and term else '', 期限=term, 退款=refund,
                价钱句=SALES_LINE_NO_N.format(价钱=price) if price else '',   # 11-10 复审第 11 条：连不上中转时，价钱照样显示
                收款码=loc['收款码'] is not None, 收款码说明=QR_LINE.format(价钱=price) if price else '', 连上=bool(r),
                等=pos(r.get('等几秒')),                                 # 云端一条最多排几秒（中转配置「总时限秒」），开卖页明写（11-09 复审轻 1）
                全站每天=r.get('全站每天') if isinstance(r.get('全站每天'), int) and not isinstance(r.get('全站每天'), bool) and r.get('全站每天') >= 0 else None)   # 0 = 不拦填了码的；None = 老中转没报   # 连上：问到了中转（开卖页分得清「连不上」和「价钱没设好」）


def _hw():
    """这台电脑的硬件记号：注册表 MachineGuid + 系统盘卷序列号。算法借自 收费保护\\客户端\\kb_license.py 的机器码（只借算法，不接授权）。
    重装系统、换系统盘会变。读不到回空。"""
    try:
        if os.name == 'nt':
            import ctypes, winreg
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Cryptography', 0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY) as k:
                g = str(winreg.QueryValueEx(k, 'MachineGuid')[0])
            serial = ctypes.c_ulong(0); root = (os.environ.get('SystemDrive') or 'C:') + '\\'
            ok = ctypes.windll.kernel32.GetVolumeInformationW(ctypes.c_wchar_p(root), None, 0, ctypes.byref(serial), None, None, None, 0)
            return g + '|' + (f'{serial.value:08X}' if ok else '') if g else ''
        for p in ('/etc/machine-id', '/var/lib/dbus/machine-id'):
            if Path(p).is_file(): return Path(p).read_text().strip()
    except Exception: pass
    return ''


_DEV = []
def device_id():
    """这台电脑的设备号：按硬件算出的一串乱码（反推不出硬件信息；和收费保护的机器码前缀不同，也算不出那个），删了软件文件夹、重装软件都不变。
    只用来让中转按电脑数免费试用条数、按天限量。算出来顺手写进 runtime\\设备号.txt 给他自己看（要把自己的电脑加进中转「不限试用的设备号」时抄这串），
    改这个文件没用，下次照样按硬件算。读不到硬件（极少见）才退回那个文件里的随机串。"""
    if _DEV: return _DEV[0]
    p = ROOT / 'runtime' / '设备号.txt'; hw = _hw()
    if hw:
        s = hashlib.sha256(('koubo-trial|' + hw).encode()).hexdigest()[:32]
        try:
            if not p.exists() or p.read_text(encoding='utf-8').strip() != s: p.parent.mkdir(exist_ok=True); p.write_text(s, encoding='utf-8')
        except OSError: pass
    else:
        try: s = p.read_text(encoding='utf-8').strip()
        except OSError: s = ''
        if not re.fullmatch(r'[0-9a-f]{32}', s):
            s = uuid.uuid4().hex
            try: p.parent.mkdir(exist_ok=True); p.write_text(s, encoding='utf-8')
            except OSError: pass
    _DEV.append(s); return s


# ───────── 云端还剩几条：没填码的是试用（中转按电脑记），填了码的看次数码（中转按码记）（11-09 他定） ─────────
TRIAL_FILE = ROOT / 'runtime' / '试用.json'      # 中转最近一次报的数，加上这台电脑云端排过的录音记号
CODE_FILE = ROOT / 'runtime' / '次数码.txt'       # 用户填的次数码，只存在这台电脑
CODE_ABC = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'


def norm_code(s):
    """填的次数码 → 去掉短横、空格，转大写；格式不对回空。和中转同一套规则（20 位，没有 0 O 1 I L）。"""
    k = re.sub(r'[^0-9A-Z]', '', unicodedata.normalize('NFKC', str(s or '')).upper())   # 全角的 ＡＢＣ、１２３ 也认
    return k if len(k) == 20 and all(c in CODE_ABC for c in k) else ''


def show_code(k): return '-'.join(k[i:i + 5] for i in range(0, len(k), 5)) if k else ''


def cn_day(day):
    """2027-11-09 → 2027 年 11 月 9 日；不是这个样子的回空（11-09 复审：中转回什么都不原样往外写）"""
    m = re.fullmatch(r'(\d{4})-(\d{2})-(\d{2})', day) if isinstance(day, str) else None
    return f'{m.group(1)} 年 {int(m.group(2))} 月 {int(m.group(3))} 日' if m else ''


def _n(v): return v if isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= 10 ** 6 else None   # 中转报的数：整数才要


def _clean_code(m):
    """中转报的码的样子，只留验过的：状态是那四样之一，剩 / 共 / 天是整数，开始 / 到期是 年-月-日。别的一概不要（11-09 复审中 9）。"""
    if not isinstance(m, dict) or m.get('状态') not in ('能用', '用完', '到期', '不对'): return None
    out = {'状态': m['状态']}
    for x in ('剩', '共', '天'):
        if _n(m.get(x)) is not None: out[x] = m[x]
    for x in ('开始', '到期'):
        if isinstance(m.get(x), str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', m[x]): out[x] = m[x]
    return out


def get_code():
    try: return norm_code(CODE_FILE.read_text(encoding='utf-8'))
    except OSError: return ''


def set_code(k):
    """存次数码（空 = 拿掉）。格式不对的不存，回空。"""
    k = norm_code(k)
    try:
        if k: CODE_FILE.parent.mkdir(exist_ok=True); CODE_FILE.write_text(show_code(k), encoding='utf-8')
        elif CODE_FILE.exists(): CODE_FILE.unlink()
    except OSError: pass
    _LEFT[0] = 0.0
    return k


def _ckey(k): return hashlib.sha256(('koubo-code|' + k).encode()).hexdigest()[:12]   # 缓存里认是哪个码，不存码本身


def _cache():
    try:
        d = json.loads(TRIAL_FILE.read_text(encoding='utf-8'))
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError): return {}


def _save_cache(d):
    try: TRIAL_FILE.parent.mkdir(exist_ok=True); TRIAL_FILE.write_text(json.dumps(d, ensure_ascii=False), encoding='utf-8')
    except OSError: pass


def _code_cache(d, k):
    m = d.get('码')
    return m if k and isinstance(m, dict) and m.get('键') == _ckey(k) else None


def trial_info():
    """中转最近一次报的数，给页面用（存在 runtime 的 试用.json，重开软件也记得）：试用 {'剩': 2, '共': 3}，不限 {'不限': True}；
    填了码的再带 '码': {'状态': 能用 / 用完 / 到期 / 不对 / 没问过, '剩', '共', '开始', '到期', '天'}。没问过、老中转不报 = {}。"""
    d = _cache(); out = {}
    if d.get('不限') is True: out['不限'] = True
    elif _n(d.get('剩')) is not None and _n(d.get('共')) is not None: out.update(剩=d['剩'], 共=d['共'])
    k = get_code()
    if k:
        m = _clean_code(_code_cache(d, k))                      # 本机存的那份读出来再验一遍：被人改过也不出事
        out['码'] = m or {'状态': '没问过'}
    return out


def _note(r, k=''):
    """中转回话里带的数（排画面、问剩几条都带）记下来。k：这次请求带的码，回话里的「码」说的就是它。"""
    if not isinstance(r, dict): return
    d = _cache()
    if _n(r.get('试用剩')) is not None and _n(r.get('试用共')) is not None: d.pop('不限', None); d.update(剩=r['试用剩'], 共=r['试用共'])
    elif r.get('不限') is True: d.pop('剩', None); d.pop('共', None); d['不限'] = True
    m = _clean_code(r.get('码'))                                 # 只存验过的（11-09 复审中 9：原来原样存，刷新后照样在页面里跑）
    if k and m:
        d['码'] = m; d['码']['键'] = _ckey(k)
    _save_cache(d)


def _done(rec): return bool(rec) and rec in (_cache().get('排过') or [])


def _mark_done(rec):
    """这条录音云端排成了：记下记号（只是一串乱码）。用完以后，排过的这几条重出还能用云端（中转不另扣）。"""
    if not rec: return
    d = _cache(); d['排过'] = [x for x in d.get('排过') or [] if x != rec][-2999:] + [rec]; _save_cache(d)   # 记最近 3000 条（一个码最多 1000 条，够用）


def stop_reason(rec=None):
    """已经知道问了也白问（中转上次报的：码不对、到期、用完，或者试用用完）：回中文原因，字幕不发出去；不知道就回 None，照常问。
    用完了，排过的那几条录音重出照样问（第一轮验收：试完以后新录音还在白发字幕）。"""
    d = _cache(); k = get_code()
    if k:
        m = _code_cache(d, k)
        if not m: return None
        if m.get('状态') == '不对': return '次数码不对，请检查有没有填错'
        if m.get('状态') == '到期': return f'次数码已经到期（到 {cn_day(m.get("到期"))}为止）'
        if m.get('状态') == '用完' and not _done(rec): return f'次数码的 {m.get("共")} 条用完了'
        return None
    if d.get('不限') is True: return None
    if d.get('剩') == 0 and isinstance(d.get('共'), int) and not _done(rec): return f'免费试用的 {d["共"]} 条用完了'
    return None


def recording_id(p):
    """这条录音的记号：录音文件的大小加头尾各 1MB 取摘要（一串乱码，反推不出内容）。同一个文件改字、换画风、换剪法重新导入，都是同一个记号；
    中转按它记条数，同一条录音不另扣（第一轮验收：按各句开始秒算时，删掉行首一个字也会多扣一条）。读不到回 None（中转就按开始秒算）。"""
    try:
        p = Path(p); n = p.stat().st_size; h = hashlib.sha256(('koubo-rec|' + str(n)).encode())
        with open(p, 'rb') as f:
            h.update(f.read(1 << 20))
            if n > 2 << 20: f.seek(-(1 << 20), 2); h.update(f.read(1 << 20))
        return h.hexdigest()[:32]
    except (OSError, TypeError): return None


_LEFT = [0.0, None]   # 上次问的时刻、正在问的线程
def ask_trial(force=False):
    """问中转还剩几条（POST /shiyong，只发设备号和次数码，不扣）。首页最多等 0.6 秒，没等到就先用上次记的，后台接着问；
    force：刚填了码，马上问、最多等 3.5 秒。只在用户开了云端或填了码以后问（server.py 管）。"""
    url = relay_url()
    if not url: return {}
    if (force or time.time() - _LEFT[0] >= 30) and not (_LEFT[1] and _LEFT[1].is_alive()):
        def ask():
            k = get_code()
            try:
                b = {'设备号': device_id(), '版本': VERSION}
                if k: b['次数码'] = k
                req = urllib.request.Request(url + '/shiyong', data=json.dumps(b).encode(), headers={'Content-Type': 'application/json; charset=utf-8'})
                with urllib.request.urlopen(req, timeout=3) as f: _note(json.loads(f.read()), k)
            except Exception: pass                                 # 老中转没有这个地址、连不上：照旧用上次记的
            _LEFT[0] = time.time()
        _LEFT[1] = threading.Thread(target=ask, daemon=True); _LEFT[1].start()
    if _LEFT[1] and _LEFT[1].is_alive(): _LEFT[1].join(3.5 if force else 0.6)
    return trial_info()


def pro_qr():
    """开卖页的收款码图片：读软件包里 开卖\\ 夹的那张（开卖.json 写了文件名才读；11-09 第三轮起不向服务器要）。
    回 (图, 类型)；没有、太大、不像图都回 None（页面就写「还没开卖」）。"""
    try: d = json.loads((ROOT / '开卖.json').read_text(encoding='utf-8'))
    except Exception: d = {}
    p = _qr_local(d.get('收款码图片') if isinstance(d, dict) else None)
    if not p: return None
    try: b = p.read_bytes()
    except OSError: return None
    if not 100 <= len(b) <= QR_MAX: return None
    if b.startswith(b'\x89PNG'): return b, 'image/png'
    if b.startswith(b'\xff\xd8\xff'): return b, 'image/jpeg'
    return None


def tell_pro():
    """有人点开「了解专业版」：告诉中转加一次数（POST /liaojie，什么内容都不发）。成了回 True。"""
    url = relay_url()
    if not url: return False
    try:
        req = urllib.request.Request(url + '/liaojie', data=b'{}', headers={'Content-Type': 'application/json; charset=utf-8'})
        with urllib.request.urlopen(req, timeout=5) as f: return bool(json.loads(f.read()).get('ok'))
    except Exception: return False


def ask_relay(lines, rec=None):
    """发逐句文字给中转，拿回 AI 剧本（{主角词, 句:[...]}）。任何问题都抛中文错，由 write() 退回规则写手。
    rec：这条录音的记号（recording_id）；已经知道白问（stop_reason）就不发，直接抛原因。"""
    url = relay_url()
    if not url: raise RuntimeError('没设中转地址')
    why = stop_reason(rec)
    if why: raise RuntimeError(why)
    k = get_code()
    b = {'文字': [{'开始': round(l['t0'], 2), '句': ''.join(c[0] for c in l['cs'])} for l in lines], '设备号': device_id(), '版本': VERSION}
    if k: b['次数码'] = k
    if rec: b['录音'] = rec
    body = json.dumps(b, ensure_ascii=False).encode()
    req = urllib.request.Request(url + '/juben', data=body, headers={'Content-Type': 'application/json; charset=utf-8'})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as f: r = json.loads(f.read())
    except urllib.error.HTTPError as e:
        try: r = json.loads(e.read())
        except Exception: r = {}
        _note(r, k)                                              # 用完、码不对（429 / 403）也带着数
        why = r.get('原因') or f'中转回了错误（{e.code}）'
        raise RuntimeError('云端那头还是旧版，要先换新中转' if why == '只收逐句文字和开始秒' else why)
    except (TimeoutError, socket.timeout) as e:
        raise RuntimeError('云端太慢，这次没等到') from e
    except urllib.error.URLError as e:
        if isinstance(getattr(e, 'reason', None), (TimeoutError, socket.timeout)): raise RuntimeError('云端太慢，这次没等到') from e
        raise RuntimeError('连不上中转，可能没网或中转没开') from e
    except Exception as e:
        raise RuntimeError('连不上中转，可能没网或中转没开') from e
    _note(r, k)
    if not r.get('ok') or not isinstance(r.get('剧本'), dict): raise RuntimeError(r.get('原因') or '中转回的东西不对')
    _mark_done(rec)
    jb = r['剧本']; jb['_模型名'] = str(r.get('公示名') or '').strip()[:40]   # 这一条是哪个模型排的（中转报的），修改页「这条是谁排的」写它
    if r.get('没扣') is True: jb['_没扣'] = True                    # 11-10：真用上云端词的句子不到一半，中转没扣这条，修改页写一句
    return jb


ACT = {'上': 1, '下': -1, '无': 0}
NUMC = '0123456789０１２３４５６７８９零〇一二两三四五六七八九十百千万亿'   # 数的字：从它们中间截开，数就变了
NEG = '不没别未非无莫勿零负'                                             # 挨在前面的否定字：截掉它，意思就反了（零风险 → 风险、负增长 → 增长）
NEG_NEAR = '不没别未非无莫勿'                                           # 同一小句里、上屏词前后任何地方的否定字（这不是什么坏事、一点风险都没有、股价涨不上去）
NEG_AFTER = '了动起到下住出完成有上回倒去过来'                           # 紧跟在后面的「不 / 没 + 这些字」（跌不了、卖不出去、涨不上去、难不倒）
NEG_OK = re.compile('非常|无论|不论|不管|无数|不仅|不但|不只|不少|不断|不同(?!意)|不久|不错|没错|不过|未来|不等(?!于)|'
                    '别人|别的|特别|区别|分别|级别|类别|个别|告别|差别|识别|性别|无疑|无比|无限|无线|'
                    '莫名|差不多|了不起|不得不|不妨|对不起|不好意思|非洲|难得')   # 带这些字、却不是在说「不」的词（「不等于」「不同意」照样算否定）
HARD = ('很难', '难以', '难说', '难道', '谁说', '未必', '为零', '很少', '极少', '谣言', '是零', '等于零', '鲜少', '假的', '纯属传言')   # 11-10 补：可能性是零、等于零、鲜少、假的、纯属传言   # 同一小句里有这些说法，也是在说「不」（很难说AI会取代人、难以真正落地、谁说做这个能赚钱；11-09 第三轮补：加息的可能性为零、这只基金很少赚钱、涨价的说法是谣言）
NEG_VERB = ('否认', '拒绝', '拒不', '避免', '反对', '防止', '禁止', '杜绝', '否定', '否决', '辟谣', '叫停', '停止', '暂停', '终止', '中止', '取消', '放弃', '以免', '免得', '撤回', '推迟')   # 11-10 补：撤回、推迟   # 前面有这些（或后面「被、遭」这些），说的事是被推掉的（他否认涨价、央行拒绝加息、避免亏损）
STOP = '，,。.!！?？；;：:、 \n'
NUM_TAIL = '.．-－~～—/／+＋%％点'                                       # 跟在数后面、截开就变了的字（2.4、50-60、1/3、2点4）
NUM_TAILQ = '半次件位名户辆张份款例套笔宗桩趟颗枚粒棵株层届座场'
NEG_PRE = re.compile(r'负(?:增长|的|值|数|收益率?|回报率?|利率)(?:了|是|为|约|达)?$')   # 11-10 总控改判：数前面紧挨着「负增长、负的」，截掉就成了正数（负增长3% 截成 3%）   # 11-10 复审：数加单位后面还跟着这些字，截到这里就丢了一截（3岁半、3000万人次、40亿件）
UNIT = '倍天年月日周个元块毛角秒钟时小点半米斤克吨岁折股份家只张条次人项场度成号期届层级分%％‰'   # 数后面的单位：「两倍到三倍」「60天到90天」「2个月到3个月」往回找前一个数时跳过它们
ASK_END = '吗呢么嘛'                                                    # 一句以这些收尾是问句，下一句开头就否定，是在否定它（AI会取代人吗 / 不可能）


def _neg_head(s):
    """一句开头四个字里有没有否定（不可能、我觉得不会、很难说、想多了）。"""
    h = NEG_OK.sub(lambda m: '_' * len(m.group()), s[:6])[:4]
    return any(c in NEG_NEAR for c in h) or h.startswith(HARD) or s.startswith('想多了')


def cut_ok(w, t, nxt=''):
    """上屏词 w 在原句 t 里至少有一处出现得「完整」，截出来不改意思。拦这些截法：
    从一个数中间截（82% 截成 2%、1360万 截成 360万、2点4倍 截成 4倍或点4倍或2点、2.4倍 截成 .4倍、1/3 截成 3、50-60% 截成 60%或-60%、-5% 截成 5%、
    百分之八十二 截成 八十二或分之八十二、三分之一 截成 三分、几十亿 截成 十亿、十几万 截成 几万、1,500元 截成 500元）；
    从一个范围中间截（2到3倍 截成 3倍、两倍到三倍 截成 三倍或两倍、60天到90天 截成 90天或60天、2个月到3个月 截成 3个月）；
    同一小句里有否定字（不、没、别、未、非、无、莫、勿），上屏词又没把它带上（这不是什么坏事 截成 坏事、一点风险都没有 截成 风险、
    股价涨不上去 截成 股价涨、我不同意加息 截成 加息）；「很难、难以、难说、谁说、未必」（很难说AI会取代人 截成 AI会取代人）；
    前面有「否认、拒绝、避免、反对、防止、暂停、终止」这类（他否认涨价 截成 涨价、央行拒绝加息 截成 加息、避免亏损 截成 亏损、央行暂停加息 截成 加息、公司终止了合作 截成 合作）；
    同一小句里有「为零、很少、谣言」（加息的可能性为零 截成 加息、这只基金很少赚钱 截成 赚钱、涨价的说法是谣言 截成 涨价）；前面紧挨着「零、负」（零风险、负增长）；
    问句后面紧跟否定（AI会取代人？不可能 截成 AI会取代人）。nxt 是下一句的原文：这句以「吗、呢」收尾、下一句开头就否定，同样拦。
    「非常、不同、未来、别人」这类带否定字的词不算否定。宁可多拦，不许改意思；拦下的句子用本机规则的词。找不到完整的一处就算不完整。
    中转那头（中转.py 的 cut_ok）有一模一样的一份，两头各查一遍。"""
    if not w: return True
    i = t.find(w)
    while i >= 0:
        a = t[i - 1] if i > 0 else ''; a2 = t[i - 2] if i > 1 else ''
        j = i + len(w); b = t[j] if j < len(t) else ''; b2 = t[j + 1] if j + 1 < len(t) else ''
        s0 = max([t.rfind(c, 0, i) for c in STOP if c != '.'] + [-1]) + 1     # 这一小句从哪到哪（小数点不算断句）
        e0 = min([k for k in (t.find(c, j) for c in STOP if c != '.') if k >= 0] + [len(t)])
        ctx = t[s0:i] + '|' + t[j:e0]
        ctx = NEG_OK.sub(lambda m: '_' * len(m.group()), ctx)
        bad = (bool(a) and a in NEG) or any(c in NEG_NEAR for c in ctx) or t[:i].endswith(('难', '难以')) \
            or (b in '不没' and bool(b2) and b2 in NEG_AFTER) or any(h in ctx for h in HARD) \
            or any(v in t[s0:i] for v in NEG_VERB) or any(p + v in t[j:e0] for v in NEG_VERB for p in '被遭')
        if e0 < len(t) and t[e0] in '?？':                                     # 问句后面紧跟着否定（AI会取代人？不可能）
            e1 = min([k for k in (t.find(c, e0 + 1) for c in STOP if c != '.') if k >= 0] + [len(t)])
            if _neg_head(t[e0 + 1:e1]): bad = True
        if nxt and e0 == len(t) and t[-1] in ASK_END and _neg_head(nxt): bad = True   # 这句以「吗、呢」收尾，下一句开头就否定
        if w[0] in NUMC and a and (a in NUMC or a in '点负/／-－~～—+＋' or (a in '.．' and a2 in NUMC) or t[:i].endswith('分之')
                                   or a == '几' or (a == '数' and w[0] in '十百千万亿') or (a in '到至' and a2 and (a2 in NUMC or a2 in '%％'))
                                   or (a == ',' and a2 in '0123456789')):
            bad = True
        if w[0] in NUMC and a and a in '到至~～':                              # 「两倍到三倍」「60天到90天」截后半：往回跳过单位，再往前是数，就是一个范围
            k = i - 2; n = 0
            while k >= s0 and n < 3 and t[k] in UNIT and t[k] not in NUMC: k -= 1; n += 1
            if k >= s0 and t[k] in NUMC: bad = True
        if w[0] == '几' and a and a in NUMC: bad = True                        # 「十几万」截成 几万
        if w[-1] in NUMC and b and (b in NUMC or b in '点%％‰/／' or (b in '.．-－~～' and b2 in NUMC) or (b in '到至' and b2 in NUMC)
                                    or (b == ',' and b2 in '0123456789')): bad = True
        if any(c in NUMC for c in w) and b and b in '到至~～-－—' and b2 and b2 in NUMC: bad = True   # 「两倍到三倍」「60天到90天」截前半
        if w[0] in NUM_TAIL and a in NUMC: bad = True                          # 「-60%」「.4倍」「点4倍」：数的后半截
        if w[-1] in NUM_TAIL and w[-1] not in '%％' and b in NUMC and (w[-1] != '点' or w[-2:-1] in NUMC): bad = True   # 「2点」「2.」：数的前半截（「重点1」不算）
        if (w[-1] == '分' and b == '之') or w.startswith('分之') or (w[0] == '之' and a == '分'): bad = True   # 「三分之一」截成 三分、分之一
        if any(c in NUMC for c in w) and b and b in NUM_TAILQ: bad = True
        if w[0] in NUMC and NEG_PRE.search(t[s0:i]): bad = True              # 11-10 总控改判：「负增长3%」截成 3%     # 11-10 复审：「3岁半」截成 3岁、「3000万人次」截成 3000万人、「40亿件」截成 40亿
        if not bad: return True
        i = t.find(w, i + 1)
    return False


def word_ok(w, text, nxt=''):
    """云端挑的上屏词 w 能不能用（11-10 合并盲审：两头必须同一个判法，不然中转算用上、软件却没用，会多扣）：
    原样在这句里、截得完整（cut_ok）、不只盖住半个数（shuzi.whole_ok）、不丢紧贴着数的限定词（shuzi.qual_ok）。
    中转 check_line 是同一个判法，考卷 s18 拿一张词表两头逐个比，不一样就报错。"""
    return not w or (w in text and cut_ok(w, text, nxt) and shuzi.whole_ok(text, w) and shuzi.qual_ok(text, w))


def merge(j, ai):
    """把 AI 每句的上屏词 / 道具 / 动作和主角词盖到规则剧本上。上屏词不在本句、道具不在图标表的，这句沿用规则的（中转已校验过，这里再兜一次）。"""
    icons = _icon_names()
    rows = {int(s.get('编号', 0)): s for s in ai.get('句') or [] if str(s.get('编号', '')).isdigit()}
    texts = [''.join(c[0] for c in l['cs']) for l in j['lines']]
    for n, l in enumerate(j['lines']):
        s = rows.get(l['i'] + 1)
        if not s: continue
        keep = copy.deepcopy(l)
        try: _merge_line(j, l, s, icons, texts[n + 1] if n + 1 < len(texts) else '')
        except Exception: l.clear(); l.update(keep)            # 这一句盖不上就沿用规则的，不连累整条（第三轮盲审）
    hero = (ai.get('主角词') or '').strip() if isinstance(ai.get('主角词'), str) else ''
    if hero and hero != j.get('hero') and any(cut_ok(hero, ''.join(c[0] for c in l['cs'])) for l in j['lines']):
        old = j.get('hero'); j['hero'] = hero
        j['heroLine'] = next(l['i'] for l in j['lines'] if cut_ok(hero, ''.join(c[0] for c in l['cs'])))
        j['define'] = None                                    # 规则找的定义句是给旧主角词的，换了主角词就不用了
        if j.get('end') and j['end'].get('word') == old: j['end']['word'] = hero
    return j


def _merge_line(j, l, s, icons, nxt=''):
    """一句 AI 的上屏词 / 道具 / 动作盖到规则剧本这一句上。上屏词不在本句就不盖。nxt：下一句的原文。"""
    text = ''.join(c[0] for c in l['cs'])
    w = (s.get('上屏词') or '').strip(); ic = (s.get('道具') or '').strip()
    if s.get('退回') is True or not word_ok(w, text, nxt): return   # 中转拦下或那一截没回来（标了退回）、或这头再查也不合格：这句整句沿用本机规则的（11-09 复审中 11：原来留空，云端比本机还差）；11-09 第三轮：只盖住半个数的也退回
    if ic and (ic not in icons or ic in ('user', 'users')): ic = ''      # 人不画成图标（人物闸）
    if not w and not ic: return                                          # 11-09 第三轮：模型留空、只给人物图标：这句沿用本机规则的词，不空着
    if w:
        t0, t1 = pos_time(l, w); l['word'], l['wt0'], l['wt1'], l['kw'], l['wp'] = w, t0, t1, w, False
    else:
        l['word'], l['wt0'], l['wt1'], l['kw'], l['wp'] = None, l['t0'], l['t1'], '', False
    if '句卡' in planner.FIXES:                                          # 11-12 夜第二步：标亮词换了，普通句卡新排法的折点跟着重算，别把新标亮词折成两半（照这句所在的卡，一排最多八个字）
        planner.para_fold_line(j, l)
    l['show'] = ([dict(text=w, t0=l['wt0'], t1=l['wt1'], asset=ic or None)] if w else
                 [dict(text='', t0=l['t0'], t1=l['t1'], asset=ic)] if ic else [])
    if not l['person']: l['pol'] = ACT.get((s.get('动作') or '无')[:1], 0)
    for g in j.get('groups', []):
        if g['line'] == l['i']: g['word'] = bool(w) and g['a'] <= text.find(w) < g['b']


def _icon_names():
    s = (ROOT / 'app' / '画风' / '公共' / 'icons.js').read_text(encoding='utf-8')
    return set(json.loads(s[s.index('{'):s.rindex('}') + 1]))


def _ai(lines, dur, title=None, audio_end=None, rec=None):
    ai = ask_relay(lines, rec)                                     # 先问中转，问不到就整条退回规则（不白算一遍规则）
    rows = ai.get('句') if isinstance(ai.get('句'), list) else []
    if len(lines) >= 3 and not any(isinstance(r, dict) and (r.get('上屏词') or r.get('道具')) for r in rows):
        raise RuntimeError('云端这次一个词都没排')            # 等于没排：退回本机规则，修改页说清楚
    j = planner.plan(copy.deepcopy(lines), dur, title=title, audio_end=audio_end)
    j = merge(j, ai)
    if ai.get('_模型名'): j['writer_model'] = ai['_模型名']
    if ai.get('_没扣'): j['writer_note'] = NOFEE_NOTE                # 和开卖页、使用说明那句同一个意思
    if len(lines) >= 3 and not any(l.get('word') or any(s.get('asset') for s in l['show']) for l in j['lines']):
        raise RuntimeError('云端这次排的词都用不上')          # 比如道具全填了人：人物闸拿掉以后一个词都没有
    return j


NOFEE_NOTE = '这条真用上云端词的句子不到一半，没扣条数。没用上的那几句，用的是你电脑上排的词。'
WRITERS = {'规则': _rules, 'AI': _ai}


def names():
    return list(WRITERS)


def pick(use_ai=True):
    """该用哪个写手：设了中转地址、用户没关云端排画面，就用 AI；否则规则。"""
    return 'AI' if use_ai and relay_url() else '规则'


def write(lines, dur, title=None, audio_end=None, writer=None, use_ai=True, rec=None):
    """按名字找写手出剧本，出完自查；剧本不合契约就报错，不让坏剧本流到画风。
    writer 不给就按 pick() 选。AI 写手出任何问题（没网、次数用完、中转出错、剧本不合契约），自动退回规则写手，
    原因记在剧本的 writer_note 里（校字页会显示），出片不卡。"""
    writer = writer or pick(use_ai)
    if writer not in WRITERS: raise ValueError(f'没有叫「{writer}」的写手，可选：{"、".join(WRITERS)}')
    n = len(lines); note = None; retry = False; stop = None
    try:
        j = WRITERS[writer](lines, dur, title=title, audio_end=audio_end, rec=rec)
        bad = juben.check(j)
        if bad: raise ValueError(f'「{writer}」写手出的剧本不合契约：' + '；'.join(bad[:5]))
        if len(j['lines']) != n: raise ValueError(f'「{writer}」写手改了句数（{n} → {len(j["lines"])}），写手不许动字幕')
    except Exception as e:
        if writer == '规则': raise
        relay = isinstance(e, RuntimeError)                   # ask_relay 只抛中文 RuntimeError：没网、太慢、次数用完、模型没回好
        note = (f'云端这次没用上（{e}），画面改用本机规则排' if relay else '云端排好了，但这台电脑没接上，画面改用本机规则排')
        stop = stop_reason(rec) if relay else None             # 用完、到期、码不对：下次重出不再白问（填了新码再问，pipeline 管）
        retry = relay and not stop
        writer = '规则'; j = _rules(lines, dur, title=title, audio_end=audio_end)
        bad = juben.check(j)
        if bad: raise ValueError('「规则」写手出的剧本不合契约：' + '；'.join(bad[:5]))
    j['writer'] = writer
    if note: j['writer_note'] = note
    if note and retry: j['writer_retry'] = True
    if note and stop: j['writer_stop'] = True
    return j
