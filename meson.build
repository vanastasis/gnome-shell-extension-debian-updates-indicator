project('gnome-shell-extension-debian-updates-indicator',
    version: '2.7.0-2',
    meson_version: '>= 1.1.0',
    license: 'GPL3')

ext_uuid = 'debian-updates-indicator@vanastasis.github.com'

data_dir = get_option('datadir')

shell_dir = join_paths(data_dir, 'gnome-shell')
extensions_dir = join_paths(shell_dir, 'extensions')
extension_dir = join_paths(extensions_dir, ext_uuid)
locale_dir = join_paths(extension_dir, 'locale')
gschema_dir = join_paths(extension_dir, 'schemas')
scripts_dir = join_paths(extension_dir, 'scripts')
ui_dir = join_paths(extension_dir, 'ui')

subdir(ext_uuid)
subdir('po')

install_data (extension_sources + extension_data, install_dir: extension_dir)
install_data (extension_schemas, install_dir: gschema_dir)
install_data (extension_scripts, install_dir: scripts_dir)
install_data (extension_ui, install_dir: ui_dir)

