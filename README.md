# todo
Interface.foo(param1, param2,..., paramn);
 - Interface can be any file: TokenPollInterface, ERC20Interface, MultiEscrowInterface etc.
 - params: What params foo expects and where can I get those params? or if needed to calculate then how can I calculate those params?
 - description: Short description of the function.
 - return type: Is foo returns Promise or a value?
  If it returns value then proper error handling should be there.
  If possible, Use try-catch blocks and return the false value with an error message from the catch block.
  If it is returning a promise then I have a Promise error handler that will take care of showing an error message.
 - Add error handlers in all the functions, if anything goes wrong we will have the error message with us and we will not spend more time in debugging.
 - If you are changing/updating anything, please update the docs as well. Also, mention which modules will get affected due to the change.

