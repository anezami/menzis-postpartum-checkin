/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        menzis: {
          geel: '#FEC352',
          inkt: '#161513',
          wit: '#FFFFFF',
          zacht: '#FFF7E8',
        },
        triage: {
          groen: '#2E7D32',
          geel: '#F2A900',
          oranje: '#E8730C',
          rood: '#C62828',
        },
      },
      borderRadius: {
        xl2: '20px',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-rounded',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
