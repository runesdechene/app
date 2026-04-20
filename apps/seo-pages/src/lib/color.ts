export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function deriveTheme(hex: string) {
  const { h } = hexToHsl(hex);
  return {
    tagDark: `hsl(${h}, 15%, 8%)`,
    tagDeep: `hsl(${h}, 8%, 6%)`,
    tagAccent: `hsl(${h}, 45%, 75%)`,
    tagGlow: `hsla(${h}, 30%, 30%, 0.15)`,
    tagBorder: `hsla(${h}, 30%, 40%, 0.25)`,
    hue: h,
  };
}
