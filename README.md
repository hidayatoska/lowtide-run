# Lowtide Run

Lowtide Run is an original third-person coastal city exploration game. Its city, character, parked cars, and HUD use procedural geometry; Rapier handles player and vehicle collisions. The static build bundles Three.js and Rapier locally for offline play.

## Requirements

- Node.js 20.19+ (verified with Node.js 24.15.0)
- npm
- A desktop browser with WebGL 2 support (Chrome recommended)

## Install and run

From the repository root in PowerShell:

```powershell
npm install
npm run dev
```

Open the local URL Vite prints (normally `http://127.0.0.1:5173/`). On foot, use **W A S D** to move, **Shift** to run, and **Space** to jump. Walk near a parked car and press **E** to enter. While driving, **W** accelerates, **S** brakes then reverses, **A/D** steer, **Space** is the handbrake, and **E** exits. Click the canvas to capture the mouse, drag to look, and use the mouse wheel to change camera distance.

## Production build and Make.fun packaging

```powershell
npm run build
```

Vite writes the static game to `game/dist/`. The Make.fun entry point copies only this built tree into `/output/game` and keeps the existing screenshots and dossier pipeline:

```powershell
$env:MAKEFUN_OUTPUT_DIR = 'out'
node main.ts
Remove-Item Env:MAKEFUN_OUTPUT_DIR
```

`node serve.ts` remains the repository's static server for `game/`; it is not the Vite development server. After building, the compiled game can be previewed at `/dist/` through that server.
