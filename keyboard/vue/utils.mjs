export function calcGen(octave, Lstep, sstep, Lnum, snum) {
  if (Lstep < sstep) return calcGen(octave, sstep, Lstep, snum, Lnum);
  if (Lnum == snum) return { repeats: snum, generator: sstep, period: octave / snum };
  return Lnum > snum
    ? calcGen(octave, Lstep + sstep, Lstep, snum, Lnum - snum)
    : calcGen(octave, Lstep + sstep, sstep, Lnum, snum - Lnum);
}

var mosCache = {};
export function allMOSsteps(octave, Lnum, snum) {
  mosCache[octave] = mosCache[octave] || {};
  var Lstep, sstep, res = [];
  var mos = `${Lnum}L${snum}s`;
  if (mosCache[octave][mos])
    return mosCache[octave][mos];
  for (Lstep = Math.floor(octave / (Lnum + snum))
       ; sstep = Math.round((octave - Lstep * Lnum) / snum)
       , Lstep * Lnum < octave
       ; Lstep++) {
    if (Lnum * Lstep + snum * sstep == octave && (Lstep > sstep || (Lstep == sstep && Lnum >= snum)))
      res.push({ mos, Lstep, sstep, Lnum, snum, genPer: calcGen(octave, Lstep, sstep, Lnum, snum) })
  }
  return res;
}
export function MOSsteps(octave, Lnum, snum, generator) {
  var allMOS = allMOSsteps(octave, Lnum, snum);
  if (generator) {
    var mos = allMOS.find(mos => mos.genPer.generator == generator);
    if (mos) return mos;
  }
  allMOS.sort((a, b) => a.Lstep - b.Lstep);
  return allMOS[0];
}

export function fromRatio(octave, r, other) { 
  var fraq = Math.log(r)/Math.log(2) * octave;
  var note = Math.round(fraq);
  while (note < 0) note += octave;
  note = note % octave;
  return other ? note > fraq ? note - 1 : note + 1 : note;
}

export function gcd(a, b) 
{
  if (b < 1) return a;
  return gcd(b, a % b);
}


