let MSW = artifacts.require('build/contracts/MultiSigWallet.sol');
let TokenPoll = artifacts.require('./../contracts/tokenPoll/TokenPoll.sol');
let CreateStash = artifacts.require('./../build/contracts/CreateStash.sol');

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
  await TokenPoll.setProvider(web3.currentProvider);
  await CreateStash.setProvider(web3.currentProvider);
  await MSW.setProvider(web3.currentProvider);
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


const dev_createTokenPoll = async (cs, fundingToken, icoToken, roundOneFunding, web3Params) => {
  let tx = await cs.createStash(fundingToken, icoToken, roundOneFunding, web3Params);
  let event = pullEvent(tx, 'StashCreated');

  return { tokenPoll : await TokenPoll.at(event.tokenPoll)
         ,  wallet   : await MSW.at(event.wallet) 
         }
};

var createTokenPoll = async (fundingToken, icoToken, roundOneFunding, web3Params) => {
  let createStash = await CreateStash.deployed();
  let tx = await createStash.createStash(fundingToken, icoToken, roundOneFunding, web3Params);

  let event = pullEvent(tx, 'StashCreated');

  return { tokenPoll : await TokenPoll.at(event.tokenPoll)
         ,  wallet   : await MSW.at(event.wallet) 
         }
};

var receiveFunds_sendRound1Funds = async (tokenPoll, crowdFundBank, web3Params) => {
  return await tokenPoll.receiveFunds_sendRound1Funds(crowdFundBank, web3Params);
}

var initializeTokenPoll = async (tokenPoll, allocStartTime, web3Params) => {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'Uninitialized');

  return await tokenPoll.initialize(allocStartTime, web3Params);
}

var setupNextRound = async (tokenPoll, newStartTime, fundSize, web3Params) => {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'NextRoundApproved');

  let tx = await tokenPoll.setupNextRound(newStartTime, fundSize, web3Params);
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
  // await verifyInState(tokenPoll, 'VoteAllocation');

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
                 
      , 'UnknownState'
      ];

  return states[state.toString(10)];
}

const throwIfError = e => { if (e) throw e;};

var getUserHasVoted = async(tokenPoll, user, roundNum, voteNum) =>  tokenPoll.getHasVoted(user, roundNum, voteNum); 

const getUserVoteHistory = (tokenPoll, user) => {
  return new Promise(resolve => {
    tokenPoll.Vote({voter:user}, {fromBlock: 0, toBlock: 'latest' })
      .get((error, logs) => { 
        throwIfError(error);
        const ls = logs.map(l => {return{ round: l.args.round.toString()
                                        , votingRoundNumber: l.args.votingRoundNumber.toString()
                                        , vote: l.args.vote
                                        };});
        resolve(ls);
      });
  });
};

const getUserVoteChoice = (tokenPoll, user, fundRound, voteRound) => {
  return new Promise(resolve => {
    tokenPoll.Vote({voter:user, round:fundRound, votingRoundNumber:voteRound}, {fromBlock: 0, toBlock: 'latest' })
      .get((error, logs) => { 
        throwIfError(error);
        if (logs.length === 0) resolve(undefined);
        else             resolve(logs[0].args.vote);
      });
  });
};
      
var getUserVotePower = async(tokenPoll, user) => { return await tokenPoll.getUserVotePower(user); };

// var getCurrentYesVotes = async (tokenPoll) =>    { await verifyTokenPoll(tokenPoll); return tokenPoll.yesVotes(); };

const getYesVotes = async(tokenPoll, fundRound, voteRound) => {
  const isCurrentRound = (await getFundingRoundNumber(tokenPoll)).toString() === fundRound.toString()
                      && (await getVotingRoundNumber(tokenPoll)).toString() === voteRound.toString();
  if (isCurrentRound) 
    return tokenPoll.yesVotes();

  return new Promise(resolve => {
    tokenPoll.RoundResult({round:fundRound, votingRoundNumber:voteRound}, {fromBlock: 0, toBlock: 'latest' })
      .get((error, logs) => { 
        throwIfError(error);
        if (logs.length === 0) resolve(undefined);
        else                   resolve(logs[0].args.yesVoters)
      });
  });
};

const getNoVotes = async(tokenPoll, fundRound, voteRound) => {
  const isCurrentRound = (await getFundingRoundNumber(tokenPoll)).toString() === fundRound.toString()
                      && (await getVotingRoundNumber(tokenPoll)).toString() === voteRound.toString();
  if (isCurrentRound) 
    return tokenPoll.noVotes();

  return new Promise(resolve => {
    tokenPoll.RoundResult({round:fundRound, votingRoundNumber:voteRound}, {fromBlock: 0, toBlock: 'latest' })
      .get((error, logs) => { 
        throwIfError(error);
        if (logs.length === 0) resolve(undefined);
        else                   resolve(logs[0].args.noVoters)
      });
  });
};

