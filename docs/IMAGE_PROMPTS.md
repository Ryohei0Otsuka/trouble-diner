# Image generation record

本プロジェクトで使用するドット絵素材の生成条件です。再生成時に同じ目的と制約を共有できるよう、英語の原文を保存しています。

## Restaurant map

- Mode: built-in image generation
- Output: `public/assets/restaurant-map.png`

```text
Use case: stylized-concept
Asset type: wide background illustration for a tablet-first restaurant incident-response web app
Primary request: create a charming 16-bit pixel-art Japanese casual diner interior viewed from a slightly elevated isometric angle, with clearly readable zones for dining floor, open kitchen, cashier counter, stock shelf, takeout pickup window, staff room door, and utility corner
Style/medium: authentic polished 16-bit pixel art, crisp hard pixel edges, limited sprite-game palette, cozy management-simulation game aesthetic
Composition/framing: wide 16:9 scene with generous calm space around each operational zone so HTML buttons and status markers can be overlaid later; no UI chrome
Lighting/mood: warm, inviting, playful, busy but orderly
Color palette: cream, tomato red, warm amber, mint green, sky blue, chocolate brown
Constraints: no text, no letters, no numbers, no logos, no watermark, no people, no brand marks, no photorealism, no anti-aliased vector look; every zone visually distinct; designed to sit behind a readable web interface
```

## Crew mascot

- Mode: built-in image generation with background extraction
- Output: `public/assets/crew-mascot.png`

```text
Use case: background-extraction
Asset type: transparent pixel-art mascot for a restaurant operations game-style web app and PWA icon
Primary request: a cheerful tiny restaurant crew mascot, gender-neutral, wearing a tomato-red cap and cream apron, holding a small mint-green checklist clipboard, confident ready-to-help pose
Style/medium: authentic polished 16-bit pixel art sprite, crisp hard pixel edges, limited palette, charming Japanese management-simulation game style
Composition/framing: centered full-body character, square canvas, generous transparent padding, readable at very small icon size
Lighting/mood: friendly, capable, playful
Color palette: tomato red, cream, mint green, sky blue, chocolate brown
Constraints: genuinely transparent background, one character only, no text, no letters, no numbers, no logo, no watermark, no restaurant brand, no extra objects besides clipboard, no photorealism, no anti-aliased vector look
```
