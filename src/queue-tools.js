'use strict';
// BOBER 4.0: narzędzia kolejki bez zależności od Discorda lub FFmpeg.
const LIMIT = 100;
function assertQueue(queue) {
  if (!Array.isArray(queue)) throw new Error('Niepoprawna kolejka.');
}
function at(queue, position) {
  assertQueue(queue);
  if (!Number.isInteger(position) || position < 1 || position > queue.length)
    throw new Error('Nieprawidłowy numer utworu w kolejce (od 1 do ' + queue.length + ').');
  return position - 1;
}
function remove(queue, position) {
  return queue.splice(at(queue, position), 1)[0];
}
function move(queue, from, to) {
  const i = at(queue, from), j = at(queue, to);
  const item = queue.splice(i, 1)[0];
  queue.splice(j, 0, item);
  return item;
}
function shuffle(queue, random = Math.random) {
  assertQueue(queue);
  for (let i = queue.length - 1; i > 0; i--) {
    const r = Number(random());
    if (!Number.isFinite(r) || r < 0 || r >= 1) throw new Error('Nieprawidłowy generator losowania.');
    const j = Math.floor(r * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue.length;
}
function clear(queue) {
  assertQueue(queue);
  const count = queue.length;
  queue.length = 0;
  return count;
}
// Do ponowienia kwalifikują się tylko pełne utwory, nigdy radio, test OGG,
// pominięty utwór ani źródło, które zakończyło się błędem.
function requeueFinished(queue, track, mode, opts = {}) {
  assertQueue(queue);
  if (!['one', 'all'].includes(mode) || !track || opts.failed || opts.skipped ||
      opts.continuous || !['file', 'youtube', 'stream'].includes(track.kind) ||
      queue.length >= LIMIT) return false;
  if (mode === 'one') queue.unshift({ ...track });
  else queue.push({ ...track });
  return true;
}
module.exports = { LIMIT, at, remove, move, shuffle, clear, requeueFinished };
