var MockTokenPoll = artifacts.require('../../../test/mocks/TokenPoll.sol');
var MockTokenPoll = artifacts.require('../../../build/contracts/TokenPoll.sol');
var tokenpoll = undefined;

var simulated = false;
var testrpc = true;
var failPercentage = 0.01;

// ==============
// Test functions
// ==============

var setBlockTime = async(t, web3Params) => {
  // begin timestamp
  const tx = await tokenpoll.setBlockTime(t, web3Params);
}

// =============
// Init function
// =============

var init = async (web3Params) => {
  if (testrpc)
    tokenpoll = await MockTokenPoll.new(web3Params);
  else
    tokenpoll = await TokenPoll.Deployed();
}

// =================
//  User functions
// =================

var allocVotes = async(web3Parms) => {
  // If simulated allocate fake votes
  if (simulated) return;

  // For all other cases, testrpc, testnet, mainnet
  if (escrow == undefined) throw('Escrow undefined');
  
  const tx = tokenpoll.allocVotes(web3Parmas);
  return tx;
}

var getUserVotePowerPercentage = async(user) = {
  const vp = await getUserVotePower(user);
  const tvp = totalVotePower;
  return vp / tvp;
}

// =================
//       API
// =================

exports.setBlockTime = setBlockTime;

// init
exports.init = init;

// User
exports.allocVotes = allocVotes;
exports.getUserVotePowerPercentage = getUserVotePowerPercentage;
