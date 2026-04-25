const axios = require("axios");

function createClient() {
  const host = process.env.DATABRICKS_HOST;
  const token = process.env.DATABRICKS_TOKEN;
  const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID;  

  if (!host || !token || !warehouseId) {
    return null;
  }

  const baseURL = `https://${host}`;
  const http = axios.create({
    baseURL,
    timeout: 20000,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  return { http, warehouseId };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapResultRows(payload) {
  const cols = payload?.manifest?.schema?.columns?.map((c) => c.name) || [];
  const rows = payload?.result?.data_array || [];
  return rows.map((arr) => {
    const row = {};
    cols.forEach((col, idx) => {
      row[col] = arr[idx];
    });
    return row;
  });
}

async function runSql(statement) {
  const client = createClient();
  if (!client) {
    throw new Error("Databricks SQL config is missing");
  }

  const submit = await client.http.post("/api/2.0/sql/statements", {
    statement,
    warehouse_id: client.warehouseId,
    wait_timeout: "10s"
  });

  let payload = submit.data;
  if (payload?.status?.state === "SUCCEEDED") {
    return mapResultRows(payload);
  }

  if (!payload?.statement_id) {
    throw new Error("Databricks SQL did not return statement_id");
  }

  for (let i = 0; i < 10; i += 1) {
    await sleep(1000);
    const check = await client.http.get(`/api/2.0/sql/statements/${payload.statement_id}`);
    payload = check.data;

    if (payload?.status?.state === "SUCCEEDED") {
      return mapResultRows(payload);
    }

    if (["FAILED", "CANCELED", "CLOSED"].includes(payload?.status?.state)) {
      const errMsg = payload?.status?.error?.message || "Databricks SQL statement failed";
      throw new Error(errMsg);
    }
  }

  throw new Error("Databricks SQL statement timed out");
}

module.exports = { runSql };
