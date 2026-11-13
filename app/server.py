# 本机小网页：只开在 127.0.0.1（只有这台电脑自己能打开），录音不出这台电脑。
import json, os, re, shutil, sys, threading, time, webbrowser, socket, uuid
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
if sys.stdout is None:  # 无窗口运行（pythonw）：提示和报错写进 runtime\运行记录.txt
    sys.stdout = sys.stderr = open(Path(__file__).resolve().parent.parent / 'runtime' / '运行记录.txt', 'a', encoding='utf-8', buffering=1)

APP = Path(__file__).resolve().parent
ROOT = APP.parent
(ROOT/'runtime').mkdir(exist_ok=True)
OUT = ROOT / '出片'; OUT.mkdir(exist_ok=True)
sys.path.insert(0, str(APP))
import pipeline, juben  # noqa: E402

LOCK = threading.Lock()
TYPES = {'.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.srt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8',
         '.json': 'application/json; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml'}
AUDIO = ('.mp3', '.m4a', '.wav', '.aac', '.flac', '.ogg', '.mp4', '.mov', '.m4v', '.amr', '.wma', '.webm')
MAX_BYTES = 2 * 1024 ** 3  # 最大收 2GB（手机 1080p 竖拍 10 分钟大约 1.2GB）


def safe_id(s):
    s = unquote(s or '')
    p = (OUT / s).resolve()
    if p.parent != OUT.resolve() or not p.is_dir(): raise ValueError('找不到这条视频，可能已被删除')
    return p


LAST_PING = time.time() + 60  # 窗口最后一次报平安的时间；开窗要几秒，先多给一分钟
RUNNING = None


def run_job(folder, **kw):
    global RUNNING
    if not LOCK.acquire(blocking=False):
        raise ValueError("上一条还在生成，请稍后再试")
    RUNNING = Path(folder).name
    def go():
        global RUNNING
        try:
            pipeline.Job(folder).run(**kw)
        except Exception as exc:
            print("出片出错：", exc, flush=True)
        finally:
            RUNNING = None
            LOCK.release()
    threading.Thread(target=go, daemon=True).start()


