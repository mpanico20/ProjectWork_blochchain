//Library imports
const { Web3 } = require('web3');
const { EthrDID } = require('ethr-did');
const { createVerifiableCredentialJwt} = require('did-jwt-vc');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

//Function to create a DID
async function createDID(address, privateKey, provider, chainID) {
    const ethrDid = new EthrDID({
        identifier: address,
        privateKey,
        provider: provider,
        chainNameOrId: chainID,
    });

    return ethrDid;
}

//Generate an unique id for a VC
function generaID(bookingName) {
  const counterPath = path.join(__dirname, `DB/${bookingName}/counter.json`);
  const data = JSON.parse(fs.readFileSync(counterPath));
  const padded = String(data.counter).padStart(4, '0');
  const id = `http://${bookingName}.example/credentials/${padded}`;
  data.counter++;
  fs.writeFileSync(counterPath, JSON.stringify(data, null, 2));
  return id;
}

//Function to create a VC signed by hotel
async function createVCBooking(issuer, subject, checkInDate, checkOutDate, add_hotel, Num_person, bookingName) {
    //Set hour 0 to calculate the night 
    checkInDate.setHours(0, 0, 0, 0);
    checkOutDate.setHours(0, 0, 0, 0);
    const release_date = new Date();
    const diffTime = checkOutDate - checkInDate;
    const num_notti = diffTime / (1000 * 60 * 60 * 24);

    //Generate the unique id
    const id = generaID(bookingName);

    //Payload of Verifiable Credential
    const vcPayload = {
      sub: subject,
      nbf: Math.floor(Date.now() / 1000),

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
            Add_hotel: add_hotel,
            Release: release_date
          }
        }
      }
    };

    //The booking signed the vc
    const vcJwt = await createVerifiableCredentialJwt(vcPayload, issuer);
    return vcJwt;
}

async function main() {
  try {
    const providerUrl = 'HTTP://127.0.0.1:7545';
    const web3 = new Web3(providerUrl);
    
    // Retrieve accounts and chainId from Ganache
    const accounts = await web3.eth.getAccounts();
    const chainId = await web3.eth.getChainId();
    const provider = web3.currentProvider;

    //Information to change if want to use different actors
    const bookingName = "Booking";
    const UserName = "Pasquale";

    //User data
    const userAccount = accounts[5];
    const privateKeyUser = "0x333cd7a33a9f0154095c5a1366625160564cd472acd21284ae68d4e44352de21";

    //Booking data
    const bookingAccount = accounts[9];
    const privateKeyBooking = "0x637b8191a4b48aa684cf97f80b43bfb3f0784a8ee156409583fd529edac40383";

    //Create DID
    const userDID = await createDID(userAccount, privateKeyUser, provider, chainId);
    const bookingDID = await createDID(bookingAccount, privateKeyBooking, provider, chainId);

    //Booked hotel
    const hotel = accounts[1];

    console.log("User DID is:", userDID.did);
    console.log("Booking DID is:", bookingDID.did);

    const checkInDate = new Date("2025-07-10");
    const checkOutDate = new Date("2025-07-11");
    const num_person = 3;

    //Create the vc
    const vcJwt = await createVCBooking(
      bookingDID,
      userDID.did,
      checkInDate,
      checkOutDate,
      hotel,
      num_person,
      bookingName
    );

    //Decode and print the vc
    const decoded_h = jwt.decode(vcJwt, { complete: true });
    console.log(decoded_h.payload.vc);

    //Save the vc in the user wallet
    const wallet = `Wallet/${UserName}/vc_Jwt_${bookingName}.txt`;
    fs.writeFileSync(wallet, vcJwt, 'utf-8');
    console.log("VC saved in the wallet:", wallet);

  } catch(err) {
    console.log("Error:", err);
  }
}

main().catch(console.error);