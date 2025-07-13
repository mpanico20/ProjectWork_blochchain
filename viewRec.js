const { Web3 } = require('web3');
const fs = require('fs');

// Connect to Ganache
const web3 = new Web3('ws://127.0.0.1:7545');

// Load ABI
const abi = JSON.parse(fs.readFileSync('contract/GestioniRecensioni/GestioneRecensioniAbi.json', 'utf8'));

// Set contract address (use the one from deployment)
const contractAddress = '0xa4Ac98F855cec84e0Ed5a6088Ae5ad8EFF3C9530';

const contract = new web3.eth.Contract(abi, contractAddress);


async function main() {
    try{
        const providerUrl = 'HTTP://127.0.0.1:7545';
        const web3 = new Web3(providerUrl);
        const accounts = await web3.eth.getAccounts();

        //Hotel data
        const hotelAccount = accounts[1];

        const cids = await contract.methods.visualizzaRecensioniAttive(hotelAccount).call();

        //Upload the file that contains the mapping between id and salt used
        const fileIdPath = "DB/cacheDB.json";
        const idHashFile = fs.readFileSync(fileIdPath, 'utf-8');
        const parseIdHash = JSON.parse(idHashFile);
        const mapIdHash = new Map(Object.entries(parseIdHash));

        for(let i = 0; i < cids.length; i++){
            const rec = mapIdHash.get(cids[i]);
            const rcid = await contract.methods.getRisposta(cids[i]).call();
            if(rcid.cidRisp){
                const recr = mapIdHash.get(rcid.cidRisp);
                console.log(rec);
                console.log("       ", recr);
            } else {
                console.log(rec);
            }
        }

    } catch (err){
        console.log(err);
    }
}

main().catch(console.error);