var getTotalVotes = async (tokenPoll, fundRound, voteRound) =>  { await verifyTokenPoll(tokenPoll); return (await getYesVotes(tokenPoll, fundRound, voteRound)) + (await getNoVotes(tokenPoll, fundRound, voteRound)); };

const getQuadraticYesVotes = async(tokenPoll, fundRound, voteRound) => {
  const isCurrentRound = (await getFundingRoundNumber(tokenPoll)).toString() === fundRound.toString()
                      && (await getVotingRoundNumber(tokenPoll)).toString() === voteRound.toString();
  if (isCurrentRound) 
    return tokenPoll.quadraticYesVotes();

  return new Promise(resolve => {
    tokenPoll.RoundResult({round:fundRound, votingRoundNumber:voteRound}, {fromBlock: 0, toBlock: 'latest' })
      .get((error, logs) => { 
        throwIfError(error);
        if (logs.length === 0) resolve(undefined);
        else                   resolve(logs[0].args.weightedYesVotes)
      });
  });
};

const getQuadraticNoVotes = async(tokenPoll, fundRound, voteRound) => {
  const isCurrentRound = (await getFundingRoundNumber(tokenPoll)).toString() === fundRound.toString()
                      && (await getVotingRoundNumber(tokenPoll)).toString() === voteRound.toString();
  if (isCurrentRound) 
    return tokenPoll.quadraticNoVotes();

  return new Promise(resolve => {
    tokenPoll.RoundResult({round:fundRound, votingRoundNumber:voteRound}, {fromBlock: 0, toBlock: 'latest' })
      .get((error, logs) => { 
        throwIfError(error);
        if (logs.length === 0) resolve(undefined);
        else                   resolve(logs[0].args.weightedNoVotes)
      });
  });
};


const getResultHistory = async(tokenPoll) => {
  const state = await getState(tokenPoll);
  let moreData = [];
  if (state === 'InRound' || state === 'PostRoundDecision')
    moreData = [{ roundFinished: false
                , round: (await tokenPoll.currentRoundNumber()).toString()
                , votingRoundNumber: (await tokenPoll.votingRoundNumber()).toString()
                , weightedNoVotes: (await tokenPoll.quadraticNoVotes()).toString()
                , weightedYesVotes: (await tokenPoll.quadraticYesVotes()).toString()
                , yesVoters: (await tokenPoll.yesVotes()).toString()
                , noVoters: (await tokenPoll.noVotes()).toString()
                , fundSize: (await tokenPoll.currentRoundFundSize()).toString()
                }];

  return new Promise(resolve => {
    tokenPoll.RoundResult({}, {fromBlock: 0, toBlock: 'latest' })
      .get((error, logs) => { 
        throwIfError(error);
        const ls = logs.map(l => {return{ roundFinished: true
                                        , round: l.args.round.toString()
                                        , votingRoundNumber: l.args.votingRoundNumber.toString()
                                        , approvedFunding: l.args.approvedFunding
                                        , weightedNoVotes: l.args.weightedNoVotes.toString()
                                        , weightedYesVotes: l.args.weightedYesVotes.toString()
                                        , yesVoters: l.args.yesVoters.toString()
                                        , noVoters: l.args.noVoters.toString()
                                        , fundSize: l.args.fundSize.toString()
                                        };});
        resolve(ls.concat(moreData));
      });
  });
};

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

var getFundingRoundNumber = async(tokenPoll) => { return await tokenPoll.currentRoundNumber(); };
var getVotingRoundNumber = async(tokenPoll) => { return await tokenPoll.votingRoundNumber(); };

var getUserVotePowerPercentage = async(tokenPoll, user) => {
  await verifyTokenPoll(tokenPoll);
  const vp = await tokenPoll.getUserVotePower(user);
  const tvp = await tokenPoll.totalVotePower();
  return vp.dividedBy(tvp);
}

// ----------------------------
const getTPFAddress = async()  => await (await CreateStash.deployed()).tpFact();
const getMSWFAddress = async() => await (await CreateStash.deployed()).walletFact();

// =================
//       API
// =================

module.exports = 
  // ICO fns
  { init
  , createTokenPoll
  , receiveFunds_sendRound1Funds
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
  , getFundingRoundNumber
  , getVotingRoundNumber

  // Vote stats 1
  , getUserHasVoted
  , getUserVoteHistory
  , getUserVoteChoice
  , getUserVotePower

  , getYesVotes
  , getNoVotes
  , getTotalVotes
  , getQuadraticYesVotes
  , getQuadraticNoVotes

  , getResultHistory

  // Vote stats 2
  , getTotalVotePower
  , getUserCount
  , getUserVotePowerPercentage

  // dev
  , dev_createTokenPoll
  , getTPFAddress
  , getMSWFAddress
  , getTokenPollWithAddress
  };
