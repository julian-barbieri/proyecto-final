/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Tokens semánticos institucionales — centraliza la identidad visual
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          200: '#c7d7fe',
          500: '#3b5bdb',  // Azul institucional principal (USAL)
          600: '#2f4abf',
          700: '#243a99',
          800: '#1a2d7a',
          900: '#0f1f5c',
        },
        surface: {
          DEFAULT: '#f8fafc', // Fondo de página (reemplaza bg-slate-50 / bg-gray-50)
          card:    '#ffffff',
          hover:   '#f1f5f9',
          border:  '#e2e8f0',
        },
        // Semáforo de riesgo académico — usado en TODOS los indicadores de la app
        risk: {
          high:          '#dc2626', // Alto   — red-600
          'high-bg':     '#fef2f2',
          'high-border': '#fecaca',
          medium:        '#b45309', // Medio  — amber-700 (garantiza contraste WCAG AA)
          'medium-bg':   '#fffbeb',
          'medium-border': '#fde68a',
          low:           '#16a34a', // Bajo   — green-600
          'low-bg':      '#f0fdf4',
          'low-border':  '#bbf7d0',
          none:          '#64748b', // Sin datos — slate-500
          'none-bg':     '#f8fafc',
          'none-border': '#e2e8f0',
        },
      },
      fontFamily: {
        // Crimson Pro: autoridad académica/institucional para títulos
        heading: ['"Crimson Pro"', 'Georgia', 'serif'],
        // Atkinson Hyperlegible: diseñada para máxima legibilidad (usuarios mayores)
        body:    ['"Atkinson Hyperlegible"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};