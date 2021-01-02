require 'spec_helper'
require 'parser'

RSpec.describe HledgerParser do
  describe '.eol' do
    it 'accepts an empty newline' do
      expect(described_class.eol.parse("\n")).to eq("\n")
    end
  end

  describe '.blank_line' do
    it 'accepts whitespace followed by a newline' do
      expect(described_class.blank_line.parse("\t  \n")).to eq("\n")
    end

    it 'accepts an empty newline' do
      expect(described_class.blank_line.parse("\n")).to eq("\n")
    end
  end

  describe '.comment' do
    it 'returns the text after the comment character through the end of line' do
      expect(described_class.comment.parse(";;; some comments \n")).to eq(";; some comments")
    end
  end

  describe '.many_2' do
    it 'accepts a two matching characters' do
      expect(described_class.many_2(described_class.lit(" ")).parse("  ")).to eq([" ", " "])
    end

    it 'accepts more than two matching characters' do
      expect(described_class.many_2(described_class.lit(" ")).parse("    ")).to eq([" ", " ", " ", " "])
    end
  end

  describe '.description' do
    it 'accepts a description' do
      expect(described_class.description.parse("big stuff")).to eq("big stuff")
    end

    it 'accepts a newline terminated description' do
      expect(described_class.description.parse("big stuff\n")).to eq("big stuff")
    end

    it 'accepts a comment terminated description' do
      expect(described_class.description.parse("big stuff; TODO FIXME")).to eq("big stuff")
    end
  end

  describe '.record_with_comment' do
    it 'parses out the comment' do
      data = "2020-10-01 big stuff  ; id=123\n" \
             "    expenses:big       $1000.00\n" \
             "    assets:small      $-1000.00\n" \
             "\n"

      expected = [
        [Date.parse("2020-10-01"), "big stuff", "id=123"],
        ["expenses:big", BigDecimal("1000.00")],
        ["assets:small", BigDecimal("-1000.00")]
      ]

      expect(described_class.record_with_comment.parse(data)).to eq(expected)
    end
  end

  describe '.amount' do
    it 'parses a positive amount' do
      expect(described_class.amount.parse("$19.99")).to eq(BigDecimal("19.99"))
    end

    it 'parses a negative amount' do
      expect(described_class.amount.parse("$-1999.99")).to eq(BigDecimal("-1999.99"))
    end
  end

  describe '.posting' do
    it 'accepts a category and an amount' do
      data = "    expenses:food:restaurants:take out          $-17.11\n"
      expect(described_class.posting.parse(data)).to eq(["expenses:food:restaurants:take out", BigDecimal("-17.11")])
    end
  end

  describe '.record' do
    it 'parses a description with two postings' do
      data = "2020-10-01 big stuff\n" \
             "    expenses:utilities:cell phone        $81.23\n" \
             "    liabilities:credit card:visa        $-81.23\n" \
             "   \n"

      expected = [
        [Date.new(2020,10,1), "big stuff"],
        ["expenses:utilities:cell phone", BigDecimal("81.23")],
        ["liabilities:credit card:visa", BigDecimal("-81.23")]
      ]

      expect(described_class.record.parse(data)).to eq(expected)
    end
  end

  describe '.hledger' do
    it 'parses the data into transactions' do
      data = "2020-10-01 big stuff  ; id=123\n" \
             "    expenses:important             $100.00\n" \
             "    assets:cash                   $-100.00\n" \
             "\n" \
             "2020-10-02  bigger stuff\n" \
             "    expenses:food:take out          $17.22\n" \
             "    liabilities:credit card:visa   $-17.22\n" \
             "\n"

      expected = [
        [
          [Date.parse("2020-10-01"), "big stuff", "id=123"],
          ["expenses:important", BigDecimal("100.00")],
          ["assets:cash", BigDecimal("-100.00")]
        ],
        [
          [Date.parse("2020-10-02"), "bigger stuff"],
          ["expenses:food:take out", BigDecimal("17.22")],
          ["liabilities:credit card:visa", BigDecimal("-17.22")]
        ]
      ]

      expect(described_class.hledger.parse(data)).to eq(expected)
    end

    it 'handles a comment header' do
      data = "; journal file\n" \
             "\n" \
             "2020-10-01 big stuff ; id=123\n" \
             "    expenses:import              $100.00\n" \
             "    assets:cash                 $-100.00\n" \

      expected = [
        "journal file",
        "\n",
        [
          [Date.parse("2020-10-01"), "big stuff", "id=123"],
          ["expenses:import", BigDecimal("100.00")],
          ["assets:cash", BigDecimal("-100.00")],
        ]
      ]

      expect(described_class.hledger.parse(data)).to eq(expected)
    end

    it 'parses hledger generated journal' do
      data = File.read('test.journal')

      actual = described_class.hledger.parse(data)
      expect(actual.size).to eq(325)
    end
  end
end
