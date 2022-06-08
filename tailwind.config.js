module.exports = {
  content: ["*.{html,js}"],
  purge: ["*.{html,js}"],
  theme: {
    extend: {
      backgroundImage: {
        'landscape': "url('/images/landscape.svg')",
      },
      minHeight: (theme) => ({
        ...theme('spacing'),
      }),
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
