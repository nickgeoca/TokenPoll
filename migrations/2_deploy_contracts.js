var SafeMath = artifacts.require('SafeMath.sol');
var TokenPollFactory = artifacts.require('TokenPollFactory.sol');

module.exports = function(deployer, network, accounts) {
  return deployer.deploy(SafeMath).then(async () => {

    await deployer.link(SafeMath, TokenPollFactory);

    await deployer.deploy(TokenPollFactory);
    
    // /* 
    if (network == 'rinkeby') {
      var MockStableCoin = artifacts.require('MockStableCoin.sol');
      var MockICOToken = artifacts.require('MockICOToken.sol');
      await deployer.deploy(MockStableCoin);
      await deployer.deploy(MockICOToken);
    }
    // */

  });
}
