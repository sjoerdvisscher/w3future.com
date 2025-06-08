import { allMOSsteps, MOSsteps, fromRatio } from "./utils.mjs";

export const Tuning = {
  inject: ['rt', 'ag'],
  data() {
    return {}
  },
  methods: {
    mosArgs({mos, genPer: {generator: g}}) {
      return mos + (this.ag.alt ? '&alt' : '') + '&gen=' + g;
      // location.href = `?${octave}&${ls}${this.value}${args.groups.gen ? '&gen=' + args.groups.gen : ''}${location.hash}`; 
    },
    sortedObj(obj) {
      var res = {};
      var keys = Object.keys(obj);
      keys.sort();
      keys.forEach(key => res[key] = obj[key]);
      return res;
    }
  },
  computed: {
    octaves() {
      var octave = this.rt.octave;
      var octInfo = {};
      // octInfo[1*Lnum + 1*snum] = '(Equalized)';
      // octInfo[3*Lnum + 4*snum] = '(Anti Supersoft)';
      // octInfo[2*Lnum + 3*snum] = '(Anti Soft)';
      // octInfo[3*Lnum + 5*snum] = '(Anti Semisoft)';
      // octInfo[1*Lnum + 2*snum] = '(Anti Basic)';
      // octInfo[2*Lnum + 5*snum] = '(Anti Semihard)';
      // octInfo[1*Lnum + 3*snum] = '(Anti Hard)';
      // octInfo[1*Lnum + 4*snum] = '(Anti Superhard)';
      // octInfo[4*Lnum + 3*snum] = '(Supersoft)';
      // octInfo[3*Lnum + 2*snum] = '(Soft)';
      // octInfo[5*Lnum + 3*snum] = '(Semisoft)';
      // octInfo[2*Lnum + 1*snum] = '(Basic)';
      // octInfo[5*Lnum + 2*snum] = '(Semihard)';
      // octInfo[3*Lnum + 1*snum] = '(Hard)';
      // octInfo[4*Lnum + 1*snum] = '(Superhard)';
      for (var tot = 18; tot >= 2; tot--) {
        for (var s = Math.max(1, tot - 9); s <= Math.min(9, tot - 1); s++) {
          var L = tot - s;
          octInfo[L*this.rt.steps.Lnum + s*this.rt.steps.snum] = L >= s ? `(L=${L}, s=${s})` : `(s=${L}, L=${s})`;
        }
      }
      octInfo[octave] = `(L=${this.rt.steps.Lstep}, s=${this.rt.steps.sstep})`
      var result = [];
      for (var oct = 5; oct <= 100; oct++) {
        if (octave >= 100 && oct == 100) oct = octave;
        result.push({ oct, text: `${oct}edo ${octInfo[oct] || ''}` })
      }
      return result;
    },
    MOSses() {
      var MOSgenPer = {};
      for (var n = 2; n <= Math.min(this.rt.octave, 40); n++) {
        for (var l = 1; l < n; l++) {
          var allMOS = allMOSsteps(this.rt.octave, l, n - l);
          allMOS.forEach(mos => {
            var {Lstep, sstep, genPer: {repeats, generator:g}} = mos;
            if ((g != this.rt.generator || repeats != this.rt.steps.genPer.repeats) && ((l == 1 && Lstep >= 2*sstep) || n < 5 || n > 15)) return;
            MOSgenPer[repeats] = MOSgenPer[repeats] || {};
            MOSgenPer[repeats][g] = MOSgenPer[repeats][g] || [];
            MOSgenPer[repeats][g].push(mos);
          })
        }
      }
      if (this.rt.steps.sstep == 0)
        MOSgenPer[this.rt.steps.genPer.repeats][this.rt.steps.genPer.generator].push(this.rt.steps);      
      return MOSgenPer;
    },
    generators() {
      var allMOS = allMOSsteps(this.rt.octave, this.rt.steps.Lnum, this.rt.steps.snum).concat(
        this.rt.steps.Lnum == this.rt.steps.snum ? [] : allMOSsteps(this.rt.octave, this.rt.steps.snum, this.rt.steps.Lnum));
      allMOS.sort((a, b) => a.genPer.generator - b.genPer.generator);
      return allMOS.map(mos => {
        var gen = mos.genPer.generator;
        var ct = Math.round(1200*gen/this.rt.octave);
        return {mos, gen, ct}
      })
    },
    altOpts() {
      var altOpts = {'': 'Non-alternating'};
      if (this.rt.ls == '5L2s') {
        var min3 = Math.min(this.rt.major, this.rt.whole + 1);
        var max3 = Math.max(this.rt.major, this.rt.fourth - 1);
        for (var trd = min3; trd <= max3; trd++) {
          var name = {
            [this.rt.fifth - this.rt.whole - this.rt.whole]: 'pyth. minor',
            [this.rt.whole + this.rt.whole]: 'pyth. major',
            [fromRatio(this.rt.octave, 6/5)]: '6/5 minor',
            [fromRatio(this.rt.octave, 5/4)]: '5/4 major',
            [this.rt.fifth/2]: 'neutral',
          }[trd] || '';
          altOpts['alt=' + trd] = `e=${trd} ${name}`;
        }
        this.ag.alt = this.ag.alt ? 'alt=' + (this.ag.L && !this.ag.third ? 2*this.rt.whole : this.rt.major) : '';
      } else {
        // altOpts['alt'] = "Alternating"
        for (var a = 1; a < this.rt.Lstep + this.rt.sstep; a++) {
          var b = this.rt.Lstep + this.rt.sstep - a;
          var alt = this.rt.ystep + a;
          var sizes = [this.rt.ystep, a, b];
          sizes.sort((a, b) => b - a);
          var LMS = sizes[0] == sizes[1] || sizes[1] == sizes[2] 
            ? `L=${sizes[0]} s=${sizes[2]}` 
            : `L=${sizes[0]} M=${sizes[1]} s=${sizes[2]}`;
          altOpts['alt=' + alt] = `${a},${b} (${LMS})`;
        }
        this.ag.alt = this.ag.alt ? 'alt=' + (this.ag.third ? this.rt.ystep + this.rt.Lstep : this.rt.Lstep + this.rt.sstep) : '';
      }
      return altOpts;
    }
  },
  template: `
    <div id="tuning">
      <select id="octave" v-model="rt.octave"><option v-for="{oct, text} in octaves" :value="oct" :key="oct">{{text}}</option></select>
      <select id="mos" v-model="rt.steps"><optgroup label="MOS scale"></optgroup>
        <template  v-for="(gens, r) in sortedObj(MOSses)" :key="r">
          <optgroup :label="'###### ' + r + ' period' + (r>1?'s':'') + ' ######'"></optgroup>
          <optgroup v-for="(genMOSses, g) in gens" :key="g" :label="'gen: ' + g + ' ' + Math.round(1200*g/rt.octave) + 'ct'">
            <option v-for="mos in genMOSses" :value="mos" :key="mos.mos">{{mos.mos}} (L={{mos.Lstep}}, s={{mos.sstep}})</option>
          </optgroup>
        </template>
      </select>
      <select id="gen" v-model="rt.steps" :style="{ display: generators.length ? '' : 'none' }"><optgroup label="Generator"></optgroup>
        <option v-for="{mos, gen, ct} in generators" :value="mos" :key="gen">gen: {{gen}} {{ct}}ct</option>
      </select>
      <select id="third" v-model="ag.alt">
        <option v-for="(text, val) in altOpts" :value="val" :key="val">{{text}}</option>
      </select>
    </div>
  `
}
