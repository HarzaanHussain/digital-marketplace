// db-performance-test.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function testQueryPerformance() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('⏱️ Testing query performance...');
    
    // List of queries to test
    const queries = [
      {
        name: 'Get all categories',
        sql: 'SELECT * FROM categories',
        params: []
      },
      {
        name: 'Get items with pagination',
        sql: 'SELECT * FROM items WHERE is_deleted = false LIMIT 10 OFFSET 0',
        params: []
      },
      {
        name: 'Search items by title',
        sql: 'SELECT * FROM items WHERE title LIKE ? AND is_deleted = false LIMIT 10',
        params: ['%test%']
      },
      {
        name: 'Get item details with joins',
        sql: `SELECT i.*, c.name as category_name, u.username as seller_name, AVG(r.rating) as avg_rating
              FROM items i
              JOIN categories c ON i.category_id = c.category_id
              JOIN users u ON i.seller_id = u.user_id
              LEFT JOIN reviews r ON i.item_id = r.item_id
              WHERE i.is_deleted = false
              GROUP BY i.item_id
              LIMIT 10`,
        params: []
      },
      {
        name: 'Get user purchases with joins',
        sql: `SELECT p.*, i.title, i.description
              FROM purchases p
              JOIN items i ON p.item_id = i.item_id
              WHERE p.buyer_id = ?
              ORDER BY p.purchase_date DESC
              LIMIT 10`,
        params: [1] // Assuming user_id 1 exists
      }
    ];
    
    // Test each query and measure performance
    for (const query of queries) {
      console.log(`Testing query: ${query.name}`);
      
      // Run with EXPLAIN to check query plan
      console.log('Query plan:');
      const [explainResult] = await connection.query(`EXPLAIN ${query.sql}`, query.params);
      console.table(explainResult);
      
      // Run query and measure time
      const startTime = process.hrtime();
      
      await connection.query(query.sql, query.params);
      
      const endTime = process.hrtime(startTime);
      const executionTime = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
      
      console.log(`Execution time: ${executionTime}ms`);
      
      // Evaluate performance
      if (executionTime < 50) {
        console.log('✅ Excellent performance');
      } else if (executionTime < 200) {
        console.log('✅ Good performance');
      } else if (executionTime < 500) {
        console.log('⚠️ Acceptable performance, but could be improved');
      } else {
        console.log('❌ Poor performance, needs optimization');
      }
      
      console.log('----------------------------');
    }
    
    console.log('🎉 Query performance testing complete!');
    return true;
  } catch (error) {
    console.error('❌ Performance testing failed:', error.message);
    return false;
  } finally {
    if (connection) await connection.end();
  }
}

// Run the test
testQueryPerformance()
  .then(success => {
    if (!success) process.exit(1);
  })
  .catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });