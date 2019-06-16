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
    { id : Int
    , category : String
    , amountCents : Int
    }


type alias Transaction =
    { id : Int
    , date : String
    , description : String
    , postings : List Posting
    , editable : Bool
    }



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
            "Food"
            [ Posting 10 "Expenses:Food:Restaurant" 1000 ]
            False
        , Transaction 2
            "2019-03-04"
            "Gas"
            []
            False
        , Transaction 3
            "2019-03-06"
            "Pets"
            [ Posting 20 "Expenses:Food:Dog" 1999, Posting 30 "Income:Rebates" -500 ]
            False
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
    | SaveChanges Int String


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

        SaveChanges id text ->
            ( { model | transactions = updateTransaction model.transactions id (updateTransactionDescription text << deactivateEditor id) }, Cmd.none )


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
        (List.map (postingRow transaction) transaction.postings)


postingRow : Transaction -> Posting -> Html Msg
postingRow transaction posting =
    tr []
        [ td [] [ postingEditor transaction posting "posting-desc-" .category ]
        , td [] [ postingEditor transaction posting "posting-amt-" (.amountCents >> toCurrency) ]
        ]


postingEditor : Transaction -> Posting -> String -> (Posting -> String) -> Html Msg
postingEditor transaction posting idPrefix display =
    if transaction.editable then
        input
            [ type_ "text"
            , value (display posting)
            , editorKeyHandler (CancelEditor transaction.id) (SaveChanges transaction.id)
            , id (inputId idPrefix posting.id)
            ]
            []

    else
        span (clickable transaction (inputId idPrefix posting.id)) [ text (display posting) ]


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
