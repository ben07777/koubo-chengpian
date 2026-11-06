# 一条录音 → 竖屏成片 + 封面 + 字幕文件。全部在本机跑，不联网。
# 命令行用法：python app/pipeline.py 录音.mp3 [夜幕|白纸|薄荷]
import json, re, shutil, subprocess, sys, time, threading, traceback
from pathlib import Path

APP = Path(__file__).resolve().parent
ROOT = APP.parent
sys.path.insert(0, str(APP))
import asr, cut, planner, render, bgm, person  # noqa: E402
import native

THEMES = {'夜幕': 'night', '白纸': 'paper', '薄荷': 'mint'}
STEPS = ['听写', '剪气口', '定画面', '配乐', '画画面', '合成', '封面']
MIN_SEC, MAX_SEC = 3, 600  # 录音最短 3 秒，最长 10 分钟


def ff(*args):
    r = subprocess.run([render.ffmpeg(), '-y', '-loglevel', 'error', *map(str, args)], capture_output=True, text=True, encoding='utf-8', errors='ignore')
    if r.returncode: raise RuntimeError('ffmpeg: ' + (r.stderr or '').strip()[-600:])


# 出错时给用户看的人话：左边是技术报错里的关键词，右边是该怎么办
HUMAN = [
    (('does not contain any stream', 'matches no streams', 'Output file is empty', 'no audio'), '这个文件里没有声音，请换一个有声音的录音或视频。'),
    (('Invalid data found', 'moov atom not found', 'could not find codec'), '文件无法打开，可能没录完整或已损坏。请在手机上重新导出后再试。'),
    (('No space left', 'Errno 28', '磁盘空间不足'), '硬盘空间不足。请删除“出片”文件夹里不需要的旧视频后再试。'),
    (('画面页出错',), '生成画面时出错。请关掉口播成片，重新打开再试。'),
    (('找不到能用的浏览器',), '未找到 Edge 浏览器（Windows 自带，可能被卸载了）。请重新安装 Edge 后再试。'),
    (('Timeout', 'Target page, context or browser has been closed'), '生成画面时卡住了。请关掉口播成片，重新打开再试。'),
    (('MemoryError', 'bad allocation'), '电脑内存不足。请关闭其他软件，或把素材剪短一些再试。'),
]


def human(e):
    if isinstance(e, native.FocusError):
        return str(e)
    msg = f'{type(e).__name__}: {e}'
    for keys, tip in HUMAN:
        if any(k in msg for k in keys): return tip
    if isinstance(e, RuntimeError) and str(e) and '\u4e00' <= str(e)[0] <= '\u9fff' and not re.search('[A-Za-z]{4}', str(e)):
        return str(e)  # 自己写的中文提示，原样给；夹着英文报错的不给，英文只进出错记录
    return '出现未知错误。请关掉口播成片，重新打开再试；还不行，重启电脑后再试。'


def mmss(x):
    x = round(x)
    return f'{x // 60} 分 {x % 60} 秒' if x >= 60 else f'{x} 秒'


def duration(wav):
    import wave
    with wave.open(str(wav)) as w:
        return w.getnframes() / w.getframerate()


def srt(lines, path):
    def ts(x):
        h, r = divmod(x, 3600); m, s = divmod(r, 60)
        return f'{int(h):02d}:{int(m):02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}'
    out = []
    for i, l in enumerate(lines):
        end = min(l['t1'] + 0.4, lines[i + 1]['t0'] - 0.02) if i + 1 < len(lines) else l['t1'] + 0.6
        out.append(f"{i + 1}\n{ts(l['t0'])} --> {ts(end)}\n{''.join(c[0] for c in l['cs'])}\n")
    Path(path).write_text('\n'.join(out), encoding='utf-8')


class Job:
    def __init__(self, folder):
        self.dir = Path(folder); self.dir.mkdir(parents=True, exist_ok=True)
        self.f = self.dir / 'job.json'
        self.s = json.loads(self.f.read_text(encoding='utf-8')) if self.f.exists() else dict(step='', pct=0, done=False, err='', log=[])

    def save(self):
        # 网页每秒来读一次进度；Windows 下文件正被读时换不进去，等一下再试
        tmp = self.f.with_suffix('.tmp'); tmp.write_text(json.dumps(self.s, ensure_ascii=False, indent=1), encoding='utf-8')
        for _ in range(100):
            try:
                tmp.replace(self.f); return
            except PermissionError:
                time.sleep(0.05)
        raise RuntimeError('保存进度失败。请关掉口播成片，重新打开再试。')

    def mark(self, step, pct=None, msg=None):
        self.s['step'] = step
        if pct is not None: self.s['pct'] = pct
        if msg: self.s['log'].append(f"{time.strftime('%H:%M:%S')} {msg}")
        self.save()

    def run(self, src=None, theme='夜幕', music=True, edits=None, title=None, my_music=None, keep_person=None, cover_t=None, trim=True, focus=None):
        """src 给了就从头跑；不给就沿用上次的听写，只按改过的字幕 / 标题 / 风格重出。
        keep_person：视频里的人留不留（只对视频文件有用）；重出时不给就照上次。
        trim：先剪掉过长的停顿、「嗯」「呃」和说错重说的前一遍，再往下做（只在从头跑时有用）。"""
        t_start = time.time(); d = self.dir
        try:
            if keep_person is None: keep_person = self.s.get('person', False)
            self.s.update(done=False, err='', theme=theme, music=bool(music), my_music=bool(my_music)); self.save()
            if src:
                self.mark('听写', 2, '开始识别字幕（在本机进行，文件不上传）'); voice = None
                ff('-i', src, '-vn', '-ac', '1', '-ar', '16000', d / 'vo16k.wav')
                sec = duration(d / 'vo16k.wav')
                if sec < MIN_SEC: raise RuntimeError(f'素材太短（{sec:.1f} 秒），至少需要 {MIN_SEC} 秒。')
                if sec > MAX_SEC: raise RuntimeError(f'素材时长 {int(sec // 60)} 分 {int(sec % 60)} 秒，超过 10 分钟上限。请剪成几段，分开生成。')
                segs = asr.transcribe(d / 'vo16k.wav')
                self.s['trim'] = bool(trim); self.s['cut'] = None
                if trim:
                    keep, cuts = cut.plan(segs, sec); sm = cut.summary(cuts, keep, sec)
                    if sm['sec'] >= 0.5:
                        self.mark('剪气口', 5, f"找到 {sm['n']} 处可剪：停顿 {sm['停顿']} 处、语气词 {sm['语气词']} 处、重说 {sm['重说']} 处，正在剪")
                        isv = bool(keep_person) and person.has_video(src, render.ffmpeg())
                        new = d / ('剪后素材' + ('.mp4' if isv else '.wav'))
                        cut.apply(src, keep, new, render.ffmpeg(), isv); cut.write_list(cuts, d / '剪掉的地方.txt')
                        if isv: src = new
                        voice = new
                        ff('-i', voice, '-vn', '-ac', '1', '-ar', '16000', d / 'vo16k.wav')
                        segs = asr.transcribe(d / 'vo16k.wav'); self.s['cut'] = sm
                        self.mark('剪气口', 7, f"剪掉 {sm['sec']} 秒，剪后素材 {mmss(duration(d / 'vo16k.wav'))}")
                    else:
                        self.mark('剪气口', 7, '没有找到需要剪的停顿和口误')
                ff('-i', voice if self.s['cut'] else src, '-vn', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '2', '-ar', '48000', d / 'vo.wav')
                lines = planner.build_lines(asr.chars(segs))
                if not lines: raise RuntimeError('没有识别到人声。请检查素材是否有声音，目前支持普通话和英语。')
                (d / 'lines_asr.json').write_text(json.dumps(lines, ensure_ascii=False), encoding='utf-8')
                self.mark('剪气口' if trim else '听写', 8, f'字幕识别完成，共 {len(lines)} 句')
                if keep_person and not person.has_video(src, render.ffmpeg()):
                    keep_person = False; self.mark('听写', None, '这个文件只有声音没有画面，将生成纯动效版')
            lines = json.loads((d / 'lines_asr.json').read_text(encoding='utf-8'))
            if edits:
                lines = planner.apply_edits(lines, edits)
            dur = round(duration(d / 'vo.wav') + 0.8, 2)
            need = 0.6 + (dur * 0.006 if keep_person else 0)  # GB：真人版每秒画面约 6MB
            free = shutil.disk_usage(d).free / 1e9
            if free < need: raise RuntimeError(f'硬盘剩余 {free:.1f}GB，这条视频至少需要 {need:.1f}GB。请删除“出片”文件夹里不需要的旧视频后再试。')
            self.s['person'] = bool(keep_person)
            pmeta = None
            if keep_person:
                vsrc = src or next(iter(sorted(d.glob('剪后素材.mp4')) or sorted(d.glob('原素材.*')) or sorted(d.glob('录音原件.*'))), None)
                if not vsrc: raise RuntimeError('找不到原视频，无法保留真人画面。请重新导入视频。')
                self.mark('人脸', 10, '检测到视频画面，正在提取')
                pmeta = person.prepare(vsrc, d, dur, render.ffmpeg(), log=lambda m: self.mark('人脸', None, m))
                if cover_t is not None: pmeta['cover_t'] = round(min(max(float(cover_t), 0), dur - 1), 2)  # 用户自己挑的封面帧
                self.s['cover_t'] = pmeta['cover_t']
            self.mark('定画面', 15)
            p = planner.plan(lines, dur, title=title, theme=THEMES.get(theme, 'night'))
            if pmeta: p['person'] = person.for_plan(d, pmeta)
            (d / 'plan.js').write_text('window.PLAN=' + json.dumps(p, ensure_ascii=False) + ';', encoding='utf-8')
            self.s['lines'] = [''.join(c[0] for c in l['cs']) for l in p['lines']]
            self.s['title'] = [planner.re.sub(r'\[\[|\]\]', '', x) for x in p['title']]
            self.s['scenes'] = [dict(type=s['type'], t0=round(s['t0'], 1)) for s in p['scenes']]
            self.mark('定画面', 18, f"已安排 {len(p['scenes'])} 段动效画面")

            self.mark('配乐', 20)
            if my_music:
                ff('-stream_loop', '-1', '-i', my_music, '-t', dur, '-ac', '2', '-ar', '48000', d / 'bgm.wav')
            elif music:
                bgm.write_wav(d / 'bgm.wav', bgm.make(dur, impacts=[s['t0'] for s in p['scenes'][1:]]))
            if music or my_music:
                ff('-i', d / 'vo.wav', '-i', d / 'bgm.wav', '-filter_complex',
                   f'[0:a]apad=whole_dur={dur},asplit=2[v][sc];[1:a]atrim=0:{dur},volume=-25dB[b];'
                   '[b][sc]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=400[bd];'
                   '[v][bd]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.0:LRA=11',
                   '-ar', '48000', d / 'mix.wav')
            else:
                ff('-i', d / 'vo.wav', '-af', f'apad=whole_dur={dur},loudnorm=I=-14:TP=-1.0:LRA=11', '-ar', '48000', d / 'mix.wav')

            self.mark('画画面', 22, '开始渲染画面（这一步耗时最长）')
            prog = {}
            def cb(slot, k, n):
                prog[slot] = (k, n); a = sum(x[0] for x in prog.values()); b = sum(x[1] for x in prog.values())
                if k % 15 == 0: self.s['pct'] = 22 + int(66 * a / max(b, 1)); self.save()
            video_renderer, covers = render.render_video, render.stills
            if pmeta:
                video_renderer, covers = native.render_adapters(APP, d, focus)
                self.s['focus'] = focus
            video_renderer(d / 'plan.js', dur, d / '_video.mp4', progress=cb)

            self.mark('合成', 90, '画面渲染完成，正在合成音视频')
            out = d / '成片_竖屏.mp4'
            ff('-i', d / '_video.mp4', '-i', d / 'mix.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
               '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out)
            if pmeta: native.write_subtitles(d)
            else: srt(p['lines'], d / '字幕.srt')

            self.mark('封面', 96)
            covers(d / 'plan.js', [], d, cover=['34', '916'])
            shutil.rmtree(d / '_segs', ignore_errors=True); (d / '_video.mp4').unlink(missing_ok=True)
            shutil.rmtree(d / '人像帧', ignore_errors=True)  # 占地方，重出时再从原视频抽
            took = round(time.time() - t_start)
            self.s.update(done=True, pct=100, took=took, files=['成片_竖屏.mp4', '封面_3比4.png', '封面_9比16.png', '字幕.srt']
                          + (['剪掉的地方.txt'] if (d / '剪掉的地方.txt').exists() and self.s.get('cut') else []))
            self.mark('完成', 100, '生成完成，用时 ' + mmss(took))
        except Exception as e:
            (d / '出错记录.txt').write_text(time.strftime('%Y-%m-%d %H:%M:%S\n') + traceback.format_exc(), encoding='utf-8')
            self.s['err'] = human(e); self.mark('出错', None, '生成失败：' + self.s['err'])
            raise


NAMES = dict(hook='开场大字', say='大字跳出', question='问号', cta='收尾印章', myth='误区卡', compare='前后对比', flip='划掉改写', pair='圆章并列',
             range='区间条', stat='数字滚动', list='清单卡', cause='因果箭头', year='年份时间线')


if __name__ == '__main__':
    src = Path(sys.argv[1]).resolve(); theme = sys.argv[2] if len(sys.argv) > 2 else '夜幕'
    job = Job(ROOT / '出片' / (src.stem + time.strftime('_%m%d_%H%M')))
    own = job.dir / ('原素材' + src.suffix.lower()); shutil.copy(src, own)
    job.run(own, theme, keep_person='--人' in sys.argv)
    print(job.dir, job.s['took'])
