// db-transaction-test.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function testTransactions() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('⚖️ Testing database transactions...');
    
    // Test 1: Successful transaction (commit)
    console.log('Test 1: Successful transaction (commit)');
    await connection.query('START TRANSACTION');
    
    // Create test user and category
    const testUsername = `testuser_${Date.now()}`;
    
    // Insert a test user
    const [userResult] = await connection.query(
      `INSERT INTO users (username, email, password, full_name) 
       VALUES (?, ?, ?, ?)`,
      [testUsername, `${testUsername}@example.com`, 'password123', 'Test User']
    );
    
    const userId = userResult.insertId;
    
    // Insert a test category
    const [categoryResult] = await connection.query(
      `INSERT INTO categories (name, description) 
       VALUES (?, ?)`,
      [`Test Category ${Date.now()}`, 'Test category description']
    );
    
    const categoryId = categoryResult.insertId;
    
    // Insert a test item associated with the user and category
    const [itemResult] = await connection.query(
      `INSERT INTO items (seller_id, category_id, title, description, price, is_deleted) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, categoryId, 'Test Item', 'Test item description', 9.99, false]
    );
    
    const itemId = itemResult.insertId;
    
    // Commit the transaction
    await connection.query('COMMIT');
    console.log(`✅ Successful transaction committed - created user(${userId}), category(${categoryId}), and item(${itemId})`);
    
    // Test 2: Failed transaction (rollback)
    console.log('Test 2: Failed transaction (rollback)');
    await connection.query('START TRANSACTION');
    
    const testUsername2 = `testuser2_${Date.now()}`;
    
    // Insert another test user
    const [userResult2] = await connection.query(
      `INSERT INTO users (username, email, password, full_name) 
       VALUES (?, ?, ?, ?)`,
      [testUsername2, `${testUsername2}@example.com`, 'password123', 'Test User 2']
    );
    
    const userId2 = userResult2.insertId;
    console.log(`Inserted test user with ID: ${userId2}`);
    
    try {
      // Try to insert an item with an invalid category_id
      // This should fail and trigger rollback
      await connection.query(
        `INSERT INTO items (seller_id, category_id, title, description, price, is_deleted) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId2, 999999, 'Invalid Item', 'This should fail', 19.99, false]
      );
      
      console.error('❌ Expected foreign key constraint error was not thrown');
    } catch (error) {
      // This is expected - we should get a foreign key constraint error
      console.log('✅ Got expected error:', error.message);
      
      // Rollback the transaction
      await connection.query('ROLLBACK');
      console.log('✅ Transaction rolled back');
      
      // Verify user was not inserted (should have been rolled back)
      const [verifyUser] = await connection.query(
        'SELECT * FROM users WHERE user_id = ?',
        [userId2]
      );
      
      if (verifyUser.length === 0) {
        console.log('✅ Rollback successful - test user not in database');
      } else {
        console.error('❌ Rollback failed - test user still in database');
      }
    }
    
    // Clean up the test data from the successful transaction
    console.log('Cleaning up test data...');
    await connection.query('START TRANSACTION');
    
    await connection.query('DELETE FROM items WHERE item_id = ?', [itemId]);
    await connection.query('DELETE FROM categories WHERE category_id = ?', [categoryId]);
    await connection.query('DELETE FROM users WHERE user_id = ?', [userId]);
    
    await connection.query('COMMIT');
    console.log('🧹 Test data cleanup complete');
    
    console.log('🎉 Transaction testing complete!');
    return true;
  } catch (error) {
    if (connection) {
      await connection.query('ROLLBACK');
      console.log('Transaction rolled back due to error');
    }
    console.error('❌ Transaction testing failed:', error.message);
    return false;
  } finally {
    if (connection) await connection.end();
  }
}

// Run the test
testTransactions()
  .then(success => {
    if (!success) process.exit(1);
  })
  .catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });