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
  S: { m: { features: { pending_child: 1 }, stages: ['new', 'punched', 'allocated', 'picked', 'checked', 'billed', 'packed', 'dispatched', 'delivered', 'cancelled'], stage_label: {} }, user: { name: 'T', role: 'admin' } },
  R: 'admin', location: { hash: '#/q' }, console
};
ctx.role = () => ctx.R;
ctx.isAdmin = () => ctx.R === 'admin';
vm.createContext(ctx);
const fns = ['can', 'navItemsFor', 'hasPendingChild', 'isPendingChildC', 'normDealerC', 'sameDealerC', 'dealerKeyC', 'pendingRows', 'groupRowsByDealer', 'execSelectionSummary', 'pendingChildCard', 'pendingCycleOf',
  'badges', 'planBadge', 'srcOf', 'h', 'pcs', 'dmy', 'trk', 'ono', 'pendingLineRowHtml'];
vm.runInContext(grabVar('NAV') + grabVar('NAV_PRIMARY') + fns.map(grab).join('\n'), ctx);
let passed = 0; const t = (n, f) => { f(); passed++; console.log('ok', n); };
const J1 = { id: 1, dealer_src_id: '901', dealer_name: 'JAI SAI HOSIERY', order_no: 'ST-1', order_date: '2026-10-04', pending_status: 'open', pending_qty: 5, pending_lines: [{ line_id: 11, brand: 'TRYLO', item: 'BRA', remaining: 2 }, { line_id: 12, brand: 'C9', remaining: 3 }, { line_id: 13, brand: 'LUX', remaining: 0 }] };
const J2 = { id: 2, dealer_src_id: '', dealer_name: 'Jai Sai Hosiery', order_no: 'ST-2', order_date: '2026-11-06', pending_status: 'open', pending_qty: 1, pending_lines: [{ line_id: 21, brand: 'C9', remaining: 1 }] };
const K1 = { id: 3, dealer_src_id: '902', dealer_name: 'KRISHNA', order_no: 'ST-3', order_date: '2026-11-07', pending_status: 'open', pending_qty: 4, pending_lines: [{ line_id: 31, brand: 'C9', remaining: 4 }] };
const done = { id: 4, dealer_src_id: '902', dealer_name: 'KRISHNA', pending_status: 'complete', pending_qty: 0 };
t('pending rows: only open lines with remaining, brand + month filters', () => {
  assert.equal(ctx.pendingRows([J1, J2, K1, done]).length, 4);
  assert.equal(ctx.pendingRows([J1, J2, K1], { brand: 'C9' }).length, 3);
  assert.equal(ctx.pendingRows([J1, J2, K1], { month: '2026-10' }).length, 2);
});
t('group by dealer (src id, else name) for one-order-per-dealer bulk', () => {
  const g = ctx.groupRowsByDealer(ctx.pendingRows([J1, K1, { ...J2, dealer_src_id: '901' }]));
  assert.equal(g.length, 2); assert.equal(g[0].pcs, 6); assert.equal(g[0].order_count, 2);
  assert.ok(ctx.sameDealerC(J2, { dealer_name: 'JAI SAI HOSIERY' }));
});
t('selection summary counts dealers / orders / pcs for the confirm', () => {
  const s = ctx.execSelectionSummary([{ order_id: 1, line_id: 11, qty: 2 }, { order_id: 1, line_id: 12, qty: 3 }, { order_id: 3, line_id: 31, qty: 4 }], { 1: J1, 3: K1 });
  assert.deepEqual(JSON.parse(JSON.stringify(s)), { dealers: 2, orders: 2, pcs: 9 });
});
t('Pending executed tag on cards + detail links to the old order', () => {
  const c = { id: 9, pending_tag: 'Pending executed', parent_order_id: 1, parent_order_no: 'ST-1', parent_orders: [{ id: 1, order_no: 'ST-1', order_date: '2026-10-04', invoice_no: 'INV-1' }], pending_refs: [{ order_no: 'ST-1', brand: 'TRYLO', item: 'BRA', qty: 2 }] };
  assert.ok(/Pending executed/.test(ctx.badges(c)));
  assert.ok(!/Pending executed/.test(ctx.badges({ id: 1 })));
  const html = ctx.pendingChildCard(c); assert.ok(/#\/o\/1/.test(html) && /INV-1/.test(html) && /TRYLO BRA/.test(html));
  assert.equal(ctx.pendingChildCard({ id: 2 }), '');
  assert.ok(/Carried 2026-12/.test(ctx.badges({ id: 5, stage: 'dispatched', carry_month: '2026-12' })));
});
t('child rows on the old order are not a running leftover cycle', () => {
  assert.equal(ctx.pendingCycleOf({ pending_execs: [{ cycle_status: 'child' }, { cycle_status: 'void' }] }), null);
  assert.ok(ctx.pendingCycleOf({ pending_execs: [{ cycle_status: 'allocated' }] }));
});
t('Archive page + bulk execute only for admin / warehouse manager', () => {
  const has = r => navItemsAll(r).indexOf('/arch') >= 0;
  function navItemsAll(r) { const x = ctx.navItemsFor(r); return x.primary.concat(x.more).map(i => i[0]); }
  assert.ok(has('admin') && has('warehouse_manager')); assert.ok(!has('picker') && !has('biller') && !has('dispatch') && !has('coordinator'));
  assert.ok(ctx.can('pendingexec', 'warehouse_manager') && !ctx.can('pendingexec', 'packer'));
});
t('line row is phone friendly (checkbox 22px, qty 64px, wraps long order no)', () => {
  const r = ctx.pendingLineRowHtml(ctx.pendingRows([J1])[0], true, 'pb');
  assert.ok(/class="pbsel"/.test(r) && /checked/.test(r) && /width:64px/.test(r) && /overflow-wrap:anywhere/.test(r));
});
t('sw cache bumped to v43', () => { assert.ok(/im-warehouse-v43/.test(sw)); });
console.log(passed + ' passed');
