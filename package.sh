#!/bin/sh
set -eu

uuid='github.notifications@alexandre.dufournet.gmail.com'
schema='org.gnome.shell.extensions.github.notifications.gschema.xml'
staging_dir=$(mktemp -d)
trap 'rm -rf "$staging_dir"' EXIT

cp extension.js prefs.js metadata.json github.svg stylesheet.css "$staging_dir/"
mkdir "$staging_dir/schemas"
cp "schemas/$schema" "$staging_dir/schemas/"

gnome-extensions pack \
    --force \
    --out-dir=. \
    --extra-source="$staging_dir/github.svg" \
    --schema="$staging_dir/schemas/$schema" \
    "$staging_dir"

packed_file="$uuid.shell-extension.zip"
if [ -f "$packed_file" ]; then
    mv -f "$packed_file" gnome-notifications.zip
fi
