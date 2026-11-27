# Translation build configuration for Debian APT Updates Indicator.
i18n = import('i18n')

# define GETTEXT_PACKAGE
add_project_arguments('-DGETTEXT_PACKAGE="@0@"'.format (meson.project_name()), language:'c')

i18n.gettext(
    meson.project_name(),
    args: [
        '--no-wrap',
        '--width=120',
        '--keyword=n_:1,2',
        '--package-version=' + meson.project_version(),
        '--add-comments=Translators',
        '--copyright-holder=2023-2026 Gianni Lerro {glerro} ~ <glerro@pm.me>',
        '--msgid-bugs-address=https://github.com/vanastasis/' + meson.project_name() + '/issues',
    ],
    preset: 'glib',
    install_dir: locale_dir,
    install: true,
)
# This function also defines targets for maintainers to use:
#    gnome-shell-extension-debian-updates-indicator-pot: runs xgettext to regenerate the pot file
#    gnome-shell-extension-debian-updates-indicator-update-po: regenerates the .po files from current .pot file
#    gnome-shell-extension-debian-updates-indicator-gmo: builds the translations without installing
#    (in _build directory execute "meson compile target")

