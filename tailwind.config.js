module.exports = {
  content: ["./app/**/*.{js,jsx}", "./lib/**/*.js"],
  theme: {
    extend: {
      colors: { ink: "#111111", muted: "#6B7280", accent: "#0EA5E9", proof: "#10B981" },
      fontFamily: { sans: ["var(--font-inter)", "system-ui", "sans-serif"] }
    }
  },
  plugins: []
};
