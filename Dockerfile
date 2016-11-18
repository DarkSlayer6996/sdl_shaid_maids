FROM mhart/alpine-node:6.9.1

RUN apk add --update bash && rm -rf /var/cache/apk/*

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package.json /usr/src/app/
RUN npm install

COPY . /usr/src/app/

RUN chmod +x scripts/wait-for-it.sh

EXPOSE 10101
EXPOSE 9042

CMD ["node", "index.js"]