module Transactions exposing (Flags, Model, Msg(..), Transaction, init, initialModel, main, tableRow, update, view)

import Browser
import Browser.Dom
import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (keyCode, on, onClick, onInput, targetValue)
import Json.Decode
import String
import Task



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


type DisplayPosting
    = EmptyPosting
    | NonEmptyPosting Posting



-- used to pass data in from JS - couldn't figure out if it's possible to omit this
-- if not being used so made it a generic JSON block based on this advice:
-- https://github.com/NoRedInk/elm-style-guide#how-to-structure-modules-for-a-page


type alias Flags =
    { data : String
    }


initialModel : Model
initialModel =
    { transactions =
        [ Transaction 1
            "2019-03-01"
            False
            (TransactionData
                "Food"
                [ Posting (Just 10) (Just "Expenses:Food:Restaurant") 1000
                , Posting Nothing Nothing 0
                ]
            )
            Nothing
        , Transaction 2
            "2019-03-04"
            False
            (TransactionData "Gas"
                [ Posting Nothing Nothing 0 ]
            )
            Nothing
        , Transaction 3
            "2019-03-06"
            False
            (TransactionData "Pets"
                [ Posting (Just 20) (Just "Expenses:Food:Dog") 1999
                , Posting (Just 30) (Just "Income:Rebates") -500
                , Posting Nothing Nothing 0
                ]
            )
            Nothing
        ]
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    ( initialModel, Cmd.none )



-- UPDATE


type Msg
    = Noop
    | Click Int String
    | CancelEditor Int
    | SetPostingName Int Int String
    | SetPostingAmount Int Int String
    | SaveChanges Int String
    | SaveChanges2 Int


update : Msg -> Model -> ( Model, Cmd Msg )
update message model =
    let
        deactivateEditor id txn =
            toggleEditable True id txn
    in
    case message of
        Noop ->
            ( model, Cmd.none )

        Click txnId domId ->
            ( { model | transactions = List.map (toggleEditable False txnId) model.transactions }
            , Task.attempt (\_ -> Noop) (Browser.Dom.focus domId)
            )

        CancelEditor id ->
            ( { model | transactions = List.map (deactivateEditor id) model.transactions }, Cmd.none )

        SetPostingName id postId name ->
            ( { model | transactions = updateTransactionAndPosting model.transactions id postId (updatePostingCategory name) }, Cmd.none )

        SetPostingAmount id postId amount ->
            ( { model | transactions = updateTransactionAndPosting model.transactions id postId (updatePostingAmount amount) }, Cmd.none )

        SaveChanges id text ->
            ( { model | transactions = updateTransaction model.transactions id (updateTransactionDescription text << deactivateEditor id) }, Cmd.none )

        SaveChanges2 id ->
            ( model, Cmd.none )


toggleEditable : Bool -> Int -> Transaction -> Transaction
toggleEditable curState id transaction =
    if transaction.id == id && transaction.editable == curState then
        { transaction | editable = not transaction.editable }

    else
        transaction


updateTransactionDescription : String -> Transaction -> Transaction
updateTransactionDescription desc transaction =
    { transaction | description = desc }


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



-- TODO: is there a way to make a generic function that can update transactions OR postings?


updatePosting : List Posting -> Int -> (Posting -> Posting) -> List Posting
updatePosting postings id updateFn =
    let
        matchIdUpdateFn posting =
            if posting.id == id then
                updateFn posting

            else
                posting
    in
    List.map matchIdUpdateFn postings


updateTransactionAndPosting : List Transaction -> Int -> Int -> (Posting -> Posting) -> List Transaction
updateTransactionAndPosting transactions txnId postId updatePostingFn =
    let
        updateTxnFn transaction =
            { transaction | postings = updatePosting transaction.postings postId updatePostingFn }
    in
    updateTransaction transactions txnId updateTxnFn


updatePostingCategory : String -> Posting -> Posting
updatePostingCategory catg posting =
    { posting | category = catg }


updatePostingAmount : String -> Posting -> Posting
updatePostingAmount amount posting =
    { posting | amountCents = toCents amount }



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
            Json.Decode.map (Click transaction.id) (Json.Decode.at [ "target", "id" ] Json.Decode.string)
    in
    on "click" decoder


transactionDescription : Transaction -> Html Msg
transactionDescription transaction =
    if transaction.editable then
        input
            [ type_ "text"
            , value transaction.description
            , editorKeyHandler (CancelEditor transaction.id) (SaveChanges transaction.id)
            , id (descInputId transaction.id)
            ]
            []

    else
        span (clickable transaction (descInputId transaction.id)) [ text transaction.description ]


postingsTable : Transaction -> Html Msg
postingsTable transaction =
    table []
        (List.map (postingRow transaction) (processedPostings transaction))


processedPostings : Transaction -> List DisplayPosting
processedPostings transaction =
    case transaction.postings of
        [] ->
            [ EmptyPosting ]

        _ ->
            -- this is ugly - should it be extracted into a function instead?
            List.map NonEmptyPosting transaction.postings
                ++ (if transaction.editable then
                        [ EmptyPosting ]

                    else
                        []
                   )


postingRow : Transaction -> DisplayPosting -> Html Msg
postingRow transaction posting =
    let
        displayText =
            postingText posting

        -- TODO: use the position (index) of the posting to generate its DOM id instead of its id, since it won't always have an id
        cells =
            case posting of
                EmptyPosting ->
                    [ td [] [ postingEditor SetPostingName transaction transaction.id "empty-posting-" displayText ]
                    , td [] [ postingEditor SetPostingAmount transaction transaction.id "posting-amt-" "" ]
                    ]

                NonEmptyPosting post ->
                    [ td [] [ postingEditor SetPostingName transaction post.id "posting-desc-" displayText ]
                    , td [] [ postingEditor SetPostingAmount transaction post.id "posting-amt-" (post.amountCents |> toCurrency) ]
                    ]
    in
    tr []
        cells


postingText : DisplayPosting -> String
postingText posting =
    case posting of
        EmptyPosting ->
            "Choose a Category"

        NonEmptyPosting post ->
            post.category


postingEditor : (Int -> Int -> String -> Msg) -> Transaction -> Int -> String -> String -> Html Msg
postingEditor saveMsg transaction postingId idPrefix displayText =
    if transaction.editable then
        input
            [ type_ "text"
            , value displayText
            , onInput (saveMsg transaction.id postingId)
            , editorKeyHandler2 (CancelEditor transaction.id) (SaveChanges2 transaction.id)
            , id (inputId idPrefix postingId)
            ]
            []

    else
        span (clickable transaction (inputId idPrefix postingId)) [ text displayText ]


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


editorKeyHandler : Msg -> (String -> Msg) -> Attribute Msg
editorKeyHandler escMsg enterMsg =
    on "keyup" <|
        -- takes the anonymous function that produces a Decoder Msg & keyCode (a Decoder Int) and
        -- returns the Decoder Msg that is used by the keyup hanlder
        Json.Decode.andThen
            -- this function takes the keyCode and returns a different Decoder Msg depending on
            -- what the keyCode was (the keyCode parameter is different than keyCode decoder below)
            (\keyCode ->
                if keyCode == 13 then
                    -- on Enter, decode the targetValue of the event into the enterMsg
                    Json.Decode.map enterMsg targetValue

                else if keyCode == 27 then
                    -- on ESC
                    Json.Decode.succeed escMsg

                else
                    Json.Decode.fail (String.fromInt keyCode)
            )
            keyCode


editorKeyHandler2 : Msg -> Msg -> Attribute Msg
editorKeyHandler2 escMsg enterMsg =
    on "keyup" <|
        -- takes the anonymous function that produces a Decoder Msg & keyCode (a Decoder Int) and
        -- returns the Decoder Msg that is used by the keyup hanlder
        Json.Decode.andThen
            -- this function takes the keyCode and returns a different Decoder Msg depending on
            -- what the keyCode was (the keyCode parameter is different than keyCode decoder below)
            (\keyCode ->
                if keyCode == 13 then
                    -- on Enter
                    Json.Decode.succeed enterMsg

                else if keyCode == 27 then
                    -- on ESC
                    Json.Decode.succeed escMsg

                else
                    Json.Decode.fail (String.fromInt keyCode)
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
