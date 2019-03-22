module Transactions exposing (Flags, Model, Msg(..), Transaction, init, initialModel, main, tableRow, update, view)

import Browser
import Html exposing (..)
import Html.Events exposing (onClick)



-- MODEL


type alias Model =
    { transactions : List Transaction
    }


type alias Transaction =
    { id : Int
    , date : String
    , description : String
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
        [ Transaction 1 "2019-03-01" "Food"
        , Transaction 2 "2019-03-04" "Gas"
        , Transaction 3 "2019-03-06" "Pets"
        ]
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    ( initialModel, Cmd.none )



-- UPDATE
-- dummy message for now


type Msg
    = RowClick Int


update : Msg -> Model -> ( Model, Cmd Msg )
update message model =
    case message of
        RowClick id ->
            ( model, Cmd.none )



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
        , td [] [ text transaction.description ]
        ]



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
