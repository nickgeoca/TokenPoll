/**
 * @author Nick Geoca <nickgeoca@gmail.com>
 * @file Web interface to TokenPoll.sol
 */

require('babel-polyfill');
const BigNumber = require('bignumber.js');

let web3;


// ==============
// Misc
// ==============

const pullEvent = (result, eventType) => {
 for (let i = 0; i < result.logs.length; i++) {
      let log = result.logs[i];
      if (log.event == eventType) return log.args;
    }
}

const getTokenPollWithAddress = async address => '';

const verifyInState = async (tokenPoll, expectedState) => {
  let actualState = await getState(tokenPoll);
  if (actualState !== expectedState) throw ('Contract is in state "' + actualState + '", but must be in state "' + expectedState + '"');
}

// todo
var verifyTokenPoll = tp => { return; }

const throwIfError = e => {if (e) throw e;}

// ==============
// Setup Function
// ==============

const init = async _web3 => { 
  web3 = _web3;
}


const createTokenPoll = async web3Params => {
  return {address: '0xbE1085bc3e0812F3dF63dEcED87e29b3BC2db524'};
}


const initializeTokenPoll = async (tokenPoll, icoTokenAddress, scTokenAddress, allocStartTime, web3Params) => {
  // tokenPoll.initialize(icoTokenAddress, scTokenAddress, allocStartTime, web3Params);
  return ''; 
}

const initializeEscrow = async (tokenPoll, escrow, web3Params) => {
  // tokenPoll.initialize(escrow, web3Params);
  return ''; 
}
TODO GREP AND FIX POLL_STATE
const setupNextRound = async (tokenPoll, newStartTime, fundSize, web3Params) => { 
  // tokenPoll.setupNextRound(newStartTime, fundSize, web3Params);
  // pullEvent(tx, 'NewRoundInfo')
  // event (uint indexed round, uint indexed votingRoundNumber, uint startTime, uint endTime, uint fundSize)
  const oneWeek = new BigNumber(60*60*24*7);
  const endTime = oneWeek.plus(newStartTime);
  const round new BigNumber(4);
  return {tx: '', event: {round: round, startTime: newStartTime, endTime: endTime}};
}

const startRound = async (tokenPoll, web3Params) => {
  return '';
}

const approveNewRound = async (tokenPoll, web3Params) => {
  if ('PostRoundDecision') console.error('approveNewRound. Wrong state. '+sim_currentState+', should be PostRoundDecision');
  
  

  let tx = await tokenPoll.approveNewRound(web3Params);
  return {tx: tx, event: pullEvent(tx, 'RoundResult')};
}

// ===============
// Voter Functions
// ===============

// return successful, tx hash, ?
const allocVotes = async(tokenPoll, web3Params) => {
  sim_currentState = 'VoteAllocation';
  return '';
}

// Vote is a boolean
const castVote = async(tokenPoll, vote, web3Params) => {
  if (vote == true) 
    parseInt(sim_currentRoundState.yesVoters) userVoteSize;
  else 
    
  let sim_currentRoundState = { fundingRoundNumber: '' // String
                            , votingRoundNumber: ''  // String
                            , weightedNoVotes: ''    // String
                            , weightedYesVotes: ''   // String
                            , yesVoters: ''          // String
                            , noVoters: ''           // String
                            , fundSize: ''           // String
                            };

  return '';
} 

const userRefund = async(tokenPoll, web3Params) => {
  sim_refundUser = web3Params.from;
  return '';
}

const startRefund_voteFailed = async(tokenPoll, web3Params, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'NextRoundApproved');

  return tokenPoll.startRefund_voteFailed(web3Params); 
} catch (e) { eFn(e); }}

const startRefund_illegalRoundDelay = async(tokenPoll, web3Params, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'NextRoundApproved');

  return tokenPoll.startRefund_illegalRoundDelay(web3Params); 
} catch (e) { eFn(e); }}
  
// =======
// Getters
// =======

/**
 * Get the state of the token poll.
 * <ul>
 * <li>Uninitialized: If in this state, call <b>initializeTokenPoll</b>.</li>
 * <li>Initialized: If in this state, it is waiting until the vote allocation has started. </li>
 * <li>VoteAllocation: This is when users allocate their votes, call <b>allocVotes</b>. The ICO token balances should be frozen during this time.</li>
 * <li>InRound: Users vote during this time.</li>
 * <li>PostRoundDecision: If in this state, call <b>approveNewRound</b></li>
 * <li>NextRoundApproved: If in this state, the ico call's <b>setupNextRound</b></li>
 * <li>Refund: Users can withdraw their remaining balances. This happens if in PostRoundDecision state and refund occurs.</li>
 * <li>UnknownState</li>
 * </ul>
 * 
 * @example 
 * // See if in refund state
 * const inRefundState = (await getState(tokenPoll, eFn)) == 'Refund';
 * if (inRefundState) console.log('TokenPoll is refunding users');
 * 
 * @function getState
 * @async
 * @param {Object} web3 Pass in web3 object.
 * @param {callback} eFn Error handler
*/
const getState = async tokenPoll => sim_currentState;


