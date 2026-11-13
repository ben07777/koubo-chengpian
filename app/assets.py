"""检查离线模型。首次安装时下载，出片时只读取本机文件。"""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
SENSE = "https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/"
ASSETS = {
    "sense-voice/model.int8.onnx": (SENSE+"model.int8.onnx","c71f0ce00bec95b07744e116345e33d8cbbe08cef896382cf907bf4b51a2cd51"),
    "sense-voice/tokens.txt": (SENSE+"tokens.txt","f449eb28dc567533d7fa59be34e2abca8784f771850c78a47fb731a31429a1dc"),
    "vad.onnx": ("https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx","9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6"),
    "face_yunet.onnx": ("https://huggingface.co/opencv/opencv_zoo/resolve/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx","8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4")
}

def _short(path):
    """Windows 的短文件名（8.3 名），全是英文。磁盘关了短名时拿不到，给 None。"""
    if os.name != "nt":
        return None
    try:
        import ctypes
        buf = ctypes.create_unicode_buffer(32768)
        n = ctypes.windll.kernel32.GetShortPathNameW(str(path), buf, len(buf))
        return buf.value if 0 < n < len(buf) else None
    except Exception:
        return None

def local_path(name):
    """给听写、找脸这两个底层库用的模型路径。这两个库在普通中文 Windows 上打不开带中文的路径。
    软件所在路径全是英文就原样给。带中文时（中文用户名的桌面、OneDrive 里的桌面），
    先给从当前文件夹算起的相对路径（models 文件夹下的那串，剪一条.cmd 先进到软件文件夹，所以这串全是英文）；
    当前文件夹不在软件夹里，再试 Windows 的短文件名；都不行就原样给。
    11-12 盲审重1：不再往软件夹以外（ProgramData 等）复制模型。旧版复制过去的那份新版不用，可以整个删掉。"""
    src = ROOT / "models" / name
    if str(src).isascii():
        return str(src)
    try:
        rel = os.path.relpath(src)
        if rel.isascii() and os.path.isfile(rel):
            return rel
    except ValueError:   # 当前文件夹和软件不在同一个盘
        pass
    short = _short(src)
    if short and short.isascii() and os.path.isfile(short):
        return short
    return str(src)

def matches(path, expected):
    if not path.is_file():
        return False
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest() == expected

def verify(download=False, offline=None):
    for name, (url, checksum) in ASSETS.items():
        dest = ROOT/"models"/name
        if matches(dest,checksum):
            continue
        if not download:
            raise SystemExit("模型缺少或内容不符："+name+"。请先运行 安装依赖.cmd。")
        dest.parent.mkdir(parents=True,exist_ok=True)
        print("正在准备 "+name,flush=True)
        with tempfile.NamedTemporaryFile(delete=False, dir=dest.parent) as out:
            pending=Path(out.name)
        try:
            if offline:
                shutil.copyfile(offline / name,pending)
            else:
                with urllib.request.urlopen(url,timeout=120) as src, pending.open("wb") as f:
                    shutil.copyfileobj(src,f)
            if not matches(pending,checksum):
                raise ValueError("文件校验未通过："+name+"。请核对下载版本，再重试。")
            os.replace(pending,dest)
        finally:
            pending.unlink(missing_ok=True)
    print("离线模型已通过内容校验。",flush=True)

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--install",action="store_true")
    parser.add_argument("--from-folder",type=Path,help="从已有的同版本 models 目录安装")
    args=parser.parse_args()
    try:
        verify(args.install,args.from_folder)
    except (OSError,ValueError) as e:
        raise SystemExit("模型准备失败。请检查网络或按安装说明离线放置模型。\n"+type(e).__name__)

