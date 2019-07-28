const fs = require('fs');
const util = require('util');
const compression = require('compression');
const diff = require('diff');
const express = require('express');
const { applyDelta, minimizeDelta } = require('./deltaUtil');

const BASE_VERSION_HEADER = 'x-differential-base-version';
const DELTA_CONTENT_TYPE = 'application/delta+json';
const PORT = 80;

const readFile = util.promisify(fs.readFile);

const app = express();
app.use(compression());
app.use(express.static('./static'));

app.get('/:package/:version/:file', asyncRoute(handleRequest));

app.listen(PORT, () => console.log('Listening on port', PORT));

async function handleRequest(request, response) {
  const { file } = request.params;
  const content = await readPackageFile(request.params);
  if (content === undefined) {
    response.sendStatus(404);
    return;
  }

  response.set('Cache-Control', 'public, max-age=31536000');
  response.vary('Accept');

  if (request.accepts([DELTA_CONTENT_TYPE, '*/*']) === DELTA_CONTENT_TYPE) {
    return handleDifferentialRequest(request, response, content);
  }

  response.type(file.substring(file.lastIndexOf('.')));
  response.send(content);
}

async function handleDifferentialRequest(request, response, fullContent) {
  // In future could support multiple, and choose the closest for minimal delta
  const baseVersion = request.get(BASE_VERSION_HEADER);

  if (baseVersion === undefined) {
    response.status(400).send('No base version specified');
    return;
  }

  const baseContent = await readPackageFile({ ...request.params, version: baseVersion });
  if (baseContent === undefined) {
    response.status(417).send('Specified base version not known');  // expectation failed
    return;
  }

  const delta = createDelta(baseContent, fullContent);

  response.set(BASE_VERSION_HEADER, baseVersion);
  response.type(DELTA_CONTENT_TYPE);
  response.vary(BASE_VERSION_HEADER);
  response.send(delta);
}

function createDelta(base, other) {
  const rawDelta = diff.diffChars(base, other);
  const minimalDelta = minimizeDelta(rawDelta);

  if (applyDelta(minimalDelta, base) !== other) {
    throw new Error('Delta failed verification');
  }

  return minimalDelta;
}

function readPackageFile({ package, version, file }) {
  // Danger: path traversal
  return readOptionalFile(`./resources/${package}/${version}/${file}`, 'utf8');
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
