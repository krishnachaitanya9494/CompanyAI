/** @type {import('tailwindcss').Config} */
// Export Tailwind CSS configuration object.
export default {
  // Specify paths to all template and component files containing Tailwind utility classes.
  content: [
    // Include the root HTML file.
    "./index.html",
    // Include all JavaScript and JSX source files.
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Extend default Tailwind theme tokens.
  theme: {
    extend: {
      // Custom color palette tailored for modern AI-first SaaS design.
      colors: {
        // Dark navy primary palette for typography and prominent headers.
        navy: {
          950: '#070C18', // Deepest canvas navy
          900: '#0F172A', // Main dark navy text
          800: '#1E293B', // Slate navy secondary headers
          700: '#334155', // Muted navy text
          600: '#475569', // Subtle text
          500: '#64748B', // Neutral placeholder
        },
        // Subtle emerald / mint green accent palette for AI highlights and status.
        brand: {
          50: '#ECFDF5',  // Very light mint green background for badges/panels
          100: '#D1FAE5', // Soft green accent background
          200: '#A7F3D0', // Green border accent
          500: '#10B981', // Core brand green
          600: '#059669', // Darker brand green for buttons & focus
          700: '#047857', // High-contrast green text
        },
        // Clean neutral background canvas.
        surface: {
          50: '#F8FAFC',  // Main app neutral canvas
          100: '#F1F5F9', // Slightly darkened border/card hover
          200: '#E2E8F0', // Border divider
          card: '#FFFFFF', // Clean white card background
        }
      },
      // Configure clean font family hierarchy.
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      // Subtle, minimal shadows for clean enterprise aesthetics.
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.02)',
        'card': '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
        'dropdown': '0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)',
      }
    },
  },
  // Plugins configuration.
  plugins: [],
};
