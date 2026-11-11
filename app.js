/* IM Warehouse frontend: static PWA. Talks to Apps Script JSON API (POST text/plain). */
(function () {
'use strict';
var $ = function (id) { return document.getElementById(id); };
var LS = window.localStorage;
var S = { token: LS.getItem('imw_token'), user: JSON.parse(LS.getItem('imw_user') || 'null'), m: null };
function apiUrl() { return LS.getItem('imw_api') || (window.IM_WAREHOUSE_CONFIG || {}).apiUrl || ''; }
function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function today() { return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10); }
function tm(iso) { if (!iso) return '-'; var t = new Date(new Date(iso).getTime() + 330 * 60000), hh = t.getUTCHours(), mm = t.getUTCMinutes(); return t.getUTCDate() + '/' + (t.getUTCMonth() + 1) + ' ' + ((hh % 12) || 12) + ':' + (mm < 10 ? '0' : '') + mm + (hh < 12 ? 'am' : 'pm'); }
function mins(m) { if (m == null || m === '') return '-'; m = Math.round(m); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm'; }
function inr(n) { return 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-IN'); }
function pcs(n) { return (n === '' || n == null ? '-' : Math.round(Number(n) || 0).toLocaleString('en-IN')) + ' pcs'; }
function dmy(d) { return d ? String(d).split('-').reverse().join('-') : ''; }
function val(id) { var e = $(id); return e ? e.value.trim() : ''; }
var pending = 0; function busy(d) { pending += d; $('loading').classList.toggle('hidden', pending <= 0); }
function toast(m, t) { var e = $('toast'); e.textContent = m; e.className = 'toast ' + (t || 'ok'); clearTimeout(e._h); e._h = setTimeout(function () { e.className = 'toast hidden'; }, 4000); }
function fail(e) { toast(e && e.message || String(e), 'err'); }
function call(action, data, quiet) {
  var url = apiUrl(); if (!url) { go('/setup'); return Promise.reject(new Error('API link set nahi hai. Setup screen par /exec link daalein.')); }
  if (!quiet) busy(1);
  return fetch(url, { method: 'POST', redirect: 'follow', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: S.token, action: action, data: data || {} }) })
    .then(function (r) { if (!r.ok) throw new Error('Server error ' + r.status); return r.text(); })
    .then(function (s) { try { return JSON.parse(s); } catch (e) { throw new Error('Bad response. API link / deployment (Anyone access) check karein.'); } },
      function (e) { throw new Error(/Server/.test(e.message) ? e.message : 'Network problem, internet check karein.'); })
    .then(function (r) { if (!quiet) busy(-1); if (!r.ok) { if (r.auth === false) signOut(true); throw new Error(r.error); } return r.data; }, function (e) { if (!quiet) busy(-1); throw e; });
}
function signOut(local) { if (!local) call('logout', {}, true).catch(function () {}); S.token = null; S.user = null; S.m = null; LS.removeItem('imw_token'); LS.removeItem('imw_user'); go('/login'); }
function masters(force) { if (S.m && !force) return Promise.resolve(S.m); return call('masters').then(function (m) { S.m = m; return m; }); }
function role() { return S.user && S.user.role; }
function isMgr() { return role() === 'admin' || role() === 'warehouse_manager'; }
function isAdmin() { return role() === 'admin'; }
function can(p) { var P = { view: ['admin', 'warehouse_manager'], bills: ['admin', 'warehouse_manager', 'biller'], hold: ['admin', 'warehouse_manager', 'biller', 'coordinator'], holdmgr: ['admin', 'warehouse_manager', 'coordinator'], delivery: ['admin', 'warehouse_manager', 'dispatch'], sync: ['admin', 'warehouse_manager', 'biller'], manage: ['admin'], recvtime: ['admin', 'warehouse_manager'], routes: ['admin', 'warehouse_manager', 'coordinator'] }; return (P[p] || []).indexOf(role()) >= 0; }
function stageLbl(s) { return (S.m && S.m.stage_label[s]) || s; }
function ono(o) { return o.order_no || (/^W-/.test(o.src_id) ? o.src_id : '#' + o.id); }
function trk(o) { return o.track_no ? '<span class="trk">' + h(o.track_no) + '</span> ' : ''; }
function srcOf(o) { return o.source || 'Sales Tracker'; }
function canNew() { return ['admin', 'warehouse_manager', 'dispatch'].indexOf(role()) >= 0; }
function planBadge(o) {
  if (!o || (!o.plan_delivery_date && !o.plan_flag && !o.plan_mode)) return '';
  var bits = [];
  if (o.plan_delivery_date) bits.push('<span class="pill" title="Plan delivery">📅 ' + h(dmy(o.plan_delivery_date)) + (o.plan_van ? ' · ' + h(String(o.plan_van).replace(/^DL1L?A?P?-?|^DL1LZ-?/,'')) : '') + '</span>');
  if (o.plan_mode && o.plan_mode !== 'van') bits.push('<span class="pill src">' + h(o.plan_mode) + '</span>');
  if (o.plan_flag === 'no_guarantee') bits.push('<span class="pill st-hold" title="Real-time nahi">No guarantee</span>');
  if (o.plan_flag === 'beyond_48h') bits.push('<span class="pill st-hold">&gt;48h</span>');
  if (o.plan_flag === 'unmapped') bits.push('<span class="pill st-hold">Unmapped area</span>');
  if (Number(o.plan_override)) bits.push('<span class="pill src">Override</span>');
  return bits.length ? ' ' + bits.join(' ') : '';
}
function badges(o) { return ' <span class="pill src">' + h(srcOf(o)) + '</span>' + (o.priority === 'Urgent' ? ' <span class="pill st-hold">URGENT</span>' : '') + ((o.dups || []).length ? ' <span class="pill st-hold" title="Same dealer, overlapping items / amount, paas ki date">⚠ Possible duplicate</span>' : '') + planBadge(o); }
function pill(o) { return '<span class="pill st-' + h(o.stage) + '">' + h(stageLbl(o.stage)) + '</span>' + (o.stage === 'new' && Number(o.needs_punch) ? ' <span class="pill st-hold">Trylo: punching baaki</span>' : '') + (Number(o.hold) ? ' <span class="pill st-hold">HOLD</span>' : ''); }
// ---------------- SLA (bill within deadline)
var SLA_CLS = { 'On time': 'sla-ok', 'Due soon': 'sla-soon', 'Delayed': 'sla-late', 'Waiting for stock': 'sla-wait' };
var SLA_LBL = { 'On time': 'On time', 'Due soon': 'Due soon', 'Delayed': 'Delayed', 'Waiting for stock': 'Waiting for stock' };
function left(dlIso) { var m = Math.round((Date.parse(dlIso) - Date.now()) / 60000); return m >= 0 ? mins(m) + ' baaki' : mins(-m) + ' late'; }
/** live status from deadline (server status is the base; Waiting/Delayed stay as they are). */
function slaNow(s) { if (!s || s.billed || s.status === 'Waiting for stock' || s.status === 'Delayed') return s && s.status; var m = (Date.parse(s.deadline) - Date.now()) / 60000; return m < 0 ? 'Delayed' : m <= 30 ? 'Due soon' : 'On time'; }
function slaBadge(o, long) {
  var s = o.sla; if (!s) return ''; var st = slaNow(s);
  var t = s.billed ? (st === 'Delayed' ? 'Delayed processing (' + mins(s.delay_min) + ')' : 'Bill on time')
    : st === 'Waiting for stock' ? 'Waiting for stock: ' + s.waiting.join(', ') : SLA_LBL[st] + ' • <span data-dl="' + h(s.deadline) + '">' + left(s.deadline) + '</span>';
  return ' <span class="pill ' + SLA_CLS[st] + '">' + t + '</span>' + (long ? '<div class="small muted">Order aaya ' + tm(s.received_at) + ' • Bill deadline <b>' + tm(s.deadline) + '</b>' + (s.purchase ? ' (purchase ke baad)' : '') + (o.received_at_original ? '<br>Time badla: pehle ' + tm(o.received_at_original) + ' • ' + h(o.received_edit_by || '') + ' ne ' + tm(o.received_edit_at) : '') + '</div>' : '');
}
setInterval(function () { Array.prototype.forEach.call(document.querySelectorAll('[data-dl]'), function (e) { e.textContent = left(e.dataset.dl); }); }, 30000);
function slaHelp() {
  var c = (S.m && S.m.sla) || {};
  return '<details class="small help"><summary>ⓘ Rules kaise kaam karte hain</summary><ul>' +
    '<li>Har order ko aane ke <b>' + h(c.sla_hours || 2) + ' ghante</b> ke andar <b>bill</b> hona chahiye. Nahi hua to <b class="short">Delayed</b> (baad mein bill ho jaye tab bhi Delayed hi rahega, kitni der hui woh bhi dikhega).</li>' +
    '<li><b>' + h(c.cutoff_time || '17:00') + '</b> ke baad aaya order: deadline agle din <b>' + h(c.next_day_deadline || '11:00') + '</b>.</li>' +
    '<li>Warehouse khulne (<b>' + h(c.open_time || '10:00') + '</b>) se pehle aaya order: deadline = open time + ' + h(c.sla_hours || 2) + ' ghante.</li>' +
    '<li>Chhutti (' + h(c.weekly_off || 'weekly off nahi') + (c.holidays ? '; ' + h(c.holidays) : '') + ') wale din aaya order: agle working din ' + h(c.next_day_deadline || '11:00') + '.</li>' +
    '<li>Kisi brand ka stock nahi hai to manager order par <b>Waiting for purchase</b> lagaye. Tab tak order Delayed nahi ginta, alag "Waiting for stock" mein dikhta hai.</li>' +
    '<li>Purchase aane par <b>Purchase aaya</b> mein brand + time daalein. Us brand ke sab pending orders ki nayi deadline = aane ka time + ' + h(c.purchase_grace_hours || 24) + ' ghante.</li>' +
    '<li>Due soon = deadline mein 30 min se kam bacha. Settings Google Sheet ke Settings tab mein badlein.</li></ul></details>';
}
function csv(rows, name) {
  if (!rows.length) return toast('Kuch data nahi', 'err'); var keys = Object.keys(rows[0]);
  var s = [keys.join(',')].concat(rows.map(function (r) { return keys.map(function (k) { var v = r[k] == null ? '' : typeof r[k] === 'object' ? JSON.stringify(r[k]) : String(r[k]); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); })).join('\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + s], { type: 'text/csv' })); a.download = name + '-' + today() + '.csv'; a.click();
}
function sheet(html) { var d = document.createElement('div'); d.className = 'sheet'; d.innerHTML = '<div>' + html + '<button class="big" data-close style="margin-top:10px">Band karein</button></div>'; d.addEventListener('click', function (e) { if (e.target === d || e.target.hasAttribute('data-close')) d.remove(); }); document.body.appendChild(d); return d; }

// ---------------- router
function go(p) { if (location.hash !== '#' + p) location.hash = '#' + p; else route(); }
var NAV = [['/q', '📋', 'Meri queue', null], ['/sq', '🛍️', 'Store orders', null], ['/all', '🏬', 'Sab orders', 'view'], ['/cl', '📍', 'Cluster', 'view'], ['/dl', '🏪', 'Dealers', 'view'], ['/bills', '🧾', 'Billing', 'bills'], ['/disp', '🚚', 'Delivery', 'delivery'], ['/kal', '🚐', 'Kal delivery', 'delivery'], ['/van', '🗺️', 'Van plan', 'routes'], ['/dash', '📊', 'Dashboard', 'view'], ['/hl', '⛔', 'Hold list', 'holdmgr'], ['/admin', '⚙️', 'Admin', 'manage']];
function nav(cur) {
  var n = $('nav'); if (!S.user) { n.classList.add('hidden'); return; }
  n.innerHTML = NAV.filter(function (x) { return !x[3] || can(x[3]); }).map(function (x) { return '<a href="#' + x[0] + '" class="' + (cur.indexOf(x[0]) === 0 ? 'on' : '') + '"><i>' + x[1] + '</i>' + x[2] + '</a>'; }).join('');
  n.classList.remove('hidden');
}
function route() {
  var p = location.hash.slice(1) || '/q', v = $('view');
  if (p !== '/setup' && !S.token) p = '/login';
  $('who').textContent = S.user ? S.user.name + ' (' + S.user.role_label + ')' : '';
  nav(p); window.scrollTo(0, 0);
  if (p === '/login') return vLogin(v); if (p === '/setup') return vSetup(v);
  masters().then(function () {
    if (p.indexOf('/o/') === 0) return vOrder(v, Number(p.slice(3)));
    if (p === '/new') return vNew(v, null);
    if (p === '/sq/new') return vStoreNew(v, null);
    if (p.indexOf('/sq/edit/') === 0) return call('order', { id: Number(p.slice(9)) }).then(function (r) { vStoreNew(v, r.order); }).catch(fail);
    if (p === '/sq') return vStoreQueue(v);
    if (p.indexOf('/edit/') === 0) return call('order', { id: Number(p.slice(6)) }).then(function (r) { if (isStore(r.order)) return go('/sq/edit/' + r.order.id); vNew(v, r.order); }).catch(fail);
    var f = { '/q': vQueue, '/all': vAll, '/cl': vClusters, '/bills': vBills, '/disp': vDisp, '/kal': vKalDelivery, '/van': vVanPlan, '/dash': vDash, '/dl': vDealers, '/admin': vAdmin, '/pr': vPurchase, '/hl': vHoldList, '/dup': vDups }[p] || vQueue; f(v);
  }).catch(fail);
}
window.addEventListener('hashchange', route);

// ---------------- hold list (office coordinator)
function parseHoldPaste(t) {
  return String(t || '').split(/\r?\n/).map(function (l) { return l.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(function (x) { return x.replace(/^"|"$/g, '').trim(); }); })
    .filter(function (c) { return c[0] && !/^dealer$/i.test(c[0]); }).map(function (c) { return { dealer: c[0], why: c[1] || '', brand: c[2] || '', os: (c[3] || '').replace(/[,₹\s]/g, '') }; });
}
function vHoldList(v) {
  Promise.all([call('holdList'), call('orders', { all: 1 })]).then(function (rs) {
    var hl = rs[0], open = rs[1].filter(function (o) { return o.stage !== 'cancelled' && o.stage !== 'dispatched' && !o.invoice_no && S.m.stages.indexOf(o.stage) < S.m.stages.indexOf('billed'); }), match = [];
    v.innerHTML = '<div class="row"><h2>Hold dealers list</h2><button class="sm good" id="hx" style="flex:0;white-space:nowrap">⬇️ HOLD orders Excel</button></div><p class="small muted">Is list ke dealers ke naye orders apne aap HOLD ho jaate hain, jab tak agli list import na ho. List date: <b>' + h(hl.list_date || '-') + '</b> • ' + hl.entries.length + ' dealers</p>' +
      '<div class="card">' + (hl.entries.length ? table(hl.entries, [['dealer_name', 'Dealer'], ['why', 'Reason'], ['brand', 'Brand'], ['os', 'OS', inr], ['created_by', 'Kisne'], ['id', '', function (x) { return '<button class="sm good" data-ud="' + x + '">Dealer UNHOLD</button> <button class="sm warn" data-rm="' + x + '">Hatao</button>'; }]]) : '<span class="muted">List khali hai.</span>') + '</div>' +
      '<details class="card"><summary><b>+ Ek dealer jodein</b></summary><datalist id="dl_hd">' + hl.dealers.map(function (d) { return '<option value="' + h(d.name) + '">'; }).join('') + '</datalist><label>Dealer</label><input id="ad" list="dl_hd" placeholder="Naam search karein"><div class="grid2"><div><label>Reason</label><input id="aw" placeholder="CHEQUE BOUNCE / >100d"></div><div><label>Brand</label><input id="ab" placeholder="TRYLO / C9 / BOTH"></div></div><label>OS (Rs)</label><input id="ao" inputmode="numeric"><button class="primary" id="aa" style="margin-top:8px">Jodein + open orders hold karein</button></details>' +
      '<details class="card"><summary><b>Nayi list import (purani list replace hogi)</b></summary><p class="small muted">Excel se paste karein: Dealer | Reason | Brand | OS (har line ek dealer).</p><label>List date</label><input id="ld" placeholder="24-Oct" value="' + h(hl.list_date) + '"><textarea id="lp" rows="6" style="width:100%"></textarea><button id="lm" style="margin-top:6px">Match karein</button><div id="lr"></div></details>' +
      '<div class="card"><h3>Open orders – select karke hold / unhold</h3><input id="oq" placeholder="Dealer / tracking no"><div class="row" style="margin-top:6px"><select id="br">' + S.m.hold_reasons.map(function (x) { return '<option>' + h(x) + '</option>'; }).join('') + '</select><input id="bn" placeholder="Note"></div><div class="row" style="margin-top:6px"><input id="udn" list="dl_hd" placeholder="Dealer naam (list ke bahar wala bhi)"><button class="good" id="udb" style="flex:0;white-space:nowrap">Dealer ke sab orders UNHOLD</button></div><div class="row" style="margin-top:6px"><button class="danger" id="bh">Selected HOLD karein</button><button class="warn" id="bu">Selected UNHOLD karein</button></div><label class="chk"><input type="checkbox" id="oall"> Sab dikh rahe select karein</label><div id="ol"></div></div>';
    function drawOrders() {
      var q = (val('oq') || '').toUpperCase(), f = open.filter(function (o) { return !q || (o.dealer_name + ' ' + (o.track_no || '')).toUpperCase().indexOf(q) >= 0; });
      $('ol').innerHTML = f.map(function (o) { return '<label class="chk"><input type="checkbox" data-o="' + o.id + '"> <a href="#/o/' + o.id + '">' + h(o.track_no || '#' + o.id) + '</a> ' + h(o.dealer_name) + ' <span class="small muted">' + h(stageLbl(o.stage)) + ' • ' + pcs(o.pcs) + '</span>' + (Number(o.hold) ? ' <span class="pill st-hold">HOLD</span> <span class="small short">' + h(o.hold_reason) + '</span>' : '') + '</label>'; }).join('') || '<span class="muted">Koi open order nahi.</span>';
    }
    drawOrders(); $('oq').oninput = drawOrders;
    $('hx').onclick = function () { holdExcel(rs[1], hl); };
    $('oall').onchange = function () { var c = this.checked; Array.prototype.forEach.call(document.querySelectorAll('[data-o]'), function (x) { x.checked = c; }); };
    function sel() { return Array.prototype.filter.call(document.querySelectorAll('[data-o]'), function (x) { return x.checked; }).map(function (x) { return Number(x.getAttribute('data-o')); }); }
    function bulk(un) { var ids = sel(); if (!ids.length) return toast('Order select karein', 'err'); call('bulkHold', { ids: ids, unhold: un ? 1 : 0, reason: val('br'), note: val('bn') }).then(function (r) { toast((un ? 'Unhold: ' : 'Hold: ') + r.done + (r.errors.length ? ' • skip ' + r.errors.length : '')); vHoldList(v); }).catch(fail); }
    $('udb').onclick = function () { var d = hl.dealers.filter(function (x) { return x.name === val('udn'); })[0]; if (!d) return toast('Dealer list se chunein', 'err'); if (!confirm(d.name + ' ke sab HOLD orders unhold karein?')) return; call('unholdDealer', { dealer_id: d.id }).then(function (r) { toast(r.dealer + ': ' + r.orders_unheld + ' orders unhold'); vHoldList(v); }).catch(fail); };
    $('bh').onclick = function () { bulk(0); }; $('bu').onclick = function () { bulk(1); };
    Array.prototype.forEach.call(document.querySelectorAll('[data-ud]'), function (b) { b.onclick = function () { if (!confirm('Is dealer ko list se hata kar uske sab HOLD orders unhold karein?')) return; call('unholdDealer', { entry_id: Number(b.getAttribute('data-ud')) }).then(function (r) { toast(r.dealer + ': ' + r.orders_unheld + ' orders unhold'); vHoldList(v); }).catch(fail); }; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-rm]'), function (b) { b.onclick = function () { if (!confirm('List se hatayein? (orders ka hold khud nahi hatega)')) return; call('saveHoldDealer', { id: Number(b.getAttribute('data-rm')), remove: 1 }).then(function () { toast('Hata diya'); vHoldList(v); }).catch(fail); }; });
    $('aa').onclick = function () { var d = hl.dealers.filter(function (x) { return x.name === val('ad'); })[0]; if (!d) return toast('Dealer list se chunein', 'err'); call('saveHoldDealer', { dealer_id: d.id, why: val('aw'), brand: val('ab'), os: val('ao') }).then(function (r) { toast('Joda • ' + r.count + ' orders hold'); vHoldList(v); }).catch(fail); };
    $('lm').onclick = function () {
      var rows = parseHoldPaste(val('lp')); if (!rows.length) return toast('Kuch paste nahi kiya', 'err');
      call('holdMatch', { rows: rows }).then(function (m) {
        match = m; var bad = { sure: '', maybe: ' <span class="pill st-hold">pakka nahi</span>', none: ' <span class="pill st-hold">nahi mila</span>' };
        $('lr').innerHTML = m.map(function (x, i) { return '<label class="chk"><input type="checkbox" data-m="' + i + '"' + (x.status === 'sure' ? ' checked' : '') + (x.status === 'none' ? ' disabled' : '') + '> ' + h(x.dealer) + ' → <b>' + h(x.master_name || '-') + '</b> <span class="small muted">' + x.score + '% • ' + h(x.why) + ' • ' + h(x.brand) + ' • OS ' + h(x.os) + '</span>' + bad[x.status] + '</label>'; }).join('') +
          '<p class="small muted">' + m.filter(function (x) { return x.status === 'sure'; }).length + ' pakke match. "Pakka nahi" wale khud check karke tick karein.</p><button class="primary big" id="ls">List save + orders HOLD karein</button>';
        $('ls').onclick = function () {
          var pick = Array.prototype.filter.call(document.querySelectorAll('[data-m]'), function (x) { return x.checked; }).map(function (x) { return match[Number(x.getAttribute('data-m'))]; });
          if (!pick.length) return toast('Koi dealer select nahi', 'err'); if (!confirm(pick.length + ' dealers ki nayi list save karein? Purani list hat jayegi.')) return;
          call('importHoldList', { list_date: val('ld'), rows: pick }).then(function (r) { toast('List: ' + r.entries + ' dealers • ' + r.count + ' orders HOLD'); vHoldList(v); }).catch(fail);
        };
      }).catch(fail);
    };
  }).catch(function (e) { if (/Unknown action/i.test(String(e && e.message || e))) { v.innerHTML = '<div class="card center muted">Hold list abhi chalu nahi hai (server update baaki hai). Thodi der baad try karein.</div>'; return; } fail(e); });
}

// HOLD orders -> Excel (.xlsx via SheetJS CDN; internet na ho to CSV)
var XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
function loadXlsx() { if (window.XLSX && window.XLSX.utils) return Promise.resolve(); return new Promise(function (ok, no) { var sc = document.createElement('script'); sc.src = XLSX_URL; sc.onload = function () { window.XLSX && window.XLSX.utils ? ok() : no(new Error('xlsx')); }; sc.onerror = function () { no(new Error('xlsx')); }; document.head.appendChild(sc); }); }
function ftm(iso) { var t = Date.parse(iso); if (!isFinite(t)) return ''; var d = new Date(t + 330 * 60000).toISOString(); return d.slice(8, 10) + '-' + d.slice(5, 7) + '-' + d.slice(0, 4) + ' ' + d.slice(11, 16); }
function days(from) { var t = Date.parse(from); return isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86400000)) : ''; }
function holdType(o) { return /^Hold list/i.test(o.hold_by || '') ? 'HOLD list' + (o.hold_reason === 'Cheque bounce' ? ' (Cheque bounce)' : '') : (o.hold_reason === 'Cheque bounce' ? 'Cheque bounce' : 'Manual'); }
function holdRows(orders, hl) {
  var bySrc = {}, byName = {}, dl = {};
  (hl.entries || []).forEach(function (e) { if (e.dealer_src_id !== '') bySrc[String(e.dealer_src_id)] = e; byName[String(e.dealer_name).toUpperCase()] = e; });
  (hl.dealers || []).forEach(function (d) { if (d.src_id != null) dl[String(d.src_id)] = d; });
  return orders.filter(function (o) { return Number(o.hold) && o.stage !== 'cancelled' && o.stage !== 'dispatched'; }).map(function (o) {
    var e = bySrc[String(o.dealer_src_id)] || byName[String(o.dealer_name).toUpperCase()] || {}, d = dl[String(o.dealer_src_id)] || {}, rec = (o.sla && o.sla.received_at) || o.src_at || o.created_at;
    return { 'Dealer': o.dealer_name, 'Tracking no': o.track_no || '', 'Order no': ono(o), 'Order date': dmy(o.order_date), 'Order aaya (time)': rec ? ftm(rec) : '', 'Brand': (o.lines || []).map(function (l) { return l.brand; }).filter(function (b, i, a) { return b && a.indexOf(b) === i; }).join(', '),
      'Pcs': Number(o.pcs) || 0, 'Stage': stageLbl(o.stage), 'Hold reason': o.hold_reason || '', 'Hold type': holdType(o), 'Held by': o.hold_by || '', 'Held on': ftm(o.hold_at), 'Note': o.hold_note || '',
      'List reason': e.why || '', 'Dealer OS (Rs)': e.os === '' || e.os == null ? '' : Number(e.os), 'Overdue (Rs)': d.overdue === '' || d.overdue == null ? '' : Number(d.overdue), 'Order age (din)': o.order_date ? days(o.order_date + 'T00:00:00+05:30') : '', 'Hold age (din)': days(o.hold_at), 'Zone': o.zone || '', 'Area': o.area || '', 'Salesman': o.salesman || '' };
  }).sort(function (a, b) { return a.Dealer < b.Dealer ? -1 : a.Dealer > b.Dealer ? 1 : 0; });
}
function holdExcel(orders, hl) {
  var rows = holdRows(orders, hl); if (!rows.length) return toast('Abhi koi order HOLD par nahi', 'err');
  var name = 'Dealer-orders-on-HOLD-' + today();
  loadXlsx().then(function () { var X = window.XLSX;
    var ws = X.utils.json_to_sheet(rows); ws['!cols'] = Object.keys(rows[0]).map(function (k) { return { wch: Math.min(40, Math.max(k.length, 8) + 2) }; }); ws['!autofilter'] = { ref: ws['!ref'] };
    var wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'HOLD orders'); X.writeFile(wb, name + '.xlsx'); toast(rows.length + ' HOLD orders download');
  }).catch(function (e) { if (window.console) console.warn('xlsx ' + (e && e.message || e)); csv(rows, 'Dealer-orders-on-HOLD'); toast('Excel load nahi hua, CSV download kiya'); });
}

// ---------------- login / setup
function vLogin(v) {
  v.innerHTML = '<div class="card"><h2>IM Warehouse login</h2><label>Username ya mobile</label><input id="u" autocomplete="username"><label>PIN</label><input id="p" type="password" inputmode="numeric" autocomplete="current-password">' +
    '<button class="primary big" id="go" style="margin-top:14px">Login</button><p class="center small"><a href="#/setup">Setup / API link</a></p></div>';
  $('go').onclick = function () { call('login', { username: val('u'), pin: val('p') }).then(function (r) { S.token = r.token; S.user = r.user; LS.setItem('imw_token', r.token); LS.setItem('imw_user', JSON.stringify(r.user)); go('/q'); }).catch(fail); };
}
function vSetup(v) {
  v.innerHTML = '<div class="card"><h2>Setup / API link</h2><p class="small muted">Apps Script Web app ka /exec link yahan paste karein.</p><input id="api" value="' + h(apiUrl()) + '"><div class="row" style="margin-top:10px"><button class="primary" id="sv">Save</button><button id="tp">Test</button></div><p class="center small"><a href="#/login">Login par wapas</a></p></div>';
  $('sv').onclick = function () { if (!/^https:\/\/script\.google(usercontent)?\.com\/.+\/exec/.test(val('api'))) return toast('Link /exec par khatam hona chahiye', 'err'); LS.setItem('imw_api', val('api')); toast('Saved'); go(S.token ? '/q' : '/login'); };
  $('tp').onclick = function () { LS.setItem('imw_api', val('api')); call('ping').then(function () { toast('Connected'); }).catch(fail); };
}

// ---------------- lists
function cardInner(o) {
  return '<div class="row"><b>' + trk(o) + h(ono(o)) + ' ' + h(o.dealer_name) + '</b><span style="flex:0;white-space:nowrap">' + pill(o) + badges(o) + '</span></div>' +
    '<div class="small">' + slaBadge(o) + '</div><div class="small muted">' + h(dmy(o.order_date)) + ' • ' + (o.zone ? '<b>' + h(o.zone) + '</b> / ' : '') + h(o.area || 'area ?') + (o.route ? ' • ' + h(o.route) : '') + (o.beat_day ? ' • beat ' + h(o.beat_day) : '') + (o.salesman ? ' • ' + h(o.salesman) : '') + (o.taken_by ? ' • liya: ' + h(o.taken_by) : '') + (o.expected_date ? ' • exp ' + h(dmy(o.expected_date)) : '') + (o.plan_delivery_date ? ' • plan ' + h(dmy(o.plan_delivery_date)) + (o.plan_van ? ' ' + h(o.plan_van) : '') : '') + '</div>' +
    '<div class="small">' + (o.lines || []).map(function (l) { return h(l.brand) + ' ' + pcs(l.ordered_qty); }).join(' + ') + ((o.lines || []).length > 1 ? ' = <b>' + pcs(o.pcs) + '</b>' : '') +
    [['Punch', o.punch_name], ['P', o.picker_name], ['C', o.checker_name], ['B', o.biller_name], ['Pk', o.packer_name]].filter(function (x) { return x[1]; }).map(function (x) { return ' • ' + x[0] + ': ' + h(x[1]); }).join('') + (o.invoice_no ? ' • Inv ' + h(o.invoice_no) : '') + (o.vehicle || o.delivery_mode ? ' • ' + h(o.vehicle || o.delivery_mode) : '') + '</div>' +
    (Number(o.hold) ? '<div class="small short">Hold: ' + h(o.hold_reason) + ' ' + h(o.hold_note) + '</div>' : '') + (o.stage === 'cancelled' ? '<div class="small short">Cancel: ' + h(o.cancel_reason) + '</div>' : '');
}
function card(o, sel) {
  if (!sel) return '<a class="card" style="display:block;text-decoration:none;color:inherit" href="#/o/' + o.id + '">' + cardInner(o) + '</a>';
  return '<div class="card" style="display:flex;align-items:flex-start;gap:8px"><label style="flex:none;padding-top:2px"><input type="checkbox" class="qsel" data-id="' + o.id + '" style="width:22px;height:22px"></label><a style="flex:1;text-decoration:none;color:inherit" href="#/o/' + o.id + '">' + cardInner(o) + '</a></div>';
}
function newBtn() { return canNew() ? '<button class="sm primary" onclick="location.hash=\'#/new\'">+ New order</button>' : ''; }
function syncBtn() { return newBtn() + (can('sync') ? '<button class="sm" id="sync">🔄 Sync now</button>' : ''); }
function bindSync(after) { var b = $('sync'); if (b) b.onclick = function () { call('syncNow').then(function (r) { toast('Sync: ' + r.new_orders + ' naye orders, ' + r.dealers_added + ' naye dealers' + (r.auto_held ? ', ' + r.auto_held + ' auto HOLD' : '')); S.m = null; after(); }).catch(fail); }; }
// Meri queue date filter (client-side, by order_date; show_from still applies on the server)
function addDays(d, n) { return new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
function qRange(k, d1, d2) {
  var t = today(), dow = (new Date(t + 'T00:00:00Z').getUTCDay() + 6) % 7; // Monday = 0
  switch (k) {
    case 'today': return [t, t]; case 'yday': var y = addDays(t, -1); return [y, y];
    case 'week': return [addDays(t, -dow), t]; case 'month': return [t.slice(0, 8) + '01', t];
    case 'date': return d1 ? [d1, d1] : null; case 'range': return d1 || d2 ? [d1 || '0000-00-00', d2 || '9999-12-31'] : null;
    default: return null;
  }
}
function vQueue(v) {
  var jobs = [call('orders', {})];
  if (can('view')) jobs.push(call('dupList').catch(function () { return null; }));
  Promise.all(jobs).then(function (rs) {
    var list = rs[0], dupPairs = rs[1];
    var k = LS.getItem('imw_qf') || '', d1 = LS.getItem('imw_qd1') || '', d2 = LS.getItem('imw_qd2') || '';
    var qs = LS.getItem('imw_qs') || '', dq = '';
    var opts = [['', 'Sab dates'], ['today', 'Aaj'], ['yday', 'Kal'], ['week', 'Is hafte'], ['month', 'Is mahine'], ['date', 'Ek date'], ['range', 'From - To']];
    var stageOpts = [['', 'Sab'], ['picking', 'Picking'], ['checking', 'Checking'], ['billing', 'Billing'], ['hold', 'HOLD'], ['dup', '⚠ Duplicates'], ['pending_bill', 'Pending for billing']];
    v.innerHTML = '<div class="row"><h2>Meri queue (<span id="qn">' + list.length + '</span>)</h2>' + syncBtn() + '</div><p class="small muted">Last sync: ' + tm(S.m.last_sync) + '</p>' +
      '<div class="row"><select id="qf">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === k ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<input type="date" id="qd1" value="' + h(d1) + '" title="Date / From"><input type="date" id="qd2" value="' + h(d2) + '" title="To"></div>' +
      '<div class="row" style="margin-top:8px;flex-wrap:wrap;gap:6px"><input id="qdl" placeholder="Dealer / customer search" style="flex:1;min-width:180px" list="qdl_list" autocomplete="off"><datalist id="qdl_list"></datalist></div>' +
      '<div class="row" style="margin-top:6px;flex-wrap:wrap;gap:6px" id="qstages"></div>' +
      '<p class="small" id="qsum"></p><div id="qlst"></div>';
    function qStageOk(o, st) {
      if (!st) return true;
      if (st === 'hold') return !!Number(o.hold);
      if (st === 'pending_bill') return o.stage !== 'cancelled' && o.stage !== 'dispatched' && ['new', 'punched', 'allocated', 'picked', 'checked'].indexOf(o.stage) >= 0;
      if (st === 'picking') return o.stage === 'allocated';
      if (st === 'checking') return o.stage === 'picked';
      if (st === 'billing') return o.stage === 'checked';
      return o.stage === st;
    }
    function qDealerOk(o, q) {
      if (!q) return true;
      q = q.toUpperCase();
      return String(o.dealer_name || '').toUpperCase().indexOf(q) >= 0;
    }
    function draw() {
      $('qd1').style.display = k === 'date' || k === 'range' ? '' : 'none'; $('qd2').style.display = k === 'range' ? '' : 'none';
      var r = qRange(k, d1, d2), base = r ? list.filter(function (o) { var d = String(o.order_date || ''); return d >= r[0] && d <= r[1]; }) : list;
      var names = {};
      base.forEach(function (o) { if (o.dealer_name) names[o.dealer_name] = 1; });
      $('qdl_list').innerHTML = Object.keys(names).sort().map(function (n) { return '<option value="' + h(n) + '">'; }).join('');
      var mid = base.filter(function (o) { return qDealerOk(o, dq); });
      var pairs = dupPairs != null ? dupPairs : dupPairsFromOrders(list);
      var shownDups = dupGroupsInList(dupGroupList(pairs), mid);
      $('qstages').innerHTML = stageOpts.map(function (s) {
        var n = s[0] === 'dup' ? shownDups.length : mid.filter(function (o) { return qStageOk(o, s[0]); }).length;
        return '<button type="button" class="sm' + (qs === s[0] ? ' primary' : (s[0] === 'dup' && n ? ' danger' : '')) + '" data-qs="' + s[0] + '">' + s[1] + ' (' + n + ')</button>';
      }).join('');
      Array.prototype.forEach.call(document.querySelectorAll('#qstages [data-qs]'), function (b) {
        b.onclick = function () { qs = b.getAttribute('data-qs'); LS.setItem('imw_qs', qs); draw(); };
      });
      var bits = [];
      if (r) bits.push('Order date ' + h(dmy(r[0] === '0000-00-00' ? '' : r[0]) || '...') + ' se ' + h(dmy(r[1] === '9999-12-31' ? '' : r[1]) || '...'));
      if (dq) bits.push('dealer "' + h(dq) + '"');
      if (qs === 'dup') {
        var oc = shownDups.reduce(function (a, g) { return a + g.orders.length; }, 0);
        $('qn').textContent = shownDups.length + (r || dq || qs ? ' / ' + list.length : '');
        $('qsum').innerHTML = (bits.length ? bits.join(' · ') + ': ' : '') + '<b>' + shownDups.length + '</b> duplicate groups, <b>' + oc + '</b> orders · <a href="#/dup">Duplicates page</a>';
        $('qlst').innerHTML = shownDups.length ? dupGroupCardsHtml(shownDups, isMgr()) : '<div class="card center muted">' + ((r || dq) ? 'Is filter mein koi possible duplicate nahi.' : 'Koi possible duplicate nahi 👍') + '</div>';
        bindDupGroupActions($('qlst'), shownDups, function () { vQueue(v); });
        return;
      }
      var f = mid.filter(function (o) { return qStageOk(o, qs); });
      var tp = f.reduce(function (a, o) { return a + (Number(o.pcs) || 0); }, 0);
      var canMark = isMgr() && !!dq;
      $('qn').textContent = f.length + (r || dq || qs ? ' / ' + list.length : '');
      $('qsum').innerHTML = (bits.length ? bits.join(' · ') + ': ' : 'Sab: ') + '<b>' + f.length + '</b> orders, <b>' + pcs(tp) + '</b>' +
        (canMark ? ' · <button type="button" class="sm primary" id="qmd">Mark duplicate</button> <span class="small muted">2+ orders select karke mark karein</span>' : '');
      $('qlst').innerHTML = f.length ? f.map(function (o) { return card(o, canMark); }).join('') : '<div class="card center muted">' + ((r || dq || qs) ? 'Is filter mein koi order nahi.' : 'Abhi koi kaam nahi.') + '</div>';
      if (canMark && $('qmd')) $('qmd').onclick = function () {
        var ids = Array.prototype.map.call(v.querySelectorAll('.qsel:checked'), function (x) { return Number(x.dataset.id); });
        if (ids.length < 2) return toast('Kam se kam 2 orders chunein', 'err');
        if (!confirm(ids.length + ' orders ko possible duplicate mark karein? Duplicates tab mein dikhenge.')) return;
        call('markDups', { ids: ids }).then(function () { toast('Duplicate mark ho gaya'); qs = 'dup'; LS.setItem('imw_qs', qs); vQueue(v); }).catch(fail);
      };
    }
    $('qf').onchange = function () { k = this.value; LS.setItem('imw_qf', k); if ((k === 'date' || k === 'range') && !d1) { d1 = today(); $('qd1').value = d1; LS.setItem('imw_qd1', d1); } draw(); };
    $('qd1').onchange = function () { d1 = this.value; LS.setItem('imw_qd1', d1); draw(); };
    $('qd2').onchange = function () { d2 = this.value; LS.setItem('imw_qd2', d2); draw(); };
    $('qdl').oninput = function () { dq = this.value.trim(); draw(); };
    draw(); bindSync(function () { vQueue(v); });
  }).catch(fail);
}

function vAll(v) {
  call('orders', { all: 1 }).then(function (list) {
    var st = LS.getItem('imw_f') || '', sf = LS.getItem('imw_sf') || '', pv = LS.getItem('imw_pv') || '', pd = LS.getItem('imw_pd') || '';
    var vans = (S.m.van_plan && S.m.van_plan.vans) || ['DL1LAP-0938', 'DL1LZ-6422'];
    function draw() {
      var f = list.filter(function (o) {
        var ok = !st || (st === 'hold' ? Number(o.hold) : st === 'dup' ? (o.dups || []).length : st === 'punch_pending' ? o.stage === 'new' && Number(o.needs_punch) : st === 'unmapped' ? (o.plan_flag === 'unmapped' || /^unmapped$/i.test(String(o.zone || '')) || !String(o.area || '').trim()) : st === 'kal' ? String(o.plan_delivery_date) === addDays(today(), 1) : st === 'aaj_plan' ? String(o.plan_delivery_date) === today() : o.stage === st);
        return ok && (!sf || srcOf(o) === sf) && (!pv || String(o.plan_van) === pv) && (!pd || String(o.plan_delivery_date) === pd);
      }), q = (val('q') || '').toUpperCase();
      if (q) f = f.filter(function (o) { return (o.track_no + ' ' + ono(o) + ' ' + o.dealer_name + ' ' + o.zone + ' ' + o.area + ' ' + o.route + ' ' + o.invoice_no + ' ' + (o.plan_van || '')).toUpperCase().indexOf(q) >= 0; });
      $('lst').innerHTML = f.map(card).join('') || '<div class="card center muted">Kuch nahi</div>';
    }
    v.innerHTML = '<div class="row"><h2>Sab orders</h2>' + syncBtn() + '<button class="sm" id="ex">CSV</button>' + (function (n) { return '<a class="btn sm' + (n ? ' danger' : '') + '" href="#/dup">⚠ Duplicates' + (n ? ' (' + n + ')' : '') + '</a>'; })(list.filter(function (o) { return (o.dups || []).length; }).length) + '</div><div class="row"><select id="st"><option value="">Sab stage</option>' + S.m.stages.map(function (s) { return '<option value="' + s + '"' + (st === s ? ' selected' : '') + '>' + h(stageLbl(s)) + '</option>'; }).join('') + '<option value="punch_pending"' + (st === 'punch_pending' ? ' selected' : '') + '>Trylo: punching baaki</option><option value="hold"' + (st === 'hold' ? ' selected' : '') + '>HOLD</option><option value="dup"' + (st === 'dup' ? ' selected' : '') + '>⚠ Possible duplicates</option><option value="aaj_plan"' + (st === 'aaj_plan' ? ' selected' : '') + '>Aaj plan delivery</option><option value="kal"' + (st === 'kal' ? ' selected' : '') + '>Kal plan delivery</option><option value="unmapped"' + (st === 'unmapped' ? ' selected' : '') + '>Unmapped area</option><option value="cancelled"' + (st === 'cancelled' ? ' selected' : '') + '>Cancel</option></select><select id="sf"><option value="">Sab source</option>' + ['Sales Tracker'].concat(S.m.sources || []).map(function (x) { return '<option' + (x === sf ? ' selected' : '') + '>' + h(x) + '</option>'; }).join('') + '</select></div><div class="row"><select id="pv"><option value="">Sab van</option>' + vans.map(function (x) { return '<option value="' + h(x) + '"' + (x === pv ? ' selected' : '') + '>' + h(x) + '</option>'; }).join('') + '</select><input type="date" id="pd" value="' + h(pd) + '" title="Plan delivery date"><input id="q" placeholder="Tracking / dealer / area / van"></div><div id="lst" style="margin-top:10px"></div>';
    $('st').onchange = function () { st = this.value; LS.setItem('imw_f', st); draw(); }; $('sf').onchange = function () { sf = this.value; LS.setItem('imw_sf', sf); draw(); };
    $('pv').onchange = function () { pv = this.value; LS.setItem('imw_pv', pv); draw(); }; $('pd').onchange = function () { pd = this.value; LS.setItem('imw_pd', pd); draw(); };
    $('q').oninput = draw; draw(); bindSync(function () { vAll(v); });
    $('ex').onclick = function () { call('exportOrders').then(function (r) { csv(r, 'warehouse-orders'); }).catch(fail); };
  }).catch(fail);
}

// ---------------- possible duplicates (same dealer, overlapping items/amount, close dates, not yet billed)
function dupLine(o) { return (o.lines || []).map(function (l) { return h(l.brand) + (l.item ? ' ' + h(l.item) : '') + ' ' + pcs(l.ordered_qty); }).join(' + ') + ' = <b>' + pcs(o.pcs) + '</b> pcs'; }
function dupPicked(o) { var st = (S.m && S.m.stages) || []; return !!(o && (o.picked_at || (st.indexOf(o.stage) >= 0 && st.indexOf('picked') >= 0 && st.indexOf(o.stage) >= st.indexOf('picked')))); }
function dupGroupList(list) {
  var parent = {}, by = {};
  function find(x) { x = String(x); if (!parent[x] || parent[x] === x) return parent[x] = x; return parent[x] = find(parent[x]); }
  function uni(a, b) { a = find(a); b = find(b); if (a !== b) parent[a] = b; }
  (list || []).forEach(function (p) { if (!p || !p.a || !p.b) return; by[p.a.id] = p.a; by[p.b.id] = p.b; uni(p.a.id, p.b.id); });
  var groups = {};
  Object.keys(by).forEach(function (k) {
    var r = find(k); if (!groups[r]) groups[r] = { orders: [], pairs: [], brands: {}, items: {}, days: 0 };
    groups[r].orders.push(by[k]);
  });
  (list || []).forEach(function (p) {
    if (!p || !p.a) return; var g = groups[find(p.a.id)]; if (!g) return;
    g.pairs.push(p); (p.brands || []).forEach(function (b) { g.brands[b] = 1; }); (p.items || []).forEach(function (b) { g.items[b] = 1; }); if (p.days > g.days) g.days = p.days;
    if (p.manual) g.manual = 1; if (p.billed) g.billed = 1; if (p.billed_id) g.billed_id = p.billed_id;
  });
  return Object.keys(groups).map(function (k) {
    var g = groups[k];
    g.orders.sort(function (a, b) { return String(a.order_date) < String(b.order_date) ? -1 : String(a.order_date) > String(b.order_date) ? 1 : Number(a.id) - Number(b.id); });
    return g;
  });
}
/** Build pairs from list-row .dups ids when dupList is not available (non-view roles). */
function dupPairsFromOrders(list) {
  var by = {}, seen = {}, pairs = [];
  (list || []).forEach(function (o) { if (o && o.id != null) by[o.id] = o; });
  (list || []).forEach(function (o) {
    (o.dups || []).forEach(function (id) {
      var a = Number(o.id), b = Number(id); if (!b || a === b) return;
      var k = a < b ? a + '-' + b : b + '-' + a; if (seen[k]) return; seen[k] = 1;
      var other = by[b]; if (!other) return;
      pairs.push({ a: o, b: other, brands: [], items: [], why: '', days: 0 });
    });
  });
  return pairs;
}
/** Groups that have at least one order present in list (after date / dealer filter). */
function dupGroupsInList(groups, list) {
  var ids = {};
  (list || []).forEach(function (o) { ids[o.id] = 1; });
  return (groups || []).filter(function (g) { return (g.orders || []).some(function (o) { return ids[o.id]; }); });
}
function isDupBilled(o) {
  if (!o) return false;
  if (o.invoice_no) return true;
  var st = (S.m && S.m.stages) || [];
  return st.indexOf(o.stage) >= 0 && st.indexOf('billed') >= 0 && st.indexOf(o.stage) >= st.indexOf('billed');
}
function onoBilled(o) { return ono(o) + (o.invoice_no ? ' (Inv ' + o.invoice_no + ')' : ''); }
function dupGroupCardsHtml(groups, withActions) {
  return (groups || []).map(function (g, i) {
    var name = (g.orders[0] && g.orders[0].dealer_name) || '', meta = Object.keys(g.brands).concat(Object.keys(g.items));
    if (g.days) meta = meta.concat([g.days + ' din ka fark']);
    if (g.manual) meta = meta.concat(['manual']);
    var billedOs = g.orders.filter(isDupBilled), openOs = g.orders.filter(function (o) { return !isDupBilled(o); });
    if (billedOs.length && openOs.length) meta = meta.concat(['ek billed + open']);
    var acts = '';
    if (withActions) {
      if (billedOs.length && openOs.length) {
        acts = openOs.map(function (o) {
          return billedOs.map(function (b) { return '<button class="sm primary" data-c="' + i + '" data-open="' + o.id + '" data-billed="' + b.id + '">Cancel as duplicate of ' + h(onoBilled(b)) + '</button>'; }).join(' ');
        }).join(' ');
        if (isAdmin()) acts += openOs.map(function (o) {
          return '<button class="sm danger" data-del="' + i + '" data-open="' + o.id + '" data-billed="' + billedOs[0].id + '">Delete duplicate ' + h(ono(o)) + '</button>';
        }).join(' ');
        acts += '<button class="sm" data-n="' + i + '">Not duplicate</button>';
      } else {
        acts = '<button class="sm primary" data-m="' + i + '">Merge selected</button><button class="sm" data-n="' + i + '">Not duplicate</button>';
      }
    }
    return '<div class="card" data-g="' + i + '" style="border:2px solid #c0392b"><div><b>' + h(name) + '</b> <span class="small muted">' + h(meta.join(' • ')) + ' • ' + g.orders.length + ' orders</span></div>' +
      g.orders.map(function (o) { return '<label class="chk"><input type="checkbox" class="dsel" data-id="' + o.id + '" checked> <a href="#/o/' + o.id + '">' + trk(o) + h(ono(o)) + '</a><span class="small">' + h(srcOf(o)) + ' • ' + h(dmy(o.order_date)) + ' • ' + dupLine(o) + ' • ' + h(stageLbl(o.stage)) + (isDupBilled(o) && o.invoice_no ? ' • Inv ' + h(o.invoice_no) : '') + '</span></label>'; }).join('') +
      (acts ? '<div class="row" style="flex-wrap:wrap;gap:6px">' + acts + '</div>' : '') + '</div>';
  }).join('');
}
function bindDupGroupActions(root, groups, onDone) {
  if (!root) return;
  Array.prototype.forEach.call(root.querySelectorAll('[data-m]'), function (b) {
    b.onclick = function () {
      var g = groups[b.dataset.m], ids = Array.prototype.map.call(root.querySelectorAll('.card[data-g="' + b.dataset.m + '"] .dsel:checked'), function (x) { return Number(x.dataset.id); });
      var selected = g.orders.filter(function (o) { return ids.indexOf(Number(o.id)) >= 0; });
      if (selected.length < 2) return toast('Kam se kam 2 orders chunein', 'err');
      if (selected.some(isDupBilled)) return toast('Billed order merge nahi ho sakta. Cancel as duplicate use karein.', 'err');
      mergeDialog(selected, onDone);
    };
  });
  Array.prototype.forEach.call(root.querySelectorAll('[data-c]'), function (b) {
    b.onclick = function () {
      var openId = Number(b.getAttribute('data-open')), billedId = Number(b.getAttribute('data-billed'));
      var g = groups[b.dataset.c], open = g.orders.filter(function (o) { return Number(o.id) === openId; })[0], billed = g.orders.filter(function (o) { return Number(o.id) === billedId; })[0];
      if (!open || !billed) return;
      if (!confirm(ono(open) + ' ko ' + onoBilled(billed) + ' ka duplicate mark karke cancel (Merge ho gaya) karein? Pcs add nahi honge.')) return;
      call('cancelAsDup', { open_id: open.id, billed_id: billed.id }).then(function () { toast('Duplicate mark ho gaya, open order hide ho gaya'); if (onDone) onDone(); }).catch(fail);
    };
  });
  Array.prototype.forEach.call(root.querySelectorAll('[data-del]'), function (b) {
    b.onclick = function () {
      if (!isAdmin()) return toast('Sirf admin delete kar sakta hai', 'err');
      var openId = Number(b.getAttribute('data-open')), billedId = Number(b.getAttribute('data-billed'));
      var g = groups[b.dataset.del], open = g.orders.filter(function (o) { return Number(o.id) === openId; })[0], billed = g.orders.filter(function (o) { return Number(o.id) === billedId; })[0];
      if (!open || !billed) return;
      if (isDupBilled(open) || open.invoice_no) return toast('Billed / invoice wala order delete nahi ho sakta', 'err');
      if (!confirm('Delete ' + ono(open) + '? Sirf yeh open duplicate delete hoga. Billed ' + onoBilled(billed) + ' nahi chhedega. Wapas queue mein nahi aayega.')) return;
      call('deleteDup', { open_id: open.id, billed_id: billed.id }).then(function () { toast(ono(open) + ' delete ho gaya'); if (onDone) onDone(); }).catch(fail);
    };
  });
  Array.prototype.forEach.call(root.querySelectorAll('[data-n]'), function (b) {
    b.onclick = function () {
      var g = groups[b.dataset.n]; if (!confirm('In sab ko duplicate nahi maane? Flag hamesha ke liye hat jayega.')) return;
      Promise.all((g.pairs || []).map(function (p) { return call('dismissDup', { a: p.a.id, b: p.b.id }); })).then(function () { toast('Flag hata diya'); if (onDone) onDone(); }).catch(fail);
    };
  });
}
function dupCard(o, others) {
  if (!others || !others.length || !isMgr()) return '';
  var meBilled = isDupBilled(o);
  return '<div class="card" style="border:2px solid #c0392b"><h3>⚠ Possible duplicate (' + others.length + ')</h3><p class="small muted">Same dealer, overlapping items / amount, paas ki date. Open + open: merge. Ek billed + ek open: open ko cancel as duplicate.</p>' +
    others.map(function (x) {
      var billedOther = isDupBilled(x), act = '';
      if (!meBilled && !billedOther) act = '<button class="sm primary dupm" data-id="' + x.id + '">Merge</button>';
      else if (meBilled && !billedOther) act = '<button class="sm primary dupc" data-open="' + x.id + '" data-billed="' + o.id + '">Cancel as duplicate of ' + h(onoBilled(o)) + '</button>' + (isAdmin() ? '<button class="sm danger dupdel" data-open="' + x.id + '" data-billed="' + o.id + '">Delete duplicate ' + h(ono(x)) + '</button>' : '');
      else if (!meBilled && billedOther) act = '<button class="sm primary dupc" data-open="' + o.id + '" data-billed="' + x.id + '">Cancel as duplicate of ' + h(onoBilled(x)) + '</button>' + (isAdmin() ? '<button class="sm danger dupdel" data-open="' + o.id + '" data-billed="' + x.id + '">Delete duplicate ' + h(ono(o)) + '</button>' : '');
      return '<div class="chk"><a href="#/o/' + x.id + '">' + trk(x) + h(ono(x)) + '</a><span class="small">' + h(srcOf(x)) + ' • ' + h(dmy(x.order_date)) + ' • ' + dupLine(x) + ' • ' + h(stageLbl(x.stage)) + (x.invoice_no ? ' • Inv ' + h(x.invoice_no) : '') + '</span>' + act + '<button class="sm dupn" data-id="' + x.id + '">Not duplicate</button></div>';
    }).join('') +
    (!meBilled && others.filter(function (x) { return !isDupBilled(x); }).length ? '<div class="row"><button class="sm primary" id="dma">Merge selected (2+)</button></div>' : '') + '</div>';
}
function dupSide(x) {
  return '<div class="card"><label><input type="radio" name="dk" value="' + x.id + '"> <b>Ye rakhein</b></label><div><b>' + trk(x) + h(ono(x)) + '</b></div><div class="small">' + h(srcOf(x)) + (x.salesman ? ' • salesman ' + h(x.salesman) : '') + (x.taken_by ? ' • liya ' + h(x.taken_by) : '') + '</div><div class="small">' + h(dmy(x.order_date)) + ' ' + tm(x.src_at || x.created_at) + '</div><div class="small">' + dupLine(x) + '</div><div class="small">' + h(stageLbl(x.stage)) + (Number(x.hold) ? ' • HOLD' : '') + (dupPicked(x) ? ' • pick ho chuka' : '') + '</div>' + (x.remarks ? '<div class="small muted">Remark: ' + h(x.remarks) + '</div>' : '') + '</div>';
}
function mergeDialog(a, b, done) {
  var orders, cb;
  if (Object.prototype.toString.call(a) === '[object Array]') { orders = a; cb = b; } else { orders = [a, b]; cb = done; }
  orders = (orders || []).filter(Boolean);
  if (orders.length < 2) return toast('Kam se kam 2 orders chunein', 'err');
  sheet('<h3>Duplicate merge</h3><p class="small muted">' + h(orders[0].dealer_name) + '. Jo order rakhna hai use chunein. Baaki "Merge ho gaya" ho jayenge (delete nahi hota, queue se hat jaate hain). Default: lines / pcs jod diye jaate hain.</p><div' + (orders.length === 2 ? ' class="grid2"' : '') + '>' + orders.map(dupSide).join('') + '</div>' +
    '<label><input type="radio" name="dmode" value="add" checked> Lines / pcs jod do (same brand+item add, nayi lines alag)</label><label><input type="radio" name="dmode" value="keep"> Sirf ek rakhein (pcs nahi jodne)</label>' +
    '<button class="primary big" id="dms" style="margin-top:10px">Merge karein</button>');
  var def = orders.filter(function (o) { return !/^W-/.test(String(o.src_id || '')) && !dupPicked(o); })[0] || orders.filter(function (o) { return !dupPicked(o); })[0] || orders[0];
  var r0 = document.querySelector('input[name=dk][value="' + def.id + '"]'); if (r0) r0.checked = true;
  $('dms').onclick = function () {
    var k = document.querySelector('input[name=dk]:checked'); if (!k) return toast('Kaunsa rakhna hai chunein', 'err');
    var keep = Number(k.value), keepO = orders.filter(function (o) { return Number(o.id) === keep; })[0];
    var drops = orders.filter(function (o) { return Number(o.id) !== keep; });
    var add = document.querySelector('input[name=dmode]:checked').value === 'add';
    if (add && dupPicked(keepO)) return toast('Pick ho chuke order mein pcs add nahi ho sakte. Pick se pehle wala rakhein, ya pcs add band karein.', 'err');
    if (!confirm(drops.map(ono).join(', ') + ' ko ' + ono(keepO) + ' mein merge (hide) karein?')) return;
    call('mergeOrders', { keep_id: keep, drop_ids: drops.map(function (o) { return o.id; }), add_pcs: add ? 1 : 0 }).then(function (x) { toast('Merge ho gaya ✔'); var sh = document.querySelector('.sheet'); if (sh) sh.remove(); if (cb) cb(x.kept); }).catch(fail);
  };
}
function bindDup(v, o, others) {
  Array.prototype.forEach.call(document.querySelectorAll('.dupm'), function (btn) { btn.onclick = function () { var x = (others || []).filter(function (y) { return Number(y.id) === Number(btn.dataset.id); })[0]; if (x) mergeDialog([o, x], function (kept) { go('/o/' + kept); }); }; });
  Array.prototype.forEach.call(document.querySelectorAll('.dupc'), function (btn) {
    btn.onclick = function () {
      var openId = Number(btn.getAttribute('data-open')), billedId = Number(btn.getAttribute('data-billed'));
      var open = Number(o.id) === openId ? o : (others || []).filter(function (y) { return Number(y.id) === openId; })[0];
      var billed = Number(o.id) === billedId ? o : (others || []).filter(function (y) { return Number(y.id) === billedId; })[0];
      if (!open || !billed) return;
      if (!confirm(ono(open) + ' ko ' + onoBilled(billed) + ' ka duplicate mark karke cancel karein? Pcs add nahi honge.')) return;
      call('cancelAsDup', { open_id: open.id, billed_id: billed.id }).then(function () { toast('Duplicate mark ho gaya'); go('/o/' + billed.id); }).catch(fail);
    };
  });
  Array.prototype.forEach.call(document.querySelectorAll('.dupdel'), function (btn) {
    btn.onclick = function () {
      if (!isAdmin()) return toast('Sirf admin delete kar sakta hai', 'err');
      var openId = Number(btn.getAttribute('data-open')), billedId = Number(btn.getAttribute('data-billed'));
      var open = Number(o.id) === openId ? o : (others || []).filter(function (y) { return Number(y.id) === openId; })[0];
      var billed = Number(o.id) === billedId ? o : (others || []).filter(function (y) { return Number(y.id) === billedId; })[0];
      if (!open || !billed) return;
      if (isDupBilled(open) || open.invoice_no) return toast('Billed / invoice wala order delete nahi ho sakta', 'err');
      if (!confirm('Delete ' + ono(open) + '? Sirf yeh open duplicate delete hoga. Billed ' + onoBilled(billed) + ' nahi chhedega. Wapas queue mein nahi aayega.')) return;
      call('deleteDup', { open_id: open.id, billed_id: billed.id }).then(function () { toast(ono(open) + ' delete ho gaya'); go('/o/' + billed.id); }).catch(fail);
    };
  });
  Array.prototype.forEach.call(document.querySelectorAll('.dupn'), function (btn) { btn.onclick = function () { if (!confirm('Ye duplicate nahi hai? Flag hamesha ke liye hat jayega.')) return; call('dismissDup', { a: o.id, b: Number(btn.dataset.id) }).then(function () { toast('Flag hata diya'); vOrder(v, o.id); }).catch(fail); }; });
  var all = document.getElementById('dma'); if (all) all.onclick = function () { mergeDialog([o].concat((others || []).filter(function (x) { return !isDupBilled(x) && !isDupBilled(o); })), function (kept) { go('/o/' + kept); }); };
}
function vDups(v) {
  call('dupList').then(function (list) {
    var groups = dupGroupList(list), days = (S.m.dup_days != null ? S.m.dup_days : 2);
    var rule = 'Same dealer, overlapping brand / item / amount, order date ' + days + ' din ke andar. Open + open merge ho sakte hain. Ek billed + ek open: open ko Cancel as duplicate. Manual marks bhi yahin dikhte hain.';
    v.innerHTML = '<div class="row"><h2>⚠ Possible duplicates (' + groups.length + ')</h2></div><p class="small muted">' + h(rule) + '</p>' +
      (dupGroupCardsHtml(groups, isMgr()) || '<div class="card center muted">Koi possible duplicate nahi 👍</div>');
    bindDupGroupActions(v, groups, function () { vDups(v); });
  }).catch(fail);
}

// ---------------- order detail
var STEPS = [['punch', 'punched_at', 'punched_by', 'Order Punching (Trylo)'], ['allocate', 'allocated_at', 'allocated_by', 'Kaam allocate (naam chunein)'], ['pick', 'picked_at', 'picked_by', 'Pick (maal nikala)'], ['check', 'checked_at', 'checked_by', 'Check'], ['bill', 'billed_at', 'billed_by', 'Bill'], ['pack', 'packed_at', 'packed_by', 'Pack (ready for dispatch)'], ['dispatch', 'dispatched_at', 'dispatched_by', 'Dispatch']];
var STEP_ROLES = { punch: ['admin', 'warehouse_manager', 'biller', 'coordinator'], allocate: ['admin', 'warehouse_manager'], pick: ['admin', 'warehouse_manager', 'picker'], check: ['admin', 'warehouse_manager', 'checker'], bill: ['admin', 'warehouse_manager', 'biller'], pack: ['admin', 'warehouse_manager', 'packer'], dispatch: ['admin', 'warehouse_manager', 'dispatch'] };
function nextStep(o) { return o.stage === 'new' && Number(o.needs_punch) ? 'punch' : NEXT[o.stage]; }
var NEXT = { new: 'allocate', punched: 'allocate', allocated: 'pick', picked: 'check', checked: 'bill', billed: 'pack', packed: 'dispatch' };
function vOrder(v, id) {
  call('order', { id: id }).then(function (r) {
    var o = r.order, manEdit = canNew() && /^W-/.test(o.src_id) && o.stage !== 'cancelled' && !o.invoice_no && S.m.stages.indexOf(o.stage) < S.m.stages.indexOf('billed'), nx = nextStep(o), mine = nx && STEP_ROLES[nx].indexOf(role()) >= 0 && !Number(o.hold), si = S.m.stages.indexOf(o.stage);
    var tl = '<ul class="tl"><li class="done"><b>Order aaya</b> <span class="small muted">' + h(dmy(o.order_date)) + ' • ' + h(o.salesman) + ' (' + (/^W-/.test(o.src_id) ? h(srcOf(o)) + ', liya ' + h(o.taken_by) : 'Sales Tracker #' + h(o.src_id)) + ')</span></li>' + STEPS.filter(function (s) { return s[0] !== 'punch' || Number(o.needs_punch) || o.punched_at; }).map(function (s) {
      var done = !!o[s[1]], extra = '', i = S.m.stages.indexOf({ punch: 'new', allocate: 'punched', pick: 'allocated', check: 'picked', bill: 'checked', pack: 'billed', dispatch: 'packed' }[s[0]]);
      if (s[0] === 'allocate' && !Number(o.needs_punch) && o.stage === 'new') i = si;
      if (s[0] === 'allocate' && done) extra = ' → Pick: <b>' + h(o.picker_name || '-') + '</b>, Check: <b>' + h(o.checker_name || '-') + '</b>, Bill: <b>' + h(o.biller_name || '-') + '</b>, Pack: <b>' + h(o.packer_name || '-') + '</b>';
      var nm = { punch: o.punch_name, pick: o.picker_name, check: o.checker_name, bill: o.biller_name, pack: o.packer_name, dispatch: o.dispatch_name }[s[0]];
      if (s[0] === 'pick' && done) extra = ' • picked ' + h(o.picked_qty) + (Number(o.short_qty) ? ' <span class="short">short ' + o.short_qty + '</span>' : '');
      if (s[0] === 'bill' && o.invoice_no) extra = ' • Inv ' + h(o.invoice_no) + ' • ' + pcs(o.billed_qty) + (o.bill_source ? ' (' + h(o.bill_source) + ')' : '');
      if (s[0] === 'pack' && done) extra = ' • ' + h(o.boxes) + ' boxes';
      if (s[0] === 'dispatch' && o.delivery_mode) extra = ' • ' + h(o.delivery_mode) + ' ' + h(o.vehicle) + ' • ' + h(o.payment_mode) + ' • ' + h(dmy(o.dispatch_date));
      return '<li class="' + (done ? 'done' : (i === si ? 'now' : '')) + '"><b>' + s[3] + '</b>' + extra + '<div class="small muted">' + (done ? tm(o[s[1]]) + ' • ' + (nm && s[0] !== 'allocate' ? 'Done by <b>' + h(nm) + '</b> (login: ' + h(o[s[2]]) + ')' : h(o[s[2]])) : 'Pending' + (nm && s[0] !== 'allocate' ? ' • assigned ' + h(nm) : '')) + '</div></li>';
    }).join('') + '</ul>';
    var lines = '<div class="tw"><table><tr><th>Brand / item</th><th>Order (pcs)</th><th>Picked (pcs)</th><th>Short</th></tr>' + o.lines.map(function (l) {
      var sh = l.picked_qty !== '' && l.ordered_qty !== '' ? Math.max(0, l.ordered_qty - l.picked_qty) : '';
      return '<tr><td>' + h(l.brand) + (l.item ? ' ' + h(l.item) : '') + '</td><td>' + (isMgr() && o.stage !== 'dispatched' && !o.picked_at ? '<input class="oq" data-id="' + l.id + '" type="number" min="0" value="' + h(l.ordered_qty) + '" style="width:80px;padding:6px">' : h(l.ordered_qty)) + '</td><td>' +
        (nx === 'pick' && mine ? '<input class="pq" data-id="' + l.id + '" type="number" min="0" value="' + h(l.ordered_qty) + '" style="width:80px;padding:6px">' : h(l.picked_qty)) + '</td><td class="short">' + (sh || '') + '</td></tr>';
    }).join('') + '<tr><th>Total</th><th>' + pcs(o.pcs) + '</th><th>' + (o.picked_at ? pcs(o.picked_qty) : '') + '</th><th></th></tr></table></div>' + (isMgr() && !o.picked_at ? '<button class="sm" id="saveq">Order qty save</button>' : '');
    var act = '';
    if (mine) {
      if (nx === 'allocate') act = '<div class="grid2"><div>' + whoSel('w_picker', 'picker', o.picker_name, 'Pick kaun karega') + '</div><div>' + whoSel('w_checker', 'checker', o.checker_name, 'Check kaun karega') + '</div><div>' + whoSel('w_biller', 'biller', o.biller_name, 'Bill kaun karega') + '</div><div>' + whoSel('w_packer', 'packer', o.packer_name, 'Pack kaun karega') + '</div></div>';
      else act = whoSel('w_done', STEP_ROLE[nx][0], o[STEP_ROLE[nx][1]] || (role() === STEP_ROLE[nx][0] ? S.user.name : ''), 'Kisne kiya (naam)');
      if (nx === 'bill') act += '<div class="grid2"><div><label>Invoice no</label><input id="inv"></div><div><label>Billed qty (pcs)</label><input id="bq" type="number" value="' + h(o.picked_qty) + '"></div></div>';
      if (nx === 'pack') act += '<label>Kitne boxes</label><input id="bx" type="number" min="1">';
      act += '<button class="good big" id="stepb" style="margin-top:10px">✔ ' + STEPS.filter(function (s) { return s[0] === nx; })[0][3] + ' confirm</button>';
    }
    var hold = '';
    if (can('hold') && o.stage !== 'dispatched') hold = Number(o.hold) ? '<div class="card"><b class="short">HOLD: ' + h(o.hold_reason) + '</b> ' + h(o.hold_note) + '<div class="small muted">' + tm(o.hold_at) + ' • ' + h(o.hold_by) + '</div><button class="warn" id="unh" style="margin-top:8px">Unhold</button></div>'
      : '<div class="card"><h3>Hold</h3><select id="hr">' + S.m.hold_reasons.map(function (x) { return '<option>' + h(x) + '</option>'; }).join('') + '</select><input id="hn" placeholder="Note (Other ke liye zaroori)" style="margin-top:6px"><button class="danger" id="hb" style="margin-top:8px">Hold karein</button></div>';
    var del = '';
    if (can('delivery') && si >= S.m.stages.indexOf('billed') && o.stage !== 'dispatched') del = '<div class="card"><h3>Delivery allocation</h3>' + delForm(o) + '<button class="primary big" id="delb" style="margin-top:10px">Save delivery</button></div>';
    var nb = r.nearby.length ? '<div class="card"><h3>Paas ke pending orders (' + r.nearby.length + ')</h3><p class="small muted">Inhe saath mein bill / dispatch karein.</p>' + r.nearby.map(function (x) { return '<div class="chk"><a href="#/o/' + x.id + '">' + h(x.track_no || '#' + x.id) + ' ' + h(x.dealer_name) + '</a><span class="small muted">' + h(x.why) + (x.km !== '' ? ' • ' + x.km + ' km' : '') + ' • ' + h(stageLbl(x.stage)) + (Number(x.hold) ? ' • HOLD' : '') + ' • ' + pcs(x.ordered_qty) + (x.zone ? ' • ' + h(x.zone) : '') + '</span></div>'; }).join('') + '</div>' : '';
    v.innerHTML = '<div class="card"><div class="row"><h2>' + trk(o) + h(ono(o)) + ' ' + h(o.dealer_name) + '</h2><span style="flex:0;white-space:nowrap">' + pill(o) + badges(o) + '</span></div><div class="small muted">Zone ' + h(o.zone || '-') + ' • ' + h(o.area || 'area ?') + ' • ' + h(o.route || '-') + (o.beat_day ? ' • beat ' + h(o.beat_day) : '') + (o.lat !== '' ? ' • <a target="_blank" href="https://www.google.com/maps?q=' + o.lat + ',' + o.lng + '">map</a>' : '') + '</div>' + '<div class="small" style="margin-top:4px">' + slaBadge(o, true) + (can('recvtime') && o.sla && !o.sla.billed && o.stage !== 'cancelled' ? '<button class="sm" id="rte" style="margin-top:6px">⏱ Order aaya time badlein</button>' : '') + '</div>' + (o.remarks ? '<div class="small">Remark: ' + h(o.remarks) + '</div>' : '') +
      '<div class="small muted">Source: ' + h(srcOf(o)) + (o.taken_by ? ' • liya: ' + h(o.taken_by) : '') + (o.salesman ? ' • salesman: ' + h(o.salesman) : '') + (o.expected_date ? ' • expected dispatch ' + h(dmy(o.expected_date)) : '') + (o.edited_at ? ' • edited ' + tm(o.edited_at) + ' ' + h(o.edited_by) : '') + '</div>' +
      (o.stage === 'cancelled' ? '<div class="short">Cancel: ' + h(o.cancel_reason) + ' (' + tm(o.cancelled_at) + ', ' + h(o.cancelled_by) + ')</div>' : '') +
      (manEdit ? '<div class="row" style="margin-top:8px"><a class="btn sm" href="#/' + (isStore(o) ? 'sq/' : '') + 'edit/' + o.id + '">✏️ Edit</a><button class="sm danger" id="cnl">Cancel order</button></div>' : '') + '</div>' +
      (isMgr() ? '<details class="card"><summary><b>Area / zone badlein</b></summary>' + dlists() + '<div class="grid2"><div><label>Zone</label><input id="oz" list="dl_zone" value="' + h(o.zone) + '"></div><div><label>Area</label><input id="oa" list="dl_area" value="' + h(o.area) + '"></div></div><label>Route</label><input id="or" list="dl_route" value="' + h(o.route) + '"><p class="small muted">Dealer master aur uske open orders mein bhi update hoga. Sync isse overwrite nahi karega.</p><button class="primary" id="oas">Save</button></details>' : '') + dupCard(o, r.dup_orders) + (o.merged_into ? '<div class="card short">Ye order duplicate tha, <a href="#/o/' + h(o.merged_into) + '">' + h((o.merged_into_order && (o.merged_into_order.track_no || o.merged_into_order.order_no)) || '#' + o.merged_into) + '</a> mein merge hua (' + tm(o.merged_at) + ', ' + h(o.merged_by) + ')</div>' : '') + '<div class="card"><h3>Items</h3>' + lines + '</div><div class="card"><h3>Timeline</h3>' + tl + act + '</div>' + waitCard(o) + planCard(o) + hold + del + nb;
    var b = $('stepb'); if (b) b.onclick = function () {
      var d = { id: o.id, action: nx };
      if (nx === 'allocate') {
        d.picker_name = whoVal('w_picker'); var pu = S.m.users.filter(function (u) { return u.name === d.picker_name; })[0]; if (pu) d.picker_id = pu.id;
        d.checker_name = whoVal('w_checker'); d.biller_name = whoVal('w_biller'); d.packer_name = whoVal('w_packer');
      } else { d.done_by = whoVal('w_done'); if (!d.done_by) return toast('Naam chunein (kisne kiya)', 'err'); }
      if (nx === 'pick') { d.picked = {}; Array.prototype.forEach.call(document.querySelectorAll('.pq'), function (i) { d.picked[i.dataset.id] = i.value; }); }
      if (nx === 'bill') { d.invoice_no = val('inv'); d.billed_qty = val('bq'); }
      if (nx === 'pack') d.boxes = val('bx');
      call('step', d).then(function () { toast('Ho gaya ✔'); vOrder(v, id); }).catch(fail);
    };
    if ($('cnl')) $('cnl').onclick = function () { var why = prompt('Cancel ka reason?'); if (!why) return; call('cancelOrder', { id: o.id, reason: why }).then(function () { toast('Cancel ho gaya'); vOrder(v, id); }).catch(fail); };
    if ($('oas')) $('oas').onclick = function () { call('orderArea', { id: o.id, zone: val('oz'), area: val('oa'), route: val('or') }).then(function () { S.dl = null; toast('Saved'); vOrder(v, id); }).catch(fail); };
    if (isMgr() && !S.dl) loadDealers().then(function () { var e = $('dlbox'); if (e) e.outerHTML = dlists(); }).catch(function () {});
    if ($('saveq')) $('saveq').onclick = function () { var ls = []; Array.prototype.forEach.call(document.querySelectorAll('.oq'), function (i) { ls.push({ id: i.dataset.id, ordered_qty: i.value }); }); call('setLines', { id: o.id, lines: ls }).then(function () { toast('Saved'); vOrder(v, id); }).catch(fail); };
    if ($('hb')) $('hb').onclick = function () { call('hold', { id: o.id, reason: val('hr'), note: val('hn') }).then(function () { toast('Hold kiya'); vOrder(v, id); }).catch(fail); };
    if ($('rte')) $('rte').onclick = function () {
      var cur = new Date(Date.parse(o.sla.received_at) + 330 * 60000).toISOString().slice(0, 16);
      sheet('<h3>Order aaya time badlein</h3><p class="small muted">Bill deadline ab is time se ginegi (2 ghante wala rule). Purana time record mein rahega.</p><label>Order kab aaya (date-time)</label><input id="rtv" type="datetime-local" value="' + cur + '" max="' + istNowLocal() + '"><label>Wajah (optional)</label><input id="rtn" maxlength="150"><button class="primary big" id="rts" style="margin-top:10px">Save</button>');
      $('rts').onclick = function () { var t = val('rtv'); if (!t) return toast('Time daalein', 'err'); call('setReceivedTime', { id: o.id, received_at: t, note: val('rtn') }).then(function (x) { toast('Nayi bill deadline: ' + tm(x.sla && x.sla.deadline)); var sh = document.querySelector('.sheet'); if (sh) sh.remove(); vOrder(v, o.id); }).catch(fail); };
    };
    if ($('wsv')) $('wsv').onclick = function () { var b = Array.prototype.filter.call(document.querySelectorAll('.wb'), function (i) { return i.checked; }).map(function (i) { return i.value; }); call('waitPurchase', { id: o.id, brands: b }).then(function () { toast(b.length ? 'Waiting for purchase - ' + b.join(', ') : 'Stock wait hata diya'); vOrder(v, id); }).catch(fail); };
    bindDup(v, o, r.dup_orders);
    if (isStore(o)) storePhotosCard(v, o);
    if ($('unh')) $('unh').onclick = function () { call('unhold', { id: o.id }).then(function () { toast('Unhold'); vOrder(v, id); }).catch(fail); };
    if ($('delb')) $('delb').onclick = function () { call('delivery', delData([o.id])).then(function () { toast('Delivery saved'); vOrder(v, id); }).catch(fail); };
    if ($('pov')) $('pov').onclick = function () { call('overridePlan', { id: o.id, plan_delivery_date: val('pdd'), plan_van: val('pdv'), plan_mode: val('pdm') }).then(function () { toast('Plan override saved'); vOrder(v, id); }).catch(fail); };
    if ($('pcl')) $('pcl').onclick = function () { call('overridePlan', { id: o.id, clear: 1 }).then(function () { toast('Override hata, auto plan'); vOrder(v, id); }).catch(fail); };
  }).catch(fail);
}
function waitCard(o) {
  if (!isMgr() || o.stage === 'cancelled' || o.billed_at || S.m.stages.indexOf(o.stage) >= S.m.stages.indexOf('billed')) return '';
  var cur = String(o.wait_brands || '').split(',').filter(String), br = [];
  o.lines.forEach(function (l) { var b = String(l.brand).toUpperCase(); if (b && br.indexOf(b) < 0) br.push(b); });
  return '<div class="card"><h3>Stock wait (purchase)</h3><p class="small muted">Jis brand ka stock nahi hai use tick karein. Tick rahne tak order Delayed nahi ginta.</p>' +
    br.map(function (b) { return '<label class="chk"><input type="checkbox" class="wb" value="' + h(b) + '"' + (cur.indexOf(b) >= 0 ? ' checked' : '') + '> Waiting for purchase - ' + h(b) + '</label>'; }).join('') +
    (cur.length ? '<div class="small muted">Lagaya: ' + tm(o.wait_at) + ' • ' + h(o.wait_by) + '</div>' : '') + '<button class="warn" id="wsv" style="margin-top:8px">Save</button> <a class="btn sm" href="#/pr">📦 Purchase aaya</a></div>';
}
function planCard(o) {
  if (!o || (o.stage === 'cancelled' && !o.plan_delivery_date)) return '';
  var vans = (S.m.van_plan && S.m.van_plan.vans) || ['DL1LAP-0938', 'DL1LZ-6422'];
  var canEdit = can('routes') && o.stage !== 'dispatched';
  return '<div class="card"><h3>Van / delivery plan</h3>' +
    '<div class="small">Plan date: <b>' + h(dmy(o.plan_delivery_date) || '-') + '</b> • Van: <b>' + h(o.plan_van || '-') + '</b> • Mode: ' + h(o.plan_mode || '-') +
    (o.plan_option ? ' • Option ' + h(o.plan_option) : '') + (Number(o.plan_realtime) ? ' • <span class="pill">Real-time</span>' : '') + planBadge(o) + '</div>' +
    '<div class="small muted">Area match: ' + h(o.plan_area || o.area || '-') + (o.plan_at ? ' • set ' + tm(o.plan_at) + ' ' + h(o.plan_by) : '') + '</div>' +
    (canEdit ? '<details style="margin-top:8px"><summary><b>Override / clear</b></summary><div class="grid2"><div><label>Delivery date</label><input type="date" id="pdd" value="' + h(o.plan_delivery_date || '') + '"></div><div><label>Van</label><select id="pdv"><option value="">-</option>' + vans.map(function (x) { return '<option' + (o.plan_van === x ? ' selected' : '') + '>' + h(x) + '</option>'; }).join('') + '</select></div><div><label>Mode</label><select id="pdm"><option value="van"' + (o.plan_mode === 'van' ? ' selected' : '') + '>van</option><option value="hand"' + (o.plan_mode === 'hand' ? ' selected' : '') + '>hand</option><option value="courier"' + (o.plan_mode === 'courier' ? ' selected' : '') + '>courier</option></select></div></div><div class="row" style="margin-top:8px"><button class="primary" id="pov">Save override</button><button class="warn" id="pcl">Clear override (auto recompute)</button></div></details>' : '') + '</div>';
}

// "Done by": users of that role + staff names of that role + Other (free text)
// All active users + staff names (us role wale pehle), dropdown mein "Naam (Role)".
function peopleAll(r) {
  var seen = {}, out = [], all = S.m.users.concat(S.m.staff || []);
  all.filter(function (x) { return x.role === r; }).concat(all.filter(function (x) { return x.role !== r; })).forEach(function (x) { if (x.name && !seen[x.name]) { seen[x.name] = 1; out.push({ name: x.name, role: (S.m.roles || {})[x.role] || x.role || '' }); } });
  return out;
}
function peopleFor(r) { return S.m.users.concat(S.m.staff || []).filter(function (x) { return x.role === r; }).map(function (x) { return x.name; }); }
function whoSel(id, r, cur, label) {
  var pa = peopleAll(r), ps = pa.map(function (x) { return x.name; }), other = cur && ps.indexOf(cur) < 0;
  return '<label>' + label + '</label><select id="' + id + '" onchange="document.getElementById(\'' + id + '_o\').classList.toggle(\'hidden\',this.value!==\'__o\')"><option value="">-</option>' +
    pa.map(function (x) { return '<option value="' + h(x.name) + '"' + (x.name === cur ? ' selected' : '') + '>' + h(x.name) + (x.role ? ' (' + h(x.role) + ')' : '') + '</option>'; }).join('') + '<option value="__o"' + (other ? ' selected' : '') + '>Other name...</option></select>' +
    '<input id="' + id + '_o" class="' + (other ? '' : 'hidden') + '" placeholder="Naam likhein" value="' + h(other ? cur : '') + '" style="margin-top:6px">';
}
function whoVal(id) { var v = val(id); return v === '__o' ? val(id + '_o') : v; }
var STEP_ROLE = { punch: ['biller', 'punch_name'], pick: ['picker', 'picker_name'], check: ['checker', 'checker_name'], bill: ['biller', 'biller_name'], pack: ['packer', 'packer_name'], dispatch: ['dispatch', 'dispatch_name'] };
function delForm(o) {
  o = o || {};
  return '<div class="grid2"><div><label>Delivery mode</label><select id="dm">' + S.m.delivery_modes.map(function (x) { return '<option' + (o.delivery_mode === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
    '<div><label>Vehicle</label><select id="vh"><option value="">-</option>' + S.m.vehicles.map(function (x) { return '<option' + (o.vehicle === x.number ? ' selected' : '') + '>' + h(x.number) + '</option>'; }).join('') + '</select></div>' +
    '<div><label>Payment mode</label><select id="pm">' + S.m.payment_modes.map(function (x) { return '<option' + (o.payment_mode === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
    '<div><label>Dispatch date</label><input id="dd" type="date" value="' + h(o.dispatch_date || today()) + '"></div></div><label>Ref (courier AWB / porter / note)</label><input id="dr" value="' + h(o.delivery_ref) + '">';
}
function delData(ids) { return { ids: ids, delivery_mode: val('dm'), vehicle: val('vh'), payment_mode: val('pm'), dispatch_date: val('dd'), delivery_ref: val('dr') }; }

// ---------------- delivery allocation (bulk)
function vDisp(v) {
  call('orders', { all: 1 }).then(function (list) {
    var open = list.filter(function (o) { return (o.stage === 'billed' || o.stage === 'packed') && !Number(o.hold); });
    var un = open.filter(function (o) { return !o.delivery_mode; }), al = open.filter(function (o) { return o.delivery_mode; });
    var groups = {}; un.forEach(function (o) { var k = (o.area || 'No area') + (o.route ? ' • ' + o.route : ''); (groups[k] = groups[k] || []).push(o); });
    v.innerHTML = '<div class="row"><h2>Delivery allocation</h2><a class="btn sm" href="#/kal">🚐 Kal delivery</a></div><div class="card"><h3>Bill ho chuke, delivery baaki (' + un.length + ')</h3>' + Object.keys(groups).sort().map(function (k) {
      return '<div class="small muted" style="margin-top:8px"><b>' + h(k) + '</b> (' + groups[k].length + ')</div>' + groups[k].map(function (o) { return '<label class="chk"><input type="checkbox" class="sel" value="' + o.id + '"><span><b>' + h(o.track_no || '#' + o.id) + '</b> ' + h(o.dealer_name) + ' • ' + h(o.invoice_no) + ' • ' + pcs(o.billed_qty || o.pcs) + ' • ' + h(stageLbl(o.stage)) + (o.boxes ? ' • ' + o.boxes + ' boxes' : '') + '</span></label>'; }).join('');
    }).join('') + (un.length ? delForm() + '<button class="primary big" id="go" style="margin-top:10px">Selected ko allocate karein</button>' : '<p class="muted">Sab allocate ho gaye.</p>') + '</div>' +
      '<div class="card"><h3>Allocated, dispatch baaki (' + al.length + ')</h3>' + al.map(card).join('') + '</div>';
    if ($('go')) $('go').onclick = function () { var ids = Array.prototype.map.call(document.querySelectorAll('.sel:checked'), function (i) { return Number(i.value); }); if (!ids.length) return toast('Orders chunein', 'err'); call('delivery', delData(ids)).then(function () { toast(ids.length + ' allocated'); vDisp(v); }).catch(fail); };
  }).catch(fail);
}

// ---------------- clusters
function vClusters(v) {
  call('clusters').then(function (cl) {
    var lastZ = null;
    v.innerHTML = '<div class="row"><h2>Cluster view (pending)</h2><button class="sm" id="ex">CSV</button></div><p class="small muted">Zone, phir area, phir route. Ek jagah ke unbilled / unallocated orders saath bill aur dispatch karein.</p>' + cl.map(function (c, i) {
      var zh = c.zone !== lastZ ? '<h3 style="margin-top:14px">Zone: ' + h(c.zone) + ' (' + cl.filter(function (x) { return x.zone === c.zone; }).reduce(function (a, x) { return a + x.orders; }, 0) + ' orders)</h3>' : ''; lastZ = c.zone;
      return zh + '<div class="card"><div class="row"><b>' + h(c.key) + '</b><span style="flex:0" class="pill">' + c.orders + ' orders</span></div><div class="small muted">' + (c.route ? 'Route: ' + h(c.route) + ' • ' : '') + c.dealers + ' dealers • ' + pcs(c.pcs) + ' • unbilled ' + c.unbilled + (c.held ? ' • <span class="short">hold ' + c.held + '</span>' : '') + '</div><div class="small">' + c.ids.map(function (id, j) { return '<a href="#/o/' + id + '">' + h((c.trk || [])[j] || '#' + id) + '</a>'; }).join(' ') + '</div></div>';
    }).join('');
    $('ex').onclick = function () { csv(cl.map(function (c) { return { zone: c.zone, area: c.area || c.key, route: c.route, orders: c.orders, dealers: c.dealers, pcs: c.pcs, unbilled: c.unbilled, hold: c.held, order_ids: c.ids.join(' '), tracking_nos: (c.trk || []).join(' ') }; }), 'clusters'); };
  }).catch(fail);
}

// ---------------- billing import
var FIELDS = [['invoice_no', 'Invoice no *'], ['bill_date', 'Bill date *'], ['dealer', 'Dealer / party name *'], ['order_ref', 'Order ref (optional)'], ['qty', 'Qty'], ['value', 'Value / amount']];
var TEMPLATE_MAP = { invoice_no: 'Invoice No', bill_date: 'Invoice Date', dealer: 'Dealer / Party Name', order_ref: 'Order Ref', qty: 'Qty', value: 'Value' };
var GUESS = { invoice_no: /inv.*(no|num)|bill.*no|voucher|document.*no|^trx|transaction.*number/i, bill_date: /date/i, dealer: /party|customer|dealer|bill.?to|account.*name/i, order_ref: /order|ref|po/i, qty: /qty|quantity/i, value: /amount|value|total|net/i };
function loadXlsx() { if (window.XLSX) return Promise.resolve(); return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload = res; s.onerror = function () { rej(new Error('XLSX reader load nahi hua. CSV try karein.')); }; document.head.appendChild(s); }); }
function parseCsv(text) {
  var rows = [], row = [], f = '', q = false, i, ch; text = String(text).replace(/^\uFEFF/, '');
  for (i = 0; i < text.length; i++) { ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += ch; }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  rows = rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); }); if (!rows.length) return [];
  var head = rows[0].map(function (x) { return String(x).trim(); });
  return rows.slice(1).map(function (r) { var o = {}; head.forEach(function (k, j) { o[k] = r[j] == null ? '' : r[j]; }); return o; });
}
function readFile(file) {
  if (/\.xlsx?$/i.test(file.name)) return loadXlsx().then(function () { return file.arrayBuffer(); }).then(function (b) { var wb = XLSX.read(b, { type: 'array', cellDates: true }), ws = wb.Sheets[wb.SheetNames[0]]; return XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' }); });
  return file.text().then(parseCsv);
}
function vBills(v) {
  v.innerHTML = '<h2>Daily billing import (Fusion ERP)</h2><div class="card"><p class="small"><a href="Billing_Import_Template.xlsx" download>⬇ Download template (XLSX)</a> : template ke columns apne aap map ho jaate hain. EXAMPLE rows skip hoti hain.</p><label>CSV ya XLSX file</label><input type="file" id="f" accept=".csv,.xlsx,.xls"><div id="mapper"></div></div><div class="card"><div class="row"><h3>Unmatched bills</h3><button class="sm" id="rl">Refresh</button></div><div id="um"></div></div>';
  $('f').onchange = function () {
    var file = this.files[0]; if (!file) return;
    readFile(file).then(function (rows) {
      if (!rows.length) throw new Error('File khali hai');
      var cols = Object.keys(rows[0]), saved = S.m.bill_map || {};
      $('mapper').innerHTML = '<p class="small muted">' + rows.length + ' rows. Columns match karein (yaad rakha jayega):</p>' + FIELDS.map(function (fd) {
        var pre = cols.indexOf(TEMPLATE_MAP[fd[0]]) >= 0 ? TEMPLATE_MAP[fd[0]] : cols.indexOf(saved[fd[0]]) >= 0 ? saved[fd[0]] : (cols.filter(function (c) { return GUESS[fd[0]].test(c); })[0] || '');
        return '<label>' + fd[1] + '</label><select id="m_' + fd[0] + '"><option value="">(none)</option>' + cols.map(function (c) { return '<option' + (c === pre ? ' selected' : '') + '>' + h(c) + '</option>'; }).join('') + '</select>';
      }).join('') + '<button class="primary big" id="imp" style="margin-top:12px">Import + match</button>';
      $('imp').onclick = function () {
        var map = {}; FIELDS.forEach(function (fd) { map[fd[0]] = val('m_' + fd[0]); });
        if (!map.invoice_no || !map.dealer || !map.bill_date) return toast('Invoice, date aur dealer column zaroori', 'err');
        var bills = mapBillRows(rows, map);
        call('importBills', { map: map, rows: bills }).then(function (r) { S.m.bill_map = map; toast('Matched ' + r.matched + ', unmatched ' + r.unmatched + ', duplicate skip ' + r.skipped_duplicates); loadUm(); }).catch(fail);
      };
    }).catch(fail);
  };
  $('rl').onclick = loadUm; loadUm();
}
function num(v) { var n = Number(String(v == null ? '' : v).replace(/[,₹\s]|Rs\.?/gi, '')); return isFinite(n) ? n : 0; }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function anyDate(v) {
  var s = String(v || '').trim(), m, MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]);
  if ((m = /^(\d{1,2})[-\/. ]([A-Za-z]{3})[A-Za-z]*[-\/. ](\d{2,4})/.exec(s)) && MON[m[2].toLowerCase()]) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + pad2(MON[m[2].toLowerCase()]) + '-' + pad2(+m[1]);
  if ((m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/.exec(s))) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + pad2(+m[2]) + '-' + pad2(+m[1]);
  return s;
}
function mapBillRows(rows, map) {
  var by = {}, out = [];
  rows.forEach(function (r) { var inv = String(r[map.invoice_no] == null ? '' : r[map.invoice_no]).trim(); if (!inv || /^EXAMPLE/i.test(inv)) return; var b = by[inv];
    if (!b) { b = by[inv] = { invoice_no: inv, bill_date: anyDate(r[map.bill_date]), dealer: String(r[map.dealer] || '').trim(), order_ref: map.order_ref ? String(r[map.order_ref] || '').trim() : '', qty: 0, value: 0 }; out.push(b); }
    b.qty += map.qty ? num(r[map.qty]) : 0; b.value += map.value ? num(r[map.value]) : 0; });
  return out;
}
function loadUm() {
  Promise.all([call('unmatchedBills'), call('orders', { all: 1 })]).then(function (r) {
    var um = r[0], open = r[1].filter(function (o) { return !o.invoice_no && o.stage !== 'dispatched'; });
    var host = $('um'); if (!host) return; // user left Billing before this slow load finished
    host.innerHTML = um.length ? um.map(function (b) {
      return '<div class="card"><b>' + h(b.invoice_no) + '</b> • ' + h(dmy(b.bill_date)) + ' • ' + h(b.dealer) + ' • ' + pcs(b.qty) + '<div class="row" style="margin-top:6px"><select class="lk" data-id="' + b.id + '"><option value="">Order chunein</option>' + open.map(function (o) { return '<option value="' + o.id + '">' + h(o.track_no || '#' + o.id) + ' ' + h(o.dealer_name) + ' (' + h(dmy(o.order_date)) + ')</option>'; }).join('') + '</select><button class="sm primary" data-link="' + b.id + '">Link</button><button class="sm" data-ign="' + b.id + '">Ignore</button></div></div>';
    }).join('') : '<p class="muted">Sab bills match ho gaye.</p>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-link]'), function (bt) { bt.onclick = function () { var s = document.querySelector('.lk[data-id="' + bt.dataset.link + '"]'); if (!s.value) return toast('Order chunein', 'err'); call('linkBill', { bill_id: Number(bt.dataset.link), order_id: Number(s.value) }).then(function () { toast('Linked'); loadUm(); }).catch(fail); }; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-ign]'), function (bt) { bt.onclick = function () { call('ignoreBill', { bill_id: Number(bt.dataset.ign) }).then(loadUm).catch(fail); }; });
  }).catch(fail);
}

// ---------------- new / edit manual order
var BRANDS = ['TRYLO', 'C9', 'OS'];

// ---------------- Karwa Marketing Store orders (warehouse types the store's paper order + 3 photos)
var STORE_SRC = 'Karwa Marketing Store';
var STORE_FALLBACK = ['Kamla Nagar', 'Rohini City Centre', 'V3S', 'Burari', 'Mahagun Mall Ghaziabad', 'Elan Epic Gurgaon', 'Pacific Mall Anand Vihar', 'Mukherjee Nagar', 'H&S Mall Boulevard Walk Greater Noida West'];
var PHOTO_KINDS = [['order', 'Order photo'], ['pending', 'Pending page'], ['exec', 'Execution page']];
function isStore(o) { return o && o.source === STORE_SRC; }
function storeList() { return (S.m && S.m.stores) || STORE_FALLBACK; }
function storeOf(o) { return o.store_name || o.dealer_name; }
function photoFlags(o) {
  var ph = o.photos || { order: o.photo_order_id ? 1 : 0, pending: o.photo_pending_id ? 1 : 0, exec: o.photo_exec_id ? 1 : 0 };
  return PHOTO_KINDS.map(function (k) { return ph[k[0]] ? '<span class="pill" style="background:#e6f4ea;color:#1e7e34">✔ ' + k[1] + '</span>' : '<span class="pill" style="background:#fdecea;color:#c0392b">✖ ' + k[1] + ' nahi</span>'; }).join(' ');
}
/** Resize to max edge 1600px, JPEG q 0.7. Resolves {mime, b64, url}. */
function compressImg(file) {
  return new Promise(function (ok, bad) {
    if (!file || !/^image\//.test(file.type)) return bad(new Error('Sirf photo chunein.'));
    var rd = new FileReader(); rd.onerror = function () { bad(new Error('Photo padh nahi paye.')); };
    rd.onload = function () {
      var im = new Image(); im.onerror = function () { bad(new Error('Photo khul nahi rahi, doosri chunein.')); };
      im.onload = function () {
        var sc = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        var url = c.toDataURL('image/jpeg', 0.7); ok({ mime: 'image/jpeg', b64: url.split(',')[1], url: url });
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}
function uploadPhoto(id, kind, ph) { return call('uploadStorePhoto', { order_id: id, kind: kind, mime: ph.mime, b64: ph.b64 }); }
function photoInputs(have) {
  return PHOTO_KINDS.map(function (k) { return '<div class="card" style="margin:6px 0"><label><b>' + k[1] + '</b>' + (have && have[k[0]] ? ' <span class="small" style="color:#1e7e34">(lagi hui hai, nayi chunein to badal jayegi)</span>' : ' *') + '</label>' +
    '<input type="file" accept="image/*" capture="environment" data-ph="' + k[0] + '"><div class="small muted" id="phs_' + k[0] + '"></div><img id="phv_' + k[0] + '" style="max-width:160px;max-height:160px;display:none;margin-top:6px;border:1px solid var(--line)"></div>'; }).join('');
}
function bindPhotoInputs(store) {
  Array.prototype.forEach.call(document.querySelectorAll('[data-ph]'), function (inp) {
    inp.onchange = function () {
      var k = inp.dataset.ph, f = inp.files[0]; delete store[k]; $('phv_' + k).style.display = 'none'; if (!f) return;
      $('phs_' + k).textContent = 'Photo chhoti kar rahe hain...';
      compressImg(f).then(function (ph) { store[k] = ph; $('phv_' + k).src = ph.url; $('phv_' + k).style.display = ''; $('phs_' + k).textContent = 'Ready (' + Math.round(ph.b64.length * 0.75 / 1024) + ' KB)'; })
        .catch(function (e) { inp.value = ''; $('phs_' + k).textContent = ''; fail(e); });
    };
  });
}
/** Upload photos one by one. Returns kinds that failed (order stays saved). */
function uploadAll(id, store) {
  var bad = [];
  return Object.keys(store).reduce(function (p, k) { return p.then(function () { return uploadPhoto(id, k, store[k]).catch(function () { bad.push(k); }); }); }, Promise.resolve()).then(function () { return bad; });
}
function kindLbl(k) { return PHOTO_KINDS.filter(function (x) { return x[0] === k; })[0][1]; }
function vStoreQueue(v) {
  call('storeOrders', {}).then(function (list) {
    var k = LS.getItem('imw_sqf') || '', d1 = LS.getItem('imw_sqd1') || '', d2 = LS.getItem('imw_sqd2') || '', qs = LS.getItem('imw_sqs') || '', sq = '';
    var opts = [['', 'Sab dates'], ['today', 'Aaj'], ['yday', 'Kal'], ['week', 'Is hafte'], ['month', 'Is mahine'], ['date', 'Ek date'], ['range', 'From - To']];
    var stageOpts = [['', 'Sab'], ['new', 'Naye'], ['picking', 'Picking'], ['checking', 'Checking'], ['billing', 'Billing'], ['ready', 'Bill ho gaya'], ['hold', 'HOLD'], ['nophoto', 'Photo baaki']];
    v.innerHTML = '<div class="row"><h2>Store orders (<span id="sqn">' + list.length + '</span>)</h2>' + (canNew() ? '<button class="primary" style="flex:0;white-space:nowrap" onclick="location.hash=\'#/sq/new\'">+ Store order</button>' : '') + '</div>' +
      '<p class="small muted">Karwa Marketing (Intimissi) stores ke orders. Store se aaya order warehouse yahan khud daalta hai, order photo, pending page aur execution page ki photo ke saath.</p>' +
      '<div class="row"><select id="sqf">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === k ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<input type="date" id="sqd1" value="' + h(d1) + '"><input type="date" id="sqd2" value="' + h(d2) + '"></div>' +
      '<div class="row" style="margin-top:8px"><select id="sqst"><option value="">Sab stores</option>' + storeList().map(function (x) { return '<option>' + h(x) + '</option>'; }).join('') + '</select><input id="sqq" placeholder="Store / tracking no search" style="flex:1;min-width:160px"></div>' +
      '<div class="row" style="margin-top:6px;flex-wrap:wrap;gap:6px" id="sqstages"></div><p class="small" id="sqsum"></p><div id="sqlst"></div>';
    function stOk(o, st) {
      if (!st) return true; if (st === 'hold') return !!Number(o.hold);
      if (st === 'nophoto') { var p = o.photos || {}; return !(p.order && p.pending && p.exec); }
      if (st === 'new') return o.stage === 'new' || o.stage === 'punched'; if (st === 'picking') return o.stage === 'allocated'; if (st === 'checking') return o.stage === 'picked'; if (st === 'billing') return o.stage === 'checked';
      if (st === 'ready') return o.stage === 'billed' || o.stage === 'packed'; return o.stage === st;
    }
    function scard(o) { var c = card(o); return c.slice(0, -4) + '<div class="small" style="margin-top:4px">🏬 <b>' + h(storeOf(o)) + '</b> ' + photoFlags(o) + '</div></a>'; }
    function draw() {
      $('sqd1').style.display = k === 'date' || k === 'range' ? '' : 'none'; $('sqd2').style.display = k === 'range' ? '' : 'none';
      var r = qRange(k, d1, d2), stn = val('sqst'), q = sq.toUpperCase();
      var mid = list.filter(function (o) { var d = String(o.order_date || ''); return (!r || d >= r[0] && d <= r[1]) && (!stn || storeOf(o) === stn) && (!q || (storeOf(o) + ' ' + o.dealer_name + ' ' + (o.track_no || '') + ' ' + ono(o)).toUpperCase().indexOf(q) >= 0); });
      $('sqstages').innerHTML = stageOpts.map(function (s) { return '<button type="button" class="sm' + (qs === s[0] ? ' primary' : '') + '" data-sqs="' + s[0] + '">' + s[1] + ' (' + mid.filter(function (o) { return stOk(o, s[0]); }).length + ')</button>'; }).join('');
      Array.prototype.forEach.call(document.querySelectorAll('[data-sqs]'), function (b) { b.onclick = function () { qs = b.getAttribute('data-sqs'); LS.setItem('imw_sqs', qs); draw(); }; });
      var f = mid.filter(function (o) { return stOk(o, qs); });
      $('sqn').textContent = f.length + (f.length !== list.length ? ' / ' + list.length : '');
      $('sqsum').innerHTML = '<b>' + f.length + '</b> orders, <b>' + pcs(f.reduce(function (a, o) { return a + (Number(o.pcs) || 0); }, 0)) + '</b>';
      $('sqlst').innerHTML = f.length ? f.map(scard).join('') : '<div class="card center muted">' + (list.length ? 'Is filter mein koi store order nahi.' : 'Abhi koi store order nahi. Store se order aaye to upar "+ Store order" dabayein, store chunein, brand aur pcs daalein, aur teen photo lagayein: order, pending page, execution page.') + '</div>';
    }
    $('sqf').onchange = function () { k = this.value; LS.setItem('imw_sqf', k); if ((k === 'date' || k === 'range') && !d1) { d1 = today(); $('sqd1').value = d1; LS.setItem('imw_sqd1', d1); } draw(); };
    $('sqd1').onchange = function () { d1 = this.value; LS.setItem('imw_sqd1', d1); draw(); };
    $('sqd2').onchange = function () { d2 = this.value; LS.setItem('imw_sqd2', d2); draw(); };
    $('sqst').onchange = draw; $('sqq').oninput = function () { sq = this.value.trim(); draw(); };
    draw();
  }).catch(fail);
}
function vStoreNew(v, ed) {
  if (!canNew()) return go('/sq');
  var stores = storeList(), cur = ed ? (ed.store_name || '') : '', lines = ed ? ed.lines.map(function (l) { return { brand: l.brand, item: l.item, qty: l.ordered_qty }; }) : [{ brand: '' }], photos = {};
  var have = ed ? { order: ed.photo_order_id, pending: ed.photo_pending_id, exec: ed.photo_exec_id } : null;
  v.innerHTML = '<h2>' + (ed ? 'Edit store order ' + h(ono(ed)) : 'Naya store order (Karwa Marketing)') + '</h2><datalist id="dl_brand">' + BRANDS.map(function (b) { return '<option value="' + b + '">'; }).join('') + '</datalist>' +
    '<div class="card"><label>Store *</label><select id="sst"><option value="">Store chunein</option>' + stores.map(function (x) { return '<option' + (x === cur ? ' selected' : '') + '>' + h(x) + '</option>'; }).join('') + '</select>' +
    (ed ? '<div class="small muted">Dealer: ' + h(ed.dealer_name) + '</div>' : '<div class="small muted">Store ka dealer apne aap juda jayega (area / van plan ke liye). Na mile to naya "Intimissi store" dealer ban jayega.</div>') + '</div>' +
    '<div class="card"><div class="grid2"><div><label>Order kisne liya (taken by)</label><input id="tb" value="' + h(ed ? ed.taken_by : S.user.name) + '"></div><div><label>Priority</label><select id="pri">' + S.m.priorities.map(function (x) { return '<option' + (ed && ed.priority === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
    '<div><label>Expected dispatch date (optional)</label><input id="exd" type="date" value="' + h(ed ? ed.expected_date : '') + '"></div><div><label>Source</label><input value="' + STORE_SRC + '" disabled></div></div></div>' +
    '<div class="card"><h3>Brand / items</h3><div id="lns"></div><button class="sm" id="al">+ Brand line</button><div class="small muted" id="tot"></div></div>' +
    '<div class="card"><h3>Photos</h3><p class="small muted">Phone par camera khulega, computer par file chunein. Photo apne aap chhoti ho jaati hai.</p>' + photoInputs(have) + '</div>' +
    '<div class="card"><label>Remarks (optional)</label><textarea id="rm" rows="2">' + h(ed ? ed.remarks : '') + '</textarea></div><button class="primary big" id="sv">' + (ed ? 'Save changes' : 'Store order banayein') + '</button>';
  function readLines() { lines = Array.prototype.map.call(document.querySelectorAll('.ln'), function (r) { return { brand: r.querySelector('.lb').value, item: r.querySelector('.li').value, qty: r.querySelector('.lq').value }; }); }
  function total() { readLines(); $('tot').textContent = 'Total: ' + lines.reduce(function (a, l) { return a + (Number(l.qty) || 0); }, 0) + ' pcs'; }
  function drawLines() {
    $('lns').innerHTML = lines.map(function (l, i) { return '<div class="ln" style="border-bottom:1px solid var(--line);padding:6px 0"><div class="grid2"><div><label>Brand *</label><input class="lb" list="dl_brand" value="' + h(l.brand) + '"></div><div><label>Item (optional)</label><input class="li" value="' + h(l.item) + '"></div><div><label>Qty (pcs) *</label><input class="lq" type="number" min="1" inputmode="numeric" value="' + h(l.qty) + '"></div></div>' + (lines.length > 1 && !(ed && ed.picked_at) ? '<button class="sm" data-rm="' + i + '">Line hatayein</button>' : '') + '</div>'; }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('[data-rm]'), function (b) { b.onclick = function () { readLines(); lines.splice(Number(b.dataset.rm), 1); drawLines(); }; });
    Array.prototype.forEach.call(document.querySelectorAll('.lq'), function (e) { e.oninput = total; }); total();
  }
  $('al').onclick = function () { if (ed && ed.picked_at) return toast('Pick ke baad line add nahi ho sakti', 'err'); readLines(); lines.push({ brand: '' }); drawLines(); };
  drawLines(); bindPhotoInputs(photos);
  $('sv').onclick = function () {
    readLines(); var st = val('sst'); if (!st) return toast('Store chunein', 'err');
    var miss = PHOTO_KINDS.filter(function (k) { return !photos[k[0]] && !(have && have[k[0]]); });
    if (!ed && miss.length) return toast(miss.map(function (k) { return k[1]; }).join(', ') + ' ki photo lagayein', 'err');
    var d = { store: st, source: STORE_SRC, priority: val('pri'), taken_by: val('tb'), expected_date: val('exd'), remarks: val('rm'), lines: lines };
    var btn = $('sv'); btn.disabled = true;
    var save = ed ? call('editOrder', Object.assign(d, { id: ed.id })).then(function () { return { id: ed.id }; }) : call('createStoreOrder', d);
    save.then(function (r) {
      var id = r.id; if (!ed) toast((r.track_no ? r.track_no + ' / ' : '') + r.order_no + ' ban gaya, photos upload ho rahi hain...');
      return uploadAll(id, photos).then(function (bad) {
        if (bad.length) toast('Order save hai, par ' + bad.map(kindLbl).join(', ') + ' upload nahi hui. Order page se dobara lagayein.', 'err'); else toast(ed ? 'Saved' : 'Store order aur photos save ho gaye ✔');
        S.dl = null; go('/o/' + id);
      });
    }).catch(function (e) { btn.disabled = false; fail(e); });
  };
}
/** Order detail: 3 photos with view + add / replace. Photo bytes are fetched only when tapped. */
function storePhotosCard(v, o) {
  var have = { order: o.photo_order_id, pending: o.photo_pending_id, exec: o.photo_exec_id }, box = document.createElement('div'); box.className = 'card';
  box.innerHTML = '<h3>🏬 Store order: ' + h(storeOf(o)) + '</h3><div class="small" style="margin-bottom:6px">' + photoFlags(o) + '</div>' +
    PHOTO_KINDS.map(function (k) { return '<div class="chk"><b style="flex:1">' + k[1] + '</b>' + (have[k[0]] ? '<button class="sm" data-pv="' + k[0] + '">Dekhein</button>' : '<span class="small short">Nahi lagi</span>') +
      (canNew() ? '<label class="btn sm" style="flex:0;white-space:nowrap">' + (have[k[0]] ? 'Badlein' : '+ Lagayein') + '<input type="file" accept="image/*" capture="environment" data-pu="' + k[0] + '" style="display:none"></label>' : '') + '</div>'; }).join('');
  v.insertBefore(box, v.children[1] || null);
  Array.prototype.forEach.call(box.querySelectorAll('[data-pv]'), function (b) { b.onclick = function () {
    var k = b.dataset.pv; call('getStorePhoto', { order_id: o.id, kind: k }).then(function (r) { sheet('<h3>' + kindLbl(k) + '</h3><img src="data:' + h(r.mime) + ';base64,' + r.b64 + '" style="width:100%;height:auto">'); }).catch(fail);
  }; });
  Array.prototype.forEach.call(box.querySelectorAll('[data-pu]'), function (inp) { inp.onchange = function () {
    var k = inp.dataset.pu, f = inp.files[0]; if (!f) return;
    compressImg(f).then(function (ph) { return uploadPhoto(o.id, k, ph); }).then(function () { toast(kindLbl(k) + ' lag gayi ✔'); vOrder(v, o.id); }).catch(function (e) { inp.value = ''; fail(e); });
  }; });
}
function vNew(v, ed) {
  if (!canNew()) return go('/q');
  loadDealers().then(function (list) {
    var sel = ed ? list.filter(function (d) { return String(d.src_id) === String(ed.dealer_src_id); })[0] || { id: '', name: ed.dealer_name } : null, lines = ed ? ed.lines.map(function (l) { return { brand: l.brand, item: l.item, qty: l.ordered_qty, value: l.ordered_value }; }) : [{ brand: 'TRYLO' }];
    v.innerHTML = '<h2>' + (ed ? 'Edit ' + h(ono(ed)) : 'New order (phone / WhatsApp / walk-in)') + '</h2>' + dlists() + '<datalist id="dl_brand">' + BRANDS.map(function (b) { return '<option value="' + b + '">'; }).join('') + '</datalist>' +
      '<div class="card"><label>Dealer</label><div id="dsel"></div><input id="ds" placeholder="Dealer ka naam search karein"' + (ed && ed.picked_at ? '' : '') + '><div id="dres"></div>' + (ed ? '' : '<label class="chk"><input type="checkbox" id="nd"> Naya dealer add karein</label><div id="ndf" class="hidden grid2"><div><label>Naam</label><input id="ndn"></div><div><label>Mobile</label><input id="ndm" inputmode="tel"></div><div><label>Area</label><input id="nda" list="dl_area"></div><div><label>Zone</label><input id="ndz" list="dl_zone"></div></div>') + '</div>' +
      '<div class="card"><div class="grid2"><div><label>Source</label><select id="src">' + S.m.sources.filter(function (x) { return x !== STORE_SRC; }).map(function (x) { return '<option' + (ed && ed.source === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div><div><label>Priority</label><select id="pri">' + S.m.priorities.map(function (x) { return '<option' + (ed && ed.priority === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
      '<div><label>Order kisne liya (taken by)</label><input id="tb" value="' + h(ed ? ed.taken_by : S.user.name) + '"></div><div><label>Salesman (optional)</label><input id="sm" value="' + h(ed ? ed.salesman : '') + '"></div>' +
      '<div><label>Expected dispatch date</label><input id="exd" type="date" value="' + h(ed ? ed.expected_date : '') + '"></div></div></div>' +
      '<div class="card"><h3>Items</h3><div id="lns"></div><button class="sm" id="al">+ Line</button><div class="small muted" id="tot"></div></div>' +
      '<div class="card"><label>Remarks</label><textarea id="rm" rows="2">' + h(ed ? ed.remarks : '') + '</textarea></div><button class="primary big" id="sv">' + (ed ? 'Save changes' : 'Order banayein') + '</button>';
    function showSel() { $('dsel').innerHTML = sel ? '<div class="chk"><b style="flex:1">' + h(sel.name) + '</b><span class="small muted">' + h(sel.zone || '') + ' ' + h(sel.area || '') + '</span></div>' : '<span class="small muted">Koi dealer nahi chuna</span>'; }
    $('ds').oninput = function () { var q = val('ds').toUpperCase(); $('dres').innerHTML = q.length < 2 ? '' : list.filter(function (d) { return d.name.toUpperCase().indexOf(q) >= 0 || String(d.mobile).indexOf(q) >= 0; }).slice(0, 12).map(function (d) { return '<div class="chk" data-pick="' + d.id + '" style="cursor:pointer"><span style="flex:1">' + h(d.name) + '</span><span class="small muted">' + h(d.zone || '') + ' ' + h(d.area || '') + '</span></div>'; }).join('') || '<p class="small muted">Nahi mila. Naya dealer add karein.</p>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-pick]'), function (e) { e.onclick = function () { sel = list.filter(function (d) { return d.id === Number(e.dataset.pick); })[0]; $('dres').innerHTML = ''; $('ds').value = ''; if ($('nd')) { $('nd').checked = false; $('ndf').classList.add('hidden'); } showSel(); }; }); };
    if ($('nd')) $('nd').onchange = function () { $('ndf').classList.toggle('hidden', !this.checked); if (this.checked) { sel = null; showSel(); $('ndn').value = val('ds'); } };
    function readLines() { lines = Array.prototype.map.call(document.querySelectorAll('.ln'), function (r) { return { brand: r.querySelector('.lb').value, item: r.querySelector('.li').value, qty: r.querySelector('.lq').value, value: r.querySelector('.lv').value }; }); }
    function drawLines() {
      $('lns').innerHTML = lines.map(function (l, i) { return '<div class="ln" style="border-bottom:1px solid var(--line);padding:6px 0"><div class="grid2"><div><label>Brand</label><input class="lb" list="dl_brand" value="' + h(l.brand) + '"></div><div><label>Item (optional)</label><input class="li" value="' + h(l.item) + '"></div><div><label>Qty (pcs) *</label><input class="lq" type="number" min="1" inputmode="numeric" value="' + h(l.qty) + '"><input class="lv" type="hidden" value="' + h(l.value) + '"></div></div>' + (lines.length > 1 && !(ed && ed.picked_at) ? '<button class="sm" data-rm="' + i + '">Hatayein</button>' : '') + '</div>'; }).join('');
      Array.prototype.forEach.call(document.querySelectorAll('[data-rm]'), function (b) { b.onclick = function () { readLines(); lines.splice(Number(b.dataset.rm), 1); drawLines(); }; });
      Array.prototype.forEach.call(document.querySelectorAll('.lq,.lv'), function (e) { e.oninput = total; }); total();
    }
    function total() { readLines(); $('tot').textContent = 'Total: ' + lines.reduce(function (a, l) { return a + (Number(l.qty) || 0); }, 0) + ' pcs'; }
    $('al').onclick = function () { if (ed && ed.picked_at) return toast('Pick ke baad line add nahi ho sakti', 'err'); readLines(); lines.push({ brand: '' }); drawLines(); };
    showSel(); drawLines();
    $('sv').onclick = function () {
      readLines(); var d = { source: val('src'), priority: val('pri'), taken_by: val('tb'), salesman: val('sm'), expected_date: val('exd'), remarks: val('rm'), lines: lines };
      if (sel && sel.id) d.dealer_id = sel.id; else if ($('nd') && $('nd').checked) d.new_dealer = { name: val('ndn'), mobile: val('ndm'), area: val('nda'), zone: val('ndz') }; else if (!ed) return toast('Dealer chunein', 'err');
      if (ed) { d.id = ed.id; call('editOrder', d).then(function () { toast('Saved'); go('/o/' + ed.id); }).catch(fail); }
      else call('createOrder', d).then(function (r) { S.dl = null; toast((r.track_no ? r.track_no + ' / ' : '') + r.order_no + ' ban gaya'); go('/o/' + r.id); }).catch(fail);
    };
  }).catch(fail);
}

// ---------------- dealers
function loadDealers(force) { if (S.dl && !force) return Promise.resolve(S.dl); return call('dealers', {}, true).then(function (d) { S.dl = d; return d; }); }
function uniq(k) { var m = {}; (S.dl || []).forEach(function (d) { var v = String(d[k] || '').trim(); if (v) m[v] = 1; }); return Object.keys(m).sort(); }
function dlists() { return '<div id="dlbox">' + ['zone', 'area', 'route'].map(function (k) { return '<datalist id="dl_' + k + '">' + uniq(k).map(function (v) { return '<option value="' + h(v) + '">'; }).join('') + '</datalist>'; }).join('') + '</div>'; }
function vDealers(v) {
  loadDealers(true).then(function (list) {
    var fz = LS.getItem('imw_fz') || '', fa = '';
    v.innerHTML = '<div class="row"><h2>Dealers (' + list.length + ')</h2><button class="sm" id="dx">CSV download</button><label class="btn sm" style="margin:0">CSV upload<input type="file" id="du" accept=".csv" class="hidden"></label></div>' + dlists() +
      '<div class="row"><input id="dq" placeholder="Naam / mobile"><select id="dz"><option value="">Sab zone</option><option value="__none">(zone khali)</option>' + uniq('zone').map(function (z) { return '<option' + (z === fz ? ' selected' : '') + '>' + h(z) + '</option>'; }).join('') + '</select><select id="da"><option value="">Sab area</option><option value="__none">(area khali)</option>' + uniq('area').map(function (z) { return '<option>' + h(z) + '</option>'; }).join('') + '</select></div>' +
      '<div class="card" style="margin-top:10px"><b>Bulk:</b> select karke zone / area set karein<div class="row" style="margin-top:6px"><input id="bz" list="dl_zone" placeholder="Zone"><input id="ba" list="dl_area" placeholder="Area (optional)"><button class="primary" id="bs">Selected par lagao</button></div><label class="chk"><input type="checkbox" id="sall"> Sab dikh rahe select karein</label></div><div id="dlst"></div>' +
      '<p class="small muted">CSV columns: id, name, area, zone, route (id ya name se match). Sales Tracker sync aapke badle hue area/zone/route ko overwrite nahi karega.</p>';
    function shown() {
      var q = val('dq').toUpperCase(), z = val('dz'), a = val('da');
      return list.filter(function (d) { return (!q || (d.name + ' ' + d.mobile).toUpperCase().indexOf(q) >= 0) && (!z || (z === '__none' ? !d.zone : d.zone === z)) && (!a || (a === '__none' ? !d.area : d.area === a)); });
    }
    function draw() {
      var f = shown();
      $('dlst').innerHTML = f.slice(0, 300).map(function (d) { return '<div class="chk"><input type="checkbox" class="dsel" value="' + d.id + '"><span style="flex:1"><b>' + h(d.name) + '</b><br><span class="small muted">Zone ' + h(d.zone || '-') + ' • ' + h(d.area || 'area ?') + ' • ' + h(d.route || '-') + (d.beat_day ? ' • ' + h(d.beat_day) : '') + (d.local_override ? ' • local: ' + h(d.local_override) : '') + '</span></span><button class="sm" data-de="' + d.id + '">Edit</button></div>'; }).join('') + (f.length > 300 ? '<p class="muted small">Pehle 300 dikh rahe, search se chhota karein (' + f.length + ').</p>' : '');
      Array.prototype.forEach.call(document.querySelectorAll('[data-de]'), function (b) { b.onclick = function () { edit(list.filter(function (x) { return x.id === Number(b.dataset.de); })[0]); }; });
    }
    function edit(d) {
      var sh = sheet('<h3>' + h(d.name) + '</h3>' + dlists() + '<div class="grid2"><div><label>Zone</label><input id="ez" list="dl_zone" value="' + h(d.zone) + '"></div><div><label>Area</label><input id="ea" list="dl_area" value="' + h(d.area) + '"></div><div><label>Route</label><input id="er" list="dl_route" value="' + h(d.route) + '"></div><div><label>Mobile</label><input id="em" value="' + h(d.mobile) + '"></div><div><label>Lat</label><input id="elat" inputmode="decimal" value="' + h(d.lat) + '"></div><div><label>Lng</label><input id="elng" inputmode="decimal" value="' + h(d.lng) + '"></div></div><button class="primary big" id="es" style="margin-top:10px">Save</button>');
      $('es').onclick = function () { call('saveDealer', { id: d.id, zone: val('ez'), area: val('ea'), route: val('er'), mobile: val('em'), lat: val('elat'), lng: val('elng') }).then(function () { sh.remove(); toast('Saved'); vDealers(v); }).catch(fail); };
    }
    $('dq').oninput = draw; $('dz').onchange = function () { LS.setItem('imw_fz', val('dz')); draw(); }; $('da').onchange = draw; draw();
    $('sall').onchange = function () { var c = this.checked; Array.prototype.forEach.call(document.querySelectorAll('.dsel'), function (i) { i.checked = c; }); };
    $('bs').onclick = function () { var ids = Array.prototype.map.call(document.querySelectorAll('.dsel:checked'), function (i) { return Number(i.value); }); if (!ids.length) return toast('Dealers select karein', 'err'); call('bulkDealers', { ids: ids, zone: val('bz'), area: val('ba') }).then(function (n) { toast(n + ' dealers updated'); vDealers(v); }).catch(fail); };
    $('dx').onclick = function () { csv(list.map(function (d) { return { id: d.id, name: d.name, area: d.area, zone: d.zone, route: d.route, beat_day: d.beat_day, mobile: d.mobile, lat: d.lat, lng: d.lng }; }), 'dealers'); };
    $('du').onchange = function () { var f = this.files[0]; if (!f) return; f.text().then(parseCsv).then(function (rows) { rows = rows.map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { o[k.trim().toLowerCase()] = r[k]; }); return o; }); return call('importDealers', { rows: rows }); }).then(function (r) { toast(r.updated + ' updated' + (r.not_found_count ? ', ' + r.not_found_count + ' nahi mile' : '')); vDealers(v); }).catch(fail); };
  }).catch(fail);
}

// ---------------- dashboard
function table(rows, cols) { return '<div class="tw"><table><tr>' + cols.map(function (c) { return '<th>' + c[1] + '</th>'; }).join('') + '</tr>' + rows.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td>' + (c[2] ? c[2](r[c[0]], r) : h(r[c[0]])) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>'; }
function vDash(v) {
  var day = LS.getItem('imw_day') || today();
  call('dashboard', { date: day }).then(function (d) {
    var sl = d.sla || { counts: {}, open: [], delayed: [], kpi: [] }, sc = sl.counts;
    v.innerHTML = '<div class="row"><h2>Dashboard</h2><input type="date" id="day" value="' + day + '" style="flex:0 1 170px"></div>' +
      '<div class="card"><div class="row"><h3>Bill deadline (SLA)</h3><a class="btn sm" href="#/pr" style="flex:0">📦 Purchase aaya</a></div>' + slaHelp() +
      '<div class="grid4" style="margin-top:8px"><div class="kpi"><b style="color:var(--good)">' + (sc['On time'] || 0) + '</b><span>On time</span></div><div class="kpi"><b style="color:var(--mid)">' + (sc['Due soon'] || 0) + '</b><span>Due soon (&lt;30 min)</span></div><div class="kpi"><b class="short">' + (sc['Delayed'] || 0) + '</b><span>Delayed</span></div><div class="kpi"><b style="color:#5b2a7a">' + (sc['Waiting for stock'] || 0) + '</b><span>Waiting for stock</span></div></div>' +
      '<h3 style="margin-top:12px">Pending orders: deadline</h3>' + (sl.open.length ? table(sl.open.slice(0, 100), [['id', 'Tracking no', function (x, r) { return '<a href="#/o/' + x + '"><b>' + h(r.track_no || '-') + '</b></a><div class="small muted">' + h(r.order_no || '#' + x) + '</div>'; }], ['dealer_name', 'Dealer'], ['status', 'Status', function (x, r) { return slaBadge({ sla: { status: x, deadline: r.deadline, waiting: r.waiting ? r.waiting.split(', ') : [], delay_min: r.delay_min } }); }], ['deadline', 'Deadline', tm], ['received_at', 'Order aaya', tm]]) : '<p class="muted small">Koi pending order nahi.</p>') +
      '<div class="row" style="margin-top:12px"><h3>Delayed orders (' + sl.delayed.length + ')</h3><button class="sm" id="e4" style="flex:0">CSV</button></div>' + (sl.delayed.length ? table(sl.delayed, [['id', 'Tracking no', function (x, r) { return '<a href="#/o/' + x + '"><b>' + h(r.track_no || '-') + '</b></a><div class="small muted">' + h(r.order_no || '#' + x) + '</div>'; }], ['dealer_name', 'Dealer'], ['received_at', 'Order aaya', tm], ['deadline', 'Deadline', tm], ['billed_at', 'Bill', function (x) { return x ? tm(x) : '<span class="short">abhi pending</span>'; }], ['delay_min', 'Kitna late', function (x) { return '<span class="pill sla-late">' + mins(x) + '</span>'; }]]) : '<p class="muted small">Koi delayed order nahi 👍</p>') +
      '<h3 style="margin-top:12px">On-time % (din wise, order aane ka din)</h3>' + table(sl.kpi, [['day', 'Din', dmy], ['orders', 'Orders'], ['on_time', 'On time bill'], ['delayed', 'Delayed'], ['pending', 'Abhi pending'], ['pct', 'On-time %', function (x) { return x === '' ? '-' : '<b style="color:' + (x >= 90 ? 'var(--good)' : x >= 70 ? 'var(--mid)' : 'var(--low)') + '">' + x + '%</b>'; }]]) + '</div>' +
      
      '<div class="grid4">' + S.m.stages.map(function (s) { return '<div class="kpi"><b>' + (d.counts[s] || 0) + '</b><span>' + h(stageLbl(s)) + '</span></div>'; }).join('') + '<div class="kpi"><b class="short">' + (d.counts.punch_pending || 0) + '</b><span>Trylo: punching baaki</span></div><div class="kpi"><b class="short">' + d.counts.hold + '</b><span>HOLD</span></div><div class="kpi"><b>' + d.unmatched + '</b><span>Unmatched bills</span></div></div>' +
      '<div class="card" style="margin-top:12px"><h3>Source wise (last 30 din)</h3><div class="grid4">' + Object.keys(d.sources || {}).map(function (k) { return '<div class="kpi"><b>' + d.sources[k] + '</b><span>' + h(k) + '</span></div>'; }).join('') + '</div></div>' +
      '<div class="card" style="margin-top:12px"><div class="row"><h3>Pending to bill (' + d.pending.length + ')</h3><button class="sm" id="e1">CSV</button></div>' + table(d.pending, [['id', 'Tracking no', function (x, r) { return '<a href="#/o/' + x + '"><b>' + h(r.track_no || '-') + '</b></a>'; }], ['order_no', 'Order'], ['source', 'Source', function (x, r) { return h(x) + (r.priority === 'Urgent' ? ' <span class="short">URGENT</span>' : ''); }], ['dealer_name', 'Dealer'], ['zone', 'Zone'], ['area', 'Area'], ['reason', 'Reason', function (x, r) { return r.hold ? '<span class="short">' + h(x) + '</span>' : h(x); }], ['age_days', 'Age (din)'], ['pcs', 'Pcs', pcs]]) + '</div>' +
      '<div class="card"><div class="row"><h3>Aaj ka dispatch by vehicle</h3><button class="sm" id="e2">CSV</button></div>' + table(d.dispatch, [['vehicle', 'Vehicle / mode'], ['orders', 'Orders'], ['dispatched', 'Dispatched'], ['boxes', 'Boxes'], ['pcs', 'Pcs', pcs], ['dealers', 'Dealers', function (x) { return h(x.join(', ')); }]]) + '</div>' +
      '<div class="card"><div class="row"><h3>Efficiency (last 30 din, avg time per step)</h3><button class="sm" id="e3">CSV</button></div>' + table(d.efficiency, [['step', 'Step'], ['person', 'Kisne'], ['orders', 'Orders'], ['avg_min', 'Avg', mins], ['max_min', 'Max', mins]]) + '</div>';
    $('day').onchange = function () { LS.setItem('imw_day', this.value); vDash(v); };
    $('e1').onclick = function () { csv(d.pending, 'pending-to-bill'); }; $('e2').onclick = function () { csv(d.dispatch.map(function (r) { return Object.assign({}, r, { dealers: r.dealers.join(' | ') }); }), 'dispatch-' + day); }; $('e3').onclick = function () { csv(d.efficiency, 'efficiency'); };
    $('e4').onclick = function () { csv(sl.delayed.map(function (r) { return { tracking_no: r.track_no, order: r.order_no || r.id, dealer: r.dealer_name, source: r.source, received: tm(r.received_at), deadline: tm(r.deadline), billed: r.billed_at ? tm(r.billed_at) : 'pending', delay_min: r.delay_min }; }), 'delayed-orders'); };
  }).catch(fail);
}

// ---------------- purchase received (stock aaya)
function istNowLocal() { return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 16); }
function vPurchase(v) {
  if (!isMgr()) return go('/q');
  Promise.all([call('purchaseList'), call('orders', { all: 1 })]).then(function (r) {
    var waiting = r[1].filter(function (o) { return o.wait_brands && !o.billed_at && o.stage !== 'cancelled'; }), wb = {};
    waiting.forEach(function (o) { o.wait_brands.split(',').forEach(function (b) { wb[b] = (wb[b] || 0) + 1; }); });
    var brands = BRANDS.slice(); Object.keys(wb).forEach(function (b) { if (brands.indexOf(b) < 0) brands.push(b); });
    v.innerHTML = '<h2>📦 Purchase aaya (stock received)</h2><div class="card">' + slaHelp() +
      '<p class="small">Waiting for stock: ' + (Object.keys(wb).length ? Object.keys(wb).map(function (b) { return '<b>' + h(b) + '</b> ' + wb[b] + ' order'; }).join(' • ') : 'koi nahi') + '</p>' +
      '<datalist id="dl_brand">' + brands.map(function (b) { return '<option value="' + h(b) + '">'; }).join('') + '</datalist>' +
      '<div class="grid2"><div><label>Brand</label><input id="pb" list="dl_brand" value="' + h(Object.keys(wb)[0] || '') + '"></div><div><label>Kab aaya (date-time)</label><input id="pt" type="datetime-local" value="' + istNowLocal() + '"></div>' +
      '<div><label>Kisne receive kiya</label><input id="pw" value="' + h(S.user.name) + '"></div><div><label>Note (optional)</label><input id="pn" placeholder="Bill no / supplier"></div></div>' +
      '<button class="primary big" id="ps" style="margin-top:10px">Save: purchase aaya</button><p class="small muted">Us brand ke sab pending (bill se pehle) orders ki nayi deadline = yeh time + ' + h((S.m.sla || {}).purchase_grace_hours || 24) + ' ghante.</p></div>' +
      '<div class="card"><h3>Pichli entries</h3>' + (r[0].length ? table(r[0], [['brand', 'Brand'], ['received_at', 'Aaya', tm], ['by_name', 'Kisne'], ['note', 'Note'], ['orders_updated', 'Orders']]) : '<p class="muted small">Abhi koi entry nahi.</p>') + '</div>';
    $('ps').onclick = function () {
      var b = val('pb').toUpperCase(), t = val('pt'); if (!b) return toast('Brand likhein', 'err'); if (!t) return toast('Date-time daalein', 'err');
      if (!confirm(b + ' ka purchase ' + t.replace('T', ' ') + ' par aaya? Iske pending orders ki deadline badlegi.')) return;
      call('purchaseReceived', { brand: b, received_at: t, by: val('pw'), note: val('pn') }).then(function (x) { toast(x.orders_updated + ' orders ki nayi deadline: ' + tm(x.deadline)); vPurchase(v); }).catch(fail);
    };
  }).catch(fail);
}

// ---------------- admin

// ---------------- Kal ki delivery + van day log
function vKalDelivery(v) {
  if (!can('delivery')) return go('/q');
  var day = LS.getItem('imw_kal') || '';
  function load(d) {
    var payload = d ? { date: d } : { tomorrow: 1 };
    call('kalDelivery', payload).then(function (r) {
      day = r.date; LS.setItem('imw_kal', day);
      var logs = {}; (r.van_logs || []).forEach(function (x) { logs[x.van] = x; });
      v.innerHTML = '<div class="row"><h2>Kal / plan delivery</h2><input type="date" id="kd" value="' + h(day) + '"><button class="sm" id="kr">Refresh van log</button></div>' +
        '<p class="small muted">Option ' + h(r.option || (S.m.van_plan && S.m.van_plan.option) || 'A') + ' • ' + (r.orders || []).length + ' open orders for ' + h(dmy(day)) + '</p>' +
        '<div class="card"><h3>Per van summary</h3>' + table(r.summary || [], [['van', 'Van'], ['stops', 'Stops'], ['orders', 'Orders'], ['pcs', 'Pcs', pcs], ['value', 'Value', inr], ['areas', 'Areas']]) + '</div>' +
        (r.summary || []).map(function (s) {
          var lg = logs[s.van] || {};
          return '<div class="card"><h3>' + h(s.van) + ' — km log</h3><div class="small muted">Planned: ' + s.stops + ' stops • ' + s.orders + ' orders • ' + pcs(s.pcs) + ' • ' + inr(s.value) + '</div>' +
            '<div class="grid2"><div><label>Start km</label><input id="sk_' + h(s.van) + '" inputmode="numeric" value="' + h(lg.start_km != null ? lg.start_km : '') + '"></div><div><label>End km</label><input id="ek_' + h(s.van) + '" inputmode="numeric" value="' + h(lg.end_km != null ? lg.end_km : '') + '"></div></div>' +
            '<div class="small muted">Running: ' + (lg.running_km !== '' && lg.running_km != null ? h(lg.running_km) + ' km' : '—') + (lg.note ? ' • ' + h(lg.note) : '') + '</div>' +
            '<button class="primary" data-van="' + h(s.van) + '" style="margin-top:8px">Save km</button></div>';
        }).join('') +
        '<div class="card"><h3>Orders</h3>' + (r.orders || []).map(card).join('') + (!(r.orders || []).length ? '<p class="muted">Is din koi open plan order nahi.</p>' : '') + '</div>';
      $('kd').onchange = function () { load(val('kd')); };
      $('kr').onclick = function () { call('refreshVanLog', { date: day }).then(function () { toast('Van log refreshed'); load(day); }).catch(fail); };
      Array.prototype.forEach.call(document.querySelectorAll('[data-van]'), function (b) {
        b.onclick = function () {
          var van = b.getAttribute('data-van');
          call('saveVanLog', { date: day, van: van, start_km: val('sk_' + van), end_km: val('ek_' + van) }).then(function () { toast('Km saved'); load(day); }).catch(fail);
        };
      });
    }).catch(fail);
  }
  load(day || null);
}

// ---------------- Van plan (Warehouse Manager settings)
function vVanPlan(v) {
  if (!can('routes')) return go('/q');
  function draw() {
    Promise.all([call('routesList'), call('unmappedDealers')]).then(function (rr) {
      var R = rr[0], U = rr[1], opt = R.option || 'A';
      var routes = (R.routes || []).filter(function (x) { return Number(x.active) !== 0; }).sort(function (a, b) { return String(a.option).localeCompare(String(b.option)) || String(a.area).localeCompare(String(b.area)); });
      v.innerHTML = '<h2>Van plan</h2>' +
        '<div class="card"><h3>Active plan option</h3><p class="small muted">A = Minimum km (tighter days). B = Maximum volume (extra weekdays). Switch se open (not dispatched) orders recompute hote hain.</p>' +
        '<div class="row"><label class="chk"><input type="radio" name="vpo" value="A"' + (opt === 'A' ? ' checked' : '') + '> A — Minimum km</label><label class="chk"><input type="radio" name="vpo" value="B"' + (opt === 'B' ? ' checked' : '') + '> B — Maximum volume</label></div>' +
        '<div class="grid2"><div><label>Real-time cutoff (IST)</label><input id="vcut" value="' + h(R.realtime_cutoff || '20:00') + '" placeholder="20:00"></div></div>' +
        '<button class="primary" id="vpos" style="margin-top:8px">Save option + recompute</button> <button class="sm" id="vre">Recompute only</button></div>' +
                '<div class="card" style="border:2px solid #c0392b;background:#fff5f5"><div class="row"><h3 style="color:#c0392b">⚠ Unmapped dealers / zones — ' + (U.count || 0) + '</h3><span class="pill st-hold">option ' + h(U.option) + '</span></div>' +
        '<p class="small">WH orders mein aksar zone = <b>Unmapped</b> hota hai. Neeche list fix karein: Dealers → Area / zone badlein, ya Van plan mein route jodein. Open orders: <b>' + (U.open_orders_unmapped || 0) + '</b> unmapped/no-area, <b>' + (U.open_orders_no_plan || 0) + '</b> bina plan date.</p>' +
        (!(U.dealers || []).length ? '<p class="muted">Sab dealers map ho gaye 👍</p>' :
          (U.dealers || []).slice(0, 120).map(function (d) {
            return '<div class="chk"><a href="#/dl">' + h(d.name) + '</a> <span class="small"><b>' + h(d.area || '(no area)') + '</b>' + (d.zone ? ' • zone ' + h(d.zone) : '') + (d.why ? ' <span class="short">[' + h(d.why) + ']</span>' : '') + (d.kmpl ? ' • KMPL→' + h(d.kmpl) : '') + '</span></div>';
          }).join('') + (U.count > 120 ? '<p class="small muted">…aur ' + (U.count - 120) + ' — Dealers tab se search karein</p>' : '')) +
        '<div class="row" style="margin-top:8px;flex-wrap:wrap;gap:6px"><a class="btn sm danger" href="#/all" id="goUnmapped">Filter: Unmapped area orders</a><a class="btn sm" href="#/dl">Dealers</a>' +
        '</div></div>' +
        '<div class="card"><div class="row"><h3>Routes (' + routes.length + ')</h3><button class="sm" id="vseed">Seed area_day_master (110)</button></div>' +
        '<p class="small muted">Master: area_day_master.csv — 52 van + 3 courier (Gurgaon/Faridabad/Elan Epic) × options A/B. Closed days CSV closed_day se; Sheet Closed_Days tab bhi sync ho sakta hai baad mein.</p>' +
        table(routes, [['option', 'Opt'], ['area', 'Area'], ['van', 'Van'], ['weekdays', 'Days'], ['mode', 'Mode'], ['notes', 'Notes'], ['id', '', function (x) { return '<button class="sm" data-re="' + x + '">Edit</button>'; }]]) +
        '<details style="margin-top:8px"><summary><b>+ Route / area</b></summary><div class="grid2"><div><label>Area</label><input id="ra"></div><div><label>Van</label><select id="rv"><option value="">-</option>' + (R.vans || []).map(function (x) { return '<option>' + h(x) + '</option>'; }).join('') + '</select></div><div><label>Weekdays</label><input id="rw" placeholder="Mon,Wed"></div><div><label>Mode</label><select id="rm"><option>van</option><option>hand</option><option>courier</option></select></div><div><label>Option</label><select id="ro"><option>A</option><option>B</option></select></div><div><label>Notes</label><input id="rn"></div></div><button class="primary" id="rsa" style="margin-top:8px">Save route</button></details></div>' +
        '<div class="card"><h3>Market closed weekdays</h3>' + table(R.closed || [], [['area', 'Area'], ['closed_weekday', 'Closed'], ['id', '', function (x) { return '<button class="sm warn" data-mc="' + x + '">Hatao</button>'; }]]) +
        '<div class="row" style="margin-top:6px"><input id="mca" placeholder="Area"><input id="mcw" placeholder="Sun"><button id="mcs">Add</button></div></div>' +
        '<div class="card"><h3>Holidays</h3>' + table(R.holidays || [], [['date', 'Date', dmy], ['area', 'Area'], ['reason', 'Reason'], ['id', '', function (x) { return '<button class="sm warn" data-ho="' + x + '">Hatao</button>'; }]]) +
        '<div class="row" style="margin-top:6px"><input type="date" id="hd"><input id="ha" placeholder="ALL / area"><input id="hr" placeholder="Reason"><button id="hs">Add</button></div></div>' +
'<div class="card"><a class="btn sm" href="#/kal">🚐 Kal delivery + km log</a></div>';
      $('vpos').onclick = function () {
        var o = (document.querySelector('input[name=vpo]:checked') || {}).value || 'A';
        if (!confirm('Option ' + o + ' set karke sab open orders recompute karein?')) return;
        call('setVanPlanOption', { option: o, cutoff: val('vcut') }).then(function (r) { S.m = null; toast('Option ' + r.option + ' • updated ' + r.updated); draw(); }).catch(fail);
      };
      $('vre').onclick = function () { call('recomputePlans').then(function (r) { toast('Recomputed ' + r.updated); }).catch(fail); };
      if ($('goUnmapped')) $('goUnmapped').onclick = function (e) { e.preventDefault(); LS.setItem('imw_f', 'unmapped'); go('/all'); };
      function unmappedCsvEscape(v) { v = String(v == null ? '' : v); if (/[",\n\r]/.test(v)) return '"' + v.replace(/"/g, '""') + '"'; return v; }
      function downloadUnmappedCsv(rows, cols, name) {
        var lines = [cols.join(',')];
        (rows || []).forEach(function (r) { lines.push(cols.map(function (c) { return unmappedCsvEscape(r[c]); }).join(',')); });
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv' })); a.download = name + '-' + today() + '.csv'; a.click();
      }
      if ($('dlUnmappedTpl')) $('dlUnmappedTpl').onclick = function () {
        call('unmappedTemplate').then(function (T) {
          var cols = T.columns || ['dealer_id','dealer_name','city','current_area','current_zone','current_route','open_orders','why','suggested_area','suggested_van','suggested_weekdays','suggested_mode','new_area','new_zone','new_route','mode','notes'];
          downloadUnmappedCsv(T.rows || [], cols, 'unmapped-dealers-template');
          toast((T.count || 0) + ' rows • ' + (T.suggested_confident || 0) + ' suggested');
        }).catch(fail);
      };
      if ($('dlAreasList')) $('dlAreasList').onclick = function () {
        call('areasList').then(function (A) {
          downloadUnmappedCsv(A.areas || [], ['area','van','weekdays','mode','option'], 'valid-areas');
          toast((A.count || 0) + ' areas' + (A.from_seed ? ' (from seed — Routes empty)' : ''));
        }).catch(fail);
      };
      if ($('impUnmapped')) $('impUnmapped').onchange = function () {
        var file = this.files[0]; this.value = ''; if (!file) return;
        readFile(file).then(function (rows) {
          if (!rows.length) throw new Error('File khali hai');
          rows = rows.map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { o[String(k).trim().toLowerCase()] = r[k]; }); return o; });
          var box = $('impUnmappedBox');
          box.innerHTML = '<p class="small">Preview…</p>';
          return call('importDealerAreas', { rows: rows, dry_run: 1, apply: 0 }).then(function (prev) {
            var errs = (prev.warnings || []).slice(0, 40).map(function (w) {
              return '<div class="small short">L' + h(w.line) + ' #' + h(w.dealer_id) + ': ' + h(w.msg) + '</div>';
            }).join('');
            var pv = (prev.preview || []).slice(0, 30).map(function (r) {
              return '<tr><td>' + h(r.dealer_id) + '</td><td>' + h(r.dealer_name) + '</td><td>' + h(r.new_area) + '</td><td>' + h(r.new_zone) + '</td><td>' + h(r.new_route) + '</td><td>' + h(r.mode) + '</td></tr>';
            }).join('');
            box.innerHTML = '<div class="card" style="background:#fff"><b>Preview:</b> ' + (prev.updated || 0) + ' update, ' + (prev.skipped || 0) + ' skip, ' + (prev.warnings_count || 0) + ' warnings' +
              (prev.routes_to_create && prev.routes_to_create.length ? ' • ' + prev.routes_to_create.length + ' areas create honge (tick below)' : '') +
              '<div class="tw" style="max-height:220px;overflow:auto;margin-top:6px"><table><tr><th>id</th><th>name</th><th>new_area</th><th>new_zone</th><th>new_route</th><th>mode</th></tr>' + pv + '</table></div>' +
              (errs ? '<details style="margin-top:6px"><summary>Warnings</summary>' + errs + '</details>' : '') +
              '<label class="chk" style="margin-top:8px"><input type="checkbox" id="impCreateAreas"> Create missing areas (Routes) — CSV mein van/weekdays / mode chahiye</label>' +
              '<div class="row" style="margin-top:8px"><button class="primary" id="impApply">Apply import</button><button class="sm" id="impCancel">Cancel</button></div></div>';
            $('impCancel').onclick = function () { box.innerHTML = ''; };
            $('impApply').onclick = function () {
              if (!confirm('Apply ' + (prev.updated || 0) + ' dealer updates?')) return;
              call('importDealerAreas', { rows: rows, apply: 1, dry_run: 0, create_missing_areas: $('impCreateAreas').checked ? 1 : 0 }).then(function (r) {
                toast('Updated ' + r.updated + ' • orders ' + (r.orders_recomputed || 0) + (r.routes_created ? ' • routes +' + r.routes_created : '') + (r.warnings_count ? ' • warn ' + r.warnings_count : ''));
                box.innerHTML = ''; draw();
              }).catch(fail);
            };
          });
        }).catch(fail);
      };
      $('vseed').onclick = function () { if (!confirm('area_day_master.csv seed load (110 rows, A+B)? Active plan B set hoga. Existing same area+option update.')) return; call('seedRoutesExample', { replace: 0 }).then(function (r) { toast('Seeded ' + r.seeded + ' routes • recompute ' + r.recomputed); draw(); }).catch(fail); };
      $('rsa').onclick = function () { call('saveRoute', { area: val('ra'), van: val('rv'), weekdays: val('rw'), mode: val('rm'), option: val('ro'), notes: val('rn') }).then(function () { toast('Route saved'); draw(); }).catch(fail); };
      $('mcs').onclick = function () { call('saveMarketClosed', { area: val('mca'), closed_weekday: val('mcw') }).then(function () { toast('Closed day saved'); draw(); }).catch(fail); };
      $('hs').onclick = function () { call('saveHoliday', { date: val('hd'), area: val('ha') || 'ALL', reason: val('hr') }).then(function () { toast('Holiday saved'); draw(); }).catch(fail); };
      Array.prototype.forEach.call(document.querySelectorAll('[data-re]'), function (b) {
        b.onclick = function () {
          var r = routes.filter(function (x) { return Number(x.id) === Number(b.getAttribute('data-re')); })[0]; if (!r) return;
          var d = sheet('<h3>Edit route</h3><label>Area</label><input id="era" value="' + h(r.area) + '"><label>Van</label><input id="erv" value="' + h(r.van) + '"><label>Weekdays</label><input id="erw" value="' + h(r.weekdays) + '"><label>Mode</label><select id="erm"><option' + (r.mode === 'van' ? ' selected' : '') + '>van</option><option' + (r.mode === 'hand' ? ' selected' : '') + '>hand</option><option' + (r.mode === 'courier' ? ' selected' : '') + '>courier</option></select><label>Option</label><select id="ero"><option' + (r.option === 'A' ? ' selected' : '') + '>A</option><option' + (r.option === 'B' ? ' selected' : '') + '>B</option></select><label>Notes</label><input id="ern" value="' + h(r.notes) + '"><label class="chk"><input type="checkbox" id="era2"' + (Number(r.active) !== 0 ? ' checked' : '') + '> Active</label><button class="primary big" id="ers" style="margin-top:10px">Save</button>');
          $('ers').onclick = function () { call('saveRoute', { id: r.id, area: val('era'), van: val('erv'), weekdays: val('erw'), mode: val('erm'), option: val('ero'), notes: val('ern'), active: $('era2').checked ? 1 : 0 }).then(function () { d.remove(); toast('Saved'); draw(); }).catch(fail); };
        };
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-mc]'), function (b) {
        b.onclick = function () { if (!confirm('Hataein?')) return; call('saveMarketClosed', { id: Number(b.getAttribute('data-mc')), remove: 1, area: ' ', closed_weekday: 'Sun' }).then(draw).catch(fail); };
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-ho]'), function (b) {
        b.onclick = function () { if (!confirm('Hataein?')) return; call('saveHoliday', { id: Number(b.getAttribute('data-ho')), remove: 1 }).then(draw).catch(fail); };
      });
    }).catch(function (e) { if (/Unknown action/i.test(String(e && e.message || e))) { v.innerHTML = '<div class="card center muted">Van plan server pe abhi deploy nahi. Stage build ready — Pramod approve ke baad push.</div>'; return; } fail(e); });
  }
  draw();
}

function vAdmin(v) {
  Promise.all([call('users'), call('staffList')]).then(function (rr) { var us = rr[0]; S.m.staffAll = rr[1];
    v.innerHTML = '<h2>Admin</h2><div class="card"><h3>Users</h3>' + table(us, [['username', 'Login'], ['name', 'Naam'], ['role_label', 'Role'], ['active', 'Active', function (x) { return Number(x) ? 'Haan' : 'Nahi'; }], ['id', '', function (x) { return '<button class="sm" data-u="' + x + '">Edit</button>'; }]]) +
      '<button class="primary" id="nu" style="margin-top:8px">+ Naya user</button></div><div class="card"><h3>Vehicles</h3>' + S.m.vehicles.map(function (x) { return '<div class="chk">' + h(x.number) + ' <span class="muted small">' + h(x.type) + '</span></div>'; }).join('') + '<div class="row" style="margin-top:8px"><input id="vn" placeholder="DL1XX-0000"><button id="va">Add vehicle</button></div></div>' +
      '<div class="card"><h3>Staff names (bina login)</h3><p class="small muted">Yeh naam "Done by" dropdown mein aate hain.</p>' + (S.m.staffAll || []).map(function (x) { return '<div class="chk"><span style="flex:1">' + h(x.name) + ' <span class="muted small">' + h(S.m.roles[x.role] || x.role) + (Number(x.active) ? '' : ' (off)') + '</span></span><button class="sm" data-st="' + x.id + '">' + (Number(x.active) ? 'Off' : 'On') + '</button></div>'; }).join('') +
      '<div class="row" style="margin-top:8px"><input id="sn" placeholder="Naam"><select id="sr">' + ['picker', 'checker', 'biller', 'packer', 'dispatch', 'warehouse_manager'].map(function (r) { return '<option value="' + r + '">' + S.m.roles[r] + '</option>'; }).join('') + '</select><button id="sa">Add</button></div></div>' +
      '<div class="card small muted">Sales Tracker sync: har 15 min (trigger). Last: ' + tm(S.m.last_sync) + ' ' + h(S.m.last_sync_note) + '</div><button class="big" id="lo">Logout</button>';
    function edit(u) {
      u = u || {}; var d = sheet('<h3>' + (u.id ? 'Edit user' : 'Naya user') + '</h3>' + (u.id ? '' : '<label>Username</label><input id="eu">') + '<label>Naam</label><input id="en" value="' + h(u.name) + '"><label>Mobile</label><input id="em" value="' + h(u.mobile) + '"><label>Role</label><select id="er">' + Object.keys(S.m.roles).map(function (r) { return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + S.m.roles[r] + '</option>'; }).join('') + '</select><label>PIN ' + (u.id ? '(khali = same)' : '') + '</label><input id="ep" inputmode="numeric">' + (u.id ? '<label class="chk"><input type="checkbox" id="ea"' + (Number(u.active) ? ' checked' : '') + '> Active</label>' : '') + '<button class="primary big" id="es" style="margin-top:10px">Save</button>');
      $('es').onclick = function () { call('saveUser', { id: u.id, username: val('eu'), name: val('en'), mobile: val('em'), role: val('er'), pin: val('ep'), active: u.id ? $('ea').checked : 1 }).then(function () { d.remove(); S.m = null; toast('Saved'); route(); }).catch(fail); };
    }
    $('nu').onclick = function () { edit(); };
    Array.prototype.forEach.call(document.querySelectorAll('[data-u]'), function (b) { b.onclick = function () { edit(us.filter(function (x) { return x.id === Number(b.dataset.u); })[0]); }; });
    $('va').onclick = function () { call('saveVehicle', { number: val('vn') }).then(function () { S.m = null; route(); }).catch(fail); };
    $('lo').onclick = function () { signOut(); };
    $('sa').onclick = function () { call('saveStaff', { name: val('sn'), role: val('sr') }).then(function () { S.m = null; toast('Added'); route(); }).catch(fail); };
    Array.prototype.forEach.call(document.querySelectorAll('[data-st]'), function (b) { b.onclick = function () { var x = S.m.staffAll.filter(function (y) { return y.id === Number(b.dataset.st); })[0]; call('saveStaff', { id: x.id, name: x.name, role: x.role, active: !Number(x.active) }).then(function () { S.m = null; route(); }).catch(fail); }; });
  }).catch(fail);
}
// non-admin logout: long-press title
$('title').addEventListener('click', function () { if (S.user && confirm('Logout karein?')) signOut(); });
route();
})();
