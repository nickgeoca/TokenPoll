/*!
 * @dispatchlabs/dispatch-js <https://github.com/dispatchlabs/disnode_sdk>
 *
 * Copyright © 2018, [Dispatch Labs](http://dispatchlabs.io).
 * Released under the LGPL v3 License.
 */

'use strict';

const Dispatch = require('@dispatchlabs/dispatch-js');
const TokenPollFactory = require('./build/contracts/TokenPollFactory.json');

const doGoodKey = new Dispatch.Account({name: 'NodeSDKTest', privateKey: 'c8a18a7f6e1e0672dafbaf5fe59c484956dc9269073f2d048c061c9d2e7a488c' });
const tpfByteCode = TokenPollFactory.bytecode.slice(2);
const tpfAbi = TokenPollFactory.abi.slice(2);

const deploy = async (byteCode, abi) => {
  let ok, result;
  console.log('\n\n--- SMART CONTRACT EXAMPLES ---\n');

  const contract = doGoodKey.createContract(byteCode, abi);
  console.log('\nNew contract:\n' + contract + '\n');

  ok = await contract.send();
  console.log('Contract send result:\n' + JSON.stringify(ok) + '\n');
  result = await contract.whenStatusEquals('Ok');
  console.log('Contract creation result:\n' + JSON.stringify(result) + '\n');
                  
};

deploy(tpfByteCode, tpfAbi).catch(e=>console.log(e));
