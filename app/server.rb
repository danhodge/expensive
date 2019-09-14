require 'sinatra'

set :root, File.dirname(__FILE__)
set :public_folder, File.expand_path("../public", File.dirname(__FILE__))
set :static, true

helpers do
  def transactions
    @transactions ||= [
      {
        id: 1,
        date: "2019-03-01",
        data: {
          description: "Food",
          postings: [
            {
              id: 10,
              category: "Expenses:Food:Restaurant",
              amountCents: 1000
            }
          ]
        }
      },
      {
        id: 2,
        date: "2019-03-02",
        data: {
          description: "Gas",
          postings: []
        }
      },
      {
        id: 3,
        date: "2019-03-06",
        data: {
          description: "Pets",
          postings: [
            {
              id: 20,
              category: "Expenses:Food:Dog",
              amountCents: 1999
            },
            {
              id: 30,
              category: "Income:Rebates",
              amountCents: -500
            }
          ]
        }
      }
    ]
  end
end

get "/" do
  redirect "/index.html"
end

get "/transactions" do
  content_type "application/json"

  transactions.to_json
end
