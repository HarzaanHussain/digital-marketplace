// Load test environment variables before running tests
require('dotenv').config({ path: '.env.test' });

// Log confirmation message
console.log(`Using test database: ${process.env.DB_NAME}`);
console.log(`Database host: ${process.env.DB_HOST}`);
console.log(`Using user: ${process.env.DB_USER}`);

// Optional: Global setup code for all tests
global.testSetup = {
  isTestEnvironment: true
};