"""Build WhatsApp/OG cover from Anuradhapura photos."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "images"
OUT = IMG_DIR / "cover.png"

W, H = 1200, 630
BANNER_H = 110
GAP = 4
BG = (15, 23, 42)

COVER_IMAGES = [
    IMG_DIR / "cover-a1.png",
    IMG_DIR / "cover-a2.png",
    IMG_DIR / "cover-a3.png",
]


def load_font(size: int):
    for name in ("Nirmala UI", "Iskoola Pota", "Segoe UI", "Arial"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def fit_crop(img: Image.Image, tw: int, th: int) -> Image.Image:
    sw, sh = img.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return img.crop((left, top, left + tw, top + th))


def main():
    photos = [Image.open(p).convert("RGB") for p in COVER_IMAGES]

    canvas = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(canvas)

    # Top title banner
    overlay = Image.new("RGBA", (W, BANNER_H), (15, 23, 42, 210))
    canvas.paste(overlay, (0, 0), overlay)

    title = "✨ අනුරාධපුර නගරය"
    subtitle = "ඔබේ අදහස අපිට කියන්න · විකල්ප 6 න් 3ක් තෝරන්න"
    draw.text((40, 22), title, fill=(255, 255, 255), font=load_font(40))
    draw.text((40, 68), subtitle, fill=(186, 230, 253), font=load_font(22))

    # 3 photo panels
    cols = len(photos)
    grid_h = H - BANNER_H - GAP
    cell_w = (W - GAP * (cols + 1)) // cols

    for idx, photo in enumerate(photos):
        x = GAP + idx * (cell_w + GAP)
        y = BANNER_H
        tile = fit_crop(photo, cell_w, grid_h)
        canvas.paste(tile, (x, y))

    # Bottom gradient for polish
    grad = Image.new("RGBA", (W, 48), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(grad)
    for i in range(48):
        alpha = int(120 * (i / 47))
        gdraw.line([(0, i), (W, i)], fill=(15, 23, 42, alpha))
    canvas.paste(grad, (0, H - 48), grad)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, "PNG", optimize=True)
    print(f"Saved {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
