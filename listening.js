const { Web3 } = require('web3');
const fs = require('fs');
const { assertBytes } = require('ethereum-cryptography/utils');
const axios = require('axios');

// Connect to Ganache
const web3 = new Web3('ws://127.0.0.1:7545');

// Load ABI
const abi = JSON.parse(fs.readFileSync('contract/GestioniRecensioni/GestioneRecensioniAbi.json', 'utf8'));
const abi_t = JSON.parse(fs.readFileSync('contract/Token/MyTokenAbi.json', 'utf8'));

// Set contract address (use the one from deployment)
const contractAddress = '0xa4Ac98F855cec84e0Ed5a6088Ae5ad8EFF3C9530';
const contractAddress_t = "0xC34FAf5949811B423cE8e5849c57C4c61A101d1e";

const contract = new web3.eth.Contract(abi, contractAddress);
const contract_t = new web3.eth.Contract(abi_t, contractAddress_t);

// ----- Direct download function via HTTP POST -----
async function downloadFromIPFS(cid, outputPath) {
  const res = await axios.post(
    'http://localhost:5001/api/v0/cat',
    null,
    {
      params: { arg: cid },
      responseType: 'stream',
    }
  );
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    res.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function saveCid(cid) {
    const tempPath = "temp/temp.txt";
    await downloadFromIPFS(cid, tempPath);

    const rec = fs.readFileSync(tempPath, 'utf-8');
    //Upload the file that contains the mapping between id and salt used
    const fileIdPath = "DB/cacheDB.json";
    const idHashFile = fs.readFileSync(fileIdPath, 'utf-8');
    const parseIdHash = JSON.parse(idHashFile);
    const mapIdHash = new Map(Object.entries(parseIdHash));

    mapIdHash.set(cid, rec);

    fs.writeFileSync(fileIdPath, JSON.stringify(Object.fromEntries(mapIdHash), null, 2));

}

async function listen() {
    // Listen to the event
    contract.events.RecensioneInserita()
    .on('data', async (event) => {
        console.log('Insert Event:', event.returnValues);
        await saveCid(event.returnValues.cidIPFS);
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