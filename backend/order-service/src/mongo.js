const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URL || "mongodb://mongo:27017";
const dbName = process.env.MONGO_DB_NAME || "ecommerce";

let client;
let db;

async function initMongo() {
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);

  const products = db.collection("products");
  const count = await products.countDocuments();
  if (count === 0) {
    await products.insertMany([
      {
        name: "iPhone 15",
        category: "phone",
        price: 999.0,
        stock: 120,
        created_at: new Date()
      },
      {
        name: "Samsung Galaxy S24",
        category: "phone",
        price: 899.0,
        stock: 150,
        created_at: new Date()
      },
      {
        name: "MacBook Pro M3",
        category: "laptop",
        price: 1999.0,
        stock: 60,
        created_at: new Date()
      },
      {
        name: "Sony WH-1000XM5",
        category: "accessory",
        price: 349.0,
        stock: 200,
        created_at: new Date()
      }
    ]);
  }
}

function getProductsCollection() {
  if (!db) {
    throw new Error("MongoDB is not initialized");
  }
  return db.collection("products");
}

async function pingMongo() {
  if (!db) {
    throw new Error("MongoDB is not initialized");
  }
  return db.command({ ping: 1 });
}

module.exports = { initMongo, getProductsCollection, pingMongo };
