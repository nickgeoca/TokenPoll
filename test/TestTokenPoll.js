const util = require("./util.js");

const tpi = require("../app/TokenPollInterface.js");

var ERC20 = artifacts.require('ERC20.sol');

var chai = require('chai')

const BigNumber = web3.BigNumber;

const assert = require("chai").use(require("chai-as-promised")).assert;
const eq = assert.equal.bind(assert);

// const getRandomInt = (max) =>  new BigNumber( Math.floor(Math.random() * Math.floor(max)) );

const genNumEth = (n) => (new BigNumber(10)).pow(18).times(n);

//************************************************
// Tests

// States
// ['Start', 'VoteAllocation', 'Running', 'Refund', 'End']

contract('TokenPoll', function (accounts) {
  const user1 = accounts[0];
  const user2 = accounts[1];
  const user3 = accounts[2];
  const user4 = accounts[3];
  const user5 = accounts[4];
  const user6 = accounts[5];
  const doGood  = accounts[6];
  const company = accounts[7];
  const escrow = accounts[8];
  // const arbitrator = accounts[9];
  let tokenPoll;

  tpi.init(web3);

  describe('token poll', async () => {
    let icoTokenSupply;
    let icoTokenName;
    let icoTokenSymbol;
    let icoTokenDecimals;
    let icoToken;

    let scTokenSupply;
    let scTokenName;
    let scTokenSymbol;
    let scTokenDecimals;
    let scToken;

    const voteAllocTimeStartOffset = 50;
    const voteAllocTimeDifference = 100;

    // Create token polls
    beforeEach(async () => {
      // ICO coin
      icoTokenSupply = genNumEth(10);
      icoTokenName = 'ico token';
      icoTokenSymbol = 'ico';
      icoTokenDecimals = new BigNumber(18);

      // Stable coin
      scTokenSupply = genNumEth(10);
      scTokenName = 'stable coin';
      scTokenSymbol = 'sc';
      scTokenDecimals = new BigNumber(18);

      dailyLimit = genNumEth(1); 
      const allocStartTime = await web3.eth.getBlock(await web3.eth.blockNumber).timestamp + voteAllocTimeStartOffset;
      const allocEndTime = allocStartTime + voteAllocTimeDifference;

      icoToken = await ERC20.new(icoTokenSupply, icoTokenName, icoTokenDecimals, icoTokenSymbol, {from: company});
      scToken  = await ERC20.new(scTokenSupply, scTokenName, scTokenDecimals, scTokenSymbol, {from: company});

      tokenPoll = await tpi.createTokenPoll({from: doGood});
      await tpi.initializeTokenPoll(tokenPoll, icoToken.address, scToken.address, escrow, allocStartTime, allocEndTime, {from: doGood, gas: 200000});
    });

    it('allocates votes', async () => {
      // Give user 1 some money
      const bal1 = genNumEth(1);
      const vp1E = bal1.sqrt().floor(); 

      await icoToken.transfer(user1, bal1, {from: company}); // Alloc tokens
      await icoToken.transfer(user2, bal1, {from: company}); // Alloc tokens

      // Fails before
      await util.forwardEVMTime(0);
      eq(await tpi.getState(tokenPoll), 'Initialized');
      await util.expectThrow(tpi.allocVotes(tokenPoll, {from: user1}));

      // Works during
      await util.forwardEVMTime(voteAllocTimeStartOffset + voteAllocTimeDifference / 2);
      eq(await tpi.getState(tokenPoll), 'VoteAllocation');
      await tpi.allocVotes(tokenPoll, {from: user1});

      // Fails after
      await util.forwardEVMTime(voteAllocTimeStartOffset + voteAllocTimeDifference + 5);
      eq(await tpi.getState(tokenPoll), 'NextRoundApproved');
      await util.expectThrow(tpi.allocVotes(tokenPoll, {from: user2}));
    });
/*
    it('test cast vote', async () => {
      const bal1 = getRandomInt(1000000000);
      const bal2 = getRandomInt(1000000000);

      // vote power
      const vp1E = bal1.sqrt().floor();
      const vp2E = bal2.sqrt().floor();
      const percentVp1e = vp1E.dividedBy(vp1E.plus(vp2E));

      // Alloc tokens
      await token.transfer(user1, bal1, {from: company}); 
      await token.transfer(user2, bal2, {from: company}); 

      // Put in vote allocation state
      await util.forwardEVMTime(voteAllocTimeStartOffset + voteAllocTimeDifference / 2);
      eq(await tpi.getState(tokenPoll), 'VoteAllocation');

      // Votes
      await tpi.allocVotes(tokenPoll, {from: user1});     // Alloc votes
      await tpi.allocVotes(tokenPoll, {from: user2});     // Alloc votes
      await util.forwardEVMTime(voteAllocTimeDifference);

      await tpi.castVote(tokenPoll, true, {from: user1});
      await tpi.castVote(tokenPoll, false, {from: user2});

      eq( await tpi.getUserVotePower(tokenPoll, user1)
        , vp1E);      
      eq( await tpi.getUserVotePower(tokenPoll, user2)
        , vp2E);      

      eq( await tpi.getHasVoted(tokenPoll, user1)
        , true);
      eq( await tpi.getHasVoted(tokenPoll, user2)
        , true);
    });
*/
  });
});
