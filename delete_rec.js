// Importazione delle librerie necessarie
const { Web3 } = require('web3'); // Per interagire con Ethereum
const { EthrDID } = require('ethr-did'); // Per gestire DIDs
const { Resolver } = require('did-resolver'); // Risoluzione DIDs
const ethrDidResolver = require('ethr-did-resolver'); // Resolver specifico per ethr-did
const fs = require('fs'); // Lettura/scrittura file locali
const jwt = require('jsonwebtoken'); // Per decodificare JWT

// Connessione a Ganache via WebSocket
const web3 = new Web3('ws://127.0.0.1:7545');

// Caricamento dell'ABI del contratto e indirizzo
const abi = JSON.parse(fs.readFileSync('contract/GestioniRecensioni/GestioneRecensioniAbi.json', 'utf8'));
const contractAddress = '0xa4Ac98F855cec84e0Ed5a6088Ae5ad8EFF3C9530';

// Creazione dell'istanza del contratto
const contract_gr = new web3.eth.Contract(abi, contractAddress);

// Funzione per creare un oggetto DID a partire da indirizzo, chiave privata, provider e chainID
async function createDID(address, privateKey, provider, chainID) {
    return new EthrDID({
        identifier: address,
        privateKey,
        provider: provider,
        chainNameOrId: chainID,
    });
}

// Funzione che verifica l'esistenza della VP e restituisce l'hash associato alla recensione
async function checkVPExists(vpJwt, expectedSubject) {

    // Decodifica del JWT (VP)
    const decoded = jwt.decode(vpJwt, { complete: true });

    // Estrazione delle VC dalla VP
    const vcs = decoded.payload.vp.verifiableCredential;

    // Decodifica della prima VC
    const decoded_h = jwt.decode(vcs[0], { complete: true });

    // Estrazione dell'ID (vc.id)
    const vcId = decoded_h.payload.vc.id;

    // Verifica che il subject (issuer VP) corrisponda all'utente previsto
    const vpIssuer = decoded.payload.iss;
    if (vpIssuer !== expectedSubject) {
        console.log("Il subject (utente) e l'issuer della VP non coincidono!");
        return null;
    }

    // Lettura del file contenente la mappatura tra vcId e salt
    const fileIdPath = "DB/idHash.json";
    const idHashFile = fs.readFileSync(fileIdPath, 'utf-8');
    const parseIdHash = JSON.parse(idHashFile);
    const mapIdHash = new Map(Object.entries(parseIdHash));

    // Recupero del salt associato al vcId
    const salt = mapIdHash.get(vcId);
    if (!salt) {
        console.log("Nessuna recensione associata a questa VP.");
        return null;
    }

    // Creazione dell'hash combinando vcId e salt
    const combined = vcId + salt;
    return Web3.utils.keccak256(combined); // Hash SHA3 usato nel contratto per identificare la recensione
}

// Funzione principale asincrona
async function main() {
    // Connessione a Ganache via HTTP (usata per ottenere account e chainId)
    const providerUrl = 'HTTP://127.0.0.1:7545';
    const web3 = new Web3(providerUrl);

    // Recupero degli account e chainId disponibili
    const accounts = await web3.eth.getAccounts();
    const chainId = await web3.eth.getChainId();
    const provider = web3.currentProvider;

    // Dati dell’utente che vuole cancellare la recensione
    const nameUser = "Alessia";
    const userAccount = accounts[4]; // L’utente Alessia usa il quinto account di Ganache
    const privateKeyUser = "0xfa74c2c8f64e2204ce9e090fe232bfdf8a6f826582f0cdcb57cc7510e407a74b"; // Chiave privata associata

    // Creazione del DID per l’utente
    const userDID = await createDID(userAccount, privateKeyUser, provider, chainId);

    // Lettura della VP (Verifiable Presentation) da file
    const userVP = `Wallet/${nameUser}/vp_Jwt.txt`;
    const vpJwt = fs.readFileSync(userVP, 'utf-8');

    // Calcolo dell’hash della recensione a partire dalla VP
    const hash = await checkVPExists(vpJwt, userDID);
    if (!hash) return; // Se non esiste hash, interrompi l'esecuzione

    // Chiamata alla funzione dello smart contract per cancellare la recensione
    await contract_gr.methods.cancellaRecensione(hash).send({ from: accounts[0], gas: 300000 });
    console.log("Recensione cancellata con successo.");
}

main().catch(console.error);