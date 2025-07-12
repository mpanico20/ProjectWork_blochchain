const { Web3 } = require('web3');
const fs = require('fs');
const { assertBytes } = require('ethereum-cryptography/utils');

// Connect to Ganache
const web3 = new Web3('ws://127.0.0.1:7545');

// Load ABI
const abi = JSON.parse(fs.readFileSync('contract/GestioniRecensioni/GestioneRecensioniAbi.json', 'utf8'));

// Set contract address (use the one from deployment)
const contractAddress = '0xAc59a723c2ab90e06EF39E5fc0E160f9a68677F7';

const contract = new web3.eth.Contract(abi, contractAddress);

async function listen() {
    // Listen to the event
    contract.events.RecensioneInserita()
    .on('data', (event) => {
        console.log('Insert Event:', event.returnValues);
    });
    contract.events.RecensioneModificata()
    .on('data', (event) => {
        console.log('Modified Event:', event.returnValues);
    });
    contract.events.RispostaInserita()
    .on('data', (event) => {
        console.log('Answer Event:', event.returnValues);
    });

    
}

listen().catch(console.error);