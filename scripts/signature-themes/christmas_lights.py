"""Builds the Christmas-lights strip for the email signature generator.

    python3 scripts/signature-themes/christmas_lights.py

Writes public/signature-generator/assets/theme-christmas-lights.gif: a transparent, looping, twinkling string of lights
(drawn at 3x so it stays sharp on retina screens; the signature shows it at 380x34). Email apps that don't animate GIFs
(Outlook for Windows) show the first frame, which is already a complete string of lights.
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

W, H = 380, 34          # CSS pixels the signature displays it at
OUT_SCALE = 3           # file is 3x for crisp screens
SS = 2                  # extra supersampling when drawing
S = OUT_SCALE * SS
SPACING = 22
SWAG = 95
FRAMES = 4
DELAY_MS = 380

WIRE = (45, 106, 63)
SOCKET = (28, 61, 39)
COLORS = [(229, 50, 45), (247, 183, 49), (47, 163, 91), (59, 143, 243)]  # red, gold, green, blue
OFF_MIX = (88, 98, 108)  # an unlit bulb is the colour pulled toward grey glass


def mix(c, to, t):
    return tuple(round(c[i] * (1 - t) + to[i] * t) for i in range(3))


def wire_y(x):
    u = (x % SWAG) / SWAG * 2 - 1       # -1..1 across one swag
    return 4 + 7 * (1 - u * u)


def frame(f):
    img = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # the wire, as a polyline fine enough to look like a curve
    pts = [(x * S, wire_y(x) * S) for x in [i * 0.5 for i in range(0, W * 2 + 1)]]
    d.line(pts, fill=WIRE + (255,), width=round(1.3 * S), joint="curve")
    n = (W - SPACING // 2) // SPACING + 1
    for i in range(n):
        x = SPACING / 2 + SPACING * i
        y = wire_y(x)
        base = COLORS[i % len(COLORS)]
        lit = ((i + f) % FRAMES) < 2
        col = base if lit else mix(base, OFF_MIX, 0.58)
        # socket
        d.rounded_rectangle([(x - 1.9) * S, (y - 0.5) * S, (x + 1.9) * S, (y + 4) * S], radius=0.8 * S, fill=SOCKET + (255,))
        # bulb: a rounded drop
        top = y + 3.2
        d.ellipse([(x - 4.2) * S, (top + 1.2) * S, (x + 4.2) * S, (top + 11.6) * S], fill=col + (255,))
        d.polygon([((x - 2.6) * S, (top + 2.2) * S), ((x + 2.6) * S, (top + 2.2) * S), ((x + 1.5) * S, top * S), ((x - 1.5) * S, top * S)], fill=col + (255,))
        # glint
        gl = (255, 255, 255) if lit else mix(col, (255, 255, 255), 0.35)
        d.ellipse([(x - 2.7) * S, (top + 3.4) * S, (x - 0.9) * S, (top + 6.2) * S], fill=gl + (255,))
    return img.resize((W * OUT_SCALE, H * OUT_SCALE), Image.LANCZOS)


def to_gif_frame(im):
    alpha = im.getchannel("A")
    p = im.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    mask = alpha.point(lambda a: 255 if a < 128 else 0)
    p.paste(255, mask)
    p.info["transparency"] = 255
    return p


frames = [to_gif_frame(frame(f)) for f in range(FRAMES)]
out = Path(__file__).resolve().parents[2] / "public/signature-generator/assets/theme-christmas-lights.gif"
frames[0].save(out, save_all=True, append_images=frames[1:], duration=DELAY_MS, loop=0, disposal=2, transparency=255, optimize=False)
print(out, out.stat().st_size, "bytes", frames[0].size)
