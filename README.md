# expensive

Life Is Expensive

## Build

``` bash
elm make src/Transactions.elm --output=public/js/transactions.js --debug
```

## Tests

``` bash
npm run test

npm test <path_to_test_file>

npx jest -i <path_to_test_file> -t <test_name>
```

## Server

``` bash
# Start Server
npm run start:wp
```

``` bash
# Posting a transactions CSV
curl -X POST -H "Content-Type: text/csv" --data-binary @file.csv http://localhost:3000/api/$DB_ID/upload/$ACCOUNT_ID
```
