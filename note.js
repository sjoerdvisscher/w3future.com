

var audioCtx = null;
var soundBuffer = null;


function playSound(freq, vol) {
	  vol = vol === undefined ? 0.5 : vol;
    if(soundBuffer) {
        // console.log("playing", freq)
        var sound = audioCtx.createBufferSource();
        var gain = audioCtx.createGain();
        sound.buffer = soundBuffer;
        sound.playbackRate.value = freq/220;
        sound.connect(gain);
        gain.connect(audioCtx.destination);

        gain.gain.defaultValue = vol;
			  for (var i = 0; i <= 100; i++)
			    gain.gain.setValueAtTime(vol*(1 - i/100), audioCtx.currentTime + i/50);
			  
			  sound.start(0, 0);
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

        this.gain.connect(audioCtx.destination);
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
  audioCtx = new (window.webkitAudioContext || window.AudioContext)();
	var fromTouchEnd = false;
	document.body.ontouchend = function() {
		if (!fromTouchEnd) {
			fromTouchEnd = true;
			  var request = new XMLHttpRequest();
  request.open('GET', 'https://cdn.glitch.com/d4395f6d-f5a9-4c72-baaf-d540b05e361d%2Frhodes.mp3?1515162947197', true);
  request.responseType = 'arraybuffer';
	request.addEventListener('load', function () {
		audioCtx.decodeAudioData(request.response, function (buffer) { 
			soundBuffer = buffer
			playSound(500, 1)
			console.log("soundBuffer from touch end")
		})
	}, false);
  request.send();

		}
	}

    function bufferSound() {
        audioCtx.createBuffer(request.response, false);
    }

  var request = new XMLHttpRequest();
  request.open('GET', 'https://cdn.glitch.com/d4395f6d-f5a9-4c72-baaf-d540b05e361d%2Frhodes.mp3?1515162947197', true);
  request.responseType = 'arraybuffer';
	request.addEventListener('load', function () {
		audioCtx.decodeAudioData(request.response, function (buffer) { soundBuffer = buffer })
	}, false);
  request.send();

}
