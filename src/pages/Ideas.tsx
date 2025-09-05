import { ideaBucketUrl } from "../lib/amazon";

export default function Ideas(){
  const buckets = [5,10,15,20] as const;
  return (
    <div style={{padding:16}}>
      <h1>Idee regalo veloci</h1>
      <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(2,minmax(0,1fr))"}}>
        {buckets.map(b=>(
          <a key={b} href={ideaBucketUrl(b)} target="_blank" rel="noreferrer"
             style={{padding:14,border:"1px solid #eee",borderRadius:10,textAlign:"center"}}>{b} €</a>
        ))}
      </div>
      <p style={{marginTop:12,color:"#666",fontSize:12}}>
        Come affiliato Amazon, guadagniamo da acquisti idonei.
      </p>
    </div>
  );
}
