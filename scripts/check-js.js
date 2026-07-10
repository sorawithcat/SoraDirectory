const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const files = [
    'SoraDirectoryJS.js',
    'cleanComments.js',
    ...readdirSync('js')
        .filter(name => name.endsWith('.js'))
        .map(name => join('js', name))
];

for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Checked ${files.length} JavaScript files.`);
