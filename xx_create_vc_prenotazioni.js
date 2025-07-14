// Importazione delle librerie necessarie
const { Web3 } = require('web3'); // Libreria per interagire con Ethereum
const { EthrDID } = require('ethr-did'); // Per creare e gestire DIDs su Ethereum
const { createVerifiableCredentialJwt, verifyCredential } = require('did-jwt-vc'); // Per creare e verificare VC in formato JWT
const { Resolver } = require('did-resolver'); // Risolutore DID (non usato esplicitamente qui)
const ethrDidResolver = require('ethr-did-resolver'); // Risolutore per DID di tipo ethr
const fs = require('fs'); // Per leggere e scrivere file
const path = require('path'); // Per gestire i percorsi dei file
const jwt = require('jsonwebtoken'); // Per decodificare i JWT (utile per debugging)

// Funzione per creare un DID a partire da un indirizzo e chiave privata
async function createDID(address, privateKey, provider, chainID) {
    const ethrDid = new EthrDID({
        identifier: address, // indirizzo Ethereum
        privateKey,          // chiave privata corrispondente
        provider: provider,  // provider Web3
        chainNameOrId: chainID, // id della chain (es. 1337 per Ganache)
    });

    return ethrDid;
}

// Genera un ID univoco per la VC di Booking basato su un contatore salvato in file
function generaID(bookingName) {
  const counterPath = path.join(__dirname, `DB/${bookingName}/counter.json`); // Percorso del contatore
  const data = JSON.parse(fs.readFileSync(counterPath)); // Lettura contatore corrente
  const padded = String(data.counter).padStart(4, '0'); // Padding: "0001", "0002", ecc.
  const id = `http://${bookingName}.example/credentials/${padded}`; // ID fittizio unico della VC
  data.counter++; // Incremento del contatore
  fs.writeFileSync(counterPath, JSON.stringify(data, null, 2)); // Salvataggio nuovo valore
  return id; // Restituisce l'ID generato
}

// Funzione per creare una Verifiable Credential firmata da Booking
async function createVCBooking(issuer, subject, checkInDate, checkOutDate, add_hotel, Num_person, bookingName) {
    // Calcolo numero notti tra check-in e check-out
    checkInDate.setHours(0, 0, 0, 0);
    checkOutDate.setHours(0, 0, 0, 0);
    const release_date = new Date();
    const diffTime = checkOutDate - checkInDate;
    const num_notti = diffTime / (1000 * 60 * 60 * 24); // Conversione millisecondi in giorni

    // Genera ID unico per la VC
    const id = generaID(bookingName);

    // Creazione payload della Verifiable Credential
    const vcPayload = {
      sub: subject, // DID dell'utente a cui è riferita la VC
      nbf: Math.floor(Date.now() / 1000), // Timestamp Unix (inizio validità)

      vc: {
        "@context": ["https://www.w3.org/2018/credentials/v1"], // Context VC standard
        id: id, // ID unico generato
        type: ["VerifiableCredential", "Bookingx"], // Tipi associati alla VC
        issuer: issuer.did, // DID di Booking
        credentialSubject: {
          id: subject, // DID dell'utente
          Book: {
            Num_person: Num_person,                         // Numero persone nella prenotazione
            Num_notti: num_notti,                           // Numero notti calcolate
            CheckIn: checkInDate.toDateString(),            // Data di check-in (stringa leggibile)
            CheckOut: checkOutDate.toDateString(),          // Data di check-out
            Add_hotel: add_hotel,                           // Indirizzo Ethereum dell'hotel prenotato
            Release: release_date                           // Data emissione VC
          }
        }
      }
    };

    // Firma della VC usando la chiave privata di Booking
    const vcJwt = await createVerifiableCredentialJwt(vcPayload, issuer);
    return vcJwt;
}

// Funzione principale asincrona che esegue tutto il processo
async function main() {
  try {
    const providerUrl = 'HTTP://127.0.0.1:7545'; // URL di Ganache locale
    const web3 = new Web3(providerUrl); // Crea un'istanza Web3

    // Ottiene gli account disponibili da Ganache
    const accounts = await web3.eth.getAccounts();
    const chainId = await web3.eth.getChainId(); // ID della rete locale
    const provider = web3.currentProvider; // Provider corrente

    // Nomi simbolici (modificabili)
    const bookingName = "Booking"; // Nome della piattaforma Booking
    const UserName = "Marco";      // Nome simbolico dell'utente

    // Dati dell'utente (Marco)
    const userAccount = accounts[3];
    const privateKeyUser = "0x139a2d1597daee5e60cd2098e38f179224a364e7c36038025011a54644fd49ac";

    // Dati della piattaforma Booking
    const bookingAccount = accounts[9];
    const privateKeyBooking = "0x637b8191a4b48aa684cf97f80b43bfb3f0784a8ee156409583fd529edac40383";

    // Crea DID utente
    const userDID = await createDID(userAccount, privateKeyUser, provider, chainId);

    // Crea DID di Booking
    const bookingDID = await createDID(bookingAccount, privateKeyBooking, provider, chainId);

    // Hotel prenotato (rappresentato da un account Ganache)
    const hotel = accounts[1];

    // Stampa a console i DID generati
    console.log("User DID is:", userDID.did);
    console.log("Booking DID is:", bookingDID.did);

    // Parametri della prenotazione
    const checkInDate = new Date("2025-07-10");
    const checkOutDate = new Date("2025-07-11");
    const num_person = 3;

    // Creazione della Verifiable Credential firmata da Booking per l'utente
    const vcJwt = await createVCBooking(
      bookingDID,
      userDID.did,
      checkInDate,
      checkOutDate,
      hotel,
      num_person,
      bookingName
    );

    // Decodifica del JWT (solo per debug, mostra il contenuto)
    const decoded_h = jwt.decode(vcJwt, { complete: true });
    console.log(decoded_h.payload.vc);

    // Salvataggio della VC nel wallet dell’utente
    const wallet = `Wallet/${UserName}/vc_Jwt_${bookingName}.txt`;
    fs.writeFileSync(wallet, vcJwt, 'utf-8');
    console.log("VC salvata nel wallet:", wallet);

  } catch(err) {
    // Gestione errori
    console.log("Error:", err);
  }
}

main().catch(console.error);