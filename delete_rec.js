// Importazione delle librerie necessarie
const { Web3 } = require('web3'); // Per interagire con Ethereum
const { EthrDID } = require('ethr-did'); // Per gestire DIDs
const { Resolver } = require('did-resolver'); // Risoluzione DIDs
const ethrDidResolver = require('ethr-did-resolver'); // Resolver specifico per ethr-did
const fs = require('fs'); // Lettura/scrittura file locali
const jwt = require('jsonwebtoken'); // Per decodificare JWT
const {
  createVerifiableCredentialJwt,
  createVerifiablePresentationJwt,
  verifyPresentation,
  verifyCredential
} = require('did-jwt-vc');

// Connessione a Ganache via WebSocket
const web3 = new Web3('ws://127.0.0.1:7545');

// Caricamento dell'ABI del contratto e indirizzo
const abi = JSON.parse(fs.readFileSync('contract/GestioniRecensioni/GestioneRecensioniAbi.json', 'utf8'));
const contractAddress = '0x60BeCa1ce29f9A423689484052Ad7bAF7FB55229';

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
    // Connessione a Ganache via HTTP (usata per ottenere account e chainId)
    const providerUrl = 'HTTP://127.0.0.1:7545';
    const web3 = new Web3(providerUrl);

    const address_r = "0xCB0e1CaBe7FA1605d9e63f92d48f6EE072387A2f"; // <-- replace with the DID contract address

    // Recupero degli account e chainId disponibili
    const accounts = await web3.eth.getAccounts();
    const chainId = await web3.eth.getChainId();
    const provider = web3.currentProvider;

    // Dati dell’utente che vuole cancellare la recensione
    const nameUser = "Pasquale";
    const userAccount = accounts[5]; // L’utente Alessia usa il quinto account di Ganache
    const privateKeyUser = "0x333cd7a33a9f0154095c5a1366625160564cd472acd21284ae68d4e44352de21"; // Chiave privata associata

    //Hotel data. Change the accound and private key to use another hotel
    const hotelAccount = accounts[1];
    const privateKeyHotel = "0x0b039446a2241a02d745abd0de558356aa8a2711631390ccfcf531b01dcde190";

    // Creazione del DID per l’utente
    const userDID = await createDID(userAccount, privateKeyUser, provider, chainId);

    // Creazione del DID per l'hotel
    const hotelDID = await createDID(hotelAccount, privateKeyHotel, provider, chainId);

    // Lettura della VP (Verifiable Presentation) da file
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

    // Calcolo dell’hash della recensione a partire dalla VP
    const hash = await checkVPExists(vpJwt, userDID.did, hotelDID.did, didResolver);
    if (!hash) return; // Se non esiste hash, interrompi l'esecuzione

    // Chiamata alla funzione dello smart contract per cancellare la recensione
    await contract_gr.methods.eliminaRecensione(hash).send({ from: accounts[0], gas: 300000 });
    console.log("Review successfully deleted.");
}

main().catch(console.error);