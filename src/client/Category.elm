module Category exposing (Category, CategorySetting(..), toCategorySetting, fromCategorySetting, nonEmptyCategoryFilter, emptyCategory, categoryText)

type alias Category =
    String


type CategorySetting
    = CategorySetting Category
    | NoCategory


toCategorySetting : String -> CategorySetting
toCategorySetting text =
    case String.length text of
        0 ->
            NoCategory

        _ ->
            CategorySetting text

fromCategorySetting : CategorySetting -> String
fromCategorySetting category =
    case category of
        NoCategory ->
            ""

        CategorySetting name ->
            name


emptyCategory : CategorySetting -> Bool
emptyCategory category =
    case category of
        NoCategory ->
            True

        CategorySetting value ->
            False


nonEmptyCategoryFilter : CategorySetting -> Maybe Category
nonEmptyCategoryFilter category =
    case category of
        CategorySetting cat ->
            Just cat

        NoCategory ->
            Nothing


categoryText : Maybe String -> CategorySetting -> String
categoryText noCategoryText category =
    case category of
        CategorySetting value ->
            value

        NoCategory ->
            case noCategoryText of
                Just txt ->
                    txt

                Nothing ->
                    "Choose a Category"
