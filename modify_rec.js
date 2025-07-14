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

// Connessione a Ganache tramite WebSocket (necessaria per eventi e interazioni live)
const web3 = new Web3('ws://127.0.0.1:7545');

// Caricamento dell'ABI (Application Binary Interface) del contratto smart
const abi = JSON.parse(fs.readFileSync('contract/GestioniRecensioni/GestioneRecensioniAbi.json', 'utf8'));

// Indirizzo del contratto deployato sulla blockchain
const contractAddress = '0xa4Ac98F855cec84e0Ed5a6088Ae5ad8EFF3C9530';

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
async function checkVPExists(vpJwt, expectedSubject) {

    // Decodifica del JWT contenente la VP (Verifiable Presentation)
    const decoded = jwt.decode(vpJwt, { complete: true });

    // Estrazione delle credenziali verificate (VC) dalla VP
    const vcs = decoded.payload.vp.verifiableCredential;

    // Decodifica della prima VC contenuta
    const decoded_h = jwt.decode(vcs[0], { complete: true });

    // Estrazione dell'ID della VC (serve per accedere al file salt)
    const vcId = decoded_h.payload.vc.id;

    // Verifica che l’issuer della VP corrisponda al soggetto previsto (controllo identità)
    const vpIssuer = decoded.payload.iss;
    if (vpIssuer !== expectedSubject.did) {
        console.log("Il subject (utente) e l'issuer della VP non coincidono!");
        return null;
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

    // Recupero degli account locali e chain ID
    const accounts = await web3.eth.getAccounts();
    const chainId = await web3.eth.getChainId();
    const provider = web3.currentProvider;

    // Dati utente (Alessia) che vuole modificare la recensione
    const nameUser = "Alessia";
    const userAccount = accounts[4]; // Account dell’utente
    const privateKeyUser = "0xfa74c2c8f64e2204ce9e090fe232bfdf8a6f826582f0cdcb57cc7510e407a74b"; // Chiave privata dell’utente

    // Creazione del DID per l’utente
    const userDID = await createDID(userAccount, privateKeyUser, provider, chainId);

    // Lettura della Verifiable Presentation dell’utente da file
    const userVP = `Wallet/${nameUser}/vp_Jwt.txt`;
    const vpJwt = fs.readFileSync(userVP, 'utf-8');

    // Verifica della VP ed estrazione dell’hash della recensione
    const hash = await checkVPExists(vpJwt, userDID);
    if (!hash) return; // Se non c'è hash, la recensione non è valida/modificabile

    // Nuova recensione da sostituire
    const nuovaRecensione = "L'hotel ha migliorato molto rispetto all'ultima volta. Servizio impeccabile!";

    // Controllo di lunghezza testo (business rule: tra 20 e 200 caratteri)
    if (nuovaRecensione.length < 20 || nuovaRecensione.length > 200) {
        console.log("La recensione deve contenere tra 20 e 200 caratteri.");
        return;
    }

    // Scrittura temporanea del contenuto della recensione su file (necessario per IPFS)
    const tempPath = "temp/temp.txt";
    fs.writeFileSync(tempPath, nuovaRecensione, 'utf-8');

    // Upload su IPFS e ottenimento del CID (Content Identifier)
    const cid = await uploadToIPFS(tempPath);
    if (!cid) return; // Se l'upload fallisce, uscita

    // Chiamata alla funzione dello smart contract per modificare la recensione (identificata tramite hash)
    await contract_gr.methods.modificaRecensione(cid, hash).send({ from: accounts[0], gas: 300000 });
    console.log("Recensione modificata con successo.");
}

main().catch(console.error);