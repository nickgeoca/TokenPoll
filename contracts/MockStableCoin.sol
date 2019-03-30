pragma solidity >=0.5.0;

contract BasicERC20 {
    uint256 public decimals = 18;
    string public name = "StableCoin";
    string public symbol = "USDT";
    uint256 public totalSupply;

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    function transfer(address _to, uint256 _value) public returns (bool success) {
        require(balances[msg.sender] >= _value);
        balances[msg.sender] -= _value;
        balances[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        balances[_to] += _value;
        balances[_from] -= _value;
        emit Transfer(_from, _to, _value);
        return true;
    }

    function balanceOf(address _owner) public view returns (uint256 balance) {
        return balances[_owner];
    }

    function approve(address _spender, uint256 _value) public returns (bool success) {
        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function allowance(address _owner, address _spender) public view returns (uint256 remaining) {
      return allowed[_owner][_spender];
    }

    mapping (address => uint256) balances;
    mapping (address => mapping (address => uint256)) allowed;
}


contract MockStableCoin is BasicERC20 {
  event Mint(address indexed to, uint256 amount);
  event MintFinished();

  function mintMany(address[] memory _to, uint256 _amount) public returns (bool){
    for (uint i = 0; i < _to.length; i++) {
      mint(_to[i], _amount);
    }
  }

  function mint(
    address _to,
    uint256 _amount
  )
    public
    returns (bool)
  {
    totalSupply += _amount;
    balances[_to] += _amount;
    emit Mint(_to, _amount);
    emit Transfer(address(0), _to, _amount);
    return true;
  }
}
