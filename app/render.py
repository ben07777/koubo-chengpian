# 逐帧渲染：用电脑自带的 Edge（没有就用 Chrome）打开画风页，seek(t) 一帧一帧截图，交给 ffmpeg 合成。
# 画风页 = 画风/公共/页面.html + 公共 core.js、icons.js + 剧本（data.js，现场从 剧本.json 生成）+ 画风/<名字>/seek.js。
# 浏览器带「不后台下载模型、不自动更新组件」的开关，用固定的用户目录，不会每次新下东西。
# 中间帧用 PNG 还是 JPEG，由画风.json 的「中间帧」声明（字卡 jpeg 92，跳字、夜路 jpeg 95；声明 png 就逐帧走无损，画布类画风慢约四倍）。
# 一条命令出片：python app/render.py 剧本.json --画风 跳字 --出 成片.mp4 [--声音 mix.wav] [--配色 night]
import asyncio, json, os, shutil, subprocess, sys, time
from urllib.parse import urlsplit
from pathlib import Path
from playwright.async_api import async_playwright

APP = Path(__file__).resolve().parent
ROOT = APP.parent
STYLES = APP / '画风'
COMMON = STYLES / '公共'
PROFILES = ROOT / 'runtime' / 'browser_profiles'
FLAGS = ['--font-render-hinting=none', '--force-color-profile=srgb',
         '--disable-background-networking', '--disable-component-update', '--no-first-run', '--no-default-browser-check',
         '--disable-features=OptimizationGuideModelDownloading,OptimizationHintsFetching,OptimizationTargetPrediction,OptimizationGuideOnDeviceModel,msEdgeAIFeatures,EdgeCopilot',
         '--disable-sync', '--hide-scrollbars', '--mute-audio',
         # 11-10 合并盲审：上面几条关不住 Edge 自己去连 bing、微软对时。出片浏览器一律不许连外网：代理指向本机没人听的端口，
         # 网址一律查不到（只认本机）。画面页要的东西全由 _open 里的拦截从本机文件供，不受影响。
         '--proxy-server=127.0.0.1:9', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost']


def ffmpeg():
    p = ROOT / 'runtime' / 'ffmpeg.exe'
    if p.exists():
        return str(p)
    if (ROOT / 'runtime' / 'python' / 'python.exe').exists():   # 11-12 盲审轻3：免安装包里那份不见了，不悄悄改用电脑上别的 FFmpeg
        raise RuntimeError('软件文件夹里的 ffmpeg.exe 不见了，可能被杀毒软件拿走了。把压缩包重新解压一次，或者到杀毒软件的隔离区把它恢复。')
    return 'ffmpeg'


def styles():
    """装着的画风：画风/ 下每个带 画风.json 的文件夹。"""
    return sorted(d.name for d in STYLES.iterdir() if (d / '画风.json').exists())


def style_meta(style):
    return json.loads((STYLES / style / '画风.json').read_text(encoding='utf-8'))


def listed_styles():
    """首页、修改页能选的画风：有预览图，画风.json 没写「首页列出」: false。
    11-12 起只剩字卡：跳字、夜路、水面他否了，代码和文件夹留着，出片命令行照样能指定。"""
    return [n for n in styles() if (STYLES / n / '预览.jpg').exists() and style_meta(n).get('首页列出', True) is not False]


def frame_kind(style):
    """画风声明的中间帧：('jpeg', 质量) 或 ('png', None)。没声明按 jpeg 92。"""
    f = style_meta(style).get('中间帧') or {}
    if f.get('格式', 'jpeg') == 'png': return 'png', None
    return 'jpeg', int(f.get('质量', 92))


def stage_url(cover=None):
    return "http://127.0.0.1/page.html" + (f"?cover={cover}" if cover else "")


def page_data(juben_json, opts=None):
    """剧本 + 画风参数 → 画风页读的 data.js。画风只从这里拿东西，不碰原文。"""
    j = json.loads(Path(juben_json).read_text(encoding='utf-8'))
    try:                                                   # 11-10 复审第 4 条：每句的数块（和字幕断行同一套），画风折大字时整块不拆
        import shuzi
        for l in j.get('lines', []): l['nb'] = [[a, b] for a, b in shuzi.blocks(l.get('text') or ''.join(c[0] for c in l.get('cs', [])))]
    except Exception: pass                                 # 算不出就不给，画风照旧
    return 'window.JUBEN=' + json.dumps(j, ensure_ascii=False) + ';window.OPTS=' + json.dumps(opts or {}, ensure_ascii=False) + ';'


async def _open(p, slot, juben_json, w=1080, h=1920, style='字卡', opts=None):
    # 为本次渲染提供最小虚拟页面。不启动网站，不放宽浏览器的文件或跨域保护。
    sd = STYLES / style
    meta = style_meta(style)
    allowed = {"/page.html": COMMON / "页面.html", "/core.js": COMMON / "core.js", "/icons.js": COMMON / "icons.js", "/seek.js": sd / "seek.js"}
    if meta.get("样式"): allowed["/style.css"] = sd / meta["样式"]
    allowed.update({"/fonts/"+f.name:f for f in (COMMON/"fonts").iterdir() if f.is_file()})
    data = page_data(juben_json, opts)
    async def serve(route):
        uri=urlsplit(route.request.url)
        if uri.netloc == "127.0.0.1" and uri.path == "/data.js":
            return await route.fulfill(body=data, content_type="text/javascript; charset=utf-8")
        if uri.netloc == "127.0.0.1" and uri.path == "/style.css" and "/style.css" not in allowed:
            return await route.fulfill(body="", content_type="text/css")
        file=allowed.get(uri.path)
        if uri.netloc != "127.0.0.1" or file is None:
            return await route.abort()
        await route.fulfill(path=file)
    for ch in ("msedge","chrome",None):
        try:
            browser=await p.chromium.launch(channel=ch,headless=True,args=FLAGS)
            ctx=await browser.new_context(viewport={"width":w,"height":h},device_scale_factor=1,service_workers="block")
            await ctx.route("**/*",serve)
            return ctx
        except Exception as exc:
            last=exc
    raise RuntimeError("找不到能用的浏览器（Edge / Chrome）") from last


async def _ready(pg, errs, timeout=120):
    """等画风页说「可以截了」；页面一报错就停，把错报出来，不空等。"""
    for _ in range(timeout * 4):
        if errs: raise RuntimeError('画面页出错：' + '; '.join(errs[:3]))
        if await pg.evaluate('window.READY === true'): return
        await asyncio.sleep(.25)
    raise RuntimeError(f'画面页 {timeout} 秒没准备好')


async def _seg(juben_json, out, fps, n0, n1, slot, progress=None, style='字卡', opts=None, drawn=None):
    async with async_playwright() as p:
        ctx = await _open(p, slot, juben_json, style=style, opts=opts)
        pg = ctx.pages[0] if ctx.pages else await ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(stage_url()); await _ready(pg, errs)
        if drawn and slot == 0:                                   # 画风登记的「画出来的字」，修改页照它列（第 5 步）
            Path(drawn).write_text(json.dumps(await pg.evaluate('window.DRAWN || null'), ensure_ascii=False), encoding='utf-8')
        kind, q = frame_kind(style)
        shot = dict(type='png') if kind == 'png' else dict(type='jpeg', quality=q)
        ff = subprocess.Popen([ffmpeg(), '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(fps), '-c:v', 'png' if kind == 'png' else 'mjpeg', '-i', '-',
                               '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', str(fps), str(out)],
                              stdin=subprocess.PIPE)
        for n in range(n0, n1):
            await pg.evaluate(f'seek({n / fps})')
            ff.stdin.write(await pg.screenshot(**shot))
            if progress: progress(slot, n - n0 + 1, n1 - n0)
        ff.stdin.close()
        rc=ff.wait()
        await ctx.close()
        await ctx.browser.close()   # 11-12 盲审中1：连浏览器一起关，它在系统临时夹里建的那个夹才会删掉
        if rc: raise RuntimeError("动效画面编码失败")
        if errs: raise RuntimeError('画面页出错：' + '; '.join(errs[:3]))


def render_video(juben_json, dur, out_mp4, fps=30, workers=2, progress=None, style='字卡', opts=None, drawn=None):
    """分 workers 段并行渲染，再无损拼起来（只有画面，声音另外合）。临时夹按成片名分开，拼好就删。"""
    out_mp4 = Path(out_mp4); tmp = out_mp4.parent / f'_segs_{out_mp4.stem}'
    shutil.rmtree(tmp, ignore_errors=True); tmp.mkdir()
    N = int(round(dur * fps)); cuts = [round(N * i / workers) for i in range(workers + 1)]
    segs = [tmp / f's{i}.mp4' for i in range(workers)]

    async def main():
        await asyncio.gather(*[_seg(juben_json, segs[i], fps, cuts[i], cuts[i + 1], i, progress, style, opts, drawn) for i in range(workers)])
    asyncio.run(main())
    lst = tmp / 'list.txt'; lst.write_text(''.join(f"file '{s.name}'\n" for s in segs), encoding='utf-8')
    r = subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(out_mp4)],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode or r.stderr.strip() or not out_mp4.exists() or out_mp4.stat().st_size < 10000:
        raise RuntimeError('画面拼接失败：' + (r.stderr.strip()[:300] or '拼出来的文件太小'))
    shutil.rmtree(tmp, ignore_errors=True)
    return out_mp4


