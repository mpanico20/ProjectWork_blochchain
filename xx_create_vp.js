const { Web3 } = require('web3');
const { EthrDID } = require('ethr-did');
const {
  createVerifiableCredentialJwt,
  createVerifiablePresentationJwt,
  verifyPresentation,
  verifyCredential
} = require('did-jwt-vc');
const { Resolver } = require('did-resolver');
const ethrDidResolver = require('ethr-did-resolver');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');

async function createDID(address, privateKey, provider, chainID) {
    const ethrDid = new EthrDID({
        identifier: address,
        privateKey,
        provider: provider,
        chainNameOrId: chainID,
    });

    return ethrDid;
}


async function createVP(vcJwt_h, vcJwt_b, subject) {
    const vpPayload = {
        vp: {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiablePresentation"],
        verifiableCredential: [vcJwt_h, vcJwt_b]
        }
    };

    const vpJwt = await createVerifiablePresentationJwt(vpPayload, subject);
    return vpJwt;
    
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
    const hotelName = "Hotel California";
    const bookingName = "Booking";
    const nameUser = "Marco";

    //User data
    const userAccount = accounts[3];
    const privateKeyUser = "0x139a2d1597daee5e60cd2098e38f179224a364e7c36038025011a54644fd49ac";

    //Create User DID
    const userDID = await createDID(userAccount, privateKeyUser, provider, chainId);

    console.log("User DID is:", userDID.did);
    console.log("User address:",userDID.address);

    const hotel_vc = `Wallet/${nameUser}/vc_Jwt_${hotelName}.txt`;
    const booking_vc = `Wallet/${nameUser}/vc_Jwt_${bookingName}.txt`;

    //Readaing the VCs
    const vcJwt_h = fs.readFileSync(hotel_vc, 'utf-8');
    const vcJwt_b = fs.readFileSync(booking_vc,'utf-8');

    //VP creation
    const vpJwt = await createVP(vcJwt_h, vcJwt_b, userDID);
    const userVP = `Wallet/${nameUser}/vp_Jwt.txt`;
    fs.writeFileSync(userVP, vpJwt, 'utf-8');


  } catch(err) {
    console.log("Error:", err);

  }
  
}

main().catch(console.error);