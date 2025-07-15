//Library imports
const { Web3 } = require('web3');
const { EthrDID } = require('ethr-did');
const { createVerifiableCredentialJwt } = require('did-jwt-vc');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

//Function to create a DID
async function createDID(address, privateKey, provider, chainID) {
    const ethrDid = new EthrDID({
        identifier: address,
        privateKey,
        provider: provider,
        chainNameOrId: chainID
    });

    return ethrDid;
}

//Generate an unique id for a VC
function generaID(hotelName) {
  const counterPath = path.join(__dirname, `DB/${hotelName}/counter.json`);
  const data = JSON.parse(fs.readFileSync(counterPath));
  const padded = String(data.counter).padStart(4, '0');
  const id = `http://${hotelName}.example/credentials/${padded}`;
  data.counter++;
  fs.writeFileSync(counterPath, JSON.stringify(data, null, 2));
  return id;
}

//Function to create a VC signed by hotel
async function createVCHotel(issuer, subject, checkInDate, Num_person, add_hotel, hotelName) {
    //Simulating chech out date for test
    const CheckOut_date = new Date("2025-07-11");
    const release_date = new Date();

    //Set hour 0 to calculate the night 
    checkInDate.setHours(0, 0, 0, 0);
    CheckOut_date.setHours(0, 0, 0, 0);

    const diffTime = CheckOut_date - checkInDate;
    const num_notti = diffTime / (1000 * 60 * 60 * 24);

    //Generate the unique id
    const id = generaID(hotelName);

    //Payload of Verifiable Credential
    const vcPayload = {
      sub: subject,
      nbf: Math.floor(Date.now() / 1000),

      vc: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        id: id,
        type: ["VerifiableCredential", hotelName],
        issuer: issuer.did,
        credentialSubject: {
          id: subject,
          Stay: {
            Num_person: Num_person,
            CheckIn: checkInDate.toDateString(),
            CheckOut: CheckOut_date.toDateString(),
            N_notti: num_notti,
            Release: release_date,
            Add_hotel: add_hotel
          }
        }
      }
    };

    //The hotel signed the vc
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
    const hotelName = "Hotel California";
    const nameUser = "Pasquale";

    //User data
    const userAccount = accounts[5]; // Account dell’utente su Ganache
    const privateKeyUser = "0x333cd7a33a9f0154095c5a1366625160564cd472acd21284ae68d4e44352de21";

    //hotel data
    const hotelAccount = accounts[1];
    const privateKeyHotel = "0x0b039446a2241a02d745abd0de558356aa8a2711631390ccfcf531b01dcde190";

    //Create DID
    const userDID = await createDID(userAccount, privateKeyUser, provider, chainId);
    const hotelDID = await createDID(hotelAccount, privateKeyHotel, provider, chainId);

    console.log("User DID is:", userDID.did);
    console.log("Hotel DID is:", hotelDID.did);

    const CheckIn_date = new Date("2025-07-10");
    const num_person = 3;

    //Create the vc
    const vcJwt = await createVCHotel(
      hotelDID,
      userDID.did,
      CheckIn_date,
      num_person,
      hotelAccount,
      hotelName
    );

    //Decode and print the vc
    const decoded_h = jwt.decode(vcJwt, { complete: true });
    console.log(decoded_h.payload);

    //Save the vc in the user wallet
    const wallet = `Wallet/${nameUser}/vc_Jwt_${hotelName}.txt`;
    fs.writeFileSync(wallet, vcJwt, 'utf-8');
    console.log("VC saved in the wallet:", wallet);

  } catch(err) {
    console.log("Error:", err);
  }
}

main().catch(console.error);