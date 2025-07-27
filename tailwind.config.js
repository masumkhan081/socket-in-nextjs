/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // You can add custom colors here
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        secondary: {
          // Add your secondary color palette here
        },
        // Add more custom colors as needed
      },
      fontFamily: {
        // Add custom fonts here
        // Example: 'sans': ['Roboto', 'Arial', 'sans-serif'],
      },
      spacing: {
        // Add custom spacing values here
        // Example: '128': '32rem',
      },
      borderRadius: {
        // Add custom border radius values here
        // Example: 'xl': '1rem',
      },
      // Add other theme extensions as needed
    },
  },
  plugins: [
    // Add Tailwind plugins here
    // Example: require('@tailwindcss/forms'),
  ],
};
