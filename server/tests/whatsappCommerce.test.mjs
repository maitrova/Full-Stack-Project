import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as crypto from 'node:crypto';

// Isolated contract tests: no MongoDB connection or real cart writes.
async function setup() {
  const handlers = new Map();
  const middleware = [];
  const receipts = new Map();
  const checkoutRequests = new Map();
  let additions = 0;
  let stock = 3;
  let orderFilter;
  let orderIdFilter;
  let linkedUser = 'owner';
  const router = {
    post: (path, ...fns) => handlers.set('POST ' + path, fns),
    get: (path, ...fns) => handlers.set('GET ' + path, fns),
    delete: (path, ...fns) => handlers.set('DELETE ' + path, fns),
    use: fn => middleware.push(fn),
  };
  const collection = {
    findOne: async ({_id}) => receipts.get(_id),
    insertOne: async doc => {
      if (receipts.has(doc._id)) throw Object.assign(new Error('duplicate'), {code: 11000});
      receipts.set(doc._id, {...doc});
    },
    updateOne: async ({_id}, update) => Object.assign(receipts.get(_id), update.$set),
  };
  const checkoutCollection = {
    createIndex: async () => {},
    insertOne: async doc => { checkoutRequests.set(doc._id, {...doc}); },
    findOneAndUpdate: async ({_id, expiresAt, $or}, update) => {
      const record = checkoutRequests.get(_id);
      if (!record || record.expiresAt <= expiresAt.$gt) return null;
      if (record.consumed_by && record.consumed_by !== $or[1].consumed_by) return null;
      Object.assign(record, update.$set);
      return record;
    },
  };
  const linkCollection = {
    findOne: async () => linkedUser ? {user: linkedUser} : null,
    updateOne: async (_query, update) => { linkedUser = update.$set.user; },
    deleteMany: async () => {},
  };
  const subscriptions = new Map();
  const subscriptionCollection = {
    updateOne: async (query, update) => subscriptions.set(query._id, {...(subscriptions.get(query._id) || {}), ...update.$set}),
    updateMany: async () => {},
  };
  const rateLimitCounts = new Map();
  const rateLimitCollection = {
    findOneAndUpdate: async ({_id}, update) => {
      const count = (rateLimitCounts.get(_id) || 0) + Number(update.$inc?.count || 0);
      rateLimitCounts.set(_id, count);
      return {_id, count};
    },
  };
  const stubs = {
    express: {default: {Router: () => router}},
    mongoose: {default: {
      isValidObjectId: value => /^[a-f0-9]{24}$/.test(value),
      connection: {db: {collection: name => {
        if (name === 'whatsapp_cart_operations') return collection;
        if (name === 'whatsapp_link_requests') return checkoutCollection;
        if (name === 'whatsapp_account_links') return linkCollection;
        if (name === 'whatsapp_order_subscriptions') return subscriptionCollection;
        if (name === 'whatsapp_commerce_rate_limits') return rateLimitCollection;
        return {deleteMany: async () => {}, insertOne: async () => {}};
      }}},
    }},
    crypto,
    '../middleware/authMiddleware.js': {protect: () => {}},
    '../models/authmodel.js': {default: {findById: id => ({select: async () => ({_id: id})})}},
    '../models/Order.js': {default: {find: query => {
      orderFilter = query;
      return {sort: () => ({limit: () => ({select: () => ({lean: async () => []})})})};
    }, findOne: query => {
      orderIdFilter = query;
      return {select: () => ({lean: async () => ({_id: query._id, orderStatus: 'SHIPPED'})})};
    }}},
    '../models/readymadeproducts.js': {default: {findOne: () => ({lean: async () => ({variants: [{size: 'M', stock}]})})}},
    '../utils/readymadePricing.js': {getReadymadePricing: () => ({effectivePrice: 120})},
    '../controllers/cartController.js': {addToCart: async (req, res) => {additions++; res.status(201).json({message: 'Added'});}},
  };
  const context = vm.createContext({Buffer, URL, process: {env: {WHATSAPP_COMMERCE_KEY: 'test-only', ECOMMERCE_STOREFRONT_URL: 'https://shop.example'}}, Date});
  const source = await readFile(new URL('../routes/whatsappCommerce.js', import.meta.url), 'utf8');
  const module = new vm.SourceTextModule(source, {context});
  await module.link(specifier => {
    const values = stubs[specifier];
    return new vm.SyntheticModule(Object.keys(values), function() {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, {context});
  });
  await module.evaluate();
  const response = () => ({code: 200, status(code) {this.code = code; return this;}, json(body) {this.body = body; return this;}, sendStatus(code) {this.code = code; return this;}, set() {return this;}});
  const request = () => ({user: {_id: 'owner'}, body: {product_id: 'a'.repeat(24), size: 'M', quantity: 2, expected_price: 120, operation_id: 'b'.repeat(32)}});
  const seedCheckout = (token, document) => {
    const id = crypto.createHash('sha256').update(token).digest('hex');
    checkoutRequests.set(id, {_id: id, expiresAt: new Date(Date.now() + 60000), ...document});
  };
  return {handlers, middleware, response, request, additions: () => additions, seedCheckout, checkoutRequests, setStock: v => stock = v, setLinked: v => linkedUser = v, orderFilter: () => orderFilter, orderIdFilter: () => orderIdFilter, subscriptions};
}

test('cart retry replays receipt, including after stock changes', async () => {
  const s = await setup();
  const cart = s.handlers.get('POST /cart')[0];
  const first = s.response();
  await cart(s.request(), first);
  assert.equal(first.code, 201);
  s.setStock(0);
  const retry = s.response();
  await cart(s.request(), retry);
  assert.equal(retry.code, 201);
  assert.equal(s.additions(), 1);
});

test('stock and changed quotes cannot mutate carts', async () => {
  const s = await setup();
  const cart = s.handlers.get('POST /cart')[0];
  const req = s.request();
  req.body.expected_price = 100;
  const res = s.response();
  await cart(req, res);
  assert.equal(res.code, 409);
  s.setStock(0);
  await cart(s.request(), s.response());
  assert.equal(s.additions(), 0);
});

test('secret and linked account required; orders scoped to linked user', async () => {
  const s = await setup();
  const denied = s.response();
  await s.middleware[0]({headers: {}}, denied, () => assert.fail('unauthorized'));
  assert.equal(denied.code, 401);
  const req = {headers: {'x-whatsapp-account': 'a'.repeat(64)}};
  await s.middleware[1](req, s.response(), () => {});
  await s.handlers.get('GET /orders')[0](req, s.response());
  assert.equal(s.orderFilter().user, 'owner');
  s.setLinked(null);
  const expired = s.response();
  await s.middleware[1](req, expired, () => assert.fail('expired link'));
  assert.equal(expired.code, 401);
});

test('one-tap link connects the account and adds the confirmed cart item once', async () => {
  const s = await setup();
  const token = 'a'.repeat(43);
  s.seedCheckout(token, {
    account: 'c'.repeat(64),
    recipient: '919876543210',
    return_path: '/checkout',
    purchase: {product_id: 'd'.repeat(24), size: 'M', quantity: 1, expected_price: 120, operation_id: 'e'.repeat(32)},
  });
  const complete = s.handlers.get('POST /link/complete')[1];
  const req = {user: {_id: 'owner'}, body: {token}};
  const first = s.response();

  await complete(req, first);

  assert.equal(first.code, 201);
  assert.equal(first.body.redirectTo, '/checkout');
  assert.equal(s.additions(), 1);
  assert.equal(s.subscriptions.get('c'.repeat(64)).recipient, '919876543210');

  req.body = {token};
  const retry = s.response();
  await complete(req, retry);
  assert.equal(retry.code, 201);
  assert.equal(s.additions(), 1);
});

test('specific order lookup is scoped to the linked user', async () => {
  const s = await setup();
  const id = 'f'.repeat(24);
  const req = {user: {_id: 'owner'}, whatsappAccountRef: 'a'.repeat(64), params: {orderId: id}};
  const res = s.response();

  await s.handlers.get('GET /orders/:orderId')[0](req, res);

  assert.equal(res.code, 200);
  assert.equal(s.orderIdFilter()._id, id);
  assert.equal(s.orderIdFilter().user, 'owner');
});

test('cart mutation is rate limited', async () => {
  const s = await setup();
  const cart = s.handlers.get('POST /cart')[0];
  for (let index = 0; index < 30; index++) {
    const req = s.request();
    req.whatsappAccountRef = 'a'.repeat(64);
    req.body.operation_id = index.toString(16).padStart(32, '0');
    await cart(req, s.response());
  }
  const blockedRequest = s.request();
  blockedRequest.whatsappAccountRef = 'a'.repeat(64);
  blockedRequest.body.operation_id = 'f'.repeat(32);
  const blocked = s.response();

  await cart(blockedRequest, blocked);

  assert.equal(blocked.code, 429);
  assert.equal(s.additions(), 30);
});

test('backend-issued links complete on its database and refreshes do not add twice', async () => {
  const s = await setup();
  const issue = s.handlers.get('POST /link/request')[0];
  const complete = s.handlers.get('POST /link/complete')[1];
  const purchase = s.request().body;
  const tokens = [];
  for (let i = 0; i < 2; i++) {
    const res = s.response();
    await issue({headers: {'x-whatsapp-account': 'c'.repeat(64)}, body: {recipient: '919876543210', purchase, return_path: '/checkout'}}, res);
    assert.equal(res.code, 201);
    const url = new URL(res.body.checkout_url);
    assert.equal(url.origin, 'https://shop.example');
    tokens.push(url.searchParams.get('token'));
  }
  assert.notEqual(tokens[0], tokens[1]);
  assert.equal(s.checkoutRequests.size, 2);
  for (const token of tokens) {
    const stored = s.checkoutRequests.get(crypto.createHash('sha256').update(token).digest('hex'));
    assert.ok(stored.expiresAt > new Date());
    assert.equal(JSON.stringify(stored).includes(token), false);
    const res = s.response();
    await complete({user: {_id: 'owner'}, body: {token}}, res);
    assert.equal(res.code, 201);
  }
  assert.equal(s.additions(), 1);
});

test('expired, missing, and other-user tokens cannot mutate the cart', async () => {
  const s = await setup();
  const complete = s.handlers.get('POST /link/complete')[1];
  const token = 'x'.repeat(43);
  for (const doc of [null, {account: 'c'.repeat(64), expiresAt: new Date(Date.now() - 1)}, {account: 'c'.repeat(64), consumed_by: 'someone-else'}]) {
    if (doc) s.seedCheckout(token, doc);
    const res = s.response();
    await complete({user: {_id: 'owner'}, body: {token}}, res);
    assert.equal(res.code, 400);
    assert.equal(res.body.code, 'CHECKOUT_LINK_UNAVAILABLE');
  }
  assert.equal(s.additions(), 0);
});

test('token issuer validates account, recipient, purchase, and rate limit', async () => {
  const s = await setup();
  const issue = s.handlers.get('POST /link/request')[0];
  const req = {headers: {'x-whatsapp-account': 'c'.repeat(64)}, body: {recipient: '919876543210', purchase: s.request().body}};
  for (const invalid of [
    {...req, headers: {}},
    {...req, body: {...req.body, recipient: 'bad'}},
    {...req, body: {...req.body, purchase: {...req.body.purchase, quantity: 21}}},
  ]) {
    const res = s.response();
    await issue(invalid, res);
    assert.equal(res.code, 400);
  }
  assert.equal(s.checkoutRequests.size, 0);
  for (let i = 0; i < 10; i++) await issue(req, s.response());
  const blocked = s.response();
  await issue(req, blocked);
  assert.equal(blocked.code, 429);
  assert.equal(s.checkoutRequests.size, 10);
});
