import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.github.notifications';
const USER_AGENT = 'gnome-github-notifications';

function logError(message, exception = null) {
    if (exception)
        console.error(`[GitHub Notifications] ${message}: ${exception.message}`);
    else
        console.error(`[GitHub Notifications] ${message}`);
}

class GithubNotifications {
    constructor(extension) {
        this.extension = extension;
        this.settings = extension.getSettings(SETTINGS_SCHEMA);

        this.domain = 'github.com';
        this.token = '';
        this.hideWidget = false;
        this.hideCount = false;
        this.refreshInterval = 60;
        this.githubInterval = 60;
        this.showAlertNotification = false;
        this.showParticipatingOnly = false;

        this.notifications = [];
        this.lastModified = null;
        this.retryAttempts = 0;
        this.retryIntervals = [60, 120, 240, 480, 960, 1920, 3600];

        this.timeout = null;
        this.httpSession = null;
        this.cancellable = null;
        this.httpGeneration = 0;
        this.settingsChangedId = 0;
        this.indicator = null;
        this.label = null;
        this.stylesheet = null;
        this.enabled = false;
    }

    start() {
        this.enabled = true;
        this.reloadSettings();
        this.loadStylesheet();
        this.initUI();
        this.initHttp();

        this.settingsChangedId = this.settings.connect('changed', () => {
            this.reloadSettings();
            this.initHttp();
            this.stopLoop();
            this.planFetch(5, false);
        });

        this.fetchNotifications();
    }

    stop() {
        this.enabled = false;
        this.stopLoop();

        if (this.settingsChangedId) {
            this.settings.disconnect(this.settingsChangedId);
            this.settingsChangedId = 0;
        }

        this.stopHttp();

        if (this.indicator) {
            this.indicator.destroy();
            this.indicator = null;
        }

        this.unloadStylesheet();
    }

    reloadSettings() {
        this.domain = this.settings.get_string('domain').trim()
            .replace(/^https?:\/\//, '')
            .replace(/\/.*$/, '') || 'github.com';
        this.token = this.settings.get_string('token').trim();
        this.hideWidget = this.settings.get_boolean('hide-widget');
        this.hideCount = this.settings.get_boolean('hide-notification-count');
        this.refreshInterval = this.settings.get_int('refresh-interval');
        this.showAlertNotification = this.settings.get_boolean('show-alert');
        this.showParticipatingOnly = this.settings.get_boolean('show-participating-only');
        this.checkVisibility();
    }

    loadStylesheet() {
        try {
            this.stylesheet = this.extension.dir.resolve_relative_path('stylesheet.css');
            const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
            theme.load_stylesheet(this.stylesheet);
        } catch (e) {
            logError('Could not load stylesheet', e);
            this.stylesheet = null;
        }
    }

    unloadStylesheet() {
        if (!this.stylesheet)
            return;

        try {
            const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
            theme.unload_stylesheet(this.stylesheet);
        } catch (e) {
            logError('Could not unload stylesheet', e);
        }

        this.stylesheet = null;
    }

    initUI() {
        this.indicator = new PanelMenu.Button(0.0, this.extension.metadata.name, false);

        const box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
        const iconFile = this.extension.dir.resolve_relative_path('github.svg');
        const icon = new St.Icon({
            gicon: new Gio.FileIcon({file: iconFile}),
            style_class: 'system-status-icon',
        });

        this.label = new St.Label({
            text: '0',
            style_class: 'system-status-icon notifications-length',
            y_align: Clutter.ActorAlign.CENTER,
            y_expand: true,
        });

        box.add_child(icon);
        box.add_child(this.label);
        this.indicator.add_child(box);

        this.indicator.menu.addAction(
            'Open GitHub Notifications',
            () => this.showBrowserUri());
        this.indicator.menu.addAction(
            'Preferences',
            () => this.extension.openPreferences());

        Main.panel.addToStatusArea(this.extension.uuid, this.indicator);
        this.checkVisibility();
    }

    checkVisibility() {
        if (this.indicator)
            this.indicator.visible = !this.hideWidget || this.notifications.length !== 0;

        if (this.label)
            this.label.visible = !this.hideCount;
    }

    showBrowserUri() {
        const path = this.showParticipatingOnly
            ? '/notifications/participating'
            : '/notifications';
        const url = `https://${this.domain}${path}`;

        try {
            Gio.AppInfo.launch_default_for_uri(url, null);
        } catch (e) {
            logError(`Could not open ${url}`, e);
        }
    }

    initHttp() {
        this.stopHttp();
        this.httpGeneration++;
        this.lastModified = null;
        this.githubInterval = 60;
        this.httpSession = new Soup.Session({
            user_agent: USER_AGENT,
            timeout: 30,
        });
        this.cancellable = new Gio.Cancellable();
    }

    stopHttp() {
        this.httpGeneration++;

        if (this.cancellable) {
            this.cancellable.cancel();
            this.cancellable = null;
        }

        if (this.httpSession) {
            this.httpSession.abort();
            this.httpSession = null;
        }
    }

    interval() {
        const retryInterval = this.retryAttempts > 0
            ? this.retryIntervals[this.retryAttempts - 1] ?? 3600
            : 0;
        const githubInterval = Number.parseInt(this.githubInterval, 10) || 60;

        return Math.max(this.refreshInterval, githubInterval, retryInterval);
    }

    planFetch(delay, retry) {
        this.retryAttempts = retry ? this.retryAttempts + 1 : 0;
        this.stopLoop();

        this.timeout = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            Math.max(1, Math.trunc(delay)),
            () => {
                this.timeout = null;
                if (this.enabled)
                    this.fetchNotifications();
                return GLib.SOURCE_REMOVE;
            });
    }