const getEndOfRefundDate = async tokenPoll => new BigNumber(60*60*24*30*6 + Math.round(new Date() / 1000));


const getUserRefundSize = async (tokenPoll, user) => new BigNumber(3000000000000000);

const getUserRefundStatus = async(tokenPoll, user) => 'UserRefunded';

const getRemainingFunds = async(tokenPoll) => { 
  //return await ERC20.at(stableCoinAddress).balanceOf(escrowAddress); 
  return new BigNumber(4510000000000000);
}

const currentRoundFundSize = async(tokenPoll, eFn) => { try {
  return await tokenPoll.currentRoundFundSize();
} catch (e) { eFn(e); }}

const hasUserVoted = async(tokenPoll, user, roundNum, voteNum) => true;

const getUserVoteHistory = (tokenPoll, user, eFn) => { try {
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
} catch (e) { eFn(e); }}

const getUserVoteChoice = (tokenPoll, user, fundRound, voteRound, eFn) => { try {
  return new Promise(resolve => {
    tokenPoll.Vote({voter:user, round:fundRound, votingRoundNumber:voteRound}, {fromBlock: 0, toBlock: 'latest' })
      .get((error, logs) => { 
        throwIfError(error);
        if (logs.length === 0) resolve(undefined);
        else             resolve(logs[0].args.vote);
      });
  });
} catch (e) { eFn(e); }}
      
const getUserVotePower = async(tokenPoll, user) => new BigNumber(3231);

const getYesVotes = async(tokenPoll, fundRound, voteRound, eFn) => { try {
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
} catch (e) { eFn(e); }}

const getNoVotes = async(tokenPoll, fundRound, voteRound, eFn) => { try {
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
} catch (e) { eFn(e); }}

const getTotalVotes = async (tokenPoll, fundRound, voteRound, eFn) =>  { try { 
  await verifyTokenPoll(tokenPoll); 
  return (await getYesVotes(tokenPoll, fundRound, voteRound)) + (await getNoVotes(tokenPoll, fundRound, voteRound)); 
} catch (e) { eFn(e); }}

const getQuadraticYesVotes = async(tokenPoll, fundRound, voteRound, eFn) => { try {
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
} catch (e) { eFn(e); }}

const getQuadraticNoVotes = async(tokenPoll, fundRound, voteRound, eFn) => { try {
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
} catch (e) { eFn(e); }}

const getResultHistory = async tokenPoll => {
  let roundHist    = Object.assign({}, sim_roundHistory);
  let currentRound = Object.assign({}, sim_currentRoundState);

  // Round finished?
  roundHist = roundHist.map(round => {round.roundFinished = true; return round});
  currentRound.roundFinished = false;

  if (state === 'InRound' || state === 'PostRoundDecision') 
    roundHist.push(currentRound);
  return ret;
}

// Returns time in seconds
const getAllocationTimeFrame = async (tokenPoll, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  const start = await tokenPoll.allocStartTime();
  const end   = await tokenPoll.allocEndTime();

  return {start, end}
} catch (e) { eFn(e); }}

const getRoundTimeFrame = async tokenPoll => {
  let start = sim_roundStartTime;
  let end   = sim_roundEndTime;
  return {start, end};
}

// **** misc

const getTotalVotePower = async(tokenPoll, eFn) => { try {
  return await tokenPoll.totalVotePower(); 
} catch (e) { eFn(e); }}

// Total count of potential voters
const getUserCount = async(tokenPoll, eFn) => { try { 
  return await tokenPoll.userCount(); 
} catch (e) { eFn(e); }}

const getFundingRoundNumber = async(tokenPoll, eFn) => { try { 
  return await tokenPoll.currentRoundNumber(); 
} catch (e) { eFn(e); }}

const getVotingRoundNumber = async(tokenPoll, eFn) => { try { 
  return await tokenPoll.votingRoundNumber(); 
} catch (e) { eFn(e); }}

const getUserVotePowerPercentage = async(tokenPoll, user, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  const vp = await tokenPoll.getUserVotePower(user);
  const tvp = await tokenPoll.totalVotePower();
  return vp.dividedBy(tvp);
} catch (e) { eFn(e); }}

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
  , getUserRefundStatus
  , getUserRefundSize
  , getEndOfRefundDate
  , currentRoundFundSize
  , getRemainingFunds
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
  };
