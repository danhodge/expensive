module Zondicon exposing (Zondicon(..), zondicon)

import Html exposing (Html)
import Html.Attributes exposing (attribute)
import Svg exposing (path, svg)
import Svg.Attributes exposing (d)


type Zondicon
    = CloseIcon


zondicon : List String -> Zondicon -> Html msg
zondicon cssClassNames icon =
    let
        data =
            case icon of
                CloseIcon ->
                    "M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"
    in
    svg
        (List.map
            Svg.Attributes.class
            cssClassNames
            ++ [ attribute "xmlns" "http://www.w3.org/2000/svg"
               , attribute "viewBox" "0 0 20 20"
               ]
        )
        [ path [ d data ] [] ]
