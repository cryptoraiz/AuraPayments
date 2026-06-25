import { ethers } from 'ethers';
const wallet = ethers.Wallet.createRandom();
console.log('ADDRESS:' + wallet.address);
console.log('KEY:' + wallet.privateKey);
