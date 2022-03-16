import { hledgerTransactionsSerialize, Transaction } from '../src/server/transaction';
import { Posting } from '../src/server/posting';
import { TransactionDate } from '../src/server/transactionDate';
//import { TransactionRecord } from "../src/server/parser";

test("hledgerTransactionsSerialize", () => {
    const rec = new Transaction(
        "456",
        TransactionDate.parse("4/2/2021"),
        "Quik-E-Mart",
        new Array<Posting>(
            new Posting(1, "expenses:food:squishee", 3456),
            new Posting(2, "liabilities:credit cards:visa", -3456)
        )
    );

    const txt = hledgerTransactionsSerialize([rec]);
    console.log(txt);
});