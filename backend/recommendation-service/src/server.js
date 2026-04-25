require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { runSql } = require("./databricks");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3003);

function safeText(value) {
  return String(value || "").replace(/'/g, "''");
}

function mockTopProducts() {
  return [
    { product_category_name: "phone", product_id: "mock-phone-1", total_orders: 120, rank_in_category: 1 },
    { product_category_name: "laptop", product_id: "mock-laptop-1", total_orders: 95, rank_in_category: 1 },
    { product_category_name: "accessory", product_id: "mock-accessory-1", total_orders: 80, rank_in_category: 1 }
  ];
}

app.get("/health", (_req, res) => {
  const databricksEnabled = Boolean(
    process.env.DATABRICKS_HOST && process.env.DATABRICKS_TOKEN && process.env.DATABRICKS_WAREHOUSE_ID
  );
  return res.json({
    service: "recommendation-service",
    status: "ok",
    databricks_enabled: databricksEnabled
  });
});

app.get("/recommendations/top-products", async (req, res) => {
  const category = req.query.category ? safeText(req.query.category) : null;
  const limit = Math.max(1, Math.min(Number(req.query.limit || 10), 50));

  let statement = `
    SELECT product_category_name, product_id, total_orders, rank_in_category
    FROM workspace.default.gold_top_products
  `;
  if (category) {
    statement += ` WHERE product_category_name = '${category}' `;
  }
  statement += ` ORDER BY total_orders DESC LIMIT ${limit}`;

  try {
    const rows = await runSql(statement);
    return res.json({ source: "databricks", data: rows });
  } catch (err) {
    return res.json({
      source: "mock",
      warning: `Fallback because Databricks query failed: ${err.message}`,
      data: mockTopProducts().slice(0, limit)
    });
  }
});

app.get("/recommendations/user/:userId", async (req, res) => {
  const userId = safeText(req.params.userId);

  const segmentSql = `
    SELECT customer_unique_id, customer_segment, recency, frequency, monetary, rfm_score
    FROM workspace.default.gold_user_segments
    WHERE customer_unique_id = '${userId}'
    LIMIT 1
  `;

  const suggestionSql = `
    SELECT product_category_name, product_id, total_orders, rank_in_category
    FROM workspace.default.gold_top_products
    ORDER BY total_orders DESC
    LIMIT 5
  `;

  try {
    const [segmentRows, suggestionRows] = await Promise.all([
      runSql(segmentSql),
      runSql(suggestionSql)
    ]);

    return res.json({
      source: "databricks",
      user: segmentRows[0] || { customer_unique_id: userId, customer_segment: "unknown" },
      suggestions: suggestionRows
    });
  } catch (err) {
    return res.json({
      source: "mock",
      warning: `Fallback because Databricks query failed: ${err.message}`,
      user: { customer_unique_id: userId, customer_segment: "Potential" },
      suggestions: mockTopProducts()
    });
  }
});

app.listen(PORT, () => {
  console.log(`recommendation-service listening on port ${PORT}`);
});
