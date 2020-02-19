module Transactions exposing (Flags, Model, Msg(..), Transaction, init, initialModel, main, tableRow, update, view)

import Browser
import Browser.Dom
import Dict exposing (Dict)
import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (keyCode, on, onClick, onInput, targetValue)
import Http
import Json.Decode as Decode exposing (Decoder, field, map2, map3, map4, map5)
import Json.Encode as Encode exposing (..)
import String
import Task
import Url.Builder



-- MODEL


type alias Category =
    String


type CategorySetting
    = CategorySetting Category
    | NoCategory


type alias Model =
    { transactions : List Transaction
    , categories : List Category
    }


type Currency
    = CurrencyDisplay String
    | CurrencyValue Int


type Message
    = Message String
    | Error String


type alias Posting =
    { id : Maybe Int
    , category : CategorySetting
    , amount : Currency
    }



-- TransactionData = the data in a transaction that are editable


type alias TransactionData =
    { description : String
    , postings : List Posting
    }


type alias Transaction =
    { id : Int
    , date : String
    , amountCents : Int
    , editable : Bool
    , data : TransactionData
    , originalData : Maybe TransactionData
    }



-- used to pass data in from JS - couldn't figure out if it's possible to omit this
-- if not being used so made it a generic JSON block based on this advice:
-- https://github.com/NoRedInk/elm-style-guide#how-to-structure-modules-for-a-page


type alias Flags =
    { categories : List Category
    }


initialModel : Model
initialModel =
    { transactions = [], categories = [] }


init : Flags -> ( Model, Cmd Msg )
init flags =
    ( { initialModel | categories = flags.categories }, getTransactions )



-- UPDATE


type Msg
    = Noop
    | NewTransactions (Result Http.Error (List Transaction))
    | Click Int String
    | CancelEditor Int
    | SetDescription Int String
    | SetPostingName Int Int CategorySetting
    | SetPostingAmount Int Int String
    | RemovePosting Int Int
    | SaveChanges Int
    | ChangesSaved Int (Result Http.Error Transaction)


update : Msg -> Model -> ( Model, Cmd Msg )
update message model =
    let
        toggleableRow id curEditState txn =
            txn.id == id && txn.editable == curEditState

        deactivateEditor =
            restoreOriginalData >> clearOriginalData >> toggleEditable

        deactivatedTransaction txnId transactions =
            List.map (filteredIdentityMapper (toggleableRow txnId True) deactivateEditor) transactions
    in
    case message of
        Noop ->
            ( model, Cmd.none )

        NewTransactions (Ok newTransactions) ->
            ( { model | transactions = newTransactions }, Cmd.none )

        NewTransactions (Err error) ->
            -- TODO: display an error
            ( model, Cmd.none )

        Click txnId domId ->
            ( { model | transactions = List.map (filteredIdentityMapper (toggleableRow txnId False) (toggleEditable << captureOriginalData)) model.transactions }
            , Task.attempt (\_ -> Noop) (Browser.Dom.focus domId)
            )

        CancelEditor id ->
            -- TODO: set focus to the amount of the last posting
            ( { model | transactions = deactivatedTransaction id model.transactions }, Cmd.none )

        SetDescription id desc ->
            ( { model | transactions = updateTransaction model.transactions id (updateTransactionDescription desc) }, Cmd.none )

        SetPostingName id postIdx category ->
            -- TODO: Detect when PostingName is set to an existing category by pressing Enter on auto-complete list and shift focus to the amount
            ( { model | transactions = updateTransactionAndPosting model.transactions id postIdx (updatePostingCategory category >> justify) }, Cmd.none )

        SetPostingAmount id postIdx amount ->
            ( { model | transactions = updateTransactionAndPosting model.transactions id postIdx (updatePostingAmount amount >> justify) }, Cmd.none )

        RemovePosting id postIdx ->
            ( { model | transactions = updateTransactionAndPosting model.transactions id postIdx (\posting -> Nothing) }, Cmd.none )

        SaveChanges id ->
            let
                transaction =
                    model.transactions |> List.filter (\txn -> txn.id == id) |> List.head

                errors =
                    case transaction of
                        Just txn ->
                            validateForSave txn

                        Nothing ->
                            []
            in
            case errors of
                f :: _ ->
                    -- TODO: include error message in the model
                    ( model, Cmd.none )

                [] ->
                    ( model, saveChanges transaction )

        ChangesSaved id (Ok updatedTxn) ->
            let
                nonEmptyCategory posting =
                    case posting.category of
                        CategorySetting category ->
                            Just category

                        _ ->
                            Nothing
            in
            ( { model | transactions = List.map (filteredIdentityMapper (\txn -> txn.id == id) (\txn -> updatedTxn)) model.transactions, categories = insertCategory (List.filterMap nonEmptyCategory updatedTxn.data.postings) model.categories }, Cmd.none )

        ChangesSaved id (Err error) ->
            -- TODO: display an error
            ( { model | transactions = deactivatedTransaction id model.transactions }, Cmd.none )


