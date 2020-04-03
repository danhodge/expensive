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


type alias Description =
    String


type alias Currency =
    String


type alias PostingId =
    Int


type alias Model =
    { transactions : List Transaction
    , categories : List Category
    , status : Message
    }


type Message
    = NoMessage
    | Message String
    | Error String


type alias TransactionRecord =
    { id : Int
    , date : String
    , amountCents : Int
    , data : TransactionData
    }


type alias TransactionData =
    { description : Description
    , postings : List Posting
    }


type alias Posting =
    { id : Maybe PostingId
    , category : CategorySetting
    , amount : String
    }


type Transaction
    = SavedTransaction TransactionRecord
    | EditableSavedTransaction TransactionRecord TransactionData



-- used to pass data in from JS - couldn't figure out if it's possible to omit this
-- if not being used so made it a generic JSON block based on this advice:
-- https://github.com/NoRedInk/elm-style-guide#how-to-structure-modules-for-a-page


type alias Flags =
    { categories : List Category
    }


initialModel : Model
initialModel =
    { transactions = [], categories = [], status = NoMessage }


init : Flags -> ( Model, Cmd Msg )
init flags =
    ( { initialModel | categories = flags.categories }, getTransactions )



-- UPDATE


type Msg
    = Noop
    | NewTransactions (Result Http.Error (List Transaction))
    | Click Int String
    | CancelEditor Int
    | SetDescription Int Description
    | SetPostingName Int Int CategorySetting
    | SetPostingAmount Int Int String
    | RemovePosting Int Int
    | SaveChanges Transaction
    | ChangesSaved Int (Result Http.Error Transaction)


update : Msg -> Model -> ( Model, Cmd Msg )
update message model =
    let
        deactivatedTransaction txnId transactions =
            List.map (filteredIdentityMapper (andFn (matchTransactionId txnId) editableTransaction) restoreOriginalData) transactions
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
            ( { model | transactions = List.map (filteredIdentityMapper (matchTransactionId txnId) toggleEditable) model.transactions }
            , Task.attempt (\_ -> Noop) (Browser.Dom.focus domId)
            )

        CancelEditor id ->
            -- TODO: set focus to the amount of the last posting
            ( { model | transactions = deactivatedTransaction id model.transactions }, Cmd.none )

        SetDescription id desc ->
            -- TODO: why not just put the Transaction in message instead of the id?
            ( { model | transactions = updateTransaction model.transactions id (updateTransactionDescription desc) }, Cmd.none )

        SetPostingName id postIdx category ->
            -- TODO: Detect when PostingName is set to an existing category by pressing Enter on auto-complete list and shift focus to the amount
            ( { model | transactions = updateTransactionAndPosting model.transactions id postIdx (updatePostingCategory category >> justify) }, Cmd.none )

        SetPostingAmount id postIdx amount ->
            ( { model | transactions = updateTransactionAndPosting model.transactions id postIdx (updatePostingAmount amount >> justify) }, Cmd.none )

        RemovePosting id postIdx ->
            ( { model | transactions = updateTransactionAndPosting model.transactions id postIdx (\posting -> Nothing) }, Cmd.none )

        SaveChanges txn ->
            let
                errors =
                    []

                -- case transaction of
                --     Just txn ->
                --         validateForSave txn
                --     Nothing ->
                --         []
            in
            case errors of
                f :: _ ->
                    -- TODO: include error message in the model
                    ( model, Cmd.none )

                [] ->
                    ( model, saveChanges txn )

        ChangesSaved id (Ok updatedTxn) ->
            let
                nonEmptyCategory posting =
                    case posting.category of
                        CategorySetting category ->
                            Just category

                        _ ->
                            Nothing
            in
            ( { model | transactions = List.map (filteredIdentityMapper (matchTransactionId id) (\txn -> updatedTxn)) model.transactions, categories = insertCategory (List.filterMap nonEmptyCategory (toRecord updatedTxn).data.postings) model.categories }, Cmd.none )

        ChangesSaved id (Err error) ->
            -- TODO: display an error
            ( { model | transactions = deactivatedTransaction id model.transactions }, Cmd.none )


toggleEditable : Transaction -> Transaction
toggleEditable transaction =
    case transaction of
        SavedTransaction record ->
            let
                curData =
                    record.data

                newData =
                    { curData | postings = ensureEmptyPosting curData.postings }
            in
            EditableSavedTransaction { record | data = newData } record.data

        EditableSavedTransaction record originalData ->
            SavedTransaction { record | data = originalData }


restoreOriginalData : Transaction -> Transaction
restoreOriginalData transaction =
    case transaction of
        SavedTransaction _ ->
            transaction

        EditableSavedTransaction record originalData ->
            SavedTransaction { record | data = originalData }


matchTransactionId : Int -> Transaction -> Bool
matchTransactionId id txn =
    (txn |> toRecord |> .id) == id


andFn : (a -> Bool) -> (a -> Bool) -> (a -> Bool)
andFn f g =
    \v -> f v && g v


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


updateTransactionDescription : String -> Transaction -> Transaction
updateTransactionDescription desc transaction =
    updateTransactionData transaction (\data -> { data | description = desc })


updateTransactionData : Transaction -> (TransactionData -> TransactionData) -> Transaction
updateTransactionData transaction updateFn =
    case transaction of
        SavedTransaction _ ->
            transaction

        EditableSavedTransaction record originalData ->
            let
                curData =
                    record.data
            in
            EditableSavedTransaction { record | data = updateFn curData } originalData


updateTransaction : List Transaction -> Int -> (Transaction -> Transaction) -> List Transaction
updateTransaction transactions id updateFn =
    let
        matchIdUpdateFn txn =
            if matchTransactionId id txn then
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
        -- TODO: maybe empty posting should be a different type of posting?
        postings ++ [ Posting Nothing NoCategory "" ]


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
            updateMatchedTransaction transaction ((updatePosting postIdx updatePostingFn >> ensureEmptyPosting) (transaction |> toRecord |> .data |> .postings))
    in
    updateTransaction transactions txnId updateTxnFn


updateMatchedTransaction : Transaction -> List Posting -> Transaction
updateMatchedTransaction transaction updatedPostings =
    updateTransactionData transaction (\data -> { data | postings = updatedPostings })


updatePostingCategory : CategorySetting -> Posting -> Posting
updatePostingCategory catg posting =
    { posting | category = catg }


updatePostingAmount : String -> Posting -> Posting
updatePostingAmount amount posting =
    { posting | amount = amount }


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


encodeTransaction : Transaction -> Result String Encode.Value
encodeTransaction transaction =
    let
        record =
            toRecord transaction

        dataResult =
            encodeTransactionData record.data
    in
    case dataResult of
        Ok value ->
            Ok
                ([ ( "id", Encode.int record.id )
                 , ( "date", Encode.string record.date )
                 , ( "amountCents", Encode.int record.amountCents )
                 , ( "data", value )
                 ]
                    |> Encode.object
                )

        Err msg ->
            dataResult


encodeTransactionData : TransactionData -> Result String Encode.Value
encodeTransactionData data =
    let
        postingResults =
            List.map encodePosting (List.filter (emptyPosting >> not) data.postings)

        onlyErrors v =
            case v of
                Ok _ ->
                    Nothing

                Err msg ->
                    Just msg

        onlySuccesses v =
            case v of
                Ok value ->
                    Just value

                Err _ ->
                    Nothing

        errorResults =
            List.filterMap onlyErrors postingResults

        successResults =
            List.filterMap onlySuccesses postingResults
    in
    if List.length errorResults == 0 then
        Ok
            (Encode.object
                [ ( "description", Encode.string data.description )
                , ( "postings", Encode.list (\a -> a) successResults )
                ]
            )

    else
        Err (List.foldr (++) "" errorResults)


encodePosting : Posting -> Result String Encode.Value
encodePosting posting =
    let
        amountCents =
            fromCurrency posting.amount

        category =
            case posting.category of
                NoCategory ->
                    ""

                CategorySetting name ->
                    name
    in
    case amountCents of
        Just cents ->
            Ok
                ([ maybeEncodeField "id" Encode.int posting.id
                 , Just ( "category", Encode.string category )
                 , Just ( "amountCents", Encode.int cents )
                 ]
                    |> List.filterMap (\v -> v)
                    |> Encode.object
                )

        Nothing ->
            Err ("Cannot convert " ++ posting.amount ++ " into cents")


maybeEncodeField : String -> (a -> Encode.Value) -> Maybe a -> Maybe ( String, Value )
maybeEncodeField fieldName encoder value =
    case value of
        Just val ->
            Just ( fieldName, encoder val )

        Nothing ->
            Nothing


decodedPosting : Int -> String -> Int -> Posting
decodedPosting id category amountCents =
    Posting (Just id) (toCategorySetting category) (toCurrency amountCents)


postingDecoder : Decoder Posting
postingDecoder =
    map3 decodedPosting
        (field "id" Decode.int)
        (field "category" Decode.string)
        (field "amountCents" Decode.int)


decodedTransaction : Int -> String -> Int -> Description -> List Posting -> Transaction
decodedTransaction id date amountCents description postings =
    SavedTransaction (TransactionRecord id date amountCents (TransactionData description postings))


transactionDecoder : Decoder Transaction
transactionDecoder =
    map5 decodedTransaction
        (field "id" Decode.int)
        (field "date" Decode.string)
        (field "amountCents" Decode.int)
        (field "description" Decode.string)
        (field "postings" (Decode.list postingDecoder))


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


