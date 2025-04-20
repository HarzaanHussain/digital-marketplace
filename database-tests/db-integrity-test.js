const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDataIntegrity() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('🛡️ Testing data integrity...');
    
    // 1. Check for orphaned records - items without valid sellers
    console.log('Checking for orphaned items...');
    const [orphanedItems] = await connection.query(`
      SELECT i.item_id, i.title
      FROM items i
      LEFT JOIN users u ON i.seller_id = u.user_id
      WHERE u.user_id IS NULL
    `);
    
    if (orphanedItems.length > 0) {
      console.warn(`⚠️ Found ${orphanedItems.length} items with missing sellers:`);
      orphanedItems.forEach(item => {
        console.warn(`   - Item ID: ${item.item_id}, Title: ${item.title}`);
      });
    } else {
      console.log('✅ No orphaned items found');
    }
    
    // 2. Check for orphaned records - purchases without valid items
    console.log('Checking for orphaned purchases...');
    const [orphanedPurchases] = await connection.query(`
      SELECT p.purchase_id, p.buyer_id
      FROM purchases p
      LEFT JOIN items i ON p.item_id = i.item_id
      WHERE i.item_id IS NULL
    `);
    
    if (orphanedPurchases.length > 0) {
      console.warn(`⚠️ Found ${orphanedPurchases.length} purchases with missing items:`);
      orphanedPurchases.forEach(purchase => {
        console.warn(`   - Purchase ID: ${purchase.purchase_id}, Buyer ID: ${purchase.buyer_id}`);
      });
    } else {
      console.log('✅ No orphaned purchases found');
    }
    
    // 3. Check for duplicate categories
    console.log('Checking for duplicate categories...');
    const [duplicateCategories] = await connection.query(`
      SELECT name, COUNT(*) as count
      FROM categories
      GROUP BY name
      HAVING count > 1
    `);
    
    if (duplicateCategories.length > 0) {
      console.warn('⚠️ Found duplicate categories:');
      duplicateCategories.forEach(category => {
        console.warn(`   - "${category.name}" appears ${category.count} times`);
      });
    } else {
      console.log('✅ No duplicate categories found');
    }
    
    // 4. Check for users who purchased their own items
    console.log('Checking for self-purchases...');
    const [selfPurchases] = await connection.query(`
      SELECT p.purchase_id, p.buyer_id, i.item_id, i.title
      FROM purchases p
      JOIN items i ON p.item_id = i.item_id
      WHERE p.buyer_id = i.seller_id
    `);
    
    if (selfPurchases.length > 0) {
      console.warn(`⚠️ Found ${selfPurchases.length} self-purchases (users buying their own items):`);
      selfPurchases.forEach(purchase => {
        console.warn(`   - User ${purchase.buyer_id} purchased their own item: ${purchase.title} (ID: ${purchase.item_id})`);
      });
    } else {
      console.log('✅ No self-purchases found');
    }
    
    // 5. Check for invalid prices
    console.log('Checking for invalid prices...');
    const [invalidPrices] = await connection.query(`
      SELECT item_id, title, price
      FROM items
      WHERE price <= 0 OR price IS NULL
    `);
    
    if (invalidPrices.length > 0) {
      console.warn(`⚠️ Found ${invalidPrices.length} items with invalid prices:`);
      invalidPrices.forEach(item => {
        console.warn(`   - Item ID: ${item.item_id}, Title: ${item.title}, Price: ${item.price}`);
      });
    } else {
      console.log('✅ No invalid prices found');
    }
    
    // 6. Check for invalid reviews (ratings outside 1-5 range)
    console.log('Checking for invalid review ratings...');
    const [invalidRatings] = await connection.query(`
      SELECT review_id, rating
      FROM reviews
      WHERE rating < 1 OR rating > 5 OR rating IS NULL
    `);
    
    if (invalidRatings.length > 0) {
      console.warn(`⚠️ Found ${invalidRatings.length} reviews with invalid ratings:`);
      invalidRatings.forEach(review => {
        console.warn(`   - Review ID: ${review.review_id}, Rating: ${review.rating}`);
      });
    } else {
      console.log('✅ No invalid review ratings found');
    }
    
    console.log('🎉 Data integrity testing complete!');
    return true;
  } catch (error) {
    console.error('❌ Data integrity testing failed:', error.message);
    return false;
  } finally {
    if (connection) await connection.end();
  }
}

// Run the test
testDataIntegrity()
  .then(success => {
    if (!success) process.exit(1);
  })
  .catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });