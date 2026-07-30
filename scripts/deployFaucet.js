const fs = require('fs');
const solc = require('solc');
const { ethers } = require('ethers');
require('dotenv').config({ path: '.env.production' });

async function main() {
    console.log("Compiling Faucet.sol...");
    const source = fs.readFileSync('contracts/Faucet.sol', 'utf8');
    
    const input = {
        language: 'Solidity',
        sources: {
            'Faucet.sol': {
                content: source,
            },
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
        },
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    
    if (output.errors && output.errors.length > 0) {
        let hasErrors = false;
        for (const error of output.errors) {
            console.log(error.formattedMessage);
            if (error.severity === 'error') hasErrors = true;
        }
        if (hasErrors) {
            console.error("Compilation failed.");
            process.exit(1);
        }
    }

    const contract = output.contracts['Faucet.sol']['Faucet'];
    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    // Save ABI for frontend
    fs.writeFileSync('frontend/src/config/FaucetABI.json', JSON.stringify(abi, null, 2));
    console.log("ABI saved to frontend/src/config/FaucetABI.json");

    // Setup Provider and Wallet
    const provider = new ethers.JsonRpcProvider('https://rpc.testnet.arc.network');
    let privateKey = process.env.FAUCET_PRIVATE_KEY;
    if (!privateKey) throw new Error("Missing FAUCET_PRIVATE_KEY env variable");
    
    // Clean up any brackets if the user pasted them by accident
    privateKey = privateKey.replace(/[\[\]]/g, '');
    
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log("Deploying with wallet:", wallet.address);

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    
    const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
    
    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    const retryTx = async (action, retries = 5) => {
        while (retries > 0) {
            try {
                return await action();
            } catch (err) {
                if (err.error && err.error.message === 'request limit reached') {
                    console.log("RPC Rate limit hit, retrying in 2 seconds...");
                    retries--;
                    if (retries === 0) throw err;
                    await delay(2000);
                } else {
                    throw err;
                }
            }
        }
    };

    console.log("Deploying Faucet contract...");
    const faucet = await retryTx(() => factory.deploy(USDC_ADDRESS));
    
    console.log("Waiting for deployment...");
    await faucet.waitForDeployment();
    
    const address = await faucet.getAddress();
    console.log("Faucet deployed to:", address);

    console.log("Transferring 10,000 USDC to Faucet to fund it...");
    const usdcAbi = ["function transfer(address to, uint256 amount) returns (bool)"];
    const usdc = new ethers.Contract(USDC_ADDRESS, usdcAbi, wallet);
    
    const fundAmount = ethers.parseUnits("10000", 6); // 10,000 USDC (6 decimals)
    const tx = await retryTx(() => usdc.transfer(address, fundAmount));
    console.log("Funding tx hash:", tx.hash);
    await tx.wait();
    console.log("Faucet successfully funded with 10,000 USDC!");
}

main().catch(console.error);
