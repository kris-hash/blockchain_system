const { Blockchain, Transaction } = require('./blockchain');
const EC = require('elliptic').ec;// криптосистема эллиптической кривой
const ec = new EC('secp256k1'); //Конкретная эллиптическая кривая: y² = x³ + 7

// Your private key goes here
const myKey = ec.keyFromPrivate(
    '7c4c45907dec40c91bab3480c39032e90049f1a44f3e18c3e07c23e3273995cf'
);

const myWalletAddress = myKey.getPublic('hex');
const safeCoin = new Blockchain();

safeCoin.minePendingTransactions(myWalletAddress);

const tx1 = new Transaction(myWalletAddress, 'address2', 100);
tx1.signTransaction(myKey);
safeCoin.addTransaction(tx1);
safeCoin.minePendingTransactions(myWalletAddress);

const tx2 = new Transaction(myWalletAddress, 'address1', 50);
tx2.signTransaction(myKey);
safeCoin.addTransaction(tx2);
safeCoin.minePendingTransactions(myWalletAddress);

console.log();
console.log(
    `Balance: ${safeCoin.getBalanceOfAddress(myWalletAddress)}`
);

console.log();
console.log('Blockchain valid?', safeCoin.isChainValid() ? 'Yes' : 'No');