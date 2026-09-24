const fs = require('node:fs');
const html = fs.readFileSync('app.html', 'utf8');
fs.writeFileSync('app-html.js', `export default ${JSON.stringify(html)};\n`);
