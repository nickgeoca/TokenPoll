require("babel-polyfill");

// Works for testrpc v4.1.3
const mineOneBlock = async () => {
  await web3.currentProvider.send({
    jsonrpc: "2.0",
    method: "evm_mine",
    params: [],
    id: 0
  });
};

const mineNBlocks = async n => {
  for (let i = 0; i < n; i++) {
    await mineOneBlock();
  }
};

const forwardEVMTime = async seconds => {
  await web3.currentProvider.send({
    jsonrpc: "2.0",
    method: "evm_increaseTime",
    params: [seconds],
    id: 0
  });
  await mineOneBlock();
};

const expectThrow = async promise => {
  try {
    await promise;
  } catch (err) {
    /* 
    const outOfGas = err.message.includes("out of gas");
    const invalidOpcode = err.message.includes("invalid opcode");
    const require = err.message.includes("revert");
    assert(
      outOfGas || invalidOpcode || require,
      "Expected throw, got `" + err + "` instead"
    );
    */
    return;
  }
  assert.fail("Expected throw not received");
};


module.exports = 
  { mineNBlocks
  , forwardEVMTime
  , expectThrow
};

