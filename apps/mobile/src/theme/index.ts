// Design tokens from DESIGN.md. Classes come from tailwind.config.cjs; this module serves the few
// places that need a raw value: icons, SVG, maps and native props that do not accept classes.
import tokens from './tokens.json';

const c = tokens.colors;
export const palette = {
  brand: c.brand.DEFAULT, brandSoft: c.brand.soft, brandInk: c.brand.ink,
  lime: c.lime.DEFAULT, ink: c.ink, paper: c.paper.DEFAULT, paperShade: c.paper.shade, surface: c.surface,
  muted: c.muted, border: c.border, success: c.success.DEFAULT, warning: c.warning.DEFAULT, danger: c.danger,
  coral: c.coral, map: c.map, live: c.person['5'],
} as const;
/** Journey bar colors, in participant order. People are never identified by color alone: the name sits next to the bar. */
export const personColors = Object.values(c.person);
export const avatarColors = Object.values(c.avatar);
export { tokens };
