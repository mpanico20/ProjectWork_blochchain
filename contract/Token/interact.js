const { Web3 } = require('web3');
const fs = require('fs');

// Connect to Ganache
const web3 = new Web3('http://127.0.0.1:7545');

// Load ABI
const abi = JSON.parse(fs.readFileSync('MyTokenAbi.json', 'utf8'));

// Set contract address (use the one from deployment)
const contractAddress = '0xD2b6117eceF7C62685AD91A54B38Eb2A050Fea57';

const contract = new web3.eth.Contract(abi, contractAddress);

async function interactWithContract() {
    const accounts = await web3.eth.getAccounts();

    console.log('Sistema di recensioni:', accounts[0]);

    // Display initial balance
    let balance = await contract.methods.balanceOf(accounts[0]).call();
    console.log('Bilancio iniziale sistema di recensioni:', web3.utils.fromWei(balance, 'ether'));

    // Trasferisci 0.1 token dal sistema di prenotazione al cliente come ricompensa
    await contract.methods.transfer(accounts[0], accounts[3], web3.utils.toWei('0.1', 'ether')).send({ from: accounts[0] });
    console.log('0.1 Token trasferiti per il rilascio della recensione');

    // verifica il bilancio del cliente dopo il trasferimento
    balance = await contract.methods.balanceOf(accounts[3]).call();
    console.log('Bilancio cliente::', web3.utils.fromWei(balance, 'ether'));

    // Trasferisci token al sistema di recensioni per riscuotere buono sconto
    try {
        await contract.methods.transfer(accounts[3], accounts[0], web3.utils.toWei('1', 'ether')).send({ from: accounts[0] });
        console.log('1 Token trasferito per riscuotere buono sconto da utilizzare sul sistema di prenotazioni');
        // Genera un buono sconto (esempio: codice alfanumerico + timestamp)
        const codiceBuono = 'SC-REC-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        const buono = {
            codice: codiceBuono,
            valore: '10%',             
            emittente: "Sistema di recensioni",
        };
         console.log('Buono sconto generato:', buono);
    }catch (error) {
    console.error('Errore nella riscossione del buono sconto:', error.message || error);
}
    // Verifica i bilanci
    balance = await contract.methods.balanceOf(accounts[3]).call();
    console.log('Bilancio cliente:', web3.utils.fromWei(balance, 'ether'));
    balance = await contract.methods.balanceOf(accounts[0]).call();
    console.log('Bilancio sistema di recensione:', web3.utils.fromWei(balance, 'ether'));
}

interactWithContract().catch(console.error);
