const { Web3 } = require('web3');
const fs = require('fs');
const axios = require('axios');

// Connect to Ganache
const web3 = new Web3('ws://127.0.0.1:7545');

// Load ABI
const abi = JSON.parse(fs.readFileSync('contract/GestioniRecensioni/GestioneRecensioniAbi.json', 'utf8'));

// Set contract address (use the one from deployment)
const contractAddress = '0x6f284790EFd756e93e81B7F10e061255DfeFbDE9';

const contract = new web3.eth.Contract(abi, contractAddress);

//Direct download function via HTTP POST
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


async function main() {
    try{
        const providerUrl = 'HTTP://127.0.0.1:7545';
        const web3 = new Web3(providerUrl);
        const accounts = await web3.eth.getAccounts();

        //Hotel data
        const hotelAccount = accounts[1];

        //Take the active review from the contract and initialize the variable
        const cids = await contract.methods.visualizzaRecensioniAttive(hotelAccount).call();
        let pos = 0;
        let negative = 0;
        let recPos = [];
        let recNeg = [];

        //For each cid download the equivalent rec and sentiment and check for possible answers
        for(let i = 0; i < cids.length; i++){
            const tempPath = "temp/temp.txt";
            await downloadFromIPFS(cids[i], tempPath);
            const raw = fs.readFileSync(tempPath, 'utf8');
            const rec = JSON.parse(raw);
            const rcid = await contract.methods.getRisposta(cids[i]).call();
            if(rcid.cidRisp){
                await downloadFromIPFS(rcid.cidRisp, tempPath);
                const raw1 = fs.readFileSync(tempPath, 'utf-8');
                const rec1 = JSON.parse(raw1);

                const obj = {rec: rec.rec, risp: rec1};
                if(rec.sentiment){
                    pos++;
                    recPos.push(obj);
                }else{
                    negative++;
                    recNeg.push(obj);
                }
            } else {
                if(rec.sentiment){
                    pos++;
                    recPos.push({rec: rec.rec});
                }else{
                    negative++;
                    recNeg.push({rec: rec.rec});
                }
            }
        }

        //check which reviews to show first based on sentiment
        if(pos >= negative){
            recPos.forEach((r, i) => {
                if (typeof r === 'object' && r.rec) {
                console.log(`${i + 1}. ${r.rec}`);
                if (r.risp && r.risp.rec) {
                console.log(`   ↳ Risposta: ${r.risp.rec}`);
                }
            }
            });
            recNeg.forEach((r, i) => {
                if (typeof r === 'object' && r.rec) {
                console.log(`${i + 1}. ${r.rec}`);
                if (r.risp && r.risp.rec) {
                console.log(`   ↳ Risposta: ${r.risp.rec}`);
                }
            }
            });
        } else {
            recNeg.forEach((r, i) => {
                if (typeof r === 'object' && r.rec) {
                console.log(`${i + 1}. ${r.rec}`);
                if (r.risp && r.risp.rec) {
                console.log(`   ↳ Risposta: ${r.risp.rec}`);
                }
            }
            });
            recPos.forEach((r, i) => {
                if (typeof r === 'object' && r.rec) {
                console.log(`${i + 1}. ${r.rec}`);
                if (r.risp && r.risp.rec) {
                console.log(`   ↳ Risposta: ${r.risp.rec}`);
                }
            }
            });
        }

    } catch (err){
        console.log(err);
    }
}

main().catch(console.error);