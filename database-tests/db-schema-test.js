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

const TABLE_SCHEMAS = {
  'users': [
    'user_id', 'username', 'email', 'password', 
    'full_name', 'profile_image', 'created_at'
  ],
  'categories': [
    'category_id', 'name', 'description'
  ],
  'items': [
    'item_id', 'seller_id', 'category_id', 'title', 'description',
    'price', 'file_path', 'thumbnail_path', 'is_deleted', 'created_at'
  ],
  'purchases': [
    'purchase_id', 'buyer_id', 'item_id', 'purchase_price', 'purchase_date'
  ],
  'reviews': [
    'review_id', 'item_id', 'reviewer_id', 'rating', 'comment', 'created_at'
  ],
  'user_alerts': [
    'alert_id', 'user_id', 'alert_type_id', 'item_id', 'category_id',
    'price_threshold', 'is_read', 'created_at'
  ],
  'alert_types': [
    'alert_type_id', 'name', 'description'
  ]
};

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
    
    const tableNames = tables.map(t => t.table_name.toLowerCase());
    
    // Check that all expected tables exist
    const missingTables = EXPECTED_TABLES.filter(t => !tableNames.includes(t));
    
    if (missingTables.length > 0) {
      console.error('❌ Missing tables:', missingTables.join(', '));
      return false;
    }
    
    console.log('✅ All expected tables exist');
    
    // Check each table's columns
    for (const tableName of EXPECTED_TABLES) {
      const [columns] = await connection.query(
        'SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?',
        [process.env.DB_NAME, tableName]
      );
      
      const columnNames = columns.map(c => c.column_name.toLowerCase());
      const expectedColumns = TABLE_SCHEMAS[tableName];
      
      const missingColumns = expectedColumns.filter(c => !columnNames.includes(c.toLowerCase()));
      
      if (missingColumns.length > 0) {
        console.error(`❌ Table ${tableName} is missing columns:`, missingColumns.join(', '));
        return false;
      }
      
      console.log(`✅ Table ${tableName} has all required columns`);
    }
    
    console.log('🎉 Database schema validation complete - all tables and columns exist!');
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