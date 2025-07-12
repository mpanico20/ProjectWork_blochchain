const { Web3 } = require('web3');
const fs = require('fs');
const { bytes } = require('@noble/hashes/_assert');

// Connect to Ganache
const web3 = new Web3('ws://127.0.0.1:7545');

// Load ABI
const abi = JSON.parse(fs.readFileSync('GestioneRecensioniAbi.json', 'utf8'));

// Set contract address (use the one from deployment)
const contractAddress = '0x3F57e1bf71D39b25Fb21247A8624F75CDbb811B6';

const contract = new web3.eth.Contract(abi, contractAddress);

async function interactWithContract() {
    const accounts = await web3.eth.getAccounts();

    console.log('Interacting from account:', accounts[0]);
    const bytes32 = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const bytes33 = "0x1234567890abcdef1234567890abcdef1234567990abcdef1234560890abcdef";
    const bytes34 = "0x1234567890abcdef1234567890abcdef2234567990abcdef1234560890abcdef";
    const bytes35 = "0x1434567890abcdef1234567890abcdef1234567990abcdef1234560890abcdef";


    await contract.methods.inserisciRecensione("rec1", true, bytes32, accounts[1], accounts[2]).send({ from: accounts[0], gas: 200000 });
    await contract.methods.modificaRecensione(bytes32, "CID1MOD").send({ from: accounts[0], gas: 200000 });
    await contract.methods.inserisciRecensione("CID356", true, bytes33, accounts[1], accounts[2]).send({ from: accounts[0], gas: 200000 });
    const verifica = await contract.methods.eliminaRecensione(bytes33).send({ from: accounts[0], gas: 200000 });
    if (verifica){
        console.log("Recensione eliminata");
    } else {
        console.log("Eliminazione non riuscita");
    }
    await contract.methods.inserisciRecensione("CID3", true, bytes34, accounts[1], accounts[2]).send({ from: accounts[0], gas: 200000 });
    const num = await contract.methods.visualizzaRecensioniAttive(accounts[1]).call();

    console.log("Recensioni per hotel :",num);
    const cidhotel = await contract.methods.visualizzaRecensioniHotel(accounts[1]).call();

    console.log("Tutte le recensioni per hotel :", cidhotel.length);

}

interactWithContract().catch(console.error);

