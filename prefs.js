import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.github.notifications';

function bindSetting(settings, key, widget, property) {
    settings.bind(key, widget, property, Gio.SettingsBindFlags.DEFAULT);
}

function addEntryRow(group, settings, title, key, options = {}) {
    const row = new Adw.ActionRow({
        title,
        subtitle: options.subtitle ?? '',
    });
    const entry = options.password
        ? new Gtk.PasswordEntry({hexpand: true, show_peek_icon: true})
        : new Gtk.Entry({hexpand: true});

    bindSetting(settings, key, entry, 'text');
    row.add_suffix(entry);
    row.activatable_widget = entry;
    group.add(row);
}

function addSwitchRow(group, settings, title, key) {
    const row = new Adw.ActionRow({title});
    const switchWidget = new Gtk.Switch({valign: Gtk.Align.CENTER});

    bindSetting(settings, key, switchWidget, 'active');
    row.add_suffix(switchWidget);
    row.activatable_widget = switchWidget;
    group.add(row);
}

function addSpinRow(group, settings, title, key, min, max, step) {
    const row = new Adw.ActionRow({title});
    const spinButton = Gtk.SpinButton.new_with_range(min, max, step);

    spinButton.set_numeric(true);
    bindSetting(settings, key, spinButton, 'value');
    row.add_suffix(spinButton);
    row.activatable_widget = spinButton;
    group.add(row);
}

export default class GithubNotificationsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings(SETTINGS_SCHEMA);
        const page = new Adw.PreferencesPage();
        const githubGroup = new Adw.PreferencesGroup({
            title: 'GitHub',
            description: 'Configure the GitHub account used for notifications.',
        });

        addEntryRow(githubGroup, settings, 'GitHub Hostname', 'domain', {
            subtitle: 'Use github.com unless you use GitHub Enterprise.',
        });
        addEntryRow(githubGroup, settings, 'GitHub Token', 'token', {
            password: true,
            subtitle: 'A token with permission to read notifications.',
        });
        addEntryRow(githubGroup, settings, 'GitHub Handle', 'handle', {
            subtitle: 'Kept for compatibility with older settings.',
        });

        const behaviorGroup = new Adw.PreferencesGroup({title: 'Behavior'});
        addSwitchRow(behaviorGroup, settings, 'Show notification alerts', 'show-alert');
        addSpinRow(
            behaviorGroup,
            settings,
            'Refresh interval (seconds)',
            'refresh-interval',
            60,
            86400,
            1);
        addSwitchRow(
            behaviorGroup,
            settings,
            'Only show participating notifications',
            'show-participating-only');
        addSwitchRow(behaviorGroup, settings, 'Hide notification count', 'hide-notification-count');
        addSwitchRow(behaviorGroup, settings, 'Hide widget when there are no notifications', 'hide-widget');

        page.add(githubGroup);
        page.add(behaviorGroup);
        window.add(page);
    }
}
