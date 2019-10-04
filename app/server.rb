require 'sinatra'

set :root, File.dirname(__FILE__)
set :public_folder, File.expand_path("../public", File.dirname(__FILE__))
set :static, true

helpers do
  def next_id
    @id = (@id || 0) + 1
  end

  def transactions
    @transactions ||= {
      next_id => {
        date: "2019-03-01",
        amountCents: -1000,
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
      next_id => {
        date: "2019-03-02",
        amountCents: -3461,
        data: {
          description: "Gas",
          postings: []
        }
      },
      next_id => {
        date: "2019-03-06",
        amountCents: -1499,
        data: {
          description: "Pets",
          postings: [
            {
              id: next_id,
              category: "Expenses:Food:Dog",
              amountCents: 1999
            },
            {
              id: next_id,
              category: "Income:Rebates",
              amountCents: -500
            }
          ]
        }
      }
    }
  end
end

get "/" do
  redirect "/index.html"
end

get "/transactions" do
  content_type "application/json"

  transactions.map { |id, data| data.merge(id: id) }.to_json
end

put "/transactions/:id" do
  id = Integer(params[:id])
  if transactions.key?(id)
    new_txn = JSON.parse(request.body.read, symbolize_names: true)
    new_txn[:data][:postings].each do |posting|
      posting[:id] ||= next_id
    end
    transactions[id] = new_txn

    { status: "OK", transaction: new_txn }.to_json.tap { |b| puts "RESP = #{b}" }
  else
    status 404
  end
end
