import { accountDecoder } from '../src/server/account';
import { decodeString } from '../src/server/json';

test("decodes an account without naming rules", () => {
  const accountStr = JSON.stringify(
    {
      "id": "6cd4cb5f-875d-4570-9647-5483ed74f2e3",
      "type": "Credit",
      "accountName": "liabilities:credit cards:amex",
      "csvSpec": {
        "date": {
          "field": "Transaction Date",
          "format": "%m/%d/%Y"
        },
        "description": {
          "field": "Description"
        },
        "amount": {
          "field": "Amount"
        }
      }
    }
  );
  const accountResult = decodeString(accountDecoder, accountStr);
  accountResult.caseOf({
    Ok: acct => {
      expect(acct.id).toEqual("6cd4cb5f-875d-4570-9647-5483ed74f2e3");
      expect(acct.accountName).toEqual("liabilities:credit cards:amex");
      expect(acct.namingRules.isEmpty()).toBe(true);
    },
    Err: _err => {
      expect(false).toBe(true);
    }
  });
});

test("decodes an account with naming rules", () => {
  const accountStr = JSON.stringify(
    {
      "id": "6cd4cb5f-875d-4570-9647-5483ed74f2e3",
      "type": "Credit",
      "accountName": "liabilities:credit cards:amex",
      "csvSpec": {
        "date": {
          "field": "Transaction Date",
          "format": "%m/%d/%Y"
        },
        "description": {
          "field": "Description"
        },
        "amount": {
          "field": "Amount"
        }
      },
      "namingRules": [
        {
          "description": "Desc",
          "patterns": ["PAT"],
          "accounts": [{ "name": "expenses" }]
        }
      ]
    }
  );
  const accountResult = decodeString(accountDecoder, accountStr);
  accountResult.caseOf({
    Ok: acct => {
      expect(acct.id).toEqual("6cd4cb5f-875d-4570-9647-5483ed74f2e3");
      expect(acct.accountName).toEqual("liabilities:credit cards:amex");
      expect(acct.namingRules.isEmpty()).toBe(false);
    },
    Err: _err => {
      expect(false).toBe(true);
    }
  });
});
