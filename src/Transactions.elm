module Transactions exposing (Flags, Model, Msg(..), Transaction, init, initialModel, main, tableRow, toRow, update, view)

import Browser
import Html exposing (..)



-- MODEL


type alias Model =
    { transactions : List Transaction
    }


type alias Transaction =
    { date : String
    , description : String
    }



-- used to pass data in from JS - couldn't figure out if it's possible to omit this
-- if not being used so made it a generic JSON block based on this advice:
-- https://github.com/NoRedInk/elm-style-guide#how-to-structure-modules-for-a-page


type alias Flags =
    { data : String
    }


toRow : Transaction -> List String
toRow transaction =
    [ transaction.date, transaction.description ]


initialModel : Model
initialModel =
    { transactions =
        [ Transaction "2019-03-01" "Food"
        , Transaction "2019-03-04" "Gas"
        , Transaction "2019-03-06" "Pets"
        ]
    }


init : Flags -> ( Model, Cmd Msg )
init flags =
    ( initialModel, Cmd.none )



-- UPDATE
-- dummy message for now


type Msg
    = None


update : Msg -> Model -> ( Model, Cmd Msg )
update message model =
    ( model, Cmd.none )



-- VIEW


view : Model -> Html Msg
view model =
    table []
        -- there has to be a better way to do this
        ([ tableRow th [ "Date", "Description" ] ]
            ++ List.map (tableRow td) (List.map toRow model.transactions)
        )


tableRow : (List (Attribute Msg) -> List (Html Msg) -> Html Msg) -> List String -> Html Msg
tableRow elementType values =
    tr [] (List.map (\value -> elementType [] [ text value ]) values)



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
