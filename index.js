const fs = require('fs');
const path = require('path');
const app = require('./src/app.js');

//const [,, ...args] = process.argv;
//console.log(`Argument: ${args[0]}`);
//process.exit();

const filePath = path.join(__dirname, 'migrations_data.json')
const contents = fs.readFileSync(filePath, 'utf8');
const ENV_CONFIG = JSON.parse(contents);

app(ENV_CONFIG);