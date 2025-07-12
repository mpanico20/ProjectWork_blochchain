const { Web3 } = require('web3');
const fs = require('fs');

// Connect to Ganache
const web3 = new Web3('http://127.0.0.1:7545');

// Load ABI and Bytecode
const abi = JSON.parse(fs.readFileSync('GestioneRecensioniAbi.json', 'utf8'));
const bytecode = fs.readFileSync('GestioneRecensioniBytecode.bin', 'utf8');

async function deployContract() {
    const accounts = await web3.eth.getAccounts();
    console.log('Bytecode length (bytes):', bytecode.length / 2);

    console.log('Deploying from account:', accounts[0]);

    const contract = new web3.eth.Contract(abi);
    const deployedContract = await contract
        .deploy({ data: '0x' + bytecode })
        .send({ from: accounts[0], gas: 6000000, gasPrice: '30000000000' });
    
    console.log('Contract deployed at address:', deployedContract.options.address);
}

deployContract().catch(console.error);
