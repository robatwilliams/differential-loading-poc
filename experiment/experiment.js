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
  const compressedChanges = compressChanges(changes);
  const updated = applyPatch(compressedChanges, oldContent);

  if (updated !== newContent) {
    throw new Error('Patching old did not yield new');
  }

  writeFile('./experiment/out/changes.json', JSON.stringify(compressedChanges, undefined, 2));
  writeFile('./experiment/out/changes.min.json', JSON.stringify(compressedChanges));
})();

function compressChanges(changes) {
  return changes.map(change => {
    if (change.added) {
      return change;
    } else {
      const { value, ...keep } = change;
      return keep;
    }
  });
}

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
