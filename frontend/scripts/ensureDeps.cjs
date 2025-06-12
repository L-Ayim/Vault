const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const modulesPath = path.join(projectRoot, 'node_modules');

if (!fs.existsSync(modulesPath)) {
  console.log('node_modules not found. Installing dependencies...');
  execSync('npm install', { stdio: 'inherit', cwd: projectRoot });
}