toggleEditable : Transaction -> Transaction
toggleEditable transaction =
    { transaction | editable = not transaction.editable }


validateForSave : Transaction -> List Message
validateForSave transaction =
    let
        fn posting =
            case posting.amount of
                CurrencyDisplay value ->
                    case fromCurrency value of
                        Just _ ->
                            Nothing

                        Nothing ->
                            Just (Error ("Invalid currency amount " ++ value))

                CurrencyValue _ ->
                    Nothing
    in
    List.filterMap fn transaction.data.postings


convertPostingAmounts : Transaction -> Transaction
convertPostingAmounts transaction =
    let
        curData =
            transaction.data

        updatedData =
            { curData | postings = List.map convertPostingAmount curData.postings }
    in
    { transaction | data = updatedData }


convertPostingAmount : Posting -> Posting
convertPostingAmount posting =
    let
        convertedAmount =
            case posting.amount of
                CurrencyValue cents ->
                    CurrencyValue cents

                CurrencyDisplay amount ->
                    case fromCurrency amount of
                        Just cents ->
                            CurrencyValue cents

                        Nothing ->
                            -- TODO: error here? a third type?
                            CurrencyDisplay amount
    in
    { posting | amount = convertedAmount }


restoreOriginalData : Transaction -> Transaction
restoreOriginalData transaction =
    { transaction | data = Maybe.withDefault transaction.data transaction.originalData }


captureOriginalData : Transaction -> Transaction
captureOriginalData transaction =
    { transaction | originalData = Just transaction.data }


{-| Returns a mapper function that is an identity mapper unless the
filter function evaluates to True
-}
filteredIdentityMapper : (a -> Bool) -> (a -> a) -> (a -> a)
filteredIdentityMapper filterFn mapFn =
    \v ->
        if filterFn v then
            mapFn v

        else
            v


clearOriginalData : Transaction -> Transaction
clearOriginalData transaction =
    { transaction | originalData = Nothing }


updateTransactionDescription : String -> Transaction -> Transaction
updateTransactionDescription desc transaction =
    let
        curData =
            transaction.data

        updatedData =
            { curData | description = desc }
    in
    { transaction | data = updatedData }


updateTransaction : List Transaction -> Int -> (Transaction -> Transaction) -> List Transaction
updateTransaction transactions id updateFn =
    let
        matchIdUpdateFn txn =
            if txn.id == id then
                updateFn txn

            else
                txn
    in
    List.map matchIdUpdateFn transactions


justify : a -> Maybe a
justify value =
    Just value



-- TODO: is there a way to make a generic function that can update transactions OR postings?


ensureEmptyPosting : List Posting -> List Posting
ensureEmptyPosting postings =
    let
        hasEmptyPosting =
            List.any emptyPosting postings
    in
    if hasEmptyPosting then
        postings

    else
        -- TODO: defaualt amount to remaining balance
        postings ++ [ Posting Nothing NoCategory (CurrencyValue 0) ]


updatePosting : Int -> (Posting -> Maybe Posting) -> List Posting -> List Posting
updatePosting idx updateFn postings =
    postings |> List.indexedMap (updateMatchedPosting updateFn idx) |> List.filterMap (\x -> x)


updateMatchedPosting : (Posting -> Maybe Posting) -> Int -> Int -> Posting -> Maybe Posting
updateMatchedPosting updateFn targetIdx postingIdx posting =
    if postingIdx == targetIdx then
        updateFn posting

    else
        Just posting


updateTransactionAndPosting : List Transaction -> Int -> Int -> (Posting -> Maybe Posting) -> List Transaction
updateTransactionAndPosting transactions txnId postIdx updatePostingFn =
    let
        updateTxnFn transaction =
            updateMatchedTransaction transaction ((updatePosting postIdx updatePostingFn >> ensureEmptyPosting) transaction.data.postings)
    in
    updateTransaction transactions txnId updateTxnFn


