#! /usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');
const readline = require('readline');

const NanoNode = require('nano-node');
const pow = require('raiblocks-pow');

const PEER_WAIT = 10000;
const HEX64CHAR = /^[A-Fa-f0-9]{64}$/;
const DEFAULT_REP = NanoNode.keyFromAccount('xrb_1nanode8ngaakzbck8smq6ru9bethqwyehomf79sae1k7xd47dkidjqzffeg');

if(process.argv.length < 3 || !process.argv[2])
  throw new Error('persistence filename not specified');

const persistenceFile = process.argv[2];

let hashData = { seed: crypto.randomBytes(32).toString('hex'), pendingHash: null };

try {
  hashData = JSON.parse(fs.readFileSync(persistenceFile, {encoding:'utf8'}));
} catch(error) {
  console.log('error reading persistence file, starting from new');
}

function saveData() {
  fs.writeFileSync(persistenceFile, JSON.stringify(hashData));
}

function zeroPad(num, size) {
  // Max 32 digits
  var s = "00000000000000000000000000000000" + num;
  return s.substr(s.length-size);
}

function queueBlock(hashData, block, accountIndex) {
  let prev = block.previous;
  if(block.type === 'open') prev = block.account;
  console.log('Generating work for', prev);
  console.time('Work found');
  block.work = zeroPad(pow(prev), 16);
  console.timeEnd('Work found');

  const msg = NanoNode.renderMessage({ type: 'publish', body: block }, hashData.accounts[accountIndex].privateKey);

  msg.message = msg.message.toString('hex');

  hashData.messages.push(msg);

  saveData();
}

function handler(hashData) {
  if(!HEX64CHAR.test(hashData.seed))
    throw new Error('invalid seed value, must be 64 character hex string')

  if(!('accounts' in hashData)) {
    hashData.accounts = [ 0, 1 ].map(index =>
      NanoNode.accountPair(Buffer.from(hashData.seed, 'hex'), index));

    saveData();
  }

  if(!hashData.msgCount || typeof hashData.msgCount !== 'number' || hashData.msgCount % 2 !== 1 || hashData.msgCount < 3) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('How many transactions to send? (not counting the final return transaction, will be rounded to nearest odd number greater than or equal to 3) ', input => {
      rl.close();
      input = parseFloat(input);
      if(isNaN(input))
        throw new Error('please input number');

      input = (Math.floor(input/2)*2) + 1;
      if(input < 3) input = 3;

      hashData.msgCount = input;
      saveData();
      handler(hashData);
    });
  }

  if(hashData.msgCount && (!hashData.pendingHash || !HEX64CHAR.test(hashData.pendingHash))) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    console.log('Please specify 64 character hex string of a pending send block to ' + hashData.accounts[0].address);
    console.log('Find this hash at https://www.nanode.co/account/' + hashData.accounts[0].address);
    console.log('Perform this transaction with an external wallet before continuing.')
    rl.question('What is the hash of the block? ', hash => {
      rl.close();
      if(!HEX64CHAR.test(hash))
        throw new Error('invalid hash, please try again');

      hashData.pendingHash = hash;
      saveData();
      handler(hashData);
    });
  }

  let len = !hashData.messages ? 0 : hashData.messages.length;
  if(len < hashData.msgCount && hashData.pendingHash && HEX64CHAR.test(hashData.pendingHash)) {
    console.log('Found', len, 'blocks pre-calculated');
    let block;

    switch(len) {
      case 0:
        hashData.messages = [];
        block = {
          type: 'open',
          source: hashData.pendingHash,
          representative: DEFAULT_REP,
          account: hashData.accounts[0].publicKey
        };
        queueBlock(hashData, block, 0);
        break;
      case 1:
        block = {
          type: 'send',
          previous: hashData.messages[0].hash,
          destination: hashData.accounts[1].publicKey,
          balance: '00000000000000000000000000000000'
        };
        queueBlock(hashData, block, 0);
        break;
      case 2:
        block = {
          type: 'open',
          source: hashData.messages[1].hash,
          representative: DEFAULT_REP,
          account: hashData.accounts[1].publicKey
        };
        queueBlock(hashData, block, 1);
        break;
      default:
        if(len >= hashData.msgCount) break;
        let accountIndex = Math.floor(len/2) % 2;
        let prev = hashData.messages[len-(len % 2 === 1 || len === 3 ? 1 : 3)].hash;
        if(len % 2 === 0) {
          block = {
            type: 'receive',
            previous: prev,
            source: hashData.messages[len-1].hash
          };
        } else {
          block = {
            type: 'send',
            previous: prev,
            destination: hashData.accounts[Math.abs(accountIndex - 1)].publicKey,
            balance: '00000000000000000000000000000000'
          };
        }
        queueBlock(hashData, block, accountIndex);
    }
    if(len + 1 < hashData.msgCount) return handler(hashData);

    len++;
    console.log('Found', len, 'sequence messages ready to send');
  }

  if(len === hashData.msgCount && (!hashData.finalRecipient || !HEX64CHAR.test(hashData.finalRecipient))) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('What address to send balance at end? ', addr => {
      rl.close();
      hashData.finalRecipient = NanoNode.keyFromAccount(addr);
      saveData();
      handler(hashData);
    });
  }

  if(hashData.finalRecipient && HEX64CHAR.test(hashData.finalRecipient) && len === hashData.msgCount) {
    let accountIndex = Math.floor((len-1)/2) % 2;
    let finalBlock = {
      type: 'send',
      previous: hashData.messages[len-1].hash,
      destination: hashData.finalRecipient,
      balance: '00000000000000000000000000000000'
    };
    queueBlock(hashData, finalBlock, accountIndex);
    len++;
  }

  if(len === hashData.msgCount + 1) {
    console.log('Sequence and final blocks all ready! Beginning publish...');
    messageSequence(hashData.messages, () => {
      console.log('All messages sent!');
    });
  }
}

handler(hashData);

function messageSequence(messages, cb, node) {
  if(!node) {
    node = new NanoNode();

    node.on('ready', () => {
      const address = node.client.address();
      console.log(`server listening ${address.address}:${address.port}`);
      // Initial introduction to default rai.raiblocks.net node will give a few peers
      node.publish({ type: 'keepalive' });
    });

    setTimeout(() => {
      console.log('Acquired', node.peers.length, 'peers in', PEER_WAIT, 'ms');
      if(node.peers.length === 1) {
        console.log('Peer connection failed, please try again...');
      } else {
        messageSequence(messages, cb, node);
      }
    }, PEER_WAIT);
  } else if(messages.length) {
    const msg = messages.shift().message;
    node.publish(Buffer.from(msg, 'hex'), null, () => {
      messageSequence(messages, cb, node);
    });
  } else {
    node.client.close();
    cb();
  }

}
