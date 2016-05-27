module.exports = config:

  files:
    javascripts:
      joinTo:
        'libraries.js': /^(bower_components|node_modules|vendor)[\\/]/
        'app.js': /^app/
      order:
        before: [/js\/controllers\//]
    stylesheets: joinTo: 'app.css'
    templates: joinTo: 'templates.js'

  plugins:
    fbFlo:
      resolverReload: false
    babel:
      presets: ['es2015','stage-0']

  overrides:
    production:
      sourceMaps: true

  server:
    hostname: '127.0.0.1'
