#!/usr/bin/env bash

cd /Users/ssmereka/Documents/Livio/sdl_shaid_maids
docker stop maids
docker rm maids

docker build --rm=false -t smartdevicelink/shaid-maids:123456789 .

docker run -d --name maids -e "DB_PASSWORD=tRvpe7WVtcHMCoU4hpDxayynKyt" smartdevicelink/shaid-maids:123456789
docker exec -i -t maids /bin/bash

# Then enter command
# npm run-script test-circleci