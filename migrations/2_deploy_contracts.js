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
    const fundTokenWhiteList = ['0xB03b5ad79e59dc60974021059C85D3BC397C8EDa'];
    const feeToken = '0xB03b5ad79e59dc60974021059C85D3BC397C8EDa';
    const fee = 0;
    
    await deployer.deploy(CreateStash, TokenPollFactory.address, MultiSigWalletFactory.address, fundTokenWhiteList, feeToken, fee);
  });
}

