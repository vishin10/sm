const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src/renderer');
const destDir = path.join(__dirname, '../dist/renderer');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

fs.readdirSync(srcDir).forEach(file => {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);

    if (path.extname(file) === '.html' || path.extname(file) === '.css') {
        fs.copyFileSync(srcFile, destFile);
        console.log(`Copied ${file} to dist/renderer`);
    }
});
