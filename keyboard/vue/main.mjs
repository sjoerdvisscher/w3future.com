import { createApp, ref, watch, computed, reactive } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { playSound } from "./note.mjs";
import { calcGen, MOSsteps, fromRatio } from "./utils.mjs";
import { Keyboard } from "./keyboard.mjs";
import { Tuning } from "./tuning.mjs";

var output = null;
var transposeMap = {};
var noteOffs = {};
var channel = 1;
var channels = [];
var sustained = null;
var lumaOut = null;
var arpeggio = false;
var tempo = 480;
var isLumatone = location.hash.indexOf('lumatone') > -1;

if (location.hash.indexOf('launchpad') > -1)
  location = "/keyboard/launchpad#launchpad"

function noteOn(note, obj, ix, volume, dt) {
  if (!volume) return noteOff(ix);
  if (output) {
    if (octave == 12) {
      channel = 0;
      channels[0] = null;
    }    
    var note12 = note / octave * 12;
    var note12rnd = Math.round(note12);
    var note12frac = Math.round((note12 - note12rnd) * 0x2000 / 12) + 0x2000;

    // channel = obj.midiChan - 1;
    // note12frac = 0;

    var toSend = channels[channel] ? [
      0x80 + channel,
      channels[channel],
      0
    ] : [];
    if (noteOffs[ix])
      toSend = toSend.concat(noteOffs[ix].data);
    else
      noteOffs[ix] = { count: 0 }
    if (sustained && sustained[ix]) {
      toSend = toSend.concat(sustained[ix]);
      delete sustained[ix];
    }
    toSend = toSend.concat([
      0xe0 + channel, 
      note12frac & 0x7f,
      (note12frac >> 7) & 0x7f
    ]);
    var midiNote = channels[channel] = note12rnd + 72;
    
    // var midiNote = obj.midiNote;
    
    toSend = toSend.concat([
      0x90 + channel,
      midiNote,
      25 + volume / 2
    ]);
    noteOffs[ix].data = [
      0x80 + channel,
      midiNote,
      0
    ];
    noteOffs[ix].count++;
    // console.log("Sending channel: ", channel, "Sending pitch bend: ", note12frac, "Diff: ", note12 - note12rnd);
    if (dt)
      setTimeout(() => output.send(toSend), dt*1000);
    else 
      output.send(toSend);
    channel++;
    if (channel == 16) channel = 1;
  } else {
    var freq = 523 * 
      Math.pow(2, note / octave);
    // setTimeout(() => playSound(freq, volume / 127), dt*1000);
    playSound(freq, volume / 127, dt);
  }
}
function noteOff(ix) {
  if (!output) return;
  var noteOff = noteOffs[ix];
  if (noteOff) {
    noteOff.count--;
    if (!noteOff.count) {
      if (sustained)
        sustained[ix] = noteOff.data;
      else
        output.send(noteOff.data);
      delete noteOffs[ix];
    }
  }
}
function noteOffAll(delta) {
  var noteOffsCopy = noteOffs;
  noteOffs = {};
  setTimeout(function() {
    for (var ix in noteOffsCopy) {
      if (!noteOffs[ix])
        output.send(noteOffsCopy[ix].data)
    }
  }, delta || 0)
}

var extras = [
  [{x:0, y:0}], 
  [{x:0, y:0}, {x:1, y:0}], 
  [{x:0, y:0}, {x:1, y:0}, {x:2, y:0}], 
  [{x:0, y:0}, {x:1, y:0}, {x:2, y:0}, {x:1, y: -3}], 
  [{x:0, y:0}, {x:-4, y:-1}, {x:-2, y:-1}, {x:1, y:0}, {x:2, y:0}, {x:4, y:1}, {x:4, y:0}, {x:5, y:1}]
];
var arpeggios = [[[0], [1], [2], [0], [1], [2], [0], [1]], [[0, 2], [3], [1, 2], [3]], [[0], [1], [2], [3], [4], [5], [6], [7]]];
var arpeggioRowOffset = 0;
var currentExtra = 0;
var mode = 'play';
var config = JSON.parse(localStorage.getItem('config/v1')) || {};
// (config.extras || []).forEach((extra, i) => extras[i] = extra);
currentExtra = config.currentExtra || currentExtra;
currentExtra = 0;
for (var name in config.transposeMap)
  transposeMap[name] = Math.round(config.transposeMap[name] * octave);
