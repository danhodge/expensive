require 'parsby'
require 'date'
require 'bigdecimal'

module HledgerParser
  include Parsby::Combinators
  extend self

  def parse(io)
    hledger.parse(io)
  end

  define_combinator :hledger do
    many(record | record_with_comment | blank_line | comment) < eof
  end

  define_combinator :blank_line do
    non_newline_whitespace > eol
  end

  define_combinator :non_newline_whitespace do
    join(many(char_in(" \t")))
  end

  define_combinator :eol do
    lit("\n")
  end

  define_combinator :start_comment do
    lit(";")
  end

  define_combinator :comment do
    start_comment > join(many(any_char.that_fail(eol))).fmap(&:strip) < eol
  end

  define_combinator :record do
    single((group((date < whitespace), description) < eol)) + many_1(posting) < (blank_line | eof)
  end

  define_combinator :record_with_comment do
    single(group((date < whitespace), description, comment)) + many_1(posting) < (blank_line | eof)
  end

  define_combinator :date do
    group(decimal < lit("-"), decimal < lit("-"), decimal).fmap { |y, m, d| Date.new(y, m, d) }
  end

  define_combinator :description do
    join(many(any_char.that_fail(eol | start_comment))).fmap(&:strip)
  end

  define_combinator :char_not_in do |*strings|
    any_char.that_fails(char_in(*strings))
  end

  define_combinator :posting_description do
    # join(many(any_char.that_fail(eol | start_comment | lit('  ')))).fmap(&:strip)

    # this works but it's not much faster
    group(many_1(group(many_1(char_not_in("\n; ")), lit(" "))), lit(" ")).fmap { |s| s.flatten.join.strip }
  end

  define_combinator :posting do
    group((whitespace_1 > posting_description), (whitespace > amount)) < eol
  end

  define_combinator :amount do
    group((lit('$') > optional(lit('-'))), decimal, lit('.'), decimal).fmap { |tokens| BigDecimal(tokens.compact.join) }
  end

  define_combinator :many_2 do |p|
    single(p) + many_1(p)
  end
end
