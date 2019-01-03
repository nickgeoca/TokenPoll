pragma solidity >=0.4.8;

// Got safemath from here: https://github.com/etheropt/etheropt.github.io/blob/master/smart_contract/etheropt.sol

library SafeMath {

  function safeMul(uint a, uint b) internal pure returns (uint) {
    uint c = a * b;
    require(a == 0 || c / a == b);
    return c;
  }

  function safeSub(uint a, uint b) internal pure returns (uint) {
    require(b <= a);
    return a - b;
  }

  function safeAdd(uint a, uint b) internal pure returns (uint) {
    uint c = a + b;
    require(c>=a && c>=b);
    return c;
  }

  function safeDiv(uint a, uint b) internal pure returns (uint) {
    uint c = a / b;
    assert(b > 0);
    return c;
  }

}


/*
    function safeMuli(int a, int b) internal returns (int) {
    int c = a * b;
    require(a == 0 || c / a == b);
    return c;
  }

  function safeSubi(int a, int b) internal returns (int) {
    int negB = safeNegi(b);
    int c = a + negB;
    if (b<0 && c<=a)        require(false);
    if (a>0 && b<0 && c<=0) require(false);
    if (a<0 && b>0 && c>=0) require(false);
    return c;
  }

  function safeAddi(int a, int b) internal returns (int) {
    int c = a + b;
    if (a>0 && b>0 && c<=0) require(false);
    if (a<0 && b<0 && c>=0) require(false);
    return c;
  }

  function safeNegi(int a) internal returns (int) {
    int c = -a;
    if (a<0 && -a<=0) require(false);
    return c;
  }

  function safeIntToUint(int a) internal returns(uint) {
    uint c = uint(a);
    require(a>=0);
    return c;
  }

  function safeUintToInt(uint a) internal returns(int) {
    int c = int(a);
    require(c>=0);
    return c;
  }
  */
