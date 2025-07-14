// Importazione delle librerie necessarie
const { Web3 } = require('web3'); // Per interagire con Ethereum
const { EthrDID } = require('ethr-did'); // Per generare DIDs compatibili con Ethereum
const {
  createVerifiablePresentationJwt, // Per creare la VP (Verifiable Presentation)
} = require('did-jwt-vc');
const fs = require('fs'); // Per operazioni su file
const jwt = require('jsonwebtoken'); // Per gestire e decodificare JWT

// Funzione per creare un oggetto DID (identificativo decentralizzato)
async function createDID(address, privateKey, provider, chainID) {
    const ethrDid = new EthrDID({
        identifier: address,
        privateKey,
        provider: provider,
        chainNameOrId: chainID,
    });

    return ethrDid;
}

// Funzione per creare una Verifiable Presentation (VP) contenente due VC
async function createVP(vcJwt_h, vcJwt_b, subject) {
    const vpPayload = {
        vp: {
            "@context": ["https://www.w3.org/2018/credentials/v1"], // Contesto standard W3C
            type: ["VerifiablePresentation"], // Tipo di oggetto VP
            verifiableCredential: [vcJwt_h, vcJwt_b] // Inserisce le due VCs nella VP
        }
    };

    // Firma della VP usando la chiave privata del soggetto
    const vpJwt = await createVerifiablePresentationJwt(vpPayload, subject);
    return vpJwt;
}

// Funzione principale asincrona
async function main() {
  try {
    // Connessione al provider Ganache in locale
    const providerUrl = 'HTTP://127.0.0.1:7545';
    const web3 = new Web3(providerUrl);

    // Recupero degli account disponibili e dell'ID della chain
    const accounts = await web3.eth.getAccounts();
    const chainId = await web3.eth.getChainId();
    const provider = web3.currentProvider;

    // Nomi costanti degli attori (hotel e booking) e dell’utente (Marco)
    const hotelName = "Hotel California";
    const bookingName = "Booking";
    const nameUser = "Marco";

    // Account e chiave privata dell’utente Marco (accounts[3] di Ganache)
    const userAccount = accounts[3];
    const privateKeyUser = "0x139a2d1597daee5e60cd2098e38f179224a364e7c36038025011a54644fd49ac";

    // Creazione del DID per Marco
    const userDID = await createDID(userAccount, privateKeyUser, provider, chainId);

    // Output di debug: DID e indirizzo associato
    console.log("User DID is:", userDID.did);
    console.log("User address:", userDID.address);

    // Percorsi dei file VC associati all’hotel e a Booking
    const hotel_vc = `Wallet/${nameUser}/vc_Jwt_${hotelName}.txt`;
    const booking_vc = `Wallet/${nameUser}/vc_Jwt_${bookingName}.txt`;

    // Lettura delle due Verifiable Credentials (VC) da file
    const vcJwt_h = fs.readFileSync(hotel_vc, 'utf-8');
    const vcJwt_b = fs.readFileSync(booking_vc, 'utf-8');

    // Creazione della Verifiable Presentation (VP) firmata contenente le due VCs
    const vpJwt = await createVP(vcJwt_h, vcJwt_b, userDID);

    // Salvataggio della VP su file per usi futuri (es. modifica o cancellazione recensione)
    const userVP = `Wallet/${nameUser}/vp_Jwt.txt`;
    fs.writeFileSync(userVP, vpJwt, 'utf-8');

  } catch(err) {
    // Gestione degli eventuali errori a console
    console.log("Error:", err);
  }
}

main().catch(console.error);