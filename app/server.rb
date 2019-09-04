require 'sinatra'

set :root, File.dirname(__FILE__)
set :public_folder, File.expand_path("../public", File.dirname(__FILE__))
set :static, true

get "/" do
  redirect "/index.html"
end

get "/transactions" do
  content_type "application/json"

  [
    {
      id: 1,
      date: "2019-03-01",
      editable: false,
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
    }
  ].to_json
end
