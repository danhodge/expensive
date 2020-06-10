# typed: false
require 'sinatra'
require 'pry-coolline'

set :root, File.dirname(__FILE__)
set :public_folder, File.expand_path("../public", File.dirname(__FILE__))
set :static, true
set :static_cache_control, [:public, max_age: 1]

helpers do
  def next_id
    @id = (@id || 0) + 1
  end

  def transactions
    @transactions ||= {
      next_id => {
        date: "Mar 1, 2019",
        amountCents: -1000,
        description: "Food",
        postings: [
          {
            id: 10,
            category: "Expenses:Food:Restaurant",
            amountCents: 1000
          }
        ]
      },
      next_id => {
        date: "Mar 2, 2019",
        amountCents: -3461,
        description: "Gas",
        postings: []
      },
      next_id => {
        date: "Mar 6, 2019",
        amountCents: -1499,
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
    puts "PUT /transactions/#{params[:id]} BODY: #{new_txn.inspect}"
    new_txn[:postings].each do |posting|
      posting[:id] ||= next_id
    end
    transactions[id][:description] = new_txn[:description]
    transactions[id][:postings] = new_txn[:postings]

    { status: "OK", transaction: { id: id }.merge(transactions[id]) }.to_json.tap { |b| puts "RESP = #{b}" }
  else
    status 404
  end
end