arpeggios = config.arpeggios || arpeggios;
tempo = config.tempo || tempo;
var lumaNotes = {};
var lumaIx = {};
var lumaBuffer = [];
function lumaSetNote(boardIx, keyIx, chan, note) {
  lumaNotes[[boardIx, keyIx]] = {chan, note};
  lumaIx[[chan, note]] = {boardIx, keyIx};
  keysByLuma[[boardIx, keyIx]].box.midiChan = chan;
  keysByLuma[[boardIx, keyIx]].box.midiNote = note;
  if (chan == 8) {
    keysByLuma[[boardIx, keyIx]].box.style.color = "transparent";
  }
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
  ])
}
var lumaColors = {};
var unLumaColors = {};
function unLumaColor(hexColor) {
  var rgbhex = hexColor.map(n => n.toString(16)).join('');
  if (unLumaColors[rgbhex]) return unLumaColors[rgbhex];
  var r = hexColor[0]*16 + hexColor[1];
  var g = hexColor[2]*16 + hexColor[3];
  var b = hexColor[4]*16 + hexColor[5];
  var max = Math.max(r,g,b);
  var min = Math.min(r,g,b);
  var l = 255 - (255 - max)*0.7;
  r = Math.round(l*(1 - (1 - r/max)/3));
  g = Math.round(l*(1 - (1 - g/max)/3));
  b = Math.round(l*(1 - (1 - b/max)/3));
  // "hsl(" + h + ", " + (3*s) + "%, " + (100 - (100 - l)*1.3) + "%)"
  return `rgb(${r}, ${g}, ${b})`
}
function lumaColorMsg(boardIx, keyIx, hexColor) {
  keysByLuma[[boardIx, keyIx]].box.style.backgroundColor = unLumaColor(hexColor);
  if (lumaDown[[boardIx, keyIx]]) {
    // hack, change color a tiny bit so it will be redrawn on keyup
    lumaColors[[boardIx, keyIx]] = hexColor.concat();
    lumaColors[[boardIx, keyIx]][5] = hexColor[5] ^ 1;
  }
  return [
    0xf0, // sysex
    0x00, 0x21, 0x50, // lumatone device id
    boardIx + 1, // board index
    1, // command
    keyIx // key index
    ].concat(hexColor).concat([
    0xf7 // end sysex
  ])
}
function lumaSetColor(boardIx, keyIx, hexColor) {
  lumaBuffer.push(lumaColorMsg(boardIx, keyIx, hexColor));
}
var lumaDown = {};
var recordT0;
function lumaNoteOn(channel, note, volume) {
  var ix = lumaIx[[channel, note]];
  if (ix) {
    if (!volume && lumaColors[[ix.boardIx, ix.keyIx]]) {
      var color = lumaColors[[ix.boardIx, ix.keyIx]];
      setTimeout(() => lumaSetColor(ix.boardIx, ix.keyIx, color), 20)
      // setTimeout(() => lumaSetColor(ix.boardIx, ix.keyIx, color), 200)
      delete lumaColors[[ix.boardIx, ix.keyIx]];
    }
    lumaDown[[ix.boardIx, ix.keyIx]] = volume > 0;

    if (channel == 8) {
      if (volume) lumaSpecial(note);
      return;
    }      
  }

  var key = keysByNote[[channel, note]];
  if (key) {
    var deltas = extras[currentExtra];
    if (mode == 'record') {
      if (volume) {
        if (!recordT0) recordT0 = performance.now();
        extras[currentExtra].push({ x: key.x, y: key.y, volume, dt: (performance.now() - recordT0) / 1000 });
      }
      deltas = [{x: 0, y: 0, volume}];
    }
    deltas.forEach((d) => { 
      var x = key.x + d.x;
      var y = key.y + d.y;
      var ix = [x, y]
      var dkey = keysByCoords[ix];
      if (dkey) {
        noteOn(dkey.box.note, dkey.box, ix, (d.volume/127 || 1) * volume, d.dt);
        dkey.box.style.border = volume ? "2px solid #A86D80" : "2px solid rgba(255, 255, 255, 0.7)";
      }
    })
  } else {
    if (volume)
      console.log({channel, note, keysByNote})
  }
}
const SPEC_ON = [15, 0, 12, 0, 4, 0];
const SPEC_OFF = [4, 0, 3, 0, 1, 0];
const SPEC_RED = [13, 0, 0, 0, 0, 0];
var old_extra;
function lumaSpecial(note) {
  switch (note) {
    case 0:
      mode = mode == 'play' ? 'config' : 'play';
      if (mode == 'config') {
        for (var i = 0; i < 7; i++) {
          lumaSetNote(0, i, 8, i);
          lumaSetColor(0, i, i == 0 || currentExtra == i - 2 ? SPEC_ON : SPEC_OFF);
        }
      }
      break;
    case 2: case 3: case 4: case 5: case 6:
      if (currentExtra == note - 2) {
        if (mode == 'config') {
          lumaSetColor(0, currentExtra + 2, SPEC_RED);
          mode = 'record';
          recordT0 = null;
          old_extra = extras[currentExtra];
          extras[currentExtra] = [];
        } else {
          lumaSetColor(0, currentExtra + 2, SPEC_ON);
          mode = 'config';
          if (!extras[currentExtra].length) {
            extras[currentExtra] = old_extra;
          }
        }
      } else {
        lumaSetColor(0, currentExtra + 2, SPEC_OFF);
        currentExtra = note - 2;
        lumaSetColor(0, currentExtra + 2, SPEC_ON);
      }
      break;
    default:
      console.log("luma special: ", note)
  }
}

navigator.requestMIDIAccess({ sysex: true }).then(function(midiAccess) {
  var inputs = midiAccess.inputs.values ?
      midiAccess.inputs.values() : midiAccess.inputs();
  var outputs = midiAccess.outputs.values ? 
      midiAccess.outputs.values() : midiAccess.outputs();
  onMIDIAccess(inputs, outputs);
}, function(err) { 
  onMIDIAccess([], []);
  console.error(JSON.stringify(err)) 
});

function onMIDIAccess(inputs, outputs) {

  function color(note, ix) {
    if (arpeggio.notesOn) {
      var n = arpeggio.notesOn.find(function(n) { return n.ix == ix; });
      if (n) return n.isMinor ? 0x2e : 0x2c;
    } 
    let name = majors[(note + 10*octave) % octave];
    var d = Math.abs(name.d) % (12 * 4);
    return d == 7 || d == 41 ? 0x1c : d == 17 || d == 31 ? 0xd : 0xc
  }
  function saveConfig() {
    const data = {
      extras: extras,
      currentExtra: currentExtra,
      transposeMap: {},
      arpeggios: arpeggios,
      tempo: tempo,
      outputName: output && output.name,
    };
    for (var name in transposeMap)
      data.transposeMap[name] = transposeMap[name] / octave;
    localStorage.setItem('config/v1', JSON.stringify(data));
  }
  function sustainPedalMsg(evt) {
    switch (evt.data[0] & 0xF0) {
      case 0xB0: // Control change
        if (evt.data[1] == 64) { // Sustain
          if (evt.data[2] == 0) {
            for (var ix in sustained)
              output.send(sustained[ix]);
            sustained = null;
          } else {
            sustained = {};
          }
        }
        break;
      default:
        //console.log(evt.data);
    }
  }
  function lumaMsg(evt) {
    switch (evt.data[0] & 0xF0) {
      case 0x90: // Note on
        var channel = (evt.data[0] & 0xF) + 1;
        var note = evt.data[1];
        var volume = evt.data[2];
        lumaNoteOn(channel, note, volume);
        break;
      case 0x80:
        var channel = (evt.data[0] & 0xF) + 1;
        var note = evt.data[1];
        lumaNoteOn(channel, note, 0);
        break;
      case 0xb0: // Control change
        sustainPedalMsg(evt);
        break;
      case 0xf0: // Sysex
        if (evt.data[5] < 2 && evt.data[6] == 1) {
          // console.log("Lumatone ready");
          lumaSend();
          break;
        }
        if (evt.data[5] < 2 && evt.data[6] == 2) {
          console.log("Lumatone busy");
          break;
        }
        if (evt.data[5] < 2 && evt.data[6] == 3) {
          console.log("Lumatone error");
          break;
        }
        if (evt.data[5] < 2 && evt.data[6] == 4) {
          console.log("Lumatone not in MIDI state");
          break;
        }
        if (evt.data[5] == 0x33) {
          // console.log("Luma Ping");
          break;
        }
      default:
        console.log(evt);
    }
  }
  function lumaSend() {
    var msg = lumaBuffer.shift();
    if (msg) {
      // console.log("Sending", msg);
      lumaOut.send(msg);
    } else setTimeout(lumaSend, 10);
  }
  var midiSelect = document.getElementById('midi-out');
  midiSelect.addEventListener('change', function() {
    output = midiSelect.options[midiSelect.selectedIndex].port;
    saveConfig();
    if (output)
      mpe(output);
  })
  for (var port of inputs) {
    detectPort(port);
  }
  function detectPort(port) {
    console.log("Detected: " + port.name);
    midiSelect.style.visibility = "visible";
    transposeMap[port.name] = 0;//transposeMap[port.name] || 0;
    if (port.name == "Lumatone") {
      port.onmidimessage = lumaMsg;
    } else if (port.name.indexOf("AXIS-49") > -1) {
      port.onmidimessage = function(evt) {
        start()
        // console.log("Received: ", evt);
        switch (evt.data[0] & 0xF0) {
          case 0x90: // Note on
            var data = []
            for (var i = 0; i < evt.data.length; i++)
              data[i] = evt.data[i];
            var ix = data[1];
            if (ix == 1) {
              transposeMap[port.name]++;
              return;
            }
            if (ix == 98) {
              transposeMap[port.name]--;
              return;
            }
            var col = Math.floor((ix - 1) / 7);
            var isMinor = col % 2 == 1;
            var col2 = col >> 1;
            var row = (ix - 1) % 7;
            if (!isMinor && col > 7)
              row++;
            var note = -whole * (1 + row) + col2 * fourth + isMinor * (major - whole) +
                Math.round(octave * (transposeMap[port.name] / 4 - 2));
            noteOn(note, {isMinor:isMinor}, ix, data[2])
            break;
          case 0x80: // Note off
            var ix = evt.data[1];
            noteOff(ix)
            break;
          default:
            //console.log(evt.data);
        }
      }
    } else {
      port.onmidimessage = sustainPedalMsg;
    }
  }
  function mpe(port) {
    // Turn on MPE mode on channel 1
    port.send([0xB0, 127, 15])
    // Send pitch bend range on channel 2 to 12
    port.send([0xB1, 101, 0, 0xB1, 100, 0, 0xB1, 6, 12])
  } 
  for (var port of outputs) {
    var option = document.createElement('option');
    option.text = port.name;
    option.port = port;
    midiSelect.appendChild(option);
    if (config.outputName == port.name) {
      output = port;
      mpe(output);
      midiSelect.selectedIndex = midiSelect.options.length - 1;
    }
    if (port.name == "Lumatone") {
      if (!isLumatone) {
        location.hash = "#lumatone";
        location.reload();
      }
      lumaOut = port;
      lumaBoards.forEach((board, boardIx) => {
        board.forEach(({note, chan}, keyIx) => {
          lumaSetNote(boardIx, keyIx, chan, note);
        })
      })
      var msgs = [];
      for (var keyIx = 0; keyIx < 56; keyIx++) {
        lumaBoards.forEach((board, boardIx) => {
          var {x,y,color} = board[keyIx] || {x:0,y:0,color:'000000'}
          var hexColor = color.split('').map(c => parseInt(c, 16));
          msgs.push({r:-x*x-y*y*2, msg: lumaColorMsg(boardIx, keyIx, hexColor)})
        })
      }
      msgs.sort((a,b) => a.r - b.r);
      msgs.forEach(({msg}) => lumaBuffer.push(msg));
      
      // Start sending
      lumaSend();
    }
  }


}

function number(s) {
  return isNaN(1*s) ? 0 : 1*s;
}
var args = location.search.match(/\?(\d+b?c?)(&(?<L>\d+)L(?<s>\d+)s)?(&(?<alt>alt(=(?<third>\d+))?))?(&gen=(?<gen>\d+))?/) || {1:'', groups:{}};
var otherFifth = args[1].indexOf('b') != -1;
var otherThird = args[1].indexOf('c') != -1;
var octave = parseInt(args[1]) || 12;
var ls = args.groups.L ? args.groups.L + 'L' + args.groups.s + 's' : '5L2s';
var fifth = args.groups.gen && ls == '5L2s' ? octave - args.groups.gen : fromRatio(octave, 3/2, otherFifth);
var major = 1*args.groups.third || (ls == '5L2s' ? fromRatio(octave, 5/4, otherThird) : 4 * fifth - 2 * octave);
var generator = 1*args.groups.gen;

var justDelta = Math.log(5/4)/Math.log(2) - major / octave;

var cd = gcd(octave, gcd(fifth, major));
if (cd != 1 && !args.groups.third)
{
  if (justDelta > 0) major++; else major--;
  // var changed = "major";
  var other = octave / cd;
  cd = gcd(octave, gcd(fifth, major));
  if (cd != 1)
  {
    major = fromRatio(octave, 5/4, otherThird);
    fifth--; // only for 30 and 102?
    // var changed = "fifth";
  }
  // alert("Shifted the " + 
  //       changed + 
  //       " interval to prevent the layout to be the same as " + 
  //       other);
}
var fourth = octave - fifth;
var whole = fifth - fourth;
var majorScale = [0, whole, major, fourth, fifth, major + fourth, major + fifth, octave];	
var minor = fifth - major;
var minorScale = [0, whole, minor, fourth, fifth, minor + fourth, minor + fifth, octave];
var sharp = 3 * whole - fourth;

var Lnum, snum, Lstep, sstep, ystep, Lsnum, ynum, steps;
if (args.groups.L) {
  Lnum = 1*args.groups.L;
  snum = 1*args.groups.s;
  steps = MOSsteps(octave, Lnum, snum, generator);
  if (!steps) {
    Lnum = 1*args.groups.s;
    snum = 1*args.groups.L;
    steps = MOSsteps(octave, Lnum, snum, generator);
    // if (steps) alert(`Impossible MOS for this EDO, switching L and s to ${Lnum}L${snum}s`)
  }
  if (!steps) {
    alert("Impossible MOS for this EDO, defaulting to 5L2s");
    args.groups.L = null;
  } else {
    Lstep = steps.Lstep;
    sstep = steps.sstep;
    ystep = Lnum >= snum ? Lstep : sstep;
    if (args.groups.third) {
      sstep += Lstep;
      Lstep = major - ystep;
      sstep -= Lstep; 
    }
    Lsnum = Math.min(Lnum, snum);
    ynum = Math.abs(Lnum - snum);
    if (!args.groups.alt) {
      if (snum >= Lnum)// && snum / Lnum < 2)
      {
        ystep = Lstep;
        Lstep = sstep;
        Lsnum = snum / 2;
        ynum = Lnum;
      }
      else if (Lnum > snum)// && Lnum / snum < 2)
      {
        ystep = sstep;
        sstep = Lstep;
        Lsnum = Lnum / 2;
        ynum = snum;
      }
    }
    else args.groups.alt = "alt";
  }
}
if (!args.groups.L) {
  Lnum = 5;
  snum = 2;
  Lsnum = 2;
  ynum = 3;
  Lstep = major - whole;
  sstep = fifth - 2*whole - Lstep;
  ystep = 2*fifth - octave;
  steps = MOSsteps(octave, Lnum, snum, calcGen(octave, ystep, Lstep + sstep - ystep, Lnum, snum).generator)
  if (ystep == sstep && Lstep != sstep) {
    Lnum = 2; snum = 5; ls = '2L5s';
    steps.Lstep = Lstep + sstep - ystep;
    steps.sstep = ystep;
    steps.genPer = calcGen(octave, Lstep + sstep - ystep, ystep, Lnum, snum);
  }
  args.groups.alt = "alt";
}
generator = steps.genPer.generator;

var rt = reactive({
  octave, steps
});
rt.fifth = computed(() => fromRatio(rt.octave, 3/2));
rt.fourth = computed(() => rt.octave - rt.fifth);
rt.whole = computed(() => rt.fifth - rt.fourth);
rt.major = computed(() => fromRatio(rt.octave, 5/4));
rt.minor = computed(() => rt.fifth - rt.major);
rt.ls = computed(() => rt.steps.mos);
rt.generator = computed(() => rt.steps.genPer.generator);
rt.Lsnum = computed(() => Math.min(rt.steps.Lnum, rt.steps.snum));
rt.ynum = computed(() => Math.abs(rt.steps.Lnum - rt.steps.snum));
rt.ystep = computed(() => rt.steps.Lnum >= rt.steps.snum ? rt.steps.Lstep : rt.steps.sstep);
watch(() => rt.octave, (octave) => {
  rt.steps = 
    MOSsteps(octave, rt.steps.Lnum, rt.steps.snum) || 
    MOSsteps(octave, rt.steps.snum, rt.steps.Lnum) ||
    MOSsteps(octave, 5, 2) || MOSsteps(octave, 2, 5)
})

function fix(args) {
  var res = {};
  for (var k in args)
    res[k] = args[k] ? '' + args[k] : undefined;
  return res;
}

var app = createApp({
  data() {
    return {
    }
  },
  provide() {
    return {
      rt,
      ag: fix(args.groups),
      isLumatone,
    }
  },
  components: {
    Keyboard,
    Tuning
  }
})
app.mount("#app");



