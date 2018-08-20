const util = require("./util.js");

const tpi = require("../app/TokenPollInterface.js");

var ERC20 = artifacts.require('ERC20.sol');
var MSW = artifacts.require('./wallet/MultiSigWallet.sol');
var MSWF = artifacts.require('./wallet/MultiSigWalletFactory.sol');

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
  const fundTokenOwner = accounts[8];

  let tokenPoll;

  tpi.init(web3);

  describe('token poll', async () => {
    let icoTokenSupply;
    let icoTokenName;
    let icoTokenSymbol;
    let icoTokenDecimals;
    let icoToken;

    let fundTokenSupply;
    let fundTokenName;
    let fundTokenSymbol;
    let fundTokenDecimals;
    let fundToken;
    
    let feeTokenSupply;
    let feeTokenName;
    let feeTokenSymbol;
    let feeTokenDecimals;
    let feeToken;

    const voteAllocTimeStartOffset = 50;
    const voteAllocTimeDifference = 120;

    // Create token polls
    beforeEach(async () => {
      // ICO coin
      icoTokenSupply = genNumEth(10);
      icoTokenName = 'ico token';
      icoTokenSymbol = 'ico';
      icoTokenDecimals = new BigNumber(18);

      // Funding coin
      fundTokenSupply = genNumEth(10);
      fundTokenName = 'fund coin';
      fundTokenSymbol = 'fund';
      fundTokenDecimals = new BigNumber(18);

      // Stable coin
      fundTokenSupply = genNumEth(10);
      fundTokenName = 'fund coin';
      fundTokenSymbol = 'fee';
      fundTokenDecimals = new BigNumber(18);

      const allocStartTime = await web3.eth.getBlock('latest').timestamp + voteAllocTimeStartOffset;

      icoToken  = await ERC20.new(icoTokenSupply, icoTokenName, icoTokenDecimals, icoTokenSymbol, {from: company});
      fundToken = await ERC20.new(fundTokenSupply, fundTokenName, fundTokenDecimals, fundTokenSymbol, {from: fundTokenOwner});
      feeToken  = await ERC20.new(feeTokenSupply, feeTokenName, feeTokenDecimals, feeTokenSymbol, {from: feeTokenOwner});

      tokenPoll = await tpi.createTokenPoll(fundingToken.address, icoToken.address, roundOneFunding, {from: company});
      await tpi.initializeTokenPoll(tokenPoll, icoToken.address, fundToken.address, '0x0', allocStartTime, {from: company, gas: 200000});
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
      await tpi.setupNextRound(tokenPoll, 30 + t, {from: company});  // 30 seconds from now
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

      eq( await tpi.getUserHasVoted(tokenPoll, user1, 1, 1)
          , true);
      eq( await tpi.getUserHasVoted(tokenPoll, user2, 1, 1)
          , true);

      eq( await tpi.getYesVotes(tokenPoll, 1, 1)
          , '1');
      eq( await tpi.getNoVotes(tokenPoll, 1, 1)
          , '1');

      eq( await tpi.getQuadraticYesVotes(tokenPoll, 1, 1)
          , vp1E.toString(10));
      eq( await tpi.getQuadraticNoVotes(tokenPoll, 1, 1)
          , vp2E.toString(10));

    });
  });

  describe('token poll start to finish', async () => {
    it('works start to finish', async () => {
      let d;

      const voteAllocTimeStartOffset = 50;
      const voteAllocTimeDifference = 120;
      
      const user1BalanceE = getRandomInt(1000000000);
      const user2BalanceE = getRandomInt(1000000000);
      
      // vote power
      const user1VotePowerE = user1BalanceE.sqrt().floor();
      const user2VotePowerE = user2BalanceE.sqrt().floor();
      const totalVotePowerE = user1VotePowerE.plus(user2VotePowerE);
      const user1PercentVotePowerE = user1VotePowerE.dividedBy(totalVotePowerE);

      // ICO coin
      let icoTokenSupply = genNumEth(10);
      let icoTokenName = 'ico token';
      let icoTokenSymbol = 'ico';
      let icoTokenDecimals = new BigNumber(18);

      // Stable coin
      let fundTokenSupply = genNumEth(10);
      let fundTokenName = 'stable coin';
      let fundTokenSymbol = 'sc';
      let fundTokenDecimals = new BigNumber(18);
      
      let companyInitialFunding = 10000000;

      const allocStartTime = await web3.eth.getBlock('latest').timestamp + voteAllocTimeStartOffset;

      icoToken = await ERC20.new(icoTokenSupply, icoTokenName, icoTokenDecimals, icoTokenSymbol, {from: company});
      fundToken  = await ERC20.new(fundTokenSupply, fundTokenName, fundTokenDecimals, fundTokenSymbol, {from: fundTokenOwner});
      let mswf = await MSWF.new();

      // Alloc tokens
      await icoToken.transfer(user1, user1BalanceE, {from: company}); 
      await icoToken.transfer(user2, user2BalanceE, {from: company}); 

      // ********************************************************************************
      //                            Start token poll
      tokenPoll = await tpi.createTokenPoll({from: company});
      msw = await MSW.at((await mswf.create([tokenPoll.address], 1, true)).logs[0].args.instantiation);
      await fundToken.transfer(msw.address, companyInitialFunding, {from: fundTokenOwner});

      // *******************************
      eq(await tpi.getState(tokenPoll), 'Uninitialized');
      // ********* STATE - Uninitialized

      // *******************************
      await tpi.initializeTokenPoll(tokenPoll, icoToken.address, fundToken.address, msw.address, allocStartTime, {from: company, gas: 200000});
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
      await tpi.setupNextRound(tokenPoll, 30 + t, {from: company});  // 30 seconds from now
      await util.forwardEVMTime(120);
      eq(await tpi.getState(tokenPoll), 'NextRoundApproved');

      // *******************************
      await tpi.startRound(tokenPoll, {from: company});
      eq(await tpi.getState(tokenPoll), 'InRound');
      // ********* STATE - InRound
      await tpi.castVote(tokenPoll, true, {from: user1});
      await tpi.castVote(tokenPoll, true, {from: user2});

      eq( await tpi.getUserHasVoted(tokenPoll, user1, 1, 1)
        , true);
      eq( await tpi.getUserHasVoted(tokenPoll, user2, 1, 1)
        , true);

      // *******************************
      await util.forwardEVMTime(3000);      
      eq(await tpi.getState(tokenPoll), 'PostRoundDecision');
      // ********* STATE - PostRoundDecision

      // *******************************
      d = await tpi.approveNewRound(tokenPoll);

      // Check wallet and company stable coin balances
      let releasedFunds = Math.trunc(companyInitialFunding / 12);
      eq( (await fundToken.balanceOf(msw.address)).toString(10)
        , (companyInitialFunding - releasedFunds).toString(10));
      eq( (await fundToken.balanceOf(company)).toString(10)
        , (releasedFunds).toString(10));

      eq(await tpi.getState(tokenPoll), 'NextRoundApproved');
      t = web3.eth.getBlock('latest').timestamp; 
      await tpi.setupNextRound(tokenPoll, 30 + t, {from: company});  // 30 seconds from now
      await util.forwardEVMTime(120);
      eq(await tpi.getState(tokenPoll), 'NextRoundApproved');

      // *******************************
      await tpi.startRound(tokenPoll, {from: company});
      eq(await tpi.getState(tokenPoll), 'InRound');
      // ********* STATE - InRound
      await tpi.castVote(tokenPoll, false, {from: user1});
      await tpi.castVote(tokenPoll, false, {from: user2});

      eq( await tpi.getUserHasVoted(tokenPoll, user1, 1, 1)
        , true);
      eq( await tpi.getUserHasVoted(tokenPoll, user2, 1, 1)
        , true);

      console.log(await tpi.getResultHistory(tokenPoll));

      // *******************************
      // ********* STATE - Finished

    });    

  });
// */
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
