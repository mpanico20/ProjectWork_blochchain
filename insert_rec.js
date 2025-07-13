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
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');

// Connect to Ganache
const web3 = new Web3('ws://127.0.0.1:7545');

// Load ABI
const abi = JSON.parse(fs.readFileSync('contract/GestioniRecensioni/GestioneRecensioniAbi.json', 'utf8'));
const abi_t = JSON.parse(fs.readFileSync('contract/Token/MyTokenAbi.json', 'utf8'));

// Set contract address (use the one from deployment)
const contractAddress = '0xa4Ac98F855cec84e0Ed5a6088Ae5ad8EFF3C9530';
const contractAddress_t = "0xC34FAf5949811B423cE8e5849c57C4c61A101d1e";

const contract_gr = new web3.eth.Contract(abi, contractAddress);
const contract_tk = new web3.eth.Contract(abi_t, contractAddress_t);

// ----- Direct upload function via HTTP POST -----
async function uploadToIPFS(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  const res = await axios.post('http://localhost:5001/api/v0/add', form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
  });
  let data = res.data;
  if (typeof data === 'string') {
    const lines = data.trim().split('\n');
    data = JSON.parse(lines[lines.length - 1]);
  }
  return data.Hash;
}

// ---- Create the DID of the actors ----
async function createDID(address, privateKey, provider, chainID) {
    const ethrDid = new EthrDID({
        identifier: address,
        privateKey,
        provider: provider,
        chainNameOrId: chainID,
    });

    return ethrDid;
}


async function generateSalt(lenght = 32){
    return crypto.randomBytes(lenght).toString('hex');
}


