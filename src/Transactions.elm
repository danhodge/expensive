module Transactions exposing (Flags, Model, Msg(..), Transaction, init, initialModel, main, update, view)

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
import Zondicon exposing (Zondicon, zondicon)
import Category as Category exposing (..)
import Money as Money exposing (..)



-- MODEL


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
            case saveChanges txn of
                Ok cmd ->
                    ( { model | status = NoMessage }, cmd )

                Err msg ->
                    ( { model | status = Error msg }, Cmd.none )

        ChangesSaved id (Ok updatedTxn) ->
            let
                nonEmptyCategory posting =
                    nonEmptyCategoryFilter posting.category

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

        postingsResult =
            encodePostings record.data.postings
    in
    case postingsResult of
        Ok value ->
            Ok
                ([ ( "id", Encode.int record.id )
                 , ( "date", Encode.string record.date )
                 , ( "amountCents", Encode.int record.amountCents )
                 , ( "description", Encode.string record.data.description )
                 , ( "postings", value )
                 ]
                    |> Encode.object
                )

        Err msg ->
            postingsResult


encodePostings : List Posting -> Result String Encode.Value
encodePostings postings =
    let
        postingResults =
            List.map encodePosting (List.filter (emptyPosting >> not) postings)

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
        Ok (Encode.list (\a -> a) successResults)

    else
        Err (List.foldr (++) "" errorResults)


encodePosting : Posting -> Result String Encode.Value
encodePosting posting =
    let
        amountCents =
            fromCurrency posting.amount

        category =
            fromCategorySetting posting.category
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


saveChanges : Transaction -> Result String (Cmd Msg)
saveChanges transaction =
    case transaction of
        SavedTransaction _ ->
            Ok Cmd.none

        EditableSavedTransaction record _ ->
            let
                encodeResult =
                    encodeTransaction transaction
            in
            case encodeResult of
                Ok value ->
                    Ok
                        (Http.request
                            { method = "PUT"
                            , headers = []
                            , url = Url.Builder.crossOrigin "http://localhost:4567" [ "transactions", String.fromInt record.id ] []
                            , body = Http.jsonBody value
                            , expect = Http.expectJson (ChangesSaved record.id) saveTransactionDecoder
                            , timeout = Nothing
                            , tracker = Nothing
                            }
                        )

                Err msg ->
                    Err msg



-- VIEW


view : Model -> Html Msg
view model =
    div [ class "mt-4" ]
        [ datalist [ id "categories-list" ]
            (List.map
                (\name -> option [] [ text name ])
                model.categories
            )
        , div
            (classes
                [ "w-2/3", "mx-auto" ]
            )
            [ statusMessage model.status ]
        , table
            (classes [ "w-2/3", "mx-auto", "table-fixed" ])
            ([ tr [ class "text-left" ]
                [ th [ class "w-1/6", class "p-2" ] [ text "Date" ]
                , th [ class "w-1/4" ] [ text "Description" ]
                , th [ class "w-1/6" ] [ text "Amount" ]
                , th [ class "w-1/6" ] [ text "Status" ]
                , th [ class "w-1/2" ] [ text "Postings" ]
                ]
             ]
                ++ transactionRows model.transactions
            )
        ]


classes : List String -> List (Attribute Msg)
classes names =
    List.map (\name -> class name) names


statusMessage : Message -> Html Msg
statusMessage msg =
    case msg of
        NoMessage ->
            span [] []

        Message txt ->
            span [] [ text txt ]

        Error txt ->
            span [ class "text-red-600", class "pl-2", class "font-semibold" ] [ text txt ]


transactionRows : List Transaction -> List (Html Msg)
transactionRows transactions =
    List.map transactionRow transactions


transactionRow : Transaction -> Html Msg
transactionRow transaction =
    let
        record =
            toRecord transaction

        cssClasses =
            [ "text-sm", "text-gray-800", "border-b-2", "border-solid", "border-gray-400" ]
                ++ (case transaction of
                        SavedTransaction _ ->
                            []

                        EditableSavedTransaction _ _ ->
                            [ "bg-yellow-300" ]
                   )

        rowAttrs =
            classes cssClasses
                ++ (case transaction of
                        SavedTransaction _ ->
                            clickable transaction (descInputId record.id)

                        EditableSavedTransaction _ _ ->
                            []
                   )
    in
    tr rowAttrs
        [ td (classes [ "align-top", "h-8", "py-1", "pl-2" ]) [ text record.date ]
        , td (classes [ "align-top", "h-8", "py-1" ]) [ transactionDescription transaction ]
        , td (classes [ "align-top", "h-8", "py-1" ])
            [ div
                (amountClasses
                    [ class "mr-12" ]
                    record.amountCents
                )
                [ text (toCurrencyDisplay record.amountCents) ]
            ]
        , td (classes [ "align-top", "h-8", "py-1" ]) [ transactionStatus transaction ]
        , td (classes [ "align-top", "h-8", "py-1" ]) [ postingsTable transaction ]
        ]


