from pathlib import Path

import cairosvg
from PIL import Image

base_dir = Path(__file__).resolve().parent.parent
svg_path = base_dir / 'assets' / 'courier-mark.svg'
out_dir = base_dir / 'assets'
sizes = [16, 24, 32, 48, 64, 128, 256]

for size in sizes:
    png_path = out_dir / f'courier-icon-{size}.png'
    cairosvg.svg2png(
        url=str(svg_path),
        write_to=str(png_path),
        output_width=size,
        output_height=size,
    )

images = [
    Image.open(str(out_dir / f'courier-icon-{size}.png')).convert('RGBA')
    for size in sizes
]

ico_path = out_dir / 'courier-icon.ico'
images[0].save(
    ico_path,
    format='ICO',
    sizes=[(img.size[0], img.size[1]) for img in images],
)

print(f'Generated icons: {ico_path}')
