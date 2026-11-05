# 代码合成的轻底乐（不是 AI 生成的音乐，没有版权问题）：柔和和弦铺底 + 轻拍 + 镜头切换处一声低鼓。
# 只用 numpy；输出 48k 立体声 wav。想要更好的效果，在网页里换成你自己的配乐。
import wave
import numpy as np

SR = 48000
CHORDS = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]]   # Am F C G
f = lambda m: 440 * 2 ** ((m - 69) / 12)


def lowpass(x, cutoff):
    X = np.fft.rfft(x); fr = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (fr / cutoff) ** 4), len(x))


def make(dur, impacts=(), bpm=96, seed=3):
    n = int(SR * (dur + 0.5)); t = np.arange(n) / SR; L = np.zeros(n); R = np.zeros(n)
    beat = 60 / bpm; bar = beat * 4; rng = np.random.default_rng(seed)
    # 和弦铺底：每个和弦两小节，慢起慢收
    seg = bar * 2
    for k in range(int(dur / seg) + 2):
        a = k * seg; ch = CHORDS[k % 4]
        i0, i1 = int(a * SR), min(n, int((a + seg + 0.6) * SR))
        if i0 >= n: break
        tt = t[i0:i1] - a
        env = np.minimum(1, tt / 0.8) * np.clip((seg + 0.6 - tt) / 0.9, 0, 1)
        for j, m in enumerate(ch):
            ph = rng.random() * 6.28
            v = (np.sin(2 * np.pi * f(m) * tt + ph) + 0.25 * np.sin(2 * np.pi * f(m) * 2.003 * tt)) * env * 0.11
            L[i0:i1] += v * (1.0 if j % 2 else 0.7); R[i0:i1] += v * (0.7 if j % 2 else 1.0)
        # 低音
        bv = np.sin(2 * np.pi * f(ch[0] - 12) * tt) * env * 0.16
        L[i0:i1] += bv; R[i0:i1] += bv
    # 轻拍：四分音符软鼓 + 八分音符沙沙
    for k in range(int(dur / beat) + 1):
        a = k * beat; i0 = int(a * SR)
        if i0 >= n: break
        m = min(n - i0, int(0.25 * SR)); tt = np.arange(m) / SR
        if k % 2 == 0:
            kick = np.sin(2 * np.pi * (50 + 60 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 14) * 0.22
            L[i0:i0 + m] += kick; R[i0:i0 + m] += kick
        for h in (0, beat / 2):
            j0 = int((a + h) * SR); mm = min(n - j0, int(0.05 * SR))
            if mm <= 0: continue
            hat = rng.normal(0, 1, mm) * np.exp(-np.arange(mm) / SR * 90) * 0.025
            L[j0:j0 + mm] += hat * 0.8; R[j0:j0 + mm] += hat
    L = lowpass(L, 5200); R = lowpass(R, 5200)
    # 镜头切换处：一声低鼓 + 前面一小段渐强的风声
    for a in impacts:
        i0 = int(a * SR)
        if i0 >= n or a < 0.5: continue
        m = min(n - i0, int(0.9 * SR)); tt = np.arange(m) / SR
        boom = np.sin(2 * np.pi * (38 + 90 * np.exp(-tt * 9)) * tt) * np.exp(-tt * 5) * 0.35
        L[i0:i0 + m] += boom; R[i0:i0 + m] += boom
        s0 = max(0, i0 - int(0.35 * SR)); sw = lowpass(rng.normal(0, 1, i0 - s0), 2500) * np.linspace(0, 1, i0 - s0) ** 2 * 0.05
        L[s0:i0] += sw; R[s0:i0] += sw
    fade = np.clip((dur + 0.4 - t) / 1.5, 0, 1); L *= fade; R *= fade
    x = np.stack([L, R], 1); x /= max(1e-6, np.abs(x).max()) / 0.89
    return x


def write_wav(path, x):
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