var circleNamesMaj = ["C", "F", "B", "E", "A", "D", "G", "C"]; 
var circleNamesMin = ["e", "b", "f", "c", "g", "d", "a", "e"]; 
var majors = [], minors = [];
if (Lstep == sstep) {
  minors = majors;
  circleNamesMin = ["E", "B", "F", "C", "G", "D", "A", "E"];
}
if (Lstep < sstep) {
  circleNamesMaj = ["e", "b", "f", "c", "g", "d", "a", "e"]; 
  circleNamesMin = ["C", "F", "B", "E", "A", "D", "G", "C"]; 
  if (Lstep == sstep) {
    circleNamesMaj = ["E", "B", "D", "C", "G", "D", "A", "E"]; 
  }
}
function setName(arr, ibase, namebase, mod, num, den, udbase) 
{
  for (var j = -Math.floor(comDen / 2); j < comDen / 2; j++) {
    var i = (ibase + j + octave * octave) % octave;
    var ud = (udbase || 0) + j;
    var name = sharp <= 0 ? updown(sharp * mod + ud) + namebase : updown(ud) + namebase + sign(mod);
    if (!arr[i] || ((arr[i].mod && arr[i].ud) && !mod && !ud) || (sharp <= 0 && Math.abs(sharp*arr[i].mod + arr[i].ud) > Math.abs(sharp*mod + ud)))
      arr[i] = { name: name, num: num, den: den, mod: mod, ud: ud};
  }
}
function rep(c, n) {
  if (n == 0)
    return '';
  if (n == 1)
    return c;
  if (n == 2)
    return c + c;
  return c + "<sup>" + n + "</sup>";  
}
function sign(c)
{
  var s = "<b>♯</b>";
  if (c == 2) {
    return "<u>✕</u>";
  }
  else if (c < 0) 
  {
    s = "<i>♭</i>";
    c = -c;
  }
  return rep(s, c);
}
function updown(n)
{
  return n ? "<u>" + rep(n > 0 ? "∧" : "∨", Math.abs(n)) + "</u>" : "";
}
var comma = ls == '5L2s' ? major >= minor ? 4 * fifth - major : 3 * fourth - major : sharp == 1 ? 0 : 1;
var comma1 = comma % octave;
if (comma1 > octave / 2) comma1 -= octave;
var commaSign    = -comma1;
var negCommaSign = comma1;
var niceUD = (sharp <= 0 || Math.abs(comma1) < sharp);
var comDen = gcd(octave, fifth);
var octaveloop = octave / comDen;
if (Lstep == sstep && octaveloop == octave) octaveloop /= 2;
if (octaveloop > 55)
  octaveloop = 1;
function octDist(p) { return Math.min(p % octave, octave - (p % octave)) }
for (var i = 0; i < octave; i++)
{
  var ud = octave == 4296 ? '' : negCommaSign;
  if (Lstep >= sstep) {
    setName(majors, i * fifth, circleNamesMaj[7 - (i % 7)], Math.floor((i + 1) / 7), 2 * Math.pow(3, i), Math.pow(4, i), '');
    setName(majors, i * fourth, circleNamesMaj[i % 7], -Math.floor((i + 5) / 7), Math.pow(4, i), Math.pow(3, i), '');
    if (niceUD) {
      setName(majors, i * fifth + comma, circleNamesMaj[7 - (i % 7)], Math.floor((i + 1) / 7), 2 * Math.pow(3, i), Math.pow(4, i), ud);
      setName(majors, i * fourth + comma, circleNamesMaj[i % 7], -Math.floor((i + 5) / 7), Math.pow(4, i), Math.pow(3, i), ud);
    }
  } else {
    setName(majors, (i - 4) * fourth, circleNamesMaj[7 - (i % 7)], -Math.floor((i + 1) / 7), 2 * Math.pow(3, i), Math.pow(4, i), '');
    setName(majors, (i + 4) * fifth, circleNamesMaj[i % 7], Math.floor((i + 5) / 7), Math.pow(4, i), Math.pow(3, i), '');    
    if (niceUD) {
      setName(majors, (i - 4) * fourth + comma, circleNamesMaj[7 - (i % 7)], -Math.floor((i + 1) / 7), 2 * Math.pow(3, i), Math.pow(4, i), ud);
      setName(majors, (i + 4) * fifth + comma, circleNamesMaj[i % 7], Math.floor((i + 5) / 7), Math.pow(4, i), Math.pow(3, i), ud);    
    }
  }
  var ud = octave == 4296 ? '' : commaSign;
  if (Lstep >= sstep) {
    setName(minors, (i - 4) * fourth - comma, circleNamesMin[7 - (i % 7)], -Math.floor((i + 1) / 7), Math.pow(4, i) * 5, Math.pow(3, i) * 4, ud);
    setName(minors, (i + 4) * fifth - comma, circleNamesMin[i % 7], Math.floor((i + 5) / 7), Math.pow(3, i) * 5, Math.pow(4, i) * 4, ud);
    if (niceUD) {
      setName(minors, (i - 4) * fourth, circleNamesMin[7 - (i % 7)], -Math.floor((i + 1) / 7), Math.pow(4, i) * 5, Math.pow(3, i) * 4, '');
      setName(minors, (i + 4) * fifth, circleNamesMin[i % 7], Math.floor((i + 5) / 7), Math.pow(3, i) * 5, Math.pow(4, i) * 4, '');
    }
  } else {
    setName(minors, i * fifth - comma, circleNamesMin[7 - (i % 7)], Math.floor((i + 1) / 7), Math.pow(4, i) * 5, Math.pow(3, i) * 4, ud);
    setName(minors, i * fourth - comma, circleNamesMin[i % 7], -Math.floor((i + 5) / 7), Math.pow(3, i) * 5, Math.pow(4, i) * 4, ud);
    if (niceUD) {
      setName(minors, i * fifth, circleNamesMin[7 - (i % 7)], Math.floor((i + 1) / 7), Math.pow(4, i) * 5, Math.pow(3, i) * 4, '');
      setName(minors, i * fourth, circleNamesMin[i % 7], -Math.floor((i + 5) / 7), Math.pow(3, i) * 5, Math.pow(4, i) * 4, '');
    }
  }
  if (i > 0 && i < 55 && octDist(i * fifth) < octDist(octaveloop * fifth))
    octaveloop = i;
}
function gcd(a, b) 
{
  if (b < 1) return a;
  return gcd(b, a % b);
}

