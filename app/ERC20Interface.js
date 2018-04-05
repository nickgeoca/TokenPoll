import {BigNumber} from 'bignumber.js';

var ERC20 = artifacts.require('./../contracts/ERC20.sol');

// ==============
// Misc
// ==============

const pullEvent = (result, eventType) => {
 for (let i = 0; i < result.logs.length; i++) {
      let log = result.logs[i];
      if (log.event == eventType) return log.args;
    }
}

// =============
// Init function
// =============

var init = async (web3) => {
  await ERC20.setProvider(web3.currentProvider);
}

var getERC20WithAddress = async (address) => { return await ERC20.at(address); };

var getBalance = async (token, address) => { 
  let decimals;

  try        { decimals = await token.decimals(); }
  catch(err) { decimals = new BigNumber(0);       }

  decimals = (new BigNumber(10)).pow(decimals);
  return (await token.balanceOf(address)).dividedBy(decimals);
};

// =================
//       API
// =================

module.exports = 
  { init
  , getERC20WithAddress
  , getBalance
  };
