// var events = require('./../app/javascripts/events');
// var util = require('./../app/javascripts/util');

const TPI = require("../app/TokenPollInterface.js");

var ERC20 = artifacts.require('ERC20.sol');

var chai = require('chai')
const assert = require("chai").use(require("chai-as-promised")).assert;
const BigNumber = web3.BigNumber;

//************************************************
// Tests
contract('TokenPoll', function (accounts) {

  const user1 = accounts[0];
  const user2 = accounts[1];
  const user3 = accounts[2];
  const user4 = accounts[3];
  const user5 = accounts[4];
  const user6 = accounts[5];
  const doGood   = accounts[6];
  const company  = accounts[7];
  // const payoutAddress = accounts[8];
  // const arbitrator = accounts[9];

  describe('token poll', async () => {
    let tokenSupply;
    let tokenName;
    let tokenSymbol;
    let tokenDecimals;
    let token;
    const allocStartTime = 50;
    const allocEndTime = 100;

    beforeEach(async () => {
      tokenSupply = new BigNumber(1000000000000);
      tokenName = 'Test token'
      tokenSymbol = 'test'
      tokenDecimals = new BigNumber(18);

      token = await ERC20.new(tokenSupply, tokenName, tokenDecimals, tokenSymbol, {from: company});
      await TPI.init(token.address, allocStartTime, allocEndTime, {from: doGood});
    });

    it('allocates voting', async () => {
/*
      const bal1 = new BigNumber(84729832);
      const vp1E = bal1.sqrt().floor();  // 9204

      // Alloc tokens then votes to user1
      await token.transfer(user1, bal1, {from: company});      
      await TPI.allocVotes(user1);

      // Test value
      const vp1 = await TPI.getUserVotePowerPercentage(user1);
      assert.equal(vp1, vp1E, 'Voting not allocated properly');
*/
    });
  });
});
