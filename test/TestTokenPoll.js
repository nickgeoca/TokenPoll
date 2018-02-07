// var events = require('./../app/javascripts/events');
// var util = require('./../app/javascripts/util');

import * as TokenPollInterface from '../app/javascripts/lib/TokenPollInterface';

var ERC20 = artifacts.require('ERC20.sol');

var chai = require('chai')
const assert = require("chai").use(require("chai-as-promised")).assert;
const BigNumber = web3.BigNumber;

//************************************************
// Tests
contract('TokenPoll', function (accounts) {

  const account1 = accounts[0];
  const account2 = accounts[1];
  const account3 = accounts[2];
  const account4 = accounts[3];
  const account5 = accounts[4];
  const account6 = accounts[5];
  const doGood   = accounts[6];
  const company  = accounts[7];
  // const payoutAddress = accounts[8];
  // const arbitrator = accounts[9];

  describe('escrow init tests', async () => {
    // beforeEach(async () => {
    // });

    it('allocates voting in time window', async () => {
      const tokenSupply = new BigNumber(1000000000000);
      const tokenName = 'Test token'
      const tokenSymbol = 'test'
      const tokenDecimals = new BigNumber(18);

      const bal1 = new BigNumber(84729832);
      const vp1E = bal1.sqrt().floor();  // 9204

      token = await ERC20.new(tokenSupply, tokenName, tokenDecimals, tokenSymbol, {from: company});
      await TokenPollInterface.init({from: doGood});

      await token.transfer(account1, bal1, {from: company});      

      await TokenPollInterface.allocVotes(account1);

      const vp1 = await TokenPollInterface.getUserVotePowerPercentage(account1);
      assert.equal(vp1, vp1E, 'Voting not allocated properly');
    });
  });
});
