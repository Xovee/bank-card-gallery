# Bank Card Gallery

A small static template for publishing a personal bank card gallery. It includes anonymized sample data, placeholder SVG card art, bank and timeline views, search, filters, sorting, and a card preview dialog.

## Files

```text
card.html                  Static page entry
code/build-card-page.js    Builds generated card sections from data/cards.json
css/common.css             Base page styles
css/card.css               Card gallery styles
data/cards.json            Banks, card types, networks, and card records
img/card/                  Card images
img/logo/                  Bank logos
```

## Quick Start

Only Node.js is required.

1. Edit `data/cards.json`.
2. Replace the sample images in `img/card/` and `img/logo/`.
3. Build the page:

```bash
node code/build-card-page.js
```

On Windows PowerShell:

```powershell
node code\build-card-page.js
```

You can also use `npm run build` in shells that allow npm scripts.

4. Open `card.html` in a browser.

## Data Format

Add banks in `banks`:

```json
{
  "id": "river",
  "shortName": "RIVER",
  "name": "River Bank",
  "localName": "River Bank",
  "logo": "img/logo/river-bank.svg",
  "logoHeight": "3.2rem",
  "color": "#17633a"
}
```

Add cards in `cards`:

```json
{
  "title": "Everyday Debit",
  "bank": "river",
  "type": "debit",
  "networks": ["unionpay"],
  "image": "img/card/river-everyday-debit.svg",
  "alt": "Anonymous green debit card illustration",
  "width": 640,
  "height": 402,
  "date": "2022-03-30",
  "active": true
}
```

Useful optional card fields:

- `note`: shows a small badge
- `code`: appears in the preview dialog
- `imagePosition`: adjusts image crop, for example `"center top"`
- `imageScale`: adjusts image zoom, for example `"1.08"`

Dates can use `YYYY-MM-DD` or `YYYY-MM`. The page displays month and year, and uses the full value for sorting.

## Privacy

Before publishing, remove or mask:

- Real card numbers, expiry dates, CVV values, names, phone numbers, and identity numbers
- Internal card, application, or production codes
- Uncropped card scans or photos
- EXIF metadata from scanned or photographed images

The included sample banks and card images are placeholders.

## Deploy

This is a plain static site. After running the build script, upload the whole folder to GitHub Pages, Cloudflare Pages, Netlify, Vercel, or any static server.

Keep the relative paths intact unless you also update `card.html`:

- `css/common.css`
- `css/card.css`
- `data/cards.json`
- `img/card/...`
- `img/logo/...`

Add a `LICENSE` file before publishing if you want others to reuse the template.
