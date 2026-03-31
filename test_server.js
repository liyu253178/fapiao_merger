const http = require('http');
http.get('http://127.0.0.1:9988/', (r) => {
  let d = '';
  r.on('data', (c) => d += c);
  r.on('end', () => {
    console.log('Status:', r.statusCode);
    console.log('Length:', d.length);
    console.log('First 200:', d.substring(0, 200));
  });
}).on('error', (e) => console.log('Err:', e.message));
