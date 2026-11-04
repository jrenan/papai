const assert = require('node:assert/strict');
const {choose, stageOf, evidence, independent, levelOf} = require('../soma/journey.js');
const gameOf = level => level < 3 ? 'friends' : 'blocks';
const examples = [
  [[1,1],[1,2],[1,3],[2,2]], [[1,5],[2,5],[3,5],[4,5]], [[5,6],[6,6],[6,7],[5,9]],
  [[10,2],[10,3],[12,6],[11,9]], [[20,4],[22,5],[14,12],[31,7]], [[18,7],[24,16],[36,17],[53,29]],
];
const solve = (level, pair, mistakes = 0, assisted = false) => ({
  game:gameOf(level),level,a:pair[0],b:pair[1],mistakes,assisted,
});
const history = [];
for (let i = 0; i < 6; i++) {
  assert.equal(stageOf(history),i);
  assert.equal(choose(history,gameOf(i),5).level,i);
  for (const pair of examples[i]) history.push(solve(i,pair));
  assert.ok(evidence(history,i).mastered);
}
assert.equal(stageOf(history),5);
assert.equal(independent(solve(0,[1,1],0,true)),false);
assert.equal(evidence(Array(8).fill(solve(0,[1,2])),0).mastered,false);
assert.equal(evidence([solve(0,[1,1]),solve(0,[1,2]),solve(0,[1,3])],0).mastered,false);
const support = history.slice(0,4).concat(solve(1,[2,5],1), solve(1,[1,5],0,true));
const review = choose(support,'friends',6);
assert.equal(review.level,0);
assert.equal(choose([...support,solve(0,[review.a,review.b])],'friends',7).level,1);
assert.equal(choose(history.filter(p => p.level === 3),'blocks',4).level,4);
for (let level = 0; level < 6; level++) {
  const before = history.filter(p => p.level < level);
  for (let n = 0; n < 300; n++) {
    const {a,b,level:selected} = choose(before,gameOf(level),5);
    assert.equal(selected,level);
    assert.equal(levelOf(gameOf(level),a,b),level);
    assert.ok(a >= 1 && b >= 1 && a+b <= (level < 3 ? 20 : 100));
    if (level < 3) assert.ok(Math.max(a,b) <= 10);
    if (level === 5) assert.ok(a%10 + b%10 >= 10);
  }
}
console.log('PASS learning progression, distinct facts, reviews, recovery, direct game entry and problem limits');
