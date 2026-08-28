require('dotenv').config();
const {Pool}=require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

// Prevent an idle database client error from becoming an unhandled process error.
pool.on("error", (error) => {
  console.error("POSTGRES POOL ERROR:", error);
});
module.exports=pool;
