

export const Key = {
  props: ['x', 'y', 'isMinor', 'note'],
  inject: ['rt', 'isLumatone', 'keybProv'],
  computed: {
    majors() { return this.keybProv.majors; },
    minors() { return this.keybProv.minors; },
    lumaAlt() { return this.keybProv.lumaAlt; },
    lumaSwap() { return this.keybProv.lumaSwap; },
    octaveloop() { return this.keybProv.octaveloop; },
    basicLs() { return this.keybProv.basicLs; },
    style() {
      var y2 = this.p * 17 * 4 / (2 * this.rt.Lsnum);
      var x2 = (this.note - this.isMinor * (this.rt.steps.Lstep - this.rt.steps.sstep) / 2) / this.rt.octave * 230 * (2 * this.rt.Lsnum) / 4;
      if (this.isLumatone) {
        y2 = this.lumaY * 70;
        x2 = this.lumaX * 60 + this.lumaY * 15;
      }
      var dx = this.isLumatone ? 1200 : 200;
      var dy = this.isLumatone ? 400 : 2000;
      // if (!x && !y) center = {x: x2 + dx + 100, y: y2 + dy + 50};
      return {
        left: (x2 + dx) + "px",
        top: (y2 + dy) + "px",
        backgroundColor: this.bgColor,
      };
    },
    p() { return (this.x * 2 + this.isMinor) * (this.rt.ynum - this.rt.Lsnum) + this.y * this.rt.Lsnum; },
    col() { return this.x*2 + this.isMinor },
    row() { return (this.y + this.col) / 2 },
    pitchClass() { return this.note % this.rt.octave },
    nm() { return (this.isMinor ? this.minors : this.majors)[this.pitchClass]?.name },
    lumaX() { return this.lumaAlt ? this.col / 2 - this.row / 2 : this.lumaSwap ? this.col / 2 + this.row / 2 : this.col - this.row / 2 },
    lumaY() { return this.lumaAlt ? this.col * 5 / 7 + this.row : this.lumaSwap ? this.col * 5 / 7 - this.row : this.row - this.col * 2 / 7 },
    bgColor() {
      var d = Math.abs((this.col * 2 * (2*this.rt.Lsnum - this.rt.ynum) - 4 * this.rt.Lsnum * this.row + (this.rt.major < this.rt.minor ? -3 : -1) + (100 + 2) * this.octaveloop) % (4 * this.octaveloop) - 2 * this.octaveloop);
      var numSum = this.rt.steps.Lnum + this.rt.steps.snum
      var isCorner = numSum % 2 == 1 
        ? d == numSum || d == 2 * this.basicLs + numSum || (this.rt.steps.Lstep != this.rt.steps.sstep && (d == 2 * this.basicLs - numSum || d == 4 * this.basicLs - numSum))
        : (d == 1 && this.pitchClass == 0) || d == 2 * this.basicLs - 1 || d == 2 * this.basicLs + 1 || d == 4 * this.basicLs - 1;
      var checkers = d == this.basicLs || d == 3*this.basicLs ? 0.65 : (d < this.basicLs || d > 3 * this.basicLs);
      var h = isCorner ? -20 : this.isMinor ? 100 : 200;
      var l = this.isMinor && this.rt.steps.Lstep != this.rt.steps.sstep ? checkers * 15 + 65 : checkers * 35 + 65;
      if (isCorner) l = checkers ? this.isMinor ? 70 : 55 : this.isMinor ? 90 : 95;
      var strangeness = 0.5 - 0.5 * Math.cos(this.p * Math.PI / this.octaveloop);
      var s = 25 + 10 * strangeness;
      l -= (120 - l) * strangeness * 0.3;
      
      return "hsl(" + h + ", " + s + "%, " + l + "%)";
    }
  },
  template: `
    <div class="key" :style="style"><span v-html="nm"></span><sub>{{rt.octave != 12 ? '' + [pitchClass] : ''}}</sub></div>
  `
}

