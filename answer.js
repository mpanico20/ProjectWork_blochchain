const { Web3 } = require('web3');
const { EthrDID } = require('ethr-did');
const {
  createVerifiableCredentialJwt,
  createVerifiablePresentationJwt,
  verifyPresentation,
  verifyCredential
} = require('did-jwt-vc');
const { Resolver } = require('did-resolver');
const ethrDidResolver = require('ethr-did-resolver');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');

// Connect to Ganache
const web3 = new Web3('ws://127.0.0.1:7545');

// Load ABI of the 2 contract
const abi = JSON.parse(fs.readFileSync('contract/GestioniRecensioni/GestioneRecensioniAbi.json', 'utf8'));

const contractAddress = '0x60BeCa1ce29f9A423689484052Ad7bAF7FB55229';

const contract_gr = new web3.eth.Contract(abi, contractAddress);

//Direct upload function via HTTP POST
async function uploadToIPFS(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  const res = await axios.post('http://localhost:5001/api/v0/add', form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
  });
  let data = res.data;
  if (typeof data === 'string') {
    const lines = data.trim().split('\n');
    data = JSON.parse(lines[lines.length - 1]);
  }
  return data.Hash;
}

async function main() {
    try{
        const providerUrl = 'HTTP://127.0.0.1:7545';
        const web3 = new Web3(providerUrl);

        // Retrieve hotel account and chainId from Ganache
        const accounts = await web3.eth.getAccounts();

        //Hotel data. Change the accound and private key to use another hotel
        const hotelAccount = accounts[1];

        const cid = "QmYX3QUkt7V1aKpYy8zRpR2R2Bbf5MwBMqR9Sthyu1wiM2";

        //Check the review. Uncomment for use different review
        const tempPath = "temp/temp.txt";

        const ansewr = { anw: "Non mi sono per niente offeso! Secondo me menti."};
        
        if (ansewr.anw.length < 20 || ansewr.anw.length > 200) {
            console.log("La recensione deve contenere tra 20 e 200 caratteri.");
            return;
        }
        
        fs.writeFileSync(tempPath, JSON.stringify(ansewr), 'utf-8');
        
        //Uploading the review and the sentiment on IPFS
        console.log("Uploading answer on IPFS...");
        const cidr = await uploadToIPFS(tempPath);
        console.log("Cid answer:", cidr);

        await contract_gr.methods.inserisciRisposta(cid, cidr, hotelAccount).send({ from: accounts[0], gas: 300000 });
    } catch(err){
        console.log(err);
    }
    
}

main().catch(console.error);