var TokenPollFactory = artifacts.require('./../build/contracts/TokenPollFactory.sol');
var TokenPoll = artifacts.require('./../contracts/TokenPoll.sol');
var tokenpoll = undefined;

// ==============
// Misc
// ==============

const pullEvent = (result, eventType) => {
 for (let i = 0; i < result.logs.length; i++) {
      let log = result.logs[i];
      if (log.event == eventType) return log.args;
    }
}

var init = async (web3) => {
  await TokenPollFactory.setProvider(web3.currentProvider);
  await TokenPoll.setProvider(web3.currentProvider);
}

var getTokenPollWithAddress = async (address) => {return await TokenPoll.at(address);};

var verifyInState = async (tokenPoll, expectedState) => {
  let actualState = await getState(tokenPoll);
  if (actualState !== expectedState) throw ('Contract is in state "' + actualState + '", but must be in state "' + expectedState + '"');
}

// var verifyTokenPoll = tp => { assert(tp != undefined, 'TokenPoll undefined'); }
// var verifyTokenPoll = (tp) => { assert(tp.address != '0x', 'Address not valid'); }
var verifyTokenPoll = (tp) => { return; }

// =============
// ICO Functions
// =============

var createTokenPoll = async (web3Params) => {
  let fact = await TokenPollFactory.deployed();
  let tx = await fact.createTokenPoll(web3Params);

  let event = pullEvent(tx, 'TokenPollCreated');

  return await TokenPoll.at(event.tokenPoll);
}

var initializeTokenPoll = async (tokenPoll, icoTokenAddress, scTokenAddress, escrow, allocStartTime, web3Params) => {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'Uninitialized');

  return await tokenPoll.initialize(icoTokenAddress, scTokenAddress, escrow, allocStartTime, web3Params);
}

var setupNextRound = async (tokenPoll, newStartTime, web3Params) => {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'NextRoundApproved');

  let tx = await tokenPoll.setupNextRound(newStartTime, web3Params);
  return {tx: tx, event: pullEvent(tx, 'NewRoundInfo')};
}

var startRound = async (tokenPoll, web3Params) => {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'NextRoundApproved');

  return await tokenPoll.startRound(web3Params);
}

var approveNewRound = async (tokenPoll, web3Params) => {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'PostRoundDecision');

  let tx = await tokenPoll.approveNewRound(web3Params);
  return {tx: tx, event: pullEvent(tx, 'RoundResult')};
}

// ===============
// Voter Functions
// ===============

// return successful, tx hash, ?
var allocVotes = async(tokenPoll, web3Params) => {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'VoteAllocation');

  return tokenPoll.allocVotes(web3Params);;
}

// Vote is a boolean
var castVote = async(tokenPoll, vote, web3Params) => { 
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'InRound');

  return tokenPoll.castVote(vote, web3Params); 
}

var userRefund = async(tokenPoll, vote, web3Params) => { 
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'Refund');

  return tokenPoll.userRefund(vote, web3Params); 
}

var startRefund_voteFailed = async(tokenPoll, web3Params) => { 
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'NextRoundApproved');

  return tokenPoll.startRefund_voteFailed(web3Params); 
}

var startRefund_illegalRoundDelay = async(tokenPoll, web3Params) => { 
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'NextRoundApproved');

  return tokenPoll.startRefund_illegalRoundDelay(web3Params); 
}
  
// =======
// Getters
// =======

var getState = async(tokenPoll) => {
  await verifyTokenPoll(tokenPoll);

  let state = await tokenPoll.getState();
  const states = 
      [ 'Uninitialized'      // Waits token poll is parameterized
      , 'Initialized'        // Waits until vote allocation. Can't have InRound/Voting before votes are allocated
      , 'VoteAllocation'     // Token balances should be frozen and users allocate votes during this period.

      , 'InRound'            // Voting period. Follows VoteAllocation & NextRoundApproved
      , 'PostRoundDecision'
      , 'NextRoundApproved'

      , 'Refund'             // Users can withdraw remaining balance
      , 'Finished'           // End of polls
                 
      , 'UnknownState'
      ];

  return states[state.toString(10)];
}

var getUserHasVoted = async(tokenPoll, user, roundNum) => { return await tokenPoll.getHasVoted(user, roundNum); };
var getUserVoteChoice = async(tokenPoll, user, roundNum) => { return await tokenPoll.getVoteChoice(user, roundNum); };
var getUserVotePower = async(tokenPoll, user) => { return await tokenPoll.getUserVotePower(user); };

var getYesVotes = async (tokenPoll, roundNum) => {   await verifyTokenPoll(tokenPoll); return tokenPoll.yesVotes(); };
var getNoVotes = async (tokenPoll, roundNum) => {   await verifyTokenPoll(tokenPoll); return tokenPoll.noVotes(); };
var getTotalVotes = async (tokenPoll, roundNum) => {   await verifyTokenPoll(tokenPoll); return (await getYesVotes(tokenPoll)) + (await getNoVotes(tokenPoll)); };
var getQuadraticYesVotes = async (tokenPoll) => {   await verifyTokenPoll(tokenPoll); return tokenPoll.quadraticYesVotes(); }
var getQuadraticNoVotes = async (tokenPoll) => {   await verifyTokenPoll(tokenPoll); return tokenPoll.quadraticNoVotes(); }

// Returns time in seconds
var getAllocationTimeFrame = async (tokenPoll) => {
  await verifyTokenPoll(tokenPoll);
  const start = await tokenPoll.allocStartTime();
  const end   = await tokenPoll.allocEndTime();

  return {start, end}
};


var getRoundTimeFrame = async (tokenPoll) => {
  await verifyTokenPoll(tokenPoll);
  let start = await tokenPoll.getRoundStartTime();
  let end = await tokenPoll.getRoundEndTime();

  return {start, end};
}

// **** misc

var getTotalVotePower = async(tokenPoll) => { return await tokenPoll.totalVotePower(); };

// Total count of potential voters
var getUserCount = async(tokenPoll) => { return await tokenPoll.userCount(); };

var getCurrentRoundNumber = async(tokenPoll) => { return await tokenPoll.currentRoundNumber(); };

var getUserVotePowerPercentage = async(tokenPoll, user) => {
  await verifyTokenPoll(tokenPoll);
  const vp = await tokenPoll.getUserVotePower(user);
  const tvp = await tokenPoll.totalVotePower();
  return vp.dividedBy(tvp);
}

// =================
//       API
// =================

module.exports = 
  // ICO fns
  { init
  , createTokenPoll
  , initializeTokenPoll
  , setupNextRound
  , startRound
  , approveNewRound

  // Voter fns
  , allocVotes
  , castVote
  , userRefund
  , startRefund_voteFailed
  , startRefund_illegalRoundDelay

  // Misc
  , getAllocationTimeFrame
  , getRoundTimeFrame
  , getState
  , getCurrentRoundNumber

  // Vote stats 1
  , getUserHasVoted
  , getUserVoteChoice
  , getUserVotePower

  , getYesVotes
  , getNoVotes
  , getTotalVotes
  , getQuadraticYesVotes
  , getQuadraticNoVotes

  // Vote stats 2
  , getTotalVotePower
  , getUserCount
  , getUserVotePowerPercentage
  };