def cn(e):
    """网页上只给中文提示；英文报错只打到黑色窗口里。"""
    m = str(e)
    if m and '一' <= m[0] <= '鿿': return m
    print('出错：', repr(e), flush=True)
    return '页面出错了，请刷新后再试'


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def send(self, code, body, ctype='application/json; charset=utf-8', extra=None):
        if isinstance(body, (dict, list)): body = json.dumps(body, ensure_ascii=False).encode()
        elif isinstance(body, str): body = body.encode()
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)

    def file(self, p):
        p = Path(p)
        if not p.is_file(): return self.send(404, {'err': '找不到这个文件，可能已被删除'})
        size = p.stat().st_size; ctype = TYPES.get(p.suffix.lower(), 'application/octet-stream')
        rng = self.headers.get('Range'); a, b = 0, size - 1
        if rng and (m := re.match(r'bytes=(\d*)-(\d*)', rng)):
            a = int(m.group(1) or 0); b = int(m.group(2) or size - 1); b = min(b, size - 1)
            self.send_response(206); self.send_header('Content-Range', f'bytes {a}-{b}/{size}')
        else:
            self.send_response(200)
        self.send_header('Content-Type', ctype); self.send_header('Accept-Ranges', 'bytes'); self.send_header('Content-Length', str(b - a + 1))
        self.send_header('Cache-Control', 'no-store'); self.end_headers()
        with open(p, 'rb') as f:
            f.seek(a); left = b - a + 1
            while left > 0:
                chunk = f.read(min(1 << 20, left))
                if not chunk: break
                try: self.wfile.write(chunk)
                except ConnectionError: return  # 网页里拖进度条会掐断旧请求，正常现象，不报错
                left -= len(chunk)

    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        if not 0 <= n <= 512*1024: raise ValueError('提交的文字太长')
        return self.rfile.read(n) if n else b''

    def save_body(self, path):
        """大视频边收边写盘，不占内存。"""
        left = int(self.headers.get('Content-Length') or 0)
        with open(path, 'wb') as f:
            while left > 0:
                chunk = self.rfile.read(min(4 << 20, left))
                if not chunk: break
                f.write(chunk); left -= len(chunk)
        if left: raise ValueError('文件没读完整，请重新导入')

    def local_request(self, write=False):
        host = self.headers.get("Host", "")
        expected = f"127.0.0.1:{self.server.server_port}"
        origin = self.headers.get("Origin")
        allowed = host == expected and (not write or origin in (None, f"http://{expected}"))
        if not allowed: self.send(403, {"err":"仅限本机页面访问"})
        return allowed

    def do_GET(self):
        if not self.local_request(): return
        u = urlparse(self.path); q = parse_qs(u.query)
        try:
            if u.path in ('/', '/index.html'): return self.file(APP / 'web' / 'index.html')
            if u.path.startswith('/web/'): return self.file((APP / 'web' / Path(unquote(u.path[5:])).name))
            if u.path == '/icons.js': return self.file(APP / '画风' / '公共' / 'icons.js')   # 校字页画图标用（和画风同一份 Lucide）
            if u.path == '/api/ping':
                global LAST_PING; LAST_PING = time.time(); return self.send(200, {})
            if u.path == '/api/ver': return self.send(200, {'v': pipeline.xieshou.VERSION})   # 11-10：首页角落的版本号，读本机，不联网
            if u.path == '/api/styles':                                # 首页「画风」选择：有预览图、没标「首页列出: false」的才给选（11-12 起只剩字卡，首页那一行就不出）
                out = []
                for n in pipeline.render.listed_styles():
                    m = pipeline.render.style_meta(n); line = re.split('[：:。；;，,]', m.get('一句话', ''))[0][:14]
                    out.append(dict(name=n, line=line, palette=bool((m.get('配色') or {}).get('可选'))))
                out.sort(key=lambda x: x['name'] != '字卡')
                return self.send(200, out)
            if u.path.startswith('/style/'):
                n = unquote(u.path[7:]).split('/')[0]
                if n not in pipeline.render.styles(): raise ValueError('页面出错了，请刷新后再试')
                return self.file(APP / '画风' / n / '预览.jpg')
            if u.path == '/api/info':
                x = pipeline.xieshou; p = pref(); agreed = p.get('云端已同意') is True
                ai = p.get('云端排画面') if agreed else None; on = bool(x.relay_url()) and ai is True   # 11-09 盲审：没点过「知道了，用云端」就当没开
                if x.relay_url(): x.device_id()                         # 算出设备号写进 runtime\设备号.txt（只在本机，不发），他要把自己的电脑设成不限时抄这串
                trial = (x.ask_trial() if on else x.trial_info()) if x.relay_url() else {}   # 11-09：免费版一点不碰服务器。开了云端才问中转剩几条、问模型名；没开只用上次记的
                beian = (x.relay_beian() if on else '') or str(x.settings().get('云端备案号') or '').strip()[:60]   # 11-09 第三轮 E：首页公示那句的备案号也从配置出
                return self.send(200, dict(running=RUNNING, cloud=bool(x.relay_url()), model=(x.relay_name() if on else '') or x.settings().get('云端模型名') or '', beian=beian, ai=ai, agreed=agreed, trial=trial or None,
                                           code=x.show_code(x.get_code())))   # cloud：设了中转地址，首页才出「云端排画面」开关；code：填过的次数码（只在本机）
            if u.path == '/api/pro':                                   # 「了解专业版」那页：价钱、链接、收款码读本地 开卖.json；条数、期限问中转（11-09 第三轮）
                x = pipeline.xieshou; d = x.pro_info() if x.relay_url() else {}; d['model'] = d.get('model') or x.settings().get('云端模型名') or ''
                if not d.get('备案号'): d['备案号'] = str(x.settings().get('云端备案号') or '').strip()[:60]
                return self.send(200, d)
            if u.path == '/api/shoukuanma':                            # 开卖页的收款码：读软件包里 开卖\ 夹的图，不向服务器要（11-09 第三轮）
                x = pipeline.xieshou; r = x.pro_qr() if x.relay_url() else None
                if not r: return self.send(404, {'err': '没有收款码'})
                return self.send(200, r[0], r[1])
            if u.path == '/api/jobs':
                jobs = []
                for d in sorted(OUT.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True)[:12]:
                    if (d / 'job.json').exists():
                        s = json.loads((d / 'job.json').read_text(encoding='utf-8')); jobs.append(dict(id=d.name, done=s.get('done'), step=s.get('step')))
                return self.send(200, jobs)
            if u.path == '/api/job':
                d = safe_id(q.get('id', [''])[0]); s = None
                for _ in range(40):
                    try: s = json.loads((d / 'job.json').read_text(encoding='utf-8')); break
                    except (PermissionError, ValueError): time.sleep(0.05)
                if s is None: return self.send(200, {'step': '', 'pct': 0, 'log': [], 'busy': True})
                s['busy'] = LOCK.locked(); return self.send(200, s)
            if u.path.startswith('/out/'):
                _, _, jid, name = u.path.split('/', 3)
                d = safe_id(jid); p = (d / unquote(name)).resolve()
                if p.name not in {'成片_竖屏.mp4','封面_3比4.png','封面_9比16.png','字幕.srt','剪掉的地方.txt'} or p.parent != d: raise ValueError('页面出错了，请刷新后再试')
                return self.file(p)
            self.send(404, {'err': '页面出错了，请刷新后再试'})
        except Exception as e:
            self.send(400, {'err': cn(e)})

    def do_POST(self):
        if not self.local_request(write=True): return
        u = urlparse(self.path); q = parse_qs(u.query); g = lambda k, v='': q.get(k, [v])[0]
        try:
            if u.path == '/api/start':
                if LOCK.locked(): return self.send(409, {'err': '上一条还在生成，完成后再导入下一条'})
                name = unquote(g('name', 'luyin.mp3')); ext = Path(name).suffix.lower()
                if ext not in AUDIO: return self.send(400, {'err': f'不支持 {ext} 格式，请换成 mp3、m4a、wav、aac、mp4、mov 等常见格式'})
                size = int(self.headers.get('Content-Length') or 0)
                if size > MAX_BYTES:
                    self.close_connection = True
                    return self.send(413, {'err': f'文件有 {size / 1e9:.1f}GB，超过 2GB 上限。手机导出时选 1080P，或剪短一些再试。'})
                stem = re.sub(r'[\\/:*?"<>|\s]+', '_', Path(name).stem)[:30] or '录音'
                d = OUT / f"{stem}_{time.strftime('%m%d_%H%M%S')}_{uuid.uuid4().hex[:5]}"; d.mkdir(parents=True)
                src = d / ('原素材' + ext); self.save_body(src)
                pipeline.Job(d).mark('排队', 1, '录音已存进本机文件夹：出片\\' + d.name)
                run_job(d, src=src, theme=g('theme', '夜幕'), music=g('music', '1') == '1', keep_person=g('person', '0') == '1',
                        trim=g('trim', '1') == '1', focus=g('focus') or None, style=unquote(g('style', '字卡')), use_ai=g('ai', '0') == '1' and agreed())
                return self.send(200, {'id': d.name})
            if u.path == '/api/redo':
                if LOCK.locked(): return self.send(409, {'err': '还在生成中，完成后再修改'})
                d = safe_id(g('id')); b = json.loads(self.body() or b'{}')
                mine = next((p for p in d.glob('我的配乐.*')), None) if b.get('music') == 'mine' else None
                prior = pipeline.Job(d)
                edited=b.get('lines')
                if not isinstance(edited,list) or len(edited)!=len(prior.s.get('lines',[])) or not all(isinstance(x,str) and x.strip() for x in edited):
                    raise ValueError('字幕不能为空，也不能增删行')
                shows = b.get('shows')
                if shows is not None and (not isinstance(shows, list) or len(shows) != len(edited) or not all(x is None or isinstance(x, dict) for x in shows)):
                    raise ValueError('上屏词的修改和字幕行数对不上，请刷新后再试')
                shows = juben.merge_show_edits(prior.s.get('show_edits'), shows)   # 第二轮修改叠在第一轮上
                new = OUT / (re.sub(r'_校字_[0-9a-f]+$', '', d.name) + '_校字_' + uuid.uuid4().hex[:6])
                new.mkdir()
                for pattern in ('原素材.*','剪后素材.*','vo.wav','lines_asr.json','job.json','剪掉的地方.txt','我的配乐.*','剧本_写手原稿.json'):
                    for f in d.glob(pattern):
                        try: os.link(f, new/f.name)
                        except OSError: shutil.copyfile(f, new/f.name)
                if mine: mine = new / mine.name
                pending=pipeline.Job(new)
                pending.s.update(done=False, err='', log=[])
                pending.mark('排队',1,'正在按校对后的字幕重新导出')
                run_job(new, src=None, focus=b.get('focus') or None, theme=b.get('theme', '夜幕'), music=b.get('music', True) not in (False, 'off'),
                        edits=b.get('lines'), title=[x for x in b.get('title', []) if x.strip()] or None, my_music=mine,
                        keep_person=b.get('person'), cover_t=b.get('cover_t'), style=b.get('style') or prior.s.get('style', '字卡'), shows=shows,
                        use_ai=b.get('ai', prior.s.get('use_ai', False)) not in (False, 0, '0') and agreed(), title_mark=b.get('title_mark'), cover_icon=b.get('cover_icon'))
                return self.send(200, {'id':new.name})
            if u.path == '/api/bgm':
                d = safe_id(g('id')); ext = Path(unquote(g('name', 'm.mp3'))).suffix.lower()
                if ext not in AUDIO: raise ValueError('请选择音频文件')
                if not 0 < int(self.headers.get('Content-Length') or 0) <= 256*1024**2: raise ValueError('配乐请选择 256MB 以内的文件')
                for old in d.glob('我的配乐.*'): old.unlink()
                self.save_body(d / ('我的配乐' + ext)); return self.send(200, {'ok': True})
            if u.path == '/api/pref':                                  # 用户在首页或修改区开关「云端排画面」：软件记住（换端口也不忘）
                b = json.loads(self.body() or b'{}'); v = b.get('云端排画面')
                if v not in (True, False): raise ValueError('只收开或关')
                if b.get('云端已同意') is True: set_pref(云端排画面=v, 云端已同意=True)   # 只有「知道了，用云端」那一下带这个
                elif v and not agreed(): raise ValueError('要先看过说明、点「知道了，用云端」')
                else: set_pref(云端排画面=v)
                return self.send(200, {'ok': True})
            if u.path == '/api/code':                                  # 填次数码：存在本机 runtime\次数码.txt，马上问中转还剩几条；空 = 拿掉
                x = pipeline.xieshou; v = str(json.loads(self.body() or b'{}').get('码') or '').strip()
                k = x.norm_code(v)
                if v and not k: raise ValueError('次数码的格式不对：应该是 20 个字母和数字，可以带短横，比如 ABCDE-FGH23-JKMNP-QRS45')
                x.set_code(k)
                if k and not agreed():                                 # 11-09 盲审：还没点过「知道了，用云端」：码只存在本机，不发给中转，先出同意说明
                    return self.send(200, dict(ok=True, code=x.show_code(k), ai=False, need_agree=True, trial=x.trial_info() or None))
                if k:                                                  # 填了码就是要用云端：开关打开，问一次中转
                    set_pref(云端排画面=True)
                    return self.send(200, dict(ok=True, code=x.show_code(k), ai=True, trial=(x.ask_trial(force=True) if x.relay_url() else x.trial_info()) or None))
                return self.send(200, dict(ok=True, code='', trial=x.trial_info() or None))
            if u.path == '/api/liaojie':                               # 「了解专业版」那页打开了：告诉中转加一次数；每台电脑只记第一次
                if not pref().get('了解专业版已记') and pipeline.xieshou.relay_url():
                    def tell():
                        if pipeline.xieshou.tell_pro():
                            set_pref(了解专业版已记=True)
                    threading.Thread(target=tell, daemon=True).start()
                return self.send(200, {'ok': True})
            if u.path == '/api/open':
                d = safe_id(g('id')); os.startfile(str(d)); return self.send(200, {'ok': True})
            self.send(404, {'err': '页面出错了，请刷新后再试'})
        except Exception as e:
            self.send(400, {'err': cn(e)})


