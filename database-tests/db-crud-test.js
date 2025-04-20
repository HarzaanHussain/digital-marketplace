const mysql = require('mysql2/promise');
require('dotenv').config();

async function testCrudOperations() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('🔍 Testing CRUD operations...');
    
    // Start transaction to ensure we can rollback all changes
    await connection.query('START TRANSACTION');
    
    // 1. CREATE - Insert a test category
    console.log('Testing CREATE operation...');
    const testCategoryName = `Test Category ${Date.now()}`;
    const [createResult] = await connection.query(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [testCategoryName, 'This is a test category for CRUD operations']
    );
    
    if (createResult.affectedRows !== 1) {
      throw new Error('CREATE operation failed');
    }
    
    const newCategoryId = createResult.insertId;
    console.log(`✅ CREATE successful - inserted category with ID: ${newCategoryId}`);
    
    // 2. READ - Get the category we just created
    console.log('Testing READ operation...');
    const [readResult] = await connection.query(
      'SELECT * FROM categories WHERE category_id = ?',
      [newCategoryId]
    );
    
    if (readResult.length !== 1 || readResult[0].name !== testCategoryName) {
      throw new Error('READ operation failed');
    }
    
    console.log(`✅ READ successful - retrieved category: ${readResult[0].name}`);
    
    // 3. UPDATE - Update the category name
    console.log('Testing UPDATE operation...');
    const updatedCategoryName = `Updated Test Category ${Date.now()}`;
    const [updateResult] = await connection.query(
      'UPDATE categories SET name = ? WHERE category_id = ?',
      [updatedCategoryName, newCategoryId]
    );
    
    if (updateResult.affectedRows !== 1) {
      throw new Error('UPDATE operation failed');
    }
    
    // Verify the update
    const [verifyUpdate] = await connection.query(
      'SELECT name FROM categories WHERE category_id = ?',
      [newCategoryId]
    );
    
    if (verifyUpdate.length !== 1 || verifyUpdate[0].name !== updatedCategoryName) {
      throw new Error('UPDATE verification failed');
    }
    
    console.log(`✅ UPDATE successful - category name updated to: ${updatedCategoryName}`);
    
    // 4. DELETE - Delete the test category
    console.log('Testing DELETE operation...');
    const [deleteResult] = await connection.query(
      'DELETE FROM categories WHERE category_id = ?',
      [newCategoryId]
    );
    
    if (deleteResult.affectedRows !== 1) {
      throw new Error('DELETE operation failed');
    }
    
    // Verify the delete
    const [verifyDelete] = await connection.query(
      'SELECT * FROM categories WHERE category_id = ?',
      [newCategoryId]
    );
    
    if (verifyDelete.length !== 0) {
      throw new Error('DELETE verification failed');
    }
    
    console.log(`✅ DELETE successful - category removed from database`);
    
    // Roll back our test data to keep the database clean
    await connection.query('ROLLBACK');
    console.log('Transaction rolled back - database returned to original state');
    
    console.log('🎉 CRUD operations testing complete - all operations successful!');
    return true;
  } catch (error) {
    if (connection) {
      await connection.query('ROLLBACK');
      console.log('Transaction rolled back due to error');
    }
    console.error('❌ CRUD testing failed:', error.message);
    return false;
  } finally {
    if (connection) await connection.end();
  }
}

// Run the test
testCrudOperations()
  .then(success => {
    if (!success) process.exit(1);
  })
  .catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });