/* global API */

// ---------- State ----------
const state = {
  user: null,
  view: 'marketplace',
  catalog: [],
  category: 'All',
  search: '',
  qty: {}, // transient per-product quantity on cards
  cart: [], // { productId, name, vendor, pricePerKg, quantityKg }
  editingId: null,
};

const CATEGORIES = ['Vegetables', 'Fruits', 'Tubers', 'Grains'];
const app = document.getElementById('app');

// ---------- Helpers ----------
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(n) { return 'KES ' + Number(n || 0).toLocaleString('en-KE'); }

function toast(msg, type = '') {
  const wrap = document.getElementById('toast-wrap');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function vendorName(p) {
  return (p.vendor && (p.vendor.businessName || p.vendor.name)) || 'SokoFresh Vendor';
}

// ===================================================================
//  AUTH
// ===================================================================
function renderAuth(mode = 'register') {
  let role = 'BUYER';

  app.innerHTML = `
    <div class="auth">
      <div class="auth-hero">
        <div class="brand" style="position:absolute;top:48px;left:60px"><b>SokoFresh</b></div>
        <div class="quote">
          <h1>Direct from farm to your kitchen.</h1>
          <p>SokoFresh connects premium local growers with high-end commercial kitchens through a transparent, cooling-verified supply chain.</p>
          <div class="stats">
            <div><b>500+</b><small>Certified Farmers</small></div>
            <div><b>24h</b><small>Delivery Window</small></div>
          </div>
        </div>
      </div>
      <div class="auth-form">
        <div class="brand" style="margin-bottom:30px"><b>SokoFresh</b><small>PRIVATE EXCHANGE</small></div>
        <h2 id="auth-title"></h2>
        <p id="auth-sub"></p>
        <div class="form-err" id="auth-err"></div>
        <div id="auth-fields"></div>
        <button class="btn" id="auth-submit" style="width:100%;margin-top:6px"></button>
        <div class="auth-toggle" id="auth-toggle"></div>
      </div>
    </div>`;

  const fields = document.getElementById('auth-fields');
  const title = document.getElementById('auth-title');
  const sub = document.getElementById('auth-sub');
  const submit = document.getElementById('auth-submit');
  const toggle = document.getElementById('auth-toggle');
  const errBox = document.getElementById('auth-err');

  function paint() {
    errBox.textContent = '';
    if (mode === 'register') {
      title.textContent = 'Create your account';
      sub.textContent = 'Join the community driving temperature-controlled agriculture forward.';
      submit.textContent = 'Join the Private Exchange';
      toggle.innerHTML = `Already trading? <button data-go="login">Sign in</button>`;
      fields.innerHTML = `
        <div class="field">
          <label>I am joining as a</label>
          <div class="role-pick">
            <div class="role-opt ${role === 'BUYER' ? 'active' : ''}" data-role="BUYER"><div class="ic">🍴</div><b>Commercial Buyer</b></div>
            <div class="role-opt ${role === 'VENDOR' ? 'active' : ''}" data-role="VENDOR"><div class="ic">🚜</div><b>Vendor / Farmer</b></div>
          </div>
        </div>
        <div class="field-row">
          <div class="field"><label>First Name</label><input id="f-first" placeholder="Jane" /></div>
          <div class="field"><label>Last Name</label><input id="f-last" placeholder="Doe" /></div>
        </div>
        <div class="field"><label id="bn-label">Business / Restaurant Name</label><input id="f-biz" placeholder="Bistro Vert" /></div>
        <div class="field"><label>Business Email Address</label><input id="f-email" type="email" placeholder="jane@kitchen.com" /></div>
        <div class="field"><label>Secure Password</label><input id="f-pass" type="password" placeholder="At least 8 characters" /></div>`;
    } else {
      title.textContent = 'Welcome back';
      sub.textContent = 'Sign in to your SokoFresh exchange account.';
      submit.textContent = 'Sign In';
      toggle.innerHTML = `New here? <button data-go="register">Create an account</button>`;
      fields.innerHTML = `
        <div class="field"><label>Business Email Address</label><input id="f-email" type="email" placeholder="jane@kitchen.com" /></div>
        <div class="field"><label>Secure Password</label><input id="f-pass" type="password" placeholder="Your password" /></div>`;
    }
  }
  paint();

  app.addEventListener('click', async (e) => {
    const roleEl = e.target.closest('[data-role]');
    if (roleEl) { role = roleEl.dataset.role; paint(); return; }
    const goEl = e.target.closest('[data-go]');
    if (goEl) { mode = goEl.dataset.go; paint(); return; }
  });

  submit.addEventListener('click', async () => {
    errBox.textContent = '';
    const email = document.getElementById('f-email').value.trim();
    const password = document.getElementById('f-pass').value;
    submit.disabled = true;
    submit.innerHTML = '<span class="spinner"></span>';
    try {
      let res;
      if (mode === 'register') {
        res = await API.register({
          firstName: document.getElementById('f-first').value.trim(),
          lastName: document.getElementById('f-last').value.trim(),
          businessName: document.getElementById('f-biz').value.trim() || undefined,
          email, password, role,
        });
      } else {
        res = await API.login({ email, password });
      }
      API.setToken(res.token);
      state.user = res.user;
      enterApp();
    } catch (err) {
      errBox.textContent = err.message;
      submit.disabled = false;
      submit.textContent = mode === 'register' ? 'Join the Private Exchange' : 'Sign In';
    }
  });
}

// ===================================================================
//  APP SHELL
// ===================================================================
function enterApp() {
  state.view = state.user.role === 'VENDOR' ? 'inventory' : 'marketplace';
  mountChrome();
  showView(state.view);
}

function mountChrome() {
  const u = state.user;
  const tabs = u.role === 'BUYER'
    ? `<button class="nav-tab" data-action="goto" data-view="marketplace">Marketplace Catalog</button>
       <button class="nav-tab" data-action="goto" data-view="orders">Order Tracking</button>`
    : u.role === 'VENDOR'
      ? `<button class="nav-tab" data-action="goto" data-view="inventory">My Inventory</button>
         <button class="nav-tab" data-action="goto" data-view="vendor-orders">Incoming Orders</button>`
      : `<button class="nav-tab" data-action="goto" data-view="admin">Fulfillment</button>`;

  app.innerHTML = `
    <div class="nav">
      <div class="brand"><b>SokoFresh</b><small>PRIVATE EXCHANGE</small></div>
      <div class="nav-tabs">${tabs}</div>
      <div class="nav-right">
        <span class="role-pill">Role: ${esc(u.role[0] + u.role.slice(1).toLowerCase())}</span>
        ${u.role === 'BUYER' ? `<button class="cart-btn" data-action="open-cart">🛒<span class="cart-count hidden" id="cart-count">0</span></button>` : ''}
        <div class="who"><b>${esc(u.name)}</b><small>${esc(u.businessName || '')}</small></div>
        <button class="btn ghost sm" data-action="logout">Sign out</button>
      </div>
    </div>
    <main class="wrap" id="view"></main>
    <div class="overlay" id="overlay" data-action="close-cart"></div>
    <aside class="drawer" id="drawer"></aside>`;

  app.addEventListener('click', onAppClick);
  renderCart();
}

function setActiveTab() {
  document.querySelectorAll('.nav-tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.view === state.view));
}

function showView(view) {
  state.view = view;
  setActiveTab();
  if (view === 'marketplace') return renderMarketplace();
  if (view === 'orders') return renderOrders();
  if (view === 'inventory') return renderInventory();
  if (view === 'vendor-orders') return renderVendorOrders();
  if (view === 'admin') return renderAdmin();
}

// ---------- Delegated clicks ----------
async function onAppClick(e) {
  const a = e.target.closest('[data-action]');
  if (!a) return;
  const act = a.dataset.action;

  if (act === 'goto') return showView(a.dataset.view);
  if (act === 'logout') { API.setToken(null); state.user = null; state.cart = []; renderAuth('login'); location.reload(); return; }
  if (act === 'open-cart') return openCart();
  if (act === 'close-cart') return closeCart();
  if (act === 'set-cat') { state.category = a.dataset.cat; renderGrid(); document.querySelectorAll('.cat').forEach((c) => c.classList.toggle('active', c.dataset.cat === state.category)); return; }
  if (act === 'step') { stepQty(a.dataset.id, a.dataset.dir === 'up' ? 1 : -1); return; }
  if (act === 'add-cart') return addToCart(a.dataset.id);
  if (act === 'cart-step') { cartStep(a.dataset.id, a.dataset.dir === 'up' ? 1 : -1); return; }
  if (act === 'cart-remove') { state.cart = state.cart.filter((c) => c.productId !== a.dataset.id); renderCart(); return; }
  if (act === 'checkout') return doCheckout();
  if (act === 'edit-product') return startEdit(a.dataset.id);
  if (act === 'cancel-edit') { state.editingId = null; renderInventory(); return; }
  if (act === 'delete-product') return deleteProduct(a.dataset.id);
  if (act === 'set-status') return setOrderStatus(a.dataset.id, a.dataset.status);
}

// ===================================================================
//  MARKETPLACE  (buyer)
// ===================================================================
async function renderMarketplace() {
  const view = document.getElementById('view');
  view.innerHTML = `
    <div class="page-head">
      <div class="crumbs">Marketplace / <b>All Produce</b></div>
      <h1>Fresh Produce Exchange</h1>
      <p>High-quality harvest with cold-storage verified freshness. Listed in Kenyan Shillings (KES).</p>
    </div>
    <div class="layout">
      <div class="panel">
        <h3>Categories</h3>
        <button class="cat ${state.category === 'All' ? 'active' : ''}" data-action="set-cat" data-cat="All">All Produce</button>
        ${CATEGORIES.map((c) => `<button class="cat ${state.category === c ? 'active' : ''}" data-action="set-cat" data-cat="${c}">${c}</button>`).join('')}
      </div>
      <div>
        <input class="search" id="search" placeholder="Search harvest crop, farm origin, or location…" value="${esc(state.search)}" />
        <div class="grid" id="grid"><div class="loading">Loading catalog…</div></div>
      </div>
    </div>`;

  document.getElementById('search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderGrid();
  });

  try {
    state.catalog = await API.catalog();
    renderGrid();
  } catch (err) {
    document.getElementById('grid').innerHTML = `<div class="empty">Could not load catalog: ${esc(err.message)}</div>`;
  }
}

function filteredCatalog() {
  const s = state.search.trim().toLowerCase();
  return state.catalog.filter((p) => {
    if (state.category !== 'All' && p.category !== state.category) return false;
    if (s && !(`${p.name} ${vendorName(p)} ${p.category}`.toLowerCase().includes(s))) return false;
    return true;
  });
}

function renderGrid() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  const items = filteredCatalog();
  if (!items.length) { grid.innerHTML = `<div class="empty">No produce matches your filters.</div>`; return; }

  grid.innerHTML = items.map((p) => {
    const q = state.qty[p.id] || 1;
    const out = p.stockKg <= 0;
    return `
      <div class="card">
        <div class="card-top">
          <span class="leaf">${esc(p.name[0] || '🌿')}</span>
          <span class="origin">${esc(vendorName(p))}</span>
        </div>
        <div class="card-body">
          <div class="row1">
            <h3>${esc(p.name)}</h3>
            <span class="price">${money(p.pricePerKg)} <small>/kg</small></span>
          </div>
          <div class="stock ${out ? 'out' : ''}">${out ? 'Out of stock' : p.stockKg + ' kg available'}</div>
          <div class="card-foot">
            <div class="stepper">
              <button data-action="step" data-id="${p.id}" data-dir="down">−</button>
              <span>${q}</span>
              <button data-action="step" data-id="${p.id}" data-dir="up">+</button>
            </div>
            <button class="btn sm" style="flex:1" data-action="add-cart" data-id="${p.id}" ${out ? 'disabled' : ''}>Add to Cart</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function stepQty(id, delta) {
  const p = state.catalog.find((x) => x.id === id);
  const max = p ? Math.max(1, Math.floor(p.stockKg)) : 999;
  const cur = state.qty[id] || 1;
  state.qty[id] = Math.min(max, Math.max(1, cur + delta));
  renderGrid();
}

function addToCart(id) {
  const p = state.catalog.find((x) => x.id === id);
  if (!p) return;
  const qty = state.qty[id] || 1;
  const existing = state.cart.find((c) => c.productId === id);
  if (existing) existing.quantityKg += qty;
  else state.cart.push({ productId: id, name: p.name, vendor: vendorName(p), pricePerKg: p.pricePerKg, quantityKg: qty });
  state.qty[id] = 1;
  renderGrid();
  renderCart();
  toast(`${qty} kg ${p.name} added to cart`, 'ok');
}

// ===================================================================
//  CART
// ===================================================================
function cartTotal() { return state.cart.reduce((s, c) => s + c.pricePerKg * c.quantityKg, 0); }

function renderCart() {
  const drawer = document.getElementById('drawer');
  if (!drawer) return;
  const count = state.cart.reduce((s, c) => s + 1, 0);
  const badge = document.getElementById('cart-count');
  if (badge) { badge.textContent = count; badge.classList.toggle('hidden', count === 0); }

  const body = state.cart.length
    ? state.cart.map((c) => `
        <div class="cart-line">
          <div class="info">
            <b>${esc(c.name)}</b>
            <small>${esc(c.vendor)} · ${money(c.pricePerKg)}/kg</small>
          </div>
          <div class="stepper">
            <button data-action="cart-step" data-id="${c.productId}" data-dir="down">−</button>
            <span>${c.quantityKg}</span>
            <button data-action="cart-step" data-id="${c.productId}" data-dir="up">+</button>
          </div>
          <button class="btn danger sm" data-action="cart-remove" data-id="${c.productId}">✕</button>
        </div>`).join('')
    : `<div class="empty">Your cart is empty.<br />Add produce from the marketplace.</div>`;

  drawer.innerHTML = `
    <div class="drawer-head"><h2>Your Cart</h2><button class="btn ghost sm" data-action="close-cart">Close</button></div>
    <div class="drawer-body">${body}</div>
    <div class="drawer-foot">
      <div class="total-row"><span>Order total</span><b>${money(cartTotal())}</b></div>
      <button class="btn" style="width:100%" data-action="checkout" ${state.cart.length ? '' : 'disabled'}>Place Order</button>
    </div>`;
}

function cartStep(id, delta) {
  const c = state.cart.find((x) => x.productId === id);
  if (!c) return;
  c.quantityKg = Math.max(1, c.quantityKg + delta);
  renderCart();
}

function openCart() { document.getElementById('overlay').classList.add('open'); document.getElementById('drawer').classList.add('open'); }
function closeCart() { document.getElementById('overlay').classList.remove('open'); document.getElementById('drawer').classList.remove('open'); }

async function doCheckout() {
  const btn = document.querySelector('[data-action="checkout"]');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    const items = state.cart.map((c) => ({ productId: c.productId, quantityKg: c.quantityKg }));
    const order = await API.checkout(items); // backend returns the created order
    state.cart = [];
    renderCart();
    closeCart();
    openPayment(order);
  } catch (err) {
    toast(err.message, 'err');
    btn.disabled = false; btn.textContent = 'Place Order';
  }
}

// ===================================================================
//  PAYMENT  (M-Pesa STK push)
// ===================================================================
function openPayment(order) {
  const wrap = document.createElement('div');
  wrap.className = 'overlay open';
  wrap.id = 'pay-overlay';
  wrap.innerHTML = `
    <div class="modal">
      <h2>Pay with M-Pesa</h2>
      <p>Order total <b>${money(order.totalPrice)}</b></p>
      <div class="form-err" id="pay-err"></div>
      <div class="field">
        <label>M-Pesa Phone Number</label>
        <input id="pay-phone" placeholder="0712 345 678" />
      </div>
      <button class="btn" id="pay-go" style="width:100%">Send STK Push</button>
      <div id="pay-status" class="pay-status"></div>
      <button class="btn ghost sm" id="pay-skip" style="width:100%;margin-top:12px">Pay later</button>
    </div>`;
  document.body.appendChild(wrap);

  const close = () => wrap.remove();
  wrap.querySelector('#pay-skip').addEventListener('click', () => { close(); showView('orders'); });

  wrap.querySelector('#pay-go').addEventListener('click', async () => {
    const phone = wrap.querySelector('#pay-phone').value.trim();
    const errEl = wrap.querySelector('#pay-err'); errEl.textContent = '';
    const statusEl = wrap.querySelector('#pay-status');
    const goBtn = wrap.querySelector('#pay-go');
    if (!phone) { errEl.textContent = 'Enter your M-Pesa phone number.'; return; }
    goBtn.disabled = true; goBtn.innerHTML = '<span class="spinner"></span>';
    try {
      await API.payStk(order.id, phone);
      statusEl.innerHTML = '<span class="spinner"></span> Check your phone and enter your M-Pesa PIN…';
      pollPayment(order.id, statusEl, close, goBtn);
    } catch (err) {
      errEl.textContent = err.message;
      goBtn.disabled = false; goBtn.textContent = 'Send STK Push';
    }
  });
}

function pollPayment(orderId, statusEl, close, goBtn) {
  let tries = 0;
  const timer = setInterval(async () => {
    tries++;
    try {
      const s = await API.paymentStatus(orderId);
      if (s.paid) {
        clearInterval(timer);
        statusEl.innerHTML = '✅ Payment received! Receipt: ' + (s.mpesaReceipt || '—');
        toast('Payment confirmed', 'ok');
        setTimeout(() => { close(); showView('orders'); }, 1600);
        return;
      }
      if (s.status === 'CANCELLED') {
        clearInterval(timer);
        statusEl.textContent = '❌ Payment failed or was cancelled.';
        goBtn.disabled = false; goBtn.textContent = 'Try again';
        return;
      }
    } catch (e) { /* keep polling */ }
    if (tries >= 20) { // ~60s
      clearInterval(timer);
      statusEl.textContent = 'Still pending — if you paid it will update shortly. Check Order Tracking.';
    }
  }, 3000);
}

// ===================================================================
//  ORDER TRACKING  (buyer)
// ===================================================================
async function renderOrders() {
  const view = document.getElementById('view');
  view.innerHTML = `
    <div class="page-head">
      <div class="crumbs">Orders / <b>Tracking</b></div>
      <h1>Shipment Tracking</h1>
      <p>Follow each order through the fulfillment pipeline.</p>
    </div>
    <div id="orders"><div class="loading">Loading orders…</div></div>`;

  try {
    const orders = await API.myOrders();
    const box = document.getElementById('orders');
    if (!orders.length) { box.innerHTML = `<div class="empty">No orders yet. Place one from the marketplace.</div>`; return; }
    box.innerHTML = orders.map((o) => {
      const items = o.items.map((i) => `${i.quantityKg}kg ${esc(i.product ? i.product.name : 'item')}`).join(', ');
      const date = new Date(o.createdAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
      const payment = o.paid
        ? `✅ Paid${o.mpesaReceipt ? ' · ' + esc(o.mpesaReceipt) : ''}`
        : '⏳ Unpaid';
      return `
        <div class="order">
          <div class="order-head">
            <span class="oid">Order ${esc(o.id.slice(0, 8).toUpperCase())}</span>
            <span class="badge ${o.status}">${o.status}</span>
          </div>
          <div class="order-items">${items}</div>
          <div class="order-foot">
            <span class="date">${date} · ${payment}</span>
            <span class="ot">${money(o.totalPrice)}</span>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    document.getElementById('orders').innerHTML = `<div class="empty">Could not load orders: ${esc(err.message)}</div>`;
  }
}

// ===================================================================
//  VENDOR INVENTORY
// ===================================================================
async function renderInventory() {
  const view = document.getElementById('view');
  view.innerHTML = `
    <div class="page-head">
      <div class="crumbs">Vendor / <b>Inventory</b></div>
      <h1>Manage Your Batches</h1>
      <p>Create and maintain the produce batches buyers can order.</p>
    </div>
    <div class="layout">
      <div class="panel">
        <h3 id="form-title">${state.editingId ? 'Edit Batch' : 'New Batch'}</h3>
        <div class="form-err" id="inv-err"></div>
        <div class="field"><label>Produce Name</label><input id="p-name" placeholder="Russet Potatoes" /></div>
        <div class="field"><label>Category</label>
          <select id="p-cat">${CATEGORIES.map((c) => `<option>${c}</option>`).join('')}</select>
        </div>
        <div class="field-row">
          <div class="field"><label>Price / kg (KES)</label><input id="p-price" type="number" min="1" placeholder="85" /></div>
          <div class="field"><label>Stock (kg)</label><input id="p-stock" type="number" min="0" placeholder="500" /></div>
        </div>
        <button class="btn" style="width:100%" id="p-save">${state.editingId ? 'Update Batch' : 'Add Batch'}</button>
        ${state.editingId ? `<button class="btn ghost sm" style="width:100%;margin-top:10px" data-action="cancel-edit">Cancel</button>` : ''}
      </div>
      <div class="panel">
        <h3>Your Catalog</h3>
        <div id="inv-table"><div class="loading">Loading…</div></div>
      </div>
    </div>`;

  document.getElementById('p-save').addEventListener('click', saveProduct);

  try {
    const products = await API.myProducts();
    state._mine = products;
    const tbl = document.getElementById('inv-table');
    if (!products.length) { tbl.innerHTML = `<div class="empty">No batches yet. Add your first on the left.</div>`; return; }
    tbl.innerHTML = `
      <table class="tbl">
        <thead><tr><th>Name</th><th>Category</th><th>Price/kg</th><th>Stock</th><th></th></tr></thead>
        <tbody>${products.map((p) => `
          <tr>
            <td><b>${esc(p.name)}</b></td>
            <td>${esc(p.category)}</td>
            <td>${money(p.pricePerKg)}</td>
            <td>${p.stockKg} kg</td>
            <td class="acts">
              <button class="btn ghost sm" data-action="edit-product" data-id="${p.id}">Edit</button>
              <button class="btn danger sm" data-action="delete-product" data-id="${p.id}">Delete</button>
            </td>
          </tr>`).join('')}</tbody>
      </table>`;
  } catch (err) {
    document.getElementById('inv-table').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }

  if (state.editingId && state._editData) {
    const d = state._editData;
    document.getElementById('p-name').value = d.name;
    document.getElementById('p-cat').value = d.category;
    document.getElementById('p-price').value = d.pricePerKg;
    document.getElementById('p-stock').value = d.stockKg;
  }
}

function startEdit(id) {
  const p = (state._mine || []).find((x) => x.id === id);
  if (!p) return;
  state.editingId = id;
  state._editData = p;
  renderInventory();
}

async function saveProduct() {
  const errBox = document.getElementById('inv-err');
  errBox.textContent = '';
  const body = {
    name: document.getElementById('p-name').value.trim(),
    category: document.getElementById('p-cat').value,
    pricePerKg: parseFloat(document.getElementById('p-price').value),
    stockKg: parseFloat(document.getElementById('p-stock').value),
  };
  const btn = document.getElementById('p-save');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    if (state.editingId) await API.updateProduct(state.editingId, body);
    else await API.createProduct(body);
    toast(state.editingId ? 'Batch updated' : 'Batch added', 'ok');
    state.editingId = null;
    state._editData = null;
    renderInventory();
  } catch (err) {
    errBox.textContent = err.message;
    btn.disabled = false; btn.textContent = state.editingId ? 'Update Batch' : 'Add Batch';
  }
}

