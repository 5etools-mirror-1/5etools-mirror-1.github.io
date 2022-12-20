FROM alpine

RUN apk update && apk add lighttpd rsync

COPY lighttpd.conf mime-types.conf /etc/lighttpd/

CMD [ "lighttpd", "-D", "-f", "/etc/lighttpd/lighttpd.conf" ]
EXPOSE 80

COPY . /var/www/localhost/htdocs/
