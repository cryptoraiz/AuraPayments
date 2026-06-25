import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
console.log('PG_URL_START>' + process.env.POSTGRES_URL + '<PG_URL_END>');
