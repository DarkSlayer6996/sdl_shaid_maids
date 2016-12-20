FROM mhart/alpine-node:6.9.2

# Install bash
RUN apk add --update bash && rm -rf /var/cache/apk/*

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install

# Bundle app source
COPY . /usr/src/app/

RUN chmod +x scripts/wait-for-it.sh

EXPOSE 3001

CMD ["node", "index.js"]