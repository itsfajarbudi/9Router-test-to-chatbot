const http = require('http');

http.get('http://localhost:20128/dashboard/providers', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('Body snippet:', data.substring(0, 1000));
  });
}).on('error', err => console.error(err));
