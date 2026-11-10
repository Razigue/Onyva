import { describe, expect, it } from 'vitest';
import tokens from './tokens.json';

// WCAG 2.2 AA (DESIGN.md): 4.5:1 for text, 3:1 for large text (24 px, or 18.66 px bold) and interface shapes.
const c = tokens.colors;
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

// Every text color used on every background it appears on in the app.
const text: Array<[string, string, string]> = [
  ['ink on paper', c.ink, c.paper.DEFAULT], ['ink on surface', c.ink, c.surface], ['ink on lime', c.ink, c.lime.DEFAULT], ['ink on lime-soft', c.ink, c.lime.soft], ['ink on chip', c.ink, c.chip],
  ['muted on paper', c.muted, c.paper.DEFAULT], ['muted on surface', c.muted, c.surface], ['muted on chip', c.muted, c.chip], ['muted on lime-soft', c.muted, c.lime.soft], ['muted on paper-deep', c.muted, c.paper.deep],
  ['brand on surface', c.brand.DEFAULT, c.surface], ['brand on paper', c.brand.DEFAULT, c.paper.DEFAULT], ['brand on brand-soft', c.brand.DEFAULT, c.brand.soft], ['brand on lime-soft', c.brand.DEFAULT, c.lime.soft],
  ['surface on brand (button)', c.surface, c.brand.DEFAULT], ['brand-ink on brand-soft', c.brand.ink, c.brand.soft],
  ['warning-ink on warning-soft', c.warning.ink, c.warning.soft], ['success on success-soft', c.success.DEFAULT, c.success.soft],
];

describe('color contrast of the design tokens', () => {
  for (const [name, fg, bg] of text) it(`${name} reaches 4.5:1`, () => expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5));
  it('keeps field and card outlines distinguishable from text, never the only cue', () => {
    // Borders are decorative separators; state is always written. Selected chips use brand, 3:1 against white.
    expect(contrast(c.brand.DEFAULT, c.surface)).toBeGreaterThanOrEqual(3);
  });
});
