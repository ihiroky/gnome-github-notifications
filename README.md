# gnome-github-notifications
Integrate github's notifications within the gnome desktop environment

This version targets GNOME Shell 50 only.

## Installation

### Install from the package

```
./package.sh
gnome-extensions install --force gnome-notifications.zip
gnome-extensions enable github.notifications@alexandre.dufournet.gmail.com
gnome-extensions prefs github.notifications@alexandre.dufournet.gmail.com
```

Configure the GitHub token and hostname in the preferences window. The token must be able to read notifications.

To install directly from a checkout while developing, copy the repository contents to `~/.local/share/gnome-shell/extensions/github.notifications@alexandre.dufournet.gmail.com/` and then enable the extension with `gnome-extensions`.

