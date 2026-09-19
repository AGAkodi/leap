import math
from PIL import Image, ImageDraw, ImageFilter

def create_casino_carpet(path="assets/textures/casino_carpet_green.png"):
    size = 1024
    img = Image.new("RGBA", (size, size), (10, 35, 20, 255)) # Deep emerald base
    draw = ImageDraw.Draw(img)

    # Base subtle gradient / fabric noise
    for y in range(size):
        v = int(28 + 10 * math.sin(y / size * math.pi * 8))
        draw.line([(0, y), (size, y)], fill=(8, v, 16, 255))

    # Longitudinal flowing stripes/ribbons (as seen in photo)
    stripe_w = 32
    for x in range(0, size, stripe_w * 2):
        draw.rectangle([x, 0, x + stripe_w, size], fill=(12, 45, 26, 255))

    # Flowing curved horseshoe/oval chain motifs (horseshoe ribbon pattern from the photo)
    # To make seamless tileable, we tile across (size, size)
    cell_w = 128
    cell_h = 128
    
    # Draw interlocking gold & blended sage/emerald curved ribbons
    for gx in range(0, size, cell_w):
        for gy in range(0, size, cell_h):
            cx = gx + cell_w // 2
            cy = gy + cell_h // 2
            r = 44
            
            # Shadow under curve
            draw.arc([cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2], start=30, end=330, fill=(4, 18, 10, 220), width=14)
            
            # Deep green ribbon body
            draw.arc([cx - r, cy - r, cx + r, cy + r], start=30, end=330, fill=(24, 78, 48, 255), width=10)
            
            # Inner lighter sage/emerald highlight
            draw.arc([cx - r, cy - r, cx + r, cy + r], start=45, end=315, fill=(45, 115, 75, 255), width=4)
            
            # Thin gold filigree edge (luxury casino accent)
            draw.arc([cx - r - 5, cy - r - 5, cx + r + 5, cy + r + 5], start=40, end=320, fill=(185, 150, 65, 200), width=2)
            draw.arc([cx - r + 5, cy - r + 5, cx + r - 5, cy + r - 5], start=40, end=320, fill=(210, 175, 80, 200), width=2)

            # Central interlocking secondary loop (offset)
            cx2 = gx
            cy2 = gy
            r2 = 36
            draw.arc([cx2 - r2, cy2 - r2, cx2 + r2, cy2 + r2], start=210, end=510, fill=(18, 62, 38, 255), width=8)
            draw.arc([cx2 - r2 - 4, cy2 - r2 - 4, cx2 + r2 + 4, cy2 + r2 + 4], start=215, end=505, fill=(170, 135, 55, 180), width=2)

    # Apply subtle blur to blend beautifully like luxury carpet pile
    img = img.filter(ImageFilter.SMOOTH_MORE)
    img.save(path, "PNG")
    print(f"Generated casino carpet texture: {path} ({size}x{size})")

if __name__ == "__main__":
    create_casino_carpet()
