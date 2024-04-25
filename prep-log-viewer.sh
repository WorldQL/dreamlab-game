mkdir -p ./public/log-viewer
# clear out anything already in there
rm -rf ./public/log-viewer/assets
rm -rf ./public/log-viewer/index.html

# build and copy in the log viewer
cd ../dreamlab-game-log-viewer
npm i && npm run build
cp -r dist/assets ../dreamlab-game/public/log-viewer/assets
cp dist/index.html ../dreamlab-game/public/log-viewer/index.html