def stills(juben_json, times, out_dir, cover=None, style='字卡', opts=None, fmt='jpeg'):
    """抽几帧看效果；cover='34' / '916' 出封面。fmt='png' 出无损帧（对比用）。"""
    out_dir = Path(out_dir); out_dir.mkdir(parents=True, exist_ok=True)

    async def main():
        async with async_playwright() as p:
            ctx = await _open(p, 9, juben_json, style=style, opts=opts)
            pg = ctx.pages[0] if ctx.pages else await ctx.new_page()
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
            res = []
            if cover:
                for kind in cover:
                    await pg.set_viewport_size({'width': 1080, 'height': 1440 if kind == '34' else 1920})
                    await pg.goto(stage_url(kind)); await _ready(pg, errs)
                    f = out_dir / f'封面_{"3比4" if kind == "34" else "9比16"}.png'
                    await pg.screenshot(path=str(f), type='png'); res.append(f)
            else:
                await pg.goto(stage_url()); await _ready(pg, errs)
                for t in times:
                    await pg.evaluate(f'seek({t})'); f = out_dir / f'f_{t:06.2f}.{"png" if fmt == "png" else "jpg"}'
                    if fmt == 'png': await pg.screenshot(path=str(f), type='png')
                    else: await pg.screenshot(path=str(f), type='jpeg', quality=85)
                    res.append(f)
            await ctx.close()
            await ctx.browser.close()   # 11-12 盲审中1：同上，连浏览器一起关
            if errs: print('页面报错：', errs[:5])
            return res
    return asyncio.run(main())


