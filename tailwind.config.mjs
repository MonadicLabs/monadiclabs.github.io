/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Monadic Labs palette — electric blue on black / white
        ink: {
          900: '#07070a',
          800: '#0a0a12',
          700: '#0e0e1a',
          600: '#12121f',
        },
        mono: {
          900: '#0a0a0a',
          800: '#141414',
          700: '#1f1f1f',
          500: '#6b6b6b',
          400: '#9a9a9a',
          300: '#cfcfcf',
          200: '#e6e6e6',
          100: '#f3f3f3',
          50: '#fafafa',
        },
        blue: {
          50: '#eef3ff',
          100: '#d6e4ff',
          200: '#a9c8ff',
          300: '#75a6ff',
          400: '#3d84ff',
          500: '#1158ff', // electric blue
          600: '#0b3fd6',
          700: '#082e9e',
          800: '#0a2470',
          900: '#0a1f4d',
        },
        // Theme-aware semantic tokens (swap under [data-theme] via CSS vars in global.css)
        canvas: 'var(--bg)',
        panel: 'var(--surface)',
        panel2: 'var(--surface-2)',
        line: 'var(--border)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['var(--font-display)', 'ui-serif-serif', 'Georgia', 'serif'],
      },
      maxWidth: {
        'container': '1240px',
      },
      screens: {
        '2xl': '1400px',
      },
    },
  },
  plugins: [],
};