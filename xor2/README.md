# XOR2

The idea of this piece was to play with 31 tone equal temperament and the fact that 31 is 11111 in binary. It starts with the four notes C (00000), D (00101), E♭ (01000) and G (10010) which don't share any 1 bits. All the possible ways of XORing these values together gives the C melodic minor scale. The first sequence of 8 chords is created by XORing the four notes of the initial chord with each note of the scale. The 8 sequences of 8 chords are created by again XORing by a note from the scale and at the same time transposing it down by that same value.

This is the sequence of notes this program generates (transposed to D for readability and symmetry):

```
D,A,F,E → E,B,G,D → F,C,D,G → G,D,E,F → A,D,C,B → B,E,D,A → C,F,A,D → D,G,B,C
D,G,F,E → E,A,G,D → F,Bb,D,G → G,C,E,F → G,D,Bb,A → A,E,C,G → Bb,F,G,C → C,G,A,Bb
D,G,B,E → E,A,C#,D → B,E,D,C# → C#,F#,E,B → G,D,E,A → A,E,F#,G → E,B,G,F# → F#,C#,A,E
D,A,B,E → E,B,C#,D → B,F#,D,C# → C#,G#,E,B → A,D,F#,B → B,E,G#,A → F#,B,A,G# → G#,C#,B,F#
D,A,B,C → C,G,A,D → B,F#,D,A → A,E,C,B → A,D,F#,G → G,C,E,A → F#,B,A,E → E,A,G,F#
D,G,B,C → C,F,A,D → B,E,D,A → A,D,C,B → G,D,E,F → F,C,D,G → E,B,G,D → D,A,F,E
D,G,F,C → C,F,Eb,D → F,Bb,D,Eb → Eb,Ab,C,F → G,D,Bb,F → F,C,Ab,G → Bb,F,G,Ab → Ab,Eb,F,Bb
D,A,F,C → C,G,Eb,D → F,C,D,Eb → Eb,Bb,C,F → A,D,C,G → G,C,Bb,A → C,F,A,Bb → Bb,Eb,G,C
```