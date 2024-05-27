FROM node:22-alpine

ENV ESSENTIAL_PACKAGES="" \
    UTILITY_PACKAGES="mlocate vim" \
    PATH="${PATH}:/home/node_modules"

RUN apk update && \
    apk --no-cache --progress add $ESSENTIAL_PACKAGES $UTILITY_PACKAGES


ADD ./app/package.json /home
RUN cd /home && yarn -g && updatedb

WORKDIR /home/app

