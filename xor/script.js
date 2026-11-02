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
var gain = ac.createGain();
var biquadFilter = ac.createBiquadFilter();
gain.connect(ac.destination);
gain.gain.value = 0.1;
var reverb = SimpleReverb(ac)
reverb.connect(gain)
reverb.time = 1 //seconds
reverb.wet.value = 1
reverb.dry.value = 0.5
reverb.filterType = 'lowpass'
reverb.cutoff.value = 4000 //Hz
biquadFilter.connect(reverb);
biquadFilter.frequency.value = 0;
biquadFilter.Q.value = 10;
var bufferSize = 2 * ac.sampleRate,
    noiseBuffer = ac.createBuffer(1, bufferSize, ac.sampleRate),
    output = noiseBuffer.getChannelData(0);
for (var i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
}
var noiseGain = ac.createGain();
noiseGain.connect(reverb);
var noiseFilter = ac.createBiquadFilter();
noiseFilter.connect(noiseGain);
var noise = ac.createBufferSource();
noise.buffer = noiseBuffer;
noise.loop = true;
noise.start();
noise.connect(noiseFilter);
var oscs = [];
for (var i = 0; i < 4; i++) {
  var osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.connect(biquadFilter);
  osc.start();
  oscs.push(osc);
};
var t = -1;
var delta = 0.5;
setInterval(function() {
  t++;
  biquadFilter.frequency.setTargetAtTime(160*Math.pow(1.5, 8 - Math.abs(t / 64 - 8)), ac.currentTime, delta);
  if (t > 1050) {
    gain.gain.setTargetAtTime(0.1, ac.currentTime, delta);
    t = 0;
  }
  if (t >= 1024) {
    gain.gain.setTargetAtTime(0, ac.currentTime, delta);
    return;
  }
  var x = t >> 6;
  var z = (((x * 0x222) & 0x1284) % 63) // reverse bits
  var y = (t >> 2) & 15;
  
  if (!(t & 3)) {
    var w = z ^ y ^ (z ^ y) >> 1;
    oscs.forEach(function (osc, i) {
      const b = !!(w & (1 << i));
      ctx.fillRect(47 - i * 12 + x * 64 - b*2, 27 + y * 64 - b*2, 6+4*b, 6+4*b);
      osc.frequency.setValueAtTime(Math.pow(2, (i * 3 + b)/12 + 8), ac.currentTime);
    });
  }
  
  var j = (t >> 5) & 1;
  if (!(t & 16)) {
    var y = t & 15;
    const b = z ^ y;
    if (!((j ^ z) & 1)) ctx.fillRect(y*64, (15-b)*64, 64, 64)
    ctx.fillRect(y*64 + 4, (15-b)*64 + 4, 56, 56)
    noiseFilter.frequency.setTargetAtTime(200 * Math.pow(1.3, b), ac.currentTime, delta * 0.05);
    noiseGain.gain.setTargetAtTime(25 * Math.pow(0.8, b), ac.currentTime + delta * 0.1, delta * 0.1);
    noiseGain.gain.setTargetAtTime(0, ac.currentTime + delta * 0.2, delta * 0.5);
  }
  canvas.style.display = 'none';
  canvas.offsetHeight; 
  canvas.style.display = '';
}, delta * 1000)
}