/*
const run = async () => {
  const execute = test.executeContract('52ae9ac819e41a5accb673020bf8fdb14ebef375', 'createTokenPoll', []);
  console.log('Contract execution:\n' + execute + '\n');
  result = await execute.whenStatusEquals('Ok');
  console.log('Contract execution result:\n' + JSON.stringify(result) + '\n');
};

const runFn (c, a, f, ps) {
  const execute = c.executeContract(a, f, ps);  
  return await execute.whenStatusEquals('Ok');
}

*/


/**
 * @author Nick Geoca <nickgeoca@gmail.com>
 * @file Web interface to TokenPoll.sol
 */


import TokenPollFactory_artifact from "./../build/contracts/TokenPollFactory.json";
import TokenPoll_artifact from "./../build/contracts/TokenPoll.json";
import ERC20_artifact from "./../build/contracts/ERC20.json";

const getContract = async (web3, artifact) => new web3.eth.Contract(artifact.abi);
const getContractDeployed = async (web3, artifact) => new web3.eth.Contract(artifact.abi, artifact.networks[await web3.eth.net.getId()].address);

let TokenPollFactory;
let TokenPoll;
let ERC20;
let tokenpoll = undefined;
let BigNumber = require('bignumber.js');
let web3;
let tpFact;

// ==============
// Misc
// ==============

const pullEvent = (result, eventType) => {
 for (let i = 0; i < result.logs.length; i++) {
      let log = result.logs[i];
      if (log.event == eventType) return log.args;
    }
}

const getTokenPollWithAddress = async address => await TokenPoll.at(address);

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

/**
 * Call this once before calling any other functions to initialize the file.
 *
 * @example 
 * var Web3 = require('web3');
 * var web3 = new Web3();
 * await init(web3, errorFn);
 *
 * @function init 
 * @async
 * @param {Object} web3 Pass in web3 object.
 * @param {callback} eFn Error handler
*/
const init = async (_web3, eFn) => { try {
  TokenPollFactory = await getContractDeployed(_web3, TokenPollFactory_artifact);
  TokenPoll = getContract(_web3, TokenPoll_artifact);
  ERC20 = getContract(_web3, ERC20_artifact);

  web3 = _web3;
} catch (e) { eFn(e); }}

const devSetTPF = tpf => { tpFact = tpf; }

// =============
// ICO Functions
// =============

/**
 * Creates the token poll. 
 *
 * @example 
 * await createTokenPoll({from: user1}, errorFn);     // Create a token poll with user1 as owner
 *
 * @function createTokenPoll
 * @async
 * @param {Object} web3Params Etherem parameters. The address in 'from' will be the owner of the contract.
 * @param {callback} eFn Error handler
 * @returns {Object} The Token Poll as a truffle smart contract object. Other functions in this library rely on it as a parameter 'tokenPoll'.
*/
const createTokenPoll = async (web3Params, eFn) => { try {
  let tx = await tpFact.createTokenPoll(web3Params);

  let event = pullEvent(tx, 'TokenPollCreated');
  const address = event.tokenPoll;

  // See if there is code. Try 5 times, wait 1 second each
  const delayP = time => result => new Promise(resolve => setTimeout(() => resolve(result), time));
  for (let i = 0; i < 60; i++) {
    await delayP(1000);
    const code = await web3.eth.getCode(address);
    const codeAvailable = code && code !== '0x0' && code !== '0x';
    if (codeAvailable) return await TokenPoll.at(address);
  }

  // If no code, then try anyway
  return await TokenPoll.at(event.tokenPoll);
} catch (e) { eFn(e); }}

/**
 * Initializes the token poll. Including the vote allocation time- it is hard coded to one week duration.
 *
 * @example 
 * const tokenPoll = await createTokenPoll({from: user1}, errorFn);     // Create a token poll with user1 as owner
 * const msw = await createMSW();   // This will be added to a future version of this library
 * const allocationStartTime = current unix time seconds + 3 days;
 * await initializeTokenPoll(tokenPoll, icoToken, fundToken, msw.address, allocationStartTime, {from: user1}, errorFn);
 *
 * @function initializeTokenPoll
 * @async
 * @param {Object} tokenPoll The token poll that was created in createTokenPoll.
 * @param {address} icoTokenAddress The address of the ico token
 * @param {address} escrow Address of the multi-sig wallet
 * @param {BigNum} allocStarTime Unix time stamp in seconds. Start of vote allocation period. Must be greater than the current block time when excuted on the blockchain.
 * @param {Object} web3Params Etherem parameters. The address in 'from' will be the owner of the contract.
 * @param {callback} eFn Error handler
 * @returns {Object} Etheruem transaction result.
*/
const initializeTokenPoll = async (tokenPoll, icoTokenAddress, escrow, allocStartTime, web3Params, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'Uninitialized');

  return await tokenPoll.initialize(icoTokenAddress, escrow, allocStartTime, web3Params);
} catch (e) { eFn(e); }}

/**
 * Setups the next round of funding.
 *
 * @example 
 * const tokenPoll = await createTokenPoll({from: user1}, errorFn);     // Create a token poll with user1 as owner
 * const msw = await createMSW();   // This will be added to a future version of this library
 * const allocationStartTime = current unix time seconds + 3 days;
 * await initializeTokenPoll(tokenPoll, icoToken, fundToken, msw.address, allocationStartTime, {from: user1}, errorFn);
 *
 * @function setupNextRound
 * @async
 * @param {Object} tokenPoll The token poll that was created in createTokenPoll.
 * @param {address} icoTokenAddress The address of the ico token
 * @param {address} scTokenAddress The address of the funding token
 * @param {address} escrow Address of the multi-sig wallet
 * @param {BigNum} allocStarTime Unix time stamp in seconds. Start of vote allocation period. Must be greater than the current block time when excuted on the blockchain.
 * @param {Object} web3Params Etherem parameters. The address in 'from' will be the owner of the contract.
 * @param {callback} eFn Error handler
 * @returns {Object} Etheruem transaction result.
*/
const setupNextRound = async (tokenPoll, newStartTime, fundSize, web3Params, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'NextRoundApproved');

  let tx = await tokenPoll.setupNextRound(newStartTime, fundSize, web3Params);
  return {tx: tx, event: pullEvent(tx, 'NewRoundInfo')};
} catch (e) { eFn(e); }}

const startRound = async (tokenPoll, web3Params, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'NextRoundApproved');

  return await tokenPoll.startRound(web3Params);
} catch (e) { eFn(e); }}

const approveNewRound = async (tokenPoll, web3Params, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'PostRoundDecision');

  let tx = await tokenPoll.approveNewRound(web3Params);
  return {tx: tx, event: pullEvent(tx, 'RoundResult')};
} catch (e) { eFn(e); }}

// ===============
// Voter Functions
// ===============

// return successful, tx hash, ?
const allocVotes = async(tokenPoll, web3Params, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  // await verifyInState(tokenPoll, 'VoteAllocation');

  return tokenPoll.allocVotes(web3Params);;
} catch (e) { eFn(e); }}

// Vote is a boolean
const castVote = async(tokenPoll, vote, web3Params, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'InRound');

  return tokenPoll.castVote(vote, web3Params); 
} catch (e) { eFn(e); }}

const userRefund = async(tokenPoll, web3Params, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'Refund');

  let tx = await tokenPoll.userRefund(web3Params); 
  return {tx: tx, event: pullEvent(tx, 'Transfer')};
} catch (e) { eFn(e); }}

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
const getState = async(tokenPoll, eFn) => { try {
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
} catch (e) { eFn(e); }}

const getEndOfRefundDate = async(tokenPoll, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'Refund');

  return new BigNumber(60*60*24*30*6 + Math.round(new Date() / 1000));
} catch (e) { eFn(e); }}

const getUserRefundSize = async(tokenPoll, user, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'Refund');

  return await tokenPoll.getUserRefundSize(user);
} catch (e) { eFn(e); }}

const getUserRefundStatus = async(tokenPoll, user, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  await verifyInState(tokenPoll, 'Refund');
  
  const refundSize = (await tokenPoll.getUserRefundSize(user)).toString(10);
  let status;

  if (refundSize == '0') status = 'UserRefunded';
  else                   status = 'UserNotRefunded';

  return status;
} catch (e) { eFn(e); }}

const getRemainingFunds = async(tokenPoll, eFn) => { try {
  const escrowAddress = await tokenPoll.escrow();
  const stableCoinAddress = await tokenPoll.stableCoin();
  
  return await ERC20.at(stableCoinAddress).balanceOf(escrowAddress); 
} catch (e) { eFn(e); }}

const currentRoundFundSize = async(tokenPoll, eFn) => { try {
  return await tokenPoll.currentRoundFundSize();
} catch (e) { eFn(e); }}

const getUserHasVoted = async(tokenPoll, user, roundNum, voteNum, eFn) => { try {
  return await tokenPoll.getHasVoted(user, roundNum, voteNum); 
} catch (e) { eFn(e); }}

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
      
const getUserVotePower = async(tokenPoll, user, eFn) => { try {
  return await tokenPoll.getUserVotePower(user); 
} catch (e) { eFn(e); }}

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

const getResultHistory = async(tokenPoll, eFn) => { try {
  const state = await getState(tokenPoll);
  let moreData = [];
  if (state === 'InRound' || state === 'PostRoundDecision')
    moreData = [{ roundFinished: false
                , fundingRoundNumber: (await tokenPoll.currentRoundNumber()).toString()
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
                                        , fundingRoundNumber: l.args.round.toString()
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
} catch (e) { eFn(e); }}

// Returns time in seconds
const getAllocationTimeFrame = async (tokenPoll, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  const start = await tokenPoll.allocStartTime();
  const end   = await tokenPoll.allocEndTime();

  return {start, end}
} catch (e) { eFn(e); }}


const getRoundTimeFrame = async (tokenPoll, eFn) => { try {
  await verifyTokenPoll(tokenPoll);
  let start = await tokenPoll.getRoundStartTime();
  let end = await tokenPoll.getRoundEndTime();

  return {start, end};
} catch (e) { eFn(e); }}

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
  // Dev fns
  { devSetTPF
    
  // ICO fns
  , init
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
