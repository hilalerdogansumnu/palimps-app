#!/usr/bin/env python3
"""
PALIMPS OG Image — 1200x630 for social link previews.

Runs standalone (Linux sandbox or Mac with Pillow). Reads ./icon.png,
writes ./og-image.png. Update <meta og:image> to /og-image.png after
generation.

Rerun whenever brand visuals change:
    python3 generate_og.py
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

# ── Canvas ───────────────────────────────────────────────────────────
W, H = 1200, 630

# ── Palette (from website/index.html brand tokens) ───────────────────
GRAD_TOP    = (122,  94, 229)   # #7A5EE5
GRAD_BOTTOM = ( 92,  59, 204)   # #5C3BCC
WHITE       = (255, 255, 255)
CREAM       = (237, 233, 250)   # #EDE9FA
CREAM_DIM   = (200, 190, 230)

# ── Paths ────────────────────────────────────────────────────────────
HERE      = os.path.dirname(os.path.abspath(__file__))
ICON_PATH = os.path.join(HERE, "icon.png")
OUT_PATH  = os.path.join(HERE, "og-image.png")

# ── Fonts (Linux-sandbox first; fall back to common Mac paths) ───────
FONT_CANDIDATES_SERIF = [
    "/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf",
    "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
    "/System/Library/Fonts/NewYork.ttf",
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
]
FONT_CANDIDATES_SANS = [
    "/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf",
    "/System/Library/Fonts/SFNS.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]
FONT_CANDIDATES_LIGHT = [
    "/usr/share/fonts/truetype/google-fonts/Poppins-Light.ttf",
    "/System/Library/Fonts/SFNSRounded.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]


def first_existing(paths):
    for p in paths:
        if os.path.exists(p):
            return p
    raise FileNotFoundError(f"No font found in: {paths}")


SERIF_PATH = first_existing(FONT_CANDIDATES_SERIF)
SANS_PATH  = first_existing(FONT_CANDIDATES_SANS)
LIGHT_PATH = first_existing(FONT_CANDIDATES_LIGHT)


def fnt(path, size):
    return ImageFont.truetype(path, size)


def linear_gradient(size, c1, c2):
    img = Image.new("RGB", size, c1)
    draw = ImageDraw.Draw(img)
    _, h = size
    for y in range(h):
        t = y / h
        c = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
        draw.line([(0, y), (size[0], y)], fill=c)
    return img


def rounded_icon(path, size, radius):
    icon = Image.open(path).convert("RGBA").resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size, size], radius=radius, fill=255
    )
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(icon, (0, 0), mask)
    return out


def draw_text_centered(draw, text, font, y, color, letter_spacing=0):
    """Draw text centered on canvas W, optionally with letter-spacing."""
    if letter_spacing:
        # Measure each char to layout manually
        widths = []
        for ch in text:
            bb = draw.textbbox((0, 0), ch, font=font)
            widths.append(bb[2] - bb[0])
        total = sum(widths) + letter_spacing * (len(text) - 1)
        x = (W - total) // 2
        for i, ch in enumerate(text):
            draw.text((x, y), ch, font=font, fill=color)
            x += widths[i] + letter_spacing
    else:
        bb = draw.textbbox((0, 0), text, font=font)
        x = (W - (bb[2] - bb[0])) // 2
        draw.text((x, y), text, font=font, fill=color)


def main():
    # Background
    img = linear_gradient((W, H), GRAD_TOP, GRAD_BOTTOM).convert("RGBA")

    # Icon geometry
    ICON_SIZE = 160
    ICON_RADIUS = 36
    icon_x = (W - ICON_SIZE) // 2
    icon_y = 80

    # Soft shadow under icon
    icon = rounded_icon(ICON_PATH, ICON_SIZE, ICON_RADIUS)
    shadow_canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shadow_color = Image.new("RGBA", icon.size, (0, 0, 0, 120))
    shadow_color.putalpha(
        Image.eval(icon.split()[-1], lambda a: min(a, 120))
    )
    shadow_canvas.paste(shadow_color, (icon_x, icon_y + 18), icon.split()[-1])
    shadow_canvas = shadow_canvas.filter(ImageFilter.GaussianBlur(22))
    img = Image.alpha_composite(img, shadow_canvas)

    # Icon on top
    icon_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    icon_layer.paste(icon, (icon_x, icon_y), icon)
    img = Image.alpha_composite(img, icon_layer)

    # Text
    img = img.convert("RGB")
    draw = ImageDraw.Draw(img)

    # PALIMPS wordmark — serif bold, letter-spaced
    wordmark_font = fnt(SERIF_PATH, 92)
    draw_text_centered(
        draw, "PALIMPS", wordmark_font,
        y=icon_y + ICON_SIZE + 36,
        color=WHITE,
        letter_spacing=14,
    )

    # Tagline — light sans
    tagline_font = fnt(LIGHT_PATH, 32)
    draw_text_centered(
        draw, "Kitap okuma hafızan", tagline_font,
        y=icon_y + ICON_SIZE + 36 + 120,
        color=CREAM,
    )

    # URL corner
    url_font = fnt(SANS_PATH, 20)
    url = "palimps.app"
    bb = draw.textbbox((0, 0), url, font=url_font)
    uw = bb[2] - bb[0]
    draw.text((W - uw - 48, H - 52), url, font=url_font, fill=CREAM_DIM)

    img.save(OUT_PATH, "PNG", optimize=True)
    print(f"OG image saved: {OUT_PATH} ({W}x{H})")


if __name__ == "__main__":
    main()
