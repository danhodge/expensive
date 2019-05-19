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


type alias Transaction =
    { id : Int
    , date : String
    , description : String
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
            False
        , Transaction 2
            "2019-03-04"
            "Gas"
            False
        , Transaction 3
            "2019-03-06"
            "Pets"
            False
        ]
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    ( initialModel, Cmd.none )



-- UPDATE


type Msg
    = Noop
    | RowClick Int
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

        RowClick id ->
            ( { model | transactions = List.map (toggleEditable False id) model.transactions }
            , Task.attempt (\_ -> Noop) (Browser.Dom.focus (descInputId id))
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
        ([ tableRow th [ "Date", "Description" ] ]
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
    tr [ onClick (RowClick transaction.id) ]
        [ td [] [ text transaction.date ]
        , td [] [ transactionDescription transaction ]
        ]


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
        text transaction.description


descInputId : Int -> String
descInputId id =
    "desc_" ++ String.fromInt id


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
