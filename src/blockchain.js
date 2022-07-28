const crypto = require('crypto');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1'); //модуль обеспечивает нативную привязку к bitcoin-core/secp256k1 (биткойн-ядро)
const debug = require('debug')('safeCoin:blockchain');

class Transaction {
    constructor(fromAddress, toAddress, amount) {
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.amount = amount;
        this.timestamp = Date.now();
    }

    calculateHash() {
        return crypto
            .createHash('sha256')
            .update(this.fromAddress + this.toAddress + this.amount + this.timestamp)
            .digest('hex');
    }

    /**
     * Подписывает транзакцию с помощью данного signingKey
     * подпись сохраняется внутри объект транзакции
     * затем сохраняется в блокчейне
     *
     * @param {string} signingKey
     */
    signTransaction(signingKey) {
        if (signingKey.getPublic('hex') !== this.fromAddress) {
            throw new Error('Вы не можете подписывать транзакции для других кошельков.');
        }

        // считаем хэш -> подписываем ключом -> сохраняем внутри объекта транзакции
        const hashTx = this.calculateHash();
        const sig = signingKey.sign(hashTx, 'base64');
        this.signature = sig.toDER('hex');
    }

    isValid() {
        //
        if (this.fromAddress === null) return true;

        if (!this.signature || this.signature.length === 0) {
            throw new Error('Нет подписи в этой транзакции');
        }

        const publicKey = ec.keyFromPublic(this.fromAddress, 'hex');
        return publicKey.verify(this.calculateHash(), this.signature);
    }
}

class Block {
    /**
     * @param {number} timestamp
     * @param {Transaction[]} transactions
     * @param {string} previousHash
     */
    constructor(timestamp, transactions, previousHash = '') {
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.nonce = 0;
        this.hash = this.calculateHash();
    }

    calculateHash() {
        return crypto
            .createHash('sha256')
            .update(
                this.previousHash +
                this.timestamp +
                JSON.stringify(this.transactions) +
                this.nonce
            )
            .digest('hex');
    }

    /**
     * изменяет «одноразовый номер» пока хэш блока не начнется с достаточного кол 0
     *
     * @param {number} difficulty
     */
    mineBlock(difficulty) {
        while (
            this.hash.substring(0, difficulty) !== Array(difficulty + 1).join('0')
            ) {
            this.nonce++;
            this.hash = this.calculateHash();
        }

        debug(`Block mined: ${this.hash}`);
    }

    hasValidTransactions() {
        for (const tx of this.transactions) {
            if (!tx.isValid()) {
                return false;
            }
        }

        return true;
    }
}

class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 2;
        this.pendingTransactions = [];
        this.miningReward = 100;
    }

    createGenesisBlock() {
        return new Block(Date.parse('2022-07-24'), [], '0');
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    //ожидающие помещаются в блок - начинается рассчет/ передача адреса для получения награды
    minePendingTransactions(miningRewardAddress) {
        const rewardTx = new Transaction(
            null,
            miningRewardAddress,
            this.miningReward
        );
        this.pendingTransactions.push(rewardTx);

        const block = new Block(
            Date.now(),
            this.pendingTransactions,
            this.getLatestBlock().hash
        );
        block.mineBlock(this.difficulty);

        debug('Block successfully mined!');
        this.chain.push(block);

        this.pendingTransactions = [];
    }

    addTransaction(transaction) {
        if (!transaction.fromAddress || !transaction.toAddress) {
            throw new Error('Транзакция должна включать от и до адреса');
        }

        // verify
        if (!transaction.isValid()) {
            throw new Error('Невозможно добавить недопустимую транзакцию в цепочку');
        }

        if (transaction.amount <= 0) {
            throw new Error('Сумма транзакции должна быть больше 0');
        }

        const walletBalance = this.getBalanceOfAddress(transaction.fromAddress);
        if (walletBalance < transaction.amount) {
            throw new Error('Недостаточный баланс');
        }

        const pendingTxForWallet = this.pendingTransactions.filter(
            tx => tx.fromAddress === transaction.fromAddress
        );

        // если в кошельке есть еще ожидающие транзакции - рассчет общ сум потраченных монет на данный момент
        // если баланс превышен - отказ добавлять транзакцию
        if (pendingTxForWallet.length > 0) {
            const totalPendingAmount = pendingTxForWallet
                .map(tx => tx.amount)
                .reduce((prev, curr) => prev + curr);

            const totalAmount = totalPendingAmount + transaction.amount;
            if (totalAmount > walletBalance) {
                throw new Error(
                    'Баланс превышен.'
                );
            }
        }

        this.pendingTransactions.push(transaction);
        debug('transaction added: %s', transaction);
    }

    getBalanceOfAddress(address) {
        let balance = 0;

        for (const block of this.chain) {
            for (const trans of block.transactions) {
                if (trans.fromAddress === address) {
                    balance -= trans.amount;
                }

                if (trans.toAddress === address) {
                    balance += trans.amount;
                }
            }
        }

        debug('getBalanceOfAdrees: %s', balance);
        return balance;
    }

    //вся цепь
    getAllTransactionsForWallet(address) {
        const txs = [];

        for (const block of this.chain) {
            for (const tx of block.transactions) {
                if (tx.fromAddress === address || tx.toAddress === address) {
                    txs.push(tx);
                }
            }
        }

        debug('get transactions for wallet count: %s', txs.length);
        return txs;
    }

    // глобальная проверка
    isChainValid() {
        const realGenesis = JSON.stringify(this.createGenesisBlock());
        if (realGenesis !== JSON.stringify(this.chain[0])) {
            return false;
        }

        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            if (previousBlock.hash !== currentBlock.previousHash) {
                return false;
            }

            if (!currentBlock.hasValidTransactions()) {
                return false;
            }

            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }
        }

        return true;
    }
}

module.exports.Blockchain = Blockchain;
module.exports.Block = Block;
module.exports.Transaction = Transaction;
