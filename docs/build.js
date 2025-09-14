const fs = require('fs');
const path = require('path');

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Copy HTML file to dist
const htmlSource = path.join(__dirname, 'index.html');
const htmlDest = path.join(distDir, 'index.html');
fs.copyFileSync(htmlSource, htmlDest);

// Copy OpenAPI spec to dist
const yamlSource = path.join(__dirname, 'openapi.yaml');
const yamlDest = path.join(distDir, 'openapi.yaml');
fs.copyFileSync(yamlSource, yamlDest);

console.log('✅ Swagger UI documentation built successfully!');
console.log('📁 Output directory: ./dist');
console.log('🌐 To serve: npm run serve');