# Portal brand assets

Drop these files into `/portal/public/` so the header, favicon, and About hero render with the wadibardawil.com brand:

| File | Used by | Notes |
|---|---|---|
| `logo-horizontal.png` | Site header | White wordmark on transparent. Renders ~32px tall. The header background is `#22252a` so the logo must read on dark. |
| `logo-icon.png` | Header on mobile, social cards | "WB" monogram, square, transparent background. |
| `favicon.png` | Browser tab | Square, 32×32 minimum (a 64×64 master is fine — Next will downscale). Wired in `app/layout.tsx`. |
| `hero-transformation.jpg` | Future About / publisher section | Wide, dark-friendly. Not yet referenced in code. |

Until you drop the logo PNGs in, `<BrandWordmark />` (in `components/`) renders the name as text in the brand typography — the header still works.

Once the logo files are present, swap the wordmark for an `<Image>`:

```tsx
import Image from "next/image";

// in components/SiteHeader.tsx, replace <BrandWordmark /> with:
<Image src="/logo-horizontal.png" alt="Wadi Bardawil" height={32} width={180} priority />
```
