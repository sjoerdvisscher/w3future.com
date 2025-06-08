import { gcd } from "./utils.mjs";
import { Key } from "./key.mjs";

export const Keyboard = {
  inject: ['rt'],
  provide() { return { keybProv: this.keybProv } },
  computed: {
    keybProv() {
      return {
        majors: this.majors,
        minors: this.minors,
        lumaAlt: this.lumaAlt,
        lumaSwap: this.lumaSwap,
        basicLs: this.basicLs,
        octaveloop: this.octaveloop,
      }      
    },
    keys() {
      var keys = [];
      var range = 20 // Math.min(50, 4 * this.rt.octave);
      var center;
      var keysByCoords = {}, keysByNote = {}, keysByLuma = {};
      for (var y = -range; y <= range; y++)
      {
        var isMinor = y & 1 == 1;
        var noteY = 5 * this.rt.octave - (y * this.rt.ystep - isMinor * (2 * this.rt.steps.Lstep + this.rt.ystep)) / 2;
        var x0 = Math.min(-range, Math.max(
          (0 - noteY) / (this.rt.steps.Lstep + this.rt.steps.sstep + this.rt.ystep),
          (-100 - y * this.rt.Lsnum) / Math.abs(this.rt.ynum - this.rt.Lsnum) / 2
        ));
        var x1 = Math.max(range, Math.min(
          (10 * this.rt.octave - noteY) / (this.rt.steps.Lstep + this.rt.steps.sstep + this.rt.ystep),
          (100 - y * this.rt.Lsnum) / Math.abs(this.rt.ynum - this.rt.Lsnum) / 2
        ));
        for (var x = Math.ceil(x0); x <= x1; x++) {
          keys.push({x, y, note: x * (this.rt.steps.Lstep + this.rt.steps.sstep + this.rt.ystep) + noteY, isMinor })
        }
      }
      return keys;
    },
    basicLs() { return /*Lstep == sstep ? Lnum + snum / 2 :*/ this.rt.steps.Lnum * 2 + this.rt.steps.snum },
    lumaAlt() { return this.rt.steps.ynum > 2 * this.rt.steps.Lsnum },
    lumaSwap() { return this.rt.steps.ynum < this.rt.steps.Lsnum },
    bigGcd() { return gcd(gcd(this.rt.steps.Lstep, this.rt.steps.sstep), gcd(this.rt.ystep, this.rt.octave)) },
    octaveloop() { return (this.rt.steps.Lstep == this.rt.steps.sstep ? this.rt.octave / 2 : this.rt.octave) / this.bigGcd },
    names() {
      var circleNamesMaj = ["C", "F", "B", "E", "A", "D", "G", "C"]; 
      var circleNamesMin = ["e", "b", "f", "c", "g", "d", "a", "e"]; 
      var majors = [], minors = [];
      if (this.rt.steps.Lstep == this.rt.steps.sstep) {
        minors = majors;
        circleNamesMin = ["E", "B", "F", "C", "G", "D", "A", "E"];
      }
      if (this.rt.steps.Lstep < this.rt.steps.sstep) {
        circleNamesMaj = ["e", "b", "f", "c", "g", "d", "a", "e"]; 
        circleNamesMin = ["C", "F", "B", "E", "A", "D", "G", "C"]; 
        if (this.rt.steps.Lstep == this.rt.steps.sstep) {
          circleNamesMaj = ["E", "B", "D", "C", "G", "D", "A", "E"]; 
        }
      }
      var rt = this.rt;
      function setName(arr, ibase, namebase, mod, num, den, udbase) 
      {
        for (var j = -Math.floor(comDen / 2); j < comDen / 2; j++) {
          var i = (ibase + j + rt.octave * rt.octave) % rt.octave;
          var ud = (udbase || 0) + j;
          var name = rt.sharp <= 0 ? updown(rt.sharp * mod + ud) + namebase : updown(ud) + namebase + sign(mod);
          if (!arr[i] || ((arr[i].mod && arr[i].ud) && !mod && !ud) || (rt.sharp <= 0 && Math.abs(rt.sharp*arr[i].mod + arr[i].ud) > Math.abs(rt.sharp*mod + ud)))
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
      var comma = this.rt.ls == '5L2s' ? this.rt.major >= this.rt.minor ? 4 * this.rt.fifth - this.rt.major : 3 * this.rt.fourth - this.rt.major : this.rt.sharp == 1 ? 0 : 1;
      var comma1 = comma % this.rt.octave;
      if (comma1 > this.rt.octave / 2) comma1 -= this.rt.octave;
      var commaSign    = -comma1;
      var negCommaSign = comma1;
      var niceUD = (this.rt.sharp <= 0 || Math.abs(comma1) < this.rt.sharp);
      var comDen = gcd(this.rt.octave, this.rt.fifth);
      var octaveloop = this.rt.octave / comDen;
      if (this.rt.steps.Lstep == this.rt.steps.sstep && octaveloop == this.rt.octave) octaveloop /= 2;
      if (octaveloop > 55)
        octaveloop = 1;
      function octDist(p) { return Math.min(p % rt.octave, rt.octave - (p % rt.octave)) }
      for (var i = 0; i < this.rt.octave; i++)
      {
        var ud = this.rt.octave == 4296 ? '' : negCommaSign;
        if (this.rt.steps.Lstep >= this.rt.steps.sstep) {
          setName(majors, i * this.rt.fifth, circleNamesMaj[7 - (i % 7)], Math.floor((i + 1) / 7), 2 * Math.pow(3, i), Math.pow(4, i), '');
          setName(majors, i * this.rt.fourth, circleNamesMaj[i % 7], -Math.floor((i + 5) / 7), Math.pow(4, i), Math.pow(3, i), '');
          if (niceUD) {
            setName(majors, i * this.rt.fifth + comma, circleNamesMaj[7 - (i % 7)], Math.floor((i + 1) / 7), 2 * Math.pow(3, i), Math.pow(4, i), ud);
            setName(majors, i * this.rt.fourth + comma, circleNamesMaj[i % 7], -Math.floor((i + 5) / 7), Math.pow(4, i), Math.pow(3, i), ud);
          }
        } else {
          setName(majors, (i - 4) * this.rt.fourth, circleNamesMaj[7 - (i % 7)], -Math.floor((i + 1) / 7), 2 * Math.pow(3, i), Math.pow(4, i), '');
          setName(majors, (i + 4) * this.rt.fifth, circleNamesMaj[i % 7], Math.floor((i + 5) / 7), Math.pow(4, i), Math.pow(3, i), '');    
          if (niceUD) {
            setName(majors, (i - 4) * this.rt.fourth + comma, circleNamesMaj[7 - (i % 7)], -Math.floor((i + 1) / 7), 2 * Math.pow(3, i), Math.pow(4, i), ud);
            setName(majors, (i + 4) * this.rt.fifth + comma, circleNamesMaj[i % 7], Math.floor((i + 5) / 7), Math.pow(4, i), Math.pow(3, i), ud);    
          }
        }
        var ud = this.rt.octave == 4296 ? '' : commaSign;
        if (this.rt.steps.Lstep >= this.rt.steps.sstep) {
          setName(minors, (i - 4) * this.rt.fourth - comma, circleNamesMin[7 - (i % 7)], -Math.floor((i + 1) / 7), Math.pow(4, i) * 5, Math.pow(3, i) * 4, ud);
          setName(minors, (i + 4) * this.rt.fifth - comma, circleNamesMin[i % 7], Math.floor((i + 5) / 7), Math.pow(3, i) * 5, Math.pow(4, i) * 4, ud);
          if (niceUD) {
            setName(minors, (i - 4) * this.rt.fourth, circleNamesMin[7 - (i % 7)], -Math.floor((i + 1) / 7), Math.pow(4, i) * 5, Math.pow(3, i) * 4, '');
            setName(minors, (i + 4) * this.rt.fifth, circleNamesMin[i % 7], Math.floor((i + 5) / 7), Math.pow(3, i) * 5, Math.pow(4, i) * 4, '');
          }
        } else {
          setName(minors, i * this.rt.fifth - comma, circleNamesMin[7 - (i % 7)], Math.floor((i + 1) / 7), Math.pow(4, i) * 5, Math.pow(3, i) * 4, ud);
          setName(minors, i * this.rt.fourth - comma, circleNamesMin[i % 7], -Math.floor((i + 5) / 7), Math.pow(3, i) * 5, Math.pow(4, i) * 4, ud);
          if (niceUD) {
            setName(minors, i * this.rt.fifth, circleNamesMin[7 - (i % 7)], Math.floor((i + 1) / 7), Math.pow(4, i) * 5, Math.pow(3, i) * 4, '');
            setName(minors, i * this.rt.fourth, circleNamesMin[i % 7], -Math.floor((i + 5) / 7), Math.pow(3, i) * 5, Math.pow(4, i) * 4, '');
          }
        }
        if (i > 0 && i < 55 && octDist(i * this.rt.fifth) < octDist(octaveloop * this.rt.fifth))
          octaveloop = i;
      }
      return {majors, minors}
    },
    majors() { return this.names.majors },
    minors() { return this.names.minors },
  },
  components: {
    Key
  },
  template: `
    <div id="keyboard">
      <key v-for="key in keys" :x="key.x" :y="key.y" :note="key.note" :isMinor="key.isMinor"></key>
    </div>
  `
}