export const colors = {
  navy: {
    900: '#050B14',
    800: '#0A1628',
    700: '#0D1F35',
    600: '#1A2A40',
    500: '#23293A',
  },
  teal: {
    DEFAULT: '#00D9FF',
    glow: 'rgba(0, 217, 255, 0.3)',
    muted: 'rgba(0, 217, 255, 0.1)',
  },
  green: {
    DEFAULT: '#00FF88',
    glow: 'rgba(0, 255, 136, 0.3)',
    muted: 'rgba(0, 255, 136, 0.1)',
  },
  surface: '#1A1F2E',
  border: '#23293A',
  text: {
    primary: '#FFFFFF',
    secondary: '#A0AEC0',
    muted: '#718096',
  },
} as const;

export const glassStyle = {
  background: 'rgba(26, 31, 46, 0.6)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(0, 217, 255, 0.1)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
} as const;

export const screens = {
  xs: '375px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;
