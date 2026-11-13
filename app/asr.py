# 离线听写：SenseVoice + silero VAD（sherpa-onnx）。思路借自 motion-video-workflow/motion-kit 的 tools/asr.py（MIT，Isaac Chang）。
# 输出每句 start/end/text，以及每个字的时间。
import json, re, sys
from pathlib import Path
import wave
import numpy as np, sherpa_onnx
from assets import local_path

ROOT = Path(__file__).resolve().parent.parent
M = ROOT / 'models'
PUNCT = r"[，。！？、；：,.!?;:“”\"'（）()《》…—-]+"
DIGIT = '0123456789０１２３４５６７８９'
# 夹在两个数字中间的符号：留在数里（全角换成半角，下游只认一种写法）。11-09 第三轮总控：「数」这一类一次堵死，不再一种说法补一处
NUM_MID = {'.': '.', '．': '.', '-': '-', '－': '-', '−': '-', ':': ':', '：': ':', '/': '/', '／': '/', ',': ','}
NEG = ('-', '－', '−')   # 数字前面紧挨着、前头又不是数字的「-」是负号


def num_mid(prev, tk, nxt):
    """听写把「2.4」拆成「2」「.」「4」三个字：前后紧挨着都是数字的那个符号（. - : / ,）是数的一部分，不当标点
    （11-09 复审：原来「2.4倍」成了「24倍」；第三轮：「3:15」「1/3」「1,500」「3-5倍」一样）。全角逗号「，」不算，那是说话的停顿。"""
    return tk in NUM_MID and bool(prev) and prev[-1] in DIGIT and bool(nxt) and nxt[0] in DIGIT


def neg_sign(prev, tk, nxt):
    """「负百分之五」听写吐「-」「5」「%」：后面紧跟数字、前面不是数字的「-」是负号（11-09 第三轮复审：原来被当标点删掉，「负5%」成了「5%」）。"""
    return tk in NEG and bool(nxt) and nxt[0] in DIGIT and not (prev and prev[-1] in DIGIT)


def dec_dot(prev, tk, nxt):   # 老名字，1.2 补丁和考题还在用：小数点那一种
    return tk in ('.', '．') and num_mid(prev, tk, nxt)


def transcribe(wav16k, threads=4):
    rec = sherpa_onnx.OfflineRecognizer.from_sense_voice(
        model=local_path('sense-voice/model.int8.onnx'), tokens=local_path('sense-voice/tokens.txt'),
        use_itn=True, language='zh', num_threads=threads)
    with wave.open(str(wav16k)) as w:
        sr, n, ch = w.getframerate(), w.getnframes(), w.getnchannels()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    if ch > 1: x = x.reshape(-1, ch).mean(1)
    cfg = sherpa_onnx.VadModelConfig()
    cfg.silero_vad.model = local_path('vad.onnx'); cfg.silero_vad.min_silence_duration = 0.25
    cfg.silero_vad.threshold = 0.4; cfg.silero_vad.max_speech_duration = 8; cfg.sample_rate = sr
    vad = sherpa_onnx.VoiceActivityDetector(cfg, buffer_size_in_seconds=900)
    out = []
    def drain():
        while not vad.empty():
            seg = vad.front; st = seg.start / sr
            s = rec.create_stream(); s.accept_waveform(sr, seg.samples); rec.decode_stream(s); r = s.result
            toks = [t for t in r.tokens]; ts = [round(st + t, 3) for t in r.timestamps]
            out.append(dict(start=round(st, 3), end=round(st + len(seg.samples) / sr, 3), text=r.text, tokens=toks, ts=ts))
            vad.pop()
    for i in range(0, len(x), 512):
        vad.accept_waveform(x[i:i + 512]); drain()
    vad.flush(); drain()
    return out

def chars(segs):
    """拍平成逐字列表 [{c, t0, t1, p?, brk?}]：标点挂在前一个字的 p 上，brk 表示这里有停顿。"""
    res = []
    for s in segs:
        toks, ts = s['tokens'], s['ts']
        for i, tk in enumerate(toks):
            tk = tk.replace('▁', ' ').strip()
            if not tk: continue
            nxt = toks[i + 1].replace('▁', ' ').strip() if i + 1 < len(toks) else ''
            prev = res[-1]['c'] if res and 'p' not in res[-1] else ''
            if num_mid(prev, tk, nxt): tk = NUM_MID[tk]                     # 数中间的符号：当一个字留下
            elif neg_sign(prev if res and 'p' not in res[-1] else '', tk, nxt): tk = '负'   # 负号：字幕写「负」，和说的话一样
            elif re.fullmatch(PUNCT, tk):
                if res: res[-1]['p'] = res[-1].get('p', '') + tk
                continue
            t0 = ts[i]; t1 = ts[i + 1] if i + 1 < len(ts) else s['end']
            res.append(dict(c=tk, t0=round(t0, 3), t1=round(min(t1, t0 + 0.6), 3)))
        if res: res[-1]['brk'] = True
    return res

if __name__ == '__main__':
    segs = transcribe(sys.argv[1])
    for s in segs: print(f"{s['start']:6.2f}-{s['end']:6.2f}  {s['text']}")
    json.dump(segs, open(sys.argv[2] if len(sys.argv) > 2 else 'asr.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
