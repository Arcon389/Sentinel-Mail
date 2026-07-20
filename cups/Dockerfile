FROM debian:bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    cups \
    cups-client \
    avahi-daemon \
    printer-driver-all \
    && rm -rf /var/lib/apt/lists/*

COPY cupsd.conf /etc/cups-defaults/cupsd.conf
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 631

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
