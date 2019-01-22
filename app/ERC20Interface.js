require('babel-polyfill');
import Web3 from "web3";
import ERC20_artifact from "./../build/contracts/ERC20.json";

const getContract = (web3, artifact) => new web3.eth.Contract(artifact.abi);
let ERC20;

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
  // get contract instance
  ERC20 = getContract(web3, ERC20_artifact);
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