updateMatchedTransaction : Transaction -> List Posting -> Transaction
updateMatchedTransaction transaction updatedPostings =
    let
        curData =
            transaction.data

        updatedData =
            { curData | postings = updatedPostings }
    in
    { transaction | data = updatedData }


updatePostingCategory : CategorySetting -> Posting -> Posting
updatePostingCategory catg posting =
    { posting | category = catg }


updatePostingAmount : String -> Posting -> Posting
updatePostingAmount amount posting =
    { posting | amount = CurrencyDisplay amount }


insertCategory : List String -> List String -> List String
insertCategory transactionCategories existingCategories =
    let
        newCategories =
            List.filter (\category -> not (List.member category existingCategories)) transactionCategories
    in
    if List.isEmpty (Debug.log "newCats" newCategories) then
        existingCategories

    else
        List.sort (List.append newCategories existingCategories)



-- Encoders & Decoders


encodeTransaction : Transaction -> Encode.Value
encodeTransaction transaction =
    Encode.object
        [ ( "id", Encode.int transaction.id )
        , ( "date", Encode.string transaction.date )
        , ( "data", encodeTransactionData transaction.data )
        ]


encodeTransactionData : TransactionData -> Encode.Value
encodeTransactionData data =
    Encode.object
        [ ( "description", Encode.string data.description )
        , ( "postings", Encode.list encodePosting (List.filter (emptyPosting >> not) data.postings) )
        ]


encodePosting : Posting -> Encode.Value
encodePosting posting =
    let
        amountCents =
            case posting.amount of
                CurrencyDisplay val ->
                    case fromCurrency val of
                        Just amount ->
                            amount

                        -- TODO: fail or prevent execution from getting here if this is going to happen
                        Nothing ->
                            0

                CurrencyValue amount ->
                    amount

        category =
            case posting.category of
                NoCategory ->
                    ""

                CategorySetting name ->
                    name
    in
    [ maybeEncodeField "id" Encode.int posting.id
    , Just ( "category", Encode.string category )
    , Just ( "amountCents", Encode.int amountCents )
    ]
        |> List.filterMap (\v -> v)
        |> Encode.object


maybeEncodeField : String -> (a -> Encode.Value) -> Maybe a -> Maybe ( String, Value )
maybeEncodeField fieldName encoder value =
    case value of
        Just val ->
            Just ( fieldName, encoder val )

        Nothing ->
            Nothing


decodedPosting : Int -> String -> Int -> Posting
decodedPosting id category amountCents =
    Posting (Just id) (toCategorySetting category) (CurrencyValue amountCents)


postingDecoder : Decoder Posting
postingDecoder =
    map3 decodedPosting
        (field "id" Decode.int)
        (field "category" Decode.string)
        (field "amountCents" Decode.int)


transactionDataDecoder : Decoder TransactionData
transactionDataDecoder =
    map2 decodedTransactionData
        (field "description" Decode.string)
        (field "postings" (Decode.list postingDecoder))


decodedTransaction : Int -> String -> Int -> TransactionData -> Transaction
decodedTransaction id date amountCents data =
    Transaction id date amountCents False data Nothing


decodedTransactionData : String -> List Posting -> TransactionData
decodedTransactionData description postings =
    TransactionData description (ensureEmptyPosting postings)


transactionDecoder : Decoder Transaction
transactionDecoder =
    map4 decodedTransaction
        (field "id" Decode.int)
        (field "date" Decode.string)
        (field "amountCents" Decode.int)
        (field "data" transactionDataDecoder)


saveTransactionDecoder : Decoder Transaction
saveTransactionDecoder =
    map2 (\status txn -> txn)
        (field "status" Decode.string)
        (field "transaction" transactionDecoder)



-- COMMANDS


getTransactions : Cmd Msg
getTransactions =
    Http.get
        { url = "http://localhost:4567/transactions"
        , expect = Http.expectJson NewTransactions (Decode.list transactionDecoder)
        }


