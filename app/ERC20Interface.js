require('babel-polyfill');
const BigNumber = require('bignumber.js');

const contract = require('truffle-contract');
const ERC20 = contract(require('../build/contracts/ERC20.json'));

// ==============
// Misc
// ==============

const pullEvent = (result, eventType) => {
 for (let i = 0; i < result.logs.length; i++) {
      let log = result.logs[i];
      if (log.event == eventType) return log.args;
    }
}

const throwIfError = e => {if (e) throw e;}

// =========
// Functions
// =========

// Call this once before calling any other functions to initialize the file.
const init = async (web3, eFn) => { try {
  await ERC20.setProvider(web3.currentProvider);
} catch (e) { eFn(e); }}

const transfer = async (token, to, value, web3Params, eFn) => { try {
  return (await ERC20.at(token)).transfer(to, value, web3Params);
} catch (e) { eFn(e); }}

const balanceOf = async (token, address, eFn) => { try {
  return (await ERC20.at(token)).balanceOf(address);
} catch (e) { eFn(e); }}

const getERC20WithAddress = async address => await ERC20.at(address);

// =================
//       API
// =================

module.exports = 
  { init
  , transfer
  , balanceOf
  , getERC20WithAddress
  };