var genPer = steps.genPer;
console.log(genPer);

function mkLsSteps(Lstep, sstep, Lnum, snum, hasMinors) {
  if (!hasMinors && Lnum + snum <= 8 && Math.max(Lnum, snum) < 7 && Lnum + snum < octave) 
    return Lstep > sstep 
      ? mkLsSteps(sstep, Lstep - sstep, Lnum + snum, Lnum, hasMinors)
      : mkLsSteps(Lstep, sstep - Lstep, Lnum + snum, snum, hasMinors);
  var nums = Math.max(Lnum, snum) / genPer.repeats;
  var scale = [];
  for (var r = 0; r < genPer.repeats; r++) {
    for (var i = Math.ceil(-nums / 2); i < nums / 2; i++) {
      scale.push((r * genPer.period + (i * genPer.generator + Math.abs(i) * octave)) % octave)
    }
  }
  scale.sort((a, b) => a - b);
  console.log(scale);
  // function play(i) {
  //   return function() { 
  //     playSound(523 * Math.pow(2, [...scale,octave][i]/octave - 1), 0.9);
  //   }
  // }
  // for (var i = 0; i <= scale.length; i++)
  //   setTimeout(play(i), i * 300 + 2000)
  var lssteps = [], debug = [];
  var x = 0, y = 0, s = 0;
  var steps = Lstep + sstep;
  lssteps.steps = steps;
  var period = genPer.period;
  Lnum /= genPer.repeats;
  snum /= genPer.repeats;
  for (var i = 0; s < period; i++) {
    if (Math.floor(i / steps * Lstep) > y) {
      for (var j = 0; j < Lnum; j++) lssteps[s++] = { h: (x + y) / steps, l: 0 };
      y++;
      debug.push(Lnum)
    }
    if (Math.round(i / steps * sstep) > x) {
      for (var j = 0; j < snum; j++) lssteps[s++] = { h: (x + y) / steps, l: 1 };
      x++;
      debug.push(snum)
    }
  }
  console.log(debug)
  var bigL = Lnum > snum ? 0 : 1;
  let getL = ({l}) => l;
  for (var start = 1; start >= !hasMinors; start--) {
    lssteps.start = start;
    for (var i = 0; i < period; i++)
      if (lssteps[0].l == bigL && lssteps.slice(start).map(getL).toString() == lssteps.slice(start).reverse().map(getL).toString())
        return lssteps;
      else
        lssteps.push(lssteps.shift());
  }
  /*for (var start = 1; start >= !hasMinors; start--) {
    lssteps.start = start;
    for (var i = 0; i < period; i++)
      if (lssteps.slice(start).map(getL).toString() == lssteps.slice(start).reverse().map(getL).toString())
        return lssteps;
      else
        lssteps.push(lssteps.shift());  
  }*/
  console.log("no symmetry found")
  var next = Math.floor((Math.max(Lsnum, snum) - 1)/2) + 1;
  for (var i = 0; i < octave; i++)
    if (lssteps[0].l == bigL && lssteps[next].l == 1 - bigL)
      return lssteps;
    else
      lssteps.push(lssteps.shift());  
  return lssteps;
}
var bigGcd = gcd(gcd(Lstep, sstep), gcd(ystep, octave));
console.log({bigGcd})
var lssteps = Lstep == sstep
  ? mkLsSteps(ystep/bigGcd, sstep/bigGcd, ynum, snum + Lnum - ynum, false) 
  : mkLsSteps(ystep/bigGcd, (Lstep + sstep - ystep)/bigGcd, Lnum, snum, true);
console.log(lssteps.map(({h}) => h * lssteps.steps).toString());
for (var i = octave - 1; i >= 0; i--)
  lssteps[i] = lssteps[Math.floor(i / genPer.repeats)];

