from pathlib import Path
from PIL import Image, ImageDraw

base_dir = Path(__file__).resolve().parent.parent
out_dir = base_dir / 'assets'

size = 256
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

bg = (15, 155, 115, 255)
margin = 20
radius = 54

draw.rounded_rectangle(
    [margin, margin, size - margin, size - margin],
    radius=radius,
    fill=bg,
)

draw.rounded_rectangle(
    [int(size * 0.18), int(size * 0.18), int(size * 0.82), int(size * 0.82)],
    radius=28,
    fill=(30, 180, 135, 255),
)

arrow = [
    (int(size * 0.27), int(size * 0.62)),
    (int(size * 0.57), int(size * 0.62)),
    (int(size * 0.57), int(size * 0.37)),
    (int(size * 0.78), int(size * 0.55)),
    (int(size * 0.57), int(size * 0.74)),
    (int(size * 0.57), int(size * 0.62)),
]
draw.polygon(arrow, fill=(255, 255, 255, 255))

ico_path = out_dir / 'courier-icon.ico'
ico_path.unlink(missing_ok=True)
img.save(ico_path, format='ICO')
print(f'Generated valid 256x256 Windows icon: {ico_path}')
