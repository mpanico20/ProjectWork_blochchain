const { Web3 } = require('web3');
const { EthrDID } = require('ethr-did');
const { createVerifiableCredentialJwt, verifyCredential } = require('did-jwt-vc');
const { Resolver } = require('did-resolver');
const ethrDidResolver = require('ethr-did-resolver');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

async function createDID(address, privateKey, provider, chainID) {
    const ethrDid = new EthrDID({
        identifier: address,
        privateKey,
        provider: provider,
        chainNameOrId: chainID,
    });

    return ethrDid;
}

function generaID(bookingName) {
  const counterPath = path.join(__dirname, `DB/${bookingName}/counter.json`);
  const data = JSON.parse(fs.readFileSync(counterPath));
  const padded = String(data.counter).padStart(4, '0'); // "0001", "0002", ...
  const id = `http://${bookingName}.example/credentials/${padded}`;
  data.counter++;
  fs.writeFileSync(counterPath, JSON.stringify(data, null, 2));
  return id;
}

async function createVCBooking(issuer, subject, checkInDate, checkOutDate, add_hotel, Num_person, bookingName) {
    //Calcola il numero di notti di un utente
    checkInDate.setHours(0, 0, 0, 0);
    checkOutDate.setHours(0, 0, 0, 0);
    const diffTime = checkOutDate - checkInDate;
    const num_notti = diffTime / (1000 * 60 * 60 * 24);

    //La piattaforma si calcola id da inserire nella vc in maniera che sia unico per ogni vc
    const id = generaID(bookingName);

    // Create the payload for the Verifiable Credential
    const vcPayload = {
      sub: subject,
      // "nbf" indicates the validity starting from (timestamp in seconds)
      nbf: Math.floor(Date.now() / 1000),
      // The "vc" field contains the VC document
      vc: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        id: id,
        type: ["VerifiableCredential", "Bookingx"],
        issuer: issuer.did,
        credentialSubject: {
          id: subject,
          Book: {
            Num_person: Num_person,
            Num_notti: num_notti,
            CheckIn: checkInDate.toDateString(),
            CheckOut: checkOutDate.toDateString(),
            Add_hotel: add_hotel
          }
        }
      }
    };

    const vcJwt = await createVerifiableCredentialJwt(vcPayload, issuer);
    return vcJwt;
}

async function main() {
  try {
    const providerUrl = 'HTTP://127.0.0.1:7545';
    const web3 = new Web3(providerUrl);

    // Retrieve hotel account and chainId from Ganache
    const accounts = await web3.eth.getAccounts();
    const chainId = await web3.eth.getChainId();
    const provider = web3.currentProvider;

    //Constants name. To change if want to use other users or hotels
    const bookingName = "Booking";
    const UserName = "Alessia";

    //User data
    const userAccount = accounts[4];
    const privateKeyUser = "0xfa74c2c8f64e2204ce9e090fe232bfdf8a6f826582f0cdcb57cc7510e407a74b";

    //Booking data
    const bookingAccount = accounts[9];
    const privateKeyBooking = "0x637b8191a4b48aa684cf97f80b43bfb3f0784a8ee156409583fd529edac40383";

    //Create User DID
    const userDID = await createDID(userAccount, privateKeyUser, provider, chainId);

    //Create booking DID
    const bookingDID = await createDID(bookingAccount, privateKeyBooking, provider, chainId);

    //Hotel where Usere booked
    const hotel = accounts[1];

    console.log("User DID is:", userDID.did);
    console.log("Booking DID is:", bookingDID.did);

    //VC creation
    const checkInDate = new Date("2025-07-10");
    const checkOutDate = new Date("2025-07-11");
    const num_person = 3;
    const vcJwt = await createVCBooking(bookingDID, userDID.did, checkInDate, checkOutDate, hotel, num_person, bookingName);

    const decoded_h = jwt.decode(vcJwt, { complete: true});
    console.log(decoded_h.payload.vc);

    //Salvo la vc nel wallet dell'utente
    const wallet = `Wallet/${UserName}/vc_Jwt_${bookingName}.txt`;
    fs.writeFileSync(wallet, vcJwt, 'utf-8');

  } catch(err) {
    console.log("Error:", err);

  }
  
}

main().catch(console.error);