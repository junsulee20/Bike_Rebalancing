/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", 
    "./src/index.css" // src 폴더 안의 모든 파일에 Tailwind 적용
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}