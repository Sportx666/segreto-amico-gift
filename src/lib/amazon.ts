export function ideaBucketUrl(budget: number): string {
  // Amazon affiliate search URLs for different budget ranges
  const searchQueries: Record<number, string> = {
    5: "regalo+sotto+5+euro",
    10: "regalo+sotto+10+euro", 
    15: "regalo+sotto+15+euro",
    20: "regalo+sotto+20+euro"
  };
  
  const query = searchQueries[budget] || "regali";
  return `https://www.amazon.it/s?k=${query}&tag=your-affiliate-tag&ref=sr_nr_p_36_1`;
}