PREF = APP.parent / 'runtime' / '偏好.json'


def pref():
    with _PREF_LOCK:                             # 读也排队：Windows 上有人正读着，整份换上去会被拒
        try: return json.loads(PREF.read_text(encoding='utf-8'))
        except (OSError, ValueError): return {}


_PREF_LOCK = threading.RLock()                   # 同一个线程能重复进（set_pref 里面还要读一次）


def agreed():
    """看过同意说明、点过「知道了，用云端」没有。没点过，什么都不往中转发（11-09 盲审）。"""
    return pref().get('云端已同意') is True


def set_pref(**kv):
    """改偏好：排队改（连着点两下开关，两次写同时进来会把文件写坏），先写临时文件再整份换上去。返回改之前的样子。"""
    with _PREF_LOCK:
        old = pref(); new = dict(old, **kv)
        PREF.parent.mkdir(exist_ok=True); tmp = PREF.with_name(PREF.name + '.tmp')
        tmp.write_text(json.dumps(new, ensure_ascii=False), encoding='utf-8'); os.replace(tmp, PREF)
        return old


def free_port(start=8765):
    for p in range(start, start + 50):
        with socket.socket() as s:
            try: s.bind(('127.0.0.1', p)); return p
            except OSError: continue
    raise RuntimeError('启动失败，请重启电脑后再试')


if __name__ == '__main__':
    from assets import verify
    verify()
    port = free_port()
    srv = ThreadingHTTPServer(('127.0.0.1', port), H)
    url = f'http://127.0.0.1:{port}/'
    print(f'口播成片已启动：{url}', flush=True)
    print('关闭这个命令窗口即可退出。',flush=True)
    if '--no-browser' not in sys.argv: webbrowser.open(url)
    srv.serve_forever()
