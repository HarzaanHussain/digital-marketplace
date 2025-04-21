// db-relationships-test.js - FIXED VERSION
const mysql = require('mysql2/promise');
require('dotenv').config();

const EXPECTED_RELATIONSHIPS = [
  { table: 'items', column: 'seller_id', references: { table: 'users', column: 'user_id' } },
  { table: 'items', column: 'category_id', references: { table: 'categories', column: 'category_id' } },
  { table: 'purchases', column: 'buyer_id', references: { table: 'users', column: 'user_id' } },
  { table: 'purchases', column: 'item_id', references: { table: 'items', column: 'item_id' } },
  { table: 'reviews', column: 'item_id', references: { table: 'items', column: 'item_id' } },
  { table: 'reviews', column: 'reviewer_id', references: { table: 'users', column: 'user_id' } },
  { table: 'user_alerts', column: 'user_id', references: { table: 'users', column: 'user_id' } },
  { table: 'user_alerts', column: 'alert_type_id', references: { table: 'alert_types', column: 'alert_type_id' } },
  { table: 'user_alerts', column: 'item_id', references: { table: 'items', column: 'item_id' } },
  { table: 'user_alerts', column: 'category_id', references: { table: 'categories', column: 'category_id' } },
  { table: 'seller_notifications', column: 'seller_id', references: { table: 'users', column: 'user_id' } },
  { table: 'seller_notifications', column: 'item_id', references: { table: 'items', column: 'item_id' } },
  { table: 'seller_notifications', column: 'buyer_id', references: { table: 'users', column: 'user_id' } },
  { table: 'seller_notifications', column: 'purchase_id', references: { table: 'purchases', column: 'purchase_id' } }
];

async function testForeignKeyRelationships() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('🔄 Testing foreign key relationships...');
    
    const [constraints] = await connection.query(`
      SELECT 
        TABLE_NAME as table_name,
        COLUMN_NAME as column_name,
        REFERENCED_TABLE_NAME as referenced_table_name,
        REFERENCED_COLUMN_NAME as referenced_column_name,
        CONSTRAINT_NAME as constraint_name
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE 
        TABLE_SCHEMA = ? AND
        REFERENCED_TABLE_NAME IS NOT NULL
    `, [process.env.DB_NAME]);
    
    console.log(`Found ${constraints.length} foreign key constraints in database`);
    
    // Check that all expected relationships exist
    for (const relationship of EXPECTED_RELATIONSHIPS) {
      const found = constraints.some(c => 
        String(c.table_name).toLowerCase() === relationship.table.toLowerCase() &&
        String(c.column_name).toLowerCase() === relationship.column.toLowerCase() &&
        String(c.referenced_table_name).toLowerCase() === relationship.references.table.toLowerCase() &&
        String(c.referenced_column_name).toLowerCase() === relationship.references.column.toLowerCase()
      );
      
      if (found) {
        console.log(`✅ Found relationship: ${relationship.table}.${relationship.column} -> ${relationship.references.table}.${relationship.references.column}`);
      } else {
        console.warn(`⚠️ Missing relationship: ${relationship.table}.${relationship.column} -> ${relationship.references.table}.${relationship.references.column}`);
        
        // Additional check - see if the columns exist but no FK constraint
        const [columns] = await connection.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = ? AND table_name = ? AND column_name = ?
        `, [process.env.DB_NAME, relationship.table, relationship.column]);
        
        if (columns.length > 0) {
          console.log(`   Column ${relationship.table}.${relationship.column} exists but doesn't have a foreign key constraint`);
        } else {
          console.log(`   Column ${relationship.table}.${relationship.column} doesn't exist`);
        }
      }
    }
    
    // Check for any extra relationships that weren't expected
    for (const constraint of constraints) {
      const isExpected = EXPECTED_RELATIONSHIPS.some(r => 
        r.table.toLowerCase() === String(constraint.table_name).toLowerCase() &&
        r.column.toLowerCase() === String(constraint.column_name).toLowerCase() &&
        r.references.table.toLowerCase() === String(constraint.referenced_table_name).toLowerCase() &&
        r.references.column.toLowerCase() === String(constraint.referenced_column_name).toLowerCase()
      );
      
      if (!isExpected) {
        console.log(`ℹ️ Extra relationship: ${constraint.table_name}.${constraint.column_name} -> ${constraint.referenced_table_name}.${constraint.referenced_column_name} (${constraint.constraint_name})`);
      }
    }
    
    console.log('🎉 Foreign key relationship testing complete!');
    return true;
  } catch (error) {
    console.error('❌ Relationship testing failed:', error.message);
    return false;
  } finally {
    if (connection) await connection.end();
  }
}

// Run the test
testForeignKeyRelationships()
  .then(success => {
    console.log(`Test completed with ${success ? 'success' : 'failure'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });