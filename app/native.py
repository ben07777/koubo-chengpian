from functools import lru_cache
import json
from pathlib import Path
import re
import subprocess

import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

class FocusError(ValueError):
    """The user can fix this choice directly in the emphasis field."""


FPS=30
W,H=1080,1920
PAPER=(255,245,218)
INK=(22,20,20)
RED=(238,72,43)


def ease(t):
    v=max(0,min(1,t))
    return v*v*(3-2*v)


def project_sheet(width,height,cx,cy,roll,yaw,pitch):
    """实体相纸三个轴的旋转后投影，四角共用相机焦距。"""
    ax,ay,az=np.deg2rad([pitch,yaw,roll])
    sx,sy,sz=np.sin([ax,ay,az]);cxr,cyr,czr=np.cos([ax,ay,az])
    rx=np.array([[1,0,0],[0,cxr,-sx],[0,sx,cxr]])
    ry=np.array([[cyr,0,sy],[0,1,0],[-sy,0,cyr]])
    rz=np.array([[czr,-sz,0],[sz,czr,0],[0,0,1]])
    pts=np.array([[-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0]])*np.array([width,height,1])
    pts=pts@(rz@ry@rx).T
    return (pts[:,:2]*2450/(2450+pts[:,2:3])+[cx,cy]).astype(np.float32)


def word_times(lines, requested):
    seq=[c for ln in lines for c in ln["cs"]]
    text="".join(c[0] for c in seq)
    chars=[(a,b) for token,a,b in seq for _ in token]
    def occurrence(word,start=0):
        pos=text.find(word,start)
        return None if pos<0 else (word,chars[pos][0],chars[pos+len(word)-1][1],pos+len(word))
    if requested:
        words=[w.strip() for w in re.split("[，,]",requested) if w.strip()]
        if not 1<=len(words)<=3: raise FocusError("重点词可留空，或填 1 至 3 个词，用逗号隔开。")
    else:
        words=[]
        if text:
            import jieba.posseg
            choices=[w.word for w in jieba.posseg.cut(text) if 2<=len(w.word)<=5 and w.flag.startswith(("n","vn","v"))]
            choices=[w for w in choices if w not in ("可以","进行","大家","自己","就是","这个","知道","什么")]
            if not choices: choices=[ln["text"][:4] for ln in lines if ln["text"]]
            words=[max(choices,key=lambda w:(len(w),.28*len(text)<=text.index(w)<=.77*len(text)))]
    found=[];start=0
    for w in words:
        hit=occurrence(w,start)
        if not hit:
            if requested: raise FocusError(f"听写里没有按顺序找到“{w}”。可以先清空重点词并生成，再对照原声校字幕。")
            continue
        if found and hit[1]-found[0][1]>4:
            if requested: raise FocusError("重点词相隔超过 4 秒。请换成同一句里的词，或清空重点词后再生成。")
            break
        found.append(hit[:3]);start=hit[3]
    return found


def write_subtitles(jobdir):
    report=json.loads((jobdir/"样式实跑.json").read_text("utf-8"))
    lines=report["lines"]
    def stamp(sec):
        ms=round(sec*1000)
        return f"{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}"
    entries=[]
    for i,(start,end,text) in enumerate(lines):
        following=lines[i+1][0]-.02 if i+1<len(lines) else report["actual_duration"]
        end=min(end+.35,following,report["actual_duration"])
        if end>start:entries.append(f"{len(entries)+1}\n{stamp(start)} --> {stamp(end)}\n{text}\n")
    (jobdir/"字幕.srt").write_text("\n".join(entries),"utf-8")


