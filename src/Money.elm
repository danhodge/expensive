module Money exposing (MoneySign(..), toCurrencyDisplay, toCurrency, fromCurrency, toDollarsCents, toCents)

type MoneySign
    = Positive
    | Negative

toCurrencyDisplay : Int -> String
toCurrencyDisplay amountCents =
    let
        ( sign, dollars, cents ) =
            toDollarsCents amountCents

        prefix =
            case sign of
                Positive ->
                    "$"

                Negative ->
                    "-$"
    in
    if amountCents == 0 then
        -- TODO: do not display an empty string for a posting that is being edited
        ""

    else
        String.join "." [ String.join "" [ prefix, dollars ], cents ]


toCurrency : Int -> String
toCurrency amountCents =
    let
        ( sign, dollars, cents ) =
            toDollarsCents amountCents

        prefix =
            case sign of
                Positive ->
                    ""

                Negative ->
                    "-"
    in
    if amountCents == 0 then
        -- TODO: do not display an empty string for a posting that is being edited
        ""

    else
        String.join "." [ String.join "" [ prefix, dollars ], cents ]


fromCurrency : String -> Maybe Int
fromCurrency currency =
    currency |> String.toFloat |> Maybe.map (\value -> round (value * 100))


toDollarsCents : Int -> ( MoneySign, String, String )
toDollarsCents cents =
    let
        dollars =
            abs cents // 100

        sign =
            if cents < 0 then
                Negative

            else
                Positive
    in
    ( sign, String.fromInt dollars, String.fromInt (abs cents - (dollars * 100)) |> String.padLeft 2 '0' )


toCents : String -> Int
toCents dollars =
    Maybe.withDefault 0 (String.filter Char.isDigit dollars |> String.toInt)