async function checkVP(subject, issuer_h, issuer_b, vpJwt, didResolver) {

    try {
        const result = await verifyPresentation(vpJwt, didResolver);

        //Check on the subject
        if(result.issuer != subject){
            console.log("The subject (user) and the issuer of the vp are not equal!");
            return;
        }

        const decoded = jwt.decode(vpJwt, { complete: true });

        const vpPayload = decoded.payload;
        const vcs = vpPayload.vp.verifiableCredential;

        //Check for the hotel's vc
        const verifiedVCh = await verifyCredential(vcs[0], didResolver);
        const verifiedVCb = await verifyCredential(vcs[1], didResolver);
        if(verifiedVCh.issuer != issuer_h){
            console.log("The hotel's vc is not signed correctly!");
            return;
        } else if(verifiedVCb.issuer != issuer_b){
            console.log("The booking's vc is non signed correctly!");
            return;
        }
        
        const decoded_h = jwt.decode(vcs[0], { complete: true});
        const decoded_b = jwt.decode(vcs[1], {complete: true});
        const subjH = decoded_h.payload.vc.credentialSubject.id;
        const subjB = decoded_b.payload.vc.credentialSubject.id;

        console.log(decoded_h.payload.vc.credentialSubject);
        console.log(decoded_b.payload.vc.credentialSubject);

        if(result.issuer != subjH || result.issuer != subjB){
            console.log("The subject of the VC does not match the VP issuer!");
            return;
        }

    

        //Check release_date of Hotel VC (+12 hours)
        const releaseDateStr = decoded_h.payload.vc.credentialSubject.Stay.Release;
        if (releaseDateStr) {
        const release_dateH = new Date(releaseDateStr);
        const twelveHoursLater = new Date(release_dateH.getTime() + 12 * 60 * 60 * 1000);
        const now = new Date("2025-07-15T23:45:00.000Z");
        //const now = new Date();
        if (now < twelveHoursLater) {
            console.log("12 hours have not passed since hotel VC issuance!");
            return;
        } else console.log("12 hours have passed since hotel VC issuance!");

        } else {
        console.log("Release date not found in Hotel VC:", decoded_h.vc.credentialSubject.Stay);
        }

        // Check coherence between VC data Da modificare
        const hotelId_h = decoded_h.payload.vc.credentialSubject.Stay.Add_hotel;
        const hotelId_b = decoded_b.payload.vc.credentialSubject.Book.Add_hotel;

        if (hotelId_b !== hotelId_h) {
            console.log("Hotel ID mismatch between booking and hotel VCs!");
            return;
        }

        const CheckIn_h = decoded_h.payload.vc.credentialSubject.Stay.CheckIn;
        const CheckOut_h = decoded_h.payload.vc.credentialSubject.Stay.CheckOut;
        const CheckIn_b = decoded_b.payload.vc.credentialSubject.Book.CheckIn;
        const CheckOut_b = decoded_b.payload.vc.credentialSubject.Book.CheckOut;

        if (CheckIn_b !== CheckIn_h || CheckOut_b !== CheckOut_h) {
            console.log("Check-in/check-out dates do not match between VCs!" );
            return;
        } 
        const num_people_h = decoded_h.payload.vc.credentialSubject.Stay.Num_person;
        const num_people_b = decoded_b.payload.vc.credentialSubject.Book.Num_person;
        
        if (num_people_b !== num_people_h){
            console.log("Number of people do not match between VCs!" );
            return;
        }

        //Upload the file that contains the mapping between id and salt used
        const fileIdPath = "DB/idHash.json";
        const idHashFile = fs.readFileSync(fileIdPath, 'utf-8');
        const parseIdHash = JSON.parse(idHashFile);
        const mapIdHash = new Map(Object.entries(parseIdHash));

        const vcId = decoded_h.payload.vc.id;
        console.log(vcId); //ELIMINA
        if(mapIdHash.get(vcId) != null){
            console.log("Vc already used!");
            return;
        }

        const salt = await generateSalt();
        console.log(salt); //ELIMINA

        mapIdHash.set(vcId, salt);

        fs.writeFileSync(fileIdPath, JSON.stringify(Object.fromEntries(mapIdHash), null, 2));

        const combined = vcId + salt;
        const hash = Web3.utils.keccak256(combined);
        console.log(combined, hash); //ELIMINA

        console.log("VP and VCs validated successfully!");

        return hash;

    } catch(err){
        console.log("Error:", err);
    }


    
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
    const nameUser = "Alessia";

    //User data
    const userAccount = accounts[4];
    const privateKeyUser = "0xfa74c2c8f64e2204ce9e090fe232bfdf8a6f826582f0cdcb57cc7510e407a74b";

    //Hotel data
    const hotelAccount = accounts[1];
    const privateKeyHotel = "0x0b039446a2241a02d745abd0de558356aa8a2711631390ccfcf531b01dcde190";

    //Booking data
    const bookingAccount = accounts[9];
    const privateKeyBooking = "0x637b8191a4b48aa684cf97f80b43bfb3f0784a8ee156409583fd529edac40383";

    //Create User DID
    const userDID = await createDID(userAccount, privateKeyUser, provider, chainId);

    //Create Hotel DID
    const hotelDID = await createDID(hotelAccount, privateKeyHotel, provider, chainId);

    //Create booking DID
    const bookingDID = await createDID(bookingAccount, privateKeyBooking, provider, chainId);

    console.log("User DID is:", userDID.did);
    console.log("User address:",userDID.address);
    console.log("Hotel DID is:", hotelDID.did);
    console.log("Booking DID is:", bookingDID.did);

    const userVP = `Wallet/${nameUser}/vp_Jwt.txt`;
    
    //Readaing the VCs
    const vpJwt = fs.readFileSync(userVP, 'utf-8');

    const address_r = "0xEA75671faA5fF9AfE782b9E6455235727A060410"; // <-- replace with the DID contract address

    // === CONFIGURATION OF THE RESOLVER ===
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

    const hash = await checkVP(userDID.did, hotelDID.did, bookingDID.did, vpJwt, didResolver);

    if(hash){
        console.log(hash);
    } else {
        return;
    }
    

    const tempPath = "temp/temp.txt";
    //const review = "L'hotel in cui ho soggiornato mi è sembrato molto accogliente. Il personale è stato molto cordiale, ed in generale un ottima esperienza! Raccomando tantissimo.";
    const review = "L'hotel non era il massimo!";
    fs.writeFileSync(tempPath, review, 'utf-8');

    console.log("Uploading review on IPFS...");
    const cid = await uploadToIPFS(tempPath);

    if(!cid){
        return;
    }

    console.log("Cid ottenuto:", cid);

    await contract_gr.methods.inserisciRecensione(cid, true, hash, hotelDID.address).send({ from: accounts[0], gas: 300000 });
    await contract_tk.methods.transfer(accounts[0], userDID.address, web3.utils.toWei('0.1', 'ether')).send({ from: accounts[0], gas: 300000 });

    // verifica il bilancio del cliente dopo il trasferimento
    balance = await contract_tk.methods.balanceOf(userDID.address).call();
    console.log('Bilancio cliente::', web3.utils.fromWei(balance, 'ether'));


  } catch(err) {
    console.log("Error:", err);

  }
  
}

main().catch(console.error);