def make(juben_json, out_mp4, style='字卡', opts=None, audio=None, fps=30, workers=2):
    """剧本 → 指定画风的成片；给了声音就合上（和出片流程同一组参数）。"""
    out_mp4 = Path(out_mp4); out_mp4.parent.mkdir(parents=True, exist_ok=True)
    dur = json.loads(Path(juben_json).read_text(encoding='utf-8'))['dur']
    silent = out_mp4.with_name(out_mp4.stem + '_无声.mp4') if audio else out_mp4
    render_video(juben_json, dur, silent, fps=fps, workers=workers, style=style, opts=opts)
    if audio:
        subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-i', str(silent), '-i', str(audio), '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                        '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', str(out_mp4)], check=True)
        silent.unlink()
    return out_mp4


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description='剧本 → 成片（或抽几帧）。画风：' + '、'.join(styles()))
    ap.add_argument('剧本')
    ap.add_argument('--画风', default='字卡', choices=styles())
    ap.add_argument('--配色', default=None, help='画风允许换配色时才有用，比如字卡的 night / paper2 / grid')
    ap.add_argument('--出', help='成片路径；不给就放在剧本旁边，叫 成片_<画风>.mp4')
    ap.add_argument('--声音', help='合进去的声音（出片夹里的 mix.wav）；不给就出无声')
    ap.add_argument('--段数', type=int, default=2, help='几个浏览器同时画')
    ap.add_argument('--抽帧', nargs='*', type=float, help='只抽这几秒的静帧看，不出整条')
    a = ap.parse_args()
    meta = style_meta(a.画风); pal = meta.get('配色', {})
    if a.配色 and a.配色 not in pal.get('可选', []):
        ap.error(f'画风「{a.画风}」' + (f'的配色只有：{"、".join(pal["可选"])}' if pal.get('可选') else '不能换配色'))
    opts = {'theme': a.配色 or pal.get('默认', 'night')}
    t0 = time.time()
    if a.抽帧 is not None:
        print(stills(a.剧本, a.抽帧, Path(a.剧本).parent / f'抽帧_{a.画风}', style=a.画风, opts=opts))
    else:
        out = make(a.剧本, a.出 or Path(a.剧本).parent / f'成片_{a.画风}.mp4', style=a.画风, opts=opts, audio=a.声音, workers=a.段数)
        print(out, f'{time.time() - t0:.1f} 秒')
