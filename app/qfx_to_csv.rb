require 'csv'
require 'json'
require 'quicken_parser'

module QuickenParser
  class Parser
    # work-around problems with the SGML sanitization methods in QuickenParser::Parser#parse
    def parse2
      @doc = REXML::Document.new(@input)
      self
    end
  end
end

class Rules
  def initialize(rules)
    @rules = rules
  end

  def reject?(account, transaction)
    false
  end

  def transformed_description(desc)
    transformed = transform_description(desc)
    return transformed if transformed

    updated_desc =
      if desc.start_with?('PAYPAL')
        desc[6..-1]
      elsif desc.start_with?('SQ *')
        desc[4..-1]
      elsif desc.start_with?('Deposit from ')
        desc[13..-1]
      elsif desc.start_with?('Electronic Payment to ')
        desc[22..-1]
      elsif desc.start_with?('Withdrawal from ')
        desc[16..-1]
      elsif desc.start_with?('Debit Card Purchase ')
        desc[20..-1]
      else
        desc
      end

    tokens = updated_desc.split(/[\s\*-]+/).reject(&:empty?).map(&:downcase)
    capitalized_tokens = tokens.map do |token|
      if %w(llc).include?(token)
        token.upcase
      elsif %w(.co .com .org).any? { |suffix| token.end_with?(suffix) }
        token
      else
        [token[0].upcase, token[1..-1]].join
      end
    end

    capitalized_tokens.join(' ')
  end

  def transformed_amount(account, amount)
    if account.number.end_with?('6664') || account.bank_id == '031176110'
      amount * -1
    else
      amount
    end
  end

  # unmarked, pending, cleared
  def status(account, transaction)
    :unmarked
  end

  private

  def transform_description(desc)
    rule = @rules["description"].find do |r|
      if r["regex"]
        Regexp.new(r["regex"]).match(desc)
      else
        desc.include?(r["match"])
      end
    end

    rule["transformed"] if rule
  end
end

def handle_transaction(account, transaction, rules)
  return if rules.reject?(account, transaction)

  raw_desc = transaction.name || transaction.memo

  [
    transaction.number,
    transaction.timestamp.to_date,
    rules.transformed_description(raw_desc),
    raw_desc,
    rules.transformed_amount(account, transaction.amount),
    rules.status(account, transaction)
  ]
end

def accounts(file)
  data = file.read
  QuickenParser::Parser.new(data).parse.accounts
rescue
  QuickenParser::Parser.new(data).parse2.accounts
end

unless ARGV.length == 3
  raise ArgumentError, "Usage: ruby #{__FILE__} <input_qfx_file> <output_csv_file> <rules_file>"
end

rules = Rules.new(JSON.parse(File.read(ARGV[2])))

CSV.open(ARGV[1], "w") do |csv|
  csv << %w(id date description raw_description amount status)
  File.open(ARGV[0]) do |file|
    accounts(file).each do |account|
      account.transactions.each do |transaction|
        result = handle_transaction(account, transaction, rules)
        csv << result if result
      end
    end
  end
end
