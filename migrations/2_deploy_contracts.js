var SafeMath = artifacts.require('./lib/SafeMath.sol');
var TokenPollFactory = artifacts.require('./tokenPoll/TokenPollFactory.sol');
var MultiSigWalletFactory = artifacts.require('./stash/MultiSigWalletFactory.sol');
var CreateStash = artifacts.require('./CreateStash.sol');

module.exports = function(deployer, network, accounts) {
  return deployer.deploy(SafeMath).then(async () => {

    await deployer.link(SafeMath, TokenPollFactory);

    await deployer.deploy(TokenPollFactory);
    await deployer.deploy(MultiSigWalletFactory);

    await deployer.deploy(CreateStash, TokenPollFactory.address, MultiSigWalletFactory.address, '0x0', '0');
  });
}

