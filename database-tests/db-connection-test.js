// db-connection-test.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDatabaseConnection() {
  let connection;
  try {
    // Create connection with your environment variables
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('✅ Successfully connected to database!');
    
    // Get database version
    const [rows] = await connection.query('SELECT VERSION() as version');
    console.log(`📊 MySQL Version: ${rows[0].version}`);
    
    // Test query performance
    console.log('Testing query performance...');
    const startTime = Date.now();
    await connection.query('SELECT 1');
    const endTime = Date.now();
    console.log(`⏱️ Query execution time: ${endTime - startTime}ms`);
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  } finally {
    if (connection) await connection.end();
  }
}

// Run the test
testDatabaseConnection()
  .then(success => {
    if (!success) process.exit(1);
  })
  .catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });