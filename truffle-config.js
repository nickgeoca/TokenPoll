const keys = require('./keys');
const HDWalletProvider = require('truffle-hdwallet-provider');

const infura_apikey = keys.infura_apikey;
const mnemonic = keys.mnemonic;

const ropstenProvider = new HDWalletProvider(mnemonic, "https://ropsten.infura.io/" + infura_apikey);
const rinkebyProvider = new HDWalletProvider(mnemonic, "https://rinkeby.infura.io/" + infura_apikey);
const kovanProvider   = new HDWalletProvider(mnemonic, "https://kovan.infura.io/" + infura_apikey);
const liveProvider    = new HDWalletProvider(mnemonic, "https://mainnet.infura.io/" + infura_apikey);

const gasPriceMainNet = 0; // gigawei
const gasPriceTest = 2 * 1000000000; // gigawei
const gas = 6000000;

module.exports = {
  networks: {
    development: {
     host: "127.0.0.1",     
     port: 8545,            
     network_id: "*",       
     websockets: false
    },
    live: {
      gasPrice: gasPriceMainNet, 
      gas: gas,
      provider: liveProvider,
      network_id: 1,
      from: liveProvider.getAddress() 
    },
    ropsten: {
      gasPrice: gasPriceTest, 
      gas: gas,
      provider: ropstenProvider,
      network_id: 3,
      from: ropstenProvider.getAddress() 
    },
    rinkeby: { 
      gasPrice: gasPriceTest, 
      gas: gas,
      network_id: 4, 
      provider: rinkebyProvider,
      from: rinkebyProvider.getAddress() 
    },
    kovan: {
      gasPrice: gasPriceTest, 
      gas: gas,
      provider: kovanProvider,
      network_id: 42,
      from: kovanProvider.getAddress() 
    } 
  },

  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      // version: "0.5.1",
      // docker: true,
      settings: {
       optimizer: {
         enabled: false,
         runs: 200
       },
       evmVersion: "byzantium"
      }
    }
  }
}
