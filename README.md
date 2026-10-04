# ⚠️ **THIS PROJECT IS UNMAINTAINED** ⚠️

Thanks for your interest over the years but, as the commit history shows, I don't have the time to maintain this project between my family and professional responsibilities (especially as I don't use this extension anymore!).

# gnome-github-notifications
Integrate github's notifications within the gnome desktop environment

## Installation

### The automatic way
Go there and activate the extension: https://extensions.gnome.org/extension/1125/github-notifications/
Don't forget to click on the configuration icon and follow the instructions there.

### The manual way

```
./package.sh
gnome-extensions install --force gnome-notifications.zip
gnome-extensions enable github.notifications@ihiroky.dev
gnome-extensions prefs github.notifications@ihiroky.dev
```

Then in gnome-tweaks, configure the extension to give it a token and your github handle (instructions are provided in the configuration dialog).
If the extension isn't detected, restart gnome shell `Alt` + `F2`, type `r` then press `enter`.

To install directly from a checkout while developing, copy the repository contents to `~/.local/share/gnome-shell/extensions/github.notifications@ihiroky.dev/` and then enable the extension with `gnome-extensions`.
