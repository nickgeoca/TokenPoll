const util = require("./util.js");

const tpi = require("../app/TokenPollInterface.js");

var ERC20 = artifacts.require('ERC20.sol');

var chai = require('chai')

const BigNumber = web3.BigNumber;

const assert = require("chai").use(require("chai-as-promised")).assert;
const eq = assert.equal.bind(assert);

const getRandomInt = (max) =>  new BigNumber( Math.floor(Math.random() * Math.floor(max)) );

const genNumEth = (n) => (new BigNumber(10)).pow(18).times(n);

const debug = (s) => { console.log(s) };

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
      const allocStartTime = await web3.eth.getBlock('latest').timestamp + voteAllocTimeStartOffset;
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

    it('test cast vote', async () => {
      const bal1 = getRandomInt(1000000000);
      const bal2 = getRandomInt(1000000000);

      // vote power
      const vp1E = bal1.sqrt().floor();
      const vp2E = bal2.sqrt().floor();
      const percentVp1e = vp1E.dividedBy(vp1E.plus(vp2E));

      // Alloc tokens
      await icoToken.transfer(user1, bal1, {from: company}); 
      await icoToken.transfer(user2, bal2, {from: company}); 

      // Put in vote allocation state
      await util.forwardEVMTime(voteAllocTimeStartOffset + voteAllocTimeDifference / 2);
      eq(await tpi.getState(tokenPoll), 'VoteAllocation');

      // Votes
      await tpi.allocVotes(tokenPoll, {from: user1});     // Alloc votes
      await tpi.allocVotes(tokenPoll, {from: user2});     // Alloc votes
      await util.forwardEVMTime(voteAllocTimeDifference);

      // Setup next round then start the round
      let t = web3.eth.getBlock('latest').timestamp; 
      await tpi.setupNextRound(tokenPoll, 30 + t, {from: doGood});  // 30 seconds from now
      await util.forwardEVMTime(120);
      eq(await tpi.getState(tokenPoll), 'NextRoundApproved');
      await tpi.startRound(tokenPoll, {from: company});
      eq(await tpi.getState(tokenPoll), 'InRound');
      await tpi.castVote(tokenPoll, true, {from: user1});
      await tpi.castVote(tokenPoll, false, {from: user2});

      eq( (await tpi.getUserVotePower(tokenPoll, user1))
        , vp1E.toString(10));      
      eq( (await tpi.getUserVotePower(tokenPoll, user2)).toString(10)
        , vp2E.toString(10));      
      eq( await tpi.getUserHasVoted(tokenPoll, user1, 0)
        , true);
      eq( await tpi.getUserHasVoted(tokenPoll, user2, 0)
        , true);
    });
  });


  describe('token poll start to finish', async () => {
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

    const user1BalanceE = getRandomInt(1000000000);
    const user2BalanceE = getRandomInt(1000000000);

    // vote power
    const user1VotePowerE = user1BalanceE.sqrt().floor();
    const user2VotePowerE = user2BalanceE.sqrt().floor();
    const totalVotePowerE = user1VotePowerE.plus(user2VotePowerE);
    const user1PercentVotePowerE = user1VotePowerE.dividedBy(totalVotePowerE);

    it('works start to finish', async () => {
      let d;

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
      const allocStartTime = await web3.eth.getBlock('latest').timestamp + voteAllocTimeStartOffset;
      const allocEndTime = allocStartTime + voteAllocTimeDifference;

      icoToken = await ERC20.new(icoTokenSupply, icoTokenName, icoTokenDecimals, icoTokenSymbol, {from: company});
      scToken  = await ERC20.new(scTokenSupply, scTokenName, scTokenDecimals, scTokenSymbol, {from: company});

      // Alloc tokens
      await icoToken.transfer(user1, user1BalanceE, {from: company}); 
      await icoToken.transfer(user2, user2BalanceE, {from: company}); 

      // ********************************************************************************
      //                            Start token poll

      tokenPoll = await tpi.createTokenPoll({from: doGood});

      // *******************************
      eq(await tpi.getState(tokenPoll), 'Uninitialized');
      // ********* STATE - Uninitialized


      // *******************************
      await tpi.initializeTokenPoll(tokenPoll, icoToken.address, scToken.address, escrow, allocStartTime, allocEndTime, {from: doGood, gas: 200000});
      eq(await tpi.getState(tokenPoll), 'Initialized');
      // ********* STATE - Initialized

      // *******************************
      await util.forwardEVMTime(voteAllocTimeStartOffset + voteAllocTimeDifference / 2);
      eq(await tpi.getState(tokenPoll), 'VoteAllocation');
      // ********* STATE - VoteAllocation
      await tpi.allocVotes(tokenPoll, {from: user1});     // Alloc votes
      await tpi.allocVotes(tokenPoll, {from: user2});     // Alloc votes

      eq( (await tpi.getUserVotePower(tokenPoll, user1))
        , user1VotePowerE.toString(10));      
      eq( (await tpi.getUserVotePower(tokenPoll, user2)).toString(10)
        , user2VotePowerE.toString(10));      

      // *******************************
      await util.forwardEVMTime(voteAllocTimeDifference);      
      // ********* STATE - NextRoundApproved
      eq(await tpi.getState(tokenPoll), 'NextRoundApproved');
      let t = web3.eth.getBlock('latest').timestamp; 
      await tpi.setupNextRound(tokenPoll, 30 + t, {from: doGood});  // 30 seconds from now
      await util.forwardEVMTime(120);
      eq(await tpi.getState(tokenPoll), 'NextRoundApproved');


      // *******************************
      await tpi.startRound(tokenPoll, {from: company});
      eq(await tpi.getState(tokenPoll), 'InRound');
      // ********* STATE - InRound
      await tpi.castVote(tokenPoll, true, {from: user1});
      await tpi.castVote(tokenPoll, true, {from: user2});

      eq( await tpi.getUserHasVoted(tokenPoll, user1, 0)
        , true);
      eq( await tpi.getUserHasVoted(tokenPoll, user2, 0)
        , true);

      // *******************************
      await util.forwardEVMTime(3000);      
      eq(await tpi.getState(tokenPoll), 'PostRoundDecision');
      // ********* STATE - PostRoundDecision


      // *******************************
      d = await tpi.approveNewRound(tokenPoll);
      debug(d.event);
      
      
      // eq(await tpi.getState(tokenPoll), 'NextRoundApproved');
      // ********* STATE - InRound

      // *******************************
      // ********* STATE - Finished
      

    });    
  });
});


/*
      // E is expected
      // A is actual
      
      // Expected values
      const userBalancesE
            = [ 1000000000,1000000000,1000000000,1000000000
              , 1000000000,1000000000,1000000000,1000000000].map(getRandomInt);
      const votePowerE = userBalancesE.map(x=> x.sqrt().floor())
      const totalVotePowerE = votePowerE.reduce((accum,x)=>(accum+x));
      const percentVotePowerE = votePowerE.map(x=>x.dividedBy(totalVotePowerE));

*/
