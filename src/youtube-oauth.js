'use strict';
// Oficjalne YouTube Data API v3: dane kanału i playlist, nie audio.
const TOKEN_URL='https://oauth2.googleapis.com/token';
const DATA_URL='https://www.googleapis.com/youtube/v3/';
let cached=null;
function config(env=process.env){
  const clientId=String(env.YOUTUBE_OAUTH_CLIENT_ID||'').trim();
  const clientSecret=String(env.YOUTUBE_OAUTH_CLIENT_SECRET||'').trim();
  const refreshToken=String(env.YOUTUBE_OAUTH_REFRESH_TOKEN||'').trim();
  const validId=/^[\w.-]{10,200}\.apps\.googleusercontent\.com$/.test(clientId);
  const n=[clientId,clientSecret,refreshToken].filter(Boolean).length;
  return {clientId,clientSecret,refreshToken,ready:validId&&Boolean(clientSecret&&refreshToken),
    status:n===0?'brak konfiguracji':!validId?'nieprawidłowy YOUTUBE_OAUTH_CLIENT_ID':!clientSecret?
      'brak YOUTUBE_OAUTH_CLIENT_SECRET':!refreshToken?'brak YOUTUBE_OAUTH_REFRESH_TOKEN':'skonfigurowany'};
}
function clearCache(){cached=null;}
async function accessToken(fetchImpl=fetch,env=process.env){
  const cfg=config(env);
  if(!cfg.ready)throw Error('YouTube OAuth: '+cfg.status+'. Ustaw .env na hostingu.');
  const key=[cfg.clientId,cfg.clientSecret,cfg.refreshToken].join('\0');
  if(cached&&cached.key===key&&cached.expiry>Date.now())return cached.token;
  const res=await fetchImpl(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.clientSecret,refresh_token:cfg.refreshToken,grant_type:'refresh_token'}),
    signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw Error('Google OAuth: odświeżenie tokenu nieudane (HTTP '+res.status+'). Sprawdź ważność tokenu i uprawnienia.');
  const json=await res.json();
  if(!json||typeof json.access_token!=='string'||!json.access_token)throw Error('Google nie zwróciło tokenu dostępu.');
  const seconds=Number(json.expires_in);
  cached={key,token:json.access_token,expiry:Date.now()+(Number.isFinite(seconds)?Math.max(120,seconds-60):3000)*1000};
  return cached.token;
}
async function getItems(endpoint,params,fetchImpl=fetch,env=process.env){
  if(!['channels','playlists'].includes(endpoint))throw Error('Nieobsługiwana operacja YouTube API.');
  const token=await accessToken(fetchImpl,env);
  const url=new URL(endpoint,DATA_URL);
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,String(value));
  const res=await fetchImpl(url.toString(),{headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw Error('YouTube Data API: HTTP '+res.status+'. Sprawdź YouTube Data API v3 i zakres youtube.readonly.');
  const json=await res.json();
  if(!json||!Array.isArray(json.items))throw Error('YouTube Data API zwróciło niepoprawne dane.');
  return json.items;
}
async function account(fetchImpl=fetch,env=process.env){
  const items=await getItems('channels',{part:'snippet',mine:true,maxResults:1},fetchImpl,env);
  const x=items[0];
  return x?{id:String(x.id||'').slice(0,80),title:String(x.snippet?.title||'Kanał YouTube').slice(0,120)}:
    {id:'',title:'Nie znaleziono kanału YouTube.'};
}
async function playlists(fetchImpl=fetch,env=process.env){
  const items=await getItems('playlists',{part:'snippet,contentDetails',mine:true,maxResults:15},fetchImpl,env);
  return items.map(x=>({id:String(x.id||'').slice(0,80),title:String(x.snippet?.title||'Playlista').slice(0,120),
    count:Number.isInteger(x.contentDetails?.itemCount)?x.contentDetails.itemCount:null}));
}
module.exports={config,accessToken,account,playlists,clearCache};
