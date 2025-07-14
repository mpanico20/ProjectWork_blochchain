// Importazione delle librerie necessarie
const { Web3 } = require('web3'); // Per interagire con Ethereum
const { EthrDID } = require('ethr-did'); // Per creare un DID conforme a ethr-did
const { Resolver } = require('did-resolver'); // Per risolvere un DID
const ethrDidResolver = require('ethr-did-resolver'); // Resolver specifico per ethr-did
const fs = require('fs'); // Per la gestione del file system
const jwt = require('jsonwebtoken'); // Per decodificare JSON Web Tokens (VP/VC)
const crypto = require('crypto'); // Non usato qui, ma può servire per hashing o random
const axios = require('axios'); // Per fare richieste HTTP (verso IPFS)
const FormData = require('form-data'); // Per creare il corpo della richiesta multipart/form-data
const {
  createVerifiableCredentialJwt,
  createVerifiablePresentationJwt,
  verifyPresentation,
  verifyCredential
} = require('did-jwt-vc');

// Connessione a Ganache tramite WebSocket (necessaria per eventi e interazioni live)
const web3 = new Web3('ws://127.0.0.1:7545');

// Caricamento dell'ABI (Application Binary Interface) del contratto smart
const abi = JSON.parse(fs.readFileSync('contract/GestioniRecensioni/GestioneRecensioniAbi.json', 'utf8'));

// Indirizzo del contratto deployato sulla blockchain
const contractAddress = '0x60BeCa1ce29f9A423689484052Ad7bAF7FB55229';

// Istanza del contratto per poter chiamare i metodi pubblici
const contract_gr = new web3.eth.Contract(abi, contractAddress);

// Funzione per creare un oggetto DID dell'utente
async function createDID(address, privateKey, provider, chainID) {
    return new EthrDID({
        identifier: address,
        privateKey,
        provider: provider,
        chainNameOrId: chainID,
    });
}

// Funzione per caricare un file su IPFS tramite API HTTP locale
async function uploadToIPFS(filePath) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath)); // Aggiunge il file alla form multipart

    const res = await axios.post('http://localhost:5001/api/v0/add', form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity, // IPFS può accettare file grandi
    });

    // Parsing della risposta (può essere stringa o JSON, a seconda della versione di IPFS)
    let data = res.data;
    if (typeof data === 'string') {
        const lines = data.trim().split('\n');
        data = JSON.parse(lines[lines.length - 1]); // Prende solo l'ultima riga con i dati
    }

    return data.Hash; // Restituisce il CID (Content Identifier)
}

// Funzione che controlla se la VP è valida e calcola l’hash della recensione da modificare
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

    // Lettura del file locale che mappa ogni VC ID con un salt segreto
    const fileIdPath = "DB/idHash.json";
    const idHashFile = fs.readFileSync(fileIdPath, 'utf-8');
    const parseIdHash = JSON.parse(idHashFile);
    const mapIdHash = new Map(Object.entries(parseIdHash));

    // Recupero del salt corrispondente al vcId
    const salt = mapIdHash.get(vcId);
    if (!salt) {
        console.log("Nessuna recensione associata a questa VP.");
        return null;
    }

    // Combinazione tra vcId e salt e calcolo hash con Keccak256
    const combined = vcId + salt;
    return Web3.utils.keccak256(combined); // Hash identificativo della recensione
}

// Funzione principale asincrona
async function main() {
    // Connessione HTTP a Ganache (usata per getAccounts e getChainId)
    const providerUrl = 'HTTP://127.0.0.1:7545';
    const web3 = new Web3(providerUrl);

    const address_r = "0xCB0e1CaBe7FA1605d9e63f92d48f6EE072387A2f"; // <-- replace with the DID contract address

    // Recupero degli account locali e chain ID
    const accounts = await web3.eth.getAccounts();
    const chainId = await web3.eth.getChainId();
    const provider = web3.currentProvider;

    // Dati utente (Alessia) che vuole modificare la recensione
    const nameUser = "Pasquale";
    const userAccount = accounts[5]; // Account dell’utente
    const privateKeyUser = "0x333cd7a33a9f0154095c5a1366625160564cd472acd21284ae68d4e44352de21"; // Chiave privata dell’utente
    
    //Hotel data. Change the accound and private key to use another hotel
    const hotelAccount = accounts[1];
    const privateKeyHotel = "0x0b039446a2241a02d745abd0de558356aa8a2711631390ccfcf531b01dcde190";

    // Creazione del DID per l’utente
    const userDID = await createDID(userAccount, privateKeyUser, provider, chainId);

    // Creazione del DID per l'hotel
    const hotelDID = await createDID(hotelAccount, privateKeyHotel, provider, chainId);

    // Lettura della Verifiable Presentation dell’utente da file
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

    // Verifica della VP ed estrazione dell’hash della recensione
    const hash = await checkVPExists(vpJwt, userDID.did, hotelDID.did, didResolver);
    if (!hash) return; // Se non c'è hash, la recensione non è valida/modificabile

    // Nuova recensione da sostituire
    const nuovaRecensione = {rec: "L'hotel è veramente sporco! E il personale davvero incompetente. Sconsigliato."};

    // Controllo di lunghezza testo (business rule: tra 20 e 200 caratteri)
    if (nuovaRecensione.rec.length < 20 || nuovaRecensione.rec.length > 200) {
        console.log("La recensione deve contenere tra 20 e 200 caratteri.");
        return;
    }

    // Scrittura temporanea del contenuto della recensione su file (necessario per IPFS)
    const tempPath = "temp/temp.txt";
    fs.writeFileSync(tempPath, JSON.stringify(nuovaRecensione), 'utf-8');

    // Upload su IPFS e ottenimento del CID (Content Identifier)
    const cid = await uploadToIPFS(tempPath);
    if (!cid) return; // Se l'upload fallisce, uscita

    // Chiamata alla funzione dello smart contract per modificare la recensione (identificata tramite hash)
    await contract_gr.methods.modificaRecensione(hash, cid).send({ from: accounts[0], gas: 300000 });
    console.log("Recensione modificata con successo.");
}

main().catch(console.error);