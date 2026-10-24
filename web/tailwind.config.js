/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        // 品牌主色：年轻活力的粉红渐变系
        brand: {
          50: '#fff1f4',
          100: '#ffe0e7',
          200: '#ffc2cf',
          300: '#ff92a8',
          400: '#ff5c7c',
          500: '#ff3a6a', // 主色
          600: '#e81e50',
          700: '#c21440',
          800: '#9c1136',
          900: '#7c0f2c',
        },
        accent: '#7c5cff', // 辅助色：紫
        warn: '#ff9f1c', // 强调色：橙
        ink: {
          900: '#16161a',
          700: '#3d3d46',
          500: '#6b6b76',
          300: '#a5a5b0',
          100: '#e6e6ec',
          50: '#f5f5f8',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px rgba(22,22,26,0.06)',
        pop: '0 8px 30px rgba(22,22,26,0.12)',
      },
      borderRadius: { xl2: '18px' },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
      },
      animation: {
        shimmer: 'shimmer 1.4s linear infinite',
        fadeUp: 'fadeUp .28s ease both',
      },
    },
  },
  plugins: [],
};
