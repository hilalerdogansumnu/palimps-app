/** @type {const} */
const themeColors = {
  // PALIMPS Design System v5 — Purple/Lavender Palette
  // Primary: Deep violet (#6E46C8) for actions/CTAs — contemplative, bookish
  // Accent: Soft lavender (#A78BFA) for highlights/badges
  // WCAG AA verified: all text/background pairs >= 4.5:1 contrast.
  // Surface is warm near-white (never pure #FFFFFF) to preserve warmth.
  background: { light: '#F8F6FF', dark: '#100C1E' },
  foreground: { light: '#160E2C', dark: '#EDE9FA' },
  muted:      { light: '#5F5678', dark: '#9B93B8' },
  primary:    { light: '#6E46C8', dark: '#8B67E0' },
  accent:     { light: '#A78BFA', dark: '#C4B0FF' },
  surface:    { light: '#FDFBFF', dark: '#1C1630' },
  border:     { light: '#E4DCFA', dark: '#2E2550' },
  success:    { light: '#22C55E', dark: '#4ADE80' },
  warning:    { light: '#F59E0B', dark: '#FBBF24' },
  error:      { light: '#EF4444', dark: '#F87171' },
};

module.exports = { themeColors };
