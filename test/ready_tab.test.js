// Frontend simulation: extracts helper functions from app.js and checks queue / tab filtering.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
function grab(name) { const m = src.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n|function ' + name + '\\([^)]*\\) \\{[^\\n]*\\}\\n')); assert.ok(m, name); return m[0]; }
const ctx = { S: { m: { stages: ['new', 'punched', 'allocated', 'picked', 'checked', 'billed', 'packed', 'dispatched', 'cancelled'] } }, role: () => 'admin' };
vm.createContext(ctx);
vm.runInContext(grab('stillInWorkQueue') + grab('isReadyStageO'), ctx);
const orders = ['new', 'allocated', 'picked', 'checked', 'billed', 'packed', 'dispatched', 'cancelled'].map((s, i) => ({ id: i, stage: s }));
const inQ = orders.filter(ctx.stillInWorkQueue).map(o => o.stage);
assert.deepEqual(inQ, ['new', 'allocated', 'picked', 'checked', 'billed']);
assert.deepEqual(orders.filter(ctx.isReadyStageO).map(o => o.stage), ['packed', 'dispatched']);
// stage chips: Picking/Checking/Billing/Packing/Ready for despatch
const chip = { picking: 'allocated', checking: 'picked', billing: 'checked', packing: 'billed' };
Object.keys(chip).forEach(k => assert.ok(src.indexOf("if (st === '" + k + "') return o.stage === '" + chip[k] + "'") >= 0, k));
assert.ok(src.indexOf("['packing', 'Packing'], ['ready', 'Ready for despatch']") >= 0);
assert.equal((src.match(/\['packing', 'Packing'\], \['ready', 'Ready for despatch'\]/g) || []).length, 2); // Meri queue + Store orders
assert.ok(!/'Bill ho chuka'\]/.test(src));
console.log('ready_tab ok');
