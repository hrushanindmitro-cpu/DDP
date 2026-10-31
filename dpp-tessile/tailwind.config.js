module.exports = {
  content: ["./app/**/*.{js,jsx}", "./lib/**/*.js", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111111", muted: "#6B7280", accent: "#0EA5E9", proof: "#10B981",
        forest: "#0F3D33", forest2: "#1B5A4B", brand: "#0D7C6B", mint: "#CDEFE7",
        surface: "#F5F9F7", line: "#E3ECE8"
      },
      fontFamily: { sans: ["var(--font-inter)", "system-ui", "sans-serif"] }
    }
  },
  plugins: []
};