saveChanges : Maybe Transaction -> Cmd Msg
saveChanges transaction =
    case transaction of
        Nothing ->
            Cmd.none

        Just txn ->
            Http.request
                { method = "PUT"
                , headers = []
                , url = Url.Builder.crossOrigin "http://localhost:4567" [ "transactions", String.fromInt txn.id ] []
                , body = Http.jsonBody (encodeTransaction txn)
                , expect = Http.expectJson (ChangesSaved txn.id) saveTransactionDecoder
                , timeout = Nothing
                , tracker = Nothing
                }



-- VIEW


view : Model -> Html Msg
view model =
    div []
        [ datalist [ id "categories-list" ]
            (List.map
                (\name -> option [] [ text name ])
                model.categories
            )
        , table
            []
            -- there has to be a better way to do this
            ([ tableRow th [ "Date", "Description", "Amount", "Status", "Postings" ] ]
                ++ transactionRows model.transactions
            )
        ]


tableRow : (List (Attribute Msg) -> List (Html Msg) -> Html Msg) -> List String -> Html Msg
tableRow elementType values =
    tableRowWithAttributes [] elementType values


tableRowWithAttributes : List (Attribute Msg) -> (List (Attribute Msg) -> List (Html Msg) -> Html Msg) -> List String -> Html Msg
tableRowWithAttributes attributes elementType values =
    tr attributes (List.map (\value -> elementType [] [ text value ]) values)


transactionRows : List Transaction -> List (Html Msg)
transactionRows transactions =
    List.map transactionRow transactions


transactionRow : Transaction -> Html Msg
transactionRow transaction =
    tr []
        [ td [] [ text transaction.date ]
        , td [] [ transactionDescription transaction ]
        , td [] [ text (toCurrency transaction.amountCents) ]
        , td [] [ transactionStatus transaction ]
        , td [] [ postingsTable transaction ]
        ]


clickable : Transaction -> String -> List (Attribute Msg)
clickable transaction domId =
    [ id domId, clicker transaction ]


clicker : Transaction -> Attribute Msg
clicker transaction =
    let
        -- decoder that extracts the event.target.id property from the onClick event
        decoder =
            Decode.map (Click transaction.id) (Decode.at [ "target", "id" ] Decode.string)
    in
    on "click" decoder


transactionDescription : Transaction -> Html Msg
transactionDescription transaction =
    if transaction.editable then
        input
            [ type_ "text"
            , value transaction.data.description
            , onInput (SetDescription transaction.id)
            , editorKeyHandler (Dict.fromList [ ( 27, CancelEditor transaction.id ), ( 13, SaveChanges transaction.id ) ])
            , id (descInputId transaction.id)
            ]
            []

    else
        span (clickable transaction (descInputId transaction.id)) [ text transaction.data.description ]


transactionStatus : Transaction -> Html Msg
transactionStatus transaction =
    let
        extractAmount posting =
            case posting.amount of
                CurrencyDisplay val ->
                    Maybe.withDefault 0 (fromCurrency val)

                CurrencyValue amountCents ->
                    amountCents

        balance =
            transaction.amountCents + List.foldl (+) 0 (List.map extractAmount transaction.data.postings)
    in
    case balance of
        0 ->
            text "Balanced"

        _ ->
            text "Unbalanced"


postingsTable : Transaction -> Html Msg
postingsTable transaction =
    table []
        (List.indexedMap (postingRow transaction) (processedPostings transaction))


processedPostings : Transaction -> List Posting
processedPostings transaction =
    let
        numPostings =
            List.length transaction.data.postings
    in
    if transaction.editable || numPostings == 1 then
        transaction.data.postings

    else
        List.take (numPostings - 1) transaction.data.postings


postingRow : Transaction -> Int -> Posting -> Html Msg
postingRow transaction postingIndex posting =
    let
        displayText =
            postingText transaction.editable posting

        domId idPrefix =
            inputId (inputId idPrefix transaction.id) postingIndex

        cells =
            [ td [] [ postingCategoryEditor transaction postingIndex domId displayText ]
            , td [] [ postingAmountEditor transaction postingIndex domId posting ]
            ]

        controls =
            if transaction.editable && not (emptyPosting posting) then
                [ td [] [ a [ onClick (RemovePosting transaction.id postingIndex) ] [ text "X" ] ] ]

            else
                [ td [] [] ]
    in
    tr []
        (cells
            ++ controls
        )


