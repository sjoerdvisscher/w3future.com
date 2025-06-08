{
  var output = null;
	var transposeMap = {'Launchpad Mini': 0};
  var noteOffs = {};
  var channel = 1;
  var channels = [];
  var sustained = null;
  var lpOut = null;
  var lpMini = null;
  var arpeggio = false;
  var tempo = 480;
  var isLumatone = location.hash.indexOf('lumatone') > -1;

  function noteOn(note, isMinor, ix, volume) {
    if (output) {
      if (octave == 12) {
        channel = 0;
        channels[0] = null;
      }
      var note12 = (note / octave + (isMinor && just3rd) * justDelta) * 12;
      var note12rnd = Math.round(note12);
      var note12frac = Math.round((note12 - note12rnd) * 0x2000 / 12) + 0x2000;
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
      channels[channel] = note12rnd + 72;
      toSend = toSend.concat([
        0x90 + channel,
        channels[channel],
        25 + volume / 2
      ]);
      noteOffs[ix].data = [
        0x80 + channel,
        channels[channel],
        0
      ];
      noteOffs[ix].count++;
      // console.log("Sending channel: ", channel, "Sending pitch bend: ", note12frac, "Diff: ", note12 - note12rnd);
      output.send(toSend);
      channel++;
      if (channel == 16) channel = 1;
    } else {
      var freq = 523 * 
        Math.pow(2, note / octave + (isMinor && just3rd) * justDelta);
      playSound(freq, volume / 127 * .7);
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
    var extras = [[{x:1, y:0}, {x:2, y:0}], [], [{x:-3, y:1}, {x:-1, y:1}, {x:1, y:0}, {x:2, y:0}, {x:3, y:-1}, {x:4, y:0}, {x:4, y:-1}]];
    var arpeggios = [[[0], [1], [2], [0], [1], [2], [0], [1]], [[0, 2], [3], [1, 2], [3]], [[0], [1], [2], [3], [4], [5], [6], [7]]];
    var arpeggioRowOffset = 0;
    var currentExtra = 0;
    var mode = 'play';
    var config = JSON.parse(localStorage.getItem('config/v1')) || {};
    extras = config.extras || extras;
    currentExtra = config.currentExtra || currentExtra;
    for (var name in config.transposeMap)
      transposeMap[name] = Math.round(config.transposeMap[name] * octave);
    arpeggios = config.arpeggios || arpeggios;
    tempo = config.tempo || tempo;
    function lpSend(data) {
      if (lpOut) lpOut.send(data);
      var y = data[0] == 0x90 ? (data[1] >> 4) + 1 : 0;
      var x = data[0] == 0x90 ? data[1] % 16 : data[1] - 104;
      if (lpMini) lpMini.childNodes[y * 9 + x].id = 'c' + (data[2] + 0x100).toString(16).substr(1);
    }
    function updateLpNoteNames() {
      lpMini.childNodes[0].innerHTML = mode == 'play' || arpeggio ? '▲' : ''
      lpMini.childNodes[1].innerHTML = mode == 'play' || arpeggio ? '▼' : ''
      lpMini.childNodes[2].innerHTML = mode == 'play' ? '◀' : arpeggio ? '-' : ''
      lpMini.childNodes[3].innerHTML = mode == 'play' ? '▶' : arpeggio ? '+' : ''
      for (var i = 0; i <= 2; i++)
        lpMini.childNodes[i + 4].innerHTML = currentExtra == i ? arpeggio ? 'off' : 'arp' : i + 1;
      lpMini.childNodes[7].innerHTML = mode == 'play' ? 'opt' : 'ok'
      var i = 9;
      for (var y = -3; y < 5; y++) {
        for (var x = -5; x <= 3; x++) {
          var isMinor = (x & 1) != (y & 1);
          var pitchClass = ((x + y - isMinor) * fifth / 2 - y * fourth + isMinor * major + octave * 10 + transposeMap['Launchpad Mini']) % octave;
          lpMini.childNodes[i++].innerHTML = mode == 'play' ? (isMinor ? minors : majors)[pitchClass] : '';
        }
      }
    }
    function highlightAEs() {
      for (var y = -3; y < 5; y++) {
        for (var x = -5; x <= 3; x++) {
          if (mode == 'play') {
            var isMinor = (x & 1) != (y & 1);
            var note = (x + y - isMinor) * fifth / 2 - y * fourth + isMinor * major - octave + transposeMap['Launchpad Mini'];
            var ix = (y+3)*16 + x + 5;
            lpSend([0x90, ix, color(note, ix)]);
          } else {
            if (arpeggio) {
              var curRow = (arpeggio.pos - arpeggioRowOffset) % arpeggios[currentExtra].length == y + 3;
              var arps = arpeggios[currentExtra][y + 3 + arpeggioRowOffset];
              lpSend([0x90, (y+3)*16 + x + 5, (x == 3 ? arps ? curRow ? 0x3 : 0x30 : 0 : arps && arps.indexOf(x + 5) > -1 ? 0x33 : curRow ? 0x1 : 0) + 0xc]);
            } else {
              var x1 = x + 2
              var c = extras[currentExtra].find(function(d) { return d.x == x1 && d.y == y }) ? 0x30 : x1 == 0 && y == 0 ? 0x3 : 0;
              lpSend([0x90, (y+3)*16 + x + 5, c + 0xc]);
            }
          }
        }
      }
      for (var i = 0; i <= 2; i++)
        lpSend([0xb0, i + 108, currentExtra == i ? arpeggio ? 0x3f : 0x3c : 0xc])
      lpSend([0xb0, 111, mode == 'play' ? 0xc : 0xf])
    }
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
    function noteLP(x, y, volume) {
      const ix = y * 16 + x + 0x35;
      var isMinor = (x & 1) != (y & 1);
      var note = (x + y - isMinor) * fifth / 2 - y * fourth + isMinor * major - octave + transposeMap['Launchpad Mini']
      if (arpeggio) {
        if (arpeggio === true) {
          arpeggio = {
            toh: setTimeout(playArpeggio, 50),
            notes: {},
            pos: 0,
            downCount: 0,
          };
        }
        if (volume) {
          if (arpeggio.downCount <= 0) { arpeggio.notes = {}; arpeggio.downCount = 0; }
          if (arpeggio.notes[ix]) {
            arpeggio.notes[ix].count++;
          } else {
            arpeggio.notes[ix] = { note: note, isMinor: isMinor, ix: ix, count: 1 };
          }
          arpeggio.downCount++;
        } else {
          arpeggio.downCount--;
        }
      } else {
        if (volume) noteOn(note, isMinor, ix, 127); else noteOff(ix);
      }
      if (mode == 'play' && x >= -5 && x <= 3 && y>= -3 && y <= 4) {
        if (volume) {
          lpSend([0x90, ix, isMinor ? 0x2e : 0x2c]);
        } else if (!noteOffs[ix] || arpeggio) {
          lpSend([0x90, ix, color(note, ix)]);
        }
      }
    }
    function playArpeggio() {
      noteOffAll(60 * 1000 / tempo / 2)
      arpeggio.toh = setTimeout(playArpeggio, 60 * 1000 / tempo);
      var notes = [];
      for (var ix in arpeggio.notes)
        for (var i = 0; i < arpeggio.notes[ix].count; i++)
          notes.push(arpeggio.notes[ix]);
      if (!notes.length) return;
      var arp = arpeggios[currentExtra];
      var as = arp[arpeggio.pos % arp.length];
      notes.sort(function(a,b) { return a.note - b.note });
      arpeggio.notesOn = [];
      as.forEach(function(a) {
        var note = notes[a];
        if (note) {
          noteOn(note.note, note.isMinor, note.ix, 127);
          arpeggio.notesOn.push(note);
        }
      })
      highlightAEs()
      arpeggio.pos++;
    }
    function lpMiniMsg(evt) {
      start()
      // console.log("Received: ", evt);
      switch (evt.data[0] & 0xF0) {
        case 0x90: // Note on
          var data = []
          for (var i = 0; i < evt.data.length; i++)
            data[i] = evt.data[i];
          var ix = data[1];
          var x = ix & 0xf;
          var y = ix >> 4;
          if (mode == 'play') {
            noteLP(x - 5, y - 3, data[2])
            extras[currentExtra].forEach(function(d) { noteLP(x - 5 + d.x, y - 3 + d.y, data[2]) })
          } else {
            if (arpeggio) {
              var row = arpeggios[currentExtra][y + arpeggioRowOffset];
              if (!row) {
                arpeggios[currentExtra].length = y + 1 + arpeggioRowOffset;
                for (var i = 0; i < arpeggios[currentExtra].length; i++)
                  arpeggios[currentExtra][i] = arpeggios[currentExtra][i] || [];
                row = arpeggios[currentExtra][y + arpeggioRowOffset];
              }
              if (data[2]) {
                if (x == 8) {
                  arpeggios[currentExtra].length = y + 1 + arpeggioRowOffset;
                } else {
                  var i = row.indexOf(x);
                  if (i == -1) {
                    row.push(x);
                  } else {
                    row.splice(i, 1);
                  }
                }
              }
              highlightAEs()
            } else {
              x -= 3;
              y -= 3;
              if ((x != 0 || y != 0) && data[2]) {
                var i = extras[currentExtra].findIndex(function(d) { return d.x == x && d.y == y });
                if (i > -1) {
                  extras[currentExtra].splice(i, 1);
                } else {
                  extras[currentExtra].push({x: x, y: y})
                }
                highlightAEs()
              }
              noteLP(0, 0, data[2])
              extras[currentExtra].forEach(function(d) { noteLP(d.x, d.y, data[2]) })
            }
          }
          break;
        case 0xb0: // Control change
          if (evt.data[2]) {
            var ctrl = evt.data[1] - 104;
            switch (ctrl) {
              case 0: case 1: case 2: case 3:
                if (mode == 'play') {
                  transposeMap['Launchpad Mini'] += [fifth - 2 * whole, 2 * whole - fifth, -fifth, fifth][ctrl] || 0;
                } else if (arpeggio) {
                  if (ctrl == 0 && arpeggioRowOffset > 0) {
                    arpeggioRowOffset--;
                  } else if (ctrl == 1) {
                    arpeggioRowOffset++;
                  } else if (ctrl == 2) {
                    tempo -= 24;
                  } else if (ctrl == 3) {
                    tempo += 24;
                  }
                } else return;
                lpSend([0xb0, evt.data[1], 0x3c]);
                break;
              case 4: case 5: case 6:
                var e = ctrl - 4;
                if (currentExtra == e) {
                  arpeggio && clearTimeout(arpeggio.toh);
                  noteOffAll()
                  arpeggio = !arpeggio;
                } else {
                  currentExtra = e;
                }
                break;
              case 7:
                mode = mode == 'play' ? 'config' : 'play';
                for (var ix in noteOffs) {
                  if (output)
                    output.send(noteOffs[ix].data);
                  delete noteOffs[ix];
                }
                break;
            }
            highlightAEs()
            updateLpNoteNames()
            saveConfig()
          } else {
            if (evt.data[1] >= 104 && evt.data[1] < 108)
              lpSend([0xb0, evt.data[1], 0xc]);
          }
          break;
      }
    }
    for (var port of inputs) {
      detectPort(port);
    }
    function detectPort(port) {
      console.log("Detected: " + port.name);
      transposeMap[port.name] = 0;//transposeMap[port.name] || 0;
      if (port.name.indexOf("Launchpad Mini") > -1) {
        port.onmidimessage = lpMiniMsg;
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
							noteOn(note, isMinor, ix, data[2])
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
				port.onmidimessage = function(evt) {
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
			}
		}
    var midiSelect = document.getElementById('midi-out');
    midiSelect.addEventListener('change', function() {
      output = midiSelect.options[midiSelect.selectedIndex].port;
      saveConfig();
      if (output)
        mpe(output);
    })
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
      if (port.name.indexOf("Launchpad Mini") > -1) {
        lpOut = port;
        showLpMini()
      }
    }
    if (!lpOut && location.hash.indexOf('launchpad') > -1) 
      showLpMini()
    function showLpMini() {
      lpMini = document.createElement('div');
      lpMini.id = 'lp-mini';
      document.body.appendChild(lpMini);
      for (var y = 0; y < 9; y++) {
        for (var x = 0; x < 9; x++) {
          makeEl(x, y);
        }
      }
      function makeEl(x, y) {
        var el = document.createElement('span');
        el.className = 'lp-pad x' + x + ' y' + y;
        el.id = 'c0c';
        el.style.left = (x * 10 + 5) + 'vmin';
        el.style.top = (y * 10 + 5) + 'vmin';
        lpMini.appendChild(el);
        var ix = x + (y - 1) * 16;
        el.onmousedown = y ? function() {
          lpMiniMsg({data: [0x90, ix, 127]});
        } : function() {
          lpMiniMsg({data: [0xb0, 104 + x, 127]});
        }
        el.onmouseup = y ? function() {
          lpMiniMsg({data: [0x90, ix, 0]});
        } : function() {
          lpMiniMsg({data: [0xb0, 104 + x, 0]});
        }
      }
      setTimeout(animate, 15);
    }
    function animate() {
      if (document.getElementById('features').style.visibility == 'hidden') {
        if (lpOut) {
          for (var i = 0; i < 40; i++)
            lpOut.send([0x92, 12, 12]);
        }
        updateLpNoteNames();
        highlightAEs();
        return;
      }
      var t = new Date()/1000;
      var data = [];
      for (var yy = 0; yy < 10; yy++) {
        for (var xx = 0; xx < 8; xx++) {
          if ((xx&1) == 0) data.push(0x92);
          var x = xx;
          var y = yy;
          if (yy == 8) {
            y = xx;
            x = 8;
          } else if (yy == 9) {
            y = -1;
          }
          var g = (Math.sin(t + x*Math.sin(t)*0.7 + y*Math.cos(t*1.1)*0.7)*2 + 2)&3;
          var r = (Math.cos(t*1.3 + x*Math.sin(t*0.5)*0.9 + y*Math.cos(t*2.1)*0.3)*2 + 2)&3;
          data.push(12 + g * 16 + r);
        }
      }
      data.push(0x90, 0, data[1]);
      if (lpOut) lpOut.send(data);
      setTimeout(animate, 15);
    }
	}
	
	var args = location.search.substr(1).toLowerCase().split('&');
  var octave = parseInt(args[0]) || 12;
	if (args[0] == "ji")
		octave = 4296;
	var just3rd = location.search.toLowerCase().indexOf("j") > -1;

	function fromRatio(r) { return Math.round(Math.log(r)/Math.log(2) * octave) }
  var fifth = 1*args[2] || fromRatio(3/2);
  var major = 1*args[1] || fromRatio(5/4);
 
	var justDelta = Math.log(5/4)/Math.log(2) - major / octave;

	var cd = gcd(octave, gcd(fifth, major));
	if (cd != 1 && !args[1])
	{
		if (justDelta > 0) major++; else major--;
		var changed = "major";
		var other = octave / cd;
		cd = gcd(octave, gcd(fifth, major));
	  if (cd != 1)
		{
			major = fromRatio(5/4)
			fifth--; // only for 30 and 102?
  		var changed = "fifth";
		}
		alert("Shifted the " + 
					changed + 
					" interval to prevent the layout to be the same as " + 
					other);
	}
	var fourth = octave - fifth;
  var whole = fifth - fourth;
	var half = Math.floor(whole / 2) || 1;
	var quarter = Math.floor(half / 2) || 1;
	var majorScale = [0, whole, major, fourth, fifth, major + fourth, major + fifth, octave];	
	var minor = fifth - major;
	var minorScale = [0, whole, minor, fourth, fifth, minor + fourth, minor + fifth, octave];

	
	var circleNamesMaj = ["C", "F", "B", "E", "A", "D", "G", "C"]; 
	var circleNamesMin = ["e", "b", "f", "c", "g", "d", "a", "e"]; 
	var majors = [], minors = [];
  if (major == minor) {
    minors = majors;
    circleNamesMin = ["E", "B", "F", "C", "G", "D", "A", "E"];
  }
  var ud = "";
	function setName(arr, i, name, mod, num, den, d) 
	{
		i = (i + octave * octave) % octave;
		name += sign(mod);
		if (!arr[i])
			arr[i] = { toString: function() { return name }, num: num, den: den, mod: mod, d: d};
	}
	function sign(c)
	{
		if (c == 0)
			return ud;
		var s = "<b>♯</b>";
		if (c < 0) 
		{
			s = "<i>♭</i>";
			c = -c;
		}
		if (c == 1)
			return s + ud;
	  if (c == 2)
			return s + s + ud;
		return s + "<sup>" + c + "</sup>" + ud;
	}
	var comma = 4 * fifth - major;
  var comma1 = comma % octave;
  if (comma1 > octave / 2) comma1 -= octave;
  var commaSign = "<u>" + (comma1 < 0 ? "∧∧∧∧∧" : "∨∨∨∨∨").substr(0, Math.abs(comma1)) + "</u>";
	var octaveloop = octave / gcd(octave, fifth);
  if (major == minor && octaveloop == octave) octaveloop /= 2;
	if (octaveloop > 32)
		octaveloop = 1;
	function octDist(p) { return Math.min(p % octave, octave - (p % octave)) }
	for (var i = 0; i < octave; i++)
	{
    ud = '';
		setName(majors, i * fifth, circleNamesMaj[7 - (i % 7)], Math.floor((i + 1) / 7), 2 * Math.pow(3, i), Math.pow(4, i), i * 4 - 1);
		setName(majors, i * fourth, circleNamesMaj[i % 7], -Math.floor((i + 5) / 7), Math.pow(4, i), Math.pow(3, i), -i * 4 - 1);
    ud = just3rd ? '' : commaSign;
		setName(minors, (i - 4) * fourth - comma, circleNamesMin[7 - (i % 7)], -Math.floor((i + 1) / 7), Math.pow(4, i) * 5, Math.pow(3, i) * 4, -i * 4 + 1);
		setName(minors, (i + 4) * fifth - comma, circleNamesMin[i % 7], Math.floor((i + 5) / 7), Math.pow(3, i) * 5, Math.pow(4, i) * 4, i * 4 + 1);
		if (i > 0 && i < 32 && octDist(i * fifth) < octDist(octaveloop * fifth))
			octaveloop = i;
	}
  function gcd(a, b) 
	{
		if (b < 1) return a;
		return gcd(b, a % b);
	}

  var lumaKeys = 0;
  var keyboard = document.getElementById("keyboard");
	var range = Math.min(42, 2 * octave);
  for (var y = -range; y <= range; y++)
  {
    var isMinor = y & 1 == 1;
		var noteY = 5 * octave - (y * whole - isMinor * (2 * major - whole)) / 2;
		var x0 = -Math.floor((noteY - octave * (isLumatone ? 0 : 2)) / fourth);
    for (var x = x0; x <= octave * 9.2 / fourth + x0; x++)
    {
      var col = x*2 + isMinor;
      var row = (y + col) / 2;
      var lumaY = row - col / 3.5;
      var lumaX = col - row / 2;
      if (isLumatone && (lumaY < -4.15 || lumaY > 3.85 || lumaX > 15 || lumaX <= -15)) {
        continue;
      }
      lumaKeys ++;
      var note = x * fourth + noteY;
      var pitchClass = note % octave;
      var box = keyboard.appendChild(document.createElement("div"));
      box.className = "key";
			var p = x * 2 + y * 2 + isMinor;
      var y2 = p * 17;
			var x2 = (note - isMinor * (major - fifth / 2)) / octave * 230;
      box.style.left = (x2 + (isLumatone ? 200 : - 190)) + "px";
      box.style.top = (y2 + (isLumatone ? 400 : 1968)) + "px";
			var nm = (isMinor ? minors : majors)[pitchClass];
			if (octave == 4296)
			{ 
				var num = nm.num;
				var den = nm.den;
				if (num && den)
				{
					while (num < den) num *= 2;
					while (num >= den * 2) den *= 2;
				  var g = gcd(num, den);
					num /= g; den /= g;
					pitchClass = num < 1000 
					? num + ":" + den 
					  : Math.round((Math.log(num / den) / Math.log(2) % 1) * 120000) / 100;
					note = Math.log(num / den) / Math.log(2) * octave + (note - (note % octave));
				}
			}
      box.innerHTML = lumaX > 15 ? "X" : (nm||"") + "<sub>" + (octave != 12 ? pitchClass : '') + "</sub>";
      var h = (nm.d + 360) % (12 * 4) * 7.5 + 240; // (p * 180 / octaveloop + 60) % 360
      var d = Math.abs(nm.d) % (12 * 4);
      var l = d == 7 || d == 41 || d == 17 || d == 31 ? 10 : d < 12 || d > 36 ? 0 : 20;
      box.style.backgroundColor = "hsl(" + h + ", 25%, " + (l + 60) + "%)";
      box.note = note - 6 * octave;
      box.isMinor = isMinor;
    }
  }
	
	var isDown = {}, note = {};
	function ondown(e) {
		clearInterval(handler);
		
		var idx = e.identifier;
		isDown[idx] = true;
		onmove(e);
	}
	function onup(e) {
		var idx = e.identifier;
    noteOff(idx);
		delete isDown[idx];
		delete note[idx];
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
		if (tgt && tgt.note != note[idx])
		{
      noteOff(idx);
		  note[idx] = tgt.note;
      noteOn(tgt.note, tgt.isMinor, idx, 127);
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

			if (e.target.nodeName.toLowerCase() == "a")
				return;

			for (var i = 0; i < e.changedTouches.length; i++)
			{
				var t = e.changedTouches[i];
				var w = window.innerWidth;
				var h = window.innerHeight;
				var r = Math.min(w, h) / 3;
				var d = t.clientX - t.clientY;
				if (d < w - r && -d < h - r)
					e.preventDefault();

				ondown(t);
			}
		}
		document.documentElement.ontouchmove = function(e) {
			for (var i = 0; i < e.changedTouches.length; i++)
				onmove(e.changedTouches[i]);
      e.preventDefault();
		}
		document.documentElement.ontouchend = function(e) {
			for (var i = 0; i < e.changedTouches.length; i++)
				onup(e.changedTouches[i]);
      e.preventDefault();
		}
	}

	function scrollCenter() {
		window.scrollTo(1000 - window.innerWidth / 2, 2000 - window.innerHeight / 2);
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
    console.log("key count: ", lumaKeys);
    document.body.className = "lumatone";
  }
}