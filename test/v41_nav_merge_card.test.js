// v41: phone nav per role, Merge/Delete client rules, and the Ready-tab "[object Object]" card bug.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const sw = fs.readFileSync(__dirname + '/../sw.js', 'utf8');

function grab(name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'missing ' + name);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unclosed ' + name);
}
function grabVar(name) {
  const start = src.indexOf('var ' + name + ' =');
  assert.ok(start >= 0, 'missing var ' + name);
  const open = src.slice(start).search(/[\[{]/) + start, o = src[open], c = o === '[' ? ']' : '}';
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === o) depth++;
    else if (src[i] === c) { depth--; if (depth === 0) return src.slice(start, i + 1) + ';'; }
  }
  throw new Error('unclosed var ' + name);
}

const ctx = {
  S: { m: { stages: ['new', 'punched', 'allocated', 'picked', 'checked', 'billed', 'packed', 'dispatched', 'delivered', 'cancelled'], stage_label: {} }, user: { name: 'T', role: 'admin' } },
  R: 'admin', location: { hash: '#/q' }, console
};
ctx.role = () => ctx.R;
ctx.isAdmin = () => ctx.R === 'admin';
vm.createContext(ctx);
const fns = ['can', 'navItemsFor', 'mergeOk', 'deleteReasonOk', 'buildMergeRequest',
  'card', 'cardInner', 'pendingWarnHtml', 'h', 'pcs', 'formatBoxes', 'parseBoxTypes', 'dmy', 'slaBadge', 'tm', 'left', 'mins', 'slaNow',
  'badges', 'planBadge', 'srcOf', 'pill', 'stageLbl', 'dealerLinkHtml', 'dealerHref', 'isCurrentDealerFilter', 'hashQuery', 'ono', 'trk'];
vm.runInContext(grabVar('NAV') + grabVar('NAV_PRIMARY') + fns.map(grab).join('\n'), ctx);

let passed = 0;
function t(name, fn) { fn(); passed++; console.log('ok -', name); }

