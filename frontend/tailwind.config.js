/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        virla: {
          // Escala da marca (roxo). `roxo` é a cor canônica (#800080).
          roxo:          '#800080', // Primary brand — botões, ícones, headers
          roxohighlight: '#9932CC', // Hover/active
          roxodark:      '#5a0a5a', // Roxo profundo — logo, títulos, alto contraste
          roxomid:       '#d8b4de', // Lilás claro — bordas, divisores
          neve:          '#FFFAFA', // Branco quente — fundo de página
          texto:         '#333333', // Cinza escuro — corpo de texto
          muted:         '#6b6470', // Cinza neutro — texto secundário (contraste AA)
        },
      },
      fontFamily: {
        // Display para títulos; body para o restante.
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        virla: '0 4px 16px rgba(128,0,128,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        'virla-lg': '0 20px 50px rgba(128,0,128,0.12), 0 6px 16px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        'virla-fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'virla-fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'virla-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'virla-fade-in 0.4s ease both',
      },
    },
  },
  plugins: [],
}
