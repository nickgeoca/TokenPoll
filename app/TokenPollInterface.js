/**
 * @author Nick Geoca <nickgeoca@gmail.com>
 * @file Web interface to TokenPoll.sol
 */

require('babel-polyfill');
const BigNumber = require('bignumber.js');

const contract = require('truffle-contract');
const TokenPollFactory = contract(require('../build/contracts/TokenPollFactory.json'));
const TokenPoll = contract(require('../build/contracts/TokenPoll.json'));
const ERC20 = contract(require('../build/contracts/ERC20.json'));

// var TokenPollFactory = artifacts.require('./../build/contracts/TokenPollFactory.sol');
// var TokenPoll = artifacts.require('./../contracts/TokenPoll.sol');
// var ERC20 = artifacts.require('./../contracts/ERC20.sol');
// var tokenpoll = undefined;
let web3;
let BN;

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

// Truncates
function numStrAndDecimalsToStr(strNum, decimals) {
   decimals = parseInt(decimals);
   function insert(str, index, value) {    return str.substr(0, index) + value + str.substr(index);}
   const hasDecimalPlace = strNum.indexOf('.') > -1;
   strNum = strNum + ('0'.repeat(decimals)) + (hasDecimalPlace?'':'.');
   strNum = strNum.split('.');
   const prevDecPlace = strNum[0].length;
   return insert(strNum[0]+strNum[1], prevDecPlace+decimals, '.').split('.')[0];
}
const stableCoinRealToInt = async (tokenPollAddress, strRealAmount) => {
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  const stableCoinAddress = await tokenPoll.stableCoin();
  const stableCoin = await ERC20.at(stableCoinAddress);
  const stableCoinDecimals = (await stableCoin.decimals()).toString(10);
  const result = numStrAndDecimalsToStr(strRealAmount, stableCoinDecimals);
  return result;
}

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
  web3 = _web3;
  BN = web3.utils.BN;
  await TokenPollFactory.setProvider(web3.currentProvider);
  await TokenPoll.setProvider(web3.currentProvider);
  await ERC20.setProvider(web3.currentProvider);
} catch (e) { eFn(e); }}

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
 * @returns {address} TokenPoll address
*/
const createTokenPoll = async (web3Params) => {
  let fact = await TokenPollFactory.deployed();
  let tx = await fact.createTokenPoll(web3Params);

  let event = pullEvent(tx, 'TokenPollCreated');
  return event.tokenPoll;
}

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
 * @param {address} scTokenAddress The address of the funding token
 * @param {BigNum} allocStarTime Unix time stamp in seconds. Start of vote allocation period. Must be greater than the current block time when excuted on the blockchain.
 * @param {BigNum} roundOneFunding 
 * @param {Object} web3Params Etherem parameters. The address in 'from' will be the owner of the contract.
 * @returns {Object} Etheruem transaction result.
*/
const initializeTokenPoll = async (tokenPollAddress, icoTokenAddress, scTokenAddress, web3Params) => {
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  return await tokenPoll.initialize(icoTokenAddress, scTokenAddress, web3Params);
}

const initializeVoterRegistration = async (tokenPollAddress, startTime, web3Params) => {
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  return await tokenPoll.initializeVoterRegistration(startTime, web3Params);
}

const initializeProjectWalletAddress = async (tokenPollAddress, projectWallet, web3Params) => {
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  return await tokenPoll.initializeProjectWalletAddress(projectWallet, web3Params);
}

const initializeRound1FundingAmount = async (tokenPollAddress, strRealAmount, web3Params) => {
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  const strIntAmount = await stableCoinRealToInt(tokenPollAddress, strRealAmount);
  return await tokenPoll.initializeRound1FundingAmount(strIntAmount, web3Params);
}

const getInitializerData = async (tokenPollAddress) => {
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  const ps = [tokenPoll.icoCoin(), tokenPoll.stableCoin(), tokenPoll.registrationStartTime(), tokenPoll.projectWallet(), tokenPoll.roundOneFunding()];
  const data = await Promise.all(ps)
  return {icoCoin: data[0], stableCoin: data[1], registrationStartTime: data[2], projectWallet: data[3], roundOneFunding: data[4]};
}

const pullFundsAndDisburseRound1 = async (tokenPollAddress, fundsOrigin, fundsBalance, web3Params) => {
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  const strIntAmount = await stableCoinRealToInt(tokenPollAddress, fundsBalance);
  console.log('Amount to pull', strIntAmount);
  const tx = await tokenPoll.pullFundsAndDisburseRound1(fundsOrigin, strIntAmount, web3Params);
  return {tx: tx, event: pullEvent(tx, 'RoundResult')};
}

const registerAsVoter = async (tokenPollAddress, web3Params) => { 
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  let tx = await tokenPoll.registerAsVoter(web3Params);
  return {tx: tx};
}

const setupNextRound = async (tokenPollAddress, newStartTime, fundSize, web3Params) => { 
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  const strIntAmount = await stableCoinRealToInt(tokenPollAddress, fundSize);
  console.log('Round fund amount',strIntAmount);
  const tx = await tokenPoll.setupNextRound(newStartTime, strIntAmount, web3Params);
  return {tx: tx, event: pullEvent(tx, 'NewRoundInfo')};
}

const finalizeRound = async (tokenPollAddress, web3Params) => { 
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  const tx = await tokenPoll.finalizeRound(web3Params);
  return {tx: tx, event: pullEvent(tx, 'RoundResult')};
}

const castVote = async (tokenPollAddress, vote, web3Params) => { 
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  const tx = await tokenPoll.castVote(vote, web3Params);
  return {tx: tx};
}

const castYesVote = async (tokenPollAddress, web3Params) => { 
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  const tx = await tokenPoll.castVote(true, web3Params);
  return {tx: tx};
}
const castNoVote = async (tokenPollAddress, web3Params) => { 
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  const tx = await tokenPoll.castVote(false, web3Params);
  return {tx: tx};
}

const userRefund = async (tokenPollAddress, web3Params) => { 
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  const tx = await tokenPoll.userRefund(web3Params);
  return {tx: tx};
}

const isInRound = async (tokenPollAddress, web3Params) => { 
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  return await tokenPoll.isInRound(web3Params);
}

const getRoundTimeFrame = async (tokenPollAddress) => {
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  let start = await tokenPoll.getRoundStartTime();
  let end = await tokenPoll.getRoundEndTime();

  return {start, end};
}

// **************************************************
// NEW STUFF

const refundIfPenalized = async (tokenPollAddress, web3Params) => { 
  const tokenPoll = await getTokenPollWithAddress(tokenPollAddress);
  const tx = await tokenPoll.refundIfPenalized(web3Params);
  return {tx: tx}
}

// NEW STUFF
// **************************************************

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
const getState = async(tokenPoll) => {
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

  return states[0];
}

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
  { init
  , createTokenPoll

  , initializeTokenPoll
  , initializeVoterRegistration
  , initializeProjectWalletAddress
  , initializeRound1FundingAmount

  , getInitializerData
  , pullFundsAndDisburseRound1
  , setupNextRound
  , finalizeRound
  , refundIfPenalized
  , registerAsVoter
  , castVote
  , castYesVote
  , castNoVote
  , userRefund
  , isInRound

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
  , getTokenPollWithAddress

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