const ROLES = ['admin', 'warehouse_manager', 'biller', 'dispatch', 'coordinator', 'picker', 'checker', 'packer'];
t('nav: at most 4 primary + More, every allowed page reachable exactly once', () => {
  ROLES.forEach(r => {
    const n = ctx.navItemsFor(r), allowed = ctx.NAV.filter(x => !x[3] || ctx.can(x[3], r));
    if (n.more.length) assert.ok(n.primary.length <= 4, r + ' primary ' + n.primary.length);
    else assert.ok(n.primary.length <= 5, r);
    const all = n.primary.concat(n.more).map(x => x[0]).sort();
    assert.strictEqual(all.join(), allowed.map(x => x[0]).sort().join(), r + ' reachability');
    assert.strictEqual(n.primary[0][0], '/q', r + ' starts with queue');
  });
});
t('nav: primary tabs per role', () => {
  assert.strictEqual(ctx.navItemsFor('admin').primary.map(x => x[0]).join(), '/q,/all,/disp,/dash');
  assert.strictEqual(ctx.navItemsFor('warehouse_manager').primary.map(x => x[0]).join(), '/q,/all,/merge,/disp');
});
t('nav: Merge for admin + manager only, Delete log admin only', () => {
  const has = (r, p) => { const n = ctx.navItemsFor(r); return n.primary.concat(n.more).some(x => x[0] === p); };
  assert.ok(has('admin', '/merge') && has('warehouse_manager', '/merge'));
  ['biller', 'dispatch', 'coordinator', 'picker', 'checker', 'packer'].forEach(r => assert.ok(!has(r, '/merge'), r + ' merge'));
  assert.ok(has('admin', '/dellog'));
  ROLES.filter(r => r !== 'admin').forEach(r => assert.ok(!has(r, '/dellog'), r + ' dellog'));
});
t('mergeOk blocks dispatched / delivered / cancelled / merged', () => {
  ['new', 'punched', 'picked', 'billed', 'packed'].forEach(s => assert.ok(ctx.mergeOk({ stage: s })));
  ['dispatched', 'delivered', 'cancelled', 'merged'].forEach(s => assert.ok(!ctx.mergeOk({ stage: s })));
  assert.ok(!ctx.mergeOk({ stage: 'new', merged_into: 9 }));
});
t('deleteReasonOk requires 3+ chars', () => {
  assert.ok(!ctx.deleteReasonOk('')); assert.ok(!ctx.deleteReasonOk('  a ')); assert.ok(ctx.deleteReasonOk('dup order'));
});
t('buildMergeRequest: keep choice, only ticked open orders move, combine', () => {
  const a = { key: 'S:1', orders: [{ id: 1, stage: 'new', can_combine: 1 }] };
  const b = { key: 'N:abc', orders: [{ id: 2, stage: 'punched', can_combine: 1 }, { id: 3, stage: 'delivered' }, { id: 4, stage: 'new', can_combine: 1 }] };
  const r = ctx.buildMergeRequest({ a, b, keep: 'a', checked: { 2: 1, 3: 1 } });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), { keep_key: 'S:1', drop_key: 'N:abc', move_ids: [2], note: '' });
  const r2 = ctx.buildMergeRequest({ a, b, keep: 'b', checked: { 1: 1, 2: 1 }, combine: true, combineKeep: 2 });
  assert.strictEqual(r2.keep_key, 'N:abc'); assert.deepStrictEqual([...r2.move_ids], [1]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r2.combine)), { keep_id: 2, drop_ids: [1], add_pcs: 1 });
  assert.throws(() => ctx.buildMergeRequest({ a, b: a, keep: 'a' }));
  assert.throws(() => ctx.buildMergeRequest({ a, b, keep: 'a', checked: { 3: 1 } }), /koi order/);
});
t('card(): list.map(card) never prints [object Object] or stray checkboxes (Ready / Delivered / pending warn)', () => {
  const orders = ['packed', 'billed', 'delivered', 'dispatched', 'new'].map((s, i) => ({
    id: 100 + i, order_no: 'ST-' + i, stage: s, dealer_name: 'DEALER ' + i, pcs: 30, order_date: '2026-11-1' + i,
    lines: [{ brand: 'AMANTE', ordered_qty: 10 }, { brand: 'LUX', ordered_qty: 20 }],
    pending_warn: { remaining: 12, orders: [{ id: 7, track_no: '101126-7' }, { id: 8, order_no: 'W-8' }] }
  }));
  ['admin', 'warehouse_manager', 'dispatch', 'picker'].forEach(r => {
    ctx.R = r;
    const html = orders.map(ctx.card).join('');
    assert.ok(!html.includes('[object Object]'), r + ': [object Object] in card');
    assert.ok(!html.includes('class="qsel"'), r + ': stray checkbox from map index');
    assert.ok(html.includes('101126-7') && html.includes('W-8'), 'pending warn still readable');
  });
  ctx.R = 'admin';
  assert.ok(ctx.card(orders[0], true).includes('class="qsel"'), 'explicit select still works');
  assert.ok(ctx.card(orders[0], false, '<i>x</i>').includes('<i>x</i>'), 'explicit extra still works');
});
t('no list renders call .map(card) with extra args', () => {
  assert.ok(!/\.map\(card\)/.test(src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')) || src.includes('sel = sel === true'), 'card() guards index/array args');
});
t('service worker cache is v41 or later', () => { assert.ok(/'im-warehouse-v(4[1-9]|[5-9]\d)'/.test(sw)); });
t('graceful on v39 backend: unknown-action detection + deploy message present', () => {
  ['isUnknownAction', 'hasBatch', 'callMany'].forEach(f => assert.ok(src.includes('function ' + f + '('), f));
  assert.ok(src.includes('DEPLOY_V40_MSG'));
});
console.log(passed + ' passed');