saveChanges : Transaction -> Cmd Msg
saveChanges transaction =
    case transaction of
        SavedTransaction _ ->
            Cmd.none

        EditableSavedTransaction record _ ->
            let
                encodeResult =
                    encodeTransaction transaction
            in
            case encodeResult of
                Ok value ->
                    Http.request
                        { method = "PUT"
                        , headers = []
                        , url = Url.Builder.crossOrigin "http://localhost:4567" [ "transactions", String.fromInt record.id ] []
                        , body = Http.jsonBody value
                        , expect = Http.expectJson (ChangesSaved record.id) saveTransactionDecoder
                        , timeout = Nothing
                        , tracker = Nothing
                        }

                Err msg ->
                    -- TODO: put message in model status
                    Cmd.none



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
    let
        record =
            toRecord transaction
    in
    tr []
        [ td [] [ text record.date ]
        , td [] [ transactionDescription transaction ]
        , td [] [ text (toCurrency record.amountCents) ]
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
            Decode.map (Click (transaction |> toRecord |> .id)) (Decode.at [ "target", "id" ] Decode.string)
    in
    on "click" decoder


transactionDescription : Transaction -> Html Msg
transactionDescription transaction =
    case transaction of
        EditableSavedTransaction record _ ->
            input
                [ type_ "text"
                , value record.data.description
                , onInput (SetDescription record.id)
                , editorKeyHandler (Dict.fromList [ ( 27, CancelEditor record.id ), ( 13, SaveChanges transaction ) ])
                , id (descInputId record.id)
                ]
                []

        SavedTransaction record ->
            span (clickable transaction (descInputId record.id)) [ text record.data.description ]


transactionStatus : Transaction -> Html Msg
transactionStatus transaction =
    let
        record =
            toRecord transaction

        extractedAmounts =
            List.filterMap (\posting -> fromCurrency posting.amount) record.data.postings

        balance =
            record.amountCents + List.foldl (+) 0 extractedAmounts
    in
    if balance == 0 && List.length extractedAmounts == List.length (List.filter postingWithAmount record.data.postings) then
        text "Balanced"

    else
        text "Unbalanced"


postingsTable : Transaction -> Html Msg
postingsTable transaction =
    table []
        (List.indexedMap (postingRow transaction) (processedPostings transaction))


processedPostings : Transaction -> List Posting
processedPostings transaction =
    let
        postings =
            transaction |> toRecord |> .data |> .postings

        numPostings =
            List.length postings

        dropAmount =
            case transaction of
                SavedTransaction _ ->
                    if numPostings == 1 then
                        0

                    else
                        1

                EditableSavedTransaction _ _ ->
                    0
    in
    List.take (numPostings - dropAmount) postings


postingRow : Transaction -> Int -> Posting -> Html Msg
postingRow transaction postingIndex posting =
    let
        editable =
            case transaction of
                SavedTransaction _ ->
                    False

                EditableSavedTransaction _ _ ->
                    True

        displayText =
            postingText editable posting

        txnId =
            transaction |> toRecord |> .id

        domId idPrefix =
            inputId (inputId idPrefix txnId) postingIndex

        cells =
            [ td [] [ postingCategoryEditor transaction postingIndex domId displayText ]
            , td [] [ postingAmountEditor transaction postingIndex domId posting ]
            ]

        controls =
            if editable && not (emptyPosting posting) then
                [ td [] [ a [ onClick (RemovePosting txnId postingIndex) ] [ text "X" ] ] ]

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
            String.isEmpty posting.amount

        CategorySetting value ->
            False


postingWithAmount : Posting -> Bool
postingWithAmount posting =
    String.length posting.amount > 0


editableTransaction : Transaction -> Bool
editableTransaction transaction =
    case transaction of
        SavedTransaction _ ->
            False

        EditableSavedTransaction _ _ ->
            True


toRecord : Transaction -> TransactionRecord
toRecord transaction =
    case transaction of
        SavedTransaction record ->
            record

        EditableSavedTransaction record _ ->
            record


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
            SetPostingName (transaction |> toRecord |> .id) postingIndex (toCategorySetting str)
    in
    postingEditor saveMsg transaction (domId "posting-desc-") displayText [ Html.Attributes.list "categories-list", Html.Attributes.autocomplete False ] Dict.empty


postingAmountEditor : Transaction -> Int -> (String -> String) -> Posting -> Html Msg
postingAmountEditor transaction postingIndex domId posting =
    let
        txnId =
            transaction |> toRecord |> .id
    in
    postingEditor (SetPostingAmount txnId postingIndex) transaction (domId "posting-amt-") posting.amount [] (Dict.fromList [ ( 13, SaveChanges transaction ) ])


postingEditor : (String -> Msg) -> Transaction -> String -> String -> List (Attribute Msg) -> Dict Int Msg -> Html Msg
postingEditor saveMsg transaction domId displayText attributes additionalKeys =
    let
        editorKeys =
            Dict.union (Dict.fromList [ ( 27, CancelEditor (transaction |> toRecord |> .id) ) ]) additionalKeys
    in
    case transaction of
        EditableSavedTransaction _ _ ->
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

        SavedTransaction _ ->
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
