// Importazione delle librerie necessarie ===
const { Web3 } = require('web3');                     // Per interazione con la blockchain Ethereum
const { EthrDID } = require('ethr-did');              // Per la gestione di DIDs basati su Ethereum
const { createVerifiableCredentialJwt } = require('did-jwt-vc'); // Per creare Verifiable Credential (VC) firmate in formato JWT
const fs = require('fs');                             // Per operazioni di lettura/scrittura file
const path = require('path');                         // Per gestione di path cross-platform
const jwt = require('jsonwebtoken');                  // Per decodificare i JWT (debug/log)

// Funzione per creare un DID a partire da un indirizzo e chiave privata
async function createDID(address, privateKey, provider, chainID) {
    // Restituisce un oggetto EthrDID, usato per firmare VC o VP
    const ethrDid = new EthrDID({
        identifier: address,           // Indirizzo Ethereum
        privateKey,                    // Chiave privata dell'entità
        provider: provider,            // Provider Web3
        chainNameOrId: chainID         // ID della rete (es. 1337 per Ganache)
    });

    return ethrDid;
}

// Genera un ID univoco per la VC di Hotel basato su un contatore salvato in file
function generaID(hotelName) {
  const counterPath = path.join(__dirname, `DB/${hotelName}/counter.json`); // Percorso al file JSON del contatore dell'hotel
  const data = JSON.parse(fs.readFileSync(counterPath)); // Lettura e parsing del contatore attuale
  const padded = String(data.counter).padStart(4, '0');  // Formatta il numero come "0001", "0002", ...
  const id = `http://${hotelName}.example/credentials/${padded}`; // ID fittizio della VC
  data.counter++; // Incrementa il contatore per la prossima VC
  fs.writeFileSync(counterPath, JSON.stringify(data, null, 2)); // Aggiorna il file JSON
  return id; // Restituisce l'ID univoco generato
}

// Funzione per creare una Verifiable Credential firmata da Booking
async function createVCHotel(issuer, subject, checkInDate, Num_person, add_hotel, hotelName) {
    // Simulazione della data di check-out (in un'app reale sarebbe registrata al termine del soggiorno)
    const CheckOut_date = new Date("2025-07-11");
    const release_date = new Date(); // Data di emissione della VC (oggi)

    // Imposta orari a 00:00 per calcolo notti corretto
    checkInDate.setHours(0, 0, 0, 0);
    CheckOut_date.setHours(0, 0, 0, 0);

    // Calcolo del numero di notti tra check-in e check-out
    const diffTime = CheckOut_date - checkInDate;
    const num_notti = diffTime / (1000 * 60 * 60 * 24);

    // Generazione dell'ID univoco per la VC
    const id = generaID(hotelName);

    // Payload della Verifiable Credential
    const vcPayload = {
      sub: subject, // DID del soggetto (utente destinatario)
      nbf: Math.floor(Date.now() / 1000), // "Not Before": validità a partire da ora, in secondi Unix

      vc: {
        "@context": ["https://www.w3.org/2018/credentials/v1"], // Contesto standard VC
        id: id, // ID univoco generato
        type: ["VerifiableCredential", hotelName], // Tipi della credenziale
        issuer: issuer.did, // DID dell'emittente (hotel)
        credentialSubject: {
          id: subject, // DID dell'utente
          Stay: {
            Num_person: Num_person,                       // Numero di persone nel soggiorno
            CheckIn: checkInDate.toDateString(),         // Data check-in (stringa leggibile)
            CheckOut: CheckOut_date.toDateString(),      // Data check-out
            N_notti: num_notti,                          // Numero di notti
            Release: release_date,                       // Data emissione VC
            Add_hotel: add_hotel                         // Indirizzo Ethereum dell’hotel
          }
        }
      }
    };

    // Firma della VC con la chiave privata dell'hotel
    const vcJwt = await createVerifiableCredentialJwt(vcPayload, issuer);
    return vcJwt;
}

// Funzione principale asincrona che esegue tutto il processo
async function main() {
  try {
    const providerUrl = 'HTTP://127.0.0.1:7545'; // Endpoint Web3 di Ganache
    const web3 = new Web3(providerUrl); // Crea un'istanza Web3

    const accounts = await web3.eth.getAccounts(); // Ottieni tutti gli account da Ganache
    const chainId = await web3.eth.getChainId();   // Ottieni ID della rete (es. 1337)
    const provider = web3.currentProvider;         // Provider corrente

    // === Parametri personalizzabili ===
    const hotelName = "Hotel California"; // Nome hotel (usato anche per path e tipo VC)
    const nameUser = "Marco";             // Nome utente

    // === Dati dell’utente ===
    const userAccount = accounts[3]; // Account dell’utente su Ganache
    const privateKeyUser = "0x139a2d1597daee5e60cd2098e38f179224a364e7c36038025011a54644fd49ac";

    // === Dati dell’hotel ===
    const hotelAccount = accounts[1];
    const privateKeyHotel = "0x0b039446a2241a02d745abd0de558356aa8a2711631390ccfcf531b01dcde190";

    // Crea i DID per utente e hotel
    const userDID = await createDID(userAccount, privateKeyUser, provider, chainId);
    const hotelDID = await createDID(hotelAccount, privateKeyHotel, provider, chainId);

    // Mostra i DID generati a console
    console.log("User DID is:", userDID.did);
    console.log("Hotel DID is:", hotelDID.did);

    // === Parametri del soggiorno ===
    const CheckIn_date = new Date("2025-07-10");
    const num_person = 3;

    // Crea una Verifiable Credential firmata dall’hotel per l’utente
    const vcJwt = await createVCHotel(
      hotelDID,
      userDID.did,
      CheckIn_date,
      num_person,
      hotelAccount,
      hotelName
    );

    // Decodifica e stampa la VC per controllo
    const decoded_h = jwt.decode(vcJwt, { complete: true });
    console.log(decoded_h.payload);

    // Salva la VC nel wallet dell’utente
    const wallet = `Wallet/${nameUser}/vc_Jwt_${hotelName}.txt`;
    fs.writeFileSync(wallet, vcJwt, 'utf-8');
    console.log("VC salvata con successo nel wallet:", wallet);

  } catch(err) {
    console.log("Error:", err); // Mostra errori in console
  }
}

main().catch(console.error);