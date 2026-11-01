# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

homeBridge is the website for HomeBridge Israel, which helps foreign buyers handle Israeli bureaucracy when purchasing property (it is not a real estate agency). MIT-licensed. The design and copy are based on the Lovable prototype at https://homebridge-connect-israel.lovable.app/.

## Stack and commands

Plain static site: `index.html`, `styles.css`, `script.js`, `journey.js`, images in `assets/`. No build step, package manager, linter or tests. Libraries come from CDNs: GSAP 3.12.5 + ScrollTrigger (cdnjs, classic scripts) and three.js 0.160.0 (jsdelivr, loaded with dynamic `import()` inside `journey.js` so the page still works from `file://`).

- Preview: open `index.html` in a browser, or serve it with `python3 -m http.server` and visit http://localhost:8000
- `version.txt` holds the project version as a plain string

## Structure and conventions

- Single page for now. It opens with the 3D scroll section (`#journey`), which also holds the hero copy as its first chapter; then `#services`, `#why` (dark navy band), `#contact`. Nav links are in-page anchors. The prototype also has Testimonials, Q&A and a French (FR) version; those have not been built yet.
- Design tokens are CSS custom properties on `:root` in `styles.css` (vivid navy, saffron gold, blueprint blue, sky, cream). Reuse them rather than hard-coding colors; `journey.js` reads them too.
- Type roles come from `--serif` (headings and wordmark: Sora, despite the token name), `--sans` (body: Plus Jakarta Sans) and `--mono` (small uppercase labels: JetBrains Mono), with `--h-weight`/`--h-track` for heading weight and tracking.
- `#services` is a grid of "3D block" cards (muted navy, dusty blue, sand, terracotta via per-card `--c`/`--c-dark` custom properties; the offset box-shadow is the block's depth and shrinks on hover).
- `#services`, `#why` and `#contact` are `.section.fit`: each is exactly one viewport tall under the header, with content that has to fit in that height (phone styles are compacted for this). `html` uses `scroll-snap-type: y proximity`, and these sections plus `#journey` are snap points.
- The logo is an inline SVG symbol (`#hb-mark`, defined at the top of `<body>`: a house whose walls double as suspension-bridge towers; `.brand-mark` needs `stroke: none` because of the global `svg` stroke rule) plus a text wordmark (`.brand`), used in the header and footer; the favicon is a simplified data-URI copy of the mark. `assets/homebridge-logo.png` is the original raster logo and is no longer used on the page.
- `script.js` highlights the nav link of the section on screen (IntersectionObserver; `#journey` maps to the `#top` link).
- Icons are inline Lucide SVG paths (stroke-based; the global `svg` rule sets stroke defaults).
- The contact form has no backend: `script.js` builds a `mailto:` link to the contact email.
- `#journey` is a tall section (`620vh`) with a CSS-sticky canvas. `journey.js` builds a low-poly house from three.js primitives (no model files). The walls are an `InstancedMesh` of bricks laid course by course (`layBlock`/`placeBricks`). One GSAP timeline tweens a plain `state` object (plinth, walls, roof, openings, garden, lights, cam); `apply()` maps it onto the scene, and rendering happens only when the state or the mouse parallax changes. `CHAPTER_STARTS` must line up with the timeline positions and with the `.chapter` items in the HTML (chapter 0 is the intro); the `.hud` "case file" steps map to chapters 1–5.
- Motion degrades gracefully: with reduced motion or no GSAP, `.journey.is-static` shows the finished house and all chapters; without WebGL the canvas is hidden. Entrance reveals in `script.js` use `gsap.from`, so content stays visible if GSAP fails to load.
- Breakpoints: 1023px (HUD hidden, 2-column services) and 767px (hamburger menu, journey chapters become bottom cards, single-column sections).
