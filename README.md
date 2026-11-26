
# Aerotide: Last Light Courier

[![Make the best flight game](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/duclucky/aerotide-flight-20261126-113119-r01/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/duclucky/aerotide-flight-20261126-113119-r01/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

Fly a high-wing courier through the Kestrel Archipelago at dusk. Follow the tide beacons or put a medical shipment down on the island's narrow strip. Tight banks bleed speed. Fuel burns faster at high power, and a heavy touchdown can damage the aircraft.

## Fly locally

From the repository root, run `python -m http.server 8080 --bind 127.0.0.1 --directory game` and open **http://127.0.0.1:8080/** in desktop Chrome or Edge with WebGL 2. The game needs a local HTTP server for its JavaScript modules, but makes no external requests and needs no build or install.

| Input | Action |
| --- | --- |
| Space or the Take controls button | Begin a sortie |
| W / S or ↑ / ↓ | Raise / lower the nose |
| A / D or ← / → | Bank left / right |
| Drag on the scene | Pitch and bank with the mouse |
| Shift / Ctrl or mouse wheel | Increase / decrease throttle |
| F | Toggle flaps |
| Hold Space on the runway | Brake |
| Esc / C / M / R | Pause / switch chase camera / toggle sound / restart |

### Beacon Circuit

Fly through all four beacons in order. Only the current beacon counts; if you miss it, make a wide turn and fly through it from either direction. The localizer points to the active beacon.

### Last Light Delivery

Set flaps with **F** before starting. Stay level until **LANDING CLEARED**. Stay on heading **000°** and aim along Runway 36's centerline at **55–85 kt**. On the default approach, hold **S** to descend; release it at about **32 ft indicated** to arrest the descent. Keep the wings level. Once **ON RUNWAY** appears, hold **Space** to brake and secure the cargo.

## Package the entry

Run `node main.ts` with Node.js 22.18 or later. It copies the game and browser captures and writes the make.fun dossier. The grader uses `/output`; for a local run set `MAKEFUN_OUTPUT_DIR` to a fresh empty directory.

## Credits and license

Aerotide's aircraft, island geometry, interface, shaders and synthesized sound are original. Aerotide is licensed under [MIT](LICENSE). The offline renderer is [Three.js r180](https://github.com/mrdoob/three.js/tree/r180) under its [MIT license](game/vendor/THREE-LICENSE.txt). The make.fun kit's dossier SDK is shipped unchanged at `vendor/makefun-game.ts`.
