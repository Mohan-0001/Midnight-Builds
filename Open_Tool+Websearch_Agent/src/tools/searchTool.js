import { TavilySearch } from "@langchain/tavily";

const SearchTool = new TavilySearch({
    maxResults: 3,       
    
});

export default SearchTool;