var keyCount = 0, lumaBoards = [[], [], [], [], []];
var keyboard = document.getElementById("keyboard");
var range = Math.min(50, 4 * octave);
var center;
var basicLs = /*Lstep == sstep ? Lnum + snum / 2 :*/ Lnum * 2 + snum;
var lumaAlt = ynum > 2 * Lsnum;
var lumaSwap = ynum < Lsnum;
console.log({lumaAlt, lumaSwap, range})
var keysByCoords = {}, keysByNote = {}, keysByLuma = {};
for (var y = -range; y <= range; y++)
{
  var isMinor = y & 1 == 1;
  var noteY = 5 * octave - (y * ystep - isMinor * (2 * Lstep + ystep)) / 2;
  var x0 = Math.min(-range, Math.max(
    (0 - noteY) / (Lstep + sstep + ystep),
    (-100 - y * Lsnum) / Math.abs(ynum - Lsnum) / 2
  ));
  var x1 = Math.max(range, Math.min(
    (10 * octave - noteY) / (Lstep + sstep + ystep),
    (100 - y * Lsnum) / Math.abs(ynum - Lsnum) / 2
  ));
  for (var x = Math.ceil(x0); x <= x1; x++)
  {
    var col = x*2 + isMinor;
    var row = (y + col) / 2;
    var lumaX = lumaAlt ? col / 2 - row / 2 : lumaSwap ? col / 2 + row / 2 : col - row / 2;
    var lumaY = lumaAlt ? col * 5 / 7 + row : lumaSwap ? col * 5 / 7 - row : row - col * 2 / 7;
    var lumaBoardIx = Math.floor((lumaX + 14.5) / 6);
    var lumaBoardX = Math.round(lumaX);
    var lumaBoardY = Math.round((lumaY*7+lumaX*2)/6);
    var lumaKeyIx = lumaBoardX + lumaBoardY * 6 + 63 - lumaBoardIx * 18;
    if (lumaKeyIx < 7) lumaKeyIx += 1;
    if (lumaKeyIx < 2) lumaKeyIx += 4;
    if (lumaKeyIx > 48) lumaKeyIx -= 1;
    if (lumaKeyIx > 53) lumaKeyIx -= 4;
    var note = x * (Lstep + sstep + ystep) + noteY;
    var skip = isLumatone ? lumaY < -4 || lumaY >= 4 || lumaX > 15 || lumaX <= -15 : note / octave < 0 || note / octave > 10;
    var keyObj = {x:col,y:row,note,skip,lumaBoardIx,lumaKeyIx,lumaX,lumaY}
    keysByCoords[[col, row]] = keyObj;
    // if (isLumatone && (lumaBoardIx < 0 || lumaBoardIx >= 5 || lumaKeyIx < 0 || lumaKeyIx >= 56)) {
    //   console.log({lumaX, lumaY, lumaBoardIx, lumaKeyIx})
    //   continue;
    // }
    keyCount++;
    var pitchClass = note % octave;
    var box = keyObj.box = document.createElement("div");
    if (!skip) {
      //keyboard.appendChild(box);
    }
    box.className = "key";
    var p = (x * 2 + isMinor) * (ynum - Lsnum) + y * Lsnum;
    var y2 = p * 17 * 4 / (2 * Lsnum);
    var x2 = (note - isMinor * (Lstep - sstep) / 2) / octave * 230 * (2 * Lsnum) / 4;
    if (isLumatone) {
      y2 = lumaY * 70;
      x2 = lumaX * 60 + lumaY * 15;
    }
    var dx = isLumatone ? 1200 : 200;
    var dy = isLumatone ? 400 : 2000;
    if (!x && !y) center = {x: x2 + dx + 100, y: y2 + dy + 50};
    box.style.left = (x2 + dx) + "px";
    box.style.top = (y2 + dy) + "px";
    var nm = (isMinor ? minors : majors)[pitchClass]?.name;
    octaveloop = Lstep == sstep ? octave / 2 : octave;
    octaveloop /= bigGcd;
    if (args.groups.alt)
      while (octaveloop > 24) octaveloop = Math.round(octaveloop/2);
    var d = Math.abs((col * 2 * (2*Lsnum - ynum) - 4 * Lsnum * row + (major < minor ? -3 : -1) + (100 + 2) * octaveloop) % (4 * octaveloop) - 2 * octaveloop);
    var isCorner = (Lnum + snum) % 2 == 1 
      ? d == Lnum + snum || d == 2 * basicLs + Lnum + snum || (Lstep != sstep && (d == 2 * basicLs - Lnum - snum || d == 4 * basicLs - Lnum - snum))
      : (d == 1 && pitchClass == 0) || d == 2 * basicLs - 1 || d == 2 * basicLs + 1 || d == 4 * basicLs - 1;
    var checkers = d == basicLs || d == 3*basicLs ? 0.65 : (d < basicLs || d > 3 * basicLs);
    var h = isCorner ? -20 : isMinor ? 100 : 200;
    var l = isMinor && Lstep != sstep ? checkers * 15 + 65 : checkers * 35 + 65;
    if (isCorner) l = checkers ? isMinor ? 70 : 55 : isMinor ? 90 : 95;
    var strangeness = 0.5 - 0.5 * Math.cos(p * Math.PI / octaveloop);
    var s = 25 + 10 * strangeness;
    l -= (120 - l) * strangeness * 0.3;
    
    if (Lstep == sstep) {
      var d = (col * (2*Lsnum - ynum) - 2 * Lsnum * row + 100 * octaveloop - 2 * (ls == '7L5s' || ls == '5L7s') + 2 * (ls == '5L2s' || ls == '2L3s' || ls == '7L2s' || ls=='12L7s')) % (2 * octaveloop);
    } else {
      var d = (col * (2*Lsnum - ynum) - 2 * Lsnum * row + (major < minor ? -1 : 1) - 2 + lssteps.start  + 100 * octaveloop) % (2 * octaveloop);
      d = Math.floor(d / 2);
    }
    if (d < 0) continue;
    if (!args.groups.alt) {
      h = ((lssteps[d].h - lssteps[0].h) * 360 + 360) % 360;
      var strangeness = 1 - Math.abs(180 - h) / 180;
      var dark = lssteps[d].l ^ lssteps[0].l;
      if (dark) box.className = "key dark";
      s = (80 - 50 * dark) * strangeness - 5 * (Lstep != sstep && isMinor);
      l = 100 - 15 * (strangeness > 0) - (50 - 30 * strangeness) * dark - 15 * strangeness - 5 * (Lstep != sstep && isMinor);
      h = 90 - h;
    }

    box.innerHTML = nm + "<sub>" + (octave != 12 ? [pitchClass] : '') + "</sub>";
    // box.innerHTML = nm + "<sub>" + (octave != 12 ? [row,col] : '') + "</sub>";
    box.note = note - 6 * octave;
    box.isMinor = isMinor;
    note += (Math.round(64 / octave) - 5)*octave;
    var chan = 1;
    while (note <   0) { chan--; note += octave; }
    while (note > 127) { chan++; note -= octave; }
    if (octave <= 64 && Lstep != sstep) {
      // put major in even channels, minor is odd channels
      if (isMinor ^ (chan & 1)) {
        if (note < 64) {
          note += octave;
          chan--;
        } else {
          note -= octave;
          chan++;
        }
      }
    }
    if (chan < 1) chan += 16;
    if (isLumatone && lumaBoardIx == 0 && lumaKeyIx == 0) {
      note = 0; chan = 8;
    }
    keyObj.midiNote = box.midiNote = note;
    keyObj.midiChan = box.midiChan = chan;
    lumaIx[[chan, note]] = {boardIx: lumaBoardIx, keyIx: lumaKeyIx};
    if (!skip) {
      if (!keysByNote[[chan,note]] || Math.abs(keysByNote[[chan,note]].lumaY) > Math.abs(keyObj.lumaY))
        keysByNote[[chan,note]] = keyObj;
      keysByLuma[[lumaBoardIx, lumaKeyIx]] = keyObj;
    }
    if (isLumatone && !skip) {
      box.style.backgroundColor = "hsl(" + h + ", " + (3*s) + "%, " + (100 - (100 - l)*1.3) + "%)";
      var rgb = rgba2hex(window.getComputedStyle(box).backgroundColor);
      unLumaColors[rgb] = "hsl(" + h + ", " + s + "%, " + l + "%)";
      lumaBoards[lumaBoardIx][lumaKeyIx] = {
        note: note,
        chan: chan,
        color: rgb,
        x: x2, y: y2
      }
    }
    box.style.backgroundColor = "hsl(" + h + ", " + s + "%, " + l + "%)";
    // box.innerHTML = nm + "<sub>" + (octave != 12 ? [chan,note] : '') + "</sub>";
  }
}
function rgba2hex(rgba) { return rgba.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.{0,1}\d*))?\)$/).slice(1).map((n, i) => (i === 3 ? 'NaN' : parseFloat(n)).toString(16).padStart(2, '0').replace('NaN', '')).join('') }
console.log("Key count", keyCount)

var isDown = {}, targets = {};
function ondown(e) {
  clearInterval(handler);

  if (e.target.nodeName.toLowerCase() in { a: true, option: true, select: true })
    return;

  var idx = e.identifier;
  isDown[idx] = true;
  onmove(e);
}
function onup(e) {
  var idx = e.identifier;
  if (isLumatone && targets[idx]) {
    lumaNoteOn(targets[idx].midiChan, targets[idx].midiNote, 0);
  } else {
    noteOff(idx);
  }
  delete isDown[idx];
  delete targets[idx];
}
function onmove(e) {
  var idx = e.identifier;
  if (!isDown[idx])
    return;
  for (
    var tgt = document.elementFromPoint(e.clientX, e.clientY); 
    tgt && !('note' in tgt);
    tgt = tgt.parentNode
  ) {}
  if (tgt && (!targets[idx] || (tgt.note != targets[idx].note)))
  {
    if (isLumatone && targets[idx]) {
      lumaNoteOn(targets[idx].midiChan, targets[idx].midiNote, 0);
    } else {
      noteOff(idx);
    }
    targets[idx] = tgt;
    if (isLumatone) {
      lumaNoteOn(tgt.midiChan, tgt.midiNote, 127);
    } else {
      noteOn(tgt.note, tgt, idx, 127);
    }
  }
}
function initEventHandlers() {
  document.documentElement.onmousedown = ondown;
  document.documentElement.onmouseup = onup;
  document.documentElement.onmousemove = onmove;
  document.documentElement.ontouchstart = function(e) {
    document.documentElement.onmousedown = null;
    document.documentElement.onmouseup = null;
    document.documentElement.onmousemove = null;

    if (e.target.nodeName.toLowerCase() in { a: true, option: true, select: true })
      return;

    for (var i = 0; i < e.changedTouches.length; i++)
    {
      // e.preventDefault();
      ondown(e.changedTouches[i]);
    }
  }
  document.documentElement.ontouchmove = function(e) {
    for (var i = 0; i < e.changedTouches.length; i++)
      onmove(e.changedTouches[i]);
    // e.preventDefault();
  }
  document.documentElement.ontouchend = function(e) {
    for (var i = 0; i < e.changedTouches.length; i++)
      onup(e.changedTouches[i]);
    // e.preventDefault();
  }
}

function scrollCenter() {
  window.scrollTo(
    center.x - window.innerWidth / 2, 
    center.y - window.innerHeight / 2
  );
}
var handler = setInterval(scrollCenter, 100);

document.getElementById("close-features").onclick = start;
var features = document.getElementById("features");
features.onclick = start;
function start(e) {
  if (features.style.visibility == "hidden")
    return;
  playSound(400, 0)
  initEventHandlers()
  clearInterval(handler);
  scrollCenter();
  if (e && e.target.nodeName.toLowerCase() == "a")
    return;
  features.style.visibility = "hidden";
}
if (isLumatone) {
  start();
  features.style.visibility = "hidden";
  // console.log("key count: ", lumaKeys);
  document.body.className = "lumatone";
  setTimeout(scrollCenter, 500)
  var ltnFile = lumaBoards.map((board, i) => 
    `[Board${i}]\n` + board.map(({note, chan, color}, j) => 
      [
        `Key_${j}=${note}`,
        `Chan_${j}=${chan}`,
        `Col_${j}=${color}`,
      ].join('\n')
    ).join('\n')
  ).join('\n') + "\nLightOnKeyStrokes=1\nAfterTouchActive=1";
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(ltnFile));
  element.setAttribute('download', `chords-${octave}edo${args.groups.L?ls:''}${args.groups.third?major:''}${args.groups.fifth?'-'+fifth:''}-visscher.ltn`);
  element.id = 'download';
  element.innerHTML = 'Download mapping file';
  document.body.appendChild(element);
  
}

