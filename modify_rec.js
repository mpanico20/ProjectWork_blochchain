const { Web3 } = require('web3');
const { EthrDID } = require('ethr-did');
const { Resolver } = require('did-resolver');
const ethrDidResolver = require('ethr-did-resolver');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');

// Connect to Ganache
const web3 = new Web3('ws://127.0.0.1:7545');

// Load ABI
const abi = JSON.parse(fs.readFileSync('contract/GestioniRecensioni/GestioneRecensioniAbi.json', 'utf8'));

const contractAddress = '0xa4Ac98F855cec84e0Ed5a6088Ae5ad8EFF3C9530';
const contract_gr = new web3.eth.Contract(abi, contractAddress);

async function createDID(address, privateKey, provider, chainID) {
    return new EthrDID({
        identifier: address,
        privateKey,
        provider: provider,
        chainNameOrId: chainID,
    });
}

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

async function checkVPExists(vpJwt, expectedSubject) {

    const decoded = jwt.decode(vpJwt, { complete: true });
    const vcs = result.payload.vp.verifiableCredential;
    const decoded_h = jwt.decode(vcs[0], { complete: true });
    const vcId = decoded_h.payload.vc.id;

    // Verifica che il subject (issuer VP) corrisponda all'utente
    const vpIssuer = decoded.payload.iss;
    if (vpIssuer !== expectedSubject) {
        console.log("Il subject (utente) e l'issuer della VP non coincidono!");
        return null;
    }

    const fileIdPath = "DB/idHash.json";
    const idHashFile = fs.readFileSync(fileIdPath, 'utf-8');
    const parseIdHash = JSON.parse(idHashFile);
    const mapIdHash = new Map(Object.entries(parseIdHash));

    const salt = mapIdHash.get(vcId);
    if (!salt) {
        console.log("Nessuna recensione associata a questa VP.");
        return null;
    }

    const combined = vcId + salt;
    return Web3.utils.keccak256(combined);
}

async function main() {
    const providerUrl = 'HTTP://127.0.0.1:7545';
    const web3 = new Web3(providerUrl);
    const accounts = await web3.eth.getAccounts();
    const chainId = await web3.eth.getChainId();
    const provider = web3.currentProvider;

    const nameUser = "Alessia";
    const userAccount = accounts[4];
    const privateKeyUser = "0xfa74c2c8f64e2204ce9e090fe232bfdf8a6f826582f0cdcb57cc7510e407a74b";

    const userDID = await createDID(userAccount, privateKeyUser, provider, chainId);

    const userVP = `Wallet/${nameUser}/vp_Jwt.txt`;
    const vpJwt = fs.readFileSync(userVP, 'utf-8');

    const hash = await checkVPExists(vpJwt, userDID);
    if (!hash) return;

    const nuovaRecensione = "L'hotel ha migliorato molto rispetto all'ultima volta. Servizio impeccabile!";
    if (nuovaRecensione.length < 20 || nuovaRecensione.length > 200) {
        console.log("La recensione deve contenere tra 20 e 200 caratteri.");
        return;
    }

    const tempPath = "temp/temp.txt";
    fs.writeFileSync(tempPath, nuovaRecensione, 'utf-8');

    const cid = await uploadToIPFS(tempPath);
    if (!cid) return;

    await contract_gr.methods.modificaRecensione(cid, hash).send({ from: accounts[0], gas: 300000 });
    console.log("Recensione modificata con successo.");
}

main().catch(console.error);