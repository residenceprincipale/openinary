#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function addJsExtensionsInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Regex to find relative imports/exports without extension
  const importRegex = /(import\s+.*?\s+from\s+['"])(\.[^'"]*?)(?<!\.js)(['"])/g;
  const exportRegex = /(export\s+.*?\s+from\s+['"])(\.[^'"]*?)(?<!\.js)(['"])/g;
  // Dynamic import() — no `from` keyword
  const dynamicImportRegex = /(import\(\s*['"])(\.[^'"]*?)(?<!\.js)(['"]\s*\))/g;
  // Side-effect import "x" (no `from`), used by runtime configuration modules
  const sideEffectImportRegex = /(import\s*['"])(\.[^'"]*?)(?<!\.js)(['"])/g;
  
  let hasChanges = false;
  let newContent = content.replace(importRegex, (match, prefix, importPath, suffix) => {
    // First check if it's a directory with an index.js
    const dirPath = path.resolve(path.dirname(filePath), importPath);
    const indexPath = path.join(dirPath, 'index.js');
    
    if (fs.existsSync(indexPath) && fs.statSync(dirPath).isDirectory()) {
      hasChanges = true;
      return prefix + importPath + '/index.js' + suffix;
    }
    
    // Otherwise check if the file exists with .js extension
    const fullPath = path.resolve(path.dirname(filePath), importPath + '.js');
    if (fs.existsSync(fullPath)) {
      hasChanges = true;
      return prefix + importPath + '.js' + suffix;
    }
    return match;
  });
  
  newContent = newContent.replace(exportRegex, (match, prefix, exportPath, suffix) => {
    // First check if it's a directory with an index.js
    const dirPath = path.resolve(path.dirname(filePath), exportPath);
    const indexPath = path.join(dirPath, 'index.js');
    
    if (fs.existsSync(indexPath) && fs.statSync(dirPath).isDirectory()) {
      hasChanges = true;
      return prefix + exportPath + '/index.js' + suffix;
    }
    
    // Otherwise check if the file exists with .js extension
    const fullPath = path.resolve(path.dirname(filePath), exportPath + '.js');
    if (fs.existsSync(fullPath)) {
      hasChanges = true;
      return prefix + exportPath + '.js' + suffix;
    }
    return match;
  });
  
  newContent = newContent.replace(dynamicImportRegex, (match, prefix, importPath, suffix) => {
    const dirPath = path.resolve(path.dirname(filePath), importPath);
    const indexPath = path.join(dirPath, 'index.js');
    
    if (fs.existsSync(indexPath) && fs.statSync(dirPath).isDirectory()) {
      hasChanges = true;
      return prefix + importPath + '/index.js' + suffix;
    }
    
    const fullPath = path.resolve(path.dirname(filePath), importPath + '.js');
    if (fs.existsSync(fullPath)) {
      hasChanges = true;
      return prefix + importPath + '.js' + suffix;
    }
    return match;
  });

  newContent = newContent.replace(sideEffectImportRegex, (match, prefix, importPath, suffix) => {
    const dirPath = path.resolve(path.dirname(filePath), importPath);
    const indexPath = path.join(dirPath, 'index.js');
    if (fs.existsSync(indexPath) && fs.statSync(dirPath).isDirectory()) {
      hasChanges = true;
      return prefix + importPath + '/index.js' + suffix;
    }
    const fullPath = path.resolve(path.dirname(filePath), importPath + '.js');
    if (fs.existsSync(fullPath)) {
      hasChanges = true;
      return prefix + importPath + '.js' + suffix;
    }
    return match;
  });

  if (hasChanges) {
    fs.writeFileSync(filePath, newContent);
    console.log(`Added .js extensions in: ${path.relative(process.cwd(), filePath)}`);
  }
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDirectory(filePath);
    } else if (file.endsWith('.js')) {
      addJsExtensionsInFile(filePath);
    }
  }
}

// Node ESM needs explicit extensions that tsc (moduleResolution "bundler")
// leaves out. Runs on the dist folder of the package that calls it.
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  console.log('Adding .js extensions to compiled files...');
  walkDirectory(distPath);
  console.log('Done!');
} else {
  console.log('Dist folder not found');
}