// Store order photos: order photo at create, pending page at billing, execution page not required.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
function grab(name) {
  const m = src.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n'));
  assert.ok(m, name);
  return m[0];
}
const ctx = {
  PHOTO_KINDS: [['order', 'Order photo'], ['pending', 'Pending page'], ['exec', 'Execution page']],
  role: () => 'admin',
  canNew: () => true
};
vm.createContext(ctx);
vm.runInContext(
  'function photoOf(o) { return (o && o.photos) || { order: o && o.photo_order_id ? 1 : 0, pending: o && o.photo_pending_id ? 1 : 0, exec: o && o.photo_exec_id ? 1 : 0 }; }\n' +
  "function storeIsBilled(o) { return !!(o && (o.invoice_no || o.billed_at || ['billed', 'packed', 'dispatched'].indexOf(o.stage) >= 0)); }\n" +
  grab('storePhotoMissing') + grab('photoShowKinds') + grab('photoFlags'),
  ctx
);

const newO = { source: 'Karwa Marketing Store', stage: 'new', photos: {} };
assert.deepEqual(ctx.storePhotoMissing(newO), ['order']);
assert.deepEqual(ctx.storePhotoMissing({ stage: 'new', photo_order_id: 'f1' }), []);
assert.deepEqual(ctx.storePhotoMissing({ stage: 'checked', photos: { order: 1 } }), []);
assert.deepEqual(ctx.storePhotoMissing({ stage: 'billed', photos: { order: 1 } }), ['pending']);
assert.deepEqual(ctx.storePhotoMissing({ stage: 'packed', photos: { order: 1, pending: 1, exec: 0 } }), []);
assert.deepEqual(ctx.storePhotoMissing({ stage: 'allocated', invoice_no: 'S-1', photos: { order: 1 } }), ['pending']);
assert.deepEqual(ctx.storePhotoMissing({ stage: 'dispatched', photos: { order: 1, pending: 1 } }), []);

assert.deepEqual(ctx.photoShowKinds({ stage: 'new', photos: { order: 1 } }).map(k => k[0]), ['order'], 'unbilled new order shows only order photo');
assert.deepEqual(ctx.photoShowKinds({ stage: 'checked', photo_exec_id: 'e1', photos: { order: 1, exec: 1 } }).map(k => k[0]), ['order', 'exec'], 'old execution photo still displays');
assert.deepEqual(ctx.photoShowKinds({ stage: 'billed', photos: { order: 1 } }).map(k => k[0]), ['order', 'pending'], 'pending required after bill even if missing');
assert.ok(ctx.photoFlags({ stage: 'billed', photos: { order: 1 } }).indexOf('Pending page') >= 0);
assert.ok(ctx.photoFlags({ stage: 'new', photos: { order: 1 } }).indexOf('Execution page') < 0);

assert.ok(src.indexOf("var PHOTO_CREATE_KINDS = [['order', 'Order photo']]") >= 0);
assert.ok(src.indexOf('photoInputs(have, PHOTO_CREATE_KINDS)') >= 0);
assert.ok(src.indexOf("if (st === 'nophoto') return storePhotoMissing(o).length > 0") >= 0);
assert.ok(src.indexOf('Pending page ki photo lagayein') >= 0);
assert.ok(src.indexOf('data-ph="pending"') >= 0);
assert.ok(src.indexOf('teen photo') < 0);
assert.ok(src.indexOf('execution page') < 0);
assert.ok(/function vStoreNew[\s\S]*photoInputs\(have, PHOTO_CREATE_KINDS\)/.test(src));
assert.ok(/function vStoreNew[\s\S]*PHOTO_CREATE_KINDS\.filter/.test(src));
assert.ok(/if \(nx === 'bill'\) act \+=[\s\S]*isStore\(o\)[\s\S]*Pending page/.test(src));
assert.ok(src.indexOf("if (nx === 'bill' && isStore(o))") >= 0);
assert.ok(src.indexOf("uploadPhoto(o.id, 'pending'") >= 0);
console.log('store_photos ok');
