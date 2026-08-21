"""Build WhatsApp/OG cover collage from survey images."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "images"
OUT = IMG_DIR / "cover.png"

W, H = 1200, 630
HEADER = 96
GAP = 6
BG = (15, 23, 42)
ACCENT = (14, 165, 233)


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
    paths = [IMG_DIR / f"{i}.png" for i in range(1, 7)]
    photos = [Image.open(p).convert("RGB") for p in paths]

    canvas = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(canvas)

    for y in range(HEADER):
        t = y / max(HEADER - 1, 1)
        r = int(BG[0] + (ACCENT[0] - BG[0]) * t * 0.35)
        g = int(BG[1] + (ACCENT[1] - BG[1]) * t * 0.35)
        b = int(BG[2] + (ACCENT[2] - BG[2]) * t * 0.35)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    title = "අනුරාධපුර නගරය"
    subtitle = "විකල්ප 6 න් 3ක් තෝරන්න"
    title_font = load_font(42)
    sub_font = load_font(24)

    draw.text((48, 18), title, fill=(255, 255, 255), font=title_font)
    draw.text((48, 58), subtitle, fill=(186, 230, 253), font=sub_font)

    cols, rows = 3, 2
    grid_w = W - GAP * (cols + 1)
    grid_h = H - HEADER - GAP * (rows + 1)
    cell_w = grid_w // cols
    cell_h = grid_h // rows

    for idx, photo in enumerate(photos):
        c = idx % cols
        r = idx // cols
        x = GAP + c * (cell_w + GAP)
        y = HEADER + GAP + r * (cell_h + GAP)
        tile = fit_crop(photo, cell_w, cell_h)
        canvas.paste(tile, (x, y))
        draw.rectangle([(x, y), (x + cell_w - 1, y + cell_h - 1)], outline=(255, 255, 255), width=2)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, "PNG", optimize=True)
    print(f"Saved {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
