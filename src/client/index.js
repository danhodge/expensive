// TODO: port this to ts?
var Elm = require('./Transactions.elm').Elm;
//import app = require('./Transactions.elm');

/*global document,_dbs*/
//app.Elm.Transactions.init({
Elm.Transactions.init({
  node: document.getElementById('elm-app'),
  flags: { databases: _dbs }
});
