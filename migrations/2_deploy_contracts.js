var SafeMath = artifacts.require('./lib/SafeMath.sol');
var TokenPollFactory = artifacts.require('./tokenPoll/TokenPollFactory.sol');
var MultiSigWalletFactory = artifacts.require('./stash/MultiSigWalletFactory.sol');
var CreateStash = artifacts.require('./CreateStash.sol');

module.exports = function(deployer, network, accounts) {
  return deployer.deploy(SafeMath).then(async () => {

    await deployer.link(SafeMath, TokenPollFactory);

    await deployer.deploy(TokenPollFactory);
    await deployer.deploy(MultiSigWalletFactory);

    // Use rinkeby erc20
    await deployer.deploy(CreateStash, TokenPollFactory.address, MultiSigWalletFactory.address, '0xB03b5ad79e59dc60974021059C85D3BC397C8EDa', '0');
  });
}