amountClasses : List (Attribute Msg) -> Int -> List (Attribute Msg)
amountClasses attrs amountCents =
    (if amountCents < 0 then
        []

     else
        [ class "text-green-600 " ]
    )
        ++ [ class "text-right " ]
        ++ attrs


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
                , class "border"
                , class "px-1"
                , class "rounded-sm"
                , class "border-gray-400"
                , Html.Attributes.autocomplete False
                , value record.data.description
                , onInput (SetDescription record.id)
                , editorKeyHandler (Dict.fromList [ ( 27, CancelEditor record.id ), ( 13, SaveChanges transaction ) ])
                , id (descInputId record.id)
                ]
                []

        SavedTransaction record ->
            span [] [ text record.data.description ]


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
    table [ class "table-fixed", class "w-full" ]
        (List.indexedMap (postingRow transaction) (transaction |> toRecord |> .data |> .postings))


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
            [ td [ class "w-9/12" ] [ postingCategoryEditor transaction postingIndex domId displayText ]
            , td [ class "w-1/6", class "text-right" ] [ postingAmountEditor transaction postingIndex domId posting ]
            ]

        controls =
            if editable && not (emptyPosting posting) then
                [ td [ class "w-1/12", class "text-center" ]
                    [ div
                        [ onClick (RemovePosting txnId postingIndex)
                        ]
                        -- TODO: figure out how to get other styles to apply to the icon (i.e. color)
                        [ zondicon [ "h-4" ] Zondicon.CloseIcon ]
                    ]
                ]

            else
                [ td [ class "w-1/12" ] [] ]
    in
    tr []
        (cells
            ++ controls
        )


emptyPosting : Posting -> Bool
emptyPosting posting =
    emptyCategory posting.category && String.isEmpty posting.amount


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
    let
        noCategoryText =
            if editable then
                Just ""
            else
                Nothing
    in
    categoryText noCategoryText posting.category


postingCategoryEditor : Transaction -> Int -> (String -> String) -> String -> Html Msg
postingCategoryEditor transaction postingIndex domId displayText =
    let
        saveMsg str =
            SetPostingName (transaction |> toRecord |> .id) postingIndex (toCategorySetting str)
    in
    postingEditor saveMsg transaction (domId "posting-desc-") (\_ -> displayText) (\_ -> [ Html.Attributes.list "categories-list", Html.Attributes.autocomplete False ]) Dict.empty


postingAmountEditor : Transaction -> Int -> (String -> String) -> Posting -> Html Msg
postingAmountEditor transaction postingIndex domId posting =
    let
        txnId =
            transaction |> toRecord |> .id
    in
    postingEditor (SetPostingAmount txnId postingIndex) transaction (domId "posting-amt-") (postingAmountDisplayText posting.amount) (postingAmountAttributes posting.amount) (Dict.fromList [ ( 13, SaveChanges transaction ) ])


postingEditor : (String -> Msg) -> Transaction -> String -> (Transaction -> String) -> (Transaction -> List (Attribute Msg)) -> Dict Int Msg -> Html Msg
postingEditor saveMsg transaction domId displayTextFn attributesFn additionalKeys =
    let
        editorKeys =
            Dict.union (Dict.fromList [ ( 27, CancelEditor (transaction |> toRecord |> .id) ) ]) additionalKeys
    in
    case transaction of
        EditableSavedTransaction _ _ ->
            div (classes [ "flex", "flex-col" ])
                [ input
                    ([ type_ "text"
                     , class "border"
                     , class "px-1"
                     , class "rounded-sm"
                     , class "border-gray-400"
                     , value (displayTextFn transaction)
                     , onInput saveMsg
                     , editorKeyHandler editorKeys
                     , id domId
                     ]
                        ++ attributesFn transaction
                    )
                    []
                ]

        SavedTransaction _ ->
            span (attributesFn transaction) [ text (displayTextFn transaction) ]


postingAmountDisplayText : String -> Transaction -> String
postingAmountDisplayText amount transaction =
    case transaction of
        EditableSavedTransaction _ _ ->
            amount

        SavedTransaction _ ->
            case fromCurrency amount of
                Just amountCents ->
                    toCurrencyDisplay amountCents

                Nothing ->
                    amount


postingAmountAttributes : String -> Transaction -> List (Attribute Msg)
postingAmountAttributes amount transaction =
    case transaction of
        EditableSavedTransaction _ _ ->
            [ class "text-right", Html.Attributes.autocomplete False ]

        SavedTransaction _ ->
            case fromCurrency amount of
                Just amountCents ->
                    amountClasses [] amountCents

                Nothing ->
                    []



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
