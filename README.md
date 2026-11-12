# IM Warehouse

Order tracker for the Intimissi / Karwa warehouse, Delhi: orders from the Sales Tracker, then allocate to picker, pick (with short qty), check, bill, pack, delivery allocation, dispatch.

App: https://pramod-lgtm.github.io/im-warehouse/
Backend: Google Apps Script Web app (Code.gs kept outside this repo, see SETUP.md given with it).

## Demo logins (change the PINs in Admin after first login)
| Role | Username | PIN | Sees |
|---|---|---|---|
| Admin | admin | 1234 | everything, users, vehicles |
| Warehouse manager | manager | 2222 | all orders, allocate to picker, cluster, billing, delivery, dashboard |
| Picker | picker1 | 3333 | only orders allocated to him |
| Checker | checker1 | 4444 | picked orders to check |
| Biller | biller1 | 5555 | checked orders to bill, hold/unhold, billing import |
| Packer | packer1 | 6666 | billed orders to pack |
| Dispatch | dispatch1 | 7777 | billed/packed orders, delivery allocation, dispatch |

## Flow
1. Sales Tracker orders (Calls with order Trylo / C9) sync every 15 min, or "Sync now".
2. Manager allocates to picker. Picker enters picked qty (short qty shown). Checker checks. Biller enters invoice no, qty, value (or imports the Fusion ERP CSV/XLSX). Packer enters boxes. Dispatch sets mode, vehicle, payment mode, then dispatches.
3. Hold / unhold with reason at any stage before dispatch. Held orders show in Dashboard > Pending to bill with age.
4. Order screen lists nearby pending orders (same area / route / within 3 km). Cluster tab groups pending orders by area.

Tap the top title to log out.

## Done by names
At allocation the manager assigns picker, checker, biller and packer. At every step the "Done by" dropdown (users of that role + Admin > Staff names + "Other name") records who actually did the work, so one shared login per counter is fine. Names show in the timeline, order list, CSV export and efficiency table.

## Dealers, area and zone
Dealers tab (admin, manager): search, filter by zone/area, edit zone/area/route/mobile/lat/lng, bulk-set zone, CSV download/upload (id, name, area, zone, route). Area/zone can also be changed from an order. Local edits are never overwritten by the Sales Tracker sync. Cluster view and nearby orders group by zone, then area, then route.

## Hold list
Office coordinator / manager: bottom nav **Hold list**. Paste a collection list (Dealer | Reason | Brand | OS). Import matches each pasted name to a warehouse dealer by name (aliases are not used).

When Sales Tracker has **merged two or more names** for the same dealer (billing / store under two names), the Hold list shows a review flag: **Doosra naam bhi hai: combined OS …**. For that group you see each name's individual outstanding, the combined outstanding, and which names are already on the hold list. The other name is **not** auto-held. Use **Hold this too** only if you decide to add it.

Outstanding figures come from, in order: the pasted list OS, then the warehouse / Sales Tracker overdue, then net OS. If the other name was not on the pasted list, its list OS is missing and overdue is used when available (the gap is shown).

Merge groups are pulled read-only from the Sales Tracker Dealers `merged_into` field and the Merges tab, cached in **HoldMergeCache** (hold-list scope only). Refresh with **Refresh merge groups**. The 15-minute warehouse Dealers sync and auto-hold stay as they were in v27.

## Billing template

Billing > "Download template" gives `Billing_Import_Template.xlsx`; its headers map automatically. EXAMPLE rows are skipped.

## Manual orders (phone / WhatsApp / walk-in / email / salesman)
"+ New order" (admin, manager, dispatch): pick a dealer or add a new one, source, taken by, salesman, brand lines (brand, item, qty, value), remarks, expected dispatch date, priority. Manual orders are numbered W-1, W-2... (Sales Tracker orders show as ST-<id>), follow the same stages, hold and bill matching, and can be edited or cancelled (with reason) until billed. Source shows as a badge, a filter in All orders, on the dashboard and in the CSV.

## Possible duplicates
Admin / warehouse manager: Meri queue chip **⚠ Duplicates** (alongside Picking, Checking, Billing, HOLD; dealer search applies), Sab orders > **⚠ Duplicates**, the filter **⚠ Possible duplicates**, or the red badge on an order. The full list is also at `#/dup` (link from the Meri queue Duplicates summary), but it is not in the bottom nav.

The list groups likely-duplicate orders: same dealer, overlapping brand or item or similar qty/amount, order dates within Settings `dup_days` (default 2). This includes two open (not yet billed) orders, and a billed order paired with a still-open one. Two billed orders are not flagged. Any source (Sales Tracker, warehouse W-, store, phone). Set Settings `dup_st_only` to 1 to go back to only Sales Tracker vs warehouse pairs.

**Merge selected** (2+ open orders, only before billing): choose which order to keep. Other orders become "Merge ho gaya" (not deleted, hidden from queues, src_id kept so sync does not re-import). Default is to combine lines. If one order is already billed, Merge is hidden; use **Cancel as duplicate of &lt;billed order&gt;** on the open one (same merged stage and audit note, no pcs added). Admin only can also **Delete duplicate** for that unbilled order (confirm shows the order number). The billed/invoiced order is never deleted; the open one is archived to DeletedOrders (src_id tombstone so Sales Tracker sync does not re-import it) and removed from Orders/queues.

After a dealer search in Meri queue, admin / warehouse manager can select 2+ orders and tap **Mark duplicate** to create a manual group on this tab (stored in the backend). "Not duplicate" hides an auto or manual group forever.

## Order SLA
Every order must be billed within `sla_hours` of being received (Sales Tracker visit time, or create time for in-app orders). After `cutoff_time`, before `open_time`, and on holidays / weekly off the deadline moves as per the Settings tab. Managers can mark "Waiting for purchase - <brand>" on an order, and record "Purchase aaya" (Dashboard > 📦) to give pending orders of that brand a new deadline. Dashboard shows On time / Due soon / Delayed / Waiting for stock, delayed report and on-time % by day.

## Pending leftover (old order)
When a dealer's earlier order was only partly fulfilled (short pick / billed less than ordered), the leftover quantity stays on **that old order**. Do not raise a new order just to execute that pending.

Warehouse manager (or admin): tap the **dealer name** in Meri queue, review orders with leftover pending, open the order, tap **Pending executed**, enter the leftover qty and assign a **picker**. That same order (leftover lines only) goes back to the picking stage of Meri queue, then through checking and billing as usual. Each cycle is logged (date, qty, picker, and the bill no once billed). Remaining pending reduces after pick/bill; at zero the order is marked **Pending complete**. The original invoice / first pick is not overwritten. Execution history is on the order page.

Meri queue also has a **Pending leftover** chip (includes already dispatched orders). If a new order arrives for a dealer who still has older leftover pending, a warning is shown on the queue card, the order page, and New order. This is separate from **Pending for billing** (orders not yet billed).

Frontend sw **im-warehouse-v31**. Backend schema **20** (`PendingExec` tab).
