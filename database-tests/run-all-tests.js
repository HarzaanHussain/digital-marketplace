// run-all-tests.js - FIXED VERSION
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Array of test scripts to run
const testScripts = [
  'db-connection-test.js',
  'db-schema-test.js',
  'db-relationships-test.js',
  'db-crud-test.js',
  'db-transaction-test.js',
  'db-integrity-test.js',
  'db-performance-test.js'
];

console.log('🚀 Running all database tests...\n');

// Create results array to track outcomes
const results = [];

// Function to run each test with proper path handling
function runTest(scriptIndex) {
  if (scriptIndex >= testScripts.length) {
    printResults();
    return;
  }
  
  const script = testScripts[scriptIndex];
  const scriptPath = path.join(__dirname, script);
  
  console.log(`\n📋 Running test: ${script}`);
  console.log('='.repeat(50));
  
  // Use exec instead of execSync to handle errors better
  exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
    if (stderr) {
      console.error(stderr);
    }
    
    console.log(stdout);
    
    if (error) {
      results.push({ script, passed: false });
      console.log(`❌ Test ${script} failed!`);
    } else {
      results.push({ script, passed: true });
      console.log(`✅ Test ${script} passed!`);
    }
    
    console.log('='.repeat(50));
    
    // Run the next test
    runTest(scriptIndex + 1);
  });
}

// Function to print results
function printResults() {
  // Print summary
  console.log('\n📊 Test Results Summary:');
  console.log('='.repeat(50));

  let passCount = 0;
  let failCount = 0;

  results.forEach(result => {
    if (result.passed) {
      console.log(`✅ ${result.script} - PASSED`);
      passCount++;
    } else {
      console.log(`❌ ${result.script} - FAILED`);
      failCount++;
    }
  });

  console.log('='.repeat(50));
  console.log(`Total: ${results.length} tests, ${passCount} passed, ${failCount} failed`);

  // Generate HTML report
  const htmlReport = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Test Results</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      h1 { color: #333; }
      .summary { margin: 20px 0; }
      .test-list { list-style-type: none; padding: 0; }
      .test-item { padding: 10px; margin: 5px 0; border-radius: 4px; }
      .pass { background-color: #dff0d8; color: #3c763d; }
      .fail { background-color: #f2dede; color: #a94442; }
      .totals { font-weight: bold; margin-top: 20px; }
    </style>
  </head>
  <body>
    <h1>Database Test Results</h1>
    <div class="summary">
      <p>Test run completed at: ${new Date().toLocaleString()}</p>
    </div>
    <ul class="test-list">
      ${results.map(result => `
        <li class="test-item ${result.passed ? 'pass' : 'fail'}">
          ${result.passed ? '✅' : '❌'} ${result.script}
        </li>
      `).join('')}
    </ul>
    <div class="totals">
      Total: ${results.length} tests, ${passCount} passed, ${failCount} failed
    </div>
  </body>
  </html>
  `;

  // Write the HTML report to a file
  fs.writeFileSync('database-test-report.html', htmlReport);
  console.log('\n📄 HTML report generated: database-test-report.html');
}

// Start running tests
runTest(0);