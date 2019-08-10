require 'sinatra'

set :root, File.dirname(__FILE__)
set :public_folder, File.expand_path("../public", File.dirname(__FILE__))
set :static, true

get "/" do
  redirect "/index.html"
end

get "/transactions" do
  # TODO: serve transactions JSON
end
