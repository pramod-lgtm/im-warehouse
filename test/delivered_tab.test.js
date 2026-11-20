// v40: Delivered tab, packing-tab shortcut for orders before 10 Nov 2026, qty edit blocked on delivered.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
const sw = fs.readFileSync(__dirname + '/../sw.js', 'utf8');

function grab(name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'missing ' + name);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unclosed ' + name);
}

const ctx = {
  S: { m: { stages: ['new', 'punched', 'allocated', 'picked', 'checked', 'billed', 'packed', 'dispatched', 'delivered', 'cancelled'] }, user: { name: 'Pramod' } },
  R: 'admin',
  role: function () { return ctx.R; },
  isAdmin: function () { return ctx.R === 'admin'; }
};
vm.createContext(ctx);
vm.runInContext(
  grab('stillInWorkQueue') + grab('isReadyStageO') + grab('isDeliveredStageO') +
  grab('orderDateYmd') + grab('canDirectDeliverFromPack') + grab('canUseDirectDeliver') +
  grab('canAdminQtyEdit') + grab('serverHasDelivered') +
  'var DIRECT_DELIVER_BEFORE = "2026-11-10";',
  ctx
);

const stages = ['new', 'allocated', 'picked', 'checked', 'billed', 'packed', 'dispatched', 'delivered', 'cancelled'];
const orders = stages.map((st, i) => ({ id: i, stage: st, order_date: '2026-11-05' }));

assert.deepEqual(orders.filter(ctx.stillInWorkQueue).map(o => o.stage), ['new', 'allocated', 'picked', 'checked', 'billed']);
assert.deepEqual(orders.filter(ctx.isReadyStageO).map(o => o.stage), ['packed', 'dispatched']);
assert.deepEqual(orders.filter(ctx.isDeliveredStageO).map(o => o.stage), ['delivered']);

assert.ok(src.indexOf("['delivered', 'Delivered']") >= 0);
assert.equal((src.match(/\['delivered', 'Delivered'\]/g) || []).length, 2, 'Meri queue + Store orders');
assert.ok(src.indexOf("['packing', 'Packing'], ['ready', 'Ready for despatch'], ['delivered', 'Delivered']") >= 0);
assert.ok(src.indexOf("function drawDelivered()") >= 0);
assert.ok((src.match(/function drawDelivered\(\)/g) || []).length === 2);
assert.ok(src.indexOf("billedOrders', { delivered: 1") >= 0 || src.indexOf('billedOrders\', { delivered: 1') >= 0 || src.indexOf("delivered: 1, from:") >= 0 || src.indexOf("{ delivered: 1") >= 0);
assert.ok(src.indexOf("{ delivered: 1") >= 0 || src.indexOf("delivered: 1") >= 0);
assert.ok(src.indexOf("data-deliv") >= 0);
assert.ok(src.indexOf('Delivered mark karein') >= 0);
assert.ok(sw.indexOf("im-warehouse-v40") >= 0);

// Date parsing: ISO, timestamp, DD-MM-YYYY, fallback created_at
assert.equal(ctx.orderDateYmd({ order_date: '2026-11-09' }), '2026-11-09');
assert.equal(ctx.orderDateYmd({ order_date: '2026-11-09T18:30:00Z' }), '2026-11-09');
assert.equal(ctx.orderDateYmd({ order_date: '09-11-2026' }), '2026-11-09');
assert.equal(ctx.orderDateYmd({ order_date: '9/11/26' }), '2026-11-09');
assert.equal(ctx.orderDateYmd({ created_at: '2026-11-08T10:00:00+05:30' }), '2026-11-08');
assert.equal(ctx.orderDateYmd({ order_date: '', src_at: '07-11-2026' }), '2026-11-07');
assert.equal(ctx.orderDateYmd({}), '');

// Pre-10 Nov billed: shortcut allowed
const pre = { id: 1, stage: 'billed', order_date: '2026-11-09', hold: 0 };
assert.ok(ctx.canDirectDeliverFromPack(pre), '9 Nov billed can shortcut');
assert.ok(ctx.canUseDirectDeliver(pre), 'admin can use shortcut');
const early = { id: 2, stage: 'billed', order_date: '2026-11-01' };
assert.ok(ctx.canDirectDeliverFromPack(early));

// On/after 10 Nov: blocked
['2026-11-10', '2026-11-11', '10-11-2026', '2026-11-10T00:00:00+05:30'].forEach(function (d) {
  assert.ok(!ctx.canDirectDeliverFromPack({ id: 3, stage: 'billed', order_date: d }), d);
});
assert.ok(!ctx.canDirectDeliverFromPack({ id: 4, stage: 'billed', order_date: '2026-11-20' }));

// Wrong stage, hold, missing date: blocked
assert.ok(!ctx.canDirectDeliverFromPack({ id: 5, stage: 'packed', order_date: '2026-11-09' }));
assert.ok(!ctx.canDirectDeliverFromPack({ id: 6, stage: 'dispatched', order_date: '2026-11-09' }));
assert.ok(!ctx.canDirectDeliverFromPack({ id: 7, stage: 'billed', order_date: '2026-11-09', hold: 1 }));
assert.ok(!ctx.canDirectDeliverFromPack({ id: 8, stage: 'billed' }));

// Roles
ctx.R = 'packer'; assert.ok(ctx.canUseDirectDeliver(pre));
ctx.R = 'dispatch'; assert.ok(ctx.canUseDirectDeliver(pre));
ctx.R = 'warehouse_manager'; assert.ok(ctx.canUseDirectDeliver(pre));
ctx.R = 'picker'; assert.ok(!ctx.canUseDirectDeliver(pre));
ctx.R = 'biller'; assert.ok(!ctx.canUseDirectDeliver(pre));
ctx.R = 'admin';

// Qty edit blocked on delivered (and still allowed before dispatch)
const o = (st, x) => Object.assign({ stage: st, lines: [{ id: 1 }] }, x || {});
['new', 'allocated', 'picked', 'checked', 'billed', 'packed'].forEach(st => assert.ok(ctx.canAdminQtyEdit(o(st), null), st));
['dispatched', 'delivered', 'cancelled', 'merged'].forEach(st => assert.ok(!ctx.canAdminQtyEdit(o(st), null), st));
assert.ok(!ctx.canAdminQtyEdit(o('billed', { delivered_at: 'x' }), null));
assert.ok(!ctx.canAdminQtyEdit(o('packed', { dispatched_at: 'x' }), null));

console.log('delivered tab ui ok');
