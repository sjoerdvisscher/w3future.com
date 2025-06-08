var handlers = {};
var id = 1;

function poll(timestamp) {
  requestAnimationFrame(poll);
  var toRemove = [];
  for (var id in handlers) {
    if (handlers[id].timestamp <= timestamp) {
      toRemove.push(id);
      handlers[id].handler();
    } 
  }
  toRemove.forEach(id => delete handlers[id]);
}
requestAnimationFrame(poll);

export function setTimeoutHR(handler, delta) {
  if (!delta) {
    handler();
    return;
  }
  handlers[++id] = { handler, timestamp: performance.now() + delta }
  return id;
}

export function clearTimeoutHR(id) {
  delete handlers[id];
}