    stopLoop() {
        if (this.timeout) {
            GLib.Source.remove(this.timeout);
            this.timeout = null;
        }
    }

    fetchNotifications() {
        if (!this.enabled || !this.httpSession || !this.cancellable)
            return;

        const query = this.showParticipatingOnly ? '?participating=1' : '';
        const url = `https://api.${this.domain}/notifications${query}`;
        const message = Soup.Message.new('GET', url);
        const requestHeaders = message.get_request_headers();

        requestHeaders.append('Accept', 'application/vnd.github+json');
        requestHeaders.append('X-GitHub-Api-Version', '2022-11-28');
        if (this.token)
            requestHeaders.append('Authorization', `Bearer ${this.token}`);
        if (this.lastModified)
            requestHeaders.append('If-Modified-Since', this.lastModified);

        const session = this.httpSession;
        const cancellable = this.cancellable;
        const generation = this.httpGeneration;

        session.send_and_read_async(
            message,
            GLib.PRIORITY_DEFAULT,
            cancellable,
            (source, result) => {
                if (!this.enabled || generation !== this.httpGeneration)
                    return;

                try {
                    const bytes = source.send_and_read_finish(result);
                    this.handleResponse(message, bytes);
                } catch (e) {
                    if (!this.enabled || generation !== this.httpGeneration)
                        return;

                    logError('HTTP request failed', e);
                    this.setErrorState();
                    this.planFetch(this.interval(), true);
                }
            });
    }

    handleResponse(message, bytes) {
        const status = message.get_status();
        const responseHeaders = message.get_response_headers();
        const lastModified = responseHeaders.get_one('Last-Modified');
        const pollInterval = responseHeaders.get_one('X-Poll-Interval');

        if (lastModified)
            this.lastModified = lastModified;
        if (pollInterval)
            this.githubInterval = pollInterval;

        if (status === Soup.Status.OK || status === Soup.Status.NOT_MODIFIED) {
            this.planFetch(this.interval(), false);

            if (status === Soup.Status.OK) {
                const body = new TextDecoder().decode(bytes.get_data());
                const data = JSON.parse(body);
                if (!Array.isArray(data))
                    throw new Error('GitHub returned an unexpected response');
                this.updateNotifications(data);
            }
            return;
        }

        if (status === Soup.Status.UNAUTHORIZED) {
            logError('GitHub rejected the token');
            this.setErrorState();
            this.planFetch(this.interval(), true);
            return;
        }

        logError(`GitHub returned HTTP ${status}`);
        this.setErrorState();
        this.planFetch(this.interval(), true);
    }

    setErrorState() {
        if (this.label)
            this.label.text = '!';
    }

    updateNotifications(data) {
        const previousCount = this.notifications.length;
        this.notifications = data;

        if (this.label)
            this.label.text = String(data.length);
        this.checkVisibility();

        if (data.length > previousCount && this.showAlertNotification)
            Main.notify('GitHub Notifications', `You have ${data.length} notifications`);
    }
}

export default class GithubNotificationsExtension extends Extension {
    enable() {
        this.githubNotifications = new GithubNotifications(this);
        this.githubNotifications.start();
    }

    disable() {
        this.githubNotifications?.stop();
        this.githubNotifications = null;
    }
}
