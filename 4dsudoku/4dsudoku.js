var input = [
  [
    [[1, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[0, 0, 0], [0, 0, 2], [3, 0, 0]],
    [[0, 0, 0], [0, 0, 0], [0, 0, 4]]
  ],
  [
    [[0, 5, 0], [0, 0, 0], [0, 0, 0]],
    [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[0, 0, 0], [0, 0, 0], [0, 6, 0]]
  ],
  [
    [[7, 0, 0], [0, 0, 0], [0, 0, 0]],
    [[0, 0, 0], [8, 0, 0], [0, 0, 0]],
    [[0, 0, 2], [0, 0, 0], [0, 0, 9]]
  ]
];

var data = [];

function init() {
  for (var v = -1; v <= 1; v++) {
    data[v] = [];
    for (var y = -1; y <= 1; y++) {
      data[v][y] = [];
      for (var u = -1; u <= 1; u++) {
        data[v][y][u] = [];
        for (var x = -1; x <= 1; x++) {
          var o = (data[v][y][u][x] = {});
          o.el = document.body.appendChild(document.createElement("input"));
          o.el.value = input[v + 1][y + 1][u + 1][x + 1] || "";
        }
      }
    }
  }
  draw();
}

var units = {
  v: [1, 0, 0, 0],
  y: [0, 1, 0, 0],
  u: [0, 0, 1, 0],
  x: [0, 0, 0, 1]
};

function draw() {
  for (var v = -1; v <= 1; v++) {
    var vv = units.v.times(v);
    for (var y = -1; y <= 1; y++) {
      var vy = units.y.times(y).add(vv);
      for (var u = -1; u <= 1; u++) {
        var vu = units.u.times(u).add(vy);
        for (var x = -1; x <= 1; x++) {
          var vx = units.x.times(x).add(vu);
          var s = data[v][y][u][x].el.style;
          s.left = vx[2] * 80 + vx[3] * 24 + 400 + "px";
          s.top = vx[0] * 80 + vx[1] * 24 + 150 + "px";
        }
      }
    }
  }
}

Array.prototype.times = function(x) {
  var a = [];
  for (var i = 0; i < this.length; i++) a[i] = this[i] * x;
  return a;
};
Array.prototype.add = function(that) {
  var a = [];
  for (var i = 0; i < this.length; i++) a[i] = this[i] + that[i];
  return a;
};

var angle = Math.PI / 20;
var cosa = Math.cos(angle);
var sina = Math.sin(angle);
function rotate(a, b, count) {
  count = count || 0;
  if (count == 10) return;

  for (var d in units) {
    var vec = units[d];
    var x = vec[a];
    var y = vec[b];
    vec[a] = round(cosa * x + sina * y);
    vec[b] = round(-sina * x + cosa * y);
  }
  draw();

  setTimeout(function() {
    rotate(a, b, count + 1);
  }, 30);
}

function round(x) {
  return Math.abs(Math.round(x) - x) < 0.001 ? Math.round(x) : x;
}
