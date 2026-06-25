import https from 'https';

https.get('https://arc-invoice-backend.vercel.app/api/invoices/get?id=test-123', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log(JSON.stringify(JSON.parse(data), null, 2));
    });
}).on('error', err => console.error('Error:', err.message));
