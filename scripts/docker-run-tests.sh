#!/usr/bin/env bash

docker run -d --name maids -e "DB_PASSWORD=$CASSANDRA_DB_PASSWORD" smartdevicelink/shaid-maids:$CIRCLE_TAG
sudo lxc-attach -n "$(docker inspect --format "{{.Id}}" maids)" -- bash -c "cd /usr/src/app/ && npm run-script test-circleci"