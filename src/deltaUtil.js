// Duplicated in serviceWorker.js
function applyDelta(delta, str) {
  // From https://github.com/kpdecker/jsdiff/issues/95#issuecomment-218429097

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

function minimizeDelta(delta) {
  // No need to keep values for unchanged/removed blocks
  return delta.map(change => {
    if (change.added) {
      return change;
    } else {
      const { value, ...keep } = change;
      return keep;
    }
  });
}

module.exports = {
  applyDelta,
  minimizeDelta,
};
