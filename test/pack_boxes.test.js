// Pack box types: Baby box / Carton selection, format for cards / ready / delivery, old count-only rows.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
function grab(name) {
  const m = src.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n'));
  assert.ok(m, name);
  return m[0];
}
const ctx = {};
vm.createContext(ctx);
vm.runInContext(grab('parseBoxTypes') + grab('formatBoxes'), ctx);

assert.equal(ctx.formatBoxes({ boxes: 3 }), '3 boxes');
assert.equal(ctx.formatBoxes({ boxes: 1 }), '1 box');
assert.equal(ctx.formatBoxes({ boxes: 4, box_types: '' }), '4 boxes');
assert.equal(ctx.formatBoxes({ boxes: 1, box_types: '{"baby_box":1}' }), '1 baby box');
assert.equal(ctx.formatBoxes({ boxes: 2, box_types: '{"baby_box":2}' }), '2 baby boxes');
assert.equal(ctx.formatBoxes({ boxes: 1, box_types: '{"carton":1}' }), '1 carton');
assert.equal(ctx.formatBoxes({ boxes: 5, box_types: '{"baby_box":2,"carton":3}' }), '2 baby boxes + 3 cartons');
assert.equal(ctx.formatBoxes({ baby_boxes: 1, carton_boxes: 1, boxes: 2 }), '1 baby box + 1 carton');
assert.equal(ctx.formatBoxes({}), '');

assert.deepEqual(ctx.parseBoxTypes({ boxes: 3 }), { baby_box: 0, carton: 0 });
assert.deepEqual(ctx.parseBoxTypes({ box_types: '{"baby_box":2,"carton":1}' }), { baby_box: 2, carton: 1 });

assert.ok(src.indexOf('function packBoxFormHtml()') >= 0);
assert.ok(src.indexOf("['baby_box', 'Baby box']") >= 0);
assert.ok(src.indexOf("['carton', 'Carton']") >= 0);
assert.ok(src.indexOf('if (nx === \'pack\') act += packBoxFormHtml();') >= 0);
assert.ok(src.indexOf('bindPackBoxInputs()') >= 0);
assert.ok(src.indexOf('packBoxPayload()') >= 0);
assert.ok(src.indexOf('Baby box ya carton chunein') >= 0);
assert.ok(src.indexOf("d.baby_boxes = bx.baby_box") >= 0);
assert.ok(src.indexOf('formatBoxes(o)') >= 0);
assert.ok(src.indexOf("box_detail: formatBoxes(o)") >= 0);
assert.ok((src.match(/box_detail: formatBoxes\(o\)/g) || []).length >= 2, 'ready + store ready CSVs');
assert.ok(src.indexOf("['baby_boxes', 'Baby box']") >= 0);
assert.ok(src.indexOf("['carton_boxes', 'Carton']") >= 0);
assert.ok(!/Kitne boxes/.test(src));
assert.ok(!/id="bx"/.test(src));
console.log('pack_boxes ui ok');
