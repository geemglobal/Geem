export function applyPrimaryColor(hex: string): void {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  document.documentElement.style.setProperty(
    "--primary",
    `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`,
  );
}

const RADIUS_MAP: Record<string, string> = {
  sharp:   "0rem",
  sm:      "0.25rem",
  md:      "0.5rem",
  lg:      "0.75rem",
  xl:      "1.25rem",
};

export function applyBorderRadius(size: string): void {
  document.documentElement.style.setProperty("--radius", RADIUS_MAP[size] ?? "0.5rem");
}
