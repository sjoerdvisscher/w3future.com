export function Key() {}
export var keys = [];

for (var row = -9; row <= 9; row++) {
  for (var col = -19; col <= 19; col++) {
    var x = col * 7 + row * 2;
    var y = - row * 7 - col * 2;
    var side = col * 2 + row;
    var board = Math.floor((side + 29) / 12);
    var section = board + 1;
    var ix = col + Math.round(-row * 5.5) + 63 - 18 * board;
    if (ix < 7) ix += 1;
    if (ix < 2) ix += 4;
    if (ix > 48) ix -= 1;
    if (ix > 53) ix -= 4;
    if (y < -28 || y > 27 || board < 0 || board > 4) continue;
    var key = new Key();
    Object.assign(key, { row, col, x, y, side, board, section, ix });
    keys.push(key);
  }
}

var lumatoneCallback = null;
export function setLumatoneCallback(f) {
  lumatoneCallback = f;
}

var currentTestingOutputPort = null;
navigator.requestMIDIAccess && navigator.requestMIDIAccess({ sysex: true }).then(function(midiAccess) {
  for (let input of midiAccess.inputs.values()) {
    input.onmidimessage = midiIn;
  }
  var outputs = midiAccess.outputs.values();
  window.outputs = midiAccess.outputs;
  let findLumatone = function() {
    if (lumaOut) return;
    var outputRes = outputs.next();
    if (outputRes.done) {
      outputs = null;
      return;
    }
    currentTestingOutputPort = outputRes.value;
    if (currentTestingOutputPort) {
      console.log("Trying " + currentTestingOutputPort.name)
      currentTestingOutputPort.send([
        0xf0, // sysex
        0x00, 0x21, 0x50, // lumatone device id
        0, // server
        0x23, // command: get serial identity
        0x7f, // echo
        0,
        0,
        0, 
        0xf7 // end sysex
      ]);      
    }
    setTimeout(findLumatone, 100);
  }
  findLumatone();
  midiAccess.onstatechange = function(evt) {
    if (evt.port)
      evt.port.onmidimessage = midiIn;
    if (!outputs) {
      outputs = midiAccess.outputs.values();
      findLumatone();
    }
  }
}, function(err) { 
  console.error(JSON.stringify(err)) 
});

function midiIn(evt) {
  switch (evt.data[0] & 0xF0) {
    case 0xf0: // Sysex
      if (evt.data[1] == 0x00 && evt.data[2] == 0x21 && evt.data[3] == 0x50) { // is lumatone
        console.log([...evt.data].map(v => v.toString(16)), evt.target.name);
        if (evt.data[4] == 0 && evt.data[5] == 0x23 && evt.data[6] == 1) { // lumatone serial identity response
          lumaOut = currentTestingOutputPort;
          console.log("Lumatone detected on port " + lumaOut.name);
          if (lumatoneCallback) lumatoneCallback(lumaOut);
          lumaSend();
        }
        if (evt.data[5] < 2 && evt.data[6] == 1) {
          // console.log("Lumatone ready");
          lumaSend();
          break;
        }
      }
  }
}

var lumaBuffer = [];
var lumaOut = null;
function lumaSend() {
  var msg = lumaBuffer.shift();
  if (msg) {
    // console.log("Sending", msg);
    if (lumaOut)
      lumaOut.send(msg);
  } else setTimeout(lumaSend, 10);
}

export function setNote(boardIx, keyIx, chan, note) {
  lumaBuffer.push([
    0xf0, // sysex
    0x00, 0x21, 0x50, // lumatone device id
    boardIx + 1, // board index
    0, // command
    keyIx, // key index
    note,
    chan - 1,
    1, // key type = noteonnoteoff
    0xf7 // end sysex
  ]);
}

export function setColor(boardIx, keyIx, hexColor) {
  lumaBuffer.push([
    0xf0, // sysex
    0x00, 0x21, 0x50, // lumatone device id
    boardIx + 1, // board index
    1, // command
    keyIx, // key index
    ...hexColor,
    0xf7 // end sysex
  ]);
}

var tmpDiv = window.document.createElement("div");
window.document.body.appendChild(tmpDiv);
export function toHexColor(h, s, l) {
  tmpDiv.style.backgroundColor = "hsl(" + h + ", " + s + "%, " + l + "%)";
  var rgb = rgba2hex(window.getComputedStyle(tmpDiv).backgroundColor);
  return rgb.split('').map(c => parseInt(c, 16));
}

function rgba2hex(rgba) { return rgba.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.{0,1}\d*))?\)$/).slice(1).map((n, i) => (i === 3 ? 'NaN' : parseFloat(n)).toString(16).padStart(2, '0').replace('NaN', '')).join('') }
