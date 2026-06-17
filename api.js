// Wrapper around the SokoFresh API. Backend runs on its own origin.
// In production, change API_BASE to your deployed backend URL.
// Wrapper around the SokoFresh API. Backend runs on its own origin.
const API_BASE = 'https://your-ngrok-url.ngrok-free.dev';

const API = {
  token: localStorage.getItem('sf_token') || null,

  setToken(t) {
    this.token = t;
    if (t) localStorage.setItem('sf_token', t);
    else localStorage.removeItem('sf_token');
  },

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(API_BASE + '/api' + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }

    if (!res.ok) {
      const msg =
        (data && data.error) ||
        (data && Array.isArray(data.errors) && data.errors.join(' ')) ||
        `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  // Auth
  register(body) { return this.request('POST', '/auth/register', body); },
  login(body) { return this.request('POST', '/auth/login', body); },
  me() { return this.request('GET', '/auth/me'); },

  // Products
  catalog(params) {
    const q = params && Object.keys(params).length ? '?' + new URLSearchParams(params) : '';
    return this.request('GET', '/products' + q);
  },
  myProducts() { return this.request('GET', '/products/mine'); },
  createProduct(body) { return this.request('POST', '/products', body); },
  updateProduct(id, body) { return this.request('PATCH', '/products/' + id, body); },
  deleteProduct(id) { return this.request('DELETE', '/products/' + id); },

  // Orders
  checkout(items) { return this.request('POST', '/orders', { items }); },
  myOrders() { return this.request('GET', '/orders/mine'); },
  incomingOrders() { return this.request('GET', '/orders/incoming'); },
  updateOrderStatus(id, status) { return this.request('PATCH', `/orders/${id}/status`, { status }); },

  // Payments (M-Pesa)
  payStk(orderId, phone) { return this.request('POST', '/payments/stk', { orderId, phone }); },
  paymentStatus(orderId) { return this.request('GET', '/payments/status/' + orderId); },
};