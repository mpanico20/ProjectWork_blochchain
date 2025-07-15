//Library imports
const { Web3 } = require('web3');
const { EthrDID } = require('ethr-did');
const { Resolver } = require('did-resolver');
const ethrDidResolver = require('ethr-did-resolver');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const FormData = require('form-data');
const {
  verifyPresentation,
  verifyCredential
} = require('did-jwt-vc');

// Connect to Ganache
const web3 = new Web3('ws://127.0.0.1:7545');

// Load ABI of the 2 contract
const abi = JSON.parse(fs.readFileSync('contract/GestioniRecensioni/GestioneRecensioniAbi.json', 'utf8'));

//Address for GestioniRecensioni Contract
const contractAddress = '0xc2985daA8C89d12Ced11e4d5e57967F4EAE0Cf39';

const contract_gr = new web3.eth.Contract(abi, contractAddress);

//Create the DID of the actors
async function createDID(address, privateKey, provider, chainID) {
    return new EthrDID({
        identifier: address,
        privateKey,
        provider: provider,
        chainNameOrId: chainID,
    });
}

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

//Function to check if VP exist
async function checkVPExists(vpJwt, subject, issuer_h, didResolver) {


    const result = await verifyPresentation(vpJwt, didResolver);

    //Check on the subject
    if(result.issuer != subject){
        console.log("The subject (user) and the issuer of the vp are not equal!");
        return;
    }

    //Decode the User VP and take the VC inside
    const decoded = jwt.decode(vpJwt, { complete: true });
    const vpPayload = decoded.payload;
    const vcs = vpPayload.vp.verifiableCredential;

    //Check for the hotel's vc
    const verifiedVCh = await verifyCredential(vcs[0], didResolver);

    if(verifiedVCh.issuer != issuer_h){
        console.log("The hotel's vc is not signed correctly!");
        return;
    }

    const decoded_h = jwt.decode(vcs[0], { complete: true});
    const subjH = decoded_h.payload.vc.credentialSubject.id;
    const vcId = decoded_h.payload.vc.id;

    //Check if the subject of the VCs is the same that presented the VP
    if(result.issuer != subjH){
        console.log("The subject of the VC does not match the VP issuer!");
        return;
    }

    //Load the DB fot check the VC id
    const fileIdPath = "DB/idHash.json";
    const idHashFile = fs.readFileSync(fileIdPath, 'utf-8');
    const parseIdHash = JSON.parse(idHashFile);
    const mapIdHash = new Map(Object.entries(parseIdHash));

    //Take the salt
    const salt = mapIdHash.get(vcId);
    if (!salt) {
        console.log("Nessuna recensione associata a questa VP.");
        return null;
    }

    //Combine the vcID and salt to calculate the hash with Keccak256
    const combined = vcId + salt;
    return Web3.utils.keccak256(combined);
}

async function main() {
    const providerUrl = 'HTTP://127.0.0.1:7545';
    const web3 = new Web3(providerUrl);

    //Address for DID contract
    const address_r = "0xf1Db7CD3fE00D007a04e6987c50D18C260F54369";

    // Retrieve account from Ganache
    const accounts = await web3.eth.getAccounts();
    const chainId = await web3.eth.getChainId();
    const provider = web3.currentProvider;

    //User data
    const nameUser = "Pasquale";
    const userAccount = accounts[5];
    const privateKeyUser = "0x333cd7a33a9f0154095c5a1366625160564cd472acd21284ae68d4e44352de21";
    
    //Hotel data. Change the accound and private key to use another hotel
    const hotelAccount = accounts[1];
    const privateKeyHotel = "0x0b039446a2241a02d745abd0de558356aa8a2711631390ccfcf531b01dcde190";

    //Create user DID
    const userDID = await createDID(userAccount, privateKeyUser, provider, chainId);

    //Create hotel DID
    const hotelDID = await createDID(hotelAccount, privateKeyHotel, provider, chainId);

    //Louad the VP
    const userVP = `Wallet/${nameUser}/vp_Jwt.txt`;
    const vpJwt = fs.readFileSync(userVP, 'utf-8');

    //Configuration of the resolver
    const registryAddress = address_r;
    const resolverConfig = {
        networks: [{
            name: chainId,
            rpcUrl: providerUrl,
            chainId: chainId,
            registry: registryAddress
        }]
    };
    const didResolver = new Resolver(ethrDidResolver.getResolver(resolverConfig));

    //Check if VP exist
    const hash = await checkVPExists(vpJwt, userDID.did, hotelDID.did, didResolver);
    if (!hash) return;

    //Review
    const nuovaRecensione = {rec: "L'hotel è veramente sporco! E il personale davvero incompetente. Sconsigliato."};

    //Check the review
    if (nuovaRecensione.rec.length < 20 || nuovaRecensione.rec.length > 200) {
        console.log("The review must contain between 20 and 200 characters.");
        return;
    }

    //Uploading the review on IPFS
    const tempPath = "temp/temp.txt";
    fs.writeFileSync(tempPath, JSON.stringify(nuovaRecensione), 'utf-8');

    const cid = await uploadToIPFS(tempPath);
    if (!cid) return;

    //Call the smart contract
    await contract_gr.methods.modificaRecensione(hash, cid).send({ from: accounts[0], gas: 300000 });
    console.log("Review successfully updated.");
}

main().catch(console.error);