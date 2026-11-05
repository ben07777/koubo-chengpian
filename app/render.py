# 逐帧渲染：用电脑自带的 Edge（没有就用 Chrome）打开画面页，seek(t) 一帧一帧截图，交给 ffmpeg 合成。
# 浏览器带「不后台下载模型、不自动更新组件」的开关，用固定的用户目录，不会每次新下东西。
import asyncio, json, os, subprocess, sys, time
from urllib.parse import urlsplit
from pathlib import Path
from playwright.async_api import async_playwright

APP = Path(__file__).resolve().parent
ROOT = APP.parent
STAGE = APP / 'stage' / 'stage.html'
PROFILES = ROOT / 'runtime' / 'browser_profiles'
FLAGS = ['--font-render-hinting=none', '--force-color-profile=srgb',
         '--disable-background-networking', '--disable-component-update', '--no-first-run', '--no-default-browser-check',
         '--disable-features=OptimizationGuideModelDownloading,OptimizationHintsFetching,OptimizationTargetPrediction,OptimizationGuideOnDeviceModel,msEdgeAIFeatures,EdgeCopilot',
         '--disable-sync', '--hide-scrollbars', '--mute-audio']


def ffmpeg():
    p = ROOT / 'runtime' / 'ffmpeg.exe'
    return str(p) if p.exists() else 'ffmpeg'


def stage_url(plan_js, cover=None):
    return "http://127.0.0.1/stage.html?plan=plan.js" + (f"&cover={cover}" if cover else "")


async def _open(p, slot, plan_js, w=1080, h=1920):
    # 为本次渲染提供最小虚拟页面。不启动网站，不放宽浏览器的文件或跨域保护。
    allowed = {"/"+name: STAGE.parent/name for name in
               ("stage.html","core.js","director.js","icons.js")}
    allowed.update({"/fonts/"+f.name:f for f in (STAGE.parent/"fonts").iterdir() if f.is_file()})
    allowed["/plan.js"] = Path(plan_js)
    async def serve(route):
        uri=urlsplit(route.request.url)
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


async def _seg(plan_js, out, fps, n0, n1, slot, progress=None):
    async with async_playwright() as p:
        ctx = await _open(p, slot, plan_js)
        pg = ctx.pages[0] if ctx.pages else await ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(stage_url(plan_js)); await pg.wait_for_function('window.READY === true', timeout=120000)
        ff = subprocess.Popen([ffmpeg(), '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(fps), '-c:v', 'mjpeg', '-i', '-',
                               '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', str(fps), str(out)],
                              stdin=subprocess.PIPE)
        for n in range(n0, n1):
            await pg.evaluate(f'seek({n / fps})')
            ff.stdin.write(await pg.screenshot(type='jpeg', quality=92))
            if progress: progress(slot, n - n0 + 1, n1 - n0)
        ff.stdin.close()
        rc=ff.wait()
        await ctx.close()
        if rc: raise RuntimeError("动效画面编码失败")
        if errs: raise RuntimeError('画面页出错：' + '; '.join(errs[:3]))


def render_video(plan_js, dur, out_mp4, fps=30, workers=2, progress=None):
    """分 workers 段并行渲染，再无损拼起来（只有画面，声音另外合）。"""
    out_mp4 = Path(out_mp4); tmp = out_mp4.parent / '_segs'; tmp.mkdir(exist_ok=True)
    N = int(round(dur * fps)); cuts = [round(N * i / workers) for i in range(workers + 1)]
    segs = [tmp / f's{i}.mp4' for i in range(workers)]

    async def main():
        await asyncio.gather(*[_seg(plan_js, segs[i], fps, cuts[i], cuts[i + 1], i, progress) for i in range(workers)])
    asyncio.run(main())
    lst = tmp / 'list.txt'; lst.write_text(''.join(f"file '{s.name}'\n" for s in segs), encoding='utf-8')
    subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(out_mp4)], check=True)
    return out_mp4


def stills(plan_js, times, out_dir, cover=None):
    """抽几帧看效果；cover='34' / '916' 出封面。"""
    out_dir = Path(out_dir); out_dir.mkdir(parents=True, exist_ok=True)

    async def main():
        async with async_playwright() as p:
            ctx = await _open(p, 9, plan_js)
            pg = ctx.pages[0] if ctx.pages else await ctx.new_page()
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
            res = []
            if cover:
                for kind in cover:
                    await pg.set_viewport_size({'width': 1080, 'height': 1440 if kind == '34' else 1920})
                    await pg.goto(stage_url(plan_js, kind)); await pg.wait_for_function('window.READY === true', timeout=120000)
                    f = out_dir / f'封面_{"3比4" if kind == "34" else "9比16"}.png'
                    await pg.screenshot(path=str(f), type='png'); res.append(f)
            else:
                await pg.goto(stage_url(plan_js)); await pg.wait_for_function('window.READY === true', timeout=120000)
                for t in times:
                    await pg.evaluate(f'seek({t})'); f = out_dir / f'f_{t:06.2f}.jpg'
                    await pg.screenshot(path=str(f), type='jpeg', quality=85); res.append(f)
            await ctx.close()
            if errs: print('页面报错：', errs[:5])
            return res
    return asyncio.run(main())


if __name__ == '__main__':
    plan_js, *ts = sys.argv[1:]
    print(stills(plan_js, [float(x) for x in ts], Path(plan_js).parent / 'pv'))
