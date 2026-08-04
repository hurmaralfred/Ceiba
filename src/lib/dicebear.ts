// Generates deterministic DiceBear Adventurer avatar URLs for persons without real photos.
// Style: adventurer — cartoon character suitable for family context.

const BASE = "https://api.dicebear.com/9.x/adventurer"

export function getDiceBearUrl(seed: string): string {
  return `${BASE}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0a0818&radius=50`
}

// PNG variant — required for SVG <image href> (avoids cross-origin SVG blocking)
export function getDiceBearPngUrl(seed: string): string {
  return `${BASE}/png?seed=${encodeURIComponent(seed)}&backgroundColor=0a0818&radius=50&size=128`
}
