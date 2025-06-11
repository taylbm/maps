// chimp_ui/maps/demo/theme.js
const theme = {
  colors: {
    text: '#000000',        // Black text
    background: '#FFFFFF',  // White background
    primary: '#0070f3',     // A blue primary color
    secondary: '#1c1c1e',   // A dark secondary color
    muted: '#f1f1f1',       // Light grey for muted elements
    modes: {
      // Define dark mode colors if needed later
      // dark: {
      //   text: '#FFFFFF',
      //   background: '#000000',
      //   primary: '#0a84ff',
      //   secondary: '#ebebf5',
      //   muted: '#1c1c1e',
      // }
    }
  },
  fonts: {
    body: 'system-ui, sans-serif',
    heading: 'system-ui, sans-serif',
    mono: 'Menlo, monospace',
  },
  fontSizes: [12, 14, 16, 20, 24, 32, 48, 64, 96],
  fontWeights: {
    body: 400,
    heading: 700,
    bold: 700,
  },
  lineHeights: {
    body: 1.5,
    heading: 1.125,
  },
  space: [0, 4, 8, 16, 32, 64, 128, 256, 512],
  // Add other theme scales as needed (borders, radii, shadows, etc.)
  // Example styles (can be expanded)
  styles: {
    root: {
      fontFamily: 'body',
      lineHeight: 'body',
      fontWeight: 'body',
    },
    h1: {
      color: 'text',
      fontFamily: 'heading',
      lineHeight: 'heading',
      fontWeight: 'heading',
      fontSize: 5,
    },
    // ... other global styles
  },
};

export default theme; 