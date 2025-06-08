export var presets = 
    { "Bosanquet":
      { o: "53"
      , n: "col * (2*fifth - o) + row * (7*fifth - 4*o)"
      , midiChannel: "section < 3 ? section + 14 : section - 2"
      , midiNote: "n - (section - 3) * o + 60 + 2*fifth - o"
      , h: "90 - whiteBlackRow * 6 / o * 360"
      , s: "abs(whiteBlackRow) * 12 / o * 100"
      , l: "isBlackKey ? 30 + s/3 : 100 - s/3" 
      , fifth: "steps(3/2)"
      , fifths: "mod(n*modInv(fifth,o) + o/2, o) - o/2"
      , whiteBlackRow: "round(fifths / 6) - (mod(fifths, 12) == 3 ? 1 : 0)"
      , isBlackKey: "mod(whiteBlackRow, 2) == 1"
      }
    , "Hemi-isomorphic chord layout":
      { o: "12"
      , n: "floor(col/2) * steps(3/2) + row * steps(9/8) + isMinor * steps(5/4) + 60"
      , midiChannel: "c + 1 + (c < 0 ? 16 : 0)"
      , midiNote: "n - c * o"
      , h: "isCorner ? -20 : isMinor ? 100 : 200"
      , s: "70"
      , l: "isCorner ? isCheckers ? isMinor ? 70 : 55 : isMinor ? 90 : 95 : isMinor ? isCheckers * 15 + 65 : isCheckers * 35 + 65"
      , isMinor: "col & 1"
      , isCorner: "d == 4 || d == 21 || d == 9 || d == 16"
      , isCheckers: "d <= 6 || d > 18"
      , c: "n > 127 ? ceil((n - 127) / o) : n < 0 ? floor(n / o) : 0"
      , d: "mod(col + 4*row, 24)"
      }
    , "Wicky-Hayden":
      { o: "31"
      , n: "fifths * steps(3/2) - splitCol * o + 62"
      , midiChannel: "channel + 1 + (channel < 0 ? 16 : 0)"
      , midiNote: "n - channel * o"
      , h: "90 - color * 6 / o * 360"
      , s: "abs(color) * 12 / o * 100"
      , l: "(n - 62) / o * 10 + 55 + (n == 62 ? 30 : 0)" 
      , tiltedCol: "col * 2 + row"
      , splitCol: "tiltedCol <= 0 ? col + 10 : col - 10"
      , splitRow: "tiltedCol <= 0 ? row - 5 : row + 5"
      , fifths: "splitCol * 2 + splitRow"
      , equivFifths: "mod(fifths + o/2, o) - o/2"
      , color: "round(equivFifths / 6) - (mod(equivFifths, 12) == 3 ? 1 : 0)"
      , channel: "n > 127 ? ceil((n - 127) / o) : n < 0 ? floor(n / o) : 0"
      }
    , "12-ET Harmonic Table":
      { o: "12"
      , n: "col * steps(5/4) + row * steps(3/2)"
      , midiChannel: "1"
      , midiNote: "n + 60"
      , h: "color*90"
      , s: "70"
      , l: "70"
      , color: "[[1,1,2,1],[1,1,0,1],[3,0,0,0]][blockX][blockY]"
      , blockX: "mod(col+floor((row+1)/4), 3)"
      , blockY: "mod(row, 4)"
      }
    , "24-ET Stretched Bosanquet":
      { o: "24"
      , n: "col * steps(9/8) + row * (3*steps(9/8) - steps(4/3)) / 2 + 60"
      , midiChannel: "c + 1 + (c < 0 ? 16 : 0)"
      , midiNote: "n - c * o"
      , h: "90 - e * 12 / o * 360"
      , s: "abs(e) * 24 / o * 100"
      , l: "(mod(e, 2) == 1 ? 30 + s/3 : 100 - s/3) * (3 - (row&1))/3"
      , c: "n > 127 ? ceil((n - 127) / o) : n < 0 ? floor(n / o) : 0"
      , e: "round(f / 6) - (mod(f, 12) == 3 ? 1 : 0)"
      , f: "mod(g + o/4, o/2) - o/4"
      , g: "col * 2 + round(row/2) * 7"
      }
    , "56-ET Polychromatic":
      { o: "56"
      , n: "0"
      , midiChannel: "chroma + 1"
      , midiNote: "col+16 + floor(chroma/2) + (chroma==5||chroma==7)"
      , h: "[0,30,60,90,120,180,240,300][chroma]"
      , s: "[100,100,100,0,100,100,100,100][chroma]"
      , l: "[60,60,50,100,50,45,60,40][chroma] * (mod(col,7)==6?0.7:1)"
      , chroma: "3 - floor(y/7)"
      }
    , "30-ET à la @bdeister":
      { o: "30"
      , n: "col * 5 + row * 2 + 60"
      , midiChannel: "c + 1 + (c < 0 ? 16 : 0)"
      , midiNote: "n - c * o"
      , h: "[120, 120, 80, 180, 80][color]"
      , s: "[100, 100, 30, 30, 90][color]"
      , l: "[80, 10, 60, 80, 80][color]"
      , color: "[1,4,2,0,3,1,3,1,0,4,2,3,1,0,4,2,3,1,0,4,2,3,1,0,3,1,4,2,0,3][mod(n, 30)]"
      , c: "n > 127 ? ceil((n - 127) / o) : n < 0 ? floor(n / o) : 0"
      }
    , "Rainbow": 
      { h: "x * 1.6 - 230"
      , s: "100"
      , l: "50 - y * 1.6"
      , midiChannel: "1", midiNote: "60 - y"
      , o: 12, n: 0
      }
    , "Color Check": 
      { h: "section * 72 - 36"
      , s: "x*2 - section * 90 + 340"
      , l: "y + 60"
      , midiChannel: "section", midiNote: "ix + 33"
      , o: 12, n: 0
      }
    };