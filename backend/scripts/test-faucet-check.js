import https from 'https';

const ADDRESS = '0xB4a6d29844d54a96be120F8d750B39C6Bc2C1045';

const options = {
    hostname: 'arc-invoice-backend-danilos-projects-b6373e8b.vercel.app',
    port: 443,
    path: `/api/faucet/check?address=${ADDRESS}`,
    method: 'GET',
};

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
    });
});

req.on('error', (e) => {
    console.error('Error:', e);
});

req.end();
