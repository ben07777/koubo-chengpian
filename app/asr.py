# 离线听写：SenseVoice + silero VAD（sherpa-onnx）。思路借自 motion-video-workflow/motion-kit 的 tools/asr.py（MIT，Isaac Chang）。
# 输出每句 start/end/text，以及每个字的时间。
import json, re, sys
from pathlib import Path
import wave
import numpy as np, sherpa_onnx

ROOT = Path(__file__).resolve().parent.parent
M = ROOT / 'models'
PUNCT = r"[，。！？、；：,.!?;:“”\"'（）()《》…—-]+"

def transcribe(wav16k, threads=4):
    rec = sherpa_onnx.OfflineRecognizer.from_sense_voice(
        model=str(M / 'sense-voice/model.int8.onnx'), tokens=str(M / 'sense-voice/tokens.txt'),
        use_itn=True, language='zh', num_threads=threads)
    with wave.open(str(wav16k)) as w:
        sr, n, ch = w.getframerate(), w.getnframes(), w.getnchannels()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    if ch > 1: x = x.reshape(-1, ch).mean(1)
    cfg = sherpa_onnx.VadModelConfig()
    cfg.silero_vad.model = str(M / 'vad.onnx'); cfg.silero_vad.min_silence_duration = 0.25
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
            if re.fullmatch(PUNCT, tk):
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
