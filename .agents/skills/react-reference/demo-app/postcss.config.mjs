export default {
  plugins: {
    '@csstools/postcss-global-data': {
      files: ['src/ui/themes/styles/media.css']
    },
    'postcss-custom-media': {},
    'postcss-nesting': {},
    autoprefixer: {}
  }
}
