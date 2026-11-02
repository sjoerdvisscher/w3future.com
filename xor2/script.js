// Midi setup
let midiOut = null;
let midiOuts = [];
const fokker = [0, 2, 5, 8, 10, 13, 15, 18, 20, 23, 26, 28, 31];
function midiOff(ch, tone) {
  midi(ch, tone, 0x80, 0);
}
function midiOn(ch, tone) {
  midi(ch, tone, 0x90, 64);
}
function midi(ch, tone, msg, vol) {
  tone += 4 * 31 + 17;
  const note = tone % 31;
  const oct = Math.floor(tone / 31);
  const n12 = fokker.findIndex(f => note < f) - 1;
  const channelDelta = note - fokker[n12];
  midiOut.send([msg + ch + channelDelta, oct * 12 + n12, vol]);
  // midiOuts[ch].send([msg, tone + 5 * 12 + 2, vol])
}
if (navigator.requestMIDIAccess) {
  navigator.requestMIDIAccess().then(midiAccess => {
    for (let port of midiAccess.outputs.values()) {
      if (port.name == "to Forgan4 1") {
        midiOut = port;
        for (var i = 0; i < 128; i++) {
          for (var c = 0; c < 16; c++) {
            midiOut.send([0x80 + c, i, 0]);
          }
        }
        midiOut.send([0xc0, 0x9]);
        midiOut.send([0xc0, 0xa]);
        midiOut.send([0xc0, 0xf]);
        midiOut.send([0xc0, 0x11]);
        break;
      } /*else if (port.name == "IAC Driver Bus 1") {
        midiOuts[0] = port;
      } else if (port.name == "IAC Driver Bus 2") {
        midiOuts[1] = port;
      } else if (port.name == "IAC Driver Bus 3") {
        midiOuts[2] = port;
      } else if (port.name == "IAC Driver Bus 4") {
        midiOuts[3] = port;
      }*/
    }
  });
}

function start() {
  // Unlock audio during the click, before fullscreen can consume user activation.
  var ac = new (window.AudioContext || window.webkitAudioContext)();
  ac.resume().catch(function (error) {
    console.error('Unable to start audio:', error);
  });
  document.body.removeChild(document.querySelector('button'));
  var canvas = document.querySelector('canvas');
  var rf = canvas.requestFullscreen || canvas.webkitRequestFullScreen || canvas.mozRequestFullScreen || canvas.msRequestFullScreen;
  if (rf) {
    try {
      var fullscreen = rf.call(canvas);
      if (fullscreen && fullscreen.catch) fullscreen.catch(function () {});
    } catch (error) {
      // Fullscreen is optional; continue playing if the browser refuses it.
    }
  }
  var ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'xor';
  ctx.fillStyle = 'white';
  
  // Audio setup
  var maingain = ac.createGain();
  maingain.connect(ac.destination);
  maingain.gain.value = midiOut ? 0 : 1;
  var reverb = SimpleReverb(ac)
  reverb.connect(maingain)
  reverb.time = 1 //seconds
  reverb.wet.value = 1
  reverb.dry.value = 0.5
  reverb.filterType = 'lowpass'
  reverb.cutoff.value = 4000 //Hz  
  var oscs = [];
  for (var i = 0; i < 4; i++) {
    var biquadFilter = ac.createBiquadFilter();
    biquadFilter.connect(reverb);
    biquadFilter.frequency.value = 100;
    biquadFilter.Q.value = 0.5;
    if (ac.createStereoPanner) {
      var pan = ac.createStereoPanner();
      pan.pan.value = (i % 1.51) - .75;
      pan.connect(biquadFilter);
    }
    var gain = ac.createGain();
    gain.gain.value = 0.001;
    gain.connect(pan || biquadFilter);
    var osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.connect(gain);
    osc.start();
    oscs.push([osc, gain, biquadFilter]);
  };
  
  // This piece was conceived in 31 tone equal temperament, but the number of tones is configurable
  // E.g. xor2.glitch.me?12 plays in the regular 12 tone equal temperament
  const oct = 1*location.search.substr(1) || 31
  const g = oct == 1 ? Math.log2(3/2) : Math.round(oct * Math.log2(3/2));
  const d = g + g - oct;
  const eb = g - d - d;
  const accid = d + d - eb;
  var scale = [];
  for (var i = 0; i < 16; i++) {
    scale[i] = (i & 1)*d + (i & 2)/2*eb + (i & 4)/4*g;
  }
  var ts = [];
  var chords = [];
  var names = {0: 'C', [d]: 'D', [d*2]: 'E', [g-d]: 'F', [g]: 'G', [g+d]: 'A', [g+d*2]: 'B'}
  for (var s in names) {
    var i = s*1;
    if (!names[(i+accid)%oct])
      names[(i+accid)%oct] = names[i] + '#';
    if (!names[(i+oct-accid)%oct])
      names[(i+oct-accid)%oct] = names[i] + 'b';
  }
  var t = -1;
  var delta = 0.4;
  var midiOns = [];
  var start = new Date()*1;
  function loop() {
    t+=1;
    const td = ac.currentTime;
    setTimeout(loop, (t + 1) * delta * 1000 + start - new Date());

    // k is the melody loop
    var k = t & 3;
    // y is the chord loop of 8 steps
    var y = (t >> 2) & 7;
    // x is the transpose loop of 16 steps
    var x = (t >> 5) & 15;
    // Change x into a sequence where only 1 bit changes each step, reverse lower 3 bits
    var xx = ((((x ^ x >> 1) * 0x444) & 0x1284) % 63)

    var x7 = ((x + 4) & 7) * 16 * 8;
    if (!y && !k) ctx.fillRect(x7, x7, 1024 - x7 * 2, 1024 - x7 * 2);
    if (!y && !k) { console.log(chords.join('->')); chords=[] }
    
    if (midiOut && !(x & 1) && !y && !k) {
      const b = (x & 8) >> 3;
      // midiOut.send([0xc0, 0xf - ((x & 2) >> 1 ^ b)]);
      // midiOut.send([0xc0, 0x9 - ((x & 4) >> 2 ^ b)]);
    } 

    ts = [];
    oscs.forEach(([osc, gain, biquadFilter], i) => {
      
      // Pick a part in the melody
      var m = (i ^ ((x ^ x >> 2) + y & 3)) + 2 - ((x + 3 - i) >> 2);
      // Pick a note in the chord
      var n = i ^ k >> m;
      
      // Only these two lines generate the chord sequence
      var q = (1 << n ^ y ^ xx) & 7;
      var tone = scale[q] - scale[xx];
      
      // Separate the ranges of the voices by half an octave each, like an SATB four-part harmony
      if ((i&1)) {
        if (tone > oct) tone -= oct;
        if (tone < 0) tone += oct;
      } else {
        if (tone > oct + g) tone -= oct;
        if (tone < g) tone += oct;
      }
      tone -= (i>>1)*oct;
      
      // Play the note (using scientific pitch: C4=256Hz)
      osc.frequency.setValueAtTime(Math.pow(2, tone/oct + 8), td);
      
      ts.unshift(tone);
      if (!k) for (var j = -1; j<=1; j++)
        ctx.fillRect(y*16*8 + 56 - i*16, (7-q + j*7)*16*8 + 56 - i*16, 16 + i*32, 16 + i*32);
      gain.gain.setTargetAtTime(Math.exp(-(1-Math.cos(t / 256 * Math.PI))), td, 0);
      biquadFilter.frequency.setTargetAtTime(Math.pow(2, 7 - i/4)*Math.pow(1.5, (1 - Math.cos(t / 256 * Math.PI)) * 4), td, delta);      
    });
    if (!k) chords.push(ts.map(a => names[(a+d+2*oct)%oct]).join(','));
    canvas.style.display = 'none';
    canvas.offsetHeight; 
    canvas.style.display = '';
    
    if (midiOut) {
      midiOns.forEach((tone, i) => {
        if (tone != ts[i]) {
          midiOff(i, tone);
          // midiOff(6, tone);
        }
      });
      ts.forEach((tone, i) => {
        if (tone != midiOns[i]) {
          midiOn(i, tone);
          // midiOn(6, tone);
        }
      });
      midiOns = ts;
    }
  }
  loop();
}
// start()