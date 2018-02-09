# nano-mass-tx

With all the talk of Nano Currency network stress testing, there should be a simple tool to take part yourself. This is that tool.

## Installation and Usage

Use [nvm](https://github.com/creationix/nvm) to install Node.js if you do not already have it installed.

```sh
$ npm install -g nano-mass-tx
```

As shown below, you will be prompted for the parameters of the process. You may exit with Ctrl+C or Ctrl+D (at prompts) at any time and resume progress by speciying the same output file.

If for some reason your balance is not returned at the end of the sequence, you may import the seed from the output file into a wallet and recover the funds.

```sh
$ nano-mass-tx test.json
error reading persistence file, starting from new
```

A wallet with 2 accounts is generated randomly at the beginning. The test will transfer the balance of one account to the other and back again until the number of transactions desired has been reached. The first prompt asks how many transactions to send.

```
How many transactions to send? (not counting the final return transaction, will be rounded to nearest odd number greater than or equal to 3) 10

```

You are then prompted to send an amount to the first account.

```
Please specify 64 character hex string of a pending send block to xrb_1dnukwcqaq93ni8qaqjsrcrgmobhfozzroj8yukfkkc737tdkbsar1s68odd
Find this hash at https://www.nanode.co/account/xrb_1dnukwcqaq93ni8qaqjsrcrgmobhfozzroj8yukfkkc737tdkbsar1s68odd
Perform this transaction with an external wallet before continuing.
What is the hash of the block? 6EC4A09C2F64911CEF91A4A271E8268D883D09663ED070E9613ACF53917781F3
```

Next, the work is calculated for each block using the [raiblocks-pow native code NPM module](https://github.com/numtel/node-raiblocks-pow).

```
Found 0 blocks pre-calculated
Generating work for 2e9b97154e7649a40d745e39c2b0e9d52f6d7ffc5626f6e4d949450974b92728
Work found: 267400.137ms
Found 1 blocks pre-calculated
```

Finally, a prompt for the return address is asked, the last work value is calculated, and then the messages are sent to the network of nodes.

```
Found 11 sequence messages ready to send
What address to send balance at end? xrb_1a7yzpzt9weaks382899akk6r1cryhxh4kqn73umojks1uzgg4ipc8jii5km
Generating work for 1284da019c6b5b0526b322861ccf86af1f862f46e886f8aa6479ff39bd1f05d0
Work found: 42174.145ms
Sequence and final blocks all ready! Beginning publish...
server listening 0.0.0.0:56704
Acquired 200 peers in 10000 ms
All messages sent!

```

## License

MIT
