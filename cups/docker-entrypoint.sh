#!/bin/sh
set -e
mkdir -p /run/cups
# /etc/cups is a persistent volume (keeps printers.conf/ppd across restarts),
# but that means a stale cupsd.conf from an older image would otherwise stick
# around forever - always refresh it from the image on startup.
cp /etc/cups-defaults/cupsd.conf /etc/cups/cupsd.conf
exec /usr/sbin/cupsd -f
