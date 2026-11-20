'use strict';
const crypto=require('node:crypto');
const validCode=value=>typeof value==='string'&&/^\d{6}$/.test(value);
function newCode(occupied,randomInt=crypto.randomInt){for(let n=0;n<1000;n++){const code=String(randomInt(1000000)).padStart(6,'0');if(!occupied.has(code))return code;}throw new Error('No room codes available');}
module.exports={validCode,newCode};
