const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

const key = ec.genKeyPair();
const publicKey = key.getPublic('hex');
const privateKey = key.getPrivate('hex');

console.log();
console.log(
    'Ваш открытый ключ (также адрес вашего кошелька, которым можно свободно поделиться)\n',
    publicKey
);

console.log();
console.log(
    'Ваш закрытый ключ (держите это в секрете! Для подписи транзакций)\n',
    privateKey
);