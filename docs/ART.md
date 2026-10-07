# Neon Heist visual assets

Original cinematic cyberpunk artwork generated during development with the built-in imagegen tool. These are static project-owned assets; the application never calls an image-generation or AI service at runtime.

- `public/art/neon-operative-hero.png`: original hero source.
- `public/art/neon-operative-hero.webp`: optimized image retained from the earlier cinematic layout. The rebuilt homepage uses a procedural interactive 3D vault instead.
- `public/art/operative-atlas.png`: original six-character portrait atlas, three columns by two rows.
- `public/art/operative-atlas.webp`: optimized portrait atlas served by the app.

Hero prompt:

> Cinematic, realistic 3D-rendered cyberpunk heist artwork. Rain-soaked city rooftop at night. An original hooded hacker, waist-up, charcoal technical hood and layered dark jacket, subtle teal cybernetic visor, holding a compact hacking device. Wide landscape with dark negative space on the left. Cyan-teal rim light and warm amber practical light, physically based materials, cinematic depth of field. No text, logos, watermarks, UI, or workstation.

Portrait atlas prompt:

> Exactly six equal square panels in a regular 3-column, 2-row landscape atlas. Consistent cinematic 3D bust portraits, near-black teal background, cyan rim light, amber fill. Top row: hooded hacker Ghost, armored enforcer Brute, masked stealth operative Wraith. Bottom row: silver-haired grifter Switch, goggled getaway driver Rook, bearded analyst Oracle. Original characters, physically based detailed clothing, centered faces. No text, labels, numbering, logos, watermarks, gaps, or borders.

Images are pre-rendered artwork, not rigged 3D models. Portraits use CSS atlas positioning. The hero uses Next.js image optimization. The original PNGs are preserved alongside the WebP assets.
