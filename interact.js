const { Web3 } = require('web3');
const fs = require('fs');
const { bytes } = require('@noble/hashes/_assert');

// Connect to Ganache
const web3 = new Web3('ws://127.0.0.1:7545');

// Load ABI
const abi = JSON.parse(fs.readFileSync('contract/GestioniRecensioni/GestioneRecensioniAbi.json', 'utf8'));

// Set contract address (use the one from deployment)
const contractAddress = '0x95B78b69558F14D79fa2a8e5297B28736976e7b2';

const contract = new web3.eth.Contract(abi, contractAddress);

async function interactWithContract() {
    const accounts = await web3.eth.getAccounts();

    console.log('Interacting from account:', accounts[0]);
    const bytes32 = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const bytes33 = "0x1234567890abcdef1234567890abcdef1234567990abcdef1234560890abcdef";
    const bytes34 = "0x1234567890abcdef1234567890abcdef2234567990abcdef1234560890abcdef";
    const bytes35 = "0x1434567890abcdef1234567890abcdef1234567990abcdef1234560890abcdef";

   await contract.methods.inserisciRecensione("CID3", true, bytes34, accounts[1], accounts[2]).send({ from: accounts[0], gas: 200000 });
   console.log("cid3")
    try {
    await contract.methods.inserisciRecensione("CID3", true, bytes34, accounts[1], accounts[2]).send({ from: accounts[0], gas: 200000 });
    const num = await contract.methods.visualizzaRecensioniAttive(accounts[1]).call();
     }catch (error) {
        console.error('Recensione già inserita:', error.message || error);
    }
    await contract.methods.inserisciRecensione("rec1", true, bytes32, accounts[1], accounts[2]).send({ from: accounts[0], gas: 200000 });
    await contract.methods.modificaRecensione(bytes32, "CID1MOD").send({ from: accounts[0], gas: 200000 });
    await contract.methods.inserisciRecensione("CID356", true, bytes33, accounts[1], accounts[2]).send({ from: accounts[0], gas: 200000 });
    const verifica = await contract.methods.eliminaRecensione(bytes33).send({ from: accounts[0], gas: 200000 });
    if (verifica){
        console.log("Recensione eliminata");
    } else {
        console.log("Eliminazione non riuscita");
    }
    const num = await contract.methods.visualizzaRecensioniAttive(accounts[1]).call();
    console.log("Recensioni per hotel :",num);
    const cidhotel = await contract.methods.visualizzaRecensioniHotel(accounts[1]).call({from: accounts[0]});

    console.log("Tutte le recensioni per hotel :", cidhotel);
    try {
        await contract.methods.inserisciRisposta("CID3", "RISP21", accounts[1]).send({ from: accounts[0], gas: 200000 });
    }catch (error) {
        console.error('Risposta alla recensione già inserita:', error.message || error);
    }

    const risphotel = await contract.methods.getRisposta("CID3").call({from: accounts[0]});
    console.log("Tutte le recensioni per hotel :", risphotel);
  


}

interactWithContract().catch(console.error);

