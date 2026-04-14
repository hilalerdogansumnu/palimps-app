#!/usr/bin/env python3
"""
PALIMPS App Store Screenshot Generator — Purple Edition
1290 × 2796 px  (6.7" iPhone 16 Pro Max)
All UI content is drawn programmatically — no prototype screenshots.
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, math

OUT = "/home/ubuntu/appstore-screenshots/purple"
os.makedirs(OUT, exist_ok=True)

W, H = 1290, 2796

# ── Palette ──────────────────────────────────────────────────────────────────
BG1        = (18,  12,  32)   # very dark purple-black (top)
BG2        = (34,  22,  58)   # deep purple (bottom)
PURPLE     = (120,  80, 200)  # main accent
PURPLE_LT  = (160, 120, 240)  # lighter accent
LAVENDER   = (200, 180, 255)  # soft lavender
WHITE      = (255, 255, 255)
OFF_WHITE  = (240, 235, 255)
MUTED      = (160, 150, 190)
SURFACE    = ( 38,  28,  64)  # card surface
SURFACE2   = ( 50,  38,  80)  # slightly lighter card
BORDER     = ( 70,  55, 110)  # subtle border
GREEN      = (100, 220, 140)  # toggle on
CREAM_TEXT = (225, 215, 255)  # subtitle text

# ── Fonts ─────────────────────────────────────────────────────────────────────
FB  = "/usr/share/fonts/truetype/noto/NotoSansDisplay-Black.ttf"
FBo = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
FM  = "/usr/share/fonts/truetype/noto/NotoSans-Medium.ttf"
FR  = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"

def fnt(path, size):
    try:    return ImageFont.truetype(path, size)
    except: return ImageFont.load_default()

# ── Helpers ───────────────────────────────────────────────────────────────────
def gradient(img, c1, c2):
    px = img.load()
    iw, ih = img.size
    for y in range(ih):
        t = y / ih
        r = int(c1[0]+(c2[0]-c1[0])*t)
        g = int(c1[1]+(c2[1]-c1[1])*t)
        b = int(c1[2]+(c2[2]-c1[2])*t)
        for x in range(iw): px[x,y] = (r,g,b)

def rr(d, x,y,w,h, r, fill=None, outline=None, lw=1):
    d.rounded_rectangle([x,y,x+w,y+h], radius=r, fill=fill, outline=outline, width=lw)

def centered_text(d, text, font, y, color, img_w=W, shadow=True):
    bb = d.textbbox((0,0), text, font=font)
    tw = bb[2]-bb[0]
    tx = (img_w - tw)//2
    if shadow:
        d.text((tx+2, y+2), text, font=font, fill=(0,0,0,80))
    d.text((tx, y), text, font=font, fill=color)
    return bb[3]-bb[1]   # line height

def text_w(d, text, font):
    bb = d.textbbox((0,0), text, font=font)
    return bb[2]-bb[0]

def text_h(d, text, font):
    bb = d.textbbox((0,0), text, font=font)
    return bb[3]-bb[1]

def sparkles(d, seed=1):
    import random; random.seed(seed)
    for _ in range(100):
        x = random.randint(0,W); y = random.randint(0,H)
        r = random.randint(1,3)
        a = random.randint(30,80)
        c = (LAVENDER[0], LAVENDER[1], LAVENDER[2])
        d.ellipse([x-r,y-r,x+r,y+r], fill=c)

def phone_frame(canvas, screen_img, px, py, pw, ph):
    """Draw iPhone 16 Pro Max frame and paste screen_img inside it."""
    cr = int(pw*0.115)
    bx = int(pw*0.018); bt = int(ph*0.018); bb = int(ph*0.018)
    sw = pw-bx*2; sh = ph-bt-bb

    # shadow
    shd = Image.new("RGBA",(pw+80,ph+80),(0,0,0,0))
    sd  = ImageDraw.Draw(shd)
    sd.rounded_rectangle([40,40,pw+40,ph+40], radius=cr, fill=(0,0,0,100))
    shd = shd.filter(ImageFilter.GaussianBlur(28))
    canvas.paste(shd,(px-40,py-40),shd)

    # body
    frm = Image.new("RGBA",(pw,ph),(0,0,0,0))
    fd  = ImageDraw.Draw(frm)
    fd.rounded_rectangle([0,0,pw-1,ph-1], radius=cr,
                         fill=(22,18,38), outline=(80,65,120), width=3)

    # screen
    sc_resized = screen_img.resize((sw,sh), Image.LANCZOS)
    mask = Image.new("L",(sw,sh),0)
    ImageDraw.Draw(mask).rounded_rectangle([0,0,sw-1,sh-1],
                                           radius=int(cr*0.8), fill=255)
    frm.paste(sc_resized,(bx,bt),mask)

    # Dynamic Island
    di_w=int(pw*0.30); di_h=int(ph*0.022)
    di_x=(pw-di_w)//2; di_y=int(bt*0.25)
    fd.rounded_rectangle([di_x,di_y,di_x+di_w,di_y+di_h],
                         radius=di_h//2, fill=(0,0,0))

    # glass highlight
    hl = Image.new("RGBA",(pw,ph),(0,0,0,0))
    ImageDraw.Draw(hl).rounded_rectangle([1,1,pw-2,ph-2], radius=cr-1,
                                         outline=(255,255,255,18), width=2)
    frm = Image.alpha_composite(frm,hl)
    canvas.paste(frm,(px,py),frm)

# ── Screen builders ───────────────────────────────────────────────────────────

def screen_library():
    """Screen 1: Kitaplarım"""
    sw, sh = 390, 844
    img = Image.new("RGB",(sw,sh),(248,246,255))
    d   = ImageDraw.Draw(img)

    # status bar
    d.rectangle([0,0,sw,44], fill=(248,246,255))
    d.text((16,14),"9:41",font=fnt(FBo,14),fill=(30,20,50))
    # battery/signal icons (simple rects)
    d.rounded_rectangle([sw-46,18,sw-14,28],radius=3,fill=(30,20,50))
    d.rectangle([sw-14,21,sw-12,25],fill=(30,20,50))
    d.rounded_rectangle([sw-68,19,sw-52,27],radius=2,outline=(30,20,50),width=1)
    d.rounded_rectangle([sw-67,20,sw-60,26],radius=1,fill=(30,20,50))

    # title
    d.text((20,52),"Kitaplarım",font=fnt(FB,26),fill=(22,14,44))

    # search bar
    rr(d,16,90,sw-32,40,12,fill=(235,230,250))
    d.text((46,102),"Kitap ve anları ara...",font=fnt(FR,14),fill=(150,140,180))
    # magnifier icon (circle + line)
    d.ellipse([24,100,36,112],outline=(150,140,180),width=2)
    d.line([34,110,40,116],fill=(150,140,180),width=2)

    # book rows
    books = [
        ("Savaş ve Barış",    "Lev Tolstoy",      "12 an", True,  (180,140,220)),
        ("Suç ve Ceza",       "F. Dostoyevski",   "8 an",  False, (140,180,220)),
        ("Dönüşüm",           "Franz Kafka",      "5 an",  False, (200,160,140)),
        ("Yüzyıllık Yalnızlık","G.G. Márquez",    "3 an",  False, (140,200,160)),
    ]
    y = 148
    for title, author, count, has_cover, cover_color in books:
        # row bg
        rr(d,16,y,sw-32,72,14,fill=(255,255,255))
        # cover placeholder
        rr(d,28,y+8,48,56,8,fill=cover_color)
        # cover initial
        d.text((44,y+26),title[0],font=fnt(FB,18),fill=(255,255,255))
        # text
        d.text((88,y+14),title,font=fnt(FBo,15),fill=(22,14,44))
        d.text((88,y+34),author,font=fnt(FR,13),fill=(120,110,150))
        d.text((88,y+54),count,font=fnt(FR,12),fill=(130,100,200))
        # chevron
        d.text((sw-40,y+26),"›",font=fnt(FBo,22),fill=(180,170,210))
        y += 82

    # FAB
    d.ellipse([sw-72,sh-100,sw-20,sh-48],fill=(110,70,200))
    d.text((sw-56,sh-88),"+",font=fnt(FB,28),fill=(255,255,255))

    # tab bar
    rr(d,0,sh-82,sw,82,0,fill=(255,255,255))
    d.line([0,sh-82,sw,sh-82],fill=(220,215,240),width=1)
    tabs=[("📚","Kitaplarım",sw//6),("💬","Asistan",sw//2),("👤","Profil",5*sw//6)]
    for icon,label,tx in tabs:
        active = label=="Kitaplarım"
        col = (110,70,200) if active else (160,150,190)
        d.text((tx-12,sh-72),icon,font=fnt(FR,22),fill=col)
        d.text((tx-text_w(d,label,fnt(FR,11))//2,sh-44),label,font=fnt(FR,11),fill=col)

    return img

def screen_book_detail():
    """Screen 2: Kitap Detay"""
    sw, sh = 390, 844
    img = Image.new("RGB",(sw,sh),(248,246,255))
    d   = ImageDraw.Draw(img)

    # status bar
    d.rectangle([0,0,sw,44], fill=(248,246,255))
    d.text((16,14),"9:41",font=fnt(FBo,14),fill=(30,20,50))
    d.rounded_rectangle([sw-46,18,sw-14,28],radius=3,fill=(30,20,50))
    d.rectangle([sw-14,21,sw-12,25],fill=(30,20,50))

    # nav bar
    d.text((16,52),"‹ Kitaplarım",font=fnt(FBo,15),fill=(110,70,200))
    d.text((sw-36,52),"···",font=fnt(FBo,15),fill=(110,70,200))

    # book header card
    rr(d,16,84,sw-32,130,16,fill=(255,255,255))
    # cover
    rr(d,28,94,72,108,10,fill=(160,110,220))
    d.text((50,132),"S",font=fnt(FB,32),fill=(255,255,255))
    # info
    d.text((114,100),"Savaş ve Barış",font=fnt(FB,17),fill=(22,14,44))
    d.text((114,124),"Lev Tolstoy",font=fnt(FR,14),fill=(120,110,150))
    d.text((114,148),"12 Ocak 2025'ten beri",font=fnt(FR,12),fill=(150,140,180))
    # stats
    rr(d,114,168,70,36,10,fill=(240,235,255))
    d.text((126,176),"12 An",font=fnt(FBo,13),fill=(110,70,200))
    rr(d,192,168,80,36,10,fill=(240,235,255))
    d.text((200,176),"34 Gün",font=fnt(FBo,13),fill=(110,70,200))

    # section header
    d.text((20,228),"Anlar",font=fnt(FB,18),fill=(22,14,44))
    d.text((sw-90,232),"+ An Ekle",font=fnt(FBo,14),fill=(110,70,200))

    # moment cards
    moments = [
        ("alıntı", "3 gün önce · s. 142",
         "\"Savaş, insanın kendine yabancılaştığı\nen derin andır.\""),
        ("fotoğraf", "1 hafta önce · s. 87", None),
        ("alıntı", "2 hafta önce · s. 43",
         "\"Barış, yalnızca savaşın yokluğu\ndeğil, ruhun sessizliğidir.\""),
    ]
    y = 260
    for kind, meta, text in moments:
        card_h = 110 if text else 90
        rr(d,16,y,sw-32,card_h,14,fill=(255,255,255))
        # type badge
        badge_col = (230,220,255) if kind=="alıntı" else (220,240,255)
        badge_txt_col = (100,60,180) if kind=="alıntı" else (60,100,180)
        rr(d,28,y+10,52 if kind=="alıntı" else 60,22,8,fill=badge_col)
        d.text((34,y+13),kind,font=fnt(FR,11),fill=badge_txt_col)
        d.text((28,y+38),meta,font=fnt(FR,12),fill=(150,140,180))
        if text:
            for i,line in enumerate(text.split("\n")):
                d.text((28,y+56+i*18),line,font=fnt(FR,13),fill=(50,40,80))
        else:
            # photo placeholder
            rr(d,sw-100,y+10,72,68,8,fill=(200,190,230))
            d.text((sw-82,y+34),"📷",font=fnt(FR,22),fill=(130,110,180))
        y += card_h+12

    # tab bar
    rr(d,0,sh-82,sw,82,0,fill=(255,255,255))
    d.line([0,sh-82,sw,sh-82],fill=(220,215,240),width=1)
    tabs=[("📚","Kitaplarım",sw//6),("💬","Asistan",sw//2),("👤","Profil",5*sw//6)]
    for icon,label,tx in tabs:
        active = label=="Kitaplarım"
        col = (110,70,200) if active else (160,150,190)
        d.text((tx-12,sh-72),icon,font=fnt(FR,22),fill=col)
        d.text((tx-text_w(d,label,fnt(FR,11))//2,sh-44),label,font=fnt(FR,11),fill=col)

    return img

def screen_ocr():
    """Screen 3: OCR — clean layout, no formatting controls"""
    sw, sh = 390, 844
    img = Image.new("RGB",(sw,sh),(248,246,255))
    d   = ImageDraw.Draw(img)

    # status bar
    d.rectangle([0,0,sw,44], fill=(248,246,255))
    d.text((16,14),"9:41",font=fnt(FBo,14),fill=(30,20,50))
    d.rounded_rectangle([sw-46,18,sw-14,28],radius=3,fill=(30,20,50))
    d.rectangle([sw-14,21,sw-12,25],fill=(30,20,50))

    # nav bar
    d.text((16,52),"‹ Geri",font=fnt(FBo,15),fill=(110,70,200))
    d.text((sw//2-40,52),"Metni Düzenle",font=fnt(FB,16),fill=(22,14,44))
    rr(d,sw-82,46,66,28,12,fill=(110,70,200))
    d.text((sw-72,52),"Kaydet",font=fnt(FBo,13),fill=(255,255,255))

    # ── photo + OCR info row ──
    rr(d,16,80,sw-32,90,14,fill=(255,255,255))
    # thumbnail
    rr(d,28,90,66,70,10,fill=(200,185,240))
    d.text((42,116),"📖",font=fnt(FR,24),fill=(130,100,200))
    # info
    rr(d,106,94,118,24,8,fill=(230,220,255))
    d.text((114,98),"OCR ile tanındı",font=fnt(FR,12),fill=(100,60,180))
    d.text((106,124),"Savaş ve Barış · s. 142",font=fnt(FBo,13),fill=(40,30,70))
    d.text((106,144),"3 gün önce",font=fnt(FR,12),fill=(150,140,180))

    # ── note label ──
    d.text((20,186),"Not",font=fnt(FBo,14),fill=(22,14,44))
    d.text((sw-100,190),"Opsiyonel",font=fnt(FR,12),fill=(170,160,200))

    # ── note input (short, single-line style) ──
    rr(d,16,208,sw-32,48,12,fill=(255,255,255),outline=(220,215,240),lw=1)
    d.text((28,222),"Kendi düşünceni ekle...",font=fnt(FR,14),fill=(190,180,215))

    # ── OCR text label ──
    d.text((20,274),"Tanınan Metin",font=fnt(FBo,14),fill=(22,14,44))

    # ── OCR text area (larger, read/edit) ──
    text_area_h = sh - 274 - 100
    rr(d,16,298,sw-32,text_area_h,14,fill=(255,255,255),outline=(220,215,240),lw=1)
    ocr_lines = [
        "Gelişimini ve başarını kısıtlayan",
        "mevcut faktörler neler? İşte ya da",
        "okulda önünü kesen biri mi var?",
        "Yeterince takdir ediliyor ve fırsatlar",
        "konusunda göz ardı mı ediliyorsun?",
        "Şu anda hangi düşük başarı",
        "olasılıklarıyla karşı karşıyasın?",
        "",
        "Başarının önündeki engelleri tanımak,",
        "onları aşmanın ilk adımıdır.",
    ]
    for i, line in enumerate(ocr_lines):
        d.text((28, 314+i*22), line, font=fnt(FR,14), fill=(40,30,70))

    # blinking cursor at end of last non-empty line
    last = ocr_lines[9]
    cx = 28 + text_w(d, last, fnt(FR,14))
    d.rectangle([cx, 314+9*22, cx+2, 314+9*22+16], fill=(110,70,200))

    # ── bottom: page number pill ──
    rr(d,16,sh-80,sw-32,44,12,fill=(255,255,255),outline=(220,215,240),lw=1)
    d.text((28,sh-64),"Sayfa",font=fnt(FR,13),fill=(150,140,180))
    rr(d,sw-80,sh-74,56,28,8,fill=(235,230,250))
    d.text((sw-68,sh-68),"142",font=fnt(FBo,13),fill=(80,60,140))

    return img

def screen_notifications():
    """Screen 4: Bildirimler"""
    sw, sh = 390, 844
    img = Image.new("RGB",(sw,sh),(248,246,255))
    d   = ImageDraw.Draw(img)

    # status bar
    d.rectangle([0,0,sw,44], fill=(248,246,255))
    d.text((16,14),"9:41",font=fnt(FBo,14),fill=(30,20,50))
    d.rounded_rectangle([sw-46,18,sw-14,28],radius=3,fill=(30,20,50))
    d.rectangle([sw-14,21,sw-12,25],fill=(30,20,50))

    # nav
    d.text((16,52),"‹ Profil",font=fnt(FBo,15),fill=(110,70,200))
    d.text((sw//2-44,52),"Bildirimler",font=fnt(FB,16),fill=(22,14,44))

    def toggle(d, x, y, on=True):
        w,h = 50,28
        rr(d,x,y,w,h,h//2,fill=(GREEN if on else (200,195,220)))
        cx = x+w-h//2-2 if on else x+h//2+2
        d.ellipse([cx-11,y+3,cx+11,y+h-3],fill=(255,255,255))

    def section(d, label, y):
        d.text((20,y),label,font=fnt(FR,12),fill=(150,140,180))
        return y+22

    def row(d, label, sub, y, right_text=None, has_toggle=False, toggle_on=False, chevron=False):
        rr(d,16,y,sw-32,56,12,fill=(255,255,255))
        d.text((28,y+10),label,font=fnt(FBo,14),fill=(22,14,44))
        if sub:
            d.text((28,y+30),sub,font=fnt(FR,12),fill=(150,140,180))
        if has_toggle:
            toggle(d,sw-82,y+14,toggle_on)
        elif right_text:
            d.text((sw-60,y+20),right_text,font=fnt(FR,14),fill=(150,140,180))
            d.text((sw-30,y+20),"›",font=fnt(FBo,18),fill=(180,170,210))
        elif chevron:
            d.text((sw-30,y+20),"›",font=fnt(FBo,18),fill=(180,170,210))
        return y+68

    y = 88
    y = section(d,"OKUMA HATIRLATICISI",y)
    y = row(d,"Günlük Okuma Hatırlatıcısı","Her gün belirlediğin saatte",y,has_toggle=True,toggle_on=True)
    y = row(d,"Saat","",y,right_text="21:00",chevron=True)
    y = row(d,"Günler","",y,right_text="Her gün",chevron=True)

    # notification preview card
    y += 8
    rr(d,16,y,sw-32,72,12,fill=(240,235,255))
    d.text((28,y+6),"ÖNİZLEME",font=fnt(FR,10),fill=(150,140,180))
    rr(d,28,y+22,36,36,8,fill=(110,70,200))
    d.text((38,y+30),"P",font=fnt(FB,16),fill=(255,255,255))
    d.text((74,y+22),"PALIMPS",font=fnt(FBo,13),fill=(22,14,44))
    d.text((74,y+40),"Bugün okudun mu? Son Kız'dan bir an kaydet.",
           font=fnt(FR,12),fill=(80,70,110))
    y += 84

    y = section(d,"HAFTALIK ÖZET",y)
    y = row(d,"Haftalık Okuma Özeti","Her Pazar sabahı",y,has_toggle=True,toggle_on=True)

    # weekly preview
    y += 8
    rr(d,16,y,sw-32,72,12,fill=(240,235,255))
    d.text((28,y+6),"ÖNİZLEME",font=fnt(FR,10),fill=(150,140,180))
    rr(d,28,y+22,36,36,8,fill=(110,70,200))
    d.text((38,y+30),"P",font=fnt(FB,16),fill=(255,255,255))
    d.text((74,y+22),"PALIMPS — Haftalık Özet",font=fnt(FBo,13),fill=(22,14,44))
    d.text((74,y+40),"Bu hafta 3 an kaydedildi · Savaş ve Barış · Dönüşüm",
           font=fnt(FR,12),fill=(80,70,110))
    y += 84

    y = section(d,"OKUMA SERİSİ",y)
    y = row(d,"Seri Kırılma Uyarısı","Gün bitmeden 2 saat önce",y,has_toggle=True,toggle_on=True)

    # tab bar
    rr(d,0,sh-82,sw,82,0,fill=(255,255,255))
    d.line([0,sh-82,sw,sh-82],fill=(220,215,240),width=1)
    tabs=[("📚","Kitaplarım",sw//6),("💬","Asistan",sw//2),("👤","Profil",5*sw//6)]
    for icon,label,tx in tabs:
        col = (160,150,190)
        d.text((tx-12,sh-72),icon,font=fnt(FR,22),fill=col)
        d.text((tx-text_w(d,label,fnt(FR,11))//2,sh-44),label,font=fnt(FR,11),fill=col)

    return img

def screen_profile():
    """Screen 5: Profil"""
    sw, sh = 390, 844
    img = Image.new("RGB",(sw,sh),(248,246,255))
    d   = ImageDraw.Draw(img)

    # status bar
    d.rectangle([0,0,sw,44], fill=(248,246,255))
    d.text((16,14),"9:41",font=fnt(FBo,14),fill=(30,20,50))
    d.rounded_rectangle([sw-46,18,sw-14,28],radius=3,fill=(30,20,50))
    d.rectangle([sw-14,21,sw-12,25],fill=(30,20,50))

    # title
    d.text((20,52),"Profil",font=fnt(FB,26),fill=(22,14,44))

    # avatar + name card
    rr(d,16,96,sw-32,120,16,fill=(255,255,255))
    # avatar circle
    d.ellipse([28,108,88,168],fill=(110,70,200))
    d.text((46,124),"A",font=fnt(FB,28),fill=(255,255,255))
    # name
    d.text((104,112),"Ayşe Kaya",font=fnt(FB,18),fill=(22,14,44))
    d.text((104,138),"4 kitap · 27 an",font=fnt(FR,14),fill=(120,110,150))
    # premium badge
    rr(d,104,162,80,22,8,fill=(110,70,200))
    d.text((116,165),"✦ Premium",font=fnt(FBo,11),fill=(255,255,255))

    # stats row
    y_s = 232
    rr(d,16,y_s,sw-32,72,14,fill=(255,255,255))
    stats = [("4","Kitap",sw//4),("27","An",sw//2),("12","Gün serisi",3*sw//4)]
    for val,label,sx in stats:
        d.text((sx-text_w(d,val,fnt(FB,20))//2,y_s+10),val,font=fnt(FB,20),fill=(110,70,200))
        d.text((sx-text_w(d,label,fnt(FR,12))//2,y_s+38),label,font=fnt(FR,12),fill=(150,140,180))

    # settings section
    d.text((20,322),"AYARLAR",font=fnt(FR,12),fill=(150,140,180))

    def settings_row(d, label, right, y, color=(22,14,44)):
        rr(d,16,y,sw-32,52,12,fill=(255,255,255))
        d.text((28,y+16),label,font=fnt(FBo,14),fill=color)
        d.text((sw-60,y+16),right,font=fnt(FR,14),fill=(150,140,180))
        d.text((sw-30,y+16),"›",font=fnt(FBo,18),fill=(180,170,210))
        return y+62

    y = 346
    y = settings_row(d,"Dil","Türkçe",y)
    y = settings_row(d,"Bildirimler","Açık",y)
    y = settings_row(d,"Abonelik","Aktif",y)
    y = settings_row(d,"Gizlilik Politikası","",y)

    # logout button
    y += 8
    rr(d,16,y,sw-32,52,12,fill=(255,245,245))
    d.text((sw//2-text_w(d,"Çıkış Yap",fnt(FBo,15))//2,y+16),
           "Çıkış Yap",font=fnt(FBo,15),fill=(200,60,60))

    # version
    d.text((sw//2-text_w(d,"PALIMPS v1.0",fnt(FR,12))//2,y+70),
           "PALIMPS v1.0",font=fnt(FR,12),fill=(180,170,210))

    # tab bar
    rr(d,0,sh-82,sw,82,0,fill=(255,255,255))
    d.line([0,sh-82,sw,sh-82],fill=(220,215,240),width=1)
    tabs=[("📚","Kitaplarım",sw//6),("💬","Asistan",sw//2),("👤","Profil",5*sw//6)]
    for icon,label,tx in tabs:
        active = label=="Profil"
        col = (110,70,200) if active else (160,150,190)
        d.text((tx-12,sh-72),icon,font=fnt(FR,22),fill=col)
        d.text((tx-text_w(d,label,fnt(FR,11))//2,sh-44),label,font=fnt(FR,11),fill=col)

    return img

# ── Outer frame builder ───────────────────────────────────────────────────────

SCREENS = [
    (screen_library,       "KİTAPLIK",       "Kitaplarınız,\nhafızanızda",
     "Tüm kitaplarınızı ve anlarınızı\nbir arada saklayın"),
    (screen_book_detail,   "KİTAP DETAY",    "Her an,\nbir iz",
     "Alıntılar ve fotoğraflarla\nokuma hafızanızı oluşturun"),
    (screen_ocr,           "OCR",            "Sayfayı fotoğrafla,\nmetin hazır",
     "OCR teknolojisiyle anları\nsaniyeler içinde kaydedin"),
    (screen_notifications, "BİLDİRİMLER",    "Okuma ritüelinizi\nkoruyun",
     "Günlük hatırlatıcılar ve seri\nuyarılarıyla alışkanlık edinin"),
    (screen_profile,       "PROFİL",         "Okuma hafızanız,\nsizin",
     "Premium ile sınırsız kitap ve an,\ntam kontrol sizde"),
]

def build(idx, screen_fn, badge, title, subtitle):
    print(f"  [{idx}] {badge}...")

    # ── background canvas ──
    canvas = Image.new("RGB",(W,H), BG1)
    gradient(canvas, BG1, BG2)
    draw = ImageDraw.Draw(canvas)
    sparkles(draw, seed=idx)

    # ── badge ──
    f_badge = fnt(FBo, 42)
    bb = draw.textbbox((0,0),badge,font=f_badge)
    bw = bb[2]-bb[0]+64; bh = bb[3]-bb[1]+26
    bx = (W-bw)//2; by = 88
    rr(draw,bx,by,bw,bh,bh//2,fill=PURPLE)
    draw.text((bx+32,by+13),badge,font=f_badge,fill=WHITE)

    # ── title ──
    f_title = fnt(FB,108)
    ty = by+bh+52
    for line in title.split("\n"):
        lh = centered_text(draw,line,f_title,ty,WHITE,shadow=True)
        ty += lh+18

    # ── phone mockup ──
    PHONE_TOP    = 660
    PHONE_BOTTOM = 2460
    zone_h = PHONE_BOTTOM - PHONE_TOP
    aspect = 390/844
    ph = int(zone_h*0.96)
    pw = int(ph*aspect)
    if pw > int(W*0.80): pw=int(W*0.80); ph=int(pw/aspect)

    screen_img = screen_fn()
    px = (W-pw)//2
    py = PHONE_TOP + (zone_h-ph)//2
    phone_frame(canvas, screen_img, px, py, pw, ph)

    # ── subtitle ──
    f_sub = fnt(FBo, 54)
    sy = 2490
    for line in subtitle.split("\n"):
        lh = centered_text(draw,line,f_sub,sy,CREAM_TEXT,shadow=False)
        sy += lh+18

    # ── logo ──
    f_logo = fnt(FB,52)
    ly = H-95
    centered_text(draw,"PALIMPS",f_logo,ly,LAVENDER,shadow=False)

    # ── save ──
    path = os.path.join(OUT,f"palimps-{idx:02d}.png")
    canvas.save(path,"PNG",optimize=True)
    kb = os.path.getsize(path)//1024
    print(f"     → {path} ({kb} KB)")
    return path

def main():
    print("PALIMPS App Store Screenshots — Purple Edition")
    print(f"Canvas: {W}×{H} px\n")
    paths=[]
    for i,(fn,badge,title,sub) in enumerate(SCREENS,1):
        paths.append(build(i,fn,badge,title,sub))
    print(f"\n✓ {len(paths)} screenshots saved to {OUT}/")

if __name__=="__main__":
    main()
