const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Read the Solidity file
const contractPath = path.resolve(__dirname, 'MyToken.sol');
const sourceCode = fs.readFileSync(contractPath, 'utf8');

// Compile the contract
const input = {
    language: 'Solidity',
    sources: {
        'MyToken.sol': { content: sourceCode },
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
const abi = compiledContract.contracts['MyToken.sol'].MyToken.abi;
const bytecode = compiledContract.contracts['MyToken.sol'].MyToken.evm.bytecode.object;

// Write ABI and Bytecode to files
fs.writeFileSync('MyTokenAbi.json', JSON.stringify(abi, null, 2));
fs.writeFileSync('MyTokenBytecode.bin', bytecode);

console.log('Compilation successful!');
