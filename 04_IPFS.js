const {Web3} = require('web3');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');

const review = "L'hotel in cui ho soggiornato mi è sembrato molto accogliente. Il personale è stato molto cordiale, ed in generale un ottima esperienza! Raccomando tantissimo.";



// 2) File to upload
const filePath = path.join(__dirname, 'review1.txt');

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


// ----- Direct download function via HTTP POST -----
async function downloadFromIPFS(cid, outputPath) {
  const res = await axios.post(
    'http://localhost:5001/api/v0/cat',
    null,
    {
      params: { arg: cid },
      responseType: 'stream',
    }
  );
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    res.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// ----- Main -----
async function interact() {
    //Saving the review
    const fs = require('fs');

    fs.writeFileSync('review1.txt', review, 'utf-8');

    console.log("Uploading file to IPFS...");
    const cid = await uploadToIPFS(filePath);
    console.log("CID obtained:", cid);
}

async function dowload_f(){
    const cid_d ="QmT1X56DeUo1UVpDqfcvHuVU1MzHTEjxyifjLFTkkN19Xf"
    console.log("Downloading the file from IPFS...");
    await downloadFromIPFS(cid_d,filePath);

    const fs_1 = require('fs');

    const rec = fs_1.readFileSync('review1.txt', 'utf-8');
    console.log('La recensione che stai cercando è questa:', rec);
    
    const salt = await generateSalt();

    console.log("Questo è il salt generato per la tua recensione:", salt);
    
}

//interact().catch(console.error)
dowload_f().catch(console.error);