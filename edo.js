function calcEdo(octave, major, fifth) {
  function fromRatio(r) { return Math.round(Math.log(r)/Math.log(2) * octave) }
  fifth = fifth || fromRatio(3/2);
  major = major || fromRatio(5/4);
 
	var fourth = octave - fifth;
  var whole = fifth - fourth;
	var majorScale = [0, whole, major, fourth, fifth, major + fourth, major + fifth, octave];	
	var minor = fifth - major;
	var minorScale = [0, whole, minor, fourth, fifth, minor + fourth, minor + fifth, octave];

	var circleNamesMaj = ["D", "G", "C", "F", "B", "E", "A", "D"]; 
	var circleNamesMin = ["d", "a", "e", "b", "f", "c", "g", "d"]; 
	var majors = [], minors = [];
	function setName(arr, i, name, mod) 
	{
		i = (i + octave * octave) % octave;
		name += sign(mod);
		if (!arr[i])
			arr[i] = name;
	}
	function sign(c)
	{
		return c == 0 ? "" : c < 0 
      ? "♭" + sign(c + 1)
      : "♯" + sign(c - 1);
	}
	var comma = 4 * fifth - major;
	for (var i = 0; i < octave; i++)
	{
		setName(majors, i * fifth, circleNamesMaj[7 - (i % 7)], Math.floor((i + 3) / 7));
		setName(majors, i * fourth, circleNamesMaj[i % 7], -Math.floor((i + 3) / 7));
		setName(majors, (i - 4) * fourth - comma, circleNamesMin[7 - (i % 7)], -Math.floor((i + 3) / 7));
		setName(majors, (i + 4) * fifth - comma, circleNamesMin[i % 7], Math.floor((i + 3) / 7));
	} 
  return majors;
}