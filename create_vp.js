//Library imports
const { Web3 } = require('web3');
const { EthrDID } = require('ethr-did');
const {
  createVerifiablePresentationJwt,
} = require('did-jwt-vc');
const fs = require('fs'); 
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

//Function to create a VP signed by user
async function createVP(vcJwt_h, vcJwt_b, subject) {
    const vpPayload = {
        vp: {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            type: ["VerifiablePresentation"],
            verifiableCredential: [vcJwt_h, vcJwt_b]
        }
    };

    //User sign the VP
    const vpJwt = await createVerifiablePresentationJwt(vpPayload, subject);
    return vpJwt;
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
    const bookingName = "Booking";
    const nameUser = "Pasquale";

    //User data
    const userAccount = accounts[5];
    const privateKeyUser = "0x333cd7a33a9f0154095c5a1366625160564cd472acd21284ae68d4e44352de21";

    //Create DID
    const userDID = await createDID(userAccount, privateKeyUser, provider, chainId);

    console.log("User DID is:", userDID.did);
    console.log("User address:", userDID.address);

    //Path for the VCs
    const hotel_vc = `Wallet/${nameUser}/vc_Jwt_${hotelName}.txt`;
    const booking_vc = `Wallet/${nameUser}/vc_Jwt_${bookingName}.txt`;

    //Read the VCs
    const vcJwt_h = fs.readFileSync(hotel_vc, 'utf-8');
    const vcJwt_b = fs.readFileSync(booking_vc, 'utf-8');

    //Create the VP
    const vpJwt = await createVP(vcJwt_h, vcJwt_b, userDID);

    //Save the VP in the user wallet
    const userVP = `Wallet/${nameUser}/vp_Jwt.txt`;
    fs.writeFileSync(userVP, vpJwt, 'utf-8');
    console.log("VP saved in the wallet:", wallet);

  } catch(err) {
    console.log("Error:", err);
  }
}

main().catch(console.error);