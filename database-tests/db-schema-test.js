// db-schema-test.js - FIXED VERSION
const mysql = require('mysql2/promise');
require('dotenv').config();

const EXPECTED_TABLES = [
  'users', 
  'categories', 
  'items', 
  'purchases', 
  'reviews', 
  'user_alerts', 
  'alert_types'
];

async function validateDatabaseSchema() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('📋 Validating database schema...');
    
    // Get all tables in the database
    const [tables] = await connection.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
      [process.env.DB_NAME]
    );
    
    const tableNames = tables.map(t => t.TABLE_NAME || t.table_name);
    console.log('Existing tables:', tableNames.join(', '));
    
    // Check that all expected tables exist
    const missingTables = EXPECTED_TABLES.filter(t => !tableNames.map(name => name.toLowerCase()).includes(t.toLowerCase()));
    
    if (missingTables.length > 0) {
      console.error('❌ Missing tables:', missingTables.join(', '));
    } else {
      console.log('✅ All expected tables exist');
    }
    
    // For each existing table in our expected list, check its columns
    for (const tableName of EXPECTED_TABLES) {
      // Skip if table doesn't exist
      if (missingTables.includes(tableName)) {
        continue;
      }
      
      // Get columns for this table
      const [columns] = await connection.query(
        'SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?',
        [process.env.DB_NAME, tableName]
      );
      
      if (columns.length === 0) {
        console.log(`ℹ️ Table ${tableName} exists but has no columns`);
      } else {
        const columnNames = columns.map(c => c.COLUMN_NAME || c.column_name);
        console.log(`✅ Table ${tableName} has columns: ${columnNames.join(', ')}`);
      }
    }
    
    console.log('🎉 Database schema validation complete!');
    return true;
  } catch (error) {
    console.error('❌ Schema validation failed:', error.message);
    return false;
  } finally {
    if (connection) await connection.end();
  }
}

// Run the validation
validateDatabaseSchema()
  .then(success => {
    if (!success) process.exit(1);
  })
  .catch(err => {
    console.error('Validation failed with error:', err);
    process.exit(1);
  });