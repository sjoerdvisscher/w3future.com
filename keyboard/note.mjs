

var audioCtx = null;
var soundBuffer = null;
var compressor = null;

function resumeAudio() {
    if (audioCtx && (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted')) {
        audioCtx.resume().catch(function (error) {
            console.error('Unable to start audio:', error);
        });
    }
}

export function playSound(freq, vol, dt = 0) {
    // Unlock audio on interaction even if the sample is still loading.
    resumeAudio();
	  vol = vol === undefined ? 0.5 : vol;
    if(soundBuffer) {
        // console.log("playing", freq)
        var sound = audioCtx.createBufferSource();
        var gain = audioCtx.createGain();
        sound.buffer = soundBuffer;
        sound.playbackRate.value = freq/220;
        sound.connect(gain);
        gain.connect(compressor);

        // gain.gain.defaultValue = vol;
			  for (var i = 0; i <= 100; i++)
			    gain.gain.setValueAtTime(vol*(1 - i/100), audioCtx.currentTime + dt + i/50);
			  
			  sound.start(audioCtx.currentTime + dt);
    }
}
  
function Note(freq) {
    if(audioCtx) {
        this.node = audioCtx.createJavaScriptNode(1024, 1, 1);
        this.incr = 0;

        this.gain = audioCtx.createGainNode();
        this.node.connect(this.gain);
        this.incr = 2 * Math.PI * freq/audioCtx.sampleRate;
        this.gain.gain.value = 0.25;
    }
}

Note.prototype.playNote = function() {
    if(this.playing) {
        this.stopNote();
    }

    if(audioCtx) {
        var x = 0;

        var _this = this;
        this.node.onaudioprocess = function(e) {
            var data = e.outputBuffer.getChannelData(0);
            for(var i=0; i<data.length; i++) {
              data[i] = Math.exp(-x/1000)*(Math.sin(x)*4 % 1);
                x += _this.incr;
            }
        };

        this.gain.connect(compressor);
        this.playing = true;
    }
};

Note.prototype.stopNote = function() {
    if(audioCtx) {
        this.node.disconnect();
        this.gain.disconnect();
        this.playing = false;
    }
};
  
if('webkitAudioContext' in window || 'AudioContext' in window) {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -40;
  compressor.knee.value = 40;
  compressor.ratio.value = 12;
  compressor.attack.value = 0;
  compressor.release.value = 0.25;
  compressor.connect(audioCtx.destination)

  document.body.addEventListener('touchend', resumeAudio);

  // Keep the instrument sample on this site rather than depending on Glitch.
  fetch('/Media/rhodes.mp3')
    .then(function (response) {
      if (!response.ok) throw new Error('Piano sample request failed: ' + response.status);
      return response.arrayBuffer();
    })
    .then(function (data) { return audioCtx.decodeAudioData(data); })
    .then(function (buffer) { soundBuffer = buffer; })
    .catch(function (error) {
      console.error('Unable to load the piano sample:', error);
    });
}
