//Library imports
const { Web3 } = require('web3');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

// Connect to Ganache
const web3 = new Web3('http://127.0.0.1:7545');

// Load ABI of the contract
const abi = JSON.parse(fs.readFileSync('contract/GestioniRecensioni/GestioneRecensioniAbi.json', 'utf8'));

//Address contract GestioniRecensioni
const contractAddress = '0xc2985daA8C89d12Ced11e4d5e57967F4EAE0Cf39';

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

        // Retrieve account from Ganache
        const accounts = await web3.eth.getAccounts();

        //Hotel information 
        //Change the accound to use another hotel
        const hotelAccount = accounts[1];

        //Review cid to asnwer
        const cid = "QmYX3QUkt7V1aKpYy8zRpR2R2Bbf5MwBMqR9Sthyu1wiM2";

        const tempPath = "temp/temp.txt";

        const ansewr = { anw: "Si buon tu! Ma ti sei visto!"};

        //Check the answer
        if (ansewr.anw.length < 20 || ansewr.anw.length > 200) {
            console.log("The comment must contain between 20 and 200 characters.");
            return;
        }
        
        fs.writeFileSync(tempPath, JSON.stringify(ansewr), 'utf-8');
        
        //Uploading the review on IPFS
        console.log("Uploading answer on IPFS...");
        const cidr = await uploadToIPFS(tempPath);
        console.log("Cid answer:", cidr);
        //Call the smart contract
        await contract_gr.methods.inserisciRisposta(cid, cidr, hotelAccount).send({ from: accounts[0], gas: 300000 });
    } catch(err){
        console.log(err);
    }
    
}

main().catch(console.error);