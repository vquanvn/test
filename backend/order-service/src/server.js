require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ObjectId } = require("mongodb");
const { pool, initPostgres } = require("./pg");
const { initMongo, getProductsCollection, pingMongo } = require("./mongo");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3002);

const ALLOWED_STATUSES = [
  "created",
  "confirmed",
  "shipping",
  "delivered",
  "cancelled"
];

app.get("/health", async (_req, res) => {
  await pool.query("SELECT 1");
  await pingMongo();
  res.json({ service: "order-service", status: "ok" });
});

app.get("/products", async (req, res) => {
  const { category } = req.query;
  const filter = category ? { category } : {};
  const products = await getProductsCollection().find(filter).limit(100).toArray();
  return res.json({ products });
});

app.get("/products/:id", async (req, res) => {
  let objectId;
  try {
    objectId = new ObjectId(req.params.id);
  } catch (_err) {
    return res.status(400).json({ message: "Invalid product id" });
  }

  const product = await getProductsCollection().findOne({ _id: objectId });
  if (!product) return res.status(404).json({ message: "Product not found" });
  return res.json({ product });
});

app.post("/products", async (req, res) => {
  const { name, category, price, stock } = req.body;
  if (!name || !category || price == null) {
    return res.status(400).json({ message: "name, category, price are required" });
  }

  const payload = {
    name,
    category,
    price: Number(price),
    stock: Number(stock ?? 0),
    created_at: new Date()
  };

  const result = await getProductsCollection().insertOne(payload);
  return res.status(201).json({
    product: { _id: result.insertedId, ...payload }
  });
});

app.post("/orders", async (req, res) => {
  const { user_id, items, shipping_address } = req.body;
  if (!user_id || !Array.isArray(items) || items.length === 0 || !shipping_address) {
    return res.status(400).json({ message: "user_id, items, shipping_address are required" });
  }

  const productObjectIds = [];
  for (const item of items) {
    if (!item.product_id || !item.quantity || Number(item.quantity) <= 0) {
      return res.status(400).json({ message: "Each item requires product_id and quantity > 0" });
    }
    try {
      productObjectIds.push(new ObjectId(item.product_id));
    } catch (_err) {
      return res.status(400).json({ message: `Invalid product_id: ${item.product_id}` });
    }
  }

  const products = await getProductsCollection()
    .find({ _id: { $in: productObjectIds } })
    .toArray();

  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const orderItems = [];

  for (const item of items) {
    const product = productMap.get(String(item.product_id));
    if (!product) {
      return res.status(404).json({ message: `Product not found: ${item.product_id}` });
    }

    const quantity = Number(item.quantity);
    const lineTotal = Number(product.price) * quantity;
    orderItems.push({
      product_id: String(product._id),
      product_name: product.name,
      unit_price: Number(product.price),
      quantity,
      line_total: Number(lineTotal.toFixed(2))
    });
  }

  const totalAmount = Number(
    orderItems.reduce((sum, item) => sum + item.line_total, 0).toFixed(2)
  );

  const inserted = await pool.query(
    `INSERT INTO orders (user_id, items, total_amount, shipping_address, status)
     VALUES ($1, $2::jsonb, $3, $4, 'created')
     RETURNING id, user_id, items, total_amount, shipping_address, status, created_at`,
    [Number(user_id), JSON.stringify(orderItems), totalAmount, shipping_address]
  );

  return res.status(201).json({ order: inserted.rows[0] });
});

app.get("/orders/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid order id" });

  const result = await pool.query(
    `SELECT id, user_id, items, total_amount, shipping_address, status, created_at
     FROM orders WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return res.status(404).json({ message: "Order not found" });
  return res.json({ order: result.rows[0] });
});

app.get("/orders/user/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId)) return res.status(400).json({ message: "Invalid user id" });

  const result = await pool.query(
    `SELECT id, user_id, items, total_amount, shipping_address, status, created_at
     FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  return res.json({ orders: result.rows });
});

app.put("/orders/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid order id" });
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` });
  }

  const result = await pool.query(
    `UPDATE orders SET status = $1
     WHERE id = $2
     RETURNING id, user_id, items, total_amount, shipping_address, status, created_at`,
    [status, id]
  );

  if (result.rows.length === 0) return res.status(404).json({ message: "Order not found" });
  return res.json({ order: result.rows[0] });
});

app.get("/orders", async (_req, res) => {
  const result = await pool.query(
    `SELECT id, user_id, items, total_amount, shipping_address, status, created_at
     FROM orders ORDER BY created_at DESC LIMIT 200`
  );
  return res.json({ orders: result.rows });
});

Promise.all([initPostgres(), initMongo()])
  .then(() => {
    app.listen(PORT, () => {
      console.log(`order-service listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize order-service", err);
    process.exit(1);
  });
