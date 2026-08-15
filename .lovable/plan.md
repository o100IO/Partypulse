

# Move Hero Icons to the Side for Full Banner Visibility

## Problem
The hero section stacks everything centered over the background image — the LIVE badge, event name, DJ avatar, genre badge all pile on top of each other, obscuring the background/banner image (as seen in the screenshot with the Buzz Lightyear image being covered).

## Solution
Restructure the hero layout so content sits at the edges, leaving the banner image visible:

- **Top-right corner**: LIVE badge (or Pre-Event badge)
- **Bottom-left**: DJ avatar + name + genre badge in a horizontal row
- **Bottom overlay**: Event name as a bold title along the bottom
- **VIP badge**: Small pill bottom-right
- The hero section gets a taller fixed height so the background image has room to breathe
- Gradient overlay shifts to bottom-only (`from-black/60 via-transparent to-transparent` from bottom) so the top/center of the image stays clear

## Layout (ASCII)
```text
┌──────────────────────────────┐
│                    ● LIVE ▐▌▌│  ← top-right
│                              │
│      (banner image visible)  │
│                              │
│  [avatar] DJ Name  [Pop]     │  ← bottom-left
│  Event Name Here             │
└──────────────────────────────┘
```

## File to Modify
- **`src/pages/guest/Event.tsx`** (lines 485-543) — Restructure the hero `div` from `text-center` stacked layout to a `flex flex-col justify-between` layout with positioned elements. Increase min-height. Lighten the gradient overlay so the image shows through.