emptyPosting : Posting -> Bool
emptyPosting posting =
    case posting.category of
        NoCategory ->
            case posting.amount of
                CurrencyDisplay val ->
                    String.isEmpty val

                CurrencyValue amount ->
                    abs amount == 0

        CategorySetting value ->
            False


postingText : Bool -> Posting -> String
postingText editable posting =
    case posting.category of
        CategorySetting value ->
            value

        NoCategory ->
            if editable then
                ""

            else
                "Choose a Category"


toCategorySetting : String -> CategorySetting
toCategorySetting text =
    case String.length text of
        0 ->
            NoCategory

        _ ->
            CategorySetting text


postingCategoryEditor : Transaction -> Int -> (String -> String) -> String -> Html Msg
postingCategoryEditor transaction postingIndex domId displayText =
    let
        saveMsg str =
            SetPostingName transaction.id postingIndex (toCategorySetting str)
    in
    postingEditor saveMsg transaction (domId "posting-desc-") displayText [ Html.Attributes.list "categories-list", Html.Attributes.autocomplete False ] Dict.empty


postingAmountEditor : Transaction -> Int -> (String -> String) -> Posting -> Html Msg
postingAmountEditor transaction postingIndex domId posting =
    let
        postingAmount =
            case posting.amount of
                CurrencyDisplay val ->
                    val

                CurrencyValue cents ->
                    toCurrency cents
    in
    postingEditor (SetPostingAmount transaction.id postingIndex) transaction (domId "posting-amt-") postingAmount [] (Dict.fromList [ ( 13, SaveChanges transaction.id ) ])


postingEditor : (String -> Msg) -> Transaction -> String -> String -> List (Attribute Msg) -> Dict Int Msg -> Html Msg
postingEditor saveMsg transaction domId displayText attributes additionalKeys =
    let
        editorKeys =
            Dict.union (Dict.fromList [ ( 27, CancelEditor transaction.id ) ]) additionalKeys
    in
    if transaction.editable then
        input
            ([ type_ "text"
             , value displayText
             , onInput saveMsg
             , editorKeyHandler editorKeys
             , id domId
             ]
                ++ attributes
            )
            []

    else
        span (clickable transaction domId) [ text displayText ]



-- TODO: how to capture the input as a string but still validate it?
-- on load - convert cents into currency string
-- on update - update the string - convert it back into cents for balance computation but do not fail on error
-- on save - validate the string and refuse to save if not valid


toCurrency : Int -> String
toCurrency amountCents =
    let
        ( dollars, cents ) =
            toDollarsCents amountCents
    in
    if amountCents == 0 then
        -- TODO: do not display an empty string for a posting that is being edited
        ""

    else
        String.join "." [ String.fromInt dollars, String.fromInt cents |> String.padLeft 2 '0' ]


fromCurrency : String -> Maybe Int
fromCurrency currency =
    currency |> String.toFloat |> Maybe.map (\value -> round (value * 100))


toDollarsCents : Int -> ( Int, Int )
toDollarsCents cents =
    let
        dollars =
            cents // 100
    in
    ( dollars, abs (cents - (dollars * 100)) )



-- TODO: this doesn't allow negatives, also causes some weird input behavior


toCents : String -> Int
toCents dollars =
    Maybe.withDefault 0 (String.filter Char.isDigit dollars |> String.toInt)


inputId : String -> Int -> String
inputId prefix id =
    prefix ++ String.fromInt id


descInputId : Int -> String
descInputId id =
    inputId "desc-" id


editorKeyHandler : Dict Int Msg -> Attribute Msg
editorKeyHandler keys =
    on "keyup" <|
        -- takes the anonymous function that produces a Decoder Msg & keyCode (a Decoder Int) and
        -- returns the Decoder Msg that is used by the keyup hanlder
        Decode.andThen
            (\keyCode -> keyCodeToMsg keys keyCode)
            keyCode


keyCodeToMsg : Dict Int Msg -> Int -> Decoder Msg
keyCodeToMsg keys keyCode =
    -- takes the keyCode and returns a different Decoder Msg depending on what it is
    case Dict.get keyCode keys of
        Just msg ->
            Decode.succeed msg

        Nothing ->
            Decode.fail (String.fromInt keyCode)



--
-- entry point, takes no arguments, returns a Program, I guess? does it matter?
--


main : Program Flags Model Msg
main =
    Browser.element
        { init = init
        , view = view
        , update = update
        , subscriptions = \_ -> Sub.none
        }