async function deleteProduct(id) {
  if (!confirm('Delete this batch? This cannot be undone.')) return;
  try {
    await API.deleteProduct(id);
    toast('Batch deleted', 'ok');
    renderInventory();
  } catch (err) {
    toast(err.message, 'err');
  }
}

// ===================================================================
//  VENDOR INCOMING ORDERS  (fulfillment)
// ===================================================================
async function renderVendorOrders() {
  const view = document.getElementById('view');
  view.innerHTML = `
    <div class="page-head">
      <div class="crumbs">Vendor / <b>Incoming Orders</b></div>
      <h1>Incoming Orders</h1>
      <p>Orders containing your produce. Advance each through fulfillment.</p>
    </div>
    <div id="vorders"><div class="loading">Loading…</div></div>`;
  try {
    const orders = await API.incomingOrders();
    const box = document.getElementById('vorders');
    if (!orders.length) { box.innerHTML = `<div class="empty">No incoming orders yet.</div>`; return; }

    const NEXT = {
      PENDING: [['DISPATCHED', 'Mark Dispatched'], ['CANCELLED', 'Cancel']],
      DISPATCHED: [['DELIVERED', 'Mark Delivered'], ['CANCELLED', 'Cancel']],
      DELIVERED: [], CANCELLED: [],
    };

    box.innerHTML = orders.map((o) => {
      const lines = o.items.map((i) => `${i.quantityKg}kg ${esc(i.product ? i.product.name : 'item')}`).join(', ');
      const buyer = o.buyer ? (o.buyer.businessName || o.buyer.name) : 'Buyer';
      const buttons = (NEXT[o.status] || []).map(([s, label]) =>
        `<button class="btn ${s === 'CANCELLED' ? 'danger' : ''} sm" data-action="set-status" data-id="${o.id}" data-status="${s}">${label}</button>`).join('');
      const payment = o.paid
        ? `✅ Paid${o.mpesaReceipt ? ' · ' + esc(o.mpesaReceipt) : ''}`
        : '⏳ Unpaid';
      return `
        <div class="order">
          <div class="order-head">
            <span class="oid">Order ${esc(o.id.slice(0, 8).toUpperCase())}</span>
            <span class="badge ${o.status}">${o.status}</span>
          </div>
          <div class="order-items">${esc(buyer)} · ${lines}</div>
          <div class="order-foot">
            <span class="date">${payment}</span>
            <span class="ot">${money(o.totalPrice)}</span>
          </div>
          ${buttons ? `<div style="display:flex;gap:8px;margin-top:14px">${buttons}</div>` : ''}
        </div>`;
    }).join('');
  } catch (err) {
    document.getElementById('vorders').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

async function setOrderStatus(id, status) {
  try {
    await API.updateOrderStatus(id, status);
    toast('Order marked ' + status.toLowerCase(), 'ok');
    renderVendorOrders();
  } catch (err) {
    toast(err.message, 'err');
  }
}

// ===================================================================
//  ADMIN (minimal — set order status by ID)
// ===================================================================
function renderAdmin() {
  const view = document.getElementById('view');
  view.innerHTML = `
    <div class="page-head">
      <div class="crumbs">Admin / <b>Fulfillment</b></div>
      <h1>Order Status Control</h1>
      <p>Move an order through the fulfillment pipeline. Paste an Order ID to advance its state.</p>
    </div>
    <div class="panel" style="max-width:560px">
      <div class="form-err" id="adm-err"></div>
      <div class="field"><label>Order ID</label><input id="adm-id" placeholder="full order UUID" /></div>
      <div class="field"><label>New Status</label>
        <select id="adm-status">
          <option>DISPATCHED</option><option>DELIVERED</option><option>CANCELLED</option><option>PENDING</option>
        </select>
      </div>
      <button class="btn" id="adm-save" style="width:100%">Update Status</button>
    </div>`;
  document.getElementById('adm-save').addEventListener('click', async () => {
    const err = document.getElementById('adm-err'); err.textContent = '';
    try {
      const o = await API.updateOrderStatus(document.getElementById('adm-id').value.trim(), document.getElementById('adm-status').value);
      toast(`Order now ${o.status}`, 'ok');
    } catch (e) { err.textContent = e.message; }
  });
}

// ===================================================================
//  BOOT
// ===================================================================
async function init() {
  if (!API.token) return renderAuth('register');
  try {
    const { user } = await API.me();
    state.user = user;
    enterApp();
  } catch {
    API.setToken(null);
    renderAuth('login');
  }
}

init();