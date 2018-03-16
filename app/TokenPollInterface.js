var TokenPollFactory = artifacts.require('./../build/contracts/TokenPollFactory.sol');
var TokenPoll = artifacts.require('./../contracts/TokenPoll.sol');
var tokenpoll = undefined;

// todo , curry crap

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

var createTokenPoll = async (tokenAddress, escrow, allocStartTime, allocEndTime, web3Params) => {
  let fact = await TokenPollFactory.deployed();
  let tx = await fact.createTokenPoll(tokenAddress, escrow, allocStartTime, allocEndTime, web3Params);

  let event = pullEvent(tx, 'TokenPollCreated');

  return await TokenPoll.at(event.tokenPoll);
}

// =================
//  User functions
// =================

// return successful, tx hash, ?
var allocVotes = async(tokenPoll, web3Params) => {
  if (tokenPoll == undefined) throw('Tokenpoll undefined');

  const tx = tokenPoll.allocVotes(web3Params);
  console.log('Alloc votes t');
  console.log(tx);
  return tx;
}

var getUserVotePower = async(tokenPoll, user) => { return await tokenPoll.getUserVotePower(user); };

var getTotalVotePower = async(tokenPoll) => { return await tokenPoll.totalVotePower(); };

// Total count of potential voters
var getUserCount = async(tokenPoll) => { return await tokenPoll.userCount(); };

var getUserVotePowerPercentage = async(tokenPoll, user) => {
  const vp = await tokenPoll.getUserVotePower(user);
  const tvp = await tokenPoll.totalVotePower();
  return vp.dividedBy(tvp);
}

var getState = async(tokenPoll) => {
  if (tokenPoll == undefined) throw('Tokenpoll undefined');

  let state = await tokenPoll.getState();
  
  return [ 'Start'            // Waits until vote allocation. Can't have Running/Voting before votes are allocated
         , 'VoteAllocation'   // Token balances should be frozen and users allocate votes during this period.
         , 'Running'          // After vote allocation but not voting
         , 'Voting'           // In voting state. Outcome is either State.Running or State.VoteFailed
         , 'VoteFailed'       // If this happens multisig wallet initiates refund
         , 'Refund'           // Users can withdraw remaining balance
         , 'End' ][state];
}

// =================
//       API
// =================

module.exports = 
  { createTokenPoll
  , allocVotes
  , getUserVotePower
  , getTotalVotePower
  , getUserVotePowerPercentage
  , getUserCount
  , getState
  };

 
 
