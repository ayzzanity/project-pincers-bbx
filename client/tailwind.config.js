/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bbx: {
          red: '#d71920',
          deepRed: '#a80f16',
          ink: '#171717',
          muted: '#6b7280',
          panel: '#ffffff',
          line: '#e5e7eb',
          warm: '#fff3d5',
          gold: '#f5b433',
          silver: '#d9dee6',
          bronze: '#b86635'
        }
      },
      boxShadow: {
        soft: '0 10px 30px rgba(23, 23, 23, 0.08)'
      }
    }
  },
  plugins: []
};
