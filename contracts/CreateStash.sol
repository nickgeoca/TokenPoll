pragma solidity ^0.4.15;

import "./lib/Ownable.sol";
import "./lib/ERC20.sol";

import "./stash/MultiSigWalletFactory.sol";
import "./stash/MultiSigWallet.sol";

import "./tokenPoll/TokenPollFactory.sol";
import "./tokenPoll/TokenPoll.sol";

// Todo - transferFrom on funds. 

// Voting is quadratic
contract CreateStash is Ownable {

  // Event
  event StashCreated(address tokenPoll, address wallet);
  // CreateStash changes event?

  // State
  TokenPollFactory public tpFact;
  MultiSigWalletFactory public walletFact;

  address public feeToken;
  uint public fee;

  address[] public fundingTokenWhiteList;
  mapping (address => uint) private indexOfFTWL;

  // Getters
  function getOwner() public view returns (address) { return _getOwner(); }

  function getFundingTokens() public view returns (address[]) { return fundingTokenWhiteList; }

  // Constructor
  function CreateStash (address _tpFact, address _walletFact, address[] _whiteListFundingTokens, address _feeToken, uint _fee) public  Ownable() {
    tpFact = TokenPollFactory(tpFact);
    walletFact = MultiSigWalletFactory(_walletFact);

    _addFundingTokensToWhiteList(_whiteListFundingTokens);
    feeToken = _feeToken;
    fee = _fee;
  }

  // Functions1
  function createStash(address _fundingToken, address _icoToken, uint roundOneFunding) public returns (address) {
    require(isAFundingToken(_fundingToken));
    require(ERC20(feeToken).transferFrom(msg.sender, this, fee));
    require(_fundingToken != address(0));
    require(_icoToken != address(0));

    address[] memory walletOwners = new address[](1);
    walletOwners[0] = this;

    // Create stash/tokenpoll
    MultiSigWallet w = MultiSigWallet(walletFact.create(walletOwners, 1));
    TokenPoll tp = TokenPoll(tpFact.createTokenPoll(w, _fundingToken, _icoToken, roundOneFunding));

    // Transfer owner
    w.addOwner(tp);
    w.removeOwner(this);    
    tp.transferOwnership(msg.sender);

    StashCreated(tp, w);

    return tp;
  }

  function isAFundingToken(address token) public view returns(bool) { return fundingTokenWhiteList[indexOfFTWL[token]] == token; }

  // Only owner
  function transferOwnership(address newOwner) public { _transferOwnership(newOwner); } 

  function withdraw(address token, address to, uint amount) public onlyOwner { require(ERC20(token).transfer(to, amount)); }
  
  function addFundingTokensToWhiteList(address[] fundingTokens) public onlyOwner { _addFundingTokensToWhiteList(fundingTokens); }
  
  function removeFundingTokensFromWhiteList(address[] fundingTokens) public onlyOwner { _removeFundingTokensFromWhiteList(fundingTokens); }

  // Private functions
  function _addFundingTokensToWhiteList(address[] fundingTokens) private {
    for (uint i = 0; i < fundingTokens.length; i++) _addFundingToken(fundingTokens[i]);
  }

  function _removeFundingTokensFromWhiteList(address[] fundingTokens) private {
    for (uint i = 0; i < fundingTokens.length; i++) _removeFundingToken(fundingTokens[i]);
  }

  function _addFundingToken(address token) private {
    if (token == 0) return;

    indexOfFTWL[token] = fundingTokenWhiteList.length;
    fundingTokenWhiteList.push(token);
  }

  function _removeFundingToken(address token) private {
    if (!isAFundingToken(token)) return;

    uint index = indexOfFTWL[token];
      
    if (fundingTokenWhiteList.length > 1) {
      fundingTokenWhiteList[index] = fundingTokenWhiteList[fundingTokenWhiteList.length - 1];
    }

    delete(fundingTokenWhiteList[fundingTokenWhiteList.length - 1]);
    delete(indexOfFTWL[token]);

    fundingTokenWhiteList.length--;
  }
}

