module.exports = {
  content: ["*.{html,js}"],
  theme: {
    extend: {
      backgroundImage: {
        'hero-pattern': "url('/images/1536016414.svg')",
        'footer-texture': "url('/images/1536016414.svg')",
      }
    }
  },
  plugins: [require("daisyui")],

    // daisyUI config (optional)
    daisyui: {
      styled: true,
      themes: true,
      base: true,
      utils: true,
      logs: true,
      rtl: false,
      prefix: "",
      darkTheme: "dark",
    },
}
