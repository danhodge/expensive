// TODO: port this to ts?
var Elm = require('./Transactions.elm').Elm;

Elm.Transactions.init({
  node: document.getElementById('elm-app'),
  flags: { categories: _categories }
});
