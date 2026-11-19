// Admin qty edit (v38): button only for admin before dispatch, history block from order log.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
function grab(name) { const m = src.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n')); assert.ok(m, name); return m[0]; }
const ctx = { R: 'admin' };
vm.createContext(ctx);
vm.runInContext('function isAdmin(){return R==="admin";} function h(s){return String(s==null?"":s);} function tm(x){return x;}\n' + grab('canAdminQtyEdit') + grab('qtyEditHistory'), ctx);
const o = (st, x) => Object.assign({ stage: st, lines: [{ id: 1 }] }, x || {});
['new', 'allocated', 'picked', 'checked', 'billed', 'packed'].forEach(st => assert.ok(ctx.canAdminQtyEdit(o(st), null), st));
['dispatched', 'cancelled', 'merged'].forEach(st => assert.ok(!ctx.canAdminQtyEdit(o(st), null), st));
assert.ok(!ctx.canAdminQtyEdit(o('packed', { dispatched_at: 'x' }), null));
assert.ok(!ctx.canAdminQtyEdit(o('allocated'), { group_id: 'g' }), 'blocked during leftover cycle');
ctx.R = 'warehouse_manager'; assert.ok(!ctx.canAdminQtyEdit(o('new'), null), 'non-admin sees nothing');
assert.equal(ctx.qtyEditHistory([{ action: 'pick', note: 'x' }]), '');
const hh = ctx.qtyEditHistory([{ action: 'qty_edit', note: 'LUX: 10->12', at: 'T1', by_name: 'Pramod' }]);
assert.ok(/Qty badli \(admin\)/.test(hh) && /LUX: 10-&gt;12|LUX: 10->12/.test(hh) && /Pramod/.test(hh));
assert.ok(src.indexOf("call('editOrderQty'") >= 0);
assert.ok(fs.readFileSync(__dirname + '/../sw.js', 'utf8').search(/im-warehouse-v(3[89]|4\d)/) >= 0);
console.log('qty edit ui ok');
