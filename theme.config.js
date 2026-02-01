/** @type {const} */
const themeColors = {
  // PALIMPS Design System
  // Near-white background (not pure white)
  background: { light: '#F8F8F7', dark: '#F8F8F7' },
  
  // Near-black text (not pure black)
  foreground: { light: '#1C1C1E', dark: '#1C1C1E' },
  
  // System gray for secondary text
  muted: { light: '#8E8E93', dark: '#8E8E93' },
  
  // Muted accent color (single, not saturated)
  primary: { light: '#6B7280', dark: '#6B7280' },
  
  // Surface for subtle elevation
  surface: { light: '#FAFAF9', dark: '#FAFAF9' },
  
  // Minimal border (very subtle)
  border: { light: '#E5E5E5', dark: '#E5E5E5' },
  
  // Success, warning, error (muted, not vibrant)
  success: { light: '#10B981', dark: '#10B981' },
  warning: { light: '#F59E0B', dark: '#F59E0B' },
  error: { light: '#EF4444', dark: '#EF4444' },
};

module.exports = { themeColors };
