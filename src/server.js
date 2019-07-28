const fs = require('fs');
const util = require('util');
const compression = require('compression');
const express = require('express');

const PORT = 80;

const readFile = util.promisify(fs.readFile);

const app = express();
app.use(compression());

app.get('/:package/:version/:file', asyncRoute(handleRequest));

app.listen(PORT, () => console.log('Listening on port', PORT));

async function handleRequest(request, response) {
  const { package, version, file } = request.params;

  // Danger: path traversal
  const content = await readOptionalFile(`./resources/${package}/${version}/${file}`, 'utf8');
  if (content === undefined) {
    response.sendStatus(404);
    return;
  }

  response.type(file.substring(file.lastIndexOf('.')));
  response.set('Cache-Control', 'public, max-age=31536000');
  response.send(content);
}

async function readOptionalFile(...args) {
  try {
    return await readFile(...args);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
}

function asyncRoute(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response)).catch(next);
}
