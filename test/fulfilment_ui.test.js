// v37 Order vs fulfilment frontend: search / sort helper and wiring.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
function grab(name) { const m = src.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n')); assert.ok(m, name); return m[0]; }
const ctx = {}; vm.createContext(ctx); vm.runInContext(grab('fulRows'), ctx);
const rows = [{ customer: 'Raj Hosiery', city: 'Karol Bagh', fill_pct: 50, ordered: 10 }, { customer: 'Sita', city: 'Rohini', fill_pct: '', ordered: 30 }, { customer: 'Gupta', city: 'Rohini', fill_pct: 90, ordered: 20 }];
assert.deepEqual(ctx.fulRows(rows, ['customer', 'city'], 'rohini', {}).map(r => r.customer), ['Sita', 'Gupta']);
assert.deepEqual(ctx.fulRows(rows, ['customer'], '', { k: 'fill_pct', d: 'desc' }).map(r => r.customer), ['Gupta', 'Raj Hosiery', 'Sita'], 'blank last');
assert.deepEqual(ctx.fulRows(rows, ['customer'], '', { k: 'ordered', d: 'asc' }).map(r => r.ordered), [10, 20, 30]);
assert.deepEqual(ctx.fulRows(rows, ['customer'], '', { k: 'customer', d: 'asc' }).map(r => r.customer), ['Gupta', 'Raj Hosiery', 'Sita']);
assert.ok(src.indexOf("['/ful', '📦', 'Fulfilment', 'view']") >= 0, 'nav for view perm (admin + manager)');
assert.ok(src.indexOf("'/ful': vFul") >= 0, 'route');
assert.ok(/function vFul\(v\) \{\n  if \(!isMgr\(\)\) return go\('\/q'\);/.test(src), 'admin / manager only');
assert.ok(src.indexOf("call('fulfilment', payload)") >= 0);
['fulfilment-customers', 'fulfilment-orders', 'fulfilment-articles', 'fulfilment-summary'].forEach(n => assert.ok(src.indexOf(n) >= 0, 'csv ' + n));
assert.ok(/const C='im-warehouse-v37'/.test(fs.readFileSync(__dirname + '/../sw.js', 'utf8')));
console.log('fulfilment_ui ok');
