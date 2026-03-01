/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Claude's exact font stack
        sans: [
          'Sohne',
          'Söhne',
          'Geist',
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        // Claude's monospace (code blocks)
        mono: [
          '"Geist Mono"',
          'ui-monospace',
          '"Cascadia Code"',
          '"Source Code Pro"',
          'Menlo',
          'Consolas',
          '"Courier New"',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
