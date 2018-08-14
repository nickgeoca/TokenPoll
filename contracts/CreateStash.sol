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
  // event WhiteListChanges(address[] additions, address[] removals);
  // CreateStash changes event?

  // State
  uint tokenPollFee;
  ERC20 feeToken;

  TokenPollFactory tpFact;
  MultiSigWalletFactory walletFact;

  address[] public fundingTokenWhiteList;
  mapping (address => uint) indexOfFTWL;

  // Getters
  function getOwner() public view returns (address) { return _getOwner(); }

  // Constructor
  function CreateStash (address _tpFact, address _walletFact, address _feeToken, uint _fee, address[] _whiteListFundingTokens) public  Ownable() {
    tpFact = TokenPollFactory(tpFact);
    walletFact = MultiSigWalletFactory(_walletFact);

    _addFundingTokensToWhiteList(_whiteListFundingTokens);
    tokenPollFee = _fee;
    feeToken = ERC20(_feeToken);
  }

  // Functions
  function createStash(address _fundingToken, address _icoToken) returns (address) {
    require(feeToken.transferFrom(msg.sender, this, tokenPollFee));
    require(isAFundingToken(_fundingToken));

    address[] memory walletOwners = new address[](1);
    walletOwners[0] = this;

    // Create stash/tokenpoll
    MultiSigWallet w = MultiSigWallet(walletFact.create(walletOwners, 1));
    TokenPoll tp = TokenPoll(tpFact.createTokenPoll(w, _fundingToken, _icoToken));

    // Transfer owner
    w.addOwner(tp);
    w.removeOwner(this);    
    tp.transferOwnership(msg.sender);

    StashCreated(tp, w);

    return tp;
  }

  function isAFundingToken(address token) public returns(bool) {
    return fundingTokenWhiteList[indexOfFTWL[token]] != address(0);
  }

  // Only owner
  function transferOwnership(address newOwner) public { _transferOwnership(newOwner); } 

  function withdraw(address token, address to, uint amount) public onlyOwner { require(ERC20(token).transfer(to, amount)); }

  function setTokenPollFee(uint fee) public onlyOwner { tokenPollFee = fee; }

  function setFeeToken(address t) public onlyOwner { feeToken = ERC20(t); }

  function addFundingTokensToWhiteList(address[] fundingTokens) public onlyOwner { _addFundingTokensToWhiteList(fundingTokens); }

  function removeFundingTokensFromWhiteList(address[] fundingTokens) public onlyOwner { _removeFundingTokensFromWhiteList(fundingTokens); }

  // Private functions
  function _addFundingTokensToWhiteList(address[] fundingTokens) private {
    for (uint i = 0; i < fundingTokens.length; i++) _addFundingToken(fundingTokens[i]);
  }

  function _removeFundingTokensFromWhiteList(address[] fundingTokens) private {
    for (uint i = 0; i < fundingTokens.length; i++) _removeFundingToken(fundingTokens[i]);
  }

  function _addFundingToken(address token) {
    if (token == 0) return;

    indexOfFTWL[token] = fundingTokenWhiteList.length;
    fundingTokenWhiteList.push(token);
  }

  function _removeFundingToken(address token) {
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
