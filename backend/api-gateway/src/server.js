require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
app.use(cors());

const PORT = Number(process.env.PORT || 3000);
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://user-service:3001";
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || "http://order-service:3002";
const RECOMMENDATION_SERVICE_URL =
  process.env.RECOMMENDATION_SERVICE_URL || "http://recommendation-service:3003";

app.get("/health", (_req, res) => {
  res.json({
    service: "api-gateway",
    status: "ok",
    routes: {
      users: "/api/users/*",
      orders: "/api/orders/*",
      recommendations: "/api/recommendations/*"
    }
  });
});

app.use(
  "/api/users",
  createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/users": "" }
  })
);

app.use(
  "/api/orders",
  createProxyMiddleware({
    target: ORDER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/orders": "" }
  })
);

app.use(
  "/api/recommendations",
  createProxyMiddleware({
    target: RECOMMENDATION_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/recommendations": "" }
  })
);

app.listen(PORT, () => {
  console.log(`api-gateway listening on port ${PORT}`);
});
