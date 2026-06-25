import https from 'https';

// Create invoice
const createData = JSON.stringify({
    id: "test-real-link",
    fromWallet: "0xABCD1234",
    toWallet: "0xEF567890",
    recipientName: "Test Real User",
    amount: "25.50",
    currency: "USDC",
    description: "Test payment"
});

const createOpts = {
    hostname: 'arc-invoice-backend.vercel.app',
    method: 'POST',
    path: '/api/invoices/create',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': createData.length
    }
};

const req = https.request(createOpts, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('CREATE Response:', data);

        // Now fetch it
        setTimeout(() => {
            https.get('https://arc-invoice-backend.vercel.app/api/invoices/get?id=test-real-link', res2 => {
                let data2 = '';
                res2.on('data', chunk => data2 += chunk);
                res2.on('end', () => {
                    console.log('\n\nGET Response:', JSON.stringify(JSON.parse(data2), null, 2));
                });
            });
        }, 1000);
    });
});

req.write(createData);
req.end();
