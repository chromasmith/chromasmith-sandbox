const { generate } = require('./nl-playbook-generate.cjs');
const fs = require('fs').promises;
const path = require('path');

async function runTests() {
  console.log('🧪 Testing NL Playbook Generator\n');
  
  const testCases = [
    {
      description: "Handle payment processing errors with retry",
      expectedIntent: "incident"
    },
    {
      description: "Validate all feature maps before deployment",
      expectedIntent: "validate"
    }
  ];
  
  let passed = 0;
  const generatedFiles = [];
  
  for (const testCase of testCases) {
    try {
      console.log(\`📝 Generating: "\${testCase.description}"\`);
      
      // Dry run first
      const dryResult = await generate(testCase.description, { dryRun: true, includeCode: false });
      console.log(\`   Intent detected: \${dryResult.discovery.intent}\`);
      console.log(\`   File would be: \${dryResult.fileName}\`);
      console.log(\`   Verbs: \${dryResult.discovery.verbs.length}\`);
      
      if (dryResult.discovery.intent === testCase.expectedIntent) {
        console.log('   ✅ Intent matches expected\n');
        passed++;
      } else {
        console.log(\`   ⚠️  Intent mismatch (expected: \${testCase.expectedIntent})\n\`);
      }
    } catch (err) {
      console.log(\`   ❌ Generation failed: \${err.message}\n\`);
    }
  }
  
  // Test actual file generation (one example)
  try {
    console.log('📝 Testing actual file generation...');
    const result = await generate("Quick health check", { 
      name: "test-generated-playbook",
      dryRun: false 
    });
    
    const fileExists = await fs.access(result.filePath)
      .then(() => true)
      .catch(() => false);
    
    if (fileExists) {
      console.log('   ✅ File created successfully');
      console.log(\`   Path: \${result.filePath}\`);
      generatedFiles.push(result.filePath);
      passed++;
      
      // Clean up test file
      await fs.unlink(result.filePath);
      console.log('   🧹 Test file cleaned up\n');
    } else {
      console.log('   ❌ File was not created\n');
    }
  } catch (err) {
    console.log(\`   ❌ File generation failed: \${err.message}\n\`);
  }
  
  console.log(\`\n📊 Results: \${passed}/3 passed\`);
  return passed === 3;
}

if (require.main === module) {
  runTests().then(success => process.exit(success ? 0 : 1));
}

module.exports = { runTests };