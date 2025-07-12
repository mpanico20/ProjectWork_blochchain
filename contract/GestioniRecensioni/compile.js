const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Read the Solidity file
const contractPath = path.resolve(__dirname, 'GestioneRecensioni.sol');
const sourceCode = fs.readFileSync(contractPath, 'utf8');

// Compile the contract
const input = {
    language: 'Solidity',
    sources: {
        'GestioneRecensioni.sol': { content: sourceCode },
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['*'],
            },
        },
    },
};

const compiledContract = JSON.parse(solc.compile(JSON.stringify(input)));
const abi = compiledContract.contracts['GestioneRecensioni.sol'].GestioneRecensioni.abi;
const bytecode = compiledContract.contracts['GestioneRecensioni.sol'].GestioneRecensioni.evm.bytecode.object;

// Write ABI and Bytecode to files
fs.writeFileSync('GestioneRecensioniAbi.json', JSON.stringify(abi, null, 2));
fs.writeFileSync('GestioneRecensioniBytecode.bin', bytecode);

console.log('Compilation successful!');
