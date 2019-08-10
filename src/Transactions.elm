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
    | SetDescription Int String
    | SetPostingName Int Int String
    | SetPostingAmount Int Int String
    | RemovePosting Int Int
    | SaveChanges Int



-- TODO: automatically add a new posting during editing


update : Msg -> Model -> ( Model, Cmd Msg )
update message model =
    let
        toggle id txn =
            toggleEditable True id txn

        deactivateEditor id =
            toggle id << restoreOriginalData
    in
    case message of
        Noop ->
            ( model, Cmd.none )

        Click txnId domId ->
            ( { model | transactions = List.map (toggleEditable False txnId << captureOriginalData) model.transactions }
            , Task.attempt (\_ -> Noop) (Browser.Dom.focus domId)
            )

        CancelEditor id ->
            ( { model | transactions = List.map (deactivateEditor id) model.transactions }, Cmd.none )

        SetDescription id desc ->
            ( { model | transactions = updateTransaction model.transactions id (updateTransactionDescription desc) }, Cmd.none )

        SetPostingName id postIdx name ->
            ( { model | transactions = updateTransactionAndPosting model.transactions id postIdx (updatePostingCategory name >> justify) }, Cmd.none )

        SetPostingAmount id postIdx amount ->
            ( { model | transactions = updateTransactionAndPosting model.transactions id postIdx (updatePostingAmount amount >> justify) }, Cmd.none )

        RemovePosting id postIdx ->
            ( { model | transactions = updateTransactionAndPosting model.transactions id postIdx (\posting -> Nothing) }, Cmd.none )

        SaveChanges id ->
            ( { model | transactions = List.map (toggle id << clearOriginalData) model.transactions }, Cmd.none )


toggleEditable : Bool -> Int -> Transaction -> Transaction
toggleEditable curState id transaction =
    if transaction.id == id && transaction.editable == curState then
        case curState of
            True ->
                { transaction | editable = not transaction.editable }

            False ->
                { transaction | editable = not transaction.editable }

    else
        transaction


restoreOriginalData : Transaction -> Transaction
restoreOriginalData transaction =
    { transaction | data = Maybe.withDefault transaction.data transaction.originalData }


captureOriginalData : Transaction -> Transaction
captureOriginalData transaction =
    { transaction | originalData = Just transaction.data }


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


updatePosting : List Posting -> Int -> (Posting -> Maybe Posting) -> List Posting
updatePosting postings idx updateFn =
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
            updateMatchedTransaction transaction (updatePosting transaction.data.postings postIdx updatePostingFn)
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
