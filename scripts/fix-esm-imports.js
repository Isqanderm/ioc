#!/usr/bin/env node

/**
 * Fix ESM imports by adding .js extensions to relative imports
 * This script processes all .js files in the ESM output directory
 */

const fs = require('fs');
const path = require('path');

function fixImportsInFile(filePath) {
	let content = fs.readFileSync(filePath, 'utf8');
	let modified = false;
	const fileDir = path.dirname(filePath);

	// Fix: export * from "./path" -> export * from "./path/index.js" or "./path.js"
	// Fix: export { ... } from "./path" -> export { ... } from "./path/index.js" or "./path.js"
	// Fix: import ... from "./path" -> import ... from "./path/index.js" or "./path.js"
	// But skip if already has .js extension or is a package import (doesn't start with ./ or ../)

	const patterns = [
		// export * from "./path"
		/(export\s+\*\s+from\s+['"])(\.[^'"]+)(['"])/g,
		// export { ... } from "./path"
		/(export\s+\{[^}]+\}\s+from\s+['"])(\.[^'"]+)(['"])/g,
		// import ... from "./path"
		/(import\s+(?:(?:\{[^}]+\})|(?:[^'"]+))\s+from\s+['"])(\.[^'"]+)(['"])/g,
	];

	patterns.forEach(pattern => {
		content = content.replace(pattern, (match, prefix, importPath, suffix) => {
			// Skip if already has .js extension or /index.js
			if (importPath.endsWith('.js')) {
				return match;
			}

			// Resolve the full path relative to the current file's directory
			const fullPath = path.resolve(fileDir, importPath);

			// Check if it's a directory with index.js
			const indexPath = path.join(fullPath, 'index.js');
			if (fs.existsSync(indexPath)) {
				modified = true;
				return `${prefix}${importPath}/index.js${suffix}`;
			}

			// Check if it's a file (add .js extension)
			const jsFilePath = `${fullPath}.js`;
			if (fs.existsSync(jsFilePath)) {
				modified = true;
				return `${prefix}${importPath}.js${suffix}`;
			}

			// Default: add .js extension (for cases where file might not exist yet)
			modified = true;
			return `${prefix}${importPath}.js${suffix}`;
		});
	});

	if (modified) {
		fs.writeFileSync(filePath, content, 'utf8');
		console.log(`✓ Fixed imports in: ${filePath}`);
	}
}

function processDirectory(dir) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			// Skip node_modules and package.json files
			if (entry.name !== 'node_modules') {
				processDirectory(fullPath);
			}
		} else if (entry.isFile() && entry.name.endsWith('.js')) {
			// Skip package.json marker file
			if (entry.name !== 'package.json') {
				fixImportsInFile(fullPath);
			}
		}
	}
}

// Get the ESM directory from command line argument
const esmDir = process.argv[2];

if (!esmDir) {
	console.error('Usage: node fix-esm-imports.js <esm-directory>');
	process.exit(1);
}

if (!fs.existsSync(esmDir)) {
	console.error(`Error: Directory not found: ${esmDir}`);
	process.exit(1);
}

console.log(`Fixing ESM imports in: ${esmDir}`);
processDirectory(esmDir);
console.log('✅ Done!');

