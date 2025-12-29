# ASHFIELD: FIND HER (GitHub Pages Horror Prototype)

A fogbound 3D exploration horror game inspired by Silent Hill structure:
- Exploration (first-person)
- Dialogue & text fragments
- Notes/journal
- Goal: find your daughter
- A silent entity stalks you through the fog

## Features
- Random theme each run (Wikipedia REST random summary)
- Random “scraped” public imagery used as textures (Wikimedia random file API)
- Offline-safe procedural texture fallbacks
- Rich fog + lights + abandoned town layout
- Journal (Tab) with objectives and notes
- Accessibility: sensitivity + fog + grain + vignette

## Controls
- WASD: move
- Mouse: look
- Shift: sprint
- E: interact
- Tab: journal
- Click: lock pointer

## Run locally
Because this uses ES modules, you should serve it (not open file://).
Examples:
- `python -m http.server`
- VS Code Live Server

## Deploy on GitHub Pages
1. Push repo
2. Settings → Pages → Deploy from branch → `main` / root
3. Wait for build, open the Pages URL

## Notes
- Online fetching depends on CORS and network availability. If blocked, it falls back automatically.
- Replace `assets/style_ref.png` with your own reference images to set mood for the boot screen.