def render_adapters(app,jobdir,focus):
    """原版在生成 mix.wav/plan.js 后调用这两个接口，后续合成、成片名、SRT 都交回原版。"""
    import pipeline,render
    fontdir=app/"画风/公共/fonts"
    @lru_cache(128)
    def face(size,display=False):
        path=fontdir/("GlowSansSC-Condensed-Heavy.otf" if display else "NotoSansSC-VF.ttf")
        f=ImageFont.truetype(str(path),int(size))
        if not display:
            try:f.set_variation_by_axes([645])
            except (OSError,ValueError):pass
        return f

    def render_movie(plan_path,dur,out_mp4,fps=30,workers=3,progress=None):
        p=json.loads(Path(plan_path).read_text("utf-8").removeprefix("window.PLAN=").removesuffix(";"))
        meta=p["person"];frames_dir=jobdir/"人像帧"
        lines=p["lines"]
        for ln in lines: ln["text"]="".join(c[0] for c in ln["cs"])
        actual=pipeline.duration(jobdir/"vo.wav")
        n=min(meta["n"],round(actual*fps))
        selected=word_times(lines,focus)
        if not selected: raise ValueError("缺少可强调的人声词语")
        debut=selected[0][1]
        exit_t=min(actual,selected[-1][2]+.40)
        # 轻微的肩部压缩保护高光，暗部保留肤色层次。全帧使用同一色表。
        x=np.arange(256,dtype=float)/255
        neutral=np.clip((x-.5)*1.030+.5+0.008-(np.maximum(0,x-.76)**2)*.38,0,1)*255
        lut=np.round(np.concatenate([np.clip(neutral+d*(1-x)*.55,0,255) for d in (2,0,-2)])).astype(np.uint8).tolist()
        lower=np.interp(np.arange(H)/H,[0,.5,.63,.78,.91,1],[0,0,7,48,57,17]).astype("uint8")
        shade=Image.new("RGB",(W,H),(14,13,14))
        shadowmask=Image.fromarray(np.repeat(lower[:,None],W,1))

        @lru_cache(15)
        def source(i):
            path=frames_dir/f"{min(meta['n']-1,max(0,i)):05d}.jpg"
            with Image.open(path) as f:
                frame=f.convert("RGB")
            iw,ih=frame.size
            row=meta["track"][min(len(meta["track"])-1,i//meta["step"])]
            # 9:16 原片保持原画幅。横片才按原生脸部轨迹移裁。
            cw,ch=min(iw,ih*W/H),min(ih,iw*H/W)
            left=max(0,min(iw-cw,row[0]*iw-cw/2))
            top=max(0,min(ih-ch,row[1]*ih-.42*ch))
            frame=frame.resize((W,H),Image.Resampling.LANCZOS,box=(left,top,left+cw,top+ch))
            return frame.point(lut)

        def film(i,t):
            src=source(i)
            if t>=.85:return src.copy()
            z=ease((t-.10)/.75)
            w=round(W*(.74+.26*z));h=round(H*(.74+.26*z))
            left=round((W-w)/2+W*.044*(1-z));top=round((H-h)*.49)
            gutter=round(17*(1-z))
            im=Image.new("RGB",(W,H),(25,24,24));dr=ImageDraw.Draw(im)
            # 前后格取同一真人素材的两个不同时间点。中心是此时真正的口型。
            for k,idx in ((-1,max(0,i+5)),(1,min(n-1,i+12)),(0,i)):
                px=left+k*(w+gutter)
                if px>=W or px+w<=0:continue
                cell=source(idx).resize((w,h),Image.Resampling.BICUBIC)
                if k:cell=Image.blend(cell,Image.new("RGB",(w,h),(42,36,30)),.27)
                im.paste(cell,(px,top))
                if w<W-3:dr.rectangle((px,top,px+w-1,top+h-1),outline=(196,176,146),width=1)
            # 只留真实底片格旁的一小段红色索引边；入满屏时它随底片离开画面。
            if top>6:dr.rectangle((left,top-5,left+round(70*(1-z)),top-3),fill=RED)
            return im

        def normal_caption(im,text):
            d=ImageDraw.Draw(im);sz=60
            while sz>36 and d.textlength(text,font=face(sz))>W*.82:sz-=2
            d.text((W*.5,H*.807),text,font=face(sz),fill=(255,250,237),anchor="mm",
                   stroke_width=2,stroke_fill=(57,47,42))

        def inkword(im,text,x,y,size,t,at,rgb,maxwidth):
            d=ImageDraw.Draw(im)
            while size>45 and d.textlength(text,font=face(size,True))>maxwidth:size-=2
            f=face(size,True)
            # 词组从一条排版基线依次翻出，有轻微错版红边，静止后合版。
            glyph=Image.new("RGBA",(maxwidth+22,round(size*1.4)+20))
            dr=ImageDraw.Draw(glyph);px=1
            for k,ch in enumerate(text):
                q=ease((t-at-k*.035)/.24)
                if q>0:
                    dy=round((1-q)*size*.48);a=round(255*q)
                    dr.text((px+round(4*(1-q))+1,4+dy),ch,font=f,fill=(*RED,a),anchor="lt")
                    dr.text((px,2+dy),ch,font=f,fill=(*rgb,a),anchor="lt")
                px+=d.textlength(ch,font=f)
            # 一个固定基线裁掉上升动作的下沿，质感接近字模由遮片后显影。
            glyph=glyph.crop((0,0,glyph.width,size+13))
            im.paste(glyph,(round(x),round(y)),glyph)
            return px

        # 同一原片的三次曝光。底色来自这一镜的暖灰环境，光与阴影分层绘制。
        gy,gx=np.mgrid[0:320,0:180]
        light=np.exp(-(((gx-67)/115)**2+((gy-78)/202)**2))
        flecks=np.random.default_rng(104).normal(0,.9,light.shape)
        desk=np.stack([37+light*47+flecks,32+light*44+flecks,30+light*42+flecks],axis=2)
        tabletop=cv2.resize(np.uint8(desk),(W,H),interpolation=cv2.INTER_CUBIC)
        paper_rgb=(248,237,211)
        art_start=max(.86,debut-.34)
        settle=min(actual,(selected[1][1] if len(selected)>1 else debut+.80)+.34)
        def fan_amount(t):
            if t<=art_start or t>=settle:return 0.0
            arrival=ease((t-art_start)/min(.43,max(.15,(settle-art_start)*.38)))
            departure=ease((settle-t)/min(.43,max(.15,(settle-art_start)*.38)))
            return min(arrival,departure)

        def paste_sheet(bg,image,quad,depth):
            # 边缘与投影沿透视四边形变化；环境影柔、接触影窄，避免贴纸感。
            src=np.asarray(image);sh,sw=src.shape[:2]
            corners=np.asarray([[0,0],[sw-1,0],[sw-1,sh-1],[0,sh-1]],dtype=np.float32)
            mat=cv2.getPerspectiveTransform(corners,quad)
            shape=np.zeros((H,W),np.uint8)
            cv2.fillConvexPoly(shape,np.int32(np.round(quad)),255,cv2.LINE_AA)
            if depth>.5:
                for dx,dy,sigma,power in ((.55,1.6,16,.28),(.2,.52,4,.30)):
                    low=cv2.resize(shape,(W//4,H//4))
                    matshadow=np.float32([[1,0,depth*dx/4],[0,1,depth*dy/4]])
                    low=cv2.warpAffine(low,matshadow,(W//4,H//4))
                    shadow=cv2.resize(cv2.GaussianBlur(low,(0,0),max(1,sigma*depth/75)),(W,H))
                    bg=cv2.multiply(bg,cv2.merge([255-np.uint8(shadow*power)]*3),scale=1/255)
            photo=cv2.warpPerspective(src,mat,(W,H),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
            alpha=shape[:,:,None].astype(np.uint16)
            return ((bg*(255-alpha)+photo*alpha+127)//255).astype(np.uint8)

        def paper_scene(i,t,amt):
            bg=tabletop.copy()
            # 后景的异时照片先滑到两边；前景保留这一帧的口型，最后直接接回原始画幅。
            for layer,tshift in ((-1,-.72),(1,.79),(0,0)):
                idx=max(0,min(n-1,i+round(tshift*fps)))
                if layer:
                    lean=layer*(17 if layer<0 else 14)*amt
                    center_x=W*(.5+layer*.355*amt)
                    center_y=H*(.5+(.015 if layer<0 else -.045)*amt)
                    size=1-.445*amt
                else:
                    lean=-4.8*amt;size=1-.345*amt
                    center_x=W*(.5-.014*amt);center_y=H*(.5+.006*amt)
                margins=round(25*amt)
                foot=round((100 if layer else 175)*amt)
                sheet=Image.new("RGB",(W,H),paper_rgb)
                inset=(margins,margins,W-margins,H-max(margins,foot))
                img=source(idx)
                if layer:img=Image.blend(img,Image.new("RGB",img.size,(114,100,77)),.23*amt)
                iw,ih=inset[2]-inset[0],inset[3]-inset[1]
                # 只略裁相纸边，保留眼口比例。中片永远是这个时刻的真原帧。
                pic=img.resize((iw,ih),Image.Resampling.BICUBIC,box=(0,max(0,(H-W*ih/iw)*.40),W,min(H,max(0,(H-W*ih/iw)*.40)+W*ih/iw))) if ih/iw<H/W else img.resize((iw,ih),Image.Resampling.BICUBIC)
                sheet.paste(pic,inset[:2])
                if not layer and foot>50 and t>=debut-.075:
                    d=ImageDraw.Draw(sheet);x=52;yy=H-foot+round(foot*.17)
                    width=min(118,round(foot*.58))
                    f=face(max(28,width),True)
                    word=selected[0][0]
                    while d.textlength(word,font=f)>W-205 and width>25:width-=3;f=face(width,True)
                    for k,ch in enumerate(word):
                        amtch=ease((t-debut+.075-k*.04)/.19)
                        clr=tuple(round(a+(b-a)*amtch) for a,b in zip(paper_rgb,INK))
                        d.text((x,yy+round((1-amtch)*13)),ch,font=f,fill=clr,anchor="lt")
                        x+=d.textlength(ch,font=f)
                    if len(selected)>1 and t>=selected[1][1]-.075:
                        second,at,_=selected[1];x+=round(width*.67)
                        for k,ch in enumerate(second):
                            q=ease((t-at+.075-k*.032)/.16)
                            ink=tuple(round(a+(b-a)*q) for a,b in zip(paper_rgb,(186,52,33)))
                            d.text((x,yy+round((1-q)*11)),ch,font=f,fill=ink,anchor="lt")
                            x+=d.textlength(ch,font=f)
                    d.rectangle((W-99,yy+7,W-64,yy+13),fill=RED)
                quad=project_sheet(W*size,H*size,center_x,center_y,lean,(layer*14 if layer else -7)*amt,(layer*4 if layer else 3)*amt)
                bg=paste_sheet(bg,sheet,quad,(17 if layer else 28)*amt)
            return Image.fromarray(bg)

        def draw_words(im,t):
            hits=[w for w in selected if t>=w[1]-.075]
            if not hits:return
            x=82;y=H*.693
            if len(selected)==1:
                inkword(im,hits[0][0],x,y,150,t,hits[0][1]-.075,PAPER,910)
                return
            second_at=selected[1][1]-.075
            # 第一词已经印在前景相纸下框。相纸归位后第二词直接在全幅原画上接住。
            if len(hits)>=2:
                second=hits[1];span=inkword(im,second[0],x,y+9,141,t,second_at,PAPER,490)
                if len(hits)>=3:
                    third=hits[2];tx=x+span+33
                    inkword(im,third[0],tx,y+48,81,t,third[1]-.075,(255,198,121),max(200,round(W-tx-65)))

        def caption_line(t):
            for i,line in enumerate(lines):
                end=min(lines[i+1]["t0"]-.018 if i+1<len(lines) else actual,line["t1"]+.35)
                if line["t0"]-.04<=t<end: return line
            return None

        # 有字的独立主片。藏去关键词所在行的重复大字，其余原话仍留给观众。
        cmd=[render.ffmpeg(),"-y","-loglevel","error","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}",
             "-r",str(fps),"-i","-","-an","-vf","scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
             "-c:v","libx264","-preset","veryfast","-crf","17","-threads","6","-pix_fmt","yuv420p",
             "-color_primaries","bt709","-color_trc","bt709","-colorspace","bt709","-color_range","tv",str(out_mp4)]
        with subprocess.Popen(cmd,stdin=subprocess.PIPE) as ff:
            try:
                for i in range(n):
                    t=i/fps;amt=fan_amount(t)
                    im=paper_scene(i,t,amt) if amt>.002 else Image.composite(shade,film(i,t),shadowmask)
                    line=caption_line(t)
                    if debut-.075<=t<exit_t:
                        if amt<.095:draw_words(im,t)
                        if line and len(selected)>1 and t>=selected[1][2] and t<selected[-1][1]-.075:
                            aside=line["text"]
                            for word,*_ in selected:aside=aside.replace(word,"")
                            aside=aside.strip("还")
                            if aside and len(aside)<=15:normal_caption(im,aside)
                    elif line:
                        txt=line["text"]
                        if line["t0"]<debut<line["t1"] and t<debut:
                            txt="".join(c for c,a,b in line["cs"] if a<debut-.01)
                        if txt:normal_caption(im,txt)
                    ff.stdin.write(im.tobytes())
                    if progress and i%15==0:progress(0,i,n)
            finally:ff.stdin.close()
            if ff.wait():raise RuntimeError("真人样式编码失败")
        (jobdir/"样式实跑.json").write_text(json.dumps({"style":"真人 · 排印","source":n,"fps":fps,"size":[W,H],
          "intro_sec":.85,"focus":selected,"spatial_event":{"from":art_start,"to":settle,"frame_offsets":[-.72,0,.79]},
          "actual_duration":n/fps,"package_job":True,
          "lines":[[q["t0"],q["t1"],q["text"]] for q in lines]},ensure_ascii=False,indent=2),"utf-8")
        return out_mp4

    def cover(plan_path,times,out_dir,cover=None):
        p=json.loads(Path(plan_path).read_text("utf-8").removeprefix("window.PLAN=").removesuffix(";"))
        tm=p["person"]["cover_t"];out_dir=Path(out_dir);made=[]
        for shape in cover or []:
            name=("封面_3比4.png" if shape=="34" else "封面_9比16.png")
            vf="crop=1080:1440:0:210" if shape=="34" else "null"
            pipeline.ff("-ss",tm,"-i",out_dir/"成片_竖屏.mp4","-vf",vf,"-frames:v","1",out_dir/name)
            made.append(out_dir/name)
        return made

    return render_movie,cover
