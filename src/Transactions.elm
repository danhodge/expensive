module Transactions exposing (Flags, Model, Msg(..), Transaction, init, initialModel, main, tableRow, update, view)

import Browser
import Browser.Dom
import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (keyCode, on, onClick, onInput, targetValue)
import Http
import Json.Decode as Decode exposing (Decoder, field, map2, map3, map5)
import Json.Encode as Encode exposing (..)
import String
import Task
import Url.Builder



-- MODEL


type alias Model =
    { transactions : List Transaction
    }


type alias Posting =
    { id : Maybe Int
    , category : Maybe String
    , amountCents : Int
    }



-- TransactionData = the data in a transaction that is editable


type alias TransactionData =
    { description : String
    , postings : List Posting
    }


type alias Transaction =
    { id : Int
    , date : String
    , editable : Bool
    , data : TransactionData
    , originalData : Maybe TransactionData
    }



-- used to pass data in from JS - couldn't figure out if it's possible to omit this
-- if not being used so made it a generic JSON block based on this advice:
-- https://github.com/NoRedInk/elm-style-guide#how-to-structure-modules-for-a-page


type alias Flags =
    { data : String
    }


initialModel : Model
initialModel =
    { transactions = [] }


init : Flags -> ( Model, Cmd Msg )
init flags =
    ( initialModel, getTransactions )



-- UPDATE


type Msg
    = Noop
    | NewTransactions (Result Http.Error (List Transaction))
    | Click Int String
    | CancelEditor Int
    | SetDescription Int String
    | SetPostingName Int Int String
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
            ( { model | transactions = deactivatedTransaction id model.transactions }, Cmd.none )

        SetDescription id desc ->
            ( { model | transactions = updateTransaction model.transactions id (updateTransactionDescription desc) }, Cmd.none )

        SetPostingName id postIdx name ->
            ( { model | transactions = updateTransactionAndPosting model.transactions id postIdx (updatePostingCategory name >> justify) }, Cmd.none )

        SetPostingAmount id postIdx amount ->
            ( { model | transactions = updateTransactionAndPosting model.transactions id postIdx (updatePostingAmount amount >> justify) }, Cmd.none )

        RemovePosting id postIdx ->
            ( { model | transactions = updateTransactionAndPosting model.transactions id postIdx (\posting -> Nothing) }, Cmd.none )

        SaveChanges id ->
            ( { model | transactions = List.map (filteredIdentityMapper (toggleableRow id True) toggleEditable) model.transactions }, saveChanges (model.transactions |> List.filter (\txn -> txn.id == id) |> List.head) )

        ChangesSaved id (Ok updatedTxn) ->
            ( { model | transactions = List.map (filteredIdentityMapper (\txn -> txn.id == id) (\txn -> updatedTxn)) model.transactions }, Cmd.none )

        ChangesSaved id (Err error) ->
            -- TODO: display an error
            ( { model | transactions = deactivatedTransaction id model.transactions }, Cmd.none )


toggleEditable : Transaction -> Transaction
toggleEditable transaction =
    { transaction | editable = not transaction.editable }


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
        postings ++ [ Posting Nothing Nothing 0 ]


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


updatePostingCategory : String -> Posting -> Posting
updatePostingCategory catg posting =
    { posting | category = Just catg }


updatePostingAmount : String -> Posting -> Posting
updatePostingAmount amount posting =
    { posting | amountCents = toCents amount }



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
    [ maybeEncodeField "id" Encode.int posting.id
    , maybeEncodeField "category" Encode.string posting.category
    , Just ( "amountCents", Encode.int posting.amountCents )
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
    Posting (Just id) (Just category) amountCents


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


decodedTransaction : Int -> String -> TransactionData -> Transaction
decodedTransaction id date data =
    Transaction id date False data Nothing


decodedTransactionData : String -> List Posting -> TransactionData
decodedTransactionData description postings =
    TransactionData description (ensureEmptyPosting postings)


transactionDecoder : Decoder Transaction
transactionDecoder =
    map3 decodedTransaction
        (field "id" Decode.int)
        (field "date" Decode.string)
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
    table []
        -- there has to be a better way to do this
        ([ tableRow th [ "Date", "Description", "Postings" ] ]
            ++ transactionRows model.transactions
        )


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
            , editorKeyHandler (CancelEditor transaction.id) (SaveChanges transaction.id)
            , id (descInputId transaction.id)
            ]
            []

    else
        span (clickable transaction (descInputId transaction.id)) [ text transaction.data.description ]


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
            postingText posting

        cells =
            [ td [] [ postingEditor SetPostingName transaction postingIndex "posting-desc-" displayText ]
            , td [] [ postingEditor SetPostingAmount transaction postingIndex "posting-amt-" (posting.amountCents |> toCurrency) ]
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
        Nothing ->
            abs posting.amountCents == 0

        Just value ->
            False


postingText : Posting -> String
postingText posting =
    case posting.category of
        Just value ->
            value

        Nothing ->
            "Choose a Category"


postingEditor : (Int -> Int -> String -> Msg) -> Transaction -> Int -> String -> String -> Html Msg
postingEditor saveMsg transaction postingIndex idPrefix displayText =
    let
        domId =
            inputId (inputId idPrefix transaction.id) postingIndex
    in
    if transaction.editable then
        input
            [ type_ "text"
            , value displayText
            , onInput (saveMsg transaction.id postingIndex)
            , editorKeyHandler (CancelEditor transaction.id) (SaveChanges transaction.id)
            , id domId
            ]
            []

    else
        span (clickable transaction domId) [ text displayText ]


toCurrency : Int -> String
toCurrency amountCents =
    let
        ( dollars, cents ) =
            toDollarsCents amountCents
    in
    String.join "." [ String.fromInt dollars, String.fromInt cents |> String.padLeft 2 '0' ]


toDollarsCents : Int -> ( Int, Int )
toDollarsCents cents =
    let
        dollars =
            cents // 100
    in
    ( dollars, cents - (dollars * 100) )



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


editorKeyHandler : Msg -> Msg -> Attribute Msg
editorKeyHandler escMsg enterMsg =
    on "keyup" <|
        -- takes the anonymous function that produces a Decoder Msg & keyCode (a Decoder Int) and
        -- returns the Decoder Msg that is used by the keyup hanlder
        Decode.andThen
            -- this function takes the keyCode and returns a different Decoder Msg depending on
            -- what the keyCode was (the keyCode parameter is different than keyCode decoder below)
            (\keyCode ->
                if keyCode == 13 then
                    -- on Enter
                    Decode.succeed enterMsg

                else if keyCode == 27 then
                    -- on ESC
                    Decode.succeed escMsg

                else
                    Decode.fail (String.fromInt keyCode)
            )
            keyCode



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
