'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const q = require('../src/queue-tools');
const a = { kind:'file', source:'a.mp3', title:'A' };
const b = { kind:'file', source:'b.mp3', title:'B' };
const c = { kind:'file', source:'c.mp3', title:'C' };
test('kolejka: usuwanie, przenoszenie i błędne numery', () => {
  const queue = [a,b,c];
  assert.equal(q.remove(queue, 2), b);
  assert.deepEqual(queue, [a,c]);
  assert.equal(q.move(queue, 2, 1), c);
  assert.deepEqual(queue, [c,a]);
  assert.throws(() => q.remove(queue, 0), /numer/);
  assert.throws(() => q.move(queue, 1, 3), /numer/);
});
test('tasowanie zachowuje elementy; czyszczenie nie zmienia innych danych', () => {
  const queue = [a,b,c];
  assert.equal(q.shuffle(queue, () => 0), 3);
  assert.deepEqual(new Set(queue), new Set([a,b,c]));
  assert.equal(q.clear(queue), 3);
  assert.equal(queue.length, 0);
});
test('repeat one/all: poprawna kolejność i kopia tracka', () => {
  const queue = [b];
  assert.equal(q.requeueFinished(queue, a, 'one'), true);
  assert.deepEqual(queue.map(t => t.source), ['a.mp3','b.mp3']);
  assert.notEqual(queue[0], a);
  assert.equal(q.requeueFinished(queue, c, 'all'), true);
  assert.deepEqual(queue.map(t => t.source), ['a.mp3','b.mp3','c.mp3']);
});
test('repeat nie zapętla błędów, pomijania, radia, 24/7 ani testów', () => {
  for (const opts of [{ failed:true }, { skipped:true }, { continuous:true }]) {
    const queue = [];
    assert.equal(q.requeueFinished(queue, a, 'one', opts), false);
    assert.equal(queue.length, 0);
  }
  for (const track of [{kind:'radio'}, {kind:'diagnostic'}, null]) {
    assert.equal(q.requeueFinished([], track, 'all'), false);
  }
  assert.equal(q.requeueFinished([], a, 'off'), false);
  assert.equal(q.requeueFinished(new Array(100).fill(a), a, 'all'), false);
});
