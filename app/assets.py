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

def _ascii_bases():
    out = []
    for v in (os.environ.get("ProgramData"), os.environ.get("PUBLIC")):
        if v:
            out.append(Path(v) / "koubo-chengpian" / "models")
    out.append(Path(ROOT.anchor) / "koubo-chengpian-models")
    out.append(Path(tempfile.gettempdir()) / "koubo-chengpian-models")
    return [p for p in out if str(p).isascii()]

def local_path(name):
    """给听写、找脸这两个底层库用的模型路径。软件所在路径全是英文就原样给；
    带中文时（中文用户名的桌面、OneDrive 里的桌面），普通中文 Windows 上这两个库可能打不开文件，
    先复制一份到不带中文的文件夹（第一次要几秒，以后直接用），复制不了再原样给。"""
    src = ROOT / "models" / name
    if str(src).isascii():
        return str(src)
    want = ASSETS.get(name, (None, None))[1]
    for base in _ascii_bases():
        dest = base / name
        part = dest.with_name(dest.name + ".part")
        mark = dest.with_name(dest.name + ".sha256")   # 复制成功时记下内容指纹；换了版本、模型同样大小也能认出来
        try:
            if dest.is_file() and dest.stat().st_size == src.stat().st_size and (not want or (mark.is_file() and mark.read_text(encoding="ascii").strip() == want)):
                return str(dest)
            dest.parent.mkdir(parents=True, exist_ok=True)
            if shutil.disk_usage(dest.parent).free < src.stat().st_size + (200 << 20):   # 留 200 MB 余量，不把这块盘写满
                continue
            shutil.copyfile(src, part)
            if want and not matches(part, want):
                part.unlink(missing_ok=True)
                continue
            os.replace(part, dest)
            if want:
                mark.write_text(want, encoding="ascii")
            print("软件路径里有中文，模型复制到 " + str(base) + " 再读取。", flush=True)
            return str(dest)
        except OSError:   # 写到一半失败（盘满、没权限）：删掉半截文件再换下一个位置
            try:
                part.unlink(missing_ok=True)
            except OSError:
                pass
            continue
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

