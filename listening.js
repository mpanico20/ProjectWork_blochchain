//Library imports
const { Web3 } = require('web3');
const fs = require('fs');
const axios = require('axios');

// Connect to Ganache
const web3 = new Web3('ws://127.0.0.1:7545');

// Load ABI
const abi = JSON.parse(fs.readFileSync('contract/GestioniRecensioni/GestioneRecensioniAbi.json', 'utf8'));
const abi_t = JSON.parse(fs.readFileSync('contract/Token/MyTokenAbi.json', 'utf8'));

// Set contract address (use the one from deployment)
const contractAddress = '0x992165285F6CF05d03cFE7b153cfbAbba86f21DE';
const contractAddress_t = "0x40f4090D0158e58DA73fB75334211Da0876dd409";

const contract = new web3.eth.Contract(abi, contractAddress);
const contract_t = new web3.eth.Contract(abi_t, contractAddress_t);

async function listen() {
    // Listen to the event
    contract.events.RecensioneInserita()
    .on('data', async (event) => {
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
    contract_t.events.Transfer()
    .on('data', (event) => {
        console.log('Tranfer Event:', event.returnValues);
    });
}

listen().catch(console.error);