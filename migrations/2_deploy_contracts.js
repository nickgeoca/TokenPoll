var SafeMath = artifacts.require('SafeMath.sol');
var TokenPollFactory = artifacts.require('TokenPollFactory.sol');

module.exports = function(deployer, network, accounts) {
  return deployer.deploy(SafeMath).then(async () => {
    console.log(network);
    // if (network != 'rinkeby-fork' && network != 'development') throw('Update stable coin address!');
    await deployer.link(SafeMath, TokenPollFactory);
    await deployer.deploy(TokenPollFactory, '0x9e621781C6D70c50551F6757CF320BDE0191d52E');
  });
}
