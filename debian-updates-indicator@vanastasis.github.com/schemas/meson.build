# Build configuration for Debian APT Updates Indicator (vanastasis fork).
extension_schemas = files('org.gnome.shell.extensions.debian-updates-indicator.gschema.xml')

glib_compile_schemas_exe = find_program('glib-compile-schemas')
custom_target(
  'gschemas',
  build_by_default: true,
  build_always_stale: true,
  output: 'gschemas.compiled',
  command: [
    glib_compile_schemas_exe,
    '--targetdir=@OUTDIR@',
    '--strict',
    '@CURRENT_SOURCE_DIR@'
  ],
  install: true,
  install_dir: join_paths(extension_dir, 'schemas')
)

