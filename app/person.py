# 真人画面：从视频里抽帧，找人脸位置，交给画面页做「人在上、卡在下」。全部本机跑。
import json, os, re, subprocess
from pathlib import Path
os.environ.setdefault("OPENCV_LOG_LEVEL", "ERROR")  # 不往黑窗口刷英文警告
import numpy as np

APP = Path(__file__).resolve().parent
ROOT = APP.parent
FACE = ROOT / 'models' / 'face_yunet.onnx'
FPS = 30
STEP = 15  # 每 15 帧（半秒）找一次脸


def has_video(src, ffmpeg):
    """文件里有没有真画面（mp3 的专辑封面不算）。"""
    r = subprocess.run([ffmpeg, '-hide_banner', '-i', str(src)], capture_output=True, text=True, encoding='utf-8', errors='ignore')
    return any('Video:' in l and 'attached pic' not in l for l in r.stderr.splitlines())


def extract(src, out, dur, ffmpeg):
    """按每秒 30 帧抽成图片，短边最多 1080。"""
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    for f in out.glob('*.jpg'): f.unlink()
    vf = (f"fps={FPS},scale=w='if(lt(iw,ih),min(1080,iw),-2)':h='if(lt(iw,ih),-2,min(1080,ih))'")
    subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-i', str(src), '-t', f'{dur:.2f}', '-vf', vf, '-q:v', '4',
                    '-start_number', '0', str(out / '%05d.jpg')], check=True)
    n = len(list(out.glob('*.jpg')))
    if n == 0: raise RuntimeError('无法从视频中提取画面，文件可能已损坏。请重新导出后再试。')
    return n


def _read(p):
    import cv2
    return cv2.imdecode(np.fromfile(str(p), dtype=np.uint8), cv2.IMREAD_COLOR)


def track(out, n):
    """每半秒找一次最大的那张脸，补空、平滑；返回 [[cx, cy, h], ...]，都按画面宽高归一。"""
    import cv2
    out = Path(out); first = _read(out / '00000.jpg'); ih, iw = first.shape[:2]
    sc = 320 / max(iw, ih); dw, dh = int(iw * sc), int(ih * sc)
    from assets import local_path
    det = cv2.FaceDetectorYN.create(local_path('face_yunet.onnx'), '', (dw, dh), 0.6, 0.3, 50)
    raw, best, best_i = [], -1, n // 3
    for i in range(0, n, STEP):
        img = cv2.resize(_read(out / f'{i:05d}.jpg'), (dw, dh))
        sharp = cv2.Laplacian(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()  # 手一挥就糊，封面不要糊的
        nxt = out / f'{min(i + 6, n - 1):05d}.jpg'  # 0.2 秒后那帧：差得多说明人在晃、手在挥
        move = float(np.mean(cv2.absdiff(img, cv2.resize(_read(nxt), (dw, dh)))))
        _, faces = det.detect(img)
        if faces is None or len(faces) == 0: raw.append(None); continue
        f = max(faces, key=lambda f: f[2] * f[3]); x, y, w, h = f[:4]
        raw.append([(x + w / 2) / dw, (y + h / 2) / dh, h / dh])
        # 封面挑「正脸、够大」的一帧：鼻尖在两眼正中间、两眼齐平
        ex, ey, lx, ly, nx = f[4], f[5], f[6], f[7], f[8]; eye = max(abs(lx - ex), 1)
        front = max(0, 1 - 2.5 * abs(nx - (ex + lx) / 2) / eye) * max(0, 1 - 3 * abs(ly - ey) / eye)
        hh = h / dh; size = min(hh, 0.26) / 0.26 if hh <= 0.34 else max(0.2, 1 - (hh - 0.34) * 3)  # 中景最好，脸太大的大特写不要
        sc_ = f[-1] * front * size * min(sharp, 400) / 400 / (1 + move / 3)
        if FPS <= i < n - FPS and sc_ > best: best, best_i = sc_, i
    found = [r for r in raw if r]
    if not found:
        return dict(w=iw, h=ih, track=[[0.5, 0.36, 0.0]] * len(raw), faces=0, cover_t=round(best_i / FPS, 2))
    # 补空：用前后最近的那次
    last = found[0]; filled = []
    for r in raw:
        last = r or last; filled.append(list(last))
    a = np.array(filled)
    # 平滑：先中值去跳，再来回各一遍指数平滑（不拖尾）
    k = 2; med = np.array([np.median(a[max(0, i - k):i + k + 1], axis=0) for i in range(len(a))])
    for arr in (med, med[::-1]):
        for i in range(1, len(arr)): arr[i] = arr[i - 1] * 0.6 + arr[i] * 0.4
    return dict(w=iw, h=ih, track=[[round(float(x), 4) for x in r] for r in med], faces=len(found), cover_t=round(best_i / FPS, 2))


def prepare(src, job_dir, dur, ffmpeg, log=print):
    d = Path(job_dir) / '人像帧'
    n = extract(src, d, dur, ffmpeg)
    log(f'已提取 {n} 帧画面，正在识别人脸')
    meta = track(d, n)
    meta.update(n=n, fps=FPS, step=STEP)
    (Path(job_dir) / 'person.json').write_text(json.dumps(meta), encoding='utf-8')
    log('已识别到人脸，画面会自动跟随' if meta['faces'] else '未检测到正脸，人像将居中显示')
    return meta


def for_plan(job_dir, meta):
    return dict(meta, dir=(Path(job_dir) / '人像帧').resolve().as_uri() + '/')
