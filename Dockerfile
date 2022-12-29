FROM alpine

RUN apk update && apk add lighttpd rsync

COPY docker/lighttpd.conf docker/mime-types.conf /etc/lighttpd/

ENTRYPOINT [ "lighttpd" ]
CMD [ "-D", "-f", "/etc/lighttpd/lighttpd.conf" ]
EXPOSE 80

COPY . /var/www/localhost/htdocs/
