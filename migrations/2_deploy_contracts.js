var SafeMath = artifacts.require('SafeMath.sol');
var TokenPollFactory = artifacts.require('TokenPollFactory.sol');

module.exports = function(deployer, network, accounts) {
  return deployer.deploy(SafeMath).then(async () => {

    await deployer.deploy(TokenPollFactory);
    
  });
}
