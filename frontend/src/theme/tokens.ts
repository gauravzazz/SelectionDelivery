/**
 * Centralized Design Tokens
 * All colors, sizes, spacing, radii, shadows, and typography live here.
 * Never hardcode these values in components.
 */

export const colors = {
    /* ── brand ── */
    primary: 'hsl(250, 84%, 54%)',
    primaryLight: 'hsl(250, 84%, 64%)',
    primaryDark: 'hsl(250, 84%, 44%)',
    accent: 'hsl(160, 84%, 44%)',
    accentLight: 'hsl(160, 84%, 54%)',

    /* ── surfaces ── */
    bgBase: 'hsl(230, 25%, 8%)',
    bgCard: 'hsl(230, 22%, 12%)',
    bgCardHover: 'hsl(230, 22%, 15%)',
    bgInput: 'hsl(230, 20%, 16%)',
    bgGlass: 'hsla(230, 30%, 18%, 0.65)',

    /* ── borders ── */
    border: 'hsla(230, 30%, 40%, 0.25)',
    borderFocus: 'hsl(250, 84%, 54%)',

    /* ── text ── */
    textPrimary: 'hsl(0, 0%, 96%)',
    textSecondary: 'hsl(230, 15%, 65%)',
    textMuted: 'hsl(230, 10%, 50%)',

    /* ── semantic ── */
    success: 'hsl(160, 84%, 44%)',
    successBg: 'hsla(160, 84%, 44%, 0.12)',
    warning: 'hsl(38, 92%, 50%)',
    warningBg: 'hsla(38, 92%, 50%, 0.12)',
    error: 'hsl(0, 72%, 51%)',
    errorBg: 'hsla(0, 72%, 51%, 0.12)',
} as const;

export const spacing = {
    xxs: '0.25rem',   /*  4px */
    xs: '0.5rem',    /*  8px */
    sm: '0.75rem',   /* 12px */
    md: '1rem',      /* 16px */
    lg: '1.5rem',    /* 24px */
    xl: '2rem',      /* 32px */
    xxl: '3rem',      /* 48px */
} as const;

export const radii = {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.25rem',
    full: '9999px',
} as const;

export const shadows = {
    card: '0 4px 24px hsla(0, 0%, 0%, 0.35)',
    glow: '0 0 32px hsla(250, 84%, 54%, 0.25)',
    btn: '0 2px 12px hsla(250, 84%, 54%, 0.35)',
} as const;

export const font = {
    family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    size: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
    },
    weight: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800,
    },
} as const;

export const breakpoints = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
} as const;
