const fs = require('fs');
const util = require('util');
const Diff = require('diff');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

(async () => {
  const [oldContent, newContent] = await Promise.all([
    readFile('./resources/react-dom/16.8.0/react-dom.production.min.js', 'utf8'),
    readFile('./resources/react-dom/16.8.1/react-dom.production.min.js', 'utf8'),
  ]);

  const changes = Diff.diffChars(oldContent, newContent);
  const updated = applyPatch(changes, oldContent);

  if (updated !== newContent) {
    throw new Error('Patching old did not yield new');
  }

  writeFile('./out/changes.json', JSON.stringify(changes, undefined, 2));
  writeFile('./out/changes.min.json', JSON.stringify(changes));
})();


//////////// From https://github.com/kpdecker/jsdiff/issues/95#issuecomment-218429097

function applyPatch(delta, str) {
  var result = str;
  var pos = 0;
  for (var i = 0; i < delta.length; i++) {
    if (delta[i].added) {
      result = insertAt(result, pos, delta[i].value);
      pos += delta[i].count;
    }
    else if (delta[i].removed) {
      result = removeAt(result, pos, delta[i].count);
    } else {
      pos += delta[i].count;
    }
  }
  return result;
}
function insertAt(str, index, add) {
  return [str.slice(0, index), add, str.slice(index)].join('');
}

function removeAt(str, index, count) {
  return str.slice(0, index) + str.slice(index + count);
}
